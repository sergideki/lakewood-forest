#!/usr/bin/env python3
"""Lakewood sprite generator — 16-bit pixel sprites matching the forest 10.

Pipeline per sprite (matches the pipeline that styled the forest 10):
draw supersampled (512x512) with hard cel bands -> downsample to 44px native
(nearest) -> upscale to 64 nearest -> posterize 4 bits/channel, alpha
hard-thresholded.

Run: python3 scripts/gen-sprites.py            # all groups
     python3 scripts/gen-sprites.py water      # one group: water|pets|crops|villagers
Also writes a contact sheet of EVERY sprite under assets/{creatures,pets,crops,
villagers} to scripts/contact-sheet.png (dark bg, nearest x3) for QA.

Never writes over the 10 shipped forest PNGs — the draw maps below only
contain the new ids.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
S = 512            # supersample canvas
NATIVE = 44        # native crunch resolution
OUT = 64
PX = S / NATIVE    # supersample px per native px (~11.6)
OUTLINE = (16, 16, 32, 255)      # sampled from the shipped forest 10
SCLERA = (236, 236, 224, 255)
SPECULAR = (250, 250, 246, 255)
MOUTH = (56, 44, 38, 255)

# ---------------------------------------------------------------- helpers

def canvas():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def band(base, k):
    """Cel band of a material color.
    0 highlight / 1 base / 't' texture-dither shade / 2 shadow / 3 deep shadow."""
    f = {0: 1.30, 1: 1.0, 't': 0.90, 2: 0.72, 3: 0.52}[k]
    return tuple(min(255, int(c * f)) for c in base[:3]) + (255,)


def crunch(img):
    """Supersampled RGBA -> 16-bit-look 64x64."""
    small = img.resize((NATIVE, NATIVE), Image.NEAREST)
    big = small.resize((OUT, OUT), Image.NEAREST)
    px = big.load()
    for y in range(OUT):
        for x in range(OUT):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = ((r >> 4) * 17, (g >> 4) * 17, (b >> 4) * 17, 255)
    return big


def outline(img, width=10):
    """Dark outline around every opaque region (supersampled space)."""
    a = img.split()[3]
    grown = a.filter(ImageFilter.MaxFilter(width * 2 + 1))
    ol = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ol.paste(Image.new('RGBA', img.size, OUTLINE), (0, 0), grown)
    ol.paste(img, (0, 0), a)
    return ol


def checker(d, box, color, parity=0):
    """Checkerboard dither of native-pixel cells clipped to an ellipse —
    the scale texture the forest 10 wear on their bodies."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = max(1, (x1 - x0) / 2), max(1, (y1 - y0) / 2)
    for j in range(NATIVE):
        for i in range(NATIVE):
            if (i + j) % 2 != parity:
                continue
            mx, my = (i + .5) * PX, (j + .5) * PX
            if ((mx - cx) / rx) ** 2 + ((my - cy) / ry) ** 2 <= 1:
                d.rectangle([i * PX, j * PX, (i + 1) * PX - 1, (j + 1) * PX - 1],
                            fill=color)


def eyes(d, cx, cy, dx, r, iris=(74, 58, 42, 255)):
    """Signature big glossy eyes: dark rim -> near-white sclera -> iris -> specular."""
    for sx in (-1, 1):
        ex = cx + sx * dx
        d.ellipse([ex - r - 9, cy - r - 9, ex + r + 9, cy + r + 9], fill=OUTLINE)
        d.ellipse([ex - r, cy - r, ex + r, cy + r], fill=SCLERA)
        ir = r * 0.68
        d.ellipse([ex - ir, cy - ir + r * .1, ex + ir, cy + ir + r * .1], fill=iris)
        sr = max(10, r * 0.28)
        sx0, sy0 = ex - r * 0.5, cy - r * 0.55
        d.ellipse([sx0, sy0, sx0 + 2 * sr, sy0 + 2 * sr], fill=SPECULAR)


def dot_eyes(d, cx, cy, dx, r=15, color=(45, 35, 30, 255)):
    """Simple dark dot eyes — humans (villagers), never the big sclera."""
    for sx in (-1, 1):
        d.ellipse([cx + sx * dx - r, cy - r, cx + sx * dx + r, cy + r], fill=color)


