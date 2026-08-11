import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, writeAuth, linkedInStateToken } from '@/lib/linkedin';

// LinkedIn OAuth callback: validates state, exchanges the code for tokens, and stores them in
// dbo.LinkedIn_Auth. After this succeeds, the poster can post to the Company Page and self-refresh.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get('code');
  const state = sp.get('state');
  const err = sp.get('error');
  if (err) {
    return NextResponse.json({ ok: false, error: err, detail: sp.get('error_description') }, { status: 400 });
  }
  if (!code) return NextResponse.json({ ok: false, error: 'missing code' }, { status: 400 });
  if (!state || state !== linkedInStateToken()) {
    return NextResponse.json({ ok: false, error: 'bad state (CSRF check failed)' }, { status: 400 });
  }

  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${req.nextUrl.origin}/api/social/linkedin/callback`;
  const tokens = await exchangeCode(code, redirectUri);
  if (!tokens?.access_token) {
    return NextResponse.json({ ok: false, error: 'token exchange failed' }, { status: 502 });
  }

  try {
    const orgUrn = process.env.LINKEDIN_ORG_URN || null;
    await writeAuth(tokens.access_token, tokens.refresh_token ?? null, tokens.expires_in, orgUrn);
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'stored token write failed', detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    connected: true,
    expires_in_days: Math.round((tokens.expires_in || 0) / 86400),
    has_refresh_token: !!tokens.refresh_token,
    note: tokens.refresh_token
      ? 'Connected. Token will auto-refresh before expiry.'
      : 'Connected, but LinkedIn did not return a refresh token — this app may need Marketing/refresh approval; the token expires in ~60 days and must be reconnected.',
  });
}
