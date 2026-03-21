import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, hasPermission } from '@/lib/auth';
import { query, execute } from '@/lib/db';
import { AdminRole } from '@/types';

// ============================================================================
// USERS API — NaijaMarket Intel Admin
// GET    /api/users — List traders or validators with synthetic filter
// PATCH  /api/users — Update user status
// POST   /api/users — Stats summary
// DELETE /api/users — Bulk delete synthetic users
// ============================================================================

export const dynamic = 'force-dynamic';

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userType  = searchParams.get('type')   || 'traders'; // traders | validators
    const page      = parseInt(searchParams.get('page')     || '1');
    const pageSize  = parseInt(searchParams.get('pageSize') || '50');
    const search    = searchParams.get('search')  || '';
    const status    = searchParams.get('status')  || '';
    const source    = searchParams.get('source')  || 'all'; // all | real | synthetic
    const offset    = (page - 1) * pageSize;

    if (userType === 'traders') {
      // Build WHERE clause
      let where = 'WHERE 1=1';

      if (search)
        where += ` AND (t.full_name LIKE '%' + @search + '%' OR t.phone_number LIKE '%' + @search + '%')`;
      if (status && status !== 'All')
        where += ` AND t.registration_status = @status`;
      if (source === 'synthetic')
        where += ` AND t.trader_id LIKE 'SYN-TR-%'`;
      else if (source === 'real')
        where += ` AND t.trader_id NOT LIKE 'SYN-TR-%'`;

      const sql = `
        SELECT
          t.trader_id         AS id,
          t.full_name         AS name,
          t.phone_number      AS phone,
          t.assigned_market_name AS market,
          t.assigned_market_id   AS market_id,
          t.assigned_state       AS state,
          CAST(ISNULL(t.reputation, '50') AS INT) AS reputation,
          CAST(ISNULL(t.total_submissions, '0') AS INT) AS submissions,
          CAST(ISNULL(t.approved_submissions, '0') AS INT) AS approved,
          CAST(ISNULL(t.rejected_submissions, '0') AS INT) AS rejected,
          t.current_balance  AS balance,
          t.registration_status AS status,
          t.registered_at    AS createdAt,
          t.last_submission_at AS lastActive,
          CASE WHEN t.trader_id LIKE 'SYN-TR-%' THEN 1 ELSE 0 END AS isSynthetic
        FROM dbo.Traders_register t
        ${where}
        ORDER BY t.registered_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

        SELECT COUNT(*) AS total
        FROM dbo.Traders_register t
        ${where};
      `;

      const params: Record<string, unknown> = { offset, pageSize };
      if (search) params.search = search;
      if (status && status !== 'All') params.status = status;

      const rows = await query<Record<string, unknown>>(sql, params);

      // mssql returns multiple result sets — rows after the first SELECT
      // The count row has no item_id so filter by shape
      const items = rows.filter(r => 'id' in r);
      const countRow = rows.find(r => 'total' in r);
      const total = (countRow?.total as number) ?? items.length;

      return NextResponse.json({
        success: true,
        data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
        timestamp: new Date().toISOString(),
      });
    }

    // ── Validators ────────────────────────────────────────────────────────────
    let where = 'WHERE 1=1';

    if (search)
      where += ` AND (v.full_name LIKE '%' + @search + '%' OR v.phone_number LIKE '%' + @search + '%')`;
    if (status && status !== 'All')
      where += ` AND v.status = @status`;
    if (source === 'synthetic')
      where += ` AND v.validator_id LIKE 'SYN-VL-%'`;
    else if (source === 'real')
      where += ` AND v.validator_id NOT LIKE 'SYN-VL-%'`;

    const sql = `
      SELECT
        v.validator_id     AS id,
        v.full_name        AS name,
        v.phone_number     AS phone,
        v.assigned_market  AS market,
        v.market_id        AS market_id,
        v.state,
        v.tier,
        v.accuracy_rate    AS accuracy,
        v.total_votes      AS totalValidations,
        v.correct_votes    AS correctVotes,
        v.current_balance  AS balance,
        v.status,
        v.registered_at    AS createdAt,
        v.last_vote_at     AS lastActive,
        CASE WHEN v.validator_id LIKE 'SYN-VL-%' THEN 1 ELSE 0 END AS isSynthetic
      FROM dbo.Validators v
      ${where}
      ORDER BY v.registered_at DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;

      SELECT COUNT(*) AS total
      FROM dbo.Validators v
      ${where};
    `;

    const params: Record<string, unknown> = { offset, pageSize };
    if (search) params.search = search;
    if (status && status !== 'All') params.status = status;

    const rows = await query<Record<string, unknown>>(sql, params);
    const items = rows.filter(r => 'id' in r);
    const countRow = rows.find(r => 'total' in r);
    const total = (countRow?.total as number) ?? items.length;

    return NextResponse.json({
      success: true,
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[users GET]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// ── PATCH — update user status ────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const userRole = (session.user as { role?: AdminRole })?.role || 'viewer';
    if (!hasPermission(userRole, 'canTakeAction'))
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });

    const { userId, userType, action, reason } = await request.json();
    if (!userId || !userType || !action)
      return NextResponse.json({ success: false, error: 'Missing userId, userType, action' }, { status: 400 });

    const statusMap: Record<string, string> = {
      activate: 'ACTIVE',
      suspend:  'SUSPENDED',
      ban:      'BANNED',
      review:   'PENDING_REVIEW',
    };
    const newStatus = statusMap[action];
    if (!newStatus) return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    if (userType === 'trader') {
      await execute(`
        UPDATE dbo.Traders_register
        SET registration_status = @status, suspension_reason = @reason
        WHERE trader_id = @userId
      `, { userId, status: newStatus, reason: reason || '' });
    } else {
      await execute(`
        UPDATE dbo.Validators
        SET status = @status, suspension_reason = @reason
        WHERE validator_id = @userId
      `, { userId, status: newStatus, reason: reason || '' });
    }

    return NextResponse.json({ success: true, message: `User ${action}d successfully` });
  } catch (error) {
    console.error('[users PATCH]', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

// ── POST — stats summary ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { action } = await request.json();

    if (action === 'stats') {
      const today = new Date().toISOString().split('T')[0];
      const rows = await query<Record<string, unknown>>(`
        SELECT
          (SELECT COUNT(*) FROM dbo.Traders_register  WHERE trader_id    NOT LIKE 'SYN-TR-%') AS totalTraders,
          (SELECT COUNT(*) FROM dbo.Traders_register  WHERE trader_id    NOT LIKE 'SYN-TR-%' AND registration_status = 'APPROVED') AS activeTraders,
          (SELECT COUNT(*) FROM dbo.Traders_register  WHERE trader_id    NOT LIKE 'SYN-TR-%' AND CAST(registered_at AS DATE) = '${today}') AS newTradersToday,
          (SELECT COUNT(*) FROM dbo.Traders_register  WHERE trader_id    NOT LIKE 'SYN-TR-%' AND is_suspended = 1) AS suspendedTraders,
          (SELECT COUNT(*) FROM dbo.Traders_register  WHERE trader_id    LIKE 'SYN-TR-%') AS syntheticTraders,
          (SELECT COUNT(*) FROM dbo.Validators         WHERE validator_id NOT LIKE 'SYN-VL-%') AS totalValidators,
          (SELECT COUNT(*) FROM dbo.Validators         WHERE validator_id NOT LIKE 'SYN-VL-%' AND status = 'ACTIVE') AS activeValidators,
          (SELECT COUNT(*) FROM dbo.Validators         WHERE validator_id NOT LIKE 'SYN-VL-%' AND tier = 'GOLD') AS goldValidators,
          (SELECT COUNT(*) FROM dbo.Validators         WHERE validator_id NOT LIKE 'SYN-VL-%' AND CAST(registered_at AS DATE) = '${today}') AS newValidatorsToday,
          (SELECT COUNT(*) FROM dbo.Validators         WHERE validator_id LIKE 'SYN-VL-%') AS syntheticValidators,
          (SELECT ISNULL(AVG(CAST(ISNULL(reputation,'50') AS FLOAT)),0) FROM dbo.Traders_register WHERE trader_id NOT LIKE 'SYN-TR-%') AS avgTraderReputation,
          (SELECT ISNULL(AVG(CAST(accuracy_rate AS FLOAT)),0) FROM dbo.Validators WHERE validator_id NOT LIKE 'SYN-VL-%') AS avgValidatorAccuracy
      `);

      return NextResponse.json({ success: true, data: rows[0] || {}, timestamp: new Date().toISOString() });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[users POST]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user stats' }, { status: 500 });
  }
}

// ── DELETE — bulk remove synthetic users ─────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const userRole = (session.user as { role?: AdminRole })?.role || 'viewer';
    if (!hasPermission(userRole, 'canTakeAction'))
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });

    const { userType, confirm } = await request.json();

    // Require explicit confirmation flag to prevent accidental bulk delete
    if (confirm !== 'DELETE_SYNTHETIC') {
      return NextResponse.json(
        { success: false, error: 'confirm field must be "DELETE_SYNTHETIC"' },
        { status: 400 }
      );
    }

    let tradersDeleted = 0;
    let validatorsDeleted = 0;

    if (!userType || userType === 'traders') {
      // Delete synthetic votes first (FK order)
      await execute(`
        DELETE FROM dbo.Validation_Votes
        WHERE submission_id IN (
          SELECT submission_id FROM dbo.Submissions WHERE trader_id LIKE 'SYN-TR-%'
        )
      `);
      await execute(`DELETE FROM dbo.Validator_Votes WHERE validator_id LIKE 'SYN-VL-%'`);
      await execute(`DELETE FROM dbo.Submissions      WHERE trader_id   LIKE 'SYN-TR-%'`);
      const result = await query<{ cnt: number }>(`
        SELECT COUNT(*) AS cnt FROM dbo.Traders_register WHERE trader_id LIKE 'SYN-TR-%'
      `);
      tradersDeleted = result[0]?.cnt ?? 0;
      await execute(`DELETE FROM dbo.Traders_register WHERE trader_id LIKE 'SYN-TR-%'`);
    }

    if (!userType || userType === 'validators') {
      const result = await query<{ cnt: number }>(`
        SELECT COUNT(*) AS cnt FROM dbo.Validators WHERE validator_id LIKE 'SYN-VL-%'
      `);
      validatorsDeleted = result[0]?.cnt ?? 0;
      await execute(`DELETE FROM dbo.Validators WHERE validator_id LIKE 'SYN-VL-%'`);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${tradersDeleted} synthetic traders and ${validatorsDeleted} synthetic validators`,
      tradersDeleted,
      validatorsDeleted,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[users DELETE]', error);
    return NextResponse.json({ success: false, error: 'Bulk delete failed', message: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}
