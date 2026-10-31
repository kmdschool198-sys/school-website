// Vercel Cron: copies new Facebook Page posts into website news once a day (see vercel.json).
// Vercel sends "Authorization: Bearer $CRON_SECRET"; other callers are refused.
import { adminDb } from '../scripts/lib/adminApp.mjs';
import { syncFacebookPosts } from '../scripts/lib/facebookPosts.mjs';

const REQUIRED = ['CRON_SECRET', 'FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_TOKEN', 'FIREBASE_SERVICE_ACCOUNT_BASE64'];

export default async function handler(req, res) {
  const missing = REQUIRED.filter(name => !process.env[name]);
  if (missing.length) return res.status(500).json({ error: `missing env: ${missing.join(', ')}` });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });

  try {
    const result = await syncFacebookPosts({
      db: adminDb(),
      pageId: process.env.FACEBOOK_PAGE_ID,
      token: process.env.FACEBOOK_PAGE_TOKEN,
      write: true,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Facebook sync failed:', err);
    return res.status(502).json({ error: String(err?.message || err) });
  }
}
