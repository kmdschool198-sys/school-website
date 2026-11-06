// News images live in Google Drive (folder of kmdschool198@gmail.com), never in public/.
// Replaces post imageUrl values that point at a file on the website (/news/xxx.jpg) with the
// Drive link of the file with the same name.
//
// Mapping file: JSON { "fb_xxx.jpg": "<Drive file id or link>", ... }
// Every touched post is saved to private/backups/ first. Dry run unless --write.
//
// Usage: node scripts/relink_news_images.mjs <mapping.json> [--write]
import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from './lib/adminApp.mjs';

const WRITE = process.argv.includes('--write');
const mapFile = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!mapFile) {
  console.error('usage: node scripts/relink_news_images.mjs <mapping.json> [--write]');
  process.exit(1);
}

const driveLink = value => {
  const id = /\/d\/([\w-]{20,})/.exec(value)?.[1] || /[?&]id=([\w-]{20,})/.exec(value)?.[1] || (/^[\w-]{20,}$/.test(value) ? value : null);
  return id ? `https://drive.google.com/file/d/${id}/view?usp=sharing` : null;
};

const mapping = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
const db = adminDb();
const snap = await db.collection('posts').get();
const updates = [];
const missing = [];
for (const d of snap.docs) {
  const url = d.data().imageUrl;
  if (typeof url !== 'string' || !url.startsWith('/')) continue;
  const name = path.posix.basename(url);
  const link = mapping[name] ? driveLink(mapping[name]) : null;
  if (!link) { missing.push(`${d.id} ${url}`); continue; }
  updates.push({ ref: d.ref, id: d.id, before: d.data(), link });
  console.log(`${d.id}  ${url}  ->  ${link}`);
}
console.log(`\nposts to relink: ${updates.length}; local images with no Drive file: ${missing.length}`);
missing.forEach(m => console.log('   missing', m));

if (!WRITE) {
  console.log('\ndry run — nothing written. Run with --write to apply.');
  process.exit(0);
}

const dir = path.join(process.cwd(), 'private', 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `news-image-relink-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(Object.fromEntries(updates.map(u => [u.id, u.before])), null, 1));
console.log('backup:', file);
const batch = db.batch();
updates.forEach(u => batch.update(u.ref, { imageUrl: u.link }));
await batch.commit();
console.log(`written: ${updates.length} posts`);
process.exit(0);
