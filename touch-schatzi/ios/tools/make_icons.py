#!/usr/bin/env python3
"""Generates the iOS app icon (1024x1024, opaque) and the launch logo from the game's own artwork.

Same design as the Android launcher icon: the Schatzi cat inside a gold ring on the brand purple.
The source cutout is www/assets/chars/cat.webp (committed), so this is reproducible:
    python3 ios/tools/make_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, '..', '..', 'app/src/main/assets/www/assets/chars/cat.webp')
OUT = os.path.join(HERE, '..', 'TouchSchatzi/Resources/Assets.xcassets')
PURPLE_DARK, PURPLE_LIGHT = (42, 15, 77), (86, 36, 150)
GOLD_LIGHT, GOLD_DARK = (255, 233, 160), (240, 154, 0)


def radial(size, inner, outer):
    """Cheap radial gradient (purple glow in the middle)."""
    small = 256
    im = Image.new('RGB', (small, small))
    px = im.load()
    c = (small - 1) / 2
    for y in range(small):
        for x in range(small):
            d = min(1.0, (((x - c) ** 2 + (y - c) ** 2) ** 0.5) / (small * 0.72))
            px[x, y] = tuple(int(inner[i] + (outer[i] - inner[i]) * d) for i in range(3))
    return im.resize((size, size), Image.BICUBIC)


def badge(size, with_background):
    """The ringed cat. With a background it fills the whole square (iOS masks the corners itself)."""
    S = size * 2  # supersample
    canvas = radial(S, PURPLE_LIGHT, PURPLE_DARK).convert('RGBA') if with_background else Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ring_d = int(S * (0.86 if with_background else 0.96))
    ring_w = int(ring_d * 0.055)
    cx = cy = S // 2
    # inner disc: purple behind the cat, so the cutout's soft edge never shows the background
    disc = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    inner_d = ring_d - ring_w
    ImageDraw.Draw(disc).ellipse((cx - inner_d // 2, cy - inner_d // 2, cx + inner_d // 2, cy + inner_d // 2), fill=PURPLE_DARK + (255,))
    canvas.alpha_composite(disc)
    # cat, cropped to the face and clipped to the disc
    cat = Image.open(CAT).convert('RGBA')
    face = cat.crop((0, 40, cat.width, 40 + cat.width))  # square around the face/ears
    scale = inner_d * 1.04 / face.width
    face = face.resize((int(face.width * scale), int(face.height * scale)), Image.LANCZOS)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    layer.alpha_composite(face, (cx - face.width // 2, cy - face.height // 2 + int(inner_d * 0.04)))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).ellipse((cx - inner_d // 2, cy - inner_d // 2, cx + inner_d // 2, cy + inner_d // 2), fill=255)
    clipped = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    clipped.paste(layer, (0, 0), mask)
    canvas.alpha_composite(clipped)
    # gold ring with a vertical gradient + soft drop shadow
    ring_mask = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(ring_mask)
    d.ellipse((cx - ring_d // 2, cy - ring_d // 2, cx + ring_d // 2, cy + ring_d // 2), fill=255)
    d.ellipse((cx - inner_d // 2, cy - inner_d // 2, cx + inner_d // 2, cy + inner_d // 2), fill=0)
    grad = Image.new('RGBA', (S, S))
    gp = grad.load()
    for y in range(S):
        t = min(1.0, max(0.0, (y - (cy - ring_d // 2)) / ring_d))
        col = tuple(int(GOLD_LIGHT[i] + (GOLD_DARK[i] - GOLD_LIGHT[i]) * t) for i in range(3)) + (255,)
        for x in range(S):
            gp[x, y] = col
    if with_background:
        shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 110), (0, int(S * 0.012)), ring_mask)
        canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(S * 0.012)))
    ring = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ring.paste(grad, (0, 0), ring_mask)
    canvas.alpha_composite(ring)
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    icon = badge(1024, True).convert('RGB')  # App Store icon must have no alpha channel
    icon.save(os.path.join(OUT, 'AppIcon.appiconset', 'AppIcon-1024.png'), optimize=True)
    for scale, suffix in ((1, ''), (2, '@2x'), (3, '@3x')):
        badge(160 * scale, False).save(os.path.join(OUT, 'LaunchLogo.imageset', f'LaunchLogo{suffix}.png'), optimize=True)
    print('icons written to', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
