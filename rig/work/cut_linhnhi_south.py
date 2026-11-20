#!/usr/bin/env python3
"""Cut npc-linhnhi.png (221x560, south/front only) into full-frame rig pieces.
Method: same as godotrig cut_south.py (box-cut arms, fill torso holes, narrow
leg extensions hidden under the dress) adapted to Linh Nhi's watercolour art.
Pieces: head, torso, armL (screen-left, basket arm), armR, basket (child of
armL), legL, legR. Ground pivot (110,558).
"""
import numpy as np
from PIL import Image, ImageFilter
import os
from collections import deque

SRC = '/home/hatch/workspace/game-ngu-hanh-deploy/assets/art/npc-linhnhi.png'
OUT = '/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig/pieces/south'
os.makedirs(OUT, exist_ok=True)

im = np.array(Image.open(SRC).convert('RGBA')).astype(np.int32)
H, W, _ = im.shape
assert (W, H) == (221, 560), (W, H)
alpha = im[:, :, 3]
R, G, B = im[:, :, 0], im[:, :, 1], im[:, :, 2]
opaque = alpha > 30
yy, xx = np.mgrid[0:H, 0:W]


def closing(mask):
    """3x3 binary closing (dilate then erode) via shifts."""
    def dil(m):
        out = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
        return out
    def ero(m):
        out = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                out &= np.roll(np.roll(m, dy, 0), dx, 1)
        return out
    return ero(dil(mask))


