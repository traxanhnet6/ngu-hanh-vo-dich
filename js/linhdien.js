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
      element: 'moc', tier: 1, minSoilLevel: 0, desc: 'Linh diệp phát sáng linh quang, dược liệu nhập môn ngũ hành.'
    },
    'linh-chi-rung': {
      itemId: 'linh-chi-rung', name: 'Linh Chi Rừng', growSec: 600, yieldCount: 2, seedCost: 1,
      element: 'moc', tier: 2, minSoilLevel: 1, desc: 'Linh chi tụ linh mộc khí, nguyên liệu luyện đan quý giá.'
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
      desc: 'Thúc cây lớn nhanh một nhịp — tốn linh lực nhiều, dùng dồn dập làm cây chín ép giảm phẩm chất. Cho tu vi đường Mộc.'
    },
    'dan-linh': {
      id: 'dan-linh', name: 'Dẫn Linh Quyết', element: null, path: null,
      baseCost: 6, baseCooldownSec: 40, tuViElem: null, tuViAmount: 0, // PROVISIONAL
      desc: 'Dẫn linh khí vào đất, giữ độ phì của thửa và hồi linh khí cho đất sau mỗi vụ.'
    },
    'tru-ue': {
      id: 'tru-ue', name: 'Trừ Uế Quyết', element: 'moc', path: 'moc',
      baseCost: 6, baseCooldownSec: 25, tuViElem: 'moc', tuViAmount: 2, // PROVISIONAL
      desc: 'Xua sâu linh và cỏ dại mà không phải làm tay từng ô.'
    }
  };

  var livePlayer = null;
  var refreshTimer = null;
  var selectedPlotIndex = null;

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

  function waterPlot(player, plotIndex, nowMs) {
    ensureState(player);
    if (plotIndex < 0 || plotIndex >= MAX_PLOTS) return { ok: false, msg: 'Ô đất không hợp lệ.' };
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) return { ok: false, msg: 'Ô đất trống.' };
    plot.watered = true;
    plot.waterCount = (plot.waterCount || 0) + 1;
    plot.lastWateredAt = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
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
  // plotView
  // ---------------------------------------------------------------------------
  function calcQuality(plot, plantDef, withered) {
    var q = 1.0;
    var soilElem = (plot && plot.soilElement) || 'thuy';
    var plantElem = (plot && plot.element) || (plantDef && plantDef.element) || 'moc';
    if (isSynergyGood(soilElem, plantElem)) q += 0.5; // PROVISIONAL
    if (plot && plot.watered) q += 0.2; // PROVISIONAL
    if (plot && plot.fertilizedCount) q += 0.2 * plot.fertilizedCount; // PROVISIONAL
    if (plot && plot.forcedCount) q -= 0.25 * plot.forcedCount; // chín ép
    if (withered) q -= 0.5; // PROVISIONAL
    if (plot && (plot.weed || plot.pest)) q -= 0.2;
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

  function plotView(player, plotIndex, nowMs) {
    if (!player || plotIndex < 0 || plotIndex >= MAX_PLOTS) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, withered: false, weed: false, pest: false, watered: false, quality: 1 };
    }
    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot || !plot.itemId || !plot.plantedAt) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, withered: false, weed: false, pest: false, watered: false, quality: 1 };
    }

    var plantDef = PLANTABLE[plot.itemId];
    if (!plantDef) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, withered: false, weed: false, pest: false, watered: false, quality: 1 };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var soilElem = plot.soilElement || 'thuy';
    var plantElem = plot.element || plantDef.element || 'moc';
    var syn = synergyMultiplier(soilElem, plantElem);
    var waterFactor = plot.watered ? 0.75 : 1.0;
    var weedFactor = (plot.weed || plot.pest) ? 1.15 : 1.0;
    var fertFactor = plot.fertilizedCount > 0 ? Math.max(0.85, 1 - 0.05 * plot.fertilizedCount) : 1.0;
    var growSec = plantDef.growSec * syn * waterFactor * weedFactor * fertFactor;

    // cỏ dại / sâu linh xuất hiện theo thời gian
    var weed = plot.weedCleared ? false : (now >= plot.plantedAt + plantDef.growSec * 1000 * 0.4);
    var pest = plot.pestCleared ? false : (now >= plot.plantedAt + plantDef.growSec * 1000 * 0.7);
    plot.weed = weed;
    plot.pest = pest;

    var elapsedSec = Math.max(0, (now - plot.plantedAt) / 1000);

    if (elapsedSec >= growSec + WITHER_GRACE_SEC) {
      var qW = calcQuality(plot, plantDef, true);
      return { state: 'withered', itemId: plot.itemId, progress: 1.0, remainSec: 0, stage: 2, withered: true, weed: weed, pest: pest, watered: !!plot.watered, quality: qW, grade: qualityGrade(qW) };
    }

    if (elapsedSec >= growSec) {
      var qR = calcQuality(plot, plantDef, false);
      return { state: 'ready', itemId: plot.itemId, progress: 1.0, remainSec: 0, stage: 2, withered: false, weed: weed, pest: pest, watered: !!plot.watered, quality: qR, grade: qualityGrade(qR) };
    }

    var progress = Math.max(0, Math.min(0.9999, elapsedSec / growSec));
    var remainSec = Math.max(0, Math.ceil(growSec - elapsedSec));

    var stage = 0;
    if (progress >= 0.66) stage = 2;
    else if (progress >= 0.33) stage = 1;

    return { state: 'growing', itemId: plot.itemId, progress: progress, remainSec: remainSec, stage: stage, withered: false, weed: weed, pest: pest, watered: !!plot.watered, quality: calcQuality(plot, plantDef, false), grade: qualityGrade(calcQuality(plot, plantDef, false)) };
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
      watered: false,
      waterCount: 0,
      lastWateredAt: 0,
      fertilizedCount: 0,
      qualityBonus: 0,
      weed: false,
      weedCleared: false,
      pest: false,
      pestCleared: false,
      forcedCount: 0
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
    var itemId = plot.itemId;
    var quality = view.quality || calcQuality(plot, plantDef, withered);

    var st = getStateAPI();
    var m = getMonstersAPI();
    var itemDefs = m ? m.ITEM_DEFS : null;

    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.', itemId: itemId, count: 0 };

    var addRes = st.addItemToBag(player, itemId, yieldCount, itemDefs);
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
      grade: qualityGrade(quality),
      withered: withered
    };
  }

  // ---------------------------------------------------------------------------
  // Pháp quyết
  // ---------------------------------------------------------------------------
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
    player.linhDien.spells[spellId].learned = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã học ' + SPELLS[spellId].name + '.', spellId: spellId };
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
    if (!isSpellLearned(player, spellId)) return { ok: false, msg: 'Chưa học pháp quyết này.' };

    var ld = player.linhDien;
    var sp = ld.spells[spellId];
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();

    if (sp.cooldownUntil && now < sp.cooldownUntil) {
      return { ok: false, msg: 'Đang hồi chiêu.', code: 'cooldown' };
    }

    var cost = spellCost(spellId, sp.level || 1);
    var st = getStateAPI();
    if ((player.linhLuc || 0) < cost) {
      return { ok: false, msg: 'Linh lực không đủ (cần ' + cost + ').', code: 'cost' };
    }

    player.linhLuc -= cost;

    var affected = 0;
    if (spellId === 'linh-vu') {
      // tưới tất cả ô đã mở đang có cây
      for (var i = 0; i < (ld.unlockedPlots || INITIAL_PLOTS); i++) {
        var p = ld.plots[i];
        if (p && p.itemId) {
          p.watered = true;
          p.waterCount = (p.waterCount || 0) + 1;
          p.lastWateredAt = now;
          affected++;
        }
      }
    } else if (spellId === 'thoi-sinh') {
      var idx = (typeof plotIndex === 'number') ? plotIndex : -1;
      if (idx < 0 || idx >= MAX_PLOTS || !ld.plots[idx]) {
        // tìm ô đang lớn đầu tiên
        for (var j = 0; j < (ld.unlockedPlots || INITIAL_PLOTS); j++) {
          if (ld.plots[j] && ld.plots[j].itemId) { idx = j; break; }
        }
      }
      if (idx >= 0 && ld.plots[idx]) {
        var plot = ld.plots[idx];
        // thúc lớn: lùi thời điểm gieo 40% thời gian lớn (PROVISIONAL)
        var plantDef = PLANTABLE[plot.itemId];
        var boostSec = plantDef ? Math.round(plantDef.growSec * 0.4) : 120;
        plot.plantedAt = plot.plantedAt - boostSec * 1000;
        plot.forcedCount = (plot.forcedCount || 0) + 1;
        affected = 1;
      }
    } else if (spellId === 'tru-ue') {
      for (var k = 0; k < (ld.unlockedPlots || INITIAL_PLOTS); k++) {
        var pp = ld.plots[k];
        if (pp) {
          pp.weed = false;
          pp.pest = false;
          pp.weedCleared = true;
          pp.pestCleared = true;
          affected++;
        }
      }
    } else if (spellId === 'dan-linh') {
      ld.soilFertility = (ld.soilFertility || 0) + (sp.level || 1);
      affected = (ld.unlockedPlots || INITIAL_PLOTS);
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

    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, msg: 'Đã thi ' + def.name + '.', spellId: spellId, affected: affected, uses: sp.uses, level: sp.level };
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
      else {
        actionEl.addEventListener('click', function (e) {
          e.stopPropagation();
          if (selectedPlotIndex === null) return;
          var res = plant(player, selectedPlotIndex, itemId);
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(res.msg);
          closeSeedSelector();
          renderPanel();
        });
      }

      card.appendChild(iconEl);
      card.appendChild(infoEl);
      card.appendChild(actionEl);

      if (canPlant && soilOk) {
        card.addEventListener('click', function () {
          if (selectedPlotIndex === null) return;
          var res = plant(player, selectedPlotIndex, itemId);
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(res.msg);
          closeSeedSelector();
          renderPanel();
        });
      }

      listEl.appendChild(card);
    });
  }

  function renderPanel() {
    if (typeof document === 'undefined') return;
    var gridEl = document.getElementById('linhdien-grid');
    if (!gridEl) return;
    if (!livePlayer) return;

    ensureState(livePlayer);
    gridEl.innerHTML = '';

    var now = Date.now();

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
          var emptyPrompt = document.createElement('div');
          emptyPrompt.className = 'plot-empty-prompt';
          emptyPrompt.innerHTML = '<div class="empty-soil-mound"></div><div class="empty-hint">+ Chạm để gieo</div>';
          bodyEl2.appendChild(emptyPrompt);
          plotEl.addEventListener('click', function () { openSeedSelector(plotIndex); });
        } else if (view.state === 'growing') {
          var stageLabels = ['Mầm', 'Cây non', 'Trưởng thành'];
          badgeEl2.textContent = stageLabels[view.stage] || 'Đang lớn';
          badgeEl2.className += ' badge-growing';

          var visualWrap = document.createElement('div');
          visualWrap.className = 'plot-herb-visual-wrap';
          if (view.itemId === 'la-thanh-tuy') {
            var imgEl = document.createElement('img');
            imgEl.className = 'plot-herb-img stage-' + view.stage;
            imgEl.src = 'assets/art/herb-la-thanh-tuy.png';
            imgEl.alt = plantDef ? plantDef.name : 'Lá Thanh Tụy';
            visualWrap.appendChild(imgEl);
          } else {
            var spriteEl = document.createElement('div');
            spriteEl.className = 'plot-herb-sprite stage-' + view.stage;
            var itemDef = getItemDef(view.itemId);
            setElementIconSprite(spriteEl, itemDef, 56);
            visualWrap.appendChild(spriteEl);
          }
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
          var timeEl = document.createElement('div');
          timeEl.className = 'plot-remain-time';
          timeEl.textContent = 'Còn ' + formatRemainTime(view.remainSec) + ' (' + Math.floor(view.progress * 100) + '%)' + (view.weed ? ' · Cỏ dại' : '') + (view.pest ? ' · Sâu linh' : '');

          progressWrap.appendChild(barEl);
          progressWrap.appendChild(timeEl);

          bodyEl2.appendChild(visualWrap);
          bodyEl2.appendChild(herbNameEl);
          bodyEl2.appendChild(progressWrap);

          plotEl.addEventListener('click', function () {
            if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
              window.GameUI.showToast(herbNameEl.textContent + ' đang lớn: ' + Math.floor(view.progress * 100) + '% (còn ' + formatRemainTime(view.remainSec) + ').');
            }
          });
        } else if (view.state === 'ready' || view.state === 'withered') {
          badgeEl2.textContent = view.state === 'withered' ? 'Héo' : 'Chín';
          badgeEl2.className += view.state === 'withered' ? ' badge-withered' : ' badge-ready';

          var readyVisual = document.createElement('div');
          readyVisual.className = 'plot-herb-visual-wrap ready-glow';
          if (view.itemId === 'la-thanh-tuy') {
            var readyImg = document.createElement('img');
            readyImg.className = 'plot-herb-img stage-2 ready-pulse';
            readyImg.src = 'assets/art/herb-la-thanh-tuy.png';
            readyImg.alt = plantDef ? plantDef.name : 'Lá Thanh Tụy';
            readyVisual.appendChild(readyImg);
          } else {
            var readySprite = document.createElement('div');
            readySprite.className = 'plot-herb-sprite stage-2 ready-pulse';
            var readyDef = getItemDef(view.itemId);
            setElementIconSprite(readySprite, readyDef, 56);
            readyVisual.appendChild(readySprite);
          }
          var readyNameEl = document.createElement('div');
          readyNameEl.className = 'plot-herb-name ready-gold';
          readyNameEl.textContent = (plantDef ? plantDef.name : view.itemId) + ' · ' + (view.grade || '');

          var harvestBtn = document.createElement('button');
          harvestBtn.className = 'btn wood btn-harvest-plot';
          harvestBtn.type = 'button';
          var yieldCnt = plantDef ? plantDef.yieldCount : 1;
          if (view.state === 'withered') yieldCnt = Math.max(1, yieldCnt - 1);
          harvestBtn.textContent = 'Thu Hoạch (+' + yieldCnt + ')';

          var doHarvest = function (e) {
            if (e) e.stopPropagation();
            var res = harvest(livePlayer, plotIndex);
            if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(res.msg);
            if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) window.GameAudio.playChime();
            renderPanel();
          };
          harvestBtn.addEventListener('click', doHarvest);
          plotEl.addEventListener('click', doHarvest);

          bodyEl2.appendChild(readyVisual);
          bodyEl2.appendChild(readyNameEl);
          bodyEl2.appendChild(harvestBtn);
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
  exports.waterPlot = waterPlot;
  exports.water = waterPlot;
  exports.fertilize = fertilize;
  exports.applyFertilizer = fertilize;

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

  exports.attach = attach;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameLinhDien = {}));
