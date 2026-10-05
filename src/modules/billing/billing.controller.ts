import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Role } from '../users/entities/user.entity';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';
import { StripeBillingService } from './stripe-billing.service';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: StripeBillingService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @ApiBearerAuth()
  createCheckout(
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.billingService.createCheckoutSession(dto, req.user);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  @ApiBearerAuth()
  createPortal(
    @Body() dto: CreatePortalSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.billingService.createPortalSession(dto, req.user);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.billingService.processWebhook(req.rawBody, signature);
  }
}
