import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';

@Entity('billing_events')
export class BillingEvent {
  @PrimaryColumn({ length: 191 })
  eventId: string;

  @Column({ length: 100 })
  type: string;

  @ManyToOne(() => Business, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'businessId' })
  business: Business | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  businessId: number | null;

  @Column({ type: 'datetime', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  processingStartedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'datetime', nullable: true })
  failedAt: Date | null;

  @Column({ default: 0 })
  attempts: number;

  @CreateDateColumn()
  createdAt: Date;
}
