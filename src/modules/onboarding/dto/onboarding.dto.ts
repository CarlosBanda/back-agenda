import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsBoolean()
  profileCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  servicesConfigured?: boolean;

  @IsOptional()
  @IsBoolean()
  scheduleConfigured?: boolean;

  @IsOptional()
  @IsBoolean()
  staffConfigured?: boolean;

  @IsOptional()
  @IsBoolean()
  policiesConfigured?: boolean;

  @IsOptional()
  @IsBoolean()
  clientsImported?: boolean;

  @IsOptional()
  @IsBoolean()
  remindersReviewed?: boolean;
}
