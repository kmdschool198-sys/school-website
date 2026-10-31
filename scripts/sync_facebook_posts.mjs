// Copy new posts from the school's Facebook Page into website news.
// Dry run by default (shows what would be added); pass --write to save.
//   npm run sync:facebook            # preview
//   npm run sync:facebook -- --write # save
// Needs FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN in .env.local (see docs/facebook-sync.md).
import { adminDb, fail } from './lib/adminApp.mjs';
import { syncFacebookPosts } from './lib/facebookPosts.mjs';

const write = process.argv.includes('--write');
const db = adminDb(); // also loads .env.local
const pageId = process.env.FACEBOOK_PAGE_ID;
const token = process.env.FACEBOOK_PAGE_TOKEN;
if (!pageId || !token) fail('กรุณาใส่ FACEBOOK_PAGE_ID และ FACEBOOK_PAGE_TOKEN ใน .env.local (ดู docs/facebook-sync.md)');

const result = await syncFacebookPosts({ db, pageId, token, write });
console.log(`โพสต์จากเพจ: ${result.fetched} | ข่าวใหม่: ${result.added.length} | รูปที่ต้องอัปเดตลิงก์: ${result.imagesRefreshed}`);
for (const p of result.added) console.log(`  + ${p.date}  ${p.title}`);
console.log(write ? 'บันทึกแล้ว' : 'ยังไม่ได้บันทึก (dry run) — ใส่ --write เพื่อบันทึก');
process.exit(0);
