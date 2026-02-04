// ============================================================================
// FILE: src/app/api/trader/profile/route.ts
// PURPOSE: Get trader profile with stats
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'naijamarket-trader-secret-key-2026-prod'
);

export async function GET(request: NextRequest) {
  try {
    // Get token from header
    const authHeader = request.headers.get('authorization');
    console.log('Profile request, auth header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT
    let payload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload;
      console.log('Token verified, phone:', payload.phone);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const phone = payload.phone as string;

    // Get trader from database
    const traders = await prisma.$queryRaw<any[]>`
      SELECT 
        trader_id as traderId,
        phone_number as phoneNumber,
        full_name as fullName,
        first_name as firstName,
        registration_status as registrationStatus,
        reputation,
        balance,
        total_earned as totalEarned,
        assigned_markets as market,
        tier_name as tier
      FROM Traders_register
      WHERE phone_number = ${phone}
         OR phone_number = ${'+' + phone}
    `;

    if (!traders || traders.length === 0) {
      return NextResponse.json(
        { error: 'Trader not found' },
        { status: 404 }
      );
    }

    const trader = traders[0];

    // Get today's submission count
    let todaySubmissions = 0;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const submissionCount = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count 
        FROM Submissions 
        WHERE trader_phone = ${phone}
          AND submitted_at >= ${today}
      `;
      todaySubmissions = Number(submissionCount?.[0]?.count) || 0;
    } catch (e) {
      console.log('Could not get submission count:', e);
    }

    // Get pending balance (rewards awaiting validation)
    let pendingBalance = 0;
    try {
      const pending = await prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM Rewards_Ledger
        WHERE trader_phone = ${phone}
          AND status = 'PENDING'
      `;
      pendingBalance = Number(pending?.[0]?.total) || 0;
    } catch (e) {
      console.log('Could not get pending balance:', e);
    }

    console.log('Profile loaded successfully for:', trader.fullName);

    return NextResponse.json({
      success: true,
      trader: {
        traderId: trader.traderId,
        fullName: trader.fullName,
        firstName: trader.firstName,
        phoneNumber: trader.phoneNumber,
        market: trader.market,
        reputation: Number(trader.reputation) || 50,
        balance: Number(trader.balance) || 0,
        pendingBalance,
        totalEarned: Number(trader.totalEarned) || 0,
        tier: trader.tier || 'New',
        todaySubmissions
      }
    });

  } catch (error: any) {
    console.error('Profile error:', error);
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 }
    );
  }
}
