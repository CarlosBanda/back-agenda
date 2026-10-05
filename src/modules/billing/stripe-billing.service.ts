import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { QueryFailedError, Repository } from 'typeorm';
import { JwtUser } from '../../common/interfaces/authenticated-request.interface';
import { sanitizeErrorMessage } from '../../common/utils/error-sanitizer';
import { BusinessService } from '../business/business.service';
import { BillingInterval } from '../subscriptions/entities/plan.entity';
import { SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import {
  ProviderSubscriptionInput,
  SubscriptionsService,
} from '../subscriptions/subscriptions.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';
import { BillingEvent } from './entities/billing-event.entity';
import { BillingCheckoutAttempt } from './entities/billing-checkout-attempt.entity';

const STRIPE_PROVIDER = 'STRIPE';

function metadataBusinessId(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const metadata = record.metadata;
  if (typeof metadata !== 'object' || metadata === null) return null;
  const raw = (metadata as Record<string, unknown>).businessId;
  const businessId = typeof raw === 'string' ? Number(raw) : raw;
  return typeof businessId === 'number' &&
    Number.isInteger(businessId) &&
    businessId > 0
    ? businessId
    : null;
}

export function extractEventBusinessId(event: Stripe.Event): number | null {
  const object = event.data.object as unknown;
  const direct = metadataBusinessId(object);
  if (direct !== null) return direct;
  if (typeof object !== 'object' || object === null) return null;
  const subscriptionDetails = (object as Record<string, unknown>)[
    'subscription_details'
  ];
  return metadataBusinessId(subscriptionDetails);
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return SubscriptionStatus.TRIAL;
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return SubscriptionStatus.PAST_DUE;
    case 'incomplete':
      return SubscriptionStatus.INCOMPLETE;
    case 'incomplete_expired':
      return SubscriptionStatus.EXPIRED;
    case 'canceled':
      return SubscriptionStatus.CANCELLED;
    default:
      throw new BadRequestException(
        `Unsupported Stripe subscription status: ${status}`,
      );
  }
}

export function parseSubscriptionMetadata(metadata: Stripe.Metadata): {
  businessId: number;
  planId: number;
} {
  const businessId = Number(metadata.businessId);
  const planId = Number(metadata.planId);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new BadRequestException(
      'Stripe subscription metadata.businessId is invalid',
    );
  }
  if (!Number.isInteger(planId) || planId <= 0) {
    throw new BadRequestException(
      'Stripe subscription metadata.planId is invalid',
    );
  }
  return { businessId, planId };
}

export function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  startDate: string;
  endDate: string;
} {
  const items = subscription.items.data;
  if (items.length === 0) {
    throw new BadRequestException('Stripe subscription has no items');
  }
  const start = Math.min(...items.map((item) => item.current_period_start));
  const end = Math.max(...items.map((item) => item.current_period_end));
  return {
    startDate: new Date(start * 1000).toISOString().slice(0, 10),
    endDate: new Date(end * 1000).toISOString().slice(0, 10),
  };
}

