import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeOTP(phone: string, otp: string, traderName: string) {
  const sheets = getSheets();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OTP_Sessions!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[phone, otp, expiresAt, traderName, new Date().toISOString()]]
      }
    });
    return true;
  } catch (error) {
    console.error('Error storing OTP:', error);
    return false;
  }
}

async function sendWhatsAppOTP(phone: string, otp: string, traderName: string): Promise<boolean> {
  if (!TWILIO_AUTH_TOKEN) {
    console.error('TWILIO_AUTH_TOKEN not configured');
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

async function findTrader(phone: string) {
  const sheets = getSheets();
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Traders_register!A:Z',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return null;

    const headers = rows[0];
    const phoneIdx = headers.indexOf('phone');
    const nameIdx = headers.indexOf('full_name');
    const statusIdx = headers.indexOf('status');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[phoneIdx] === phone && row[statusIdx] === 'APPROVED') {
        return {
          phone: row[phoneIdx],
          fullName: row[nameIdx] || 'Trader',
          status: row[statusIdx]
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding trader:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/^\+/, '');
    const trader = await findTrader(normalizedPhone);
    
    if (!trader) {
      return NextResponse.json({ 
        error: 'Phone number not registered as a trader. Please register on WhatsApp first.' 
      }, { status: 404 });
    }

    const otp = generateOTP();
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
