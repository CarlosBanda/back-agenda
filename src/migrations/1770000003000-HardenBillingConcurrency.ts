import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class HardenBillingConcurrency1770000003000 implements MigrationInterface {
  name = 'HardenBillingConcurrency1770000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('billing_events')) {
      if (
        !(await queryRunner.hasColumn('billing_events', 'processingStartedAt'))
      ) {
        await queryRunner.addColumn(
          'billing_events',
          new TableColumn({
            name: 'processingStartedAt',
            type: 'datetime',
            isNullable: true,
          }),
        );
      }
      if (!(await queryRunner.hasColumn('billing_events', 'attempts'))) {
        await queryRunner.addColumn(
          'billing_events',
          new TableColumn({ name: 'attempts', type: 'int', default: 0 }),
        );
      }
    }

    if (await queryRunner.hasTable('billing_checkout_attempts')) return;
    await queryRunner.createTable(
      new Table({
        name: 'billing_checkout_attempts',
        columns: [
          { name: 'businessId', type: 'int', isPrimary: true },
          { name: 'planId', type: 'int' },
          { name: 'attemptId', type: 'varchar', length: '36' },
          {
            name: 'stripeSessionId',
            type: 'varchar',
            length: '191',
            isNullable: true,
          },
          { name: 'checkoutUrl', type: 'text', isNullable: true },
          { name: 'expiresAt', type: 'datetime', isNullable: true },
          {
            name: 'processingStartedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_billing_checkout_attempt',
            columnNames: ['attemptId'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_billing_checkout_stripe_session',
            columnNames: ['stripeSessionId'],
            isUnique: true,
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'FK_billing_checkout_business',
            columnNames: ['businessId'],
            referencedTableName: 'businesses',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            name: 'FK_billing_checkout_plan',
            columnNames: ['planId'],
            referencedTableName: 'plans',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('billing_checkout_attempts')) {
      await queryRunner.dropTable('billing_checkout_attempts');
    }
    if (await queryRunner.hasTable('billing_events')) {
      for (const column of ['attempts', 'processingStartedAt']) {
        if (await queryRunner.hasColumn('billing_events', column)) {
          await queryRunner.dropColumn('billing_events', column);
        }
      }
    }
  }
}
