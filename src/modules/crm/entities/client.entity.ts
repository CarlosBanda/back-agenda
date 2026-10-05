import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { User } from '../../users/entities/user.entity';
import { ClientTag } from './client-tag.entity';

export enum ClientSource {
  MANUAL = 'MANUAL',
  IMPORTED = 'IMPORTED',
  LINKED = 'LINKED',
}

@Entity('clients')
@Index(['businessId', 'isActive'])
// MySQL treats multiple NULLs as distinct, so these uniques deduplicate only
// when the phone/email is present, scoped per business.
@Index('IDX_clients_business_phone', ['businessId', 'phone'], { unique: true })
@Index('IDX_clients_business_email', ['businessId', 'email'], { unique: true })
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: number;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 20 })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true, length: 191 })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'enum', enum: ClientSource, default: ClientSource.MANUAL })
  source: ClientSource;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linkedUserId' })
  linkedUser: User | null;

  @Column({ type: 'int', nullable: true })
  linkedUserId: number | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => ClientTag)
  @JoinTable({
    name: 'client_tag_links',
    joinColumn: { name: 'clientId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: ClientTag[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
