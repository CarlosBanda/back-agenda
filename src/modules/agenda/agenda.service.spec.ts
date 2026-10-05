import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { AppointmentsService } from '../appointments/appointments.service';
import {
  Appointment,
  AppointmentStatus,
  DepositStatus,
} from '../appointments/entities/appointment.entity';
import type { BusinessService } from '../business/business.service';
import type { PoliciesService } from '../policies/policies.service';
import type { ServicesService } from '../services/services.service';
import { Role } from '../users/entities/user.entity';
import { AgendaService } from './agenda.service';

function buildService(appointmentOverrides: Partial<Appointment> = {}) {
  const appointment = {
    id: 11,
    businessId: 9,
    status: AppointmentStatus.CONFIRMED,
    depositStatus: DepositStatus.PENDING,
    depositAmount: '100.00',
    depositPaidAmount: null,
    depositPaidAt: null,
    depositMethod: null,
    depositNote: null,
    ...appointmentOverrides,
  } as Appointment;
  const save = jest.fn((value: Appointment) => Promise.resolve(value));
  const repo = {
    findOne: jest.fn().mockResolvedValue(appointment),
    save,
  } as unknown as Repository<Appointment>;
  const businessService = {
    assertCanManage: jest.fn().mockResolvedValue(undefined),
  } as unknown as BusinessService;
  const service = new AgendaService(
    repo,
    businessService,
    {} as AppointmentsService,
    {} as PoliciesService,
    {} as ServicesService,
  );
  return { service, save };
}

describe('AgendaService manual deposits', () => {
  it('requires a positive amount before marking a deposit as paid', async () => {
    const { service } = buildService({ depositAmount: null });

    await expect(
      service.setDeposit(11, { status: DepositStatus.PAID }, 7, Role.BUSINESS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records a valid payment without claiming an automatic charge', async () => {
    const { service, save } = buildService();

    const result = await service.setDeposit(
      11,
      {
        status: DepositStatus.PAID,
        paidAmount: 100,
        method: ' transferencia ',
      },
      7,
      Role.BUSINESS,
    );

    expect(result.depositPaidAmount).toBe('100.00');
    expect(result.depositMethod).toBe('transferencia');
    expect(result.depositPaidAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a paid deposit when recalculating policy', async () => {
    const { service } = buildService({
      depositStatus: DepositStatus.PAID,
      depositPaidAmount: '100.00',
    });

    await expect(
      service.applyPolicyDeposit(11, 7, Role.BUSINESS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not erase the audit trail by reopening a paid deposit', async () => {
    const { service } = buildService({
      depositStatus: DepositStatus.PAID,
      depositPaidAmount: '100.00',
      depositPaidAt: new Date(),
    });

    await expect(
      service.setDeposit(
        11,
        { status: DepositStatus.PENDING },
        7,
        Role.BUSINESS,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
