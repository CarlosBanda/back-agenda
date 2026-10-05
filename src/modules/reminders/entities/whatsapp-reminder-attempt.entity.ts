import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Appointment } from '../../appointments/entities/appointment.entity';

export enum ReminderAttemptStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

@Entity('whatsapp_reminder_attempts')
@Index(['businessId', 'createdAt'])
export class WhatsappReminderAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column()
  appointmentId: number;

  @Column()
  businessId: number;

  // Deterministic key (appointmentId + reminder date) enforcing idempotency:
  // a reminder is attempted at most once per appointment per day.
  @Index('IDX_whatsapp_attempts_idempotency', { unique: true })
  @Column({ length: 120 })
  idempotencyKey: string;

  @Column({
    type: 'enum',
    enum: ReminderAttemptStatus,
    default: ReminderAttemptStatus.PENDING,
  })
  status: ReminderAttemptStatus;

  @Column({ type: 'varchar', nullable: true, length: 191 })
  providerMessageId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 1000 })
  sanitizedError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