@Injectable()
export class StripeBillingService {
  private readonly logger = new Logger(StripeBillingService.name);
  private readonly stripe: Stripe | null;
  private readonly enabled: boolean;
  private readonly frontendUrl: string;
  private readonly webhookSecret: string;
  private readonly automaticTax: boolean;
  private readonly collectTaxId: boolean;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(BillingEvent)
    private readonly billingEventRepo: Repository<BillingEvent>,
    @InjectRepository(BillingCheckoutAttempt)
    private readonly checkoutAttemptRepo: Repository<BillingCheckoutAttempt>,
    private readonly businessService: BusinessService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    this.enabled = config.get<string>('STRIPE_ENABLED', 'false') === 'true';
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5176/agenda')
      .replace(/\/$/, '');
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET', '');
    this.automaticTax =
      config.get<string>('STRIPE_AUTOMATIC_TAX', 'false') === 'true';
    this.collectTaxId =
      config.get<string>('STRIPE_COLLECT_TAX_ID', 'true') === 'true';
    this.stripe = this.enabled
      ? new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'))
      : null;
  }

  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
    actor: JwtUser,
  ): Promise<{ url: string }> {
    const stripe = this.getStripe();
    await this.businessService.assertCanManage(
      dto.businessId,
      actor.sub,
      actor.role,
    );
    const plan = await this.subscriptionsService.findPlanById(dto.planId);
    if (!plan.isActive) throw new BadRequestException('Plan is not active');
    if (plan.currency.toUpperCase() !== 'MXN') {
      throw new BadRequestException('Stripe Checkout only supports MXN plans');
    }
    if (!plan.providerPriceId) {
      throw new BadRequestException('Plan has no Stripe Price configured');
    }

    const current = await this.subscriptionsService.findLatestStripeByBusiness(
      dto.businessId,
    );
    if (
      current &&
      [
        SubscriptionStatus.INCOMPLETE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.PAST_DUE,
      ].includes(current.status)
    ) {
      throw new ConflictException(
        'This business already has a Stripe subscription; use the billing portal',
      );
    }

    const checkoutAttempt = await this.acquireCheckoutAttempt(
      dto.businessId,
      dto.planId,
    );
    if (!checkoutAttempt.acquired && checkoutAttempt.attempt.checkoutUrl) {
      return { url: checkoutAttempt.attempt.checkoutUrl };
    }

    try {
      const price = await stripe.prices.retrieve(plan.providerPriceId);
      this.assertPriceMatchesPlan(price, plan);

      const session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          line_items: [{ price: plan.providerPriceId, quantity: 1 }],
          customer: current?.providerCustomerId ?? undefined,
          customer_email: current?.providerCustomerId ? undefined : actor.email,
          client_reference_id: String(dto.businessId),
          metadata: {
            businessId: String(dto.businessId),
            planId: String(dto.planId),
          },
          subscription_data: {
            metadata: {
              businessId: String(dto.businessId),
              planId: String(dto.planId),
            },
          },
          billing_address_collection: 'required',
          tax_id_collection: { enabled: this.collectTaxId },
          automatic_tax: { enabled: this.automaticTax },
          allow_promotion_codes: true,
          locale: 'es',
          success_url: `${this.frontendUrl}/planes?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.frontendUrl}/planes?checkout=cancelled`,
        },
        {
          idempotencyKey: `agenda-checkout-${checkoutAttempt.attempt.attemptId}`,
        },
      );

      if (!session.url) {
        throw new ServiceUnavailableException(
          'Stripe did not return a Checkout URL',
        );
      }
      await this.checkoutAttemptRepo.update(
        {
          businessId: dto.businessId,
          attemptId: checkoutAttempt.attempt.attemptId,
        },
        {
          stripeSessionId: session.id,
          checkoutUrl: session.url,
          expiresAt: new Date(session.expires_at * 1000),
          processingStartedAt: null,
        },
      );
      return { url: session.url };
    } catch (error) {
      await this.checkoutAttemptRepo.update(
        {
          businessId: dto.businessId,
          attemptId: checkoutAttempt.attempt.attemptId,
        },
        { processingStartedAt: null },
      );
      throw error;
    }
  }

  private async acquireCheckoutAttempt(
    businessId: number,
    planId: number,
  ): Promise<{ attempt: BillingCheckoutAttempt; acquired: boolean }> {
    for (let retry = 0; retry < 3; retry += 1) {
      const now = new Date();
      const leaseCutoff = new Date(now.getTime() - 2 * 60 * 1000);
      const existing = await this.checkoutAttemptRepo.findOne({
        where: { businessId },
      });

      if (!existing) {
        const attempt = this.checkoutAttemptRepo.create({
          businessId,
          planId,
          attemptId: randomUUID(),
          stripeSessionId: null,
          checkoutUrl: null,
          expiresAt: null,
          processingStartedAt: now,
        });
        try {
          await this.checkoutAttemptRepo.insert(attempt);
          return { attempt, acquired: true };
        } catch (error) {
          if (error instanceof QueryFailedError) continue;
          throw error;
        }
      }

      const sessionIsReusable =
        Boolean(existing.checkoutUrl) &&
        (!existing.expiresAt || existing.expiresAt > now);
      if (sessionIsReusable) {
        if (existing.planId !== planId) {
          throw new ConflictException(
            'An open Checkout for another plan already exists for this business',
          );
        }
        return { attempt: existing, acquired: false };
      }

      if (
        existing.processingStartedAt &&
        existing.processingStartedAt > leaseCutoff
      ) {
        throw new ServiceUnavailableException(
          'Checkout is already being created for this business',
        );
      }

      const previousSessionExpired =
        existing.expiresAt !== null && existing.expiresAt <= now;
      if (!previousSessionExpired && existing.planId !== planId) {
        throw new ConflictException(
          'A pending Checkout for another plan already exists for this business',
        );
      }

      const attemptId = previousSessionExpired
        ? randomUUID()
        : existing.attemptId;
      const result = await this.checkoutAttemptRepo
        .createQueryBuilder()
        .update(BillingCheckoutAttempt)
        .set({
          planId,
          attemptId,
          stripeSessionId: null,
          checkoutUrl: null,
          expiresAt: null,
          processingStartedAt: now,
        })
        .where('businessId = :businessId', { businessId })
        .andWhere('attemptId = :previousAttemptId', {
          previousAttemptId: existing.attemptId,
        })
        .execute();
      if (result.affected === 1) {
        return {
          attempt: this.checkoutAttemptRepo.create({
            ...existing,
            planId,
            attemptId,
            stripeSessionId: null,
            checkoutUrl: null,
            expiresAt: null,
            processingStartedAt: now,
          }),
          acquired: true,
        };
      }
    }

    throw new ServiceUnavailableException(
      'Could not acquire Checkout creation lease',
    );
  }

  async createPortalSession(
    dto: CreatePortalSessionDto,
    actor: JwtUser,
  ): Promise<{ url: string }> {
    const stripe = this.getStripe();
    await this.businessService.assertCanManage(
      dto.businessId,
      actor.sub,
      actor.role,
    );
    const subscription =
      await this.subscriptionsService.findLatestStripeByBusiness(
        dto.businessId,
      );
    if (!subscription?.providerCustomerId) {
      throw new BadRequestException(
        'This business does not have a Stripe customer yet',
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: `${this.frontendUrl}/planes`,
    });
    return { url: session.url };
  }

  async processWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<{ received: true; duplicate?: true }> {
    const stripe = this.getStripe();
    if (!rawBody) throw new BadRequestException('Missing raw webhook body');
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const claimed = await this.claimEvent(event);
    if (!claimed) return { received: true, duplicate: true };

    try {
      await this.handleEvent(event);
      await this.billingEventRepo.update(event.id, {
        businessId: extractEventBusinessId(event),
        processedAt: new Date(),
        processingStartedAt: null,
        lastError: null,
        failedAt: null,
      });
      return { received: true };
    } catch (error) {
      try {
        await this.billingEventRepo.update(event.id, {
          businessId: extractEventBusinessId(event),
          lastError: sanitizeErrorMessage(error),
          failedAt: new Date(),
          processingStartedAt: null,
        });
      } catch (persistenceError) {
        this.logger.error(
          `Could not persist failed billing event ${event.id}: ${sanitizeErrorMessage(persistenceError, 300)}`,
        );
      }
      throw error;
    }
  }

  private async claimEvent(event: Stripe.Event): Promise<boolean> {
    const existing = await this.billingEventRepo.findOne({
      where: { eventId: event.id },
    });
    if (existing?.processedAt) return false;

    const now = new Date();
    if (existing) {
      const leaseCutoff = new Date(now.getTime() - 5 * 60 * 1000);
      const result = await this.billingEventRepo
        .createQueryBuilder()
        .update(BillingEvent)
        .set({
          businessId: existing.businessId ?? extractEventBusinessId(event),
          processingStartedAt: now,
          lastError: null,
          failedAt: null,
          attempts: () => 'attempts + 1',
        })
        .where('eventId = :eventId', { eventId: event.id })
        .andWhere('processedAt IS NULL')
        .andWhere(
          '(processingStartedAt IS NULL OR processingStartedAt < :leaseCutoff)',
          { leaseCutoff },
        )
        .execute();
      if (result.affected === 1) return true;
      throw new ServiceUnavailableException(
        'Stripe event is already being processed',
      );
    }

    try {
      await this.billingEventRepo.insert({
        eventId: event.id,
        type: event.type,
        businessId: extractEventBusinessId(event),
        processedAt: null,
        processingStartedAt: now,
        lastError: null,
        failedAt: null,
        attempts: 1,
      });
      return true;
    } catch (error) {
      if (!(error instanceof QueryFailedError)) throw error;
      const concurrent = await this.billingEventRepo.findOne({
        where: { eventId: event.id },
      });
      if (concurrent?.processedAt) return false;
      throw new ServiceUnavailableException(
        'Stripe event is already being processed',
      );
    }
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId = this.expandableId(session.subscription);
        if (subscriptionId) {
          const subscription = await this.getStripe().subscriptions.retrieve(
            subscriptionId,
            { expand: ['items.data.price'] },
          );
          await this.syncSubscription(subscription);
        }
        await this.checkoutAttemptRepo.delete({ stripeSessionId: session.id });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const eventSubscription = event.data.object;
        const subscription = await this.getStripe().subscriptions.retrieve(
          eventSubscription.id,
          { expand: ['items.data.price'] },
        );
        await this.syncSubscription(subscription);
        break;
      }
      default:
        break;
    }
  }

  private async syncSubscription(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const { businessId, planId } = parseSubscriptionMetadata(
      subscription.metadata,
    );
    const plan = await this.subscriptionsService.findPlanById(planId);
    const items = subscription.items.data;
    if (items.length !== 1 || items[0].price.id !== plan.providerPriceId) {
      throw new BadRequestException(
        'Stripe subscription price does not match the configured plan',
      );
    }

    const input: ProviderSubscriptionInput = {
      businessId,
      planId,
      provider: STRIPE_PROVIDER,
      providerSubscriptionId: subscription.id,
      providerCustomerId: this.expandableId(subscription.customer),
      status: mapStripeSubscriptionStatus(subscription.status),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...getSubscriptionPeriod(subscription),
    };
    await this.subscriptionsService.upsertFromProvider(input);
  }

  private assertPriceMatchesPlan(
    price: Stripe.Price,
    plan: {
      price: number;
      billingInterval: BillingInterval;
      providerPriceId: string | null;
    },
  ): void {
    const expectedInterval =
      plan.billingInterval === BillingInterval.YEAR ? 'year' : 'month';
    if (
      !price.active ||
      price.currency !== 'mxn' ||
      price.type !== 'recurring' ||
      !price.recurring ||
      price.recurring.interval !== expectedInterval ||
      price.recurring.interval_count !== 1 ||
      price.unit_amount !== Math.round(Number(plan.price) * 100)
    ) {
      throw new BadRequestException(
        'Stripe Price does not match the active MXN plan configuration',
      );
    }
  }

  private expandableId(value: string | { id: string } | null): string | null {
    return typeof value === 'string' ? value : (value?.id ?? null);
  }

  private getStripe(): Stripe {
    if (!this.enabled || !this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe Billing is not enabled on this server',
      );
    }
    return this.stripe;
  }
}
