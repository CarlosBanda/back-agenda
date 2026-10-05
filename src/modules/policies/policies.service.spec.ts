import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { BusinessService } from '../business/business.service';
import { Role } from '../users/entities/user.entity';
import { BusinessPolicy, ChargeType } from './entities/business-policy.entity';
import { PoliciesService } from './policies.service';

function makeService() {
  const repo = {
    findOne: jest.fn(),
    create: jest.fn(
      (value: Partial<BusinessPolicy>) => value as BusinessPolicy,
    ),
    save: jest.fn((value: BusinessPolicy) => Promise.resolve(value)),
  } as unknown as Repository<BusinessPolicy>;
  const businessService = {
    assertCanManage: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue({ id: 1 }),
  } as unknown as BusinessService;
  return new PoliciesService(repo, businessService);
}

function policy(overrides: Partial<BusinessPolicy>): BusinessPolicy {
  return {
    businessId: 1,
    depositType: ChargeType.NONE,
    depositValue: '0.00',
    currency: 'MXN',
    cancellationWindowHours: 24,
    cancellationFeeType: ChargeType.NONE,
    cancellationFeeValue: '0.00',
    policyText: null,
    ...overrides,
  } as BusinessPolicy;
}

describe('PoliciesService.computeDeposit', () => {
  const service = makeService();

  it('returns zero when no deposit is required', () => {
    expect(
      service.computeDeposit(policy({ depositType: ChargeType.NONE }), 500),
    ).toBe('0.00');
  });

  it('computes a fixed deposit capped at the service price', () => {
    expect(
      service.computeDeposit(
        policy({ depositType: ChargeType.FIXED, depositValue: '100' }),
        500,
      ),
    ).toBe('100.00');
    expect(
      service.computeDeposit(
        policy({ depositType: ChargeType.FIXED, depositValue: '800' }),
        500,
      ),
    ).toBe('500.00');
  });

  it('computes a percentage deposit', () => {
    expect(
      service.computeDeposit(
        policy({ depositType: ChargeType.PERCENT, depositValue: '20' }),
        500,
      ),
    ).toBe('100.00');
  });
});

describe('PoliciesService.upsert', () => {
  it('rejects percentage values over 100', async () => {
    const service = makeService();

    await expect(
      service.upsert(
        1,
        { depositType: ChargeType.PERCENT, depositValue: 101 },
        7,
        Role.BUSINESS,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects currencies other than MXN', async () => {
    const service = makeService();

    await expect(
      service.upsert(1, { currency: 'USD' }, 7, Role.BUSINESS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PoliciesService.getPublic', () => {
  it('returns only customer-facing policy fields', async () => {
    const service = makeService();

    const result = await service.getPublic(1);

    expect(result).toEqual({
      businessId: 1,
      depositType: ChargeType.NONE,
      depositValue: '0.00',
      currency: 'MXN',
      cancellationWindowHours: 24,
      cancellationFeeType: ChargeType.NONE,
      cancellationFeeValue: '0.00',
      policyText: null,
    });
    expect(result).not.toHaveProperty('ownerId');
  });
});
