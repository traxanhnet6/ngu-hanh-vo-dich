# NPCVOICE-PHASE2-REPORT — Thu 54 câu mới + ghép vào game (Ngũ Hành Vô Địch)

Ngày: 2026-11-20. Bui lệnh gốc 05:32: "Các npc chưa lồng tiếng lồng tiếng vào".
Nối tiếp giai đoạn 1: [NPCVOICE-REPORT.md](NPCVOICE-REPORT.md) (rà soát xong 05:38).
**BUI QUYẾT 05:41: Tuần Thú Sư + Tiểu Đan Đồng CẢ HAI ĐỀU NAM** — 5 câu thu bằng Ngọc Ngạn.
Cây đợt: `~/workspace/game-ngu-hanh-npcvoice/` (nhân bản `cp -a` từ deploy HEAD `7ad01cf`,
đo `diff -rq` khớp toàn bộ, chỉ thêm NPCVOICE-REPORT.md). **CHƯA GỘP LIVE — chờ Bui phán bằng tai.**

## §0. TIẾN ĐỘ (cập nhật 23:0x ngày 2026-11-20)

- [x] Nhân bản cây đợt (1,6 GB), headroom lúc nhân bản 2G OK.
- [x] Rebase cây đợt lên live mới nhất `8a47c0f` (sửa lỗi bánh bao + chấm "!" — 06:04 ngày 2026-11-20): fast-forward sạch, không đụng file đợt này (8a47c0f chỉ sửa `css/style.css` + `js/engine.js`; đợt này sửa `js/p2g.js` + `js/ui.js`). Các thay đổi chưa commit của đợt giữ nguyên.
- [x] Sửa văn bản nữ `js/p2g.js:54`: "ca xem giúp muội" → "ca ca xem giúp muội với".
- [x] Trích đúng 54 câu từ mã nguồn, đối chiếu từng chữ với `js/mapdata.js` / `js/mo-dau.js` /
      `js/p2g.js` / `js/engine.js` — 54/54 khớp nguyên văn, 0 trùng câu, 0 trùng manifest cũ.
      Bảng câu + gán giọng: [work/lines.json](work/lines.json).
- [x] Thu 10 câu Mã Tam bằng Đạt Phi (VieNeu): **10/10 OK**, F0 128–143 Hz = nam ✓.
- [x] Câu thử OmniVoice (`tuan-thu-su-02`): **OK sau 346s** — raw 97.110 byte, mp3 2,0s, **F0 105 Hz = nam ✓**. (Lần thử đầu rớt vì `work/raw/` chưa được tạo — lỗi của đợt, đã sửa; `batch_omni.py` tự tạo thư mục nên đợt chính không gặp.)
- [x] Thu 44 câu OmniVoice (Ngọc Ngạn 30 + MC Blog 14): **44/44 XONG 21:32 ngày 2026-11-20**.
  Diễn biến: đợt batch kết thúc 21:09 ở 43/44 — câu `chuong-mon-p2g-02` rớt lỗi HTTP 400
  thoáng qua (request tới lúc 20:32:53, backend vừa khởi động lại 20:32:33, model TTS chưa
  nạp xong — không phải lỗi nội dung câu). Watchdog cron khởi động lại batch 21:23
  (backend cổng 3900 vẫn sống, không cần khởi lại); lượt chạy lại `ok=1 fail=0 skip=43`,
  câu cuối xong 21:32. Đo F0 44 file mới: xem bảng §3. Tiến độ:
  [work/batch-omni.log](work/batch-omni.log) + [work/progress-omni.json](work/progress-omni.json).
- [x] Nối `playFor` cho 3 câu Trưởng Lão Dược Điền (`js/ui.js:4196, 4259, 4274`).
- [x] Cập nhật manifest (21 file pack + 5 Trưởng Lão + 54 câu mới + 5 intro): **XONG 21:35
  ngày 2026-11-20** bằng `work/update_manifest.py` — tổng 85 entries, `ok` 85/85, 0 file
  thiếu (đã kiểm từng file trong `assets/voice/`). Backup manifest cũ:
  `work/manifest-before-phase2.json`.
- [ ] Kiểm trình duyệt thật trên cây đợt (đang chạy browser task).