def smile(d, cx, cy, w=64, color=MOUTH):
    d.arc([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], 30, 150,
          fill=color, width=11)


def blush(d, cx, cy, dx, w=34, h=22, color=(219, 138, 127, 255)):
    for sx in (-1, 1):
        d.ellipse([cx + sx * dx - w / 2, cy - h / 2,
                   cx + sx * dx + w / 2, cy + h / 2], fill=color)


def body(d, box, base, tex=True, hi=True, sh=True):
    """Round cel-banded body: base fill + checker scale texture +
    top highlight chord + bottom shadow chord."""
    x0, y0, x1, y1 = box
    h = y1 - y0
    d.ellipse(box, fill=band(base, 1))
    if tex:
        checker(d, [x0 + 18, y0 + 18, x1 - 18, y1 - 18], band(base, 't'))
    if hi:
        d.chord([x0 + 16, y0 + 10, x1 - 16, y1 - h * 0.38], 195, 345,
                fill=band(base, 0))
    if sh:
        d.chord([x0 + 12, y0 + h * 0.44, x1 - 12, y1 - 6], 15, 165,
                fill=band(base, 2))


def feet(d, cx, y, dx, base, w=62, h=38):
    for sx in (-1, 1):
        d.ellipse([cx + sx * dx - w / 2, y - h / 2,
                   cx + sx * dx + w / 2, y + h / 2], fill=band(base, 2))


# ------------------------------------------------- water creatures (4)

def draw_ripplefrog():
    img, d = canvas()
    G = (104, 168, 116)
    RIP = (108, 148, 176)
    # blue ripple ring behind the feet
    d.ellipse([100, 394, 412, 462], outline=band(RIP, 1), width=16)
    d.ellipse([158, 410, 354, 450], outline=band(RIP, 0), width=12)
    # lily-pad eye bumps on top
    for sx in (-1, 1):
        bx = 256 + sx * 88
        d.ellipse([bx - 62, 96, bx + 62, 224], fill=band(G, 1))
    body(d, [118, 152, 394, 428], G)
    eyes(d, 256, 158, 88, 42, iris=(58, 74, 46, 255))
    smile(d, 256, 292, 66)
    blush(d, 256, 312, 110)
    feet(d, 256, 420, 80, G)
    return outline(img)


def draw_puddleduck():
    img, d = canvas()
    Y = (222, 198, 132)
    B = (198, 124, 58)
    P = (116, 152, 180)
    # puddle at the feet
    d.ellipse([106, 406, 406, 462], fill=band(P, 1))
    d.ellipse([152, 418, 360, 452], fill=band(P, 0))
    # tail-feather tuft
    d.pieslice([84, 250, 190, 360], 120, 260, fill=band(Y, 2))
    body(d, [128, 128, 384, 416], Y)
    # wing nub
    d.ellipse([320, 250, 396, 340], fill=band(Y, 2))
    # hair sprig
    d.line([256, 94, 256, 132], fill=band(Y, 2), width=12)
    d.line([256, 100, 226, 82], fill=band(Y, 2), width=12)
    eyes(d, 256, 216, 66, 40)
    # bill
    d.ellipse([204, 262, 308, 318], fill=band(B, 1))
    d.chord([208, 262, 304, 296], 195, 345, fill=band(B, 0))
    blush(d, 256, 300, 106)
    # orange feet on the puddle
    feet(d, 256, 420, 66, B, w=56, h=30)
    return outline(img)


