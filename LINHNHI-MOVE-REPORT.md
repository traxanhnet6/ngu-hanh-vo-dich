# LINHNHI-MOVE — Chuyển động NPC Linh Nhi bằng rig xương Godot

- **Lệnh:** Bui 05:32 ngày 2026-11-20 "Làm chuyển động cho npc linh nhi"; Bui 05:34 "Dùng Godot làm" — làm bằng **đường rig xương Godot**, không sinh khung hình trực tiếp.
- **Cây đợt:** `~/workspace/game-ngu-hanh-linhnhi-move/` (nhân bản `cp -a` từ cây deploy HEAD `7ad01cf`; không hardlink; không đụng cây bánh bao song song).
- **Trạng thái:** XONG mã + khung, **CHƯA NGHIỆM THU — chưa gộp live**, chờ Bui phán bằng mắt trên điện thoại thật.
- **Kiểm trình duyệt thật trên cây đợt:** CHƯA LÀM ĐƯỢC ở đợt này (subagent không có live browser) — parent kiểm trước khi trình Bui: Linh Nhi tuần tra đủ 1 vòng, idle thở khi đứng, chạm mở thoại, chuỗi bánh bao vẫn chạy, 0 page error mới.

## 1. Đã làm gì

### Rig xương Godot — hướng nam (rig/)
Dựng rig riêng cho Linh Nhi trong project Godot riêng tại `rig/` (copy project + script từ cây godotrig; **cây godotrig của Hà Nhân không bị đụng** — đã kiểm mtime).
- Cắt sprite gốc `assets/art/npc-linhnhi.png` (221×560, chibi màu nước: hai búi, áo vá, giỏ tre) thành 7 mảnh full-frame: head / torso / armL / armR / basket / legL / legR (`rig/pieces/south/`), lấp lỗ torso, solidify viền.
- Bone: hips → torso → head / armL / armR / basket; hips → legL / legR. Render 2x chống vỡ + downsample Lanczos, Linear (đúng chuẩn RIGWALK).
- Walk 0,8s loop, 8 khung @10fps: chân nhấc xen kẽ ~10px, lắc hông ±2px, tay ±3°, giỏ đung ngược pha ±10°. Idle 2,4s loop, 4 khung: thở hips −1px, đầu gật ±1px, giỏ ±2°.
- 3 vòng sửa nội bộ: (1) render trống do project mới chưa `--import` → import rồi build lại; (2) giỏ văng khỏi khung do tay ±6° quăng giỏ lệch ~21px → viewport có biên 520×1140, tay giảm ±3°, giỏ ±8°→±10° có bù vị trí; (3) chân lún + idle kế thừa tư thế walk do AnimationPlayer giữ property cũ → hips chỉ nhấc lên, thêm track rest cho chân/tay vào idle.
- Báo cáo rig chi tiết: `rig/RIG-LINHNHI-REPORT.md`.

### Khung xuất — assets/art/linhnhi/ (12 PNG, 221×560, 2,5 MB)
- `linhnhi-walk-s-0..7.png` (walk hướng nam), `linhnhi-idle-0..3.png` (idle), pivot điểm đất (110, 558) mọi khung — `rig/export/manifest.json` (nhãn `CHUA NGHIEM THU`).
- Bản gốc trong `rig/export/` giữ nguyên làm nguồn; bản trong `assets/art/linhnhi/` là bản game nạp.

### Nối vào game — js/engine.js (+115/−2, chỉ sửa file này)
- **Preload:** 12 URL vào mảng urls tĩnh + 12 bí danh `linhnhi_walk_s_0..7`, `linhnhi_idle_0..3`; khung nào nạp lỗi thì chỗ vẽ lùi về sprite tĩnh gốc.
- **Chọn khung — `getLinhNhiFrame(moving)`:** đang đi → walk, frame = floor(t×10)%8; đứng yên → idle, frame = floor(t/0,6)%4. Trạng thái đi/đứng theo `linhnhiAnim.lastMoveT` (mốc giây lần cuối dịch vị trí; đứng yên > 0,25s thì idle).
- **Vẽ NPC (khối NPC draw):** khi `npc.asset === 'assets/art/npc-linhnhi.png'` thì dùng khung rig thay sprite tĩnh — áp cho cả LINH_NHI ở miếu lẫn `npc_linhnhi_sect` ở tông môn (bản tông môn chỉ idle). Giữ nguyên công thức vẽ theo tỉ lệ bitmap đã nạp (khung 221×560 cho drawW ≈ 46,6px, khớp w=47 cũ), neo đáy feetY.
- **Vẽ follower (`drawLinhNhiFollower`):** cùng chọn khung theo follower có đang di chuyển không.
- **Tuần tra — `updateLinhNhiPatrol(dt)`**, gọi sau `updateLinhNhiFollower(dt)` trong vòng update: chỉ chạy khi `currentMapId === 'mieu_hoang' && !modauFollower.init && isNpcActive(LINH_NHI) && !modauIsDialogueOpen()`. Waypoint: (620,600) → (780,600) → (780,540) → (620,540) → lặp; tốc độ 55 px/s; tới waypoint đứng idle 2,5–4s ngẫu nhiên rồi đi tiếp. Cập nhật feetX/feetY (+ x/y/baseY/standTile) của LINH_NHI — `npcs[0]` và `mapData.linhnhi` là CÙNG object nên neo tương tác, dấu "!", điểm cho ăn bánh bao (`getLinhNhiPosition`) tự bám theo vị trí thật. Khi follower bật thì patrol dừng; khi tắt thì tiếp tục từ vị trí hiện tại, không nhảy về nhà.
- **Không đụng:** `triggerDialogue` / `handleWorldClick` / `isPlayerInNpcRange`, chuỗi bánh bao M2 (`js/mo-dau.js` không sửa), `questGate before_departure`, 6 định danh cấm P2, server/online.

