#!/usr/bin/env python3
"""Rebuilds optimized game art from the raw design export.
Usage: python3 tools/build_assets.py <path-to-unzipped-visual-assets> <cutout.py>
Not needed at runtime: the optimized files are committed in assets/."""
import sys, os, subprocess, numpy as np
from PIL import Image
src = sys.argv[1]; cut = sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), '..', 'app/src/main/assets/www/assets')
tmp = '/tmp/ts_cut'; os.makedirs(tmp, exist_ok=True)
def P(*a): return os.path.join(src, 'pages', *a)
def save(im, rel, q=86):
    path = os.path.join(OUT, rel); im.save(path, 'WEBP', quality=q, method=6); print(rel, im.size, os.path.getsize(path)//1024, 'KB')
def bbox_crop(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox())
# backgrounds
for rel, p in [('bg/splash.webp','page_01_splash/clean.png'),('bg/menu.webp','page_02_menu/clean.png'),
               ('bg/gameplay.webp','page_03_gameplay/clean.png'),('bg/scorecard.webp','page_06_page_6/clean.png'),
               ('bg/win.webp','page_04_win/clean.png'),('bg/loss.webp','page_05_loss/clean.png')]:
    save(Image.open(P(*p.split('/'))).convert('RGB'), rel, 84)
# landscape gameplay background: mirrored extension of the scenic strip
g = Image.open(P('page_03_gameplay','clean.png')).convert('RGB')
def landscape(g, rel):
    w, h = g.size; y0, y1 = int(h*.30), int(h*.93)
    strip = g.crop((0, y0, w, y1)); sw, sh = strip.size
    m = strip.transpose(Image.FLIP_LEFT_RIGHT)
    canvas = Image.new('RGB', (sw*3, sh)); canvas.paste(m, (0,0)); canvas.paste(strip, (sw,0)); canvas.paste(m, (sw*2,0))
    # soft seams
    a = np.array(canvas).astype(np.float32)
    for x in (sw, sw*2):
        k = 40
        for i in range(-k, k):
            t = (i+k)/(2*k); a[:, x+i] = a[:, x+i]  # seams are mirror-symmetric => already continuous
    out = Image.fromarray(a.astype(np.uint8))
    save(out, rel, 82)
landscape(g, 'bg/gameplay_landscape.webp')
for k in ('win','loss'):
    landscape(Image.open(P('page_04_win' if k=='win' else 'page_05_loss','clean.png')).convert('RGB'), f'bg/{k}_landscape.webp')
# characters
save(bbox_crop(Image.open(P('page_03_gameplay','other_2.png')).convert('RGBA')), 'chars/girl.webp', 90)
save(bbox_crop(Image.open(P('page_03_gameplay','other_3.png')).convert('RGBA')), 'chars/boy.webp', 90)
subprocess.check_call([sys.executable, cut, P('page_03_gameplay','other_4.png'), tmp+'/cat.png'])
save(Image.open(tmp+'/cat.png'), 'chars/cat.webp', 90)
# ui
m = Image.open(P('page_03_gameplay','other_5.png')).convert('RGBA')
LEVER = (1772, 0, 1946, 318)
lever = m.crop(LEVER); save(lever, 'ui/slot_lever.webp', 92)
a = np.array(m); a[0:LEVER[3], LEVER[0]:, 3] = 0
save(Image.fromarray(a), 'ui/slot_machine.webp', 92)
save(Image.open(P('page_06_page_6','other_1.png')).convert('RGBA'), 'ui/scorecard.webp', 90)
save(bbox_crop(Image.open(P('page_04_win','other_1.png')).convert('RGBA')), 'ui/you_win.webp', 90)
save(bbox_crop(Image.open(P('page_04_win','other_2.png')).convert('RGBA')), 'ui/play_again.webp', 90)
subprocess.check_call([sys.executable, cut, P('page_05_loss','other_1.png'), tmp+'/lose.png'])
save(Image.open(tmp+'/lose.png'), 'ui/you_lose.webp', 90)
