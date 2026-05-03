import { NextResponse } from 'next/server';
import db from '@/lib/db/knex';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    await db.migrate.latest();
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json({ error: 'Failed to init db', details: String(error) }, { status: 500 });
  }
}
