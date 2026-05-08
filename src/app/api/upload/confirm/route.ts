import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/knex';
import { triggerSync } from '@/lib/services/syncToProd';

const cleanNumber = (val: any) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

/**
 * Content-based duplicate guard for manual uploads.
 * Returns an existing bill if a duplicate is found, otherwise null.
 */
async function findDuplicate(data: any): Promise<any | null> {
  const company: string = (data.company || '').toUpperCase();

  if (company === 'STAR') {
    // Primary: grn_no must be unique
    if (data.grn_no) {
      const existing = await db('bills')
        .where('status', '!=', 'deleted')
        .where('grn_no', data.grn_no)
        .first();
      if (existing) return existing;
    }
  } else if (company === 'AMAZON' || company === 'ZEPTO') {
    // Primary: challan_no (invoice number) must be unique
    if (data.challan_no) {
      const existing = await db('bills')
        .where('status', '!=', 'deleted')
        .where('challan_no', data.challan_no)
        .first();
      if (existing) return existing;
    }
    // Fallback: same vendor + same date + same total
    if (data.challan_date && data.vendor_name && data.total_amount) {
      const existing = await db('bills')
        .where('status', '!=', 'deleted')
        .where('company', company)
        .where('vendor_name', data.vendor_name)
        .where('total_amount', cleanNumber(data.total_amount))
        .whereRaw('DATE(challan_date) = ?', [data.challan_date.toString().split('T')[0]])
        .first();
      if (existing) return existing;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // ── Duplicate guard ──────────────────────────────────────────────────────
    const duplicate = await findDuplicate(data);
    if (duplicate) {
      return NextResponse.json(
        {
          error: `Duplicate bill detected. A ${data.company} bill with the same ${
            data.grn_no ? `GRN No (${data.grn_no})` : `Invoice No (${data.challan_no || 'unknown'})`
          } already exists (ID: ${duplicate.id}).`,
          duplicate_id: duplicate.id,
        },
        { status: 409 }
      );
    }
    // ────────────────────────────────────────────────────────────────────────

    const billId = await db.transaction(async trx => {
      const insertResult = await trx('bills').insert({
        company: data.company,
        source: 'manual_upload',
        grn_no: data.grn_no,
        grn_date: data.grn_date ? new Date(data.grn_date) : null,
        current_date: data.current_date ? new Date(data.current_date) : null,
        plant_code: data.plant_code,
        plant_name: data.plant_name,
        plant_description: data.plant_description,
        vendor_code: data.vendor_code,
        vendor_name: data.vendor_name,
        vendor_address: data.vendor_address,
        delivery_note: data.delivery_note,
        vendor_inv_no: data.vendor_inv_no,
        po_number: data.po_number,
        company_pan: data.company_pan,
        gstn: data.gstn,
        movement_type: data.movement_type,
        challan_no: data.challan_no,
        challan_date: data.challan_date ? new Date(data.challan_date) : null,
        challan_version: data.challan_version,
        billing_address: data.billing_address,
        shipping_address: data.shipping_address,
        currency: data.currency,
        total_amount: cleanNumber(data.total_amount),
        pdf_filename: data.pdf_filename,
        status: 'confirmed',
        notes: data.notes
      }).returning('id');

      const id = typeof insertResult[0] === 'object' ? insertResult[0].id : insertResult[0];

      if (data.items && Array.isArray(data.items)) {
        const itemsToInsert = data.items.map((item: any) => ({
          bill_id: id,
          description: item.description,
          qty: cleanNumber(item.qty),
          unit_price: cleanNumber(item.unit_price),
          total_amount: cleanNumber(item.total_amount),
          hsn_code: item.hsn_code,
          article_no: item.article_no,
          mrp: cleanNumber(item.mrp),
          cost_per_unit: cleanNumber(item.cost_per_unit),
          unit: item.unit,
          asin: item.asin,
          po_qty: cleanNumber(item.po_qty),
          ean: item.ean,
          merch_cat: item.merch_cat,
          cgst_rate: cleanNumber(item.cgst_rate),
          cgst_amt: cleanNumber(item.cgst_amt),
          sgst_rate: cleanNumber(item.sgst_rate),
          sgst_amt: cleanNumber(item.sgst_amt),
          cess_rate: cleanNumber(item.cess_rate),
          cess_amt: cleanNumber(item.cess_amt),
          actual_qty: cleanNumber(item.actual_qty),
          return_qty: cleanNumber(item.return_qty),
          raw_details: item.raw_details ? JSON.stringify(item.raw_details) : null
        }));

        if (itemsToInsert.length > 0) {
          await trx('bill_items').insert(itemsToInsert);
        }
      }

      return id;
    });

    triggerSync(); // fire-and-forget: push to production Supabase
    return NextResponse.json({ success: true, id: billId });
  } catch (error: any) {
    console.error('Error confirming bill:', error);
    return NextResponse.json({
      error: error.message || 'Failed to save bill'
    }, { status: 500 });
  }
}
