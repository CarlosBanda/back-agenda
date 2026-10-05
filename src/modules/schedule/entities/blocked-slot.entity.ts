import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { Staff } from '../../staff/entities/staff.entity';

@Entity('blocked_slots')
export class BlockedSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ nullable: true })
  reason: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: number;

  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'staffId' })
  staff: Staff;

  @Column({ nullable: true })
  staffId: number;

  @CreateDateColumn()
  createdAt: Date;
}
