# RIG XƯƠNG GODOT — NPC LINH NHI, 7 HƯỚNG CÒN LẠI (CHƯA NGHIỆM THU)

Ngày: 2026-11-20. Lệnh Bui (06:22): "Làm thêm 7 hướng rồi gộp" — rig 7 hướng
còn lại theo đúng pipeline hướng nam đã duyệt (`RIG-LINHNHI-REPORT.md`).
Không sinh khung trực tiếp, không dùng media.generate_image. Chỉ làm trong
cây đợt `~/workspace/game-ngu-hanh-linhnhi-move/` — **không đụng** cây deploy,
`rig_south.tscn`, `rig/pieces/south/`, khung nam trong `rig/export/`,
`rig/source/`. Không gộp live.

## Kết luận

**7/7 hướng ĐẠT cổng.** Rest-pose IoU 0,945–0,956 (cổng ≥0,90); đáy bbox mọi
khung 557–559; chân nhấc xen kẽ 9–12px đo được; soi contact sheet 118px +
zoom chân 3x + GIF trên nền Miếu Hoang thật (đông, bắc) không rách khớp,
không méo, không vỡ viền ở cỡ game. 84 khung mới: 56 walk + 28 idle.

## Bảng đo (khung export 221×560, alpha>30)

| Hướng | Cắt rest IoU | Rig rest IoU (idle-0 vs nguồn) | rest bbox (nguồn) | Lift walk-2 / walk-6 | Đáy mọi khung | Vòng sửa | Kết quả |
|---|---|---|---|---|---|---|---|
| bắc (n) | 0,9586 | 0,9452 | x2–218 y3–559 (x3–216) | 12 / 12 | 557–559 | 0 | **PASS** |
| đông-bắc (ne) | 0,9639 | 0,9530 | x6–214 y2–559 (x7–212) | 10 / 11 | 557–559 | 0 | **PASS** |
| đông (e) | 0,9556 | 0,9474 | x14–208 y2–559 (x15–206) | 10 / 10 | 557–559 | 1 | **PASS** |
| đông-nam (se) | 0,9642 | 0,9536 | x9–212 y3–559 (x11–210) | 10 / 9 | 557–559 | 1 | **PASS** |
| tây-nam (sw) | 0,9630 | 0,9535 | x6–213 y2–559 (x7–212) | 10 / 10 | 557–559 | 1 | **PASS** |
| tây (w) | 0,9571 | 0,9494 | x6–213 y2–559 (x8–212) | 10 / 10 | 557–559 | 1 | **PASS** |
| tây-bắc (nw) | 0,9640 | 0,9558 | x3–216 y3–559 (x5–215) | 10 / 9 | 557–559 | 1 | **PASS** |

- Rest bbox lệch ±2px so với nguồn (viền solidify 1px + mảnh giỏ/tay), trong cổng ±2px.
- Lift đo bằng đáy giày từng nửa khung (y≥500): chân nhấc 9–12px, chân đứng
  còn lại chỉ nhấc 1–2px (do hông nhấc). Số 12 ở bắc = +10 chân +2 hông ở
  t=0,2s — đúng vật lý animation, khớp bảng hướng nam (giày 548 so với 559).
- Bbox x toàn bộ 84 khung nằm trong 0–220: không pixel nào bị cắt khỏi khung.

## Phương pháp (khác hướng nam ở đâu, và vì sao)

1. **Cắt mảnh** (`work/cut_7dirs.py`, theo từng hướng): full-frame 221×560,
   solidify 1px, lấp lỗ torso bằng màu áo kem, mảnh chân nối dài giấu dưới
   váy — đúng phương pháp hướng nam. Khác biệt theo hướng:
   - **Tay cầm giỏ đổi tay theo hướng** (giỏ luôn ở tay phải của Linh Nhi):
     giỏ là con của armL (tay trái ảnh) ở n/se/e, con của armR (tay phải ảnh)
     ở ne/sw/w/nw. Ở sw/w/nw tay cầm là tay xa, khuất sau thân — mảnh armR
     để TRỐNG (0 px, không bịa phần khuất) nhưng bone vẫn tồn tại để giỏ đung
     đưa được.
   - **Giỏ ở sw/w/nw chỉ lấy phần thấy được** (mảnh nhỏ: sw 1.653 px,
     w 1.415 px, nw 2.219 px — so với e 4.015 px). Mask giỏ = thành phần liên
     thông lớn nhất trong hộp tìm kiếm hẹp (tránh lẫn mảng vá áo màu tre).
   - **Profile đông/tây chỉ có một tay thấy được**: tay còn lại mảnh trống,
     không bịa. Hai chân cắt theo đúng hình thấy được (chia đôi theo x giữa
     khoảng giày), không bịa phần khuất.
   - Đầu đông-bắc 181px (−7% so với nam): cắt theo cùng luật đầu hướng nam,
     rest IoU 0,9530 — không cần sinh lại.
