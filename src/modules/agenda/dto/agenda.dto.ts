import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AppointmentStatus,
  DepositStatus,
} from '../../appointments/entities/appointment.entity';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class AgendaRangeDto {
  @IsString()
  @Matches(DATE_REGEX, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @IsString()
  @Matches(DATE_REGEX, { message: 'to must be YYYY-MM-DD' })
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  staffId?: number;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}

export class AgendaDayDto {
  @IsString()
  @Matches(DATE_REGEX, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  staffId?: number;
}

export enum QuickAction {
  CONFIRM = 'CONFIRM',
  COMPLETE = 'COMPLETE',
  CANCEL = 'CANCEL',
  NO_SHOW = 'NO_SHOW',
}

export class QuickActionDto {
  @IsEnum(QuickAction)
  action: QuickAction;
}

export class DepositDto {
  @IsEnum(DepositStatus)
  status: DepositStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
