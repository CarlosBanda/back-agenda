import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto) {
    const role = dto.role === Role.BUSINESS ? Role.BUSINESS : Role.CLIENT;
    const user = await this.usersService.create({ ...dto, role });
    const token = this.generateToken(user.id, user.email, user.role);
    return {
      access_token: token.access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user?.isActive) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const token = this.generateToken(user.id, user.email, user.role);
    return {
      access_token: token.access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user?.isActive) throw new UnauthorizedException('Account is inactive');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
  }

  private generateToken(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };
    return { access_token: this.jwtService.sign(payload) };
  }
}
