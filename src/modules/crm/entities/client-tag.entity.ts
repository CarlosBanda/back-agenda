import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';

@Entity('client_tags')
@Index('IDX_client_tags_business_name', ['businessId', 'name'], {
  unique: true,
})
export class ClientTag {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  businessId: number;

  @Column({ length: 60 })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 20 })
  color: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