## §1. HẠ TẦNG PHỤC HỒI (vướng ngoài dự kiến)

- Backend OmniVoice cổng 3900 không chạy sau khi máy ảo thay bản; lúc khởi lại thì
  `.venv/bin/python` trỏ tới `/home/hatch/.local/share/uv/python/.../python3.11`
  **không còn tồn tại** (uv python bị xóa theo lần thay bản).
- Khắc phục: tải CPython 3.11.10 standalone (python-build-standalone, 29,7 MB) về
  đúng đường dẫn uv cũ → venv chạy lại, `uvicorn+fastapi` import OK.
- Backend khởi lại OK: `/health` → `{"status":"ok","device":"cpu","version":"0.5.7"}`,
  model preload xong, `OMNIVOICE_CPU_GENERATE_TIMEOUT_S=1800`, `HF_HUB_OFFLINE=1`.
- Đĩa: sau khi nhân bản cây, headroom còn ~1 GB (1G OK, 2G FAIL). Phần còn lại của
  đợt chỉ cần ~50 MB (raw WAV + mp3 + manifest) — không chặn.

## §2. MÃ TAM — ĐẠT PHI (VieNeu) — 10/10 XONG

Script: [work/batch_vieneu_matam.py](work/batch_vieneu_matam.py)
(`tts.infer(text, ref_audio=ref-datphi.wav, denoise=True)`; xử lý `atempo=0.92`;
MP3 24 kHz mono 96 kbps). Thời gian: 5–28s/câu, cả đợt ~2 phút.

| File | Thời lượng | F0 trung vị | Giới |
|---|---|---|---|
| matam-retreat-01.mp3 | 3,1s | 139 Hz | NAM ✓ |
| matam-retreat-02.mp3 | 6,1s | 131 Hz | NAM ✓ |
| matam-battle-01.mp3 | 6,8s | 138 Hz | NAM ✓ |
| matam-battle-02.mp3 | 3,7s | 128 Hz | NAM ✓ |
| matam-battle-03.mp3 | 7,1s | 128 Hz | NAM ✓ |
| matam-battle-04.mp3 | 3,6s | 129 Hz | NAM ✓ |
| matam-battle-05.mp3 | 7,8s | 136 Hz | NAM ✓ |
| matam-battle-06.mp3 | 2,6s | 139 Hz | NAM ✓ |
| matam-battle-07.mp3 | 6,0s | 133 Hz | NAM ✓ |
| matam-battle-08.mp3 | 2,9s | 143 Hz | NAM ✓ |

F0 128–143 Hz: rõ nam, khớp hồ sơ Đạt Phi đã đo (~124–136 Hz). **Đề xuất mới, chờ
Bui phán**: Mã Tam dùng Đạt Phi để tách khỏi 8 vai Ngọc Ngạn; fallback Ngọc Ngạn
("middle-aged, male, low pitch", 0.90) nếu Bui muốn một giọng nam duy nhất.

## §3. OMNIVOICE — 44 CÂU (ĐANG CHẠY)

Script: [work/batch_omni.py](work/batch_omni.py) (tiếp nối được: bỏ qua câu đã có
raw >10 KB / mp3 đã có; lỗi từng câu không dừng đợt; tiến độ
[work/progress-omni.json](work/progress-omni.json) + [work/batch-omni.log](work/batch-omni.log)).

Phân vai (theo bảng gói VOICE-GENDER + quyết Bui 05:41):

