// Step 4 of the Facebook news sync: add the posts in private/fb_new_posts.json to the website
// news (Firestore "posts"). Each entry needs title, date (YYYY-MM-DD) and content, written by
// the AI from rawText; imageUrl must be a Google Drive link (never a Facebook or /news/ link).
// Posts whose facebookUrl is already on the website are skipped. Dry run unless --write.
//
// Usage: node scripts/fb_news/add_posts.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from '../lib/adminApp.mjs';

const WRITE = process.argv.includes('--write');
const JSON_FILE = path.join(process.cwd(), 'private', 'fb_new_posts.json');
const posts = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
const db = adminDb();
const existing = await db.collection('posts').get();
// www., web. and m.facebook.com are the same post
const cleanUrl = u => (u || '').split('?')[0].replace(/\/$/, '')
  .replace(/^https?:\/\/(web|m|www)\.facebook\.com/, 'https://www.facebook.com');
const known = new Set(existing.docs.map(d => cleanUrl(d.data().facebookUrl)));

const problems = [];
const toAdd = [];
for (const p of posts) {
  const url = cleanUrl(p.facebookUrl);
  if (known.has(url)) { console.log(`[skip, already on website] ${p.title || url}`); continue; }
  if (!p.title || !/^\d{4}-\d{2}-\d{2}$/.test(p.date || '') || !p.content) problems.push(`${url}: needs title, date YYYY-MM-DD and content`);
  if (p.imageUrl && !/^https:\/\/drive\.google\.com\/file\/d\/[\w-]{20,}\//.test(p.imageUrl)) problems.push(`${url}: imageUrl must be a Drive link`);
  toAdd.push({
    title: p.title, date: p.date, category: p.category || 'ข่าวประชาสัมพันธ์', content: p.content,
    imageUrl: p.imageUrl || '', imageType: 'image', facebookUrl: url, source: 'facebook',
  });
}
toAdd.forEach(p => console.log(`[add] ${p.date} ${p.title}\n      image: ${p.imageUrl || 'none'}`));
if (problems.length) {
  problems.forEach(x => console.log('PROBLEM', x));
  process.exit(1);
}
if (!WRITE) {
  console.log(`\ndry run: ${toAdd.length} posts would be added. Run with --write to add them.`);
  process.exit(0);
}
for (const p of toAdd) {
  const ref = await db.collection('posts').add({ ...p, syncedAt: Date.now(), createdAt: Date.now() });
  console.log(`added ${ref.id}`);
}
process.exit(0);
