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
import math
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
    W = (184, 200, 206)
    # four pale wings, dithered for translucency — clear gap between pairs
    for wx0, wy0, wx1, wy1 in ((56, 152, 218, 220), (294, 152, 456, 220),
                               (92, 244, 226, 302), (286, 244, 420, 302)):
        d.ellipse([wx0, wy0, wx1, wy1], fill=band(W, 1))
        checker(d, [wx0 + 10, wy0 + 8, wx1 - 10, wy1 - 8], (150, 168, 178, 255))
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
    G = (116, 150, 108)      # shell green
    P = (176, 170, 154)      # pebble stone — lighter/warmer so facets pop
    SKIN = (158, 184, 140)   # head green, lighter than the shell so it reads apart
    # four stubby legs peeking under the shell
    feet(d, 256, 398, 152, G, w=74, h=48)
    # head below the shell rim (drawn first so the shell sits on top of its crown)
    d.ellipse([198, 322, 314, 452], fill=band(SKIN, 1))
    d.chord([202, 326, 310, 402], 195, 345, fill=band(SKIN, 0))
    eyes(d, 256, 376, 33, 25)
    smile(d, 256, 422, 40)
    # domed shell
    d.ellipse([110, 118, 402, 364], fill=band(G, 1))
    d.chord([120, 120, 392, 284], 195, 345, fill=band(G, 0))   # top-lit dome
    d.chord([116, 234, 396, 360], 15, 165, fill=band(G, 2))    # underside shadow
    # cobbled facets: dark rim -> stone -> highlight chord -> specular glint
    for px0, py0, pr in ((196, 188, 50), (314, 202, 44),
                         (250, 286, 52), (150, 286, 30), (352, 290, 28)):
        d.ellipse([px0 - pr - 11, py0 - pr - 11, px0 + pr + 11, py0 + pr + 11],
                  fill=band(G, 3))
        d.ellipse([px0 - pr, py0 - pr, px0 + pr, py0 + pr], fill=band(P, 1))
        d.chord([px0 - pr, py0 - pr, px0 + pr, py0 + pr], 195, 345, fill=band(P, 0))
        gr = pr * 0.30
        gx, gy = px0 - pr * 0.42, py0 - pr * 0.52
        d.ellipse([gx, gy, gx + 2 * gr, gy + 2 * gr], fill=SPECULAR)
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
    O = (198, 122, 60)
    # curled tail on the right: thick curl + inner spiral dot
    d.arc([326, 248, 468, 390], 235, 140, fill=band(N, 1), width=36)
    d.ellipse([376, 296, 420, 340], fill=band(N, 1))
    body(d, [116, 156, 366, 418], N)
    # bright orange belly
    d.chord([136, 250, 346, 414], 10, 170, fill=band(O, 1))
    checker(d, [166, 300, 318, 404], band(O, 't'))
    eyes(d, 240, 224, 62, 38, iris=(70, 52, 34, 255))
    smile(d, 240, 300, 50)
    feet(d, 240, 414, 72, N, w=56, h=34)
    return outline(img)


# ---------------------------------------------------------- crops (4)

def draw_wheat():
    img, d = canvas()
    G = (206, 168, 86)      # golden grain
    A = (228, 200, 122)     # bright awn / kernel highlight
    T = (150, 106, 62)      # twine tie
    # three pointed ears, center taller; each = a tapered lozenge + awns + chevrons
    for dx, top in ((-96, 176), (0, 122), (96, 176)):
        cx = 256 + dx
        tip = top - 34
        earbot = top + 150
        # awns fanning up from the tip
        for ax in (-2, -1, 1, 2):
            d.line([cx, tip + 8, cx + ax * 24, tip - 76], fill=band(A, 0), width=6)
        # stalk from the ear down to the tie
        d.line([cx, earbot - 20, 256 + dx * 0.22, 372], fill=band(G, 2), width=12)
        # ear body (tall lozenge) + top-lit sheen
        d.ellipse([cx - 33, tip, cx + 33, earbot], fill=band(G, 1))
        d.chord([cx - 33, tip, cx + 33, earbot - 70], 195, 345, fill=band(A, 1))
        # kernel chevrons down the ear
        for i in range(5):
            ky = top + 6 + i * 30
            d.line([cx - 27, ky, cx, ky + 17], fill=band(G, 2), width=7)
            d.line([cx + 27, ky, cx, ky + 17], fill=band(G, 2), width=7)
    # stalks flaring below the tie
    for dx in (-40, 0, 40):
        d.line([256 + dx * 0.3, 372, 256 + dx, 466], fill=band(G, 2), width=13)
        d.line([256 + dx * 0.3, 372, 256 + dx, 462], fill=band(G, 1), width=6)
    # tied band
    d.rounded_rectangle([198, 344, 314, 392], radius=18, fill=band(T, 1))
    d.chord([202, 366, 310, 396], 15, 165, fill=band(T, 2))
    d.line([236, 348, 222, 388], fill=band(T, 2), width=9)
    d.line([276, 348, 290, 388], fill=band(T, 2), width=9)
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


