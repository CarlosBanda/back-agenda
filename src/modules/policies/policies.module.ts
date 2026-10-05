import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessModule } from '../business/business.module';
import { BusinessPolicy } from './entities/business-policy.entity';
import {
  PoliciesController,
  PublicPoliciesController,
} from './policies.controller';
import { PoliciesService } from './policies.service';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessPolicy]), BusinessModule],
  controllers: [PoliciesController, PublicPoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
