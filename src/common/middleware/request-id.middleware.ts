import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from '../interfaces/request-with-id.interface';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const header = req.headers['x-request-id'];
    const supplied = Array.isArray(header) ? header[0] : header;
    req.requestId =
      typeof supplied === 'string' && REQUEST_ID_PATTERN.test(supplied)
        ? supplied
        : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  }
}
