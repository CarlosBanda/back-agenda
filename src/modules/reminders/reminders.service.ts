import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import { sanitizeErrorMessage } from '../../common/utils/error-sanitizer';
import {
  Appointment,
  AppointmentStatus,
} from '../appointments/entities/appointment.entity';
import { BusinessService } from '../business/business.service';
import { Role } from '../users/entities/user.entity';
import { UpsertReminderSettingDto } from './dto/reminder.dto';
import { ReminderSetting } from './entities/reminder-setting.entity';
import {
  ReminderAttemptStatus,
  WhatsappReminderAttempt,
} from './entities/whatsapp-reminder-attempt.entity';
import { WhatsAppProviderService } from './whatsapp-provider.service';

const DEFAULT_TEMPLATE =
  'Hola {cliente}, te recordamos tu cita en {negocio} el {fecha} a las {hora}. ¡Te esperamos!';

export type ReminderSettingsResponse = ReminderSetting & {
  providerEnabled: boolean;
};

export interface ReminderOutcome {
  appointmentId: number;
  status: ReminderAttemptStatus;
  reason?: string;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(ReminderSetting)
    private readonly settingRepo: Repository<ReminderSetting>,
    @InjectRepository(WhatsappReminderAttempt)
    private readonly attemptRepo: Repository<WhatsappReminderAttempt>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly businessService: BusinessService,
    private readonly provider: WhatsAppProviderService,
  ) {}

  async getSettings(
    businessId: number,
    userId: number,
    role: Role,
  ): Promise<ReminderSettingsResponse> {
    await this.businessService.assertCanManage(businessId, userId, role);
    return this.withProviderStatus(await this.getOrDefault(businessId));
  }

  async upsertSettings(
    businessId: number,
    dto: UpsertReminderSettingDto,
    userId: number,
    role: Role,
  ): Promise<ReminderSettingsResponse> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const setting = await this.getOrDefault(businessId);
    if (dto.whatsappEnabled !== undefined) {
      setting.whatsappEnabled = dto.whatsappEnabled;
    }
    if (dto.hoursBefore !== undefined) setting.hoursBefore = dto.hoursBefore;
    if (dto.messageTemplate !== undefined) {
      setting.messageTemplate = dto.messageTemplate.trim() || null;
    }
    return this.withProviderStatus(await this.settingRepo.save(setting));
  }

  async listAttempts(
    businessId: number,
    userId: number,
    role: Role,
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<WhatsappReminderAttempt>> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const [data, total] = await this.attemptRepo.findAndCount({
      where: { businessId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async sendNow(
    appointmentId: number,
    userId: number,
    role: Role,
  ): Promise<ReminderOutcome> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['client', 'clientRecord', 'business'],
    });
    if (!appointment) {
      return {
        appointmentId,
        status: ReminderAttemptStatus.SKIPPED,
        reason: 'Appointment not found',
      };
    }
    await this.businessService.assertCanManage(
      appointment.businessId,
      userId,
      role,
    );
    const setting = await this.getOrDefault(appointment.businessId);
    return this.attemptReminder(appointment, setting, true);
  }

  /**
   * Global gate first: if WHATSAPP_ENABLED is false the cron never scans and
   * never emits outbound traffic.
   */
  async scanAndSend(): Promise<void> {
    if (!this.provider.isEnabled()) return;
    const settings = await this.settingRepo.find({
      where: { whatsappEnabled: true },
    });
    for (const setting of settings) {
      const appointments = await this.dueAppointments(setting);
      for (const appointment of appointments) {
        try {
          await this.attemptReminder(appointment, setting, false);
        } catch (error) {
          this.logger.warn(
            `Reminder scan error for appointment ${appointment.id}: ${sanitizeErrorMessage(error, 200)}`,
          );
        }
      }
    }
  }

  private async attemptReminder(
    appointment: Appointment,
    setting: ReminderSetting,
    persistSkip: boolean,
  ): Promise<ReminderOutcome> {
    const idempotencyKey = `appt:${appointment.id}:${appointment.date}:${appointment.startTime}:${setting.hoursBefore}`;

    // Gate: both the platform flag and the business opt-in must be enabled.
    if (!this.provider.isEnabled() || !setting.whatsappEnabled) {
      if (persistSkip) {
        await this.persistAttempt(
          appointment,
          idempotencyKey,
          ReminderAttemptStatus.SKIPPED,
          null,
          'WhatsApp reminders are disabled',
        );
      }
      return {
        appointmentId: appointment.id,
        status: ReminderAttemptStatus.SKIPPED,
        reason: 'WhatsApp reminders are disabled',
      };
    }

    // Reserve the deterministic key before any outbound call. A unique insert
    // plus a conditional FAILED/SKIPPED -> PENDING transition guarantees that
    // only one worker owns a new attempt or retry.
    const claim = await this.claimAttempt(appointment, idempotencyKey);
    if (!claim.claimed) {
      return {
        appointmentId: appointment.id,
        status: claim.status,
        reason: 'Already processed',
      };
    }

    const phone =
      appointment.clientRecord?.phone ?? appointment.client?.phone ?? null;
    if (!phone) {
      await this.completeAttempt(
        idempotencyKey,
        ReminderAttemptStatus.FAILED,
        null,
        'No recipient phone on file',
      );
      return {
        appointmentId: appointment.id,
        status: ReminderAttemptStatus.FAILED,
        reason: 'No recipient phone on file',
      };
    }

    const message = this.renderMessage(setting, appointment);
    try {
      const { providerMessageId } = await this.provider.send({
        to: phone,
        message,
        idempotencyKey,
      });
      await this.completeAttempt(
        idempotencyKey,
        ReminderAttemptStatus.SENT,
        providerMessageId,
        null,
      );
      return {
        appointmentId: appointment.id,
        status: ReminderAttemptStatus.SENT,
      };
    } catch (error) {
      await this.completeAttempt(
        idempotencyKey,
        ReminderAttemptStatus.FAILED,
        null,
        sanitizeErrorMessage(error, 300),
      );
      return {
        appointmentId: appointment.id,
        status: ReminderAttemptStatus.FAILED,
        reason: 'Provider error',
      };
    }
  }

  private async claimAttempt(
    appointment: Appointment,
    idempotencyKey: string,
  ): Promise<{ claimed: boolean; status: ReminderAttemptStatus }> {
    try {
      await this.attemptRepo.insert(
        this.attemptRepo.create({
          appointmentId: appointment.id,
          businessId: appointment.businessId,
          idempotencyKey,
          status: ReminderAttemptStatus.PENDING,
          providerMessageId: null,
          sanitizedError: null,
        }),
      );
      return { claimed: true, status: ReminderAttemptStatus.PENDING };
    } catch (error) {
      if (!this.isDuplicateKey(error)) throw error;
    }

    const reclaimed = await this.attemptRepo.update(
      {
        idempotencyKey,
        status: In([
          ReminderAttemptStatus.FAILED,
          ReminderAttemptStatus.SKIPPED,
        ]),
      },
      {
        status: ReminderAttemptStatus.PENDING,
        providerMessageId: null,
        sanitizedError: null,
      },
    );
    if ((reclaimed.affected ?? 0) > 0) {
      return { claimed: true, status: ReminderAttemptStatus.PENDING };
    }

    const existing = await this.attemptRepo.findOne({
      where: { idempotencyKey },
    });
    return {
      claimed: false,
      status: existing?.status ?? ReminderAttemptStatus.PENDING,
    };
  }

  private async completeAttempt(
    idempotencyKey: string,
    status: ReminderAttemptStatus,
    providerMessageId: string | null,
    sanitizedError: string | null,
  ): Promise<void> {
    await this.attemptRepo.update(
      { idempotencyKey, status: ReminderAttemptStatus.PENDING },
      { status, providerMessageId, sanitizedError },
    );
  }

  private isDuplicateKey(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as {
      code?: unknown;
      errno?: unknown;
      driverError?: { code?: unknown; errno?: unknown };
    };
    return (
      candidate.code === 'ER_DUP_ENTRY' ||
      candidate.errno === 1062 ||
      candidate.driverError?.code === 'ER_DUP_ENTRY' ||
      candidate.driverError?.errno === 1062
    );
  }

  private async persistAttempt(
    appointment: Appointment,
    idempotencyKey: string,
    status: ReminderAttemptStatus,
    providerMessageId: string | null,
    sanitizedError: string | null,
  ): Promise<void> {
    const existing = await this.attemptRepo.findOne({
      where: { idempotencyKey },
    });
    const attempt =
      existing ??
      this.attemptRepo.create({
        appointmentId: appointment.id,
        businessId: appointment.businessId,
        idempotencyKey,
      });
    attempt.status = status;
    attempt.providerMessageId = providerMessageId;
    attempt.sanitizedError = sanitizedError;
    await this.attemptRepo.save(attempt);
  }

  private renderMessage(
    setting: ReminderSetting,
    appointment: Appointment,
  ): string {
    const template = setting.messageTemplate || DEFAULT_TEMPLATE;
    const clientName =
      appointment.clientRecord?.name ?? appointment.client?.name ?? 'cliente';
    const businessName = appointment.business?.name ?? 'tu negocio';
    const time = appointment.startTime.substring(0, 5);
    const replacements: Record<string, string> = {
      cliente: clientName,
      negocio: businessName,
      fecha: appointment.date,
      hora: time,
      date: appointment.date,
      time,
    };
    return template.replace(
      /\{(cliente|negocio|fecha|hora|date|time)\}/g,
      (_match, key: string) => replacements[key],
    );
  }

  private withProviderStatus(
    setting: ReminderSetting,
  ): ReminderSettingsResponse {
    return Object.assign(setting, {
      providerEnabled: this.provider.isEnabled(),
    });
  }

  private async dueAppointments(
    setting: ReminderSetting,
  ): Promise<Appointment[]> {
    const now = new Date();
    const horizon = new Date(now.getTime() + setting.hoursBefore * 3_600_000);
    const fromDate = now.toISOString().split('T')[0];
    const toDate = horizon.toISOString().split('T')[0];
    const candidates = await this.appointmentRepo.find({
      where: {
        businessId: setting.businessId,
        date: Between(fromDate, toDate),
      },
      relations: ['client', 'clientRecord', 'business'],
    });
    return candidates.filter((appointment) => {
      if (
        appointment.status !== AppointmentStatus.PENDING &&
        appointment.status !== AppointmentStatus.CONFIRMED
      ) {
        return false;
      }
      const start = new Date(
        `${appointment.date}T${appointment.startTime}.000Z`,
      );
      return start.getTime() >= now.getTime() && start <= horizon;
    });
  }

  private async getOrDefault(businessId: number): Promise<ReminderSetting> {
    const existing = await this.settingRepo.findOne({ where: { businessId } });
    if (existing) return existing;
    return this.settingRepo.create({
      businessId,
      whatsappEnabled: false,
      hoursBefore: 24,
      messageTemplate: null,
    });
  }
}
