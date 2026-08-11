import { NextRequest, NextResponse } from 'next/server';
import { linkedInStateToken } from '@/lib/linkedin';

// One-time LinkedIn connect: redirects the operator to LinkedIn to authorize the app for the
// Company Page, then LinkedIn redirects back to /callback. Guarded by ?key=<CRON_SECRET> (this is
// a browser redirect, so we can't use a Bearer header). Visit once after the app is approved.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || '';

// Org content publishing + read.
const SCOPES = 'w_organization_social r_organization_social';

export async function GET(req: NextRequest) {
  if (!CRON_SECRET || req.nextUrl.searchParams.get('key') !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  if (!clientId) return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID not set' }, { status: 500 });

  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${req.nextUrl.origin}/api/social/linkedin/callback`;
  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', linkedInStateToken());
  return NextResponse.redirect(authUrl.toString());
}
