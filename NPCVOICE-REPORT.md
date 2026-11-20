# NPCVOICE-REPORT — Lồng tiếng cho các NPC chưa có giọng (Ngũ Hành Vô Địch)

Ngày: 2026-11-20. Bui lệnh 05:32: "Các npc chưa lồng tiếng lồng tiếng vào".
Bổ sung 05:33: (1) "Nhân vật nữ thì cốt chuyện văn bản phù hợp cho nữ" — rà + sửa
văn bản nữ trước khi thu giọng nữ. (2) Luật cứng: "Bản lồng tiếng nhân vật npc
phải theo đúng giới tính nam và nữ" — tuyệt đối không gán chéo.
Cây làm việc dự kiến: `~/workspace/game-ngu-hanh-npcvoice/` (chưa nhân bản được —
xem §0). Live hiện tại: HEAD `7ad01cf`. Không đụng live, không commit gì trong đợt này.

## §0. CHẶN ĐĨA — DỪNG Ở BƯỚC RÀ SOÁT (theo đúng brief)

- Đo headroom 05:33: `fallocate 2G` FAIL, `1G` FAIL, `500M` OK, `200M` OK.
  Đo lại cuối đợt: `500M` OK. **Headroom thực ~500MB–1GB, dưới ngưỡng 2GB.**
- Cây deploy 1,6GB nên **KHÔNG nhân bản được cây đợt** → không thu giọng mới,
  không ghép manifest, không kiểm trình duyệt trong đợt này.
- Đợt này làm xong phần không tốn đĩa: **rà soát toàn bộ (đọc trên cây deploy),
  kiểm giới tính giọng bằng đo F0, rà văn bản nữ + sửa, bảng gán giọng, kế hoạch
  thu/ghép chi tiết**. Parent quyết dọn đĩa xong là nối tiếp được ngay từ §6.

## §1. CƠ CHẾ LỒNG TIẾNG (đã đọc mã — quyết định cách ghép)

- `js/voice.js` (GameVoice): tải `assets/voice/manifest.json`, tra cứu theo
  **NỘI DUNG CÂU THOẠI** (chuẩn hoá khoảng trắng) + tên người nói, phát qua 1
  phần tử Audio. Câu nào `status != 'ok'` hoặc không có trong manifest → im lặng.
- `playFor()` chỉ được gọi ở 2 chỗ: `js/ui.js:4138` `renderDialogueLine()`
  (mọi thoại NPC qua hộp thoại) và `js/intro.js:182` (5 cảnh mở đầu).
  → **Mọi câu thoại qua hộp thoại chỉ cần thêm entry manifest + file mp3 là phát
  được, không cần sửa code.** Ngoại lệ duy nhất: 3 câu Trưởng Lão Dược Điền ở
  `js/ui.js:4196, 4259, 4274` (xem §5.3).
- Nguồn thoại nói (đã quét hết): `js/mapdata.js` (dialogueDefault/Quest),
  `js/mo-dau.js` (Linh Nhi milestone/low, Mã Tam, Lão Già/Chấp Sự giả),
  `js/p2g.js` (thoại mốc hảo cảm), `js/engine.js` (Mã Tam battle intro, Hà Nhân
  độc thoại), `js/intro.js` (5 cảnh), `js/ui.js` (3 câu Trưởng Lão).
  KHÔNG phải thoại nói (ngoài phạm vi): `quests.js`/`zonequests.js` (mô tả
  nhiệm vụ hiện ở UI, không qua hộp thoại), `ELDER_DEMO_STEPS` 12 mô tả pháp
  quyết (hiện ở UI demo, chưa quyết có lồng hay không — xem §7), 8 gợi ý
  `tutorial.js` (hướng dẫn hệ thống, không phải lời NPC).

## §2. KIỂM KÊ TOÀN BỘ: 85 CÂU NÓI — 26 CÓ TRONG MANIFEST, 54 THIẾU HẲN, 5 INTRO ĐÃ THU CHỜ PHÁN

### 2.1 Manifest live hiện tại (26 entries)

