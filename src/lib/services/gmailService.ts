import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import pdfParse from 'pdf-parse';
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
              // Parse PDF locally to avoid AI rate limits
              const pdfData = await pdfParse(attachment.content);
              const text = pdfData.text;

              const parsed = {
                company: 'STAR',
                grn_no: null as string | null,
                grn_date: null as string | null,
                vendor_code: null as string | null,
                vendor_name: null as string | null,
                po_number: null as string | null,
                total_amount: 0,
                items: [] as any[],
              };

              const grnMatch = text.match(/Goods\s+Receipt\s+Slip\s+No\s*:\s*(\d+)/i);
              if (grnMatch) parsed.grn_no = grnMatch[1];

              const dateMatch = text.match(/Goods\s+Receipt\s+Date\s*:\s*([\d\.]+)/i);
              if (dateMatch) {
                const parts = dateMatch[1].split('.');
                if (parts.length === 3) {
                  parsed.grn_date = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
                }
              }

              const vendorMatch = text.match(/Vendor\s*:\s*(\d+)\s*-\s*([\s\S]*?)Vendor Supply Address/i);
              if (vendorMatch) {
                parsed.vendor_code = vendorMatch[1].trim();
                parsed.vendor_name = vendorMatch[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
              }

              const poMatch = text.match(/PO\s*:\s*(\d+)/i);
              if (poMatch) parsed.po_number = poMatch[1];

              const totalMatch = text.match(/Total[\d,\s]+?(\d+)(?:0\.00)+/);
              if (totalMatch) {
                parsed.total_amount = parseInt(totalMatch[1], 10);
              } else {
                const fallbackMatch = text.match(/Total[\d,\s]+?\s+(\d+)\.?(?:0\.00)*\s*This is Computer/i);
                if (fallbackMatch) parsed.total_amount = parseInt(fallbackMatch[1], 10);
              }

              const finalGrn = parsed.grn_no || (attachment.filename ? attachment.filename.replace(/\.[^/.]+$/, "") : `EMAIL_${messageId}`);

              // Parse Line Items
              const lines = text.split('\n').map(l => l.trim());
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const itemStartMatch = line.match(/^(\d{4})([A-Za-z-]+)(\d{8})(\d{7})(.*)/);
                if (itemStartMatch) {
                  const hsn_code = itemStartMatch[3];
                  const article_no = itemStartMatch[4];
                  let description = itemStartMatch[5];
                  
                  let dataLine = null;
                  for (let j = 1; j <= 3 && (i + j) < lines.length; j++) {
                    const nextLine = lines[i + j];
                    if (/^[A-Z0-9]{4}\d{10,15}/.test(nextLine)) {
                      dataLine = nextLine;
                      for (let k = 1; k < j; k++) description += ' ' + lines[i + k];
                      break;
                    }
                  }
                  
                  if (dataLine) {
                    let po_qty = 0, qty = 0, unit = 'KG', unit_price = 0, mrp = 0, total_amount = 0;
                    const dataMatch = dataLine.match(/^[A-Z0-9]{4}\d{10,15}([\d,]+)\s+([\d,]+)(KG|PCS|NOS|EA)([\d\.]+)([\d\.]+)([\d\.]+)/i);
                    
                    if (dataMatch) {
                      po_qty = parseFloat(dataMatch[1].replace(',', '.'));
                      qty = parseFloat(dataMatch[2].replace(',', '.'));
                      unit = dataMatch[3];
                      const floats = [...dataLine.matchAll(/(\d+\.\d{2})/g)].map(m => parseFloat(m[1]));
                      if (floats.length >= 3) {
                        unit_price = floats[0]; mrp = floats[1]; total_amount = floats[2];
                      }
                    } else {
                      const qtys = [...dataLine.matchAll(/([\d]+,[\d]{2})/g)].map(m => parseFloat(m[1].replace(',', '.')));
                      if (qtys.length >= 2) { po_qty = qtys[0]; qty = qtys[1]; } else if (qtys.length === 1) qty = qtys[0];
                      const unitMatch = dataLine.match(/(KG|PCS|NOS|EA)/i);
                      if (unitMatch) unit = unitMatch[1];
                      const floats = [...dataLine.matchAll(/(\d+\.\d{2})/g)].map(m => parseFloat(m[1]));
                      if (floats.length >= 3) {
                        unit_price = floats[0]; mrp = floats[1]; total_amount = floats[2];
                      }
                    }
                    
                    parsed.items.push({ description: description.trim(), qty, unit_price, total_amount, hsn_code, article_no, mrp, unit });
                  }
                }
              }
              
              // Duplicate guard
              const isDuplicateLocal = async () => {
                if (parsed.grn_no) {
                  const existing = await db('bills').where('status', '!=', 'deleted').where('grn_no', parsed.grn_no).first();
                  if (existing) return true;
                }
                return false;
              };
              
              if (await isDuplicateLocal()) continue;

              await db.transaction(async (trx) => {
                const insertResult = await trx('bills').insert({
                  company: parsed.company,
                  source: 'auto_email',
                  vendor_name: parsed.vendor_name || 'Pending Sync (Direct)',
                  vendor_code: parsed.vendor_code,
                  po_number: parsed.po_number,
                  total_amount: parsed.total_amount,
                  grn_no: finalGrn,
                  grn_date: parsed.grn_date ? new Date(parsed.grn_date) : new Date(),
                  notes: `Auto-fetched from Gmail (gmail_uid:${messageId}). Regex parsed.`,
                  status: 'confirmed', // If we parsed successfully, mark as confirmed
                  pdf_filename: attachment.filename || 'attachment.pdf'
                }).returning('id');

                const billId = typeof insertResult[0] === 'object' ? insertResult[0].id : insertResult[0];

                if (parsed.items && parsed.items.length > 0) {
                  const itemsToInsert = parsed.items.map((item: any) => ({
                    bill_id: billId,
                    description: item.description,
                    qty: item.qty,
                    unit_price: item.unit_price,
                    cost_per_unit: item.unit_price,
                    total_amount: item.total_amount,
                    hsn_code: item.hsn_code,
                    article_no: item.article_no,
                    mrp: item.mrp,
                    unit: item.unit,
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
