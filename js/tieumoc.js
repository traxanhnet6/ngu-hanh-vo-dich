/**
 * tieumoc.js — ĐỘT PHÁ TIỂU MỐC + TRẦN TU VI THEO MỐC (Đợt T1, 2026-11-10,
 * lệnh Bui 06:27 "Bản ngũ hành làm tiếp" — chương trình hồ sơ sau K2 theo
 * sổ rà soát gap-report mục C.3).
 *
 * Căn cứ hồ sơ:
 * - Hồ sơ 02 §1: trần tu vi MỖI ĐƯỜNG theo mốc — Luyện Khí 100/tầng, Trúc Cơ
 *   400/giai đoạn (tích lũy: mốc m trần m*100; Trúc Cơ trần 1300/1700/2100/
 *   2500). Trần nằm trong state.js (getMocCap/addTuViCapped) và được engine
 *   áp tại cả hai điểm cộng tu vi (hạ quái, dùng Tu Luyện Đan).
 * - Hồ sơ 02 §2 + §3.3: đột phá (gồm tiểu mốc) cần 5 đường ĐẦY TRẦN của mốc;
 *   giao diện phải liệt kê đủ/thiếu từng đường và dẫn tới nguồn còn thiếu.
 * - Hồ sơ 02 §3.3: tiểu đột phá tốn thêm Linh Thạch (tăng theo mốc — hồ sơ
 *   ghi ĐỀ XUẤT, không chốt số) + 1–2 nguyên liệu vùng của mốc; KHÔNG cần
 *   đan đột phá riêng.
 * - Hồ sơ 06 (Bui duyệt 2026-11-08 15:00), bảng tầng Luyện Khí, cột "Điều
 *   kiện phụ đột phá lên tầng sau": lên tầng 4 cần NGỘ ĐẠO 1 lần tại điểm
 *   linh mạch (tiểu bình cảnh); lên tầng 5 cần TỤ KHÍ TÁN x2; lên tầng 7 cần
 *   ĐÁNH BẠI 1 TINH ANH (tiểu bình cảnh); lên tầng 8 cần NGƯNG KHÍ ĐAN x1.
 *   (Đọc đúng ngữ nghĩa cột: điều kiện ghi ở hàng tầng N là để đột phá TỪ
 *   tầng N lên tầng N+1 — Tụ Khí Tán tiêu hao ở mốc 4->5, Ngưng Khí Đan ở
 *   mốc 7->8.)
 * - Hồ sơ 09: dẫn đường = mũi tên + dấu tại mục tiêu THẬT, đúng bản đồ đúng
 *   cổng — bảng này có nút "Chỉ đường" cho từng điều kiện còn thiếu, đi qua
 *   móc getQuestTargetInfo của engine (cùng khuôn móc DANPHONG).
 * - Hồ sơ 50 §7 (đợt này áp ở state.js): trần Linh Thạch farm/ngày theo đại
 *   cảnh giới 300/1.200/4.000/12.000/30.000.
 *
 * SỐ ĐỘI SOẠN đợt T1 (hồ sơ không chốt — khai đầy đủ trong báo cáo đợt):
 * - Linh Thạch từng mốc: Luyện Khí 30/50/80/120/170/230/300/400 (tăng dần,
 *   mốc cuối ≈ 1,3 ngày farm ở trần 300/ngày); Trúc Cơ 600/900/1.300 (dưới
 *   trần ngày Trúc Cơ 1.200 cho hai mốc đầu).
 * - Nguyên liệu từng mốc: chọn nguyên liệu của vùng ĐÃ MỞ tại mốc đó, số
 *   lượng nhỏ (1–4) vì đây là cổng tiến độ chứ không phải cổng cày.
 * - Công thức luyện hai đan phụ trợ tại Đan Phòng (xem danphong.js).
 * - Tiểu bình cảnh "đánh bại 1 tinh anh" chỉ tính lượt hạ tinh anh TRONG
 *   KHI đang ở tầng 6 (đúng nghĩa bình cảnh của mốc — hạ trước không tính).
 *
 * KHÔNG đụng (mâu thuẫn hồ sơ mục D chưa có phán của Bui): công thức và tỉ
 * lệ của đột phá ĐẠI cảnh giới Trúc Cơ (engine.tryBreakthrough giữ nguyên
 * 100% — module này chỉ ghi mốc 10 sau khi nó thành công qua state), bể tu
 * vi ngày 65 (giữ nguyên — trần mốc là cơ chế cộng tác thêm ở state).
 *
 * Trạng thái lưu trong player.tieuMoc (state.js ensureTieuMoc khởi tạo lười
 * + suy mốc cho save cũ, KHÔNG cắt tu vi đã có). Node-loadable & trình duyệt
 * (khuôn mẫu danphong.js).
 */

