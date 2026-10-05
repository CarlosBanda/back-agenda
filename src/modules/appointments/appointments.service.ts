import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
  DepositStatus,
} from './entities/appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ServicesService } from '../services/services.service';
import { ScheduleService } from '../schedule/schedule.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DayOfWeek } from '../schedule/entities/schedule.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BusinessService } from '../business/business.service';
import { StaffService } from '../staff/staff.service';
import { Role } from '../users/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { PoliciesService } from '../policies/policies.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly servicesService: ServicesService,
    private readonly scheduleService: ScheduleService,
    private readonly notificationsService: NotificationsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly businessService: BusinessService,
    private readonly staffService: StaffService,
    private readonly policiesService: PoliciesService,
  ) {}

  async create(
    dto: CreateAppointmentDto,
    clientId: number,
  ): Promise<Appointment> {
    const service = await this.servicesService.findOne(dto.serviceId);
    await this.assertAppointmentRelations(
      dto,
      service.businessId,
      service.isActive,
    );
    await this.assertAppointmentQuota(dto.businessId, dto.date);

    // Calcular hora de fin basada en la duración del servicio
    const endTime = this.addMinutes(dto.startTime, service.duration);

    // Validar disponibilidad
    await this.validateAvailability(
      dto.businessId,
      dto.staffId,
      dto.date,
      dto.startTime,
      endTime,
    );

    const deposit = await this.depositFromPolicy(
      dto.businessId,
      Number(service.price),
    );
    const appointment = this.repo.create({
      ...dto,
      clientId,
      endTime,
      status: AppointmentStatus.PENDING,
      ...deposit,
    });

    const saved = await this.repo.save(appointment);

    // Enviar notificaciones (async, no bloquea)
    if (saved.clientId != null) {
      this.notificationsService.sendAppointmentCreated(saved).catch(() => {});
    }

    return saved;
  }

  async findByClient(clientId: number, page = 1, limit = 10) {
    const [data, total] = await this.repo.findAndCount({
      where: { clientId },
      relations: ['business', 'service', 'staff'],
      order: { date: 'DESC', startTime: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByBusiness(
    businessId: number,
    userId: number,
    role: Role,
    page = 1,
    limit = 10,
  ) {
    await this.businessService.assertCanManage(businessId, userId, role);
    const [data, total] = await this.repo.findAndCount({
      where: { businessId },
      relations: ['client', 'service', 'staff'],
      order: { date: 'ASC', startTime: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByBusinessAndDate(
    businessId: number,
    date: string,
    userId: number,
    role: Role,
  ): Promise<Appointment[]> {
    await this.businessService.assertCanManage(businessId, userId, role);
    return this.repo.find({
      where: { businessId, date },
      relations: ['client', 'service', 'staff'],
      order: { startTime: 'ASC' },
    });
  }

  async updateStatus(
    id: number,
    status: AppointmentStatus,
    userId: number,
    role: Role,
  ): Promise<Appointment> {
    const appointment = await this.repo.findOne({ where: { id } });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.businessService.assertCanManage(
      appointment.businessId,
      userId,
      role,
    );
    const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      [AppointmentStatus.PENDING]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.CONFIRMED]: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.CANCELLED]: [],
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.NO_SHOW]: [],
    };
    if (
      status !== appointment.status &&
      !allowedTransitions[appointment.status].includes(status)
    ) {
      throw new BadRequestException('Invalid appointment status transition');
    }
    appointment.status = status;
    return this.repo.save(appointment);
  }

  async cancel(id: number, userId: number, role: Role): Promise<Appointment> {
    const appointment = await this.repo.findOne({ where: { id } });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.status === AppointmentStatus.CANCELLED) return appointment;
    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'Completed appointments cannot be cancelled',
      );
    }

    if (appointment.clientId !== userId) {
      if (role !== Role.BUSINESS && role !== Role.ADMIN) {
        throw new ForbiddenException(
          'No permission to cancel this appointment',
        );
      }
      await this.businessService.assertCanManage(
        appointment.businessId,
        userId,
        role,
      );
    }

    appointment.status = AppointmentStatus.CANCELLED;
    const saved = await this.repo.save(appointment);
    this.notificationsService.sendAppointmentCancelled(saved).catch(() => {});
    return saved;
  }

  // Citas creadas por el negocio directamente
  async createByBusiness(
    dto: CreateAppointmentDto,
    clientId: number | null,
    clientRecordId: number | null,
    userId: number,
    role: Role,
  ): Promise<Appointment> {
    await this.businessService.assertCanManage(dto.businessId, userId, role);

    let resolvedClientId: number | null = clientId ?? null;
    const resolvedRecordId: number | null = clientRecordId ?? null;
    if (resolvedRecordId != null) {
      const client = await this.clientRepo.findOne({
        where: { id: resolvedRecordId },
      });
      if (!client || !client.isActive || client.businessId !== dto.businessId) {
        throw new BadRequestException(
          'Client record does not belong to this business',
        );
      }
      // Linked clients also anchor the appointment to their user account.
      if (client.linkedUserId != null) resolvedClientId = client.linkedUserId;
    } else if (resolvedClientId == null) {
      throw new BadRequestException(
        'Either clientId or clientRecordId is required',
      );
    }

    const service = await this.servicesService.findOne(dto.serviceId);
    await this.assertAppointmentRelations(
      dto,
      service.businessId,
      service.isActive,
    );
    await this.assertAppointmentQuota(dto.businessId, dto.date);
    const endTime = this.addMinutes(dto.startTime, service.duration);
    await this.validateAvailability(
      dto.businessId,
      dto.staffId,
      dto.date,
      dto.startTime,
      endTime,
    );

    const deposit = await this.depositFromPolicy(
      dto.businessId,
      Number(service.price),
    );
    const appointment = this.repo.create({
      ...dto,
      clientId: resolvedClientId,
      clientRecordId: resolvedRecordId,
      endTime,
      status: AppointmentStatus.CONFIRMED,
      ...deposit,
    });

    return this.repo.save(appointment);
  }

  async getAvailableSlots(
    businessId: number,
    date: string,
    serviceId: number,
    staffId?: number,
  ) {
    const service = await this.servicesService.findOne(serviceId);
    await this.assertAppointmentRelations(
      { businessId, staffId },
      service.businessId,
      service.isActive,
    );
    const dayOfWeek = this.getDayOfWeek(date);

    const schedules = staffId
      ? await this.scheduleService.findByStaff(staffId)
      : await this.scheduleService.findByBusiness(businessId);

    const daySchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
    if (!daySchedule) return [];

    const blockedSlots = await this.scheduleService.findBlockedSlots(
      businessId,
      date,
    );
    const appointments = await this.repo.find({
      where: {
        businessId,
        date,
        ...(staffId && { staffId }),
        status: In([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
      },
    });

    // Generar slots cada X minutos (duración del servicio)
    const slots: { startTime: string; endTime: string }[] = [];
    let current = daySchedule.startTime.substring(0, 5);
    const scheduleEnd = daySchedule.endTime.substring(0, 5);

    while (true) {
      const end = this.addMinutes(current, service.duration);
      if (end > scheduleEnd) break;

      const isBlocked = blockedSlots.some((blocked) => {
        const blockedStart = blocked.startTime.substring(0, 5);
        const blockedEnd = blocked.endTime.substring(0, 5);
        return current < blockedEnd && end > blockedStart;
      });
      const isTaken = appointments.some((appointment) => {
        const appointmentStart = appointment.startTime.substring(0, 5);
        const appointmentEnd = appointment.endTime.substring(0, 5);
        return current < appointmentEnd && end > appointmentStart;
      });

      if (!isBlocked && !isTaken) {
        slots.push({ startTime: current, endTime: end });
      }

      current = this.addMinutes(current, service.duration);
    }

    return slots;
  }

  private async assertAppointmentRelations(
    dto: Pick<CreateAppointmentDto, 'businessId' | 'staffId'>,
    serviceBusinessId: number,
    serviceIsActive: boolean,
  ): Promise<void> {
    if (!serviceIsActive || serviceBusinessId !== dto.businessId) {
      throw new BadRequestException('Service does not belong to this business');
    }
    if (!dto.staffId) return;
    const staff = await this.staffService.findOne(dto.staffId);
    if (!staff.isActive || staff.businessId !== dto.businessId) {
      throw new BadRequestException('Staff does not belong to this business');
    }
  }

  private async assertAppointmentQuota(
    businessId: number,
    date: string,
  ): Promise<void> {
    const monthStart = `${date.slice(0, 7)}-01`;
    const nextMonth = new Date(`${monthStart}T00:00:00.000Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    nextMonth.setUTCDate(nextMonth.getUTCDate() - 1);
    const monthEnd = nextMonth.toISOString().split('T')[0];
    const currentUsage = await this.repo.count({
      where: {
        businessId,
        date: Between(monthStart, monthEnd),
        status: Not(AppointmentStatus.CANCELLED),
      },
    });
    await this.subscriptionsService.assertQuota(
      businessId,
      'maxAppointmentsPerMonth',
      currentUsage,
    );
  }

  private async validateAvailability(
    businessId: number,
    staffId: number | undefined,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    // Verificar horario del negocio
    const dayOfWeek = this.getDayOfWeek(date);
    const schedules = staffId
      ? await this.scheduleService.findByStaff(staffId)
      : await this.scheduleService.findByBusiness(businessId);

    const daySchedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
    if (!daySchedule)
      throw new BadRequestException('Business is closed on this day');
    const scheduleStart = daySchedule.startTime.substring(0, 5);
    const scheduleEnd = daySchedule.endTime.substring(0, 5);
    if (startTime < scheduleStart || endTime > scheduleEnd) {
      throw new BadRequestException('Time is outside business hours');
    }

    // Verificar horarios bloqueados
    const blockedSlots = await this.scheduleService.findBlockedSlots(
      businessId,
      date,
    );
    const isBlocked = blockedSlots.some((blocked) => {
      const blockedStart = blocked.startTime.substring(0, 5);
      const blockedEnd = blocked.endTime.substring(0, 5);
      return startTime < blockedEnd && endTime > blockedStart;
    });
    if (isBlocked) throw new BadRequestException('This time slot is blocked');

    // Verificar si ya hay cita en ese horario
    const conflictQuery = this.repo
      .createQueryBuilder('appointment')
      .where('appointment.businessId = :businessId', { businessId })
      .andWhere('appointment.date = :date', { date })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
      })
      .andWhere('appointment.startTime < :endTime', { endTime })
      .andWhere('appointment.endTime > :startTime', { startTime });
    if (staffId) {
      conflictQuery.andWhere('appointment.staffId = :staffId', { staffId });
    }
    const existing = await conflictQuery.getOne();
    if (existing) {
      throw new BadRequestException('Time slot already taken');
    }
  }

  private async depositFromPolicy(
    businessId: number,
    servicePrice: number,
  ): Promise<Pick<Appointment, 'depositAmount' | 'depositStatus'>> {
    const policy = await this.policiesService.getOrDefault(businessId);
    const amount = this.policiesService.computeDeposit(policy, servicePrice);
    return {
      depositAmount: Number(amount) > 0 ? amount : null,
      depositStatus:
        Number(amount) > 0 ? DepositStatus.PENDING : DepositStatus.NOT_REQUIRED,
    };
  }

  private getDayOfWeek(date: string): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[new Date(`${date}T00:00:00.000Z`).getUTCDay()];
  }

  private addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const newM = (total % 60).toString().padStart(2, '0');
    return `${newH}:${newM}`;
  }
}
