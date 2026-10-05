import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity';

@Entity('reminder_settings')
export class ReminderSetting {
  // One reminder configuration per business.
  @PrimaryColumn()
  businessId: number;

  @OneToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  // Disabled by default: no outbound WhatsApp until a business opts in AND the
  // platform-level WHATSAPP_ENABLED flag is true.
  @Column({ default: false })
  whatsappEnabled: boolean;

  @Column({ type: 'int', default: 24 })
  hoursBefore: number;

  @Column({ type: 'text', nullable: true })
  messageTemplate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
