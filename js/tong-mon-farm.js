/**
 * js/tong-mon-farm.js — Hệ Thống Canh Tác Linh Mễ Tông Môn & Việc Vụ Tông (Đợt LINHME-MAP)
 *
 * Thiết kế theo Brief Bổ Sung LINHME-MAP & LINHME-MAP-DESIGN.md.
 * Tính năng:
 *  1. 32 ô trống trên Map Riêng Ruộng Linh Mễ (`ruong-linh-me` 1200x800).
 *  2. Toàn bộ 32 ô bắt đầu TRỐNG (null), người chơi chủ động gieo hạt.
 *  3. Cây trồng chủ lực: Linh Mễ (vật phẩm mới, 180s, sản lượng 3-5).
 *     Hỗ trợ gieo thêm Lá Thanh Tụy, Linh Chi Rừng.
 *  4. Thao tác tiện lợi: Gieo từng ô / Gieo nhanh tất cả / Thu hoạch tất cả.
 *  5. Tách biệt hoàn toàn với Linh Điền sau Miếu Hoang (player.tongMonFarm).
 *  6. Việc vụ tông môn (Sect Quests) lặp lại + Điểm hội tụ E4 (congHien, QUEST_DEFS).
 *  7. Kỹ Năng Ruộng (4 Pháp Quyết Canh Tác): Linh Vũ Quyết, Thôi Sinh Quyết,
 *     Dẫn Linh Quyết, Trừ Uế Quyết — Dùng chung state chuẩn với đợt SPELLS.
 *
 * Chạy trên trình duyệt (window.GameTongMonFarm) và Node.js (require/exports).
 */

