import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './entities/schedule.entity';
import { BlockedSlot } from './entities/blocked-slot.entity';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { BusinessModule } from '../business/business.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, BlockedSlot]),
    BusinessModule,
    StaffModule,
  ],
  providers: [ScheduleService],
  controllers: [ScheduleController],
  exports: [ScheduleService],
})
export class ScheduleModule {}
