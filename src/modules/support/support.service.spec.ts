import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Appointment } from '../appointments/entities/appointment.entity';
import type { BillingCheckoutAttempt } from '../billing/entities/billing-checkout-attempt.entity';
import type { BillingEvent } from '../billing/entities/billing-event.entity';
import type { Business } from '../business/entities/business.entity';
import type { Subscription } from '../subscriptions/entities/subscription.entity';
import { Role, type User } from '../users/entities/user.entity';
import type { AdminAuditLog } from './entities/admin-audit-log.entity';
import type { PlatformError } from './entities/platform-error.entity';
import {
  SupportCaseStatus,
  type SupportCase,
} from './entities/support-case.entity';
import type { SupportMessage } from './entities/support-message.entity';
import { SupportService } from './support.service';

describe('SupportService authorization', () => {
  function createService(requesterId: number) {
    const supportCase = {
      id: 7,
      requesterId,
      requester: { id: requesterId, name: 'Requester', role: Role.CLIENT },
      business: null,
      assignedAdmin: null,
      status: SupportCaseStatus.OPEN,
      resolvedAt: null,
    };
    const caseSave = jest.fn((value: object) => Promise.resolve(value));
    const caseRepo = {
      findOne: jest.fn().mockResolvedValue(supportCase),
      create: jest.fn((value: object) => value),
      save: caseSave,
    } as unknown as Repository<SupportCase>;
    const messageFind = jest.fn().mockResolvedValue([]);
    const messageSave = jest.fn((value: object) => Promise.resolve(value));
    const messageRepo = {
      find: messageFind,
      create: jest.fn((value: object) => value),
      save: messageSave,
    } as unknown as Repository<SupportMessage>;
    const userFindOne = jest.fn().mockResolvedValue({ id: requesterId });
    const businessFindOne = jest
      .fn()
      .mockResolvedValue({ id: 9, ownerId: requesterId });
    const userRepo = { findOne: userFindOne } as unknown as Repository<User>;
    const businessRepo = {
      findOne: businessFindOne,
    } as unknown as Repository<Business>;
    const empty = {};
    const service = new SupportService(
      caseRepo,
      messageRepo,
      empty as Repository<PlatformError>,
      empty as Repository<AdminAuditLog>,
      userRepo,
      businessRepo,
      empty as Repository<Appointment>,
      empty as Repository<Subscription>,
      empty as Repository<BillingCheckoutAttempt>,
      empty as Repository<BillingEvent>,
    );
    return {
      service,
      supportCase,
      messageFind,
      messageSave,
      caseSave,
      businessFindOne,
    };
  }

  it('rejects a requester attempting to read another user case', async () => {
    const { service, messageFind } = createService(20);

    await expect(
      service.findCaseForActor(7, {
        sub: 21,
        email: 'other@example.com',
        role: Role.CLIENT,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageFind).not.toHaveBeenCalled();
  });

  it('allows an admin and includes internal messages', async () => {
    const { service, messageFind } = createService(20);

    await expect(
      service.findCaseForActor(7, {
        sub: 1,
        email: 'admin@example.com',
        role: Role.ADMIN,
      }),
    ).resolves.toMatchObject({ id: 7, messages: [] });
    expect(messageFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { caseId: 7 } }),
    );
  });

  it('hides internal messages and admin contact fields from the requester', async () => {
    const { service, messageFind } = createService(20);
    messageFind.mockResolvedValue([
      {
        id: 3,
        caseId: 7,
        internal: false,
        author: {
          id: 1,
          name: 'Agent',
          role: Role.ADMIN,
          email: 'agent@example.com',
          phone: '+52 55 0000 0000',
        },
      },
    ]);

    const result = await service.findCaseForActor(7, {
      sub: 20,
      email: 'requester@example.com',
      role: Role.CLIENT,
    });

    expect(messageFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { caseId: 7, internal: false } }),
    );
    expect(result.messages[0].author).toEqual({
      id: 1,
      name: 'Agent',
      role: Role.ADMIN,
    });
  });

  it('reopens a waiting case when the requester replies', async () => {
    const { service, supportCase, caseSave, messageSave } = createService(20);
    supportCase.status = SupportCaseStatus.WAITING_USER;

    await service.addRequesterMessage(
      7,
      { body: 'Necesito otra aclaración' },
      { sub: 20, email: 'requester@example.com', role: Role.CLIENT },
    );

    expect(messageSave).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: 7, authorId: 20, internal: false }),
    );
    expect(supportCase.status).toBe(SupportCaseStatus.OPEN);
    expect(caseSave).toHaveBeenCalledWith(supportCase);
  });

  it('rejects an admin case linked to a business owned by another user', async () => {
    const { service, businessFindOne } = createService(20);
    businessFindOne.mockResolvedValue({ id: 9, ownerId: 99 });

    await expect(
      service.createCaseAsAdmin({
        requesterId: 20,
        businessId: 9,
        subject: 'Aclaración',
        description: 'Detalle operativo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
