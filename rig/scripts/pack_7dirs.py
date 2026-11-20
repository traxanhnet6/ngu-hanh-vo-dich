#!/usr/bin/env python3
"""Pack Linh Nhi 2x renders for one of the 7 new directions into 221x560
web frames + append to rig/export/manifest.json (south frames untouched).
Same steps as scripts/pack_export2x.py (Lanczos 520x1140 -> 260x570,
crop (20,6)-(241,566) -> 221x560, pivot (110,558)).
Usage: python3 pack_7dirs.py <dir>   (n|ne|e|se|sw|w|nw)
"""
import json, os, glob, sys
from PIL import Image
import numpy as np

ROOT = '/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig'
OUTDIR = os.path.join(ROOT, 'export')
MANIFEST = os.path.join(OUTDIR, 'manifest.json')

d = sys.argv[1]
assert d in ('n', 'ne', 'e', 'se', 'sw', 'w', 'nw'), d
os.makedirs(OUTDIR, exist_ok=True)

with open(MANIFEST) as fh:
    manifest = json.load(fh)
# drop any previous frames of this direction (by strip name)
manifest['frames'] = [f for f in manifest['frames']
                      if f['strip'] not in (f'linhnhi-walk-{d}', f'linhnhi-idle-{d}')]
dirs = sorted(set(manifest.get('directions', ['south'])) | {d})
manifest['directions'] = dirs


def pack(files, prefix, fps, anim):
    for i, f in enumerate(files):
        im = Image.open(f).convert('RGBA')
        im = im.resize((260, 570), Image.LANCZOS)
        crop = im.crop((20, 6, 241, 566))
        assert crop.size == (221, 560), crop.size
        name = f"{prefix}-{i}.png"
        crop.save(os.path.join(OUTDIR, name))
        a = np.array(crop)[:, :, 3]
        ys, xs = np.where(a > 30)
        manifest["frames"].append({
            "name": f"{prefix}-{i}", "strip": prefix, "anim": anim, "index": i,
            "direction": d,
            "fps": fps, "file": f"export/{name}", "w": 221, "h": 560,
            "pivot": {"x": 110, "y": 558},
            "bbox": {"x_min": int(xs.min()), "x_max": int(xs.max()),
                     "y_min": int(ys.min()), "y_max": int(ys.max())},
        })
        print(f"packed {name}: bbox x{xs.min()}..{xs.max()} y{ys.min()}..{ys.max()}")


pack(sorted(glob.glob(os.path.join(ROOT, 'out_2x', d, 'f*.png'))),
     f'linhnhi-walk-{d}', 10, 'walk')
pack(sorted(glob.glob(os.path.join(ROOT, 'out_2x', d, 'g*.png'))),
     f'linhnhi-idle-{d}', 4, 'idle')
# south frames predate the 'direction' key: backfill once.
for f in manifest['frames']:
    f.setdefault('direction', 'south')
with open(MANIFEST, 'w') as fh:
    json.dump(manifest, fh, indent=1, ensure_ascii=False)
print("manifest frames:", len(manifest["frames"]), "directions:", manifest["directions"])
