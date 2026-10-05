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
import { User } from '../../users/entities/user.entity';

export enum SupportCaseStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_USER = 'WAITING_USER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum SupportCasePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('support_cases')
@Index(['requesterId', 'createdAt'])
@Index(['status', 'priority', 'createdAt'])
export class SupportCase {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 40 })
  folio: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @Column()
  requesterId: number;

  @ManyToOne(() => Business, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'businessId' })
  business: Business | null;

  @Column({ type: 'int', nullable: true })
  businessId: number | null;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: SupportCaseStatus,
    default: SupportCaseStatus.OPEN,
  })
  status: SupportCaseStatus;

  @Column({
    type: 'enum',
    enum: SupportCasePriority,
    default: SupportCasePriority.MEDIUM,
  })
  priority: SupportCasePriority;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedAdminId' })
  assignedAdmin: User | null;

  @Column({ type: 'int', nullable: true })
  assignedAdminId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;
}
