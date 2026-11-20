#!/usr/bin/env python3
"""Cut Linh Nhi 7-direction idle sources into full-frame rig pieces.
Generalisation of work/cut_linhnhi_south.py (same method: solidify 1px,
torso hole-fill with dress cream, narrow leg extensions hidden under the
dress). Per-direction config: arm boxes, basket search/handle boxes,
carrier arm (basket parent), shoe split. Arms/legs are cut as SEEN:
profile/3-4 views have one visible arm; the far arm gets an EMPTY piece
(no fabricated pixels) but its bone still exists so the basket (child of
the far arm in sw/w/nw) can swing. Basket in sw/w/nw is only the visible
sliver — never fabricated. Basket mask = largest connected basketish
component inside its search box (keeps dress patches out).
Usage: python3 cut_7dirs.py [n ne e se sw w nw]  (default: all)
"""
import numpy as np
from PIL import Image, ImageFilter
import os, sys
from collections import deque
from scipy import ndimage

ROOT = '/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig'
SRC_DIR = os.path.join(ROOT, 'source')
OUT_ROOT = os.path.join(ROOT, 'pieces')

# dir: armL box, armR box (None = empty piece), basket box, handle box,
# carrier ('armL'/'armR'), shoe split x, head_pt, shoulder pts, basket_pt
CFG = {
 'n':  dict(armL=(8,72,195,398),  armR=(148,214,195,398), basket=(3,65,375,475),  handle=(12,42,375,415),  carrier='armL', split=113, head=(110,110), shL=(58,235),  shR=(168,235), bkpt=(28,395)),
 'ne': dict(armL=(28,82,195,400), armR=(142,213,195,400), basket=(148,214,375,485), handle=(160,200,375,420), carrier='armR', split=112, head=(135,108), shL=(55,235),  shR=(170,235), bkpt=(180,400)),
 'e':  dict(armL=(68,128,198,402), armR=None,                basket=(50,145,380,485),  handle=(75,120,380,425),  carrier='armL', split=120, head=(145,110), shL=(98,235),  shR=(112,235), bkpt=(95,400)),
 'se': dict(armL=(8,72,195,398),  armR=(148,214,195,398), basket=(8,72,375,480),   handle=(18,48,375,415),  carrier='armL', split=116, head=(108,110), shL=(58,235),  shR=(168,235), bkpt=(30,395)),
 'sw': dict(armL=(22,82,195,400), armR=None,                basket=(170,214,385,480), handle=(175,212,380,420), carrier='armR', split=95,  head=(92,110),  shL=(55,235),  shR=(170,235), bkpt=(195,408)),
 'w':  dict(armL=(68,130,198,402), armR=None,                basket=(155,200,375,480), handle=(160,195,350,400), carrier='armR', split=93,  head=(80,108),  shL=(100,235), shR=(115,235), bkpt=(178,382)),
 'nw': dict(armL=(22,82,195,400), armR=None,                basket=(165,216,385,485), handle=(175,212,380,425), carrier='armR', split=101, head=(95,108),  shL=(55,235),  shR=(170,235), bkpt=(195,408)),
}


def closing(mask):
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
    filled[~seen & ~sub] = True
    out = mask.copy()
    out[y0:y1 + 1, x0:x1 + 1] = filled
    return out


def solidify(arr):
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
    keep = base[:, :, 3] > 30
    out[keep] = base[keep]
    return np.clip(out, 0, 255).astype(np.uint8)


