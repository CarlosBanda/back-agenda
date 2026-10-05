import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from './entities/service.entity';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Service]),
    SubscriptionsModule,
    BusinessModule,
  ],
  providers: [ServicesService],
  controllers: [ServicesController],
  exports: [ServicesService],
})
export class ServicesModule {}
