import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(10)
  password: string;

  @IsIn([Role.CLIENT, Role.BUSINESS])
  @IsOptional()
  role?: Role;

  @IsString()
  phone: string;
}
