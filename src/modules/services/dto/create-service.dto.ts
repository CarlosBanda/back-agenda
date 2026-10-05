import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(5)
  duration: number;

  @IsNumber()
  businessId: number;
}
