import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
  BillingEventsQueryDto,
  CreateAdminSupportCaseDto,
  CreateSupportMessageDto,
  ErrorsQueryDto,
  SearchSupportDto,
  SupportCasesQueryDto,
  UpdateSupportCaseDto,
} from './dto/support.dto';
import { SupportService } from './support.service';

@ApiTags('Support Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('support/admin')
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get('overview')
  overview() {
    return this.supportService.overview();
  }

  @Get('search')
  search(@Query() query: SearchSupportDto) {
    return this.supportService.search(query.q);
  }

  @Get('users/:id/context')
  userContext(@Param('id', ParseIntPipe) id: number) {
    return this.supportService.getUserContext(id);
  }

  @Get('businesses/:id/context')
  businessContext(@Param('id', ParseIntPipe) id: number) {
    return this.supportService.getBusinessContext(id);
  }

  @Get('cases')
  findCases(@Query() query: SupportCasesQueryDto) {
    return this.supportService.findCases(query);
  }

  @Get('cases/:id')
  findCase(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.findCaseForActor(id, request.user);
  }

  @Post('cases')
  createCase(@Body() dto: CreateAdminSupportCaseDto) {
    return this.supportService.createCaseAsAdmin(dto);
  }

  @Patch('cases/:id')
  updateCase(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupportCaseDto,
  ) {
    return this.supportService.updateCase(id, dto);
  }

  @Post('cases/:id/messages')
  addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSupportMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.addAdminMessage(id, dto, request.user);
  }

  @Get('errors')
  findErrors(@Query() query: ErrorsQueryDto) {
    return this.supportService.findErrors(query);
  }

  @Patch('errors/:id/resolve')
  resolveError(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.supportService.resolveError(id, request.user.sub);
  }

  @Get('audits')
  findAudits(@Query() pagination: PaginationDto) {
    return this.supportService.findAudits(pagination.page, pagination.limit);
  }

  @Get('billing-events')
  findBillingEvents(@Query() query: BillingEventsQueryDto) {
    return this.supportService.findBillingEvents(query);
  }
}
