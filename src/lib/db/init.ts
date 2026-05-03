import db from './knex';
import fs from 'fs';
import path from 'path';

export async function initDb() {
  try {
    // Ensure data directory exists for sqlite
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log('Running database migrations...');
    await db.migrate.latest();
    console.log('Database migrations completed.');
  } catch (error) {
    console.error('Error running migrations:', error);
  }
}
