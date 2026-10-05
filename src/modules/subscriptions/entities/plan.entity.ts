import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BillingInterval {
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 80 })
  slug: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'char', length: 3, default: 'MXN' })
  currency: string;

  @Column({
    type: 'enum',
    enum: BillingInterval,
    default: BillingInterval.MONTH,
  })
  billingInterval: BillingInterval;

  @Column({ comment: 'Duración del periodo en días' })
  duration: number;

  @Column({ type: 'simple-json', nullable: true })
  features: string[] | null;

  @Column({ default: 0 })
  maxServices: number;

  @Column({ default: 0 })
  maxStaff: number;

  @Column({ default: 0 })
  maxAppointmentsPerMonth: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true, length: 191 })
  providerPriceId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
