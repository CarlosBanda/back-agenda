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
import { SupportCase } from './support-case.entity';

@Entity('support_messages')
@Index(['caseId', 'createdAt'])
export class SupportMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SupportCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caseId' })
  case: SupportCase;

  @Column()
  caseId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: number;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  internal: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
