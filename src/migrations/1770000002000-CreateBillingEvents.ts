import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateBillingEvents1770000002000 implements MigrationInterface {
  name = 'CreateBillingEvents1770000002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('billing_events')) return;

    await queryRunner.createTable(
      new Table({
        name: 'billing_events',
        columns: [
          {
            name: 'eventId',
            type: 'varchar',
            length: '191',
            isPrimary: true,
          },
          { name: 'type', type: 'varchar', length: '100' },
          { name: 'processedAt', type: 'datetime', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('billing_events')) {
      await queryRunner.dropTable('billing_events');
    }
  }
}
