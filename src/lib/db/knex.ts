import knex from 'knex';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

export const db = knex({
  client: isProd ? 'pg' : 'sqlite3',
  connection: isProd 
    ? process.env.DATABASE_URL
    : {
        filename: path.join(process.cwd(), 'data', 'billing.db'),
      },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(process.cwd(), 'src', 'lib', 'db', 'migrations'),
  },
});

export default db;
