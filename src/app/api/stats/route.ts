import { NextResponse } from 'next/server';
import db from '@/lib/db/knex';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const company = searchParams.get('company');

    let baseQuery = db('bills').where('status', '!=', 'deleted');
    if (company && company !== 'ALL') {
      baseQuery = baseQuery.andWhere('company', company);
    }

    const [{ total_bills }] = await baseQuery.clone().count('id as total_bills');

    // Total Amount
    const [{ total_amount }] = await baseQuery.clone().sum('total_amount as total_amount');

    // 1. STAR Weight (Only unit = 'KG')
    let starWeightQuery = db('bill_items')
      .join('bills', 'bill_items.bill_id', 'bills.id')
      .where('bills.status', '!=', 'deleted')
      .andWhere('bills.company', 'STAR')
      .andWhere('bill_items.unit', 'KG');

    const starWeightResult = await starWeightQuery.sum('bill_items.qty as weight_kg').first();
    const star_weight = (starWeightResult as any)?.weight_kg || 0;

    // 2. AMAZON Weight (1kg items as-is)
    let amazonWeightQuery = db('bill_items')
      .join('bills', 'bill_items.bill_id', 'bills.id')
      .where('bills.status', '!=', 'deleted')
      .andWhere('bills.company', 'AMAZON')
      .andWhere(function() {
        this.where('bill_items.description', 'like', '%1 kg%')
            .orWhere('bill_items.description', 'like', '%1kg%');
      });

    const amazonWeightResult = await amazonWeightQuery.sum('bill_items.qty as weight_kg').first();
    const amazon_1kg_weight = (amazonWeightResult as any)?.weight_kg || 0;

    // 3. AMAZON Kesar pieces (Qty * 0.02)
    let amazonKesarQuery = db('bill_items')
      .join('bills', 'bill_items.bill_id', 'bills.id')
      .where('bills.status', '!=', 'deleted')
      .andWhere('bills.company', 'AMAZON')
      .andWhere('bill_items.description', 'like', '%Fresh Kesar 1Pc Buying (Approx. 200g)%');

    const amazonKesarResult = await amazonKesarQuery.select(
        db.raw('SUM(bill_items.qty * 0.02) as kesar_weight'),
        db.raw('SUM(bill_items.qty) as kesar_qty')
      )
      .first();

    const amazon_kesar_weight = (amazonKesarResult as any)?.kesar_weight || 0;
    const kesar_qty = (amazonKesarResult as any)?.kesar_qty || 0;

    // Calculate Final Total based on active filter
    let final_weight = 0;
    if (company === 'STAR') {
      final_weight = Number(star_weight);
    } else if (company === 'AMAZON') {
      final_weight = Number(amazon_1kg_weight) + Number(amazon_kesar_weight);
    } else {
      // ALL or other
      final_weight = Number(star_weight) + Number(amazon_1kg_weight) + Number(amazon_kesar_weight);
    }

    return NextResponse.json({
      total_bills: Number(total_bills) || 0,
      total_amount: Number(total_amount) || 0,
      total_weight: final_weight || 0,
      kesar_qty: Number(kesar_qty) || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
