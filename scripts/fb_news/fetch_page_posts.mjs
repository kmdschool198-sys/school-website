// Step 1 of the Facebook news sync (see docs/news-images-drive.md and the shared skill
// "ดึงข่าวเฟซบุ๊กเข้าเว็บโรงเรียน").
// Opens the school's Facebook page in Chrome, reads the posts that are visible without
// signing in, compares them with the posts already on the website, and for every new post
// saves its first photo to private/news-to-drive/ and its text to private/fb_new_posts.json.
// Writes nothing to Firestore.
//
// Usage: node scripts/fb_news/fetch_page_posts.mjs [--scrolls 6]
import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from '../lib/adminApp.mjs';
import { loadPlaywright } from './playwright.mjs';

const PAGE_URL = 'https://www.facebook.com/BnKhlngMddang';
const OUT_DIR = path.join(process.cwd(), 'private', 'news-to-drive');
const OUT_JSON = path.join(process.cwd(), 'private', 'fb_new_posts.json');
const scrollsArg = process.argv.indexOf('--scrolls');
const SCROLLS = scrollsArg > 0 ? Number(process.argv[scrollsArg + 1]) || 6 : 6;

// www., web. and m.facebook.com are the same post
const cleanUrl = u => (u || '').split('?')[0].replace(/\/$/, '')
  .replace(/^https?:\/\/(web|m|www)\.facebook\.com/, 'https://www.facebook.com');

const db = adminDb();
const existing = await db.collection('posts').get();
const knownUrls = new Set(existing.docs.map(d => cleanUrl(d.data().facebookUrl)).filter(Boolean));
const latest = existing.docs.map(d => d.data().date || '').sort().pop();
console.log(`website: ${existing.size} posts, latest ${latest}`);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ locale: 'th-TH', viewport: { width: 1280, height: 1600 } })).newPage();
await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
for (let i = 0; i < SCROLLS; i++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(1500); }
// open every "See more" so the full text is read
await page.evaluate(() => {
  for (const b of document.querySelectorAll('div[role=button]')) {
    if (/^(See more|ดูเพิ่มเติม)$/.test(b.textContent.trim())) b.click();
  }
});
await page.waitForTimeout(1500);

const found = await page.evaluate(() => [...document.querySelectorAll('div[aria-posinset], div[role=article]')].map(p => {
  const link = [...p.querySelectorAll('a[href*="/posts/"], a[href*="story_fbid"]')].map(a => a.href)[0] || '';
  const time = [...p.querySelectorAll('a[href*="/posts/"] span, a[aria-label]')].map(x => x.textContent).find(t => /\d{4}/.test(t)) || '';
  const lines = p.innerText.split('\n').map(s => s.trim()).filter(Boolean);
  const imgs = [...p.querySelectorAll('img')].filter(i => i.naturalWidth > 300).map(i => i.src);
  return { link, time, text: lines.join('\n'), imgs };
}).filter(x => x.link));
await browser.close();

const fresh = [];
for (const post of found) {
  const url = cleanUrl(post.link);
  if (knownUrls.has(url) || fresh.some(f => f.facebookUrl === url)) continue;
  fresh.push({ facebookUrl: url, timeText: post.time, rawText: post.text, imageCdn: post.imgs[0] || '' });
}
console.log(`facebook: ${found.length} posts visible, ${fresh.length} not on the website yet`);
if (found.length <= 1) console.log('note: logged-out Facebook often shows only the newest post; check the page by hand for older ones');

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [i, post] of fresh.entries()) {
  if (!post.imageCdn) continue;
  const file = `fb_${new Date().toISOString().slice(0, 10)}_${i + 1}.jpg`;
  const res = await fetch(post.imageCdn);
  if (res.ok) {
    fs.writeFileSync(path.join(OUT_DIR, file), Buffer.from(await res.arrayBuffer()));
    post.imageFile = file;
  }
  delete post.imageCdn; // Facebook image links expire; only the Drive copy is used
}
fs.writeFileSync(OUT_JSON, JSON.stringify(fresh, null, 1));
fresh.forEach(p => console.log(`- ${p.facebookUrl}\n  ${p.rawText.slice(0, 120).replace(/\n/g, ' ')}\n  image: ${p.imageFile || 'none'}`));
console.log(`\nsaved: ${OUT_JSON}${fresh.some(p => p.imageFile) ? `\nphotos to upload to Drive: ${OUT_DIR}` : ''}`);
process.exit(0);
