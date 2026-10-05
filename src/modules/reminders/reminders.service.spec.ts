import type { Repository } from 'typeorm';
import type { Appointment } from '../appointments/entities/appointment.entity';
import { AppointmentStatus } from '../appointments/entities/appointment.entity';
import type { BusinessService } from '../business/business.service';
import { Role } from '../users/entities/user.entity';
import { RemindersService } from './reminders.service';
import { ReminderSetting } from './entities/reminder-setting.entity';
import {
  ReminderAttemptStatus,
  WhatsappReminderAttempt,
} from './entities/whatsapp-reminder-attempt.entity';
import type { WhatsAppProviderService } from './whatsapp-provider.service';

function buildService(options: {
  providerEnabled: boolean;
  whatsappEnabled: boolean;
  existingAttempt?: Partial<WhatsappReminderAttempt> | null;
}) {
  const appointment = {
    id: 55,
    businessId: 9,
    date: '2026-09-01',
    startTime: '10:00:00',
    status: AppointmentStatus.CONFIRMED,
    client: { name: 'Ana', phone: '5512345678' },
    clientRecord: null,
    business: { name: 'Salón Demo' },
  } as unknown as Appointment;

  const appointmentRepo = {
    findOne: jest.fn().mockResolvedValue(appointment),
  } as unknown as Repository<Appointment>;

  const attemptSave = jest.fn((value: WhatsappReminderAttempt) =>
    Promise.resolve(value),
  );
  const attemptInsert = options.existingAttempt
    ? jest.fn().mockRejectedValue({ code: 'ER_DUP_ENTRY' })
    : jest.fn().mockResolvedValue({ identifiers: [] });
  const reclaimable =
    options.existingAttempt?.status === ReminderAttemptStatus.FAILED ||
    options.existingAttempt?.status === ReminderAttemptStatus.SKIPPED;
  const attemptUpdate = jest
    .fn()
    .mockResolvedValue({ affected: reclaimable ? 1 : 0 });
  const attemptRepo = {
    findOne: jest.fn().mockResolvedValue(options.existingAttempt ?? null),
    create: jest.fn(
      (value: Partial<WhatsappReminderAttempt>) =>
        value as WhatsappReminderAttempt,
    ),
    insert: attemptInsert,
    update: attemptUpdate,
    save: attemptSave,
  } as unknown as Repository<WhatsappReminderAttempt>;

  const setting = {
    businessId: 9,
    whatsappEnabled: options.whatsappEnabled,
    hoursBefore: 24,
    messageTemplate: null,
  } as ReminderSetting;
  const settingRepo = {
    findOne: jest.fn().mockResolvedValue(setting),
    create: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<ReminderSetting>;

  const send = jest.fn().mockResolvedValue({ providerMessageId: 'wamid.1' });
  const provider = {
    isEnabled: jest.fn().mockReturnValue(options.providerEnabled),
    send,
  } as unknown as WhatsAppProviderService;

  const businessService = {
    assertCanManage: jest.fn().mockResolvedValue(undefined),
  } as unknown as BusinessService;

  const service = new RemindersService(
    settingRepo,
    attemptRepo,
    appointmentRepo,
    businessService,
    provider,
  );
  return { service, send, attemptSave, attemptInsert, attemptUpdate };
}

describe('RemindersService gating', () => {
  it('never sends when the platform flag is disabled', async () => {
    const { service, send, attemptSave } = buildService({
      providerEnabled: false,
      whatsappEnabled: true,
    });

    const outcome = await service.sendNow(55, 1, Role.BUSINESS);

    expect(send).not.toHaveBeenCalled();
    expect(outcome.status).toBe(ReminderAttemptStatus.SKIPPED);
    // Persisted as SKIPPED for observability on the manual path.
    expect(attemptSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: ReminderAttemptStatus.SKIPPED }),
    );
  });

  it('never sends when the business has not opted in', async () => {
    const { service, send } = buildService({
      providerEnabled: true,
      whatsappEnabled: false,
    });

    const outcome = await service.sendNow(55, 1, Role.BUSINESS);

    expect(send).not.toHaveBeenCalled();
    expect(outcome.status).toBe(ReminderAttemptStatus.SKIPPED);
  });

  it('claims atomically before sending and completes the attempt', async () => {
    const { service, send, attemptInsert, attemptUpdate } = buildService({
      providerEnabled: true,
      whatsappEnabled: true,
    });

    const outcome = await service.sendNow(55, 1, Role.BUSINESS);

    expect(attemptInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: ReminderAttemptStatus.PENDING }),
    );
    expect(attemptInsert.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0],
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      to: '5512345678',
      message:
        'Hola Ana, te recordamos tu cita en Salón Demo el 2026-09-01 a las 10:00. ¡Te esperamos!',
      idempotencyKey: 'appt:55:2026-09-01:10:00:00:24',
    });
    expect(outcome.status).toBe(ReminderAttemptStatus.SENT);
    expect(attemptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ReminderAttemptStatus.PENDING,
      }),
      expect.objectContaining({
        status: ReminderAttemptStatus.SENT,
        providerMessageId: 'wamid.1',
      }),
    );
  });

  it('is idempotent: does not resend an already sent reminder', async () => {
    const { service, send } = buildService({
      providerEnabled: true,
      whatsappEnabled: true,
      existingAttempt: { status: ReminderAttemptStatus.SENT },
    });

    const outcome = await service.sendNow(55, 1, Role.BUSINESS);

    expect(send).not.toHaveBeenCalled();
    expect(outcome.status).toBe(ReminderAttemptStatus.SENT);
  });

  it('does not send when another worker already owns the pending claim', async () => {
    const { service, send, attemptInsert, attemptUpdate } = buildService({
      providerEnabled: true,
      whatsappEnabled: true,
      existingAttempt: { status: ReminderAttemptStatus.PENDING },
    });

    const outcome = await service.sendNow(55, 1, Role.BUSINESS);

    expect(attemptInsert).toHaveBeenCalledTimes(1);
    expect(attemptUpdate).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(outcome.status).toBe(ReminderAttemptStatus.PENDING);
  });

  it('reports the global provider gate without exposing credentials', async () => {
    const { service } = buildService({
      providerEnabled: false,
      whatsappEnabled: true,
    });

    const settings = await service.getSettings(9, 1, Role.BUSINESS);

    expect(settings).toEqual(
      expect.objectContaining({
        businessId: 9,
        whatsappEnabled: true,
        providerEnabled: false,
      }),
    );
    expect(settings).not.toHaveProperty('token');
  });
});
