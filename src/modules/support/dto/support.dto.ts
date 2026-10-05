import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  SupportCasePriority,
  SupportCaseStatus,
} from '../entities/support-case.entity';

export class CreateSupportCaseDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(10_000)
  description: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  businessId?: number;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;
}

export class CreateAdminSupportCaseDto extends CreateSupportCaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requesterId: number;
}

export class CreateSupportMessageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(10_000)
  body: string;

  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

export class CreateRequesterMessageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(10_000)
  body: string;
}

export class SearchSupportDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q: string;
}

export class SupportCasesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(SupportCaseStatus)
  status?: SupportCaseStatus;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requesterId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  businessId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedAdminId?: number;
}

export class UpdateSupportCaseDto {
  @IsOptional()
  @IsEnum(SupportCaseStatus)
  status?: SupportCaseStatus;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedAdminId?: number | null;
}

export class ErrorsQueryDto extends PaginationDto {
  @IsOptional()
  @Transform((params: TransformFnParams): unknown => {
    const value: unknown = params.value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  unresolved?: boolean;
}

export enum BillingEventState {
  FAILED = 'failed',
  PROCESSED = 'processed',
  PROCESSING = 'processing',
}

export class BillingEventsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BillingEventState)
  state?: BillingEventState;
}
