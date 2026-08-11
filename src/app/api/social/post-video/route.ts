import { NextRequest, NextResponse } from 'next/server';

// Post a VIDEO to the Facebook Page (feed video) and Instagram (Reel), reusing the same
// social-poster PAGE_ACCESS_TOKEN + page-token derivation as the daily card poster
// (src/lib/socialPost.ts). CRON_SECRET-guarded. Best-effort per platform; never throws.
//
//   GET /api/social/post-video?videoUrl=<public mp4>&caption=<text>
//   Authorization: Bearer <CRON_SECRET>
//
// The video must be a PUBLIC, directly-downloadable mp4 (Meta fetches it server-side).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET || '';
const FB_PAGE_ID  = process.env.FB_PAGE_ID  || '1235437569645195';
const IG_USER_ID  = process.env.IG_USER_ID  || '17841416251692661';
const PAGE_TOKEN  = process.env.PAGE_ACCESS_TOKEN || '';
const GRAPH = 'https://graph.facebook.com/v22.0';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const videoUrl = request.nextUrl.searchParams.get('videoUrl') || '';
  const caption  = request.nextUrl.searchParams.get('caption') || '';
  const igPublishOnly = request.nextUrl.searchParams.get('creationId') || '';
  if (!PAGE_TOKEN) {
    return NextResponse.json({ error: 'PAGE_ACCESS_TOKEN not set' }, { status: 500 });
  }

  const results: { fb?: unknown; ig?: unknown } = {};

  // Publish-only mode: an earlier call created an IG container that wasn't FINISHED in time.
  // Poll it and publish — no new upload, no FB re-post.
  if (igPublishOnly) {
    try {
      let status = '';
      for (let i = 0; i < 30; i++) {
        const s = await fetch(`${GRAPH}/${igPublishOnly}?fields=status_code&access_token=${encodeURIComponent(PAGE_TOKEN)}`);
        status = ((await s.json().catch(() => ({}))) as { status_code?: string }).status_code || '';
        if (status === 'FINISHED' || status === 'ERROR') break;
        await sleep(5000);
      }
      if (status === 'FINISHED') {
        const p = new URL(`${GRAPH}/${IG_USER_ID}/media_publish`);
        p.searchParams.set('creation_id', igPublishOnly);
        p.searchParams.set('access_token', PAGE_TOKEN);
        const pr = await fetch(p.toString(), { method: 'POST' });
        results.ig = { ok: pr.ok, creation_id: igPublishOnly, container_status: status, ...(await pr.json().catch(() => ({}))) };
      } else {
        results.ig = { ok: false, creation_id: igPublishOnly, container_status: status, error: 'container not FINISHED' };
      }
    } catch (e) {
      results.ig = { ok: false, error: String(e) };
    }
    return NextResponse.json({ publishOnly: true, ...results });
  }

  if (!videoUrl) {
    return NextResponse.json({ error: 'videoUrl required' }, { status: 400 });
  }

  // ── Facebook Page feed video ──
  // Derive the PAGE-specific token first (posting AS the Page needs it; a system-user token
  // returns the misleading "(#200) publish_actions" error otherwise).
  try {
    let pageToken = PAGE_TOKEN;
    let pageTokenSource = 'provided';
    try {
      const pt = await fetch(`${GRAPH}/${FB_PAGE_ID}?fields=access_token&access_token=${encodeURIComponent(PAGE_TOKEN)}`);
      const ptj = (await pt.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
      if (ptj?.access_token) { pageToken = ptj.access_token; pageTokenSource = 'derived'; }
      else if (ptj?.error) { pageTokenSource = `derive-failed: ${ptj.error.message || 'unknown'}`; }
    } catch (e) {
      pageTokenSource = `derive-error: ${String(e)}`;
    }

    const u = new URL(`${GRAPH}/${FB_PAGE_ID}/videos`);
    u.searchParams.set('file_url', videoUrl);
    u.searchParams.set('description', caption);
    u.searchParams.set('access_token', pageToken);
    const r = await fetch(u.toString(), { method: 'POST' });
    const fbBody = await r.json().catch(() => ({}));
    results.fb = { ok: r.ok, pageTokenSource, ...fbBody };
  } catch (e) {
    results.fb = { ok: false, error: String(e) };
  }

  // ── Instagram Reel: create REELS container → poll until FINISHED → publish ──
  try {
    const c = new URL(`${GRAPH}/${IG_USER_ID}/media`);
    c.searchParams.set('media_type', 'REELS');
    c.searchParams.set('video_url', videoUrl);
    c.searchParams.set('caption', caption);
    c.searchParams.set('access_token', PAGE_TOKEN);
    const cr = await fetch(c.toString(), { method: 'POST' });
    const cj = (await cr.json().catch(() => ({}))) as { id?: string };
    if (cj?.id) {
      // Video containers take longer than images — poll up to ~2.5 min.
      let status = '';
      for (let i = 0; i < 30; i++) {
        await sleep(5000);
        const s = await fetch(`${GRAPH}/${cj.id}?fields=status_code&access_token=${encodeURIComponent(PAGE_TOKEN)}`);
        status = ((await s.json().catch(() => ({}))) as { status_code?: string }).status_code || '';
        if (status === 'FINISHED' || status === 'ERROR') break;
      }
      if (status === 'FINISHED') {
        const p = new URL(`${GRAPH}/${IG_USER_ID}/media_publish`);
        p.searchParams.set('creation_id', cj.id);
        p.searchParams.set('access_token', PAGE_TOKEN);
        const pr = await fetch(p.toString(), { method: 'POST' });
        results.ig = { ok: pr.ok, creation_id: cj.id, container_status: status, ...(await pr.json().catch(() => ({}))) };
      } else {
        results.ig = { ok: false, creation_id: cj.id, container_status: status, error: 'container not FINISHED' };
      }
    } else {
      results.ig = { ok: false, error: 'no creation_id', detail: cj };
    }
  } catch (e) {
    results.ig = { ok: false, error: String(e) };
  }

  return NextResponse.json({ posted: true, videoUrl, ...results });
}
