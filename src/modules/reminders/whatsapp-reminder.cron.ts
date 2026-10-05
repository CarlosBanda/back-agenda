import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sanitizeErrorMessage } from '../../common/utils/error-sanitizer';
import { RemindersService } from './reminders.service';

@Injectable()
export class WhatsAppReminderCron {
  private readonly logger = new Logger(WhatsAppReminderCron.name);

  constructor(private readonly remindersService: RemindersService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      await this.remindersService.scanAndSend();
    } catch (error) {
      this.logger.warn(
        `WhatsApp reminder cron failed: ${sanitizeErrorMessage(error, 200)}`,
      );
    }
  }
}
