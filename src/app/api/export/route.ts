import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/knex';

export async function GET(request: NextRequest) {
  try {
    // Fetch all bills with their items
    const bills = await db('bills')
      .where('status', '!=', 'deleted')
      .orderBy('entry_date', 'desc');

    const csvRows = [];
    
    // Headers
    const headers = [
      'Bill ID',
      'Company',
      'Date',
      'Vendor Name',
      'Vendor Code',
      'PO Number',
      'Ref No (GRN/Challan)',
      'Plant Name',
      'Total Bill Amount',
      'Currency',
      'Item Description',
      'Item Qty',
      'Unit',
      'Unit Price/Cost',
      'Item Total',
      'CGST Amt',
      'SGST Amt',
      'CESS Amt',
      'HSN Code',
      'Article/ASIN'
    ];
    csvRows.push(headers.join(','));

    for (const bill of bills) {
      const items = await db('bill_items').where('bill_id', bill.id);
      
      for (const item of items) {
        const row = [
          bill.id,
          bill.company,
          bill.grn_date || bill.challan_date || '',
          `"${(bill.vendor_name || '').replace(/"/g, '""')}"`,
          bill.vendor_code || '',
          bill.po_number || '',
          bill.grn_no || bill.challan_no || '',
          `"${(bill.plant_name || '').replace(/"/g, '""')}"`,
          bill.total_amount,
          bill.currency || 'INR',
          `"${(item.description || '').replace(/"/g, '""')}"`,
          item.qty,
          item.unit || '',
          item.unit_price || item.cost_per_unit || 0,
          item.total_amount,
          item.cgst_amt || 0,
          item.sgst_amt || 0,
          item.cess_amt || 0,
          item.hsn_code || '',
          item.article_no || item.asin || ''
        ];
        csvRows.push(row.join(','));
      }
    }

    const csvString = csvRows.join('\n');

    return new NextResponse(csvString, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="billing_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error: any) {
    console.error('Export failed:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
