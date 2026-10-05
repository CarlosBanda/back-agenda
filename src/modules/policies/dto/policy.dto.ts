import {
  Equals,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChargeType } from '../entities/business-policy.entity';

export class UpsertPolicyDto {
  @IsOptional()
  @IsEnum(ChargeType)
  depositType?: ChargeType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositValue?: number;

  @IsOptional()
  @IsString()
  @Equals('MXN')
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  cancellationWindowHours?: number;

  @IsOptional()
  @IsEnum(ChargeType)
  cancellationFeeType?: ChargeType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cancellationFeeValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  policyText?: string;
}
