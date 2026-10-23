"""Plays full games through the real UI (clicks), logging errors. usage: drive.py <w> <h> <opponents> <diff> [shotdir]"""
import sys, time, json
from playwright.sync_api import sync_playwright
w, h = int(sys.argv[1]), int(sys.argv[2]); opp = sys.argv[3]; diff = sys.argv[4]; shots = sys.argv[5] if len(sys.argv) > 5 else None
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1.5, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and '404' not in m.text and 'vibrate' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto(f'http://localhost:8765/index.html?screen=play&opp={opp}&diff={diff}'); pg.wait_for_timeout(1500)
    pg.evaluate("TS.app.setSetting('fast', true); TS.app.screen.fast = true;")
    t0 = time.time(); turns = 0; shot_n = 0
    def st(): return pg.evaluate("(() => { const s = TS.app.screen; if (!s.game) return {res:true}; const g = s.game; return {turn: g.turn, human: g.current.human, rolled: g.rolled, left: g.rollsLeft, busy: s.busy, pick: !!s.awaitingPick, round: g.round, over: g.over, dead: s.dead, committing: !!s.committing, open: s.sheet.isOpen}; })()")
    last = None
    while time.time() - t0 < 600:
        s = st()
        if s.get('res'): break
        if s['human'] and not s['busy'] and not s['committing']:
            if not s['rolled'] or (s['left'] > 0 and not s['pick']):
                if s['rolled'] and s['left'] > 0:
                    # tap a reel to hold (real tap on canvas), then maybe stop early
                    import random
                    if random.random() < 0.8:
                        box = pg.locator('.player-zone .machine canvas').bounding_box()
                        i = random.randint(0, 4); pg.touchscreen.tap(box['x'] + box['width'] * (0.2 + 0.13 * i + 0.03), box['y'] + box['height'] * 0.5); pg.wait_for_timeout(150)
                    if s['left'] == 1 or random.random() < 0.25:
                        pg.evaluate("TS.app.screen.sheet.open()"); pg.wait_for_timeout(500)
                    else:
                        pg.locator('.btn.spin').click(force=True); pg.wait_for_timeout(300)
                else:
                    pg.locator('.btn.spin').click(force=True); pg.wait_for_timeout(300)
                if shots and shot_n < 4 and s['rolled']:
                    pg.screenshot(path=f'{shots}/drive_{shot_n}.png'); shot_n += 1
            if s['rolled'] and (s['pick'] or s['open']):
                pg.wait_for_timeout(700)
                cats = pg.evaluate("(() => { const c = TS.app.screen.sheet.cards[0].card; return [...document.querySelectorAll('.sheet .card-wrap')].length && Object.entries(c.legal ? [...c.legal] : []).map(e=>e[1]); })()")
                if cats:
                    import random
                    cat = random.choice(cats)
                    if shots and shot_n < 8 and shot_n >= 4:
                        pg.screenshot(path=f'{shots}/drive_{shot_n}.png'); shot_n += 1
                    pg.locator(f'.sheet .card-wrap:first-child .sc-row[data-cat="{cat}"]').first.dispatch_event('pointerdown'); pg.wait_for_timeout(250)
                    pg.locator(f'.sheet .card-wrap:first-child .sc-row[data-cat="{cat}"]').first.dispatch_event('pointerdown'); turns += 1; pg.wait_for_timeout(500)
        pg.wait_for_timeout(120)
        k = (s.get('round'), s.get('turn'), s.get('rolled'), s.get('left'))
        if k != last:
            last = k; print(round(time.time()-t0), s, flush=True)
    print('turns by human:', turns, 'elapsed', round(time.time() - t0), 's')
    pg.wait_for_timeout(3500)
    if shots: pg.screenshot(path=f'{shots}/results.png')
    print('final screen:', pg.evaluate("document.querySelector('.screen.results') ? 'results' : 'other'"))
    for l in logs[:30]: print(l)
    b.close()
