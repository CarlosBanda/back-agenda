import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgendaCrmOperations1770000005000 implements MigrationInterface {
  name = 'AgendaCrmOperations1770000005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT NOT NULL AUTO_INCREMENT,
        businessId INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NULL,
        email VARCHAR(191) NULL,
        notes TEXT NULL,
        source ENUM('MANUAL','IMPORTED','LINKED') NOT NULL DEFAULT 'MANUAL',
        linkedUserId INT NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_clients_business_active (businessId, isActive),
        UNIQUE INDEX IDX_clients_business_phone (businessId, phone),
        UNIQUE INDEX IDX_clients_business_email (businessId, email),
        PRIMARY KEY (id),
        CONSTRAINT FK_clients_business FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE,
        CONSTRAINT FK_clients_linked_user FOREIGN KEY (linkedUserId) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_tags (
        id INT NOT NULL AUTO_INCREMENT,
        businessId INT NOT NULL,
        name VARCHAR(60) NOT NULL,
        color VARCHAR(20) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_client_tags_business_name (businessId, name),
        PRIMARY KEY (id),
        CONSTRAINT FK_client_tags_business FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_tag_links (
        clientId INT NOT NULL,
        tagId INT NOT NULL,
        INDEX IDX_client_tag_links_tag (tagId),
        PRIMARY KEY (clientId, tagId),
        CONSTRAINT FK_client_tag_links_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE,
        CONSTRAINT FK_client_tag_links_tag FOREIGN KEY (tagId) REFERENCES client_tags(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS client_notes (
        id INT NOT NULL AUTO_INCREMENT,
        clientId INT NOT NULL,
        authorId INT NOT NULL,
        body TEXT NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_client_notes_client_created (clientId, createdAt),
        PRIMARY KEY (id),
        CONSTRAINT FK_client_notes_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE,
        CONSTRAINT FK_client_notes_author FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS business_policies (
        businessId INT NOT NULL,
        depositType ENUM('NONE','FIXED','PERCENT') NOT NULL DEFAULT 'NONE',
        depositValue DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency CHAR(3) NOT NULL DEFAULT 'MXN',
        cancellationWindowHours INT NOT NULL DEFAULT 24,
        cancellationFeeType ENUM('NONE','FIXED','PERCENT') NOT NULL DEFAULT 'NONE',
        cancellationFeeValue DECIMAL(10,2) NOT NULL DEFAULT 0,
        policyText TEXT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (businessId),
        CONSTRAINT FK_business_policies_business FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reminder_settings (
        businessId INT NOT NULL,
        whatsappEnabled TINYINT NOT NULL DEFAULT 0,
        hoursBefore INT NOT NULL DEFAULT 24,
        messageTemplate TEXT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (businessId),
        CONSTRAINT FK_reminder_settings_business FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_reminder_attempts (
        id INT NOT NULL AUTO_INCREMENT,
        appointmentId INT NOT NULL,
        businessId INT NOT NULL,
        idempotencyKey VARCHAR(120) NOT NULL,
        status ENUM('PENDING','SENT','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
        providerMessageId VARCHAR(191) NULL,
        sanitizedError VARCHAR(1000) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX IDX_whatsapp_attempts_idempotency (idempotencyKey),
        INDEX IDX_whatsapp_attempts_business_created (businessId, createdAt),
        PRIMARY KEY (id),
        CONSTRAINT FK_whatsapp_attempts_appointment FOREIGN KEY (appointmentId) REFERENCES appointments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS onboarding_states (
        businessId INT NOT NULL,
        status ENUM('PENDING','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'PENDING',
        profileCompleted TINYINT NOT NULL DEFAULT 0,
        servicesConfigured TINYINT NOT NULL DEFAULT 0,
        scheduleConfigured TINYINT NOT NULL DEFAULT 0,
        staffConfigured TINYINT NOT NULL DEFAULT 0,
        policiesConfigured TINYINT NOT NULL DEFAULT 0,
        clientsImported TINYINT NOT NULL DEFAULT 0,
        remindersReviewed TINYINT NOT NULL DEFAULT 0,
        completedAt DATETIME NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (businessId),
        CONSTRAINT FK_onboarding_states_business FOREIGN KEY (businessId) REFERENCES businesses(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await this.extendAppointments(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.revertAppointments(queryRunner);
    for (const table of [
      'whatsapp_reminder_attempts',
      'reminder_settings',
      'onboarding_states',
      'business_policies',
      'client_notes',
      'client_tag_links',
      'client_tags',
      'clients',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }

  private async extendAppointments(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('appointments'))) return;

    // Add NO_SHOW to the status enum (idempotent MODIFY).
    await queryRunner.query(`
      ALTER TABLE appointments
      MODIFY status ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')
      NOT NULL DEFAULT 'PENDING'
    `);

    // Allow appointments that target an imported CRM client with no user.
    await queryRunner.query(
      'ALTER TABLE appointments MODIFY clientId INT NULL',
    );

    if (!(await queryRunner.hasColumn('appointments', 'clientRecordId'))) {
      await queryRunner.query(
        'ALTER TABLE appointments ADD COLUMN clientRecordId INT NULL',
      );
      await queryRunner.query(
        'CREATE INDEX IDX_appointments_client_record ON appointments (clientRecordId)',
      );
      await queryRunner.query(`
        ALTER TABLE appointments
        ADD CONSTRAINT FK_appointments_client_record
        FOREIGN KEY (clientRecordId) REFERENCES clients(id) ON DELETE SET NULL
      `);
    }

    const depositColumns: { name: string; ddl: string }[] = [
      {
        name: 'depositStatus',
        ddl: "ADD COLUMN depositStatus ENUM('NOT_REQUIRED','PENDING','PAID','WAIVED','REFUNDED') NOT NULL DEFAULT 'NOT_REQUIRED'",
      },
      {
        name: 'depositAmount',
        ddl: 'ADD COLUMN depositAmount DECIMAL(10,2) NULL',
      },
      {
        name: 'depositPaidAmount',
        ddl: 'ADD COLUMN depositPaidAmount DECIMAL(10,2) NULL',
      },
      { name: 'depositPaidAt', ddl: 'ADD COLUMN depositPaidAt DATETIME NULL' },
      {
        name: 'depositMethod',
        ddl: 'ADD COLUMN depositMethod VARCHAR(40) NULL',
      },
      { name: 'depositNote', ddl: 'ADD COLUMN depositNote VARCHAR(255) NULL' },
    ];
    for (const column of depositColumns) {
      if (!(await queryRunner.hasColumn('appointments', column.name))) {
        await queryRunner.query(`ALTER TABLE appointments ${column.ddl}`);
      }
    }
  }

  private async revertAppointments(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('appointments'))) return;

    const table = await queryRunner.getTable('appointments');
    const recordForeignKey = table?.foreignKeys.find(
      (foreignKey) => foreignKey.name === 'FK_appointments_client_record',
    );
    if (recordForeignKey) {
      await queryRunner.dropForeignKey('appointments', recordForeignKey);
    }
    const recordIndex = table?.indices.find(
      (index) => index.name === 'IDX_appointments_client_record',
    );
    if (recordIndex) {
      await queryRunner.dropIndex('appointments', recordIndex);
    }

    for (const column of [
      'depositNote',
      'depositMethod',
      'depositPaidAt',
      'depositPaidAmount',
      'depositAmount',
      'depositStatus',
      'clientRecordId',
    ]) {
      if (await queryRunner.hasColumn('appointments', column)) {
        await queryRunner.query(
          `ALTER TABLE appointments DROP COLUMN ${column}`,
        );
      }
    }

    await queryRunner.query(`
      ALTER TABLE appointments
      MODIFY status ENUM('PENDING','CONFIRMED','CANCELLED','COMPLETED')
      NOT NULL DEFAULT 'PENDING'
    `);
    // clientId is intentionally left nullable on down to avoid failing when
    // CRM-only appointments exist.
  }
}
