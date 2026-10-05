import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guards';
import { Role } from '../users/entities/user.entity';
import { AgendaController } from '../agenda/agenda.controller';
import { CrmController } from '../crm/crm.controller';
import { OnboardingController } from '../onboarding/onboarding.controller';
import { PoliciesController } from '../policies/policies.controller';
import { RemindersController } from '../reminders/reminders.controller';

describe('Operations controllers access perimeter', () => {
  const controllers = [
    CrmController,
    AgendaController,
    PoliciesController,
    RemindersController,
    OnboardingController,
  ];

  it.each(controllers)(
    '%p restricts to BUSINESS/ADMIN behind JWT + Roles guards',
    (controller) => {
      expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual([
        Role.BUSINESS,
        Role.ADMIN,
      ]);
      const guards = Reflect.getMetadata(GUARDS_METADATA, controller) as
        | unknown[]
        | undefined;
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    },
  );
});
