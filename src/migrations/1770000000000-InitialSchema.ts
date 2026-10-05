import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1770000000000 implements MigrationInterface {
  name = 'InitialSchema1770000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL,
        role ENUM('CLIENT','BUSINESS','ADMIN') NOT NULL DEFAULT 'CLIENT',
        isActive TINYINT NOT NULL DEFAULT 1,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_users_email (email),
        UNIQUE INDEX IDX_users_phone (phone),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255) NULL,
        address VARCHAR(255) NULL,
        phone VARCHAR(255) NULL,
        imageUrl VARCHAR(255) NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        ownerId INT NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_businesses_owner (ownerId),
        PRIMARY KEY (id),
        CONSTRAINT FK_businesses_owner FOREIGN KEY (ownerId) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS services (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255) NULL,
        price DECIMAL(10,2) NOT NULL,
        duration INT NOT NULL COMMENT 'Duración en minutos',
        isActive TINYINT NOT NULL DEFAULT 1,
        businessId INT NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_services_business (businessId, isActive),
        PRIMARY KEY (id),
        CONSTRAINT FK_services_business FOREIGN KEY (businessId) REFERENCES businesses(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        specialty VARCHAR(255) NULL,
        phone VARCHAR(255) NULL,
        imageUrl VARCHAR(255) NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        businessId INT NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_staff_business (businessId, isActive),
        PRIMARY KEY (id),
        CONSTRAINT FK_staff_business FOREIGN KEY (businessId) REFERENCES businesses(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id INT NOT NULL AUTO_INCREMENT,
        dayOfWeek ENUM('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
        startTime TIME NOT NULL,
        endTime TIME NOT NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        businessId INT NOT NULL,
        staffId INT NULL,
        INDEX IDX_schedules_business (businessId, isActive),
        INDEX IDX_schedules_staff (staffId, isActive),
        PRIMARY KEY (id),
        CONSTRAINT FK_schedules_business FOREIGN KEY (businessId) REFERENCES businesses(id),
        CONSTRAINT FK_schedules_staff FOREIGN KEY (staffId) REFERENCES staff(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS blocked_slots (
        id INT NOT NULL AUTO_INCREMENT,
        date DATE NOT NULL,
        startTime TIME NOT NULL,
        endTime TIME NOT NULL,
        reason VARCHAR(255) NULL,
        businessId INT NOT NULL,
        staffId INT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_blocked_business_date (businessId, date),
        INDEX IDX_blocked_staff (staffId),
        PRIMARY KEY (id),
        CONSTRAINT FK_blocked_business FOREIGN KEY (businessId) REFERENCES businesses(id),
        CONSTRAINT FK_blocked_staff FOREIGN KEY (staffId) REFERENCES staff(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT NOT NULL AUTO_INCREMENT,
        date DATE NOT NULL,
        startTime TIME NOT NULL,
        endTime TIME NOT NULL,
        status ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED') NOT NULL DEFAULT 'PENDING',
        notes VARCHAR(255) NULL,
        clientId INT NOT NULL,
        businessId INT NOT NULL,
        serviceId INT NOT NULL,
        staffId INT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_appointments_client (clientId, date),
        INDEX IDX_appointments_business_date (businessId, date, status),
        INDEX IDX_appointments_staff_date (staffId, date, status),
        PRIMARY KEY (id),
        CONSTRAINT FK_appointments_client FOREIGN KEY (clientId) REFERENCES users(id),
        CONSTRAINT FK_appointments_business FOREIGN KEY (businessId) REFERENCES businesses(id),
        CONSTRAINT FK_appointments_service FOREIGN KEY (serviceId) REFERENCES services(id),
        CONSTRAINT FK_appointments_staff FOREIGN KEY (staffId) REFERENCES staff(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id INT NOT NULL AUTO_INCREMENT,
        slug VARCHAR(80) NOT NULL,
        name VARCHAR(120) NOT NULL,
        description TEXT NULL,
        price DECIMAL(10,2) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'MXN',
        billingInterval ENUM('MONTH','YEAR') NOT NULL DEFAULT 'MONTH',
        duration INT NOT NULL COMMENT 'Duración del periodo en días',
        features TEXT NULL,
        maxServices INT NOT NULL DEFAULT 0,
        maxStaff INT NOT NULL DEFAULT 0,
        maxAppointmentsPerMonth INT NOT NULL DEFAULT 0,
        providerPriceId VARCHAR(191) NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        sortOrder INT NOT NULL DEFAULT 0,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_plans_slug (slug),
        UNIQUE INDEX IDX_plans_provider_price (providerPriceId),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INT NOT NULL AUTO_INCREMENT,
        businessId INT NOT NULL,
        planId INT NOT NULL,
        status ENUM('INCOMPLETE','TRIAL','ACTIVE','PAST_DUE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'INCOMPLETE',
        provider VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
        providerSubscriptionId VARCHAR(191) NULL,
        providerCustomerId VARCHAR(191) NULL,
        cancelAtPeriodEnd TINYINT NOT NULL DEFAULT 0,
        startDate DATE NOT NULL,
        endDate DATE NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_subscriptions_business_status_end (businessId, status, endDate),
        UNIQUE INDEX IDX_subscriptions_provider_id (providerSubscriptionId),
        PRIMARY KEY (id),
        CONSTRAINT FK_subscriptions_business FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE,
        CONSTRAINT FK_subscriptions_plan FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS subscriptions');
    await queryRunner.query('DROP TABLE IF EXISTS plans');
    await queryRunner.query('DROP TABLE IF EXISTS appointments');
    await queryRunner.query('DROP TABLE IF EXISTS blocked_slots');
    await queryRunner.query('DROP TABLE IF EXISTS schedules');
    await queryRunner.query('DROP TABLE IF EXISTS staff');
    await queryRunner.query('DROP TABLE IF EXISTS services');
    await queryRunner.query('DROP TABLE IF EXISTS businesses');
    await queryRunner.query('DROP TABLE IF EXISTS users');
  }
}
