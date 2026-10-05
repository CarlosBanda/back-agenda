import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { Repository } from 'typeorm';
import type { RequestWithId } from '../interfaces/request-with-id.interface';
import {
  pathWithoutQuery,
  sanitizeErrorMessage,
} from '../utils/error-sanitizer';
import { AdminAuditLog } from '../../modules/support/entities/admin-audit-log.entity';
import { Role } from '../../modules/users/entities/user.entity';

interface ExpressRoute {
  path?: string;
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminAuditInterceptor.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    if (request.user?.role !== Role.ADMIN) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.record(request, response.statusCode);
        },
        error: (error: unknown) => {
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          void this.record(request, statusCode);
        },
      }),
    );
  }

  private async record(
    request: RequestWithId,
    statusCode: number,
  ): Promise<void> {
    try {
      const route = request.route as ExpressRoute | undefined;
      const routePath = route?.path
        ? `${request.baseUrl}${route.path}`
        : pathWithoutQuery(request.originalUrl || request.url);
      const path = pathWithoutQuery(request.originalUrl || request.url);
      const caseIdValue = request.params.caseId;
      const genericIdValue = request.params.id;
      const caseId = Array.isArray(caseIdValue) ? caseIdValue[0] : caseIdValue;
      const genericId = Array.isArray(genericIdValue)
        ? genericIdValue[0]
        : genericIdValue;
      const targetId = caseId ?? genericId ?? null;
      let targetType: string | null = null;
      if (caseId) targetType = 'SupportCase';
      else if (genericId) targetType = this.inferTargetType(path);

      await this.auditRepo.insert({
        adminId: request.user!.sub,
        action: `${request.method} ${routePath}`.slice(0, 300),
        method: request.method.slice(0, 10),
        path,
        targetType,
        targetId: targetId?.slice(0, 191) ?? null,
        statusCode,
        requestId: request.requestId,
      });
    } catch (error) {
      this.logger.error(
        `Could not persist admin audit: ${sanitizeErrorMessage(error, 300)}`,
      );
    }
  }

  private inferTargetType(path: string): string {
    if (path.includes('/cases/')) return 'SupportCase';
    if (path.includes('/users/')) return 'User';
    if (path.includes('/businesses/')) return 'Business';
    if (path.includes('/errors/')) return 'PlatformError';
    return 'Resource';
  }
}
