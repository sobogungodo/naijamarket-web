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

// ── Reporter notification on admin actions ───────────────────────────────────
// Each admin action against a reporter fires a WhatsApp + email via the WA function's
// central notify_reporter endpoint (WA_NOTIFY_URL + WA_NOTIFY_KEY). Best-effort, never
// fails the action. Templates self-heal (send returns false) until approved in Meta.
// A few actions share a template (unsuspend/activate; uncap/recap) per the design.
type NotifyCfg = {
  wa_template: string;
  subject: string;
  waParams: (first: string, extra?: string) => string[];
  html: (first: string, extra?: string) => string;
};
const NOTIFY_MAP: Record<string, NotifyCfg> = {
  approve: {
    wa_template: 'naijamarket_reporter_approved', subject: "You're approved — NaijaMarket Reporter",
    waParams: (f) => [f],
    html: (f) => `<p>Hi ${f}, your NaijaMarket Reporter account has been <b>approved</b>. Log in and choose the market you'll report from to start submitting prices and earning.</p>`,
  },
  unapprove: {
    wa_template: 'naijamarket_reporter_unapproved', subject: 'Your reporter approval is under review',
    waParams: (f) => [f],
    html: (f) => `<p>Hi ${f}, your reporter approval has been placed back under review. We'll let you know once it's re-approved.</p>`,
  },
  suspend: {
    wa_template: 'naijamarket_reporter_suspended', subject: 'Your reporter account has been suspended',
    waParams: (f) => [f],
    html: (f) => `<p>Hi ${f}, your reporter account has been <b>suspended</b> and cannot submit prices for now. Contact support if you believe this is a mistake.</p>`,
  },
  unsuspend: {
    wa_template: 'naijamarket_reporter_active', subject: 'Your reporter account is active again',
    waParams: (f) => [f],
    html: (f) => `<p>Hi ${f}, your reporter account is <b>active</b> again — you can submit prices.</p>`,
  },
  activate: {
    wa_template: 'naijamarket_reporter_active', subject: 'Your reporter account is active',
    waParams: (f) => [f],
    html: (f) => `<p>Hi ${f}, your reporter account is <b>active</b> — you can submit prices.</p>`,
  },
  ban: {
    wa_template: 'naijamarket_reporter_banned', subject: 'Your reporter account has been closed',
    waParams: (f) => [f],
    html: (f) => `<p>Hi ${f}, your reporter account has been closed.</p>`,
  },
  review: {
    wa_template: 'naijamarket_reporter_review', subject: 'Your reporter account is under review',
    waParams: (f) => [f],
    html: (f) => `<p>Hi ${f}, your reporter account is under review. We'll be in touch shortly.</p>`,
  },
  set_market: {
    wa_template: 'naijamarket_reporter_market_changed', subject: 'Your reporting market changed',
    waParams: (f, m) => [f, m || 'your market'],
    html: (f, m) => `<p>Hi ${f}, your reporting market has been set to <b>${m || 'your market'}</b>. You'll report prices from there.</p>`,
  },
  uncap_submissions: {
    wa_template: 'naijamarket_reporter_limit_changed', subject: 'Your daily submission limit changed',
    waParams: (f) => [f, 'removed'],
    html: (f) => `<p>Hi ${f}, your daily submission limit has been <b>removed</b> — you can submit without the daily cap.</p>`,
  },
  recap_submissions: {
    wa_template: 'naijamarket_reporter_limit_changed', subject: 'Your daily submission limit changed',
    waParams: (f) => [f, 'restored'],
    html: (f) => `<p>Hi ${f}, your daily submission limit has been <b>restored</b>.</p>`,
  },
};

