/**
 * thien-tu.js — Đợt P2A: Thiền/thổ nạp thật + linh khí theo đất + kinh mạch (hồ sơ 45)
 *
 * Ba việc đúng phạm vi TASK-P2A:
 *   1. Thiền thật tại điểm Đả Tọa / linh nhãn (engine giữ trạng thái ngồi thiền,
 *      module này giữ toàn bộ SỐ: tốc độ hồi, tốc độ tu, ngưỡng tẩu hỏa).
 *   2. Linh khí theo đất: mỗi map một hệ trội + tier mật độ + linh nhãn ×2.
 *   3. Kinh mạch: 8 mạch mở bằng mốc rank đột phá thật / nhiệm vụ tông môn thật,
 *      mỗi mạch +sức chứa linh lực và +tốc độ hồi (cộng SAU công thức state.js:224).
 *
 * LUẬT SỐ: mọi con số đội đề xuất nằm trong MỘT object P2A_CONST dưới đây, mỗi dòng
 * ghi PROVISIONAL, chờ Bui phán. Không rải số cứng trong logic.
 *
 * Nguồn dữ liệu thật (không bịa):
 *   - Map id: js/mapdata.js ALL_MAPS ('rung-doc', 'ho-bang', 'mo-lua', 'hoang-mac',
 *     'kiem-trung', 'tong-mon').
 *   - Trần tu vi đường + cộng tu vi: state.js addTuViCapped / getMocCap (đợt T1).
 *   - Hạng cảnh giới: state.js getRealmRank.
 *   - Nhiệm vụ tông môn: quests.js QUEST_DEFS type 'sect_intro' (q_main_04_tiepdan,
 *     q_main_06_chapsu) qua quests.isQuestCompleted.
 *   - Đan Thông Mạch: CHƯA có trong ITEM_DEFS (monsters.js) — nợ, không bịa item.
 *
 * Module thuần số học + dữ liệu, không đụng DOM: test Node chạy thẳng.
 */
