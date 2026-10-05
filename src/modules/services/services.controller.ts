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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../users/entities/user.entity';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('business/:businessId')
  findByBusiness(@Param('businessId') businessId: number) {
    return this.servicesService.findByBusiness(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  create(@Body() dto: CreateServiceDto, @Req() req: AuthenticatedRequest) {
    return this.servicesService.create(dto, req.user.sub, req.user.role);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  update(
    @Param('id') id: number,
    @Body() dto: UpdateServiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.servicesService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  remove(@Param('id') id: number, @Req() req: AuthenticatedRequest) {
    return this.servicesService.remove(id, req.user.sub, req.user.role);
  }
}
