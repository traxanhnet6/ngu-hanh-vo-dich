#!/usr/bin/env python3
"""Comparison GIFs for one direction, same method as work/make_gifs.py:
real Mieu Hoang map background, crop (380,200)-(1020,560), standing point
(700,560), character 200px tall, walk 16 frames crossing, idle 4 frames.
Usage: python3 make_gifs_7dirs.py <dir>"""
import sys, os
from PIL import Image, ImageDraw
ROOT = '/home/hatch/workspace/game-ngu-hanh-linhnhi-move/rig'
E = os.path.join(ROOT, 'export')
W = os.path.join(ROOT, 'work')
BG = '/home/hatch/workspace/game-ngu-hanh-deploy/assets/art/map-mieu-hoang-bg.png'
d = sys.argv[1]
bg = Image.open(BG).convert('RGB').crop((380, 200, 1020, 560))
SCALE = 200 / 560
FW, FH = int(221 * SCALE), int(560 * SCALE)
PIV_X, PIV_Y = int(110 * SCALE), int(558 * SCALE)
GROUND_Y = 360
frames_walk = [Image.open(os.path.join(E, f'linhnhi-walk-{d}-{i}.png')).convert('RGBA').resize((FW, FH), Image.LANCZOS) for i in range(8)]
frames_idle = [Image.open(os.path.join(E, f'linhnhi-idle-{d}-{i}.png')).convert('RGBA').resize((FW, FH), Image.LANCZOS) for i in range(4)]
def shadow(base, cx):
    ov = Image.new('RGBA', base.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(ov)
    dd.ellipse([cx - 34, GROUND_Y - 6, cx + 34, GROUND_Y + 8], fill=(20, 20, 16, 70))
    return Image.alpha_composite(base, ov)
def compose(frame, cx):
    base = bg.convert('RGBA')
    base = shadow(base, cx)
    base.paste(frame, (cx - PIV_X, GROUND_Y - PIV_Y), frame)
    return base.convert('RGB')
walk = [compose(frames_walk[i % 8], int(60 + (580 - 60) * i / 15)) for i in range(16)]
walk[0].save(os.path.join(W, f'linhnhi-walk-{d}.gif'), save_all=True, append_images=walk[1:], duration=100, loop=0)
idle = [compose(frames_idle[i], 320) for i in range(4)]
idle[0].save(os.path.join(W, f'linhnhi-idle-{d}.gif'), save_all=True, append_images=idle[1:], duration=600, loop=0)
print('saved', f'linhnhi-walk-{d}.gif', f'linhnhi-idle-{d}.gif')
