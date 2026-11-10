/**
 * kimdan.js — Đợt T3: ĐỘT PHÁ KIM ĐAN (Ngũ Hành Quy Nguyên Đan + PHẨM ĐAN
 * theo Hài Hòa + TÂM MA bản đầu + độ kiếp 5 tia) cho Ngũ Hành Vô Địch.
 *
 * Căn cứ hồ sơ (đọc từ tài liệu gốc, không suy từ trí nhớ):
 * - Hồ sơ 02 §3.2 + Sổ luật Điều 142: đột phá Kim Đan cần năm đường ĐẦY TRẦN
 *   Trúc Cơ Viên Mãn + Ngũ Hành Quy Nguyên Đan luyện tại lò đan tông môn:
 *   Nguyên Tinh Mộc/Thủy/Hỏa/Thổ/Kim x1 + Nước Ốc Đảo Tinh Khiết x2 +
 *   1.500 Linh Thạch.
 * - Hồ sơ 05C + 17A: PHẨM Kim Đan (Nhất -> Cửu phẩm) quyết bởi độ HÀI HÒA
 *   của năm đường và các mốc chuẩn bị (số boss vùng đã hạ); phẩm là THƯỞNG
 *   VĨNH VIỄN qua ba kênh: hệ số tu vi, tỉ lệ luyện đan, sức chứa linh lực.
 * - Hồ sơ 04A §2: đột phá đại cảnh giới phải thắng TÂM MA — bản sao của
 *   chính mình, bộ kỹ năng giống hệt, MÁU CAO HƠN.
 * - Hồ sơ 05D §3: độ kiếp theo thang — Kim Đan 5 TIA.
 *
 * LUẬT CỦA BUI (đợt T2, 2026-11-10) ÁP CHO ĐỢT NÀY:
 * - Tỉ lệ luyện đan 70% và tỉ lệ/án phạt trong hồ sơ KHÔNG áp: luyện đan và
 *   đột phá giữ THÀNH CÔNG 100% khi đủ điều kiện (CONFIG.successRate khóa
 *   1.0 như js/dotpha.js). Câu hỏi tỉ lệ/phạt để trong báo cáo đợt chờ Bui.
 * - Thua tâm ma KHÔNG mất tu vi, KHÔNG mất đan (án "lùi tu vi" của hồ sơ
 *   04A không áp theo cùng luật không phạt): đột phá chỉ dời lại, thử lại
 *   được ngay. Đan chỉ tiêu hao khi KẾT ĐAN THÀNH CÔNG.
 *
 * SỐ ĐỘI SOẠN đợt T3 (hồ sơ không chốt số — khai đầy đủ trong báo cáo đợt):
 * - Ánh xạ phẩm: phẩm = 1 + floor(HH x 8) (HH = Hài Hòa tại lúc LUYỆN đan,
 *   theo đúng 17A "đan luyện ra càng thuần thì kim đan càng cao phẩm"),
 *   cộng +1 (trần Cửu phẩm) nếu người chơi đã hạ từ 5 lượt boss vùng trở
 *   lên (stats.bossKills — chỉ số chuẩn bị của 05C; game chưa ghi riêng
 *   từng boss vùng nên dùng tổng lượt hạ boss làm đại diện).
 * - Kênh thưởng của phẩm: sức chứa linh lực +5%/phẩm trên Nhất (state.js
 *   deriveStats), hệ số tu vi +2%/phẩm trên Nhất (state.js addTuViCapped).
 *   Kênh "tỉ lệ luyện đan" chưa có đòn bẩy thật vì luyện đan đang 100% —
 *   để dành đợt D2 (luyện đan tương tác), ghi rõ trong báo cáo.
 * - Tâm ma bản đầu: bản sao có máu = 1,5 x máu tối đa của người chơi; công/
 *   giáp/chí mạng/hồi phục và BỘ CHIÊU (loadout đã mở khóa) lấy đúng của
 *   người chơi; trận đấu theo lượt ngay trong Bảng Đột Phá (cảnh giới tâm
 *   ma), sát thương qua đúng công thức combat.js (giáp cong + trần sàn
 *   25%), đòn vào người chơi qua bảo hộ một đòn của hồ sơ 49 §6. Trạng
 *   thái phụ của chiêu (trói/choáng...) chưa mô phỏng trong bản đầu.
 *
 * Trạng thái lưu trong player.kimDan (state.js ensureKimDan khởi tạo lười).
 * Node-loadable & trình duyệt (khuôn mẫu tieumoc.js).
 */

