// Step 3 of the Facebook news sync: after the photos are uploaded to the Drive folder and the
// folder is shared "anyone with the link", read file name -> Drive file id from the folder page
// (no sign-in needed) and merge them into private/fb_new_posts.json as Drive links.
//
// Usage: node scripts/fb_news/drive_folder_ids.mjs [folderId]
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from './playwright.mjs';

const FOLDER = process.argv[2] || '1gKabyfUWIGtEFHDT0z8Josf2X-uGaCpd'; // news-to-drive (kmdschool198)
const JSON_FILE = path.join(process.cwd(), 'private', 'fb_new_posts.json');

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(`https://drive.google.com/drive/folders/${FOLDER}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const map = await page.evaluate(folder => {
  const out = {};
  document.querySelectorAll('[data-id]').forEach(e => {
    const id = e.getAttribute('data-id');
    if (!id || id.length < 20 || id === folder) return;
    const txt = [e.getAttribute('aria-label'), e.innerText,
      ...[...e.querySelectorAll('[aria-label],[title],[data-tooltip]')].map(x => x.getAttribute('aria-label') || x.getAttribute('title') || x.getAttribute('data-tooltip'))].join(' ');
    const m = txt.match(/[\w.-]+\.(jpe?g|png|webp)/i);
    if (m) out[m[0]] = id;
  });
  return out;
}, FOLDER);
await browser.close();

console.log(`Drive folder: ${Object.keys(map).length} images`);
if (!Object.keys(map).length) {
  console.log('no files found: check the folder is shared "anyone with the link"');
  process.exit(1);
}
if (fs.existsSync(JSON_FILE)) {
  const posts = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  for (const p of posts) {
    if (p.imageFile && map[p.imageFile]) p.imageUrl = `https://drive.google.com/file/d/${map[p.imageFile]}/view?usp=sharing`;
    console.log(`${p.imageFile || '(no photo)'} -> ${p.imageUrl || 'NOT IN DRIVE YET'}`);
  }
  fs.writeFileSync(JSON_FILE, JSON.stringify(posts, null, 1));
  console.log(`updated: ${JSON_FILE}`);
} else {
  console.log(JSON.stringify(map, null, 1));
}
process.exit(0);