(function (exports) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. TỌA ĐỘ 32 Ô TRỒNG TRÊN MAP RIÊNG RUỘNG LINH MỄ (ruong-linh-me: 1200 x 800)
  // ---------------------------------------------------------------------------

  var TOTAL_PLOTS = 32;

  var PLOTS_CONFIG = [
    // --- PHÂN KHU 1: Thượng Điền (Tây Bắc) — 8 ô (4 hàng x 2 cột) ---
    { id: 0, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 0, col: 0, x: 300, y: 160, radius: 22 },
    { id: 1, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 0, col: 1, x: 390, y: 160, radius: 22 },
    { id: 2, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 1, col: 0, x: 300, y: 205, radius: 22 },
    { id: 3, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 1, col: 1, x: 390, y: 205, radius: 22 },
    { id: 4, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 2, col: 0, x: 300, y: 250, radius: 22 },
    { id: 5, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 2, col: 1, x: 390, y: 250, radius: 22 },
    { id: 6, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 3, col: 0, x: 300, y: 295, radius: 22 },
    { id: 7, bedId: 'dec_bed1', zoneId: 'zone_thuong_dien', bedName: 'Thượng Điền', row: 3, col: 1, x: 390, y: 295, radius: 22 },

    // --- PHÂN KHU 2: Trung Điền (Trung Tâm) — 6 ô (2 hàng x 3 cột) ---
    { id: 8,  bedId: 'dec_bed2', zoneId: 'zone_trung_dien', bedName: 'Trung Điền', row: 0, col: 0, x: 580, y: 190, radius: 22 },
    { id: 9,  bedId: 'dec_bed2', zoneId: 'zone_trung_dien', bedName: 'Trung Điền', row: 0, col: 1, x: 660, y: 190, radius: 22 },
    { id: 10, bedId: 'dec_bed2', zoneId: 'zone_trung_dien', bedName: 'Trung Điền', row: 0, col: 2, x: 740, y: 190, radius: 22 },
    { id: 11, bedId: 'dec_bed2', zoneId: 'zone_trung_dien', bedName: 'Trung Điền', row: 1, col: 0, x: 580, y: 260, radius: 22 },
    { id: 12, bedId: 'dec_bed2', zoneId: 'zone_trung_dien', bedName: 'Trung Điền', row: 1, col: 1, x: 660, y: 260, radius: 22 },
    { id: 13, bedId: 'dec_bed2', zoneId: 'zone_trung_dien', bedName: 'Trung Điền', row: 1, col: 2, x: 740, y: 260, radius: 22 },

    // --- PHÂN KHU 3: Hạ Điền 1 (Tây Nam) — 6 ô (2 hàng x 3 cột) ---
    { id: 14, bedId: 'dec_bed3', zoneId: 'zone_ha_dien_1', bedName: 'Hạ Điền 1', row: 0, col: 0, x: 360, y: 490, radius: 22 },
    { id: 15, bedId: 'dec_bed3', zoneId: 'zone_ha_dien_1', bedName: 'Hạ Điền 1', row: 0, col: 1, x: 440, y: 490, radius: 22 },
    { id: 16, bedId: 'dec_bed3', zoneId: 'zone_ha_dien_1', bedName: 'Hạ Điền 1', row: 0, col: 2, x: 520, y: 490, radius: 22 },
    { id: 17, bedId: 'dec_bed3', zoneId: 'zone_ha_dien_1', bedName: 'Hạ Điền 1', row: 1, col: 0, x: 360, y: 560, radius: 22 },
    { id: 18, bedId: 'dec_bed3', zoneId: 'zone_ha_dien_1', bedName: 'Hạ Điền 1', row: 1, col: 1, x: 440, y: 560, radius: 22 },
    { id: 19, bedId: 'dec_bed3', zoneId: 'zone_ha_dien_1', bedName: 'Hạ Điền 1', row: 1, col: 2, x: 520, y: 560, radius: 22 },

    // --- PHÂN KHU 4: Hạ Điền 2 (Đông Nam) — 4 ô (4 hàng x 1 cột) ---
    { id: 20, bedId: 'dec_bed4', zoneId: 'zone_ha_dien_2', bedName: 'Hạ Điền 2', row: 0, col: 0, x: 750, y: 450, radius: 22 },
    { id: 21, bedId: 'dec_bed4', zoneId: 'zone_ha_dien_2', bedName: 'Hạ Điền 2', row: 1, col: 0, x: 750, y: 500, radius: 22 },
    { id: 22, bedId: 'dec_bed4', zoneId: 'zone_ha_dien_2', bedName: 'Hạ Điền 2', row: 2, col: 0, x: 750, y: 550, radius: 22 },
    { id: 23, bedId: 'dec_bed4', zoneId: 'zone_ha_dien_2', bedName: 'Hạ Điền 2', row: 3, col: 0, x: 750, y: 600, radius: 22 },

    // --- PHÂN KHU 5: Đông Điền (Đông Bắc) — 8 ô (4 hàng x 2 cột) ---
    { id: 24, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 0, col: 0, x: 900, y: 160, radius: 22 },
    { id: 25, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 0, col: 1, x: 990, y: 160, radius: 22 },
    { id: 26, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 1, col: 0, x: 900, y: 205, radius: 22 },
    { id: 27, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 1, col: 1, x: 990, y: 205, radius: 22 },
    { id: 28, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 2, col: 0, x: 900, y: 250, radius: 22 },
    { id: 29, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 2, col: 1, x: 990, y: 250, radius: 22 },
    { id: 30, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 3, col: 0, x: 900, y: 295, radius: 22 },
    { id: 31, bedId: 'dec_bed5', zoneId: 'zone_dong_dien', bedName: 'Đông Điền', row: 3, col: 1, x: 990, y: 295, radius: 22 }
  ];

  // ---------------------------------------------------------------------------
  // 2. DANH MỤC CÂY TRỒNG TẠI TÔNG MÔN (PROVISIONAL)
  // ---------------------------------------------------------------------------

  var PLANTABLE_SECT = {
    'linh-me': {
      itemId: 'linh-me',
      name: 'Linh Mễ',
      seedId: 'hat-giong-linh-me',
      seedName: 'Hạt Giống Linh Mễ',
      growSec: 180, // 3 phút (PROVISIONAL)
      yieldMin: 3,  // 3-5 hạt (PROVISIONAL)
      yieldMax: 5,
      element: 'moc',
      desc: 'Hạt giống lúa tiên ngập tràn linh khí Mộc, lương thực nền của Tông Môn.'
    },
    'la-thanh-tuy': {
      itemId: 'la-thanh-tuy',
      name: 'Lá Thanh Tụy',
      seedId: 'la-thanh-tuy',
      seedName: 'Lá Thanh Tụy (Nhánh)',
      growSec: 300,
      yieldMin: 2,
      yieldMax: 2,
      element: 'moc',
      desc: 'Dược thảo Mộc Thanh Tụy nuôi dưỡng kinh mạch.'
    },
    'linh-chi-rung': {
      itemId: 'linh-chi-rung',
      name: 'Linh Chi Rừng',
      seedId: 'linh-chi-rung',
      seedName: 'Linh Chi Rừng (Bào tử)',
      growSec: 600,
      yieldMin: 2,
      yieldMax: 2,
      element: 'moc',
      desc: 'Linh Chi đỏ bồi bổ nguyên thần.'
    }
  };

  // ---------------------------------------------------------------------------
  // 3. KỸ NĂNG RUỘNG (4 PHÁP QUYẾT CANH TÁC) — DÙNG CHUNG BỘ VỚI ĐỢT SPELLS
  // Hội tụ MERGE-LINHDIEN (Bui 01:32 + lệnh gộp 08:34): chi phí/hồi chiêu/tu vi
  // lấy CHUẨN từ SPELLS trong js/linhdien.js (linh-vu 8/30s/Thủy×2, thoi-sinh
  // 12/20s/Mộc×3, dan-linh 6/40s/không tu vi, tru-ue 6/25s/Mộc×2; phí +2/cấp).
  // ---------------------------------------------------------------------------

  var FARM_SPELLS = {
    'linh-vu': {
      id: 'linh-vu',
      name: 'Linh Vũ Quyết',
      icon: 'Thủy',
      element: 'thuy',
      costMP: 8, // PROVISIONAL (chuẩn SPELLS)
      cooldownSec: 30, // PROVISIONAL (chuẩn SPELLS)
      tuViElem: 'thuy',
      tuViAmount: 2, // PROVISIONAL (chuẩn SPELLS)
      learnReq: { realmRank: 0, sectQuestCount: 0, costLT: 0, desc: 'Nhập môn (Dược Sư truyền thụ miễn phí)' },
      desc: 'Gọi mưa linh nhuần trạch, tưới nước đồng loạt cho toàn bộ các ô đang trồng, rút ngắn 25% thời gian lớn.'
    },
    'thoi-sinh': {
      id: 'thoi-sinh',
      name: 'Thôi Sinh Quyết',
      icon: 'Mộc',
      element: 'moc',
      costMP: 12, // PROVISIONAL (chuẩn SPELLS)
      cooldownSec: 20, // PROVISIONAL (chuẩn SPELLS)
      tuViElem: 'moc',
      tuViAmount: 3, // PROVISIONAL (chuẩn SPELLS)
      learnReq: { realmRank: 1, sectQuestCount: 1, costLT: 50, desc: 'Luyện Khí tầng 1 + 1 việc tông + 50 LT' },
      desc: 'Ngưng tụ Mộc linh khí thúc đẩy sinh trưởng, rút ngắn ngay 45 giây cho tất cả các cây đang lớn trên ruộng.'
    },
    'dan-linh': {
      id: 'dan-linh',
      name: 'Dẫn Linh Quyết',
      icon: 'Thổ',
      element: 'tho',
      costMP: 6, // PROVISIONAL (chuẩn SPELLS)
      cooldownSec: 40, // PROVISIONAL (chuẩn SPELLS)
      tuViElem: null, // chuẩn SPELLS: Dẫn Linh không cho tu vi
      tuViAmount: 0, // PROVISIONAL (chuẩn SPELLS)
      learnReq: { realmRank: 2, sectQuestCount: 2, costLT: 100, desc: 'Luyện Khí tầng 2 + 2 việc tông + 100 LT' },
      desc: 'Dẫn địa linh mạch vào thổ nhưỡng, ban phước tăng sản lượng thu hoạch (+1 đến +2 mễ mỗi ô khi chín).'
    },
    'tru-ue': {
      id: 'tru-ue',
      name: 'Trừ Uế Quyết',
      icon: 'Mộc',
      element: 'moc',
      costMP: 6, // PROVISIONAL (chuẩn SPELLS)
      cooldownSec: 25, // PROVISIONAL (chuẩn SPELLS)
      tuViElem: 'moc',
      tuViAmount: 2, // PROVISIONAL (chuẩn SPELLS)
      learnReq: { realmRank: 1, sectQuestCount: 1, costLT: 30, desc: 'Luyện Khí tầng 1 + 30 LT' },
      desc: 'Thanh tẩy chướng khí và độc tố, bảo vệ cây trồng sinh trưởng khỏe mạnh, đạt phẩm chất thượng hạng.'
    }
  };

  // Chi phí thi triển theo cấp (chuẩn SPELLS: phí gốc + 2 mỗi cấp trên 1).
  function getFarmSpellCost(player, spellId) {
    var def = FARM_SPELLS[spellId];
    if (!def) return 0;
    var lvl = 1;
    if (player && player.linhDien && player.linhDien.spells && player.linhDien.spells[spellId]) {
      lvl = player.linhDien.spells[spellId].level || 1;
    }
    return (def.costMP || 10) + Math.max(0, lvl - 1) * 2;
  }

  // ---------------------------------------------------------------------------
  // 3b. SÂU BỆNH CỎ DẠI NGẪU NHIÊN TRÊN RUỘNG (mirror đợt PEST — Bui 03:07)
  // Cùng tỉ lệ/cửa sổ/lây lan với PEST trong js/linhdien.js. PROVISIONAL.
  // ---------------------------------------------------------------------------
  var farmPestConfig = {
    rates: { weed: 0.35, pest: 0.30, disease: 0.25 },
    windows: { weed: [0.20, 0.45], pest: [0.45, 0.70], disease: [0.60, 0.85] },
    spreadRate: 0.10,
    rng: Math.random
  };

  function setFarmPestRNG(fn) {
    farmPestConfig.rng = (typeof fn === 'function') ? fn : Math.random;
  }

  function setFarmPestRates(rates) {
    if (!rates) return;
    if (typeof rates.weed === 'number') farmPestConfig.rates.weed = rates.weed;
    if (typeof rates.pest === 'number') farmPestConfig.rates.pest = rates.pest;
    if (typeof rates.disease === 'number') farmPestConfig.rates.disease = rates.disease;
    if (typeof rates.spreadRate === 'number') farmPestConfig.spreadRate = rates.spreadRate;
  }

  function resetFarmPestConfig() {
    farmPestConfig.rates.weed = 0.35;
    farmPestConfig.rates.pest = 0.30;
    farmPestConfig.rates.disease = 0.25;
    farmPestConfig.spreadRate = 0.10;
    farmPestConfig.rng = Math.random;
  }

  function generateFarmPestSchedule(plotIdx, itemId, plantedAt, growSec) {
    var rng = farmPestConfig.rng || Math.random;
    var sched = {};
    var rollWeed = rng();
    if (rollWeed < farmPestConfig.rates.weed) {
      var wWin = farmPestConfig.windows.weed;
      sched.weedAt = wWin[0] + rng() * (wWin[1] - wWin[0]);
    } else {
      sched.weedAt = null;
    }
    var rollPest = rng();
    if (rollPest < farmPestConfig.rates.pest) {
      var pWin = farmPestConfig.windows.pest;
      sched.pestAt = pWin[0] + rng() * (pWin[1] - pWin[0]);
    } else {
      sched.pestAt = null;
    }
    var rollDis = rng();
    if (rollDis < farmPestConfig.rates.disease) {
      var dWin = farmPestConfig.windows.disease;
      sched.diseaseAt = dWin[0] + rng() * (dWin[1] - dWin[0]);
    } else {
      sched.diseaseAt = null;
    }
    return sched;
  }

  // Lây lan sang ô kề (chỉ sâu + bệnh, như PEST). Chỉ gọi khi dựng lại modal
  // ruộng (cùng nhịp với PEST), KHÔNG gọi mỗi khung hình.
  function checkFarmPestSpread(player, now) {
    if (!player || !player.tongMonFarm || !player.tongMonFarm.plots) return;
    var plots = player.tongMonFarm.plots;
    var rng = farmPestConfig.rng || Math.random;
    var len = Math.min(plots.length, TOTAL_PLOTS);
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
              if (p.pest && !np.pest && !np.pestCleared && rng() < farmPestConfig.spreadRate) {
                np.pest = true;
              }
              if (p.disease && !np.disease && !np.diseaseCleared && rng() < farmPestConfig.spreadRate) {
                np.disease = true;
              }
            }
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. NHIỆM VỤ TÔNG MÔN (SECT QUESTS) & ĐIỂM HỘI TỤ E4
  // ---------------------------------------------------------------------------

  var SECT_QUESTS = [
    {
      id: 'quest_sect_linhme_basic',
      name: 'Canh Tác Linh Mễ',
      desc: 'Gieo trồng và nộp 10 Linh Mễ cho Dược Sư để bổ sung lương thực cho Tông Môn.',
      starterSeeds: 4,
      requirements: [{ itemId: 'linh-me', count: 10, name: 'Linh Mễ' }],
      rewardLT: 30,
      rewardItems: [{ itemId: 'com-linh-me', count: 1, name: 'Cơm Linh Mễ' }],
      congHien: 15 // Điểm cống hiến E4
    },
    {
      id: 'quest_sect_linhme_advanced',
      name: 'Cung Ứng Lương Thực Tông Môn',
      desc: 'Nộp 25 Linh Mễ và 2 Lá Thanh Tụy để chuẩn bị ẩm thực cho toàn thể đệ tử.',
      starterSeeds: 0,
      requirements: [
        { itemId: 'linh-me', count: 25, name: 'Linh Mễ' },
        { itemId: 'la-thanh-tuy', count: 2, name: 'Lá Thanh Tụy' }
      ],
      rewardLT: 80,
      rewardItems: [{ itemId: 'com-linh-me-hap', count: 2, name: 'Cơm Linh Mễ Hấp Băng Tinh' }],
      congHien: 40 // Điểm cống hiến E4
    }
  ];

  // ---------------------------------------------------------------------------
  // 5. HELPER FUNCTIONS & STATE MANAGEMENT
  // ---------------------------------------------------------------------------

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }

  function getRealmRank(player) {
    var st = getStateAPI();
    if (st && st.getRealmRank) return st.getRealmRank(player);
    return 0;
  }

  /**
   * Đảm bảo tính toàn vẹn trạng thái dữ liệu người chơi.
   * Đồng thời chuẩn hóa và chia sẻ bảng spells trong player.linhDien.spells với đợt SPELLS.
   */
  function ensureState(player) {
    if (!player) return null;
    if (!player.tongMonFarm || typeof player.tongMonFarm !== 'object') {
      player.tongMonFarm = {
        version: 2,
        plots: []
      };
    }
    var f = player.tongMonFarm;
    if (!Array.isArray(f.plots)) f.plots = [];
    while (f.plots.length < TOTAL_PLOTS) {
      f.plots.push(null);
    }
    // Nhiệm vụ tông môn
    if (!player.sectQuests || typeof player.sectQuests !== 'object') {
      player.sectQuests = {
        activeQuestId: null,
        completedCount: {},
        starterGiven: {}
      };
    }
    // Đồng bộ và chia sẻ bảng spells với đợt SPELLS (player.linhDien.spells)
    ensureFarmSpells(player);
    return f;
  }

  function ensureFarmSpells(player) {
    if (!player) return null;
    if (!player.linhDien || typeof player.linhDien !== 'object') {
      player.linhDien = { soilLevel: 0, unlockedPlots: 6, plots: [], spells: {}, soilFertility: 0 };
    }
    if (!player.linhDien.spells || typeof player.linhDien.spells !== 'object') {
      player.linhDien.spells = {};
    }
    var lds = player.linhDien.spells;
    var keys = Object.keys(FARM_SPELLS);
    for (var i = 0; i < keys.length; i++) {
      var sid = keys[i];
      if (!lds[sid] || typeof lds[sid] !== 'object') {
        lds[sid] = { learned: false, uses: 0, level: 1, cooldownUntil: 0 };
      } else {
        if (typeof lds[sid].learned !== 'boolean') lds[sid].learned = !!lds[sid].learned;
        if (typeof lds[sid].uses !== 'number' || lds[sid].uses < 0) lds[sid].uses = 0;
        if (typeof lds[sid].level !== 'number' || lds[sid].level < 1) lds[sid].level = 1;
        if (typeof lds[sid].cooldownUntil !== 'number') lds[sid].cooldownUntil = 0;
      }
    }
    return lds;
  }

  function getPlotsConfig() {
    return PLOTS_CONFIG;
  }

  function getPlantDef(itemId) {
    return PLANTABLE_SECT[itemId] || null;
  }

  // ---------------------------------------------------------------------------
  // 6. LOGIC CANH TÁC (PLOT VIEW, PLANT, WATER, HARVEST)
  // ---------------------------------------------------------------------------

  /**
   * Xem trạng thái ô đất theo thời gian thực (nowMs).
   */
  function getPlotView(player, plotIdx, nowMs) {
    if (!player || plotIdx < 0 || plotIdx >= TOTAL_PLOTS) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, weed: false, pest: false, disease: false, watered: false, skillIntervalSec: 0, skillRemainSec: 0, needSkill: false, needSkillHint: '' };
    }
    ensureState(player);
    var plot = player.tongMonFarm.plots[plotIdx];
    if (!plot || !plot.itemId || !plot.plantedAt) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, weed: false, pest: false, disease: false, watered: false, skillIntervalSec: 0, skillRemainSec: 0, needSkill: false, needSkillHint: '' };
    }

    var plantDef = PLANTABLE_SECT[plot.itemId];
    if (!plantDef) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0, weed: false, pest: false, disease: false, watered: false, skillIntervalSec: 0, skillRemainSec: 0, needSkill: false, needSkillHint: '' };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var baseGrowSec = plot.growSec || plantDef.growSec;
    var elapsedSec = Math.max(0, (now - plot.plantedAt) / 1000);

    // Sâu bệnh cỏ dại ngẫu nhiên (mirror PEST): lịch gieo lúc trồng, ô cũ hồi tố.
    if (!plot.pestSchedule) {
      plot.pestSchedule = generateFarmPestSchedule(plotIdx, plot.itemId, plot.plantedAt, baseGrowSec);
    }
    var sched = plot.pestSchedule || {};
    var weed = !!plot.weed;
    if (plot.weedCleared) {
      weed = false;
    } else if (sched.weedAt !== null && sched.weedAt !== undefined && elapsedSec >= baseGrowSec * sched.weedAt) {
      weed = true;
    }
    var pest = !!plot.pest;
    if (plot.pestCleared) {
      pest = false;
    } else if (sched.pestAt !== null && sched.pestAt !== undefined && elapsedSec >= baseGrowSec * sched.pestAt) {
      pest = true;
    }
    var disease = !!plot.disease;
    if (plot.diseaseCleared) {
      disease = false;
    } else if (sched.diseaseAt !== null && sched.diseaseAt !== undefined && elapsedSec >= baseGrowSec * sched.diseaseAt) {
      disease = true;
    }
    plot.weed = weed;
    plot.pest = pest;
    plot.disease = disease;

    // Hậu quả uế nhiễm: mỗi loại làm chậm lớn 10% (chuẩn PEST, PROVISIONAL)
    var pestCount = (weed ? 1 : 0) + (pest ? 1 : 0) + (disease ? 1 : 0);
    var weedFactor = pestCount > 0 ? (1.0 + 0.10 * pestCount) : 1.0;

    var waterFactor = plot.watered ? 0.75 : 1.0;
    var growSec = baseGrowSec * waterFactor * weedFactor;

    // Chu kỳ cần skill (mirror PEST): 30% thời gian lớn, tối thiểu 30s.
    var skillInterval = plantDef.skillIntervalSec || Math.max(30, Math.round(baseGrowSec * 0.30));
    var lastSkill = (plot.lastSkillAt !== undefined && plot.lastSkillAt !== null) ? plot.lastSkillAt : plot.plantedAt;
    var nextSkillAt = lastSkill + skillInterval * 1000;
    var skillRemainSec = Math.max(0, Math.ceil((nextSkillAt - now) / 1000));
    var needSkill = (skillRemainSec === 0);

    if (elapsedSec >= growSec) {
      return {
        state: 'ready',
        itemId: plot.itemId,
        name: plantDef.name,
        progress: 1.0,
        remainSec: 0,
        stage: 2,
        watered: !!plot.watered,
        weed: weed, pest: pest, disease: disease,
        yieldBonus: plot.yieldBonus || 0,
        cleansed: !!plot.cleansed,
        skillIntervalSec: skillInterval, skillRemainSec: 0, needSkill: false, needSkillHint: ''
      };
    }

    var progress = Math.max(0, Math.min(0.9999, elapsedSec / growSec));
    var remainSec = Math.max(0, Math.ceil(growSec - elapsedSec));
    var stage = 0;
    if (progress >= 0.66) stage = 2;
    else if (progress >= 0.33) stage = 1;

    return {
      state: 'growing',
      itemId: plot.itemId,
      name: plantDef.name,
      progress: progress,
      remainSec: remainSec,
      stage: stage,
      watered: !!plot.watered,
      weed: weed, pest: pest, disease: disease,
      yieldBonus: plot.yieldBonus || 0,
      cleansed: !!plot.cleansed,
      skillIntervalSec: skillInterval, skillRemainSec: skillRemainSec, needSkill: needSkill,
      needSkillHint: needSkill ? 'CẦN SKILL' : ('Cần skill sau ' + skillRemainSec + 's')
    };
  }

  /**
   * Gieo hạt vào một ô đất trống.
   */
  function plant(player, plotIdx, itemId, nowMs) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    if (plotIdx < 0 || plotIdx >= TOTAL_PLOTS) return { ok: false, msg: 'Ô đất không hợp lệ.' };

    ensureState(player);
    if (player.tongMonFarm.plots[plotIdx]) {
      return { ok: false, msg: 'Ô đất này đã có cây trồng.' };
    }

    var plantDef = PLANTABLE_SECT[itemId];
    if (!plantDef) {
      return { ok: false, msg: 'Loại hạt giống không hợp lệ.' };
    }

    var st = getStateAPI();
    if (!st || !st.countItemInBag) return { ok: false, msg: 'GameState chưa sẵn sàng.' };

    var seedCount = st.countItemInBag(player, plantDef.seedId);
    if (seedCount < 1) {
      return { ok: false, msg: 'Không có ' + plantDef.seedName + ' trong túi đồ.' };
    }

    var removed = st.removeItemFromBag(player, plantDef.seedId, 1);
    if (!removed) {
      return { ok: false, msg: 'Trừ hạt giống thất bại.' };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    player.tongMonFarm.plots[plotIdx] = {
      itemId: itemId,
      plantId: itemId,
      plantedAt: now,
      growSec: plantDef.growSec,
      watered: false,
      waterCount: 0,
      yieldBonus: 0,
      cleansed: false,
      weed: false, pest: false, disease: false,
      weedCleared: false, pestCleared: false, diseaseCleared: false,
      lastSkillAt: now,
      pestSchedule: generateFarmPestSchedule(plotIdx, itemId, now, plantDef.growSec)
    };

    if (st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      msg: 'Đã gieo ' + plantDef.name + ' vào ô ' + (plotIdx + 1) + '.',
      plotIdx: plotIdx,
      itemId: itemId,
      plantId: itemId
    };
  }

  /**
   * Gieo nhanh tất cả ô trống bằng hạt giống có trong túi.
   */
  function plantAll(player, itemId, nowMs) {
    if (!player) return { ok: false, count: 0, plantedCount: 0, msg: 'Chưa có nhân vật.' };
    ensureState(player);
    var plantDef = PLANTABLE_SECT[itemId];
    if (!plantDef) return { ok: false, count: 0, plantedCount: 0, msg: 'Loại hạt giống không hợp lệ.' };

    var st = getStateAPI();
    if (!st) return { ok: false, count: 0, plantedCount: 0, msg: 'GameState chưa sẵn sàng.' };

    var availableSeeds = st.countItemInBag(player, plantDef.seedId);
    if (availableSeeds <= 0) {
      return { ok: false, count: 0, plantedCount: 0, msg: 'Không có ' + plantDef.seedName + ' trong túi.' };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var plantedCount = 0;

    for (var i = 0; i < TOTAL_PLOTS; i++) {
      if (!player.tongMonFarm.plots[i] && availableSeeds > 0) {
        st.removeItemFromBag(player, plantDef.seedId, 1);
        player.tongMonFarm.plots[i] = {
          itemId: itemId,
          plantId: itemId,
          plantedAt: now,
          growSec: plantDef.growSec,
          watered: false,
          waterCount: 0,
          yieldBonus: 0,
          cleansed: false,
          weed: false, pest: false, disease: false,
          weedCleared: false, pestCleared: false, diseaseCleared: false,
          lastSkillAt: now,
          pestSchedule: generateFarmPestSchedule(i, itemId, now, plantDef.growSec)
        };
        availableSeeds--;
        plantedCount++;
      }
    }

    if (plantedCount > 0 && st.savePlayer) {
      st.savePlayer(player);
    }

    return {
      ok: plantedCount > 0,
      count: plantedCount,
      plantedCount: plantedCount,
      msg: plantedCount > 0
        ? ('Đã gieo nhanh ' + plantedCount + ' ô ' + plantDef.name + '!')
        : 'Không có ô đất trống nào để gieo.'
    };
  }

  /**
   * Tưới nước cho ô đất (rút ngắn thời gian sinh trưởng 25%).
   */
  function water(player, plotIdx, nowMs) {
    if (!player || plotIdx < 0 || plotIdx >= TOTAL_PLOTS) {
      return { ok: false, msg: 'Ô đất không hợp lệ.' };
    }
    ensureState(player);
    var plot = player.tongMonFarm.plots[plotIdx];
    if (!plot) return { ok: false, msg: 'Ô đất đang trống.' };
    if (plot.watered) return { ok: false, msg: 'Ô này đã được tưới nước đầy đủ.' };

    plot.watered = true;
    plot.waterCount = (plot.waterCount || 0) + 1;

    var plantDef = PLANTABLE_SECT[plot.itemId];
    var baseGrow = plot.growSec || (plantDef ? plantDef.growSec : 180);
    var savedSec = Math.round(baseGrow * 0.25);

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      msg: 'Đã tưới nước cho ô ' + (plotIdx + 1) + ' — cây lớn nhanh hơn 25% (tiết kiệm ' + savedSec + 's)!',
      savedSec: savedSec
    };
  }

  /**
   * Thu hoạch 1 ô đất đã chín.
   */
  function harvest(player, plotIdx, nowMs) {
    if (!player || plotIdx < 0 || plotIdx >= TOTAL_PLOTS) {
      return { ok: false, msg: 'Ô đất không hợp lệ.' };
    }
    ensureState(player);
    var view = getPlotView(player, plotIdx, nowMs);
    if (view.state !== 'ready') {
      return { ok: false, msg: 'Cây chưa chín, còn ' + view.remainSec + ' giây.' };
    }

    var plot = player.tongMonFarm.plots[plotIdx];
    var plantDef = PLANTABLE_SECT[plot.itemId];
    var yieldCount = plantDef.yieldMin;
    if (plantDef.yieldMax > plantDef.yieldMin) {
      yieldCount += Math.floor(Math.random() * (plantDef.yieldMax - plantDef.yieldMin + 1));
    }
    // Cộng thưởng từ Dẫn Linh Quyết nếu có
    if (plot.yieldBonus && plot.yieldBonus > 0) {
      yieldCount += plot.yieldBonus;
    }
    // Uế bệnh lúc thu: -1 sản lượng, tối thiểu 1 (chuẩn PEST, PROVISIONAL)
    if (view.disease) yieldCount = Math.max(1, yieldCount - 1);

    var st = getStateAPI();
    if (!st || !st.addItemToBag) return { ok: false, msg: 'Lỗi thêm vật phẩm vào túi.' };

    st.addItemToBag(player, plot.itemId, yieldCount);
    player.tongMonFarm.plots[plotIdx] = null; // Ô trở về trạng thái trống
    if (st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      msg: 'Thu hoạch thành công ' + yieldCount + ' ' + plantDef.name + '!',
      itemId: plot.itemId,
      name: plantDef.name,
      count: yieldCount
    };
  }

  /**
   * Thu hoạch tất cả các ô đã chín (`ready`).
   */
  function harvestAll(player, nowMs) {
    if (!player) return { ok: false, totalItems: {}, count: 0, msg: 'Chưa có nhân vật.' };
    ensureState(player);

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var harvestCount = 0;
    var totalItems = {};
    var st = getStateAPI();

    for (var i = 0; i < TOTAL_PLOTS; i++) {
      var view = getPlotView(player, i, now);
      if (view.state === 'ready') {
        var plot = player.tongMonFarm.plots[i];
        var plantDef = PLANTABLE_SECT[plot.itemId];
        var yCount = plantDef.yieldMin;
        if (plantDef.yieldMax > plantDef.yieldMin) {
          yCount += Math.floor(Math.random() * (plantDef.yieldMax - plantDef.yieldMin + 1));
        }
        if (plot.yieldBonus && plot.yieldBonus > 0) {
          yCount += plot.yieldBonus;
        }
        if (view.disease) yCount = Math.max(1, yCount - 1); // Uế bệnh: -1, tối thiểu 1
        st.addItemToBag(player, plot.itemId, yCount);
        totalItems[plot.itemId] = (totalItems[plot.itemId] || 0) + yCount;
        player.tongMonFarm.plots[i] = null;
        harvestCount++;
      }
    }

    if (harvestCount > 0 && st.savePlayer) {
      st.savePlayer(player);
    }

    var summary = [];
    var totalYield = 0;
    var keys = Object.keys(totalItems);
    for (var k = 0; k < keys.length; k++) {
      totalYield += totalItems[keys[k]];
      var pDef = PLANTABLE_SECT[keys[k]];
      summary.push(totalItems[keys[k]] + ' ' + (pDef ? pDef.name : keys[k]));
    }

    return {
      ok: harvestCount > 0,
      count: harvestCount,
      harvestedPlots: harvestCount,
      totalYield: totalYield,
      totalItems: totalItems,
      msg: harvestCount > 0
        ? ('Đã thu hoạch ' + harvestCount + ' ô chín: +' + summary.join(', ') + '!')
        : 'Chưa có ô nào chín để thu hoạch.'
    };
  }

  // ---------------------------------------------------------------------------
  // 7. HỆ THỐNG KỸ NĂNG RUỘNG (4 PHÁP QUYẾT CANH TÁC)
  // ---------------------------------------------------------------------------

  function getFarmSpells() {
    return FARM_SPELLS;
  }

  function getSpellDef(spellId) {
    return FARM_SPELLS[spellId] || null;
  }

  function listFarmSpells() {
    return Object.keys(FARM_SPELLS).map(function (k) { return FARM_SPELLS[k]; });
  }

  function isSpellLearned(player, spellId) {
    if (!player) return false;
    ensureFarmSpells(player);
    var sp = player.linhDien.spells[spellId];
    return !!(sp && sp.learned);
  }

  function learnSpell(player, spellId) {
    if (!player) return { ok: false, msg: 'Chưa có nhân vật.' };
    ensureFarmSpells(player);
    var def = FARM_SPELLS[spellId];
    if (!def) return { ok: false, msg: 'Pháp quyết không tồn tại.' };

    player.linhDien.spells[spellId].learned = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return { ok: true, msg: 'Đã lĩnh ngộ ' + def.name + '!', spellId: spellId };
  }

  /**
   * Thỉnh giáo học pháp quyết từ Dược Sư Tông Môn theo điều kiện môn quy.
   * LƯU Ý HỘI TỤ (Bui 01:32): giao diện không còn gọi đường này — 4 pháp quyết
   * chỉ học qua Trưởng Lão Dược Điền + nhiệm vụ nhập tông. Giữ hàm vì API/test
   * cũ còn dùng; không mở đường học mới từ hàm này.
   */
  function learnSpellFromTeacher(player, spellId) {
    if (!player) return { ok: false, msg: 'Chưa có nhân vật.' };
    ensureState(player);
    var def = FARM_SPELLS[spellId];
    if (!def) return { ok: false, msg: 'Pháp quyết không tồn tại.' };

    if (isSpellLearned(player, spellId)) {
      return { ok: false, msg: 'Đạo hữu đã học thành thạo ' + def.name + ' rồi.' };
    }

    var rank = getRealmRank(player);
    var req = def.learnReq;
    if (rank < req.realmRank) {
      return { ok: false, msg: 'Cảnh giới chưa đủ (yêu cầu ' + req.desc + ').' };
    }

    var completedQuests = 0;
    if (player.sectQuests && player.sectQuests.completedCount) {
      var qkeys = Object.keys(player.sectQuests.completedCount);
      for (var q = 0; q < qkeys.length; q++) {
        completedQuests += player.sectQuests.completedCount[qkeys[q]] || 0;
      }
    }
    if (completedQuests < req.sectQuestCount) {
      return { ok: false, msg: 'Chưa đủ cống hiến việc tông (cần hoàn thành ít nhất ' + req.sectQuestCount + ' việc).' };
    }

    if (req.costLT > 0) {
      if ((player.linhThach || 0) < req.costLT) {
        return { ok: false, msg: 'Thiếu Linh Thạch thỉnh giáo (cần ' + req.costLT + ' LT).' };
      }
      player.linhThach -= req.costLT;
    }

    player.linhDien.spells[spellId].learned = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      msg: 'Dược Sư đã truyền thụ bí kíp ' + def.name + ' cho đạo hữu!',
      spellId: spellId
    };
  }

  /**
   * Thi triển Pháp Quyết Canh Tác trên Ruộng Linh Mễ.
   */
  function castFarmSpell(player, spellId, nowMs) {
    if (!player) return { ok: false, msg: 'Chưa có nhân vật.' };
    ensureState(player);

    var def = FARM_SPELLS[spellId];
    if (!def) return { ok: false, msg: 'Pháp quyết không hợp lệ.' };

    if (!isSpellLearned(player, spellId)) {
      return { ok: false, code: 'not_learned', msg: 'Chưa học ' + def.name + '! Hãy bái kiến Trưởng Lão Dược Điền tại Ruộng Linh Mễ để học.' };
    }

    var spState = player.linhDien.spells[spellId];
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();

    if (spState.cooldownUntil && now < spState.cooldownUntil) {
      var remainSec = Math.ceil((spState.cooldownUntil - now) / 1000);
      return { ok: false, code: 'cooldown', remainSec: remainSec, msg: def.name + ' đang hồi chiêu (còn ' + remainSec + 's).' };
    }

    var cost = getFarmSpellCost(player, spellId);
    if ((player.linhLuc || 0) < cost) {
      return { ok: false, code: 'no_mp', msg: 'Linh lực không đủ (cần ' + cost + ' MP).' };
    }

    // Trừ linh lực
    player.linhLuc -= cost;

    var affectedCount = 0;
    var effectDesc = '';

    if (spellId === 'linh-vu') {
      // Gọi mưa tưới toàn bộ các ô đang có cây mà chưa được tưới
      for (var i = 0; i < TOTAL_PLOTS; i++) {
        var p = player.tongMonFarm.plots[i];
        if (p && !p.watered) {
          p.watered = true;
          p.waterCount = (p.waterCount || 0) + 1;
          p.lastSkillAt = now;
          affectedCount++;
        } else if (p) {
          p.lastSkillAt = now;
        }
      }
      effectDesc = affectedCount > 0
        ? ('Linh Vũ nhuần trạch: Đã tưới nước đồng loạt cho ' + affectedCount + ' ô cây!')
        : 'Mưa linh rơi khắp ruộng mễ, mặt đất được tưới đẫm linh khí!';
    } else if (spellId === 'thoi-sinh') {
      // Thúc lớn: rút ngắn 45 giây cho tất cả các cây đang mọc
      for (var j = 0; j < TOTAL_PLOTS; j++) {
        var pj = player.tongMonFarm.plots[j];
        if (pj) {
          var view = getPlotView(player, j, now);
          if (view.state === 'growing') {
            pj.plantedAt = (pj.plantedAt || now) - 45000; // Lùi 45s
            pj.lastSkillAt = now;
            affectedCount++;
          }
        }
      }
      effectDesc = affectedCount > 0
        ? ('Mộc khí bùng nổ: Đã thúc lớn ' + affectedCount + ' ô cây nhanh thêm 45 giây!')
        : 'Linh khí Mộc lưu chuyển qua các luống đất!';
    } else if (spellId === 'dan-linh') {
      // Dẫn Linh: ban phước tăng sản lượng cho toàn bộ ô cây (KHÔNG reset chu kỳ cần skill, chuẩn PEST)
      for (var k = 0; k < TOTAL_PLOTS; k++) {
        var pk = player.tongMonFarm.plots[k];
        if (pk) {
          pk.yieldBonus = (pk.yieldBonus || 0) + 1;
          affectedCount++;
        }
      }
      effectDesc = affectedCount > 0
        ? ('Địa linh tụ hội: Ban phước tăng sản lượng cho ' + affectedCount + ' ô cây (+1 mễ khi chín)!')
        : 'Địa mạch linh khí tràn đầy khắp các thửa ruộng!';
    } else if (spellId === 'tru-ue') {
      // Trừ Uế: dọn cỏ/sâu/bệnh trên toàn ruộng, đặt cờ đã dọn (chuẩn PEST)
      for (var m = 0; m < TOTAL_PLOTS; m++) {
        var pm = player.tongMonFarm.plots[m];
        if (pm) {
          pm.weed = false;
          pm.pest = false;
          pm.disease = false;
          pm.weedCleared = true;
          pm.pestCleared = true;
          pm.diseaseCleared = true;
          pm.cleansed = true;
          pm.lastSkillAt = now;
          affectedCount++;
        }
      }
      effectDesc = affectedCount > 0
        ? ('Linh phù thanh tẩy: Quét sạch chướng khí trên ' + affectedCount + ' ô lúa!')
        : 'Trừ uế linh phong thổi qua, đất ruộng thanh tịnh!';
    }

    // Cập nhật trạng thái pháp quyết (chuẩn SPELLS: trần cấp theo cảnh giới, tối thiểu 5)
    spState.uses = (spState.uses || 0) + 1;
    var rankCap = Math.max(1, getRealmRank(player));
    if (rankCap < 5) rankCap = 5; // PROVISIONAL: cho phép tăng cấp ngay đầu game
    spState.level = Math.min(rankCap, 1 + Math.floor(spState.uses / 5));
    spState.cooldownUntil = now + def.cooldownSec * 1000;

    // Ban thưởng tu vi theo hệ (chuẩn SPELLS: lượng × cấp; Dẫn Linh không cho tu vi)
    var st = getStateAPI();
    if (def.tuViElem && st && st.addTuViCapped) {
      st.addTuViCapped(player, def.tuViElem, (def.tuViAmount || 1) * (spState.level || 1));
    }

    // Âm thanh pháp quyết (cùng bộ SFX-INTEGRATE với castSpell)
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
      spellId: spellId,
      name: def.name,
      affected: affectedCount,
      cooldownUntil: spState.cooldownUntil,
      msg: 'Thi triển ' + def.name + ' thành công! ' + effectDesc
    };
  }

  // ---------------------------------------------------------------------------
  // 8. VIỆC VỤ TÔNG MÔN (SECT QUESTS)
  // ---------------------------------------------------------------------------

  function getSectQuests() {
    return SECT_QUESTS.slice();
  }

  function getSectQuestDef(questId) {
    for (var i = 0; i < SECT_QUESTS.length; i++) {
      if (SECT_QUESTS[i].id === questId) return SECT_QUESTS[i];
    }
    return null;
  }

  function acceptSectQuest(player, questId) {
    if (!player) return { ok: false, msg: 'Chưa có nhân vật.' };
    ensureState(player);
    var def = getSectQuestDef(questId);
    if (!def) return { ok: false, msg: 'Nhiệm vụ không tồn tại.' };

    player.sectQuests.activeQuestId = questId;

    // Cấp phát hạt giống khởi động nếu có và chưa từng nhận
    var st = getStateAPI();
    var seedMsg = '';
    var seedsGiven = 0;
    if (def.starterSeeds > 0 && !player.sectQuests.starterGiven[questId]) {
      player.sectQuests.starterGiven[questId] = true;
      seedsGiven = def.starterSeeds;
      if (st && st.addItemToBag) {
        st.addItemToBag(player, 'hat-giong-linh-me', def.starterSeeds);
        seedMsg = ' (Đã cấp phát ' + def.starterSeeds + ' Hạt Giống Linh Mễ khởi đầu)';
      }
    }

    // Hội tụ ELDER (Bui 01:32): KHÔNG còn tặng Linh Vũ Quyết khi nhận việc.
    // Cả 4 pháp quyết chỉ học qua Trưởng Lão Dược Điền + nhiệm vụ nhập tông.

    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      msg: 'Đã nhận việc tông: ' + def.name + '!' + seedMsg,
      quest: def,
      starterSeedsGiven: seedsGiven
    };
  }

  function canCompleteSectQuest(player, questId) {
    if (!player) return { ok: false, msg: 'Chưa có nhân vật.' };
    var def = getSectQuestDef(questId);
    if (!def) return { ok: false, msg: 'Nhiệm vụ không tồn tại.' };

    var st = getStateAPI();
    if (!st || !st.countItemInBag) return { ok: false, msg: 'Lỗi túi đồ.' };

    for (var i = 0; i < def.requirements.length; i++) {
      var req = def.requirements[i];
      if (st.countItemInBag(player, req.itemId) < req.count) {
        return {
          ok: false,
          msg: 'Chưa đủ ' + (req.name || req.itemId) + ' (' + st.countItemInBag(player, req.itemId) + '/' + req.count + ').'
        };
      }
    }

    return { ok: true, quest: def };
  }

  function completeSectQuest(player, questId) {
    var check = canCompleteSectQuest(player, questId);
    if (!check.ok) return check;

    var def = check.quest;
    var st = getStateAPI();

    // Trừ vật phẩm yêu cầu
    for (var i = 0; i < def.requirements.length; i++) {
      var req = def.requirements[i];
      st.removeItemFromBag(player, req.itemId, req.count);
    }

    // Thưởng Linh Thạch
    if (def.rewardLT > 0) {
      player.linhThach = (player.linhThach || 0) + def.rewardLT;
    }

    // Thưởng vật phẩm
    if (def.rewardItems && def.rewardItems.length > 0) {
      for (var r = 0; r < def.rewardItems.length; r++) {
        var it = def.rewardItems[r];
        st.addItemToBag(player, it.itemId, it.count);
      }
    }

    // Thưởng cống hiến (Hội tụ E4)
    if (def.congHien > 0) {
      player.congHien = (player.congHien || 0) + def.congHien;
    }

    // Đánh dấu hoàn thành
    player.sectQuests.completedCount[questId] = (player.sectQuests.completedCount[questId] || 0) + 1;
    if (player.sectQuests.activeQuestId === questId) {
      player.sectQuests.activeQuestId = null;
    }

    if (st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      msg: 'Hoàn thành việc tông: ' + def.name + '! Nhận +' + def.rewardLT + ' Linh Thạch cùng phần thưởng thức ăn.',
      rewardLT: def.rewardLT,
      rewardItems: def.rewardItems
    };
  }

  // ---------------------------------------------------------------------------
  // EXPORTS
  // ---------------------------------------------------------------------------

  exports.TOTAL_PLOTS = TOTAL_PLOTS;
  exports.PLOTS_CONFIG = PLOTS_CONFIG;
  exports.PLANTABLE_SECT = PLANTABLE_SECT;
  exports.FARM_SPELLS = FARM_SPELLS;
  exports.SECT_QUESTS = SECT_QUESTS;

  exports.ensureState = ensureState;
  exports.ensureFarmSpells = ensureFarmSpells;
  exports.getPlotsConfig = getPlotsConfig;
  exports.getPlantDef = getPlantDef;
  exports.getPlotView = getPlotView;
  exports.plant = plant;
  exports.plantAll = plantAll;
  exports.water = water;
  exports.harvest = harvest;
  exports.harvestAll = harvestAll;

  exports.getFarmSpells = getFarmSpells;
  exports.getSpellDef = getSpellDef;
  exports.getFarmSpellCost = getFarmSpellCost;
  exports.listFarmSpells = listFarmSpells;
  exports.isSpellLearned = isSpellLearned;
  exports.learnSpell = learnSpell;
  exports.learnSpellFromTeacher = learnSpellFromTeacher;
  exports.castFarmSpell = castFarmSpell;
  exports.setFarmPestRNG = setFarmPestRNG;
  exports.setFarmPestRates = setFarmPestRates;
  exports.resetFarmPestConfig = resetFarmPestConfig;
  exports.generateFarmPestSchedule = generateFarmPestSchedule;
  exports.checkFarmPestSpread = checkFarmPestSpread;

  exports.getSectQuests = getSectQuests;
  exports.getSectQuestDef = getSectQuestDef;
  exports.acceptSectQuest = acceptSectQuest;
  exports.canCompleteSectQuest = canCompleteSectQuest;
  exports.completeSectQuest = completeSectQuest;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameTongMonFarm = {}));
