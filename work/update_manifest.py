#!/usr/bin/env python3
"""Cap nhat assets/voice/manifest.json tren cay dot npcvoice:
1. Thay 21 file live bang 21 file goi VOICE-GENDER (dung gioi) + sua voice/voice_id.
2. Them 5 entries truong-lao-duoc-dien (file pack).
3. Them 54 entries moi tu work/lines.json (file work/mp3/).
4. Cap nhat 5 intro (file ~/workspace/voices/intro/, status -> ok).
Tu choi neu thieu file mp3 nao. Do duration that bang ffprobe.
Chay: cd <cay dot> && /usr/bin/python3 work/update_manifest.py"""
import json, os, shutil, subprocess, sys

TREE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(TREE, "work")
VOICE = os.path.join(TREE, "assets", "voice")
PACK = os.path.expanduser("~/workspace/game-ngu-hanh-voice-gender/mp3")
INTRO_SRC = os.path.expanduser("~/workspace/voices/intro")

PACK_VOICE = {  # id -> (voice, voice_id, speed)
    "linh-nhi-01": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "linh-nhi-02": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "linh-nhi-03": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "linh-nhi-04": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "linh-nhi-05": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "linh-nhi-06": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "linh-nhi-07": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "linh-nhi-08": ("MC Blog (ab7cd3bf)", "ab7cd3bf", 1.0),
    "chuong-mon-01": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 0.92),
    "chuong-mon-02": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 0.92),
    "chuong-mon-03": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 0.92),
    "truong-lao-01": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 0.85),
    "chap-su-01": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 1.02),
    "chap-su-02": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 1.02),
    "chap-su-03": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 1.02),
    "duoc-su-01": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 0.90),
    "thuong-nhan-01": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 1.05),
    "an-si-01": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 0.93),
    "tiep-dan-01": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 1.0),
    "tiep-dan-02": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 1.0),
    "tiep-dan-03": ("Ngọc Ngạn (47c3ee0a)", "47c3ee0a", 1.0),
}

ELDER_NEW = [
    ("truong-lao-duoc-dien-01", "Ruộng Linh Mễ này là căn cơ nông nghiệp của Thanh Vân Tông ta. Người tu đạo cũng không thể thiếu linh lương dưỡng mạch."),
    ("truong-lao-duoc-dien-02", "Ngươi chính là tân đệ tử nhập môn do Chấp Sự tiến cử? Tốt lắm, hãy xem ta thị phạm 4 pháp quyết canh tác linh điền tông môn!"),
    ("truong-lao-duoc-dien-03", "Ruộng Linh Mễ này là căn cơ nông nghiệp của Thanh Vân Tông ta. Ngươi chưa chính thức nhập môn, chớ nên nóng vội."),
    ("truong-lao-duoc-dien-04", "Ngươi quả là kỳ tài thông tuệ, vừa nhìn đã thấu suốt bí quyết!"),
    ("truong-lao-duoc-dien-05", "Đó là 4 đại pháp quyết linh điền của tông môn ở các cấp độ. Ngươi đã sẵn sàng tiếp nhận truyền thừa chưa?"),
]

INTRO_VOICE = {
    "intro-scene-1": ("Đạt Phi (VieNeu)", "datphi"),
    "intro-scene-2": ("MC Blog (ab7cd3bf)", "ab7cd3bf"),
    "intro-scene-3": ("Đạt Phi (VieNeu)", "datphi"),
    "intro-scene-4": ("Đạt Phi (VieNeu)", "datphi"),
    "intro-scene-5": ("Đạt Phi (VieNeu)", "datphi"),
}

def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    return round(float(r.stdout.strip()), 2)

def main():
    lines = json.load(open(os.path.join(WORK, "lines.json")))["lines"]
    missing = []
    for l in lines:
        p = os.path.join(WORK, "mp3", l["id"] + ".mp3")
        if not (os.path.exists(p) and os.path.getsize(p) > 0):
            missing.append(l["id"])
    for i in range(1, 6):
        p = os.path.join(INTRO_SRC, "intro-scene-%d.mp3" % i)
        if not (os.path.exists(p) and os.path.getsize(p) > 0):
            missing.append("intro-scene-%d" % i)
    if missing:
        print("THIEU FILE, DUNG LAI:", missing)
        return 1
    mpath = os.path.join(VOICE, "manifest.json")
    m = json.load(open(mpath))
    # 1. thay 21 file pack + sua voice
    for lid, (voice, vid, speed) in PACK_VOICE.items():
        shutil.copyfile(os.path.join(PACK, lid + ".mp3"), os.path.join(VOICE, lid + ".mp3"))
        e = m[lid]
        e["voice"], e["voice_id"], e["speed"] = voice, vid, speed
        e["duration_s"] = duration(os.path.join(VOICE, lid + ".mp3"))
        e["note"] = "pack VOICE-GENDER 2026-11-13 (dung gioi)"
    # 2. them 5 cau Truong Lao Duoc Dien
    for lid, text in ELDER_NEW:
        shutil.copyfile(os.path.join(PACK, lid + ".mp3"), os.path.join(VOICE, lid + ".mp3"))
        m[lid] = {"speaker": "Trưởng Lão Dược Điền", "text": text,
                  "voice": "Ngọc Ngạn (47c3ee0a)", "voice_id": "47c3ee0a", "speed": 0.90,
                  "npc": "npc_truonglao_duocdien", "map": "ruong-linh-me", "kind": "default",
                  "file": lid + ".mp3", "status": "ok",
                  "duration_s": duration(os.path.join(VOICE, lid + ".mp3")),
                  "note": "pack VOICE-GENDER 2026-11-13"}
    # 3. them 54 cau moi
    for l in lines:
        shutil.copyfile(os.path.join(WORK, "mp3", l["id"] + ".mp3"),
                        os.path.join(VOICE, l["id"] + ".mp3"))
        e = {"speaker": l["speaker"], "text": l["text"],
             "voice": l["voice"], "voice_id": l["voice_id"],
             "speed": l.get("speed", 1.0),
             "npc": l["npc"], "map": l["map"], "kind": l["kind"],
             "file": l["id"] + ".mp3", "status": "ok",
             "duration_s": duration(os.path.join(VOICE, l["id"] + ".mp3"))}
        if l.get("provisional"):
            e["note"] = "PROVISIONAL: " + l["provisional"]
        m[l["id"]] = e
    # 4. cap nhat 5 intro
    for lid, (voice, vid) in INTRO_VOICE.items():
        shutil.copyfile(os.path.join(INTRO_SRC, lid + ".mp3"), os.path.join(VOICE, lid + ".mp3"))
        e = m[lid]
        e["voice"], e["voice_id"] = voice, vid
        e["status"] = "ok"
        e["duration_s"] = duration(os.path.join(VOICE, lid + ".mp3"))
        e["note"] = "thu 2026-11-20, cho Bui phan bang tai"
    json.dump(m, open(mpath, "w"), ensure_ascii=False, indent=1)
    total = len(m)
    ok = sum(1 for v in m.values() if v.get("status") == "ok")
    print("MANIFEST OK: total=%d ok=%d (truoc: total=26 ok=21)" % (total, ok))
    return 0

if __name__ == "__main__":
    sys.exit(main())
