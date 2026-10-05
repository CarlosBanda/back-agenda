import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class CreateBlockedSlotDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsNumber()
  businessId: number;

  @IsNumber()
  @IsOptional()
  staffId?: number;
}
