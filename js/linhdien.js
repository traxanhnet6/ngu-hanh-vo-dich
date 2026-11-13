/**
 * linhdien.js — Hệ thống Linh Điền trồng linh dược (Hồ sơ 12, Điều 400–420 & Brief Đợt D1)
 * Quản lý thửa đất trồng dược sau Miếu Hoang, thời gian thực, lưu vào player.linhDien.
 * Node-loadable & chạy trên trình duyệt.
 */

(function (exports) {
  'use strict';

  // ---------------------------------------------------------------------------
  // HẰNG SỐ & DỮ LIỆU (PROVISIONAL đánh dấu số đội soạn — xem D1-REPORT.md)
  // ---------------------------------------------------------------------------
  var MAX_PLOTS = 12;            // số ô tối đa (PROVISIONAL)
  var TOTAL_PLOTS = MAX_PLOTS;   // tương thích mã cũ (vòng lặp UI)
  var INITIAL_PLOTS = 6;         // số ô mở đầu (brief: bắt đầu 6 ô)
  var WITHER_GRACE_SEC = 300;    // PROVISIONAL: thời hạn héo quá hạn
  var lastCastResult = null;     // Móc lưu vết lần thi triển/thị phạm gần nhất cho VFX đợt sau

  // Vòng tương sinh/khắc (khớp combat.js & skills.js)
  var SINH_MAP = { kim: 'thuy', thuy: 'moc', moc: 'hoa', hoa: 'tho', tho: 'kim' };
  var KHAC_MAP = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' };

  // Cấp đất: Phàm Thổ → Linh Thổ → Ngọc Thổ → Tiên Thổ
  var SOIL_LEVELS = [
    { id: 'pham-tho', name: 'Phàm Thổ', level: 0, minRealmRank: 0, upgradeCostLT: 0, materials: [], maxTier: 1 },
    { id: 'linh-tho', name: 'Linh Thổ', level: 1, minRealmRank: 4, upgradeCostLT: 100, materials: [{ itemId: 'dia-tam-thach-vun', count: 2 }, { itemId: 'bang-tuy', count: 1 }], maxTier: 2 }, // PROVISIONAL
    { id: 'ngoc-tho', name: 'Ngọc Thổ', level: 2, minRealmRank: 10, upgradeCostLT: 300, materials: [{ itemId: 'dia-tam-thach-vun', count: 4 }, { itemId: 'nuoc-oc-dao-tinh-khiet', count: 2 }], maxTier: 3 }, // PROVISIONAL
    { id: 'tien-tho', name: 'Tiên Thổ', level: 3, minRealmRank: 14, upgradeCostLT: 800, materials: [{ itemId: 'dia-tam-thach-vun', count: 6 }, { itemId: 'nuoc-oc-dao-tinh-khiet', count: 4 }, { itemId: 'tuyet-lien', count: 2 }], maxTier: 4 } // PROVISIONAL
  ];

  // Bảng dữ liệu dược trồng được
  var PLANTABLE = {
    'la-thanh-tuy': {
      itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', growSec: 300, yieldCount: 2, seedCost: 1,
      element: 'moc', tier: 1, minSoilLevel: 0, skillIntervalSec: 90, // PROVISIONAL
      desc: 'Linh diệp phát sáng linh quang, dược liệu nhập môn ngũ hành.'
    },
    'linh-chi-rung': {
      itemId: 'linh-chi-rung', name: 'Linh Chi Rừng', growSec: 600, yieldCount: 2, seedCost: 1,
      element: 'moc', tier: 2, minSoilLevel: 1, skillIntervalSec: 180, // PROVISIONAL
      desc: 'Linh chi tụ linh mộc khí, nguyên liệu luyện đan quý giá.'
    }
  };

  // Bốn pháp quyết linh điền
  var SPELLS = {
    'linh-vu': {
      id: 'linh-vu', name: 'Linh Vũ Quyết', element: 'thuy', path: 'thuy',
      baseCost: 8, baseCooldownSec: 30, tuViElem: 'thuy', tuViAmount: 2, // PROVISIONAL
      desc: 'Gọi mưa linh tưới cả thửa — thay việc tưới tay, cấp cao tưới nhiều ô cùng lúc. Cho tu vi đường Thủy.'
    },
    'thoi-sinh': {
      id: 'thoi-sinh', name: 'Thôi Sinh Quyết', element: 'moc', path: 'moc',
      baseCost: 12, baseCooldownSec: 20, tuViElem: 'moc', tuViAmount: 3, // PROVISIONAL
      desc: 'Thúc cây lớn nhanh một nhịp — tốn linh lực nhiều. Cho tu vi đường Mộc.'
    },
    'dan-linh': {
      id: 'dan-linh', name: 'Dẫn Linh Quyết', element: null, path: null,
      baseCost: 6, baseCooldownSec: 40, tuViElem: null, tuViAmount: 0, // PROVISIONAL
      desc: 'Dẫn linh khí vào đất, giữ độ phì của thửa và hồi linh khí cho đất sau mỗi vụ.'
    },
    'tru-ue': {
      id: 'tru-ue', name: 'Trừ Uế Quyết', element: 'moc', path: 'moc',
      baseCost: 6, baseCooldownSec: 25, tuViElem: 'moc', tuViAmount: 2, // PROVISIONAL
      desc: 'Xua uế bệnh, sâu linh và cỏ dại mà không phải làm tay từng ô.'
    }
  };

  // ---------------------------------------------------------------------------
  // ĐỢT PLOTFIELD (Bui 16:10 2026-11-13): ruộng Linh Điền 12 ô TRÊN MAP Miếu
  // Hoang (map id 'mieu_hoang'). Hình học đã khảo sát thật trên nền map +
  // va chạm (xem PLOTFIELD-DESIGN.md §1): đồng cỏ đông-nam, 4 cột × 3 hàng,
  // gốc (1260,940), bước 90×80. Id ô = chỉ số player.linhDien.plots.
  // ---------------------------------------------------------------------------
  var FIELD_MAP_ID = 'mieu_hoang';
  var FIELD_PLOTS_CONFIG = (function () {
    var cfgs = [];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 4; c++) {
        cfgs.push({ id: r * 4 + c, row: r, col: c, x: 1260 + c * 90, y: 940 + r * 80, radius: 32 });
      }
    }
    return cfgs;
  })();
  var FIELD_CENTER = { x: 1395, y: 1020 };
  var FIELD_SKILL_RADIUS = 260; // hiện thanh kỹ năng khi cách tâm ruộng ≤ bán kính này
  var FIELD_SIGN = { x: 1210, y: 890 }; // bia đá "Linh Điền" vẽ bằng mã

  function getFieldPlotsConfig() { return FIELD_PLOTS_CONFIG; }
  function getFieldCenter() { return FIELD_CENTER; }

  var livePlayer = null;
  var refreshTimer = null;
  var selectedPlotIndex = null;

  // ---------------------------------------------------------------------------
  // GIAI ĐOẠN 2 (PLOTFIX): thẻ ô vẽ theo luống ngoài map Tông Môn.
  // Hình cây dùng bộ HERB-REDRAW đã được Bui duyệt (2 giống x 3 giai đoạn x
  // 4 trạng thái, 8 khung/giai đoạn @8fps, khung 140x112, chân y=108).
  // Nền luống cắt từ nền V7 map Tông Môn (assets/art/herb-redraw/bed-soil.png).
  // Trạng thái hiển thị khi dính nhiều uế cùng lúc: bệnh > sâu > cỏ (tag chữ
  // vẫn hiện đủ cả ba; chỉ hình vẽ lấy một trạng thái ưu tiên).
  // ---------------------------------------------------------------------------
  var HERB_REDRAW_SET = { 'la-thanh-tuy': 'thanhtuy', 'linh-chi-rung': 'linhchi' };
  var HERB_REDRAW_STAGES = ['seed', 'young', 'mature'];
  var HERB_REDRAW_STATES = ['clean', 'weed', 'bug', 'disease'];
  var herbFrameTimer = null;
  var herbFrameIndex = 0;
  var herbFramesPreloaded = false;

  function herbRedrawState(view) {
    if (view.disease) return 'disease';
    if (view.pest) return 'bug';
    if (view.weed) return 'weed';
    return 'clean';
  }

  function herbRedrawSrc(itemId, stage, state, frame) {
    var set = HERB_REDRAW_SET[itemId] || 'thanhtuy';
    var st = HERB_REDRAW_STAGES[stage] || 'seed';
    return 'assets/art/herb-redraw/' + set + '-' + st + '-' + state + '-f0' + frame + '.png';
  }

  function herbReadySrc(itemId) {
    return 'assets/art/herb-redraw/' + (HERB_REDRAW_SET[itemId] || 'thanhtuy') + '-ready.png';
  }

  // Nạp trước toàn bộ khung một lần khi mở modal lần đầu để vòng 8fps không
  // chớp khung (192 khung + 2 hình chín, ~2,7 MB, trình duyệt tự cache).
  function preloadHerbFrames() {
    if (herbFramesPreloaded) return;
    herbFramesPreloaded = true;
    if (typeof Image === 'undefined') return;
    var sets = ['thanhtuy', 'linhchi'];
    for (var a = 0; a < sets.length; a++) {
      for (var b = 0; b < HERB_REDRAW_STAGES.length; b++) {
        for (var c = 0; c < HERB_REDRAW_STATES.length; c++) {
          for (var f = 0; f < 8; f++) {
            var im = new Image();
            im.src = 'assets/art/herb-redraw/' + sets[a] + '-' + HERB_REDRAW_STAGES[b] + '-' + HERB_REDRAW_STATES[c] + '-f0' + f + '.png';
          }
        }
      }
      var rd = new Image();
      rd.src = 'assets/art/herb-redraw/' + sets[a] + '-ready.png';
    }
  }

  // Một timer chung 125ms (8fps) chỉ chạy khi modal đang mở; mỗi lần dựng
  // lại lưới (1s) các thẻ mới lấy đúng khung hiện tại nên chuyển động liền mạch.
  function startHerbFrameTimer() {
    if (typeof document === 'undefined') return;
    if (herbFrameTimer) { clearInterval(herbFrameTimer); herbFrameTimer = null; }
    herbFrameTimer = setInterval(function () {
      var modal = document.getElementById('linhdien-modal');
      if (!modal || modal.classList.contains('hidden')) { stopHerbFrameTimer(); return; }
      herbFrameIndex = (herbFrameIndex + 1) % 8;
      var imgs = document.querySelectorAll('#linhdien-grid img.plot-herb-anim');
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].src = herbRedrawSrc(imgs[i].getAttribute('data-herb-item'), parseInt(imgs[i].getAttribute('data-herb-stage'), 10), imgs[i].getAttribute('data-herb-state'), herbFrameIndex);
      }
    }, 125);
  }

  function stopHerbFrameTimer() {
    if (herbFrameTimer) { clearInterval(herbFrameTimer); herbFrameTimer = null; }
  }

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------
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

  function getRealmRank(player) {
    var st = getStateAPI();
    if (st && st.getRealmRank) return st.getRealmRank(player);
    return 0;
  }

  // ---------------------------------------------------------------------------
  // ensureState
  // ---------------------------------------------------------------------------
  function ensureState(player) {
    if (!player) return null;
    if (!player.linhDien || typeof player.linhDien !== 'object') {
      player.linhDien = { soilLevel: 0, unlockedPlots: INITIAL_PLOTS, plots: [], spells: {}, soilFertility: 0 };
    }
    var ld = player.linhDien;
    if (typeof ld.soilLevel !== 'number' || ld.soilLevel < 0 || ld.soilLevel >= SOIL_LEVELS.length) ld.soilLevel = 0;
    if (typeof ld.unlockedPlots !== 'number') ld.unlockedPlots = INITIAL_PLOTS;
    if (typeof ld.soilFertility !== 'number') ld.soilFertility = 0;
    if (!ld.spells || typeof ld.spells !== 'object') ld.spells = {};
    var spellIds = Object.keys(SPELLS);
    for (var i = 0; i < spellIds.length; i++) {
      var sid = spellIds[i];
      if (!ld.spells[sid] || typeof ld.spells[sid] !== 'object') {
        ld.spells[sid] = { learned: false, uses: 0, level: 1, cooldownUntil: 0 };
      } else {
        var sp = ld.spells[sid];
        if (typeof sp.learned !== 'boolean') sp.learned = !!sp.learned;
        if (typeof sp.uses !== 'number' || sp.uses < 0) sp.uses = 0;
        if (typeof sp.level !== 'number' || sp.level < 1) sp.level = 1;
        if (typeof sp.cooldownUntil !== 'number') sp.cooldownUntil = 0;
      }
    }
    if (!Array.isArray(ld.plots)) ld.plots = [];
    while (ld.plots.length < MAX_PLOTS) ld.plots.push(null);
    ld.unlockedPlots = maxUnlockedPlots(player);
    // Hồi tố an toàn: tự động đồng bộ mở khóa pháp quyết theo tiến độ nhiệm vụ
    syncQuestSpells(player, true);
    return ld;
  }

  // ---------------------------------------------------------------------------
  // Cấp đất
  // ---------------------------------------------------------------------------
  function getSoilLevel(player) {
    ensureState(player);
    return player.linhDien.soilLevel || 0;
  }

  function getSoilLevelId(player) {
    ensureState(player);
    return SOIL_LEVELS[player.linhDien.soilLevel].id;
  }

  function getSoilLevelDef(level) {
    if (typeof level !== 'number') level = 0;
    level = Math.max(0, Math.min(SOIL_LEVELS.length - 1, Math.floor(level)));
    return SOIL_LEVELS[level];
  }

  function getSoilLevelName(player) {
    ensureState(player);
    return SOIL_LEVELS[player.linhDien.soilLevel].name;
  }

  function maxUnlockedPlots(player) {
    if (!player || !player.linhDien) return INITIAL_PLOTS;
    var ld = player.linhDien;
    var rank = getRealmRank(player);
    var soil = (ld && typeof ld.soilLevel === 'number') ? ld.soilLevel : 0;
    var base = INITIAL_PLOTS;
    if (rank >= 4) base = 7;
    if (rank >= 7) base = 8;
    if (rank >= 10) base = 9;
    if (rank >= 14) base = 10;
    if (soil >= 1) base += 1;
    if (soil >= 2) base += 1;
    if (soil >= 3) base += 1;
    if (base > MAX_PLOTS) base = MAX_PLOTS;
    return base;
  }

  function getUnlockedPlotCount(player) {
    ensureState(player);
    return player.linhDien.unlockedPlots || INITIAL_PLOTS;
  }

  function isPlotUnlocked(player, plotIndex) {
    ensureState(player);
    if (plotIndex < 0 || plotIndex >= MAX_PLOTS) return false;
    return plotIndex < (player.linhDien.unlockedPlots || INITIAL_PLOTS);
  }

  function getPlotUnlockCondition(player, plotIndex) {
    // PROVISIONAL: điều kiện mở ô theo cảnh giới/cấp đất
    if (plotIndex < INITIAL_PLOTS) return 'Mở sẵn';
    if (plotIndex === 6) return 'Cảnh giới Luyện Khí tầng 4';
    if (plotIndex === 7) return 'Cảnh giới Luyện Khí tầng 7';
    if (plotIndex === 8) return 'Cảnh giới Trúc Cơ Sơ Kỳ';
    if (plotIndex === 9) return 'Cảnh giới Trúc Cơ Trung Kỳ';
    if (plotIndex === 10) return 'Cấp đất Linh Thổ trở lên';
    if (plotIndex === 11) return 'Cấp đất Ngọc Thổ trở lên';
    return 'Chưa rõ điều kiện';
  }

  function upgradeSoil(player, targetLevel) {
    ensureState(player);
    var cur = player.linhDien.soilLevel || 0;
    if (targetLevel === undefined || targetLevel === null) targetLevel = cur + 1;
    targetLevel = Math.floor(targetLevel);
    if (targetLevel <= cur) return { ok: false, msg: 'Đã đạt cấp đất này.' };
    if (targetLevel < 0 || targetLevel >= SOIL_LEVELS.length) return { ok: false, msg: 'Cấp đất không hợp lệ.' };
    if (targetLevel !== cur + 1) return { ok: false, msg: 'Phải nâng cấp đất theo thứ tự.' };

    var def = SOIL_LEVELS[targetLevel];
    var rank = getRealmRank(player);
    if (rank < def.minRealmRank) return { ok: false, msg: 'Cảnh giới chưa đủ (' + (rank) + ' < ' + def.minRealmRank + ').' };

    var st = getStateAPI();
    if (def.upgradeCostLT > 0 && (player.linhThach || 0) < def.upgradeCostLT) {
      return { ok: false, msg: 'Thiếu Linh Thạch (cần ' + def.upgradeCostLT + ').' };
    }
    if (st && st.countItemInBag) {
      for (var i = 0; i < def.materials.length; i++) {
        var mat = def.materials[i];
        if (st.countItemInBag(player, mat.itemId) < mat.count) {
          return { ok: false, msg: 'Thiếu vật liệu ' + mat.itemId + ' (cần ' + mat.count + ').' };
        }
      }
    }

    if (def.upgradeCostLT > 0) player.linhThach = (player.linhThach || 0) - def.upgradeCostLT;
    if (st && st.removeItemFromBag) {
      for (var j = 0; j < def.materials.length; j++) {
        st.removeItemFromBag(player, def.materials[j].itemId, def.materials[j].count);
      }
    }

    player.linhDien.soilLevel = targetLevel;
    ensureState(player);
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã nâng cấp đất lên ' + def.name + '.', level: targetLevel, name: def.name };
  }

  // ---------------------------------------------------------------------------
  // Tương sinh đất–cây
  // ---------------------------------------------------------------------------
  function synergyMultiplier(soilElem, plantElem) {
    soilElem = soilElem || 'thuy';
    plantElem = plantElem || 'moc';
    if (SINH_MAP[soilElem] === plantElem) return 0.7; // PROVISIONAL: lớn nhanh 30%
    if (KHAC_MAP[soilElem] === plantElem || KHAC_MAP[plantElem] === soilElem) return 1.4; // PROVISIONAL: chậm 40%
    return 1.0;
  }

  function isSynergyGood(soilElem, plantElem) {
    return SINH_MAP[soilElem || 'thuy'] === (plantElem || 'moc');
  }

  function isSynergyBad(soilElem, plantElem) {
    var s = soilElem || 'thuy', p = plantElem || 'moc';
    return KHAC_MAP[s] === p || KHAC_MAP[p] === s;
  }

  // ---------------------------------------------------------------------------
  // Chăm sóc: cỏ dại / sâu linh / bón phân / tưới
  // ---------------------------------------------------------------------------
  function removeWeed(player, plotIndex) {
    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) return { ok: false, msg: 'Ô đất trống.' };
    plot.weed = false;
    plot.weedCleared = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã nhổ cỏ dại.' };
  }

  function removePest(player, plotIndex) {
    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) return { ok: false, msg: 'Ô đất trống.' };
    plot.pest = false;
    plot.pestCleared = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã trừ sâu linh.' };
  }

  function removeDisease(player, plotIndex) {
    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) return { ok: false, msg: 'Ô đất trống.' };
    plot.disease = false;
    plot.diseaseCleared = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã thanh trừ uế bệnh.' };
  }

  function waterPlot(player, plotIndex, nowMs) {
    ensureState(player);
    if (plotIndex < 0 || plotIndex >= MAX_PLOTS) return { ok: false, msg: 'Ô đất không hợp lệ.' };
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) return { ok: false, msg: 'Ô đất trống.' };
    plot.watered = true;
    plot.waterCount = (plot.waterCount || 0) + 1;
    var t = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    plot.lastWateredAt = t;
    plot.lastSkillAt = t;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã tưới ô ' + (plotIndex + 1) + '.' };
  }

  function fertilize(player, plotIndex, itemId, nowMs) {
    ensureState(player);
    if (plotIndex < 0 || plotIndex >= MAX_PLOTS) return { ok: false, msg: 'Ô đất không hợp lệ.' };
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) return { ok: false, msg: 'Ô đất trống.' };

    var st = getStateAPI();
    if (itemId) {
      if (!st || !st.countItemInBag || st.countItemInBag(player, itemId) < 1) {
        return { ok: false, msg: 'Không đủ vật liệu bón phân.' };
      }
      if (st.removeItemFromBag) st.removeItemFromBag(player, itemId, 1);
    }
    plot.fertilizedCount = (plot.fertilizedCount || 0) + 1;
    plot.qualityBonus = (plot.qualityBonus || 0) + 1;
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã bón phân cho ô ' + (plotIndex + 1) + '.' };
  }

  // ---------------------------------------------------------------------------
  // Cấu hình Sâu Bệnh Cỏ Dại ngẫu nhiên (Đợt PEST - Bui 03:07)
  // ---------------------------------------------------------------------------
  var pestConfig = {
    rates: {
      weed: 0.35,      // PROVISIONAL: 35% xác suất cỏ dại
      pest: 0.30,      // PROVISIONAL: 30% xác suất sâu linh
      disease: 0.25    // PROVISIONAL: 25% xác suất uế bệnh
    },
    windows: {
      weed: [0.20, 0.45],      // PROVISIONAL: mọc ở 20% - 45% thời gian lớn
      pest: [0.45, 0.70],      // PROVISIONAL: xuất hiện ở 45% - 70% thời gian lớn
      disease: [0.60, 0.85]    // PROVISIONAL: phát bệnh ở 60% - 85% thời gian lớn
    },
    spreadRate: 0.10,          // PROVISIONAL: 10% lây lan sang ô bên
    rng: Math.random
  };

  function setPestRNG(fn) {
    pestConfig.rng = (typeof fn === 'function') ? fn : Math.random;
  }

  function setPestRates(rates) {
    if (!rates) return;
    if (typeof rates.weed === 'number') pestConfig.rates.weed = rates.weed;
    if (typeof rates.pest === 'number') pestConfig.rates.pest = rates.pest;
    if (typeof rates.disease === 'number') pestConfig.rates.disease = rates.disease;
    if (typeof rates.spreadRate === 'number') pestConfig.spreadRate = rates.spreadRate;
  }

  function resetPestConfig() {
    pestConfig.rates.weed = 0.35;
    pestConfig.rates.pest = 0.30;
    pestConfig.rates.disease = 0.25;
    pestConfig.spreadRate = 0.10;
    pestConfig.rng = Math.random;
  }

  function generatePestSchedule(plotIndex, itemId, plantedAt, growSec) {
    var rng = pestConfig.rng || Math.random;
    var sched = {};

    var rollWeed = rng();
    if (rollWeed < pestConfig.rates.weed) {
      var wWin = pestConfig.windows.weed;
      sched.weedAt = wWin[0] + rng() * (wWin[1] - wWin[0]);
    } else {
      sched.weedAt = null;
    }

    var rollPest = rng();
    if (rollPest < pestConfig.rates.pest) {
      var pWin = pestConfig.windows.pest;
      sched.pestAt = pWin[0] + rng() * (pWin[1] - pWin[0]);
    } else {
      sched.pestAt = null;
    }

    var rollDis = rng();
    if (rollDis < pestConfig.rates.disease) {
      var dWin = pestConfig.windows.disease;
      sched.diseaseAt = dWin[0] + rng() * (dWin[1] - dWin[0]);
    } else {
      sched.diseaseAt = null;
    }

    return sched;
  }

  function checkPestSpread(player, now) {
    if (!player || !player.linhDien || !player.linhDien.plots) return;
    var plots = player.linhDien.plots;
    var rng = pestConfig.rng || Math.random;
    var len = Math.min(plots.length, player.linhDien.unlockedPlots || INITIAL_PLOTS);

    for (var i = 0; i < len; i++) {
      var p = plots[i];
      if (!p || !p.itemId) continue;

      if (p.pest || p.disease) {
        var neighbors = [i - 1, i + 1];
        for (var n = 0; n < neighbors.length; n++) {
          var ni = neighbors[n];
          if (ni >= 0 && ni < len) {
            var np = plots[ni];
            if (np && np.itemId) {
              if (p.pest && !np.pest && !np.pestCleared && rng() < pestConfig.spreadRate) {
                np.pest = true;
              }
              if (p.disease && !np.disease && !np.diseaseCleared && rng() < pestConfig.spreadRate) {
                np.disease = true;
              }
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // plotView
  // ---------------------------------------------------------------------------
  function getHerbQualityAPI() { try { if (typeof window !== 'undefined' && window.GameHerbQuality) return window.GameHerbQuality; return require('./herb-quality.js'); } catch (e) { return null; } }

  function calcQuality(plot, plantDef, withered) {
    var q = 1.0;
    var soilElem = (plot && plot.soilElement) || 'thuy';
    var plantElem = (plot && plot.element) || (plantDef && plantDef.element) || 'moc';
    if (isSynergyGood(soilElem, plantElem)) q += 0.5; // PROVISIONAL
    if (plot && plot.watered) q += 0.2; // PROVISIONAL
    if (plot && plot.fertilizedCount) q += 0.2 * plot.fertilizedCount; // PROVISIONAL
    // BỎ PHẠT THÚC ÉP (Lệnh Bui 03:07): không còn trừ phẩm chất khi dùng Thôi Sinh
    if (withered) q -= 0.5; // PROVISIONAL
    if (plot) {
      if (plot.weed) q -= 0.15; // PROVISIONAL: cỏ dại tranh linh khí
      if (plot.pest) q -= 0.15; // PROVISIONAL: sâu linh đục thân lá
      if (plot.disease) q -= 0.20; // PROVISIONAL: uế bệnh xâm lấn
    }
    if (q < 0.1) q = 0.1;
    if (q > 2.0) q = 2.0;
    return q;
  }

  function qualityGrade(q) {
    if (q >= 1.8) return 'Cực phẩm';
    if (q >= 1.4) return 'Thượng phẩm';
    if (q >= 1.0) return 'Trung phẩm';
    return 'Hạ phẩm';
  }

  // Một context duy nhất cho xem và thu; Linh Vũ không có cờ riêng trên ô nên không cộng spellWatered.
  function harvestContext(player, plot, view, withered) {
    return { soilLevel: player.linhDien.soilLevel, watered: !!plot.watered, fertilizedCount: plot.fertilizedCount, soilFertility: player.linhDien.soilFertility, weed: !!view.weed, pest: !!view.pest, withered: !!withered, spellPurified: !!plot.pestCleared, spellGuided: !!plot.guided };
  }

  function herbQualityForPlot(player, plot, view, withered) {
    var hq = getHerbQualityAPI();
    if (hq && hq.qualityForHarvest) return hq.qualityForHarvest(harvestContext(player, plot, view, withered));
    return 1;
  }

  function plotView(player, plotIndex, nowMs) {
    if (!player || plotIndex < 0 || plotIndex >= MAX_PLOTS) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, withered: false, weed: false, pest: false, disease: false, watered: false, quality: 1, skillIntervalSec: 0, skillRemainSec: 0, needSkill: false, needSkillHint: '' };
    }
    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot || !plot.itemId || !plot.plantedAt) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, withered: false, weed: false, pest: false, disease: false, watered: false, quality: 1, skillIntervalSec: 0, skillRemainSec: 0, needSkill: false, needSkillHint: '' };
    }

    var plantDef = PLANTABLE[plot.itemId];
    if (!plantDef) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, withered: false, weed: false, pest: false, disease: false, watered: false, quality: 1, skillIntervalSec: 0, skillRemainSec: 0, needSkill: false, needSkillHint: '' };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var soilElem = plot.soilElement || 'thuy';
    var plantElem = plot.element || plantDef.element || 'moc';
    var syn = synergyMultiplier(soilElem, plantElem);
    var waterFactor = plot.watered ? 0.75 : 1.0;
    var fertFactor = plot.fertilizedCount > 0 ? Math.max(0.85, 1 - 0.05 * plot.fertilizedCount) : 1.0;

    // Đợt N2: thú giữ ruộng (GameLinhThu.guardBonus) giảm tỉ lệ cỏ/sâu
    // (ngưỡng xuất hiện chậm lại) + tăng tốc chăm cây (growSec ngắn lại).
    // Không có thú giữ ruộng thì mọi hệ số bằng 1, hành vi D1 giữ nguyên.
    var guardBonus = null;
    try {
      if (typeof window !== 'undefined' && window.GameLinhThu && window.GameLinhThu.guardBonus) guardBonus = window.GameLinhThu.guardBonus(player, now);
      else if (typeof require === 'function') { var ltN2 = require('./linh-thu.js'); if (ltN2 && ltN2.guardBonus) guardBonus = ltN2.guardBonus(player, now); }
    } catch (e) { guardBonus = null; }
    var guardActive = !!(guardBonus && guardBonus.active);
    var guardGrow = guardActive ? guardBonus.growFactor : 1;
    var guardWeedDelay = guardActive ? (guardBonus.weedDelay || 0) : 0;
    var guardPestDelay = guardActive ? (guardBonus.pestDelay || 0) : 0;

    // Sâu bệnh cỏ dại ngẫu nhiên (Đợt PEST - Bui 03:07)
    if (!plot.pestSchedule) {
      plot.pestSchedule = generatePestSchedule(plotIndex, plot.itemId, plot.plantedAt, plantDef.growSec);
    }
    var sched = plot.pestSchedule || {};

    var weed = !!plot.weed;
    if (plot.weedCleared) {
      weed = false;
    } else if (sched.weedAt !== null && sched.weedAt !== undefined) {
      var weedThreshold = sched.weedAt * (1 + guardWeedDelay);
      if (now >= plot.plantedAt + plantDef.growSec * 1000 * weedThreshold) {
        weed = true;
      }
    }

    var pest = !!plot.pest;
    if (plot.pestCleared) {
      pest = false;
    } else if (sched.pestAt !== null && sched.pestAt !== undefined) {
      var pestThreshold = sched.pestAt * (1 + guardPestDelay);
      if (now >= plot.plantedAt + plantDef.growSec * 1000 * pestThreshold) {
        pest = true;
      }
    }

    var disease = !!plot.disease;
    if (plot.diseaseCleared) {
      disease = false;
    } else if (sched.diseaseAt !== null && sched.diseaseAt !== undefined) {
      var diseaseThreshold = sched.diseaseAt * (1 + guardPestDelay);
      if (now >= plot.plantedAt + plantDef.growSec * 1000 * diseaseThreshold) {
        disease = true;
      }
    }

    plot.weed = weed;
    plot.pest = pest;
    plot.disease = disease;

    // Hậu quả uế nhiễm: mỗi loại làm chậm lớn 10% (PROVISIONAL)
    var pestCount = (weed ? 1 : 0) + (pest ? 1 : 0) + (disease ? 1 : 0);
    var weedFactor = pestCount > 0 ? (1.0 + 0.10 * pestCount) : 1.0;
    var growSec = plantDef.growSec * syn * waterFactor * weedFactor * fertFactor * guardGrow;

    // Chu kỳ cần skill (Đợt PEST - Bui 03:07)
    var skillInterval = plantDef.skillIntervalSec || Math.max(30, Math.round(plantDef.growSec * 0.30));
    var lastSkill = (plot.lastSkillAt !== undefined && plot.lastSkillAt !== null) ? plot.lastSkillAt : plot.plantedAt;
    var nextSkillAt = lastSkill + skillInterval * 1000;
    var skillRemainSec = Math.max(0, Math.ceil((nextSkillAt - now) / 1000));
    var needSkill = (skillRemainSec === 0);

    var elapsedSec = Math.max(0, (now - plot.plantedAt) / 1000);

    if (elapsedSec >= growSec + WITHER_GRACE_SEC) {
      var qW = calcQuality(plot, plantDef, true);
      return {
        state: 'withered', itemId: plot.itemId, progress: 1.0, remainSec: 0, stage: 2,
        withered: true, weed: weed, pest: pest, disease: disease, watered: !!plot.watered,
        quality: qW, herbQuality: herbQualityForPlot(player, plot, { weed: weed, pest: pest }, true), grade: qualityGrade(qW),
        skillIntervalSec: skillInterval, skillRemainSec: 0, needSkill: false, needSkillHint: ''
      };
    }

    if (elapsedSec >= growSec) {
      var qR = calcQuality(plot, plantDef, false);
      return {
        state: 'ready', itemId: plot.itemId, progress: 1.0, remainSec: 0, stage: 2,
        withered: false, weed: weed, pest: pest, disease: disease, watered: !!plot.watered,
        quality: qR, herbQuality: herbQualityForPlot(player, plot, { weed: weed, pest: pest }, false), grade: qualityGrade(qR),
        skillIntervalSec: skillInterval, skillRemainSec: 0, needSkill: false, needSkillHint: ''
      };
    }

    var progress = Math.max(0, Math.min(0.9999, elapsedSec / growSec));
    var remainSec = Math.max(0, Math.ceil(growSec - elapsedSec));

    var stage = 0;
    if (progress >= 0.66) stage = 2;
    else if (progress >= 0.33) stage = 1;

    var curQ = calcQuality(plot, plantDef, false);
    return {
      state: 'growing', itemId: plot.itemId, progress: progress, remainSec: remainSec, stage: stage,
      withered: false, weed: weed, pest: pest, disease: disease, watered: !!plot.watered,
      quality: curQ, grade: qualityGrade(curQ),
      skillIntervalSec: skillInterval, skillRemainSec: skillRemainSec, needSkill: needSkill,
      needSkillHint: needSkill ? 'CẦN SKILL' : ('Cần skill sau ' + skillRemainSec + 's')
    };
  }

  // ---------------------------------------------------------------------------
  // plant / harvest
  // ---------------------------------------------------------------------------
  function plant(player, plotIndex, itemId, nowMs) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    if (plotIndex < 0 || plotIndex >= MAX_PLOTS) return { ok: false, msg: 'Ô đất không hợp lệ.' };

    ensureState(player);
    if (!isPlotUnlocked(player, plotIndex)) {
      return { ok: false, msg: 'Ô đất còn khóa: ' + getPlotUnlockCondition(player, plotIndex) + '.' };
    }
    if (player.linhDien.plots[plotIndex]) {
      return { ok: false, msg: 'Ô đất này đã có cây trồng.' };
    }

    var plantDef = PLANTABLE[itemId];
    if (!plantDef) {
      return { ok: false, msg: 'Loại dược thảo này không thể gieo trồng.' };
    }

    if ((player.linhDien.soilLevel || 0) < (plantDef.minSoilLevel || 0)) {
      var needSoil = SOIL_LEVELS[plantDef.minSoilLevel || 0].name;
      return { ok: false, msg: 'Cấp đất chưa đủ (cần ' + needSoil + ') để trồng ' + plantDef.name + '.' };
    }

    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };

    var cost = plantDef.seedCost || 1;
    var countInBag = st.countItemInBag(player, itemId);
    if (countInBag < cost) {
      return { ok: false, msg: 'Không đủ giống trong túi (cần ' + cost + ' ' + plantDef.name + ').' };
    }

    var removed = st.removeItemFromBag(player, itemId, cost);
    if (!removed) {
      return { ok: false, msg: 'Trừ hạt giống thất bại.' };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    player.linhDien.plots[plotIndex] = {
      itemId: itemId,
      element: plantDef.element || 'moc',
      soilElement: 'thuy',
      plantedAt: now,
      lastSkillAt: now,
      watered: false,
      waterCount: 0,
      lastWateredAt: 0,
      fertilizedCount: 0,
      qualityBonus: 0,
      weed: false,
      weedCleared: false,
      pest: false,
      pestCleared: false,
      disease: false,
      diseaseCleared: false,
      forcedCount: 0,
      pestSchedule: generatePestSchedule(plotIndex, itemId, now, plantDef.growSec)
    };

    st.savePlayer(player);
    return { ok: true, msg: 'Đã gieo ' + plantDef.name + ' vào ô ' + (plotIndex + 1) + '.' };
  }

  function harvest(player, plotIndex, nowMs) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.', itemId: null, count: 0 };
    if (plotIndex < 0 || plotIndex >= MAX_PLOTS) {
      return { ok: false, msg: 'Ô đất không hợp lệ.', itemId: null, count: 0 };
    }

    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) {
      return { ok: false, msg: 'Ô đất đang trống.', itemId: null, count: 0 };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var view = plotView(player, plotIndex, now);
    if (view.state !== 'ready' && view.state !== 'withered') {
      return { ok: false, msg: 'Cây chưa chín (còn ' + view.remainSec + ' giây).', itemId: plot.itemId, count: 0 };
    }

    var plantDef = PLANTABLE[plot.itemId];
    var withered = view.state === 'withered';
    var yieldCount = plantDef ? (plantDef.yieldCount || 1) : 1;
    if (withered) yieldCount = Math.max(1, yieldCount - 1);
    if (plot.disease) yieldCount = Math.max(1, yieldCount - 1); // PROVISIONAL: Uế bệnh làm giảm sản lượng
    var itemId = plot.itemId;
    var quality = view.quality || calcQuality(plot, plantDef, withered);

    var st = getStateAPI();
    var m = getMonstersAPI();
    var itemDefs = m ? m.ITEM_DEFS : null;

    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.', itemId: itemId, count: 0 };

    var hq = getHerbQualityAPI();
    var herbQuality = hq && hq.qualityForHarvest ? hq.qualityForHarvest(harvestContext(player, plot, view, withered)) : 1;
    var addRes = st.addHerbToBag ? st.addHerbToBag(player, itemId, yieldCount, herbQuality, itemDefs) : st.addItemToBag(player, itemId, yieldCount, itemDefs);
    if (!addRes || !addRes.success) {
      return { ok: false, msg: 'Túi đồ đã đầy, không thể thu hoạch! Hãy dọn túi trước.', itemId: itemId, count: 0 };
    }

    player.linhDien.plots[plotIndex] = null;
    // tu vi Mộc khi thu hoạch (PROVISIONAL)
    if (st.addTuViCapped) st.addTuViCapped(player, 'moc', withered ? 2 : 5);
    // Dẫn Linh hồi độ phì đất
    player.linhDien.soilFertility = (player.linhDien.soilFertility || 0) + 1;
    st.savePlayer(player);

    var herbName = plantDef ? plantDef.name : itemId;
    return {
      ok: true,
      msg: 'Thu hoạch thành công: +' + yieldCount + ' ' + herbName + ' vào túi!',
      itemId: itemId,
      count: yieldCount,
      quality: quality,
      herbQuality: herbQuality,
      grade: qualityGrade(quality),
      withered: withered
    };
  }

  // ---------------------------------------------------------------------------
  // Pháp quyết & Mở khóa qua Nhiệm vụ (Đợt ELDER — Bui 01:32, 01:37 & Chốt 01:52)
  // Đường chuẩn mới: Nhập tông (sectStage >= 4) -> Trưởng Lão Dược Điền tại Ruộng Linh Mễ dạy 4 pháp quyết
  // ---------------------------------------------------------------------------
  var SPELL_UNLOCKS = {
    'linh-vu': {
      questName: 'Thuật Trồng Dược Tông Môn',
      hint: 'bái kiến Trưởng Lão Dược Điền tại Ruộng Linh Mễ tông môn',
      isUnlocked: function (player) {
        if (!player || !player.quests) return false;
        var eq = player.quests.elderQuest;
        return !!(eq && (eq.completed || eq.stage >= 3));
      }
    },
    'tru-ue': {
      questName: 'Thuật Trồng Dược Tông Môn',
      hint: 'bái kiến Trưởng Lão Dược Điền tại Ruộng Linh Mễ tông môn',
      isUnlocked: function (player) {
        if (!player || !player.quests) return false;
        var eq = player.quests.elderQuest;
        return !!(eq && (eq.completed || eq.stage >= 3));
      }
    },
    'thoi-sinh': {
      questName: 'Thuật Trồng Dược Tông Môn',
      hint: 'bái kiến Trưởng Lão Dược Điền tại Ruộng Linh Mễ tông môn',
      isUnlocked: function (player) {
        if (!player || !player.quests) return false;
        var eq = player.quests.elderQuest;
        return !!(eq && (eq.completed || eq.stage >= 3));
      }
    },
    'dan-linh': {
      questName: 'Thuật Trồng Dược Tông Môn',
      hint: 'bái kiến Trưởng Lão Dược Điền tại Ruộng Linh Mễ tông môn',
      isUnlocked: function (player) {
        if (!player || !player.quests) return false;
        var eq = player.quests.elderQuest;
        return !!(eq && (eq.completed || eq.stage >= 3));
      }
    }
  };

  // Kịch bản Trưởng Lão Dược Điền thi triển ví dụ các cấp độ (Bui 01:37)
  // 4 pháp quyết x 3 cấp độ (Sơ khởi -> Thuần thục -> Đại thành) = 12 bước thị phạm
  var ELDER_DEMO_STEPS = [
    { spellId: 'linh-vu', level: 1, name: 'Linh Vũ Quyết', rankName: 'Sơ Khởi (Mưa Phùn)', color: '#63b3ed', desc: 'Linh Vũ sơ khởi, tụ thủy khí thành mưa phùn bồi tưới linh điền...' },
    { spellId: 'linh-vu', level: 2, name: 'Linh Vũ Quyết', rankName: 'Thuần Thục (Cam Lộ)', color: '#3182ce', desc: 'Linh Vũ bậc hai, mây lam ngưng tụ rải cam lộ khắp ruộng...' },
    { spellId: 'linh-vu', level: 3, name: 'Linh Vũ Quyết', rankName: 'Đại Thành (Linh Tuyền)', color: '#bee3f8', desc: 'Linh Vũ đại thành! Linh tuyền từ trời rót xuống, thấm đẫm vạn khoảnh!' },
    { spellId: 'tru-ue', level: 1, name: 'Trừ Uế Quyết', rankName: 'Sơ Khởi (Thanh Phong)', color: '#48bb78', desc: 'Trừ Uế sơ khởi, thanh tẩy uế khí xua tan sâu bọ cắn rễ...' },
    { spellId: 'tru-ue', level: 2, name: 'Trừ Uế Quyết', rankName: 'Thuần Thục (Tịnh Hóa)', color: '#2f855a', desc: 'Trừ Uế bậc hai, mộc linh thanh khiết diệt sạch cỏ dại...' },
    { spellId: 'tru-ue', level: 3, name: 'Trừ Uế Quyết', rankName: 'Đại Thành (Bách Bệnh Bất Xâm)', color: '#9ae6b4', desc: 'Trừ Uế đại thành! Tịnh hóa linh thổ, bách bệnh bất xâm!' },
    { spellId: 'thoi-sinh', level: 1, name: 'Thôi Sinh Quyết', rankName: 'Sơ Khởi (Kích Mầm)', color: '#68d391', desc: 'Thôi Sinh sơ khởi, kích hoạt sinh cơ trong hạt mầm...' },
    { spellId: 'thoi-sinh', level: 2, name: 'Thôi Sinh Quyết', rankName: 'Thuần Thục (Tảo Niên)', color: '#38a169', desc: 'Thôi Sinh bậc hai, đẩy nhanh niên hạn dược thảo lớn nhanh vượt bậc...' },
    { spellId: 'thoi-sinh', level: 3, name: 'Thôi Sinh Quyết', rankName: 'Đại Thành (Nghịch Chuyển)', color: '#c6f6d5', desc: 'Thôi Sinh đại thành! Thoáng chốc nụ nở hoa kết trái, nghịch chuyển càn khôn!' },
    { spellId: 'dan-linh', level: 1, name: 'Dẫn Linh Quyết', rankName: 'Sơ Khởi (Tụ Khí)', color: '#ecc94b', desc: 'Dẫn Linh sơ khởi, gom góp linh khí xung quanh tụ về thổ nhưỡng...' },
    { spellId: 'dan-linh', level: 2, name: 'Dẫn Linh Quyết', rankName: 'Thuần Thục (Dẫn Mạch)', color: '#d69e2e', desc: 'Dẫn Linh bậc hai, kích hoạt linh mạch dưới sâu nuôi dưỡng độ phì...' },
    { spellId: 'dan-linh', level: 3, name: 'Dẫn Linh Quyết', rankName: 'Đại Thành (Địa Mạch Thăng Hoa)', color: '#fefcbf', desc: 'Dẫn Linh đại thành! Địa mạch thăng hoa, biến phàm thổ thành phúc địa linh điền!' }
  ];

  function executeElderDemoStep(player, stepIndex, nowMs) {
    if (typeof stepIndex !== 'number' || stepIndex < 0 || stepIndex >= ELDER_DEMO_STEPS.length) return null;
    var step = ELDER_DEMO_STEPS[stepIndex];
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    // HỘI TỤ (tích hợp 2026-11-13): level của demo là BẬC thành thạo 1/2/3;
    // ánh xạ SPELLFX: bậc 1 = cấp 1–2, bậc 2 = cấp 3–4, bậc 3 = cấp 5+.
    // fxLevel là cấp đại diện (1/3/5) để lớp VFX chọn đúng bộ hiệu ứng theo
    // bậc; level giữ nguyên 1/2/3 cho tương thích test + hiển thị bậc.
    var fxLevel = step.level >= 3 ? 5 : (step.level === 2 ? 3 : 1);
    var castInfo = {
      spellId: step.spellId,
      level: step.level,
      tier: step.level,
      fxLevel: fxLevel,
      caster: 'npc_truonglao_duocdien',
      mapId: 'ruong-linh-me',
      x: 225,
      y: 420,
      stepIndex: stepIndex,
      rankName: step.rankName,
      color: step.color,
      name: step.name,
      desc: step.desc,
      at: now
    };

    if (player && player.linhDien) {
      player.linhDien.lastCast = castInfo;
    }
    lastCastResult = castInfo;

    // Cắm móc VFX theo bậc (Bui 01:37 / Parent Note 01:05)
    if (typeof window !== 'undefined' && window.GameVFX && window.GameVFX.onSpellCast) {
      try { window.GameVFX.onSpellCast(castInfo); } catch (e) {}
    }
    return castInfo;
  }

  function simulateElderDemo(player, skip) {
    if (!player) return [];
    ensureState(player);
    if (!player.quests) player.quests = {};
    if (!player.quests.elderQuest) player.quests.elderQuest = { stage: 2, demoDone: false, completed: false };

    var results = [];
    if (skip) {
      var lastStep = executeElderDemoStep(player, ELDER_DEMO_STEPS.length - 1);
      if (lastStep) results.push(lastStep);
      player.quests.elderQuest.demoDone = true;
      player.quests.elderQuest.stage = 2;
    } else {
      for (var i = 0; i < ELDER_DEMO_STEPS.length; i++) {
        var res = executeElderDemoStep(player, i);
        if (res) results.push(res);
      }
      player.quests.elderQuest.demoDone = true;
      player.quests.elderQuest.stage = 2;
    }

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return results;
  }

  function learnAllSpellsFromElder(player) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    ensureState(player);
    var sids = ['linh-vu', 'tru-ue', 'thoi-sinh', 'dan-linh'];
    var newlyCount = 0;
    for (var i = 0; i < sids.length; i++) {
      var sid = sids[i];
      if (player.linhDien && player.linhDien.spells && player.linhDien.spells[sid] && !player.linhDien.spells[sid].learned) {
        newlyCount++;
      }
    }

    if (!player.quests) player.quests = {};
    if (!player.quests.elderQuest) player.quests.elderQuest = {};
    player.quests.elderQuest.stage = 3;
    player.quests.elderQuest.completed = true;
    player.quests.elderQuest.demoDone = true;

    for (var j = 0; j < sids.length; j++) {
      learnSpell(player, sids[j]);
    }

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return {
      ok: true,
      msg: 'Lĩnh ngộ toàn bộ 4 Pháp Quyết Linh Điền từ Trưởng Lão Dược Điền!',
      newlyLearnedCount: newlyCount
    };
  }

  function syncQuestSpells(player, silent) {
    if (!player || !player.linhDien || !player.linhDien.spells) return [];
    var ld = player.linhDien;
    var q = player.quests || {};
    var unlockedNow = [];

    // Hồi tố save cũ: nếu đã nhập tông (sectStage >= 4)
    if ((q.sectStage || 0) >= 4) {
      var anyLearned = ld.spells['linh-vu'].learned || ld.spells['tru-ue'].learned ||
                       ld.spells['thoi-sinh'].learned || ld.spells['dan-linh'].learned;
      if (!q.elderQuest) {
        if (anyLearned) {
          // Save cũ đã học qua đường cũ -> giữ nguyên, đánh dấu hoàn thành nhiệm vụ
          q.elderQuest = { stage: 3, demoDone: true, completed: true };
        } else {
          // Save cũ nhập tông chưa học -> cấp nhiệm vụ gặp Trưởng Lão
          q.elderQuest = { stage: 1, demoDone: false, completed: false };
        }
      } else if (anyLearned && !q.elderQuest.completed && q.elderQuest.stage < 3) {
        // Save cũ đã từng học nhưng elderQuest chưa đánh dấu completed -> hồi tố an toàn
        q.elderQuest.stage = 3;
        q.elderQuest.completed = true;
        q.elderQuest.demoDone = true;
      }
    }

    // Nếu elderQuest đã hoàn thành (stage >= 3 hoặc completed), kích hoạt 4 pháp quyết
    if (q.elderQuest && (q.elderQuest.stage >= 3 || q.elderQuest.completed)) {
      var sids = Object.keys(SPELLS);
      for (var i = 0; i < sids.length; i++) {
        var sid = sids[i];
        if (ld.spells[sid] && !ld.spells[sid].learned) {
          ld.spells[sid].learned = true;
          unlockedNow.push(sid);
          if (!silent && typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
            window.GameUI.showToast('Lĩnh ngộ pháp quyết linh điền: ' + SPELLS[sid].name + '!');
          }
        }
      }
    }

    if (unlockedNow.length > 0) {
      var st = getStateAPI();
      if (st && st.savePlayer) st.savePlayer(player);
    }
    return unlockedNow;
  }

  function getSpellDef(spellId) { return SPELLS[spellId] || null; }
  function listSpells() { return Object.keys(SPELLS).map(function (k) { return SPELLS[k]; }); }

  function isSpellLearned(player, spellId) {
    ensureState(player);
    var sp = player.linhDien.spells[spellId];
    return !!(sp && sp.learned);
  }

  function learnSpell(player, spellId) {
    ensureState(player);
    if (!SPELLS[spellId]) return { ok: false, msg: 'Pháp quyết không tồn tại.' };
    var already = !!player.linhDien.spells[spellId].learned;
    player.linhDien.spells[spellId].learned = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    if (!already && typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast('Lĩnh ngộ pháp quyết linh điền: ' + SPELLS[spellId].name + '!');
    }
    return { ok: true, msg: 'Đã học ' + SPELLS[spellId].name + '.', spellId: spellId, newlyLearned: !already };
  }

  function spellLevel(player, spellId) {
    ensureState(player);
    var sp = player.linhDien.spells[spellId];
    return sp ? (sp.level || 1) : 1;
  }

  function spellCost(spellId, level) {
    var def = SPELLS[spellId];
    if (!def) return 0;
    level = level || 1;
    return def.baseCost + Math.max(0, level - 1) * 2; // PROVISIONAL
  }

  function castSpell(player, spellId, plotIndex, nowMs) {
    ensureState(player);
    var def = SPELLS[spellId];
    if (!def) return { ok: false, msg: 'Không có pháp quyết này.' };
    if (!isSpellLearned(player, spellId)) {
      var unlockDef = SPELL_UNLOCKS[spellId];
      var hint = unlockDef ? ('Hãy ' + unlockDef.hint + ' để lĩnh ngộ!') : 'Hãy hoàn thành nhiệm vụ để lĩnh ngộ!';
      return { ok: false, msg: 'Chưa học ' + def.name + '. ' + hint, code: 'not_learned' };
    }

    var ld = player.linhDien;
    var sp = ld.spells[spellId];
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();

    if (sp.cooldownUntil && now < sp.cooldownUntil) {
      var remainSec = Math.ceil((sp.cooldownUntil - now) / 1000);
      return { ok: false, msg: def.name + ' đang hồi chiêu (còn ' + remainSec + 's).', code: 'cooldown', remainSec: remainSec };
    }

    var cost = spellCost(spellId, sp.level || 1);
    var st = getStateAPI();
    if ((player.linhLuc || 0) < cost) {
      return { ok: false, msg: 'Linh lực không đủ (cần ' + cost + ' LL, hiện có ' + (player.linhLuc || 0) + ' LL).', code: 'cost', cost: cost };
    }

    // Kiểm tra điều kiện thực thi cụ thể cho từng quyết trước khi trừ tài nguyên
    var affected = 0;
    var effectMsg = '';
    var idx = -1;

    if (spellId === 'thoi-sinh') {
      idx = (typeof plotIndex === 'number') ? plotIndex : -1;
      if (idx < 0 || idx >= MAX_PLOTS || !ld.plots[idx] || !ld.plots[idx].itemId) {
        idx = -1;
        for (var j = 0; j < (ld.unlockedPlots || INITIAL_PLOTS); j++) {
          if (ld.plots[j] && ld.plots[j].itemId) {
            var vCheck = plotView(player, j, now);
            if (vCheck.state === 'growing') { idx = j; break; }
          }
        }
      }
      if (idx < 0 || !ld.plots[idx] || !ld.plots[idx].itemId) {
        return { ok: false, msg: 'Không có linh thảo nào đang lớn trong linh điền để thúc.', code: 'no_target' };
      }
    }

    player.linhLuc -= cost;

    if (spellId === 'linh-vu') {
      // tưới tất cả ô đã mở đang có cây
      for (var i = 0; i < (ld.unlockedPlots || INITIAL_PLOTS); i++) {
        var p = ld.plots[i];
        if (p && p.itemId) {
          p.watered = true;
          p.waterCount = (p.waterCount || 0) + 1;
          p.lastWateredAt = now;
          p.lastSkillAt = now;
          affected++;
        }
      }
      effectMsg = affected > 0 ? ('Đã tưới ' + affected + ' ô dược thảo!') : 'Mưa linh tưới mát mảnh linh điền.';
    } else if (spellId === 'thoi-sinh') {
      var plot = ld.plots[idx];
      var plantDef = PLANTABLE[plot.itemId];
      var boostSec = plantDef ? Math.round(plantDef.growSec * 0.4) : 120;
      plot.plantedAt = plot.plantedAt - boostSec * 1000;
      plot.forcedCount = (plot.forcedCount || 0) + 1;
      plot.lastSkillAt = now;
      affected = 1;
      effectMsg = 'Đã thúc lớn ô #' + (idx + 1) + ' nhanh ' + boostSec + 's!';
    } else if (spellId === 'tru-ue') {
      for (var k = 0; k < (ld.unlockedPlots || INITIAL_PLOTS); k++) {
        var pp = ld.plots[k];
        if (pp) {
          pp.weed = false;
          pp.pest = false;
          pp.disease = false;
          pp.weedCleared = true;
          pp.pestCleared = true;
          pp.diseaseCleared = true;
          pp.lastSkillAt = now;
          affected++;
        }
      }
      effectMsg = 'Đã quét sạch uế khí, sâu linh, cỏ dại và dịch bệnh trên toàn bộ thửa đất!';
    } else if (spellId === 'dan-linh') {
      var gainFert = (sp.level || 1);
      ld.soilFertility = (ld.soilFertility || 0) + gainFert;
      // Hội tụ HERBQ: đánh dấu các ô đang có cây đã được dẫn linh (cộng +4 phẩm chất khi thu)
      for (var gi = 0; gi < (ld.unlockedPlots || INITIAL_PLOTS); gi++) {
        var gp = ld.plots[gi];
        if (gp && gp.itemId) gp.guided = true;
      }
      affected = (ld.unlockedPlots || INITIAL_PLOTS);
      effectMsg = 'Dẫn linh khí thành công! Độ phì thửa đất +' + gainFert + ' (hiện tại: ' + ld.soilFertility + ').';
    }

    sp.uses = (sp.uses || 0) + 1;
    var rankCap = Math.max(1, getRealmRank(player));
    if (rankCap < 5) rankCap = 5; // PROVISIONAL: cho phép tăng cấp ngay đầu game
    sp.level = Math.min(rankCap, 1 + Math.floor(sp.uses / 5)); // PROVISIONAL
    var cooldownMs = def.baseCooldownSec * 1000;
    sp.cooldownUntil = now + cooldownMs;

    // tu vi
    if (def.tuViElem && st && st.addTuViCapped) {
      st.addTuViCapped(player, def.tuViElem, (def.tuViAmount || 1) * (sp.level || 1));
    }

    // Ghi chú hội tụ Parent (2026-11-13 01:05): lưu vết lastCast kèm level cho VFX đợt sau
    ld.lastCast = {
      spellId: spellId,
      level: sp.level,
      uses: sp.uses,
      affected: affected,
      at: now
    };

    // Âm thanh pháp quyết (SFX-INTEGRATE: Bui duyệt 04:05 2026-11-13)
    // Chỉ phát khi thi triển thành công (vượt qua mọi kiểm tra tài nguyên/hồi chiêu/mục tiêu)
    var audio = (typeof window !== 'undefined' && window.GameAudio) || (typeof global !== 'undefined' && global.GameAudio) || null;
    if (audio) {
      try {
        if (spellId === 'linh-vu' && typeof audio.playLinhVu === 'function') {
          audio.playLinhVu();
        } else if (spellId === 'thoi-sinh' && typeof audio.playThoiSinh === 'function') {
          audio.playThoiSinh();
        } else if (spellId === 'dan-linh' && typeof audio.playDanLinh === 'function') {
          audio.playDanLinh();
        } else if (spellId === 'tru-ue' && typeof audio.playTruUe === 'function') {
          audio.playTruUe();
        }
      } catch (e) {}
    }

    if (st && st.savePlayer) st.savePlayer(player);
    return {
      ok: true,
      msg: 'Thi triển ' + def.name + ' thành công! ' + effectMsg,
      spellId: spellId,
      affected: affected,
      uses: sp.uses,
      level: sp.level,
      cooldownUntil: sp.cooldownUntil,
      targetPlotIndex: idx >= 0 ? idx : undefined
    };
  }

  // alias cast functions
  function castLinhVuQuyet(player, plotIndex, nowMs) { return castSpell(player, 'linh-vu', plotIndex, nowMs); }
  function castThoiSinhQuyet(player, plotIndex, nowMs) { return castSpell(player, 'thoi-sinh', plotIndex, nowMs); }
  function castDanLinhQuyet(player, plotIndex, nowMs) { return castSpell(player, 'dan-linh', plotIndex, nowMs); }
  function castTruUeQuyet(player, plotIndex, nowMs) { return castSpell(player, 'tru-ue', plotIndex, nowMs); }

  // ---------------------------------------------------------------------------
  // GIAO DIỆN (giữ nguyên phần lớn, thêm ô khóa)
  // ---------------------------------------------------------------------------
  function formatRemainTime(sec) {
    if (sec <= 0) return '0s';
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (m > 0) return m + 'p ' + (s < 10 ? '0' : '') + s + 's';
    return s + 's';
  }

  function setElementIconSprite(el, def, cellPx) {
    if (!el || !def) return;
    var scale = cellPx / 32;
    el.style.backgroundImage = "url('assets/art/icons-sheet.png')";
    el.style.backgroundSize = (192 * scale) + 'px ' + (256 * scale) + 'px';
    el.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.width = cellPx + 'px';
    el.style.height = cellPx + 'px';
  }

  function openSeedSelector(plotIndex) {
    if (typeof document === 'undefined') return;
    selectedPlotIndex = plotIndex;
    var modal = document.getElementById('linhdien-modal');
    if (!modal) return;
    var selector = document.getElementById('linhdien-seed-selector');
    if (!selector) return;
    var numEl = document.getElementById('selected-plot-num');
    if (numEl) numEl.textContent = (plotIndex + 1);
    selector.classList.remove('hidden');
    renderSeedList();
  }

  function closeSeedSelector() {
    if (typeof document === 'undefined') return;
    selectedPlotIndex = null;
    var selector = document.getElementById('linhdien-seed-selector');
    if (selector) selector.classList.add('hidden');
  }

  function renderSeedList() {
    if (typeof document === 'undefined') return;
    var listEl = document.getElementById('seed-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    var st = getStateAPI();
    var player = livePlayer;
    var keys = Object.keys(PLANTABLE);
    keys.forEach(function (itemId) {
      var plantDef = PLANTABLE[itemId];
      var itemDef = getItemDef(itemId);
      var inBag = (st && player) ? st.countItemInBag(player, itemId) : 0;
      var canPlant = inBag >= (plantDef.seedCost || 1);
      var soilOk = (player && (player.linhDien.soilLevel || 0) >= (plantDef.minSoilLevel || 0));

      var card = document.createElement('div');
      card.className = 'seed-card' + (canPlant && soilOk ? '' : ' disabled');
      card.setAttribute('data-item-id', itemId);

      var iconEl = document.createElement('div');
      iconEl.className = 'seed-card-icon';
      setElementIconSprite(iconEl, itemDef, 36);

      var infoEl = document.createElement('div');
      infoEl.className = 'seed-card-info';

      var nameRow = document.createElement('div');
      nameRow.className = 'seed-card-name-row';
      var nameEl = document.createElement('span');
      nameEl.className = 'seed-card-name';
      nameEl.textContent = plantDef.name;
      var bagEl = document.createElement('span');
      bagEl.className = 'seed-card-bag-count' + (canPlant ? ' has-stock' : ' out-of-stock');
      bagEl.textContent = 'Trong túi: ' + inBag;
      nameRow.appendChild(nameEl);
      nameRow.appendChild(bagEl);

      var detailRow = document.createElement('div');
      detailRow.className = 'seed-card-details';
      detailRow.textContent = 'Lớn: ' + formatRemainTime(plantDef.growSec) + ' · Thu: ' + plantDef.yieldCount + ' phần · Cấp đất: ' + SOIL_LEVELS[plantDef.minSoilLevel || 0].name;

      infoEl.appendChild(nameRow);
      infoEl.appendChild(detailRow);

      var actionEl = document.createElement('button');
      actionEl.className = 'btn wood seed-plant-btn' + (canPlant && soilOk ? '' : ' disabled');
      actionEl.type = 'button';
      actionEl.textContent = (canPlant && soilOk) ? 'Gieo' : (soilOk ? 'Hết giống' : 'Thiếu cấp đất');
      if (!(canPlant && soilOk)) actionEl.disabled = true;
      // PLOTFIX: không gắn listener riêng — cú bấm ủy quyền qua #seed-list trong attach()
      // (danh sách dựng lại mỗi giây, listener trên thẻ con dễ bị nuốt khi bấm đúng biên dựng lại).

      card.appendChild(iconEl);
      card.appendChild(infoEl);
      card.appendChild(actionEl);

      listEl.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // ĐỢT PLOTFIELD: bảng chọn giống TRÊN MAP (mở từ bấm ô trống tại ruộng).
  // Bảng chọn giống cũ nằm trong cửa sổ (chỉ xem) nên không dùng lại được.
  // Luật khóa thẻ giống hệt renderSeedList: đủ giống trong túi + đủ cấp đất.
  // ---------------------------------------------------------------------------
  var fieldSelectedPlotIndex = null;

  function openFieldSeedPanel(plotIndex) {
    if (typeof document === 'undefined') return;
    fieldSelectedPlotIndex = plotIndex;
    var panel = document.getElementById('linhdien-field-seed-panel');
    if (!panel) return;
    var numEl = document.getElementById('field-selected-plot-num');
    if (numEl) numEl.textContent = (plotIndex + 1);
    panel.classList.remove('hidden');
    renderFieldSeedList();
  }

  function closeFieldSeedPanel() {
    if (typeof document === 'undefined') return;
    fieldSelectedPlotIndex = null;
    var panel = document.getElementById('linhdien-field-seed-panel');
    if (panel) panel.classList.add('hidden');
  }

  function renderFieldSeedList() {
    if (typeof document === 'undefined') return;
    var listEl = document.getElementById('field-seed-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    var st = getStateAPI();
    var player = livePlayer;
    var keys = Object.keys(PLANTABLE);
    keys.forEach(function (itemId) {
      var plantDef = PLANTABLE[itemId];
      var itemDef = getItemDef(itemId);
      var inBag = (st && player) ? st.countItemInBag(player, itemId) : 0;
      var canPlant = inBag >= (plantDef.seedCost || 1);
      var soilOk = (player && (player.linhDien.soilLevel || 0) >= (plantDef.minSoilLevel || 0));

      var card = document.createElement('div');
      card.className = 'seed-card' + (canPlant && soilOk ? '' : ' disabled');
      card.setAttribute('data-item-id', itemId);

      var iconEl = document.createElement('div');
      iconEl.className = 'seed-card-icon';
      setElementIconSprite(iconEl, itemDef, 36);

      var infoEl = document.createElement('div');
      infoEl.className = 'seed-card-info';

      var nameRow = document.createElement('div');
      nameRow.className = 'seed-card-name-row';
      var nameEl = document.createElement('span');
      nameEl.className = 'seed-card-name';
      nameEl.textContent = plantDef.name;
      var bagEl = document.createElement('span');
      bagEl.className = 'seed-card-bag-count' + (canPlant ? ' has-stock' : ' out-of-stock');
      bagEl.textContent = 'Trong túi: ' + inBag;
      nameRow.appendChild(nameEl);
      nameRow.appendChild(bagEl);

      var detailRow = document.createElement('div');
      detailRow.className = 'seed-card-details';
      detailRow.textContent = 'Lớn: ' + formatRemainTime(plantDef.growSec) + ' · Thu: ' + plantDef.yieldCount + ' phần · Cấp đất: ' + SOIL_LEVELS[plantDef.minSoilLevel || 0].name;

      infoEl.appendChild(nameRow);
      infoEl.appendChild(detailRow);

      var actionEl = document.createElement('button');
      actionEl.className = 'btn wood seed-plant-btn' + (canPlant && soilOk ? '' : ' disabled');
      actionEl.type = 'button';
      actionEl.textContent = (canPlant && soilOk) ? 'Gieo' : (soilOk ? 'Hết giống' : 'Thiếu cấp đất');
      if (!(canPlant && soilOk)) actionEl.disabled = true;
      // Không gắn listener riêng — ủy quyền qua #field-seed-list trong attach().

      card.appendChild(iconEl);
      card.appendChild(infoEl);
      card.appendChild(actionEl);

      listEl.appendChild(card);
    });
  }

  function goToFieldQuickPath() {
    closePanel();
    closeFieldSeedPanel();
    var eng = (typeof window !== 'undefined') ? window.GameEngine : null;
    if (eng && eng.startAutoPathTo) {
      eng.startAutoPathTo(FIELD_MAP_ID, FIELD_CENTER.x, FIELD_CENTER.y, 90, 'Linh Điền');
    } else if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast('Chưa dẫn đường được, hãy đi bộ tới đồng cỏ đông-nam Miếu Hoang.');
    }
  }

  function renderSpellsBar() {
    if (typeof document === 'undefined') return;
    var barEl = document.getElementById('linhdien-spells-bar');
    if (!barEl) return;
    if (!livePlayer) return;

    barEl.innerHTML = '';
    var now = Date.now();
    var spellKeys = ['linh-vu', 'thoi-sinh', 'tru-ue', 'dan-linh'];

    spellKeys.forEach(function (sid) {
      var def = SPELLS[sid];
      var unlockDef = SPELL_UNLOCKS[sid];
      var sp = livePlayer.linhDien.spells[sid];
      var learned = !!(sp && sp.learned);
      var curLinhLuc = livePlayer.linhLuc || 0;
      var cost = spellCost(sid, sp ? sp.level : 1);
      var cooldownRemain = (sp && sp.cooldownUntil && sp.cooldownUntil > now)
        ? Math.ceil((sp.cooldownUntil - now) / 1000)
        : 0;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-spell';
      btn.setAttribute('data-spell-id', sid);

      // Thẻ ngũ hành (không emoji)
      var elemTag = document.createElement('span');
      elemTag.className = 'spell-elem-tag tag-' + (def.element || 'vo');
      elemTag.textContent = def.element === 'thuy' ? 'Thủy' : (def.element === 'moc' ? 'Mộc' : 'Vô');

      var nameEl = document.createElement('span');
      nameEl.className = 'spell-name';
      nameEl.textContent = def.name;

      var metaEl = document.createElement('span');
      metaEl.className = 'spell-meta';

      var statusEl = document.createElement('span');
      statusEl.className = 'spell-status';

      if (!learned) {
        btn.classList.add('spell-locked');
        metaEl.textContent = 'Cấp: Chưa học';
        statusEl.className += ' status-locked';
        statusEl.textContent = 'Khóa: ' + (unlockDef ? unlockDef.questName : 'Nhiệm vụ');
        btn.title = 'Chưa học. Điều kiện: ' + (unlockDef ? unlockDef.hint : 'Hoàn thành nhiệm vụ');
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
            window.GameUI.showToast(def.name + ' chưa mở khóa. Hãy ' + (unlockDef ? unlockDef.hint : 'làm nhiệm vụ') + '!');
          }
        });
      } else {
        btn.classList.add('spell-learned');
        metaEl.textContent = 'Cấp ' + (sp.level || 1) + ' · ' + cost + ' LL';

        if (cooldownRemain > 0) {
          btn.classList.add('spell-cooldown');
          statusEl.className += ' status-cooldown';
          statusEl.textContent = 'Hồi: ' + cooldownRemain + 's';
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
              window.GameUI.showToast(def.name + ' đang hồi chiêu (còn ' + cooldownRemain + 's).');
            }
          });
        } else if (curLinhLuc < cost) {
          btn.classList.add('spell-no-mana');
          statusEl.className += ' status-no-mana';
          statusEl.textContent = 'Thiếu LL';
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
              window.GameUI.showToast('Linh lực không đủ để thi ' + def.name + ' (cần ' + cost + ' LL, có ' + curLinhLuc + ' LL).');
            }
          });
        } else {
          btn.classList.add('spell-ready');
          statusEl.className += ' status-ready';
          // PLOTFIELD: cửa sổ chỉ xem — không thi triển từ đây. Bấm chỉ hướng
          // dẫn tới ruộng; thi triển thật qua thanh kỹ năng khi đứng tại ruộng.
          statusEl.textContent = 'Tại ruộng';
          btn.title = def.name + ': ra ruộng Linh Điền để thi triển.';
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
              window.GameUI.showToast(def.name + ' chỉ thi triển được tại ruộng Linh Điền. Bấm "Đi nhanh tới Linh Điền" để tới ruộng.');
            }
          });
        }
      }

      btn.appendChild(elemTag);
      btn.appendChild(nameEl);
      btn.appendChild(metaEl);
      btn.appendChild(statusEl);
      barEl.appendChild(btn);
    });
  }

  function renderPanel() {
    if (typeof document === 'undefined') return;
    var gridEl = document.getElementById('linhdien-grid');
    if (!gridEl) return;
    if (!livePlayer) return;

    ensureState(livePlayer);
    syncQuestSpells(livePlayer, true);

    // Cập nhật huy hiệu cấp đất + độ phì trên tiêu đề
    var soilBadge = document.querySelector('#linhdien-modal .linhdien-soil-badge');
    if (soilBadge) {
      soilBadge.textContent = 'Cấp đất: ' + getSoilLevelName(livePlayer) + ' · Độ phì: ' + (livePlayer.linhDien.soilFertility || 0);
    }

    renderSpellsBar();

    gridEl.innerHTML = '';

    var now = Date.now();
    checkPestSpread(livePlayer, now);

    for (var i = 0; i < MAX_PLOTS; i++) {
      (function (plotIndex) {
        var unlocked = isPlotUnlocked(livePlayer, plotIndex);

        var plotEl = document.createElement('div');

        if (!unlocked) {
          plotEl.className = 'linhdien-plot-card plot-state-locked';
          plotEl.setAttribute('data-plot-index', plotIndex);
          var headEl = document.createElement('div');
          headEl.className = 'plot-card-header';
          var titleEl = document.createElement('span');
          titleEl.className = 'plot-card-title';
          titleEl.textContent = 'Ô #' + (plotIndex + 1);
          var badgeEl = document.createElement('span');
          badgeEl.className = 'plot-card-badge badge-locked';
          badgeEl.textContent = 'Khóa';
          headEl.appendChild(titleEl);
          headEl.appendChild(badgeEl);
          plotEl.appendChild(headEl);
          var bodyEl = document.createElement('div');
          bodyEl.className = 'plot-card-body';
          var condEl = document.createElement('div');
          condEl.className = 'plot-locked-cond';
          condEl.textContent = getPlotUnlockCondition(livePlayer, plotIndex);
          bodyEl.appendChild(condEl);
          plotEl.appendChild(bodyEl);
          gridEl.appendChild(plotEl);
          return;
        }

        var view = plotView(livePlayer, plotIndex, now);
        var plantDef = view.itemId ? PLANTABLE[view.itemId] : null;

        plotEl.className = 'linhdien-plot-card plot-state-' + view.state;
        plotEl.setAttribute('data-plot-index', plotIndex);

        var headEl2 = document.createElement('div');
        headEl2.className = 'plot-card-header';
        var titleEl2 = document.createElement('span');
        titleEl2.className = 'plot-card-title';
        titleEl2.textContent = 'Ô #' + (plotIndex + 1);
        var badgeEl2 = document.createElement('span');
        badgeEl2.className = 'plot-card-badge';
        headEl2.appendChild(titleEl2);
        headEl2.appendChild(badgeEl2);
        plotEl.appendChild(headEl2);

        var bodyEl2 = document.createElement('div');
        bodyEl2.className = 'plot-card-body';

        if (view.state === 'empty') {
          badgeEl2.textContent = 'Trống';
          badgeEl2.className += ' badge-empty';
          // GIAI ĐOẠN 2: miếng đất luống cắt từ nền V7 thay gò đất CSS.
          var emptyBed = document.createElement('div');
          emptyBed.className = 'plot-bed-visual plot-bed-empty';
          var emptyHint = document.createElement('div');
          emptyHint.className = 'empty-hint';
          // PLOTFIELD: cửa sổ chỉ xem — không gieo từ đây.
          emptyHint.textContent = 'Trống — tới ruộng để gieo';
          emptyBed.appendChild(emptyHint);
          bodyEl2.appendChild(emptyBed);
          // PLOTFIX: không gắn listener riêng — cú bấm ủy quyền qua #linhdien-grid trong attach().
        } else if (view.state === 'growing') {
          var stageLabels = ['Mầm', 'Cây non', 'Trưởng thành'];
          badgeEl2.textContent = stageLabels[view.stage] || 'Đang lớn';
          badgeEl2.className += ' badge-growing';

          // Chỉ báo CẦN SKILL trên header (Đợt PEST - Bui 03:07)
          if (view.needSkill) {
            plotEl.classList.add('plot-need-skill');
            var needSkillBadge = document.createElement('span');
            needSkillBadge.className = 'plot-card-badge badge-need-skill';
            needSkillBadge.textContent = 'CẦN SKILL';
            headEl2.appendChild(needSkillBadge);
          }

          // GIAI ĐOẠN 2: cây HERB-REDRAW động 8 khung trên nền luống V7.
          // Giai đoạn lớn lấy từ view.stage (0 mầm / 1 non / 2 trưởng thành);
          // trạng thái lấy theo ưu tiên bệnh > sâu > cỏ; timer chung đổi khung.
          var visualWrap = document.createElement('div');
          visualWrap.className = 'plot-bed-visual';
          var herbState = herbRedrawState(view);
          var imgEl = document.createElement('img');
          imgEl.className = 'plot-herb-img plot-herb-anim';
          imgEl.setAttribute('data-herb-item', view.itemId);
          imgEl.setAttribute('data-herb-stage', view.stage);
          imgEl.setAttribute('data-herb-state', herbState);
          imgEl.src = herbRedrawSrc(view.itemId, view.stage, herbState, herbFrameIndex);
          imgEl.alt = plantDef ? plantDef.name : 'Cây linh dược';
          visualWrap.appendChild(imgEl);
          var herbNameEl = document.createElement('div');
          herbNameEl.className = 'plot-herb-name';
          herbNameEl.textContent = plantDef ? plantDef.name : view.itemId;

          var progressWrap = document.createElement('div');
          progressWrap.className = 'plot-progress-bar-wrap';
          var barEl = document.createElement('div');
          barEl.className = 'plot-progress-bar';
          var fillEl = document.createElement('div');
          fillEl.className = 'plot-progress-fill';
          fillEl.style.width = (view.progress * 100).toFixed(1) + '%';
          barEl.appendChild(fillEl);

          if (view.watered) plotEl.classList.add('plot-watered');
          if (view.weed) plotEl.classList.add('plot-has-weed');
          if (view.pest) plotEl.classList.add('plot-has-pest');
          if (view.disease) plotEl.classList.add('plot-has-disease');
          if (view.weed || view.pest || view.disease) plotEl.classList.add('plot-infested');

          var timeEl = document.createElement('div');
          timeEl.className = 'plot-remain-time';

          var timeText = 'Còn ' + formatRemainTime(view.remainSec) + ' (' + Math.floor(view.progress * 100) + '%)' + (view.watered ? ' · Đã tưới' : '');
          if (view.needSkill) {
            timeText += ' · [CẦN SKILL!]';
          } else if (view.skillRemainSec > 0) {
            timeText += ' · Cần skill: ' + view.skillRemainSec + 's';
          }
          if (view.weed) timeText += ' · Cỏ dại';
          if (view.pest) timeText += ' · Sâu linh';
          if (view.disease) timeText += ' · Uế bệnh';
          timeEl.textContent = timeText;

          progressWrap.appendChild(barEl);
          progressWrap.appendChild(timeEl);

          bodyEl2.appendChild(visualWrap);
          bodyEl2.appendChild(herbNameEl);
          bodyEl2.appendChild(progressWrap);

          // Tags uế nhiễm trực quan sẵn có (zero emoji)
          var tagsWrap = document.createElement('div');
          tagsWrap.className = 'plot-pest-tags';
          if (view.weed) {
            var weedTag = document.createElement('span');
            weedTag.className = 'plot-pest-tag tag-weed';
            weedTag.textContent = 'Cỏ dại';
            tagsWrap.appendChild(weedTag);
          }
          if (view.pest) {
            var pestTag = document.createElement('span');
            pestTag.className = 'plot-pest-tag tag-pest';
            pestTag.textContent = 'Sâu linh';
            tagsWrap.appendChild(pestTag);
          }
          if (view.disease) {
            var diseaseTag = document.createElement('span');
            diseaseTag.className = 'plot-pest-tag tag-disease';
            diseaseTag.textContent = 'Uế bệnh';
            tagsWrap.appendChild(diseaseTag);
          }
          if (tagsWrap.children.length > 0) {
            bodyEl2.appendChild(tagsWrap);
          }

          // PLOTFIX: không gắn listener riêng — cú bấm ủy quyền qua #linhdien-grid trong attach().
        } else if (view.state === 'ready' || view.state === 'withered') {
          badgeEl2.textContent = view.state === 'withered' ? 'Héo' : 'Chín';
          badgeEl2.className += view.state === 'withered' ? ' badge-withered' : ' badge-ready';

          // GIAI ĐOẠN 2: chín = hình chín HERB-REDRAW + phát sáng + nhịp đập;
          // héo = cây trưởng thành đứng yên, không phát sáng (phân biệt rõ với chín).
          var readyVisual = document.createElement('div');
          readyVisual.className = 'plot-bed-visual' + (view.state === 'ready' ? ' ready-glow' : '');
          var readyImg = document.createElement('img');
          if (view.state === 'ready') {
            readyImg.className = 'plot-herb-img ready-pulse';
            readyImg.src = herbReadySrc(view.itemId);
          } else {
            readyImg.className = 'plot-herb-img';
            readyImg.src = herbRedrawSrc(view.itemId, 2, 'clean', 0);
          }
          readyImg.alt = plantDef ? plantDef.name : 'Cây linh dược';
          readyVisual.appendChild(readyImg);
          var readyNameEl = document.createElement('div');
          readyNameEl.className = 'plot-herb-name ready-gold';
          readyNameEl.textContent = (plantDef ? plantDef.name : view.itemId) + ' · ' + (view.grade || '');

          // PLOTFIELD: cửa sổ chỉ xem — không còn nút Thu Hoạch; chỉ hiện dòng
          // thông tin hướng dẫn tới ruộng. Thu hoạch thật bằng cách bấm ô trên map.
          var harvestHint = document.createElement('div');
          harvestHint.className = 'plot-harvest-hint';
          var yieldCnt = plantDef ? plantDef.yieldCount : 1;
          if (view.state === 'withered') yieldCnt = Math.max(1, yieldCnt - 1);
          harvestHint.textContent = (view.state === 'withered' ? 'Héo' : 'Chín') + ' — tới ruộng để thu hoạch (+' + yieldCnt + ')';

          bodyEl2.appendChild(readyVisual);
          bodyEl2.appendChild(readyNameEl);
          bodyEl2.appendChild(harvestHint);
        }

        plotEl.appendChild(bodyEl2);
        gridEl.appendChild(plotEl);
      })(i);
    }

    var selector = document.getElementById('linhdien-seed-selector');
    if (selector && !selector.classList.contains('hidden') && selectedPlotIndex !== null) {
      renderSeedList();
    }
  }

  function openPanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('linhdien-modal');
    if (!modal) return;
    closeSeedSelector();
    modal.classList.remove('hidden');
    renderPanel();
    preloadHerbFrames();
    startHerbFrameTimer();
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    refreshTimer = setInterval(function () {
      if (!modal || modal.classList.contains('hidden')) { clearInterval(refreshTimer); refreshTimer = null; return; }
      renderPanel();
    }, 1000);
  }

  function closePanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('linhdien-modal');
    if (modal) modal.classList.add('hidden');
    closeSeedSelector();
    stopHerbFrameTimer();
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  function attach(player) {
    livePlayer = player;
    ensureState(livePlayer);
    if (typeof document === 'undefined') return;
    var btnHud = document.getElementById('btn-linhdien');
    if (btnHud && !btnHud.dataset.wired) {
      btnHud.dataset.wired = '1';
      btnHud.addEventListener('click', function () { openPanel(); });
    }
    var btnClose = document.getElementById('close-linhdien-modal');
    if (btnClose && !btnClose.dataset.wired) {
      btnClose.dataset.wired = '1';
      btnClose.addEventListener('click', function () { closePanel(); });
    }
    var btnCloseSelector = document.getElementById('close-seed-selector');
    if (btnCloseSelector && !btnCloseSelector.dataset.wired) {
      btnCloseSelector.dataset.wired = '1';
      btnCloseSelector.addEventListener('click', function (e) { e.stopPropagation(); closeSeedSelector(); });
    }
    var modal = document.getElementById('linhdien-modal');
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) { if (e.target === modal) closePanel(); });
    }
    // PLOTFIELD: nút "Đi nhanh tới Linh Điền" trong cửa sổ chỉ xem.
    var btnQuickPath = document.getElementById('btn-linhdien-quickpath');
    if (btnQuickPath && !btnQuickPath.dataset.wired) {
      btnQuickPath.dataset.wired = '1';
      btnQuickPath.addEventListener('click', function () { goToFieldQuickPath(); });
    }
    // PLOTFIELD: bảng chọn giống trên map — nút đóng + ủy quyền bấm thẻ giống
    // qua #field-seed-list (cha tĩnh, cùng mẫu PLOTFIX).
    var btnCloseFieldPanel = document.getElementById('close-field-seed-panel');
    if (btnCloseFieldPanel && !btnCloseFieldPanel.dataset.wired) {
      btnCloseFieldPanel.dataset.wired = '1';
      btnCloseFieldPanel.addEventListener('click', function (e) { e.stopPropagation(); closeFieldSeedPanel(); });
    }
    var fieldSeedListEl = document.getElementById('field-seed-list');
    if (fieldSeedListEl && !fieldSeedListEl.dataset.plotfieldWired) {
      fieldSeedListEl.dataset.plotfieldWired = '1';
      fieldSeedListEl.addEventListener('click', function (e) {
        var card = (e.target && e.target.closest) ? e.target.closest('.seed-card') : null;
        if (!card || !livePlayer || fieldSelectedPlotIndex === null) return;
        var itemId = card.getAttribute('data-item-id');
        if (!itemId) return;
        var plantDef = PLANTABLE[itemId];
        if (!plantDef) return;
        var st = getStateAPI();
        var inBag = st ? st.countItemInBag(livePlayer, itemId) : 0;
        var canPlant = inBag >= (plantDef.seedCost || 1);
        var soilOk = (livePlayer.linhDien.soilLevel || 0) >= (plantDef.minSoilLevel || 0);
        if (!(canPlant && soilOk)) return;
        var res = plant(livePlayer, fieldSelectedPlotIndex, itemId);
        if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(res.msg);
        if (res.ok && typeof window !== 'undefined' && window.GameEngine && window.GameEngine.spawnFloatingText) {
          var cfg = FIELD_PLOTS_CONFIG[fieldSelectedPlotIndex];
          if (cfg) window.GameEngine.spawnFloatingText('Đã gieo!', cfg.x, cfg.y - 20, '#7ce898');
        }
        closeFieldSeedPanel();
      });
    }
    // PLOTFIX: ủy quyền cú bấm thẻ ô + thẻ giống qua phần tử cha tĩnh (#linhdien-grid, #seed-list).
    // Lưới dựng lại toàn bộ mỗi 1s (renderPanel), listener gắn trên thẻ con có thể bị nuốt khi cú bấm
    // rơi đúng biên dựng lại; listener trên cha tĩnh không bao giờ bị thay nên không mất cú bấm.
    // Hành vi từng trạng thái giữ nguyên hệt như listener cũ (chỉ tính lại view tại thời điểm bấm).
    var gridEl = document.getElementById('linhdien-grid');
    if (gridEl && !gridEl.dataset.plotfixWired) {
      gridEl.dataset.plotfixWired = '1';
      gridEl.addEventListener('click', function (e) {
        var card = (e.target && e.target.closest) ? e.target.closest('.linhdien-plot-card') : null;
        if (!card || !livePlayer) return;
        var plotIndex = parseInt(card.getAttribute('data-plot-index'), 10);
        if (isNaN(plotIndex)) return;
        if (!isPlotUnlocked(livePlayer, plotIndex)) return; // ô khóa: im lặng như trước
        var view = plotView(livePlayer, plotIndex, Date.now());
        var plantDef = view.itemId ? PLANTABLE[view.itemId] : null;
        // PLOTFIELD: cửa sổ chỉ xem — mọi thao tác (gieo/thu hoạch) chỉ làm
        // được tại ruộng trên map. Bấm thẻ chỉ hiện thông tin/hướng dẫn.
        if (view.state === 'empty') {
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
            window.GameUI.showToast('Ô #' + (plotIndex + 1) + ' đang trống. Ra ruộng Linh Điền để gieo trồng (bấm "Đi nhanh tới Linh Điền").');
          }
        } else if (view.state === 'growing') {
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
            var herbName = plantDef ? plantDef.name : view.itemId;
            var toastMsg = herbName + ' đang lớn: ' + Math.floor(view.progress * 100) + '% (còn ' + formatRemainTime(view.remainSec) + ').';
            if (view.needSkill) toastMsg += ' Đang cần dùng pháp quyết chăm sóc!';
            else toastMsg += ' Cần skill sau ' + view.skillRemainSec + 's.';
            window.GameUI.showToast(toastMsg);
          }
        } else if (view.state === 'ready' || view.state === 'withered') {
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
            window.GameUI.showToast('Ô #' + (plotIndex + 1) + ' đã ' + (view.state === 'withered' ? 'héo' : 'chín') + '. Ra ruộng Linh Điền để thu hoạch (bấm "Đi nhanh tới Linh Điền").');
          }
        }
      });
    }
    var seedListEl = document.getElementById('seed-list');
    if (seedListEl && !seedListEl.dataset.plotfixWired) {
      seedListEl.dataset.plotfixWired = '1';
      seedListEl.addEventListener('click', function (e) {
        var card = (e.target && e.target.closest) ? e.target.closest('.seed-card') : null;
        if (!card || !livePlayer || selectedPlotIndex === null) return;
        var itemId = card.getAttribute('data-item-id');
        if (!itemId) return;
        var plantDef = PLANTABLE[itemId];
        if (!plantDef) return;
        var st = getStateAPI();
        var inBag = st ? st.countItemInBag(livePlayer, itemId) : 0;
        var canPlant = inBag >= (plantDef.seedCost || 1);
        var soilOk = (livePlayer.linhDien.soilLevel || 0) >= (plantDef.minSoilLevel || 0);
        if (!(canPlant && soilOk)) return; // thẻ bị khóa/hết giống: im lặng như trước
        var res = plant(livePlayer, selectedPlotIndex, itemId);
        if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(res.msg);
        closeSeedSelector();
        renderPanel();
      });
    }
    if (!document.body.dataset.linhdienEscWired) {
      document.body.dataset.linhdienEscWired = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var sel = document.getElementById('linhdien-seed-selector');
          if (sel && !sel.classList.contains('hidden')) { closeSeedSelector(); return; }
          var md = document.getElementById('linhdien-modal');
          if (md && !md.classList.contains('hidden')) closePanel();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Xuất API
  // ---------------------------------------------------------------------------
  exports.ensureState = ensureState;
  exports.MAX_PLOTS = MAX_PLOTS;
  exports.TOTAL_PLOTS = TOTAL_PLOTS;
  exports.INITIAL_PLOTS = INITIAL_PLOTS;
  exports.SOIL_LEVELS = SOIL_LEVELS;
  exports.PLANTABLE = PLANTABLE;
  exports.SPELLS = SPELLS;
  exports.SINH_MAP = SINH_MAP;
  exports.KHAC_MAP = KHAC_MAP;
  exports.WITHER_GRACE_SEC = WITHER_GRACE_SEC;

  exports.getSoilLevel = getSoilLevel;
  exports.getSoilLevelId = getSoilLevelId;
  exports.getSoilLevelDef = getSoilLevelDef;
  exports.getSoilLevelName = getSoilLevelName;
  exports.upgradeSoil = upgradeSoil;
  exports.upgradeSoilLevel = upgradeSoil;

  exports.maxUnlockedPlots = maxUnlockedPlots;
  exports.getUnlockedPlotCount = getUnlockedPlotCount;
  exports.isPlotUnlocked = isPlotUnlocked;
  exports.getPlotUnlockCondition = getPlotUnlockCondition;

  exports.synergyMultiplier = synergyMultiplier;
  exports.isSynergyGood = isSynergyGood;
  exports.isSynergyBad = isSynergyBad;

  exports.removeWeed = removeWeed;
  exports.removePest = removePest;
  exports.removeDisease = removeDisease;
  exports.waterPlot = waterPlot;
  exports.water = waterPlot;
  exports.fertilize = fertilize;
  exports.applyFertilizer = fertilize;

  exports.setPestRNG = setPestRNG;
  exports.setPestRates = setPestRates;
  exports.resetPestConfig = resetPestConfig;
  exports.generatePestSchedule = generatePestSchedule;
  exports.checkPestSpread = checkPestSpread;
  exports.pestConfig = pestConfig;
  exports.PLANTABLE = PLANTABLE;

  exports.plotView = plotView;
  exports.calcQuality = calcQuality;
  exports.qualityGrade = qualityGrade;

  exports.plant = plant;
  exports.plantSeed = plant;
  exports.harvest = harvest;

  exports.getSpellDef = getSpellDef;
  exports.listSpells = listSpells;
  exports.isSpellLearned = isSpellLearned;
  exports.learnSpell = learnSpell;
  exports.unlockSpell = learnSpell;
  exports.spellLevel = spellLevel;
  exports.spellCost = spellCost;
  exports.castSpell = castSpell;
  exports.castLinhVuQuyet = castLinhVuQuyet;
  exports.castThoiSinhQuyet = castThoiSinhQuyet;
  exports.castDanLinhQuyet = castDanLinhQuyet;
  exports.castTruUeQuyet = castTruUeQuyet;
  exports.SPELL_UNLOCKS = SPELL_UNLOCKS;
  exports.syncQuestSpells = syncQuestSpells;
  exports.renderSpellsBar = renderSpellsBar;
  exports.ELDER_DEMO_STEPS = ELDER_DEMO_STEPS;
  exports.executeElderDemoStep = executeElderDemoStep;
  exports.simulateElderDemo = simulateElderDemo;
  exports.learnAllSpellsFromElder = learnAllSpellsFromElder;
  exports.lastCastResult = lastCastResult;

  exports.attach = attach;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;

  // PLOTFIELD: hình học ruộng trên map + hình cây dùng lại cho engine vẽ.
  exports.FIELD_MAP_ID = FIELD_MAP_ID;
  exports.FIELD_PLOTS_CONFIG = FIELD_PLOTS_CONFIG;
  exports.FIELD_CENTER = FIELD_CENTER;
  exports.FIELD_SKILL_RADIUS = FIELD_SKILL_RADIUS;
  exports.FIELD_SIGN = FIELD_SIGN;
  exports.getFieldPlotsConfig = getFieldPlotsConfig;
  exports.getFieldCenter = getFieldCenter;
  exports.openFieldSeedPanel = openFieldSeedPanel;
  exports.closeFieldSeedPanel = closeFieldSeedPanel;
  exports.goToFieldQuickPath = goToFieldQuickPath;
  exports.herbRedrawSrc = herbRedrawSrc;
  exports.herbRedrawState = herbRedrawState;
  exports.herbReadySrc = herbReadySrc;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameLinhDien = {}));
