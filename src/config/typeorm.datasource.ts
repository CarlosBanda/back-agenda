import 'dotenv/config';
import { DataSource } from 'typeorm';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export default new DataSource({
  type: 'mysql',
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT ?? 3306),
  username: required('DB_USERNAME'),
  password: required('DB_PASSWORD'),
  database: required('DB_NAME'),
  timezone: 'Z',
  synchronize: false,
  entities: [`${__dirname}/../modules/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
  migrationsTableName: 'typeorm_migrations',
});
