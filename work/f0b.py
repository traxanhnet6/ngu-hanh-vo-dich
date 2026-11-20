#!/usr/bin/env python3
"""F0 estimator, validated version (recreated 2026-11-13 after VM restart wiped /tmp).

Method: autocorrelation, 50 ms window / 10 ms hop, smallest-lag-at->=90%-of-peak
picker (avoids octave-down errors), 65-400 Hz range, energy + clarity gates.
Decodes any ffmpeg-readable input (wav/mp3) to 16 kHz mono PCM.
Usage: python3 f0b.py <audio-file> [<audio-file> ...]
Output per file: <name>  dur=<s>s  voiced=<n>  F0med=<x>Hz  IQR=<lo>-<hi>
"""
import subprocess
import sys

import numpy as np

SR = 16000
WIN = int(0.050 * SR)   # 800 samples
HOP = int(0.010 * SR)   # 160 samples
FMIN, FMAX = 65.0, 400.0
LAG_MIN = int(SR / FMAX)  # 40
LAG_MAX = int(SR / FMIN)  # 246
CLARITY_MIN = 0.5         # normalized autocorr peak must reach this
ENERGY_FRAC = 0.05        # frame RMS must reach this fraction of max frame RMS


def decode(path):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-ar", str(SR), "-ac", "1",
           "-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0


def estimate(x):
    n_frames = max(0, (len(x) - WIN) // HOP + 1)
    window = np.hanning(WIN)
    # Frame energies first (for the relative energy gate).
    rms = np.empty(n_frames)
    for i in range(n_frames):
        fr = x[i * HOP:i * HOP + WIN]
        rms[i] = np.sqrt(np.mean(fr * fr))
    if n_frames == 0:
        return [], 0.0
    e_gate = ENERGY_FRAC * rms.max()
    f0s = []
    for i in range(n_frames):
        if rms[i] < e_gate:
            continue
        fr = x[i * HOP:i * HOP + WIN]
        fr = (fr - fr.mean()) * window
        # Full autocorrelation via FFT.
        nfft = 1 << int(np.ceil(np.log2(2 * WIN)))
        spec = np.fft.rfft(fr, nfft)
        ac = np.fft.irfft(spec * np.conj(spec))[:WIN]
        if ac[0] <= 0:
            continue
        ac /= ac[0]
        seg = ac[LAG_MIN:LAG_MAX + 1]
        peak = seg.max()
        if peak < CLARITY_MIN:
            continue
        # Smallest lag reaching >=90% of the peak: kills octave-down picks.
        cand = np.nonzero(seg >= 0.9 * peak)[0]
        if len(cand) == 0:
            continue
        lag = LAG_MIN + int(cand[0])
        f0s.append(SR / lag)
    return f0s, len(x) / SR


def main(paths):
    for p in paths:
        try:
            x = decode(p)
        except subprocess.CalledProcessError as e:
            print(f"{p}\tDECODE-FAIL {e.stderr[:120]!r}")
            continue
        f0s, dur = estimate(x)
        if f0s:
            a = np.array(f0s)
            print(f"{p}\tdur={dur:.1f}s\tvoiced={len(f0s)}\t"
                  f"F0med={np.median(a):.0f}Hz\t"
                  f"IQR={np.percentile(a, 25):.0f}-{np.percentile(a, 75):.0f}")
        else:
            print(f"{p}\tdur={dur:.1f}s\tvoiced=0\tF0med=NA")


if __name__ == "__main__":
    main(sys.argv[1:])
