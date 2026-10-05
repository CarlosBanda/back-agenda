import type { Request } from 'express';
import { Role } from '../../modules/users/entities/user.entity';

export interface JwtUser {
  sub: number;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: JwtUser;
}
