import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../users/entities/user.entity';
import { SupportAdminController } from './support-admin.controller';
import { SupportController } from './support.controller';

describe('SupportController access perimeter', () => {
  it('allows only requester roles and applies RolesGuard', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SupportController)).toEqual([
      Role.CLIENT,
      Role.BUSINESS,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, SupportController)).toContain(
      RolesGuard,
    );
  });

  it('loads case detail through the admin controller with the admin actor', async () => {
    const actor = { sub: 1, email: 'admin@example.com', role: Role.ADMIN };
    const findCaseForActor = jest.fn().mockResolvedValue({ id: 7 });
    const controller = new SupportAdminController({
      findCaseForActor,
    } as never);

    await expect(
      controller.findCase(7, { user: actor } as never),
    ).resolves.toEqual({
      id: 7,
    });
    expect(findCaseForActor).toHaveBeenCalledWith(7, actor);
  });
});
