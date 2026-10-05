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
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Role } from '../users/entities/user.entity';
import { AgendaService } from './agenda.service';
import {
  AgendaDayDto,
  AgendaRangeDto,
  DepositDto,
  QuickActionDto,
} from './dto/agenda.dto';

@ApiTags('Agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BUSINESS, Role.ADMIN)
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get('businesses/:businessId')
  getRange(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() query: AgendaRangeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agendaService.getRange(
      businessId,
      query,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('businesses/:businessId/day')
  getDay(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() query: AgendaDayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agendaService.getDay(
      businessId,
      query.date,
      query.staffId,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('businesses/:businessId/week')
  getWeek(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() query: AgendaDayDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agendaService.getWeek(
      businessId,
      query.date,
      query.staffId,
      req.user.sub,
      req.user.role,
    );
  }

  @Patch('appointments/:id/quick-action')
  quickAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QuickActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agendaService.quickAction(id, dto, req.user.sub, req.user.role);
  }

  @Patch('appointments/:id/deposit')
  setDeposit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DepositDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agendaService.setDeposit(id, dto, req.user.sub, req.user.role);
  }

  @Post('appointments/:id/deposit/apply-policy')
  applyPolicyDeposit(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.agendaService.applyPolicyDeposit(
      id,
      req.user.sub,
      req.user.role,
    );
  }
}
