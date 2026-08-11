// Shared Facebook Page + Instagram + X/Twitter poster used by the daily and weekly social jobs.
// Best-effort per platform; never throws. Returns a per-platform result. Each platform self-heals
// (no-ops) until its own credentials are set, so this can ship inert and activate when env is added.
import { TwitterApi } from 'twitter-api-v2';

const FB_PAGE_ID = process.env.FB_PAGE_ID || '1235437569645195';   // NaijaMarket Intel Page
const IG_USER_ID = process.env.IG_USER_ID || '17841416251692661';  // @naijamarketintel
const GRAPH = 'https://graph.facebook.com/v22.0';

export interface SocialResult { fb?: unknown; ig?: unknown; tw?: unknown }

// X/Twitter caption cap. We clamp defensively; callers should pass a pre-shortened twitterText.
const TWEET_MAX = 280;

// X/Twitter: upload the card image bytes, then create a tweet with that media. Uses OAuth 1.0a
// user context (app key/secret + access token/secret) — media upload requires user context.
async function postToTwitter(cardUrl: string, text: string): Promise<unknown> {
  const appKey = process.env.TWITTER_APP_KEY || '';
  const appSecret = process.env.TWITTER_APP_SECRET || '';
  const accessToken = process.env.TWITTER_ACCESS_TOKEN || '';
  const accessSecret = process.env.TWITTER_ACCESS_SECRET || '';
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return { ok: false, error: 'TWITTER_* credentials not set' };
  }
  const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  const rw = client.readWrite;
  const body = text.length > TWEET_MAX ? text.slice(0, TWEET_MAX - 1) + '…' : text;

  // Try an image tweet first. X's Free tier blocks media upload (HTTP 402), so on failure we
  // fall back to a text-only tweet — which posts fine on Free. If the app is later upgraded to
  // Basic, the image path just starts working again (mode flips back to 'image'), no code change.
  let mediaError: string | undefined;
  try {
    const imgRes = await fetch(cardUrl);
    if (imgRes.ok) {
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const mediaId = await rw.v1.uploadMedia(buf, { mimeType: 'image/jpeg' });
      const tweet = await rw.v2.tweet({ text: body, media: { media_ids: [mediaId] } });
      return { ok: true, mode: 'image', id: tweet?.data?.id };
    }
    mediaError = `card fetch failed: HTTP ${imgRes.status}`;
  } catch (e) {
    mediaError = e instanceof Error ? e.message : String(e);
  }

  // Text-only fallback (works on Free tier). The caption already carries the site link.
  try {
    const tweet = await rw.v2.tweet({ text: body });
    const upgradeNote = /402|payment/i.test(mediaError || '')
      ? 'Image upload requires X Basic tier — posted text only. Upgrade to auto-attach the card image.'
      : 'Posted text only (image upload failed).';
    return { ok: true, mode: 'text', id: tweet?.data?.id, note: upgradeNote, mediaError };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = /215|bad authentication|401|unauthor|oauth|403|forbidden|permission/i.test(msg)
      ? 'Auth rejected. Use the OAuth 1.0a keys (Consumer Key/Secret + a generated OAuth-1.0 Access ' +
        'token/secret marked Read+Write) — NOT the OAuth 2.0 Client ID/Secret or Bearer token.'
      : undefined;
    return { ok: false, error: msg, mediaError, ...(hint ? { hint } : {}) };
  }
}

export async function postCardToSocial(
  cardUrl: string,
  caption: string,
  opts?: { twitterText?: string },
): Promise<SocialResult> {
  const results: SocialResult = {};
  const token = process.env.PAGE_ACCESS_TOKEN || '';

  if (!token) {
    results.fb = { ok: false, error: 'PAGE_ACCESS_TOKEN not set' };
    results.ig = { ok: false, error: 'PAGE_ACCESS_TOKEN not set' };
  } else {
    // Facebook Page photo. To publish AS the Page, Graph needs the PAGE-specific access token —
    // posting with a user/system-user token (even one that has pages_manage_posts) returns the
    // misleading "(#200) publish_actions ... deprecated" error. So derive the page token first.
    try {
      let pageToken = token;
      let pageTokenSource = 'provided';
      try {
        const pt = await fetch(`${GRAPH}/${FB_PAGE_ID}?fields=access_token&access_token=${encodeURIComponent(token)}`);
        const ptj = (await pt.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
        if (ptj?.access_token) { pageToken = ptj.access_token; pageTokenSource = 'derived'; }
        else if (ptj?.error) { pageTokenSource = `derive-failed: ${ptj.error.message || 'unknown'}`; }
      } catch (e) {
        pageTokenSource = `derive-error: ${String(e)}`;
      }

      const u = new URL(`${GRAPH}/${FB_PAGE_ID}/photos`);
      u.searchParams.set('url', cardUrl);
      u.searchParams.set('caption', caption);
      u.searchParams.set('access_token', pageToken);
      const r = await fetch(u.toString(), { method: 'POST' });
      const fbBody = (await r.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
      const fb: Record<string, unknown> = { ok: r.ok, pageTokenSource, ...fbBody };
      if (!r.ok) {
        const msg = (fbBody?.error?.message || '').toLowerCase();
        if (fbBody?.error?.code === 200 || msg.includes('publish_actions') || msg.includes('pages_manage_posts')) {
          fb.hint =
            pageTokenSource === 'derived'
              ? 'Posting with the derived PAGE token still failed — verify the social-poster system user has ' +
                'the NaijaMarket Intel Page assigned with content-creation access, and the token has pages_manage_posts.'
              : 'Could not derive the PAGE access token (' + pageTokenSource + '). The PAGE_ACCESS_TOKEN must be a ' +
                'system-user token with pages_show_list + pages_manage_posts and the Page assigned to that system user.';
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
  }

  // X/Twitter — independent credentials, so it runs regardless of the Meta token state.
  results.tw = await postToTwitter(cardUrl, (opts?.twitterText || caption));

  return results;
}
