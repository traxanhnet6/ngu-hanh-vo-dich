# NGUỒN 7 HƯỚNG IDLE — NPC LINH NHI (CHƯA NGHIỆM THU)

- **Lệnh:** Bui quyết 06:22 ngày 2026-11-20 "Làm thêm 7 hướng rồi gộp".
- **Mục đích:** 7 khung idle làm **NGUỒN cho rig xương Godot** (cắt mảnh → rig → render
  chuyển động như hướng nam), **KHÔNG phải khung chuyển động trực tiếp**, chưa gộp live.
- **Trạng thái: XONG 7/7 khung, ĐẠT cổng tự kiểm — CHƯA NGHIỆM THU** (chờ Bui phán
  bằng mắt; rig 7 hướng chưa làm — đó là việc tiếp theo, không thuộc đợt này).
- **Cây đợt:** `~/workspace/game-ngu-hanh-linhnhi-move/` — chỉ thêm mới
  `rig/source/` + `rig/work7/`; **không đụng** cây deploy, `rig/rig_south.tscn`,
  `rig/pieces/south/`, `rig/export/` (git status đợt này chỉ thấy file mới
  trong `rig/source` + `rig/work7`; `js/engine.js` sửa là từ đợt 1, không phải đợt này).
- **Mẫu gốc duy nhất:** `game-ngu-hanh-deploy/assets/art/npc-linhnhi.png`
  (221×560 RGBA, bbox 4–216 × 4–559, cao 556px, tâm x 110,5; pivot đất (110,558)).

## 1. Phương pháp

1. **Sinh từng khung một** bằng `media.generate_image`, luôn kèm ảnh gốc làm
   reference, prompt ghi rõ hướng + vị trí giỏ theo giải phẫu (xem §3). Sinh
   tuần tự, không song song (đĩa/CPU đang có đợt thu giọng NPC chạy nền).
2. **Tách nền:** ảnh sinh ra là RGB nền trắng 880×2368, không có alpha.
   Thử `rembg` (u2net) trước — **thất bại: tải model 1,02 GB rồi bị OOM-kill**
   (RAM chia sẻ 6 GB, đợt thu giọng đang chạy). Chuyển sang **flood-fill PIL**
   (`rig/work7/norm2.py`): nền trắng thuần (255) + nhân vật viền mực đậm nên
   tách sạch; làm mềm viền 1px (GaussianBlur) cho mép màu nước.
   Model cache `~/.rembg/models` (1,2 GB) để nguyên (cache dùng chung, đĩa còn 43 GB);
   venv tạm `~/.tmp-rembg-venv` (594 MB) đã xoá; mọi file thô sinh ra đã xoá.
3. **Chuẩn hoá** (`norm2.py`): crop theo bbox alpha → scale Lanczos sao cho
   bbox cao đúng 556px (bằng khung nam) → đặt lên canvas 221×560 RGBA sao cho
   đáy bbox = 558–559, tâm bbox x ≈ 110,5.
4. **Vá túi trắng** (`rig/work7/pockets.py`): flood-fill không với tới các
   khoảng trắng **bị tóc/vạt áo bao kín** (không nối ra biên) — xem vòng sửa §4.
5. **Cổng đo độc lập** (`rig/work7/gate.py`, đọc lại file cuối từ đĩa):
   kích thước, bbox, đáy, tâm, chiều cao đầu (hàng cổ = hàng hẹp nhất y150–280),
   trọng tâm pixel giỏ tre (quy tắc màu như script cắt mảnh đợt 1:
   R−G>22 & G−B>15, nửa dưới y>350), kiểm lật gương (IoU khung đông so với
   lật ngang khung tây), contact sheet 118px + zoom đầu 2x trên nền tối.

## 2. Bảng đo (đọc lại từ file giao, alpha>12)

