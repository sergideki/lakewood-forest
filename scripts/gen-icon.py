#!/usr/bin/env python3
"""Generate Lakewood Forest app icons from code (no external services).

Cozy forest-lake scene in the game's palette (mint #8ed49a on warm sky). Draws at 4x and
downsamples with LANCZOS for clean edges. Writes every asset app.json references, matching the
existing dimensions/modes:

  assets/icon.png                     1024x1024 RGB   (main / iOS / stores — full-bleed scene)
  assets/android-icon-background.png   512x512  RGBA  (adaptive background — sky gradient)
  assets/android-icon-foreground.png   512x512  RGBA  (adaptive foreground — tree+lake, safe-zone)
  assets/android-icon-monochrome.png   432x432  RGBA  (themed-icon silhouette, white+alpha)
  assets/favicon.png                    48x48   RGBA  (web)
  assets/splash-icon.png              1024x1024 RGBA  (splash — centered motif)

Run: python3 scripts/gen-icon.py
"""
import os
from PIL import Image, ImageDraw

SS = 4  # supersample factor
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")

# palette (game theme + warm cozy sky)
SKY_TOP = (245, 236, 216)
SKY_BOT = (191, 230, 203)
SUN = (251, 228, 160)
SUN_GLOW = (252, 240, 200)
HILL_BACK = (134, 199, 154)
HILL_FRONT = (95, 168, 119)
TREE_DARK = (44, 106, 64)
TREE_MID = (50, 122, 73)
TREE_TIP = (142, 212, 154)   # mint accent
TRUNK = (110, 74, 44)
LAKE = (111, 188, 210)
LAKE_HI = (169, 220, 232)


def _draw_scene(d, S, with_sky=True):
    """Full cozy scene in an S x S box (already scaled by caller)."""
    if with_sky:
        for y in range(S):  # vertical sky gradient
            t = y / S
            c = tuple(int(SKY_TOP[i] + (SKY_BOT[i] - SKY_TOP[i]) * t) for i in range(3))
            d.line([(0, y), (S, y)], fill=c)
        # sun + soft glow
        d.ellipse([S * 0.60, S * 0.14, S * 0.90, S * 0.44], fill=SUN_GLOW)
        d.ellipse([S * 0.64, S * 0.18, S * 0.86, S * 0.40], fill=SUN)
    # hills
    d.ellipse([-S * 0.25, S * 0.52, S * 1.25, S * 1.45], fill=HILL_BACK)
    d.ellipse([-S * 0.35, S * 0.66, S * 0.75, S * 1.55], fill=HILL_FRONT)
    d.ellipse([S * 0.45, S * 0.70, S * 1.4, S * 1.55], fill=HILL_FRONT)
    _draw_motif(d, S)


def _draw_motif(d, S, mono=False):
    """Centered tree + lake (the adaptive-foreground / splash motif)."""
    if mono:
        fg = (255, 255, 255, 255)
        tip = trunk = lake = lakehi = fg
    else:
        fg = None
    cx = S * 0.5
    # lake (wide ellipse near the bottom)
    d.ellipse([S * 0.17, S * 0.74, S * 0.83, S * 0.94],
              fill=(fg if mono else LAKE))
    if not mono:
        d.ellipse([S * 0.30, S * 0.77, S * 0.62, S * 0.83], fill=LAKE_HI)
    # trunk
    d.rectangle([cx - S * 0.022, S * 0.60, cx + S * 0.022, S * 0.74],
                fill=(fg if mono else TRUNK))
    # three stacked foliage triangles (bottom -> top)
    tiers = [
        (0.72, 0.155, 0.50),  # base y, half-width, apex y
        (0.60, 0.135, 0.40),
        (0.50, 0.115, 0.31),
    ]
    for by, hw, ay in tiers:
        col = fg if mono else TREE_DARK
        d.polygon([(cx - S * hw, S * by), (cx + S * hw, S * by), (cx, S * ay)], fill=col)
        if not mono:  # mint tip accent
            d.polygon([(cx - S * hw * 0.34, S * (ay + (by - ay) * 0.34)),
                       (cx + S * hw * 0.34, S * (ay + (by - ay) * 0.34)),
                       (cx, S * ay)], fill=TREE_TIP)


def _canvas(px, mode="RGBA"):
    big = px * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img), big


def _finish(img, px, mode):
    out = img.resize((px, px), Image.LANCZOS)
    if mode == "RGB":
        bg = Image.new("RGB", (px, px), (255, 255, 255))
        bg.paste(out, mask=out.split()[3])
        return bg
    return out


def gen_scene(path, px, mode="RGBA", sky=True):
    img, d, big = _canvas(px)
    _draw_scene(d, big, with_sky=sky)
    _finish(img, px, mode).save(path)
    print("wrote", os.path.relpath(path), px, mode)


def gen_background(path, px):
    img, d, big = _canvas(px)
    for y in range(big):
        t = y / big
        c = tuple(int(SKY_TOP[i] + (SKY_BOT[i] - SKY_TOP[i]) * t) for i in range(3)) + (255,)
        d.line([(0, y), (big, y)], fill=c)
    d.ellipse([big * 0.60, big * 0.14, big * 0.90, big * 0.44], fill=SUN_GLOW + (255,))
    d.ellipse([big * 0.64, big * 0.18, big * 0.86, big * 0.40], fill=SUN + (255,))
    _finish(img, px, "RGBA").save(path)
    print("wrote", os.path.relpath(path), px, "RGBA (bg)")


def gen_motif(path, px, mono=False):
    img, d, big = _canvas(px)
    _draw_motif(d, big, mono=mono)
    _finish(img, px, "RGBA").save(path)
    print("wrote", os.path.relpath(path), px, "mono" if mono else "RGBA (fg)")


def main():
    a = lambda n: os.path.join(ASSETS, n)
    gen_scene(a("icon.png"), 1024, "RGB")
    gen_background(a("android-icon-background.png"), 512)
    gen_motif(a("android-icon-foreground.png"), 512, mono=False)
    gen_motif(a("android-icon-monochrome.png"), 432, mono=True)
    gen_scene(a("favicon.png"), 48, "RGBA")
    gen_motif(a("splash-icon.png"), 1024, mono=False)


if __name__ == "__main__":
    main()
