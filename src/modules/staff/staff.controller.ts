import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../users/entities/user.entity';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('business/:businessId')
  findByBusiness(@Param('businessId') businessId: number) {
    return this.staffService.findByBusiness(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.staffService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  create(@Body() dto: CreateStaffDto, @Req() req: AuthenticatedRequest) {
    return this.staffService.create(dto, req.user.sub, req.user.role);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  update(
    @Param('id') id: number,
    @Body() dto: UpdateStaffDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  remove(@Param('id') id: number, @Req() req: AuthenticatedRequest) {
    return this.staffService.remove(id, req.user.sub, req.user.role);
  }
}
