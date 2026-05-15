import { ParsedBill } from '../pdfParser';

/**
 * Local manual parser for STAR Goods Receipt Slips.
 * Uses the exact text layout produced by pdf-parse with custom pagerender.
 * 
 * Known text structure:
 *   Line N:   "0001 Fruits-Seasonal 08135020 1008907 MANGO KESAR"
 *   Line N+1: "KG"
 *   Line N+2: "R001 2162190000000 500,00  410,00 KG 100.00 50.00 41000.00 0.000 0.00 0.000 0.00"
 *   ...
 *   "Total 500,00  410,00  41000 0.00 0.00 0.00"
 */
export function parseStarManual(text: string): ParsedBill {
  const parsed: ParsedBill = {
    company: 'STAR',
    items: [],
    total_amount: 0,
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1. Extract Header Info
  const fullText = text;

  const grnMatch = fullText.match(/Goods\s+Receipt\s+Slip\s+No\s*:\s*(\d+)/i);
  if (grnMatch) parsed.grn_no = grnMatch[1];

  const dateMatch = fullText.match(/Goods\s+Receipt\s+Date\s*:\s*([\d\.]+)/i);
  if (dateMatch) {
    const parts = dateMatch[1].split('.');
    if (parts.length === 3) parsed.grn_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const vendorMatch = fullText.match(/Vendor\s*:\s*(\d+)\s*-\s*([\s\S]*?)(?:Vendor Supply|DISALE)/i);
  if (vendorMatch) {
    parsed.vendor_code = vendorMatch[1].trim();
    parsed.vendor_name = vendorMatch[2].replace(/\s+/g, ' ').trim();
  }

  const poMatch = fullText.match(/PO\s*:\s*(\d{10})/i);
  if (poMatch) parsed.po_number = poMatch[1];

  // 2. Extract Total from the "Total" line
  // Actual format: "Total 500,00  410,00  41000 0.00 0.00 0.00"
  for (const line of lines) {
    if (/^Total\b/i.test(line)) {
      const numbers = [...line.matchAll(/([\d,]+\.?\d*)/g)].map(m => m[1]);
      const cleanNums = numbers.map(n => {
        if (n.includes(',') && !n.includes('.')) return parseFloat(n.replace(/,/g, '.'));
        return parseFloat(n.replace(/,/g, ''));
      }).filter(n => n > 0);
      
      // The Cost (total) is the largest number
      // In "500,00  410,00  41000 0.00 0.00 0.00" → 500, 410, 41000
      if (cleanNums.length > 0) {
        parsed.total_amount = Math.max(...cleanNums);
      }
      break;
    }
  }

  // 3. Parse Line Items
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match item header: starts with 4-digit item number, contains 7-digit article number
    if (/^\d{4}\s/.test(line) && /\d{7}/.test(line)) {
      // Extract article number (7 digits)
      const articleMatch = line.match(/\b(\d{7})\b/);
      const article_no = articleMatch ? articleMatch[1] : '';
      
      // Extract description: text after the article number
      const descPart = line.split(/\b\d{7}\b/).pop() || '';
      const description = descPart.replace(/^\s+/, '').trim();
      
      // Extract HSN code (8 digits)
      const hsnMatch = line.match(/\b(\d{8})\b/);
      const hsn_code = hsnMatch ? hsnMatch[1] : '';

      let qty = 0, unit_price = 0, total_amount = 0, unit = 'KG', mrp = 0;
      
      // Search forward for data row (starts with R001 or similar StoLoc code)
      for (let j = 1; j <= 5 && (i + j) < lines.length; j++) {
        const dataLine = lines[i + j];
        
        // Data row pattern: starts with letter+digits (StoLoc like R001), 
        // followed by EAN (13 digits), then numbers
        if (/^[A-Z]\d{3}\s+\d{10,}/.test(dataLine)) {
          const unitMatch = dataLine.match(/\b(KG|PCS|NOS|EA|PKT)\b/i);
          if (unitMatch) unit = unitMatch[1];
          
          // Find the position of KG/PCS in the string to split before/after
          const kgIndex = dataLine.search(/\bKG\b|\bPCS\b|\bNOS\b/i);
          if (kgIndex > 0) {
            const beforeKG = dataLine.substring(0, kgIndex);
            const afterKG = dataLine.substring(kgIndex + unit.length);
            
            // Numbers before KG: StoLoc-digits, EAN, PO_Qty, Rev_Qty
            const beforeNums = [...beforeKG.matchAll(/([\d,]+\.?\d*)/g)].map(m => {
              const s = m[1];
              if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(/,/g, '.'));
              return parseFloat(s.replace(/,/g, ''));
            });
            
            // Numbers after KG: UnitCost, MRP, Cost, CGST_Rate, CGST_Amt, ...
            const afterNums = [...afterKG.matchAll(/([\d,]+\.?\d*)/g)].map(m => {
              const s = m[1];
              if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(/,/g, '.'));
              return parseFloat(s.replace(/,/g, ''));
            });
            
            // Rev_Qty is the last number before KG (after removing EAN)
            // Filter out large numbers (EAN is 13 digits)
            const qtyNums = beforeNums.filter(n => n < 1000000);
            if (qtyNums.length >= 2) {
              qty = qtyNums[qtyNums.length - 1]; // Rev Qty (last before KG)
            } else if (qtyNums.length === 1) {
              qty = qtyNums[0];
            }
            
            // After KG: UnitCost, MRP, Cost, ...
            if (afterNums.length >= 3) {
              unit_price = afterNums[0]; // Unit Cost
              mrp = afterNums[1];        // MRP
              total_amount = afterNums[2]; // Cost
            }
          }
          
          break;
        }
      }

      if (total_amount > 0 || qty > 0) {
        parsed.items.push({
          hsn_code,
          article_no,
          description: description || 'MANGO KESAR',
          qty,
          unit,
          unit_price,
          cost_per_unit: unit_price,
          total_amount,
          mrp
        });
      }
    }
  }

  // Fallback: sum items
  if (parsed.items.length > 0 && (!parsed.total_amount || parsed.total_amount === 0)) {
    parsed.total_amount = parsed.items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  }

  return parsed;
}
