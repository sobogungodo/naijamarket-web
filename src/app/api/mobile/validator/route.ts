import { NextResponse } from 'next/server';

// ============================================
// MOBILE VALIDATOR API — DISABLED (security, fail-closed)
// ============================================
// This route was UNAUTHENTICATED and trusted a client-supplied `phone`. Anyone
// could act as any validator by phone and, via action:'vote', INSERT rows into
// dbo.Validation_Votes and — by supplying 2+ validator phones to force consensus —
// flip dbo.Price_Submissions.validation_status to APPROVED/REJECTED and credit ₦50
// to each "majority voter" plus ₦20 to the trader. That is a complete unauthenticated
// reward-draining + validation-manipulation loop.
//
// It is ORPHANED: no caller of /api/mobile/validator exists in any repo
// (naijamarket-web, nmt, nmc), and /api/mobile is in the middleware skip list, so
// there was no edge auth either.
//
// Failing closed pending a properly authenticated redesign (validator JWT / session +
// server-derived identity, never a client phone). The full prior implementation is
// in git history — revert this commit to restore it if a legitimate caller surfaces.
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'This endpoint is disabled.' },
    { status: 403 }
  );
}
