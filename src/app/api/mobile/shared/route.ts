import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// ============================================
// MOBILE SHARED API
// POST /api/mobile/shared  { action: 'markets' | 'items' | 'profile' | 'push-token' }
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

    // ========== MARKETS LIST ==========
    if (action === 'markets') {
      const markets = await query<any>(`
        SELECT market_id, market_name, state, latitude, longitude, radius_meters, opening_hours, status
        FROM dbo.Markets
        WHERE status = 'ACTIVE'
        ORDER BY state, market_name
      `);

      return NextResponse.json({
        success: true,
        data: markets,
      });
    }

    // ========== ITEMS LIST ==========
    if (action === 'items') {
      const marketId = body.market_id;

      const items = await query<any>(`
        SELECT item_id, item_name, category_id, Unit, measurement,
          whole_sale_Price, min_price, max_price, status, super_category
        FROM dbo.Items_Catalog
        WHERE super_category = 'Food' AND status = 'ACTIVE'
        ORDER BY item_name
      `);

      return NextResponse.json({
        success: true,
        data: items,
      });
    }

    // ========== PROFILE ==========
    if (action === 'profile') {
      const normalizedPhone = normalizePhone(phone || '');

      // Try trader first
      const trader = await query<any>(`
        SELECT t.trader_id AS id, t.trader_name AS name, t.phone_number AS phone,
          'trader' AS role, t.assigned_market_id AS market_id, m.market_name,
          t.reputation_score AS reputation, t.current_balance AS balance,
          t.registration_status AS status, t.created_at
        FROM dbo.Traders_register t
        LEFT JOIN dbo.Markets m ON t.assigned_market_id = m.market_id
        WHERE t.phone_number = @phone
      `, { phone: normalizedPhone });

      if (trader.length > 0) {
        return NextResponse.json({ success: true, data: trader[0] });
      }

      // Try validator
      const validator = await query<any>(`
        SELECT v.validator_id AS id, v.validator_name AS name, v.phone_number AS phone,
          'validator' AS role, v.assigned_market_id AS market_id, m.market_name,
          v.accuracy_rate AS accuracy, v.current_balance AS balance,
          v.status, v.created_at
        FROM dbo.Validators v
        LEFT JOIN dbo.Markets m ON v.assigned_market_id = m.market_id
        WHERE v.phone_number = @phone
      `, { phone: normalizedPhone });

      if (validator.length > 0) {
        return NextResponse.json({ success: true, data: validator[0] });
      }

      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // ========== UPDATE PROFILE ==========
    if (action === 'update-profile') {
      const normalizedPhone = normalizePhone(phone || '');
      const { name, market_id } = body;

      // Try trader
      const trader = await query<any>(`SELECT trader_id FROM dbo.Traders_register WHERE phone_number = @phone`, { phone: normalizedPhone });
      if (trader.length > 0) {
        await execute(`
          UPDATE dbo.Traders_register SET
            trader_name = ISNULL(@name, trader_name),
            assigned_market_id = ISNULL(@market_id, assigned_market_id)
          WHERE trader_id = @tid
        `, { name: name || null, market_id: market_id || null, tid: trader[0].trader_id });
        return NextResponse.json({ success: true, message: 'Profile updated' });
      }

      // Try validator
      const validator = await query<any>(`SELECT validator_id FROM dbo.Validators WHERE phone_number = @phone`, { phone: normalizedPhone });
      if (validator.length > 0) {
        await execute(`
          UPDATE dbo.Validators SET
            validator_name = ISNULL(@name, validator_name),
            assigned_market_id = ISNULL(@market_id, assigned_market_id)
          WHERE validator_id = @vid
        `, { name: name || null, market_id: market_id || null, vid: validator[0].validator_id });
        return NextResponse.json({ success: true, message: 'Profile updated' });
      }

      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // ========== PUSH TOKEN ==========
    if (action === 'push-token') {
      const normalizedPhone = normalizePhone(phone || '');
      const { token } = body;

      if (!token) {
        return NextResponse.json({ success: false, error: 'Push token required' }, { status: 400 });
      }

      // Store push token (try both tables)
      try {
        await execute(`
          UPDATE dbo.Traders_register SET push_token = @token WHERE phone_number = @phone
        `, { token, phone: normalizedPhone });
      } catch { /* column may not exist yet */ }

      try {
        await execute(`
          UPDATE dbo.Validators SET push_token = @token WHERE phone_number = @phone
        `, { token, phone: normalizedPhone });
      } catch { /* column may not exist yet */ }

      return NextResponse.json({ success: true, message: 'Push token registered' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Mobile Shared API] Error:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
