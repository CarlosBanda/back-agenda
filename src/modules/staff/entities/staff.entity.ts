import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  specialty: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: number;

  @CreateDateColumn()
  createdAt: Date;
}