| Hướng | Kích thước | bbox x | bbox y | Cao bbox | Đáy | Tâm x | Đầu (cao) | Giỏ tre: trọng tâm x / bên | Kết quả |
|---|---|---|---|---|---|---|---|---|---|
| bắc (n) | 221×560 | 3–217 | 3–558 | 556 | 558 | 110,0 | 190 | 77 / trái | **PASS** |
| đông-bắc (ne) | 221×560 | 7–213 | 3–558 | 556 | 558 | 110,0 | 181 | 139 / phải | **PASS** |
| đông (e) | 221×560 | 13–207 | 3–558 | 556 | 558 | 110,0 | 193 | 113 / phải | **PASS** |
| đông-nam (se) | 221×560 | 10–211 | 3–558 | 556 | 558 | 110,5 | 196 | 82 / trái | **PASS** |
| nam (s, gốc) | 221×560 | 4–216 | 4–559 | 556 | 559 | 110,0 | 194 | 76 / trái | (tham chiếu) |
| tây-nam (sw) | 221×560 | 7–213 | 4–558 | 555 | 558 | 110,0 | 185 | 123 / phải | **PASS** |
| tây (w) | 221×560 | 7–213 | 3–558 | 556 | 558 | 110,0 | 191 | 118 / phải | **PASS** |
| tây-bắc (nw) | 221×560 | 4–215 | 3–558 | 556 | 558 | 109,5 | 189 | 123 / phải | **PASS** |

- Cổng: 221×560 · đáy 557–559 · cao 553–557 · tâm x 110±4 → **7/7 PASS**.
- Chiều cao đầu 181–196px so với nam 194px (đông-bắc 181 ngắn nhất, −7% — soi
  mắt ở 118px không thấy lệch tỉ lệ đầu/thân; xem §5).
- Soi mắt: contact sheet 8 hướng ở 118px (`rig/work7/contact_8dirs_118px.png`)
  + zoom đầu 2x (`rig/work7/heads_zoom2x.png`) trên nền tối — không méo,
  không vỡ viền, không quầng trắng quanh thân; 8 hướng đọc khác nhau rõ.

## 3. Quyết định vị trí giỏ tre (tay phải của Linh Nhi — không lật gương)

Nguyên tắc: giỏ **luôn ở tay phải của cô**, vị trí trong ảnh đổi theo hướng nhìn:

| Hướng | Giỏ ở đâu trong ảnh | Vì sao đúng |
|---|---|---|
| bắc (quay lưng) | Mép **trái**, tay phải cầm, thấy rõ cả giỏ | Quay lưng: tay phải của cô = bên trái ảnh |
| đông-bắc (lưng-phải 3/4) | Hông **phải**, thấy rõ | Mặt phải hướng về người xem, tay phải ở phía gần |
| đông (profile phải) | Trước váy, lệch **phải**, thấy rõ cả giỏ | Tay phải là tay gần người xem |
| đông-nam (trước-phải 3/4) | Mép **trái**, thấy rõ cả giỏ | Quay mặt về phía xem: tay phải của cô = bên trái ảnh |
| tây-nam (trước-trái 3/4) | Chỉ **ló mép phải** sau váy | Tay phải là tay xa, khuất sau thân; chỉ vành + quai ló ra |
| tây (profile trái) | Chỉ **ló mép phải** sau lưng | Như trên: tay phải khuất sau thân |
| tây-bắc (lưng-trái 3/4) | Chỉ **ló mép phải** sau thân | Như trên |

- Đông ≠ tây lật ngược: đông giỏ to trước váy (8.557 px giỏ), tây giỏ chỉ ló
  sau lưng (4.533 px giỏ); nơ hồng đông ở mép phải, tây ở mép trái sau lưng.
- Kiểm lật gương (IoU alpha khung đông vs lật ngang khung tây): **0,897**
  (đông-bắc vs lật tây-bắc 0,857; đông-nam vs lật tây-nam 0,889; cổng <0,90).
  IoU vẫn cao vì **silhouette váy gần như đối xứng** — bằng chứng chống lật
  thật nằm ở chi tiết bất đối xứng: vị trí + kích thước giỏ, nơ, mặt
  (xem bảng §2 và ảnh đối chiếu), không nằm ở IoU silhouette.

## 4. Vòng sửa nội bộ (2 vòng, tối đa 3 vòng/khung — không khung nào quá 2 vòng)

1. **Tây-nam vòng 1 → RỚT cổng mắt, sinh lại:** giỏ rơi sang mép **trái** ảnh
   (tay trái — sai tay) và bị cắt cụt ở mép khung. Vòng 2 prompt ghi rõ
   "giỏ tay phải phía xa, chỉ ló mép phải, không cắt mép" → **đạt**: giỏ ló
   sau váy mép phải, mặt 3/4 nhìn trái, đủ hai búi.
