#!/usr/bin/env python3
"""Normalize a generated Linh Nhi direction frame to the south-frame spec:
221x560 RGBA, bbox height ~556px, bbox bottom y=559 (feet), bbox centre x~110.5.
Usage: norm.py <in.png> <out.png>
Uses rembg (u2net) for background removal, then Lanczos rescale + centre.
"""
import sys, numpy as np
from PIL import Image
from rembg import remove

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
out = remove(im)  # RGBA
a = np.array(out.split()[3])
ys, xs = np.where(a > 12)
print(f"raw alpha bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()} "
      f"h={ys.max()-ys.min()+1} w={xs.max()-xs.min()+1} cx={(xs.min()+xs.max())/2:.1f}")
# Crop to alpha bbox with 1px margin, scale so height == 556 (south bbox height)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
crop = out.crop((max(0, x0-1), max(0, y0-1), min(out.width, x1+2), min(out.height, y1+2)))
H_TARGET = 556
scale = H_TARGET / crop.height
nw = max(1, round(crop.width * scale))
resized = crop.resize((nw, H_TARGET), Image.LANCZOS)
canvas = Image.new("RGBA", (221, 560), (0, 0, 0, 0))
# paste so bbox bottom = 559 (exclusive 560) and bbox centre x = 110.5
# resized height includes the 1px margins; recompute its alpha bbox
ra = np.array(resized.split()[3])
rys, rxs = np.where(ra > 12)
top = 559 - (rys.max() + 1)  # bottom exclusive 560 -> last opaque row 559
left = round(110.5 - (rxs.min() + rxs.max() + 1) / 2) - rxs.min()
canvas.paste(resized, (left, top), resized)
canvas.save(dst)
fa = np.array(canvas.split()[3])
fys, fxs = np.where(fa > 12)
print(f"final {dst}: size={canvas.size} bbox x{fxs.min()}-{fxs.max()} "
      f"y{fys.min()}-{fys.max()} h={fys.max()-fys.min()+1} "
      f"bottom={fys.max()} cx={(fxs.min()+fxs.max())/2:.1f}")
