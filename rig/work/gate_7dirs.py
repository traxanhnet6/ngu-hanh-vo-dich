#!/usr/bin/env python3
"""Gate check for one rigged direction (after pack_7dirs.py).
- rest-pose IoU: export linhnhi-idle-<d>-0 vs source, alpha>30
- bbox bottom (y_max) of every frame: must be 557..559
- leg lift: shoe-bottom per half (split x from cut config) in y>=500;
  walk-2 must lift legL ~9px, walk-6 legR ~9px, other foot stays ~0
- contact sheet 118px + feet zoom 3x saved to rig/work/
Usage: python3 gate_7dirs.py <dir>
"""
import json, os, sys
from PIL import Image
import numpy as np

ROOT = '/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig'
E = os.path.join(ROOT, 'export')
W = os.path.join(ROOT, 'work')
SPLIT = {'n': 113, 'ne': 112, 'e': 120, 'se': 116, 'sw': 95, 'w': 93, 'nw': 101}

d = sys.argv[1]
split = SPLIT[d]
ok = True


def alpha(f):
    return np.array(Image.open(f).convert('RGBA'))[:, :, 3] > 30


def shoe_bottoms(a):
    out = []
    for x0, x1 in ((0, split), (split, 221)):
        sub = a[500:, x0:x1]
        ys = np.where(sub.any(axis=1))[0]
        out.append(int(ys.max() + 500) if len(ys) else -1)
    return out


# IoU rest pose
src = alpha(os.path.join(ROOT, 'source', f'linhnhi-idle-{d}.png'))
idle0 = alpha(os.path.join(E, f'linhnhi-idle-{d}-0.png'))
iou = float((src & idle0).sum() / (src | idle0).sum())
ys, xs = np.where(idle0)
print(f"{d}: rest IoU={iou:.4f} (gate >=0.90) {'PASS' if iou >= 0.90 else 'FAIL'}"
      f" bbox x{xs.min()}..{xs.max()} y{ys.min()}..{ys.max()} (src x{np.where(src.any(axis=0))[0].min()}..{np.where(src.any(axis=0))[0].max()})")
if iou < 0.90:
    ok = False

# Per-frame bottoms + leg lift
base = None
for i in range(8):
    a = alpha(os.path.join(E, f'linhnhi-walk-{d}-{i}.png'))
    ys2, xs2 = np.where(a)
    bL, bR = shoe_bottoms(a)
    if i == 0:
        base = (bL, bR)
    liftL, liftR = base[0] - bL, base[1] - bR
    flag = '' if 557 <= ys2.max() <= 559 else '  <-- BOTTOM FAIL'
    print(f"  walk-{i}: bbox x{xs2.min()}..{xs2.max()} y{ys2.min()}..{ys2.max()} bottom={ys2.max()} shoeL={bL}(lift {liftL}) shoeR={bR}(lift {liftR}){flag}")
    if not (557 <= ys2.max() <= 559):
        ok = False
for i in range(4):
    a = alpha(os.path.join(E, f'linhnhi-idle-{d}-{i}.png'))
    ys2, xs2 = np.where(a)
    bL, bR = shoe_bottoms(a)
    flag = '' if 557 <= ys2.max() <= 559 else '  <-- BOTTOM FAIL'
    print(f"  idle-{i}: bbox x{xs2.min()}..{xs2.max()} y{ys2.min()}..{ys2.max()} bottom={ys2.max()} shoeL={bL} shoeR={bR}{flag}")
    if not (557 <= ys2.max() <= 559):
        ok = False
# lift gate: walk-2 legL 7..11, walk-6 legR 7..11, opposite foot <=2
a2 = alpha(os.path.join(E, f'linhnhi-walk-{d}-2.png'))
a6 = alpha(os.path.join(E, f'linhnhi-walk-{d}-6.png'))
l2 = (base[0] - shoe_bottoms(a2)[0], base[1] - shoe_bottoms(a2)[1])
l6 = (base[0] - shoe_bottoms(a6)[0], base[1] - shoe_bottoms(a6)[1])
lift_ok = (9 <= l2[0] <= 13 and abs(l2[1]) <= 3 and 9 <= l6[1] <= 13 and abs(l6[0]) <= 3)
print(f"  lift walk-2 L={l2[0]} R={l2[1]} | walk-6 L={l6[0]} R={l6[1]} (gate 9..13 / other <=3; +10 leg +2 hips at t=0.2s, same as south table: 548 vs 559) {'PASS' if lift_ok else 'FAIL'}")
if not lift_ok:
    ok = False

# Contact sheet 118px (walk 8 + idle 4) + feet zoom 3x (walk 0,2,6)
H118 = 118
scale = H118 / 560
fw = int(221 * scale)
frames = [Image.open(os.path.join(E, f'linhnhi-walk-{d}-{i}.png')).convert('RGBA').resize((fw, H118), Image.LANCZOS) for i in range(8)]
frames += [Image.open(os.path.join(E, f'linhnhi-idle-{d}-{i}.png')).convert('RGBA').resize((fw, H118), Image.LANCZOS) for i in range(4)]
sheet = Image.new('RGBA', (fw * 12 + 11 * 4, H118), (30, 26, 24, 255))
for i, fr in enumerate(frames):
    sheet.paste(fr, (i * (fw + 4), 0), fr)
sheet.convert('RGB').save(os.path.join(W, f'contact_{d}_118px.png'))
feet = []
for i in (0, 2, 6):
    im = Image.open(os.path.join(E, f'linhnhi-walk-{d}-{i}.png')).convert('RGBA')
    feet.append(im.crop((0, 480, 221, 560)).resize((221 * 3, 80 * 3), Image.LANCZOS))
fz = Image.new('RGBA', (221 * 3, 80 * 3 * 3 + 8), (30, 26, 24, 255))
for i, fr in enumerate(feet):
    fz.paste(fr, (0, i * (80 * 3 + 4)), fr)
fz.convert('RGB').save(os.path.join(W, f'feet_{d}_zoom3x.png'))
print(f"  sheet: work/contact_{d}_118px.png  feet: work/feet_{d}_zoom3x.png")
print(f"{d}: OVERALL {'PASS' if ok else 'FAIL'}")
