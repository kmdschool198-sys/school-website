# รูปข่าวต้องเป็นลิงก์ Google Drive เท่านั้น

## กติกา

- รูปของข่าว (`posts.imageUrl`) ต้องเป็น**ลิงก์ Google Drive** ห้ามเก็บรูปไว้ในเว็บ (`public/`)
- โฟลเดอร์รูปข่าว (บัญชี **kmdschool198@gmail.com**):
  https://drive.google.com/drive/u/6/folders/1aRRX7vJ8ix2WrD_tP8QxV9HRUKgyeK9f
- ตั้งค่าแชร์โฟลเดอร์และไฟล์เป็น **"ทุกคนที่มีลิงก์ (ผู้มีสิทธิ์อ่าน)"** ถ้าไม่ตั้ง รูปจะไม่ขึ้นในเว็บ
- รูปแบบลิงก์ที่บันทึกลง Firestore: `https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing`
  หน้าเว็บแสดงรูปผ่าน `src/components/DriveImage.tsx` ซึ่งแปลงลิงก์นี้เป็นรูปจริงเอง

## ทำไม

ข่าวจาก Facebook ที่ดึงมาเมื่อ 2 พ.ย. 2569 (commit `4c126fb`) เก็บรูป 13 ไฟล์ไว้ที่ `public/news/*.jpg`
และบันทึก `imageUrl: '/news/xxx.jpg'` ลง Firestore ทันที แต่ไฟล์รูปยังไม่ได้ขึ้นเว็บจริง
เว็บจริงจึงส่งหน้า HTML กลับมาแทนรูป และข่าว 13 รายการนี้แสดงเป็นรูปกล้องขีดฆ่า
ส่วนข่าวอื่นอีก 94 รายการใช้ลิงก์ Drive อยู่แล้ว และแสดงรูปได้ปกติ

## งานที่ค้าง (สถานะ 6 พ.ย. 2569)

ยังไม่ได้ทำ: Google Drive connector ในแอปขึ้นว่าเชื่อมต่อแล้ว แต่เรียกใช้แล้วได้ "requires authentication"

1. อัปโหลด 13 ไฟล์จาก `public/news/` เข้าโฟลเดอร์ด้านบน แล้วตั้งแชร์ "ทุกคนที่มีลิงก์"

   | ไฟล์ | โพสต์ (Firestore `posts/`) |
   |---|---|
   | fb_congrats_transfer_welcome.jpg | 1djQh6IpMFcKbnV8yvhL |
   | fb_congrats_pride_awards.jpg | 33Db6DPKIqXCn828KLB4 |
   | fb_kritsana_games_2569.jpg | 8BqUkwXKH4CW2UNw9CWW |
   | fb_congrats_kru_onprapha.jpg | BTszIYVFgmcfkJ0xId1c |
   | fb_term2_cleaning_meeting.jpg | LktC7jBvuO2Cpt78yWad |
   | fb_siam_smile_sponsor.jpg | Q8cTdB4HQPK3IjaMvLLT |
   | fb_term2_welcome_school.jpg | QYlc7Uvsbzz3tMmjdJns |
   | fb_kmd_announcement_sep28.jpg | SLhd0FqnQjNa3W4F6OMc |
   | fb_congrats_talented_students_sep11.jpg | ScYiKuNwUY2yXzPPUOag |
   | fb_kritsana_games_opening.jpg | UryMkcwvGDGc11HD02Og |
   | fb_thanks_all_sectors.jpg | WkNLwVqCnBdsHnyQReqr |
   | fb_moral_certificate_24.jpg | adyZ7siqsqRL3On6Bw03 |
   | fb_sufficiency_media_contest_sep10.jpg | hErUbR86fa0tCeDE36js |

2. ทำไฟล์ mapping ชื่อไฟล์ → รหัสไฟล์ Drive หรือลิงก์ Drive เช่น `private/news-drive-map.json`

   ```json
   { "fb_congrats_transfer_welcome.jpg": "https://drive.google.com/file/d/<FILE_ID>/view" }
   ```

3. ลองรันก่อน (ยังไม่แก้ข้อมูล) แล้วค่อยบันทึกจริง โดยข้อมูลเดิมจะถูกสำรองไว้ใน `private/backups/`

   ```bash
   node scripts/relink_news_images.mjs private/news-drive-map.json
   ```

   ```bash
   node scripts/relink_news_images.mjs private/news-drive-map.json --write
   ```

4. ลบ `public/news/` และแก้ `scripts/import_fb_news_live.mjs` ให้ `imageUrl` เป็นลิงก์ Drive
   (ดึงข่าว Facebook รอบต่อไป: อัปโหลดรูปขึ้น Drive ก่อน แล้วค่อยใส่ลิงก์)
5. เปิดหน้าแรกของเว็บ แล้วเช็คว่ารูปของข่าวทั้ง 13 รายการขึ้นครบ