(function (exports) {
  'use strict';

  // =========================================================================
  // CẤU HÌNH — MỘT CHỖ DUY NHẤT (khuôn dotpha.js CONFIG).
  // successRate khóa 1.0 theo phán của Bui ở đợt T2.
  // =========================================================================
  var CONFIG = {
    successRate: 1.0,
    bolts: 5
  };

  var PILL_ID = 'ngu-hanh-quy-nguyen-dan';
  var PILL_NAME = 'Ngũ Hành Quy Nguyên Đan';
  var RECIPE = [
    { itemId: 'nguyen-tinh-moc', count: 1 },
    { itemId: 'nguyen-tinh-thuy', count: 1 },
    { itemId: 'nguyen-tinh-hoa', count: 1 },
    { itemId: 'nguyen-tinh-tho', count: 1 },
    { itemId: 'nguyen-tinh-kim', count: 1 },
    { itemId: 'nuoc-oc-dao-tinh-khiet', count: 2 }
  ];
  var RECIPE_LT_FEE = 1500;
  var REFINE_MIN_MOC = 10; // luyện được từ khi đạt mốc Trúc Cơ (mốc 10)
  var MIRROR_HP_MULT = 1.5; // hồ sơ 04A: bản sao "máu cao hơn" — số đội soạn

  var PATH_KEYS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
  var PATH_VI = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  var PHAM_NAMES = ['', 'Nhất phẩm', 'Nhị phẩm', 'Tam phẩm', 'Tứ phẩm', 'Ngũ phẩm', 'Lục phẩm', 'Thất phẩm', 'Bát phẩm', 'Cửu phẩm'];

  var BOSS_OF_MAT = {
    'nguyen-tinh-moc': 'boss_moc_linh_co_vuong',
    'nguyen-tinh-thuy': 'boss_han_kinh_giao_vuong',
    'nguyen-tinh-hoa': 'boss_xich_diem_viem_quan',
    'nguyen-tinh-tho': 'boss_hoang_sa_co_vuong',
    'nguyen-tinh-kim': 'boss_tan_kiem_vo_danh'
  };
  var SOURCE_TEXT = {
    'nguyen-tinh-moc': 'Hạ Mộc Linh Cổ Vương (boss) ở Rừng Độc Thanh Tụy (rơi chắc chắn) — hoặc chế từ 5 Lá Thanh Tụy tại Đan Phòng.',
    'nguyen-tinh-thuy': 'Hạ Hàn Kính Giao Vương (boss) ở Hồ Băng Hàn Kính (rơi chắc chắn) — hoặc chế từ 5 Băng Tinh tại Đan Phòng.',
    'nguyen-tinh-hoa': 'Hạ Xích Diệm Viêm Quân (boss) ở Mỏ Lửa Xích Diệm (rơi chắc chắn).',
    'nguyen-tinh-tho': 'Hạ Hoàng Sa Cổ Vương (boss) ở Hoang Mạc Hoàng Sa (rơi chắc chắn).',
    'nguyen-tinh-kim': 'Hạ Tàn Kiếm Vô Danh (boss) ở Kiếm Trủng Huyền Thiết (rơi chắc chắn).',
    'nuoc-oc-dao-tinh-khiet': 'Săn Hoàng Sa Trùng ở Hoang Mạc Hoàng Sa (rơi 30%) hoặc hạ Sa Thạch Tượng tinh anh (rơi chắc chắn).'
  };

  // --- Truy cập module khác (trình duyệt: window; Node: global/require) ---
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
  function getSkillsAPI() {
    if (typeof window !== 'undefined' && window.GameSkills) return window.GameSkills;
    if (typeof global !== 'undefined' && global.GameSkills) return global.GameSkills;
    try { return require('./skills.js'); } catch (e) { return null; }
  }
  function getCombatAPI() {
    if (typeof window !== 'undefined' && window.GameCombat) return window.GameCombat;
    if (typeof global !== 'undefined' && global.GameCombat) return global.GameCombat;
    try { return require('./combat.js'); } catch (e) { return null; }
  }
  function getEngineAPI() {
    if (typeof window !== 'undefined' && window.GameEngine) return window.GameEngine;
    if (typeof global !== 'undefined' && global.GameEngine) return global.GameEngine;
    return null;
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
  function bagCount(player, itemId) {
    var st = getStateAPI();
    if (st && typeof st.countItemInBag === 'function') return st.countItemInBag(player, itemId) || 0;
    return 0;
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
    if (st && st.ensureKimDan) return st.ensureKimDan(player);
    if (!player.kimDan || typeof player.kimDan !== 'object') {
      player.kimDan = { pham: 0, pillPham: 0, tamMaWins: 0, tamMaFalls: 0, focus: null };
    }
    return player.kimDan;
  }

  function phamName(pham) {
    return PHAM_NAMES[pham] || '';
  }

  // =========================================================================
  // PHẨM ĐAN THEO HÀI HÒA (hồ sơ 05C + 17A)
  // =========================================================================

  /** Hài Hòa hiện tại của người chơi (0..1, chỉ số K2 trong state.js). */
  function harmonyNow(player) {
    var st = getStateAPI();
    if (!st || !player || !player.paths) return 0;
    if (typeof st.harmonyRatio === 'function') return st.harmonyRatio(player.paths);
    return 0;
  }

  /** Điểm chuẩn bị boss của hồ sơ 05C (đại diện: tổng lượt hạ boss >= 5). */
  function bossPrepBonus(player) {
    var kills = (player && player.stats && typeof player.stats.bossKills === 'number')
      ? player.stats.bossKills : 0;
    return kills >= 5 ? 1 : 0;
  }

  /**
   * Ánh xạ Hài Hòa -> phẩm 1..9 (số đội soạn đợt T3, khai ở đầu tệp):
   * phẩm = 1 + floor(HH x 8), cộng điểm chuẩn bị boss, trần Cửu phẩm.
   */
  function phamFromHarmony(hh, bossBonus) {
    var h = (typeof hh === 'number' && isFinite(hh)) ? Math.max(0, Math.min(1, hh)) : 0;
    var p = 1 + Math.floor(h * 8);
    if (bossBonus) p += 1;
    return Math.max(1, Math.min(9, p));
  }

  /** Phẩm sẽ nhận nếu luyện Quy Nguyên Đan NGAY LÚC NÀY. */
  function previewPham(player) {
    var hh = harmonyNow(player);
    var bonus = bossPrepBonus(player);
    return { hh: hh, bossBonus: bonus, pham: phamFromHarmony(hh, bonus) };
  }

  // =========================================================================
  // LUYỆN NGŨ HÀNH QUY NGUYÊN ĐAN (hồ sơ 02 §3.2 — luyện tại Đan Phòng)
  // Thành công 100% khi đủ nguyên liệu (luật Bui đợt T2; tỉ lệ 70% của hồ
  // sơ KHÔNG áp — câu hỏi chờ Bui trong báo cáo đợt). Phẩm của viên đan
  // tính từ Hài Hòa tại thời điểm luyện và ghi vào player.kimDan.pillPham
  // (giữ phẩm CAO NHẤT trong các viên đang giữ).
  // =========================================================================
  function refineQuyNguyen(player) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };
    var kd = ensureState(player);

    var moc = typeof st.getMocIndex === 'function' ? st.getMocIndex(player) : 1;
    if (moc < REFINE_MIN_MOC) {
      var msgLocked = 'Ngũ Hành Quy Nguyên Đan chỉ luyện được từ Trúc Cơ — hãy đột phá Trúc Cơ trước (mốc hiện tại chưa tới).';
      showToast(msgLocked);
      return { ok: false, reason: 'locked', msg: msgLocked };
    }

    var missing = [];
    for (var i = 0; i < RECIPE.length; i++) {
      var have = bagCount(player, RECIPE[i].itemId);
      if (have < RECIPE[i].count) {
        missing.push(itemName(RECIPE[i].itemId) + ' ' + have + '/' + RECIPE[i].count);
      }
    }
    var ltHave = player.linhThach || 0;
    if (ltHave < RECIPE_LT_FEE) missing.push('Linh Thạch ' + ltHave + '/' + RECIPE_LT_FEE);
    if (missing.length > 0) {
      var msgMiss = 'Chưa đủ nguyên liệu luyện ' + PILL_NAME + ': ' + missing.join(' · ') + '.';
      showToast(msgMiss);
      return { ok: false, reason: 'missing_materials', missing: missing, msg: msgMiss };
    }

    var j;
    for (j = 0; j < RECIPE.length; j++) {
      st.removeItemFromBag(player, RECIPE[j].itemId, RECIPE[j].count);
    }
    player.linhThach = ltHave - RECIPE_LT_FEE;
    var m = getMonstersAPI();
    var addRes = st.addItemToBag(player, PILL_ID, 1, m ? m.ITEM_DEFS : undefined);
    if (!addRes || !addRes.success) {
      // Hoàn toàn bộ nguyên liệu + Linh Thạch — không mất gì vì túi đầy.
      for (j = 0; j < RECIPE.length; j++) {
        st.addItemToBag(player, RECIPE[j].itemId, RECIPE[j].count, m ? m.ITEM_DEFS : undefined);
      }
      player.linhThach = ltHave;
      var msgFull = 'Túi đồ đã đầy, không nhận thêm được ' + PILL_NAME + '. Hãy dọn túi trước.';
      showToast(msgFull);
      return { ok: false, reason: 'bag_full', msg: msgFull };
    }

    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.refines = (player.stats.refines || 0) + 1;

    var prev = previewPham(player);
    kd.pillPham = Math.max(kd.pillPham || 0, prev.pham);
    st.savePlayer(player);

    var msgOk = 'Luyện thành công 1 ' + PILL_NAME + ' — phẩm ' + phamName(kd.pillPham) +
      ' (Hài Hòa lúc luyện ' + Math.round(prev.hh * 100) + '%). Mở Bảng Đột Phá Kim Đan để kết đan.';
    playChime();
    showToast(msgOk);
    refreshHUD();
    return { ok: true, msg: msgOk, pillId: PILL_ID, pham: kd.pillPham, hh: prev.hh };
  }

  // =========================================================================
  // TRẠNG THÁI ĐỘT PHÁ KIM ĐAN (thuần, kiểm được bằng Node)
  // =========================================================================
  function computeStatus(player) {
    var st = getStateAPI();
    var kd = ensureState(player);
    var moc = st && typeof st.getMocIndex === 'function' ? st.getMocIndex(player) : 1;
    var cap = st && typeof st.getMocCap === 'function' ? st.getMocCap(player) : 2500;
    var rows = [];
    var pathsOk = true;
    for (var i = 0; i < PATH_KEYS.length; i++) {
      var k = PATH_KEYS[i];
      var have = (player && player.paths && player.paths[k] && player.paths[k].tuVi) || 0;
      var ok = have >= cap;
      if (!ok) pathsOk = false;
      rows.push({ key: k, name: PATH_VI[k], have: have, cap: cap, ok: ok });
    }
    var pillHave = bagCount(player, PILL_ID);
    var recipe = [];
    for (var j = 0; j < RECIPE.length; j++) {
      recipe.push({
        itemId: RECIPE[j].itemId,
        name: itemName(RECIPE[j].itemId),
        need: RECIPE[j].count,
        have: bagCount(player, RECIPE[j].itemId),
        source: SOURCE_TEXT[RECIPE[j].itemId] || ''
      });
    }
    return {
      moc: moc,
      cap: cap,
      isKimDan: moc >= 14,
      pham: kd.pham || 0,
      paths: rows,
      pathsOk: pathsOk,
      pillHave: pillHave,
      pillOk: pillHave >= 1,
      pillPham: kd.pillPham || 0,
      recipe: recipe,
      recipeLtFee: RECIPE_LT_FEE,
      ltHave: (player && player.linhThach) || 0,
      tamMaWins: kd.tamMaWins || 0,
      tamMaFalls: kd.tamMaFalls || 0,
      preview: previewPham(player),
      ready: moc === 13 && pathsOk && pillHave >= 1
    };
  }

  // =========================================================================
  // DẪN ĐƯỜNG (khuôn tieumoc/dotpha): chỉ hoạt động khi người chơi bấm
  // "Chỉ đường" trong Bảng Đột Phá Kim Đan (player.kimDan.focus).
  // =========================================================================
  function monsterSourceList(monsterId) {
    var m = getMonstersAPI();
    if (!m || typeof m.getMonsters !== 'function') return [];
    var all = m.getMonsters() || [];
    var list = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].id === monsterId && all[i].spawnPoints) {
        for (var j = 0; j < all[i].spawnPoints.length; j++) {
          list.push({ mapId: all[i].mapId, x: all[i].spawnPoints[j].x, y: all[i].spawnPoints[j].y });
        }
      }
    }
    return list;
  }

  function nearestSource(list, player) {
    if (!list || !list.length) return null;
    var px = (player && player.x) || 0;
    var py = (player && player.y) || 0;
    var cur = player && player.currentMap;
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var dx = s.x - px;
      var dy = s.y - py;
      var d = dx * dx + dy * dy + (s.mapId === cur ? 0 : 100000000);
      if (d < bestScore) { bestScore = d; best = s; }
    }
    return best;
  }

  function matSourceTarget(player, itemId) {
    if (itemId === PILL_ID) {
      return {
        stepId: 'kimdan_pill', stage: 4, mapId: 'tong-mon', kind: 'point',
        x: 850, y: 560, title: 'Đột Phá Kim Đan — ' + PILL_NAME,
        desc: 'Tới Lò Đan của Đan Phòng ở Tông Môn để luyện ' + PILL_NAME + '.'
      };
    }
    if (itemId === 'nuoc-oc-dao-tinh-khiet') {
      var srcW = nearestSource(monsterSourceList('sa_tuong'), player);
      if (!srcW) return null;
      return {
        stepId: 'kimdan_src_nuoc_oc_dao', stage: 4, mapId: srcW.mapId, kind: 'monster',
        monsterId: 'sa_tuong', x: srcW.x, y: srcW.y,
        title: 'Đột Phá Kim Đan — Nước Ốc Đảo Tinh Khiết',
        desc: 'Hạ Sa Thạch Tượng (tinh anh) ở Hoang Mạc Hoàng Sa — rơi chắc chắn Nước Ốc Đảo Tinh Khiết (Hoàng Sa Trùng cũng rơi 30%).'
      };
    }
    var bossId = BOSS_OF_MAT[itemId];
    if (bossId) {
      var src = nearestSource(monsterSourceList(bossId), player);
      if (!src) return null;
      return {
        stepId: 'kimdan_src_' + bossId, stage: 4, mapId: src.mapId, kind: 'monster',
        monsterId: bossId, x: src.x, y: src.y,
        title: 'Đột Phá Kim Đan — ' + itemName(itemId),
        desc: 'Hạ boss trấn vùng để lấy ' + itemName(itemId) + ' (rơi chắc chắn). ' + (SOURCE_TEXT[itemId] || '')
      };
    }
    return null;
  }

  function getTrackedTargetInfo(player) {
    if (!player) return null;
    var kd = ensureState(player);
    var focus = kd.focus;
    if (!focus) return null;
    if (focus === 'pill') {
      if (bagCount(player, PILL_ID) >= 1) { kd.focus = null; return null; }
      return matSourceTarget(player, PILL_ID);
    }
    if (focus.indexOf('mat_') === 0) {
      var itemId = focus.slice(4);
      var need = 0;
      for (var i = 0; i < RECIPE.length; i++) {
        if (RECIPE[i].itemId === itemId) need = RECIPE[i].count;
      }
      if (!need || bagCount(player, itemId) >= need) { kd.focus = null; return null; }
      return matSourceTarget(player, itemId);
    }
    return null;
  }

  function setFocus(player, focus) {
    var kd = ensureState(player);
    if (kd) kd.focus = focus || null;
  }

  // =========================================================================
  // TÂM MA — BẢN ĐẦU (hồ sơ 04A §2)
  // Trận đấu theo lượt trong cảnh giới tâm ma: người chơi đấu BẢN SAO của
  // chính mình — chỉ số và bộ chiêu y hệt (loadout đã mở khóa), máu 1,5 lần.
  // Sát thương qua combat.js (giáp cong, sàn 25%); đòn vào người chơi qua
  // bảo hộ một đòn 49 §6. Thua: KHÔNG mất tu vi/đan (luật không phạt của
  // Bui) — chỉ ghi nhận số lần và cho đấu lại. Trạng thái phụ của chiêu
  // chưa mô phỏng ở bản đầu.
  // =========================================================================

  function getDuelSkills(player) {
    var sk = getSkillsAPI();
    if (!sk || typeof sk.getLoadout !== 'function') return [];
    var loadout = sk.getLoadout() || [];
    var out = [];
    for (var i = 0; i < loadout.length; i++) {
      var def = loadout[i];
      if (!def || !def.damage) continue;
      if (typeof sk.isUnlocked === 'function' && !sk.isUnlocked(def, player)) continue;
      out.push(def);
    }
    if (!out.length && typeof sk.getSkill === 'function') {
      var basic = sk.getSkill('basic');
      if (basic) out.push(basic);
    }
    return out;
  }

  function critChanceOf(stats) {
    var cr = (stats && typeof stats.critRate === 'number') ? stats.critRate : 5;
    var c = cr >= 1 ? cr / 100 : cr;
    return Math.max(0, Math.min(0.6, c)); // trần bản đầu 60% (đội soạn)
  }

  function cdRoundsOf(def) {
    var cd = (def && typeof def.cooldown === 'number') ? def.cooldown : 0;
    return Math.max(1, Math.round(cd / 3)); // giây -> lượt (số đội soạn bản đầu)
  }

  function createDuel(player, opts) {
    opts = opts || {};
    var st = getStateAPI();
    if (!st || !player) return null;
    var stats = st.deriveStats(player.paths, player.equipment);
    var mirrorHp = Math.round(stats.hpMax * MIRROR_HP_MULT);
    function side(hp, hpMax) {
      return {
        hp: hp, hpMax: hpMax,
        mp: stats.linhLucMax, mpMax: stats.linhLucMax,
        atk: stats.attack, def: stats.defense,
        critRate: stats.critRate, regenRate: stats.regenRate,
        cds: {}
      };
    }
    return {
      round: 1,
      over: false,
      won: false,
      playerName: player.name || 'Hà Nhân',
      p: side(stats.hpMax, stats.hpMax),
      m: side(mirrorHp, mirrorHp),
      log: ['Tâm ma hiện thân — một bản sao y hệt ngươi, khí huyết dồi dào hơn hẳn. Thắng nó mới được kết đan!'],
      rng: (typeof opts.rng === 'function') ? opts.rng : Math.random
    };
  }

  function strikeDamage(duel, attSide, defSide, def, targetIsPlayer) {
    var combat = getCombatAPI();
    var raw = attSide.atk * ((def.damage && def.damage.ratio) || 1) + ((def.damage && def.damage.flat) || 0);
    var dealt = combat && typeof combat.calcDamage === 'function'
      ? combat.calcDamage(raw, 1.0, defSide.def)
      : raw;
    var crit = duel.rng() < critChanceOf(attSide);
    if (crit) dealt *= (combat && combat.CRIT_MULTIPLIER) || 1.5;
    dealt = Math.max(1, Math.round(dealt));
    if (targetIsPlayer && combat && typeof combat.applyOneHitProtection === 'function') {
      dealt = Math.round(combat.applyOneHitProtection(dealt, defSide.hpMax));
    }
    return { dealt: dealt, crit: crit };
  }

  function tickCooldowns(side) {
    for (var k in side.cds) {
      if (side.cds[k] > 0) side.cds[k]--;
    }
  }

  function regenTick(duel) {
    var sides = [duel.p, duel.m];
    for (var i = 0; i < 2; i++) {
      var s = sides[i];
      if (s.hp > 0) {
        s.hp = Math.min(s.hpMax, s.hp + Math.round(s.regenRate || 0));
        s.mp = Math.min(s.mpMax, s.mp + Math.max(1, Math.round(s.mpMax * 0.08)));
      }
    }
  }

  function finishDuel(player, duel) {
    var kd = ensureState(player);
    if (duel.won) kd.tamMaWins = (kd.tamMaWins || 0) + 1;
    else kd.tamMaFalls = (kd.tamMaFalls || 0) + 1;
    var st = getStateAPI();
    if (st && typeof st.savePlayer === 'function') st.savePlayer(player);
  }

  function mirrorPickSkill(player, duel) {
    var skills = getDuelSkills(player);
    var best = null;
    for (var i = 0; i < skills.length; i++) {
      var def = skills[i];
      if ((duel.m.cds[def.id] || 0) > 0) continue;
      var cost = (def.cost && def.cost.amount) || 0;
      if (duel.m.mp < cost) continue;
      if (!best || ((def.damage && def.damage.ratio) || 0) > ((best.damage && best.damage.ratio) || 0)) {
        best = def;
      }
    }
    return best;
  }

  /**
   * Một lượt đấu: người chơi tung chiêu skillId -> bản sao đáp trả -> hồi
   * phục cuối lượt. Trả { ok, msg?, duel }. Khi trận kết thúc, kết quả
   * được ghi vào player.kimDan (thắng/thua) và lưu ngay.
   */
  function duelAct(player, duel, skillId) {
    if (!player || !duel) return { ok: false, msg: 'Chưa vào cảnh giới tâm ma.' };
    if (duel.over) return { ok: false, msg: 'Trận đấu đã kết thúc.' };
    var skills = getDuelSkills(player);
    var def = null;
    for (var i = 0; i < skills.length; i++) {
      if (skills[i].id === skillId) { def = skills[i]; break; }
    }
    if (!def) return { ok: false, msg: 'Chiêu không khả dụng trong trận này.' };
    tickCooldowns(duel.p);
    if ((duel.p.cds[def.id] || 0) > 0) {
      return { ok: false, msg: def.name + ' đang hồi chiêu (' + duel.p.cds[def.id] + ' lượt).' };
    }
    var cost = (def.cost && def.cost.amount) || 0;
    if (duel.p.mp < cost) {
      return { ok: false, msg: 'Không đủ linh lực cho ' + def.name + ' (cần ' + cost + ').' };
    }
    duel.p.mp -= cost;
    duel.p.cds[def.id] = cdRoundsOf(def);

    var hit = strikeDamage(duel, duel.p, duel.m, def, false);
    duel.m.hp = Math.max(0, duel.m.hp - hit.dealt);
    duel.log.push('Lượt ' + duel.round + ': Ngươi tung ' + def.name + ' — gây ' + hit.dealt + ' sát thương' + (hit.crit ? ' (BẠO KÍCH!)' : '') + '. Tâm ma còn ' + duel.m.hp + '/' + duel.m.hpMax + ' máu.');

    if (duel.m.hp <= 0) {
      duel.over = true;
      duel.won = true;
      duel.log.push('Tâm ma tan biến! Tâm cảnh trong suốt — giờ đã có thể chịu độ kiếp kết đan.');
      finishDuel(player, duel);
      return { ok: true, duel: duel, won: true };
    }

    tickCooldowns(duel.m);
    var mDef = mirrorPickSkill(player, duel);
    if (mDef) {
      var mCost = (mDef.cost && mDef.cost.amount) || 0;
      duel.m.mp -= mCost;
      duel.m.cds[mDef.id] = cdRoundsOf(mDef);
      var mHit = strikeDamage(duel, duel.m, duel.p, mDef, true);
      duel.p.hp = Math.max(0, duel.p.hp - mHit.dealt);
      duel.log.push('Tâm ma đáp ' + mDef.name + ' — ngươi chịu ' + mHit.dealt + ' sát thương' + (mHit.crit ? ' (BẠO KÍCH!)' : '') + '. Ngươi còn ' + duel.p.hp + '/' + duel.p.hpMax + ' máu.');
      if (duel.p.hp <= 0) {
        duel.over = true;
        duel.won = false;
        duel.log.push('Ngươi gục trong tâm cảnh... Tâm ma chưa thắng thì kiếp chưa qua. Không mất gì cả — dưỡng sức rồi đấu lại.');
        finishDuel(player, duel);
        return { ok: true, duel: duel, won: false };
      }
    } else {
      duel.log.push('Tâm ma chững lại, không tung được chiêu nào lượt này.');
    }

    regenTick(duel);
    duel.round++;
    return { ok: true, duel: duel };
  }

  // =========================================================================
  // BẢNG ĐỘT PHÁ KIM ĐAN (DOM — khuôn dotpha.js/tieumoc.js)
  // =========================================================================
  var playerRef = null;
  var modalEl = null;
  var bodyEl = null;
  var wired = false;
  var activeDuel = null;
  var lastDuel = null; // bản ghi trận THUA gần nhất — CHỈ để hiển thị tóm tắt,
  // không còn là trạng thái "đang đấu" (xem điểm chuẩn hóa trong renderPanel)

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (typeof text === 'string') e.textContent = text;
    return e;
  }

  function getPlayer() {
    if (playerRef) return playerRef;
    var eng = getEngineAPI();
    if (eng && typeof eng.getPlayer === 'function') return eng.getPlayer();
    return null;
  }

  function setIcon(elm, itemId) {
    var def = getItemDef(itemId);
    if (!elm || !def) return false;
    var cellPx = 40;
    var scale = cellPx / 32;
    elm.style.backgroundImage = "url('assets/art/icons-sheet.png')";
    elm.style.backgroundSize = (192 * scale) + 'px ' + (256 * scale) + 'px';
    elm.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    elm.style.backgroundRepeat = 'no-repeat';
    elm.style.width = cellPx + 'px';
    elm.style.height = cellPx + 'px';
    return true;
  }

  function guideButton(label, onTap) {
    var b = el('button', 'tieumoc-btn-guide', label || 'Chỉ đường');
    b.type = 'button';
    b.addEventListener('click', function () { onTap(); });
    return b;
  }

  function startGuide(focusKey) {
    var p = getPlayer();
    if (!p) return;
    setFocus(p, focusKey);
    var st = getStateAPI();
    if (st && typeof st.savePlayer === 'function') st.savePlayer(p);
    closePanel();
    var eng = getEngineAPI();
    if (eng && typeof eng.startQuestGuidance === 'function') {
      eng.startQuestGuidance('main');
    }
    showToast('Đã ghim mục tiêu — đi theo mũi tên dẫn đường trên màn hình.');
  }

  function statusRow(label, valueText, ok, guideFocus) {
    var row = el('div', 'tieumoc-row' + (ok ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
    row.appendChild(el('span', 'tieumoc-row-label', label));
    row.appendChild(el('span', 'tieumoc-row-value', valueText));
    if (!ok && guideFocus) {
      row.appendChild(guideButton('Chỉ đường', function () { startGuide(guideFocus); }));
    }
    return row;
  }

  function barHtml(label, cur, max, cls) {
    var wrap = el('div', 'kimdan-bar-wrap');
    wrap.appendChild(el('div', 'kimdan-bar-label', label + ': ' + Math.max(0, Math.round(cur)) + '/' + Math.round(max)));
    var bar = el('div', 'kimdan-bar ' + cls);
    var fill = el('div', 'kimdan-bar-fill');
    fill.style.width = Math.max(0, Math.min(100, max > 0 ? (cur / max) * 100 : 0)) + '%';
    bar.appendChild(fill);
    wrap.appendChild(bar);
    return wrap;
  }

  function renderDuel(body, p, duel) {
    var box = el('div', 'kimdan-duel');
    box.id = 'kimdan-duel-box';
    box.appendChild(el('h4', 'tieumoc-subtitle', 'CẢNH GIỚI TÂM MA — đấu bản sao của chính mình (máu x' + MIRROR_HP_MULT + ')'));

    var cols = el('div', 'kimdan-duel-cols');
    var pCard = el('div', 'kimdan-duel-card');
    pCard.appendChild(el('div', 'kimdan-duel-name', 'Ngươi — ' + duel.playerName));
    pCard.appendChild(barHtml('Khí huyết', duel.p.hp, duel.p.hpMax, 'hp'));
    pCard.appendChild(barHtml('Linh lực', duel.p.mp, duel.p.mpMax, 'mp'));
    cols.appendChild(pCard);
    var mCard = el('div', 'kimdan-duel-card kimdan-duel-mirror');
    mCard.appendChild(el('div', 'kimdan-duel-name', 'TÂM MA — bản sao của ngươi'));
    mCard.appendChild(barHtml('Khí huyết', duel.m.hp, duel.m.hpMax, 'hp mirror'));
    mCard.appendChild(barHtml('Linh lực', duel.m.mp, duel.m.mpMax, 'mp'));
    cols.appendChild(mCard);
    box.appendChild(cols);

    if (!duel.over) {
      var skills = getDuelSkills(p);
      var sWrap = el('div', 'kimdan-duel-skills');
      skills.forEach(function (def) {
        var cd = duel.p.cds[def.id] || 0;
        var cost = (def.cost && def.cost.amount) || 0;
        var b = el('button', 'btn wood tieumoc-btn kimdan-skill-btn',
          def.name + (cost ? ' (' + cost + ' LL)' : '') + (cd > 0 ? ' — hồi ' + cd : ''));
        b.type = 'button';
        b.disabled = cd > 0 || duel.p.mp < cost;
        b.addEventListener('click', function () {
          var res = duelAct(p, duel, def.id);
          if (!res.ok) showToast(res.msg);
          renderPanel();
        });
        sWrap.appendChild(b);
      });
      box.appendChild(sWrap);
      var btnQuit = el('button', 'btn wood tieumoc-btn', 'Rút Khỏi Tâm Cảnh (không mất gì, đấu lại sau)');
      btnQuit.type = 'button';
      btnQuit.addEventListener('click', function () {
        activeDuel = null;
        renderPanel();
      });
      box.appendChild(btnQuit);
    } else if (duel.won) {
      box.appendChild(el('p', 'tieumoc-note', 'Đã thắng tâm ma! Kiếp vân đang chờ — bấm nút kết đan bên dưới để chịu 5 tia lôi kiếp và kết Kim Đan.'));
      var btnComplete = el('button', 'btn gold tieumoc-btn tieumoc-btn-break', '⚡ CHỊU ĐỘ KIẾP 5 TIA — KẾT ĐAN');
      btnComplete.type = 'button';
      btnComplete.id = 'kimdan-btn-complete';
      btnComplete.addEventListener('click', function () {
        var eng = getEngineAPI();
        if (!eng || typeof eng.tryKimDanBreakthrough !== 'function') return;
        var res = eng.tryKimDanBreakthrough({ tamMaWon: true });
        if (res && res.ok) {
          activeDuel = null;
          lastDuel = null;
          closePanel();
        } else {
          showToast((res && res.msg) || 'Chưa thể kết đan.');
          renderPanel();
        }
      });
      box.appendChild(btnComplete);
    } else {
      box.appendChild(el('p', 'tieumoc-note', 'Thua tâm ma — không mất tu vi, không mất đan. Bấm "Vào Cảnh Giới Tâm Ma" để đấu lại ngay.'));
    }

    var logBox = el('div', 'kimdan-duel-log');
    var lines = duel.log.slice(-8);
    lines.forEach(function (line) {
      logBox.appendChild(el('div', 'kimdan-log-line', line));
    });
    box.appendChild(logBox);
    body.appendChild(box);
  }

  function renderPanel() {
    if (!bodyEl) return;
    var p = getPlayer();
    bodyEl.innerHTML = '';
    if (!p) {
      bodyEl.appendChild(el('p', 'tieumoc-note', 'Chưa có nhân vật.'));
      return;
    }
    ensureState(p);
    // SỬA LỖI (đội kiểm chứng T3 phát hiện): trận kết thúc bằng THUA phải đưa
    // trạng thái về "chưa vào trận" ngay tại đây. Trước kia activeDuel cứ giữ
    // nguyên trận đã thua, mà nút VÀO CẢNH GIỚI TÂM MA chỉ vẽ khi !activeDuel
    // nên nút không bao giờ hiện lại — đóng/mở bảng vẫn kẹt, chỉ tải lại
    // trang mới đấu lại được. Bản ghi trận thua chuyển sang lastDuel để vẫn
    // hiển thị tóm tắt + nhật ký bên dưới; trận THẮNG không đụng (còn treo
    // chờ nút kết đan trong renderDuel).
    if (activeDuel && activeDuel.over && !activeDuel.won) {
      lastDuel = activeDuel;
      activeDuel = null;
    }
    var info = computeStatus(p);

    if (info.isKimDan) {
      bodyEl.appendChild(el('p', 'tieumoc-note',
        'Ngươi đã kết Kim Đan ' + phamName(info.pham) + ' — phẩm đan là thưởng vĩnh viễn: sức chứa linh lực +' +
        Math.max(0, (info.pham - 1) * 5) + '%, tu vi nhận +' + Math.max(0, (info.pham - 1) * 2) +
        '% trên mỗi nguồn. Các mốc trong Kim Đan (lên Trung Kỳ/Hậu Kỳ/Viên Mãn) đột phá qua Bảng Đột Phá Tiểu Mốc như thường lệ.'));
      var btnCloseOnly = el('button', 'btn wood tieumoc-btn', 'Đóng bảng');
      btnCloseOnly.type = 'button';
      btnCloseOnly.addEventListener('click', closePanel);
      bodyEl.appendChild(btnCloseOnly);
      return;
    }

    bodyEl.appendChild(el('p', 'tieumoc-note',
      'Đột phá ĐẠI cảnh giới lên Kim Đan Sơ Kỳ: năm đường đầy trần Trúc Cơ Viên Mãn (2.500), một viên ' + PILL_NAME +
      ', thắng TÂM MA (bản sao của chính mình, máu cao hơn) rồi chịu ĐỘ KIẾP 5 TIA diễn thật. Đủ điều kiện là kết đan thành công — thua tâm ma không mất gì, đấu lại được ngay.'));

    if (info.moc < 13) {
      bodyEl.appendChild(el('p', 'tieumoc-note',
        'Đột phá Kim Đan mở ở mốc Trúc Cơ Viên Mãn với cả 5 đường đầy trần 2.500. Hãy đột phá tiểu mốc dần lên Viên Mãn trước (Bảng Đột Phá Tiểu Mốc, gặp Chấp Sự Đường).'));
    }

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Điều kiện — năm đường đầy trần ' + info.cap));
    info.paths.forEach(function (pr) {
      bodyEl.appendChild(statusRow(
        'Tu vi ' + pr.name,
        pr.have + '/' + pr.cap + (pr.ok ? ' — ĐẦY TRẦN' : ' — còn thiếu ' + (pr.cap - pr.have)),
        pr.ok, null));
    });

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Đan đột phá — ' + PILL_NAME));
    var pillRow = el('div', 'tieumoc-row' + (info.pillOk ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
    var pillIcon = el('span', 'tieumoc-item-icon');
    if (!setIcon(pillIcon, PILL_ID)) pillIcon.textContent = '◆';
    pillRow.appendChild(pillIcon);
    pillRow.appendChild(el('span', 'tieumoc-row-label', PILL_NAME));
    pillRow.appendChild(el('span', 'tieumoc-row-value',
      info.pillHave + '/1' + (info.pillOk ? ' — phẩm đan đang giữ: ' + phamName(info.pillPham) : '')));
    if (!info.pillOk) {
      pillRow.appendChild(guideButton('Chỉ đường', function () { startGuide('pill'); }));
    }
    bodyEl.appendChild(pillRow);
    bodyEl.appendChild(el('p', 'tieumoc-note',
      'Luyện tại Đan Phòng Tông Môn: 5 Nguyên Tinh (Mộc/Thủy/Hỏa/Thổ/Kim, mỗi thứ 1) + 2 Nước Ốc Đảo Tinh Khiết + ' +
      RECIPE_LT_FEE + ' Linh Thạch. PHẨM của viên đan tính theo Hài Hòa tại lúc luyện — hiện tại Hài Hòa ' +
      Math.round(info.preview.hh * 100) + '% sẽ cho phẩm ' + phamName(info.preview.pham) +
      (info.preview.bossBonus ? ' (đã gồm điểm chuẩn bị hạ boss)' : ' (hạ thêm boss vùng để cộng điểm chuẩn bị)') +
      '. Năm đường càng cân bằng, đan càng cao phẩm — và phẩm theo ngươi cả đời.'));

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Nguyên liệu gốc của viên đan (đủ/thiếu từng món)'));
    info.recipe.forEach(function (rr) {
      var row = el('div', 'tieumoc-row' + (rr.have >= rr.need ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
      var ic = el('span', 'tieumoc-item-icon');
      if (!setIcon(ic, rr.itemId)) ic.textContent = '◆';
      row.appendChild(ic);
      row.appendChild(el('span', 'tieumoc-row-label', rr.name));
      row.appendChild(el('span', 'tieumoc-row-value',
        'trong túi ' + rr.have + ' · cần ' + rr.need + (rr.have >= rr.need ? ' — ĐỦ' : ' — thiếu ' + (rr.need - rr.have))));
      if (rr.have < rr.need) {
        (function (focusKey) {
          row.appendChild(guideButton('Chỉ đường', function () { startGuide(focusKey); }));
        })('mat_' + rr.itemId);
      }
      bodyEl.appendChild(row);
      if (rr.source) bodyEl.appendChild(el('p', 'tieumoc-note', 'Nguồn: ' + rr.source));
    });
    bodyEl.appendChild(statusRow('Linh Thạch (phí luyện đan)',
      info.ltHave + '/' + RECIPE_LT_FEE, info.ltHave >= RECIPE_LT_FEE, null));

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Tâm ma & độ kiếp'));
    bodyEl.appendChild(el('p', 'tieumoc-note',
      'Khi đủ mọi điều kiện trên, vào cảnh giới tâm ma đấu bản sao của chính mình (đã thắng ' + info.tamMaWins +
      ' lần, thua ' + info.tamMaFalls + ' lần). Thắng xong mới chịu độ kiếp 5 tia để kết đan.'));

    var actions = el('div', 'tieumoc-actions');
    if (!activeDuel) {
      var btnDuel = el('button', 'btn gold tieumoc-btn tieumoc-btn-break',
        info.ready ? '🔥 VÀO CẢNH GIỚI TÂM MA' : 'Chưa đủ điều kiện kết đan');
      btnDuel.type = 'button';
      btnDuel.id = 'kimdan-btn-duel';
      btnDuel.disabled = !info.ready;
      btnDuel.addEventListener('click', function () {
        lastDuel = null;
        activeDuel = createDuel(p);
        renderPanel();
      });
      actions.appendChild(btnDuel);
    }
    var btnClose = el('button', 'btn wood tieumoc-btn', 'Đóng bảng');
    btnClose.type = 'button';
    btnClose.id = 'kimdan-btn-close';
    btnClose.addEventListener('click', closePanel);
    actions.appendChild(btnClose);
    bodyEl.appendChild(actions);

    if (activeDuel) renderDuel(bodyEl, p, activeDuel);
    else if (lastDuel) renderDuel(bodyEl, p, lastDuel);
  }

  function openPanel() {
    if (!modalEl) return;
    renderPanel();
    modalEl.classList.remove('hidden');
  }

  function closePanel() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
  }

  function isPanelOpen() {
    if (!modalEl) return false;
    return !modalEl.classList.contains('hidden');
  }

  function attach(player) {
    if (player) {
      playerRef = player;
      ensureState(player);
    }
    if (wired) return;
    if (typeof document === 'undefined') return;
    modalEl = document.getElementById('kimdan-modal');
    bodyEl = document.getElementById('kimdan-body');
    if (!modalEl || !bodyEl) return;
    wired = true;
    var closeX = document.getElementById('kimdan-close');
    if (closeX) closeX.addEventListener('click', closePanel);
    modalEl.addEventListener('click', function (ev) {
      if (ev.target === modalEl) closePanel();
    });
    var openBtn = document.getElementById('btn-kimdan-open');
    if (openBtn) openBtn.addEventListener('click', openPanel);
  }

  // Xuất API
  exports.CONFIG = CONFIG;
  exports.PILL_ID = PILL_ID;
  exports.PILL_NAME = PILL_NAME;
  exports.RECIPE = RECIPE;
  exports.RECIPE_LT_FEE = RECIPE_LT_FEE;
  exports.PHAM_NAMES = PHAM_NAMES;
  exports.MIRROR_HP_MULT = MIRROR_HP_MULT;
  exports.ensureState = ensureState;
  exports.phamName = phamName;
  exports.harmonyNow = harmonyNow;
  exports.bossPrepBonus = bossPrepBonus;
  exports.phamFromHarmony = phamFromHarmony;
  exports.previewPham = previewPham;
  exports.refineQuyNguyen = refineQuyNguyen;
  exports.computeStatus = computeStatus;
  exports.getTrackedTargetInfo = getTrackedTargetInfo;
  exports.setFocus = setFocus;
  exports.getDuelSkills = getDuelSkills;
  exports.createDuel = createDuel;
  exports.duelAct = duelAct;
  exports.attach = attach;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;
  exports.isPanelOpen = isPanelOpen;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameKimDan = {}));
