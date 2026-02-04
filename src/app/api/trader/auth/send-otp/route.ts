// ============================================================================
// FILE: src/app/api/trader/auth/send-otp/route.ts
// PURPOSE: Generate and send OTP to trader's WhatsApp
// FIX: Auto-creates OTP_Sessions table, detailed error logging
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    console.log('Generated OTP (masked):', otp.substring(0, 2) + '****');
    
    // 6. Ensure OTP_Sessions table exists
    await ensureOTPTableExists();
    
    // 7. Store OTP in database
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
    
    // 8. Send OTP via WhatsApp
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
      expiresIn: 300
    });
    
  } catch (error) {
    console.error('Send OTP unexpected error:', error);
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
    
    // Try exact match first
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
      console.log('Prisma: Trader found (exact match)');
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

async function ensureOTPTableExists(): Promise<void> {
  try {
    // Check if table exists
    const tableCheck = await prisma.$queryRaw<any[]>`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'OTP_Sessions'
    `;
    
    if (!tableCheck || tableCheck.length === 0) {
      console.log('OTP_Sessions table does not exist, creating...');
      
      // Create the table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE OTP_Sessions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          phone VARCHAR(20) NOT NULL,
          otp VARCHAR(10) NOT NULL,
          expires_at DATETIME2 NOT NULL,
          trader_name NVARCHAR(100) NULL,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          verified_at DATETIME2 NULL
        )
      `);
      
      // Create index
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IX_OTP_Sessions_Phone ON OTP_Sessions (phone)
      `);
      
      console.log('OTP_Sessions table created successfully');
    } else {
      console.log('OTP_Sessions table exists');
    }
  } catch (error) {
    console.error('Error checking/creating OTP_Sessions table:', error);
    // Don't throw - try to continue anyway
  }
}

async function storeOTP(phone: string, otp: string, traderName: string): Promise<boolean> {
  try {
    // Calculate expiry (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    console.log('Storing OTP:', { 
      phone, 
      otp: '******', 
      expiresAt: expiresAt.toISOString(),
      traderName 
    });
    
    // Delete any existing OTPs for this phone
    try {
      const deleteResult = await prisma.$executeRaw`
        DELETE FROM OTP_Sessions WHERE phone = ${phone}
      `;
      console.log('Deleted existing OTPs:', deleteResult);
    } catch (deleteError) {
      console.log('No existing OTPs to delete or delete failed:', deleteError);
    }
    
    // Insert new OTP using executeRawUnsafe for better compatibility
    const insertResult = await prisma.$executeRawUnsafe(
      `INSERT INTO OTP_Sessions (phone, otp, expires_at, trader_name, created_at)
       VALUES ('${phone}', '${otp}', '${expiresAt.toISOString()}', '${traderName.replace(/'/g, "''")}', GETUTCDATE())`
    );
    
    console.log('OTP insert result:', insertResult);
    console.log('OTP stored in Azure SQL successfully');
    return true;
    
  } catch (error: any) {
    console.error('=== OTP STORE ERROR DETAILS ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.meta) {
      console.error('Error meta:', JSON.stringify(error.meta));
    }
    
    console.error('Full error:', error);
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
      sidPrefix: accountSid?.substring(0, 4)
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
    
    // Format numbers
    const toNumber = `whatsapp:+${phone}`;
    const from = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    
    // Compose message
    const messageBody = `🔐 *NaijaMarket Intel*

Hi ${firstName}! Your login code is:

*${otp}*

This code expires in 5 minutes.

If you didn't request this, please ignore.`;
    
    console.log('Sending WhatsApp message:', { to: toNumber, from });
    
    // Use Twilio REST API directly with fetch
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toNumber,
        From: from,
        Body: messageBody,
      }).toString(),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Twilio API error:', {
        status: response.status,
        code: result.code,
        message: result.message,
        moreInfo: result.more_info
      });
      return false;
    }
    
    console.log('WhatsApp message sent:', {
      sid: result.sid,
      status: result.status,
      to: toNumber
    });
    
    return true;
    
  } catch (error: any) {
    console.error('Twilio send error:', error);
    return false;
  }
}
