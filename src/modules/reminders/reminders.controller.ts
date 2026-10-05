import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import { UpsertReminderSettingDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

@ApiTags('Reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BUSINESS, Role.ADMIN)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('businesses/:businessId/settings')
  getSettings(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.remindersService.getSettings(
      businessId,
      req.user.sub,
      req.user.role,
    );
  }

  @Put('businesses/:businessId/settings')
  upsertSettings(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: UpsertReminderSettingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.remindersService.upsertSettings(
      businessId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Get('businesses/:businessId/attempts')
  listAttempts(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Query() pagination: PaginationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.remindersService.listAttempts(
      businessId,
      req.user.sub,
      req.user.role,
      pagination.page,
      pagination.limit,
    );
  }

  @Post('appointments/:id/send')
  sendNow(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.remindersService.sendNow(id, req.user.sub, req.user.role);
  }
}
