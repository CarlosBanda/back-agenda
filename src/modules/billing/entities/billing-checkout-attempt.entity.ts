import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('billing_checkout_attempts')
export class BillingCheckoutAttempt {
  @PrimaryColumn()
  businessId: number;

  @Column()
  planId: number;

  @Index({ unique: true })
  @Column({ length: 36 })
  attemptId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true, length: 191 })
  stripeSessionId: string | null;

  @Column({ type: 'text', nullable: true })
  checkoutUrl: string | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  processingStartedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
