#!/usr/bin/env python3
"""Thu 44 cau OmniVoice (Ngoc Ngan 30 + MC Blog 14) cho giai doan 2 NPCVOICE.
Chay nen bang setsid nohup. Tiep noi duoc: cau nao da co raw WAV >10KB thi bo qua
buoc tong hop; cau nao da co mp3 thi bo qua xu ly. Loi tung cau khong dung ca dot.
Ghi tien do vao work/batch-omni.log + work/progress-omni.json sau moi cau.
Cach chay: cd work && setsid nohup /usr/bin/python3 batch_omni.py > batch-omni.stdout.log 2>&1 &"""
import json, os, subprocess, sys, time

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "raw")
MP3 = os.path.join(BASE, "mp3")
LOG = os.path.join(BASE, "batch-omni.log")
PROG = os.path.join(BASE, "progress-omni.json")
SYNTH = os.path.join(BASE, "synth.py")

os.makedirs(RAW, exist_ok=True)
os.makedirs(MP3, exist_ok=True)

def log(msg):
    line = "[%s] %s" % (time.strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def save_progress(done):
    with open(PROG, "w") as f:
        json.dump({"updated": time.strftime("%Y-%m-%d %H:%M:%S"),
                   "done": done}, f, ensure_ascii=False, indent=1)

def main():
    lines = [l for l in json.load(open(os.path.join(BASE, "lines.json")))["lines"]
             if l.get("engine", "omnivoice") == "omnivoice"]
    log("OMNI BATCH: %d cau" % len(lines))
    done = {}
    if os.path.exists(PROG):
        try:
            done = json.load(open(PROG)).get("done", {})
        except Exception:
            done = {}
    ok = fail = skip = 0
    for l in lines:
        lid = l["id"]
        raw = os.path.join(RAW, lid + ".wav")
        out = os.path.join(MP3, lid + ".mp3")
        st = done.get(lid, {})
        if st.get("mp3") and os.path.exists(out) and os.path.getsize(out) > 0:
            log("SKIP %s (mp3 da co)" % lid); skip += 1; continue
        if not (os.path.exists(raw) and os.path.getsize(raw) > 10240):
            t1 = time.time()
            text = l.get("synth_text", l["text"])
            cmd = ["/usr/bin/python3", SYNTH, l["voice_id"], str(l["speed"]),
                   l.get("instruct", ""), text, raw]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            if r.returncode == 0 and os.path.exists(raw) and os.path.getsize(raw) > 10240:
                log("SYNTH-OK %s %.0fs bytes=%d" % (lid, time.time() - t1, os.path.getsize(raw)))
                st["synth"] = True
            else:
                log("SYNTH-FAIL %s rc=%d out=%s" % (lid, r.returncode, (r.stdout + r.stderr)[-300:]))
                st["synth"] = False
                done[lid] = st; save_progress(done); fail += 1; continue
        else:
            log("SKIP-SYNTH %s (raw da co)" % lid)
            st["synth"] = True
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw,
                            "-af", l["proc"], "-ar", "24000", "-ac", "1",
                            "-b:a", "96k", out], capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 0:
            log("PROC-OK %s bytes=%d" % (lid, os.path.getsize(out)))
            st["mp3"] = True; ok += 1
        else:
            log("PROC-FAIL %s: %s" % (lid, (r.stdout + r.stderr)[-300:]))
            st["mp3"] = False; fail += 1
        done[lid] = st; save_progress(done)
    log("=== OMNI BATCH DONE ok=%d fail=%d skip=%d ===" % (ok, fail, skip))
    return 0 if fail == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