| Vai | Câu | Clone | Chỉ thị / tốc độ | Xử lý sau thu |
|---|---|---|---|---|
| Linh Nhi (mo-dau m1/m2/low + P2G) | 12 | MC Blog | không chỉ thị, 1.0 | +1 bán âm, EQ sáng |
| Bà Bán Bánh | 2 | MC Blog | "elderly, female, low pitch", 0.90 | −1 bán âm, EQ ấm — **TẠM QUYẾT** (chưa có clone nữ già, chờ tai Bui) |
| Thương Nhân Chợ | 2 | Ngọc Ngạn | "middle-aged, male, moderate pitch", 1.05 | +2 bán âm, EQ sáng |
| Lão Dược | 2 | Ngọc Ngạn | "elderly, male, low pitch", 0.90 | giữ cao độ, EQ ấm |
| Tuần Thú Sư | 2 | Ngọc Ngạn | "young adult, male, high pitch", 1.03 | +2 bán âm, EQ sáng |
| Lão Già (mapdata 1 + fake 9) | 10 | Ngọc Ngạn | "elderly, male, low pitch", 0.85 | +0,5 bán âm, mềm + thoáng |
| Chấp Sự (fake 3 + P2G 2) | 5 | Ngọc Ngạn | "middle-aged, male, moderate pitch", 1.02 | +2 bán âm, tăng độ rõ |
| Tiếp Dẫn (P2G) | 2 | Ngọc Ngạn | "young adult, male, high pitch", 1.03 | +3 bán âm, EQ sáng |
| Chưởng Môn (P2G) | 2 | Ngọc Ngạn | "elderly, male, low pitch", 0.92 | −0,5 bán âm, tăng trầm |
| Hà Nhân (độc thoại) | 2 | Ngọc Ngạn | "young adult, male, moderate pitch", 1.0 | +1 bán âm, EQ sáng |
| Tiểu Đan Đồng | 3 | Ngọc Ngạn | "child, male, high pitch", 1.05 | +3 bán âm, EQ sáng |

Câu thử đầu tiên (`tuan-thu-su-02`, câu ngắn nhất): **ĐÃ XONG — OK sau 346s** (raw 97.110
byte → mp3 2,0s, F0 105 Hz = nam ✓). Đợt batch chính khởi động 23:08, đang chạy nền
(PID 36716); 44 câu dự kiến nhiều giờ, tiếp nối được, tiến độ ghi vào
`work/batch-omni.log` + `work/progress-omni.json` sau mỗi câu.

### Kết quả đo F0 — 44 câu OmniVoice (đo độc lập bằng `work/f0b.py`, 21:32 ngày 2026-11-20)

Dải hướng dẫn: nam ~105–135 Hz, nữ ~165–205 Hz. **Nữ (MC Blog, 14 câu): 229–262 Hz** —
cao hơn dải hướng dẫn nhưng vẫn rõ nữ (giọng MC Blog vốn cao; đã qua xử lý +1 bán âm
theo kế hoạch). **Nam (Ngọc Ngạn, 30 câu): 104–165 Hz** — 29/30 câu trong 104–147 Hz;
**1 câu cần tai Bui phán: `tiep-dan-p2g-01` = 165 Hz** (cao nhất nhóm nam — do +3 bán âm
theo kế hoạch "young adult, high pitch"; chạm ngưỡng nữ). Hai câu nam khác hơi trên dải
hướng dẫn do tăng bán âm theo kế hoạch: `chap-su-p2g-01` 147 Hz (+2), `dan-dong-02`
145 Hz (+3) — vẫn đọc là nam, chờ tai Bui xác nhận cùng đợt nghe thử.

