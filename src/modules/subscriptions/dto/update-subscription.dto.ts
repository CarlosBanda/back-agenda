import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SubscriptionStatus } from '../entities/subscription.entity';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsNumber()
  planId?: number;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  providerSubscriptionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  providerCustomerId?: string;

  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
