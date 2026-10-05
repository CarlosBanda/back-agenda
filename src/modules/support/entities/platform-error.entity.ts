import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('platform_errors')
@Index(['resolvedAt', 'createdAt'])
@Index(['requestId'])
export class PlatformError {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  requestId: string;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 500 })
  path: string;

  @Column()
  statusCode: number;

  @Column({ length: 150 })
  errorName: string;

  @Column({ length: 1000 })
  sanitizedMessage: string;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolvedById' })
  resolvedBy: User | null;

  @Column({ type: 'int', nullable: true })
  resolvedById: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