def draw_vil_1():  # Pip — young farmer: straw hat, sandy hair, freckles, green shirt
    img, d = canvas()
    SKIN = (226, 184, 148)
    HAIR = (198, 146, 78)   # sandy hair peeking under the brim
    HAT = (208, 170, 88)
    FRECKLE = (198, 122, 92, 255)
    SHIRT = (108, 148, 92)
    bust(d, SKIN, SHIRT)
    # sandy hair: side tufts + a forelock, drawn before the hat so the brim overlaps it
    for hx in (176, 214, 298, 336):
        d.ellipse([hx - 26, 176, hx + 26, 236], fill=band(HAIR, 1))
    d.ellipse([232, 156, 300, 214], fill=band(HAIR, 1))
    d.chord([236, 158, 296, 200], 195, 345, fill=band(HAIR, 0))
    # straw hat: dome + wide brim + band
    d.chord([172, 56, 340, 198], 180, 360, fill=band(HAT, 1))
    checker(d, [186, 72, 326, 180], band(HAT, 't'))
    d.chord([176, 58, 336, 150], 195, 345, fill=band(HAT, 0))    # dome sheen
    d.rounded_rectangle([174, 156, 338, 190], radius=14, fill=band(HAT, 3))
    d.ellipse([110, 138, 402, 206], fill=band(HAT, 1))
    d.chord([116, 170, 396, 208], 15, 165, fill=band(HAT, 2))
    d.chord([120, 140, 392, 196], 195, 345, fill=band(HAT, 0))   # brim top edge
    dot_eyes(d, 256, 252, 48)
    blush(d, 256, 292, 98, w=42, h=24)
    # freckles across the nose — warmer + clearer
    for fx, fy in ((198, 282), (218, 294), (294, 294), (314, 282)):
        d.ellipse([fx - 8, fy - 7, fx + 8, fy + 7], fill=FRECKLE)
    smile(d, 256, 294, 40)
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
    d.chord([150, 98, 362, 226], 180, 360, fill=band(HAIR, 1))
    for hx, hy in ((176, 172), (216, 182), (256, 186), (296, 182), (336, 172)):
        d.ellipse([hx - 26, hy - 28, hx + 26, hy + 28], fill=band(HAIR, 1))
    checker(d, [168, 110, 344, 180], band(HAIR, 't'))
    # beard covering the lower face
    d.ellipse([172, 258, 340, 372], fill=band(HAIR, 1))
    checker(d, [186, 272, 326, 360], band(HAIR, 't'))
    d.ellipse([230, 282, 282, 322], fill=band(SKIN, 2))  # mouth patch
    smile(d, 256, 294, 34)
    dot_eyes(d, 256, 232, 48)
    return outline(img)


# ---------------------------------------------------- landmarks (8)

