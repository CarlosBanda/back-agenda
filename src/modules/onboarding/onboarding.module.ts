import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessModule } from '../business/business.module';
import { CrmModule } from '../crm/crm.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingState } from './entities/onboarding-state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnboardingState]),
    BusinessModule,
    CrmModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
