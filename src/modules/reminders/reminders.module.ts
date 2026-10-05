import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/entities/appointment.entity';
import { BusinessModule } from '../business/business.module';
import { ReminderSetting } from './entities/reminder-setting.entity';
import { WhatsappReminderAttempt } from './entities/whatsapp-reminder-attempt.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { WhatsAppProviderService } from './whatsapp-provider.service';
import { WhatsAppReminderCron } from './whatsapp-reminder.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReminderSetting,
      WhatsappReminderAttempt,
      Appointment,
    ]),
    BusinessModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService, WhatsAppProviderService, WhatsAppReminderCron],
  exports: [RemindersService, WhatsAppProviderService],
})
export class RemindersModule {}