def draw_koisprite():
    img, d = canvas()
    W = (226, 218, 200)
    O = (206, 122, 70)
    # flowing tail fin, right side
    d.polygon([(360, 240), (470, 150), (444, 262), (474, 368), (356, 320)],
              fill=band(W, 1))
    d.polygon([(404, 218), (462, 170), (444, 262), (458, 344), (400, 308)],
              fill=band(O, 1))
    d.line([412, 236, 448, 200], fill=band(W, 1), width=10)
    d.line([414, 292, 450, 322], fill=band(W, 1), width=10)
    # pale glow dots
    for gx, gy, gr in ((110, 120, 14), (416, 92, 12), (78, 260, 12)):
        d.ellipse([gx - gr, gy - gr, gx + gr, gy + gr],
                  fill=(240, 236, 214, 255))
    # side fins
    d.ellipse([84, 280, 160, 366], fill=band(W, 2))
    body(d, [112, 148, 382, 420], W)
    # orange koi patches
    d.ellipse([150, 162, 254, 240], fill=band(O, 1))
    checker(d, [160, 172, 244, 232], band(O, 0))
    d.ellipse([268, 310, 352, 380], fill=band(O, 1))
    eyes(d, 248, 236, 70, 40)
    smile(d, 248, 316, 56)
    blush(d, 248, 330, 104)
    return outline(img)


def draw_mistleotter():
    img, d = canvas()
    B = (146, 108, 78)
    C = (222, 198, 164)
    M = (168, 174, 184)
    # grey mist wisps around the body
    for mx, my, mw, mh in ((62, 302, 114, 44), (48, 352, 128, 44),
                           (352, 314, 114, 44), (368, 364, 126, 42)):
        d.ellipse([mx, my, mx + mw, my + mh], fill=band(M, 1))
        d.ellipse([mx + 14, my + 8, mx + mw - 14, my + mh - 6],
                  fill=band(M, 0))
    # round ears
    for sx in (-1, 1):
        ex = 256 + sx * 96
        d.ellipse([ex - 44, 100, ex + 44, 188], fill=band(B, 2))
        d.ellipse([ex - 24, 122, ex + 24, 172], fill=band(B, 't'))
    body(d, [124, 140, 388, 424], B)
    # cream belly
    d.ellipse([180, 252, 332, 408], fill=band(C, 1))
    checker(d, [194, 268, 318, 396], band(C, 't'))
    eyes(d, 256, 208, 68, 40)
    # muzzle + nose
    d.ellipse([222, 262, 290, 314], fill=band(C, 0))
    d.polygon([(242, 272), (270, 272), (256, 292)], fill=MOUTH)
    blush(d, 256, 296, 112)
    feet(d, 256, 418, 74, B)
    return outline(img)


# ----------------------------------------------------------- pets (6)

def draw_pondsnail():
    img, d = canvas()
    C = (216, 192, 150)
    SH = (158, 112, 76)
    # stub antennae with dot tips
    for ax in (150, 214):
        d.line([ax, 240, ax - 10, 158], fill=band(C, 2), width=13)
        d.ellipse([ax - 26, 128, ax + 4, 158], fill=band(C, 1))
    # slug body: head + low foot
    d.ellipse([108, 226, 244, 358], fill=band(C, 1))
    d.ellipse([108, 318, 366, 428], fill=band(C, 1))
    checker(d, [122, 330, 352, 420], band(C, 't'))
    d.chord([112, 360, 362, 430], 15, 165, fill=band(C, 2))
    # spiral shell
    d.ellipse([218, 128, 424, 336], fill=band(SH, 1))
    checker(d, [236, 146, 406, 318], band(SH, 't'))
    d.chord([224, 220, 418, 332], 15, 165, fill=band(SH, 2))
    d.arc([248, 158, 394, 306], 260, 200, fill=band(SH, 3), width=14)
    d.arc([288, 196, 354, 264], 300, 240, fill=band(SH, 3), width=13)
    eyes(d, 176, 268, 30, 28)
    smile(d, 176, 322, 40)
    return outline(img)


def draw_waterbeetle():
    img, d = canvas()
    B = (66, 76, 100)
    # tiny legs
    for sx in (-1, 1):
        for ly in (300, 360):
            d.line([256 + sx * 120, ly, 256 + sx * 172, ly + 44],
                   fill=band(B, 2), width=14)
    # glossy dome
    d.ellipse([124, 152, 388, 424], fill=band(B, 1))
    checker(d, [140, 170, 372, 408], band(B, 't'))
    d.chord([128, 268, 384, 420], 15, 165, fill=band(B, 3))
    # banded shell shine
    d.chord([142, 164, 370, 300], 195, 345, fill=(118, 132, 160, 255))
    d.arc([158, 186, 354, 380], 200, 280, fill=(160, 174, 198, 255), width=15)
    # wing-case seam
    d.line([256, 232, 256, 420], fill=band(B, 3), width=12)
    eyes(d, 256, 306, 66, 34)
    smile(d, 256, 372, 46)
    return outline(img)


