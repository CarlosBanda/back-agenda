import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { AdminAuditInterceptor } from '../../common/interceptors/admin-audit.interceptor';
import { RequestIdMiddleware } from '../../common/middleware/request-id.middleware';
import { Appointment } from '../appointments/entities/appointment.entity';
import { BillingCheckoutAttempt } from '../billing/entities/billing-checkout-attempt.entity';
import { BillingEvent } from '../billing/entities/billing-event.entity';
import { Business } from '../business/entities/business.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { PlatformError } from './entities/platform-error.entity';
import { SupportCase } from './entities/support-case.entity';
import { SupportMessage } from './entities/support-message.entity';
import { SupportAdminController } from './support-admin.controller';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportCase,
      SupportMessage,
      PlatformError,
      AdminAuditLog,
      User,
      Business,
      Appointment,
      Subscription,
      BillingCheckoutAttempt,
      BillingEvent,
    ]),
  ],
  controllers: [SupportController, SupportAdminController],
  providers: [
    SupportService,
    RequestIdMiddleware,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor },
  ],
})
export class SupportModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
