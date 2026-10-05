import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { Staff } from '../../staff/entities/staff.entity';

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: DayOfWeek })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ default: true })
  isActive: boolean;

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
}
