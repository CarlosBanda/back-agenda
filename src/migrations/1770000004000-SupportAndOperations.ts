import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class SupportAndOperations1770000004000 implements MigrationInterface {
  name = 'SupportAndOperations1770000004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.extendBillingEvents(queryRunner);

    if (!(await queryRunner.hasTable('support_cases'))) {
      await queryRunner.createTable(
        new Table({
          name: 'support_cases',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true },
            { name: 'folio', type: 'varchar', length: '40' },
            { name: 'requesterId', type: 'int' },
            { name: 'businessId', type: 'int', isNullable: true },
            { name: 'subject', type: 'varchar', length: '200' },
            { name: 'description', type: 'text' },
            {
              name: 'status',
              type: 'enum',
              enum: [
                'OPEN',
                'IN_PROGRESS',
                'WAITING_USER',
                'RESOLVED',
                'CLOSED',
              ],
              default: "'OPEN'",
            },
            {
              name: 'priority',
              type: 'enum',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
              default: "'MEDIUM'",
            },
            { name: 'assignedAdminId', type: 'int', isNullable: true },
            {
              name: 'createdAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
            },
            {
              name: 'updatedAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
              onUpdate: 'CURRENT_TIMESTAMP(6)',
            },
            { name: 'resolvedAt', type: 'datetime', isNullable: true },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_support_cases_folio',
              columnNames: ['folio'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IDX_support_cases_requester_created',
              columnNames: ['requesterId', 'createdAt'],
            }),
            new TableIndex({
              name: 'IDX_support_cases_status_priority_created',
              columnNames: ['status', 'priority', 'createdAt'],
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_support_cases_requester',
              columnNames: ['requesterId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            }),
            new TableForeignKey({
              name: 'FK_support_cases_business',
              columnNames: ['businessId'],
              referencedTableName: 'businesses',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
            new TableForeignKey({
              name: 'FK_support_cases_assigned_admin',
              columnNames: ['assignedAdminId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('support_messages'))) {
      await queryRunner.createTable(
        new Table({
          name: 'support_messages',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true },
            { name: 'caseId', type: 'int' },
            { name: 'authorId', type: 'int' },
            { name: 'body', type: 'text' },
            { name: 'internal', type: 'tinyint', default: 0 },
            {
              name: 'createdAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
            },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_support_messages_case_created',
              columnNames: ['caseId', 'createdAt'],
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_support_messages_case',
              columnNames: ['caseId'],
              referencedTableName: 'support_cases',
              referencedColumnNames: ['id'],
              onDelete: 'CASCADE',
            }),
            new TableForeignKey({
              name: 'FK_support_messages_author',
              columnNames: ['authorId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            }),
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('platform_errors'))) {
      await queryRunner.createTable(
        new Table({
          name: 'platform_errors',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true },
            { name: 'requestId', type: 'varchar', length: '128' },
            { name: 'method', type: 'varchar', length: '10' },
            { name: 'path', type: 'varchar', length: '500' },
            { name: 'statusCode', type: 'int' },
            { name: 'errorName', type: 'varchar', length: '150' },
            { name: 'sanitizedMessage', type: 'varchar', length: '1000' },
            { name: 'resolvedAt', type: 'datetime', isNullable: true },
            { name: 'resolvedById', type: 'int', isNullable: true },
            {
              name: 'createdAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
            },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_platform_errors_resolved_created',
              columnNames: ['resolvedAt', 'createdAt'],
            }),
            new TableIndex({
              name: 'IDX_platform_errors_request',
              columnNames: ['requestId'],
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_platform_errors_resolved_by',
              columnNames: ['resolvedById'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'SET NULL',
            }),
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('admin_audit_logs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'admin_audit_logs',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true },
            { name: 'adminId', type: 'int' },
            { name: 'action', type: 'varchar', length: '300' },
            { name: 'method', type: 'varchar', length: '10' },
            { name: 'path', type: 'varchar', length: '500' },
            {
              name: 'targetType',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'targetId',
              type: 'varchar',
              length: '191',
              isNullable: true,
            },
            { name: 'statusCode', type: 'int' },
            { name: 'requestId', type: 'varchar', length: '128' },
            {
              name: 'createdAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
            },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_admin_audits_admin_created',
              columnNames: ['adminId', 'createdAt'],
            }),
            new TableIndex({
              name: 'IDX_admin_audits_request',
              columnNames: ['requestId'],
            }),
          ],
          foreignKeys: [
            new TableForeignKey({
              name: 'FK_admin_audits_admin',
              columnNames: ['adminId'],
              referencedTableName: 'users',
              referencedColumnNames: ['id'],
              onDelete: 'RESTRICT',
            }),
          ],
        }),
        true,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'admin_audit_logs',
      'platform_errors',
      'support_messages',
      'support_cases',
    ]) {
      if (await queryRunner.hasTable(table)) await queryRunner.dropTable(table);
    }
    if (await queryRunner.hasTable('billing_events')) {
      const table = await queryRunner.getTable('billing_events');
      const businessForeignKey = table?.foreignKeys.find(
        (foreignKey) => foreignKey.name === 'FK_billing_events_business',
      );
      if (businessForeignKey) {
        await queryRunner.dropForeignKey('billing_events', businessForeignKey);
      }
      const businessIndex = table?.indices.find(
        (index) => index.name === 'IDX_billing_events_business',
      );
      if (businessIndex) {
        await queryRunner.dropIndex('billing_events', businessIndex);
      }
      for (const column of ['failedAt', 'lastError', 'businessId']) {
        if (await queryRunner.hasColumn('billing_events', column)) {
          await queryRunner.dropColumn('billing_events', column);
        }
      }
    }
  }

  private async extendBillingEvents(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('billing_events'))) return;
    if (!(await queryRunner.hasColumn('billing_events', 'businessId'))) {
      await queryRunner.addColumn(
        'billing_events',
        new TableColumn({ name: 'businessId', type: 'int', isNullable: true }),
      );
    }
    if (!(await queryRunner.hasColumn('billing_events', 'lastError'))) {
      await queryRunner.addColumn(
        'billing_events',
        new TableColumn({ name: 'lastError', type: 'text', isNullable: true }),
      );
    }
    if (!(await queryRunner.hasColumn('billing_events', 'failedAt'))) {
      await queryRunner.addColumn(
        'billing_events',
        new TableColumn({
          name: 'failedAt',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }
    const table = await queryRunner.getTable('billing_events');
    if (
      !table?.indices.some(
        (index) => index.name === 'IDX_billing_events_business',
      )
    ) {
      await queryRunner.createIndex(
        'billing_events',
        new TableIndex({
          name: 'IDX_billing_events_business',
          columnNames: ['businessId'],
        }),
      );
    }
    if (
      !table?.foreignKeys.some(
        (foreignKey) => foreignKey.name === 'FK_billing_events_business',
      )
    ) {
      await queryRunner.createForeignKey(
        'billing_events',
        new TableForeignKey({
          name: 'FK_billing_events_business',
          columnNames: ['businessId'],
          referencedTableName: 'businesses',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }
  }
}