| File | Thời lượng | F0 trung vị | Giới |
|---|---|---|---|
| linh-nhi-m1-01.mp3 | 6,9s | 250 Hz | NỮ ✓ |
| linh-nhi-m1-02.mp3 | 7,9s | 235 Hz | NỮ ✓ |
| linh-nhi-m2-01.mp3 | 6,5s | 254 Hz | NỮ ✓ |
| linh-nhi-m2-02.mp3 | 8,1s | 242 Hz | NỮ ✓ |
| linh-nhi-low-01.mp3 | 3,7s | 250 Hz | NỮ ✓ |
| linh-nhi-low-02.mp3 | 4,0s | 254 Hz | NỮ ✓ |
| linh-nhi-low-03.mp3 | 3,2s | 262 Hz | NỮ ✓ |
| linh-nhi-low-04.mp3 | 3,2s | 242 Hz | NỮ ✓ |
| linh-nhi-low-05.mp3 | 3,2s | 262 Hz | NỮ ✓ |
| linh-nhi-low-06.mp3 | 3,3s | 254 Hz | NỮ ✓ |
| linh-nhi-p2g-01.mp3 | 5,0s | 250 Hz | NỮ ✓ |
| linh-nhi-p2g-02.mp3 | 8,6s | 250 Hz | NỮ ✓ |
| banh-bao-01.mp3 | 4,5s | 242 Hz | NỮ ✓ |
| banh-bao-02.mp3 | 3,4s | 229 Hz | NỮ ✓ |
| cho-cui-01.mp3 | 4,3s | 136 Hz | NAM ✓ |
| cho-cui-02.mp3 | 4,1s | 119 Hz | NAM ✓ |
| lao-duoc-01.mp3 | 4,6s | 127 Hz | NAM ✓ |
| lao-duoc-02.mp3 | 4,5s | 105 Hz | NAM ✓ |
| tuan-thu-su-01.mp3 | 1,8s | 112 Hz | NAM ✓ |
| tuan-thu-su-02.mp3 | 2,0s | 105 Hz | NAM ✓ |
| lao-gia-01.mp3 | 4,3s | 134 Hz | NAM ✓ |
| lao-gia-fake-01.mp3 | 8,9s | 132 Hz | NAM ✓ |
| lao-gia-fake-02.mp3 | 10,7s | 131 Hz | NAM ✓ |
| lao-gia-fake-03.mp3 | 8,6s | 130 Hz | NAM ✓ |
| lao-gia-fake-04.mp3 | 4,8s | 134 Hz | NAM ✓ |
| lao-gia-fake-05.mp3 | 7,3s | 144 Hz | NAM ✓ |
| lao-gia-fake-06.mp3 | 9,0s | 133 Hz | NAM ✓ |
| lao-gia-fake-07.mp3 | 5,7s | 111 Hz | NAM ✓ |
| lao-gia-fake-08.mp3 | 5,9s | 127 Hz | NAM ✓ |
| lao-gia-fake-09.mp3 | 9,3s | 120 Hz | NAM ✓ |
| chap-su-fake-01.mp3 | 4,3s | 128 Hz | NAM ✓ |
| chap-su-fake-02.mp3 | 8,6s | 125 Hz | NAM ✓ |
| chap-su-fake-03.mp3 | 6,5s | 116 Hz | NAM ✓ |
| chap-su-p2g-01.mp3 | 5,1s | 147 Hz | NAM ✓ (trên dải, +2 bán âm) |
| chap-su-p2g-02.mp3 | 6,3s | 122 Hz | NAM ✓ |
| tiep-dan-p2g-01.mp3 | 4,6s | 165 Hz | NAM ? — cao nhất, chờ tai Bui |
| tiep-dan-p2g-02.mp3 | 10,2s | 133 Hz | NAM ✓ |
| chuong-mon-p2g-01.mp3 | 5,0s | 123 Hz | NAM ✓ |
| chuong-mon-p2g-02.mp3 | 9,6s | 121 Hz | NAM ✓ |
| ha-nhan-01.mp3 | 7,3s | 104 Hz | NAM ✓ |
| ha-nhan-02.mp3 | 4,2s | 123 Hz | NAM ✓ |
| dan-dong-01.mp3 | 5,8s | 119 Hz | NAM ✓ |
| dan-dong-02.mp3 | 6,3s | 145 Hz | NAM ✓ (trên dải, +3 bán âm) |
| dan-dong-03.mp3 | 8,2s | 136 Hz | NAM ✓ |