def draw_dragonfly():
    img, d = canvas()
    T = (86, 158, 148)
    W = (202, 214, 216)
    # four pale wings, dithered for translucency
    for wx0, wy0, wx1, wy1 in ((36, 168, 232, 260), (280, 168, 476, 260),
                               (70, 268, 236, 344), (276, 268, 442, 344)):
        d.ellipse([wx0, wy0, wx1, wy1], fill=band(W, 1))
        checker(d, [wx0 + 10, wy0 + 8, wx1 - 10, wy1 - 8], band(W, 't'))
    # slim segmented abdomen
    d.rounded_rectangle([226, 258, 288, 446], radius=30, fill=band(T, 1))
    for sy in (312, 358, 404):
        d.line([230, sy, 284, sy], fill=band(T, 2), width=11)
    # big round head
    d.ellipse([172, 104, 340, 272], fill=band(T, 1))
    checker(d, [188, 120, 324, 256], band(T, 't'))
    d.chord([180, 110, 332, 210], 195, 345, fill=band(T, 0))
    eyes(d, 256, 182, 46, 38, iris=(52, 68, 60, 255))
    smile(d, 256, 240, 40)
    return outline(img)


def draw_pebbleturtle():
    img, d = canvas()
    G = (122, 142, 108)
    P = (152, 150, 138)
    # side feet
    feet(d, 256, 388, 138, G, w=66, h=44)
    # shell dome
    d.ellipse([116, 132, 396, 388], fill=band(G, 1))
    checker(d, [132, 148, 380, 372], band(G, 't'))
    d.chord([120, 240, 392, 384], 15, 165, fill=band(G, 2))
    # rounded pebble facets
    for px0, py0, pr in ((196, 178, 44), (306, 190, 40), (252, 268, 46),
                         (160, 268, 32), (346, 274, 32)):
        d.ellipse([px0 - pr - 8, py0 - pr - 8, px0 + pr + 8, py0 + pr + 8],
                  fill=band(G, 2))
        d.ellipse([px0 - pr, py0 - pr, px0 + pr, py0 + pr], fill=band(P, 1))
        d.chord([px0 - pr, py0 - pr, px0 + pr, py0 + pr], 195, 345,
                fill=band(P, 0))
    # head peeking below
    d.ellipse([206, 316, 306, 428], fill=band(G, 0))
    eyes(d, 256, 362, 26, 24)
    smile(d, 256, 404, 34)
    return outline(img)


def draw_crawdad():
    img, d = canvas()
    R = (172, 84, 64)
    # antennae
    d.line([222, 160, 186, 86], fill=band(R, 2), width=12)
    d.line([290, 160, 326, 86], fill=band(R, 2), width=12)
    # segmented tail fanning below
    for i, (ty, tw) in enumerate(((392, 150), (420, 118), (444, 84))):
        d.ellipse([256 - tw / 2, ty - 26, 256 + tw / 2, ty + 26],
                  fill=band(R, 2 if i % 2 else 1))
    # two big front claws
    for sx in (-1, 1):
        cx = 256 + sx * 148
        d.line([256 + sx * 90, 260, cx, 210], fill=band(R, 2), width=22)
        d.ellipse([cx - 58, 120, cx + 58, 246], fill=band(R, 1))
        d.chord([cx - 54, 124, cx + 54, 200], 195, 345, fill=band(R, 0))
        # pincer notch
        d.polygon([(cx - 20 * sx, 108), (cx + 34 * sx, 150),
                   (cx - 20 * sx, 176)], fill=(0, 0, 0, 0))
    body(d, [148, 186, 364, 404], R)
    eyes(d, 256, 254, 56, 34)
    smile(d, 256, 322, 44)
    blush(d, 256, 334, 92, w=28, h=18)
    return outline(img)


