import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export class CreateBusinessAppointmentDto extends CreateAppointmentDto {
  // Existing platform user acting as the client. Optional when booking for a
  // CRM client record instead.
  @IsOptional()
  @IsInt()
  @Min(1)
  clientId?: number;

  // CRM client record (imported or linked). Exactly one of clientId or
  // clientRecordId must be provided.
  @IsOptional()
  @IsInt()
  @Min(1)
  clientRecordId?: number;
}
