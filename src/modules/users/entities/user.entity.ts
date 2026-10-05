import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Role {
  CLIENT = 'CLIENT',
  BUSINESS = 'BUSINESS',
  ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ unique: true })
  phone: string;

  @Column({ type: 'enum', enum: Role, default: Role.CLIENT })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