| Nhóm | Số câu | Tình trạng giọng |
|---|---|---|
| Linh Nhi 01–08 | 8 | `status: ok` nhưng **SAI GIỚI TÍNH** — giọng Ngọc Ngạn (nam) cho nhân vật nữ |
| Chưởng Môn 01–03, Chấp Sự 01–03, Trưởng Lão 01, Ẩn Sĩ 01 | 8 | `status: ok` nhưng **SAI GIỚI TÍNH** — giọng MC Blog (nữ) cho nhân vật nam |
| Tiếp Dẫn 01–03, Dược Sư 01, Thương Nhân 01 | 5 | `status: ok` nhưng dùng **Demo Voice `demo0001` (giọng mẫu tiếng Anh — đã cấm)** |
| Intro scene 1–5 | 5 | `status: missing` (file đã thu xong 04:53, xem §2.3) |
| **Tổng** | **26** | **21/21 câu NPC live đều sai (giọng ngược hoặc giọng cấm)** |

### 2.2 Gói VOICE-GENDER đã sửa xong từ 2026-11-13 (CHƯA GHÉP, CHỜ TAI BUI PHÁN)

`~/workspace/game-ngu-hanh-voice-gender/` — 26 mp3 (1,9MB, 0 tệp rỗng) + 9 bản
nghe thử (1/vai). Đợt này **đo lại độc lập bằng `work/f0b.py`**:

| File kiểm lại | F0 trung vị đo được | Kết luận |
|---|---|---|
| Pack `linh-nhi-01.mp3` | 262 Hz | NỮ ✓ (báo cáo gói: 262 Hz — khớp) |
| Pack `chuong-mon-01.mp3` | 123 Hz | NAM ✓ (báo cáo gói: 123 Hz — khớp) |
| Pack `truong-lao-duoc-dien-01.mp3` | 119 Hz | NAM ✓ (báo cáo gói: 119 Hz — khớp) |
| **Live `linh-nhi-01.mp3` (đang chạy trên game)** | **122 Hz** | **NAM ✗ — bé gái Linh Nhi đang nói bằng giọng nam** |

- Pack sửa đúng 21 câu live (Linh Nhi → MC Blog nữ; 7 vai nam → Ngọc Ngạn nam)
  + thêm 5 câu Trưởng Lão Dược Điền (Ngọc Ngạn nam). **26/26 đúng hướng giới
  tính theo báo cáo gói (nữ 232–276 Hz; nam 105–145 Hz, không chồng lấn).**
- F0 chuẩn đối chiếu (luật cứng 05:33): nam trung ~105–135 Hz; nữ ~165–205 Hz
  (MC Blog thực đo 232–276 Hz sau xử lý +1 bán âm — vẫn rõ nữ).

### 2.3 Intro 5 cảnh — đã thu, không thu lại

File tại `~/workspace/voices/intro/intro-scene-1..5.mp3` (thu 04:53 ngày
2026-11-20): cảnh 1/3/4/5 Đạt Phi (nam, kể chuyện/Hà Nhân/Cổ Thư — đúng giới),
cảnh 2 Linh Nhi MC Blog (nữ — đúng giới). Đang chờ Bui phán bằng tai; đợt này
chỉ cần cập nhật manifest (status → ok, voice/voice_id, duration_s) sau khi
Bui duyệt, không thu lại.

### 2.4 THIẾU HẲN: 54 câu chưa có entry manifest, chưa có file

**A. Trong mapdata.js — 12 câu:**

| NPC | Giới tính | Câu thiếu | Ghi chú |
|---|---|---|---|
| Thương Nhân Chợ (`npc_cho_cui`) | Nam (asset tái dùng `npc-thuongnhan.png`) | 2 | Chợ củi Tây Lương |
| Bà Bán Bánh (`npc_banh_bao`) | **Nữ** ("Bà"; asset đang tái dùng `npc-ansi.png` nam — lệch hình, xem §8) | 2 | Sạp bánh Tây Lương |
| Lão Dược (`npc_hieu_thuoc`) | Nam ("Lão"; asset `npc-duocsu.png`) | 2 | Hiệu thuốc Tây Lương |
| Tuần Thú Sư (`npc_tuan_thu_su`) | **CHƯA XÁC ĐỊNH** | 2 | Chờ Bui quyết giới tính (như gói VOICE-GENDER đã ghi) |
| Lão Già Bị Tố (`npc_lao_gia`) | Nam ("Lão phu") | 1 | Câu mapdata (ngoài 9 câu fake ở mục B) |
| Tiểu Đan Đồng (`npc_dandong`) | **CHƯA XÁC ĐỊNH** (tên không phân giới; asset tái dùng `npc-duocsu.png` nam nhưng tái dùng không chứng minh được gì — Bà Bán Bánh cũng tái dùng hình nam) | 3 | Chờ Bui quyết giới tính |

