import { parseWithLLM } from './llmParser';

// Bypass pdf-parse index.js to avoid module.parent test execution bug
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export interface ParsedBill {
  company: 'STAR' | 'AMAZON';
  po_number?: string;
  vendor_code?: string;
  vendor_name?: string;
  total_amount?: number;
  
  // Header details
  grn_no?: string;
  grn_date?: string;
  plant_code?: string;
  plant_name?: string;
  delivery_note?: string;
  challan_no?: string;
  challan_date?: string;
  
  // Multiple items support
  items: any[];
  
  pdf_filename?: string;
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedBill> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing. AI tracking cannot proceed without an API key.');
  }

  try {
    const llmData = await parseWithLLM(buffer);
    return llmData as ParsedBill;
  } catch (error: any) {
    console.error('LLM Parsing failed:', error);
    throw new Error(`AI Parsing Error: ${error.message}`);
  }
}