def hole_fill(mask, x0, x1, y0, y1):
    """Fill enclosed holes inside the given box (flood fill from box border)."""
    sub = mask[y0:y1 + 1, x0:x1 + 1].copy()
    h, w = sub.shape
    seen = np.zeros_like(sub, dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not sub[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not sub[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not sub[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    filled = sub.copy()
    filled[~seen & ~sub] = True  # enclosed background -> fill
    out = mask.copy()
    out[y0:y1 + 1, x0:x1 + 1] = filled
    return out


def solidify(arr):
    """1px edge solidify: dilate alpha, fill new fringe with blurred colour."""
    img = Image.fromarray(arr.astype(np.uint8), 'RGBA')
    a = img.split()[3]
    a_dil = a.filter(ImageFilter.MaxFilter(3))
    blur = img.filter(ImageFilter.GaussianBlur(1))
    base = np.array(img).astype(np.int32)
    bl = np.array(blur).astype(np.int32)
    ad = np.array(a_dil).astype(np.int32)
    out = base.copy()
    fringe = (ad > 30) & (base[:, :, 3] <= 30)
    out[fringe] = bl[fringe]
    out[:, :, 3] = np.where(ad > 30, np.maximum(base[:, :, 3], ad), 0)
    # keep original opaque pixels exactly as source
    keep = base[:, :, 3] > 30
    out[keep] = base[keep]
    return np.clip(out, 0, 255).astype(np.uint8)


def save(mask, name, fill_rgb=None):
    out = np.zeros((H, W, 4), dtype=np.int32)
    out[:, :, :3] = np.clip(im[:, :, :3], 0, 255)
    out[:, :, 3] = np.where(mask & opaque, alpha, 0)
    if fill_rgb is not None:
        out[mask & ~opaque] = list(fill_rgb) + [255]
    Image.fromarray(solidify(out), 'RGBA').save(os.path.join(OUT, name))
    m = mask & opaque
    ys, xs = np.where(m)
    print(f"{name}: px={int(m.sum())} bbox x{xs.min()}..{xs.max()} y{ys.min()}..{ys.max()}")


# HEAD: hair+face down to y190, plus thin side hair strands to y215 at edges.
head_mask = opaque & ((yy <= 190) | ((yy <= 215) & ((xx <= 60) | (xx >= 160))))
save(head_mask, 'head.png')

# BASKET: brown/tan weave (R-G>22, G-B>15, R<228) in box x<=66, y375..472,
# plus the thin handle strands x18..38, y380..412. Closing + hole fill.
basketish = (R - G > 22) & (G - B > 15) & (R < 228)
basket_mask = opaque & basketish & (xx <= 66) & (yy >= 375) & (yy <= 472)
handle = opaque & (xx >= 18) & (xx <= 38) & (yy >= 380) & (yy <= 412)
basket_mask = basket_mask | handle
basket_mask = closing(basket_mask)
basket_mask = hole_fill(basket_mask, 2, 66, 375, 472)
save(basket_mask, 'basket.png')

# ARMS: box cuts (same approach as cut_south.py); basket body excluded.
armL = opaque & (xx >= 8) & (xx <= 72) & (yy >= 195) & (yy <= 398)
armL = armL & ~(basket_mask & (yy >= 398))
armR = opaque & (xx >= 148) & (xx <= 214) & (yy >= 195) & (yy <= 398)
save(armL, 'armL.png')
save(armR, 'armR.png')

# LEGS: shoes only visible below the hem + narrow extension up under dress.
def save_leg(mask, x0, x1, name):
    out = np.zeros((H, W, 4), dtype=np.int32)
    out[:, :, :3] = np.clip(im[:, :, :3], 0, 255)
    out[:, :, 3] = np.where(mask & opaque, alpha, 0)
    ext = (yy >= 496) & (yy <= 522) & (xx >= x0) & (xx <= x1)
    out[ext] = np.array([228, 208, 178, 255])
    for i, y in enumerate(range(496, 502)):
        out[y, :, 3] = np.where(ext[y], int(255 * (i + 1) / 6), out[y, :, 3])
    Image.fromarray(solidify(out), 'RGBA').save(os.path.join(OUT, name))
    m = mask & opaque
    ys, xs = np.where(m)
    print(f"{name}: px={int(m.sum())} bbox x{xs.min()}..{xs.max()} y{ys.min()}..{ys.max()} ext x{x0}..{x1}")

legL_mask = opaque & (yy >= 520) & (xx >= 70) & (xx <= 111)
legR_mask = opaque & (yy >= 520) & (xx >= 111) & (xx <= 152)
save_leg(legL_mask, 84, 98, 'legL.png')
save_leg(legR_mask, 126, 140, 'legR.png')

# TORSO: dress y188..528 minus arms/basket; fill arm-box holes with dress cream.
torso_mask = opaque & (yy >= 188) & (yy <= 528) & (~armL) & (~armR) & (~basket_mask)
out = np.zeros((H, W, 4), dtype=np.int32)
out[:, :, :3] = np.clip(im[:, :, :3], 0, 255)
out[:, :, 3] = np.where(torso_mask, alpha, 0)
hole = (((xx >= 8) & (xx <= 72)) | ((xx >= 148) & (xx <= 214))) & (yy >= 195) & (yy <= 398) \
    & opaque & (~torso_mask)
fill = np.zeros((H, W, 4), dtype=np.int32)
shade = (240 - (yy - 195) * 0.03).clip(232, 240)
fill[:, :, 0] = 240; fill[:, :, 1] = 229; fill[:, :, 2] = shade.astype(np.int32); fill[:, :, 3] = 255
out[hole] = fill[hole]
Image.fromarray(solidify(out), 'RGBA').save(os.path.join(OUT, 'torso.png'))
m = torso_mask
ys, xs = np.where(m)
print(f"torso.png: px={int(m.sum())} bbox x{xs.min()}..{xs.max()} y{ys.min()}..{ys.max()} hole_px={int(hole.sum())}")

# Composite rest-pose check vs original.
order = ['legL.png', 'legR.png', 'torso.png', 'armL.png', 'armR.png', 'basket.png', 'head.png']
base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for n in order:
    base = Image.alpha_composite(base, Image.open(os.path.join(OUT, n)))
orig = Image.open(SRC).convert('RGBA')
oa = np.array(orig)[:, :, 3] > 30
ca = np.array(base)[:, :, 3] > 30
inter = (oa & ca).sum(); union = (oa | ca).sum()
print(f"rest-pose IoU={inter / union:.4f} orig_px={int(oa.sum())} comp_px={int(ca.sum())}")
print(f"orig bbox={Image.open(SRC).getbbox()} comp bbox={base.getbbox()}")
comp = Image.new('RGBA', (W * 2 + 10, H), (40, 30, 28, 255))
comp.paste(orig, (0, 0), orig)
comp.paste(base, (W + 10, 0), base)
comp.convert('RGB').save('/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig/work/cut_south_check.png')
print('pieces saved:', sorted(os.listdir(OUT)))
