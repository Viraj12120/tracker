import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/knex';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const bill = await db('bills')
      .where('id', id)
      .first();

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const items = await db('bill_items')
      .where('bill_id', id);

    return NextResponse.json({
      success: true,
      bill: {
        ...bill,
        items
      }
    });
  } catch (error: any) {
    console.error('Error fetching bill details:', error);
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 });
  }
}
