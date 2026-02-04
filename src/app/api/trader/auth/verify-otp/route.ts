import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { SignJWT } from 'jose';

const getSheets = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1n-7MXdoqvIoSHteBJaUYBmIPLjJBNtrE_jVuUxO5kr8';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'naijamarket-trader-secret-key-2026');

async function verifyOTP(phone: string, otp: string): Promise<{ valid: boolean; traderName?: string }> {
  const sheets = getSheets();
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OTP_Sessions!A:E',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { valid: false };

    const now = new Date();

    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const rowPhone = row[0];
      const rowOTP = row[1];
      const expiresAt = new Date(row[2]);
      const traderName = row[3];

      if (rowPhone === phone && rowOTP === otp) {
        if (now < expiresAt) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `OTP_Sessions!B${i + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['USED']] }
          });
          return { valid: true, traderName };
        }
        return { valid: false };
      }
    }

    return { valid: false };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { valid: false };
  }
}

async function generateToken(phone: string): Promise<string> {
  const token = await new SignJWT({ phone })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json({ error: 'Phone and OTP are required' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/^\+/, '');
    const result = await verifyOTP(normalizedPhone, otp);

    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid or expired OTP. Please try again.' }, { status: 401 });
    }

    const token = await generateToken(normalizedPhone);

    return NextResponse.json({
      success: true,
      token,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
