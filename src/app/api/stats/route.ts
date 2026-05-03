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

    // Total Weight (Sum qty for items with unit KG or description containing '1 kg')
    let weightQuery = db('bill_items')
      .join('bills', 'bill_items.bill_id', 'bills.id')
      .where('bills.status', '!=', 'deleted')
      .andWhere(function () {
        this.where('bill_items.unit', 'KG')
            .orWhere('bill_items.unit', 'kg')
            .orWhere('bill_items.description', 'like', '%1 kg%')
            .orWhere('bill_items.description', 'like', '%1kg%');
      });

    if (company && company !== 'ALL') {
      weightQuery = weightQuery.andWhere('bills.company', company);
    }

    const weightResult = await weightQuery.sum('bill_items.qty as weight_kg').first();
    const weight_kg = (weightResult as any)?.weight_kg || 0;

    // Kesar Conversion Weight (qty * 0.2)
    let kesarQuery = db('bill_items')
      .join('bills', 'bill_items.bill_id', 'bills.id')
      .where('bills.status', '!=', 'deleted')
      .andWhere('bill_items.description', 'like', '%Fresh Kesar 1Pc Buying (Approx. 200g)%');

    if (company && company !== 'ALL') {
      kesarQuery = kesarQuery.andWhere('bills.company', company);
    }

    const kesarResult = await kesarQuery.select(
        db.raw('SUM(bill_items.qty * 0.2) as kesar_weight'),
        db.raw('SUM(bill_items.qty) as kesar_qty')
      )
      .first();

    const kesar_weight = (kesarResult as any)?.kesar_weight || 0;
    const kesar_qty = (kesarResult as any)?.kesar_qty || 0;

    const total_weight = Number(weight_kg) + Number(kesar_weight);

    return NextResponse.json({
      total_bills: Number(total_bills) || 0,
      total_amount: Number(total_amount) || 0,
      total_weight: total_weight || 0,
      kesar_qty: Number(kesar_qty) || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
