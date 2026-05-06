import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/knex';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
  try {
    // Fetch all bills with their items
    const bills = await db('bills')
      .where('status', '!=', 'deleted')
      .orderBy('entry_date', 'desc');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Billing Tracker';
    workbook.lastModifiedBy = 'Billing Tracker';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheets = {
      MASTER: workbook.addWorksheet('Master Ledger'),
      AMAZON: workbook.addWorksheet('Amazon Only'),
      STAR: workbook.addWorksheet('Star Only'),
      ZEPTO: workbook.addWorksheet('Zepto Only'),
      EXPENSE: workbook.addWorksheet('Expense Tracker')
    };

    const columns = [
      { header: 'Bill ID', key: 'bill_id', width: 10 },
      { header: 'Company', key: 'company', width: 12 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Vendor Name', key: 'vendor_name', width: 30 },
      { header: 'Vendor Code', key: 'vendor_code', width: 15 },
      { header: 'PO Number', key: 'po_number', width: 20 },
      { header: 'Ref No (GRN/Challan)', key: 'ref_no', width: 20 },
      { header: 'Plant Name', key: 'plant_name', width: 20 },
      { header: 'Total Bill Amount', key: 'total_bill_amount', width: 18 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Item Description', key: 'item_description', width: 40 },
      { header: 'Item Qty', key: 'item_qty', width: 10 },
      { header: 'Actual Qty', key: 'actual_qty', width: 12 },
      { header: 'Return Qty', key: 'return_qty', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Unit Price/Cost', key: 'unit_price', width: 15 },
      { header: 'Item Total', key: 'item_total', width: 15 },
      { header: 'Article/ASIN', key: 'article_asin', width: 20 }
    ];

    // Configure all sheets
    Object.values(sheets).forEach(sheet => {
      sheet.columns = columns;
      // Style headers
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Slate-800
      };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let grandTotal = 0;
    const companyTotals: Record<string, number> = { AMAZON: 0, STAR: 0, ZEPTO: 0 };

    for (const bill of bills) {
      const items = await db('bill_items').where('bill_id', bill.id);
      const billAmount = Number(bill.total_amount || 0);
      grandTotal += billAmount;
      if (bill.company in companyTotals) {
        companyTotals[bill.company] += billAmount;
      }
      
      for (const item of items) {
        const rowData = {
          bill_id: bill.id,
          company: bill.company,
          date: bill.grn_date || bill.challan_date || '',
          vendor_name: bill.vendor_name || '',
          vendor_code: bill.vendor_code || '',
          po_number: bill.po_number || '',
          ref_no: bill.grn_no || bill.challan_no || '',
          plant_name: bill.plant_name || '',
          total_bill_amount: bill.total_amount,
          currency: bill.currency || 'INR',
          item_description: item.description || '',
          item_qty: item.qty,
          actual_qty: item.actual_qty,
          return_qty: item.return_qty,
          unit: item.unit || '',
          unit_price: item.unit_price || item.cost_per_unit || 0,
          item_total: item.total_amount,
          article_asin: item.article_no || item.asin || ''
        };

        // Add to MASTER
        sheets.MASTER.addRow(rowData);

        // Add to specific company sheet
        if (bill.company === 'AMAZON') sheets.AMAZON.addRow(rowData);
        if (bill.company === 'STAR') sheets.STAR.addRow(rowData);
        if (bill.company === 'ZEPTO') sheets.ZEPTO.addRow(rowData);
      }
    }

    // Add Summary to MASTER sheet
    const master = sheets.MASTER;
    master.addRow([]);
    const summaryHeader = master.addRow(['--- SUMMARY ---']);
    summaryHeader.font = { bold: true };
    
    master.addRow(['Total Records', bills.length]);
    master.addRow(['Grand Total Amount', grandTotal.toFixed(2)]);
    Object.entries(companyTotals).forEach(([company, total]) => {
      master.addRow([`Total ${company}`, total.toFixed(2)]);
    });

    // Final formatting for numbers
    Object.values(sheets).forEach(sheet => {
      sheet.getColumn('total_bill_amount').numFmt = '₹#,##0.00';
      sheet.getColumn('unit_price').numFmt = '₹#,##0.00';
      sheet.getColumn('item_total').numFmt = '₹#,##0.00';
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Master_Billing_Ledger.xlsx"`
      }
    });
  } catch (error: any) {
    console.error('Export failed:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
