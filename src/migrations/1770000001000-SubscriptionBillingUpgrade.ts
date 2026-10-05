import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class SubscriptionBillingUpgrade1770000001000 implements MigrationInterface {
  name = 'SubscriptionBillingUpgrade1770000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('plans'))) return;

    if (!(await queryRunner.hasColumn('plans', 'slug'))) {
      await queryRunner.addColumn(
        'plans',
        new TableColumn({
          name: 'slug',
          type: 'varchar',
          length: '80',
          isNullable: true,
        }),
      );
      await queryRunner.query(
        "UPDATE plans SET slug = CONCAT('plan-', id) WHERE slug IS NULL",
      );
      await queryRunner.changeColumn(
        'plans',
        'slug',
        new TableColumn({
          name: 'slug',
          type: 'varchar',
          length: '80',
          isNullable: false,
        }),
      );
      await queryRunner.createIndex(
        'plans',
        new TableIndex({
          name: 'IDX_plans_slug',
          columnNames: ['slug'],
          isUnique: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('plans', 'currency'))) {
      await queryRunner.addColumn(
        'plans',
        new TableColumn({
          name: 'currency',
          type: 'char',
          length: '3',
          default: "'MXN'",
        }),
      );
    }

    if (!(await queryRunner.hasColumn('plans', 'billingInterval'))) {
      await queryRunner.addColumn(
        'plans',
        new TableColumn({
          name: 'billingInterval',
          type: 'enum',
          enum: ['MONTH', 'YEAR'],
          default: "'MONTH'",
        }),
      );
    }

    if (!(await queryRunner.hasColumn('plans', 'providerPriceId'))) {
      await queryRunner.addColumn(
        'plans',
        new TableColumn({
          name: 'providerPriceId',
          type: 'varchar',
          length: '191',
          isNullable: true,
        }),
      );
      await queryRunner.createIndex(
        'plans',
        new TableIndex({
          name: 'IDX_plans_provider_price',
          columnNames: ['providerPriceId'],
          isUnique: true,
        }),
      );
    }

    if (!(await queryRunner.hasTable('subscriptions'))) return;

    await queryRunner.query(`
      ALTER TABLE subscriptions
      MODIFY status ENUM('INCOMPLETE','TRIAL','ACTIVE','PAST_DUE','EXPIRED','CANCELLED')
      NOT NULL DEFAULT 'INCOMPLETE'
    `);

    const columns: TableColumn[] = [];
    if (!(await queryRunner.hasColumn('subscriptions', 'provider'))) {
      columns.push(
        new TableColumn({
          name: 'provider',
          type: 'varchar',
          length: '40',
          default: "'MANUAL'",
        }),
      );
    }
    if (
      !(await queryRunner.hasColumn('subscriptions', 'providerSubscriptionId'))
    ) {
      columns.push(
        new TableColumn({
          name: 'providerSubscriptionId',
          type: 'varchar',
          length: '191',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('subscriptions', 'providerCustomerId'))) {
      columns.push(
        new TableColumn({
          name: 'providerCustomerId',
          type: 'varchar',
          length: '191',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('subscriptions', 'cancelAtPeriodEnd'))) {
      columns.push(
        new TableColumn({
          name: 'cancelAtPeriodEnd',
          type: 'tinyint',
          default: 0,
        }),
      );
    }
    if (columns.length > 0)
      await queryRunner.addColumns('subscriptions', columns);

    const table = await queryRunner.getTable('subscriptions');
    if (
      table &&
      !table.indices.some(
        (index) => index.name === 'IDX_subscriptions_provider_id',
      )
    ) {
      await queryRunner.createIndex(
        'subscriptions',
        new TableIndex({
          name: 'IDX_subscriptions_provider_id',
          columnNames: ['providerSubscriptionId'],
          isUnique: true,
        }),
      );
    }
    if (
      table &&
      !table.indices.some(
        (index) => index.name === 'IDX_subscriptions_business_status_end',
      )
    ) {
      await queryRunner.createIndex(
        'subscriptions',
        new TableIndex({
          name: 'IDX_subscriptions_business_status_end',
          columnNames: ['businessId', 'status', 'endDate'],
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('subscriptions'))) return;
    const subscriptionTable = await queryRunner.getTable('subscriptions');
    for (const indexName of [
      'IDX_subscriptions_business_status_end',
      'IDX_subscriptions_provider_id',
    ]) {
      if (
        subscriptionTable?.indices.some((index) => index.name === indexName)
      ) {
        await queryRunner.dropIndex('subscriptions', indexName);
      }
    }
    for (const column of [
      'cancelAtPeriodEnd',
      'providerCustomerId',
      'providerSubscriptionId',
      'provider',
    ]) {
      if (await queryRunner.hasColumn('subscriptions', column)) {
        await queryRunner.dropColumn('subscriptions', column);
      }
    }
    await queryRunner.query(`
      ALTER TABLE subscriptions
      MODIFY status ENUM('ACTIVE','EXPIRED','CANCELLED','TRIAL')
      NOT NULL DEFAULT 'TRIAL'
    `);

    if (!(await queryRunner.hasTable('plans'))) return;
    for (const indexName of ['IDX_plans_provider_price', 'IDX_plans_slug']) {
      const planTable = await queryRunner.getTable('plans');
      if (planTable?.indices.some((index) => index.name === indexName)) {
        await queryRunner.dropIndex('plans', indexName);
      }
    }
    for (const column of [
      'providerPriceId',
      'billingInterval',
      'currency',
      'slug',
    ]) {
      if (await queryRunner.hasColumn('plans', column)) {
        await queryRunner.dropColumn('plans', column);
      }
    }
  }
}
