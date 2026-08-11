// Shared Facebook Page + Instagram poster used by the daily and weekly social jobs.
// Best-effort per platform; never throws. Returns per-platform result.
const FB_PAGE_ID = process.env.FB_PAGE_ID || '1235437569645195';   // NaijaMarket Intel Page
const IG_USER_ID = process.env.IG_USER_ID || '17841416251692661';  // @naijamarketintel
const GRAPH = 'https://graph.facebook.com/v22.0';

export interface SocialResult { fb?: unknown; ig?: unknown }

export async function postCardToSocial(cardUrl: string, caption: string): Promise<SocialResult> {
  const token = process.env.PAGE_ACCESS_TOKEN || '';
  const results: SocialResult = {};
  if (!token) {
    return { fb: { ok: false, error: 'PAGE_ACCESS_TOKEN not set' }, ig: { ok: false, error: 'PAGE_ACCESS_TOKEN not set' } };
  }

  // Facebook Page photo
  try {
    const u = new URL(`${GRAPH}/${FB_PAGE_ID}/photos`);
    u.searchParams.set('url', cardUrl);
    u.searchParams.set('caption', caption);
    u.searchParams.set('access_token', token);
    const r = await fetch(u.toString(), { method: 'POST' });
    const body = (await r.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
    const fb: Record<string, unknown> = { ok: r.ok, ...body };
    // Scope check: FB returns the deprecated-"publish_actions" error (code 200) when the token
    // lacks pages_manage_posts. Translate that into an actionable hint instead of the cryptic default.
    if (!r.ok) {
      const msg = (body?.error?.message || '').toLowerCase();
      if (body?.error?.code === 200 || msg.includes('publish_actions') || msg.includes('pages_manage_posts')) {
        fb.hint =
          'PAGE_ACCESS_TOKEN is missing the pages_manage_posts scope. Regenerate the social-poster ' +
          'system-user token (App: naijamarketintel) with pages_manage_posts + pages_read_engagement + ' +
          'pages_show_list + instagram_content_publish, then update PAGE_ACCESS_TOKEN in Vercel and redeploy.';
      }
    }
    results.fb = fb;
  } catch (e) {
    results.fb = { ok: false, error: String(e) };
  }

  // Instagram: create container → publish
  try {
    const c = new URL(`${GRAPH}/${IG_USER_ID}/media`);
    c.searchParams.set('image_url', cardUrl);
    c.searchParams.set('caption', caption);
    c.searchParams.set('access_token', token);
    const cr = await fetch(c.toString(), { method: 'POST' });
    const cj = await cr.json().catch(() => ({}));
    if (cj?.id) {
      // Poll the container until FINISHED before publishing — images are usually fast, but
      // publishing immediately can hit "media is not ready" (subcode 2207027).
      let status = '';
      for (let i = 0; i < 8; i++) {
        const s = await fetch(`${GRAPH}/${cj.id}?fields=status_code&access_token=${encodeURIComponent(token)}`);
        status = ((await s.json().catch(() => ({}))) as { status_code?: string }).status_code || '';
        if (status === 'FINISHED' || status === 'ERROR') break;
        await new Promise((r) => setTimeout(r, 2500));
      }
      const p = new URL(`${GRAPH}/${IG_USER_ID}/media_publish`);
      p.searchParams.set('creation_id', cj.id);
      p.searchParams.set('access_token', token);
      const pr = await fetch(p.toString(), { method: 'POST' });
      results.ig = { ok: pr.ok, creation_id: cj.id, container_status: status, ...(await pr.json().catch(() => ({}))) };
    } else {
      results.ig = { ok: false, error: 'no creation_id', detail: cj };
    }
  } catch (e) {
    results.ig = { ok: false, error: String(e) };
  }
  return results;
}
