# LINHNHI-MOVE — KIỂM CHỨNG BẰNG TRÌNH DUYỆT THẬT (cây đợt)

Ngày: 2026-11-20. Cây đợt: `~/workspace/game-ngu-hanh-linhnhi-move/` (nhân bản từ deploy HEAD `7ad01cf`).
Phương pháp: Chrome 156 thật (puppeteer-core), viewport 390×844 điện thoại, phục vụ cây đợt bằng HTTP local
(`http://127.0.0.1:8931/`, không qua relay). 4 lượt chạy: drive1 (tuần tra 80s), drive2 (chạm + cho ăn),
drive3 (chạm xa có đo đạc + dấu "!" ở bước cho ăn), drive4 (clip 40 khung liên tiếp). Bằng chứng trong `qa-live/`
(GIF + 7 ảnh + 4 JSON trace: `samples.json`, `result.json`, `result2.json`, `result3.json`).

## Kết quả tổng: 7/7 mục PASS (có lưu ý ở mục 3, 4, 5 — xem dưới)

| # | Mục kiểm | Kết quả |
|---|---|---|
| 1 | Tuần tra đủ 1 vòng quanh sân miếu | **PASS** |
| 2 | Khung walk chạy khi đi, idle thở khi đứng; clip trên nền game thật | **PASS** |
| 3 | Chạm Linh Nhi mở thoại (neo theo chân thật) | **PASS** (xem lưu ý HUD) |
| 4 | Dấu "!" hiện đúng vị trí trên đầu cô khi cô di chuyển | **PASS** (chỉ kiểm hiển thị) |
| 5 | Chuỗi bánh bao M2 tới bước cho ăn | **PASS** |
| 6 | 0 page error mới, 0 lỗi 404 mới | **PASS** |
| 7 | Soi cỡ thật: chân bám đất, không méo, không vỡ viền, không rách khớp | **PASS** |

## 1. Tuần tra — PASS

- Drive1: 121 mẫu vị trí trong 80s. Cả 4 waypoint đều chạm (số mẫu trong ≤15px: (620,600)=20,
  (780,600)=23, (780,540)=23, (620,540)=21). X 620–780, Y 540–600 — đúng hình chữ nhật tuần tra.
  61 mẫu đang di chuyển / 59 mẫu đứng yên — xen kẽ đi/idle, khoảng 3 vòng trong 80s.
- Drive3: 30s nữa, hits [3,7,7,4], cùng khoảng X/Y.
- Tốc độ đúng 55 px/s (chặng đông 160px đi ~2,9s; đứng idle 2,5–4s mỗi waypoint).
- Người chơi đứng yên (700,730) suốt lúc quan sát; follower không bật; thoại không mở — đúng điều kiện patrol.

## 2. Walk / idle + clip — PASS

- Clip `qa-live/linhnhi-walk-live.gif`: 40 khung liên tiếp, mỗi khung 150ms (6s), cắt 220×280 quanh Linh Nhi
  lúc cô đang đi chặng đông (X 622→780). Khung walk đổi theo nhịp bước; lúc tới waypoint cô đứng idle thở.
- Ảnh `walk-10.png`, `walk-25.png`: giữa bước đi, giỏ đung đưa khác nhau giữa 2 khung, chân không lún.
- Chỉ hướng nam nên lúc đi ngang sân cô vẫn quay mặt nam — hạn chế đã khai trong báo cáo đợt.

## 3. Chạm mở thoại — PASS (có lưu ý HUD)

- Chạm gần: mở ngay sau 0,5s (drive2 tap2). Thoại đúng: "Ca ca... ca ca thực sự muốn bái nhập
  Thanh Vân Tông sao?" + chân dung Linh Nhi trong hộp thoại (`d3-fartap-dialogue.png`).
- Chạm xa: drive3 — chạm lúc cô ở (620,589), điểm chạm rơi trên canvas (`CANVAS#game-canvas`,
  trong hộp biên NPC, world (620,538)); người chơi đi (700,730)→(596,597), thoại mở sau 2s,
  đúng hành vi "chạm xa thì đi tới cạnh rồi mở thoại đúng một lần".
- Hai lần chạm xa thất bại trước đó (drive2 tap1 + drive3 lượt 0–2) đều có nguyên nhân đo được:
  điểm chạm rơi dưới `DIV#quest-panel-header` (tiêu đề bảng Nhiệm Vụ, `pointer-events: auto`),
  tức HUD chặn cú chạm chứ không phải logic game. Khi chờ tới lúc điểm chạm rơi trên canvas thì mở thoại đúng.
  Đây là hành vi chung của HUD (mọi NPC đi qua góc trái-trên đều bị vậy), không riêng Linh Nhi — ghi làm
  quan sát thêm, không tính lỗi đợt này.

## 4. Dấu "!" — PASS (chỉ kiểm hiển thị, chưa kiểm điểm chạm "!" trên cây này)

- Ở bước cho ăn (step ép thành `'feed'` để kiểm), "!" đỏ hiện trên đầu cô (`d3-excl-zoom.png` — zoom 3x
  thấy rõ vòng đỏ + dấu "!" trắng trên chip "Nói chuyện"), tại vị trí cô vừa tuần tra tới (620,597),
  không phải điểm đứng gốc. Mã vẽ "!" theo `feetX` live mỗi khung nên bám theo vị trí thật.