def draw_pondnewt():
    img, d = canvas()
    N = (98, 112, 64)
    O = (212, 128, 56)
    # curled tail on the right
    d.arc([300, 230, 470, 400], 250, 140, fill=band(N, 1), width=34)
    d.ellipse([414, 222, 462, 268], fill=band(N, 1))
    body(d, [116, 156, 366, 418], N)
    # bright orange belly
    d.chord([136, 250, 346, 414], 10, 170, fill=band(O, 1))
    checker(d, [166, 300, 318, 404], band(O, 0))
    eyes(d, 240, 224, 62, 38, iris=(70, 52, 34, 255))
    smile(d, 240, 300, 50)
    feet(d, 240, 414, 72, N, w=56, h=34)
    return outline(img)


# ---------------------------------------------------------- crops (4)

def draw_wheat():
    img, d = canvas()
    G = (200, 164, 84)
    T = (150, 106, 62)
    # 3 stalks fanning from the tie
    for dx, top in ((-96, 150), (0, 108), (96, 150)):
        d.line([256 + dx * 0.2, 360, 256 + dx, top + 96], fill=band(G, 2),
               width=13)
        # grain head: stacked kernel pairs
        for i in range(4):
            ky = top + i * 44
            kx = 256 + dx * (0.55 + i * 0.15)
            d.ellipse([kx - 34, ky - 26, kx + 34, ky + 26], fill=band(G, 1))
            d.line([kx, ky - 22, kx, ky + 22], fill=band(G, 2), width=10)
        d.ellipse([kx - 24, ky + 6, kx + 24, ky + 44], fill=band(G, 0))
    # stem bundle below the tie
    for dx in (-30, 0, 30):
        d.line([256 + dx, 356, 256 + dx * 1.4, 452], fill=band(G, 2), width=14)
        d.line([256 + dx, 356, 256 + dx * 1.4, 448], fill=band(G, 1), width=8)
    # tied band
    d.rounded_rectangle([196, 330, 316, 378], radius=18, fill=band(T, 1))
    d.line([222, 334, 210, 374], fill=band(T, 2), width=10)
    d.line([290, 334, 302, 374], fill=band(T, 2), width=10)
    return outline(img)


def draw_carrot():
    img, d = canvas()
    O = (206, 118, 52)
    G = (108, 148, 76)
    # green frilly top
    for dx, tip in ((-70, 96), (0, 68), (70, 96)):
        d.polygon([(256 - 22 + dx * 0.2, 208), (256 + 22 + dx * 0.2, 208),
                   (256 + dx, tip)], fill=band(G, 1))
        d.line([256 + dx * 0.6, 200, 256 + dx * 0.85, tip + 40],
               fill=band(G, 2), width=10)
    # taper root
    d.polygon([(168, 214), (344, 214), (282, 428), (238, 428)], fill=band(O, 1))
    d.ellipse([168, 176, 344, 254], fill=band(O, 1))
    checker(d, [184, 190, 328, 250], band(O, 't'))
    d.chord([176, 180, 336, 240], 195, 345, fill=band(O, 0))
    # ridge lines
    for ry, rw in ((280, 116), (332, 86), (384, 56)):
        d.line([256 - rw / 2, ry, 256 + rw / 2, ry], fill=band(O, 2), width=11)
    # rounded tip
    d.ellipse([236, 404, 284, 448], fill=band(O, 2))
    return outline(img)


def draw_sapling():
    img, d = canvas()
    G = (86, 126, 82)
    B = (124, 90, 62)
    E = (110, 84, 58)
    # earth mound base
    d.ellipse([150, 396, 362, 456], fill=band(E, 1))
    checker(d, [166, 404, 346, 450], band(E, 't'))
    d.chord([154, 414, 358, 456], 15, 165, fill=band(E, 2))
    # trunk
    d.rectangle([238, 320, 274, 416], fill=band(B, 1))
    # two green tiers
    d.polygon([(132, 344), (380, 344), (256, 200)], fill=band(G, 1))
    d.polygon([(150, 344), (256, 344), (256, 222), (196, 290)],
              fill=band(G, 0))
    d.polygon([(256, 344), (376, 344), (306, 262)], fill=band(G, 2))
    d.polygon([(164, 246), (348, 246), (256, 120)], fill=band(G, 1))
    d.polygon([(176, 246), (256, 246), (256, 136), (210, 200)],
              fill=band(G, 0))
    d.polygon([(256, 246), (344, 246), (296, 186)], fill=band(G, 2))
    return outline(img)


