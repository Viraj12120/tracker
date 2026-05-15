import { parseWithLLM } from './llmParser';
import { parseAmazonManual } from './parsers/amazonParser';
import { parseStarManual } from './parsers/starParser';

export interface ParsedBill {
  company: 'STAR' | 'AMAZON' | 'ZEPTO';

  // Common identifiers
  po_number?: string;
  vendor_code?: string;
  vendor_name?: string;
  vendor_address?: string;
  billing_address?: string;
  shipping_address?: string;
  currency?: string;
  company_pan?: string;
  gstn?: string;
  total_amount?: number;
  vendor_inv_no?: string;
  header_text?: string;
  supply_state?: string;
  movement_type?: string;

  // STAR fields
  grn_no?: string;
  grn_date?: string;
  current_date?: string;
  plant_code?: string;
  plant_name?: string;
  plant_description?: string;
  delivery_note?: string;

  // AMAZON / ZEPTO fields
  challan_no?: string;
  challan_date?: string;
  challan_version?: string;

  // Multiple items support
  items: any[];

  pdf_filename?: string;
}

import pdfParse from 'pdf-parse';

/**
 * Custom pagerender function for pdf-parse.
 * Groups text items by their Y-coordinate to preserve row structure.
 */
async function customPageRender(pageData: any): Promise<string> {
  const textContent = await pageData.getTextContent({ normalizeWhitespace: true });
  let lastY: number | undefined, text = '';
  for (let item of textContent.items) {
    if (lastY == item.transform[5] || !lastY) {
      text += item.str + ' ';
    } else {
      text += '\n' + item.str + ' ';
    }
    lastY = item.transform[5];
  }
  return text;
}

/**
 * Parse any supported bill file (PDF, JPEG, PNG, WebP) and return structured data.
 * 
 * Routing:
 *   - AMAZON  → Local parser (Fast-Path)
 *   - STAR    → Local parser (Fast-Path)
 *   - ZEPTO   → AI parser (Gemini LLM)
 *   - Unknown → AI parser (Gemini LLM)
 */
export async function parseFileBuffer(
  buffer: Buffer,
  mimeType: string = 'application/pdf'
): Promise<ParsedBill> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing. AI tracking cannot proceed without an API key.');
  }

  // 1. For PDFs, try LOCAL extraction and detection first (Fast-Path)
  if (mimeType === 'application/pdf') {
    try {
      console.log('Attempting local PDF extraction...');
      const pdfData = await pdfParse(buffer, { pagerender: customPageRender });
      const text = pdfData.text;

      // AMAZON — Local Fast-Path
      if (text.includes('Amazon Retail India Pvt Ltd') || text.includes('Delivery Challan') || text.includes('ASIN')) {
        console.log('[Fast-Path] Detected Amazon Challan. Parsing locally...');
        return parseAmazonManual(text);
      }

      // STAR — Local Fast-Path
      if (text.includes('Goods Receipt Slip') || text.includes('Trent Hypermarket') || text.includes('TRENT LIMITED')) {
        console.log('[Fast-Path] Detected STAR Goods Receipt. Parsing locally...');
        return parseStarManual(text);
      }

      console.log('No local fast-path detected, proceeding to AI.');
    } catch (localError) {
      console.warn('Local extraction failed:', localError);
    }
  }

  // 2. AI Parsing (Gemini) — Primary for Zepto and unknown formats
  try {
    const llmData = await parseWithLLM(buffer, mimeType);
    return llmData as ParsedBill;
  } catch (error: any) {
    console.error('LLM Parsing failed:', error);
    throw new Error(`AI Parsing Error: ${error.message}`);
  }
}

/**
 * @deprecated Use parseFileBuffer instead. Kept for backwards compatibility with gmailService.
 */
export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedBill> {
  return parseFileBuffer(buffer, 'application/pdf');
}