def largest_component(mask):
    lab, n = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    if n == 0:
        return mask
    sizes = ndimage.sum_labels(np.ones_like(lab), lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def cut_dir(d):
    cfg = CFG[d]
    src = os.path.join(SRC_DIR, f'linhnhi-idle-{d}.png')
    outdir = os.path.join(OUT_ROOT, d)
    os.makedirs(outdir, exist_ok=True)
    im = np.array(Image.open(src).convert('RGBA')).astype(np.int32)
    H, W, _ = im.shape
    assert (W, H) == (221, 560), (W, H)
    alpha = im[:, :, 3]
    R, G, B = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    opaque = alpha > 30
    yy, xx = np.mgrid[0:H, 0:W]

    def save(mask, name, fill_rgb=None):
        out = np.zeros((H, W, 4), dtype=np.int32)
        out[:, :, :3] = np.clip(im[:, :, :3], 0, 255)
        out[:, :, 3] = np.where(mask & opaque, alpha, 0)
        if fill_rgb is not None:
            out[mask & ~opaque] = list(fill_rgb) + [255]
        Image.fromarray(solidify(out), 'RGBA').save(os.path.join(outdir, name))
        m = mask & opaque
        if m.sum():
            ys2, xs2 = np.where(m)
            print(f"  {name}: px={int(m.sum())} bbox x{xs2.min()}..{xs2.max()} y{ys2.min()}..{ys2.max()}")
        else:
            print(f"  {name}: EMPTY (0 px)")

    print(f"== {d} ==")
    # HEAD: same rule as south (hair+face y<=190, side strands to y215).
    head_mask = opaque & ((yy <= 190) | ((yy <= 215) & ((xx <= 60) | (xx >= 160))))
    save(head_mask, 'head.png')

    # BASKET: basketish colour inside tight search box, largest component
    # only; handle = basketish inside handle box (+ opaque hand pixels
    # at the grip are already inside the basket body component).
    basketish = (R - G > 22) & (G - B > 15) & (R < 228)
    bx0, bx1, by0, by1 = cfg['basket']
    box = np.zeros_like(opaque)
    box[by0:by1 + 1, bx0:bx1 + 1] = True
    basket_mask = largest_component(opaque & basketish & box)
    hx0, hx1, hy0, hy1 = cfg['handle']
    hbox = np.zeros_like(opaque)
    hbox[hy0:hy1 + 1, hx0:hx1 + 1] = True
    handle_mask = opaque & basketish & hbox
    basket_mask = basket_mask | handle_mask
    basket_mask = closing(basket_mask)
    basket_mask = hole_fill(basket_mask, bx0, bx1, by0, by1)
    save(basket_mask, 'basket.png')

    # ARMS: box cuts; basket excluded (drawn on top, higher z).
    def arm_box(box):
        if box is None:
            return np.zeros_like(opaque)
        x0, x1, y0, y1 = box
        return opaque & (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1) & (~basket_mask)
    armL = arm_box(cfg['armL'])
    armR = arm_box(cfg['armR'])
    save(armL, 'armL.png')
    save(armR, 'armR.png')

    # LEGS: shoes y>=520 split at cfg split; extension 15px wide centred
    # on each half's shoe centroid x, y496..522, hidden under the dress.
    def save_leg(mask, name):
        out = np.zeros((H, W, 4), dtype=np.int32)
        out[:, :, :3] = np.clip(im[:, :, :3], 0, 255)
        out[:, :, 3] = np.where(mask & opaque, alpha, 0)
        m = mask & opaque
        ys2, xs2 = np.where(m)
        cx = int(xs2.mean()) if len(xs2) else 110
        x0, x1 = cx - 7, cx + 7
        ext = (yy >= 496) & (yy <= 522) & (xx >= x0) & (xx <= x1)
        out[ext] = np.array([228, 208, 178, 255])
        for i, y in enumerate(range(496, 502)):
            out[y, :, 3] = np.where(ext[y], int(255 * (i + 1) / 6), out[y, :, 3])
        Image.fromarray(solidify(out), 'RGBA').save(os.path.join(outdir, name))
        print(f"  {name}: px={int(m.sum())} bbox x{xs2.min()}..{xs2.max()} y{ys2.min()}..{ys2.max()} ext x{x0}..{x1} cx={cx}")
        return cx
    legL_mask = opaque & (yy >= 520) & (xx < cfg['split'])
    legR_mask = opaque & (yy >= 520) & (xx >= cfg['split'])
    cxL = save_leg(legL_mask, 'legL.png')
    cxR = save_leg(legR_mask, 'legR.png')

    # TORSO: dress y188..528 minus arms/basket; fill arm-box holes cream.
    torso_mask = opaque & (yy >= 188) & (yy <= 528) & (~armL) & (~armR) & (~basket_mask)
    out = np.zeros((H, W, 4), dtype=np.int32)
    out[:, :, :3] = np.clip(im[:, :, :3], 0, 255)
    out[:, :, 3] = np.where(torso_mask, alpha, 0)
    hole = np.zeros_like(opaque)
    for box in (cfg['armL'], cfg['armR']):
        if box is None:
            continue
        x0, x1, y0, y1 = box
        hole |= ((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1))
    hole = hole & opaque & (~torso_mask) & (yy >= 188) & (yy <= 528)
    fill = np.zeros((H, W, 4), dtype=np.int32)
    shade = (240 - (yy - 195) * 0.03).clip(232, 240)
    fill[:, :, 0] = 240; fill[:, :, 1] = 229; fill[:, :, 2] = shade.astype(np.int32); fill[:, :, 3] = 255
    out[hole] = fill[hole]
    Image.fromarray(solidify(out), 'RGBA').save(os.path.join(outdir, 'torso.png'))
    ys2, xs2 = np.where(torso_mask)
    print(f"  torso.png: px={int(torso_mask.sum())} bbox x{xs2.min()}..{xs2.max()} y{ys2.min()}..{ys2.max()} hole_px={int(hole.sum())}")

    # Composite rest-pose check vs source (z-order as in rig).
    order = ['legL.png', 'legR.png', 'torso.png', 'armL.png', 'armR.png', 'basket.png', 'head.png']
    base = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n in order:
        base = Image.alpha_composite(base, Image.open(os.path.join(outdir, n)))
    orig = Image.open(src).convert('RGBA')
    oa = np.array(orig)[:, :, 3] > 30
    ca = np.array(base)[:, :, 3] > 30
    inter = (oa & ca).sum(); union = (oa | ca).sum()
    print(f"  REST IoU={inter / union:.4f} orig_px={int(oa.sum())} comp_px={int(ca.sum())}")
    print(f"  orig bbox={orig.getbbox()} comp bbox={base.getbbox()} leg_cx L={cxL} R={cxR}")
    comp = Image.new('RGBA', (W * 2 + 10, H), (40, 30, 28, 255))
    comp.paste(orig, (0, 0), orig)
    comp.paste(base, (W + 10, 0), base)
    comp.convert('RGB').save(os.path.join(ROOT, 'work', f'cut_{d}_check.png'))
    return {'iou': float(inter / union), 'legL_cx': cxL, 'legR_cx': cxR}


if __name__ == '__main__':
    dirs = sys.argv[1:] or list(CFG)
    res = {}
    for d in dirs:
        res[d] = cut_dir(d)
    print({d: round(v['iou'], 4) for d, v in res.items()})
