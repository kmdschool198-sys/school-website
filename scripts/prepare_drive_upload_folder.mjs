import fs from 'fs';
import path from 'path';

const targetDir = 'c:/Users/KruJames/.gemini/antigravity/scratch/school-website/รูปภาพข่าว_สิงหาคม_กันยายน_2569';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const fileMap = [
  { src: 'public/news/fb_kritsana_games.jpg', dest: '2026-09-18-01-กีฬาสีกฤษณาเกมส์.jpg' },
  { src: 'public/news/fb_1598446742078172.jpg', dest: '2026-09-16-01-การประเมินPA.jpg' },
  { src: 'public/news/fb_1584041320185381.jpg', dest: '2026-09-03-01-TheSchoolCEOเหรียญทอง-เสน่ห์ผ้าทอปกาเกอะญอ.jpg' },
  { src: 'public/news/fb_bm_school_ceo.jpg', dest: '2026-09-03-02-สาขาบ้านใหม่ชุมนุมไทร-TheSchoolCEOเหรียญเงิน.jpg' },
  { src: 'public/news/fb_bm_thanks.jpg', dest: '2026-08-29-01-สาขาบ้านใหม่ชุมนุมไทร-ขอบคุณผู้สนับสนุน.jpg' },
  { src: 'public/news/fb_1583294180260095.jpg', dest: '2026-08-27-01-อบรมความปลอดภัยในสถานศึกษา.jpg' },
  { src: 'public/news/fb_1579004494022397.jpg', dest: '2026-08-25-01-แหล่งท่องเที่ยวเกาะเสือ.jpg' },
  { src: 'public/news/fb_paka_thanks.jpg', dest: '2026-08-24-01-สาขาป่าคา-ประเมินขยายชั้นเรียน-ชมรมหินหนุน.jpg' },
  { src: 'public/news/fb_1576195134303333.jpg', dest: '2026-08-21-01-เปตองชิงแชมป์จังหวัด-รองชนะเลิศอันดับ2.jpg' },
  { src: 'public/news/fb_1576058754316971.jpg', dest: '2026-08-20-01-สัปดาห์ห้องสมุด.jpg' },
  { src: 'public/news/fb_paka_science.jpg', dest: '2026-08-18-01-สาขาป่าคา-วันวิทยาศาสตร์แห่งชาติ.jpg' },
  { src: 'public/news/kmd_060_2569_tree_planting.png', dest: '2026-08-17-01-คมด060-โครงการปลูกต้นไม้99993ต้น.png' },
  { src: 'public/news/fb_1569297828326397.jpg', dest: '2026-08-15-01-ศิลปหัตถกรรมนักเรียนครั้งที่74.jpg' },
  { src: 'public/news/fb_1567318471857666.jpg', dest: '2026-08-12-01-วันแม่แห่งชาติ2569.jpg' }
];

console.log('Copying images to target directory...');
for (const item of fileMap) {
  if (fs.existsSync(item.src)) {
    const destPath = path.join(targetDir, item.dest);
    fs.copyFileSync(item.src, destPath);
    console.log(`Copied: ${item.dest}`);
  } else {
    console.warn(`Source not found: ${item.src}`);
  }
}
console.log('Done! Total in folder:', fs.readdirSync(targetDir).length);
