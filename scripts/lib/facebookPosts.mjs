// Turn the school's Facebook Page posts into website news (collection `posts`).
// Shared by scripts/sync_facebook_posts.mjs (run by hand) and api/sync-facebook.js (Vercel cron).
// Pure functions except fetchPagePosts, so the mapping and duplicate rules are unit-tested.

export const GRAPH_VERSION = 'v21.0';
export const SYNC_CATEGORY = 'ข่าวประชาสัมพันธ์';
const TITLE_MAX = 120;

/** Latest posts published by the Page itself (needs a Page access token with pages_read_engagement) */
export async function fetchPagePosts({ pageId, token, limit = 25, fetchImpl = fetch }) {
  const params = new URLSearchParams({
    fields: 'id,message,created_time,permalink_url,full_picture',
    limit: String(limit),
    access_token: token,
  });
  const res = await fetchImpl(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/posts?${params}`);
  const body = await res.json();
  if (!res.ok || body.error) {
    const err = body.error || {};
    throw new Error(`Facebook Graph API ${res.status}: ${err.message || 'unknown error'} (code ${err.code ?? '-'})`);
  }
  return body.data || [];
}

/** created_time "2026-11-02T03:15:00+0000" -> "2026-11-02" in Thai time (UTC+7, no DST) */
export function thaiDate(createdTime) {
  const d = new Date(String(createdTime).replace(/\+0000$/, 'Z'));
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** First non-empty line of the post, cut at a word boundary when it is long */
export function titleFromMessage(message) {
  const line = String(message || '').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
  if (line.length <= TITLE_MAX) return line;
  const cut = line.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(' ');
  return `${(space > 60 ? cut.slice(0, space) : cut).trim()}…`;
}

/** Website news document for one Facebook post, or null for posts with no text (shares, cover changes) */
export function toSitePost(fbPost) {
  const title = titleFromMessage(fbPost.message);
  if (!title || !fbPost.id) return null;
  return {
    docId: `fb_${fbPost.id}`,
    data: {
      title,
      content: String(fbPost.message).trim(),
      date: thaiDate(fbPost.created_time),
      category: SYNC_CATEGORY,
      facebookUrl: fbPost.permalink_url || '',
      imageUrl: fbPost.full_picture || '',
      imageType: 'image',
      source: 'facebook',
      facebookPostId: fbPost.id,
    },
  };
}

const normalize = s => String(s || '').replace(/[\s"'“”‘’.,:;!?()\-–—]/g, '').toLowerCase();

/**
 * Post ids in a Facebook link: the pfbid or the numbers after /posts/, /photos/, /videos/ or fbid=.
 * Numbers before that (a numeric page id) are ignored, or every post of the page would match.
 */
export function postKeys(url) {
  const text = String(url || '');
  const pfbid = text.match(/pfbid\w+/g) || [];
  const marker = text.search(/\/(posts|photos|videos|permalink)\/|fbid=/);
  const numbers = marker < 0 ? [] : text.slice(marker).match(/\d{6,}/g) || [];
  return [...pfbid, ...numbers];
}

/** Graph post id "pageId_postId" -> "postId" */
const graphPostKey = id => String(id || '').split('_').pop();

/**
 * True when the website already has this post: synced before, or typed in by a teacher.
 * Teachers paste many link formats, so besides the link ids we also accept a news item
 * from within a day whose title is the start of the Facebook text.
 */
export function isAlreadyOnSite(candidate, existingPosts) {
  const keys = new Set([graphPostKey(candidate.data.facebookPostId), ...postKeys(candidate.data.facebookUrl)]);
  const message = normalize(candidate.data.content);
  const day = Date.parse(candidate.data.date);
  return existingPosts.some(p => {
    if (p.id === candidate.docId) return true;
    if (postKeys(p.facebookUrl).some(k => keys.has(k))) return true;
    const title = normalize(p.title).slice(0, 25);
    const near = Math.abs(Date.parse(p.date) - day) <= 24 * 3600 * 1000;
    return near && title.length >= 8 && message.includes(title);
  });
}

/** Facebook posts that should become new website news, oldest first */
export function newSitePosts(fbPosts, existingPosts) {
  return fbPosts
    .map(toSitePost)
    .filter(Boolean)
    .filter(c => !isAlreadyOnSite(c, existingPosts))
    .sort((a, b) => a.data.date.localeCompare(b.data.date));
}

/**
 * Add new Facebook posts to `posts` and refresh the photo links of posts synced before
 * (Facebook photo links expire after a few weeks). Never deletes or overwrites a teacher's news.
 * With write=false nothing is written; the result shows what would happen.
 */
export async function syncFacebookPosts({ db, pageId, token, write = false, fetchImpl = fetch }) {
  const fbPosts = await fetchPagePosts({ pageId, token, fetchImpl });
  const snap = await db.collection('posts').get();
  const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const added = newSitePosts(fbPosts, existing);
  const freshImages = new Map(fbPosts.map(p => [`fb_${p.id}`, p.full_picture || '']));
  const refreshed = existing.filter(p => p.source === 'facebook' && freshImages.get(p.id) && freshImages.get(p.id) !== p.imageUrl);

  if (write) {
    const now = Date.now();
    for (const post of added) {
      await db.collection('posts').doc(post.docId).create({ ...post.data, syncedAt: now }); // create() fails rather than overwrite
    }
    for (const post of refreshed) {
      await db.collection('posts').doc(post.id).update({ imageUrl: freshImages.get(post.id), syncedAt: now });
    }
  }
  return {
    fetched: fbPosts.length,
    added: added.map(p => ({ id: p.docId, date: p.data.date, title: p.data.title })),
    imagesRefreshed: refreshed.length,
    written: write,
  };
}
