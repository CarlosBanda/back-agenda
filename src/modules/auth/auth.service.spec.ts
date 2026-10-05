import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Role, User } from '../users/entities/user.entity';

describe('AuthService', () => {
  const usersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
  const service = new AuthService(
    usersService as unknown as UsersService,
    jwtService as unknown as JwtService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('forces CLIENT when an unsafe public role is supplied', async () => {
    const user = {
      id: 1,
      name: 'User',
      email: 'user@example.com',
      phone: '5550000000',
      role: Role.CLIENT,
    } as User;
    usersService.create.mockResolvedValue(user);

    const result = await service.register({
      name: user.name,
      email: user.email,
      password: 'password10',
      phone: user.phone,
      role: Role.ADMIN,
    });

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.CLIENT }),
    );
    expect(result.access_token).toBe('signed-token');
  });

  it('rejects inactive users before checking their password', async () => {
    usersService.findByEmail.mockResolvedValue({ isActive: false });
    await expect(
      service.login('user@example.com', 'password10'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns a token and profile for valid credentials', async () => {
    const password = 'password10';
    const user = {
      id: 1,
      name: 'User',
      email: 'user@example.com',
      phone: '5550000000',
      role: Role.CLIENT,
      isActive: true,
      password: await bcrypt.hash(password, 4),
    } as User;
    usersService.findByEmail.mockResolvedValue(user);

    const result = await service.login(user.email, password);

    expect(result).toEqual({
      access_token: 'signed-token',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  });
});
