import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertReminderSettingDto {
  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  hoursBefore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  messageTemplate?: string;
}
