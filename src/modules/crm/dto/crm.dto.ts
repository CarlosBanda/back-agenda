import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ClientSource } from '../entities/client.entity';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class LinkClientDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;
}

export class CreateClientNoteDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(5000)
  body: string;
}

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class AssignTagsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Type(() => Number)
  tagIds: number[];
}

export class ClientsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tagId?: number;

  @IsOptional()
  @IsEnum(ClientSource)
  source?: ClientSource;
}

export class ImportClientsDto {
  // Raw CSV text sent as a JSON string field (no file upload / no new
  // dependency). Columns: name, phone, email, notes, tags (tags separated by
  // ';' or '|').
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000_000)
  content: string;

  @IsOptional()
  @IsBoolean()
  hasHeader?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Type(() => Number)
  defaultTagIds?: number[];
}
