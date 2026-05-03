const fs = require('fs');
const path = require('path');
const knex = require('knex');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: path.join(dbDir, 'billing.db'),
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, 'src', 'lib', 'db', 'migrations'),
  },
});

async function main() {
  console.log('Running database migrations...');
  await db.migrate.latest();
  console.log('Database setup complete.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
