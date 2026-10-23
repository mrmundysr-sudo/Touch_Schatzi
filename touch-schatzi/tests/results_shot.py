import sys
from playwright.sync_api import sync_playwright
w, h, pre = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
res = lambda won: """TS.app.showResults({won:%s, tie:false, newBest:true, best:231, players:[{id:'me',name:'You',human:true}], setup:{opponents:['lily','scoobert','max'],difficulty:'medium'},
 rank:[{id:'max',name:'Max',charId:'max',human:false,total:%d,place:1},{id:'me',name:'You',charId:null,human:true,total:%d,place:2},{id:'lily',name:'Lily',charId:'lily',human:false,total:198,place:3},{id:'scoobert',name:'Scoobert',charId:'scoobert',human:false,total:171,place:4}]})""" % ('true' if won else 'false', 250 if not won else 190, 231 if won else 180)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for won in (True, False):
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and '404' not in m.text and 'vibrate' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        pg.goto('http://localhost:8765/index.html?screen=menu'); pg.wait_for_timeout(1500)
        pg.evaluate(res(won)); 
        for i, t in enumerate((1200, 2600, 3200)):
            pg.wait_for_timeout(t if i == 0 else t - (1200 if i == 1 else 2600) + 400); pg.screenshot(path=f'{pre}_{"win" if won else "loss"}_{i}.png')
        for l in logs: print(l)
        ctx.close()
    b.close()
