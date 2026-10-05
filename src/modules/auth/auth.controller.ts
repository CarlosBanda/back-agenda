import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guards';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
