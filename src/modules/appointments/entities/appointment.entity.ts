import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Business } from '../../business/entities/business.entity';
import { Service } from '../../services/entities/service.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { Client } from '../../crm/entities/client.entity';

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

export enum DepositStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
  REFUNDED = 'REFUNDED',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Column({ nullable: true })
  notes: string;

  // Nullable because business-created appointments may target an imported CRM
  // client that has no platform user account.
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'clientId' })
  client: User | null;

  @Column({ type: 'int', nullable: true })
  clientId: number | null;

  // CRM client record (imported or linked). Optional to preserve the original
  // user-booked appointment flow.
  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientRecordId' })
  clientRecord: Client | null;

  @Column({ type: 'int', nullable: true })
  clientRecordId: number | null;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: number;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column()
  serviceId: number;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'staffId' })
  staff: Staff;

  @Column({ nullable: true })
  staffId: number;

  // Manual advance-payment tracking (Stripe integration pending).
  @Column({
    type: 'enum',
    enum: DepositStatus,
    default: DepositStatus.NOT_REQUIRED,
  })
  depositStatus: DepositStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  depositAmount: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  depositPaidAmount: string | null;

  @Column({ type: 'datetime', nullable: true })
  depositPaidAt: Date | null;

  @Column({ type: 'varchar', nullable: true, length: 40 })
  depositMethod: string | null;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  depositNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
