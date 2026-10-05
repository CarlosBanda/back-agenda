import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';

export enum OnboardingStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('onboarding_states')
export class OnboardingState {
  @PrimaryColumn()
  businessId: number;

  @OneToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({
    type: 'enum',
    enum: OnboardingStatus,
    default: OnboardingStatus.PENDING,
  })
  status: OnboardingStatus;

  @Column({ default: false })
  profileCompleted: boolean;

  @Column({ default: false })
  servicesConfigured: boolean;

  @Column({ default: false })
  scheduleConfigured: boolean;

  @Column({ default: false })
  staffConfigured: boolean;

  @Column({ default: false })
  policiesConfigured: boolean;

  @Column({ default: false })
  clientsImported: boolean;

  @Column({ default: false })
  remindersReviewed: boolean;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