def draw_marigold():
    img, d = canvas()
    O = (212, 148, 56)
    C = (226, 180, 88)
    G = (104, 140, 72)
    # stem + leaf
    d.line([256, 300, 256, 452], fill=band(G, 1), width=16)
    d.ellipse([268, 352, 356, 408], fill=band(G, 1))
    d.line([272, 386, 344, 372], fill=band(G, 2), width=9)
    # layered bloom: outer petal ring
    import math
    for a in range(8):
        th = a * math.pi / 4 + math.pi / 8
        px0 = 256 + 96 * math.cos(th)
        py0 = 196 + 96 * math.sin(th)
        d.ellipse([px0 - 52, py0 - 52, px0 + 52, py0 + 52], fill=band(O, 1))
    # inner petal ring
    for a in range(6):
        th = a * math.pi / 3
        px0 = 256 + 52 * math.cos(th)
        py0 = 196 + 52 * math.sin(th)
        d.ellipse([px0 - 40, py0 - 40, px0 + 40, py0 + 40], fill=band(C, 1))
    checker(d, [176, 116, 336, 276], band(C, 0))
    # center
    d.ellipse([216, 156, 296, 236], fill=(168, 110, 48, 255))
    d.ellipse([232, 172, 268, 208], fill=band(O, 0))
    return outline(img)


# ------------------------------------------------------ villagers (3)

def bust(d, skin, shirt):
    """Chibi villager bust: shoulder arc + round head."""
    d.chord([104, 344, 408, 560], 180, 360, fill=band(shirt, 1))
    d.chord([124, 400, 388, 560], 180, 360, fill=band(shirt, 0))
    d.ellipse([152, 104, 360, 330], fill=band(skin, 1))
    d.chord([160, 200, 352, 326], 30, 150, fill=band(skin, 't'))


def draw_vil_1():  # Pip — young farmer: straw hat, freckles, green shirt
    img, d = canvas()
    SKIN = (224, 182, 146)
    HAT = (208, 178, 108)
    SHIRT = (110, 142, 92)
    bust(d, SKIN, SHIRT)
    # straw hat: dome + wide brim
    d.chord([176, 68, 336, 208], 180, 360, fill=band(HAT, 1))
    checker(d, [190, 84, 322, 190], band(HAT, 't'))
    d.ellipse([124, 138, 388, 202], fill=band(HAT, 1))
    d.chord([128, 168, 384, 204], 15, 165, fill=band(HAT, 2))
    dot_eyes(d, 256, 252, 48)
    # freckles
    for fx, fy in ((186, 286), (208, 298), (306, 298), (328, 286)):
        d.ellipse([fx - 9, fy - 8, fx + 9, fy + 8], fill=band(SKIN, 2))
    smile(d, 256, 282, 44)
    blush(d, 256, 292, 92, w=26, h=16)
    return outline(img)


def draw_vil_2():  # Nan — granny: grey bun, round glasses, shawl
    img, d = canvas()
    SKIN = (226, 190, 158)
    HAIR = (188, 188, 184)
    SHAWL = (148, 108, 118)
    bust(d, SKIN, SHAWL)
    # shawl V-fold
    d.line([256, 352, 216, 444], fill=band(SHAWL, 2), width=14)
    d.line([256, 352, 296, 444], fill=band(SHAWL, 2), width=14)
    # grey hair cap + bun on top
    d.chord([150, 102, 362, 262], 180, 360, fill=band(HAIR, 1))
    checker(d, [166, 114, 346, 216], band(HAIR, 't'))
    d.ellipse([214, 52, 298, 136], fill=band(HAIR, 1))
    d.chord([220, 56, 292, 110], 195, 345, fill=band(HAIR, 0))
    # round glasses
    for sx in (-1, 1):
        gx = 256 + sx * 48
        d.ellipse([gx - 40, 218, gx + 40, 298], outline=MOUTH, width=11)
    d.line([230, 254, 282, 254], fill=MOUTH, width=10)
    dot_eyes(d, 256, 258, 48, r=13)
    smile(d, 256, 296, 38)
    return outline(img)


