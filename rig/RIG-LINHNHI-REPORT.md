# RIG XƯƠNG GODOT — NPC LINH NHI, HƯỚNG NAM (CHƯA NGHIỆM THU)

Ngày: 2026-11-20. Lệnh Bui: "Dùng Godot làm" — chuyển động ra từ rig xương
Godot 4.5.1, theo đúng pipeline RIGWALK/GODOTRIG đã duyệt của Hà Nhân
(`game-ngu-hanh-godotrig/RIG-8DIRS-REPORT.md`). Không sinh khung hình trực
tiếp, không dùng media.generate_image/generate_video. Không sửa cây
godotrig của Hà Nhân (đã kiểm: không tệp nào trong cây đó bị đổi), không
sửa cây game web, không gộp live — chỉ giao khung + rig.

Nguồn mẫu duy nhất: `game-ngu-hanh-deploy/assets/art/npc-linhnhi.png`
(221×560 RGBA, bé gái chibi tranh màu nước, hai búi tóc, áo dài vải vá màu
kem, thắt lưng hồng, tay phải cầm giỏ tre, giày vải). Chỉ có hướng nam —
đợt này CHỈ làm rig hướng nam, không bịa hướng khác, không lật gương.

## Kết luận

**Hướng nam ĐẠT cổng.** Rest-pose (idle-0) khớp sprite gốc IoU 0,9441,
bbox ±1px; chân luân phiên nhấc 9px đọc được ở 118px; đáy bbox mọi khung
557–559 (±1px quanh điểm đất 558); soi contact sheet 118px + zoom chân
3x không rách khớp, không méo, không vỡ viền.

## Phương pháp

1. **Cắt mảnh** (`work/cut_linhnhi_south.py`): full-frame 221×560, solidify
   viền 1px. head (tóc+mặt, y≤190 + sợi tóc hai bên tới y215), torso
   (váy y188–528, lấp lỗ tay bằng màu áo kem 240/229/209), armL (tay trái
   ảnh = tay cầm giỏ, hộp x8–72, y195–398), armR (x148–214), basket
   (mảnh riêng: pixel nâu tre R−G>22, G−B>15 trong hộp x≤66, y375–472 +
   quai x18–38, y380–412; closing + lấp lỗ), legL/legR (chỉ giày
   y≥520 + nối dài hẹp 15px lên tới y496, giấu dưới váy như bài học
   "nối dài mảnh chân"). Composite rest-pose IoU 0,9552, bbox ±1px.
2. **Rig** (`scripts/rig_data.gd`, `scripts/build_rig.gd`): Skeleton2D,
   bone hips → torso → head/armL/armR/basket; hips → legL/legR.
   Ground pivot (110, 558). Pivot xương (tọa độ khung):
   hips (110,470), head (110,110), vai trái (55,235), vai phải (165,235),
   tay cầm giỏ (30,395), đỉnh chân trái (92,505), phải (130,505).
   build_rig.gd mở rộng so với bản gốc: thêm cả hai animation "walk"
   và "idle" (bản gốc chỉ thêm "walk"). z_index dương + z_as_relative
   = false, Bone2D rest đặt ngay khi dựng, AnimationLibrary tên rỗng —
   đúng 3 bài học rig.
3. **Render 2x** (`scripts/render2x.gd`): SubViewport 520×1140 (có biên
   quanh sprite 442×1120 để lắc/xoay không cắt mép — xem vòng sửa 1),
   rig tại (260,1128), scale 2, nền trong suốt, Linear filter.
4. **Đóng gói** (`scripts/pack_export2x.py`): Lanczos 520×1140 → 260×570,
   crop (20,6)–(241,566) → 221×560, pivot điểm đất (110,558) mọi khung.

## Animation

- **WALK 0,8s loop, 8 khung @10fps** (theo mẫu `_south()` của Hà Nhân):
  chân nhấc xen kẽ +10px (đo được 9px sau làm tròn), lắc hông ±2px,
  tay đung đưa ±3° (armL bất đối xứng +2° ở cực trái — xem vòng sửa 2),
  giỏ đung đưa ngược pha tay ±10° quanh điểm cầm + bù vị trí ±3px.
- **IDLE 2,4s loop, 4 khung tại 0 / 0,6 / 1,2 / 1,8s**: thở (hips
  nhấc −1px chậm), đầu gật ±1px, giỏ đung đưa ±2°. Tay/chân đứng yên.
  Idle có track rest cho chân/tay (xem vòng sửa 3).

## Bảng đo (khung export 221×560, alpha>30)

| khung | bbox | đáy giày trái | đáy giày phải |
|---|---|---|---|
| walk-s-0 | x3–217, y3–559 | 559 | 559 |
| walk-s-1 | x4–218, y2–558 | 554 | 558 |
| walk-s-2 | x5–219, y1–557 | **548** (nhấc 9px) | 557 |
| walk-s-3 | x4–218, y2–558 | 554 | 558 |
| walk-s-4 | x3–217, y3–559 | 559 | 559 |
| walk-s-5 | x2–218, y2–558 | 558 | 554 |
| walk-s-6 | x0–220, y1–557 | 557 | **548** (nhấc 9px) |
| walk-s-7 | x2–218, y2–558 | 558 | 554 |
| idle-0 | x3–217, y3–559 | 559 | 559 |
| idle-1 | x3–217, y1–558 | 558 | 558 |
| idle-2 | x3–217, y3–559 | 559 | 559 |
| idle-3 | x3–217, y3–558 | 558 | 558 |

