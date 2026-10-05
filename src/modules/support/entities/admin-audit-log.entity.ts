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

@Entity('admin_audit_logs')
@Index(['adminId', 'createdAt'])
@Index(['requestId'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'adminId' })
  admin: User;

  @Column()
  adminId: number;

  @Column({ length: 300 })
  action: string;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 500 })
  path: string;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  targetType: string | null;

  @Column({ type: 'varchar', nullable: true, length: 191 })
  targetId: string | null;

  @Column()
  statusCode: number;

  @Column({ length: 128 })
  requestId: string;

  @CreateDateColumn()
  createdAt: Date;
}
