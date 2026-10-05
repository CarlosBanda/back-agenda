import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import type { RequestWithId } from '../interfaces/request-with-id.interface';
import {
  pathWithoutQuery,
  sanitizeErrorMessage,
} from '../utils/error-sanitizer';
import { PlatformError } from '../../modules/support/entities/platform-error.entity';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    @InjectRepository(PlatformError)
    private readonly platformErrorRepo: Repository<PlatformError>,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.requestId || randomUUID();
    const timestamp = new Date().toISOString();
    const path = pathWithoutQuery(request.originalUrl || request.url);

    if (statusCode >= 500) {
      try {
        await this.platformErrorRepo.insert({
          requestId,
          method: request.method.slice(0, 10),
          path,
          statusCode,
          errorName:
            exception instanceof Error
              ? exception.name.slice(0, 150)
              : 'UnknownError',
          sanitizedMessage: sanitizeErrorMessage(exception),
          resolvedAt: null,
          resolvedById: null,
        });
      } catch (persistenceError) {
        this.logger.error(
          `Could not persist platform error ${requestId}: ${sanitizeErrorMessage(persistenceError, 300)}`,
        );
      }

      response.status(statusCode).json({
        statusCode,
        message: 'Internal server error',
        requestId,
        timestamp,
        path,
      });
      return;
    }

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {
            statusCode,
            message:
              typeof exceptionResponse === 'string'
                ? exceptionResponse
                : 'Request failed',
          };
    response.status(statusCode).json({
      ...body,
      statusCode,
      requestId,
      timestamp,
      path,
    });
  }
}
