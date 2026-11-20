#!/usr/bin/env python3
"""Comparison GIFs of Linh Nhi on the REAL Mieu Hoang map background.
Background: map-mieu-hoang-bg.png (1920x1280), crop (380,200)-(1020,560);
Linh Nhi's standing point (700,560) is crop centre-bottom (feet at y=360).
Character shown 200px tall (scale 200/560). Walk: 16 frames, 2 cycles,
crossing left->right, 100ms/frame. Idle: 4 frames, 600ms/frame (2.4s loop).
A soft contact shadow grounds the feet.
"""
from PIL import Image, ImageDraw
import os

ROOT = '/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig'
E = os.path.join(ROOT, 'export')
W = os.path.join(ROOT, 'work')
BG = '/home/hatch/workspace/game-ngu-hanh-deploy/assets/art/map-mieu-hoang-bg.png'

bg = Image.open(BG).convert('RGB').crop((380, 200, 1020, 560))  # 640x360
SCALE = 200 / 560
FW, FH = int(221 * SCALE), int(560 * SCALE)          # 79x200
PIV_X, PIV_Y = int(110 * SCALE), int(558 * SCALE)    # (39,199)
GROUND_Y = 360                                        # feet line in crop

frames_walk = [Image.open(os.path.join(E, f'linhnhi-walk-s-{i}.png')).convert('RGBA').resize((FW, FH), Image.LANCZOS) for i in range(8)]
frames_idle = [Image.open(os.path.join(E, f'linhnhi-idle-{i}.png')).convert('RGBA').resize((FW, FH), Image.LANCZOS) for i in range(4)]


def shadow(base, cx):
    ov = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([cx - 34, GROUND_Y - 6, cx + 34, GROUND_Y + 8], fill=(20, 20, 16, 70))
    return Image.alpha_composite(base, ov)


def compose(frame, cx):
    base = bg.convert('RGBA')
    base = shadow(base, cx)
    base.paste(frame, (cx - PIV_X, GROUND_Y - PIV_Y), frame)
    return base.convert('RGB')


# Walk across: 16 frames, cx 60 -> 580
walk = [compose(frames_walk[i % 8], int(60 + (580 - 60) * i / 15)) for i in range(16)]
walk[0].save(os.path.join(W, 'linhnhi-walk-south.gif'), save_all=True,
             append_images=walk[1:], duration=100, loop=0)
# Idle at the standing point (map 700,560 -> crop cx 320)
idle = [compose(frames_idle[i], 320) for i in range(4)]
idle[0].save(os.path.join(W, 'linhnhi-idle.gif'), save_all=True,
            append_images=idle[1:], duration=600, loop=0)
print('saved', os.path.join(W, 'linhnhi-walk-south.gif'), os.path.join(W, 'linhnhi-idle.gif'))
for p in ['linhnhi-walk-south.gif', 'linhnhi-idle.gif']:
    im = Image.open(os.path.join(W, p))
    print(p, im.size, 'frames:', getattr(im, 'n_frames', 1))
