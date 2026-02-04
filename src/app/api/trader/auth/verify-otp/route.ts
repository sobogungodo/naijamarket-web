// ============================================================================
// FILE: src/app/api/trader/auth/verify-otp/route.ts
// PURPOSE: Verify OTP and return JWT token for trader login
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

// JWT secret - should match what's used elsewhere
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'naijamarket-trader-secret-key-2026-prod'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    console.log('=== VERIFY OTP REQUEST ===');
    console.log('Phone:', phone);
    console.log('OTP received:', otp ? otp.substring(0, 2) + '****' : 'none');

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone and OTP are required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/[\s+\-()]/g, '');
    console.log('Normalized phone:', normalizedPhone);

    // Look up the OTP in database
    console.log('Looking up OTP in database...');
    
    const otpRecords = await prisma.$queryRaw<any[]>`
      SELECT 
        otp_session_id as id,
        phone,
        otp,
        expires_at as expiresAt,
        trader_name as traderName,
        verified_at as verifiedAt
      FROM OTP_Sessions
      WHERE phone = ${normalizedPhone}
      ORDER BY created_at DESC
    `;

    console.log('OTP records found:', otpRecords?.length || 0);

    if (!otpRecords || otpRecords.length === 0) {
      console.log('No OTP found for this phone');
      return NextResponse.json(
        { error: 'No OTP found. Please request a new one.' },
        { status: 401 }
      );
    }

    const latestOTP = otpRecords[0];
    console.log('Latest OTP record:', {
      id: latestOTP.id,
      storedOTP: latestOTP.otp?.substring(0, 2) + '****',
      expiresAt: latestOTP.expiresAt,
      alreadyVerified: !!latestOTP.verifiedAt
    });

    // Check if already verified
    if (latestOTP.verifiedAt) {
      console.log('OTP already used');
      return NextResponse.json(
        { error: 'OTP already used. Please request a new one.' },
        { status: 401 }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(latestOTP.expiresAt);
    console.log('Time check:', { now: now.toISOString(), expiresAt: expiresAt.toISOString() });

    if (now > expiresAt) {
      console.log('OTP expired');
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 401 }
      );
    }

    // Verify OTP matches
    const storedOTP = String(latestOTP.otp).trim();
    const providedOTP = String(otp).trim();
    
    console.log('OTP comparison:', {
      stored: storedOTP,
      provided: providedOTP,
      match: storedOTP === providedOTP
    });

    if (storedOTP !== providedOTP) {
      console.log('OTP mismatch');
      return NextResponse.json(
        { error: 'Invalid OTP. Please check and try again.' },
        { status: 401 }
      );
    }

    // OTP is valid! Mark as verified
    console.log('OTP valid, marking as verified...');
    
    await prisma.$executeRaw`
      UPDATE OTP_Sessions 
      SET verified_at = GETUTCDATE() 
      WHERE otp_session_id = ${latestOTP.id}
    `;

    // Get trader details for the token
    const traders = await prisma.$queryRaw<any[]>`
      SELECT 
        trader_id as traderId,
        phone_number as phoneNumber,
        full_name as fullName,
        first_name as firstName,
        registration_status as registrationStatus,
        reputation,
        balance,
        assigned_markets as market,
        tier_name as tier
      FROM Traders_register
      WHERE phone_number = ${normalizedPhone}
         OR phone_number = ${'+' + normalizedPhone}
    `;

    if (!traders || traders.length === 0) {
      console.log('Trader not found for token generation');
      return NextResponse.json(
        { error: 'Trader account not found.' },
        { status: 404 }
      );
    }

    const trader = traders[0];
    console.log('Trader for token:', { name: trader.fullName, phone: trader.phoneNumber });

    // Generate JWT token (7 days expiry)
    const token = await new SignJWT({
      phone: normalizedPhone,
      traderId: trader.traderId,
      name: trader.fullName,
      role: 'trader'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    console.log('=== LOGIN SUCCESSFUL ===');

    return NextResponse.json({
      success: true,
      token,
      message: 'Login successful',
      trader: {
        name: trader.fullName,
        firstName: trader.firstName,
        phone: trader.phoneNumber,
        market: trader.market,
        reputation: trader.reputation,
        tier: trader.tier
      }
    });

  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
