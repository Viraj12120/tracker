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

export async function parseWithLLM(pdfBuffer: Buffer): Promise<any> {
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
    You are a precise document extraction expert. You are provided with a PDF document (Amazon Delivery Challan or STAR Goods Receipt Slip).
    Analyze the VISUAL layout and extract all details exactly as shown.

    CRITICAL RULES FOR ACCURACY:
    - DO NOT merge adjacent columns. Look at the column headers to separate values (e.g., separate Qty from Net Amount).
    - If the Qty is 152 and Net Amount is 6840.00, return them as two separate numbers. Do NOT return 1526840.
    - CAPTURE EVERYTHING EXACTLY. If the bill says 6840.00, return 6840.00. Do not do math or recalculate.
    - total_amount at the root level = the printed grand total from the document's totals row.
    - For STAR: use "Rev. Qty" column as the main qty.
    - For AMAZON: use "Qty" and "Net Amount" columns.

    Return a JSON object with this exact structure:
    {
      "company": "STAR" | "AMAZON",
      "po_number": string | null,
      "vendor_code": string | null,
      "vendor_name": string | null,
      "vendor_address": string | null,
      "billing_address": string | null,
      "shipping_address": string | null,
      "currency": string | null,
      "company_pan": string | null,
      "gstn": string | null,
      "total_amount": number,
      "grn_no": string | null,
      "grn_date": string | null,
      "current_date": string | null,
      "plant_code": string | null,
      "plant_name": string | null,
      "plant_description": string | null,
      "delivery_note": string | null,
      "vendor_inv_no": string | null,
      "header_text": string | null,
      "supply_state": string | null,
      "movement_type": string | null,
      "challan_no": string | null,
      "challan_date": string | null,
      "challan_version": string | null,
      "items": [
        {
          "item_no": string | null,
          "merch_cat": string | null,
          "hsn_code": string | null,
          "article_no": string | null,
          "description": string,
          "sto_loc": string | null,
          "ean": string | null,
          "po_qty": number | null,
          "qty": number,
          "unit": string | null,
          "cost_per_unit": number | null,
          "unit_price": number | null,
          "mrp": number | null,
          "total_amount": number,
          "asin": string | null,
          "cgst_rate": number | null,
          "cgst_amt": number | null,
          "sgst_rate": number | null,
          "sgst_amt": number | null,
          "cess_rate": number | null,
          "cess_amt": number | null
        }
      ]
    }

    Field mapping by document type:

    AMAZON Delivery Challan:
    - Header: challan_no, challan_version, challan_date (parse "DD-MM-YYYY HH:MM AM/PM" → "YYYY-MM-DD"),
      vendor_name, vendor_code, po_number, billing_address, shipping_address, currency.
    - Items columns: ASIN → asin, Description → description, Unit Price → unit_price, Qty → qty, Net Amount → total_amount.
    - Root total_amount = the printed "Total" Net Amount value (totals row). 

    STAR Goods Receipt Slip:
    - Header: grn_no, grn_date, current_date, plant_code, plant_description, plant_name, company_pan, gstn, vendor_code, vendor_name, vendor_address, supply_state, delivery_note, vendor_inv_no, po_number, header_text, movement_type.
    - Items: Item → item_no, Article → article_no, Rev. Qty → qty, Cost → total_amount, tax fields (CGST, SGST, CESS).
    - Root total_amount = the printed "Cost" column total row value.

    ZEPTO Invoice/Challan:
    - Header: challan_no (or invoice_no), challan_date, vendor_name, vendor_code, po_number, billing_address, shipping_address, currency.
    - Items: Description, Qty, Unit Price, Total (Net Amount), Tax fields (if any).
    - Root total_amount = the grand total printed on the document.

    Rules:
    - If a field is not present, return null.
    - Dates: YYYY-MM-DD.
    - For STAR: Handle comma as decimal (e.g. 220,00 → 220.0).
  `;

  try {
    const result = await withRetry(() => model.generateContent([
      prompt,
      {
        inlineData: {
          data: pdfBuffer.toString('base64'),
          mimeType: 'application/pdf',
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