**B. Trong mo-dau.js (chuỗi M2, qua hộp thoại) — 32 câu:**

| Nhóm câu | Nhân vật | Giới | Số câu |
|---|---|---|---|
| Linh Nhi milestone m1+m2 (cha mẹ bị vu oan; trâm của mẹ + giấc mơ 5 dòng sông) | Linh Nhi | Nữ | 4 |
| Linh Nhi low anNo/am/khoe (đói/bánh bao; lạnh/củi sưởi; ho/thuốc) | Linh Nhi | Nữ | 6 |
| Mã Tam retreat (2 câu rút lui) | Mã Tam | Nam | 2 |
| MODAU_BATTLE_INTROS matam1–4 (Mã Tam + tay chân, trước trận) | Mã Tam | Nam | 8 |
| FAKE_LAO_GIA_LINES meet 3 + waiting 1 + k2offer 2 + k2waiting 1 + done 2 | Lão Già | Nam | 9 |
| FAKE_CHAPSU_LINES (3 câu vạch mặt lão già) | Chấp Sự | Nam | 3 |

**C. Trong p2g.js (thoại mốc hảo cảm, qua `openDialogue`) — 8 câu:**

| NPC | Mốc 1 + mốc 3 | Giới |
|---|---|---|
| Linh Nhi | Cơm Linh Mễ để dành; mẩu sổ tay của cha ở Miếu Hoang | Nữ |
| Tiếp Dẫn Đệ Tử | Trông cổng; người mang ấn cũ lên tháp | Nam |
| Chưởng Môn | Tâm tính; Cổ Vương Rừng Độc + tàng kinh các | Nam |
| Chấp Sự Đường | Sổ sách; oan hồn quanh Miếu Hoang | Nam |

**D. Trong engine.js (độc thoại Hà Nhân, qua `openDialogue`, speaker 'Hà Nhân') — 2 câu:**
"Năm dòng khí nhỏ xíu vừa chuyển động trong người ta... Kim sinh Thủy..."
/ "Đây chính là vòng tương sinh ư? Từ đêm nay, ta bắt đầu tu luyện thật rồi!"
Giới: Nam (Hà Nhân). Chưa có giọng.

**Tổng thiếu: 54 câu = Nữ 14 + Nam 35 + Chưa xác định giới 5.**
(Nữ 14 = Linh Nhi mo-dau 10 + Linh Nhi P2G 2 + Bà Bán Bánh 2.
Nam 35 = Cho Củi 2 + Lão Dược 2 + Lão Già 10 + Mã Tam 10 + Chấp Sự fake 3 +
Tiếp Dẫn P2G 2 + Chưởng Môn P2G 2 + Chấp Sự P2G 2 + Hà Nhân 2.
Chưa xác định 5 = Tuần Thú Sư 2 + Tiểu Đan Đồng 3.)

## §3. RÀ VĂN BẢN NỮ — LUẬT BUI 05:33 "NHÂN VẬT NỮ THÌ CỐT CHUYỆN VĂN BẢN PHÙ HỢP CHO NỮ"

Nhân vật nữ có thoại trong game chỉ có 2 người: **Linh Nhi (21 câu) và Bà Bán
Bánh (2 câu)**. Đã đọc hết từng câu:

| Nhân vật / câu | Đánh giá | Hành động |
|---|---|---|
| Linh Nhi mapdata 01–08 (muội/ca ca, lo lắng, nấu cháo, đòi đi cùng) | Hợp nữ ✓ | Giữ nguyên |
| Linh Nhi mo-dau m1/m2/low 10 câu (nhớ cha mẹ, trâm của mẹ, giấc mơ, đói, lạnh, ho) | Hợp nữ ✓ — giọng em gái nhỏ lo cho ca ca | Giữ nguyên |
| Linh Nhi P2G mốc 1 (để dành cơm Linh Mễ) | Hợp nữ ✓ | Giữ nguyên |
| **Linh Nhi P2G mốc 3** | **LỖI CHỮ — "ca" thiếu chữ** | **SỬA (xem dưới)** |
| Linh Nhi intro cảnh 2 (đã thu bằng MC Blog) | Hợp nữ ✓ — em gái lo tuyết lớn, sợ không đủ tiền bánh bao/thuốc | **Không thu lại** (đã kiểm theo chỉ đạo, ghi nhận ở đây) |
| Bà Bán Bánh 2 câu ("Tiểu ca mua cho muội muội ở miếu phải không?"; "ăn cái bánh nóng mới có sức mà chặt củi") | Hợp nữ ✓ — giọng bà bán hàng hiền, gọi khách "Tiểu ca" | Giữ nguyên |

