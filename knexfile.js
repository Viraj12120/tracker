const path = require('path');
require('dotenv').config();

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(process.cwd(), 'data', 'billing.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(process.cwd(), 'src', 'lib', 'db', 'migrations'),
    },
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(process.cwd(), 'src', 'lib', 'db', 'migrations'),
    },
  },
};