def draw_bakery():
    img, d = canvas()
    W = (226, 200, 156)   # cream wall
    R = (190, 98, 76)     # red-brown roof
    DR = (150, 104, 64)   # wood door
    GL = (150, 182, 202)  # window glass
    L = (214, 168, 96)    # bread-loaf sign
    # wall
    d.rectangle([156, 262, 356, 452], fill=band(W, 1))
    checker(d, [172, 300, 340, 440], band(W, 't'))
    d.chord([158, 264, 354, 340], 195, 345, fill=band(W, 0))
    # pitched roof, overhanging the wall
    d.polygon([(120, 268), (392, 268), (330, 150), (182, 150)], fill=band(R, 1))
    d.polygon([(120, 268), (256, 268), (256, 150), (182, 150)], fill=band(R, 0))
    d.polygon([(256, 268), (392, 268), (330, 150)], fill=band(R, 2))
    # door
    d.rounded_rectangle([224, 350, 286, 452], radius=28, fill=band(DR, 1))
    d.chord([226, 352, 284, 410], 195, 345, fill=band(DR, 0))
    d.ellipse([272, 398, 284, 410], fill=band(DR, 3))   # knob
    # window with a top-lit pane
    d.rounded_rectangle([288, 300, 342, 352], radius=10, fill=band(GL, 1))
    d.chord([290, 302, 340, 328], 195, 345, fill=band(GL, 0))
    # round loaf sign over the door
    d.ellipse([224, 296, 288, 340], fill=band(L, 1))
    d.arc([234, 304, 278, 332], 200, 340, fill=band(L, 2), width=7)
    return outline(img)


def draw_fountain():
    img, d = canvas()
    S = (192, 190, 182)   # stone
    WA = (128, 178, 208)  # water
    # lower basin
    d.ellipse([96, 392, 416, 460], fill=band(S, 1))
    d.chord([100, 420, 412, 460], 15, 165, fill=band(S, 2))
    # water pooled in the basin
    d.ellipse([132, 398, 380, 438], fill=band(WA, 1))
    d.chord([140, 400, 372, 424], 195, 345, fill=band(WA, 0))
    # pedestal
    d.rectangle([232, 300, 280, 404], fill=band(S, 1))
    d.chord([234, 302, 278, 340], 195, 345, fill=band(S, 0))
    # upper bowl
    d.ellipse([176, 294, 336, 340], fill=band(S, 1))
    d.chord([180, 320, 332, 342], 15, 165, fill=band(S, 2))
    # water plume rising up the centre
    d.rounded_rectangle([244, 206, 268, 306], radius=12, fill=band(WA, 1))
    for dxp in (-30, 0, 30):
        d.ellipse([256 + dxp - 11, 188, 256 + dxp + 11, 214], fill=band(WA, 0))
    # streams falling from the upper bowl into the basin
    for sx in (-1, 1):
        d.line([256 + sx * 64, 328, 256 + sx * 92, 404],
               fill=band(WA, 0), width=12)
    return outline(img)


def draw_lanterns():
    img, d = canvas()
    B = (140, 100, 64)    # wood post + bar
    R = (206, 74, 58)     # red paper lantern
    G = (216, 170, 78)    # gold cap + tassel
    # ground post
    d.rectangle([244, 168, 268, 452], fill=band(B, 1))
    d.chord([246, 170, 266, 260], 195, 345, fill=band(B, 0))
    # crossbar
    d.rounded_rectangle([120, 150, 392, 178], radius=12, fill=band(B, 1))
    d.chord([122, 150, 390, 168], 195, 345, fill=band(B, 0))
    # three hanging lanterns
    for lx in (176, 256, 336):
        d.line([lx, 178, lx, 212], fill=band(B, 2), width=8)      # cord
        d.ellipse([lx - 12, 198, lx + 12, 222], fill=band(G, 1))  # top cap
        d.ellipse([lx - 46, 216, lx + 46, 320], fill=band(R, 1))  # body
        d.chord([lx - 44, 218, lx + 44, 284], 195, 345, fill=band(R, 0))
        d.chord([lx - 42, 286, lx + 42, 318], 15, 165, fill=band(R, 2))
        d.line([lx - 30, 268, lx + 30, 268], fill=band(R, 2), width=6)  # rib
        d.ellipse([lx - 12, 314, lx + 12, 338], fill=band(G, 1))  # bottom cap
        d.line([lx, 336, lx, 364], fill=band(G, 2), width=8)      # tassel
    return outline(img)


