import { NextRequest, NextResponse } from 'next/server';
import { findTrader, storeOTP } from '@/lib/db';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendWhatsAppOTP(phone: string, otp: string, traderName: string): Promise<boolean> {
  if (!TWILIO_AUTH_TOKEN || !TWILIO_ACCOUNT_SID) {
    console.error('Twilio credentials not configured');
    return false;
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

    return response.ok;
  } catch (error) {
    console.error('Error sending WhatsApp OTP:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/^\+/, '');
    
    // Find trader in Azure SQL (primary) or Google Sheets (fallback)
    const trader = await findTrader(normalizedPhone);
    
    if (!trader) {
      return NextResponse.json({ 
        error: 'Phone number not registered as a trader. Please register on WhatsApp first.' 
      }, { status: 404 });
    }

    const otp = generateOTP();
    
    // Store OTP in Azure SQL (primary) or Google Sheets (fallback)
    const stored = await storeOTP(normalizedPhone, otp, trader.fullName);
    
    if (!stored) {
      return NextResponse.json({ error: 'Failed to generate OTP. Please try again.' }, { status: 500 });
    }

    const sent = await sendWhatsAppOTP(normalizedPhone, otp, trader.fullName);
    
    if (!sent) {
      return NextResponse.json({ 
        error: 'Failed to send OTP. Please check your WhatsApp and try again.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent to your WhatsApp',
      traderName: trader.fullName.split(' ')[0]
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
