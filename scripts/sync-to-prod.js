/**
 * sync-to-prod.js
 * Reads all data from local SQLite (data/billing.db) and upserts into
 * production Supabase PostgreSQL.
 *
 * Usage:  node scripts/sync-to-prod.js
 */

require('dotenv').config();
const path = require('path');
const knex = require('knex');

// ── Local SQLite ─────────────────────────────────────────────────────────────
const localDb = knex({
  client: 'sqlite3',
  connection: { filename: path.join(__dirname, '..', 'data', 'billing.db') },
  useNullAsDefault: true,
});

// ── Production Supabase PostgreSQL ───────────────────────────────────────────
const prodDb = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
  useNullAsDefault: true,
});

// ── Date/Timestamp normalizer ─────────────────────────────────────────────────
// SQLite stores date/timestamp as ms-since-epoch integers (or already strings).
// Postgres needs ISO strings. Convert anything that looks like a big integer.
const DATE_COLS    = ['grn_date', 'challan_date', 'current_date', 'challan_version'];
const TS_COLS      = ['entry_date'];

function normalizeRow(row) {
  const out = { ...row };

  for (const col of DATE_COLS) {
    if (out[col] == null) continue;
    const v = out[col];
    // If it's a number (ms timestamp), convert to YYYY-MM-DD
    if (typeof v === 'number' || (typeof v === 'string' && /^\d{10,}$/.test(v))) {
      const d = new Date(Number(v));
      out[col] = isNaN(d) ? null : d.toISOString().slice(0, 10);
    }
    // If it's already a date string like "YYYY-MM-DD", leave it
  }

  for (const col of TS_COLS) {
    if (out[col] == null) continue;
    const v = out[col];
    if (typeof v === 'number' || (typeof v === 'string' && /^\d{10,}$/.test(v))) {
      const d = new Date(Number(v));
      out[col] = isNaN(d) ? null : d.toISOString();
    }
  }

  return out;
}

async function syncTable(tableName, conflictKey) {
  const rows = await localDb(tableName).select('*');
  if (rows.length === 0) {
    console.log(`  [${tableName}] 0 rows – skipping.`);
    return;
  }

  const normalizedRows = rows.map(normalizeRow);

  // Upsert in chunks of 30 to stay well under Postgres max-param limits
  const CHUNK = 30;
  let upserted = 0;
  for (let i = 0; i < normalizedRows.length; i += CHUNK) {
    const chunk = normalizedRows.slice(i, i + CHUNK);
    await prodDb(tableName)
      .insert(chunk)
      .onConflict(conflictKey)
      .merge();
    upserted += chunk.length;
    process.stdout.write(`\r  [${tableName}] ${upserted}/${normalizedRows.length} rows...`);
  }
  console.log(`\r  [${tableName}] ${upserted} rows upserted.   `);
}

async function ensureMigrations() {
  console.log('\n→ Running migrations on production...');
  await prodDb.migrate.latest({
    directory: path.join(__dirname, '..', 'src', 'lib', 'db', 'migrations'),
  });
  console.log('  Migrations up to date.');
}

async function main() {
  try {
    console.log('=== Local SQLite → Production Supabase Sync ===');

    // 1. Make sure schema is up to date on prod
    await ensureMigrations();

    // 2. Sync bills first (parent), then bill_items (child)
    console.log('\n→ Syncing data...');
    await syncTable('bills', 'id');
    await syncTable('bill_items', 'id');

    console.log('\n✅  Sync complete!\n');
  } catch (err) {
    console.error('\n❌  Sync failed:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  } finally {
    await localDb.destroy();
    await prodDb.destroy();
  }
}

main();
