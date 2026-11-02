import sys
import json
import re
import os
import urllib.request
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# The new posts we want to fetch and import
TARGET_POSTS = [
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid0G5SDqMBztdHutyNvMiYzaqDepcaFir7NMQZCdCqpyWmxgmdJksaShW8qbGve7yyFl",
        "date_hint": "2026-11-02",
        "slug": "congrats_transfer_welcome"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid0nQ9xX7SbMdS4bvLfojRkQX51WNgdbthmaJ7F2F7sJmGoMLyPMR8DJ7gQ8VHX9cEsl",
        "date_hint": "2026-11-02",
        "slug": "congrats_kru_onprapha"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid02GLqJmwMACcvQ6cP7pTpaPqSQVBpFSCkfD8Tje97Gq8mGEWqiAVH8XxdUnFjySnU1l",
        "date_hint": "2026-10-29",
        "slug": "thanks_all_sectors"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid02yoCjAdxFLwfer8D78kUuvYeVZXssEBZySACFwiSotcageQjxTFvLEfiP8SZ31Vqjl",
        "date_hint": "2026-10-29",
        "slug": "term2_cleaning_meeting"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid02LDohvCTnoYRUTuybkTJiqzmCmfuZFcfyPf2agTQqneZEmBitxBS8ToziTUVEx1rBl",
        "date_hint": "2026-10-28",
        "slug": "term2_welcome_school"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid02dbVF4DQGsQR7G8GeYEuZY7pQZ4tgwrLUMkYrfhMsJn6Ysd8235Q2G2GpykSZHUqql",
        "date_hint": "2026-09-28",
        "slug": "kmd_announcement_sep28"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid023VZE6nobLZDTMRa4Hh6v6V9S2XsDSpYdccpM8QHeseqGHCWwp3G9KipvoQsafaol",
        "date_hint": "2026-09-27",
        "slug": "kritsana_games_2569"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid0RfXvWZwVzHLNWavLEvYMjh33eqDGzEGajQV62DF2dBmJAZ2gXysuAB7Kg5UktU1jl",
        "date_hint": "2026-09-26",
        "slug": "kritsana_games_opening"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid02ggUyUPQtTvTQ8odcMbaxwYa1uQXfFobwebpsyNsgzx34D8UvxecpjmtjAy186P3gl",
        "date_hint": "2026-09-21",
        "slug": "moral_certificate_24"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid0hYW6GRyq6LELKaHbsWEQNuoAJA3b2KGGKfg2sdPdcxmRYph2RUiSWPW125K9xaUpl",
        "date_hint": "2026-09-21",
        "slug": "congrats_pride_awards"
    },
    {
        "url": "https://www.facebook.com/BnKhlngMddang/posts/pfbid0DKfJnr1ignc3oHptiNkvLJmfU97FwH3CbdHLNrAKnreidMii44m2DWxhApEPJ4zHl",
        "date_hint": "2026-09-19",
        "slug": "siam_smile_sponsor"
    }
]

os.makedirs("public/news", exist_ok=True)

results = []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={'width': 1280, 'height': 1600}, locale='th-TH')

    for idx, item in enumerate(TARGET_POSTS):
        print(f"[{idx+1}/{len(TARGET_POSTS)}] Visiting {item['url']} ...")
        try:
            page.goto(item['url'], wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)
            page.keyboard.press('Escape')
            page.wait_for_timeout(500)

            # Click see more if any
            see_more = page.query_selector_all('div[role="button"]:has-text("ดูเพิ่มเติม")')
            for sm in see_more:
                try:
                    sm.click(timeout=1000)
                    page.wait_for_timeout(300)
                except Exception:
                    pass

            # Extract main text
            # Usually the post content is inside div[dir="auto"]
            body_text = page.inner_text('body')
            
            # Find images
            imgs = page.query_selector_all('img[src*="fbcdn.net"]')
            best_img_src = ""
            max_res = 0
            for im in imgs:
                src = im.get_attribute('src') or ""
                if "emoji.php" in src or "rsrc.php" in src:
                    continue
                w = im.evaluate("el => el.naturalWidth || 0")
                h = im.evaluate("el => el.naturalHeight || 0")
                area = w * h
                if area > max_res and (w > 200 or h > 200):
                    max_res = area
                    best_img_src = src

            # Download image to public/news/<slug>.jpg
            local_image_path = ""
            if best_img_src:
                try:
                    filename = f"fb_{item['slug']}.jpg"
                    dest = os.path.join("public", "news", filename)
                    req = urllib.request.Request(best_img_src, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        with open(dest, 'wb') as f_out:
                            f_out.write(resp.read())
                    local_image_path = f"/news/{filename}"
                    print(f"   -> Downloaded image: {local_image_path} ({os.path.getsize(dest)} bytes)")
                except Exception as ex:
                    print(f"   -> Image download error: {ex}")
                    local_image_path = best_img_src

            # Extract post content from inner_text or div[data-ad-preview] or similar
            # Let's filter out sidebar/navigation junk
            post_content = ""
            # Often div[data-ad-rendering-role="story_message"] or div[dir="auto"]
            message_divs = page.query_selector_all('div[dir="auto"]')
            candidate_texts = []
            for md in message_divs:
                t = md.inner_text().strip()
                if len(t) > 20 and not t.startswith("เข้าสู่ระบบ") and not t.startswith("ดูเพิ่มเติมบน Facebook") and not "ผู้ติดตาม" in t:
                    candidate_texts.append(t)

            # Pick the longest unique text block
            candidate_texts.sort(key=lambda s: len(s), reverse=True)
            if candidate_texts:
                post_content = candidate_texts[0]
            else:
                post_content = body_text

            results.append({
                "url": item["url"],
                "date": item["date_hint"],
                "slug": item["slug"],
                "content": post_content,
                "image": local_image_path,
                "remote_image": best_img_src
            })
            print(f"   -> Content length: {len(post_content)} chars")

        except Exception as e:
            print(f"   -> Error: {e}")

    b.close()

with open("scripts/fetched_detailed_posts.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"\nDone! Saved {len(results)} posts to scripts/fetched_detailed_posts.json")
