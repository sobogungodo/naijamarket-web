import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { findTrader, checkDuplicate, submitPrice, createReward, getItems } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.phone as string;
  } catch {
    return null;
  }
}

function generateSubmissionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `SUB-${timestamp}-${random}`.toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const tokenPhone = await verifyToken(token);
    if (!tokenPhone) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, marketId, categoryId, itemId, brandId, price, unitId, gpsLat, gpsLng } = body;

    if (phone !== tokenPhone) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!marketId || !itemId || !price || !unitId || gpsLat === undefined || gpsLng === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get trader details from Azure SQL (primary) or Google Sheets (fallback)
    const trader = await findTrader(phone);
    if (!trader) {
      return NextResponse.json({ error: 'Trader not found' }, { status: 404 });
    }

    if (trader.marketId !== marketId) {
      return NextResponse.json({ error: 'You can only submit prices for your assigned market' }, { status: 403 });
    }

    // Check for duplicate submission
    const isDuplicate = await checkDuplicate(marketId, itemId);
    if (isDuplicate) {
      return NextResponse.json({ error: 'Price already approved for this item today' }, { status: 409 });
    }

    // Get item details
    const items = await getItems(categoryId);
    const item = items.find(i => i.id === itemId);
    const itemName = item?.name || 'Unknown Item';

    const isInstantApproval = trader.reputation >= 80;
    const status = isInstantApproval ? 'APPROVED' : 'PENDING_VALIDATION';
    const submissionId = generateSubmissionId();

    // Submit price to Azure SQL (primary) or Google Sheets (fallback)
    const submitted = await submitPrice({
      submissionId,
      traderId: trader.traderId || phone,
      phone,
      traderName: trader.fullName,
      marketId: trader.marketId,
      marketName: trader.marketName,
      categoryId: categoryId || '',
      itemId,
      itemName,
      brandId: brandId || 'generic',
      price,
      unitId,
      gpsLat,
      gpsLng,
      status,
      reputation: trader.reputation
    });

    if (!submitted) {
      return NextResponse.json({ error: 'Failed to submit price' }, { status: 500 });
    }

    // Create reward if instant approval
    if (isInstantApproval) {
      await createReward({
        rewardId: `RWD-${Date.now().toString(36)}`.toUpperCase(),
        phone,
        role: 'TRADER',
        type: 'SUBMISSION',
        referenceId: submissionId,
        amount: 200,
        status: 'APPROVED'
      });
    }

    return NextResponse.json({
      success: true,
      submissionId,
      status,
      isInstantApproval,
      message: isInstantApproval 
        ? 'Price submitted and instantly approved! ₦200 added to your balance.'
        : 'Price submitted for validation. You\'ll earn ₦200 when approved.'
    });

  } catch (error) {
    console.error('Submit price error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
