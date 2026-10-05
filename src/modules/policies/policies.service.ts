import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessService } from '../business/business.service';
import { Role } from '../users/entities/user.entity';
import { BusinessPolicy, ChargeType } from './entities/business-policy.entity';
import { UpsertPolicyDto } from './dto/policy.dto';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(BusinessPolicy)
    private readonly repo: Repository<BusinessPolicy>,
    private readonly businessService: BusinessService,
  ) {}

  async get(
    businessId: number,
    userId: number,
    role: Role,
  ): Promise<BusinessPolicy> {
    await this.businessService.assertCanManage(businessId, userId, role);
    return this.getOrDefault(businessId);
  }

  async getPublic(businessId: number) {
    await this.businessService.findOne(businessId);
    const policy = await this.getOrDefault(businessId);
    return {
      businessId: policy.businessId,
      depositType: policy.depositType,
      depositValue: policy.depositValue,
      currency: policy.currency,
      cancellationWindowHours: policy.cancellationWindowHours,
      cancellationFeeType: policy.cancellationFeeType,
      cancellationFeeValue: policy.cancellationFeeValue,
      policyText: policy.policyText,
    };
  }

  async upsert(
    businessId: number,
    dto: UpsertPolicyDto,
    userId: number,
    role: Role,
  ): Promise<BusinessPolicy> {
    await this.businessService.assertCanManage(businessId, userId, role);
    const policy = await this.getOrDefault(businessId);
    const nextDepositType = dto.depositType ?? policy.depositType;
    const nextDepositValue = dto.depositValue ?? Number(policy.depositValue);
    const nextCancellationType =
      dto.cancellationFeeType ?? policy.cancellationFeeType;
    const nextCancellationValue =
      dto.cancellationFeeValue ?? Number(policy.cancellationFeeValue);
    this.assertValidCharge(nextDepositType, nextDepositValue, 'deposit');
    this.assertValidCharge(
      nextCancellationType,
      nextCancellationValue,
      'cancellation fee',
    );
    if (dto.currency !== undefined && dto.currency !== 'MXN') {
      throw new BadRequestException('Only MXN currency is supported');
    }
    if (dto.depositType !== undefined) policy.depositType = dto.depositType;
    if (dto.depositValue !== undefined) {
      policy.depositValue = dto.depositValue.toFixed(2);
    }
    if (dto.currency !== undefined) policy.currency = dto.currency;
    if (dto.cancellationWindowHours !== undefined) {
      policy.cancellationWindowHours = dto.cancellationWindowHours;
    }
    if (dto.cancellationFeeType !== undefined) {
      policy.cancellationFeeType = dto.cancellationFeeType;
    }
    if (dto.cancellationFeeValue !== undefined) {
      policy.cancellationFeeValue = dto.cancellationFeeValue.toFixed(2);
    }
    if (dto.policyText !== undefined) {
      policy.policyText = dto.policyText.trim() || null;
    }
    return this.repo.save(policy);
  }

  /**
   * Returns the persisted policy or an in-memory default (not saved) so the
   * API always exposes a consistent shape for a business.
   */
  async getOrDefault(businessId: number): Promise<BusinessPolicy> {
    const existing = await this.repo.findOne({ where: { businessId } });
    if (existing) return existing;
    return this.repo.create({
      businessId,
      depositType: ChargeType.NONE,
      depositValue: '0.00',
      currency: 'MXN',
      cancellationWindowHours: 24,
      cancellationFeeType: ChargeType.NONE,
      cancellationFeeValue: '0.00',
      policyText: null,
    });
  }

  /**
   * Computes the required advance-payment amount for a service price given the
   * business deposit policy. Always returns a 2-decimal string in MXN.
   */
  computeDeposit(policy: BusinessPolicy, servicePrice: number): string {
    if (policy.depositType === ChargeType.NONE) return '0.00';
    const value = Number(policy.depositValue);
    if (policy.depositType === ChargeType.FIXED) {
      return Math.min(value, servicePrice).toFixed(2);
    }
    // PERCENT
    const amount = (servicePrice * value) / 100;
    return Math.max(0, Math.min(amount, servicePrice)).toFixed(2);
  }

  private assertValidCharge(
    type: ChargeType,
    value: number,
    field: string,
  ): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${field} value must be non-negative`);
    }
    if (type === ChargeType.PERCENT && value > 100) {
      throw new BadRequestException(`${field} percentage cannot exceed 100`);
    }
  }
}
