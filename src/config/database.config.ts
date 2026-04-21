import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(String(process.env.DATABASE_PORT), 10) || 5432,
  username: process.env.DATABASE_USER || 'expense_user',
  password: process.env.DATABASE_PASSWORD || 'expense_pass',
  database: process.env.DATABASE_NAME || 'expense_db',
  synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
}));
