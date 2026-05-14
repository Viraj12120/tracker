/**
 * syncToProd.ts
 * Fire-and-forget helper: after any local write, push the full local SQLite DB
 * up to the production Supabase PostgreSQL instance.
 *
 * Only runs in development (NODE_ENV !== 'production').
 * Skips silently if DATABASE_URL is not set.
 */

import knex from 'knex';
import path from 'path';

const DATE_COLS = ['grn_date', 'challan_date', 'current_date'];
const TS_COLS   = ['entry_date'];

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const out = { ...row };
  for (const col of DATE_COLS) {
    const v = out[col];
    if (v == null) continue;
    if (typeof v === 'number' || (typeof v === 'string' && /^\d{10,}$/.test(v))) {
      const d = new Date(Number(v));
      out[col] = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
  }
  for (const col of TS_COLS) {
    const v = out[col];
    if (v == null) continue;
    if (typeof v === 'number' || (typeof v === 'string' && /^\d{10,}$/.test(v))) {
      const d = new Date(Number(v));
      out[col] = isNaN(d.getTime()) ? null : d.toISOString();
    }
  }
  return out;
}

async function upsertTable(
  localDb: ReturnType<typeof knex>,
  prodDb: ReturnType<typeof knex>,
  tableName: string,
  conflictKey: string
): Promise<number> {
  const rows: Record<string, any>[] = await localDb(tableName).select('*');
  if (rows.length === 0) return 0;

  const normalized = rows.map(normalizeRow);
  const CHUNK = 30;
  for (let i = 0; i < normalized.length; i += CHUNK) {
    await prodDb(tableName)
      .insert(normalized.slice(i, i + CHUNK))
      .onConflict(conflictKey)
      .merge();
  }
  return normalized.length;
}

let _isSyncing = false;

export async function syncToProd(): Promise<void> {
  // Only run in local development
  if (process.env.NODE_ENV === 'production') return;
  if (!process.env.DATABASE_URL) return;
  if (_isSyncing) {
    console.log('[syncToProd] already running, skipping.');
    return;
  }

  _isSyncing = true;
  console.log('[syncToProd] 🔄 Starting background sync to Supabase...');
  const localDb = knex({
    client: 'sqlite3',
    connection: { filename: path.join(process.cwd(), 'data', 'billing.db') },
    useNullAsDefault: true,
  });
  const prodDb = knex({
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    useNullAsDefault: true,
  });

  try {
    const billCount      = await upsertTable(localDb, prodDb, 'bills', 'id');
    const itemCount      = await upsertTable(localDb, prodDb, 'bill_items', 'id');
    console.log(`[syncToProd] ✅ synced ${billCount} bills, ${itemCount} items → Supabase`);
  } catch (err: any) {
    console.error('[syncToProd] ❌ sync failed:', err.message);
  } finally {
    _isSyncing = false;
    await localDb.destroy();
    await prodDb.destroy();
  }
}

/**
 * Trigger sync in the background — does NOT block the caller.
 */
export function triggerSync(): void {
  syncToProd().catch(() => {/* already logged inside syncToProd */});
}
