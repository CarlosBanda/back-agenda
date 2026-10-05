import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { BusinessService } from '../business/business.service';
import type { Client } from '../crm/entities/client.entity';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PoliciesService } from '../policies/policies.service';
import type { ScheduleService } from '../schedule/schedule.service';
import { DayOfWeek } from '../schedule/entities/schedule.entity';
import type { ServicesService } from '../services/services.service';
import type { StaffService } from '../staff/staff.service';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AppointmentsService } from './appointments.service';
import {
  Appointment,
  AppointmentStatus,
  DepositStatus,
} from './entities/appointment.entity';

describe('AppointmentsService policy deposits', () => {
  it('snapshots the required manual deposit when a client books', async () => {
    const queryBuilder = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);

    const appointmentRepo = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(
          queryBuilder as unknown as SelectQueryBuilder<Appointment>,
        ),
      create: jest.fn((value: Partial<Appointment>) => value as Appointment),
      save: jest.fn((value: Appointment) =>
        Promise.resolve({ ...value, id: 88 } as Appointment),
      ),
    } as unknown as Repository<Appointment>;
    const servicesService = {
      findOne: jest.fn().mockResolvedValue({
        id: 5,
        businessId: 9,
        isActive: true,
        duration: 60,
        price: 500,
      }),
    } as unknown as ServicesService;
    const scheduleService = {
      findByBusiness: jest.fn().mockResolvedValue([
        {
          dayOfWeek: DayOfWeek.TUESDAY,
          startTime: '09:00:00',
          endTime: '18:00:00',
        },
      ]),
      findBlockedSlots: jest.fn().mockResolvedValue([]),
    } as unknown as ScheduleService;
    const notificationsService = {
      sendAppointmentCreated: jest.fn().mockResolvedValue(undefined),
    } as unknown as NotificationsService;
    const subscriptionsService = {
      assertQuota: jest.fn().mockResolvedValue(undefined),
    } as unknown as SubscriptionsService;
    const computeDeposit = jest.fn().mockReturnValue('100.00');
    const policiesService = {
      getOrDefault: jest.fn().mockResolvedValue({ businessId: 9 }),
      computeDeposit,
    } as unknown as PoliciesService;

    const service = new AppointmentsService(
      appointmentRepo,
      {} as Repository<Client>,
      servicesService,
      scheduleService,
      notificationsService,
      subscriptionsService,
      {} as BusinessService,
      {} as StaffService,
      policiesService,
    );

    const result = await service.create(
      {
        businessId: 9,
        serviceId: 5,
        date: '2026-09-01',
        startTime: '10:00',
      },
      3,
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 88,
        clientId: 3,
        status: AppointmentStatus.PENDING,
        depositStatus: DepositStatus.PENDING,
        depositAmount: '100.00',
      }),
    );
    expect(computeDeposit).toHaveBeenCalledWith({ businessId: 9 }, 500);
  });
});
