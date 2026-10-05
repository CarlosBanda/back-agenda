import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  businessId: number;
}