## 2. Bằng chứng

### GIF đối chiếu trên nền Miếu Hoang thật (dựng từ đúng tệp sẽ ghép)
- `rig/work/linhnhi-walk-south.gif` — 16 khung, Linh Nhi đi ngang qua nền miếu thật, cao 200px, có bóng tiếp xúc.
- `rig/work/linhnhi-idle.gif` — 4 khung, đứng thở tại chỗ trên nền miếu thật.

### Cổng đo — kiểm độc lập lại bằng PIL (không tin báo cáo rig một chiều)
| Chỉ số | Kết quả |
|---|---|
| Rest-pose idle-0 so với sprite gốc | IoU **0,9441**; bbox ±1px (x 3–217 so với gốc 4–216) |
| Đáy bbox alpha 12 khung | 557–559, tức **±1px** quanh điểm đất 558 (cổng ±2px) |
| Nhấc chân luân phiên | f2 giày trái đáy 548, f6 giày phải đáy 548 — nhấc ~11px xen kẽ, chân còn lại bám đất |
| Soi mắt | Contact sheet 118px (`rig/work/contact_118px.png`) + zoom chân 3x (`rig/work/feet_zoom3x.png`): không rách khớp, không méo, không vỡ viền; idle-0 giống hệt gốc bằng mắt |

### Kiểm logic bằng Node (trích đúng đoạn mã trong engine.js, chạy với stub)
- `node --check js/engine.js` — SYNTAX OK.
- Chọn khung: t=0 walk→s_0, t=0,35 walk→s_3, t=0 idle→idle_0, t=0,65 idle→idle_1; khung thiếu → null (lùi về sprite tĩnh).
- Tuần tra mô phỏng 60s (dt=1/60): đi đủ vòng waypoint (699,560 → 624,599 → 776,600 → 736,542 → 624,540 → …), x/y/baseY/standTile bám theo feet.
- Đóng băng đúng: follower bật / sang map khác / thoại mở → vị trí không đổi.
- Waypoint kiểm bằng `mapdata.isWalkable` thật: 4 điểm + 4 chặng đều thông; điểm đứng gốc (700,560) không walkable là do chính vòng va chạm NPC (bán kính 14) — không nằm trên đường tuần tra.

## 3. Hạn chế — khai thẳng, chưa sửa được trong đợt này
- **Chỉ hướng nam.** 7 hướng còn lại thiếu art gốc nên rig không sinh được (không lật gương, không bịa). Khi tuần tra đi ngang sân miếu cô vẫn dùng dải nam. Muốn đủ 8 hướng cần Bui quyết: (a) chấp nhận chỉ hướng nam trước; hoặc (b) cho sinh 7 khung idle hướng làm nguồn cho rig — vẫn là chuyển động bằng rig, nhưng cần duyệt vì Bui đã cấm sinh khung trực tiếp.
- **Chớp mắt không làm được** — mắt vẽ liền trên mảnh mặt, không bịa được.
- Chân là mảnh cứng (giày xoay cứng, không gập cổ chân); váy tĩnh khi chân đung đưa.
- Tay cầm giỏ trượt ~3px trong tay ở cực đung (dưới 1px ở cỡ hiển thị 118px).
- Giỏ chạm đúng mép trái khung (x=0) ở 1 khung walk-s-6, không bị cắt pixel nào.
- Không có grip vũ khí (Linh Nhi không mang vũ khí).

## 4. Còn nợ — parent / Bui
- Kiểm trình duyệt thật trên cây đợt (parent làm): tuần tra 1 vòng, idle thở, chạm mở thoại, chuỗi bánh bao M2 vẫn chạy (phối hợp đợt bánh bao), 0 page error mới.
- Bui phán bằng mắt trên điện thoại thật rồi mới gộp live.
- Quyết 7 hướng còn lại (xem mục 3).
