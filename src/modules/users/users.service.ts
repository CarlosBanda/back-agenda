import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const exists = await this.usersRepo.findOne({
      where: [{ email }, { phone }],
    });
    if (exists)
      throw new ConflictException('Email or phone already registered');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({
      ...dto,
      email,
      phone,
      password: hash,
    });
    return this.usersRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = :email', {
        email: email.trim().toLowerCase(),
      })
      .getOne();
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }
}
