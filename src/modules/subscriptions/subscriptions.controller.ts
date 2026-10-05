import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../users/entities/user.entity';
import { BusinessService } from '../business/business.service';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly businessService: BusinessService,
  ) {}

  // --- PUBLIC: Listar planes activos ---
  @Get('plans')
  findAllPlans() {
    return this.service.findAllPlans();
  }

  // --- ADMIN: Gestión de planes ---
  @Get('admin/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  findAllPlansAdmin() {
    return this.service.findAllPlansAdmin();
  }

  @Post('admin/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Put('admin/plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  updatePlan(@Param('id') id: number, @Body() dto: UpdatePlanDto) {
    return this.service.updatePlan(id, dto);
  }

  @Delete('admin/plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  removePlan(@Param('id') id: number) {
    return this.service.removePlan(id);
  }

  // --- ADMIN: Gestión de suscripciones ---
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  getStats() {
    return this.service.getStats();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  findAllSubscriptions(@Query() pagination: PaginationDto) {
    return this.service.findAllSubscriptions(pagination);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  findOne(@Param('id') id: number) {
    return this.service.findSubscriptionById(id);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.service.createSubscription(dto);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  updateSubscription(
    @Param('id') id: number,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.service.updateSubscription(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  cancelSubscription(@Param('id') id: number) {
    return this.service.cancelSubscription(id);
  }

  // --- BUSINESS: Ver su propia suscripción ---
  @Get('business/:businessId/entitlements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getEntitlements(
    @Param('businessId') businessId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.businessService.assertCanManage(
      businessId,
      req.user.sub,
      req.user.role,
    );
    return this.service.getEntitlements(businessId);
  }

  @Get('business/:businessId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async findByBusiness(
    @Param('businessId') businessId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.businessService.assertCanManage(
      businessId,
      req.user.sub,
      req.user.role,
    );
    return this.service.findByBusiness(businessId);
  }
}
