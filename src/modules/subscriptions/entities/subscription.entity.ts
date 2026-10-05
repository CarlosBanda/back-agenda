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
import { Business } from '../../business/entities/business.entity';
import { Plan } from './plan.entity';

export enum SubscriptionStatus {
  INCOMPLETE = 'INCOMPLETE',
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('subscriptions')
@Index(['businessId', 'status', 'endDate'])
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: number;

  @ManyToOne(() => Plan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'planId' })
  plan: Plan;

  @Column()
  planId: number;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.INCOMPLETE,
  })
  status: SubscriptionStatus;

  @Column({ length: 40, default: 'MANUAL' })
  provider: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true, length: 191 })
  providerSubscriptionId: string | null;

  @Column({ type: 'varchar', nullable: true, length: 191 })
  providerCustomerId: string | null;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
