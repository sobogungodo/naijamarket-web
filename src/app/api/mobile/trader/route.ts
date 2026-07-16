import { NextResponse } from 'next/server';

// ============================================
// MOBILE TRADER API — DISABLED (security, fail-closed)
// ============================================
// This route was UNAUTHENTICATED and trusted a client-supplied `phone`. Anyone
// could read any trader's dashboard/balance/submissions by phone and, via
// action:'submit', INSERT rows into dbo.Price_Submissions and credit ₦20 to any
// trader's balance (Traders_register.current_balance) — an unauthenticated
// data-integrity + payout-fraud surface. The only "check" was a client-supplied
// GPS distance, which is trivially spoofable.
//
// It is ORPHANED: the trader app calls naijamarket-trader.vercel.app/api/trader/*,
// and no caller of /api/mobile/trader exists in any repo (naijamarket-web, nmt, nmc).
// /api/mobile is also in the middleware skip list, so there was no edge auth either.
//
// Failing closed pending a properly authenticated redesign (trader JWT / session +
// server-derived identity, never a client phone). The full prior implementation is
// in git history — revert this commit to restore it if a legitimate caller surfaces.
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'This endpoint is disabled.' },
    { status: 403 }
  );
}
