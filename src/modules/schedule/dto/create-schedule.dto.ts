import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DayOfWeek } from '../entities/schedule.entity';

export class CreateScheduleDto {
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @IsNumber()
  businessId: number;

  @IsNumber()
  @IsOptional()
  staffId?: number;
}
