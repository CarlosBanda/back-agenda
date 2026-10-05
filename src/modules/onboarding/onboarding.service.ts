import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessService } from '../business/business.service';
import { ClientsService } from '../crm/clients.service';
import { ImportClientsDto } from '../crm/dto/crm.dto';
import { Role } from '../users/entities/user.entity';
import { UpdateOnboardingDto } from './dto/onboarding.dto';
import {
  OnboardingState,
  OnboardingStatus,
} from './entities/onboarding-state.entity';

const CHECKLIST_KEYS = [
  'profileCompleted',
  'servicesConfigured',
  'scheduleConfigured',
  'staffConfigured',
  'policiesConfigured',
  'clientsImported',
  'remindersReviewed',
] as const;

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(OnboardingState)
    private readonly repo: Repository<OnboardingState>,
    private readonly businessService: BusinessService,
    private readonly clientsService: ClientsService,
  ) {}

  async get(
    businessId: number,
    userId: number,
    role: Role,
  ): Promise<OnboardingState> {
    await this.businessService.assertCanManage(businessId, userId, role);
    return this.getOrDefault(businessId);
  }

  async update(
    businessId: number,
    dto: UpdateOnboardingDto,
    userId: number,
    role: Role,
  ): Promise<OnboardingState> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const state = await this.getOrDefault(businessId);
    for (const key of CHECKLIST_KEYS) {
      if (dto[key] !== undefined) state[key] = dto[key];
    }
    return this.repo.save(this.applyStatus(state));
  }

  async importClients(
    businessId: number,
    dto: ImportClientsDto,
    userId: number,
    role: Role,
  ) {
    // Ownership is enforced inside the CRM import as well.
    const result = await this.clientsService.importFromCsvText(
      businessId,
      dto,
      userId,
      role,
    );
    const state = await this.getOrDefault(businessId);
    if (result.created > 0 && !state.clientsImported) {
      state.clientsImported = true;
      await this.repo.save(this.applyStatus(state));
    }
    return { import: result, onboarding: await this.getOrDefault(businessId) };
  }

  private applyStatus(state: OnboardingState): OnboardingState {
    const completedCount = CHECKLIST_KEYS.filter((key) => state[key]).length;
    if (completedCount === CHECKLIST_KEYS.length) {
      state.status = OnboardingStatus.COMPLETED;
      state.completedAt = state.completedAt ?? new Date();
    } else if (completedCount > 0) {
      state.status = OnboardingStatus.IN_PROGRESS;
      state.completedAt = null;
    } else {
      state.status = OnboardingStatus.PENDING;
      state.completedAt = null;
    }
    return state;
  }

  private async getOrDefault(businessId: number): Promise<OnboardingState> {
    const existing = await this.repo.findOne({ where: { businessId } });
    if (existing) return existing;
    return this.repo.create({
      businessId,
      status: OnboardingStatus.PENDING,
      profileCompleted: false,
      servicesConfigured: false,
      scheduleConfigured: false,
      staffConfigured: false,
      policiesConfigured: false,
      clientsImported: false,
      remindersReviewed: false,
      completedAt: null,
    });
  }
}
