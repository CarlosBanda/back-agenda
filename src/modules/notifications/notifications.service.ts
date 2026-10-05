import { Injectable, Logger } from '@nestjs/common';
import type { Appointment } from '../appointments/entities/appointment.entity';

type NotificationAppointment = Pick<
  Appointment,
  'clientId' | 'date' | 'startTime'
>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendAppointmentCreated(
    appointment: NotificationAppointment,
  ): Promise<void> {
    if (appointment.clientId == null) return;
    await this.sendEmail(
      appointment.clientId,
      'Cita agendada',
      `Tu cita ha sido agendada para el ${appointment.date} a las ${appointment.startTime}.`,
    );
    await this.sendWhatsApp(
      appointment.clientId,
      `✅ Cita agendada para el ${appointment.date} a las ${appointment.startTime}.`,
    );
  }

  async sendAppointmentCancelled(
    appointment: NotificationAppointment,
  ): Promise<void> {
    if (appointment.clientId == null) return;
    await this.sendEmail(
      appointment.clientId,
      'Cita cancelada',
      `Tu cita del ${appointment.date} a las ${appointment.startTime} ha sido cancelada.`,
    );
    await this.sendWhatsApp(
      appointment.clientId,
      `❌ Tu cita del ${appointment.date} a las ${appointment.startTime} fue cancelada.`,
    );
  }

  async sendReminder(appointment: NotificationAppointment): Promise<void> {
    if (appointment.clientId == null) return;
    await this.sendEmail(
      appointment.clientId,
      'Recordatorio de cita - Mañana',
      `Recordatorio: tienes una cita mañana ${appointment.date} a las ${appointment.startTime}.`,
    );
    await this.sendWhatsApp(
      appointment.clientId,
      `🔔 Recordatorio: tu cita es mañana ${appointment.date} a las ${appointment.startTime}.`,
    );
  }

  private sendEmail(
    userId: number,
    subject: string,
    text: string,
  ): Promise<void> {
    this.logger.log(
      `[EMAIL_PENDING] userId:${userId} | Subject:${subject} | Body:${text}`,
    );
    return Promise.resolve();
  }

  private sendWhatsApp(userId: number, message: string): Promise<void> {
    this.logger.log(`[WHATSAPP_PENDING] userId:${userId} | Message:${message}`);
    return Promise.resolve();
  }
}
