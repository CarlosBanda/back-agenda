import 'dotenv/config';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import dataSource from '../config/typeorm.datasource';
import { Role, User } from '../modules/users/entities/user.entity';

const logger = new Logger('CreateAdmin');

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function createAdmin(): Promise<void> {
  const name = required('ADMIN_NAME');
  const email = required('ADMIN_EMAIL').toLowerCase();
  const phone = required('ADMIN_PHONE');
  const password = required('ADMIN_PASSWORD');
  if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD must contain at least 10 characters');
  }

  await dataSource.initialize();
  try {
    const repository = dataSource.getRepository(User);
    const existing = await repository.findOne({
      where: [{ email }, { phone }],
    });
    if (existing)
      throw new Error('An account with this email or phone already exists');

    await repository.save(
      repository.create({
        name,
        email,
        phone,
        password: await bcrypt.hash(password, 12),
        role: Role.ADMIN,
        isActive: true,
      }),
    );
    logger.log(`Administrator created: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

void createAdmin().catch((error: unknown) => {
  logger.error(error, 'Unable to create administrator');
  process.exitCode = 1;
});
