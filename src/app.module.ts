import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { ServicesModule } from './modules/services/services.module';
import { StaffModule } from './modules/staff/staff.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AdminModule } from './modules/admin/admin.module';
import { BillingModule } from './modules/billing/billing.module';
import { validateEnvironment } from './config/env.validation';
import { SupportModule } from './modules/support/support.module';
import { CrmModule } from './modules/crm/crm.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('THROTTLE_TTL_MS'),
          limit: config.getOrThrow<number>('THROTTLE_LIMIT'),
        },
      ],
    }),
    NestScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USERNAME'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: config.getOrThrow<string>('DB_SYNCHRONIZE') === 'true',
        timezone: 'Z',
      }),
    }),
    AuthModule,
    BusinessModule,
    ServicesModule,
    StaffModule,
    ScheduleModule,
    AppointmentsModule,
    NotificationsModule,
    SubscriptionsModule,
    BillingModule,
    AdminModule,
    SupportModule,
    CrmModule,
    AgendaModule,
    PoliciesModule,
    RemindersModule,
    OnboardingModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
