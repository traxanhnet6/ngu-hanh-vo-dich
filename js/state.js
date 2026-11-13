/**
 * state.js — Quản lý trạng thái người chơi, tính toán ngũ hành & lưu trữ dữ liệu
 * Tương thích cả trình duyệt và môi trường Node.js (smoke test).
 */
(function (global) {
  'use strict';

  var STORAGE_PREFIX = 'nguhanh_';

  // Bộ nhớ đệm dự phòng khi chạy trong Node.js không có localStorage
  var memoryStorage = {};

  function getStorage(customStorage) {
    if (customStorage) return customStorage;
    if (typeof global !== 'undefined' && global.localStorage) return global.localStorage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return {
      getItem: function (k) { return memoryStorage.hasOwnProperty(k) ? memoryStorage[k] : null; },
      setItem: function (k, v) { memoryStorage[k] = String(v); },
      removeItem: function (k) { delete memoryStorage[k]; },
      clear: function () { memoryStorage = {}; }
    };
  }

  /**
   * Tính chỉ số Hài Hòa (Harmony): theo hồ sơ 02 & brief,
   * lực tổng và độ tương sinh bị kéo theo đường tu yếu nhất (min tu vi).
   * @param {Object} paths Đối tượng 5 đường ngũ hành
   * @returns {number} Giá trị tu vi nhỏ nhất trong 5 đường
   */
  function harmonyOf(paths) {
    if (!paths) return 0;
    var k = (paths.kim && typeof paths.kim.tuVi === 'number') ? paths.kim.tuVi : 0;
    var m = (paths.moc && typeof paths.moc.tuVi === 'number') ? paths.moc.tuVi : 0;
    var t = (paths.thuy && typeof paths.thuy.tuVi === 'number') ? paths.thuy.tuVi : 0;
    var h = (paths.hoa && typeof paths.hoa.tuVi === 'number') ? paths.hoa.tuVi : 0;
    var th = (paths.tho && typeof paths.tho.tuVi === 'number') ? paths.tho.tuVi : 0;
    return Math.min(k, m, t, h, th);
  }

  /**
   * Đợt K2 — Chỉ số Hài Hòa HH theo hồ sơ 02 §5 (khác harmonyOf ở trên vốn
   * là tu vi đường yếu nhất dùng cho hiển thị/cổng đột phá):
   * mỗi đường tính theo % trần của MỐC hiện tại (mốc do đường yếu nhất quyết
   * định, thang trần tích lũy khớp realmRankFromPaths: Luyện Khí 100/tầng,
   * Trúc Cơ 400/giai đoạn, Kim Đan 1.200, Nguyên Anh 3.600, Hóa Thần 9.000):
   *   frac(đường) = kẹp((tuVi − đáy mốc) / trần mốc, 0, 1)
   *   HH = min(frac) / max(frac); mọi đường bằng nhau (kể cả cùng 0) → HH = 1.
   * Hệ số lực Hài Hòa: f(HH) = 0,8 + 0,45 × HH (hồ sơ 02 §5), CHUẨN HÓA trên
   * f(1) = 1,25 để trạng thái cân bằng giữ nguyên 100% số cân bằng bản live
   * (đợt 6 đã chỉnh quái đầu game theo số này); lệch cân bằng thì bị kéo
   * xuống tối đa −36% — đúng tinh thần "lực tổng kéo theo đường yếu nhất" và
   * đúng chênh tương đối 0,8↔1,25 của khung hồ sơ.
   */
  function harmonyMilestone(minTuVi) {
    if (minTuVi < 900) {
      var lkBase = Math.floor(minTuVi / 100) * 100;
      return { base: lkBase, cap: 100 };
    }
    if (minTuVi < 2500) return { base: 900 + Math.floor((minTuVi - 900) / 400) * 400, cap: 400 };
    if (minTuVi < 7300) return { base: 2500 + Math.floor((minTuVi - 2500) / 1200) * 1200, cap: 1200 };
    if (minTuVi < 21700) return { base: 7300 + Math.floor((minTuVi - 7300) / 3600) * 3600, cap: 3600 };
    return { base: 21700 + Math.floor((minTuVi - 21700) / 9000) * 9000, cap: 9000 };
  }

  function harmonyDetail(paths) {
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var vals = {};
    var min = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var p = paths ? paths[keys[i]] : null;
      var v = (p && typeof p.tuVi === 'number') ? p.tuVi : 0;
      vals[keys[i]] = v;
      if (v < min) min = v;
    }
    if (!isFinite(min)) min = 0;
    var ms = harmonyMilestone(min);
    var fracs = {};
    var minF = Infinity, maxF = 0;
    for (var j = 0; j < keys.length; j++) {
      var f = (vals[keys[j]] - ms.base) / ms.cap;
      if (f < 0) f = 0;
      if (f > 1) f = 1;
      fracs[keys[j]] = f;
      if (f < minF) minF = f;
      if (f > maxF) maxF = f;
    }
    var hh = (maxF > 0) ? (minF / maxF) : 1;
    var rawF = 0.8 + 0.45 * hh;
    return {
      hh: hh,
      fracs: fracs,
      rawFactor: rawF,
      factor: rawF / 1.25,
      milestoneBase: ms.base,
      milestoneCap: ms.cap
    };
  }

  /** HH thuần (0..1) theo hồ sơ 02 §5 — dùng cho cổng Liên Hoàn/hợp kích. */
  function harmonyRatio(paths) {
    return harmonyDetail(paths).hh;
  }

  /**
   * Dẫn xuất chỉ số nhân vật từ 5 trụ ngũ hành (theo hồ sơ 49):
   * - Thổ: Khí huyết & phòng thủ (tăng hpMax vượt trội)
   * - Kim: Công kích & xuyên giáp
   * - Hỏa: Bạo kích & sát thương bùng nổ
   * - Thủy: Linh lực tối đa & khống chế (tăng linhLucMax)
   * - Mộc: Hồi phục khí huyết & linh lực
   * 
   * Tại mốc khởi đầu (0 tu vi ngũ hành), giá trị cơ bản chuẩn:
   * hpMax = 100, linhLucMax = 20.
   * 
   * @param {Object} paths 5 đường tu
   * @returns {Object} Các chỉ số phái sinh
   */
  function deriveStats(paths, equipment, kimDanPham) {
    var k = (paths && paths.kim && paths.kim.tuVi) || 0;
    var m = (paths && paths.moc && paths.moc.tuVi) || 0;
    var t = (paths && paths.thuy && paths.thuy.tuVi) || 0;
    var h = (paths && paths.hoa && paths.hoa.tuVi) || 0;
    var th = (paths && paths.tho && paths.tho.tuVi) || 0;

    // hpMax bắt đầu từ 100, tăng mạnh nhất từ Thổ (+2.0/tuVi), Kim chỉ tăng nhẹ (+0.2/tuVi)
    var hpMax = Math.round(100 + (th * 2.0) + (k * 0.2) + (m * 0.5) + (h * 0.1) + (t * 0.1));
    // linhLucMax bắt đầu từ 20, tăng chủ yếu từ Thủy (+1.5/tuVi)
    var linhLucMax = Math.round(20 + (t * 1.5) + (m * 0.2));
    // Đợt T3 — PHẨM KIM ĐAN (hồ sơ 05C): phẩm là thưởng VĨNH VIỄN, một kênh
    // là SỨC CHỨA LINH LỰC. Hồ sơ chỉ chốt kênh (tu vi / luyện đan / linh
    // lực), không chốt số — số dưới đây là SỐ ĐỘI SOẠN đợt T3 (provisional,
    // khai trong báo cáo đợt): mỗi phẩm trên Nhất phẩm +5% linh lực tối đa
    // (Cửu phẩm = +40%). Không truyền phẩm (mọi lời gọi cũ) -> hệ số 1,
    // hành vi y như trước đợt.
    var pham = (typeof kimDanPham === 'number' && isFinite(kimDanPham))
      ? Math.floor(kimDanPham)
      : (kimDanPham && typeof kimDanPham === 'object' ? getKimDanPham(kimDanPham) : 0);
    if (pham >= 1) {
      linhLucMax = Math.round(linhLucMax * (1 + 0.05 * (pham - 1)));
    }

    // Đợt K2: Công kích của năm đường nhân hệ số Hài Hòa (hồ sơ 02 §5) —
    // một nguồn số duy nhất: bảng nhân vật hiện đúng số này và engine cũng
    // lấy đúng số này làm nền sát thương nên hai bên không bao giờ lệch.
    var harmony = harmonyDetail(paths);
    var attack = Math.round((10 + (k * 1.5)) * harmony.factor);
    var defense = Math.round(5 + (th * 1.2));
    var critRate = +(5.0 + (h * 0.2)).toFixed(1);
    var regenRate = +(1.0 + (m * 0.15)).toFixed(1);

    if (equipment) {
      var defs = null;
      if (typeof global !== 'undefined' && global.GameMonsters && global.GameMonsters.ITEM_DEFS) {
        defs = global.GameMonsters.ITEM_DEFS;
      } else if (typeof window !== 'undefined' && window.GameMonsters && window.GameMonsters.ITEM_DEFS) {
        defs = window.GameMonsters.ITEM_DEFS;
      } else if (typeof require === 'function') {
        try { defs = require('./monsters.js').ITEM_DEFS; } catch (e) {}
      }
      var eqSlots = ['weapon', 'armor', 'head', 'shoes', 'belt', 'jewelry', 'phapKhi'];
      for (var sIdx = 0; sIdx < eqSlots.length; sIdx++) {
        var sKey = eqSlots[sIdx];
        var itemVal = equipment[sKey];
        if (itemVal) {
          var itemDef = (typeof itemVal === 'string' && defs) ? defs[itemVal] : (typeof itemVal === 'object' ? itemVal : null);
          if (itemDef) {
            if (typeof itemDef.atk === 'number') attack += itemDef.atk;
            if (typeof itemDef.def === 'number') defense += itemDef.def;
          }
        }
      }
    }

    return {
      hpMax: hpMax,
      linhLucMax: linhLucMax,
      attack: attack,
      defense: defense,
      critRate: critRate,
      regenRate: regenRate,
      harmonyHH: harmony.hh,
      harmonyFactor: harmony.factor
    };
  }

  /**
   * Tạo cấu trúc dữ liệu người chơi mới
   */
  function createPlayer(name, options) {
    options = options || {};
    var charName = (name && name.trim()) || 'Hà Nhân';
    var starterPaths = {
      kim: { tuVi: 0 },
      moc: { tuVi: 0 },
      thuy: { tuVi: 0 },
      hoa: { tuVi: 0 },
      tho: { tuVi: 0 }
    };
    var stats = deriveStats(starterPaths);

    var initialSlots = new Array(48).fill(null);
    initialSlots[0] = { itemId: 'non-la', count: 1 };

    return {
      name: charName,
      x: options.x !== undefined ? options.x : 560,
      y: options.y !== undefined ? options.y : 620,
      dir: options.dir !== undefined ? options.dir : 0, // 0: nam (front)
      hp: stats.hpMax,
      hpMax: stats.hpMax,
      linhLuc: stats.linhLucMax,
      linhLucMax: stats.linhLucMax,
      paths: starterPaths,
      path: [],
      realm: 'Phàm Nhân',
      equipment: {
        weapon: null,
        armor: null,
        head: null,
        shoes: null,
        belt: null,
        jewelry: null,
        phapKhi: null
      },
      quests: {
        talked_linhnhi: false,
        current: 'talk_linhnhi',
        thaotinhKills: 0,
        huntCompleted: false,
        sectStage: 0,
        mainStage: 0,
        nhenKills: 0,
        bangXaKills: 0,
        hatClaimed: false,
        starterSwordGranted: false
      },
      face: options.face || 'Quyết tâm',
      linhThach: options.linhThach || 0,
      stats: { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 },
      usedGiftcodes: {},
      tieuMoc: { moc: 1, ngoDao: false, thangTinhAnh: false, focus: null },
      bagLocks: {},
      // Đợt V1 chặng 0 + chặng 7: trạng thái cơ chế vùng và việc mở vùng (xem ensureV1).
      v1: { poisonStacks: 0, poisonResistUntil: 0, unlockedZones: {}, zoneQuests: { activeQuestId: null, tracked: false, completed: {} } },
      // Đợt D1: trạng thái Linh Điền (đất/thửa/chăm/pháp quyết). ensureState ở linhdien.js sẽ chuẩn hóa khi nạp.
      linhDien: { soilLevel: 0, unlockedPlots: 6, plots: [], spells: {}, soilFertility: 0 },
      // Đợt D2: trạng thái Luyện Đan tương tác. ensureState ở luyendan.js sẽ chuẩn hóa khi nạp.
      luyenDan: { furnaceGrade: 0, proficiency: {}, successes: 0, examsPassed: 0, rank: 0, toxin: 0, recipes: [], availableRecipes: [], fragments: {}, pillGrades: {}, lastGrade: null },
      // Đợt E1: trạng thái trang bị cấp phát (luân phiên ô, nhiệm vụ bổ sung).
      trangBi: { nextSlotIndex: 0, issued: [], grantedMilestones: [], supplementary: {}, buybacks: {} },
      revivalPool: 5,
      revivalLastRegen: Date.now(),
      lastSpringUse: 0,
      bag: {
        slots: initialSlots
      },
      tuiKho: null,
      daily: {},
      // Đợt E3: trạng thái bí cảnh/sự kiện. ensureState ở bi-canh.js chuẩn hóa khi nạp.
      biCanh: { currentRun: null, runs: [], rewards: {}, reminders: {}, areaBuffs: {}, combatLogs: {}, troiMoProgress: { floor: 0, completed: false }, nguHanhProgress: { openedGates: [], middleOpened: false } },
      // Đợt N2: trạng thái Linh Thú. ensureState ở linh-thu.js chuẩn hóa khi nạp.
      linhThu: { companions: [], mainId: null, eggs: [], barn: [], houseGuardPetId: null, gathered: { items: [], lastCollectMs: Date.now(), daily: { date: '', count: 0 } }, metTrainer: false, firstHoanGiven: false, tamingLog: [], ridingPetId: null, isRiding: false },
      huntChain: {
        count: 0,
        timer: 0
      },
      farmSession: null,
      createdAt: Date.now(),
      lastSaved: Date.now()
    };
  }

  /**
   * Cài đặt mặc định
   */
  function defaultSettings() {
    return {
      musicVol: 0.7,
      sfxVol: 0.8,
      ambVol: 0.6,
      voiceVol: 0.9,
      voiceEnabled: true,
      muted: false,
      arrowGuidance: true,
      flourishEffects: true,
      screenShake: true,
      showDamageNumbers: true,
      autoPickup: false,
      autoPickupRank: 1,
      joystickMode: 'co_dinh',
      // Đợt 6 bổ sung theo hồ sơ 10/25/27/28 (mục 15)
      ctlOpacity: 1,
      brightness: 1,
      dialogTextSize: 'vua',
      hideHat: false,
      showClock: false,
      lefty: false,
      idleMute: false,
      duckMusic: true,
      joyDeadzone: 0.15,
      showBossTelegraph: true,
      showAggroRing: false,
      showMonsterHpText: false,
      minimapDestDot: true,
      fpsLimit: 60,
      // Hiển thị (Đợt 3, Note 8 & Đợt 6 Stage 2)
      uiScale: 1,
      joySize: 'vua',
      quality: 'cao',
      zoom: 1.0,
      display: { zoom: 1.0 },
      tutorialStep: 1,
      tutorialDone: false
    };
  }

  /**
   * Lưu dữ liệu nhân vật vào localStorage
   */
  function savePlayer(player, customStorage) {
    if (!player || !player.name) return false;
    var storage = getStorage(customStorage);
    player.lastSaved = Date.now();

    ensureTuiKho(player);

    // Đồng bộ lại chỉ số phái sinh (đợt T3: kèm phẩm Kim Đan nếu đã kết đan)
    var stats = deriveStats(player.paths, player.equipment, getKimDanPham(player));
    player.hpMax = stats.hpMax;
    player.linhLucMax = stats.linhLucMax;
    if (player.hp > player.hpMax) player.hp = player.hpMax;
    if (player.linhLuc > player.linhLucMax) player.linhLuc = player.linhLucMax;

    // REALMFIX: nhãn cảnh giới luôn khớp hạng suy ra từ tu vi mỗi lần lưu
    syncRealmLabel(player);

    var serialized = JSON.stringify(player);
    var key = STORAGE_PREFIX + 'char_' + player.name;
    storage.setItem(key, serialized);

    // Cập nhật danh sách nhân vật
    var list = listCharacters(storage);
    if (list.indexOf(player.name) === -1) {
      list.push(player.name);
      storage.setItem(STORAGE_PREFIX + 'chars', JSON.stringify(list));
    }
    storage.setItem(STORAGE_PREFIX + 'active_char', player.name);
    return true;
  }

  /**
   * Tải dữ liệu nhân vật
   */
  function loadPlayer(name, customStorage) {
    if (!name) return null;
    var storage = getStorage(customStorage);
    var key = STORAGE_PREFIX + 'char_' + name;
    var raw = storage.getItem(key);
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      // Đảm bảo cấu trúc đầy đủ
      if (!data.paths) {
        data.paths = { kim: { tuVi: 0 }, moc: { tuVi: 0 }, thuy: { tuVi: 0 }, hoa: { tuVi: 0 }, tho: { tuVi: 0 } };
      }
      if (!data.equipment) {
        data.equipment = { weapon: null, armor: null, head: null, shoes: null, belt: null, jewelry: null, phapKhi: null };
      } else {
        if (data.equipment.weapon === undefined) data.equipment.weapon = null;
        if (data.equipment.armor === undefined) data.equipment.armor = null;
        if (data.equipment.head === undefined) data.equipment.head = null;
        if (data.equipment.shoes === undefined) data.equipment.shoes = null;
        if (data.equipment.belt === undefined) data.equipment.belt = null;
        if (data.equipment.jewelry === undefined) data.equipment.jewelry = null;
        if (data.equipment.phapKhi === undefined) data.equipment.phapKhi = null;
      }
      if (!data.quests) {
        data.quests = {
          talked_linhnhi: false,
          current: 'talk_linhnhi',
          thaotinhKills: 0,
          huntCompleted: false,
          sectStage: 0,
          mainStage: 0,
          nhenKills: 0,
          bangXaKills: 0,
          hatClaimed: false,
          starterSwordGranted: false
        };
      } else {
        if (data.quests.sectStage === undefined) {
          data.quests.sectStage = 0;
        }
        if (data.quests.mainStage === undefined) {
          data.quests.mainStage = (data.quests.sectStage >= 4) ? 1 : 0;
        }
        if (data.quests.nhenKills === undefined) {
          data.quests.nhenKills = 0;
        }
        if (data.quests.bangXaKills === undefined) {
          data.quests.bangXaKills = 0;
        }
        if (data.quests.hatClaimed === undefined) {
          data.quests.hatClaimed = false;
        }
        if (data.quests.starterSwordGranted === undefined) {
          data.quests.starterSwordGranted = false;
        }
      }
      if (data.lastSpringUse === undefined) {
        data.lastSpringUse = 0;
      }
      if (!data.stats || typeof data.stats !== 'object') {
        data.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
      }
      if (!data.usedGiftcodes || typeof data.usedGiftcodes !== 'object') {
        data.usedGiftcodes = {};
      }
      // Đợt T1: save cũ chưa có trạng thái đột phá tiểu mốc -> suy mốc từ
      // tu vi/nhãn hiện có; tu vi đã có GIỮ NGUYÊN (không cắt theo trần mới).
      ensureTieuMoc(data);
      // Đợt T3: save cũ chưa có trạng thái Kim Đan -> bổ sung mặc định
      // (chưa kết đan: phẩm 0, không đổi bất kỳ số nào của nhân vật).
      ensureKimDan(data);
      // Đợt V1 chặng 0: save cũ chưa có trạng thái cơ chế vùng -> bổ sung
      // mặc định (chưa nhiễm độc, chưa kháng độc, chưa mở việc vùng nào).
      ensureV1(data);
      // Đợt D1: save cũ chưa có Linh Điền thật -> bổ sung mặc định an toàn.
      try { var _ld = require('./linhdien.js'); if (_ld && _ld.ensureState) _ld.ensureState(data); } catch (e) {}
      // Đợt D2: save cũ chưa có Luyện Đan tương tác -> bổ sung mặc định an toàn.
      try { var _ld2 = require('./luyendan.js'); if (_ld2 && _ld2.ensureState) _ld2.ensureState(data); } catch (e) {}
      // Đợt E1: save cũ chưa có trạng thái trang bị cấp phát -> bổ sung mặc định an toàn.
      try { var _tb = require('./trangbi.js'); if (_tb && _tb.ensureState) _tb.ensureState(data); } catch (e) {}
      // Đợt E2: save cũ túi phẳng -> vật chứa mới (migration).
      try { var _tk = require('./tui-kho.js'); if (_tk && _tk.ensureState) _tk.ensureState(data); } catch (e) {}
      // HERBQ: hồi tố vật phẩm thảo dược cũ về trung phẩm (1).
      try { var _hq = (typeof window !== 'undefined' && window.GameHerbQuality) ? window.GameHerbQuality : (typeof require === 'function' ? require('./herb-quality.js') : null); var _herbs = {'la-thanh-tuy':1,'linh-chi-rung':1,'hoa-giai-doc':1,'bang-tinh':1,'bang-tuy':1,'hoa-tinh-tho':1,'cat-tinh':1,'manh-kiem-gay':1,'hon-kiem-nho':1,'nguyen-tinh-moc':1,'nguyen-tinh-thuy':1,'nguyen-tinh-hoa':1,'nguyen-tinh-tho':1,'nguyen-tinh-kim':1,'nuoc-oc-dao-tinh-khiet':1,'dia-tam-thach-vun':1,'da-nung':1,'ngoc-bang-tam':1,'ngoc-cat-tam':1,'huyen-thiet-khoi':1}; var _cs = data.tuiKho && data.tuiKho.containers || {}; if (_hq && _hq.normalizeItem) Object.keys(_cs).forEach(function(k){ (_cs[k].slots||[]).forEach(function(it){ if(it && _herbs[it.itemId]) _hq.normalizeItem(it); }); }); } catch (e) {}
      // Đợt E3: save cũ chưa có trạng thái bí cảnh/sự kiện -> bổ sung mặc định an toàn.
      try { var _bc = require('./bi-canh.js'); if (_bc && _bc.ensureState) _bc.ensureState(data); } catch (e) {}
      // Đợt N2: save cũ chưa có trạng thái Linh Thú -> bổ sung mặc định an toàn.
      // Trình duyệt đi qua global GameLinhThu; Node đi qua require.
      if (typeof window !== 'undefined' && window.GameLinhThu && window.GameLinhThu.ensureState) { window.GameLinhThu.ensureState(data); }
      else { try { var _lt = require('./linh-thu.js'); if (_lt && _lt.ensureState) _lt.ensureState(data); } catch (e) {} }
      if (!data.bagLocks || typeof data.bagLocks !== 'object') {
        data.bagLocks = {};
      }
      var stats = deriveStats(data.paths, data.equipment, getKimDanPham(data));
      data.hpMax = stats.hpMax;
      data.linhLucMax = stats.linhLucMax;
      // REALMFIX: chuẩn hóa nhãn cảnh giới cho bản lưu cũ ngay khi nạp
      // (chỉ đổi trường realm trong bộ nhớ; các dữ liệu khác giữ nguyên,
      // nhãn mới được ghi xuống ở lần lưu kế tiếp như mọi trường phái sinh)
      syncRealmLabel(data);
      return data;
    } catch (e) {
      return null;
    }
  }

  // Đợt V1 chặng 0 + chặng 7: save cũ chưa có trạng thái cơ chế vùng -> bổ sung mặc định.
  // player.v1: { poisonStacks (tầng độc đang tích, chặng 1),
  //   poisonResistUntil (mốc giây kháng độc còn lại, chặng 1),
  //   unlockedZones (việc mở vùng đã hoàn thành theo mapId, chặng 7),
  //   zoneQuests (tiến trình 4 việc mở vùng hồ sơ 01, chặng 7) }.
  function ensureV1(player) {
    if (!player) return null;
    if (!player.v1 || typeof player.v1 !== 'object') {
      player.v1 = { poisonStacks: 0, poisonResistUntil: 0, unlockedZones: {}, zoneQuests: { activeQuestId: null, tracked: false, completed: {} } };
    }
    var v1 = player.v1;
    if (typeof v1.poisonStacks !== 'number' || !isFinite(v1.poisonStacks) || v1.poisonStacks < 0) v1.poisonStacks = 0;
    v1.poisonStacks = Math.floor(v1.poisonStacks);
    if (typeof v1.poisonResistUntil !== 'number' || !isFinite(v1.poisonResistUntil) || v1.poisonResistUntil < 0) v1.poisonResistUntil = 0;
    if (!v1.unlockedZones || typeof v1.unlockedZones !== 'object' || Array.isArray(v1.unlockedZones)) v1.unlockedZones = {};
    if (!v1.zoneQuests || typeof v1.zoneQuests !== 'object') {
      v1.zoneQuests = { activeQuestId: null, tracked: false, completed: {} };
    }
    if (!v1.zoneQuests.completed || typeof v1.zoneQuests.completed !== 'object') {
      v1.zoneQuests.completed = {};
    }
    return v1;
  }

  // Đợt D2: save cũ chưa có Luyện Đan tương tác -> bổ sung mặc định an toàn.
  function ensureLuyenDan(player) {
    if (!player) return null;
    try {
      var ldMod = null;
      if (typeof global !== 'undefined' && global.GameLuyenDan && global.GameLuyenDan.ensureState) ldMod = global.GameLuyenDan;
      else if (typeof window !== 'undefined' && window.GameLuyenDan && window.GameLuyenDan.ensureState) ldMod = window.GameLuyenDan;
      else { try { ldMod = require('./luyendan.js'); } catch (e) { ldMod = null; } }
      if (ldMod && ldMod.ensureState) return ldMod.ensureState(player);
    } catch (e) {}
    if (!player.luyenDan || typeof player.luyenDan !== 'object') player.luyenDan = { furnaceGrade: 0, proficiency: {}, successes: 0, examsPassed: 0, rank: 0, toxin: 0, recipes: [], availableRecipes: [], fragments: {}, pillGrades: {}, lastGrade: null };
    return player.luyenDan;
  }

  // Đợt D1: save cũ chưa có Linh Điền thật -> bổ sung mặc định an toàn.
  // (linhdien.js.ensureState làm phần chính; hàm này chỉ là cầu nối để state.js
  // không phụ thuộc cứng vào linhdien.js khi nạp module trong Node.)
  function ensureLinhDien(player) {
    if (!player) return null;
    try {
      var ldMod = null;
      if (typeof global !== 'undefined' && global.GameLinhDien && global.GameLinhDien.ensureState) ldMod = global.GameLinhDien;
      else if (typeof window !== 'undefined' && window.GameLinhDien && window.GameLinhDien.ensureState) ldMod = window.GameLinhDien;
      else { try { ldMod = require('./linhdien.js'); } catch (e) { ldMod = null; } }
      if (ldMod && ldMod.ensureState) return ldMod.ensureState(player);
    } catch (e) {}
    if (!player.linhDien || typeof player.linhDien !== 'object') player.linhDien = { soilLevel: 0, unlockedPlots: 6, plots: [], spells: {}, soilFertility: 0 };
    if (!Array.isArray(player.linhDien.plots)) player.linhDien.plots = [];
    return player.linhDien;
  }

  // ==========================================================================
  // HẠNG CẢNH GIỚI SUY RA (REALM RANK) — Dùng cho khóa cổng bản đồ
  // ==========================================================================
  var REALM_STAGE_SUFFIX = ['Sơ Kỳ', 'Trung Kỳ', 'Hậu Kỳ', 'Viên Mãn'];

  function realmRankFromString(realm) {
    if (!realm || typeof realm !== 'string') return -1;
    var m = realm.match(/Luyện Khí.*?(?:tầng|Tầng)\s*(\d+)/);
    if (m) return Math.max(1, Math.min(9, parseInt(m[1], 10)));
    var bases = [ ['Trúc Cơ', 10], ['Kim Đan', 14], ['Nguyên Anh', 18], ['Hóa Thần', 22] ];
    for (var i = 0; i < bases.length; i++) {
      if (realm.indexOf(bases[i][0]) !== -1) {
        var off = 0;
        for (var s = 0; s < 4; s++) {
          if (realm.indexOf(REALM_STAGE_SUFFIX[s]) !== -1) { off = s; break; }
        }
        return bases[i][1] + off;
      }
    }
    if (realm.indexOf('Phàm Nhân') !== -1) return 0;
    return -1;
  }

  function realmRankFromPaths(paths) {
    if (!paths) return 0;
    var keys = ['moc', 'thuy', 'hoa', 'tho', 'kim'];
    var min = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var p = paths[keys[i]];
      var v = p && typeof p.tuVi === 'number' ? p.tuVi : 0;
      if (v < min) min = v;
    }
    if (!isFinite(min) || min <= 0) return 0;
    if (min < 900) return Math.min(9, Math.floor(min / 100) + 1);
    if (min < 2500) return Math.min(13, 10 + Math.floor((min - 900) / 400));
    if (min < 7300) return Math.min(17, 14 + Math.floor((min - 2500) / 1200));
    if (min < 21700) return Math.min(21, 18 + Math.floor((min - 7300) / 3600));
    if (min < 100000) return Math.min(25, 22 + Math.floor((min - 21700) / 19575));
    return 25;
  }

  function getRealmRank(player) {
    if (!player) return 0;
    var byString = realmRankFromString(player.realm);
    var byPaths = realmRankFromPaths(player.paths);
    return Math.max(byString >= 0 ? byString : 0, byPaths);
  }

  function realmRankLabel(rank) {
    if (rank <= 0) return 'Phàm Nhân';
    if (rank <= 9) return 'Luyện Khí tầng ' + rank;
    if (rank <= 13) return 'Trúc Cơ ' + REALM_STAGE_SUFFIX[rank - 10];
    if (rank <= 17) return 'Kim Đan ' + REALM_STAGE_SUFFIX[rank - 14];
    if (rank <= 21) return 'Nguyên Anh ' + REALM_STAGE_SUFFIX[rank - 18];
    return 'Hóa Thần ' + REALM_STAGE_SUFFIX[Math.min(3, rank - 22)];
  }

  /**
   * REALMFIX (2026-11-09): đồng bộ nhãn cảnh giới lưu trong player.realm với
   * hạng suy ra — nhãn hiển thị (HUD, bảng nhân vật) đọc player.realm dạng
   * chuỗi tĩnh, mà trước đây chuỗi này chỉ được ghi lúc tạo nhân vật
   * ('Phàm Nhân') và lúc đột phá Trúc Cơ, nên qua các tầng Luyện Khí nhãn
   * không bao giờ đổi. getRealmRank lấy max(hạng từ chuỗi, hạng từ tu vi)
   * nên nhãn đồng bộ chỉ GIỮ NGUYÊN hoặc NÂNG lên — không bao giờ hạ một
   * cảnh giới đã đạt. Gọi tại: savePlayer, loadPlayer (chuẩn hóa bản lưu
   * cũ) và điểm cộng tu vi khi hạ quái trong engine.
   *
   * DOTPHA-LABEL (2026-11-09, lệnh trực tiếp của Bui): nhãn suy từ TU VI bị
   * chặn ở "Luyện Khí tầng 9" chừng nào nhân vật CHƯA đột phá thật — hạng
   * tu vi chạm 10 (min 900) vẫn chỉ là Luyện Khí tầng 9 chờ đột phá; nhãn
   * "Trúc Cơ ..." chỉ xuất hiện sau khi tryBreakthrough thành công (nơi duy
   * nhất ghi chuỗi Trúc Cơ vào player.realm). Dấu hiệu "đã đột phá" là hạng
   * suy từ CHUỖI hiện tại >= 10: khi đó giữ nguyên luật đơn điệu của
   * REALMFIX (max của hạng chuỗi và hạng tu vi — đã Trúc Cơ/Kim Đan thì
   * không bao giờ bị kéo xuống). getRealmRank và mọi cổng khóa dùng hạng
   * KHÔNG đổi — chỉ nhãn lưu trong player.realm bị chặn.
   */
  function syncRealmLabel(player) {
    if (!player) return player;
    var byString = realmRankFromString(player.realm);
    var byPaths = realmRankFromPaths(player.paths);
    var rank;
    if (byString >= 10) {
      // Đã từng đột phá thật (chuỗi do tryBreakthrough ghi): nhãn không bao
      // giờ bị kéo xuống. Đợt T3 mở rộng luật DOTPHA-LABEL cho mốc Kim Đan:
      // phần TU VI bị chặn ở TRẦN CỦA ĐẠI CẢNH GIỚI HIỆN TẠI — đầy trần
      // Trúc Cơ Viên Mãn (min 2500) KHÔNG tự hiện nhãn "Kim Đan", nhãn Kim
      // Đan chỉ mở khi đột phá Kim Đan thật thành công (engine ghi chuỗi);
      // tương tự trần Kim Đan chặn ở hạng 17 chờ đợt Nguyên Anh.
      var ceiling = byString <= 13 ? 13 : (byString <= 17 ? 17 : byPaths);
      rank = Math.max(byString, Math.min(byPaths, ceiling));
    } else {
      // Chưa đột phá: phần tu vi không được đẩy nhãn qua khỏi Luyện Khí tầng 9.
      rank = Math.max(byString >= 0 ? byString : 0, Math.min(byPaths, 9));
    }
    player.realm = realmRankLabel(rank);
    return player;
  }

  /**
   * Lấy danh sách tên nhân vật đã lưu
   */
  function listCharacters(customStorage) {
    var storage = getStorage(customStorage);
    var raw = storage.getItem(STORAGE_PREFIX + 'chars');
    if (!raw) return [];
    try {
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Xóa một nhân vật
   */
  function deleteCharacter(name, customStorage) {
    if (!name) return false;
    var storage = getStorage(customStorage);
    storage.removeItem(STORAGE_PREFIX + 'char_' + name);
    var list = listCharacters(storage);
    var idx = list.indexOf(name);
    if (idx !== -1) {
      list.splice(idx, 1);
      storage.setItem(STORAGE_PREFIX + 'chars', JSON.stringify(list));
    }
    var active = storage.getItem(STORAGE_PREFIX + 'active_char');
    if (active === name) {
      storage.removeItem(STORAGE_PREFIX + 'active_char');
    }
    return true;
  }

  /**
   * Tải cài đặt
   */
  function loadSettings(customStorage) {
    var storage = getStorage(customStorage);
    var raw = storage.getItem(STORAGE_PREFIX + 'settings');
    if (!raw) return defaultSettings();
    try {
      var parsed = JSON.parse(raw);
      var def = defaultSettings();
      var merged = Object.assign(def, parsed);
      if (!merged.display) merged.display = {};
      if (merged.zoom !== undefined && merged.display.zoom === undefined) {
        merged.display.zoom = merged.zoom;
      }
      if (merged.display.zoom !== undefined && merged.zoom === undefined) {
        merged.zoom = merged.display.zoom;
      }
      return merged;
    } catch (e) {
      return defaultSettings();
    }
  }

  /**
   * Lưu cài đặt
   */
  function saveSettings(settings, customStorage) {
    var storage = getStorage(customStorage);
    var current = loadSettings(storage);
    var merged = Object.assign(current, settings || {});
    if (merged.zoom !== undefined) {
      if (!merged.display) merged.display = {};
      merged.display.zoom = merged.zoom;
    } else if (merged.display && merged.display.zoom !== undefined) {
      merged.zoom = merged.display.zoom;
    }
    storage.setItem(STORAGE_PREFIX + 'settings', JSON.stringify(merged));
    return merged;
  }

  /**
   * Trang bị vật phẩm từ ô túi đồ
   */
  // equipItem supports:
  //   equipItem(player, slotIndex)  -> search all carried containers for gear at that flat index? (legacy)
  //   equipItem(player, containerId, slotIndex)
  //   equipItem(player, { containerId, slotIndex })
  function equipItem(player, a, b) {
    ensureTuiKho(player);
    var tk = __tk();
    var containerId = null;
    var slotIndex = null;
    if (typeof a === 'object' && a !== null && !Array.isArray(a)) {
      containerId = a.containerId || a.container || a.cId;
      slotIndex = (a.slotIndex !== undefined) ? a.slotIndex : a.slot;
    } else if (typeof b !== 'undefined') {
      containerId = a;
      slotIndex = b;
    } else if (typeof a === 'number') {
      // legacy: find first gear across carried containers at flat index? Instead search all slots in order.
      slotIndex = a;
    }
    // resolve container if missing: search carried containers for a slot containing gear
    var defs = null;
    if (typeof global !== 'undefined' && global.GameMonsters && global.GameMonsters.ITEM_DEFS) defs = global.GameMonsters.ITEM_DEFS;
    else if (typeof window !== 'undefined' && window.GameMonsters && window.GameMonsters.ITEM_DEFS) defs = window.GameMonsters.ITEM_DEFS;
    else if (typeof require === 'function') try { defs = require('./monsters.js').ITEM_DEFS; } catch (e) {}

    if (!containerId && tk && player.tuiKho) containerId = player.tuiKho.defaultContainerId;
    var targetContainer = null;
    var slotData = null;
    if (containerId && tk) {
      targetContainer = tk.getContainer(player, containerId);
      if (targetContainer) slotData = targetContainer.slots[slotIndex];
    } else if (tk) {
      // find first container/slot with gear
      var carried = tk.carriedContainerIds(player);
      // if slotIndex provided, try that index in each container
      for (var ci = 0; ci < carried.length && !slotData; ci++) {
        var c = tk.getContainer(player, carried[ci]);
        if (!c) continue;
        if (slotIndex !== null && slotIndex !== undefined && c.slots[slotIndex]) {
          var d = defs ? defs[c.slots[slotIndex].itemId] : null;
          if (d && d.type === 'gear') { targetContainer = c; slotData = c.slots[slotIndex]; containerId = c.id; }
        }
      }
      if (!slotData) {
        // scan all slots in order
        for (var ci2 = 0; ci2 < carried.length && !slotData; ci2++) {
          var c2 = tk.getContainer(player, carried[ci2]);
          if (!c2) continue;
          for (var si = 0; si < c2.slots.length; si++) {
            var s = c2.slots[si];
            if (!s || tk.isContainerItem(s)) continue;
            var dd = defs ? defs[s.itemId] : null;
            if (dd && dd.type === 'gear') { targetContainer = c2; slotData = s; containerId = c2.id; slotIndex = si; break; }
          }
        }
      }
    }
    if (!slotData || !slotData.itemId) return { ok: false, msg: 'Ô trống' };
    var def = defs ? defs[slotData.itemId] : null;
    if (!def || def.type !== 'gear' || !def.slot) return { ok: false, msg: 'Vật phẩm không thể trang bị' };

    if (!player.equipment) player.equipment = { weapon: null, armor: null, head: null, shoes: null, belt: null, jewelry: null, phapKhi: null };
    var targetSlot = def.slot;
    var oldItemId = player.equipment[targetSlot];

    player.equipment[targetSlot] = slotData.itemId;
    // remove from container
    if (targetContainer) targetContainer.slots[slotIndex] = null;
    // old item -> default container
    if (oldItemId) {
      if (tk) tk.addItemToPlayer(player, oldItemId, 1);
    }

    var stats = deriveStats(player.paths, player.equipment);
    player.hpMax = stats.hpMax;
    player.linhLucMax = stats.linhLucMax;
    savePlayer(player);

    return { ok: true, msg: 'Đã trang bị ' + def.name, slot: targetSlot, equippedId: player.equipment[targetSlot], swappedId: oldItemId, containerId: containerId, slotIndex: slotIndex };
  }

  /**
   * Cởi trang bị đưa về túi
   */
  function unequipItem(player, slotName, targetContainerId) {
    if (!player || !player.equipment || !player.equipment[slotName]) {
      return { ok: false, msg: 'Không có trang bị ở ô này' };
    }
    ensureTuiKho(player);
    var tk = __tk();
    var itemId = player.equipment[slotName];
    player.equipment[slotName] = null;
    // return to default container (or specified)
    var r;
    if (targetContainerId && tk) {
      var c = tk.getContainer(player, targetContainerId);
      r = tk.addItemToContainer(c, itemId, 1);
    } else if (tk) {
      r = tk.addItemToPlayer(player, itemId, 1);
    } else {
      r = { success: false };
    }
    if (!r || r.success === false) {
      // revert equip
      player.equipment[slotName] = itemId;
      return { ok: false, msg: 'Túi đồ đã đầy, không thể cởi trang bị!' };
    }

    var defs = null;
    if (typeof global !== 'undefined' && global.GameMonsters && global.GameMonsters.ITEM_DEFS) defs = global.GameMonsters.ITEM_DEFS;
    else if (typeof window !== 'undefined' && window.GameMonsters && window.GameMonsters.ITEM_DEFS) defs = window.GameMonsters.ITEM_DEFS;
    else if (typeof require === 'function') try { defs = require('./monsters.js').ITEM_DEFS; } catch (e) {}
    var def = defs ? defs[itemId] : null;

    var stats = deriveStats(player.paths, player.equipment);
    player.hpMax = stats.hpMax;
    player.linhLucMax = stats.linhLucMax;
    savePlayer(player);

    return { ok: true, msg: 'Đã cởi ' + (def ? def.name : itemId), slot: slotName, itemId: itemId, containerId: r.containerId };
  }

  /**
   * Tính giới hạn trần mềm Tu Vi farm quái theo ngày (Hồ sơ 02 & Brief §6 & Check 10)
   * Trần 65/ngày: trong bể nhận đủ 100%, vượt bể nhận x0.25
   */
  var TU_VI_DAILY_POOL = 65;

  function calcTuViGain(currentFarmTuViToday, rawGain) {
    var pool = TU_VI_DAILY_POOL;
    var current = currentFarmTuViToday || 0;
    var raw = rawGain || 0;
    if (current < pool) {
      var rem = pool - current;
      if (raw <= rem) {
        return raw;
      } else {
        return rem + (raw - rem) * 0.25;
      }
    } else {
      return raw * 0.25;
    }
  }

  /**
   * Trần Linh Thạch rơi trực tiếp theo ngày, theo ĐẠI CẢNH GIỚI (Hồ sơ 50 §7 —
   * bảng ĐÃ CHỐT của Bui 2026-11-08 16:42; đợt T1 thay ngưỡng cứng 300/600 cũ
   * vốn chỉ đúng cho Luyện Khí bằng bảng theo cảnh giới thật):
   *   Luyện Khí 300 · Trúc Cơ 1.200 · Kim Đan 4.000 · Nguyên Anh 12.000 ·
   *   Hóa Thần 30.000.
   * Cảnh giới lấy từ CHUỖI cảnh giới đã đột phá thật (realmRankFromString):
   * tu vi chạm mốc nhưng CHƯA đột phá thì trần chưa nâng — đúng câu hồ sơ
   * "đột phá lên đại cảnh giới mới thì trần nâng ngay". Phàm Nhân (chưa vào
   * Luyện Khí) dùng trần Luyện Khí 300 như bản live trước nay vẫn áp.
   * Chạm trần: tỉ lệ rơi còn 1/4; vượt 2 lần trần: còn 1/10 (giữ đúng hình
   * dạng hệ số cũ, chỉ đổi ngưỡng theo cảnh giới).
   */
  var LINH_THACH_DAILY_CAPS = [300, 1200, 4000, 12000, 30000];

  function getLinhThachDailyCap(player) {
    if (!player) return LINH_THACH_DAILY_CAPS[0];
    var rank = realmRankFromString(player.realm);
    if (rank >= 22) return LINH_THACH_DAILY_CAPS[4];
    if (rank >= 18) return LINH_THACH_DAILY_CAPS[3];
    if (rank >= 14) return LINH_THACH_DAILY_CAPS[2];
    if (rank >= 10) return LINH_THACH_DAILY_CAPS[1];
    return LINH_THACH_DAILY_CAPS[0];
  }

  /**
   * Hệ số giảm dần (taper factor) của Linh Thạch farm theo ngày (Hồ sơ 50 §7):
   * chạm trần của cảnh giới hiện tại -> x0.25, vượt 2 lần trần -> x0.1.
   * Không truyền player thì dùng trần Luyện Khí 300 (khớp hành vi cũ).
   */
  function getLinhThachTaperFactor(totalFarmLinhThachToday, player) {
    var total = totalFarmLinhThachToday || 0;
    var cap = getLinhThachDailyCap(player);
    if (total >= cap * 2) return 0.1;
    if (total >= cap) return 0.25;
    return 1.0;
  }

  /**
   * Tính Linh Thạch thực nhận sau khi áp dụng trần giảm dần
   */
  function calcLinhThachGain(currentFarmLinhThachToday, rawAmount, player) {
    var factor = getLinhThachTaperFactor(currentFarmLinhThachToday, player);
    var gained = rawAmount * factor;
    // Làm tròn hoặc tối thiểu 1 nếu rawAmount >= 1 và factor > 0
    return Math.max(1, Math.round(gained));
  }

  // ==========================================================================
  // ĐỘT PHÁ TIỂU MỐC — TRẦN TU VI THEO MỐC (Đợt T1, hồ sơ 02 §1/§2/§3.3 + 06)
  // Mốc (moc): 1..9 = tầng Luyện Khí đang vươn tới trần của nó, 10..13 = các
  // giai đoạn Trúc Cơ. Trần MỖI ĐƯỜNG tại mốc = mốc tích lũy của mốc kế tiếp
  // theo đúng thang hạng của realmRankFromPaths: Luyện Khí 100/tầng (mốc m
  // trần m*100), Trúc Cơ 400/giai đoạn (mốc 10..13 trần 1300/1700/2100/2500).
  // Tu vi săn/luyện KHÔNG vượt trần của mốc chưa đột phá (cộng tác với bể tu
  // vi ngày 65 không đổi — D.2): đạt trần mốc thì dừng tăng dù bể ngày còn.
  // Save cũ chưa có trường tieuMoc: SUY mốc từ tu vi/nhãn hiện có, KHÔNG cắt
  // bớt tu vi đã có — đường vượt trần được coi là đầy cho điều kiện đột phá
  // của mốc hiện tại (addTuViCapped chỉ không cộng thêm, không bao giờ trừ).
  // ==========================================================================
  var PATH_KEYS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

  function mocCapFor(moc) {
    var m = (typeof moc === 'number' && isFinite(moc)) ? Math.floor(moc) : 1;
    if (m <= 1) return 100;
    if (m <= 9) return m * 100;
    if (m <= 13) return 900 + (m - 9) * 400;
    if (m <= 17) return 2500 + (m - 13) * 1200;
    if (m <= 21) return 7300 + (m - 17) * 3600;
    return 21700 + (Math.min(m, 25) - 21) * 9000;
  }

  function inferMoc(player) {
    if (!player) return 1;
    var byString = realmRankFromString(player.realm);
    if (byString >= 14) {
      // Đợt T3: đã đột phá Kim Đan thật: mốc = giai đoạn Kim Đan (14..17).
      return Math.max(14, Math.min(17, byString));
    }
    if (byString >= 10) {
      // Đã đột phá Trúc Cơ thật: mốc = giai đoạn Trúc Cơ theo nhãn (10..13).
      return Math.max(10, Math.min(13, byString));
    }
    var min = Infinity;
    for (var i = 0; i < PATH_KEYS.length; i++) {
      var p = player.paths ? player.paths[PATH_KEYS[i]] : null;
      var v = (p && typeof p.tuVi === 'number') ? p.tuVi : 0;
      if (v < min) min = v;
    }
    if (!isFinite(min) || min <= 0) return 1;
    return Math.max(1, Math.min(9, Math.ceil(min / 100)));
  }

  function ensureTieuMoc(player) {
    if (!player) return null;
    if (!player.tieuMoc || typeof player.tieuMoc !== 'object') {
      player.tieuMoc = { moc: inferMoc(player), ngoDao: false, thangTinhAnh: false, focus: null };
    }
    var st = player.tieuMoc;
    if (typeof st.moc !== 'number' || !isFinite(st.moc) || st.moc < 1 || st.moc > 25) {
      st.moc = inferMoc(player);
    }
    st.moc = Math.floor(st.moc);
    if (typeof st.ngoDao !== 'boolean') st.ngoDao = !!st.ngoDao;
    if (typeof st.thangTinhAnh !== 'boolean') st.thangTinhAnh = !!st.thangTinhAnh;
    if (st.focus === undefined) st.focus = null;
    return st;
  }

  function getMocIndex(player) {
    var st = ensureTieuMoc(player);
    return st ? st.moc : 1;
  }

  function setMocIndex(player, moc) {
    var st = ensureTieuMoc(player);
    if (st) st.moc = Math.max(1, Math.min(25, Math.floor(moc)));
    return st ? st.moc : 1;
  }

  /** Trần tu vi MỖI ĐƯỜNG tại mốc hiện tại của người chơi. */
  function getMocCap(player) {
    return mocCapFor(getMocIndex(player));
  }

  /**
   * Cộng tu vi cho một đường, kẹp tại trần mốc hiện tại. Trả về số THỰC cộng
   * (0 khi đường đã đầy/vượt trần — tu vi sẵn có không bao giờ bị cắt).
   * Đợt T3: nhân vật đã kết Kim Đan được cộng hệ số PHẨM ĐAN vào lượng tu vi
   * trước khi kẹp trần (kênh "hệ số tu vi" của hồ sơ 05C; số đội soạn:
   * +2% mỗi phẩm trên Nhất phẩm, Cửu phẩm = +16%). Chưa kết đan (phẩm 0)
   * thì hệ số 1 — hành vi y như trước đợt.
   */
  function addTuViCapped(player, elem, amount) {
    if (!player || !amount || amount <= 0) return 0;
    if (!player.paths) return 0;
    if (!player.paths[elem]) player.paths[elem] = { tuVi: 0 };
    var pham = getKimDanPham(player);
    var effective = amount;
    if (pham >= 1) effective = Math.round(amount * (1 + 0.02 * (pham - 1)));
    var cur = player.paths[elem].tuVi || 0;
    var room = getMocCap(player) - cur;
    if (room <= 0) return 0;
    var added = Math.min(effective, room);
    player.paths[elem].tuVi = cur + added;
    return added;
  }

  // ==========================================================================
  // TRẠNG THÁI KIM ĐAN — PHẨM ĐAN (Đợt T3, hồ sơ 02 §3.2 + 05C + 17A)
  // player.kimDan = {
  //   pham:     phẩm Kim Đan ĐÃ KẾT (0 = chưa kết đan; 1..9 = Nhất..Cửu phẩm),
  //   pillPham: phẩm của viên Ngũ Hành Quy Nguyên Đan đang giữ (tính theo
  //             Hài Hòa tại lúc LUYỆN — js/kimdan.js; 0 = chưa luyện viên nào),
  //   tamMaWins / tamMaFalls: số lần thắng/thua tâm ma khi kết đan.
  // }
  // Khởi tạo lười như ensureTieuMoc: save cũ không có trường này vẫn nạp
  // bình thường, mọi giá trị mặc định đều trung tính (phẩm 0 = không thưởng).
  // ==========================================================================
  function ensureKimDan(player) {
    if (!player) return null;
    if (!player.kimDan || typeof player.kimDan !== 'object') {
      player.kimDan = { pham: 0, pillPham: 0, tamMaWins: 0, tamMaFalls: 0 };
    }
    var kd = player.kimDan;
    if (typeof kd.pham !== 'number' || !isFinite(kd.pham) || kd.pham < 0 || kd.pham > 9) kd.pham = 0;
    if (typeof kd.pillPham !== 'number' || !isFinite(kd.pillPham) || kd.pillPham < 0 || kd.pillPham > 9) kd.pillPham = 0;
    kd.pham = Math.floor(kd.pham);
    kd.pillPham = Math.floor(kd.pillPham);
    if (typeof kd.tamMaWins !== 'number' || !isFinite(kd.tamMaWins) || kd.tamMaWins < 0) kd.tamMaWins = 0;
    if (typeof kd.tamMaFalls !== 'number' || !isFinite(kd.tamMaFalls) || kd.tamMaFalls < 0) kd.tamMaFalls = 0;
    if (kd.focus === undefined) kd.focus = null; // đích dẫn đường từ Bảng Đột Phá Kim Đan
    return kd;
  }

  /** Phẩm Kim Đan đã kết của người chơi (0 = chưa kết đan). */
  function getKimDanPham(player) {
    if (!player || !player.kimDan || typeof player.kimDan !== 'object') return 0;
    var p = player.kimDan.pham;
    return (typeof p === 'number' && isFinite(p) && p >= 1 && p <= 9) ? Math.floor(p) : 0;
  }

  /**
   * Thưởng Chuỗi Săn (Hunt Chain) (Brief §6 & Check 13)
   * bonus = min(50, floor(chain/10) * 5)%
   */
  function calcChainBonus(chainCount) {
    var count = chainCount || 0;
    return Math.min(50, Math.floor(count / 10) * 5);
  }

  function incrementHuntChain(player) {
    if (!player.huntChain) player.huntChain = { count: 0, timer: 0 };
    player.huntChain.count++;
    player.huntChain.timer = 20.0; // 20s duy trì chuỗi
    return player.huntChain.count;
  }

  function breakHuntChain(player) {
    if (player.huntChain) {
      player.huntChain.count = 0;
      player.huntChain.timer = 0;
    }
  }

  /**
   * Quản lý bể hồi sinh (Brief §7 & Check 14)
   * 5 lượt, hồi +1 mỗi 2 giờ thực.
   */
  var MAX_REVIVAL = 5;
  var REVIVAL_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 giờ thực (7,200,000ms)

  function checkRevivalPoolRegen(player, nowMs) {
    if (player.revivalPool === undefined) player.revivalPool = MAX_REVIVAL;
    var now = nowMs !== undefined ? nowMs : Date.now();
    if (!player.revivalLastRegen) player.revivalLastRegen = now;

    if (player.revivalPool < MAX_REVIVAL) {
      var elapsed = now - player.revivalLastRegen;
      if (elapsed >= REVIVAL_INTERVAL_MS) {
        var added = Math.floor(elapsed / REVIVAL_INTERVAL_MS);
        player.revivalPool = Math.min(MAX_REVIVAL, player.revivalPool + added);
        player.revivalLastRegen += added * REVIVAL_INTERVAL_MS;
        if (player.revivalPool >= MAX_REVIVAL) {
          player.revivalLastRegen = now;
        }
      }
    } else {
      player.revivalLastRegen = now;
    }
    return player.revivalPool;
  }

  function consumeRevivalCharge(player) {
    if (player.revivalPool === undefined) player.revivalPool = MAX_REVIVAL;
    if (player.revivalPool > 0) {
      if (player.revivalPool === MAX_REVIVAL) {
        player.revivalLastRegen = Date.now();
      }
      player.revivalPool--;
      return true;
    }
    return false;
  }

  function revivePlayer(player, type) {
    if (type === 'spot') {
      if (!consumeRevivalCharge(player)) return false;
      player.hp = Math.round(player.hpMax * 0.5);
      player.linhLuc = Math.round(player.linhLucMax * 0.5);
      breakHuntChain(player);
      return true;
    } else {
      // Về Miếu Hoang: miễn phí, không tốn lượt trong bể hồi sinh
      player.hp = player.hpMax;
      player.linhLuc = player.linhLucMax;
      breakHuntChain(player);
      return true;
    }
  }

  /**
   * Quản lý túi trữ vật (Brief §6: 8x6 = 48 ô)
   */
  var BAG_TOTAL_SLOTS = 48;

  function __tk() {
    try {
      if (typeof global !== 'undefined' && global.GameTuiKho) return global.GameTuiKho;
      if (typeof window !== 'undefined' && window.GameTuiKho) return window.GameTuiKho;
      return require('./tui-kho.js');
    } catch (e) { return null; }
  }
  function ensureTuiKho(player) {
    var tk = __tk();
    if (tk && tk.ensureState) return tk.ensureState(player);
    if (!player.tuiKho) player.tuiKho = null;
    return player.tuiKho;
  }
  function addItemToBag(player, itemId, count, itemDefs, extra) {
    ensureTuiKho(player);
    var tk = __tk();
    if (tk && tk.addItemToPlayer) {
      var r = tk.addItemToPlayer(player, itemId, count, itemDefs, extra);
      // compat: expose slot index-ish
      if (r && r.success) return { success: true, slot: (typeof r.slot === 'number' ? r.slot : 0), count: r.count, containerId: r.containerId, tempChest: r.tempChest };
      return { success: false, reason: r ? r.reason : 'full' };
    }
    // fallback old
    var cnt = (count !== undefined && count !== null) ? count : 1;
    if (itemId === 'linh-thach') { player.linhThach = (player.linhThach || 0) + cnt; return { success: true, slot: -1, count: player.linhThach }; }
    return { success: false, reason: 'full' };
  }

  function addHerbToBag(player, itemId, count, herbQuality, itemDefs) {
    ensureTuiKho(player); var tk = __tk();
    if (tk && tk.addItemToPlayer) return tk.addItemToPlayer(player, itemId, count, undefined, { herbQuality: herbQuality });
    return addItemToBag(player, itemId, count, itemDefs);
  }

  function countItemInBag(player, itemId) {
    ensureTuiKho(player);
    var tk = __tk();
    if (tk && tk.countItemInPlayer) return tk.countItemInPlayer(player, itemId);
    if (!player) return 0;
    if (itemId === 'linh-thach') return player.linhThach || 0;
    return 0;
  }

  function hasItemInBag(player, itemId, count) {
    var cnt = (count !== undefined && count !== null) ? count : 1;
    return countItemInBag(player, itemId) >= cnt;
  }

  function removeItemFromBag(player, itemId, count) {
    ensureTuiKho(player);
    var tk = __tk();
    if (tk && tk.removeItemFromPlayer) return tk.removeItemFromPlayer(player, itemId, count);
    return false;
  }

  var StateAPI = {
    STORAGE_PREFIX: STORAGE_PREFIX,
    harmonyOf: harmonyOf,
    harmonyRatio: harmonyRatio,
    harmonyDetail: harmonyDetail,
    deriveStats: deriveStats,
    createPlayer: createPlayer,
    defaultSettings: defaultSettings,
    savePlayer: savePlayer,
    loadPlayer: loadPlayer,
    getRealmRank: getRealmRank,
    realmRankLabel: realmRankLabel,
    syncRealmLabel: syncRealmLabel,
    realmRankFromString: realmRankFromString,
    realmRankFromPaths: realmRankFromPaths,
    listCharacters: listCharacters,
    deleteCharacter: deleteCharacter,
    loadSettings: loadSettings,
    saveSettings: saveSettings,

    // Các hàm Đợt 2
    TU_VI_DAILY_POOL: TU_VI_DAILY_POOL,
    calcTuViGain: calcTuViGain,
    LINH_THACH_DAILY_CAPS: LINH_THACH_DAILY_CAPS,
    getLinhThachDailyCap: getLinhThachDailyCap,
    getLinhThachTaperFactor: getLinhThachTaperFactor,
    calcLinhThachGain: calcLinhThachGain,
    mocCapFor: mocCapFor,
    inferMoc: inferMoc,
    ensureTieuMoc: ensureTieuMoc,
    getMocIndex: getMocIndex,
    setMocIndex: setMocIndex,
    getMocCap: getMocCap,
    addTuViCapped: addTuViCapped,
    ensureKimDan: ensureKimDan,
    ensureV1: ensureV1,
    ensureLinhDien: ensureLinhDien,
    ensureLuyenDan: ensureLuyenDan,
    ensureTrangBi: function (player) {
      try {
        var tb = require('./trangbi.js');
        if (tb && tb.ensureState) return tb.ensureState(player);
      } catch (e) {}
      if (!player.trangBi || typeof player.trangBi !== 'object') player.trangBi = { nextSlotIndex: 0, issued: [], grantedMilestones: [], supplementary: {}, buybacks: {} };
      return player.trangBi;
    },
    ensureTuiKho: function (player) {
      try {
        var tk = require('./tui-kho.js');
        if (tk && tk.ensureState) return tk.ensureState(player);
      } catch (e) {}
      return player ? player.tuiKho : null;
    },
    getKimDanPham: getKimDanPham,
    calcChainBonus: calcChainBonus,
    incrementHuntChain: incrementHuntChain,
    breakHuntChain: breakHuntChain,
    MAX_REVIVAL: MAX_REVIVAL,
    REVIVAL_INTERVAL_MS: REVIVAL_INTERVAL_MS,
    checkRevivalPoolRegen: checkRevivalPoolRegen,
    consumeRevivalCharge: consumeRevivalCharge,
    revivePlayer: revivePlayer,
    BAG_TOTAL_SLOTS: BAG_TOTAL_SLOTS,
    ensureTuiKho: ensureTuiKho,
    ensureBiCanh: function (player) {
      try {
        var bc = require('./bi-canh.js');
        if (bc && bc.ensureState) return bc.ensureState(player);
      } catch (e) {}
      if (!player.biCanh || typeof player.biCanh !== 'object') player.biCanh = { currentRun: null, runs: [], rewards: {}, reminders: {}, areaBuffs: {}, combatLogs: {}, troiMoProgress: { floor: 0, completed: false }, nguHanhProgress: { openedGates: [], middleOpened: false } };
      return player.biCanh;
    },
    ensureLinhThu: function (player) {
      if (typeof window !== 'undefined' && window.GameLinhThu && window.GameLinhThu.ensureState) return window.GameLinhThu.ensureState(player);
      try {
        var lt = require('./linh-thu.js');
        if (lt && lt.ensureState) return lt.ensureState(player);
      } catch (e) {}
      if (!player.linhThu || typeof player.linhThu !== 'object') player.linhThu = { companions: [], mainId: null, eggs: [], barn: [], houseGuardPetId: null, gathered: { items: [], lastCollectMs: Date.now(), daily: { date: '', count: 0 } }, metTrainer: false, firstHoanGiven: false, tamingLog: [], ridingPetId: null, isRiding: false };
      return player.linhThu;
    },
    grantStorageBag: function (player) {
      var tk = __tk();
      if (tk && tk.grantStorageContainer) return tk.grantStorageContainer(player);
      return { ok: false };
    },
    grantRing: function (player, grade) {
      var tk = __tk();
      if (tk && tk.grantRing) return tk.grantRing(player, grade);
      return { ok: false };
    },
    addItemToBag: addItemToBag,
    addHerbToBag: addHerbToBag,
    countItemInBag: countItemInBag,
    hasItemInBag: hasItemInBag,
    removeItemFromBag: removeItemFromBag,
    equipItem: equipItem,
    unequipItem: unequipItem
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameState = StateAPI;
  }
})(typeof window !== 'undefined' ? window : this);
