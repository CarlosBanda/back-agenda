import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = tomorrow.toISOString().split('T')[0];

    const appointments = await this.repo.find({
      where: { date, status: AppointmentStatus.PENDING },
      relations: ['client', 'business', 'service'],
    });

    for (const appt of appointments) {
      await this.notificationsService.sendReminder(appt).catch(() => {});
    }

    if (appointments.length > 0) {
      this.logger.log(`Sent ${appointments.length} reminders for ${date}`);
    }
  }
}
