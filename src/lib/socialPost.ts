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
    results.fb = { ok: r.ok, ...(await r.json().catch(() => ({}))) };
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
      const p = new URL(`${GRAPH}/${IG_USER_ID}/media_publish`);
      p.searchParams.set('creation_id', cj.id);
      p.searchParams.set('access_token', token);
      const pr = await fetch(p.toString(), { method: 'POST' });
      results.ig = { ok: pr.ok, creation_id: cj.id, ...(await pr.json().catch(() => ({}))) };
    } else {
      results.ig = { ok: false, error: 'no creation_id', detail: cj };
    }
  } catch (e) {
    results.ig = { ok: false, error: String(e) };
  }
  return results;
}