(function (exports) {
  'use strict';

  var ELEM_NAMES = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  var ELEM_KEYS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
  var TC_SUFFIX = ['Sơ Kỳ', 'Trung Kỳ', 'Hậu Kỳ', 'Viên Mãn'];

  // ---------------------------------------------------------------------------
  // BẢNG ĐIỀU KIỆN ĐỘT PHÁ TIỂU MỐC (khóa theo mốc HIỆN TẠI)
  // lt: Linh Thạch (số đội soạn — hồ sơ 02 §3.3 chỉ chốt "tăng theo mốc").
  // materials: nguyên liệu vùng của mốc (hồ sơ 02 §3.3: 1–2 loại).
  // binhCanh: 'ngodao' (hồ sơ 06 — lên tầng 4) | 'elite' (hồ sơ 06 — lên tầng 7).
  // Mốc 9 không có tiểu đột phá: đó là đột phá ĐẠI cảnh giới qua Trúc Cơ Đan
  // (engine.tryBreakthrough, giữ nguyên). Mốc 13: Kim Đan thuộc đợt T3.
  // ---------------------------------------------------------------------------
  var BREAKS = {
    1: { lt: 30, materials: [{ itemId: 'la-thanh-tuy', count: 4 }], binhCanh: null },
    2: { lt: 50, materials: [{ itemId: 'linh-chi-rung', count: 2 }], binhCanh: null },
    3: { lt: 80, materials: [{ itemId: 'to-nhen-xanh', count: 3 }], binhCanh: 'ngodao' },
    4: { lt: 120, materials: [{ itemId: 'tu-khi-tan', count: 2 }], binhCanh: null },
    5: { lt: 170, materials: [{ itemId: 'bang-tinh', count: 4 }], binhCanh: null },
    6: { lt: 230, materials: [{ itemId: 'ngoc-bang-tam', count: 1 }], binhCanh: 'elite' },
    7: { lt: 300, materials: [{ itemId: 'ngung-khi-dan', count: 1 }], binhCanh: null },
    8: { lt: 400, materials: [{ itemId: 'da-nung', count: 4 }], binhCanh: null },
    10: { lt: 600, materials: [{ itemId: 'cat-tinh', count: 4 }], binhCanh: null },
    11: { lt: 900, materials: [{ itemId: 'ngoc-cat-tam', count: 1 }, { itemId: 'hon-kiem-nho', count: 2 }], binhCanh: null },
    12: { lt: 1300, materials: [{ itemId: 'manh-kiem-gay', count: 3 }, { itemId: 'ngoc-cat-tam', count: 1 }], binhCanh: null }
  };

  // Bãi săn theo đường tu (đích dẫn đường khi một đường chưa đầy trần).
  var ELEM_HUNT = {
    moc: { speciesId: 'thao_tinh', mapId: 'rung-doc', minRank: 0, zone: 'Rừng Độc Thanh Tụy', mon: 'Thảo Tinh' },
    thuy: { speciesId: 'bang_tinh', mapId: 'ho-bang', minRank: 4, zone: 'Hồ Băng Hàn Kính', mon: 'Băng Tinh Linh' },
    hoa: { speciesId: 'hoa_thu', mapId: 'mo-lua', minRank: 7, zone: 'Mỏ Lửa Xích Diệm', mon: 'Hỏa Nham Thú' },
    tho: { speciesId: 'sa_trung', mapId: 'hoang-mac', minRank: 10, zone: 'Hoang Mạc Hoàng Sa', mon: 'Hoàng Sa Trùng' },
    kim: { speciesId: 'kiem_linh', mapId: 'kiem-trung', minRank: 11, zone: 'Kiếm Trủng Huyền Thiết', mon: 'Tàn Kiếm Linh' }
  };

  // Nguồn THẬT của từng nguyên liệu đột phá (đích dẫn đường + kiểm tiền đề).
  var MAT_SOURCES = {
    'la-thanh-tuy': { kind: 'point', mapId: 'tong-mon', x: 560, y: 390, label: 'luống dược ở Tông Môn — hoặc săn Thảo Tinh ở Rừng Độc (rơi 70%)' },
    'linh-chi-rung': { kind: 'point', mapId: 'son-coc', x: 200, y: 600, label: 'điểm hái Linh Chi ở Sơn Cốc — hoặc hạ Cổ Thụ Yêu tinh anh ở Rừng Độc (rơi 50%)' },
    'to-nhen-xanh': { kind: 'monster', speciesId: 'nhen_xanh', mapId: 'rung-doc', label: 'Nhện Rừng Xanh ở Rừng Độc (rơi 60%)' },
    'tu-khi-tan': { kind: 'point', mapId: 'tong-mon', x: 850, y: 560, label: 'Lò Đan của Đan Phòng ở Tông Môn (luyện từ 2 Lá Thanh Tụy + 1 Băng Tinh)' },
    'ngung-khi-dan': { kind: 'point', mapId: 'tong-mon', x: 850, y: 560, label: 'Lò Đan của Đan Phòng ở Tông Môn (luyện từ 2 Hỏa Tinh Thổ + 1 Băng Tinh)' },
    'bang-tinh': { kind: 'monster', speciesId: 'bang_tinh', mapId: 'ho-bang', label: 'Băng Tinh Linh ở Hồ Băng (rơi 50%)' },
    'ngoc-bang-tam': { kind: 'monster', speciesId: 'han_xa', mapId: 'ho-bang', label: 'Hàn Kính Thủy Xà (tinh anh) ở Hồ Băng (rơi 100%)' },
    'da-nung': { kind: 'monster', speciesId: 'hoa_thu', mapId: 'mo-lua', label: 'Hỏa Nham Thú ở Mỏ Lửa (rơi 55%)' },
    'cat-tinh': { kind: 'monster', speciesId: 'sa_trung', mapId: 'hoang-mac', label: 'Hoàng Sa Trùng ở Hoang Mạc (rơi 60%)' },
    'ngoc-cat-tam': { kind: 'monster', speciesId: 'sa_tuong', mapId: 'hoang-mac', label: 'Sa Thạch Tượng (tinh anh) ở Hoang Mạc (rơi 100%)' },
    'hon-kiem-nho': { kind: 'monster', speciesId: 'kiem_linh', mapId: 'kiem-trung', label: 'Tàn Kiếm Linh ở Kiếm Trủng (rơi 55%)' },
    'manh-kiem-gay': { kind: 'monster', speciesId: 'kiem_linh', mapId: 'kiem-trung', label: 'Tàn Kiếm Linh ở Kiếm Trủng (rơi 30%)' }
  };

  var BINH_CANH = {
    ngodao: {
      name: 'Tiểu bình cảnh: Ngộ Đạo',
      desc: 'Tới điểm Đả Tọa bên Hồ Linh Tuyền ở Tông Môn và đả tọa ngộ đạo 1 lần (hồ sơ 06).',
      target: { kind: 'point', mapId: 'tong-mon', x: 1610, y: 525, label: 'điểm Đả Tọa bên Hồ Linh Tuyền, Tông Môn' }
    },
    elite: {
      name: 'Tiểu bình cảnh: Thắng Tinh Anh',
      desc: 'Đánh bại 1 quái TINH ANH trong khi đang ở tầng 6 (hồ sơ 06). Hàn Kính Thủy Xà ở Hồ Băng vừa là tinh anh vừa rơi Ngọc Băng Tâm.',
      target: { kind: 'monster', speciesId: 'han_xa', mapId: 'ho-bang', label: 'Hàn Kính Thủy Xà (tinh anh) ở Hồ Băng — mọi quái tinh anh đều được tính' }
    }
  };

  var livePlayer = null;

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }

  function getMonstersAPI() {
    if (typeof window !== 'undefined' && window.GameMonsters) return window.GameMonsters;
    if (typeof global !== 'undefined' && global.GameMonsters) return global.GameMonsters;
    try { return require('./monsters.js'); } catch (e) { return null; }
  }

  function getItemDef(itemId) {
    var m = getMonstersAPI();
    if (m && m.ITEM_DEFS && m.ITEM_DEFS[itemId]) return m.ITEM_DEFS[itemId];
    return { id: itemId, name: itemId, iconCol: 0, iconRow: 0 };
  }

  function itemName(itemId) {
    var d = getItemDef(itemId);
    return d && d.name ? d.name : itemId;
  }

  function showToast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast(msg);
    }
  }

  function playChime() {
    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) {
      window.GameAudio.playChime();
    }
  }

  function refreshHUD() {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) {
      window.GameUI.refreshHUD();
    }
  }

  function ensureState(player) {
    var st = getStateAPI();
    if (st && st.ensureTieuMoc) return st.ensureTieuMoc(player);
    if (!player.tieuMoc || typeof player.tieuMoc !== 'object') {
      player.tieuMoc = { moc: 1, ngoDao: false, thangTinhAnh: false, focus: null };
    }
    return player.tieuMoc;
  }

  function mocLabel(moc) {
    if (moc <= 9) return 'Luyện Khí tầng ' + moc;
    if (moc <= 13) return 'Trúc Cơ ' + TC_SUFFIX[moc - 10];
    if (moc <= 17) return 'Kim Đan ' + TC_SUFFIX[moc - 14];
    return 'Cảnh giới ' + moc;
  }

  function countOf(player, itemId) {
    var st = getStateAPI();
    if (!st || !player) return 0;
    return st.countItemInBag(player, itemId) || 0;
  }

  // ---------------------------------------------------------------------------
  // ĐIỀU KIỆN ĐỘT PHÁ CỦA MỐC HIỆN TẠI
  // ---------------------------------------------------------------------------

  /**
   * Trả cấu trúc điều kiện đầy đủ của mốc hiện tại:
   * { moc, cap, nextLabel, kind: 'minor'|'grand'|'future',
   *   paths: [{elem, have, need, ok}], lt: {have, need, ok},
   *   materials: [{itemId, name, have, need, ok}],
   *   binhCanh: {kind, name, desc, done, ok} | null, canBreak }
   * Đường có tu vi VƯỢT trần (save cũ) vẫn tính là đầy (ok) — không cắt.
   */
  function getConditions(player) {
    if (!player) return null;
    var st = getStateAPI();
    ensureState(player);
    var moc = st ? st.getMocIndex(player) : (player.tieuMoc.moc || 1);
    var cap = st ? st.getMocCap(player) : 100;

    var paths = [];
    var pathsOk = true;
    for (var i = 0; i < ELEM_KEYS.length; i++) {
      var k = ELEM_KEYS[i];
      var have = (player.paths && player.paths[k] && player.paths[k].tuVi) || 0;
      var ok = have >= cap;
      if (!ok) pathsOk = false;
      paths.push({ elem: k, have: have, need: cap, ok: ok });
    }

    if (moc === 9) {
      return {
        moc: moc, cap: cap, kind: 'grand', nextLabel: 'Trúc Cơ Sơ Kỳ',
        paths: paths, pathsOk: pathsOk,
        lt: null, materials: [], binhCanh: null, canBreak: false
      };
    }
    if (moc >= 13 || !BREAKS[moc]) {
      return {
        moc: moc, cap: cap, kind: 'future', nextLabel: mocLabel(moc + 1),
        paths: paths, pathsOk: pathsOk,
        lt: null, materials: [], binhCanh: null, canBreak: false
      };
    }

    var def = BREAKS[moc];
    var ltHave = player.linhThach || 0;
    var lt = { have: ltHave, need: def.lt, ok: ltHave >= def.lt };

    var materials = [];
    var matsOk = true;
    for (var j = 0; j < def.materials.length; j++) {
      var mat = def.materials[j];
      var mHave = countOf(player, mat.itemId);
      var mOk = mHave >= mat.count;
      if (!mOk) matsOk = false;
      materials.push({ itemId: mat.itemId, name: itemName(mat.itemId), have: mHave, need: mat.count, ok: mOk });
    }

    var binhCanh = null;
    var bcOk = true;
    if (def.binhCanh) {
      var bcDef = BINH_CANH[def.binhCanh];
      var done = def.binhCanh === 'ngodao' ? !!player.tieuMoc.ngoDao : !!player.tieuMoc.thangTinhAnh;
      bcOk = done;
      binhCanh = { kind: def.binhCanh, name: bcDef.name, desc: bcDef.desc, done: done, ok: done };
    }

    return {
      moc: moc, cap: cap, kind: 'minor', nextLabel: mocLabel(moc + 1),
      paths: paths, pathsOk: pathsOk,
      lt: lt, materials: materials, matsOk: matsOk,
      binhCanh: binhCanh,
      canBreak: pathsOk && lt.ok && matsOk && bcOk
    };
  }

  function missingSummary(cond) {
    var parts = [];
    for (var i = 0; i < cond.paths.length; i++) {
      var p = cond.paths[i];
      if (!p.ok) parts.push('Tu vi ' + ELEM_NAMES[p.elem] + ' ' + p.have + '/' + p.need);
    }
    if (cond.lt && !cond.lt.ok) parts.push('Linh Thạch ' + cond.lt.have + '/' + cond.lt.need);
    for (var j = 0; j < cond.materials.length; j++) {
      var m = cond.materials[j];
      if (!m.ok) parts.push(m.name + ' ' + m.have + '/' + m.need);
    }
    if (cond.binhCanh && !cond.binhCanh.ok) parts.push(cond.binhCanh.name + ' (chưa xong)');
    return parts;
  }

  /**
   * Thực hiện đột phá tiểu mốc: kiểm đủ điều kiện -> trừ Linh Thạch + nguyên
   * liệu (gồm đan phụ trợ nếu mốc yêu cầu) -> mở mốc kế (trần mới qua
   * state.getMocCap) -> lưu. Thiếu bất cứ điều kiện nào: từ chối kèm danh
   * sách thiếu, KHÔNG trừ gì. Nhãn cảnh giới cập nhật qua syncRealmLabel
   * trong savePlayer như mọi thay đổi tu vi khác.
   */
  function doBreakthrough(player) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };
    ensureState(player);

    var cond = getConditions(player);
    if (cond.kind === 'grand') {
      var msgG = 'Đây là đột phá ĐẠI cảnh giới lên Trúc Cơ — hãy luyện Trúc Cơ Đan rồi dùng đan để đột phá (gặp Chấp Sự hoặc mở Đan Phòng).';
      showToast(msgG);
      return { ok: false, reason: 'grand_breakthrough', msg: msgG };
    }
    if (cond.kind === 'future') {
      var msgF = 'Đột phá lên ' + cond.nextLabel + ' sẽ mở ở đợt xây dựng sau.';
      showToast(msgF);
      return { ok: false, reason: 'future_realm', msg: msgF };
    }
    if (!cond.canBreak) {
      var miss = missingSummary(cond);
      var reason = !cond.pathsOk ? 'paths' : (cond.lt && !cond.lt.ok ? 'linh_thach' : (!cond.matsOk ? 'materials' : 'binh_canh'));
      var msgBlock = 'Chưa đủ điều kiện đột phá lên ' + cond.nextLabel + '. Còn thiếu: ' + miss.join(' · ') + '.';
      showToast(msgBlock);
      return { ok: false, reason: reason, missing: miss, msg: msgBlock };
    }

    var def = BREAKS[cond.moc];
    player.linhThach = (player.linhThach || 0) - def.lt;
    for (var i = 0; i < def.materials.length; i++) {
      st.removeItemFromBag(player, def.materials[i].itemId, def.materials[i].count);
    }
    var newMoc = st.setMocIndex(player, cond.moc + 1);
    player.tieuMoc.focus = null;
    st.savePlayer(player);
    playChime();
    refreshHUD();

    var msgOk = 'Đột phá tiểu mốc thành công! Đạt mốc ' + cond.nextLabel + ' — trần tu vi mỗi đường mở lên ' + st.getMocCap(player) + '.';
    showToast(msgOk);
    return { ok: true, msg: msgOk, moc: newMoc, nextLabel: cond.nextLabel, newCap: st.getMocCap(player) };
  }

  // ---------------------------------------------------------------------------
  // TIỂU BÌNH CẢNH (hồ sơ 06)
  // ---------------------------------------------------------------------------

  /** engine gọi khi người chơi đả tọa tại điểm Đả Tọa (Tông Môn). */
  function noteNgoDao(player) {
    if (!player) return false;
    var st = getStateAPI();
    ensureState(player);
    var moc = st ? st.getMocIndex(player) : player.tieuMoc.moc;
    if (moc !== 3 || player.tieuMoc.ngoDao) return false;
    player.tieuMoc.ngoDao = true;
    if (player.tieuMoc.focus && player.tieuMoc.focus.type === 'binhcanh') player.tieuMoc.focus = null;
    if (st) st.savePlayer(player);
    showToast('Ngộ đạo thành công! Tiểu bình cảnh của tầng 3 đã vượt qua — về bảng Đột Phá Tiểu Mốc kiểm tra điều kiện lên tầng 4.');
    playChime();
    return true;
  }

  /** engine gọi mỗi khi người chơi hạ một quái tinh anh. */
  function noteEliteKill(player) {
    if (!player) return false;
    var st = getStateAPI();
    ensureState(player);
    var moc = st ? st.getMocIndex(player) : player.tieuMoc.moc;
    if (moc !== 6 || player.tieuMoc.thangTinhAnh) return false;
    player.tieuMoc.thangTinhAnh = true;
    if (player.tieuMoc.focus && player.tieuMoc.focus.type === 'binhcanh') player.tieuMoc.focus = null;
    if (st) st.savePlayer(player);
    showToast('Đã đánh bại quái tinh anh ở tầng 6 — tiểu bình cảnh thắng tinh anh hoàn thành!');
    playChime();
    return true;
  }

  // ---------------------------------------------------------------------------
  // DẪN ĐƯỜNG TỚI NGUỒN CÒN THIẾU (chuẩn hồ sơ 09, móc của engine)
  // ---------------------------------------------------------------------------

  function setFocus(player, focus) {
    if (!player) return;
    ensureState(player);
    player.tieuMoc.focus = focus || null;
    var st = getStateAPI();
    if (st) st.savePlayer(player);
    refreshHUD();
  }

  function focusTarget(player, focus, cond) {
    if (!focus) return null;
    var title = 'Đột Phá Tiểu Mốc — ';
    if (focus.type === 'path') {
      var hunt = ELEM_HUNT[focus.key];
      if (!hunt) return null;
      var st = getStateAPI();
      var rank = st && st.getRealmRank ? st.getRealmRank(player) : 0;
      if (rank >= hunt.minRank) {
        return {
          stepId: 'tieumoc_path_' + focus.key, stage: 4,
          mapId: hunt.mapId, kind: 'monster', speciesId: hunt.speciesId,
          title: title + 'Tu vi ' + ELEM_NAMES[focus.key],
          desc: 'Săn ' + hunt.mon + ' ở ' + hunt.zone + ' để tăng tu vi ' + ELEM_NAMES[focus.key] + ' tới trần mốc ' + cond.cap + '.'
        };
      }
      return {
        stepId: 'tieumoc_path_' + focus.key, stage: 4,
        mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu',
        title: title + 'Tu vi ' + ELEM_NAMES[focus.key],
        desc: 'Vùng săn của hệ ' + ELEM_NAMES[focus.key] + ' chưa mở — hãy đổi Tu Luyện Đan (' + ELEM_NAMES[focus.key] + ') 15 Linh Thạch/viên tại Chấp Sự Đường để tăng tu vi đường này.'
      };
    }
    if (focus.type === 'material') {
      var src = MAT_SOURCES[focus.key];
      if (!src) return null;
      var info = {
        stepId: 'tieumoc_mat_' + focus.key, stage: 4,
        mapId: src.mapId, kind: src.kind,
        title: title + itemName(focus.key),
        desc: 'Thu thập ' + itemName(focus.key) + ' tại ' + src.label + '.'
      };
      if (src.kind === 'monster') info.speciesId = src.speciesId;
      if (src.kind === 'point') { info.x = src.x; info.y = src.y; }
      return info;
    }
    if (focus.type === 'binhcanh') {
      var bc = cond.binhCanh ? BINH_CANH[cond.binhCanh.kind] : null;
      if (!bc) return null;
      var t = bc.target;
      var bInfo = {
        stepId: 'tieumoc_binhcanh_' + cond.binhCanh.kind, stage: 4,
        mapId: t.mapId, kind: t.kind,
        title: title + cond.binhCanh.name,
        desc: cond.binhCanh.desc + ' Đích: ' + t.label + '.'
      };
      if (t.kind === 'monster') bInfo.speciesId = t.speciesId;
      if (t.kind === 'point') { bInfo.x = t.x; bInfo.y = t.y; }
      return bInfo;
    }
    if (focus.type === 'lt') {
      // Linh Thạch rơi từ mọi quái — chỉ tới bãi săn của đường yếu nhất.
      var weakest = cond.paths[0];
      for (var i = 1; i < cond.paths.length; i++) {
        if (cond.paths[i].have < weakest.have) weakest = cond.paths[i];
      }
      var h2 = ELEM_HUNT[weakest.elem];
      return {
        stepId: 'tieumoc_lt', stage: 4,
        mapId: h2.mapId, kind: 'monster', speciesId: h2.speciesId,
        title: title + 'Linh Thạch',
        desc: 'Săn quái ở ' + h2.zone + ' để nhặt Linh Thạch rơi (cần ' + (cond.lt ? cond.lt.need : 0) + ' cho đột phá mốc này).'
      };
    }
    return null;
  }

  function focusStillMissing(player, focus, cond) {
    if (!focus || !cond || cond.kind !== 'minor') return false;
    if (focus.type === 'path') {
      for (var i = 0; i < cond.paths.length; i++) {
        if (cond.paths[i].elem === focus.key) return !cond.paths[i].ok;
      }
      return false;
    }
    if (focus.type === 'material') {
      for (var j = 0; j < cond.materials.length; j++) {
        if (cond.materials[j].itemId === focus.key) return !cond.materials[j].ok;
      }
      return false;
    }
    if (focus.type === 'binhcanh') return !!(cond.binhCanh && !cond.binhCanh.ok);
    if (focus.type === 'lt') return !!(cond.lt && !cond.lt.ok);
    return false;
  }

  /**
   * Móc dẫn đường của engine (getQuestTargetInfo): chỉ trả đích khi người
   * chơi đã đặt theo dõi từ bảng Đột Phá và điều kiện đó VẪN còn thiếu; đủ
   * rồi thì tự tắt theo dõi và trả null để dẫn đường về chuỗi chính.
   */
  function getTrackedTargetInfo(player) {
    if (!player) return null;
    ensureState(player);
    var focus = player.tieuMoc.focus;
    if (!focus) return null;
    var cond = getConditions(player);
    if (!focusStillMissing(player, focus, cond)) {
      player.tieuMoc.focus = null;
      return null;
    }
    return focusTarget(player, focus, cond);
  }

  // ---------------------------------------------------------------------------
  // GIAO DIỆN BẢNG ĐỘT PHÁ TIỂU MỐC
  // Liệt kê đủ/thiếu TỪNG đường + Linh Thạch + nguyên liệu + bình cảnh; mỗi
  // mục còn thiếu có nút "Chỉ đường" tới nguồn thật. Nút Đột Phá chỉ bấm
  // được khi đủ mọi điều kiện (theo lệnh đợt).
  // ---------------------------------------------------------------------------

  function setElementIconSprite(el, def, cellPx) {
    if (!el || !def) return;
    var scale = cellPx / 32;
    el.style.backgroundImage = "url('assets/art/icons-sheet.png')";
    el.style.backgroundSize = (192 * scale) + 'px ' + (224 * scale) + 'px';
    el.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.width = cellPx + 'px';
    el.style.height = cellPx + 'px';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function guideBtn(focus, label) {
    var b = el('button', 'btn wood tieumoc-btn tieumoc-btn-guide', label || 'Chỉ đường');
    b.type = 'button';
    b.addEventListener('click', function () {
      setFocus(livePlayer, focus);
      closePanel();
      showToast('Đã bật dẫn đường — hãy đi theo mũi tên chỉ đường trên màn hình.');
    });
    return b;
  }

  function condRow(iconDef, nameText, countText, ok, focus) {
    var row = el('div', 'tieumoc-row' + (ok ? ' ok' : ' lacking'));
    if (iconDef) {
      var icon = el('div', 'tieumoc-row-icon');
      setElementIconSprite(icon, iconDef, 28);
      row.appendChild(icon);
    }
    row.appendChild(el('span', 'tieumoc-row-name', nameText));
    row.appendChild(el('span', 'tieumoc-row-count' + (ok ? ' enough' : ' lacking'), countText));
    if (!ok && focus) row.appendChild(guideBtn(focus));
    return row;
  }

  function renderPanel() {
    if (typeof document === 'undefined') return;
    if (!livePlayer) return;
    ensureState(livePlayer);
    var body = document.getElementById('tieumoc-body');
    if (!body) return;
    body.innerHTML = '';

    var cond = getConditions(livePlayer);
    var st = getStateAPI();
    var cap = cond.cap;

    var head = el('div', 'tieumoc-intro',
      'Mốc hiện tại: ' + mocLabel(cond.moc) + ' — trần tu vi mỗi đường: ' + cap + '. ' +
      'Đột phá tiểu mốc mở trần của mốc kế; tu vi săn và luyện đan không vượt trần của mốc chưa đột phá.');
    body.appendChild(head);

    if (cond.kind === 'grand') {
      body.appendChild(el('div', 'tieumoc-section-title', 'Đột phá ĐẠI cảnh giới — lên Trúc Cơ Sơ Kỳ'));
      cond.paths.forEach(function (p) {
        body.appendChild(condRow(null, 'Tu vi ' + ELEM_NAMES[p.elem], p.have + '/' + p.need + (p.ok ? ' — ĐẦY' : ''), p.ok,
          p.ok ? null : { type: 'path', key: p.elem }));
      });
      var grandNote = el('div', 'tieumoc-source',
        'Đủ 900 tu vi cả 5 đường thì luyện Trúc Cơ Đan (Đan Phòng hoặc Chấp Sự Đường). Đột phá Trúc Cơ có ĐỘ KIẾP diễn thật 3 tia (đợt T2) — hãy mở Bảng Đột Phá Trúc Cơ để xem đủ/thiếu từng nguyên liệu và bấm đột phá tại đó. Đột phá tiểu mốc không áp dụng cho mốc này.');
      body.appendChild(grandNote);
      var gActions = el('div', 'tieumoc-actions');
      var btnDp = el('button', 'btn wood tieumoc-btn', 'Mở Đan Phòng');
      btnDp.type = 'button';
      btnDp.addEventListener('click', function () {
        closePanel();
        if (typeof window !== 'undefined' && window.GameDanPhong && window.GameDanPhong.openPanel) {
          window.GameDanPhong.openPanel('refine');
        }
      });
      gActions.appendChild(btnDp);
      // Đợt T2: mở thẳng Bảng Đột Phá Trúc Cơ (js/dotpha.js) từ mục đại
      // cảnh giới của bảng này.
      var btnGrand = el('button', 'btn wood tieumoc-btn tieumoc-btn-break', 'Mở Bảng Đột Phá Trúc Cơ');
      btnGrand.type = 'button';
      btnGrand.addEventListener('click', function () {
        closePanel();
        if (typeof window !== 'undefined' && window.GameDotPha && window.GameDotPha.openPanel) {
          window.GameDotPha.openPanel();
        }
      });
      gActions.appendChild(btnGrand);
      body.appendChild(gActions);
      return;
    }

    if (cond.kind === 'future') {
      body.appendChild(el('div', 'tieumoc-section-title', 'Mốc ' + mocLabel(cond.moc)));
      body.appendChild(el('div', 'tieumoc-source',
        'Trần tu vi mỗi đường tại mốc này là ' + cap + '. Đột phá lên ' + cond.nextLabel + ' sẽ mở ở đợt xây dựng tiếp theo của chương trình hồ sơ.'));
      return;
    }

    body.appendChild(el('div', 'tieumoc-section-title', 'Điều kiện đột phá lên ' + cond.nextLabel));

    cond.paths.forEach(function (p) {
      body.appendChild(condRow(null,
        'Tu vi ' + ELEM_NAMES[p.elem],
        p.have + '/' + p.need + (p.ok ? ' — ĐẦY TRẦN' : ''),
        p.ok, p.ok ? null : { type: 'path', key: p.elem }));
    });

    if (cond.lt) {
      body.appendChild(condRow(getItemDef('linh-thach'), 'Linh Thạch',
        cond.lt.have + '/' + cond.lt.need, cond.lt.ok,
        cond.lt.ok ? null : { type: 'lt', key: 'lt' }));
    }

    cond.materials.forEach(function (m) {
      body.appendChild(condRow(getItemDef(m.itemId), m.name,
        m.have + '/' + m.need, m.ok,
        m.ok ? null : { type: 'material', key: m.itemId }));
      if (!m.ok && MAT_SOURCES[m.itemId]) {
        body.appendChild(el('div', 'tieumoc-source', 'Nguồn: ' + MAT_SOURCES[m.itemId].label + '.'));
      }
    });

    if (cond.binhCanh) {
      body.appendChild(condRow(null, cond.binhCanh.name,
        cond.binhCanh.done ? 'Đã hoàn thành' : 'Chưa hoàn thành',
        cond.binhCanh.ok,
        cond.binhCanh.ok ? null : { type: 'binhcanh', key: cond.binhCanh.kind }));
      body.appendChild(el('div', 'tieumoc-source', cond.binhCanh.desc));
    }

    var focus = livePlayer.tieuMoc.focus;
    if (focus) {
      var fRow = el('div', 'tieumoc-actions');
      fRow.appendChild(el('span', 'tieumoc-miss-note', 'Dẫn đường đột phá đang bật — mũi tên trên màn hình chỉ tới nguồn còn thiếu.'));
      var btnOff = el('button', 'btn wood tieumoc-btn tieumoc-btn-danger', 'Tắt Dẫn Đường');
      btnOff.type = 'button';
      btnOff.addEventListener('click', function () {
        setFocus(livePlayer, null);
        renderPanel();
      });
      fRow.appendChild(btnOff);
      body.appendChild(fRow);
    }

    var actions = el('div', 'tieumoc-actions');
    var btn = el('button', 'btn wood tieumoc-btn tieumoc-btn-break', 'Đột Phá Lên ' + cond.nextLabel);
    btn.type = 'button';
    btn.id = 'tieumoc-btn-break';
    // Theo lệnh đợt: nút CHỈ bấm được khi đủ mọi điều kiện; phần còn thiếu
    // đã liệt kê từng mục kèm nút Chỉ đường ở trên.
    btn.disabled = !cond.canBreak;
    btn.addEventListener('click', function () {
      var res = doBreakthrough(livePlayer);
      renderPanel();
      return res;
    });
    actions.appendChild(btn);
    if (!cond.canBreak) {
      actions.appendChild(el('span', 'tieumoc-miss-note', 'Còn thiếu: ' + missingSummary(cond).join(' · ')));
    }
    body.appendChild(actions);
  }

  function openPanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('tieumoc-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderPanel();
  }

  function closePanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('tieumoc-modal');
    if (modal) modal.classList.add('hidden');
  }

  function isPanelOpen() {
    if (typeof document === 'undefined') return false;
    var modal = document.getElementById('tieumoc-modal');
    return !!modal && !modal.classList.contains('hidden');
  }

  /**
   * Móc nối với player đang sống (ui.js gọi trong initUI, cùng khuôn Đan Phòng)
   */
  function attach(player) {
    livePlayer = player;
    ensureState(livePlayer);

    if (typeof document === 'undefined') return;

    var btnClose = document.getElementById('close-tieumoc-modal');
    if (btnClose && !btnClose.dataset.wired) {
      btnClose.dataset.wired = '1';
      btnClose.addEventListener('click', function () { closePanel(); });
    }

    var btnOpen = document.getElementById('btn-tieumoc-open');
    if (btnOpen && !btnOpen.dataset.wired) {
      btnOpen.dataset.wired = '1';
      btnOpen.addEventListener('click', function () {
        var cp = document.getElementById('char-panel');
        if (cp) cp.classList.add('hidden');
        openPanel();
      });
    }

    var modal = document.getElementById('tieumoc-modal');
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closePanel();
      });
    }

    if (!document.body.dataset.tieumocEscWired) {
      document.body.dataset.tieumocEscWired = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var md = document.getElementById('tieumoc-modal');
          if (md && !md.classList.contains('hidden')) closePanel();
        }
      });
    }
  }

  // Xuất API
  exports.BREAKS = BREAKS;
  exports.ELEM_HUNT = ELEM_HUNT;
  exports.MAT_SOURCES = MAT_SOURCES;
  exports.BINH_CANH = BINH_CANH;
  exports.ensureState = ensureState;
  exports.mocLabel = mocLabel;
  exports.getConditions = getConditions;
  exports.missingSummary = missingSummary;
  exports.doBreakthrough = doBreakthrough;
  exports.noteNgoDao = noteNgoDao;
  exports.noteEliteKill = noteEliteKill;
  exports.setFocus = setFocus;
  exports.getTrackedTargetInfo = getTrackedTargetInfo;
  exports.attach = attach;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;
  exports.isPanelOpen = isPanelOpen;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameTieuMoc = {}));
