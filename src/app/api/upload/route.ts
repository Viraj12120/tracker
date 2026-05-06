import { NextRequest, NextResponse } from 'next/server';
import { parseFileBuffer } from '@/lib/services/pdfParser';

// Supported MIME types and their display names
const SUPPORTED_TYPES: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Normalise: some browsers send 'image/jpg' instead of 'image/jpeg'
    const rawType = file.type || '';
    const mimeType = SUPPORTED_TYPES[rawType];

    if (!mimeType) {
      return NextResponse.json(
        { error: `Unsupported file type "${rawType}". Please upload a PDF, JPG, PNG, or WebP image.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsedData = await parseFileBuffer(buffer, mimeType);

    return NextResponse.json({
      success: true,
      data: parsedData,
      filename: file.name
    });
  } catch (error: any) {
    console.error('Error parsing upload:', error);
    return NextResponse.json({
      error: error.message || 'Failed to parse file'
    }, { status: 500 });
  }
}
