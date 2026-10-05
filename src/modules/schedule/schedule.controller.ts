import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../users/entities/user.entity';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Schedules')
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('business/:businessId')
  findByBusiness(@Param('businessId') businessId: number) {
    return this.scheduleService.findByBusiness(businessId);
  }

  @Get('staff/:staffId')
  findByStaff(@Param('staffId') staffId: number) {
    return this.scheduleService.findByStaff(staffId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  create(@Body() dto: CreateScheduleDto, @Req() req: AuthenticatedRequest) {
    return this.scheduleService.createSchedule(
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  remove(@Param('id') id: number, @Req() req: AuthenticatedRequest) {
    return this.scheduleService.removeSchedule(id, req.user.sub, req.user.role);
  }

  // Blocked slots
  @Get('blocked/:businessId')
  findBlocked(
    @Param('businessId') businessId: number,
    @Query('date') date: string,
  ) {
    return this.scheduleService.findBlockedSlots(businessId, date);
  }

  @Post('blocked')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  createBlocked(
    @Body() dto: CreateBlockedSlotDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.scheduleService.createBlockedSlot(
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Delete('blocked/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  removeBlocked(@Param('id') id: number, @Req() req: AuthenticatedRequest) {
    return this.scheduleService.removeBlockedSlot(
      id,
      req.user.sub,
      req.user.role,
    );
  }
}
