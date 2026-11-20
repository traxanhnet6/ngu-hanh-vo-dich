#!/usr/bin/env python3
"""Find enclosed near-white pockets left opaque by flood-fill bg removal.
Lists connected components of dist-from-white<20 that do NOT touch the
outer transparent background. Run read-only first (no --fix)."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage

BASE = "/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig/source"
DIRS = ["n", "ne", "e", "se", "sw", "w", "nw"]
fix = "--fix" in sys.argv

for d in DIRS:
    p = f"{BASE}/linhnhi-idle-{d}.png"
    im = Image.open(p)
    rgb = np.array(im.convert("RGB")).astype(int)
    a = np.array(im.split()[3])
    dist = np.sqrt(((255 - rgb) ** 2).sum(axis=2))
    white = (dist < 20) & (a > 12)  # opaque near-white pixels
    lab, n = ndimage.label(white)
    # border-touching = component touching any opaque edge pixel adjacent to transparent
    print(f"== {d}: {n} white components")
    removed = 0
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        area = len(xs)
        if area < 150:
            continue
        touches_border = (ys.min() <= 4 or ys.max() >= 558 or
                          xs.min() <= 4 or xs.max() >= 219)
        print(f"   comp area={area} x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()} "
              f"touches_frame_edge={touches_border}")
        # A pocket is enclosed background if it is big and in the head/neck
        # zone or beside the body, NOT a hair-shine stroke (thin, inside hair).
        # Heuristic: area>400 and bbox both dims >12px.
        if fix and area > 400 and (xs.max() - xs.min()) > 12 and (ys.max() - ys.min()) > 12:
            a[lab == i] = 0
            removed += 1
    if fix and removed:
        out = im.copy()
        out.putalpha(Image.fromarray(a))
        out.save(p)
        print(f"   FIXED: removed {removed} pocket(s) in {d}")
