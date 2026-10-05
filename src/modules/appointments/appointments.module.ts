import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { Client } from '../crm/entities/client.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentReminderService } from './appointment-reminder.service';
import { ServicesModule } from '../services/services.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BusinessModule } from '../business/business.module';
import { StaffModule } from '../staff/staff.module';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, Client]),
    ServicesModule,
    ScheduleModule,
    NotificationsModule,
    SubscriptionsModule,
    BusinessModule,
    StaffModule,
    PoliciesModule,
  ],
  providers: [AppointmentsService, AppointmentReminderService],
  controllers: [AppointmentsController],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
