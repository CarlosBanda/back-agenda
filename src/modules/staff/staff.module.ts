import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from './entities/staff.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Staff]),
    SubscriptionsModule,
    BusinessModule,
  ],
  providers: [StaffService],
  controllers: [StaffController],
  exports: [StaffService],
})
export class StaffModule {}
