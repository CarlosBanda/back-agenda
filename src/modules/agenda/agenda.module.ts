import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from '../appointments/appointments.module';
import { Appointment } from '../appointments/entities/appointment.entity';
import { BusinessModule } from '../business/business.module';
import { PoliciesModule } from '../policies/policies.module';
import { ServicesModule } from '../services/services.module';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment]),
    AppointmentsModule,
    BusinessModule,
    PoliciesModule,
    ServicesModule,
  ],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
