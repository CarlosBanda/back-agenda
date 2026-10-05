import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBusinessAppointmentDto } from './dto/create-business-appointment.dto';
import { AppointmentStatus } from './entities/appointment.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../users/entities/user.entity';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // Cliente agenda cita
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.CLIENT)
  create(@Body() dto: CreateAppointmentDto, @Req() req: AuthenticatedRequest) {
    return this.appointmentsService.create(dto, req.user.sub);
  }

  // Negocio crea cita para un cliente
  @Post('business')
  @UseGuards(RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  createByBusiness(
    @Body() body: CreateBusinessAppointmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { clientId, clientRecordId, ...dto } = body;
    return this.appointmentsService.createByBusiness(
      dto,
      clientId ?? null,
      clientRecordId ?? null,
      req.user.sub,
      req.user.role,
    );
  }

  // Slots disponibles (público con auth)
  @Get('available-slots')
  getAvailableSlots(
    @Query('businessId') businessId: number,
    @Query('date') date: string,
    @Query('serviceId') serviceId: number,
    @Query('staffId') staffId?: number,
  ) {
    return this.appointmentsService.getAvailableSlots(
      businessId,
      date,
      serviceId,
      staffId,
    );
  }

  // Cliente ve sus citas
  @Get('my')
  findMy(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.appointmentsService.findByClient(req.user.sub, page, limit);
  }

  // Negocio ve sus citas
  @Get('business/:businessId')
  @UseGuards(RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  findByBusiness(
    @Param('businessId') businessId: number,
    @Query('date') date: string | undefined,
    @Query('page') page: number | undefined,
    @Query('limit') limit: number | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (date) {
      return this.appointmentsService.findByBusinessAndDate(
        businessId,
        date,
        req.user.sub,
        req.user.role,
      );
    }
    return this.appointmentsService.findByBusiness(
      businessId,
      req.user.sub,
      req.user.role,
      page,
      limit,
    );
  }

  // Cambiar status (confirmar, completar)
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.BUSINESS, Role.ADMIN)
  updateStatus(
    @Param('id') id: number,
    @Body('status', new ParseEnumPipe(AppointmentStatus))
    status: AppointmentStatus,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appointmentsService.updateStatus(
      id,
      status,
      req.user.sub,
      req.user.role,
    );
  }

  // Cancelar cita (cliente o negocio)
  @Patch(':id/cancel')
  cancel(@Param('id') id: number, @Req() req: AuthenticatedRequest) {
    return this.appointmentsService.cancel(id, req.user.sub, req.user.role);
  }
}