**SỬA DUY NHẤT (1 chỗ, `js/p2g.js:54`):**

- Gốc: "...nhưng nếu có dịp về đó, **ca** xem giúp muội với."
- Sửa: "...nhưng nếu có dịp về đó, **ca ca** xem giúp muội với."
- Lý do: "ca" là lỗi gõ thiếu chữ (Linh Nhi luôn gọi người chơi là "ca ca").
  Phải sửa cả văn bản trong `p2g.js` lẫn câu thu giọng, vì voice.js khớp giọng
  theo đúng nội dung câu hiển thị — lệch một chữ là không phát được.

Không có câu nữ nào nghe như giọng nam hay lệch tính cách. Kết luận rà nữ:
**1 lỗi chữ cần sửa, 0 câu cần viết lại.**

## §4. BẢNG GÁN GIỌNG CHO 49 CÂU MỚI (14 NỮ + 35 NAM) — THEO LUẬT CỨNG GIỚI TÍNH

Nguyên tắc: giọng nam (Ngọc Ngạn, Đạt Phi) chỉ cho NPC nam; giọng nữ (MC Blog,
Radio Nữ) chỉ cho NPC nữ. Mỗi file thu xong phải ghi rõ giới tính giọng, đối
chiếu giới tính nhân vật. F0 đối chiếu: nam ~105–135 Hz, nữ ~165–205 Hz (MC Blog
thực đo 232–276 Hz; Đạt Phi thực đo ~124–136 Hz; Radio Nữ mẫu 164,4 Hz, câu thử
~192–195 Hz).

### 4.1 Nữ — 14 câu → MC Blog `ab7cd3bf` (OmniVoice)

| Vai | Câu | Ghi chú |
|---|---|---|
| Linh Nhi — mo-dau milestone m1/m2 | 4 | Cùng vai/giọng với 8 câu pack (MC Blog, 1.0, +1 bán âm) |
| Linh Nhi — mo-dau low anNo/am/khoe | 6 | Id đề xuất: `linh-nhi-m1-01/02`, `linh-nhi-m2-01/02`, `linh-nhi-low-01..06` |
| Linh Nhi — P2G mốc 1 + mốc 3 (đã sửa "ca ca") | 2 | Id đề xuất: `linh-nhi-p2g-01/02` |
| Bà Bán Bánh — 2 câu sạp bánh | 2 | **TẠM QUYẾT, chờ tai Bui**: chưa có clone nữ già nào; dùng MC Blog chỉ thị già + hạ cao độ + chậm nhịp, ghi rõ PROVISIONAL. Nếu Bui không ưng thì cần giọng nữ già mới. |

### 4.2 Nam — 35 câu

| Vai | Câu | Giọng đề xuất | Ghi chú |
|---|---|---|---|
| Thương Nhân Chợ | 2 | Ngọc Ngạn, chỉ thị "middle-aged, male", 1.05, +2 bán âm (như Thương Nhân trong pack) | |
| Lão Dược | 2 | Ngọc Ngạn, "elderly, male, low pitch", 0.90 (như Dược Sư trong pack) | |
| Lão Già Bị Tố | 10 (1 mapdata + 9 fake) | Ngọc Ngạn, "elderly, male, low pitch", 0.85, giọng khàn/run nhẹ | |
| Chấp Sự — FAKE lines | 3 | Ngọc Ngạn, như Chấp Sự trong pack ("middle-aged, male", 1.02, +2 bán âm) | |
| Tiếp Dẫn — P2G | 2 | Ngọc Ngạn, như Tiếp Dẫn trong pack ("young adult, male, high pitch", 1.03, +3 bán âm) | |
| Chưởng Môn — P2G | 2 | Ngọc Ngạn, như Chưởng Môn trong pack ("elderly, male, low pitch", 0.92, −0,5 bán âm) | |
| Chấp Sự — P2G | 2 | Ngọc Ngạn, như Chấp Sự trong pack | |
| Hà Nhân — độc thoại | 2 | Ngọc Ngạn (đã duyệt cho Hà Nhân từ trước) | |
| Mã Tam — retreat 2 + battle intro 8 | 10 | **Đạt Phi (VieNeu) — ĐỀ XUẤT MỚI, chờ Bui chốt**: nam trung niên, giọng kể trầm hợp vai phản diện; tách hẳn khỏi 8 vai Ngọc Ngạn. Fallback nếu Bui muốn một giọng nam duy nhất: Ngọc Ngạn "middle-aged, male, low pitch", 0.90. F0 Đạt Phi thực đo ~124–136 Hz (nam ✓). | |

