import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/knex';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const cleanNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const cleaned = String(val).replace(/[^0-9.-]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const billId = await db.transaction(async trx => {
      // 1. Insert into bills table (Header)
      const [id] = await trx('bills').insert({
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
      });

      // 2. Insert into bill_items table
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
          raw_details: item.raw_details ? JSON.stringify(item.raw_details) : null
        }));

        if (itemsToInsert.length > 0) {
          await trx('bill_items').insert(itemsToInsert);
        }
      }
      
      return id;
    });

    return NextResponse.json({ success: true, id: billId });
  } catch (error: any) {
    console.error('Error confirming bill:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to save bill' 
    }, { status: 500 });
  }
}
