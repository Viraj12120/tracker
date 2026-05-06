import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { parsePdfBuffer } from './pdfParser';
import db from '../db/knex';

/**
 * Content-based duplicate check.
 * Returns true if a non-deleted bill already exists with the same unique identifiers.
 */
async function isDuplicate(parsedData: any): Promise<boolean> {
  const company: string = (parsedData.company || '').toUpperCase();

  if (company === 'STAR') {
    // STAR bills: deduplicate by grn_no
    if (parsedData.grn_no) {
      const existing = await db('bills')
        .where('status', '!=', 'deleted')
        .where('grn_no', parsedData.grn_no)
        .first();
      if (existing) {
        console.log(`[DEDUP] Skipping duplicate STAR bill — grn_no: ${parsedData.grn_no}`);
        return true;
      }
    }
    // Fallback: grn_date + vendor_code
    if (parsedData.grn_date && parsedData.vendor_code) {
      const existing = await db('bills')
        .where('status', '!=', 'deleted')
        .where('company', 'STAR')
        .where('vendor_code', parsedData.vendor_code)
        .whereRaw('DATE(grn_date) = ?', [parsedData.grn_date])
        .first();
      if (existing) {
        console.log(`[DEDUP] Skipping duplicate STAR bill — vendor_code+date: ${parsedData.vendor_code} / ${parsedData.grn_date}`);
        return true;
      }
    }
  } else if (company === 'AMAZON' || company === 'ZEPTO') {
    // AMAZON/ZEPTO bills: deduplicate by challan_no (invoice number)
    if (parsedData.challan_no) {
      const existing = await db('bills')
        .where('status', '!=', 'deleted')
        .where('challan_no', parsedData.challan_no)
        .first();
      if (existing) {
        console.log(`[DEDUP] Skipping duplicate ${company} bill — challan_no: ${parsedData.challan_no}`);
        return true;
      }
    }
    // Fallback: challan_date + vendor_name + total_amount
    if (parsedData.challan_date && parsedData.vendor_name && parsedData.total_amount) {
      const existing = await db('bills')
        .where('status', '!=', 'deleted')
        .where('company', company)
        .where('vendor_name', parsedData.vendor_name)
        .where('total_amount', parsedData.total_amount)
        .whereRaw('DATE(challan_date) = ?', [parsedData.challan_date])
        .first();
      if (existing) {
        console.log(`[DEDUP] Skipping duplicate ${company} bill — vendor+date+amount: ${parsedData.vendor_name} / ${parsedData.challan_date}`);
        return true;
      }
    }
  }

  return false;
}

export async function syncStarBillsFromGmail() {
  const config = {
    imap: {
      user: process.env.GMAIL_USER || 'dattatraydisale75@gmail.com',
      password: process.env.GMAIL_APP_PASSWORD || '',
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 30000
    }
  };

  if (!config.imap.password) {
    throw new Error('GMAIL_APP_PASSWORD is not set in .env');
  }

  const sender = process.env.STAR_SENDER_EMAIL || 'TRENTGRN-ADMIN@trenthyper-tata.com';
  let processedCount = 0;

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = [
      ['FROM', sender],
      ['SUBJECT', 'Goods receipt']
    ];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      struct: true,
      markSeen: true
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`IMAP Search found ${messages.length} messages.`);

    for (const message of messages) {
      const messageId = message.attributes.uid.toString();

      // Fast-path: skip if Gmail UID already recorded
      const uidExists = await db('bills')
        .where('notes', 'like', `%gmail_uid:${messageId}%`)
        .where('status', '!=', 'deleted')
        .first();
      if (uidExists) continue;

      const all = message.parts.find((part: any) => part.which === '');
      if (!all) continue;

      const parsedMail = await simpleParser(all.body);

      if (parsedMail.attachments && parsedMail.attachments.length > 0) {
        for (const attachment of parsedMail.attachments) {
          if (
            attachment.contentType === 'application/pdf' ||
            attachment.filename?.toLowerCase().endsWith('.pdf')
          ) {
            try {
              const parsedData = await parsePdfBuffer(attachment.content);

              // Content-based duplicate guard (prevents re-sync duplicates)
              const duplicate = await isDuplicate(parsedData);
              if (duplicate) continue;

              const cleanNumber = (val: any) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                const cleaned = String(val).replace(/[^0-9.-]/g, '');
                const num = parseFloat(cleaned);
                return isNaN(num) ? 0 : num;
              };

              await db.transaction(async (trx) => {
                const insertResult = await trx('bills').insert({
                  company: parsedData.company,
                  source: 'auto_email',
                  po_number: parsedData.po_number,
                  vendor_code: parsedData.vendor_code,
                  vendor_name: parsedData.vendor_name,
                  vendor_address: parsedData.vendor_address,
                  billing_address: parsedData.billing_address,
                  shipping_address: parsedData.shipping_address,
                  currency: parsedData.currency,
                  company_pan: parsedData.company_pan,
                  gstn: parsedData.gstn,
                  total_amount: cleanNumber(parsedData.total_amount),
                  grn_no: parsedData.grn_no,
                  grn_date: parsedData.grn_date ? new Date(parsedData.grn_date) : null,
                  plant_code: parsedData.plant_code,
                  plant_name: parsedData.plant_name,
                  plant_description: parsedData.plant_description,
                  delivery_note: parsedData.delivery_note,
                  vendor_inv_no: parsedData.vendor_inv_no,
                  movement_type: parsedData.movement_type,
                  challan_no: parsedData.challan_no,
                  challan_date: parsedData.challan_date ? new Date(parsedData.challan_date) : null,
                  challan_version: parsedData.challan_version,
                  notes: `Auto-fetched from Gmail (gmail_uid:${messageId})`,
                  status: 'confirmed',
                  pdf_filename: attachment.filename || 'attachment.pdf'
                }).returning('id');

                const billId =
                  typeof insertResult[0] === 'object' ? insertResult[0].id : insertResult[0];

                if (parsedData.items && parsedData.items.length > 0) {
                  const itemsToInsert = parsedData.items.map((item: any) => ({
                    bill_id: billId,
                    description: item.description,
                    qty: cleanNumber(item.qty),
                    unit: item.unit,
                    unit_price: cleanNumber(item.unit_price || item.cost_per_unit),
                    total_amount: cleanNumber(item.total_amount),
                    asin: item.asin,
                    article_no: item.article_no,
                    hsn_code: item.hsn_code,
                    mrp: cleanNumber(item.mrp),
                    cost_per_unit: cleanNumber(item.cost_per_unit),
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
                    return_qty: cleanNumber(item.return_qty)
                  }));
                  await trx('bill_items').insert(itemsToInsert);
                }
              });

              processedCount++;
            } catch (err) {
              console.error(`Failed to process attachment ${attachment.filename}:`, err);
            }
          }
        }
      }
    }

    connection.end();
  } catch (error) {
    console.error('Error in IMAP sync:', error);
    throw error;
  }

  return processedCount;
}
