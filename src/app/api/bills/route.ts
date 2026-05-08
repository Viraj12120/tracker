import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/knex';
import { triggerSync } from '@/lib/services/syncToProd';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');
    const search = searchParams.get('search');
    const sortDir = searchParams.get('sortDir') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = db('bills').where('status', '!=', 'deleted');

    if (company && company !== 'ALL') {
      query = query.where('company', company);
    }

    if (search) {
      query = query.where(function() {
        this.where('vendor_name', 'like', `%${search}%`)
          .orWhere('po_number', 'like', `%${search}%`)
          .orWhere('grn_no', 'like', `%${search}%`)
          .orWhere('challan_no', 'like', `%${search}%`);
      });
    }

    // Sort by grn_date/challan_date (they are actually stored as text in YYYY-MM-DD usually, or grn_date is preferred)
    // We'll use COALESCE for sorting across different company fields
    const bills = await query
      .orderByRaw(`COALESCE(grn_date, challan_date) ${sortDir}`)
      .limit(limit)
      .offset(offset);
    
    // Fetch items for each bill
    const billsWithItems = await Promise.all(bills.map(async (bill) => {
      const items = await db('bill_items').where('bill_id', bill.id);
      return { ...bill, items };
    }));

    // Get total count for pagination
    let countQuery = db('bills').where('status', '!=', 'deleted');
    if (company && company !== 'ALL') {
      countQuery = countQuery.where('company', company);
    }
    const [{ count }] = await countQuery.count('id as count');

    return NextResponse.json({
      data: billsWithItems,
      total: count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('id');
    
    let ids: number[] = [];

    if (queryId) {
      ids = [parseInt(queryId, 10)];
    } else {
      try {
        const body = await request.json();
        if (body.ids && Array.isArray(body.ids)) {
          ids = body.ids;
        }
      } catch (e) {
        // Body might be empty, skip
      }
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    // Soft delete
    await db('bills').whereIn('id', ids).update({ status: 'deleted' });
    triggerSync(); // fire-and-forget: push to production Supabase
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bills:', error);
    return NextResponse.json({ error: 'Failed to delete bills' }, { status: 500 });
  }
}