def draw_bridge():
    img, d = canvas()
    S = (186, 178, 164)   # stone
    WA = (120, 170, 202)  # water
    # water flowing behind
    d.rectangle([56, 402, 456, 460], fill=band(WA, 1))
    d.line([84, 420, 200, 420], fill=band(WA, 0), width=8)
    d.line([318, 434, 428, 434], fill=band(WA, 0), width=8)
    # stone hump
    d.pieslice([96, 250, 416, 610], 180, 360, fill=band(S, 1))
    d.chord([104, 252, 408, 470], 195, 345, fill=band(S, 0))
    # arch opening cut through, water + shadow under it
    d.pieslice([176, 372, 336, 640], 180, 360, fill=(0, 0, 0, 0))
    d.pieslice([182, 378, 330, 628], 180, 360, fill=band(WA, 1))
    d.chord([182, 378, 330, 470], 180, 360, fill=band(WA, 2))
    # railing coping + balusters along the crown
    d.arc([112, 236, 400, 566], 200, 340, fill=band(S, 2), width=14)
    for bx, by in ((160, 300), (208, 272), (256, 264), (304, 272), (352, 300)):
        d.line([bx, by, bx, by - 30], fill=band(S, 2), width=9)
    return outline(img)


def draw_gazebo():
    img, d = canvas()
    P = (222, 214, 198)   # cream posts + rail
    RF = (120, 152, 108)  # green roof
    WD = (150, 110, 72)   # wood floor
    # floor platform
    d.ellipse([132, 424, 380, 462], fill=band(WD, 1))
    d.chord([136, 442, 376, 462], 15, 165, fill=band(WD, 2))
    # posts
    for px0 in (168, 240, 272, 344):
        d.rectangle([px0 - 11, 250, px0 + 11, 432], fill=band(P, 1))
        d.chord([px0 - 11, 252, px0 + 11, 300], 195, 345, fill=band(P, 0))
    # balustrade
    d.rectangle([168, 360, 344, 388], fill=band(P, 1))
    d.chord([170, 378, 342, 390], 15, 165, fill=band(P, 2))
    # conical roof
    d.polygon([(112, 262), (400, 262), (256, 116)], fill=band(RF, 1))
    d.polygon([(112, 262), (256, 262), (256, 116)], fill=band(RF, 0))
    d.polygon([(256, 262), (400, 262), (256, 116)], fill=band(RF, 2))
    d.rounded_rectangle([104, 256, 408, 284], radius=12, fill=band(RF, 2))  # eave
    d.ellipse([242, 92, 270, 120], fill=band(P, 0))   # finial
    return outline(img)


def draw_market():
    img, d = canvas()
    WD = (150, 110, 70)   # wood posts + counter
    RS = (202, 82, 66)    # red awning stripe
    CS = (226, 208, 170)  # cream awning stripe
    F = (196, 132, 60)    # goods
    # posts
    for px0 in (150, 362):
        d.rectangle([px0 - 12, 210, px0 + 12, 440], fill=band(WD, 1))
        d.chord([px0 - 12, 212, px0 + 12, 262], 195, 345, fill=band(WD, 0))
    # counter
    d.rectangle([132, 372, 380, 424], fill=band(WD, 1))
    d.chord([134, 374, 378, 398], 195, 345, fill=band(WD, 0))
    d.chord([136, 410, 378, 424], 15, 165, fill=band(WD, 2))
    # striped awning + scalloped edge
    stripes = [(120, 176), (176, 232), (232, 288), (288, 344), (344, 400)]
    for i, (xa, xb) in enumerate(stripes):
        col = RS if i % 2 == 0 else CS
        d.polygon([(xa, 150), (xb, 150), (xb, 236), (xa, 236)], fill=band(col, 1))
        d.pieslice([xa, 214, xb, 262], 0, 180, fill=band(col, 2))
    d.rounded_rectangle([112, 142, 408, 166], radius=10, fill=band(RS, 2))  # ridge
    # goods on the counter
    for gx in (188, 232, 300, 340):
        d.ellipse([gx - 16, 346, gx + 16, 380], fill=band(F, 1))
    return outline(img)