async function notifyReporterOfAction(userId: string, action: string, extra: string | undefined, request: NextRequest) {
  const cfg = NOTIFY_MAP[action];
  if (!cfg) return; // action isn't reporter-facing
  const url = process.env.WA_NOTIFY_URL;
  const key = process.env.WA_NOTIFY_KEY;
  if (!url || !key) { console.warn('[notify] WA_NOTIFY_URL/KEY not set — skipping reporter notification'); return; }
  try {
    const rows = await query<{ phone_number: string; email: string | null; first_name: string | null; full_name: string | null }>(
      `SELECT phone_number, email, first_name, full_name FROM dbo.Traders_register WHERE trader_id = @userId`,
      { userId },
    );
    const r = rows[0];
    if (!r?.phone_number) return;
    const first = (r.first_name || (r.full_name || 'Reporter').split(' ')[0] || 'Reporter').trim();

    // Dedupe: skip if the SAME action already notified this reporter in the last ~2 minutes.
    const recent = await query<{ x: number }>(
      `SELECT TOP 1 1 AS x FROM dbo.Trader_Activity_Log
       WHERE phone_number = @phone AND event_type = 'REPORTER_NOTIFIED'
         AND event_detail LIKE @pat AND created_at > DATEADD(minute, -2, SYSUTCDATETIME())`,
      { phone: r.phone_number, pat: `%"action":"${action}"%` },
    );
    if (recent.length) { console.log('[notify] dedupe skip', action, r.phone_number); return; }

    const payload = {
      phone: r.phone_number,
      wa_template: cfg.wa_template,
      wa_params: cfg.waParams(first, extra),
      email: r.email || undefined,
      email_subject: cfg.subject,
      email_html: cfg.html(first, extra),
    };
    let waRes: unknown = null, emailRes: unknown = null;
    try {
      const resp = await fetch(`${url}?code=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (resp.ok) { const j = await resp.json().catch(() => ({})); waRes = (j as { wa?: unknown }).wa ?? null; emailRes = (j as { email?: unknown }).email ?? null; }
    } catch (e) { console.error('[notify] endpoint call failed:', e); }

    // Log the notification (also powers the dedupe window).
    try {
      await execute(
        `INSERT INTO dbo.Trader_Activity_Log (phone_number, platform, event_type, event_detail, session_token, ip_address, created_at)
         VALUES (@phone, 'ADMIN', 'REPORTER_NOTIFIED', @detail, NULL, @ip, SYSUTCDATETIME())`,
        {
          phone: r.phone_number,
          detail: JSON.stringify({ action, wa: waRes, email: emailRes, hadEmail: !!r.email }),
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        },
      );
    } catch (e) { console.error('[notify] audit failed:', e); }
  } catch (e) {
    console.error('[notify] reporter notification failed (non-fatal):', e);
  }
}

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
          ISNULL(t.reputation, 50) AS reputation,
          ISNULL(t.total_submissions, 0) AS submissions,
          ISNULL(t.approved_submissions, 0) AS approved,
          ISNULL(t.rejected_submissions, 0) AS rejected,
          t.current_balance  AS balance,
          t.registration_status AS status,
          t.registered_at    AS createdAt,
          t.last_submission_at AS lastActive,
          ISNULL(t.submission_uncapped, 0) AS uncapped,
          ISNULL(t.is_suspended, 0) AS is_suspended,
          t.suspension_reason AS suspensionReason,
          ISNULL(t.suspension_count, 0) AS suspensionCount,
          t.approved_at      AS approvedAt,
          t.email            AS email,
          t.date_of_birth    AS dob,
          t.Address          AS address,
          t.bank_name        AS bankName,
          t.account_number   AS accountNumber,
          t.bank_account_name AS bankAccountName,
          ISNULL(t.bank_account_verified, 0) AS bankVerified,
          CASE WHEN t.bvn_hash IS NULL OR t.bvn_hash = '' THEN 0 ELSE 1 END AS hasBvn,
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

    const { userId, userType, action, reason, marketId } = await request.json();
    if (!userId || !userType || !action)
      return NextResponse.json({ success: false, error: 'Missing userId, userType, action' }, { status: 400 });

    // ── Submission-cap toggle (traders only) — separate from the status actions ──
    if (action === 'uncap_submissions' || action === 'recap_submissions') {
      if (userType !== 'trader')
        return NextResponse.json({ success: false, error: 'Uncap applies to traders only' }, { status: 400 });
      const val = action === 'uncap_submissions' ? 1 : 0;
      let phone: string = userId;
      try {
        const prev = await query<{ phone_number: string }>(
          `SELECT phone_number FROM dbo.Traders_register WHERE trader_id = @userId`, { userId },
        );
        phone = prev[0]?.phone_number || userId;
      } catch (e) {
        console.error('[users PATCH][uncap] pre-read failed (non-fatal):', e);
      }
      await execute(
        `UPDATE dbo.Traders_register SET submission_uncapped = @val WHERE trader_id = @userId`,
        { userId, val },
      );
      try {
        await execute(`
          INSERT INTO dbo.Trader_Activity_Log (phone_number, platform, event_type, event_detail, session_token, ip_address, created_at)
          VALUES (@phone, 'ADMIN', @evt, @detail, NULL, @ip, SYSUTCDATETIME())
        `, {
          phone,
          evt: action === 'uncap_submissions' ? 'SUBMISSION_UNCAP' : 'SUBMISSION_RECAP',
          detail: JSON.stringify({ action, submission_uncapped: val, userId,
            adminId: (session.user as { id?: string })?.id ?? null,
            adminEmail: (session.user as { email?: string | null })?.email ?? null }),
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        });
      } catch (e) { console.error('[users PATCH][uncap audit] non-fatal:', e); }
      await notifyReporterOfAction(userId, action, undefined, request);
      return NextResponse.json({ success: true, submission_uncapped: val });
    }

    // ── Market assignment (traders only) — admin override, BYPASSES the reporter 7-day
    //    self-change cooldown. Sets the home market the reporter is locked to. ──
    if (action === 'set_market') {
      if (userType !== 'trader')
        return NextResponse.json({ success: false, error: 'set_market applies to traders only' }, { status: 400 });
      const mid = (typeof marketId === 'string' ? marketId : '').trim();
      if (!mid)
        return NextResponse.json({ success: false, error: 'marketId is required' }, { status: 400 });
      // Validate against dbo.Markets — name/state written from the authoritative row, not the client.
      const mrows = await query<{ market_id: string; market_name: string; state: string }>(
        `SELECT TOP 1 market_id, market_name, state FROM dbo.Markets WHERE market_id = @marketId`,
        { marketId: mid },
      );
      const m = mrows[0];
      if (!m)
        return NextResponse.json({ success: false, error: 'Unknown market' }, { status: 400 });
      let phone: string = userId;
      try {
        const prev = await query<{ phone_number: string }>(
          `SELECT phone_number FROM dbo.Traders_register WHERE trader_id = @userId`, { userId });
        phone = prev[0]?.phone_number || userId;
      } catch (e) { console.error('[users PATCH][set_market] pre-read failed (non-fatal):', e); }
      await execute(`
        UPDATE dbo.Traders_register
        SET assigned_market_id = @mid, assigned_market_name = @mname, assigned_state = @mstate,
            market_last_changed_at = SYSUTCDATETIME(),
            market_locked_at = COALESCE(market_locked_at, SYSUTCDATETIME())
        WHERE trader_id = @userId
      `, { userId, mid: m.market_id, mname: m.market_name, mstate: m.state });
      try {
        await execute(`
          INSERT INTO dbo.Trader_Activity_Log (phone_number, platform, event_type, event_detail, session_token, ip_address, created_at)
          VALUES (@phone, 'ADMIN', 'MARKET_SET_ADMIN', @detail, NULL, @ip, SYSUTCDATETIME())
        `, {
          phone,
          detail: JSON.stringify({ marketId: m.market_id, market_name: m.market_name, userId,
            adminId: (session.user as { id?: string })?.id ?? null,
            adminEmail: (session.user as { email?: string | null })?.email ?? null }),
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        });
      } catch (e) { console.error('[users PATCH][set_market audit] non-fatal:', e); }
      await notifyReporterOfAction(userId, 'set_market', m.market_name, request);
      return NextResponse.json({ success: true, market_id: m.market_id, market_name: m.market_name });
    }

    // Orthogonal status model:
    //   • registration_status (trader) / status (validator) = the APPROVAL lifecycle.
    //   • is_suspended (trader) = an INDEPENDENT block that does NOT change approval.
    // 'unapprove' reverts approval to PENDING_APPROVAL and leaves is_suspended alone;
    // 'suspend'/'unsuspend' flip the block and leave approval alone. These are different things.
    const VALID_ACTIONS = ['approve', 'unapprove', 'suspend', 'unsuspend', 'ban', 'review', 'activate'];
    if (!VALID_ACTIONS.includes(action))
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    // approve/unapprove govern the trader money path (Traders_register) only — never validators.
    if ((action === 'approve' || action === 'unapprove') && userType !== 'trader')
      return NextResponse.json({ success: false, error: 'approve/unapprove apply to traders only' }, { status: 400 });

    // Acting admin identity, recorded in the audit row.
    const adminId    = (session.user as { id?: string })?.id ?? null;
    const adminEmail = (session.user as { email?: string | null })?.email ?? null;

    if (userType === 'trader') {
      // registration_status change (undefined = leave the approval lifecycle untouched —
      // this is what lets 'suspend'/'unsuspend' NOT disturb an APPROVED reporter).
      const regStatusMap: Record<string, string | undefined> = {
        approve:   'APPROVED',
        unapprove: 'PENDING_APPROVAL',
        ban:       'BANNED',
        review:    'PENDING_REVIEW',
        // suspend / unsuspend / activate → undefined (approval untouched)
      };
      // is_suspended change (undefined = leave the block untouched — this is what lets
      // 'unapprove' revert approval WITHOUT suspending, and 'review' not block).
      const suspendMap: Record<string, number | undefined> = {
        approve: 0, activate: 0, unsuspend: 0,
        suspend: 1, ban: 1,
        // unapprove / review → undefined (block untouched)
      };
      const newStatus  = regStatusMap[action];   // string | undefined
      const suspendVal = suspendMap[action];      // number | undefined

      // Capture prior status BEFORE the UPDATE. Traders_register is trigger-bearing
      // (trg_Traders_register_PreventDualRole), so OUTPUT-without-INTO would throw;
      // a plain pre-SELECT is trigger-safe.
      let fromStatus: string | null = null;
      let phone: string = userId;
      try {
        const prev = await query<{ phone_number: string; registration_status: string }>(
          `SELECT phone_number, registration_status FROM dbo.Traders_register WHERE trader_id = @userId`,
          { userId }
        );
        fromStatus = prev[0]?.registration_status ?? null;
        phone      = prev[0]?.phone_number || userId;
      } catch (e) {
        console.error('[users PATCH][audit] pre-read failed (non-fatal):', e);
      }

      // Build the SET list from only the columns this action actually changes.
      const setClauses: string[] = [];
      const updParams: Record<string, unknown> = { userId };
      if (newStatus !== undefined) {
        setClauses.push('registration_status = @status');
        updParams.status = newStatus;
      }
      if (suspendVal !== undefined) {
        setClauses.push('is_suspended = @isSuspended');
        updParams.isSuspended = suspendVal;
      }
      // Admin approve notifies the reporter immediately (below), so suppress the trader_notify
      // timer's duplicate welcome by marking welcome_sent. Auto-approved reporters (no admin
      // action) still get the timer since they never hit this path. Also stamp approved_at so
      // the admin detail view shows when the reporter was approved.
      if (action === 'approve') {
        setClauses.push('welcome_sent = 1');
        setClauses.push('approved_at = SYSUTCDATETIME()');
      }
      // suspension_reason: set on suspend/ban, clear on unsuspend, otherwise leave as-is.
      if (action === 'suspend' || action === 'ban') {
        setClauses.push('suspension_reason = @reason');
        updParams.reason = reason || '';
      } else if (action === 'unsuspend') {
        setClauses.push('suspension_reason = NULL');
      }
      // Count each suspension event.
      if (action === 'suspend') {
        setClauses.push('suspension_count = ISNULL(suspension_count, 0) + 1');
      }

      if (setClauses.length > 0) {
        await execute(
          `UPDATE dbo.Traders_register SET ${setClauses.join(', ')} WHERE trader_id = @userId`,
          updParams,
        );
      }

      // [audit] admin trader status change — fire-and-forget: an audit failure must NOT
      // fail the status change. Distinctive prefix so a silent failure is greppable.
      try {
        await execute(`
          INSERT INTO dbo.Trader_Activity_Log (phone_number, platform, event_type, event_detail, session_token, ip_address, created_at)
          VALUES (@phone, 'ADMIN', 'TRADER_STATUS_CHANGED', @detail, NULL, @ip, SYSUTCDATETIME())
        `, {
          phone,
          detail: JSON.stringify({ action, fromStatus, newStatus: newStatus ?? null, isSuspended: suspendVal ?? null, adminId, adminEmail, userId, reason: reason || '' }),
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        });
      } catch (e) {
        console.error('[users PATCH][audit] trader status audit FAILED:', e);
      }

      // Notify the reporter of this status action (WA + email; best-effort, deduped).
      await notifyReporterOfAction(userId, action, undefined, request);
    } else {
      // Validators use a single `status` column (no separate is_suspended flag).
      const valStatusMap: Record<string, string | undefined> = {
        suspend:   'SUSPENDED',
        unsuspend: 'ACTIVE',
        activate:  'ACTIVE',
        ban:       'BANNED',
        review:    'PENDING_REVIEW',
      };
      const vStatus = valStatusMap[action];
      if (vStatus === undefined)
        return NextResponse.json({ success: false, error: 'Action not applicable to validators' }, { status: 400 });

      const vSet: string[] = ['status = @status'];
      const vParams: Record<string, unknown> = { userId, status: vStatus };
      if (action === 'suspend' || action === 'ban') {
        vSet.push('suspension_reason = @reason');
        vParams.reason = reason || '';
      } else if (action === 'unsuspend' || action === 'activate') {
        vSet.push('suspension_reason = NULL');
      }
      await execute(
        `UPDATE dbo.Validators SET ${vSet.join(', ')} WHERE validator_id = @userId`,
        vParams,
      );

      // [audit] log admin validator status change (fire-and-forget)
      try {
        const vr = await query<{ phone_number: string }>(
          `SELECT phone_number FROM dbo.Validators WHERE validator_id = @userId`,
          { userId }
        );
        const phone = vr[0]?.phone_number || userId;
        await execute(`
          INSERT INTO dbo.Trader_Activity_Log (phone_number, platform, event_type, event_detail, session_token, ip_address, created_at)
          VALUES (@phone, 'ADMIN', 'VALIDATOR_STATUS_CHANGED', @detail, NULL, @ip, SYSUTCDATETIME())
        `, {
          phone,
          detail: JSON.stringify({ action, newStatus: vStatus, userId, reason: reason || '' }),
          ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
        });
      } catch (e) {
        console.error('[users PATCH] validator status audit non-fatal:', e);
      }
    }

    return NextResponse.json({ success: true, message: `Action '${action}' applied successfully` });
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
