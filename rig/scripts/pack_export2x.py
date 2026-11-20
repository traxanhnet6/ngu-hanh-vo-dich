#!/usr/bin/env python3
"""Pack Linh Nhi 2x supersampled renders into 221x560 web frames + manifest.
Input: out_2x/south/f00..f07.png (walk) + g00..g03.png (idle), 520x1140,
rig ground at 2x (260,1128).
Step 1: Lanczos downsample to 260x570 (ground back at (130,564)).
Step 2: crop (20,6)-(241,566) -> 221x560, ground pivot at (110,558).
Manifest pivot is the ground point in frame coords (110,558) for all frames;
per-frame measured bbox bottom is recorded for the ground-stability gate.
"""
import json, os, glob
from PIL import Image
import numpy as np

ROOT = '/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig'
OUTDIR = os.path.join(ROOT, 'export')
os.makedirs(OUTDIR, exist_ok=True)

manifest = {"generated_by": "linhnhi-rig-2x-lanczos", "status": "CHUA NGHIEM THU",
            "character": "Linh Nhi", "direction": "south",
            "frame": {"w": 221, "h": 560}, "ground": {"x": 110, "y": 558},
            "render": "Godot 4.5.1 Skeleton2D rig, 2x supersample, Linear filter, Lanczos downsample",
            "blink": "NOT POSSIBLE - eyes are painted on the face piece",
            "frames": []}


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
            "fps": fps, "file": f"export/{name}", "w": 221, "h": 560,
            "pivot": {"x": 110, "y": 558},
            "bbox": {"x_min": int(xs.min()), "x_max": int(xs.max()),
                     "y_min": int(ys.min()), "y_max": int(ys.max())},
        })
        print(f"packed {name}: bbox x{xs.min()}..{xs.max()} y{ys.min()}..{ys.max()}")


pack(sorted(glob.glob(os.path.join(ROOT, 'out_2x', 'south', 'f*.png'))),
     'linhnhi-walk-s', 10, 'walk')
pack(sorted(glob.glob(os.path.join(ROOT, 'out_2x', 'south', 'g*.png'))),
     'linhnhi-idle', 4, 'idle')
with open(os.path.join(OUTDIR, 'manifest.json'), 'w') as fh:
    json.dump(manifest, fh, indent=1, ensure_ascii=False)
print("manifest frames:", len(manifest["frames"]))
