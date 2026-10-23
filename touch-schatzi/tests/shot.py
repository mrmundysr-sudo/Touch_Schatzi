import sys, json, time
from playwright.sync_api import sync_playwright
url = sys.argv[1]; out = sys.argv[2]; w = int(sys.argv[3]); h = int(sys.argv[4]); wait = float(sys.argv[5]) if len(sys.argv) > 5 else 2.0
js = sys.argv[6] if len(sys.argv) > 6 else None
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}')); pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto(url); pg.wait_for_timeout(int(wait * 1000))
    if js: pg.evaluate(js); pg.wait_for_timeout(1500)
    pg.screenshot(path=out)
    for l in logs[:25]: print(l)
    b.close()
