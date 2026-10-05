import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AppointmentsService } from '../appointments/appointments.service';
import {
  Appointment,
  AppointmentStatus,
  DepositStatus,
} from '../appointments/entities/appointment.entity';
import { BusinessService } from '../business/business.service';
import { PoliciesService } from '../policies/policies.service';
import { ServicesService } from '../services/services.service';
import { Role } from '../users/entities/user.entity';
import {
  AgendaRangeDto,
  DepositDto,
  QuickAction,
  QuickActionDto,
} from './dto/agenda.dto';

const MAX_RANGE_DAYS = 62;

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    private readonly businessService: BusinessService,
    private readonly appointmentsService: AppointmentsService,
    private readonly policiesService: PoliciesService,
    private readonly servicesService: ServicesService,
  ) {}

  async getRange(
    businessId: number,
    query: AgendaRangeDto,
    userId: number,
    role: Role,
  ): Promise<{
    businessId: number;
    from: string;
    to: string;
    total: number;
    appointments: Appointment[];
  }> {
    await this.businessService.assertCanManage(businessId, userId, role);
    this.assertRange(query.from, query.to);
    const where: Record<string, unknown> = {
      businessId,
      date: Between(query.from, query.to),
    };
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status;
    const appointments = await this.repo.find({
      where,
      relations: ['client', 'clientRecord', 'service', 'staff'],
      order: { date: 'ASC', startTime: 'ASC' },
    });
    return {
      businessId,
      from: query.from,
      to: query.to,
      total: appointments.length,
      appointments,
    };
  }

  async getDay(
    businessId: number,
    date: string,
    staffId: number | undefined,
    userId: number,
    role: Role,
  ) {
    return this.getRange(
      businessId,
      { from: date, to: date, staffId },
      userId,
      role,
    );
  }

  async getWeek(
    businessId: number,
    date: string,
    staffId: number | undefined,
    userId: number,
    role: Role,
  ) {
    const { from, to } = this.weekBounds(date);
    return this.getRange(businessId, { from, to, staffId }, userId, role);
  }

  async quickAction(
    id: number,
    dto: QuickActionDto,
    userId: number,
    role: Role,
  ): Promise<Appointment> {
    const status = this.actionToStatus(dto.action);
    return this.appointmentsService.updateStatus(id, status, userId, role);
  }

  async setDeposit(
    id: number,
    dto: DepositDto,
    userId: number,
    role: Role,
  ): Promise<Appointment> {
    const appointment = await this.requireManaged(id, userId, role);
    if (
      appointment.depositStatus === DepositStatus.PAID &&
      dto.status !== DepositStatus.PAID &&
      dto.status !== DepositStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'A paid deposit can only remain paid or be refunded',
      );
    }
    if (
      appointment.depositStatus === DepositStatus.REFUNDED &&
      dto.status !== DepositStatus.REFUNDED
    ) {
      throw new BadRequestException('A refunded deposit cannot be reopened');
    }
    appointment.depositStatus = dto.status;
    if (dto.amount !== undefined) {
      appointment.depositAmount = dto.amount.toFixed(2);
    }
    if (dto.method !== undefined) {
      appointment.depositMethod = dto.method.trim() || null;
    }
    if (dto.note !== undefined) {
      appointment.depositNote = dto.note.trim() || null;
    }

    if (dto.status === DepositStatus.PAID) {
      const paid =
        dto.paidAmount ??
        dto.amount ??
        (appointment.depositAmount != null
          ? Number(appointment.depositAmount)
          : 0);
      const required = Number(appointment.depositAmount ?? 0);
      if (paid <= 0) {
        throw new BadRequestException(
          'A positive paid amount is required to mark a deposit as paid',
        );
      }
      if (required > 0 && paid > required) {
        throw new BadRequestException(
          'Paid amount cannot exceed the required deposit amount',
        );
      }
      appointment.depositPaidAmount = paid.toFixed(2);
      appointment.depositPaidAt = appointment.depositPaidAt ?? new Date();
    } else if (dto.status === DepositStatus.REFUNDED) {
      if (
        appointment.depositPaidAmount == null ||
        Number(appointment.depositPaidAmount) <= 0
      ) {
        throw new BadRequestException(
          'Only a paid deposit can be marked as refunded',
        );
      }
    } else {
      appointment.depositPaidAmount = null;
      appointment.depositPaidAt = null;
    }
    return this.repo.save(appointment);
  }

  /**
   * Derives the required advance-payment amount from the business policy and
   * the appointment's service price, marking the deposit as PENDING.
   */
  async applyPolicyDeposit(
    id: number,
    userId: number,
    role: Role,
  ): Promise<Appointment> {
    const appointment = await this.requireManaged(id, userId, role);
    if (
      appointment.depositStatus === DepositStatus.PAID ||
      appointment.depositStatus === DepositStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Cannot recalculate a paid or refunded deposit',
      );
    }
    const policy = await this.policiesService.getOrDefault(
      appointment.businessId,
    );
    const service = await this.servicesService.findOne(appointment.serviceId);
    const required = this.policiesService.computeDeposit(
      policy,
      Number(service.price),
    );
    appointment.depositAmount = required;
    appointment.depositStatus =
      Number(required) > 0 ? DepositStatus.PENDING : DepositStatus.NOT_REQUIRED;
    return this.repo.save(appointment);
  }

  private async requireManaged(
    id: number,
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
    return appointment;
  }

  private actionToStatus(action: QuickAction): AppointmentStatus {
    switch (action) {
      case QuickAction.CONFIRM:
        return AppointmentStatus.CONFIRMED;
      case QuickAction.COMPLETE:
        return AppointmentStatus.COMPLETED;
      case QuickAction.CANCEL:
        return AppointmentStatus.CANCELLED;
      case QuickAction.NO_SHOW:
        return AppointmentStatus.NO_SHOW;
    }
  }

  private assertRange(from: string, to: string): void {
    if (to < from) {
      throw new BadRequestException('"to" must be on or after "from"');
    }
    const fromMs = new Date(`${from}T00:00:00.000Z`).getTime();
    const toMs = new Date(`${to}T00:00:00.000Z`).getTime();
    const spanDays = Math.round((toMs - fromMs) / 86_400_000) + 1;
    if (spanDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
      );
    }
  }

  private weekBounds(date: string): { from: string; to: string } {
    const base = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(base.getTime())) {
      throw new BadRequestException('date must be a valid YYYY-MM-DD');
    }
    const day = base.getUTCDay(); // 0 = Sunday
    const offsetToMonday = (day + 6) % 7;
    const monday = new Date(base);
    monday.setUTCDate(base.getUTCDate() - offsetToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: monday.toISOString().split('T')[0],
      to: sunday.toISOString().split('T')[0],
    };
  }
}
