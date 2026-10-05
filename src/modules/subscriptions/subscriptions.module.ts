import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, Subscription]), BusinessModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
