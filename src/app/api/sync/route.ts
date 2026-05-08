import { NextResponse } from 'next/server';
import { syncStarBillsFromGmail } from '@/lib/services/gmailService';
import { triggerSync } from '@/lib/services/syncToProd';

export async function POST() {
  try {
    const processedCount = await syncStarBillsFromGmail();
    if (processedCount > 0) triggerSync(); // fire-and-forget: push to production Supabase
    
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
  }
}
