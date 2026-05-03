import { NextResponse } from 'next/server';
import { syncStarBillsFromGmail } from '@/lib/services/gmailService';

let isSyncing = false;

export async function POST() {
  if (isSyncing) {
    return NextResponse.json({ 
      success: false, 
      error: 'A sync operation is already in progress. Please wait.' 
    }, { status: 429 });
  }

  isSyncing = true;
  try {
    const processedCount = await syncStarBillsFromGmail();
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully synchronized ${processedCount} new bills from Gmail.`,
      count: processedCount
    });
  } catch (error: any) {
    console.error('API Sync Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to sync emails from Gmail' 
    }, { status: 500 });
  } finally {
    isSyncing = false;
  }
}