def draw_vil_3():  # Rowan — brown beard, tousled hair, mustard tunic
    img, d = canvas()
    SKIN = (218, 172, 134)
    HAIR = (116, 84, 58)
    TUNIC = (192, 152, 72)
    bust(d, SKIN, TUNIC)
    # tunic collar
    d.line([256, 350, 216, 420], fill=band(TUNIC, 2), width=13)
    d.line([256, 350, 296, 420], fill=band(TUNIC, 2), width=13)
    # tousled hair: cap + spiky fringe
    d.chord([150, 100, 362, 250], 180, 360, fill=band(HAIR, 1))
    for hx, hy in ((176, 196), (216, 206), (256, 210), (296, 206), (336, 196)):
        d.ellipse([hx - 26, hy - 30, hx + 26, hy + 30], fill=band(HAIR, 1))
    checker(d, [168, 112, 344, 200], band(HAIR, 't'))
    # beard covering the lower face
    d.ellipse([170, 226, 342, 356], fill=band(HAIR, 1))
    checker(d, [184, 240, 328, 344], band(HAIR, 't'))
    d.ellipse([222, 236, 290, 288], fill=band(SKIN, 1))  # mouth patch
    smile(d, 256, 254, 40)
    dot_eyes(d, 256, 216, 48)
    return outline(img)


# ------------------------------------------------------------- driver

SPRITES = {
    'water': {'dir': 'creatures', 'draw': {
        'ripplefrog': draw_ripplefrog,
        'puddleduck': draw_puddleduck,
        'koisprite': draw_koisprite,
        'mistleotter': draw_mistleotter,
    }},
    'pets': {'dir': 'pets', 'draw': {
        'pondsnail': draw_pondsnail,
        'waterbeetle': draw_waterbeetle,
        'dragonfly': draw_dragonfly,
        'pebbleturtle': draw_pebbleturtle,
        'crawdad': draw_crawdad,
        'pondnewt': draw_pondnewt,
    }},
    'crops': {'dir': 'crops', 'draw': {
        'wheat': draw_wheat,
        'carrot': draw_carrot,
        'sapling': draw_sapling,
        'marigold': draw_marigold,
    }},
    'villagers': {'dir': 'villagers', 'draw': {
        'vil-1': draw_vil_1,
        'vil-2': draw_vil_2,
        'vil-3': draw_vil_3,
    }},
}


def contact_sheet():
    files = sorted((ROOT / 'assets').glob('creatures/*.png')) + \
            sorted((ROOT / 'assets').glob('pets/*.png')) + \
            sorted((ROOT / 'assets').glob('crops/*.png')) + \
            sorted((ROOT / 'assets').glob('villagers/*.png'))
    cols = 7
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * 68, rows * 68), (40, 44, 52, 255))
    for i, f in enumerate(files):
        im = Image.open(f).convert('RGBA')
        sheet.paste(im, ((i % cols) * 68 + 2, (i // cols) * 68 + 2), im)
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST) \
         .save(ROOT / 'scripts' / 'contact-sheet.png')


def main():
    groups = sys.argv[1:] or list(SPRITES)
    for g in groups:
        spec = SPRITES[g]
        out_dir = ROOT / 'assets' / spec['dir']
        out_dir.mkdir(parents=True, exist_ok=True)
        for sid, fn in spec['draw'].items():
            im = crunch(fn())
            im.save(out_dir / f'{sid}.png')
            ncol = len(set(p for p in im.getdata() if p[3] > 0))
            flag = '  <-- TOO MANY COLORS' if ncol > 20 else ''
            print(f'{spec["dir"]}/{sid}.png  {im.size[0]}x{im.size[1]}  '
                  f'{ncol} colors{flag}')
    contact_sheet()
    print('scripts/contact-sheet.png')


if __name__ == '__main__':
    main()
