/**
 * dan-ban.js — Đợt DANBOARD: logic thuần của VÁN LUYỆN ĐAN 4 bước.
 *
 * Bám DANBOARD-DESIGN.md. Module này KHÔNG chạm DOM: mọi hàm đều test được
 * bằng Node. Giao diện trong danphong.js gọi các hàm này rồi đưa plan vào
 * GameLuyenDan.refineBatch (nguồn sự thật duy nhất của điểm/phẩm).
 *
 * 4 bước ván -> đầu vào refineBatch:
 *   1. Xếp dược liệu  -> materials (thứ tự người chơi xếp)
 *   2. Chọn lửa       -> fireElement
 *   3. Khống hỏa      -> heatScore (ánh xạ từ 3 mức lửa, PROVISIONAL)
 *   4. Phong đan      -> sealTiming (ánh xạ từ vị trí vạch quét, PROVISIONAL)
 *
 * Node-loadable & trình duyệt (khuôn mẫu linhdien.js).
 */
(function (exports) {
  'use strict';

  var BOARD_FURNACE_ID = 'dan-phong';
  var BOARD_PILL_IDS = ['dan-moc', 'dan-thuy', 'dan-hoa', 'dan-tho', 'dan-kim',
    'thanh-doc-dan', 'tu-khi-tan', 'ngung-khi-dan'];

  var ELEM_ORDER = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
  var ELEM_NAMES = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };

  // PROVISIONAL (DANBOARD-DESIGN.md mục 7): thang 3 mức lửa khớp thang hiệu
  // ứng + tiếng lửa 3 mức.
  var HEAT_LEVELS = [
    { level: 1, name: 'Lửa Nhỏ', hint: 'lửa nhỏ liu riu' },
    { level: 2, name: 'Lửa Vừa', hint: 'lửa vừa' },
    { level: 3, name: 'Lửa Mạnh', hint: 'lửa mạnh' }
  ];
  var HEAT_IDEAL_LOW = 0.45;
  var HEAT_IDEAL_HIGH = 0.60;

  // PROVISIONAL: vùng vàng phong đan + chu kỳ quét của vạch.
  var SEAL_ZONE_HALF = 0.15;
  var SEAL_FLOOR = 0.1;
  var SEAL_PERIOD_MS = 1600;

  function getLuyenDanAPI() {
    if (typeof window !== 'undefined' && window.GameLuyenDan) return window.GameLuyenDan;
    if (typeof global !== 'undefined' && global.GameLuyenDan) return global.GameLuyenDan;
    try { return require('./luyendan.js'); } catch (e) { return null; }
  }
  function getTuiKhoAPI() {
    if (typeof window !== 'undefined' && window.GameTuiKho) return window.GameTuiKho;
    if (typeof global !== 'undefined' && global.GameTuiKho) return global.GameTuiKho;
    try { return require('./tui-kho.js'); } catch (e) { return null; }
  }
  function getHerbQualityAPI() {
    if (typeof window !== 'undefined' && window.GameHerbQuality) return window.GameHerbQuality;
    if (typeof global !== 'undefined' && global.GameHerbQuality) return global.GameHerbQuality;
    try { return require('./herb-quality.js'); } catch (e) { return null; }
  }
  function normalizeQuality(v) {
    var hq = getHerbQualityAPI();
    if (hq && hq.normalizeQuality) return hq.normalizeQuality(v);
    v = Number(v);
    if (!isFinite(v)) return 1;
    return Math.max(0, Math.min(3, Math.floor(v)));
  }

  // ---------------- Bước 3: mức lửa ----------------
  function idealHeatLevel(recipe) {
    var d = (recipe && typeof recipe.heatDifficulty === 'number') ? recipe.heatDifficulty : 0.5;
    if (d < HEAT_IDEAL_LOW) return 1;
    if (d < HEAT_IDEAL_HIGH) return 2;
    return 3;
  }
  function heatScoreForLevel(level, recipe) {
    var ideal = idealHeatLevel(recipe);
    var diff = Math.abs((level || 2) - ideal);
    if (diff === 0) return 1.0;
    if (diff === 1) return 0.6;
    return 0.3;
  }
  function heatHintForRecipe(recipe) {
    var ideal = idealHeatLevel(recipe);
    return HEAT_LEVELS[ideal - 1].hint;
  }

  // ---------------- Bước 4: phong đan ----------------
  // Vị trí vạch quét [0,1] theo sóng tam giác: 0 -> 1 -> 0 trong một chu kỳ.
  function markerPositionAt(elapsedMs, periodMs) {
    var period = periodMs || SEAL_PERIOD_MS;
    if (!(period > 0)) period = SEAL_PERIOD_MS;
    var t = ((elapsedMs % period) + period) % period / period; // [0,1)
    if (t < 0.5) return t * 2;
    return 2 - t * 2;
  }
  function sealTimingFromPosition(pos) {
    var p = Math.max(0, Math.min(1, Number(pos) || 0));
    var d = Math.abs(p - 0.5);
    if (d <= SEAL_ZONE_HALF) return 1 - (d / SEAL_ZONE_HALF) * 0.2;
    var rest = (d - SEAL_ZONE_HALF) / (0.5 - SEAL_ZONE_HALF); // [0,1]
    return Math.max(SEAL_FLOOR, 0.8 - rest * 0.7);
  }

  // ---------------- Nhìn trước phẩm chất ----------------
  // Đi theo ĐÚNG thứ tự trừ đồ của tui-kho.removeItemFromPlayer: vật chứa
  // mang theo theo thứ tự rootSlots, ô theo thứ tự. Mỗi đơn vị nguyên liệu
  // trong `materials` (thứ tự công thức — đúng thứ tự refineBatch trừ) nhận
  // phẩm chất của ô sẽ bị trừ. Ô không có phẩm chất tính là 1 (Trung) theo
  // chuẩn hóa HERBQ. Vắng túi thật (test stub) thì toàn 1.
  function peekMaterialQualities(player, materials) {
    var mats = Array.isArray(materials) ? materials : [];
    var fallback = mats.map(function () { return 1; });
    if (!player || mats.length === 0) return fallback;

    var containers = null;
    var tk = getTuiKhoAPI();
    if (tk && typeof tk.getCarriedContainers === 'function') {
      try { containers = tk.getCarriedContainers(player); } catch (e) { containers = null; }
    }
    if (!Array.isArray(containers) || containers.length === 0) {
      // Dự phòng: đi trực tiếp player.tuiKho theo thứ tự rootSlots.
      try {
        var st = player.tuiKho;
        if (st && Array.isArray(st.rootSlots) && st.containers) {
          containers = [];
          for (var i = 0; i < st.rootSlots.length; i++) {
            var sl = st.rootSlots[i];
            if (sl && sl.containerId && st.containers[sl.containerId]) containers.push(st.containers[sl.containerId]);
          }
        }
      } catch (e2) { containers = null; }
    }
    if (!Array.isArray(containers) || containers.length === 0) return fallback;

    // Sao chép số lượng từng ô để mô phỏng thứ tự trừ mà không đụng túi thật.
    var sim = [];
    for (var c = 0; c < containers.length; c++) {
      var cont = containers[c];
      if (!cont || !Array.isArray(cont.slots)) continue;
      for (var s = 0; s < cont.slots.length; s++) {
        var slot = cont.slots[s];
        if (!slot || slot.containerId) continue; // bỏ qua vật chứa lồng nhau
        sim.push({ itemId: slot.itemId, count: slot.count || 1, quality: slot.herbQuality });
      }
    }

    var out = [];
    for (var m = 0; m < mats.length; m++) {
      var want = mats[m];
      var found = false;
      for (var k = 0; k < sim.length; k++) {
        if (sim[k].itemId === want && sim[k].count > 0) {
          sim[k].count -= 1;
          out.push(normalizeQuality(sim[k].quality));
          found = true;
          break;
        }
      }
      if (!found) out.push(1);
    }
    return out;
  }

  function qualityLabelFor(values) {
    var hq = getHerbQualityAPI();
    if (!hq || !hq.weightedAverage || !hq.getQualityLabel) return '';
    if (!Array.isArray(values) || values.length === 0) return '';
    return hq.getQualityLabel(hq.weightedAverage(values));
  }

  // ---------------- Danh sách công thức trên ván ----------------
  function boardRecipeList() {
    var ld = getLuyenDanAPI();
    var list = [];
    for (var i = 0; i < BOARD_PILL_IDS.length; i++) {
      var pillId = BOARD_PILL_IDS[i];
      var r = ld && ld.getPillRecipe ? ld.getPillRecipe(pillId) : null;
      if (!r) continue;
      list.push({
        pillId: r.id, name: r.name, elem: r.elem, tier: r.tier,
        minRank: r.minRank || 0, minRealmRank: r.minRealmRank || 0,
        minFurnace: r.minFurnace || 0,
        materials: r.materials.slice(), heatDifficulty: r.heatDifficulty,
        danVanMax: r.danVanMax || 1
      });
    }
    return list;
  }

  // ---------------- Ghép plan cho refineBatch ----------------
  // input: { pillId, materials (thứ tự người chơi xếp), fireElement,
  //          heatLevel, sealPosition, nowMs }
  // Trả plan đầy đủ + các giá trị đã ánh xạ để giao diện hiển thị lại.
  function buildBoardPlan(player, input) {
    input = input || {};
    var ld = getLuyenDanAPI();
    var recipe = ld && ld.getPillRecipe ? ld.getPillRecipe(input.pillId) : null;
    var heatScore = heatScoreForLevel(input.heatLevel, recipe);
    var sealTiming = sealTimingFromPosition(input.sealPosition);
    var recipeMats = recipe ? recipe.materials.slice() : (input.materials || []).slice();
    var materialQualities = peekMaterialQualities(player, recipeMats);
    return {
      plan: {
        furnaceId: BOARD_FURNACE_ID,
        pillId: input.pillId,
        materials: (input.materials || []).slice(),
        fireElement: input.fireElement || (recipe ? recipe.elem : 'moc'),
        heatScore: heatScore,
        sealTiming: sealTiming,
        heatLevel: (typeof input.heatLevel === 'number') ? input.heatLevel : null,
        materialQualities: materialQualities,
        nowMs: input.nowMs
      },
      heatScore: heatScore,
      sealTiming: sealTiming,
      materialQualities: materialQualities,
      recipe: recipe
    };
  }

  exports.BOARD_FURNACE_ID = BOARD_FURNACE_ID;
  exports.BOARD_PILL_IDS = BOARD_PILL_IDS;
  exports.ELEM_ORDER = ELEM_ORDER;
  exports.ELEM_NAMES = ELEM_NAMES;
  exports.HEAT_LEVELS = HEAT_LEVELS;
  exports.SEAL_ZONE_HALF = SEAL_ZONE_HALF;
  exports.SEAL_FLOOR = SEAL_FLOOR;
  exports.SEAL_PERIOD_MS = SEAL_PERIOD_MS;
  exports.idealHeatLevel = idealHeatLevel;
  exports.heatScoreForLevel = heatScoreForLevel;
  exports.heatHintForRecipe = heatHintForRecipe;
  exports.markerPositionAt = markerPositionAt;
  exports.sealTimingFromPosition = sealTimingFromPosition;
  exports.peekMaterialQualities = peekMaterialQualities;
  exports.qualityLabelFor = qualityLabelFor;
  exports.boardRecipeList = boardRecipeList;
  exports.buildBoardPlan = buildBoardPlan;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameDanBan = {}));
