/**
 * Payouts API Route
 * GET /api/payouts - List payouts
 * POST /api/payouts/:id/retry - Retry a failed payout
 * POST /api/payouts/batch - Process batch payout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayouts, retryPayout, SHEETS_CONFIG } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const userType = searchParams.get('userType') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let payouts = await getPayouts({ status, user_type: userType });
    
    // Get total before pagination
    const total = payouts.length;
    
    // Calculate summary stats
    const stats = {
      totalPending: payouts.filter(p => p.status === 'PENDING').length,
      totalProcessing: payouts.filter(p => p.status === 'PROCESSING').length,
      totalCompleted: payouts.filter(p => p.status === 'COMPLETED').length,
      totalFailed: payouts.filter(p => p.status === 'FAILED').length,
      pendingAmount: payouts
        .filter(p => p.status === 'PENDING')
        .reduce((sum, p) => sum + p.amount, 0),
      completedAmount: payouts
        .filter(p => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.amount, 0),
      failedAmount: payouts
        .filter(p => p.status === 'FAILED')
        .reduce((sum, p) => sum + p.amount, 0),
    };
    
    // Apply pagination
    payouts = payouts.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      data: payouts,
      stats,
      config: {
        minimumBalance: SHEETS_CONFIG.PAYOUT.MINIMUM_BALANCE,
        frequencyDays: SHEETS_CONFIG.PAYOUT.FREQUENCY_DAYS,
        maxRetries: SHEETS_CONFIG.PAYOUT.MAX_RETRIES,
        paymentMethods: SHEETS_CONFIG.PAYOUT.PAYMENT_METHODS,
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Payouts API error:', error);
    
    // Return mock data if Google Sheets is not configured
    if (String(error).includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
      return NextResponse.json({
        success: true,
        data: getMockPayouts(),
        stats: {
          totalPending: 45,
          totalProcessing: 12,
          totalCompleted: 234,
          totalFailed: 8,
          pendingAmount: 156700,
          completedAmount: 2345600,
          failedAmount: 24500,
        },
        config: {
          minimumBalance: SHEETS_CONFIG.PAYOUT.MINIMUM_BALANCE,
          frequencyDays: SHEETS_CONFIG.PAYOUT.FREQUENCY_DAYS,
          maxRetries: SHEETS_CONFIG.PAYOUT.MAX_RETRIES,
          paymentMethods: SHEETS_CONFIG.PAYOUT.PAYMENT_METHODS,
        },
        pagination: { total: 20, limit: 100, offset: 0, hasMore: false },
        timestamp: new Date().toISOString(),
        mock: true,
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payouts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payoutId, payoutIds, adminId } = body;
    
    if (action === 'retry' && payoutId) {
      const success = await retryPayout(payoutId);
      return NextResponse.json({ success });
    }
    
    if (action === 'batch' && payoutIds && Array.isArray(payoutIds)) {
      // Process multiple payouts
      const results = await Promise.all(
        payoutIds.map(async (id: string) => {
          try {
            const success = await retryPayout(id);
            return { id, success };
          } catch (error) {
            return { id, success: false, error: String(error) };
          }
        })
      );
      
      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: results.length,
          succeeded: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Payout action error:', error);
    return NextResponse.json(
      { success: false, error: 'Action failed' },
      { status: 500 }
    );
  }
}

function getMockPayouts() {
  const statuses = ['PENDING', 'PENDING', 'COMPLETED', 'COMPLETED', 'FAILED', 'PROCESSING'];
  const methods = ['BANK_TRANSFER', 'AIRTIME'];
  const networks = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];
  const banks = ['GTBank', 'First Bank', 'Access Bank', 'UBA', 'Zenith Bank'];
  
  return Array.from({ length: 20 }, (_, i) => ({
    payout_id: `PAY_${4000 + i}`,
    user_id: `USR_${1000 + i}`,
    user_phone: `080${60000000 + i}`,
    user_name: `User ${i + 1}`,
    user_type: i % 3 === 0 ? 'VALIDATOR' : 'TRADER',
    amount: Math.floor(Math.random() * 10000) + 500,
    payment_method: methods[i % 2],
    bank_name: i % 2 === 0 ? banks[i % 5] : null,
    account_number: i % 2 === 0 ? `${1000000000 + i}` : null,
    network: i % 2 === 1 ? networks[i % 4] : null,
    status: statuses[i % 6],
    failure_reason: statuses[i % 6] === 'FAILED' ? 'Network timeout' : null,
    retry_count: statuses[i % 6] === 'FAILED' ? Math.floor(Math.random() * 3) : 0,
    transaction_ref: statuses[i % 6] === 'COMPLETED' ? `TXN_${Date.now()}_${i}` : null,
    created_at: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
    processed_at: statuses[i % 6] === 'COMPLETED' 
      ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() 
      : null,
  }));
}
