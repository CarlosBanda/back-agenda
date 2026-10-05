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
import { Client } from './client.entity';

@Entity('client_notes')
@Index(['clientId', 'createdAt'])
export class ClientNote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column()
  authorId: number;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
