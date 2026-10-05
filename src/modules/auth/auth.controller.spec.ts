import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '../users/entities/user.entity';

describe('AuthController', () => {
  const authService = {
    login: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
  };
  const controller = new AuthController(authService as unknown as AuthService);

  beforeEach(() => jest.clearAllMocks());

  it('delegates login credentials to the service', async () => {
    authService.login.mockResolvedValue({ access_token: 'token', user: {} });
    await controller.login({
      email: 'user@example.com',
      password: 'password10',
    });
    expect(authService.login).toHaveBeenCalledWith(
      'user@example.com',
      'password10',
    );
  });

  it('delegates safe registration data to the service', async () => {
    const dto = {
      name: 'User',
      email: 'user@example.com',
      password: 'password10',
      phone: '5550000000',
      role: Role.CLIENT,
    };
    authService.register.mockResolvedValue({ access_token: 'token', user: {} });
    await controller.register(dto);
    expect(authService.register).toHaveBeenCalledWith(dto);
  });
});
