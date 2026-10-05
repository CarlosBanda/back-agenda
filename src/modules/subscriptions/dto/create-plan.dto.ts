import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO4217CurrencyCode,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingInterval } from '../entities/plan.entity';

export class CreatePlanDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsISO4217CurrencyCode()
  currency: string;

  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @IsNumber()
  @Min(1)
  duration: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxServices?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStaff?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAppointmentsPerMonth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  @Matches(/^price_[A-Za-z0-9]+$/)
  providerPriceId?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
