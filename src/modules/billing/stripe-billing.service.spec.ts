import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import type { Repository } from 'typeorm';
import { Role } from '../users/entities/user.entity';
import { BillingInterval } from '../subscriptions/entities/plan.entity';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import type { BusinessService } from '../business/business.service';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { BillingEvent } from './entities/billing-event.entity';
import type { BillingCheckoutAttempt } from './entities/billing-checkout-attempt.entity';
import {
  getSubscriptionPeriod,
  mapStripeSubscriptionStatus,
  parseSubscriptionMetadata,
  StripeBillingService,
} from './stripe-billing.service';

describe('Stripe billing helpers', () => {
  it.each([
    ['trialing', SubscriptionStatus.TRIAL],
    ['active', SubscriptionStatus.ACTIVE],
    ['past_due', SubscriptionStatus.PAST_DUE],
    ['unpaid', SubscriptionStatus.PAST_DUE],
    ['paused', SubscriptionStatus.PAST_DUE],
    ['incomplete', SubscriptionStatus.INCOMPLETE],
    ['incomplete_expired', SubscriptionStatus.EXPIRED],
    ['canceled', SubscriptionStatus.CANCELLED],
  ] as const)('maps Stripe status %s', (input, expected) => {
    expect(mapStripeSubscriptionStatus(input)).toBe(expected);
  });

  it('validates positive integer subscription metadata', () => {
    expect(
      parseSubscriptionMetadata({ businessId: '12', planId: '3' }),
    ).toEqual({ businessId: 12, planId: 3 });
    expect(() =>
      parseSubscriptionMetadata({ businessId: '0', planId: '3' }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseSubscriptionMetadata({ businessId: '12', planId: 'nope' }),
    ).toThrow(BadRequestException);
  });

  it('uses item periods from Stripe 22 subscriptions', () => {
    const subscription = {
      items: {
        data: [
          {
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_000_000,
          },
          {
            current_period_start: 1_700_100_000,
            current_period_end: 1_703_000_000,
          },
        ],
      },
    } as Stripe.Subscription;

    expect(getSubscriptionPeriod(subscription)).toEqual({
      startDate: '2023-11-14',
      endDate: '2023-12-19',
    });
  });

  it('rejects subscriptions without items', () => {
    const subscription = { items: { data: [] } } as Stripe.Subscription;
    expect(() => getSubscriptionPeriod(subscription)).toThrow(
      BadRequestException,
    );
  });
});

describe('StripeBillingService', () => {
  const actor = { sub: 10, email: 'owner@example.com', role: Role.BUSINESS };

  function createService(options?: {
    event?: BillingEvent | null;
    plan?: Record<string, unknown>;
  }) {
    const values: Record<string, string> = {
      STRIPE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
      FRONTEND_URL: 'http://localhost:5176/agenda',
      STRIPE_AUTOMATIC_TAX: 'false',
      STRIPE_COLLECT_TAX_ID: 'true',
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
      getOrThrow: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    const repoMocks = {
      findOne: jest.fn().mockResolvedValue(options?.event ?? null),
      insert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };
    const repo = repoMocks as unknown as Repository<BillingEvent>;
    const checkoutRepoMocks = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value: object) => value),
      insert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn(),
    };
    const checkoutRepo =
      checkoutRepoMocks as unknown as Repository<BillingCheckoutAttempt>;
    const businessService = {
      assertCanManage: jest.fn().mockResolvedValue({ id: 22 }),
    } as unknown as BusinessService;
    const defaultPlan = {
      id: 4,
      isActive: true,
      currency: 'MXN',
      providerPriceId: 'price_test',
      price: 499,
      billingInterval: BillingInterval.MONTH,
    };
    const subscriptionsService = {
      findPlanById: jest
        .fn()
        .mockResolvedValue({ ...defaultPlan, ...options?.plan }),
      findLatestStripeByBusiness: jest.fn().mockResolvedValue(null),
      upsertFromProvider: jest.fn().mockResolvedValue({}),
    } as unknown as SubscriptionsService;
    const service = new StripeBillingService(
      config,
      repo,
      checkoutRepo,
      businessService,
      subscriptionsService,
    );
    return { service, repoMocks, checkoutRepoMocks, subscriptionsService };
  }

  it('rejects Checkout for a non-MXN plan without calling Stripe', async () => {
    const { service } = createService({ plan: { currency: 'USD' } });
    await expect(
      service.createCheckoutSession({ businessId: 22, planId: 4 }, actor),
    ).rejects.toThrow('Stripe Checkout only supports MXN plans');
  });

  it('rejects Checkout when the plan has no Stripe Price', async () => {
    const { service } = createService({ plan: { providerPriceId: null } });
    await expect(
      service.createCheckoutSession({ businessId: 22, planId: 4 }, actor),
    ).rejects.toThrow('Plan has no Stripe Price configured');
  });

  it('blocks a second Checkout for an existing Stripe subscription', async () => {
    const { service, subscriptionsService } = createService();
    jest
      .spyOn(subscriptionsService, 'findLatestStripeByBusiness')
      .mockResolvedValue({ status: SubscriptionStatus.ACTIVE } as never);

    await expect(
      service.createCheckoutSession({ businessId: 22, planId: 4 }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reuses an open Checkout instead of creating a concurrent session', async () => {
    const { service, checkoutRepoMocks } = createService();
    checkoutRepoMocks.findOne.mockResolvedValue({
      businessId: 22,
      planId: 4,
      attemptId: 'attempt-existing',
      stripeSessionId: 'cs_existing',
      checkoutUrl: 'https://checkout.stripe.test/existing',
      expiresAt: new Date(Date.now() + 60_000),
      processingStartedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.createCheckoutSession({ businessId: 22, planId: 4 }, actor),
    ).resolves.toEqual({ url: 'https://checkout.stripe.test/existing' });
    expect(checkoutRepoMocks.insert).not.toHaveBeenCalled();
  });

  it('claims and marks a webhook event as processed', async () => {
    const { service, repoMocks } = createService();
    const stripe = Reflect.get(service, 'stripe') as Stripe;
    jest.spyOn(stripe.webhooks, 'constructEvent').mockReturnValue({
      id: 'evt_new',
      type: 'invoice.created',
      data: { object: {} },
    } as Stripe.Event);

    await expect(
      service.processWebhook(Buffer.from('{}'), 'valid-signature'),
    ).resolves.toEqual({ received: true });
    expect(repoMocks.insert).toHaveBeenCalledTimes(1);
    expect(repoMocks.update).toHaveBeenCalledTimes(1);
  });

  it('reclaims a stale webhook lease after a worker crash', async () => {
    const staleEvent = {
      eventId: 'evt_stale',
      type: 'invoice.created',
      processedAt: null,
      processingStartedAt: new Date(Date.now() - 10 * 60 * 1000),
      attempts: 1,
      createdAt: new Date(),
    } as BillingEvent;
    const { service, repoMocks } = createService({ event: staleEvent });
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repoMocks.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
    const stripe = Reflect.get(service, 'stripe') as Stripe;
    jest.spyOn(stripe.webhooks, 'constructEvent').mockReturnValue({
      id: 'evt_stale',
      type: 'invoice.created',
      data: { object: {} },
    } as Stripe.Event);

    await expect(
      service.processWebhook(Buffer.from('{}'), 'valid-signature'),
    ).resolves.toEqual({ received: true });
    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
    expect(repoMocks.update).toHaveBeenCalledTimes(1);
  });

  it('returns duplicate without processing an already completed event', async () => {
    const processedEvent = {
      eventId: 'evt_done',
      type: 'invoice.created',
      processedAt: new Date(),
      createdAt: new Date(),
    } as BillingEvent;
    const { service, repoMocks } = createService({ event: processedEvent });
    const stripe = Reflect.get(service, 'stripe') as Stripe;
    jest.spyOn(stripe.webhooks, 'constructEvent').mockReturnValue({
      id: 'evt_done',
      type: 'invoice.created',
      data: { object: {} },
    } as Stripe.Event);

    await expect(
      service.processWebhook(Buffer.from('{}'), 'valid-signature'),
    ).resolves.toEqual({ received: true, duplicate: true });
    expect(repoMocks.insert).not.toHaveBeenCalled();
    expect(repoMocks.update).not.toHaveBeenCalled();
  });

  it('persists a sanitized failure and releases the event for immediate retry', async () => {
    const { service, repoMocks } = createService();
    const stripe = Reflect.get(service, 'stripe') as Stripe;
    jest.spyOn(stripe.webhooks, 'constructEvent').mockReturnValue({
      id: 'evt_bad',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_bad',
          metadata: { businessId: '22' },
        },
      },
    } as Stripe.Event);
    jest
      .spyOn(stripe.subscriptions, 'retrieve')
      .mockRejectedValue(
        new Error('temporary Stripe failure token=super-secret-value'),
      );

    await expect(
      service.processWebhook(Buffer.from('{}'), 'valid-signature'),
    ).rejects.toThrow('temporary Stripe failure');
    expect(repoMocks.delete).not.toHaveBeenCalled();
    expect(repoMocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: 22 }),
    );
    const updateCalls = repoMocks.update.mock.calls as unknown[][];
    const lastUpdate = updateCalls.at(-1);
    expect(lastUpdate?.[0]).toBe('evt_bad');
    const failureState = lastUpdate?.[1] as Partial<BillingEvent>;
    expect(failureState.processingStartedAt).toBeNull();
    expect(failureState.failedAt).toBeInstanceOf(Date);
    expect(failureState.lastError).not.toContain('super-secret-value');
  });
});
