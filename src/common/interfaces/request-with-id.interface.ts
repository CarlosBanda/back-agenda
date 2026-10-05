import type { Request } from 'express';
import type { JwtUser } from './authenticated-request.interface';

export interface RequestWithId extends Request {
  requestId: string;
  user?: JwtUser;
}