- Đáy bbox mọi khung 557–559: chênh ±1px quanh điểm đất 558 (cổng ±2px) ✓.
- Rest-pose idle-0 vs gốc: IoU 0,9441; bbox x3–217 (gốc 4–216), y3–559
  (gốc 4–559) — lệch ±1px, do viền solidify 1px ✓.
- Soi mắt: contact sheet 118px (`work/contact_118px.png`) — dáng đi đọc
  được, giỏ lắc theo nhịp; zoom chân 3x (`work/feet_zoom3x.png`) — gót
  bám đất, không rách ở viền váy/giày; đối chiếu idle-0 vs gốc
  (`work/idle0_vs_source.png`) — giống hệt bằng mắt.

## Vòng sửa (3 vòng)

1. **Render trống (lỗi setup, chưa tính vòng sửa art):** project mới chưa
   chạy `--import` nên `load()` trả texture null, 12 khung toàn trong
   suốt. Sửa: import trước rồi mới build rig.
2. **Vòng sửa 1 — giỏ văng khỏi khung:** viewport 2x vừa khít sprite
   (442×1120) làm tay xoay cắt mép; tay ±6° quanh vai còn quăng giỏ
   (cách vai ~235px) lệch ~21px, f06 chạm x=7. Sửa: viewport 520×1140
   có biên; tay giảm ±3°, giỏ đung ngược ±8°.
3. **Vòng sửa 2 — giỏ vẫn chạm mép trái + chân lún khỏi khung:**
   f06 còn −5,5px; hips +2 làm đáy giày tới 561,5 (vượt khung 560) và
   đỉnh tóc chạm 0,5. Sửa: hips chỉ nhấc lên (0/−2px, không lún xuống),
   lắc hông ±2px, armL bất đối xứng (+2° cực trái), giỏ đung ngược
   ±10° + bù vị trí ±3px. Kết quả: mọi khung nằm gọn trong khung,
   f06 chạm mép trái đúng x=0 (1 khung, viền giỏ chạm mép chứ không
   bị cắt).
4. **Vòng sửa 3 — idle kẹt tư thế walk:** AnimationPlayer giữ nguyên
   giá trị của property mà animation mới không track, nên idle-0 kế
   thừa chân phải đang nhấc dở từ walk (đáy giày phải 555 thay vì
   559). Sửa: thêm track rest cho chân/tay vào idle. Đây là bẫy chung
   của pipeline — animation nào cũng phải track đủ property nó chạm tới.

## Tệp giao

- Khung export (12 khung 221×560 + manifest):
  `rig/export/linhnhi-walk-s-0..7.png`, `rig/export/linhnhi-idle-0..3.png`,
  `rig/export/manifest.json` (pivot (110,558) mọi khung, bbox từng khung).
- GIF đối chiếu trên nền Miếu Hoang thật (crop (380,200)–(1020,560)
  quanh điểm đứng (700,560), nhân vật cao 200px, bóng tiếp xúc mờ):
  `rig/work/linhnhi-walk-south.gif` (16 khung, đi ngang qua nền),
  `rig/work/linhnhi-idle.gif` (4 khung, đứng thở tại chỗ).
- Rig Godot: `rig/rig_south.tscn`, `rig/scripts/{rig_data,build_rig,
  render2x,pack_export2x}.gd/.py`, `rig/pieces/south/*.png`,
  `rig/work/cut_linhnhi_south.py`, `rig/out_2x/south/` (render 2x gốc).

## Hạn chế còn lại (khai thật)

1. **Chớp mắt KHÔNG làm được:** mắt vẽ liền trên mảnh mặt; không có mảnh
   mí mắt riêng. Không bịa.
2. **Chỉ hướng nam.** 7 hướng khác thiếu art gốc — không làm được bằng
   rig (rig chỉ cắt mảnh từ art có sẵn, không sinh hướng mới).
3. **Chân là mảnh cứng một khối** (giày + nối dài giấu dưới váy): giày
   xoay cứng, không gập cổ chân; váy dài che hết chân nên bước đi đọc
   chủ yếu qua giày nhấc + lắc hông — giống giới hạn đã khai ở rig Hà Nhân.
4. **Váy tĩnh** trong khi chân đung đưa (giới hạn rối giấy chung).
5. **Tay cầm giỏ trượt ~3px trong tay** ở cực đung (bù vị trí giữ giỏ
   trong khung); ở cỡ hiển thị 118px là dưới 1px, không thấy.
6. **Giỏ chạm mép trái khung (x=0) đúng 1 khung** walk-s-6 ở cực đung
   trái; không bị cắt pixel nào nhưng không còn biên.
7. Mảnh basket có lẫn vài pixel nâu ở y378, x44–67 (mảng vá/quai lẫn
   vào mask màu tre) — đi theo giỏ khi đung, không thấy ở cỡ thật.
8. Không có điểm nắm vũ khí (Linh Nhi không mang vũ khí) — manifest
   không ghi grip.
