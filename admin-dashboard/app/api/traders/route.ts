/**
 * Traders API Route
 * GET /api/traders - List all traders
 * POST /api/traders/:id/suspend - Suspend a trader
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTraders, suspendUser } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const market = searchParams.get('market');
    const search = searchParams.get('search');
    const minReputation = searchParams.get('minReputation');
    const maxReputation = searchParams.get('maxReputation');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let traders = await getTraders();
    
    // Apply filters
    if (status) {
      traders = traders.filter(t => t.status === status);
    }
    if (market) {
      traders = traders.filter(t => t.market_id === market || t.market_name === market);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      traders = traders.filter(t => 
        t.full_name?.toLowerCase().includes(searchLower) ||
        t.phone_number?.includes(search) ||
        t.market_name?.toLowerCase().includes(searchLower)
      );
    }
    if (minReputation) {
      traders = traders.filter(t => t.reputation_score >= parseInt(minReputation));
    }
    if (maxReputation) {
      traders = traders.filter(t => t.reputation_score <= parseInt(maxReputation));
    }
    
    // Get total before pagination
    const total = traders.length;
    
    // Apply pagination
    traders = traders.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      data: traders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Traders API error:', error);
    
    // Return mock data if Google Sheets is not configured
    if (String(error).includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({
        success: true,
        data: getMockTraders(),
        pagination: { total: 15, limit: 100, offset: 0, hasMore: false },
        timestamp: new Date().toISOString(),
        mock: true,
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch traders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, traderId, reason, adminId } = body;
    
    if (action === 'suspend') {
      const success = await suspendUser(traderId, 'TRADER', reason, adminId);
      return NextResponse.json({ success });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Trader action error:', error);
    return NextResponse.json(
      { success: false, error: 'Action failed' },
      { status: 500 }
    );
  }
}

function getMockTraders() {
  const markets = ['Mile 12 Market', 'Onitsha Main Market', 'Iddo Market', 'Ariaria Market', 'Alaba International'];
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED'];
  
  return Array.from({ length: 15 }, (_, i) => ({
    trader_id: `TRD_${2000 + i}`,
    phone_number: `080${40000000 + i}`,
    full_name: `Trader ${i + 1}`,
    market_id: `MKT_${(i % 5) + 1}`,
    market_name: markets[i % 5],
    status: statuses[i % 5],
    reputation_score: Math.floor(Math.random() * 50) + 50,
    total_submissions: Math.floor(Math.random() * 200) + 20,
    approved_submissions: Math.floor(Math.random() * 180) + 15,
    rejected_submissions: Math.floor(Math.random() * 20),
    total_earnings: Math.floor(Math.random() * 20000) + 2000,
    pending_balance: Math.floor(Math.random() * 2000),
    registered_at: new Date(Date.now() - Math.random() * 120 * 24 * 60 * 60 * 1000).toISOString(),
    last_submission_at: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}
