"""Scripted screenshots of key states. usage: tour.py <w> <h> <prefix>"""
import sys
from playwright.sync_api import sync_playwright
w, h, pre = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and '404' not in m.text and 'vibrate' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto('http://localhost:8765/index.html?screen=play&opp=lily,scoobert,max&diff=hard'); pg.wait_for_timeout(2600)
    pg.screenshot(path=f'{pre}_1_start.png')
    pg.locator('.btn.spin').click(force=True); pg.wait_for_timeout(4000)
    pg.evaluate("TS.app.screen.onReelTap(1); TS.app.screen.onReelTap(3)"); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{pre}_2_holds.png')
    pg.evaluate("TS.app.screen.sheet.open()"); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{pre}_3_sheet.png')
    cats = pg.evaluate("[...TS.app.screen.sheet.cards[0].card.legal]")
    pg.locator(f'.sheet .card-wrap:first-child .sc-row[data-cat="{cats[2]}"]').first.dispatch_event('pointerdown'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'{pre}_4_select.png')
    pg.locator(f'.sheet .card-wrap:first-child .sc-row[data-cat="{cats[2]}"]').first.dispatch_event('pointerdown'); pg.wait_for_timeout(700)
    pg.screenshot(path=f'{pre}_5_scored.png'); pg.wait_for_timeout(3200)
    pg.screenshot(path=f'{pre}_6_ai.png'); pg.wait_for_timeout(1400)
    pg.screenshot(path=f'{pre}_7_ai2.png')
    for l in logs: print(l)
    b.close()