### 4.3 Chưa gán — 5 câu (KHÔNG thu khi chưa có quyết của Bui)

- Tuần Thú Sư (2 câu): giới tính chưa xác định từ gói VOICE-GENDER.
- Tiểu Đan Đồng (3 câu): giới tính chưa xác định (tên + lời thoại không phân
  giới; asset tái dùng hình nam không chứng minh được gì).
- Hỏi Bui: hai nhân vật này là nam hay nữ?

## §5. KẾ HOẠCH GHÉP (khi có đĩa — làm đúng thứ tự này)

1. Nhân bản cây deploy → `~/workspace/game-ngu-hanh-npcvoice/` (`cp -a`, không
   hardlink), đo headroom trước (≥2GB).
2. **Thay 21 file live bằng 21 file pack** (`game-ngu-hanh-voice-gender/mp3/`,
   đã đo F0 đúng giới) + cập nhật manifest (voice/voice_id đúng clone mới;
   riêng 3 câu Tiếp Dẫn/Dược Sư/Thương Nhân bỏ `Demo Voice`).
3. **Thu 49 câu mới**: MC Blog/Ngọc Ngạn qua OmniVoice cổng 3900 (khởi lại
   backend theo `~/workspace/tools/voicestudio/INSTALL-REPORT.md`, kèm
   `OMNIVOICE_CPU_GENERATE_TIMEOUT_S=1800`; tốc độ theo bảng §4; **lưu ý thời
   gian: đợt pack 26 câu chạy CPU 3,5–27 phút/câu — 39 câu OmniVoice có thể
   mất nhiều giờ, chia lượt, tiếp nối được**). Mã Tam 10 câu qua VieNeu Đạt Phi
   (nhanh, ~10–30s/câu; `denoise=True`; làm chậm nhẹ `atempo=0,92` nếu cần).
   Kiểm từng file: có tiếng thật, không rỗng, F0 đúng hướng giới tính, khớp
   đúng câu (đặc biệt câu P2G Linh Nhi đã sửa "ca ca").
4. **Thêm 54 entries manifest** (id mới theo mẫu `linh-nhi-m1-01`, `banh-bao-01`,
   `matam-retreat-01`, `lao-gia-fake-01`...; `status: ok`, `voice`/`voice_id`,
   `duration_s` đo thật; text phải khớp từng chữ với câu hiển thị trong game).
   **Sửa 1 chữ trong `js/p2g.js:54`** ("ca" → "ca ca"). **Cập nhật 5 intro**
   (status → ok + voice/voice_id/duration_s theo file đã thu).
5. **Sửa nối giọng 3 câu Trưởng Lão (wiring):** `js/ui.js:4196, 4259, 4274` đang
   gán `textEl.textContent` trực tiếp có tiền tố "Trưởng Lão Dược Điền: " mà
   KHÔNG gọi `playFor` → 3 file pack 03–05 đã thu sẽ không bao giờ phát.
   Sửa: sau mỗi lần gán text, gọi
   `window.GameVoice.playFor('Trưởng Lão Dược Điền', '<câu không tiền tố>')`.
   (Chỉ 3 chỗ này lệch; mọi câu khác đã qua `renderDialogueLine()`.)
6. Kiểm bằng trình duyệt thật trên cây đợt: mở thoại từng NPC (cả 5 nhóm mới +
   21 câu thay + 3 câu Trưởng Lão + 5 cảnh intro), giọng phát đúng lúc/đúng vai,
   công tắc lồng tiếng + âm lượng giọng vẫn tắt/mở được, 0 page error mới.
