import { parseWithLLM } from './llmParser';

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

/**
 * Parse any supported bill file (PDF, JPEG, PNG, WebP) and return structured data.
 * mimeType must be a MIME string accepted by the Gemini inlineData API.
 */
export async function parseFileBuffer(
  buffer: Buffer,
  mimeType: string = 'application/pdf'
): Promise<ParsedBill> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing. AI tracking cannot proceed without an API key.');
  }

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
