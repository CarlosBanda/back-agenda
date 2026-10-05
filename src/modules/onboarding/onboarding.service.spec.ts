import type { Repository } from 'typeorm';
import type { BusinessService } from '../business/business.service';
import type { ClientsService, ImportResult } from '../crm/clients.service';
import { Role } from '../users/entities/user.entity';
import {
  OnboardingState,
  OnboardingStatus,
} from './entities/onboarding-state.entity';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService.importClients', () => {
  it('returns both the import summary and updated onboarding state', async () => {
    const state = {
      businessId: 9,
      status: OnboardingStatus.PENDING,
      profileCompleted: false,
      servicesConfigured: false,
      scheduleConfigured: false,
      staffConfigured: false,
      policiesConfigured: false,
      clientsImported: false,
      remindersReviewed: false,
      completedAt: null,
    } as OnboardingState;
    const saveState = jest.fn((value: OnboardingState) =>
      Promise.resolve(value),
    );
    const repo = {
      findOne: jest.fn().mockResolvedValue(state),
      save: saveState,
    } as unknown as Repository<OnboardingState>;
    const importResult: ImportResult = {
      totalRows: 1,
      created: 1,
      duplicatesInFile: 0,
      duplicatesInDb: 0,
      invalid: 0,
      tagsCreated: 0,
      errors: [],
    };
    const clientsService = {
      importFromCsvText: jest.fn().mockResolvedValue(importResult),
    } as unknown as ClientsService;
    const service = new OnboardingService(
      repo,
      {} as BusinessService,
      clientsService,
    );

    const result = await service.importClients(
      9,
      { content: 'name\nAna' },
      7,
      Role.BUSINESS,
    );

    expect(result.import).toBe(importResult);
    expect(result.onboarding.clientsImported).toBe(true);
    expect(result.onboarding.status).toBe(OnboardingStatus.IN_PROGRESS);
    expect(saveState).toHaveBeenCalledTimes(1);
  });
});
