import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    errors = []
    page.on('console', lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ['error', 'warning'] else None)
    page.on('pageerror', lambda err: errors.append(f"[PAGE ERROR] {err}"))

    # Let's inspect admin page
    page.goto('http://localhost:5173/admin', wait_until='domcontentloaded')
    time.sleep(2)
    print("Admin page title:", page.title())
    print("Current URL:", page.url)

    # Check if login form is showing
    login_form = page.query_selector('form')
    if login_form:
        print("Login form is present on /admin")
        inputs = page.query_selector_all('input')
        print(f"Inputs count: {len(inputs)}")

    page.screenshot(path='C:/Users/KruJames/.gemini/antigravity/brain/7ee11706-0566-4dcb-96e5-de35272a75b0/admin_page_test.png')
    browser.close()

    print("\nConsole logs/errors on /admin:")
    for e in errors[:10]:
        print(e)
