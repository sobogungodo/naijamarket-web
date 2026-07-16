import { NextResponse } from 'next/server';

// ============================================
// MOBILE SHARED API — DISABLED (security, fail-closed)
// ============================================
// This route was UNAUTHENTICATED and trusted a client-supplied `phone`
// (/api/mobile is in the middleware skip list, so no edge auth either). Impact:
//   - action:'profile'        — leaked any trader/validator's profile incl. balance by phone (IDOR)
//   - action:'update-profile' — UPDATE any trader/validator's name/assigned_market by phone (tampering)
//   - action:'push-token'     — UPDATE any trader/validator's push_token by phone (notification hijack)
//
// It is ORPHANED: no caller of /api/mobile/shared exists in any repo
// (naijamarket-web, nmt, nmc). Disabled alongside the sibling /api/mobile/trader and
// /api/mobile/validator routes. Fail closed pending an authenticated redesign
// (JWT/session + server-derived identity, never a client phone). Full prior
// implementation is in git history — revert to restore if a legitimate caller surfaces.
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'This endpoint is disabled.' },
    { status: 403 }
  );
}
