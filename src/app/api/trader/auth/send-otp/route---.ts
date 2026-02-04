// ============================================================================
// FILE: src/app/api/trader/auth/send-otp/route.ts
// PURPOSE: Generate and send OTP to trader's WhatsApp
// FIX: Properly uses Azure SQL, better error handling
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';

const prisma = new PrismaClient();

// Force dynamic rendering (required for POST routes)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Parse request body
    const body = await request.json();
    const { phone } = body;
    
    console.log('=== SEND OTP REQUEST ===');
    console.log('Phone received:', phone);
    
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }
    
    // 2. Normalize phone number (remove + and spaces)
    const normalizedPhone = phone.replace(/[\s+\-()]/g, '');
    console.log('Normalized phone:', normalizedPhone);
    
    // 3. Find trader in database
    console.log('Looking up trader...');
    const trader = await findTrader(normalizedPhone);
    
    if (!trader) {
      console.log('Trader NOT found for phone:', normalizedPhone);
      return NextResponse.json(
        { 
          error: 'Phone number not registered as a trader. Please register via WhatsApp first.',
          code: 'TRADER_NOT_FOUND'
        },
        { status: 404 }
      );
    }
    
    console.log('Trader found:', {
      name: trader.fullName,
      status: trader.registrationStatus,
      market: trader.market
    });
    
    // 4. Check if trader is approved
    if (trader.registrationStatus !== 'APPROVED') {
      return NextResponse.json(
        { 
          error: `Your registration is ${trader.registrationStatus}. Please wait for approval.`,
          code: 'NOT_APPROVED'
        },
        { status: 403 }
      );
    }
    
    // 5. Generate 6-digit OTP
    const otp = generateOTP();
    console.log('Generated OTP (first 2 digits):', otp.substring(0, 2) + '****');
    
    // 6. Store OTP in database
    console.log('Storing OTP in database...');
    const stored = await storeOTP(normalizedPhone, otp, trader.fullName);
    
    if (!stored) {
      console.error('Failed to store OTP in database');
      return NextResponse.json(
        { error: 'Failed to generate OTP. Please try again.' },
        { status: 500 }
      );
    }
    console.log('OTP stored successfully');
    
    // 7. Send OTP via WhatsApp
    console.log('Sending OTP via WhatsApp...');
    const sent = await sendWhatsAppOTP(normalizedPhone, otp, trader.firstName);
    
    if (!sent) {
      console.error('Failed to send WhatsApp OTP');
      return NextResponse.json(
        { 
          error: 'Failed to send OTP. Please check your WhatsApp and try again.',
          code: 'WHATSAPP_FAILED'
        },
        { status: 500 }
      );
    }
    
    const duration = Date.now() - startTime;
    console.log(`=== OTP SENT SUCCESSFULLY (${duration}ms) ===`);
    
    return NextResponse.json({
      success: true,
      message: 'OTP sent to your WhatsApp',
      traderName: trader.firstName,
      expiresIn: 300 // 5 minutes
    });
    
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function findTrader(phone: string): Promise<any | null> {
  try {
    console.log('Prisma: Looking up trader with phone:', phone);
    
    const result = await prisma.$queryRaw<any[]>`
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
      WHERE phone_number = ${phone}
    `;
    
    if (result && result.length > 0) {
      console.log('Prisma: Trader found');
      return result[0];
    }
    
    // Try with + prefix
    const phoneWithPlus = '+' + phone;
    const resultWithPlus = await prisma.$queryRaw<any[]>`
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
      WHERE phone_number = ${phoneWithPlus}
    `;
    
    if (resultWithPlus && resultWithPlus.length > 0) {
      console.log('Prisma: Trader found (with + prefix)');
      return resultWithPlus[0];
    }
    
    console.log('Prisma: Trader not found');
    return null;
    
  } catch (error) {
    console.error('Prisma findTrader error:', error);
    return null;
  }
}

async function storeOTP(phone: string, otp: string, traderName: string): Promise<boolean> {
  try {
    // Calculate expiry (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    console.log('Storing OTP:', { phone, otp: '******', expiresAt });
    
    // Delete any existing OTPs for this phone
    await prisma.$executeRaw`
      DELETE FROM OTP_Sessions WHERE phone = ${phone}
    `;
    
    // Insert new OTP
    await prisma.$executeRaw`
      INSERT INTO OTP_Sessions (phone, otp, expires_at, trader_name, created_at)
      VALUES (${phone}, ${otp}, ${expiresAt}, ${traderName}, GETUTCDATE())
    `;
    
    console.log('OTP stored in Azure SQL successfully');
    return true;
    
  } catch (error) {
    console.error('Prisma storeOTP error:', error);
    
    // Log the specific error for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return false;
  }
}

async function sendWhatsAppOTP(phone: string, otp: string, firstName: string): Promise<boolean> {
  try {
    // Check Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    
    console.log('Twilio config check:', {
      hasSid: !!accountSid,
      hasToken: !!authToken,
      hasFrom: !!fromNumber,
      sidPrefix: accountSid?.substring(0, 4),
      fromNumber: fromNumber
    });
    
    if (!accountSid || !authToken || !fromNumber) {
      console.error('Twilio credentials not configured');
      console.error('Missing:', {
        TWILIO_ACCOUNT_SID: !accountSid,
        TWILIO_AUTH_TOKEN: !authToken,
        TWILIO_WHATSAPP_NUMBER: !fromNumber
      });
      return false;
    }
    
    // Initialize Twilio client
    const client = twilio(accountSid, authToken);
    
    // Format recipient number
    const toNumber = `whatsapp:+${phone}`;
    
    // Compose message
    const message = `🔐 *NaijaMarket Intel*

Hi ${firstName}! Your login code is:

*${otp}*

This code expires in 5 minutes.

If you didn't request this, please ignore.`;
    
    console.log('Sending WhatsApp message to:', toNumber);
    
    // Send message
    const result = await client.messages.create({
      body: message,
      from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
      to: toNumber
    });
    
    console.log('WhatsApp message sent:', {
      sid: result.sid,
      status: result.status,
      to: toNumber
    });
    
    return true;
    
  } catch (error: any) {
    console.error('Twilio send error:', error);
    
    // Log specific Twilio error details
    if (error.code) {
      console.error('Twilio error code:', error.code);
      console.error('Twilio error message:', error.message);
      console.error('Twilio more info:', error.moreInfo);
    }
    
    return false;
  }
}
