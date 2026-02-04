import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifyOTP } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

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
    
    // Verify OTP in Azure SQL (primary) or Google Sheets (fallback)
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
