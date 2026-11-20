#!/usr/bin/env python3
"""Thu 10 cau Ma Tam bang giong Dat Phi (VieNeu-TTS v3 Turbo).
Chay bang vieneu-venv python. Tiep noi duoc: cau nao da co raw WAV >10KB thi bo qua.
Xuat: work/datphi-raw/<id>.wav -> xu ly atempo=0.92 -> work/mp3/<id>.mp3 (24kHz mono 96k).
Ghi tien do vao work/batch-vieneu.log."""
import json, os, subprocess, sys, time

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "datphi-raw")
MP3 = os.path.join(BASE, "mp3")
LOG = os.path.join(BASE, "batch-vieneu.log")
REF = os.path.expanduser("~/workspace/voices/dat-phi/ref-datphi.wav")

os.makedirs(RAW, exist_ok=True)
os.makedirs(MP3, exist_ok=True)

def log(msg):
    line = "[%s] %s" % (time.strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr)[-500:]

def main():
    lines = [l for l in json.load(open(os.path.join(BASE, "lines.json")))["lines"]
             if l.get("engine") == "vieneu"]
    log("VIENEU MATAM: %d cau" % len(lines))
    from vieneu import Vieneu
    t0 = time.time()
    tts = Vieneu()
    log("INIT %.1fs" % (time.time() - t0))
    ok = fail = skip = 0
    for l in lines:
        lid, text = l["id"], l["text"]
        raw = os.path.join(RAW, lid + ".wav")
        out = os.path.join(MP3, lid + ".mp3")
        if os.path.exists(raw) and os.path.getsize(raw) > 10240 and os.path.exists(out):
            log("SKIP %s (da co)" % lid); skip += 1; continue
        try:
            t1 = time.time()
            audio = tts.infer(text, ref_audio=REF, denoise=True)
            tts.save(audio, raw)
            log("SYNTH-OK %s %.0fs bytes=%d" % (lid, time.time() - t1, os.path.getsize(raw)))
        except Exception as e:
            log("SYNTH-FAIL %s: %s" % (lid, e)); fail += 1; continue
        good, err = run(["ffmpeg", "-v", "error", "-y", "-i", raw,
                         "-af", "atempo=0.92", "-ar", "24000", "-ac", "1", "-b:a", "96k", out])
        if good and os.path.exists(out) and os.path.getsize(out) > 0:
            log("PROC-OK %s bytes=%d" % (lid, os.path.getsize(out))); ok += 1
        else:
            log("PROC-FAIL %s: %s" % (lid, err)); fail += 1
    log("=== VIENEU MATAM DONE ok=%d fail=%d skip=%d ===" % (ok, fail, skip))
    return 0 if fail == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
