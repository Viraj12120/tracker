import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { parsePdfBuffer } from './pdfParser';
import db from '../db/knex';

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

    // Search for emails from sender with "Goods receipt" in subject
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

    for (const message of messages) {
      const messageId = message.attributes.uid.toString();

      // Check if we already processed this message ID
      const existing = await db('bills').where('notes', 'like', `%gmail_uid:${messageId}%`).first();
      if (existing) continue;

      const all = message.parts.find((part: any) => part.which === '');
      if (!all) continue;

      const parsedMail = await simpleParser(all.body);

      if (parsedMail.attachments && parsedMail.attachments.length > 0) {
        for (const attachment of parsedMail.attachments) {
          if (attachment.contentType === 'application/pdf' || attachment.filename?.toLowerCase().endsWith('.pdf')) {
            try {
              const parsedData = await parsePdfBuffer(attachment.content);

              // Save to database
              await db.transaction(async (trx) => {
                const cleanNumber = (val: any) => {
                  if (typeof val === 'number') return val;
                  if (!val) return 0;
                  const cleaned = String(val).replace(/[^0-9.-]/g, '');
                  const num = parseFloat(cleaned);
                  return isNaN(num) ? 0 : num;
                };

                const [billId] = await trx('bills').insert({
                  company: parsedData.company,
                  source: 'auto_email',
                  po_number: parsedData.po_number,
                  vendor_code: parsedData.vendor_code,
                  vendor_name: parsedData.vendor_name,
                  total_amount: cleanNumber(parsedData.total_amount),
                  grn_no: parsedData.grn_no,
                  grn_date: parsedData.grn_date ? new Date(parsedData.grn_date) : null,
                  plant_code: parsedData.plant_code,
                  plant_name: parsedData.plant_name,
                  delivery_note: parsedData.delivery_note,
                  challan_no: parsedData.challan_no,
                  challan_date: parsedData.challan_date ? new Date(parsedData.challan_date) : null,
                  notes: `Auto-fetched from Gmail (UID: ${messageId})`,
                  status: 'confirmed',
                  pdf_filename: attachment.filename || 'attachment.pdf'
                });

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
                    cgst_rate: cleanNumber(item.cgst_rate),
                    cgst_amt: cleanNumber(item.cgst_amt),
                    sgst_rate: cleanNumber(item.sgst_rate),
                    sgst_amt: cleanNumber(item.sgst_amt)
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
