import { NextRequest, NextResponse } from 'next/server';
import { parsePdfBuffer } from '@/lib/services/pdfParser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // In a full implementation, we might save the file to disk here.
    // For now we'll just parse it.

    const parsedData = await parsePdfBuffer(buffer);

    return NextResponse.json({
      success: true,
      data: parsedData,
      filename: file.name
    });
  } catch (error: any) {
    console.error('Error parsing upload:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to parse PDF file' 
    }, { status: 500 });
  }
}
