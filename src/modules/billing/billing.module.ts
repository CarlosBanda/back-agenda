import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessModule } from '../business/business.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BillingController } from './billing.controller';
import { BillingEvent } from './entities/billing-event.entity';
import { BillingCheckoutAttempt } from './entities/billing-checkout-attempt.entity';
import { StripeBillingService } from './stripe-billing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingEvent, BillingCheckoutAttempt]),
    BusinessModule,
    SubscriptionsModule,
  ],
  controllers: [BillingController],
  providers: [StripeBillingService],
})
export class BillingModule {}
