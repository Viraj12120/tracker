import { ParsedBill } from '../pdfParser';

/**
 * Local manual parser for Amazon Delivery Challans.
 * Extracts ASIN-based line items, quantities, and pricing.
 * 
 * Known text structure from pdf-parse:
 *   "ASIN Description Unit Price Qty Net Amount"
 *   "B082479XPF Fresh Mango, Kesar, 1 kg, Buying 100.00 80 8000.00"
 *   "B0F1SJ765B Fresh Kesar 1Pc Buying (Approx. 200g) 20.00 1415 28300.00"
 *   "Total 1495 36300.00"
 */
export function parseAmazonManual(text: string): ParsedBill {
  const parsed: ParsedBill = {
    company: 'AMAZON',
    items: [],
    total_amount: 0
  };

  // Date extraction: "DD-MM-YYYY HH:MM AM/PM" → "YYYY-MM-DD"
  const dateMatch = text.match(/(\d{2}-\d{2}-\d{4})\s\d{2}:\d{2}\s[AP]M/);
  if (dateMatch) {
    const parts = dateMatch[1].split('-');
    parsed.challan_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // Challan number: 8-char alphanumeric code (exclude ASINs which start with B and are 10 chars)
  const eightChars = [...text.matchAll(/\b([A-Z0-9]{8})\b/g)].map(m => m[1]);
  const codes = eightChars.filter(c => !c.startsWith('B') || c.length !== 10);
  if (codes.length > 0) {
    parsed.challan_no = codes[0];
    parsed.po_number = codes[0];
  }

  // Line item extraction: Find each ASIN and extract numbers AFTER it (not including ASIN digits)
  const asins = [...text.matchAll(/\b(B[A-Z0-9]{9})\b/g)];
  asins.forEach((match) => {
    const asin = match[1];
    // Get text AFTER this ASIN up to the next ASIN or "Total" (to avoid bleeding into next row)
    const startPos = match.index! + asin.length;
    let afterAsin = text.slice(startPos, startPos + 500);
    // Cut off at the next ASIN (B + 9 alphanumeric chars) or "Total"
    const nextBoundary = afterAsin.search(/\bB[A-Z0-9]{9}\b|\bTotal\b/);
    if (nextBoundary > 0) {
      afterAsin = afterAsin.substring(0, nextBoundary);
    }
    
    // Extract numbers with decimals (prices like 100.00, 20.00) and integers (qty like 80, 1415)
    const lineNumbers = [...afterAsin.matchAll(/\b(\d+(?:\.\d{1,2})?)\b/g)].map(m => parseFloat(m[1]));
    
    let unit_price = 0, qty = 1, total_amount = 0;
    
    // Amazon structure after ASIN: Description... [Unit Price] [Qty] [Net Amount]
    // The description may contain numbers (e.g. "1 kg") so we take the LAST 3 numbers
    // which are always: Unit Price, Qty, Net Amount
    const meaningfulNums = lineNumbers.filter(n => n > 0);
    
    if (meaningfulNums.length >= 3) {
      // Take the last 3 numbers
      unit_price = meaningfulNums[meaningfulNums.length - 3];
      qty = meaningfulNums[meaningfulNums.length - 2];
      total_amount = meaningfulNums[meaningfulNums.length - 1];
    } else if (meaningfulNums.length === 2) {
      qty = meaningfulNums[0];
      total_amount = meaningfulNums[1];
    }

    // Determine description based on unit price
    // 1kg items: ₹100+ per unit | 200g pieces: ₹20-50 per unit
    let desc = `Amazon Item ${asin}`;
    if (unit_price >= 50) {
      desc = 'Fresh Mango, Kesar, 1 kg, Buying';
    } else if (unit_price > 0 && unit_price < 50) {
      desc = 'Fresh Kesar 1Pc Buying (Approx. 200g)';
    }

    parsed.items.push({
      asin,
      description: desc,
      qty,
      unit: 'Kg',
      unit_price,
      total_amount
    });
  });

  // Total amount: Sum of all item totals (most reliable method)
  if (parsed.items.length > 0) {
    parsed.total_amount = parsed.items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  }
  
  // Fallback: try to find "Total" line with the grand total
  if (!parsed.total_amount || parsed.total_amount === 0) {
    const totalMatch = text.match(/Total\s+[\d,]+\s+([\d,]+\.\d{2})/);
    if (totalMatch) {
      parsed.total_amount = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
  }

  // Vendor info
  if (text.includes('VIRAJ DATTATRAY DISALE')) {
    parsed.vendor_name = 'VIRAJ DATTATRAY DISALE (FARMER)';
  } else {
    parsed.vendor_name = 'Amazon Vendor';
  }

  const hardcodedAddress = 'Amazon Retail India Pvt Ltd, Gat No 533, Wai Pachwad Road, Gondhalwadi, Asale, Wai Wai - Satara Maharashtra India 415513';
  parsed.vendor_address = hardcodedAddress;
  parsed.shipping_address = hardcodedAddress;
  parsed.billing_address = hardcodedAddress;

  return parsed;
}