2. **Rig** (`scripts/rig_data.gd`: thêm `_dir()` chung; `build_rig.gd` đã
   nhận tham số hướng từ trước): Skeleton2D, bone hips → torso →
   head/armL/armR/basket; hips → legL/legR. Pivot xương theo đúng tỉ lệ
   khung nguồn, ground pivot (110,558). Pivot chân = trọng tâm giày đo từ
   mảnh cắt (n 89/133, ne 90/130, e 102/135, se 96/135, sw 74/116,
   w 76/110, nw 80/124; y=505). 3 bài học rig giữ nguyên: z_index dương +
   z_as_relative=false, Bone2D rest đặt ngay khi dựng, AnimationLibrary
   tên rỗng.
3. **Animation — dùng lại định nghĩa hướng nam**, chỉ chỉnh 2 tham số theo
   hướng (ghi rõ trong `rig_data.gd`):
   - Pha tay gắn với CHÂN (chân trái nhấc ở t=0,2s) nên giữ nguyên mọi
     hướng, không lật theo tay cầm giỏ. Chỉ giỏ đổi dấu đung ngược pha
     theo tay cầm của nó.
   - **Giỏ ở ne/sw/w/nw chỉ đung ±6° + bù ±2px** (thay vì ±10°/±3px): giỏ
     nằm sát mép phải khung (ne x_max 211, nw 213) — đung đủ biên độ hướng
     nam sẽ đẩy giỏ ra khỏi khung 221px. Tay cầm xoay đã đưa điểm nắm đi
     ~9px nên giỏ vẫn lắc đọc được.
   - **Hông walk nhấc −1px (thay vì −2px) ở e/se/sw/w/nw**: ở mỗi hướng này
     một giày cao hơn giày kia đúng 1px trong art gốc; ở khung mà giày cao
     đứng một mình, hông −2px đẩy đáy khung xuống 556 (rớt cổng 1px). Xem
     vòng sửa § "Vòng sửa" — n/ne giày đối xứng nên giữ −2px.
   - IDLE giữ nguyên (thở −1px, đầu gật ±1px, giỏ ±2°, track rest đủ cho
     chân/tay — bẫy vòng sửa 3 của hướng nam).
4. **Render 2x + Lanczos** (`scripts/render2x.gd` tổng quát hoá theo tham số
   hướng; `scripts/pack_7dirs.py`): SubViewport 520×1140 có biên, rig tại
   (260,1128), scale 2, Linear filter; Lanczos → 260×570, crop
   (20,6)–(241,566) → 221×560, pivot (110,558) mọi khung.

## Vòng sửa

1. **Render trống (lỗi setup của tôi, chưa tính vòng sửa art):** lần render
   bắc đầu tiên tôi thêm `--headless` — Godot dùng renderer dummy, texture
   SubViewport null, 12 khung toàn trống + treo tới timeout 300s. Sửa: chạy
   đúng như hướng nam (`xvfb-run` + `--rendering-driver opengl3`, KHÔNG
   `--headless`) — render xong trong 7 giây. Bài học: `--headless` cấm dùng
   cho render (build rig thì được).
2. **Bug pack manifest (lỗi script của tôi, đã khôi phục đủ):**
   `pack_7dirs.py` bản đầu có dòng lọc với biểu thức điều kiện sai khiến mỗi
   lần pack xoá toàn bộ frame cũ khỏi manifest (sau pack bắc chỉ còn 12
   frame thay vì 24). File PNG trên đĩa không hề bị đụng. Sửa script (bỏ
   dòng lọc sai) + dựng lại manifest từ PNG trên đĩa
   (`/tmp/rebuild_manifest.py`): 96 frame, bbox nam khớp đúng báo cáo gốc
   (walk-s-0 x3–217 y3–559). Kiểm chứng lại sau mỗi lần pack từ đó.
