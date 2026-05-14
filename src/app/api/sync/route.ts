import { NextResponse } from 'next/server';
import { syncStarBillsFromGmail } from '@/lib/services/gmailService';
import { triggerSync } from '@/lib/services/syncToProd';
export const maxDuration = 60; 

export async function POST() {
  try {
    const processedCount = await syncStarBillsFromGmail();
    triggerSync(); // Always trigger sync to push any local updates (Gmail or Manual) to Supabase
    
    return NextResponse.json({ 
      success: true, 
      message: `Sync complete. ${processedCount} new bills found in Gmail. Local data is being pushed to production.`,
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
