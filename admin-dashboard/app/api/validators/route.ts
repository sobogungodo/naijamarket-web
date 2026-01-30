/**
 * Validators API Route
 * GET /api/validators - List all validators
 * GET /api/validators?status=ACTIVE - Filter by status
 * POST /api/validators/:id/suspend - Suspend a validator
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidators, suspendUser, SHEETS_CONFIG } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const market = searchParams.get('market');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let validators = await getValidators();
    
    // Apply filters
    if (status) {
      validators = validators.filter(v => v.status === status);
    }
    if (market) {
      validators = validators.filter(v => v.market_id === market || v.market_name === market);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      validators = validators.filter(v => 
        v.full_name?.toLowerCase().includes(searchLower) ||
        v.phone_number?.includes(search) ||
        v.market_name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Get total before pagination
    const total = validators.length;
    
    // Apply pagination
    validators = validators.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      data: validators,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Validators API error:', error);
    
    // Return mock data if Google Sheets is not configured
    if (String(error).includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({
        success: true,
        data: getMockValidators(),
        pagination: { total: 10, limit: 100, offset: 0, hasMore: false },
        timestamp: new Date().toISOString(),
        mock: true,
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch validators' },
      { status: 500 }
    );
  }
}

// Suspend validator action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, validatorId, reason, adminId } = body;
    
    if (action === 'suspend') {
      const success = await suspendUser(validatorId, 'VALIDATOR', reason, adminId);
      return NextResponse.json({ success });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Validator action error:', error);
    return NextResponse.json(
      { success: false, error: 'Action failed' },
      { status: 500 }
    );
  }
}

function getMockValidators() {
  const markets = ['Mile 12 Market', 'Onitsha Main Market', 'Iddo Market', 'Ariaria Market'];
  const states = ['Lagos', 'Anambra', 'Lagos', 'Abia'];
  const tiers = ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM'];
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'SUSPENDED'];
  
  return Array.from({ length: 10 }, (_, i) => ({
    validator_id: `VAL_${1000 + i}`,
    phone_number: `080${30000000 + i}`,
    full_name: `Validator ${i + 1}`,
    market_id: `MKT_${(i % 4) + 1}`,
    market_name: markets[i % 4],
    state: states[i % 4],
    status: statuses[i % 4],
    tier: tiers[i % 4],
    total_votes: Math.floor(Math.random() * 500) + 50,
    correct_votes: Math.floor(Math.random() * 400) + 40,
    accuracy_rate: Math.round((70 + Math.random() * 25) * 10) / 10,
    avg_response_time_sec: Math.floor(Math.random() * 180) + 30,
    total_earnings: Math.floor(Math.random() * 50000) + 5000,
    pending_balance: Math.floor(Math.random() * 5000),
    registered_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    last_vote_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}
