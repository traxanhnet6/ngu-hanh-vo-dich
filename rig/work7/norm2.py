#!/usr/bin/env python3
"""Plan B background removal for generated Linh Nhi frames (rembg OOM-killed).
White background is pure 255; character is outlined in dark ink, so a
border-connected flood-fill with a threshold cleanly separates background.
Then normalize to the south spec: 221x560 RGBA, bbox height 556,
bbox bottom y=559, bbox centre x=110.5.
Usage: norm2.py <in.png> <out.png>
"""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
rgb = Image.open(src).convert("RGB")
W, H = rgb.size
# Flood-fill background on a working copy with magenta, from many border seeds.
work = rgb.copy()
d = ImageDraw.Draw(work)
seeds = [(0, 0), (W-1, 0), (0, H-1), (W-1, H-1),
         (W//2, 0), (W//2, H-1), (0, H//2), (W-1, H//2)]
for s in seeds:
    try:
        ImageDraw.floodfill(work, s, (255, 0, 255), thresh=28)
    except Exception as e:
        print("floodfill seed", s, "failed:", e)
wa = np.array(work)
bg = (wa[:, :, 0] == 255) & (wa[:, :, 1] == 0) & (wa[:, :, 2] == 255)
print(f"bg frac {bg.mean():.3f} (source frame near-white frac was ~0.38)")
alpha = np.where(bg, 0, 255).astype(np.uint8)
# Soften the cut edge 1px (watercolor fringe) — blur then restore interior.
a_img = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.0))
alpha = np.array(a_img)
alpha[~bg] = np.maximum(alpha[~bg], 200)  # keep interior solid
alpha[bg] = np.minimum(alpha[bg], 60)
rgba = rgb.convert("RGBA")
rgba.putalpha(Image.fromarray(alpha))
a = np.array(rgba.split()[3])
ys, xs = np.where(a > 12)
print(f"raw alpha bbox x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()} "
      f"h={ys.max()-ys.min()+1} w={xs.max()-xs.min()+1} cx={(xs.min()+xs.max())/2:.1f}")
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
crop = rgba.crop((max(0, x0-1), max(0, y0-1), min(W, x1+2), min(H, y1+2)))
H_TARGET = 556
scale = H_TARGET / crop.height
nw = max(1, round(crop.width * scale))
resized = crop.resize((nw, H_TARGET), Image.LANCZOS)
canvas = Image.new("RGBA", (221, 560), (0, 0, 0, 0))
ra = np.array(resized.split()[3])
rys, rxs = np.where(ra > 12)
top = 559 - (rys.max() + 1)
left = round(110.5 - (rxs.min() + rxs.max() + 1) / 2) - rxs.min()
canvas.paste(resized, (left, top), resized)
canvas.save(dst)
fa = np.array(canvas.split()[3])
fys, fxs = np.where(fa > 12)
print(f"final {dst}: size={canvas.size} bbox x{fxs.min()}-{fxs.max()} "
      f"y{fys.min()}-{fys.max()} h={fys.max()-fys.min()+1} "
      f"bottom={fys.max()} cx={(fxs.min()+fxs.max())/2:.1f}")