**Lưu ý kỹ thuật — câu Tuần Thú Sư 01:** chữ hiển thị trong game là
"Tuần Thú Sư: xem thú, chuồng và đổi Đan Thú." (kèm tiền tố tên, vì `openDialogue`
không tách tiền tố). Manifest `text` giữ đúng chữ hiển thị (kèm tiền tố) để
`voice.js` khớp được; bản thu chỉ đọc phần sau tiền tố ("Xem thú, chuồng và đổi
Đan Thú.") cho tự nhiên.

## §4. NỐI GIỌNG 3 CÂU TRƯỞNG LÃO DƯỢC ĐIỀN (ĐÃ SỬA — `js/ui.js`)

3 chỗ trước đây gán `textEl.textContent` trực tiếp mà không gọi `playFor` nên
5 file pack đã thu sẽ không bao giờ phát. Đã thêm sau mỗi lần gán:

- `ui.js:4196` → `playFor('Trưởng Lão Dược Điền', 'Ruộng Linh Mễ này là căn cơ... chớ nên nóng vội.')`
- `ui.js:4259` → `playFor('Trưởng Lão Dược Điền', 'Ngươi quả là kỳ tài thông tuệ, vừa nhìn đã thấu suốt bí quyết!')`
- `ui.js:4274` → `playFor('Trưởng Lão Dược Điền', 'Đó là 4 đại pháp quyết linh điền... tiếp nhận truyền thừa chưa?')`

Câu gọi dùng **câu không tiền tố** (khớp đúng `text` trong entry manifest của pack).
Không sửa `ui.js:4283` (12 mô tả `ELDER_DEMO_STEPS` — Bui chưa quyết có lồng hay không).

## §5. KẾ HOẠCH GHÉP (khi đủ 54 file)

Script: [work/update_manifest.py](work/update_manifest.py) (tự từ chối nếu thiếu file;
đo `duration_s` thật bằng ffprobe):

1. Thay 21 file live bằng 21 file gói VOICE-GENDER + sửa `voice`/`voice_id`/`speed`
   (Linh Nhi → MC Blog; 7 vai nam → Ngọc Ngạn; bỏ Demo Voice).
2. Thêm 5 entries `truong-lao-duoc-dien-01..05` (file pack).
3. Thêm 54 entries mới từ `work/lines.json` (file `work/mp3/`).
4. Cập nhật 5 intro: copy `~/workspace/voices/intro/intro-scene-1..5.mp3`, status → ok
   (cảnh 1/3/4/5 Đạt Phi; cảnh 2 MC Blog — sửa cả `voice` sai Ngọc Ngạn ở cảnh 2).
   Đã kiểm: 5 `text` manifest khớp từng chữ với `js/intro.js` (INTRO_SCENES).
5. Tổng sau ghép: 26 → 85 entries; `ok` 21 → 85 (21 pack + 5 Trưởng Lão + 54 mới + 5 intro).

## §6. KIỂM TRÌNH DUYỆT (CHƯA LÀM — CẦN PARENT)

Trên cây đợt, cần kiểm bằng trình duyệt thật: mở thoại từng NPC (5 nhóm mới +
21 câu thay + 3 câu Trưởng Lão + 5 cảnh intro), giọng phát đúng lúc/đúng vai,
công tắc lồng tiếng + âm lượng giọng tắt/mở được, 0 page error mới. Subagent
không có live browser — parent sắp xếp browser task khi đủ file.

## §7. HẠN CHẾ + GHI NHẬN TRUNG THỰC

- Phát âm chưa phiên âm bằng Whisper (không có Whisper trên máy) — cần tai Bui.
- Phía nam chỉ có 1 clone tiếng Việt (Ngọc Ngạn) + Đạt Phi mới; phía nữ chỉ có
  MC Blog + Radio Nữ mới — các vai cùng giới vẫn nhận ra cùng một người đọc nếu
  nghe kỹ (đã ghi trong báo cáo gói VOICE-GENDER §7).
- Bà Bán Bánh: giọng nữ già là tạm quyết (MC Blog hạ cao độ) — nếu Bui không ưng
  thì cần clone giọng nữ già mới.
- Mã Tam bằng Đạt Phi là đề xuất mới — chờ Bui chốt (fallback Ngọc Ngạn).
- Tuần Thú Sư + Tiểu Đan Đồng đã quyết đều nam (Bui 05:41) — thu bằng Ngọc Ngạn.
- Lệch hình (ngoài phạm vi giọng, đã ghi ở giai đoạn 1 §8): Bà Bán Bánh dùng hình
  nam (`npc-ansi.png`); Tiểu Đan Đồng dùng hình cụ già nam — cần hình riêng.
- Văn bản nữ chỉ sửa 1 chữ (`p2g.js:54`, "ca" → "ca ca"); 0 câu nữ cần viết lại.
- **Tổng số câu đợt này là 54, không phải 49** (brief ghi 49 theo cách tính cũ
  54 − 5 câu chưa xác định giới; Bui đã quyết cả 5 câu đều nam nên thu đủ 54).
