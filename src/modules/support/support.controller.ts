import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Role } from '../users/entities/user.entity';
import {
  CreateSupportCaseDto,
  CreateSupportMessageDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT, Role.BUSINESS)
@Controller('support/cases')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  createCase(
    @Body() dto: CreateSupportCaseDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.createCase(dto, request.user);
  }

  @Get('mine')
  findMine(
    @Query() pagination: PaginationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.findMine(
      request.user,
      pagination.page,
      pagination.limit,
    );
  }

  @Get(':id')
  findCase(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.findCaseForActor(id, request.user);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSupportMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (dto.internal) {
      throw new ForbiddenException('Only admins can create internal messages');
    }
    return this.supportService.addRequesterMessage(
      id,
      { body: dto.body },
      request.user,
    );
  }
}
