import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// ============================================
// MOBILE TRADER API
// POST /api/mobile/trader  { action: 'dashboard' | 'submit' | 'submissions' | 'balance' }
// ============================================

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+234' + cleaned.slice(1);
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, phone } = body;
    const normalizedPhone = normalizePhone(phone || '');

    // ========== DASHBOARD ==========
    if (action === 'dashboard') {
      const trader = await query<any>(`
        SELECT trader_id, trader_name, reputation_score, current_balance
        FROM dbo.Traders_register WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (trader.length === 0) {
        return NextResponse.json({ success: false, error: 'Trader not found' }, { status: 404 });
      }

      const t = trader[0];

      // Get submission stats (last 30 days for speed)
      const stats = await query<any>(`
        SELECT 
          COUNT(*) AS total_submissions,
          SUM(CASE WHEN validation_status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_count,
          SUM(CASE WHEN validation_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_count,
          SUM(CASE WHEN validation_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_count
        FROM dbo.Price_Submissions
        WHERE trader_id = @tid
      `, { tid: t.trader_id });

      // Total earned
      const earnings = await query<any>(`
        SELECT ISNULL(SUM(amount), 0) AS total_earned
        FROM dbo.Rewards_Ledger
        WHERE user_id = @tid AND status = 'PAID'
      `, { tid: t.trader_id });

      // Recent submissions
      const recent = await query<any>(`
        SELECT TOP 10 
          ps.submission_id AS id, ps.item_name, ps.price_naira,
          m.market_name, ps.validation_status AS status, ps.submitted_at AS created_at
        FROM dbo.Price_Submissions ps
        LEFT JOIN dbo.Markets m ON ps.market_id = m.market_id
        WHERE ps.trader_id = @tid
        ORDER BY ps.submitted_at DESC
      `, { tid: t.trader_id });

      return NextResponse.json({
        success: true,
        data: {
          balance: t.current_balance || 0,
          total_earned: earnings[0]?.total_earned || 0,
          total_submissions: stats[0]?.total_submissions || 0,
          approved_count: stats[0]?.approved_count || 0,
          pending_count: stats[0]?.pending_count || 0,
          rejected_count: stats[0]?.rejected_count || 0,
          reputation: t.reputation_score || 50,
          recent_submissions: recent,
        },
      });
    }

    // ========== SUBMIT PRICE ==========
    if (action === 'submit') {
      const { market_id, item_id, price_naira, latitude, longitude, unit } = body;

      if (!market_id || !item_id || !price_naira || !latitude || !longitude) {
        return NextResponse.json({ success: false, error: 'market_id, item_id, price_naira, latitude, longitude required' }, { status: 400 });
      }

      // Get trader
      const trader = await query<any>(`
        SELECT trader_id, trader_name, reputation_score
        FROM dbo.Traders_register WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (trader.length === 0) {
        return NextResponse.json({ success: false, error: 'Trader not found' }, { status: 404 });
      }

      const t = trader[0];

      // Verify GPS: trader must be within 500m of market
      const market = await query<any>(`
        SELECT market_id, market_name, latitude, longitude, radius_meters
        FROM dbo.Markets WHERE market_id = @mid
      `, { mid: market_id });

      if (market.length === 0) {
        return NextResponse.json({ success: false, error: 'Market not found' }, { status: 404 });
      }

      const m = market[0];
      const distance = getDistanceMeters(latitude, longitude, m.latitude, m.longitude);
      const maxRadius = m.radius_meters || 500;

      if (distance > maxRadius) {
        return NextResponse.json({
          success: false,
          error: `You are ${Math.round(distance)}m away from ${m.market_name}. Must be within ${maxRadius}m.`,
          fraud_flag: 'GPS_TOO_FAR',
        }, { status: 403 });
      }

      // Get item info for price range check
      const item = await query<any>(`
        SELECT item_id, item_name, min_price, max_price, whole_sale_Price
        FROM dbo.Items_Catalog WHERE item_id = @iid
      `, { iid: item_id });

      // Price range check (┬▒30% of baseline)
      let priceFlag = null;
      if (item.length > 0 && item[0].whole_sale_Price) {
        const baseline = item[0].whole_sale_Price;
        const diff = Math.abs(price_naira - baseline) / baseline * 100;
        if (diff > 30) {
          priceFlag = 'PRICE_ANOMALY';
        }
      }

      // Generate submission ID
      const lastSub = await query<any>(`SELECT TOP 1 submission_id FROM dbo.Price_Submissions ORDER BY submitted_at DESC`);
      const lastNum = lastSub.length > 0 ? parseInt(lastSub[0].submission_id.replace(/[^\d]/g, '')) : 0;
      const subId = 'SUB' + String(lastNum + 1).padStart(6, '0');

      // Determine if instant approval (reputation >= 80)
      const validationStatus = (t.reputation_score || 0) >= 80 ? 'APPROVED' : 'PENDING';

      await execute(`
        INSERT INTO dbo.Price_Submissions (
          submission_id, trader_id, market_id, item_id, item_name, price_naira,
          unit, latitude, longitude, gps_distance_m, validation_status,
          fraud_flag, submitted_at
        ) VALUES (
          @subId, @tid, @mid, @iid, @iname, @price,
          @unit, @lat, @lng, @dist, @status,
          @flag, GETDATE()
        )
      `, {
        subId,
        tid: t.trader_id,
        mid: market_id,
        iid: item_id,
        iname: item.length > 0 ? item[0].item_name : item_id,
        price: price_naira,
        unit: unit || 'bag',
        lat: latitude,
        lng: longitude,
        dist: Math.round(distance),
        status: validationStatus,
        flag: priceFlag,
      });

      // If instant approval, add reward
      if (validationStatus === 'APPROVED') {
        await execute(`
          UPDATE dbo.Traders_register SET current_balance = ISNULL(current_balance, 0) + 20 WHERE trader_id = @tid
        `, { tid: t.trader_id });
      }

      return NextResponse.json({
        success: true,
        data: {
          submission_id: subId,
          status: validationStatus,
          distance_m: Math.round(distance),
          fraud_flag: priceFlag,
        },
        message: validationStatus === 'APPROVED'
          ? 'Ô£à Price approved instantly! Ôéª20 added to your balance.'
          : 'ÔÅ│ Price submitted for validation. You\'ll be notified when reviewed.',
      });
    }

    // ========== SUBMISSIONS HISTORY ==========
    if (action === 'submissions') {
      const page = parseInt(body.page) || 1;
      const pageSize = 20;
      const offset = (page - 1) * pageSize;

      const trader = await query<any>(`
        SELECT trader_id FROM dbo.Traders_register WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (trader.length === 0) {
        return NextResponse.json({ success: false, error: 'Trader not found' }, { status: 404 });
      }

      const submissions = await query<any>(`
        SELECT 
          ps.submission_id AS id, ps.item_name, ps.price_naira,
          m.market_name, ps.validation_status AS status,
          ps.submitted_at AS created_at, ps.gps_distance_m, ps.fraud_flag
        FROM dbo.Price_Submissions ps
        LEFT JOIN dbo.Markets m ON ps.market_id = m.market_id
        WHERE ps.trader_id = @tid
        ORDER BY ps.submitted_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `, { tid: trader[0].trader_id, offset, pageSize });

      return NextResponse.json({
        success: true,
        data: { submissions, page, pageSize },
      });
    }

    // ========== BALANCE ==========
    if (action === 'balance') {
      const trader = await query<any>(`
        SELECT trader_id, current_balance, reputation_score
        FROM dbo.Traders_register WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (trader.length === 0) {
        return NextResponse.json({ success: false, error: 'Trader not found' }, { status: 404 });
      }

      const t = trader[0];

      const payouts = await query<any>(`
        SELECT TOP 10 amount, status, created_at, payout_method
        FROM dbo.Rewards_Ledger
        WHERE user_id = @tid
        ORDER BY created_at DESC
      `, { tid: t.trader_id });

      return NextResponse.json({
        success: true,
        data: {
          balance: t.current_balance || 0,
          reputation: t.reputation_score || 50,
          recent_payouts: payouts,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Mobile Trader API] Error:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// Haversine distance in meters
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