3. **Vòng sửa 1 (chung cho e/se/sw/w/nw, mỗi hướng 1 vòng):** đáy khung
   556 ở khung chân cao đứng một mình (e walk-6, se walk-2, sw walk-6,
   w walk-2, nw walk-2) — nguyên nhân 1px lệch giày trong art gốc (xem
   §3). Sửa: hông walk −1px ở 5 hướng này. Sau sửa: đáy 557–559 mọi khung,
   lift vẫn 9–10px trong cổng. n/ne không cần sửa.

## Soi mắt

- Contact sheet 118px cả 7 hướng (`work/contact_{d}_118px.png`): dáng đi
  đọc được, giỏ lắc theo nhịp, 8 hướng phân biệt rõ.
- Zoom chân 3x (`work/feet_{d}_zoom3x.png`): gót bám đất, không rách ở
  viền váy/giày, không vỡ viền.
- GIF đối chiếu trên nền Miếu Hoang thật (crop (380,200)–(1020,560), nhân
  vật cao 200px, bóng tiếp xúc mờ): `work/linhnhi-walk-e.gif` +
  `work/linhnhi-walk-n.gif` (16 khung đi ngang), `work/linhnhi-idle-e.gif`
  + `work/linhnhi-idle-n.gif` (đứng thở tại chỗ). Ở cỡ game không thấy
  rách/méo — xem ảnh trích 4 khung `work/walk_e_bg_frames.png`,
  `work/walk_n_bg_frames.png`.

## Tệp giao

- Khung export (84 khung mới 221×560 + manifest 96 frame, CHƯA NGHIỆM THU):
  `rig/export/linhnhi-walk-{n,ne,e,se,sw,w,nw}-0..7.png` (56),
  `rig/export/linhnhi-idle-{n,ne,e,se,sw,w,nw}-0..3.png` (28),
  `rig/export/manifest.json` (pivot (110,558) mọi khung, bbox từng khung,
  trường `direction` từng frame; 12 khung nam giữ nguyên — md5 export nam
  khớp bản copy trong assets).
- Bản game: `assets/art/linhnhi/` — đủ 96 file (12 nam cũ + 84 mới).
- Rig Godot: `rig/rig_{n,ne,e,se,sw,w,nw}.tscn`, `rig/pieces/{n,ne,e,se,sw,w,nw}/*.png`,
  `rig/out_2x/{n,ne,e,se,sw,w,nw}/` (render 2x gốc),
  `rig/scripts/{rig_data.gd (mở rộng 7 hướng), build_rig.gd, render2x.gd
  (tham số hoá), pack_7dirs.py}`, `rig/work/cut_7dirs.py`,
  `rig/work/gate_7dirs.py`, `rig/work/make_gifs_7dirs.py`.

## Hạn chế còn lại (khai thật)

1. **Chớp mắt KHÔNG làm được** (kế thừa hướng nam): mắt vẽ liền trên mảnh mặt.
2. **Profile đông/tây — nếp dọc ở giày khi nhấc chân:** hai giày chồng nhau
   gần như hoàn toàn trong hình chiếu profile, đường chia mảnh (x=120 đông,
   x=93 tây) cắt ngang vùng giày chồng — khung chân nhấc thấy một nếp dọc
   ở giày, rõ ở zoom chân 3x, KHÔNG thấy ở cỡ game 118px / trên nền Miếu
   Hoang thật (đã đối chiếu GIF đông). Vẽ thêm phần giày khuất sẽ là bịa
   nên không làm; đây là giới hạn của rig cắt mảnh, cùng họ với "giày xoay
   cứng" của hướng nam.
3. **Bắc walk-6 giỏ chạm mép trái khung (x=0) đúng 1 khung** — giống hệt
   hướng nam (walk-s-6): viền giỏ chạm mép, không pixel nào bị cắt
   (bbox x_max 220, trong khung). Tây-bắc walk-6 giỏ tới x=219, còn 1px biên.
4. **Váy tĩnh** trong khi chân đung đưa; tay cầm giỏ trượt ~3px ở cực đung
   (kế thừa hướng nam, dưới 1px ở cỡ hiển thị thật).
5. **Giỏ ở sw/w/nw chỉ là mảnh ló sau thân** (đúng giải phẫu, nhưng khi
   chơi sẽ thấy giỏ khuất phần lớn ở 3 hướng này) và đung chỉ ±6° (xem §3).
6. **Tàn dư trắng <250px giữa sợi tóc** (kế thừa từ khung nguồn 7 hướng):
   giữ nguyên, ở cỡ thật đọc như sợi tóc sáng.
7. Không có điểm nắm vũ khí (Linh Nhi không mang vũ khí) — manifest không
   ghi grip.