7. Trình parent → Bui phán bằng tai (9 bản nghe thử gói cũ + bản nghe thử mới)
   rồi mới gộp lên live. **Không gộp trước khi Bui phán.**

## §6. VIỆC CÒN LẠI SAU KHI CÓ ĐĨA (checklist nối tiếp)

- [ ] Dọn đĩa ≥2GB → nhân bản cây đợt.
- [ ] Hỏi Bui giới tính Tuần Thú Sư + Tiểu Đan Đồng (5 câu) — hoặc để lại sau.
- [ ] Bui chốt: Mã Tam dùng Đạt Phi hay Ngọc Ngạn; Bà Bán Bánh (giọng nữ già
      tạm bằng MC Blog hạ cao độ) có ưng không.
- [ ] Thu 49 câu mới + đo F0 từng file (ghi giới tính giọng vào báo cáo).
- [ ] Thay 21 file live bằng file pack + thêm 54 entries + sửa p2g.js + nối
      playFor 3 câu Trưởng Lão + cập nhật 5 intro.
- [ ] Kiểm trình duyệt thật → trình Bui phán bằng tai → gộp live.

## §7. QUYẾT ĐỊNH CÒN CHỜ BUI (không thuộc đợt này)

1. Giới tính Tuần Thú Sư + Tiểu Đan Đồng.
2. 12 mô tả `ELDER_DEMO_STEPS` có lồng tiếng hay không (hiện chỉ là chữ demo).
3. Tai Bui phán: 9 vai gói VOICE-GENDER + các vai mới (Mã Tam, Bà Bán Bánh...).
4. Bà Bán Bánh: chấp nhận MC Blog hạ cao độ tạm, hay cần clone giọng nữ già mới.
5. Nhân vật trong ảnh đại diện Bà Bán Bánh đang dùng hình nam (`npc-ansi.png`) —
   lệch hình với giới tính nữ — cần hình riêng cho 2 NPC này (xem §8).

## §8. HẠN CHẾ + GHI NHẬN TRUNG THỰC

- Chưa thu/ghi/ghép/kiểm trình duyệt câu nào trong đợt này (chặn đĩa §0).
- Phát âm chưa phiên âm bằng Whisper (không có Whisper trên máy) — cần tai Bui.
- Phía nam chỉ có 1 clone tiếng Việt (Ngọc Ngạn) + Đạt Phi mới; phía nữ chỉ có
  MC Blog + Radio Nữ mới — các vai cùng giới vẫn nhận ra cùng một người đọc nếu
  nghe kỹ (đã ghi trong báo cáo gói VOICE-GENDER §7).
- **§5.4 — Lệch hình (ngoài phạm vi giọng, ghi để parent chuyển đợt hình):**
  Bà Bán Bánh (nữ) đang dùng asset `npc-ansi.png` (nam); Tiểu Đan Đồng đang
  dùng `npc-duocsu.png` (cụ già nam). Khi giọng nữ vang lên từ hình nam sẽ lệch
  mạnh — cần hình riêng cho 2 NPC này.

## §9. LUẬT ĐỨNG GHI LẠI (để parent lưu — trích đúng lời Bui)

1. **"Bản lồng tiếng nhân vật npc phải theo đúng giới tính nam và nữ"**
   (Bui 05:33 ngày 2026-11-20) — nam đọc vai nam, nữ đọc vai nữ, tuyệt đối
   không gán chéo. Lỗi gán nhãn giới tính ngược từng xảy ra 2026-11-13 (hai
   clone bị gán ngược, 21/21 câu live sai) — không để lặp lại. Xác minh giới
   tính giọng bằng tai + đo F0 trước khi gán; mỗi file thu xong ghi rõ giới
   tính giọng, đối chiếu giới tính nhân vật.
2. **"Nhân vật nữ thì cốt chuyện văn bản phù hợp cho nữ"** (Bui 05:33 ngày
   2026-11-20) — lời thoại/cốt truyện nhân vật nữ phải viết cho hợp với nữ
   (xưng hô, giọng văn, nội dung đúng tính cách con gái). Rà + sửa văn bản nữ
   trước khi thu giọng nữ; câu nào chưa hợp thì sửa rồi mới thu.
