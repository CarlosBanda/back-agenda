import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  LessThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { BillingInterval, Plan } from './entities/plan.entity';
import {
  Subscription,
  SubscriptionStatus,
} from './entities/subscription.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import {
  PaginationDto,
  PaginatedResult,
} from '../../common/dto/pagination.dto';
import { BusinessService } from '../business/business.service';

export interface ProviderSubscriptionInput {
  businessId: number;
  planId: number;
  status: SubscriptionStatus;
  provider: string;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  cancelAtPeriodEnd: boolean;
  startDate: string;
  endDate: string;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    private readonly config: ConfigService,
    private readonly businessService: BusinessService,
  ) {}

  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    this.assertPlanDuration(dto.billingInterval, dto.duration);
    const duplicate = await this.planRepo.findOne({
      where: [
        { slug: dto.slug },
        ...(dto.providerPriceId
          ? [{ providerPriceId: dto.providerPriceId }]
          : []),
      ],
    });
    if (duplicate)
      throw new ConflictException('Plan slug or provider price already exists');
    return this.planRepo.save(this.planRepo.create(dto));
  }

  async findAllPlans(): Promise<Plan[]> {
    return this.planRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', price: 'ASC' },
    });
  }

  async findAllPlansAdmin(): Promise<Plan[]> {
    return this.planRepo.find({ order: { sortOrder: 'ASC', price: 'ASC' } });
  }

  async findPlanById(id: number): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async updatePlan(id: number, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findPlanById(id);
    const nextInterval = dto.billingInterval ?? plan.billingInterval;
    const nextDuration = dto.duration ?? plan.duration;
    this.assertPlanDuration(nextInterval, nextDuration);

    const contractChanged =
      (dto.price !== undefined && Number(dto.price) !== Number(plan.price)) ||
      (dto.currency !== undefined && dto.currency !== plan.currency) ||
      (dto.billingInterval !== undefined &&
        dto.billingInterval !== plan.billingInterval) ||
      (dto.providerPriceId !== undefined &&
        dto.providerPriceId !== plan.providerPriceId);
    if (contractChanged && plan.providerPriceId) {
      throw new ConflictException(
        'Stripe contract fields are immutable after assigning a Price; create a new plan',
      );
    }
    if (contractChanged) {
      const soldSubscriptions = await this.subscriptionRepo.count({
        where: { planId: id, provider: 'STRIPE' },
      });
      if (soldSubscriptions > 0) {
        throw new ConflictException(
          'Stripe contract fields are immutable after a plan has subscriptions; create a new plan',
        );
      }
    }

    Object.assign(plan, dto);
    return this.planRepo.save(plan);
  }

  async removePlan(id: number): Promise<void> {
    const plan = await this.findPlanById(id);
    plan.isActive = false;
    await this.planRepo.save(plan);
  }

  async createSubscription(dto: CreateSubscriptionDto): Promise<Subscription> {
    if (dto.provider && dto.provider.toUpperCase() !== 'MANUAL') {
      throw new BadRequestException(
        'Provider subscriptions can only be created by their billing webhook',
      );
    }
    await this.businessService.findOne(dto.businessId);
    const plan = await this.findPlanById(dto.planId);
    if (!plan.isActive) throw new BadRequestException('Plan is not active');

    const startDate = dto.startDate ?? this.today();
    const calculatedEndDate = new Date(`${startDate}T00:00:00.000Z`);
    calculatedEndDate.setUTCDate(
      calculatedEndDate.getUTCDate() + plan.duration,
    );
    const endDate =
      dto.endDate ?? calculatedEndDate.toISOString().split('T')[0];
    this.assertValidPeriod(startDate, endDate);

    await this.subscriptionRepo.update(
      {
        businessId: dto.businessId,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]),
      },
      { status: SubscriptionStatus.CANCELLED },
    );

    return this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        ...dto,
        status: dto.status ?? SubscriptionStatus.ACTIVE,
        provider: 'MANUAL',
        providerSubscriptionId: null,
        providerCustomerId: null,
        cancelAtPeriodEnd: false,
        startDate,
        endDate,
      }),
    );
  }

  async findAllSubscriptions(
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Subscription>> {
    const { page = 1, limit = 10 } = pagination;
    const [data, total] = await this.subscriptionRepo.findAndCount({
      relations: ['business', 'plan'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findSubscriptionById(id: number): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['business', 'plan'],
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return subscription;
  }

  async findLatestStripeByBusiness(
    businessId: number,
  ): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { businessId, provider: 'STRIPE' },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async upsertFromProvider(
    input: ProviderSubscriptionInput,
  ): Promise<Subscription> {
    await this.businessService.findOne(input.businessId);
    await this.findPlanById(input.planId);
    this.assertValidPeriod(input.startDate, input.endDate);

    let subscription = await this.subscriptionRepo.findOne({
      where: { providerSubscriptionId: input.providerSubscriptionId },
    });
    if (subscription && subscription.provider !== input.provider) {
      throw new ConflictException('Provider subscription ID already exists');
    }

    if (
      [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL].includes(
        input.status,
      )
    ) {
      const cancelOthers = this.subscriptionRepo
        .createQueryBuilder()
        .update(Subscription)
        .set({ status: SubscriptionStatus.CANCELLED })
        .where('businessId = :businessId', { businessId: input.businessId })
        .andWhere('status IN (:...statuses)', {
          statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
        });
      if (subscription) {
        cancelOthers.andWhere('id != :id', { id: subscription.id });
      }
      await cancelOthers.execute();
    }

    subscription ??= this.subscriptionRepo.create();
    Object.assign(subscription, input);
    return this.subscriptionRepo.save(subscription);
  }

  async findByBusiness(businessId: number): Promise<Subscription | null> {
    const today = this.today();
    await this.subscriptionRepo.update(
      {
        businessId,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]),
        endDate: LessThan(today),
      },
      { status: SubscriptionStatus.EXPIRED },
    );

    return this.subscriptionRepo.findOne({
      where: {
        businessId,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]),
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: ['plan'],
      order: { endDate: 'DESC' },
    });
  }

  async getEntitlements(businessId: number) {
    const subscription = await this.findByBusiness(businessId);
    return {
      enforced: this.isEnforced(),
      subscription,
      limits: subscription?.plan
        ? {
            maxServices: subscription.plan.maxServices,
            maxStaff: subscription.plan.maxStaff,
            maxAppointmentsPerMonth: subscription.plan.maxAppointmentsPerMonth,
          }
        : null,
    };
  }

  async assertQuota(
    businessId: number,
    quota: 'maxServices' | 'maxStaff' | 'maxAppointmentsPerMonth',
    currentUsage: number,
  ): Promise<void> {
    if (!this.isEnforced()) return;

    const subscription = await this.findByBusiness(businessId);
    if (!subscription) {
      throw new HttpException(
        'An active subscription is required',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const limit = subscription.plan[quota];
    if (limit > 0 && currentUsage >= limit) {
      throw new HttpException(
        `Plan limit reached for ${quota}`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async updateSubscription(
    id: number,
    dto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.findSubscriptionById(id);
    if (subscription.provider !== 'MANUAL') {
      throw new ConflictException(
        'Provider subscriptions must be changed through the billing provider',
      );
    }
    if (dto.provider && dto.provider.toUpperCase() !== 'MANUAL') {
      throw new BadRequestException(
        'Provider subscriptions can only be changed by their billing webhook',
      );
    }
    if (dto.planId) await this.findPlanById(dto.planId);
    const startDate = dto.startDate ?? subscription.startDate;
    const endDate = dto.endDate ?? subscription.endDate;
    this.assertValidPeriod(startDate, endDate);
    Object.assign(subscription, dto, { provider: 'MANUAL' });
    return this.subscriptionRepo.save(subscription);
  }

  async cancelSubscription(id: number): Promise<Subscription> {
    const subscription = await this.findSubscriptionById(id);
    if (subscription.provider !== 'MANUAL') {
      throw new ConflictException(
        'Provider subscriptions must be cancelled through the billing portal',
      );
    }
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelAtPeriodEnd = false;
    return this.subscriptionRepo.save(subscription);
  }

  async getStats() {
    const totalSubscriptions = await this.subscriptionRepo.count();
    const activeSubscriptions = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });
    const trialSubscriptions = await this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.TRIAL },
    });
    const totalPlans = await this.planRepo.count({ where: { isActive: true } });

    return {
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      totalPlans,
    };
  }

  private assertPlanDuration(
    interval: BillingInterval,
    duration: number,
  ): void {
    const valid =
      interval === BillingInterval.MONTH
        ? duration >= 28 && duration <= 31
        : duration >= 365 && duration <= 366;
    if (!valid) {
      throw new BadRequestException(
        interval === BillingInterval.MONTH
          ? 'Monthly plan duration must be between 28 and 31 days'
          : 'Yearly plan duration must be between 365 and 366 days',
      );
    }
  }

  private isEnforced(): boolean {
    return (
      this.config.get<string>('SUBSCRIPTIONS_ENFORCED', 'false') === 'true'
    );
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private assertValidPeriod(startDate: string, endDate: string): void {
    if (endDate < startDate) {
      throw new BadRequestException(
        'Subscription end date must be on or after start date',
      );
    }
  }
}
