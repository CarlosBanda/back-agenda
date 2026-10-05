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

export enum ChargeType {
  NONE = 'NONE',
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

@Entity('business_policies')
export class BusinessPolicy {
  // One policy row per business (business id is the primary key).
  @PrimaryColumn()
  businessId: number;

  @OneToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({ type: 'enum', enum: ChargeType, default: ChargeType.NONE })
  depositType: ChargeType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  depositValue: string;

  @Column({ type: 'char', length: 3, default: 'MXN' })
  currency: string;

  @Column({ type: 'int', default: 24 })
  cancellationWindowHours: number;

  @Column({ type: 'enum', enum: ChargeType, default: ChargeType.NONE })
  cancellationFeeType: ChargeType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cancellationFeeValue: string;

  @Column({ type: 'text', nullable: true })
  policyText: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
