import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @IsNumber()
  businessId: number;

  @IsNumber()
  serviceId: number;

  @IsNumber()
  @IsOptional()
  staffId?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
