// LinkedIn Company-Page poster + OAuth token lifecycle.
// Tokens live in dbo.LinkedIn_Auth (single row, id=1), written by the connect flow
// (/api/social/linkedin/callback). getLinkedInToken() refreshes the access token when it is
// within REFRESH_BUFFER of expiry, so posting is "set and forget" once connected.
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

const LI_OAUTH = 'https://www.linkedin.com/oauth/v2';
const LI_API = 'https://api.linkedin.com';
const LI_VERSION = process.env.LINKEDIN_API_VERSION || '202409'; // LinkedIn-Version (YYYYMM)
const REFRESH_BUFFER_MS = 5 * 86400000; // refresh when <5 days left

// CSRF state for the connect flow — deterministic HMAC of CRON_SECRET so /start and /callback agree.
export function linkedInStateToken(): string {
  return crypto.createHmac('sha256', process.env.CRON_SECRET || 'x').update('li-connect').digest('hex').slice(0, 32);
}

interface TokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: Date;
  organization_urn: string | null;
}

async function readAuth(): Promise<TokenRow | null> {
  const rows = await prisma.$queryRaw<TokenRow[]>(Prisma.sql`
    SELECT TOP 1 access_token, refresh_token, expires_at, organization_urn
    FROM dbo.LinkedIn_Auth WHERE id = 1`);
  return rows[0] ?? null;
}

// Upsert the single token row. orgUrn is only overwritten when provided.
export async function writeAuth(
  accessToken: string,
  refreshToken: string | null,
  expiresInSec: number,
  orgUrn?: string | null,
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    MERGE dbo.LinkedIn_Auth AS t
    USING (SELECT 1 AS id) AS s ON t.id = s.id
    WHEN MATCHED THEN UPDATE SET
      access_token = ${accessToken},
      refresh_token = COALESCE(${refreshToken}, t.refresh_token),
      expires_at = DATEADD(SECOND, ${expiresInSec}, SYSUTCDATETIME()),
      organization_urn = COALESCE(${orgUrn ?? null}, t.organization_urn),
      updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (id, access_token, refresh_token, expires_at, organization_urn)
      VALUES (1, ${accessToken}, ${refreshToken}, DATEADD(SECOND, ${expiresInSec}, SYSUTCDATETIME()), ${orgUrn ?? null});`);
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

// Exchange an authorization code (connect flow) for tokens.
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse | null> {
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetch(`${LI_OAUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) return null;
  return (await r.json().catch(() => null)) as TokenResponse | null;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetch(`${LI_OAUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) return null;
  return (await r.json().catch(() => null)) as TokenResponse | null;
}

// Return a valid access token + org URN, refreshing first if near expiry. null = not connected.
async function getLinkedInToken(): Promise<{ token: string; orgUrn: string | null } | null> {
  const row = await readAuth();
  if (!row) return null;
  const msLeft = new Date(row.expires_at).getTime() - Date.now();
  if (msLeft < REFRESH_BUFFER_MS && row.refresh_token) {
    const refreshed = await refreshAccessToken(row.refresh_token);
    if (refreshed?.access_token) {
      await writeAuth(refreshed.access_token, refreshed.refresh_token ?? null, refreshed.expires_in, row.organization_urn);
      return { token: refreshed.access_token, orgUrn: row.organization_urn };
    }
    // refresh failed — fall through and try the existing token (may still be valid for a few days)
  }
  return { token: row.access_token, orgUrn: row.organization_urn };
}

// Post the card image + text to the LinkedIn Company Page. No-ops cleanly until configured/connected.
export async function postToLinkedIn(cardUrl: string, text: string): Promise<unknown> {
  if (!process.env.LINKEDIN_CLIENT_ID) return { ok: false, error: 'LINKEDIN_CLIENT_ID not set' };

  let auth: { token: string; orgUrn: string | null } | null;
  try {
    auth = await getLinkedInToken();
  } catch (e) {
    return { ok: false, error: 'token store read failed: ' + (e instanceof Error ? e.message : String(e)) };
  }
  if (!auth) return { ok: false, error: 'LinkedIn not connected — visit /api/social/linkedin/start?key=<CRON_SECRET> once' };

  const orgUrn = process.env.LINKEDIN_ORG_URN || auth.orgUrn || '';
  if (!orgUrn) return { ok: false, error: 'LINKEDIN_ORG_URN not set (urn:li:organization:<id>)' };

  const token = auth.token;
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': LI_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  };

  try {
    // 1. Initialize an image upload owned by the organization.
    const initRes = await fetch(`${LI_API}/rest/images?action=initializeUpload`, {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initializeUploadRequest: { owner: orgUrn } }),
    });
    const initJson = (await initRes.json().catch(() => ({}))) as {
      value?: { uploadUrl?: string; image?: string };
      message?: string;
    };
    const uploadUrl = initJson?.value?.uploadUrl;
    const imageUrn = initJson?.value?.image;
    if (!initRes.ok || !uploadUrl || !imageUrn) {
      const hint = initRes.status === 403
        ? 'LinkedIn 403 — the app likely lacks the w_organization_social scope (Community Management API product must be approved) or is not an admin of this Organization Page.'
        : undefined;
      return { ok: false, stage: 'image-init', status: initRes.status, error: initJson?.message || 'init failed', ...(hint ? { hint } : {}) };
    }

    // 2. Upload the card bytes to the signed URL (PUT).
    const img = await fetch(cardUrl);
    if (!img.ok) return { ok: false, stage: 'card-fetch', error: `HTTP ${img.status}` };
    const buf = Buffer.from(await img.arrayBuffer());
    const up = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: buf,
    });
    if (!up.ok) return { ok: false, stage: 'image-upload', status: up.status, error: await up.text().catch(() => '') };

    // 3. Create the organization post referencing the uploaded image.
    const postRes = await fetch(`${LI_API}/rest/posts`, {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: orgUrn,
        commentary: text,
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { media: { title: 'NaijaMarket Food Prices', id: imageUrn } },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    const postId = postRes.headers.get('x-restli-id') || postRes.headers.get('x-linkedin-id') || null;
    if (!postRes.ok) {
      const pj = await postRes.json().catch(() => ({}));
      return { ok: false, stage: 'create-post', status: postRes.status, error: (pj as { message?: string })?.message || 'post failed', detail: pj };
    }
    return { ok: true, id: postId, imageUrn };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
