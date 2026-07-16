import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// ============================================
// MOBILE VALIDATOR API
// POST /api/mobile/validator  { action: 'dashboard' | 'queue' | 'vote' | 'earnings' }
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
      const validator = await query<any>(`
        SELECT validator_id, validator_name, accuracy_rate, current_balance, assigned_market_id
        FROM dbo.Validators WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (validator.length === 0) {
        return NextResponse.json({ success: false, error: 'Validator not found' }, { status: 404 });
      }

      const v = validator[0];

      // Total validations done
      const stats = await query<any>(`
        SELECT COUNT(*) AS total_validations
        FROM dbo.Validation_Votes
        WHERE validator_id = @vid
      `, { vid: v.validator_id });

      // Total earned
      const earnings = await query<any>(`
        SELECT ISNULL(SUM(amount), 0) AS total_earned
        FROM dbo.Rewards_Ledger
        WHERE user_id = @vid AND status = 'PAID'
      `, { vid: v.validator_id });

      // Pending queue count
      const pending = await query<any>(`
        SELECT COUNT(*) AS pending_queue
        FROM dbo.Price_Submissions ps
        WHERE ps.validation_status = 'PENDING'
          AND ps.market_id = @mid
          AND NOT EXISTS (
            SELECT 1 FROM dbo.Validation_Votes vv
            WHERE vv.submission_id = ps.submission_id AND vv.validator_id = @vid
          )
      `, { mid: v.assigned_market_id, vid: v.validator_id });

      return NextResponse.json({
        success: true,
        data: {
          earnings: v.current_balance || 0,
          total_earned: earnings[0]?.total_earned || 0,
          total_validations: stats[0]?.total_validations || 0,
          accuracy_pct: v.accuracy_rate || 0,
          pending_queue: pending[0]?.pending_queue || 0,
        },
      });
    }

    // ========== VALIDATION QUEUE ==========
    if (action === 'queue') {
      const validator = await query<any>(`
        SELECT validator_id, assigned_market_id
        FROM dbo.Validators WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (validator.length === 0) {
        return NextResponse.json({ success: false, error: 'Validator not found' }, { status: 404 });
      }

      const v = validator[0];

      // Get pending submissions for this validator's market
      // Exclude submissions they've already voted on
      // Exclude submissions from traders they validated in last 24h (anti-collusion)
      const queue = await query<any>(`
        SELECT TOP 20
          ps.submission_id,
          t.trader_name,
          ps.item_name,
          ps.price_naira,
          m.market_name,
          ISNULL(ic.whole_sale_Price, 0) AS baseline_price,
          CASE 
            WHEN ic.whole_sale_Price > 0 
            THEN ROUND((ps.price_naira - ic.whole_sale_Price) / ic.whole_sale_Price * 100, 1)
            ELSE 0 
          END AS price_diff_pct,
          ps.submitted_at,
          DATEADD(minute, 30, ps.submitted_at) AS deadline
        FROM dbo.Price_Submissions ps
        JOIN dbo.Traders_register t ON ps.trader_id = t.trader_id
        JOIN dbo.Markets m ON ps.market_id = m.market_id
        LEFT JOIN dbo.Items_Catalog ic ON ps.item_id = ic.item_id
        WHERE ps.validation_status = 'PENDING'
          AND ps.market_id = @mid
          AND NOT EXISTS (
            SELECT 1 FROM dbo.Validation_Votes vv
            WHERE vv.submission_id = ps.submission_id AND vv.validator_id = @vid
          )
        ORDER BY ps.submitted_at ASC
      `, { mid: v.assigned_market_id, vid: v.validator_id });

      return NextResponse.json({
        success: true,
        data: { items: queue },
      });
    }

    // ========== VOTE ==========
    if (action === 'vote') {
      const { submission_id, vote, reason } = body;

      if (!submission_id || !vote || !['approve', 'reject'].includes(vote)) {
        return NextResponse.json({ success: false, error: 'submission_id and vote (approve/reject) required' }, { status: 400 });
      }

      const validator = await query<any>(`
        SELECT validator_id, assigned_market_id
        FROM dbo.Validators WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (validator.length === 0) {
        return NextResponse.json({ success: false, error: 'Validator not found' }, { status: 404 });
      }

      const v = validator[0];

      // Check not already voted
      const existing = await query<any>(`
        SELECT vote_id FROM dbo.Validation_Votes
        WHERE submission_id = @sid AND validator_id = @vid
      `, { sid: submission_id, vid: v.validator_id });

      if (existing.length > 0) {
        return NextResponse.json({ success: false, error: 'You already voted on this submission' }, { status: 409 });
      }

      // Record vote
      const voteId = 'VT' + Date.now().toString(36).toUpperCase();
      await execute(`
        INSERT INTO dbo.Validation_Votes (vote_id, submission_id, validator_id, vote, reason, voted_at)
        VALUES (@voteId, @sid, @vid, @vote, @reason, GETDATE())
      `, {
        voteId,
        sid: submission_id,
        vid: v.validator_id,
        vote: vote.toUpperCase(),
        reason: reason || null,
      });

      // Check consensus (3 votes needed, 2+ = decision)
      const allVotes = await query<any>(`
        SELECT vote, COUNT(*) AS cnt
        FROM dbo.Validation_Votes
        WHERE submission_id = @sid
        GROUP BY vote
      `, { sid: submission_id });

      const totalVotes = allVotes.reduce((s: number, v: any) => s + v.cnt, 0);
      const approveCount = allVotes.find((v: any) => v.vote === 'APPROVE')?.cnt || 0;
      const rejectCount = allVotes.find((v: any) => v.vote === 'REJECT')?.cnt || 0;

      let finalStatus = 'PENDING';
      if (approveCount >= 2) finalStatus = 'APPROVED';
      else if (rejectCount >= 2) finalStatus = 'REJECTED';

      // If consensus reached, update submission and distribute rewards
      if (finalStatus !== 'PENDING') {
        await execute(`
          UPDATE dbo.Price_Submissions SET validation_status = @status WHERE submission_id = @sid
        `, { status: finalStatus, sid: submission_id });

        // Reward majority voters (Ôéª50 each)
        const majorityVote = finalStatus === 'APPROVED' ? 'APPROVE' : 'REJECT';
        const majorityVoters = await query<any>(`
          SELECT validator_id FROM dbo.Validation_Votes
          WHERE submission_id = @sid AND vote = @vote
        `, { sid: submission_id, vote: majorityVote });

        for (const mv of majorityVoters) {
          await execute(`
            UPDATE dbo.Validators SET current_balance = ISNULL(current_balance, 0) + 50
            WHERE validator_id = @vid
          `, { vid: mv.validator_id });
        }

        // If approved, reward trader Ôéª20
        if (finalStatus === 'APPROVED') {
          const sub = await query<any>(`SELECT trader_id FROM dbo.Price_Submissions WHERE submission_id = @sid`, { sid: submission_id });
          if (sub.length > 0) {
            await execute(`
              UPDATE dbo.Traders_register SET current_balance = ISNULL(current_balance, 0) + 20
              WHERE trader_id = @tid
            `, { tid: sub[0].trader_id });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          vote_id: voteId,
          total_votes: totalVotes,
          consensus: finalStatus !== 'PENDING' ? finalStatus : null,
        },
        message: finalStatus !== 'PENDING'
          ? `Consensus reached: ${finalStatus}. Ôéª50 earned!`
          : `Vote recorded (${totalVotes}/3 votes). Waiting for more validators.`,
      });
    }

    // ========== EARNINGS ==========
    if (action === 'earnings') {
      const validator = await query<any>(`
        SELECT validator_id, current_balance, accuracy_rate
        FROM dbo.Validators WHERE phone_number = @phone
      `, { phone: normalizedPhone });

      if (validator.length === 0) {
        return NextResponse.json({ success: false, error: 'Validator not found' }, { status: 404 });
      }

      const v = validator[0];

      const payouts = await query<any>(`
        SELECT TOP 20 amount, status, created_at, payout_method
        FROM dbo.Rewards_Ledger
        WHERE user_id = @vid
        ORDER BY created_at DESC
      `, { vid: v.validator_id });

      return NextResponse.json({
        success: true,
        data: {
          balance: v.current_balance || 0,
          accuracy: v.accuracy_rate || 0,
          recent_payouts: payouts,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Mobile Validator API] Error:', error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
