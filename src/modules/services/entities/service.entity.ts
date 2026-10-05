import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ comment: 'Duración en minutos' })
  duration: number;

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