(function (exports) {
  'use strict';

  // ---------------------------------------------------------------------------
  // BẢNG HẰNG SỐ DUY NHẤT (PROVISIONAL — đội P2A đề xuất, Bui phán sau)
  // ---------------------------------------------------------------------------
  var P2A_CONST = {
    // Tốc độ hồi linh lực khi ngồi thiền = ×4 tốc độ nền ngoài chiến đấu (2,0/s -> 8,0/s)
    MEDITATE_REGEN_MULT: 4,                 // PROVISIONAL — đội đề xuất
    // Tu vi thổ nạp ở đất khớp hệ, tier mật độ thường
    THO_NAP_TUVI_PER_MIN: 6,                // PROVISIONAL — đội đề xuất
    // Hệ số tier mật độ (thưa / thường / dày)
    DENSITY_MULT: { thua: 0.5, thuong: 1.0, day: 1.5 }, // PROVISIONAL — đội đề xuất
    // Hệ số khi ngồi đúng linh nhãn
    LINH_NHAN_MULT: 2,                      // PROVISIONAL — đội đề xuất
    // Số kinh mạch
    MERIDIAN_COUNT: 8,                      // PROVISIONAL — đội đề xuất
    // Mỗi mạch đã thông cộng thêm
    MERIDIAN_LINH_LUC_MAX: 10,              // PROVISIONAL — đội đề xuất
    MERIDIAN_REGEN_PER_SEC: 0.2,            // PROVISIONAL — đội đề xuất
    // Tẩu hỏa: ngồi đất khác hệ ở tier dày quá ngưỡng này (giây kể từ lúc cảnh báo)
    THOA_HOA_WARN_SEC: 60,                  // PROVISIONAL — đội đề xuất
    // Tẩu hỏa mất % tu vi hiện có của đường yếu nhất
    THOA_HOA_LOSS_RATIO: 0.1,               // PROVISIONAL — đội đề xuất
    // Trạng thái mệt sau tẩu hỏa: giảm tốc độ hồi linh lực
    FATIGUE_SEC: 60,                        // PROVISIONAL — đội đề xuất
    FATIGUE_REGEN_MULT: 0.5                 // PROVISIONAL — đội đề xuất
  };

  // ---------------------------------------------------------------------------
  // BẢNG LINH KHÍ CỦA ĐẤT (hồ sơ 45 §3) — khoá theo map id THẬT của mapdata.js
  // Cả 5 vùng đều tier dày theo hồ sơ 45§3 (Bui chốt 08:01 2026-11-15: sửa cả
  // 5 vùng dày theo hồ sơ rồi gộp). Hệ số tier là số PROVISIONAL, chờ Bui phán số.
  // 'tong-mon': map này KHÔNG có trong danh sách 5 vùng của hồ sơ, nhưng điểm
  // Đả Tọa duy nhất của bản live nằm ở đây (mapdata.js INTERACTABLES_TONG_MON
  // interact_meditate 1610,525) nên phải có một dòng để thiền có nghĩa; gán
  // Mộc/thường (núi rừng + vườn linh dược của tông). PROVISIONAL, chờ Bui phán.
  // ---------------------------------------------------------------------------
  var LAND_TABLE = {
    'rung-doc':   { elem: 'moc',  tier: 'day',    name: 'Rừng Độc Thanh Tụy', shortName: 'Rừng Độc' },
    'ho-bang':    { elem: 'thuy', tier: 'day',    name: 'Hồ Băng Hàn Kính',   shortName: 'Hồ Băng' },
    'mo-lua':     { elem: 'hoa',  tier: 'day',    name: 'Mỏ Lửa Xích Diệm',   shortName: 'Mỏ Lửa' },
    'hoang-mac':  { elem: 'tho',  tier: 'day',    name: 'Hoang Mạc Hoàng Sa', shortName: 'Hoang Mạc' },
    'kiem-trung': { elem: 'kim',  tier: 'day',    name: 'Kiếm Trủng Huyền Thiết', shortName: 'Kiếm Trủng' },
    'tong-mon':   { elem: 'moc',  tier: 'thuong', name: 'Tông Môn — Núi Chính', shortName: 'Tông Môn' },
    // Đợt ƯU TIÊN (sửa buff 2026-11-23): Đỉnh Tiên Môn PHẢI có dòng thì thiền
    // trong khu phong mới có tu vi nền để nhân +25% (trước đây landProfile
    // trả null → perMin 0, buff ×1,25 của 0 vẫn là 0). Gán Mộc/thường như
    // Tông Môn (cùng núi tông). PROVISIONAL, chờ Bui phán. Buff +25% chỉ
    // áp trong khu phong của chính mình — engine nhân riêng, không nằm ở đây.
    'dinh-tien-mon': { elem: 'moc', tier: 'thuong', name: 'Đỉnh Tiên Môn', shortName: 'Đỉnh Tiên Môn' }
  };

  var TIER_NAMES = { thua: 'thưa', thuong: 'thường', day: 'dày' };

  var ELEM_NAMES = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  var PATH_KEYS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

  // ---------------------------------------------------------------------------
  // KINH MẠCH (hồ sơ 45 §4) — 8 mạch. Hồ sơ KHÔNG đặt tên từng mạch: tên dưới
  // đây là "Kinh mạch 1..8" (tên tạm, chờ Bui chốt — ghi trong P2A-REPORT.md).
  // Điều kiện mở dùng dữ liệu THẬT đã có: mốc rank đột phá (state.getRealmRank)
  // và 2 nhiệm vụ tông môn đã có trong QUEST_DEFS (type 'sect_intro').
  // Đan Thông Mạch (hồ sơ 17): CHƯA có item trong ITEM_DEFS -> nợ, không móc.
  // ---------------------------------------------------------------------------
  var MERIDIAN_DEFS = [
    { id: 'mach_01', label: 'Kinh mạch 1', cond: { kind: 'rank', rank: 1 }, condText: 'Cảnh giới: Luyện Khí tầng 1' },
    { id: 'mach_02', label: 'Kinh mạch 2', cond: { kind: 'rank', rank: 3 }, condText: 'Cảnh giới: Luyện Khí tầng 3' },
    { id: 'mach_03', label: 'Kinh mạch 3', cond: { kind: 'quest', questId: 'q_main_04_tiepdan' }, condText: 'Nhiệm vụ tông môn: Báo danh ở Lối Vào' },
    { id: 'mach_04', label: 'Kinh mạch 4', cond: { kind: 'rank', rank: 5 }, condText: 'Cảnh giới: Luyện Khí tầng 5' },
    { id: 'mach_05', label: 'Kinh mạch 5', cond: { kind: 'quest', questId: 'q_main_06_chapsu' }, condText: 'Nhiệm vụ tông môn: Nhận lệnh từ Chấp Sự' },
    { id: 'mach_06', label: 'Kinh mạch 6', cond: { kind: 'rank', rank: 7 }, condText: 'Cảnh giới: Luyện Khí tầng 7' },
    { id: 'mach_07', label: 'Kinh mạch 7', cond: { kind: 'rank', rank: 9 }, condText: 'Cảnh giới: Luyện Khí tầng 9' },
    { id: 'mach_08', label: 'Kinh mạch 8', cond: { kind: 'rank', rank: 11 }, condText: 'Cảnh giới: Trúc Cơ Trung Kỳ' }
  ];

  var MERIDIAN_IDS = MERIDIAN_DEFS.map(function (d) { return d.id; });

  // ---------------------------------------------------------------------------
  // Truy cập API ngoài (lười, an toàn cho cả browser và Node)
  // ---------------------------------------------------------------------------
  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    if (typeof require === 'function') { try { return require('./state.js'); } catch (e) {} }
    return null;
  }

  function getQuestsAPI() {
    if (typeof window !== 'undefined' && window.GameQuests) return window.GameQuests;
    if (typeof global !== 'undefined' && global.GameQuests) return global.GameQuests;
    if (typeof require === 'function') { try { return require('./quests.js'); } catch (e) {} }
    return null;
  }

  // ---------------------------------------------------------------------------
  // TRẠNG THÁI LƯU (player.thienTu) — namespace mới duy nhất, save cũ nhận mặc định
  // ---------------------------------------------------------------------------
  function ensureState(player) {
    if (!player) return null;
    if (!player.thienTu || typeof player.thienTu !== 'object') player.thienTu = {};
    var st = player.thienTu;
    if (!Array.isArray(st.meridians)) st.meridians = [];
    // Bỏ id lạ (save hỏng/đợt khác) — chỉ giữ mạch có thật trong bảng
    var kept = [];
    for (var i = 0; i < st.meridians.length; i++) {
      var id = st.meridians[i];
      if (typeof id === 'string' && MERIDIAN_IDS.indexOf(id) !== -1 && kept.indexOf(id) === -1) kept.push(id);
    }
    st.meridians = kept;
    if (typeof st.fatigueUntil !== 'number' || !isFinite(st.fatigueUntil)) st.fatigueUntil = 0;
    if (typeof st.thoaHoaCount !== 'number' || !isFinite(st.thoaHoaCount)) st.thoaHoaCount = 0;
    if (typeof st.tuViThoNap !== 'number' || !isFinite(st.tuViThoNap)) st.tuViThoNap = 0;
    return st;
  }

  // ---------------------------------------------------------------------------
  // LINH KHÍ THEO ĐẤT
  // ---------------------------------------------------------------------------
  function landProfile(mapId) {
    var land = LAND_TABLE[mapId];
    if (!land) return null;
    return {
      mapId: mapId,
      elem: land.elem,
      elemName: ELEM_NAMES[land.elem],
      tier: land.tier,
      tierName: TIER_NAMES[land.tier] || land.tier,
      name: land.name,
      shortName: land.shortName
    };
  }

  /** Hệ của bản thân = đường có tu vi cao nhất (dữ liệu thật, không thêm trường save).
   *  Chưa có đường nào > 0 -> 'moc' (hệ nhân vật mà engine vốn dùng: getElementFactor(...,'moc')). */
  function playerElement(player) {
    var paths = player && player.paths;
    if (!paths) return 'moc';
    var best = null;
    var bestV = -1;
    for (var i = 0; i < PATH_KEYS.length; i++) {
      var k = PATH_KEYS[i];
      var v = (paths[k] && typeof paths[k].tuVi === 'number') ? paths[k].tuVi : 0;
      if (v > bestV) { bestV = v; best = k; }
    }
    if (bestV <= 0) return 'moc';
    // Hoà điểm: ưu tiên 'moc' nếu cùng mức cao nhất (hệ nhân vật mặc định của engine)
    if (paths.moc && typeof paths.moc.tuVi === 'number' && paths.moc.tuVi === bestV) return 'moc';
    return best;
  }

  /**
   * Tốc độ tu hiện tại theo nơi đang đứng — SỐ THẬT (tu vi/phút), 0 nếu đất khác hệ.
   * @returns {{mapId, landName, elem, elemName, tier, tierName, atLinhNhan, mult, matches, perMin}}
   */
  function tuRatePerMin(player, mapId, atLinhNhan) {
    var land = landProfile(mapId);
    if (!land) {
      return {
        mapId: mapId || null, landName: null, elem: null, elemName: null,
        tier: null, tierName: null, atLinhNhan: false, mult: 0, matches: false, perMin: 0
      };
    }
    var tierMult = P2A_CONST.DENSITY_MULT[land.tier];
    if (typeof tierMult !== 'number') tierMult = 1.0;
    var mult = tierMult * (atLinhNhan ? P2A_CONST.LINH_NHAN_MULT : 1);
    var matches = playerElement(player) === land.elem;
    var perMin = matches ? P2A_CONST.THO_NAP_TUVI_PER_MIN * mult : 0;
    return {
      mapId: mapId, landName: land.name, elem: land.elem, elemName: land.elemName,
      tier: land.tier, tierName: land.tierName, atLinhNhan: !!atLinhNhan,
      mult: mult, matches: matches, perMin: perMin
    };
  }

  /** Tẩu hỏa có nguy cơ không: ngồi thiền ở đất khác hệ của bản thân và tier dày. */
  function thoaHoaRisk(player, mapId) {
    var land = landProfile(mapId);
    if (!land) return false;
    return land.tier === 'day' && playerElement(player) !== land.elem;
  }

  // ---------------------------------------------------------------------------
  // HỒI LINH LỰC + SỨC CHỨA (kinh mạch)
  // ---------------------------------------------------------------------------
  function meridianCount(player) {
    var st = ensureState(player);
    return st ? st.meridians.length : 0;
  }

  /** Cộng vào linhLucMax SAU công thức gốc state.js:224 — không sửa công thức. */
  function meridianLinhLucBonus(player) {
    return meridianCount(player) * P2A_CONST.MERIDIAN_LINH_LUC_MAX;
  }

  /** Cộng vào tốc độ hồi linh lực (mỗi giây) theo số mạch đã thông. */
  function meridianRegenPerSec(player) {
    return meridianCount(player) * P2A_CONST.MERIDIAN_REGEN_PER_SEC;
  }

  function isFatigued(player, nowMs) {
    var st = ensureState(player);
    if (!st) return false;
    var now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
    return st.fatigueUntil > now;
  }

  /** Hệ số giảm tốc hồi khi đang mệt sau tẩu hỏa (1 = bình thường). */
  function regenFatigueMultiplier(player, nowMs) {
    return isFatigued(player, nowMs) ? P2A_CONST.FATIGUE_REGEN_MULT : 1;
  }

  // ---------------------------------------------------------------------------
  // KINH MẠCH — điều kiện mở + mở tự động
  // ---------------------------------------------------------------------------
  function questDone(player, questId) {
    var qs = getQuestsAPI();
    if (qs && qs.isQuestCompleted) {
      // isQuestCompleted tự gọi ensureQuestState (migrate save cũ) — không gọi lặp
      try { return !!qs.isQuestCompleted(player, questId); } catch (e) { /* rơi xuống đọc thô */ }
    }
    var st = player && player.questState;
    return !!(st && st.completed && st.completed[questId]);
  }

  function meridianConditionMet(player, def) {
    if (!def || !def.cond) return false;
    if (def.cond.kind === 'rank') {
      var st = getStateAPI();
      var rank = (st && st.getRealmRank) ? st.getRealmRank(player) : 0;
      return rank >= def.cond.rank;
    }
    if (def.cond.kind === 'quest') return questDone(player, def.cond.questId);
    return false;
  }

  /** Mở các mạch đã đủ điều kiện. Trả danh sách mạch VỪA mở (để engine báo). */
  function checkMeridians(player) {
    var st = ensureState(player);
    if (!st) return [];
    var opened = [];
    for (var i = 0; i < MERIDIAN_DEFS.length; i++) {
      var def = MERIDIAN_DEFS[i];
      if (st.meridians.indexOf(def.id) !== -1) continue;
      if (meridianConditionMet(player, def)) {
        st.meridians.push(def.id);
        opened.push(def);
      }
    }
    return opened;
  }

  /** Danh sách mạch cho UI: đã thông hay chưa + điều kiện chữ thật. */
  function meridianList(player) {
    var st = ensureState(player);
    var out = [];
    for (var i = 0; i < MERIDIAN_DEFS.length; i++) {
      var def = MERIDIAN_DEFS[i];
      out.push({
        id: def.id,
        label: def.label,
        condText: def.condText,
        open: !!(st && st.meridians.indexOf(def.id) !== -1)
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // THỔ NẠP -> TU VI (đường cộng riêng: KHÔNG chịu bể ngày 65, vẫn chịu trần mốc T1)
  // Dùng nguyên addTuViCapped (đã kẹp trần mốc + gọi quests.onTuViChanged); không
  // sửa hành vi của nó cho nguồn farm hiện có.
  // ---------------------------------------------------------------------------
  function grantThoNap(player, elem, amount) {
    if (!player || !elem || !(amount > 0)) return 0;
    var st = getStateAPI();
    if (!st || !st.addTuViCapped) return 0;
    var added = st.addTuViCapped(player, elem, amount);
    if (added > 0) {
      var s = ensureState(player);
      if (s) s.tuViThoNap += added;
      if (st.syncRealmLabel) st.syncRealmLabel(player);
    }
    return added;
  }

  /** Mốc tu vi ĐẦU cảnh giới hiện tại (sàn của tẩu hỏa theo hồ sơ 45 §7). */
  function realmFloorTuVi(player) {
    var st = getStateAPI();
    var rank = (st && st.getRealmRank) ? st.getRealmRank(player) : 0;
    if (rank <= 0) return 0;
    if (rank <= 9) return (rank - 1) * 100;   // Luyện Khí tầng m: mốc đầu = (m-1)*100
    if (rank <= 13) return 900;               // Trúc Cơ: mốc đầu 900
    if (rank <= 17) return 2500;              // Kim Đan: mốc đầu 2500
    if (rank <= 21) return 7300;              // Nguyên Anh: mốc đầu 7300
    return 21700;                             // Hóa Thần: mốc đầu 21700
  }

  /** Đường yếu nhất hiện tại (path key + tu vi). */
  function weakestPath(player) {
    var paths = player && player.paths;
    if (!paths) return { elem: 'moc', tuVi: 0 };
    var best = PATH_KEYS[0];
    var bestV = Infinity;
    for (var i = 0; i < PATH_KEYS.length; i++) {
      var k = PATH_KEYS[i];
      var v = (paths[k] && typeof paths[k].tuVi === 'number') ? paths[k].tuVi : 0;
      if (v < bestV) { bestV = v; best = k; }
    }
    return { elem: best, tuVi: isFinite(bestV) ? bestV : 0 };
  }

  /**
   * Tẩu hỏa (chỉ nhánh đất khác hệ — nhánh đan độc BỊ CHẶN, xem báo cáo):
   * mất THOA_HOA_LOSS_RATIO tu vi của đường yếu nhất, KHÔNG tụt dưới mốc đầu
   * cảnh giới hiện tại; cộng trạng thái mệt FATIGUE_SEC giây.
   */
  function applyThoaHoa(player, nowMs) {
    var st = ensureState(player);
    if (!st) return { ok: false };
    var now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
    var weak = weakestPath(player);
    var floor = realmFloorTuVi(player);
    var cur = weak.tuVi;
    var loss = Math.floor(cur * P2A_CONST.THOA_HOA_LOSS_RATIO);
    if (cur - loss < floor) loss = Math.max(0, Math.floor(cur - floor));
    if (loss > 0) {
      player.paths[weak.elem].tuVi = cur - loss;
      var sapi = getStateAPI();
      if (sapi && sapi.syncRealmLabel) sapi.syncRealmLabel(player);
    }
    st.fatigueUntil = Math.max(st.fatigueUntil || 0, now + P2A_CONST.FATIGUE_SEC * 1000);
    st.thoaHoaCount += 1;
    return {
      ok: true,
      elem: weak.elem,
      elemName: ELEM_NAMES[weak.elem],
      lost: loss,
      from: cur,
      to: cur - loss,
      floor: floor,
      fatigueSec: P2A_CONST.FATIGUE_SEC
    };
  }

  // ---------------------------------------------------------------------------
  // NGUỒN TU VI TỪNG ĐƯỜNG (chữ đúng dữ liệu thật của bản live)
  //   - hạ quái: engine.js handleMonsterDeath cộng tu vi vào đường theo hệ của quái,
  //     chịu bể ngày 65 + trần mốc.
  //   - linh điền: linhdien.js thu hoạch +5 Mộc (linhdien.js:796); pháp quyết
  //     Thôi Sinh (+3×cấp Mộc), Trừ Uế (+2×cấp Mộc), Linh Vũ (+2×cấp Thủy)
  //     cộng tu vi khi thi triển (linhdien.js:1157-1158, tong-mon-farm.js:890-892;
  //     chuẩn SPELLS: tuViElem/tuViAmount × cấp, Dẫn Linh không cho tu vi).
  //   - đan tu vi: engine.js useItem (dan-kim/moc/thuy/hoa/tho) +20 tu vi.
  //   - thổ nạp: đợt P2A (module này).
  // ---------------------------------------------------------------------------
  var PATH_SOURCE_TEXT = {
    kim: 'Hạ quái hệ Kim (chịu bể ngày 65) · Đan Kim (Kim Linh Đan) · Thổ nạp tại đất Kim (Kiếm Trủng)',
    moc: 'Hạ quái hệ Mộc (chịu bể ngày 65) · Thu hoạch Linh Điền +5 · Thôi Sinh Quyết (+3×cấp) / Trừ Uế Quyết (+2×cấp) · Đan Mộc · Thổ nạp tại đất Mộc (Rừng Độc, Tông Môn, Đỉnh Tiên Môn — thiền trong khu phong của mình +25%, số tạm)',
    thuy: 'Hạ quái hệ Thủy (chịu bể ngày 65) · Linh Vũ Quyết (+2×cấp) · Đan Thủy · Thổ nạp tại đất Thủy (Hồ Băng)',
    hoa: 'Hạ quái hệ Hỏa (chịu bể ngày 65) · Đan Hỏa · Thổ nạp tại đất Hỏa (Mỏ Lửa)',
    tho: 'Hạ quái hệ Thổ (chịu bể ngày 65) · Đan Thổ · Thổ nạp tại đất Thổ (Hoang Mạc)'
  };

  // ---------------------------------------------------------------------------
  exports.P2A_CONST = P2A_CONST;
  exports.LAND_TABLE = LAND_TABLE;
  exports.MERIDIAN_DEFS = MERIDIAN_DEFS;
  exports.PATH_SOURCE_TEXT = PATH_SOURCE_TEXT;
  exports.ELEM_NAMES = ELEM_NAMES;
  exports.ensureState = ensureState;
  exports.landProfile = landProfile;
  exports.playerElement = playerElement;
  exports.tuRatePerMin = tuRatePerMin;
  exports.thoaHoaRisk = thoaHoaRisk;
  exports.meridianCount = meridianCount;
  exports.meridianLinhLucBonus = meridianLinhLucBonus;
  exports.meridianRegenPerSec = meridianRegenPerSec;
  exports.isFatigued = isFatigued;
  exports.regenFatigueMultiplier = regenFatigueMultiplier;
  exports.checkMeridians = checkMeridians;
  exports.meridianList = meridianList;
  exports.meridianConditionMet = meridianConditionMet;
  exports.grantThoNap = grantThoNap;
  exports.realmFloorTuVi = realmFloorTuVi;
  exports.weakestPath = weakestPath;
  exports.applyThoaHoa = applyThoaHoa;
})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameThienTu = {}));