def draw_koipond():
    img, d = canvas()
    RM = (150, 118, 78)   # earth rim
    G = (120, 158, 92)    # grassy edge
    WA = (108, 164, 200)  # water
    O = (222, 132, 66)    # koi orange
    C = (232, 224, 206)   # koi cream / patch
    LP = (96, 150, 88)    # lily pad
    # earth rim + grassy top edge
    d.ellipse([88, 300, 424, 462], fill=band(RM, 1))
    d.chord([92, 402, 420, 462], 15, 165, fill=band(RM, 2))
    d.ellipse([104, 296, 408, 396], fill=band(G, 1))
    # water
    d.ellipse([120, 320, 392, 446], fill=band(WA, 1))
    d.chord([128, 322, 384, 392], 195, 345, fill=band(WA, 0))
    # koi fish
    d.polygon([(198, 386), (150, 360), (152, 412)], fill=band(O, 2))  # tail
    d.ellipse([196, 356, 316, 416], fill=band(O, 1))
    d.ellipse([232, 366, 288, 406], fill=band(C, 1))   # cream patch
    d.ellipse([292, 378, 308, 394], fill=OUTLINE)      # eye
    # ripple
    d.arc([300, 328, 372, 372], 200, 340, fill=band(WA, 0), width=7)
    # lily pad with a notch
    d.ellipse([300, 334, 360, 380], fill=band(LP, 1))
    d.polygon([(330, 357), (362, 338), (358, 374)], fill=(0, 0, 0, 0))
    return outline(img)


def draw_windmill():
    img, d = canvas()
    T = (216, 200, 168)   # tower
    CAP = (150, 96, 76)   # cap roof
    WD = (140, 100, 64)   # sail wood + hub
    CL = (232, 224, 204)  # sail cloth
    DR = (120, 86, 56)    # door + window
    # tapered tower
    d.polygon([(196, 236), (316, 236), (338, 452), (174, 452)], fill=band(T, 1))
    d.polygon([(196, 236), (256, 236), (256, 452), (174, 452)], fill=band(T, 0))
    d.polygon([(256, 236), (316, 236), (338, 452), (256, 452)], fill=band(T, 2))
    # cap
    d.chord([182, 176, 330, 268], 180, 360, fill=band(CAP, 1))
    d.chord([186, 178, 326, 232], 195, 345, fill=band(CAP, 0))
    d.ellipse([248, 150, 264, 182], fill=band(CAP, 2))   # finial
    # door + window
    d.rounded_rectangle([234, 372, 278, 452], radius=20, fill=band(DR, 1))
    d.ellipse([238, 300, 274, 336], fill=band(DR, 1))
    # four-blade sail cross
    hx, hy = 256, 214
    L, w = 150, 20
    for ang in (45, 135, 225, 315):
        a = math.radians(ang)
        ex, ey = hx + L * math.cos(a), hy + L * math.sin(a)
        px = math.cos(a + math.pi / 2) * w
        py = math.sin(a + math.pi / 2) * w
        d.polygon([(hx + px, hy + py), (hx - px, hy - py),
                   (ex - px, ey - py), (ex + px, ey + py)], fill=band(WD, 1))
        d.polygon([(hx, hy), (ex, ey),
                   (ex + px * 2.4, ey + py * 2.4)], fill=band(CL, 1))  # cloth
    d.ellipse([236, 194, 276, 234], fill=band(WD, 2))   # hub
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
    'landmarks': {'dir': 'landmarks', 'draw': {
        'bakery': draw_bakery,
        'fountain': draw_fountain,
        'lanterns': draw_lanterns,
        'bridge': draw_bridge,
        'gazebo': draw_gazebo,
        'market': draw_market,
        'koipond': draw_koipond,
        'windmill': draw_windmill,
    }},
}


def contact_sheet():
    files = sorted((ROOT / 'assets').glob('creatures/*.png')) + \
            sorted((ROOT / 'assets').glob('pets/*.png')) + \
            sorted((ROOT / 'assets').glob('crops/*.png')) + \
            sorted((ROOT / 'assets').glob('villagers/*.png')) + \
            sorted((ROOT / 'assets').glob('landmarks/*.png'))
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