- **Chưa kiểm trên cây này:** chạm ĐÚNG vào dấu "!" (xem mục "Cây đợt thiếu 8a47c0f" — hộp bấm "!"
  trên cây này còn trượt 8px; live đã sửa).

## 5. Chuỗi bánh bao M2 — PASS

- Mua bằng API `GameMoDau.buyItem`: ok, 2 đồng, trong túi có 1 bánh. Bước lúc đó là `'chop'`
  nên không tự chuyển bước (đúng mã: chỉ chuyển khi đang ở bước `'buy'`).
- Mở modal Hộ Muội, bấm nút "Chọn" ở hàng "Cho Bánh Bao (+25 Ăn No) (có 1)": Ăn No **60→85 (+25)**,
  bánh **1→0**, bước `'feed'`→`'matam1'`, toast "Đã cho Linh Nhi Bánh Bao. Nhiệm vụ mới: Ép Giá Ở Chợ."
  (`d2-after-feed.png` hiện 85/100).
- Lưu ý: trên cây này chip Hộ Muội trong bảng Nhiệm Vụ vẫn `pointer-events: none` (thiếu 8a47c0f),
  nên đường mở modal bằng chip HUD chưa kiểm chứng được trên cây này; lần kiểm này mở modal
  (không phân biệt được chip hay fallback API trong log đã lưu). Live đã sửa chip ở 8a47c0f.

## 6. Lỗi console / 404 — PASS

- **0 page error** cả 4 lượt chạy. 0 lỗi `linhnhi-*` nào.
- 404 duy nhất: `assets/art/map-dan-phong-bg.png` (tiền tồn, đúng baseline live) + `favicon.ico`
  (tiền tồn, trình duyệt tự hỏi). Không có 404 mới so với live.

## 7. Soi cỡ thật — PASS

- `d4-feet-zoom.png` (zoom 2x quanh chân lúc đang đi): 2 giày vải chạm đất, bóng tiếp xúc nằm đúng
  dưới chân, không lơ lửng, không rách ở mép váy/giày.
- `walk-10.png` / `walk-25.png` / `d3-clean-hud.png`: không méo, không vỡ viền, khớp tay-giỏ liền mạch.
- Váy dài che hết chân nên bước đi đọc qua giày nhấc + lắc hông (giới hạn rig đã khai).

## ⚠️ CÂY ĐỢT THIẾU COMMIT 8a47c0f — BẮT BUỘC REBASE TRƯỚC KHI GỘP

Live đã gộp 8a47c0f lúc 06:04 ngày 2026-11-20 (đợt sửa bánh bao). Cây đợt này nhân bản trước đó nên
**chưa có hai sửa đó** — đã xác minh trên đĩa: `git log` của cây dừng ở `7ad01cf`, không có object
`8a47c0f`; `css/style.css` còn `#quest-panel { pointer-events: none }` mà chip Hộ Muội không nằm trong
danh sách `pointer-events: auto`; hộp bấm NPC chưa mở lên y-36, chưa có hit-test follower.

Hệ quả với kiểm chứng này:
- (a) Chạm đúng vào dấu "!" trên cây này còn trượt 8px (lỗi 8a47c0f đã sửa trên live) — đợt kiểm này
  chỉ kiểm "!" hiển thị đúng vị trí, KHÔNG kiểm điểm chạm "!".
- (b) Chạm vào Linh Nhi dạng follower chưa có vùng bấm trên cây này.
- (c) Chip Hộ Muội trên cây này không bấm được (xem mục 5).

**Lúc gộp: PHẢI rebase cây chuyển động lên 8a47c0f trước (cả hai đợt đều sửa `js/engine.js` —
cần giải xung đột thủ công ở vùng vẽ/hit-test NPC), rồi kiểm lại 4 điểm chạm (chân NPC, chân follower,
"!" tĩnh, "!" follower) + chip Hộ Muội trên cây đã rebase. Không gộp thẳng cây này lên live.**

## Quan sát thêm (không phải lỗi đợt này)

- Bảng theo dõi nhiệm vụ hiện "Khoảng cách: -13 bước" (số âm) khi đứng gần mục tiêu — công thức
  khoảng cách trừ tầm, tiền tồn.
- Sau đoạn thoại chia tay ("Ca ca thực sự muốn bái nhập Thanh Vân Tông sao?"), Linh Nhi chuyển sang
  đi theo người chơi (follower) và rời khỏi vòng tuần tra — đúng luồng M2 (thoại xong cô đi theo),
  không phải lỗi tuần tra. Lúc đó cô vẫn vẽ bằng khung rig (follower dùng chung `getLinhNhiFrame`).

## Tệp bằng chứng (qa-live/)

- `linhnhi-walk-live.gif` — clip 40 khung, 6s, cô đi chặng đông trên nền Miếu Hoang thật.
- `d3-fartap-dialogue.png` — thoại mở, chân dung Linh Nhi, chip "Nói chuyện".
- `d3-excl-zoom.png` — zoom 3x dấu "!" đỏ trên đầu cô ở bước cho ăn.
- `walk-10.png`, `walk-25.png` — giữa bước đi, 2 tư thế khác nhau.
- `d4-feet-zoom.png` — zoom 2x chân chạm đất + bóng tiếp xúc.
- `d3-clean-hud.png` — cô đứng trong sân miếu, bảng nhiệm vụ đã thu gọn.
- `d2-after-feed.png` — sau khi cho ăn: Ăn No 85/100.
- `samples.json`, `result.json`, `result2.json`, `result3.json` — trace vị trí + kết quả từng lượt.
