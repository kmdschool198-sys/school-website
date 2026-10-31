# ดึงโพสต์เพจ Facebook มาเป็นข่าวบนเว็บ

เว็บดึงโพสต์ใหม่จากเพจ "โรงเรียนบ้านคลองมดแดง" มาเป็นข่าว (หมวด ข่าวประชาสัมพันธ์) วันละครั้ง เวลา 08:00 น.

- ไม่ลบหรือเขียนทับข่าวที่ครูลงเอง
- โพสต์ที่มีบนเว็บแล้วจะไม่ถูกเพิ่มซ้ำ ระบบดูจากลิงก์โพสต์ หรือหัวข้อกับวันที่ที่ตรงกัน
- โพสต์ที่ไม่มีข้อความ เช่น แชร์เฉย ๆ หรือเปลี่ยนรูปปก จะถูกข้ามไป
- ลิงก์รูปของโพสต์ที่ดึงมาจะถูกอัปเดตทุกครั้งที่ระบบดึง เพราะลิงก์รูปของ Facebook หมดอายุได้

โค้ดอยู่ในไฟล์เหล่านี้:

- `scripts/lib/facebookPosts.mjs`
- `scripts/sync_facebook_posts.mjs` (รันเอง)
- `api/sync-facebook.js` (Vercel Cron)

> **Token เป็นความลับ** ห้ามวางในแชต ห้าม commit และห้ามส่งให้ใคร ให้เก็บไว้ใน `.env.local` และใน Vercel เท่านั้น

## 1. ขอ Page access token (ต้องเป็นแอดมินเพจ)

1. เข้า <https://developers.facebook.com/apps> แล้วกด **Create App** เลือกประเภท **Other** แล้วเลือก **Business** ตั้งชื่อ เช่น `KMD Website Sync`
2. เปิด **Graph API Explorer** ที่ <https://developers.facebook.com/tools/explorer>
   - เลือกแอปที่เพิ่งสร้าง
   - กด **Get Token** แล้วเลือก **Get User Access Token**
   - ติ๊กสิทธิ์ `pages_show_list` และ `pages_read_engagement` แล้วกด **Generate Access Token** และอนุญาตเพจโรงเรียน
3. ทำ token ให้ใช้ได้นาน: เปิด **Access Token Debugger** ที่ <https://developers.facebook.com/tools/debug/accesstoken>
   - วาง token จากข้อ 2 แล้วกด **Debug**
   - กด **Extend Access Token** ที่ด้านล่าง แล้วคัดลอก token ยาวที่ได้
4. กลับไปที่ Graph API Explorer
   - วาง token ยาวลงช่อง Access Token
   - เรียก `me/accounts`
   - หาแถวของเพจโรงเรียน แล้วคัดลอกค่า `id` (คือ Page ID) และ `access_token` (คือ Page token แบบไม่หมดอายุ)

## 2. ทดลองบนเครื่อง

1. เพิ่มสองบรรทัดนี้ใน `.env.local` (ไฟล์นี้ไม่ถูก commit):

   ```
   FACEBOOK_PAGE_ID=ใส่ id ของเพจ
   FACEBOOK_PAGE_TOKEN=ใส่ access_token ของเพจ
   ```

2. ดูก่อนว่าจะมีข่าวไหนถูกเพิ่ม คำสั่งนี้ยังไม่บันทึกอะไร:

   ```bash
   npm run sync:facebook
   ```

3. ถ้ารายการถูกต้อง สั่งบันทึก:

   ```bash
   npm run sync:facebook -- --write
   ```

## 3. ให้ Vercel ดึงให้อัตโนมัติทุกวัน

ไปที่ Vercel → โปรเจกต์ → **Settings → Environment Variables** แล้วเพิ่มค่าเหล่านี้ (ใช้ Environment: Production):

| ชื่อ | ค่า |
|---|---|
| `FACEBOOK_PAGE_ID` | id ของเพจ |
| `FACEBOOK_PAGE_TOKEN` | Page token |
| `CRON_SECRET` | ข้อความสุ่มยาว ๆ ดูวิธีสร้างด้านล่าง |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | ไฟล์ service account ที่แปลงเป็น base64 ดูวิธีสร้างด้านล่าง |

สร้างค่า `CRON_SECRET` ใน PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

แปลงไฟล์ service account เป็น base64 แล้วคัดลอกเข้าคลิปบอร์ด ใช้ key ใหม่ที่สร้างหลังจาก rotate key เดิมแล้ว:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\KruJames\.secrets\<ไฟล์ key ใหม่>.json")) | Set-Clipboard
```

จากนั้น deploy ใหม่ ตารางเวลาอยู่ใน `vercel.json` (`0 1 * * *` คือ 01:00 UTC ตรงกับ 08:00 น. เวลาไทย)

ดูผลการดึงแต่ละรอบได้ที่ Vercel → **Logs** ค้นหา `sync-facebook`

## ถ้าดึงไม่ได้

- **`Facebook Graph API 400 ... (code 190)`:** token หมดอายุหรือถูกยกเลิก ทำข้อ 1 ใหม่
- **`code 10` หรือ `code 200`:** token ไม่มีสิทธิ์ `pages_read_engagement` หรือผู้สร้าง token ไม่ได้เป็นแอดมินเพจ
- **`missing env: ...`:** ยังตั้งค่าใน Vercel ไม่ครบ
