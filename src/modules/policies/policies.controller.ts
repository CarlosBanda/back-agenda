import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Role } from '../users/entities/user.entity';
import { UpsertPolicyDto } from './dto/policy.dto';
import { PoliciesService } from './policies.service';

@ApiTags('Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BUSINESS, Role.ADMIN)
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get('businesses/:businessId')
  get(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.policiesService.get(businessId, req.user.sub, req.user.role);
  }

  @Put('businesses/:businessId')
  upsert(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: UpsertPolicyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.policiesService.upsert(
      businessId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }
}

@ApiTags('Public policies')
@Controller('public/policies')
export class PublicPoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get('businesses/:businessId')
  getPublic(@Param('businessId', ParseIntPipe) businessId: number) {
    return this.policiesService.getPublic(businessId);
  }
}
