import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Retry a promise-returning fn up to maxRetries times on 429 errors,
// with exponential backoff.
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 5000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('Too Many Requests');

      if (is429 && attempt < maxRetries) {
        // Try to honour the Retry-After hint from the API, else use backoff
        const retryAfterMatch = err?.message?.match(/retry in ([\d.]+)s/i);
        const delayMs = retryAfterMatch
          ? Math.ceil(parseFloat(retryAfterMatch[1])) * 1000
          : baseDelayMs * Math.pow(2, attempt);

        console.warn(
          `Gemini 429 – retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export async function parseWithLLM(pdfBuffer: Buffer, mimeType: string = 'application/pdf'): Promise<any> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-lite-latest',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = `
You are a precise document extraction expert. You are provided with a PDF invoice or delivery challan from one of three companies: Amazon, STAR (Trent/Westside), or Zepto.
Analyze the VISUAL layout and extract all details exactly as shown.

CRITICAL RULES FOR ACCURACY:
- DO NOT merge adjacent columns. Look at the column headers to separate values (e.g., separate Qty from Net Amount).
- If the Qty is 152 and Net Amount is 6840.00, return them as two separate numbers. Do NOT return 1526840.
- CAPTURE EVERYTHING EXACTLY. If the bill says 6840.00, return 6840.00. Do not do math or recalculate.
- total_amount at the root level = the printed grand total from the document's totals row.
- For STAR: use "Rev. Qty" column as the main qty.
- For AMAZON: use "Qty" and "Net Amount" columns.
- For ZEPTO: use "Qty" and the item total/Amount column.

COMPANY IDENTIFICATION:
- If the document mentions "Zepto", "Kiranakart", "ZN Retail", "Zomato", or similar Zepto brand names → company = "ZEPTO"
- If the document mentions "Amazon", "ASSPL", "Amazon Seller Services" → company = "AMAZON"
- If the document mentions "TRENT", "Westside", "Star Market", "Goods Receipt Slip" issued by Trent → company = "STAR"

Return a JSON object with this exact structure:
{
  "company": "STAR" | "AMAZON" | "ZEPTO",
  "po_number": "string or null",
  "vendor_code": "string or null",
  "vendor_name": "string or null",
  "vendor_address": "string or null",
  "billing_address": "string or null",
  "shipping_address": "string or null",
  "currency": "string or null",
  "company_pan": "string or null",
  "gstn": "string or null",
  "total_amount": 0,
  "grn_no": "string or null",
  "grn_date": "string or null",
  "current_date": "string or null",
  "plant_code": "string or null",
  "plant_name": "string or null",
  "plant_description": "string or null",
  "delivery_note": "string or null",
  "vendor_inv_no": "string or null",
  "header_text": "string or null",
  "supply_state": "string or null",
  "movement_type": "string or null",
  "challan_no": "string or null",
  "challan_date": "string or null",
  "challan_version": "string or null",
  "items": [
    {
      "item_no": "string or null",
      "merch_cat": "string or null",
      "hsn_code": "string or null",
      "article_no": "string or null",
      "description": "string",
      "sto_loc": "string or null",
      "ean": "string or null",
      "po_qty": 0,
      "qty": 0,
      "unit": "string or null",
      "cost_per_unit": 0,
      "unit_price": 0,
      "mrp": 0,
      "total_amount": 0,
      "asin": "string or null",
      "actual_qty": 0,
      "return_qty": 0,
      "cgst_rate": 0,
      "cgst_amt": 0,
      "sgst_rate": 0,
      "sgst_amt": 0,
      "cess_rate": 0,
      "cess_amt": 0
    }
  ]
}

Field mapping by document type:

AMAZON Delivery Challan:
- Header: challan_no, challan_version, challan_date (parse "DD-MM-YYYY HH:MM AM/PM" to "YYYY-MM-DD"), vendor_name, vendor_code, po_number, billing_address, shipping_address, currency.
- Items columns: ASIN → asin, Description → description, Unit Price → unit_price, Qty → qty, Net Amount → total_amount.
- Root total_amount = the printed "Total" Net Amount value (totals row).

STAR Goods Receipt Slip:
- Header: grn_no (Goods Receipt Slip No), grn_date (Goods Receipt Date), current_date, plant_code (Plant), plant_description (Receiving Plant description), plant_name (Receiving Plant Name and Code), company_pan (Company PAN), gstn (GSTN/UIN), vendor_code (Vendor code part before hyphen), vendor_name (Vendor name part after hyphen), vendor_address (Vendor Supply Address), supply_state (Supply State Name and Code), delivery_note (Delivery Note), vendor_inv_no (Vendor Inv No.), po_number (PO), header_text (Header Text), movement_type (Movement Type).
- Items: Item → item_no, Article → article_no, Rev. Qty → qty, Unit Cost → cost_per_unit, MRP → mrp, Cost → total_amount, tax fields (CGST, SGST, CESS).
- Root total_amount = the printed "Cost" column total row value.

ZEPTO Invoice or Challan:
- Header: challan_no is the Invoice Number / Invoice No printed at the top of the document (this is the PRIMARY unique identifier — ALWAYS extract it), challan_date is the Invoice Date converted to YYYY-MM-DD, vendor_name is the Supplier or Seller name on the document, vendor_code is the Supplier or Seller code if present, po_number is the PO Number or Order ID, vendor_inv_no is the Invoice Number if it differs from challan_no, billing_address is the Bill To address block, shipping_address is the Ship To or Delivery address block, gstn is the GSTIN of the supplier, currency is "INR" if not explicitly stated.
- Items: Description or Product Name → description, HSN or SAC Code → hsn_code, Qty or Quantity → qty, Rate or Unit Price → unit_price, CGST Rate percent → cgst_rate, CGST Amount → cgst_amt, SGST Rate percent → sgst_rate, SGST Amount → sgst_amt, Taxable Amount per unit → cost_per_unit, Total or Amount including tax → total_amount.
- ZEPTO RETURN/DEDUCTION LOGIC (CRITICAL):
  * Look for handwritten or printed notes indicating a return or deduction (e.g., "16.906 is minus", "return 16.906", "-16.906").
  * actual_qty = the original quantity (e.g., 276).
  * return_qty = the deduction amount (e.g., 16.906).
  * qty (net quantity) = actual_qty - return_qty (e.g., 276 - 16.906 = 259.094).
  * unit_price = the rate per unit (e.g., 158).
  * total_amount for the item = qty * unit_price (e.g., 259.094 * 158 = 40936.852).
  * If no return is found, actual_qty = original quantity, return_qty = 0, and qty = original quantity.
- ZEPTO UNITS (CRITICAL):
  * Extract the unit for each item (e.g., "KG", "PCS", "PKT").
  * If the unit is not explicitly stated but the quantity has decimals (e.g., 16.906), assume the unit is "KG".
  * For vegetables and fruits, if the unit is missing, assume "KG".
- Root total_amount = the sum of all item total_amounts.

Rules:
- If a field is not present, return null.
- All dates must be in YYYY-MM-DD format.
- For STAR: Handle comma as decimal separator (e.g. 220,00 becomes 220.0).
- For ZEPTO: challan_no (Invoice Number) is MANDATORY and must always be extracted — it is the primary deduplication key.
`;

  try {
    const result = await withRetry(() => model.generateContent([
      prompt,
      {
        inlineData: {
          data: pdfBuffer.toString('base64'),
          mimeType: mimeType,
        },
      },
    ]));

    const response = await result.response;
    return JSON.parse(response.text());
  } catch (error: any) {
    console.error('Gemini API Error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack
    });
    throw error;
  }
}
