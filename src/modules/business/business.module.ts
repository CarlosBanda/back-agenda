import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Business])],
  providers: [BusinessService],
  controllers: [BusinessController],
  exports: [BusinessService],
})
export class BusinessModule {}
