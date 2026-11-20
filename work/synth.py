#!/usr/bin/env python3
"""Synthesize one line via VoiceStudio API. Usage:
synth.py <voice_id> <speed> <instruct> <text> <out_wav>
Writes out_wav (24kHz wav) and prints elapsed seconds."""
import json, sys, time, urllib.request

voice, speed, instruct, text, out = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]
body = {
    "model": "omnivoice",
    "input": text,
    "voice": voice,
    "response_format": "wav",
    "speed": speed,
    "language": "vi",
}
if instruct:
    body["instruct"] = instruct
req = urllib.request.Request(
    "http://127.0.0.1:3900/v1/audio/speech",
    data=json.dumps(body).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
t0 = time.time()
with urllib.request.urlopen(req, timeout=3600) as r:
    data = r.read()
with open(out, "wb") as f:
    f.write(data)
print(f"OK {out} bytes={len(data)} elapsed={time.time()-t0:.0f}s")