2. **Bắc + tây-bắc — vá túi trắng:** zoom đầu 2x lộ 2 khoảng trắng lớn bị tóc
   bao kín hai bên cổ (bắc: 992 px + 928 px tại y165–215; tây-bắc: 424 px
   tại y184–210) — flood-fill không với tới. Đã xoá 3 túi bằng
   `pockets.py --fix` (chỉ xoá component trắng diện tích >400 px, cả hai
   chiều >12 px). Sau vá: đầu bắc 214 → **190px** (khớp nam 194), tây-bắc
   189px; bbox/đáy/tâm không đổi, vẫn PASS.
3. **rembg OOM** (xem §1): không tính là vòng sửa art; đã chuyển hướng kỹ thuật.

## 5. Hạn chế — khai thẳng

1. **Tàn dư trắng nhỏ trong tóc:** còn các khoảng trắng kín <250 px (lớn nhất:
   tây-nam 245 px, đông-nam 218 px, đông-bắc 237 px) giữa các sợi tóc — không
   xoá vì không phân biệt được với vệt sáng trắng cố ý trên tóc. Ở cỡ hiển
   thị thật 118px chúng chỉ còn ~1–3 px, đọc như sợi tóc sáng, không thấy
   trên contact sheet.
2. **Giỏ ở tây-nam / tây / tây-bắc chỉ ló một phần** (đúng giải phẫu, nhưng khi
   cắt mảnh cho rig, mảnh basket ở 3 hướng này sẽ nhỏ — rig cần tự bù như
   đã bù ở hướng nam, hoặc chấp nhận giỏ khuất khi cô quay lưng-trái).
3. **Đông-bắc đầu 181px** (−7% so với nam 194px): trong ngưỡng mắt, nhưng là
   khung lệch nhất; nếu rig cắt mảnh đầu thấy nhỏ thì sinh lại khung này trước.
4. **Silhouette đông/tây IoU 0,897** sát cổng 0,90 — váy chibi vốn đối xứng;
   tính "hướng thật" dựa vào giỏ/nơ/mặt (xem §3), không dựa vào silhouette.
5. **Kế thừa từ đợt 1:** không chớp mắt (mắt vẽ liền trên mặt); đây là khung
   **nguồn tĩnh**, chuyển động (thở/đi) vẫn do rig sinh ra — chưa làm.

## 6. Tệp giao (7 PNG, CHƯA NGHIỆM THU)

| File | md5 | Dung lượng |
|---|---|---|
| `rig/source/linhnhi-idle-n.png` | 05c69a1cf0faa302a25124dce0bc884c | 221.980 B |
| `rig/source/linhnhi-idle-ne.png` | 2d58f47873364a9b674c08194a9adcac | 202.988 B |
| `rig/source/linhnhi-idle-e.png` | 18a1961da8e66d28cac9f886e248a5b5 | 179.054 B |
| `rig/source/linhnhi-idle-se.png` | 9be5680cd140e1d0ea5a7a879ccf8c94 | 210.355 B |
| `rig/source/linhnhi-idle-sw.png` | fb71c1ddedfb7ef56e8edb2cd0bd6103 | 205.418 B |
| `rig/source/linhnhi-idle-w.png` | 617455abe73b2167328c6c24ef41dc8f | 179.945 B |
| `rig/source/linhnhi-idle-nw.png` | b8d4461ee98e5f6e28d266c411e454da | 212.565 B |

- Ảnh đối chiếu: `rig/work7/contact_8dirs_118px.png` (8 hướng, cao 118px,
  nền tối), `rig/work7/heads_zoom2x.png` (đầu 8 hướng, zoom 2x, nền tối).
- Script tái lập: `rig/work7/norm2.py` (tách nền + chuẩn hoá),
  `rig/work7/pockets.py` (vá túi trắng), `rig/work7/gate.py` (cổng đo);
  `rig/work7/norm.py` là bản rembg đã bỏ (giữ lại làm vết).
- Pivot dùng chung với hướng nam: **(110, 558)** mọi khung.

## 7. Còn nợ — parent / bước tiếp

- Rig xương Godot 7 hướng từ 7 khung nguồn này (cắt mảnh → rig → render
  walk/idle như đợt 1); chưa làm trong đợt này.
- Bui phán bằng mắt trên điện thoại thật rồi mới gộp live (cả 7 hướng này
  vẫn là nguồn nội bộ, không trình Bui dưới dạng game art hoàn chỉnh).
- Lưu ý đĩa: lúc nhận việc báo headroom ~2 GB, thực đo `df` = **43 GB trống**
  (150 GB, đã dùng 107 GB) — không cạn đĩa trong đợt này.
