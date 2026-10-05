import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { ImportClientsDto } from '../crm/dto/crm.dto';
import { Role } from '../users/entities/user.entity';
import { UpdateOnboardingDto } from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BUSINESS, Role.ADMIN)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('businesses/:businessId')
  get(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.onboardingService.get(businessId, req.user.sub, req.user.role);
  }

  @Patch('businesses/:businessId')
  update(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: UpdateOnboardingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.onboardingService.update(
      businessId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }

  @Post('businesses/:businessId/import-clients')
  importClients(
    @Param('businessId', ParseIntPipe) businessId: number,
    @Body() dto: ImportClientsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.onboardingService.importClients(
      businessId,
      dto,
      req.user.sub,
      req.user.role,
    );
  }
}
