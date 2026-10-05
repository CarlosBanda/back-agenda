import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { In, IsNull, Not, Repository } from 'typeorm';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import type { JwtUser } from '../../common/interfaces/authenticated-request.interface';
import { Appointment } from '../appointments/entities/appointment.entity';
import { BillingCheckoutAttempt } from '../billing/entities/billing-checkout-attempt.entity';
import { BillingEvent } from '../billing/entities/billing-event.entity';
import { Business } from '../business/entities/business.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Role, User } from '../users/entities/user.entity';
import {
  BillingEventsQueryDto,
  BillingEventState,
  CreateAdminSupportCaseDto,
  CreateRequesterMessageDto,
  CreateSupportCaseDto,
  CreateSupportMessageDto,
  ErrorsQueryDto,
  SupportCasesQueryDto,
  UpdateSupportCaseDto,
} from './dto/support.dto';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { PlatformError } from './entities/platform-error.entity';
import {
  SupportCase,
  SupportCasePriority,
  SupportCaseStatus,
} from './entities/support-case.entity';
import { SupportMessage } from './entities/support-message.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportCase)
    private readonly caseRepo: Repository<SupportCase>,
    @InjectRepository(SupportMessage)
    private readonly messageRepo: Repository<SupportMessage>,
    @InjectRepository(PlatformError)
    private readonly errorRepo: Repository<PlatformError>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(BillingCheckoutAttempt)
    private readonly checkoutRepo: Repository<BillingCheckoutAttempt>,
    @InjectRepository(BillingEvent)
    private readonly billingEventRepo: Repository<BillingEvent>,
  ) {}

  async createCase(
    dto: CreateSupportCaseDto,
    actor: JwtUser,
  ): Promise<SupportCase> {
    await this.assertBusinessAllowed(dto.businessId, actor);
    return this.saveCase(
      { ...dto, priority: SupportCasePriority.MEDIUM },
      actor.sub,
    );
  }

  async createCaseAsAdmin(
    dto: CreateAdminSupportCaseDto,
  ): Promise<SupportCase> {
    await this.requireUser(dto.requesterId);
    if (dto.businessId) {
      const business = await this.requireBusiness(dto.businessId);
      if (business.ownerId !== dto.requesterId) {
        throw new BadRequestException(
          'Support case requester must own the associated business',
        );
      }
    }
    return this.saveCase(dto, dto.requesterId);
  }

  async findMine(actor: JwtUser, page = 1, limit = 10) {
    const [data, total] = await this.caseRepo.findAndCount({
      where: { requesterId: actor.sub },
      relations: ['business', 'assignedAdmin'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return this.paginate(
      data.map((supportCase) => this.toRequesterCase(supportCase)),
      total,
      page,
      limit,
    );
  }

  async findCaseForActor(id: number, actor: JwtUser) {
    const supportCase = await this.requireCase(id);
    if (actor.role !== Role.ADMIN && supportCase.requesterId !== actor.sub) {
      throw new ForbiddenException('You cannot access this support case');
    }
    const messages = await this.messageRepo.find({
      where:
        actor.role === Role.ADMIN
          ? { caseId: id }
          : { caseId: id, internal: false },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
    if (actor.role === Role.ADMIN) {
      return { ...supportCase, messages };
    }
    return {
      ...this.toRequesterCase(supportCase),
      requester: this.publicUser(supportCase.requester),
      messages: messages.map((message) => ({
        ...message,
        author: this.publicUser(message.author),
      })),
    };
  }

  async addRequesterMessage(
    id: number,
    dto: CreateRequesterMessageDto,
    actor: JwtUser,
  ): Promise<SupportMessage> {
    const supportCase = await this.requireCase(id);
    if (actor.role !== Role.ADMIN && supportCase.requesterId !== actor.sub) {
      throw new ForbiddenException('You cannot access this support case');
    }
    if (supportCase.status === SupportCaseStatus.CLOSED) {
      throw new ConflictException(
        'Closed support cases cannot receive messages',
      );
    }
    const message = await this.saveMessage(id, actor.sub, dto.body, false);
    if (
      supportCase.status === SupportCaseStatus.WAITING_USER ||
      supportCase.status === SupportCaseStatus.RESOLVED
    ) {
      supportCase.status = SupportCaseStatus.OPEN;
      supportCase.resolvedAt = null;
      await this.caseRepo.save(supportCase);
    }
    return message;
  }

  async addAdminMessage(
    id: number,
    dto: CreateSupportMessageDto,
    actor: JwtUser,
  ): Promise<SupportMessage> {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can add support messages');
    }
    const supportCase = await this.requireCase(id);
    if (!dto.internal && supportCase.status === SupportCaseStatus.CLOSED) {
      throw new ConflictException(
        'Closed support cases cannot receive replies',
      );
    }
    const message = await this.saveMessage(
      id,
      actor.sub,
      dto.body,
      dto.internal ?? false,
    );
    if (!dto.internal && supportCase.status !== SupportCaseStatus.CLOSED) {
      supportCase.status = SupportCaseStatus.WAITING_USER;
      supportCase.resolvedAt = null;
      await this.caseRepo.save(supportCase);
    }
    return message;
  }

  async overview() {
    const statuses = Object.values(SupportCaseStatus);
    const statusCounts = await Promise.all(
      statuses.map(async (status) => ({
        status,
        count: await this.caseRepo.count({ where: { status } }),
      })),
    );
    const [unresolvedErrors, failedBillingEvents, processingBillingEvents] =
      await Promise.all([
        this.errorRepo.count({ where: { resolvedAt: IsNull() } }),
        this.billingEventRepo.count({ where: { failedAt: Not(IsNull()) } }),
        this.billingEventRepo.count({
          where: { processedAt: IsNull(), processingStartedAt: Not(IsNull()) },
        }),
      ]);
    return {
      cases: Object.fromEntries(
        statusCounts.map(({ status, count }) => [status, count]),
      ),
      unresolvedErrors,
      failedBillingEvents,
      processingBillingEvents,
    };
  }

  async search(q: string) {
    const term = `%${q.trim()}%`;
    const [users, businesses] = await Promise.all([
      this.userRepo
        .createQueryBuilder('user')
        .select([
          'user.id',
          'user.name',
          'user.email',
          'user.phone',
          'user.role',
          'user.isActive',
        ])
        .where(
          '(user.name LIKE :term OR user.email LIKE :term OR user.phone LIKE :term)',
          { term },
        )
        .orderBy('user.name', 'ASC')
        .take(20)
        .getMany(),
      this.businessRepo
        .createQueryBuilder('business')
        .leftJoinAndSelect('business.owner', 'owner')
        .where('(business.name LIKE :term OR business.phone LIKE :term)', {
          term,
        })
        .orderBy('business.name', 'ASC')
        .take(20)
        .getMany(),
    ]);
    return {
      results: [
        ...users.map((user) => ({ type: 'USER' as const, ...user })),
        ...businesses.map((business) => ({
          type: 'BUSINESS' as const,
          ...business,
        })),
      ],
    };
  }

  async getUserContext(id: number) {
    const user = await this.requireUser(id);
    const businesses = await this.businessRepo.find({
      where: { ownerId: id },
      order: { createdAt: 'DESC' },
    });
    const businessIds = businesses.map((business) => business.id);
    const [clientAppointments, businessAppointments, subscriptions, cases] =
      await Promise.all([
        this.appointmentRepo.find({
          where: { clientId: id },
          relations: ['business', 'service', 'staff'],
          order: { date: 'DESC', startTime: 'DESC' },
          take: 25,
        }),
        businessIds.length
          ? this.appointmentRepo.find({
              where: { businessId: In(businessIds) },
              relations: ['client', 'business', 'service', 'staff'],
              order: { date: 'DESC', startTime: 'DESC' },
              take: 25,
            })
          : [],
        businessIds.length
          ? this.subscriptionRepo.find({
              where: { businessId: In(businessIds) },
              relations: ['plan', 'business'],
              order: { createdAt: 'DESC' },
            })
          : [],
        this.caseRepo.find({
          where: { requesterId: id },
          relations: ['business', 'assignedAdmin'],
          order: { createdAt: 'DESC' },
        }),
      ]);
    return {
      user,
      businesses,
      clientAppointments,
      businessAppointments,
      subscriptions,
      cases,
    };
  }

  async getBusinessContext(id: number) {
    const business = await this.businessRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!business) throw new NotFoundException('Business not found');
    const [appointments, subscriptions, checkoutAttempts, billingEvents] =
      await Promise.all([
        this.appointmentRepo.find({
          where: { businessId: id },
          relations: ['client', 'service', 'staff'],
          order: { date: 'DESC', startTime: 'DESC' },
          take: 50,
        }),
        this.subscriptionRepo.find({
          where: { businessId: id },
          relations: ['plan'],
          order: { createdAt: 'DESC' },
        }),
        this.checkoutRepo.find({
          where: { businessId: id },
          order: { createdAt: 'DESC' },
        }),
        this.billingEventRepo.find({
          where: { businessId: id },
          order: { createdAt: 'DESC' },
          take: 100,
        }),
      ]);
    return {
      business,
      appointments,
      subscriptions,
      checkoutAttempts: checkoutAttempts.map((attempt) => ({
        businessId: attempt.businessId,
        planId: attempt.planId,
        attemptId: attempt.attemptId,
        stripeSessionId: attempt.stripeSessionId,
        expiresAt: attempt.expiresAt,
        processingStartedAt: attempt.processingStartedAt,
        createdAt: attempt.createdAt,
        updatedAt: attempt.updatedAt,
      })),
      billingEvents,
    };
  }

  async findCases(
    query: SupportCasesQueryDto,
  ): Promise<PaginatedResult<SupportCase>> {
    const { page = 1, limit = 10 } = query;
    const builder = this.caseRepo
      .createQueryBuilder('supportCase')
      .leftJoinAndSelect('supportCase.requester', 'requester')
      .leftJoinAndSelect('supportCase.business', 'business')
      .leftJoinAndSelect('supportCase.assignedAdmin', 'assignedAdmin')
      .orderBy('supportCase.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (query.status)
      builder.andWhere('supportCase.status = :status', {
        status: query.status,
      });
    if (query.priority)
      builder.andWhere('supportCase.priority = :priority', {
        priority: query.priority,
      });
    for (const field of [
      'requesterId',
      'businessId',
      'assignedAdminId',
    ] as const) {
      if (query[field]) {
        builder.andWhere(`supportCase.${field} = :${field}`, {
          [field]: query[field],
        });
      }
    }
    const [data, total] = await builder.getManyAndCount();
    return this.paginate(data, total, page, limit);
  }

  async updateCase(
    id: number,
    dto: UpdateSupportCaseDto,
  ): Promise<SupportCase> {
    if (
      dto.status === undefined &&
      dto.priority === undefined &&
      !Object.prototype.hasOwnProperty.call(dto, 'assignedAdminId')
    ) {
      throw new BadRequestException('At least one field is required');
    }
    const supportCase = await this.requireCase(id);
    if (dto.status !== undefined) {
      supportCase.status = dto.status;
      if (dto.status === SupportCaseStatus.RESOLVED) {
        supportCase.resolvedAt = new Date();
      } else if (dto.status !== SupportCaseStatus.CLOSED) {
        supportCase.resolvedAt = null;
      }
    }
    if (dto.priority !== undefined) supportCase.priority = dto.priority;
    if (Object.prototype.hasOwnProperty.call(dto, 'assignedAdminId')) {
      if (dto.assignedAdminId !== null && dto.assignedAdminId !== undefined) {
        const admin = await this.requireUser(dto.assignedAdminId);
        if (admin.role !== Role.ADMIN) {
          throw new BadRequestException('Assigned user must be an admin');
        }
      }
      supportCase.assignedAdminId = dto.assignedAdminId ?? null;
    }
    return this.caseRepo.save(supportCase);
  }

  async findErrors(
    query: ErrorsQueryDto,
  ): Promise<PaginatedResult<PlatformError>> {
    const { page = 1, limit = 10 } = query;
    const where =
      query.unresolved === undefined
        ? {}
        : query.unresolved
          ? { resolvedAt: IsNull() }
          : { resolvedAt: Not(IsNull()) };
    const [data, total] = await this.errorRepo.findAndCount({
      where,
      relations: ['resolvedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return this.paginate(data, total, page, limit);
  }

  async resolveError(id: number, adminId: number): Promise<PlatformError> {
    const platformError = await this.errorRepo.findOne({ where: { id } });
    if (!platformError) throw new NotFoundException('Platform error not found');
    platformError.resolvedAt = new Date();
    platformError.resolvedById = adminId;
    return this.errorRepo.save(platformError);
  }

  async findAudits(
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<AdminAuditLog>> {
    const [data, total] = await this.auditRepo.findAndCount({
      relations: ['admin'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return this.paginate(data, total, page, limit);
  }

  async findBillingEvents(
    query: BillingEventsQueryDto,
  ): Promise<PaginatedResult<BillingEvent>> {
    const { page = 1, limit = 10 } = query;
    const builder = this.billingEventRepo
      .createQueryBuilder('event')
      .orderBy('event.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (query.state === BillingEventState.FAILED) {
      builder.andWhere('event.failedAt IS NOT NULL');
    } else if (query.state === BillingEventState.PROCESSED) {
      builder.andWhere('event.processedAt IS NOT NULL');
    } else if (query.state === BillingEventState.PROCESSING) {
      builder
        .andWhere('event.processedAt IS NULL')
        .andWhere('event.processingStartedAt IS NOT NULL');
    }
    const [data, total] = await builder.getManyAndCount();
    return this.paginate(data, total, page, limit);
  }

  private async saveCase(
    dto: CreateSupportCaseDto,
    requesterId: number,
  ): Promise<SupportCase> {
    const supportCase = this.caseRepo.create({
      folio: `SUP-${randomBytes(16).toString('hex').toUpperCase()}`,
      requesterId,
      businessId: dto.businessId ?? null,
      subject: dto.subject.trim(),
      description: dto.description.trim(),
      status: SupportCaseStatus.OPEN,
      priority: dto.priority ?? SupportCasePriority.MEDIUM,
      assignedAdminId: null,
      resolvedAt: null,
    });
    return this.caseRepo.save(supportCase);
  }

  private async saveMessage(
    caseId: number,
    authorId: number,
    body: string,
    internal: boolean,
  ): Promise<SupportMessage> {
    return this.messageRepo.save(
      this.messageRepo.create({
        caseId,
        authorId,
        body: body.trim(),
        internal,
      }),
    );
  }

  private async assertBusinessAllowed(
    businessId: number | undefined,
    actor: JwtUser,
  ): Promise<void> {
    if (!businessId) return;
    const business = await this.requireBusiness(businessId);
    if (actor.role !== Role.ADMIN && business.ownerId !== actor.sub) {
      throw new ForbiddenException(
        'You can only associate a business that you own',
      );
    }
  }

  private async requireCase(id: number): Promise<SupportCase> {
    const supportCase = await this.caseRepo.findOne({
      where: { id },
      relations: ['requester', 'business', 'assignedAdmin'],
    });
    if (!supportCase) throw new NotFoundException('Support case not found');
    return supportCase;
  }

  private async requireUser(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async requireBusiness(id: number): Promise<Business> {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private publicUser(user: User | null | undefined) {
    if (!user) return null;
    return { id: user.id, name: user.name, role: user.role };
  }

  private toRequesterCase(supportCase: SupportCase) {
    return {
      ...supportCase,
      requester: supportCase.requester
        ? this.publicUser(supportCase.requester)
        : undefined,
      assignedAdmin: this.publicUser(supportCase.assignedAdmin),
    };
  }

  private paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResult<T> {
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
