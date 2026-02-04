import { NextRequest, NextResponse } from 'next/server';
import { findTrader, storeOTP } from '@/lib/db';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendWhatsAppOTP(phone: string, otp: string, traderName: string): Promise<{ success: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Twilio credentials not configured - SID:', !!TWILIO_ACCOUNT_SID, 'TOKEN:', !!TWILIO_AUTH_TOKEN);
    return { success: false, error: 'Twilio credentials not configured' };
  }

  const message = `🔐 *NaijaMarket Intel*\n\nHi ${traderName}!\n\nYour login code is: *${otp}*\n\nThis code expires in 5 minutes.\n\n⚠️ Do not share this code with anyone.`;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_NUMBER,
          To: `whatsapp:+${phone}`,
          Body: message
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Twilio API error:', response.status, errorData);
      return { success: false, error: `Twilio error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending WhatsApp OTP:', error);
    return { success: false, error: (error as Error).message };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    console.log('Send OTP request for phone:', phone);

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Normalize phone - remove + and any spaces
    const normalizedPhone = phone.replace(/^\+/, '').replace(/\s/g, '');
    console.log('Normalized phone:', normalizedPhone);
    
    // Find trader in Azure SQL (primary) or Google Sheets (fallback)
    let trader;
    try {
      trader = await findTrader(normalizedPhone);
      console.log('Trader lookup result:', trader ? 'Found' : 'Not found', trader?.fullName);
    } catch (dbError) {
      console.error('Database error finding trader:', dbError);
      return NextResponse.json({ 
        error: 'Database connection error. Please try again.',
      }, { status: 500 });
    }
    
    if (!trader) {
      return NextResponse.json({ 
        error: 'Phone number not registered as a trader. Please register on WhatsApp first.' 
      }, { status: 404 });
    }

    const otp = generateOTP();
    console.log('Generated OTP for', trader.fullName);
    
    // Store OTP in Azure SQL (primary) or Google Sheets (fallback)
    let stored = false;
    try {
      stored = await storeOTP(normalizedPhone, otp, trader.fullName || 'Trader');
      console.log('OTP stored:', stored);
    } catch (storeError) {
      console.error('Error storing OTP:', storeError);
      return NextResponse.json({ 
        error: 'Failed to generate OTP. Database error.',
      }, { status: 500 });
    }
    
    if (!stored) {
      return NextResponse.json({ 
        error: 'Failed to generate OTP. Please try again.' 
      }, { status: 500 });
    }

    // Send OTP via WhatsApp
    const sendResult = await sendWhatsAppOTP(normalizedPhone, otp, trader.fullName || 'Trader');
    
    if (!sendResult.success) {
      console.error('Failed to send WhatsApp OTP:', sendResult.error);
      return NextResponse.json({ 
        error: 'Failed to send OTP to WhatsApp. Please try again.',
      }, { status: 500 });
    }

    console.log('OTP sent successfully to', normalizedPhone);

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent to your WhatsApp',
      traderName: (trader.fullName || 'Trader').split(' ')[0]
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ 
      error: 'Internal server error. Please try again.',
    }, { status: 500 });
  }
}
