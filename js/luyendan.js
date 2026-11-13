/**
 * luyendan.js — Đợt D2: LUYỆN ĐAN TƯƠNG TÁC (Ngũ Hành Vô Địch).
 *
 * Bám brief D2: 3 loại lò, ván 4 bước tay, phẩm đan + đan văn, thuần thục
 * theo phương, cấp đan sư + thi luyện, đan độc + Thanh Độc Đan, Sổ Đan
 * Phương + điều kiện học, kỳ trân phụ liệu tùy chọn.
 *
 * Node-loadable & trình duyệt (khuôn mẫu linhdien.js).
 */
(function (exports) {
  'use strict';

  var ELEM_NAMES = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  // Vòng Tương Sinh chuẩn (hồ sơ): A sinh B
  var SINH = { moc: 'hoa', hoa: 'tho', tho: 'kim', kim: 'thuy', thuy: 'moc' };
  // Ngược sinh: hệ bị sinh bởi X
  function parentOf(elem) { for (var k in SINH) if (SINH[k] === elem) return k; return null; }

  var FURNACES = [
    { id: 'mang-theo', name: 'Đan Lô Mang Theo', tier: 1, successBonus: 0, heatStability: 0.8,
      canUseAnywhere: true, requiresSect: false, requiresMap: null, requiresRank: 0,
      desc: 'Luyện mọi nơi, chất lượng thường.' },
    { id: 'dan-phong', name: 'Đan Phòng Tông Môn', tier: 2, successBonus: 0.1, heatStability: 1.0,
      canUseAnywhere: false, requiresSect: true, requiresMap: null, requiresRank: 0,
      desc: 'Lửa ổn định, tỉ lệ thành công cao hơn.' },
    { id: 'dia-hoa', name: 'Địa Hỏa Mỏ Lửa', tier: 3, successBonus: 0.2, heatStability: 1.2,
      canUseAnywhere: false, requiresSect: true, requiresMap: 'mo-lua', requiresRank: 2,
      desc: 'Lửa mạnh nhất, cho đan hệ Hỏa và đan đột phá, phải tới nơi.' }
  ];

  var FURNACE_GRADES = [
    { id: 0, name: 'Phàm Lô', heatRetention: 0.7, maxTier: 1 },
    { id: 1, name: 'Linh Lô', heatRetention: 0.85, maxTier: 2 },
    { id: 2, name: 'Pháp Lô', heatRetention: 1.0, maxTier: 3 },
    { id: 3, name: 'Tiên Lô', heatRetention: 1.15, maxTier: 4 }
  ];

  var ALCHEMIST_RANKS = ['Học đồ', 'Đan sĩ', 'Đan sư', 'Đại đan sư'];
  var RANK_SUCCESS_THRESHOLDS = [0, 5, 20, 50]; // số mẻ thành công tối thiểu
  var RANK_EXAM_THRESHOLDS = [0, 1, 2, 3]; // số bài thi đạt

  var GRADE_NAMES = ['hạ', 'trung', 'thượng', 'cực'];
  var GRADE_INDEX = { ha: 0, trung: 1, thuong: 2, cuc: 3 };

  // Phẩm đan theo mốc: số đội soạn
  var SLUG_THRESHOLD = 0.25; // dưới ngưỡng -> đan cặn

  var QUICK_REFINE_MIN_USES = 5;

  // Công thức đan hệ (tu vi) — bám danphong RECIPES nhưng thêm thứ tự & độ khó
  var PILL_RECIPES = [
    { id: 'dan-moc', name: 'Tu Luyện Đan (Mộc)', elem: 'moc', tier: 1, minRank: 0, minRealmRank: 0, minFurnace: 0,
      materials: ['la-thanh-tuy', 'la-thanh-tuy', 'la-thanh-tuy', 'linh-chi-rung'],
      heatDifficulty: 0.3, danVanMax: 2 },
    { id: 'dan-thuy', name: 'Tu Luyện Đan (Thủy)', elem: 'thuy', tier: 1, minRank: 0, minRealmRank: 4, minFurnace: 0,
      materials: ['bang-tinh', 'bang-tinh', 'bang-tinh', 'ngoc-bang-tam'],
      heatDifficulty: 0.4, danVanMax: 2 },
    { id: 'dan-hoa', name: 'Tu Luyện Đan (Hỏa)', elem: 'hoa', tier: 2, minRank: 0, minRealmRank: 7, minFurnace: 1,
      materials: ['hoa-tinh-tho', 'hoa-tinh-tho', 'da-nung', 'da-nung'],
      heatDifficulty: 0.6, danVanMax: 3 },
    { id: 'dan-tho', name: 'Tu Luyện Đan (Thổ)', elem: 'tho', tier: 2, minRank: 0, minRealmRank: 10, minFurnace: 1,
      materials: ['cat-tinh', 'cat-tinh', 'cat-tinh', 'ngoc-cat-tam'],
      heatDifficulty: 0.5, danVanMax: 3 },
    { id: 'dan-kim', name: 'Tu Luyện Đan (Kim)', elem: 'kim', tier: 3, minRank: 0, minRealmRank: 11, minFurnace: 2,
      materials: ['hon-kiem-nho', 'hon-kiem-nho', 'hon-kiem-nho', 'manh-kiem-gay', 'manh-kiem-gay'],
      heatDifficulty: 0.7, danVanMax: 3 },
    { id: 'thanh-doc-dan', name: 'Thanh Độc Đan', elem: 'thuy', tier: 1, minRank: 0, minRealmRank: 0, minFurnace: 0,
      materials: ['bang-tinh', 'la-thanh-tuy'],
      heatDifficulty: 0.3, danVanMax: 1 },
    { id: 'tu-khi-tan', name: 'Tụ Khí Tán', elem: 'moc', tier: 1, minRank: 0, minRealmRank: 4, minFurnace: 0,
      materials: ['la-thanh-tuy', 'la-thanh-tuy', 'bang-tinh'],
      heatDifficulty: 0.3, danVanMax: 1 },
    { id: 'ngung-khi-dan', name: 'Ngưng Khí Đan', elem: 'hoa', tier: 1, minRank: 0, minRealmRank: 7, minFurnace: 0,
      materials: ['hoa-tinh-tho', 'hoa-tinh-tho', 'bang-tinh'],
      heatDifficulty: 0.4, danVanMax: 1 }
  ];

  // Đan đột phá theo mốc (17-A) — công thức live hiện tại cho Trúc Cơ Đan giữ nguyên
  var BREAKTHROUGH_PILLS = [
    { id: 'truc-co-dan', name: 'Trúc Cơ Đan', realm: 'Trúc Cơ', minRank: 0, minFurnace: 1, minRealmRank: 9,
      materials: ['linh-chi-rung', 'linh-chi-rung', 'linh-chi-rung', 'bang-tuy', 'hoa-tinh-tho', 'hoa-tinh-tho', 'nguyen-tinh-moc', 'nguyen-tinh-thuy'],
      heatDifficulty: 0.5, danVanMax: 3, kyTran: 'linh-chi-ngan-nam' },
    { id: 'ho-mach-dan', name: 'Hộ Mạch Đan', realm: 'Trúc Cơ', minRank: 1, minFurnace: 1, minRealmRank: 9,
      materials: ['bang-tuy', 'la-thanh-tuy', 'la-thanh-tuy'],
      heatDifficulty: 0.3, danVanMax: 2, kyTran: 'bang-tuy-ngan-nam' },
    { id: 'dinh-can-dan', name: 'Định Căn Đan', realm: 'Trúc Cơ', minRank: 1, minFurnace: 1, minRealmRank: 9,
      materials: ['la-thanh-tuy', 'dia-tam-thach-vun'],
      heatDifficulty: 0.3, danVanMax: 2, kyTran: 'dia-tam-thach' },
    { id: 'ngung-dan-dan', name: 'Ngưng Đan Đan', realm: 'Kim Đan', minRank: 2, minFurnace: 2, minRealmRank: 13,
      materials: ['nguyen-tinh-moc', 'nguyen-tinh-thuy', 'nguyen-tinh-hoa'],
      heatDifficulty: 0.6, danVanMax: 3, kyTran: 'loi-viem-quan' },
    { id: 'ngu-hanh-quy-nguyen-dan', name: 'Ngũ Hành Quy Nguyên Đan', realm: 'Kim Đan', minRank: 2, minFurnace: 2, minRealmRank: 13,
      materials: ['nguyen-tinh-moc', 'nguyen-tinh-thuy', 'nguyen-tinh-hoa', 'nguyen-tinh-tho', 'nguyen-tinh-kim', 'nuoc-oc-dao-tinh-khiet', 'nuoc-oc-dao-tinh-khiet'],
      heatDifficulty: 0.8, danVanMax: 3, kyTran: 'loi-viem-quan' },
    { id: 'hoa-ma-dan', name: 'Hóa Ma Đan', realm: 'Kim Đan', minRank: 2, minFurnace: 2, minRealmRank: 13,
      materials: ['hoa-tinh-tho', 'bang-tinh', 'la-thanh-tuy'],
      heatDifficulty: 0.5, danVanMax: 2, kyTran: 'bang-tuy-ngan-nam' },
    { id: 'hoa-anh-dan', name: 'Hóa Anh Đan', realm: 'Nguyên Anh', minRank: 3, minFurnace: 3, minRealmRank: 17,
      materials: ['nguyen-tinh-kim', 'nguyen-tinh-kim', 'nguyen-tinh-tho'],
      heatDifficulty: 0.8, danVanMax: 3, kyTran: 'mui-kiem-vo-danh' },
    { id: 'duong-hon-dan', name: 'Dưỡng Hồn Đan', realm: 'Nguyên Anh', minRank: 3, minFurnace: 3, minRealmRank: 17,
      materials: ['la-thanh-tuy', 'bang-tinh', 'hoa-tinh-tho'],
      heatDifficulty: 0.4, danVanMax: 2, kyTran: 'bang-tuy-ngan-nam' },
    { id: 'pha-chuong-dan', name: 'Phá Chướng Đan', realm: 'Nguyên Anh', minRank: 3, minFurnace: 3, minRealmRank: 17,
      materials: ['huyen-thiet-khoi', 'cat-tinh', 'hoa-tinh-tho'],
      heatDifficulty: 0.7, danVanMax: 3, kyTran: 'mui-kiem-vo-danh' }
  ];

  var KY_TRAN = [
    { id: 'linh-chi-ngan-nam', name: 'Vạn Niên Mộc Tâm', elem: 'moc', region: 'Rừng Độc Thanh Tụy' },
    { id: 'bang-tuy-ngan-nam', name: 'Hàn Băng Ngọc Tủy', elem: 'thuy', region: 'Hồ Băng Hàn Kính' },
    { id: 'loi-viem-quan', name: 'Địa Tâm Hỏa Chủng', elem: 'hoa', region: 'Mỏ Lửa Xích Diệm' },
    { id: 'dia-tam-thach', name: 'Hậu Thổ Tinh', elem: 'tho', region: 'Hoang Mạc Hoàng Sa' },
    { id: 'mui-kiem-vo-danh', name: 'Huyền Thiết Kiếm Ý', elem: 'kim', region: 'Kiếm Trủng Huyền Thiết' }
  ];

  // Sổ Đan Phương (recipes as knowledge)
  var RECIPE_KNOWLEDGE = PILL_RECIPES.concat(BREAKTHROUGH_PILLS).map(function (r) {
    return {
      id: 'recipe-' + r.id,
      pillId: r.id,
      name: r.name,
      minRank: r.minRank,
      minRealmRank: (typeof r.minRealmRank === 'number') ? r.minRealmRank : 0,
      minFurnace: r.minFurnace,
      materials: r.materials.slice(),
      heatDifficulty: r.heatDifficulty,
      kyTran: r.kyTran || null
    };
  });

  // Fragment recipes (tàn quyển) — PROVISIONAL mapping
  var FRAGMENT_REQUIREMENTS = {
    'recipe-truc-co-dan': 3,
    'recipe-ngu-hanh-quy-nguyen-dan': 5
  };

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
    return { id: itemId, name: itemId };
  }
  function itemName(itemId) { var d = getItemDef(itemId); return d && d.name ? d.name : itemId; }
  function showToast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(msg);
  }
  function playChime() {
    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) window.GameAudio.playChime();
  }
  function refreshHUD() {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) window.GameUI.refreshHUD();
  }
  function bagCount(player, itemId) {
    var st = getStateAPI();
    if (st && typeof st.countItemInBag === 'function') return st.countItemInBag(player, itemId) || 0;
    return 0;
  }

  // ---------------- State ----------------
  function ensureState(player) {
    if (!player) return null;
    if (!player.luyenDan || typeof player.luyenDan !== 'object') {
      player.luyenDan = {
        furnaceGrade: 0,
        proficiency: {}, // pillId -> { uses, successes }
        successes: 0,
        examsPassed: 0,
        rank: 0,
        toxin: 0,
        recipes: [], // learned recipe ids
        availableRecipes: [],
        fragments: {},
        pillGrades: {},
        lastGrade: null
      };
    }
    var s = player.luyenDan;
    if (typeof s.furnaceGrade !== 'number') s.furnaceGrade = 0;
    s.furnaceGrade = Math.max(0, Math.min(3, Math.floor(s.furnaceGrade)));
    if (!s.proficiency || typeof s.proficiency !== 'object') s.proficiency = {};
    if (typeof s.successes !== 'number') s.successes = 0;
    if (typeof s.examsPassed !== 'number') s.examsPassed = 0;
    if (typeof s.rank !== 'number') s.rank = 0;
    s.rank = Math.max(0, Math.min(3, Math.floor(s.rank)));
    if (typeof s.toxin !== 'number') s.toxin = 0;
    if (!Array.isArray(s.recipes)) s.recipes = [];
    if (!Array.isArray(s.availableRecipes)) s.availableRecipes = [];
    if (!s.fragments || typeof s.fragments !== 'object') s.fragments = {};
    if (!s.pillGrades || typeof s.pillGrades !== 'object') s.pillGrades = {};
    return s;
  }

  function getFurnace(id) {
    for (var i = 0; i < FURNACES.length; i++) if (FURNACES[i].id === id) return FURNACES[i];
    return null;
  }
  function getFurnaces() { return FURNACES.slice(); }
  function getFurnaceGrade(player) {
    var s = ensureState(player);
    return FURNACE_GRADES[s.furnaceGrade] || FURNACE_GRADES[0];
  }
  function setFurnaceGrade(player, grade) {
    var s = ensureState(player);
    var g = Math.max(0, Math.min(3, Math.floor(grade)));
    s.furnaceGrade = g;
    return FURNACE_GRADES[g];
  }

  function canUseFurnace(player, furnaceId, ctx) {
    ctx = ctx || {};
    var f = getFurnace(furnaceId);
    if (!f) return { ok: false, reason: 'unknown_furnace', msg: 'Lò không tồn tại.' };
    var st = getStateAPI();
    var rank = st && st.getRealmRank ? st.getRealmRank(player) : 0;
    var alchRank = ensureState(player).rank;
    if (f.requiresRank && alchRank < f.requiresRank) {
      return { ok: false, reason: 'rank_locked', msg: 'Cần cấp đan sư ' + ALCHEMIST_RANKS[f.requiresRank] + ' để dùng ' + f.name + '.' };
    }
    if (f.requiresSect) {
      var sectStage = (player && player.quests && typeof player.quests.sectStage === 'number') ? player.quests.sectStage : 0;
      if (sectStage < 4) return { ok: false, reason: 'sect_locked', msg: 'Cần gia nhập tông môn để dùng ' + f.name + '.' };
    }
    if (f.requiresMap) {
      var mapId = ctx.mapId || (player && player.currentMap) || null;
      if (mapId !== f.requiresMap) return { ok: false, reason: 'location', msg: 'Phải tới ' + f.requiresMap + ' mới dùng được ' + f.name + '.' };
    }
    return { ok: true, furnace: f };
  }

  function listFurnacesFor(player, ctx) {
    ctx = ctx || {};
    var out = [];
    for (var i = 0; i < FURNACES.length; i++) {
      var f = FURNACES[i];
      var r = canUseFurnace(player, f.id, ctx);
      out.push({ id: f.id, name: f.name, usable: r.ok, reason: r.ok ? null : r.reason });
    }
    return out;
  }

  // ---------------- Recipes ----------------
  function getRecipe(pillId) {
    // knowledge recipe by pillId
    for (var i = 0; i < RECIPE_KNOWLEDGE.length; i++) {
      if (RECIPE_KNOWLEDGE[i].pillId === pillId) return RECIPE_KNOWLEDGE[i];
    }
    // pill recipes
    for (var j = 0; j < PILL_RECIPES.length; j++) {
      if (PILL_RECIPES[j].id === pillId) {
        return { id: 'recipe-' + PILL_RECIPES[j].id, pillId: PILL_RECIPES[j].id, name: PILL_RECIPES[j].name,
          minRank: PILL_RECIPES[j].minRank, minRealmRank: PILL_RECIPES[j].minRealmRank || 0, minFurnace: PILL_RECIPES[j].minFurnace,
          materials: PILL_RECIPES[j].materials.slice(), heatDifficulty: PILL_RECIPES[j].heatDifficulty,
          kyTran: null };
      }
    }
    for (var k = 0; k < BREAKTHROUGH_PILLS.length; k++) {
      if (BREAKTHROUGH_PILLS[k].id === pillId) {
        var b = BREAKTHROUGH_PILLS[k];
        return { id: 'recipe-' + b.id, pillId: b.id, name: b.name, minRank: b.minRank,
          minRealmRank: b.minRealmRank, minFurnace: b.minFurnace, materials: b.materials.slice(),
          heatDifficulty: b.heatDifficulty, kyTran: b.kyTran };
      }
    }
    return null;
  }
  function getPillRecipe(pillId) {
    for (var i = 0; i < PILL_RECIPES.length; i++) if (PILL_RECIPES[i].id === pillId) return PILL_RECIPES[i];
    for (var j = 0; j < BREAKTHROUGH_PILLS.length; j++) if (BREAKTHROUGH_PILLS[j].id === pillId) return BREAKTHROUGH_PILLS[j];
    return null;
  }
  function getBreakthroughRecipe(pillId) {
    for (var i = 0; i < BREAKTHROUGH_PILLS.length; i++) if (BREAKTHROUGH_PILLS[i].id === pillId) return BREAKTHROUGH_PILLS[i];
    return null;
  }
  function isBreakthrough(pillId) {
    return getBreakthroughRecipe(pillId) !== null;
  }

  function getRecipeInfo(pillId) {
    var r = getRecipe(pillId);
    if (!r) return null;
    var f = getFurnaceByIdSafe(r.minFurnace);
    return {
      pill: r.pillId,
      pillName: itemName(r.pillId),
      minFurnace: r.minFurnace,
      minFurnaceName: f ? f.name : null,
      materials: r.materials.slice(),
      heatDifficulty: r.heatDifficulty,
      minRank: r.minRank,
      minRealmRank: r.minRealmRank
    };
  }
  function getFurnaceByIdSafe(minFurnace) {
    // minFurnace is tier index; map to furnace id
    if (minFurnace >= 3) return getFurnace('dia-hoa');
    if (minFurnace >= 2) return getFurnace('dan-phong');
    return getFurnace('mang-theo');
  }

  // ---------------- Proficiency ----------------
  function getProficiency(player, pillId) {
    var s = ensureState(player);
    var p = s.proficiency[pillId];
    if (!p) return { uses: 0, successes: 0 };
    return { uses: p.uses || 0, successes: p.successes || 0 };
  }
  function recordProficiency(player, pillId, success) {
    var s = ensureState(player);
    if (!s.proficiency[pillId]) s.proficiency[pillId] = { uses: 0, successes: 0 };
    s.proficiency[pillId].uses += 1;
    if (success) {
      s.proficiency[pillId].successes += 1;
      s.successes += 1;
    }
    return s.proficiency[pillId];
  }
  function isQuickRefineUnlocked(player, pillId) {
    var prof = getProficiency(player, pillId);
    return prof.uses >= QUICK_REFINE_MIN_USES || prof.successes >= QUICK_REFINE_MIN_USES;
  }
  function proficiencyBonus(player, pillId) {
    var prof = getProficiency(player, pillId);
    return Math.min(0.2, (prof.successes || 0) * 0.02);
  }

  // ---------------- Alchemist rank ----------------
  function getAlchemistRank(player) {
    var s = ensureState(player);
    // recompute from successes/exams
    var rank = 0;
    for (var r = 3; r >= 0; r--) {
      if (s.successes >= RANK_SUCCESS_THRESHOLDS[r] && s.examsPassed >= RANK_EXAM_THRESHOLDS[r]) { rank = r; break; }
    }
    s.rank = rank;
    return rank;
  }
  function getAlchemistRankName(player) {
    return ALCHEMIST_RANKS[getAlchemistRank(player)];
  }
  function takeExam(player, pillId) {
    var s = ensureState(player);
    getAlchemistRank(player);
    // exam: luyện một phương lạ trong giới hạn nguyên liệu -> giả lập thành công nếu có recipe
    var recipe = getRecipe(pillId || '');
    if (!recipe) return { ok: false, reason: 'unknown_recipe', msg: 'Phương không tồn tại.' };
    var st = getStateAPI();
    var rank = st && st.getRealmRank ? st.getRealmRank(player) : 0;
    if (rank < recipe.minRealmRank) return { ok: false, reason: 'realm_locked', msg: 'Chưa đủ cảnh giới.' };
    if (s.rank < recipe.minRank) return { ok: false, reason: 'rank_locked', msg: 'Chưa đủ cấp đan sư.' };
    s.examsPassed += 1;
    getAlchemistRank(player);
    return { ok: true, msg: 'Thi luyện đạt.', rank: s.rank, rankName: ALCHEMIST_RANKS[s.rank] };
  }

  // ---------------- Toxin ----------------
  function getDanDoc(player) {
    var s = ensureState(player);
    return s.toxin || 0;
  }
  function addDanDoc(player, amount) {
    var s = ensureState(player);
    s.toxin = Math.max(0, Math.min(100, (s.toxin || 0) + (amount || 0)));
    return s.toxin;
  }
  function isDanDocFatigued(player) {
    return getDanDoc(player) >= 50;
  }
  function useThanhDocDan(player) {
    var cnt = bagCount(player, 'thanh-doc-dan');
    if (cnt <= 0) return { ok: false, reason: 'missing', msg: 'Chưa có Thanh Độc Đan.' };
    var st = getStateAPI();
    if (st) st.removeItemFromBag(player, 'thanh-doc-dan', 1);
    var s = ensureState(player);
    s.toxin = Math.max(0, s.toxin - 40);
    return { ok: true, msg: 'Giải đan độc.', toxin: s.toxin };
  }
  function detoxRest(player, seconds) {
    var s = ensureState(player);
    var decay = (seconds || 0) / 60 * 5; // 5 độc/phút nghỉ
    s.toxin = Math.max(0, s.toxin - decay);
    return s.toxin;
  }

  // ---------------- Recipe book ----------------
  function getRecipeBook(player) {
    var s = ensureState(player);
    var out = [];
    for (var i = 0; i < s.recipes.length; i++) {
      var r = getRecipe(s.recipes[i].replace(/^recipe-/, ''));
      if (r) out.push(r);
    }
    return out;
  }
  function isRecipeLearned(player, pillId) {
    var s = ensureState(player);
    return s.recipes.indexOf('recipe-' + pillId) !== -1 || s.recipes.indexOf(pillId) !== -1;
  }
  function canLearnRecipe(player, recipeId) {
    var r = getRecipe(recipeId);
    if (!r) return { ok: false, reason: 'unknown', missing: ['phương không tồn tại'] };
    var s = ensureState(player);
    var st = getStateAPI();
    var rank = st && st.getRealmRank ? st.getRealmRank(player) : 0;
    var missing = [];
    if (s.rank < r.minRank) missing.push('cấp đan sư ' + ALCHEMIST_RANKS[r.minRank]);
    if (rank < r.minRealmRank) missing.push('cảnh giới tối thiểu');
    if (r.minFurnace > (s.furnaceGrade || 0)) missing.push('phẩm lò tối thiểu');
    // fragment requirement
    if (FRAGMENT_REQUIREMENTS[r.id || ('recipe-' + r.pillId)]) {
      var need = FRAGMENT_REQUIREMENTS[r.id || ('recipe-' + r.pillId)];
      var have = s.fragments[r.pillId] || 0;
      if (have < need) missing.push('mảnh phương ' + have + '/' + need);
    }
    return { ok: missing.length === 0, missing: missing };
  }
  function learnRecipe(player, recipeId) {
    var r = getRecipe(recipeId);
    if (!r) return { ok: false, reason: 'unknown', msg: 'Phương không tồn tại.' };
    var s = ensureState(player);
    var c = canLearnRecipe(player, recipeId);
    if (!c.ok) {
      return { ok: false, reason: 'conditions', msg: 'Chưa đủ điều kiện học: ' + c.missing.join(', ') + '.', missing: c.missing };
    }
    var rid = r.id || ('recipe-' + r.pillId);
    if (s.recipes.indexOf(rid) === -1) s.recipes.push(rid);
    // remove fragment
    if (FRAGMENT_REQUIREMENTS[rid]) {
      var need = FRAGMENT_REQUIREMENTS[rid];
      s.fragments[r.pillId] = Math.max(0, (s.fragments[r.pillId] || 0) - need);
    }
    return { ok: true, msg: 'Đã học ' + r.name + ' vào Sổ Đan Phương.', recipeId: rid };
  }
  function addFragment(player, pillId, count) {
    var s = ensureState(player);
    s.fragments[pillId] = (s.fragments[pillId] || 0) + (count || 1);
    return s.fragments[pillId];
  }
  function combineFragments(player, pillId) {
    var s = ensureState(player);
    var rid = 'recipe-' + pillId;
    var need = FRAGMENT_REQUIREMENTS[rid] || 3;
    var have = s.fragments[pillId] || 0;
    if (have < need) return { ok: false, reason: 'not_enough', msg: 'Chưa đủ mảnh.', have: have, need: need };
    s.fragments[pillId] = have - need;
    if (s.availableRecipes.indexOf(rid) === -1) s.availableRecipes.push(rid);
    return { ok: true, recipeId: rid, msg: 'Ghép đủ mảnh, có thể học phương.' };
  }
  function tryVariantDiscovery(player, pillId) {
    var s = ensureState(player);
    var prof = getProficiency(player, pillId);
    if ((prof.successes || 0) < 10) return { ok: false, reason: 'not_proficient', msg: 'Chưa đủ thuần thục.' };
    var variantId = pillId + '-variant-' + (player.name || 'nguoi-choi');
    var variantRecipeId = 'recipe-' + variantId;
    if (s.recipes.indexOf(variantRecipeId) === -1 && s.availableRecipes.indexOf(variantRecipeId) === -1) {
      s.availableRecipes.push(variantRecipeId);
    }
    return { ok: true, variantId: variantId, msg: 'Ngộ ra phương biến thể: ' + variantId };
  }

  // ---------------- Ky tran ----------------
  function getKyTran(id) {
    for (var i = 0; i < KY_TRAN.length; i++) if (KY_TRAN[i].id === id) return KY_TRAN[i];
    return null;
  }

  // ---------------- Refine core ----------------
  function getHerbQualityAPI() { try { if (typeof window !== 'undefined' && window.GameHerbQuality) return window.GameHerbQuality; return require('./herb-quality.js'); } catch (e) { return null; } }
  function countMaterial(player, itemId) { return bagCount(player, itemId); }
  function materialQuality(plan) {
    var values = plan && plan.materialQualities;
    // Không có dữ liệu nguyên liệu nghĩa là không cộng điểm; đây là đường gọi D2 cũ.
    if (!Array.isArray(values) || values.length === 0) return null;
    var hq = getHerbQualityAPI();
    return hq && hq.weightedAverage ? hq.weightedAverage(values) : null;
  }
  function materialQualityLabel(q) {
    var hq = getHerbQualityAPI();
    return q === null ? 'Không có dữ liệu phẩm chất' : (hq && hq.getQualityLabel ? hq.getQualityLabel(q) : 'Không xác định');
  }
  function previewRefine(player, plan) { plan = plan || {}; var r = getPillRecipe(plan.pillId || plan.recipeId); if (!r) return { ok: false, reason: 'unknown_recipe' }; var q = materialQuality(plan); var base = (typeof plan.baseScore === 'number' ? plan.baseScore : 0.5); var score = Math.max(0, Math.min(1, base + (q === null ? 0 : q * 0.10))); var idx = Math.min(3, Math.floor(score * 3.999)); return { ok: true, materialQuality: q, materialQualityName: materialQualityLabel(q), predictedGrade: GRADE_NAMES[idx], predictedGradeIndex: idx }; }

  function validateMaterials(recipe, provided) {
    // provided: array of itemIds in order
    if (!Array.isArray(provided)) return { ok: false, reason: 'bad_input', msg: 'Nguyên liệu phải là mảng.' };
    var expected = recipe.materials.slice();
    // count check
    var haveCounts = {};
    for (var i = 0; i < provided.length; i++) haveCounts[provided[i]] = (haveCounts[provided[i]] || 0) + 1;
    var expCounts = {};
    for (var j = 0; j < expected.length; j++) expCounts[expected[j]] = (expCounts[expected[j]] || 0) + 1;
    // same multiset?
    var sameSet = true;
    for (var k in expCounts) if ((haveCounts[k] || 0) !== expCounts[k]) sameSet = false;
    for (var l in haveCounts) if ((expCounts[l] || 0) !== haveCounts[l]) sameSet = false;
    if (!sameSet) return { ok: false, reason: 'missing_materials', msg: 'Thiếu/sai nguyên liệu.' };
    // order score
    var exactOrder = (provided.length === expected.length);
    if (exactOrder) {
      for (var m = 0; m < expected.length; m++) if (provided[m] !== expected[m]) { exactOrder = false; break; }
    }
    var orderScore = exactOrder ? 1.0 : 0.5;
    return { ok: true, orderScore: orderScore, exactOrder: exactOrder };
  }

  function refineBatch(player, plan) {
    plan = plan || {};
    var s = ensureState(player);
    var st = getStateAPI();
    if (!st) return { ok: false, reason: 'no_state', msg: 'GameState chưa sẵn sàng.' };

    var furnaceId = plan.furnaceId || plan.furnace || 'mang-theo';
    var furnaceCheck = canUseFurnace(player, furnaceId, { mapId: plan.mapId });
    if (!furnaceCheck.ok) return furnaceCheck;
    var furnace = furnaceCheck.furnace;

    var pillId = plan.pillId || plan.recipeId;
    var recipe = getPillRecipe(pillId);
    if (!recipe) return { ok: false, reason: 'unknown_recipe', msg: 'Không có công thức.' };

    // rank / realm
    var rank = st.getRealmRank ? st.getRealmRank(player) : 0;
    if (s.rank < recipe.minRank) return { ok: false, reason: 'rank_locked', msg: 'Chưa đủ cấp đan sư.' };
    if (recipe.minRealmRank && rank < recipe.minRealmRank) return { ok: false, reason: 'realm_locked', msg: 'Chưa đủ cảnh giới.' };
    if (recipe.minFurnace && furnace.tier < (recipe.minFurnace + 1)) {
      // tier mapping: furnace tier >= minFurnace+? use tier index
      if (furnace.tier < recipe.minFurnace) return { ok: false, reason: 'furnace_locked', msg: 'Lò chưa đủ phẩm.' };
    }
    // breakthrough requires dia-hoa
    if (isBreakthrough(pillId) && furnace.id !== 'dia-hoa') {
      return { ok: false, reason: 'furnace_locked', msg: 'Đan đột phá cần luyện tại Địa Hỏa Mỏ Lửa.' };
    }
    // hoa system pills prefer dia-hoa but not required unless tier
    if (recipe.elem === 'hoa' && recipe.tier >= 2 && furnace.id === 'mang-theo') {
      // allow but lower; no hard block
    }

    var provided = plan.materials || [];
    var mv = validateMaterials(recipe, provided);
    if (!mv.ok) return mv;

    // inventory check
    for (var i = 0; i < recipe.materials.length; i++) {
      // check counts
    }
    var expCounts = {};
    for (var j = 0; j < recipe.materials.length; j++) expCounts[recipe.materials[j]] = (expCounts[recipe.materials[j]] || 0) + 1;
    for (var itemId in expCounts) {
      if (countMaterial(player, itemId) < expCounts[itemId]) {
        return { ok: false, reason: 'missing_materials', msg: 'Thiếu ' + itemName(itemId) + '.' };
      }
    }

    // fire match
    var fire = plan.fireElement || plan.fire || recipe.elem;
    var fireScore = 0;
    if (fire === recipe.elem) fireScore = 1.0;
    else if (fire === parentOf(recipe.elem)) fireScore = 0.8;
    else fireScore = 0.3;

    // heat
    var heatInput = (typeof plan.heatScore === 'number') ? plan.heatScore : (typeof plan.heat === 'number' ? plan.heat : 0.5);
    heatInput = Math.max(0, Math.min(1, heatInput));
    var gradeInfo = getFurnaceGrade(player);
    var effHeat = Math.min(1, heatInput * (furnace.heatStability || 1) * (gradeInfo.heatRetention || 1) + proficiencyBonus(player, pillId) * 0.5);

    // seal
    var sealInput = (typeof plan.sealTiming === 'number') ? plan.sealTiming : (typeof plan.seal === 'number' ? plan.seal : 0.5);
    sealInput = Math.max(0, Math.min(1, sealInput));
    var sealScore = sealInput >= 0.8 ? 1.0 : sealInput;

    var orderScore = mv.orderScore;
    var profBonus = proficiencyBonus(player, pillId);

    var score = fireScore * 0.1 + effHeat * 0.4 + sealScore * 0.3 + orderScore * 0.2 + profBonus;
    var materialQ = materialQuality(plan);
    if (materialQ !== null) score += materialQ * 0.10; // PROVISIONAL: chỉ cộng khi có mảng phẩm chất
    score = Math.max(0, Math.min(1, score));

    // ky tran optional
    var kyTranId = plan.kyTran || plan.kyTranId || null;
    var kyTranUsed = false;
    if (kyTranId) {
      if (countMaterial(player, kyTranId) <= 0) {
        return { ok: false, reason: 'missing_kytran', msg: 'Thiếu kỳ trân ' + itemName(kyTranId) + '.' };
      }
      kyTranUsed = true;
      score = Math.min(1, score + 0.2);
    }

    // consume materials
    for (var c = 0; c < recipe.materials.length; c++) {
      st.removeItemFromBag(player, recipe.materials[c], 1);
    }
    // remove by counts (recipe.materials already flattened)
    // Actually remove each occurrence
    // (above loop removed one per entry; correct)

    if (kyTranUsed) {
      st.removeItemFromBag(player, kyTranId, 1);
    }

    // determine slag
    if (score < SLUG_THRESHOLD) {
      // return partial materials (half)
      var returned = [];
      var unique = {};
      for (var u = 0; u < recipe.materials.length; u++) unique[recipe.materials[u]] = (unique[recipe.materials[u]] || 0) + 1;
      for (var it in unique) {
        var retCount = Math.ceil(unique[it] / 2);
        st.addItemToBag(player, it, retCount, getMonstersAPI() ? getMonstersAPI().ITEM_DEFS : undefined);
        returned.push({ itemId: it, count: retCount });
      }
      recordProficiency(player, pillId, false);
      return { ok: false, reason: 'slag', msg: 'Mẻ hỏng thành đan cặn.', score: score, returned: returned };
    }

    // grade
    var gradeIdx = Math.min(3, Math.floor(score * 3.999));
    if (gradeIdx < 0) gradeIdx = 0;
    // proficiency can raise max
    // dan van
    var danVan = 0;
    if (gradeIdx >= 2) {
      danVan = Math.max(1, Math.min(recipe.danVanMax || 3, gradeIdx + (score > 0.85 ? 1 : 0)));
    }
    if (kyTranUsed) danVan = Math.min(recipe.danVanMax || 3, danVan + 1);

    var gradeName = GRADE_NAMES[gradeIdx];

    // add pill
    var m = getMonstersAPI();
    var addRes = st.addItemToBag(player, pillId, 1, m ? m.ITEM_DEFS : undefined);
    if (!addRes || !addRes.success) {
      // refund all
      for (var rf = 0; rf < recipe.materials.length; rf++) {
        st.addItemToBag(player, recipe.materials[rf], 1, m ? m.ITEM_DEFS : undefined);
      }
      if (kyTranUsed) st.addItemToBag(player, kyTranId, 1, m ? m.ITEM_DEFS : undefined);
      return { ok: false, reason: 'bag_full', msg: 'Túi đồ đầy.' };
    }

    // toxin if tu vi pill consumed? handled at consume time; refining doesn't add toxin
    recordProficiency(player, pillId, true);
    s.pillGrades[pillId] = Math.max(s.pillGrades[pillId] || 0, gradeIdx);
    s.lastGrade = { pillId: pillId, grade: gradeName, danVan: danVan, score: score };

    // alchemist success counter
    s.successes = (s.successes || 0) + 1;
    getAlchemistRank(player);

    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.refines = (player.stats.refines || 0) + 1;
    st.savePlayer(player);

    var msgOk = 'Luyện thành ' + itemName(pillId) + ' — phẩm ' + gradeName + (danVan > 0 ? ', đan văn ' + danVan + ' vòng' : '') + '.';
    if (gradeIdx >= 3) msgOk += ' Dị tượng: hương đan lan ra.';
    playChime();
    showToast(msgOk);
    refreshHUD();

    return { ok: true, pillId: pillId, grade: gradeName, gradeIndex: gradeIdx, danVan: danVan, score: score, materialQuality: materialQ, materialQualityName: materialQualityLabel(materialQ), kyTranUsed: kyTranUsed, msg: msgOk };
  }

  function quickRefine(player, pillId, furnaceId) {
    var s = ensureState(player);
    if (!isQuickRefineUnlocked(player, pillId)) {
      return { ok: false, reason: 'not_proficient', msg: 'Chưa mở luyện nhanh cho phương này.' };
    }
    var recipe = getPillRecipe(pillId);
    if (!recipe) return { ok: false, reason: 'unknown_recipe', msg: 'Không có công thức.' };
    // force medium/superior max (index 2)
    var res = refineBatch(player, {
      furnaceId: furnaceId || 'dan-phong',
      pillId: pillId,
      materials: recipe.materials.slice(),
      fireElement: recipe.elem,
      heatScore: 0.7,
      sealTiming: 0.7
    });
    if (res.ok) {
      // cap grade at thuong (2)
      if (res.gradeIndex > 2) { res.gradeIndex = 2; res.grade = 'thượng'; res.danVan = Math.min(res.danVan, 1); }
    }
    return res;
  }

  // ---------------- Consume pill (dan doc) ----------------
  function consumePill(player, pillId) {
    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };
    if (bagCount(player, pillId) <= 0) return { ok: false, reason: 'missing', msg: 'Chưa có đan.' };
    var recipe = getPillRecipe(pillId);
    var elem = recipe ? recipe.elem : null;
    // toxin +10 for tu vi pills
    var toxinGain = 0;
    if (pillId.indexOf('dan-') === 0) toxinGain = 10;
    addDanDoc(player, toxinGain);
    st.removeItemFromBag(player, pillId, 1);
    var gained = 0;
    if (elem && st.addTuViCapped) {
      var base = 20;
      if (isDanDocFatigued(player)) base = Math.round(base * (1 - getDanDoc(player) / 200));
      gained = st.addTuViCapped(player, elem, base);
    }
    if (pillId === 'thanh-doc-dan') {
      useThanhDocDan(player);
    }
    st.savePlayer(player);
    return { ok: true, gained: gained, toxin: getDanDoc(player), msg: 'Dùng ' + itemName(pillId) + '.' };
  }

  // ---------------- Save old integration done in state.js ----------------

  // Exports
  exports.FURNACES = FURNACES;
  exports.FURNACE_GRADES = FURNACE_GRADES;
  exports.ALCHEMIST_RANKS = ALCHEMIST_RANKS;
  exports.GRADE_NAMES = GRADE_NAMES;
  exports.GRADE_INDEX = GRADE_INDEX;
  exports.PILL_RECIPES = PILL_RECIPES;
  exports.BREAKTHROUGH_PILLS = BREAKTHROUGH_PILLS;
  exports.KY_TRAN = KY_TRAN;
  exports.RECIPE_KNOWLEDGE = RECIPE_KNOWLEDGE;
  exports.SINH = SINH;
  exports.ensureState = ensureState;
  exports.getFurnace = getFurnace;
  exports.getFurnaces = getFurnaces;
  exports.getFurnaceGrade = getFurnaceGrade;
  exports.setFurnaceGrade = setFurnaceGrade;
  exports.canUseFurnace = canUseFurnace;
  exports.listFurnacesFor = listFurnacesFor;
  exports.listFurnaces = listFurnacesFor;
  exports.getRecipe = getRecipe;
  exports.getPillRecipe = getPillRecipe;
  exports.getBreakthroughRecipe = getBreakthroughRecipe;
  exports.isBreakthrough = isBreakthrough;
  exports.getRecipeInfo = getRecipeInfo;
  exports.getProficiency = getProficiency;
  exports.recordProficiency = recordProficiency;
  exports.isQuickRefineUnlocked = isQuickRefineUnlocked;
  exports.quickRefine = quickRefine;
  exports.proficiencyBonus = proficiencyBonus;
  exports.getAlchemistRank = getAlchemistRank;
  exports.getAlchemistRankName = getAlchemistRankName;
  exports.takeExam = takeExam;
  exports.getDanDoc = getDanDoc;
  exports.addDanDoc = addDanDoc;
  exports.isDanDocFatigued = isDanDocFatigued;
  exports.useThanhDocDan = useThanhDocDan;
  exports.detoxRest = detoxRest;
  exports.getRecipeBook = getRecipeBook;
  exports.isRecipeLearned = isRecipeLearned;
  exports.canLearnRecipe = canLearnRecipe;
  exports.learnRecipe = learnRecipe;
  exports.addFragment = addFragment;
  exports.combineFragments = combineFragments;
  exports.tryVariantDiscovery = tryVariantDiscovery;
  exports.getKyTran = getKyTran;
  exports.previewRefine = previewRefine;
  exports.refineBatch = refineBatch;
  exports.refine = refineBatch;
  exports.consumePill = consumePill;
  // aliases english
  exports.refinePill = refineBatch;
  exports.craft = refineBatch;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameLuyenDan = {}));
