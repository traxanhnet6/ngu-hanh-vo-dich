#!/usr/bin/env python3
"""Independent gate for the 7 Linh Nhi idle source frames + south reference.
Re-reads final files from disk; prints raw numbers, builds contact sheets.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE = "/home/hatch/workspace/game-ngu-hanh-linhnhi-move"
SRC = f"{BASE}/rig/source"
SOUTH = "/home/hatch/workspace/game-ngu-hanh-deploy/assets/art/npc-linhnhi.png"
DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"]
FILES = {d: f"{SRC}/linhnhi-idle-{d}.png" for d in DIRS if d != "s"}
FILES["s"] = SOUTH

def measure(path):
    im = Image.open(path)
    a = np.array(im.split()[3])
    ys, xs = np.where(a > 12)
    w = (a > 12).sum(axis=1)  # width per row
    # neck: narrowest row in y 150..280 after the wide head
    neck_y, neck_w = None, None
    if len(w) > 280:
        seg = w[150:280]
        neck_y = int(np.argmin(seg)) + 150
        neck_w = int(seg.min())
    head_h = (neck_y - int(ys.min())) if neck_y else None
    # basket pixels: bamboo brown (same rule as rig cut script), lower half
    rgb = np.array(im.convert("RGB")).astype(int)
    basket = (rgb[:, :, 0] - rgb[:, :, 1] > 22) & (rgb[:, :, 1] - rgb[:, :, 2] > 15)
    basket[:350, :] = False
    basket[a <= 12] = False
    by, bx = np.where(basket)
    bcen = f"{bx.mean():.0f} (n={len(bx)})" if len(bx) else "none"
    bside = ("left" if bx.mean() < 110 else "right") if len(bx) else "-"
    return dict(size=im.size, mode=im.mode,
                x0=int(xs.min()), x1=int(xs.max()), y0=int(ys.min()),
                y1=int(ys.max()), h=int(ys.max() - ys.min() + 1),
                cx=(xs.min() + xs.max()) / 2, head_h=head_h,
                neck_y=neck_y, basket_cx=bcen, basket_side=bside)

print(f"{'dir':4} {'size':10} {'bbox x':9} {'y':9} {'h':4} {'bot':4} {'cx':6} {'head':5} {'neck_y':6} {'basket cx':14} {'side':5}  verdict")
rows = {}
for d in DIRS:
    m = measure(FILES[d])
    rows[d] = m
    ok = (m["size"] == (221, 560) and 557 <= m["y1"] <= 559
          and 553 <= m["h"] <= 557 and abs(m["cx"] - 110) <= 4)
    print(f"{d:4} {str(m['size']):10} {m['x0']}-{m['x1']:<6} {m['y0']}-{m['y1']:<6} "
          f"{m['h']:<4} {m['y1']:<4} {m['cx']:<6.1f} {str(m['head_h']):5} "
          f"{str(m['neck_y']):6} {m['basket_cx']:14} {m['basket_side']:5}  {'PASS' if ok else 'FAIL'}")

# Mirror check: E vs horizontal flip of W (alpha IoU) — must NOT be near-identical
def alpha_mask(p):
    return np.array(Image.open(p).split()[3]) > 12
e, w = alpha_mask(FILES["e"]), alpha_mask(FILES["w"])
wf = np.fliplr(w)
iou_ew = (e & wf).sum() / (e | wf).sum()
ne, nw = alpha_mask(FILES["ne"]), alpha_mask(FILES["nw"])
iou_nene = (ne & np.fliplr(nw)).sum() / (ne | np.fliplr(nw)).sum()
se, sw = alpha_mask(FILES["se"]), alpha_mask(FILES["sw"])
iou_sesw = (se & np.fliplr(sw)).sum() / (se | np.fliplr(sw)).sum()
print(f"\nmirror-check IoU (1.0 = perfect mirror copy): E vs flip(W)={iou_ew:.3f}, "
      f"NE vs flip(NW)={iou_nene:.3f}, SE vs flip(SW)={iou_sesw:.3f}  (gate: <0.90)")

# Contact sheet: 8 dirs at 118px display height, dark bg (exposes white halo)
H = 118
cell_w = 70
sheet = Image.new("RGB", (cell_w * 8, H + 22), (51, 51, 51))
dr = ImageDraw.Draw(sheet)
for i, d in enumerate(DIRS):
    im = Image.open(FILES[d]).convert("RGBA")
    sc = H / 560
    tw = max(1, round(221 * sc))
    thumb = im.resize((tw, H), Image.LANCZOS)
    sheet.paste(thumb, ((cell_w - tw) // 2 + i * cell_w, 0), thumb)
    dr.text((i * cell_w + 4, H + 5), d.upper(), fill=(255, 255, 255))
sheet.save(f"{BASE}/rig/work7/contact_8dirs_118px.png")
print("contact sheet:", f"{BASE}/rig/work7/contact_8dirs_118px.png", sheet.size)

# Head zoom 2x: top 210px of each frame, scaled 2x, side by side, dark bg
HZ = 210
zw = 442
zsheet = Image.new("RGB", (zw * 8, HZ * 2 + 22), (51, 51, 51))
dr = ImageDraw.Draw(zsheet)
for i, d in enumerate(DIRS):
    im = Image.open(FILES[d]).convert("RGBA").crop((0, 0, 221, HZ))
    im = im.resize((442, 420), Image.LANCZOS)
    zsheet.paste(im, (i * zw, 0), im)
    dr.text((i * zw + 4, HZ * 2 + 5), d.upper(), fill=(255, 255, 255))
zsheet.save(f"{BASE}/rig/work7/heads_zoom2x.png")
print("head zoom:", f"{BASE}/rig/work7/heads_zoom2x.png", zsheet.size)
