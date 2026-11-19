/**
 * mo-dau.js — Đợt M2: Phần mở đầu đầy đủ (kỷ nguyên phàm nhân)
 *
 * Một module duy nhất chứa luật + dữ liệu của phần mở đầu: trạng thái
 * player.moDau, migration save cũ, khóa Linh Thạch, máy bước tân thủ,
 * giá củi theo ngày, Hộ Muội 3 chỉ số, chuỗi Mã Tam, kiểm trắc, đêm oán
 * linh (cổng mở tu luyện), gia viên 2 nấc, tuyến giả mạo tông chủ kỳ 1–2.
 *
 * Node-loadable và chạy trên trình duyệt (mẫu js/bi-canh.js). Không chạm
 * DOM trực tiếp — chỉ gọi GameUI/GameEngine qua window có kiểm tra tồn tại
 * (thực tế module này thuần luật; engine/ui là phía gọi vào).
 *
 * Mọi số mới đều PROVISIONAL theo M2-DESIGN.md, chờ Bui phán.
 */
(function (global) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ PROVISIONAL (M2-DESIGN.md — ghi đủ trong M2-REPORT.md § số tạm)
  // ==========================================================================
  var DAY_SECONDS = 240;            // §2.4: một ngày phàm nhân = 240 giây chơi
  var WOOD_RESPAWN_SEC = 60;        // §2.2: điểm chặt hồi sau 60s
  var CHICKEN_RESPAWN_SEC = 90;     // §4 S2: gà rừng hồi sau 90s
  var HOMUOI_DECAY_SEC = 120;       // §3: mỗi 120 giây -1 mỗi chỉ số
  var HOMUOI_DECAY_AMOUNT = 1;
  var HOMUOI_GIVE_AMOUNT = 25;      // §3: cho đồ +25 chỉ số tương ứng, trần 100
  var HOMUOI_START = 60;
  var GIVE_RANGE = 200;             // §3: cho Linh Nhi trong bán kính 200px
  var FOLLOW_STOP_DIST = 60;        // §3: Linh Nhi dừng khi cách <= 60px
  var PRICE_BANH_BAO = 2;           // §2.3 (đồng)
  var PRICE_THUOC_CAM = 5;
  var PRICE_CUI_SUOI = 1;
  var PRICE_BAY_SAN = 4;
  var HEAL_BANH_BAO = 10;           // §2.3: dùng cho mình +10 HP
  var HEAL_THUOC_CAM = 20;          // §2.3: dùng cho mình +20 HP
  var TAY_CHAN_COIN_MIN = 2;        // §4: tay chân rơi 2–5 đồng/con
  var TAY_CHAN_COIN_MAX = 5;
  var MATAM_PURSE_COINS = 20;       // §4: Túi Tiền Mã Tam = +20 đồng
  var TRAP_MAX = 3;                 // §4 S4: tối đa 3 bẫy
  var TRAP_DAMAGE = 30;             // §4: bẫy nổ 30 sát thương
  var TRAP_SLOW_RATIO = 0.5;        // §4: chậm 50%
  var TRAP_SLOW_SEC = 2;            // §4: trong 2 giây
  var TRAP_TRIGGER_RADIUS = 30;     // bán kính giẫm bẫy (tạm)
  var SIEGE_WAVE_COUNTS = [4, 6, 8];// §6.2: 3 đợt; đợt 3 thêm 1 đầu đàn
  var SIEGE_REST_SEC = 8;           // §6.2: nghỉ 8 giây giữa các đợt
  var SIEGE_CIRCLE_RADIUS = 260;    // §6.3: vòng trận đỏ bán kính 260px
  var SIEGE_SPAWN_RADIUS = 330;     // vòng sinh oán linh ngoài vòng trận
  var SIEGE_HANDS = 6;              // §6.3: 6 bàn tay xanh trang trí
  var CYCLE_LOCK_SEC = 3;           // §6.3: khóa điều khiển 3 giây vận vòng
  var CHOP_TARGET = 3;              // §7: bước chop cần 3 bó củi
  var GIAVIEN_T1_WOOD = 10;         // §9.1 nấc 1: Bó Củi x10 + 30 đồng
  var GIAVIEN_T1_COINS = 30;
  var GIAVIEN_T2_WOOD = 20;         // §9.1 nấc 2: Bó Củi x20 + Đá Nung x10 + 200 LT
  var GIAVIEN_T2_STONE = 10;
  var GIAVIEN_T2_LT = 200;
  var GIAVIEN_T2_MIN_RANK = 10;     // §9.1: yêu cầu Trúc Cơ Sơ Kỳ trở lên (rank 10)
  var MEDITATE_INTERVAL_SEC = 60;   // §9.1: mỗi 60 giây thiền +tuVi
  var MEDITATE_PCT_OF_CAP = 0.05;   // §9.1: 5% trần mốc hiện tại mỗi phút
  var MEDITATE_FALLBACK_TUVI = 2;   // §9.1: không đọc được trần thì +2/đường/phút
  var MEDITATE_MAX_SESSION_SEC = 1800; // §9.1: tối đa 30 phút tích lũy/phiên
  var GATE_TUVI_FALLBACK = 10;      // §6.4: không đọc được ngưỡng thì +10/đường
  var FAKE_REWARD_K1 = 10;          // §9.2: xong kỳ 1 thưởng 10 Linh Thạch
  var FAKE_REWARD_K2 = 20;          // §9.2: xong kỳ 2 thưởng 20 Linh Thạch

  // Tọa độ neo (khớp mapdata.js — test test_modau_maps.js đối chiếu đi được).
  var CHOP_NODES = [
    { x: 170, y: 300 },
    { x: 300, y: 180 },
    { x: 150, y: 520 },
    { x: 620, y: 200 },
    { x: 880, y: 300 }
  ];
  var AMBUSH_POINT = { x: 280, y: 640 };      // S2: đoạn đường phía tây miếu
  var TEMPLE_FRONT = { x: 480, y: 580 };      // S3/S4: trước miếu
  var SIEGE_CENTER = { x: 480, y: 470 };      // tâm vòng trận đêm oán linh
  var MATAM_HOUSE_POINT = { x: 1290, y: 480 };// S1: trước nhà Mã Tam (Tây Lương)
  var GIAVIEN_POINT = { x: 580, y: 560 };     // điểm gia viên tại miếu
  var MEDITATE_POINT = { x: 850, y: 560 };    // sân thiền tại miếu
  var EVIDENCE_POINT = { x: 200, y: 320 };    // vật chứng, góc tối Đại Điện (kiểm M2 2026-11-13: điểm cũ (110,120) bị khối HUD che kín ở màn 390px, không bấm trực tiếp được)
  var LAO_GIA_POINT = { x: 1050, y: 900 };    // Lão Già Bị Tố tại tông môn (đo thật: đi được, cách Chấp Sự 155px)

  var PATH_KEYS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }

  function clampInt(v, lo, hi, fallback) {
    if (typeof v !== 'number' || !isFinite(v)) return fallback;
    var n = Math.floor(v);
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function defaultMoDau() {
    return {
      gatePassed: false,
      kiemTracDone: false,
      day: 1,
      dayPlaySec: 0,
      step: 'chop',
      matam: { stage: 0 },
      hoMuoi: { anNo: HOMUOI_START, am: HOMUOI_START, khoe: HOMUOI_START, milestones: {}, told: {} },
      linhNhiFollows: false,
      siege: { active: false, wave: 0, kills: 0, startedAt: 0, done: false },
      giaVien: { tier: 0 },
      fakeSect: { stage: 0, hasLetter: false, hasEvidence: false, heardBoth: false },
      trapsPlaced: [],
      battle: { id: null, kills: 0, total: 0 },
      progress: { chopped: 0, sold: false, bought: false, fed: false },
      decayAcc: 0,
      meditation: { active: false, accSec: 0, sessionSec: 0 }
    };
  }

  // §8: save cũ = thiếu moDau VÀ thỏa bất kỳ điều kiện nào thì coi như đã
  // qua cổng. Save mới tinh (không thỏa điều kiện nào) bắt đầu kỷ nguyên
  // phàm nhân.
  function looksLikeOldSave(player) {
    if (!player) return false;
    var q = player.quests || {};
    if ((q.sectStage || 0) > 0) return true;
    if (q.huntCompleted) return true;
    if ((q.mainStage || 0) > 0) return true;
    if (player.paths) {
      for (var i = 0; i < PATH_KEYS.length; i++) {
        var p = player.paths[PATH_KEYS[i]];
        if (p && typeof p.tuVi === 'number' && p.tuVi > 0) return true;
      }
    }
    if ((player.linhThach || 0) > 0) return true;
    return false;
  }

  function applyOldSaveMigration(st) {
    st.gatePassed = true;
    st.kiemTracDone = true;
    st.matam.stage = 5;
    st.step = null;
    st.hoMuoi.anNo = HOMUOI_START;
    st.hoMuoi.am = HOMUOI_START;
    st.hoMuoi.khoe = HOMUOI_START;
    st.linhNhiFollows = false;
    st.giaVien.tier = 0;
    st.fakeSect.stage = 0;
    st.siege.active = false;
    st.siege.done = true;
    st.battle.id = null;
    st.battle.kills = 0;
    st.battle.total = 0;
    return st;
  }

  // ensureState: tạo đủ trường, chuẩn hóa kiểu, sửa giá trị hỏng, idempotent,
  // chạy migration save cũ. Gọi từ createPlayer/loadPlayer và đầu mọi hàm
  // public (lưới an toàn như ensureV1/ensureState các đợt trước).
  function ensureState(player) {
    if (!player) return null;
    var isNew = !player.moDau || typeof player.moDau !== 'object';
    if (isNew) {
      player.moDau = defaultMoDau();
      if (looksLikeOldSave(player)) applyOldSaveMigration(player.moDau);
    }
    var st = player.moDau;
    // Chuẩn hóa từng trường (save dở/vênh vẫn chạy được, không bao giờ ném lỗi).
    if (typeof st.gatePassed !== 'boolean') st.gatePassed = !!st.gatePassed;
    if (typeof st.kiemTracDone !== 'boolean') st.kiemTracDone = !!st.kiemTracDone;
    st.day = clampInt(st.day, 1, 99999, 1);
    st.dayPlaySec = (typeof st.dayPlaySec === 'number' && isFinite(st.dayPlaySec) && st.dayPlaySec >= 0) ? st.dayPlaySec : 0;
    if (st.step !== null && typeof st.step !== 'string') st.step = st.gatePassed ? null : 'chop';
    if (!st.matam || typeof st.matam !== 'object') st.matam = { stage: 0 };
    st.matam.stage = clampInt(st.matam.stage, 0, 5, 0);
    if (!st.hoMuoi || typeof st.hoMuoi !== 'object') st.hoMuoi = { anNo: HOMUOI_START, am: HOMUOI_START, khoe: HOMUOI_START, milestones: {}, told: {} };
    st.hoMuoi.anNo = clampInt(st.hoMuoi.anNo, 0, 100, HOMUOI_START);
    st.hoMuoi.am = clampInt(st.hoMuoi.am, 0, 100, HOMUOI_START);
    st.hoMuoi.khoe = clampInt(st.hoMuoi.khoe, 0, 100, HOMUOI_START);
    if (!st.hoMuoi.milestones || typeof st.hoMuoi.milestones !== 'object') st.hoMuoi.milestones = {};
    if (!st.hoMuoi.told || typeof st.hoMuoi.told !== 'object') st.hoMuoi.told = {};
    if (typeof st.linhNhiFollows !== 'boolean') st.linhNhiFollows = !!st.linhNhiFollows;
    if (!st.siege || typeof st.siege !== 'object') st.siege = { active: false, wave: 0, kills: 0, startedAt: 0, done: false };
    if (typeof st.siege.active !== 'boolean') st.siege.active = !!st.siege.active;
    st.siege.wave = clampInt(st.siege.wave, 0, 3, 0);
    st.siege.kills = clampInt(st.siege.kills, 0, 9999, 0);
    if (typeof st.siege.startedAt !== 'number' || !isFinite(st.siege.startedAt)) st.siege.startedAt = 0;
    if (typeof st.siege.done !== 'boolean') st.siege.done = !!st.siege.done;
    if (!st.giaVien || typeof st.giaVien !== 'object') st.giaVien = { tier: 0 };
    st.giaVien.tier = clampInt(st.giaVien.tier, 0, 2, 0);
    if (!st.fakeSect || typeof st.fakeSect !== 'object') st.fakeSect = { stage: 0, hasLetter: false, hasEvidence: false, heardBoth: false };
    st.fakeSect.stage = clampInt(st.fakeSect.stage, 0, 3, 0);
    if (typeof st.fakeSect.hasLetter !== 'boolean') st.fakeSect.hasLetter = !!st.fakeSect.hasLetter;
    if (typeof st.fakeSect.hasEvidence !== 'boolean') st.fakeSect.hasEvidence = !!st.fakeSect.hasEvidence;
    if (typeof st.fakeSect.heardBoth !== 'boolean') st.fakeSect.heardBoth = !!st.fakeSect.heardBoth;
    if (!Array.isArray(st.trapsPlaced)) st.trapsPlaced = [];
    if (!st.battle || typeof st.battle !== 'object') st.battle = { id: null, kills: 0, total: 0 };
    if (st.battle.id !== null && typeof st.battle.id !== 'string') st.battle.id = null;
    st.battle.kills = clampInt(st.battle.kills, 0, 999, 0);
    st.battle.total = clampInt(st.battle.total, 0, 999, 0);
    if (!st.progress || typeof st.progress !== 'object') st.progress = { chopped: 0, sold: false, bought: false, fed: false };
    st.progress.chopped = clampInt(st.progress.chopped, 0, 9999, 0);
    if (typeof st.progress.sold !== 'boolean') st.progress.sold = !!st.progress.sold;
    if (typeof st.progress.bought !== 'boolean') st.progress.bought = !!st.progress.bought;
    if (typeof st.progress.fed !== 'boolean') st.progress.fed = !!st.progress.fed;
    st.decayAcc = (typeof st.decayAcc === 'number' && isFinite(st.decayAcc) && st.decayAcc >= 0) ? st.decayAcc : 0;
    if (!st.meditation || typeof st.meditation !== 'object') st.meditation = { active: false, accSec: 0, sessionSec: 0 };
    if (typeof st.meditation.active !== 'boolean') st.meditation.active = !!st.meditation.active;
    st.meditation.accSec = (typeof st.meditation.accSec === 'number' && isFinite(st.meditation.accSec) && st.meditation.accSec >= 0) ? st.meditation.accSec : 0;
    st.meditation.sessionSec = (typeof st.meditation.sessionSec === 'number' && isFinite(st.meditation.sessionSec) && st.meditation.sessionSec >= 0) ? st.meditation.sessionSec : 0;
    // Tiền đồng: tân thủ 3 đồng (đúng truyện), save cũ 0. Chỉ gán khi
    // thiếu hẳn — không bao giờ ghi đè số tiền người chơi đang có.
    if (typeof player.tienDong !== 'number' || !isFinite(player.tienDong)) {
      player.tienDong = st.gatePassed ? 0 : 3;
    }
    if (player.tienDong < 0) player.tienDong = 0;
    player.tienDong = Math.floor(player.tienDong);
    return st;
  }

  // ==========================================================================
  // KHÓA LINH THẠCH (§2.5) — một hàm duy nhất, mọi điểm khóa đều đọc nó
  // ==========================================================================
  function isLinhThachLocked(player) {
    if (!player) return false;
    var st = ensureState(player);
    return !st.gatePassed;
  }

  function canEnterRungDoc(player) {
    if (!player) return false;
    return !!ensureState(player).gatePassed;
  }

  // ==========================================================================
  // GIÁ CỦI + MUA BÁN (§2.3–2.4)
  // ==========================================================================
  function getWoodPrice(player) {
    var st = ensureState(player);
    if (!st) return 3;
    if (st.matam.stage < 1) return 3; // Mã Tam ép giá tới khi thắng trận S1
    if (st.day <= 1) return 3;
    return 3 + ((st.day * 7) % 3) - 1; // 2–4 đồng, xác định theo ngày
  }

  function getPrices(player) {
    return {
      wood: getWoodPrice(player),
      banhBao: PRICE_BANH_BAO,
      thuocCam: PRICE_THUOC_CAM,
      cuiSuoi: PRICE_CUI_SUOI,
      baySan: PRICE_BAY_SAN
    };
  }

  // Bán Bó Củi lấy tiền đồng. api: { countItemInBag, removeItemFromBag } —
  // mặc định lấy GameState. Trả { ok, count, earned, price, reason }.
  function sellWood(player, count, api) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    var a = api || getStateAPI();
    if (!a) return { ok: false, reason: 'no_state_api' };
    var want = clampInt(count, 1, 9999, 1);
    var have = a.countItemInBag(player, 'bo-cui');
    var n = Math.min(want, have);
    if (n <= 0) return { ok: false, reason: 'no_wood', count: 0, earned: 0 };
    var price = getWoodPrice(player);
    a.removeItemFromBag(player, 'bo-cui', n);
    player.tienDong = (player.tienDong || 0) + n * price;
    var advanced = false;
    if (st.step === 'sell') {
      st.progress.sold = true;
      st.step = 'buy';
      advanced = true;
    }
    return { ok: true, count: n, earned: n * price, price: price, advanced: advanced };
  }

  var SHOP_ITEMS = {
    'banh-bao': { price: PRICE_BANH_BAO, name: 'Bánh Bao' },
    'thuoc-cam': { price: PRICE_THUOC_CAM, name: 'Thuốc' },
    'cui-suoi': { price: PRICE_CUI_SUOI, name: 'Củi Sưởi' },
    'bay-san': { price: PRICE_BAY_SAN, name: 'Bẫy Săn' }
  };

  // Mua vật phẩm phàm tục bằng tiền đồng. Không đủ tiền -> không trừ gì.
  function buyItem(player, itemId, count, api) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    var shop = SHOP_ITEMS[itemId];
    if (!shop) return { ok: false, reason: 'not_for_sale' };
    var a = api || getStateAPI();
    if (!a) return { ok: false, reason: 'no_state_api' };
    var n = clampInt(count, 1, 999, 1);
    var cost = shop.price * n;
    if ((player.tienDong || 0) < cost) {
      return { ok: false, reason: 'not_enough_coins', need: cost, have: player.tienDong || 0 };
    }
    var res = a.addItemToBag(player, itemId, n);
    if (!res || !res.success) return { ok: false, reason: 'bag_full' };
    player.tienDong -= cost;
    var advanced = false;
    if (itemId === 'banh-bao' && st.step === 'buy') {
      st.progress.bought = true;
      st.step = 'feed';
      advanced = true;
    }
    return { ok: true, count: n, cost: cost, advanced: advanced };
  }

  // ==========================================================================
  // TICK: ngày phàm nhân + hao Hộ Muội (§2.4, §3)
  // Chỉ chạy trước cổng — qua cổng rồi ngày/chỉ số đóng băng (Linh Nhi ở
  // lại tông môn, kỷ nguyên phàm nhân đã khép).
  // ==========================================================================
  function tick(player, dt) {
    var st = ensureState(player);
    if (!st || st.gatePassed) return { dayChanged: false, decayed: false };
    var out = { dayChanged: false, decayed: false };
    var sec = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? dt : 0;
    if (sec <= 0) return out;
    st.dayPlaySec += sec;
    while (st.dayPlaySec >= DAY_SECONDS) {
      st.dayPlaySec -= DAY_SECONDS;
      st.day += 1;
      out.dayChanged = true;
    }
    st.decayAcc += sec;
    while (st.decayAcc >= HOMUOI_DECAY_SEC) {
      st.decayAcc -= HOMUOI_DECAY_SEC;
      st.hoMuoi.anNo = Math.max(0, st.hoMuoi.anNo - HOMUOI_DECAY_AMOUNT);
      st.hoMuoi.am = Math.max(0, st.hoMuoi.am - HOMUOI_DECAY_AMOUNT);
      st.hoMuoi.khoe = Math.max(0, st.hoMuoi.khoe - HOMUOI_DECAY_AMOUNT);
      out.decayed = true;
    }
    return out;
  }

  // ==========================================================================
  // HỘ MUỘI (§3)
  // ==========================================================================
  function checkMilestones(st) {
    var unlocked = [];
    var hm = st.hoMuoi;
    if (!hm.milestones.m1 && hm.anNo >= 70 && hm.am >= 70 && hm.khoe >= 70) {
      hm.milestones.m1 = true;
      unlocked.push('m1');
    }
    if (!hm.milestones.m2 && hm.anNo >= 90 && hm.am >= 90 && hm.khoe >= 90) {
      hm.milestones.m2 = true;
      unlocked.push('m2');
    }
    return unlocked;
  }

  var GIVE_EFFECTS = {
    'banh-bao': { key: 'anNo', name: 'Bánh Bao' },
    'cui-suoi': { key: 'am', name: 'Củi Sưởi' },
    'thuoc-cam': { key: 'khoe', name: 'Thuốc' }
  };

  // Cho Linh Nhi đồ. ctx: { mapId, distToLinhNhi } — chỉ khả dụng khi Linh
  // Nhi cùng map và trong 200px; Củi Sưởi chỉ cộng khi đang ở map miếu.
  // Không tự trừ túi — engine trừ sau khi hàm trả ok (để modal chọn chạy
  // trước khi tiêu hao).
  function giveToLinhNhi(player, itemId, ctx) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    var eff = GIVE_EFFECTS[itemId];
    if (!eff) return { ok: false, reason: 'not_givable' };
    var c = ctx || {};
    if (c.mapId !== 'mieu_hoang' && c.mapId !== 'tay-luong') {
      return { ok: false, reason: 'linhnhi_not_here' };
    }
    if (typeof c.distToLinhNhi === 'number' && c.distToLinhNhi > GIVE_RANGE) {
      return { ok: false, reason: 'too_far' };
    }
    if (itemId === 'cui-suoi' && c.mapId !== 'mieu_hoang') {
      return { ok: false, reason: 'mieu_only' };
    }
    var hm = st.hoMuoi;
    hm[eff.key] = Math.min(100, hm[eff.key] + HOMUOI_GIVE_AMOUNT);
    var unlocked = checkMilestones(st);
    var advanced = false;
    if (itemId === 'banh-bao' && st.step === 'feed') {
      st.progress.fed = true;
      st.step = 'matam1';
      advanced = true;
    }
    return { ok: true, key: eff.key, value: hm[eff.key], milestones: unlocked, advanced: advanced };
  }

  // Dùng cho mình: hồi HP. Củi Sưởi không dùng cho mình được (chỉ đốt tại
  // miếu cho Linh Nhi) — thiết kế §2.3 không ghi HP cho Củi Sưởi nên không
  // tự bịa số; trả lý do rõ ràng, không tiêu hao.
  function useForSelf(player, itemId) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    if (itemId === 'banh-bao' || itemId === 'thuoc-cam') {
      var heal = itemId === 'banh-bao' ? HEAL_BANH_BAO : HEAL_THUOC_CAM;
      var before = player.hp || 0;
      player.hp = Math.min(player.hpMax || before, before + heal);
      return { ok: true, healed: player.hp - before };
    }
    if (itemId === 'cui-suoi') return { ok: false, reason: 'mieu_only' };
    return { ok: false, reason: 'not_usable' };
  }

  var LINH_NHI_MILESTONE_LINES = {
    m1: [
      'Ca ca... muội nhớ cha mẹ quá. Năm ấy, cha bị người ta vu oan tham ô tiền cứu tế, mẹ khóc cạn nước mắt rồi cũng theo cha mà đi...',
      'Muội còn nhỏ, chỉ nhớ có người mặc áo gấm đứng sau lưng quan phủ, cười rất lạnh. Ca ca, sau này chúng ta nhất định phải đòi lại công bằng, phải không?'
    ],
    m2: [
      'Ca ca, muội cho ca ca xem cái này... chiếc trâm này là của mẹ để lại. Mỗi đêm trăng tròn, nó lại ấm lên một cách kỳ lạ.',
      'Có lần muội mơ thấy mình bay lên trời, dưới chân là năm dòng sông sáng năm màu... Ca ca đừng cười muội nhé, muội cũng không hiểu giấc mơ đó nghĩa là gì.'
    ]
  };

  var LINH_NHI_LOW_LINES = {
    anNo: [
      'Ca ca... bụng muội hơi đói. Nhưng ca ca đừng lo, muội chịu được mà.',
      'Ca ca có bánh bao không? Muội chỉ hỏi vậy thôi, ca ca cứ lo việc lớn đi.'
    ],
    am: [
      'Ca ca, đêm nay lạnh quá... muội co ro cả đêm không ngủ được.',
      'Nếu có củi sưởi đốt trong miếu thì ấm biết mấy, ca ca nhỉ?'
    ],
    khoe: [
      'Ca ca, muội ho mấy tiếng rồi... chắc tại hôm qua dầm tuyết.',
      'Ca ca đừng lo cho muội, muội uống thuốc là khỏe ngay thôi.'
    ]
  };

  // Thoại Linh Nhi đổi theo chỉ số thấp nhất + mốc đã mở. Trả { lines, pendingMilestone }.
  // pendingMilestone: mốc vừa mở nhưng chưa kể — engine gọi acknowledgeMilestone
  // sau khi mở thoại để lần sau không kể lại.
  function getLinhNhiLines(player) {
    var st = ensureState(player);
    if (!st) return { lines: [], pendingMilestone: null };
    var hm = st.hoMuoi;
    if (hm.milestones.m2 && !hm.told.m2) return { lines: LINH_NHI_MILESTONE_LINES.m2.slice(), pendingMilestone: 'm2' };
    if (hm.milestones.m1 && !hm.told.m1) return { lines: LINH_NHI_MILESTONE_LINES.m1.slice(), pendingMilestone: 'm1' };
    var lowest = 'anNo';
    var lowVal = hm.anNo;
    if (hm.am < lowVal) { lowest = 'am'; lowVal = hm.am; }
    if (hm.khoe < lowVal) { lowest = 'khoe'; lowVal = hm.khoe; }
    if (lowVal < 40) return { lines: LINH_NHI_LOW_LINES[lowest].slice(), pendingMilestone: null };
    return { lines: null, pendingMilestone: null }; // null = dùng thoại cũ mặc định
  }

  function acknowledgeMilestone(player, id) {
    var st = ensureState(player);
    if (!st || (id !== 'm1' && id !== 'm2')) return false;
    st.hoMuoi.told[id] = true;
    return true;
  }

  // ==========================================================================
  // MÁY BƯỚC + DẪN ĐƯỜNG (§7)
  // ==========================================================================
  var STEP_DEFS = {
    chop: { stepId: 'modau_chop', mapId: 'mieu_hoang', kind: 'point', x: CHOP_NODES[0].x, y: CHOP_NODES[0].y, title: 'Chặt Củi Sau Miếu', desc: 'Chặt 3 Bó Củi ở rừng sau miếu (điểm chặt sáng lên khi tới gần).' },
    sell: { stepId: 'modau_sell', mapId: 'tay-luong', kind: 'npc', npcId: 'npc_cho_cui', title: 'Bán Củi Ở Chợ', desc: 'Mang Bó Củi tới Chợ Củi ở thành Tây Lương bán lấy tiền đồng.' },
    buy: { stepId: 'modau_buy', mapId: 'tay-luong', kind: 'npc', npcId: 'npc_banh_bao', title: 'Mua Bánh Bao', desc: 'Mua 1 Bánh Bao ở sạp bánh bao thành Tây Lương.' },
    feed: { stepId: 'modau_feed', mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi', title: 'Cho Linh Nhi Ăn', desc: 'Cho Linh Nhi ăn Bánh Bao — cô bé đang đợi ở miếu.' },
    matam1: { stepId: 'modau_matam1', mapId: 'tay-luong', kind: 'point', x: MATAM_HOUSE_POINT.x, y: MATAM_HOUSE_POINT.y, title: 'Ép Giá Ở Chợ', desc: 'Tới nhà Mã Tam ở thành Tây Lương đối đầu.' },
    matam2: { stepId: 'modau_matam2', mapId: 'mieu_hoang', kind: 'point', x: AMBUSH_POINT.x, y: AMBUSH_POINT.y, title: 'Chặn Đường Đòi Gà', desc: 'Tay chân Mã Tam chặn đường phía tây miếu đòi Gà Rừng.' },
    matam3: { stepId: 'modau_matam3', mapId: 'mieu_hoang', kind: 'point', x: TEMPLE_FRONT.x, y: TEMPLE_FRONT.y, title: 'Đe Dọa Trước Miếu', desc: 'Đánh lui 3 tay chân tới đe dọa Linh Nhi trước miếu.' },
    matam4: { stepId: 'modau_matam4', mapId: 'mieu_hoang', kind: 'point', x: TEMPLE_FRONT.x, y: TEMPLE_FRONT.y, title: 'Trận Giữ Miếu', desc: 'Mã Tam kéo tới miếu. Chuẩn bị bẫy rồi đối đầu.' },
    kiemtrac: { stepId: 'modau_kiemtrac', mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon', title: 'Kiểm Trắc Linh Căn', desc: 'Tới Đại Điện gặp Chưởng Môn kiểm trắc linh căn.' },
    siege: { stepId: 'modau_siege', mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi', title: 'Đêm Oán Linh Vây Miếu', desc: 'Nói chuyện với Linh Nhi, đêm nay thủ miếu.' }
  };

  // Trả target bước M2 hoặc null (qua cổng / chưa nói chuyện Linh Nhi /
  // save cũ -> null để chuỗi cũ chảy tiếp nguyên vẹn).
  function getQuestTargetInfo(player) {
    if (!player || !player.quests) return null;
    if (!player.quests.talked_linhnhi) return null;
    var st = ensureState(player);
    if (!st || st.gatePassed || !st.step) return null;
    var def = STEP_DEFS[st.step];
    if (!def) return null;
    var out = { stepId: def.stepId, stage: 0, mapId: def.mapId, kind: def.kind, title: def.title, desc: def.desc };
    if (def.npcId) out.npcId = def.npcId;
    if (def.x !== undefined) { out.x = def.x; out.y = def.y; }
    return out;
  }

  // ==========================================================================
  // CHUỖI MÃ TAM (§4)
  // ==========================================================================
  var BATTLE_DEFS = {
    matam1: { stage: 1, nextStep: 'matam2', anchor: MATAM_HOUSE_POINT, spawns: [{ speciesId: 'tay_chan_matam', dx: 40, dy: 30 }] },
    matam2: { stage: 2, nextStep: 'matam3', anchor: AMBUSH_POINT, spawns: [{ speciesId: 'tay_chan_matam', dx: -50, dy: -20 }, { speciesId: 'tay_chan_matam', dx: 50, dy: -20 }] },
    matam3: { stage: 3, nextStep: 'matam4', anchor: TEMPLE_FRONT, spawns: [{ speciesId: 'tay_chan_matam', dx: -70, dy: -30 }, { speciesId: 'tay_chan_matam', dx: 0, dy: -50 }, { speciesId: 'tay_chan_matam', dx: 70, dy: -30 }] },
    matam4: { stage: 5, nextStep: 'kiemtrac', anchor: TEMPLE_FRONT, spawns: [{ speciesId: 'ma_tam', dx: 0, dy: -60 }, { speciesId: 'tay_chan_matam', dx: -80, dy: -20 }, { speciesId: 'tay_chan_matam', dx: 80, dy: -20 }] }
  };

  function battleIdForStep(step) {
    if (step === 'matam1' || step === 'matam2' || step === 'matam3' || step === 'matam4') return step;
    return null;
  }

  // Bắt đầu trận theo kịch bản. Trả { ok, spawns, total } hoặc { ok:false, reason }.
  function startBattle(player, battleId) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    var def = BATTLE_DEFS[battleId];
    if (!def) return { ok: false, reason: 'unknown_battle' };
    if (st.battle.id) return { ok: false, reason: 'battle_active' };
    if (st.step !== battleId) return { ok: false, reason: 'wrong_step' };
    st.battle.id = battleId;
    st.battle.kills = 0;
    st.battle.total = def.spawns.length;
    var spawns = def.spawns.map(function (s) {
      return { speciesId: s.speciesId, x: def.anchor.x + s.dx, y: def.anchor.y + s.dy };
    });
    return { ok: true, spawns: spawns, total: def.spawns.length, anchor: { x: def.anchor.x, y: def.anchor.y } };
  }

  function resetBattle(player) {
    var st = ensureState(player);
    if (!st) return false;
    st.battle.id = null;
    st.battle.kills = 0;
    st.battle.total = 0;
    st.trapsPlaced = [];
    return true;
  }

  function isBattleActive(player) {
    var st = ensureState(player);
    return !!(st && st.battle.id);
  }

  // Hoàn tất trận: nâng stage Mã Tam + chuyển bước. Dùng chung cho thắng
  // trận đánh thật và đường giao gà S2 (không đánh).
  function completeBattle(player, battleId) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    var def = BATTLE_DEFS[battleId];
    if (!def) return { ok: false, reason: 'unknown_battle' };
    st.matam.stage = def.stage;
    st.battle.id = null;
    st.battle.kills = 0;
    st.battle.total = 0;
    st.trapsPlaced = [];
    if (st.step === battleId) st.step = def.nextStep;
    return { ok: true, stage: def.stage, nextStep: def.nextStep };
  }

  // Đếm hạ quái trong trận. Trả { completed, kills, total }.
  function onBattleKill(player, speciesId) {
    var st = ensureState(player);
    if (!st || !st.battle.id) return { completed: false, kills: 0, total: 0 };
    var def = BATTLE_DEFS[st.battle.id];
    if (!def) return { completed: false, kills: 0, total: 0 };
    var counts = false;
    for (var i = 0; i < def.spawns.length; i++) {
      if (def.spawns[i].speciesId === speciesId) { counts = true; break; }
    }
    if (!counts) return { completed: false, kills: st.battle.kills, total: st.battle.total };
    st.battle.kills += 1;
    if (st.battle.kills >= st.battle.total) {
      var done = completeBattle(player, st.battle.id);
      return { completed: true, kills: st.battle.total, total: st.battle.total, stage: done.stage, nextStep: done.nextStep };
    }
    return { completed: false, kills: st.battle.kills, total: st.battle.total };
  }

  // Bẫy Săn (§4 S4): tối đa 3, engine trừ 1 bay-san trong túi trước khi gọi.
  function placeTrap(player, x, y) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    if (st.trapsPlaced.length >= TRAP_MAX) return { ok: false, reason: 'trap_max' };
    st.trapsPlaced.push({ x: x, y: y, exploded: false });
    return { ok: true, count: st.trapsPlaced.length };
  }

  function explodeTrap(player, index) {
    var st = ensureState(player);
    if (!st || !st.trapsPlaced[index]) return false;
    st.trapsPlaced[index].exploded = true;
    return true;
  }

  // ==========================================================================
  // KIỂM TRẮC (§5)
  // ==========================================================================
  var KIEM_TRAC_LINES = [
    'Ngươi là đứa trẻ ở Miếu Hoang? Lại đây, đặt tay lên đá kiểm trắc này.',
    'Đá kiểm trắc... sáng lên năm màu, nhưng màu nào cũng mờ nhạt, hỗn tạp không thuần.',
    'Ngũ Hành tạp linh căn — tạp nhất trong các loại linh căn, phế nhất thế gian. Đời này e rằng khó mà Trúc Cơ.',
    'Nhưng... năm màu cùng sáng mà không xung đột, cũng là điều hiếm thấy. Thiên đạo vô thường, ai dám nói tuyệt đối?',
    'Thanh Vân Tông không đuổi người có tâm hướng đạo. Ngươi ở lại ngoại môn làm tạp dịch, tự lo tu luyện. Đi đi.'
  ];

  var MATAM_RETREAT_LINES = [
    'Hừ... tiểu tử, hôm nay coi như ngươi may mắn!',
    'Chuyện này chưa xong đâu. Mã Tam ta ở thành Tây Lương này, còn nhiều thời gian chơi với ngươi lắm!'
  ];

  function canKiemTrac(player) {
    var st = ensureState(player);
    if (!st) return false;
    return !st.gatePassed && !st.kiemTracDone && st.matam.stage === 5 && st.step === 'kiemtrac';
  }

  function applyKiemTrac(player) {
    var st = ensureState(player);
    if (!st || !canKiemTrac(player)) return { ok: false, reason: 'not_ready' };
    st.kiemTracDone = true;
    st.step = 'siege';
    return { ok: true };
  }

  // ==========================================================================
  // ĐÊM OÁN LINH + CỔNG (§6)
  // ==========================================================================
  function canStartSiege(player) {
    var st = ensureState(player);
    if (!st) return false;
    return !st.gatePassed && st.kiemTracDone && st.step === 'siege' && !st.siege.active && !st.siege.done;
  }

  function startSiege(player) {
    var st = ensureState(player);
    if (!st || !canStartSiege(player)) return { ok: false, reason: 'not_ready' };
    st.siege.active = true;
    st.siege.wave = 1;
    st.siege.kills = 0;
    st.siege.startedAt = Date.now();
    st.siege.done = false;
    return { ok: true, wave: 1, spec: getWaveSpec(1) };
  }

  // Vị trí sinh của một đợt: vòng ngoài quanh tâm miếu, chia đều góc.
  function getWaveSpec(wave) {
    var count = SIEGE_WAVE_COUNTS[wave - 1] || 0;
    var spawns = [];
    for (var i = 0; i < count; i++) {
      var ang = (Math.PI * 2 * i) / count + wave * 0.5;
      spawns.push({
        speciesId: 'oan_linh',
        x: Math.round(SIEGE_CENTER.x + Math.cos(ang) * SIEGE_SPAWN_RADIUS),
        y: Math.round(SIEGE_CENTER.y + Math.sin(ang) * SIEGE_SPAWN_RADIUS * 0.8)
      });
    }
    if (wave === 3) {
      spawns.push({ speciesId: 'oan_linh_dau_dan', x: SIEGE_CENTER.x, y: SIEGE_CENTER.y - SIEGE_SPAWN_RADIUS });
    }
    return { wave: wave, spawns: spawns, total: spawns.length };
  }

  function onSiegeKill(player, speciesId) {
    var st = ensureState(player);
    if (!st || !st.siege.active) return { counted: false };
    if (speciesId !== 'oan_linh' && speciesId !== 'oan_linh_dau_dan') return { counted: false };
    st.siege.kills += 1;
    return { counted: true, kills: st.siege.kills };
  }

  // Engine gọi khi hạ hết quái của đợt hiện tại. Trả { nextWave } hoặc
  // { allCleared: true } khi xong đợt 3.
  function onSiegeWaveClear(player) {
    var st = ensureState(player);
    if (!st || !st.siege.active) return { ok: false, reason: 'no_siege' };
    if (st.siege.wave >= 3) {
      st.siege.done = true;
      return { ok: true, allCleared: true };
    }
    st.siege.wave += 1;
    return { ok: true, nextWave: st.siege.wave, spec: getWaveSpec(st.siege.wave) };
  }

  function resetSiege(player) {
    var st = ensureState(player);
    if (!st) return false;
    st.siege.active = false;
    st.siege.wave = 0;
    st.siege.kills = 0;
    st.siege.startedAt = 0;
    st.siege.done = false;
    return true;
  }

  function isSiegeActive(player) {
    var st = ensureState(player);
    return !!(st && st.siege.active);
  }

  // Mở cổng (§6.4): mở Linh Thạch + Rừng Độc, cấp tu vi khởi đầu. Tu vi:
  // mỗi đường nâng lên đúng ngưỡng Luyện Khí tầng 1 của đợt T1 — trần mốc
  // hiện tại đọc từ state.getMocCap (mốc 1 = 100), chỉ cộng phần thiếu
  // qua addTuViCapped (không bao giờ vượt trần, không cộng dồn).
  function passGate(player, api) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    var a = api || getStateAPI();
    var granted = {};
    if (a) {
      var cap = (typeof a.getMocCap === 'function') ? a.getMocCap(player) : GATE_TUVI_FALLBACK * 10;
      if (typeof cap !== 'number' || !isFinite(cap) || cap <= 0) cap = 100;
      for (var i = 0; i < PATH_KEYS.length; i++) {
        var k = PATH_KEYS[i];
        if (!player.paths) player.paths = {};
        if (!player.paths[k]) player.paths[k] = { tuVi: 0 };
        var cur = player.paths[k].tuVi || 0;
        var need = Math.max(0, cap - cur);
        var added = 0;
        if (need > 0) {
          if (typeof a.addTuViCapped === 'function') added = a.addTuViCapped(player, k, need);
          else { player.paths[k].tuVi = cur + need; added = need; }
        }
        granted[k] = added;
      }
      if (typeof a.syncRealmLabel === 'function') a.syncRealmLabel(player);
    } else {
      for (var j = 0; j < PATH_KEYS.length; j++) {
        var k2 = PATH_KEYS[j];
        if (!player.paths) player.paths = {};
        if (!player.paths[k2]) player.paths[k2] = { tuVi: 0 };
        var cur2 = player.paths[k2].tuVi || 0;
        var add2 = Math.max(0, GATE_TUVI_FALLBACK - cur2);
        player.paths[k2].tuVi = cur2 + add2;
        granted[k2] = add2;
      }
    }
    st.gatePassed = true;
    st.siege.active = false;
    st.siege.done = true;
    st.step = null;
    st.linhNhiFollows = false;
    st.battle.id = null;
    st.battle.kills = 0;
    st.battle.total = 0;
    st.trapsPlaced = [];
    return { ok: true, granted: granted };
  }

  // ==========================================================================
  // onEvent tập trung (§7): chop/sell/buy/feed/kill:/talk:/placeTrap/siegeWaveClear
  // ==========================================================================
  function onEvent(player, event, data) {
    var st = ensureState(player);
    if (!st) return null;
    var d = data || {};
    if (event === 'chop') {
      if (st.step === 'chop') {
        st.progress.chopped += 1;
        if (st.progress.chopped >= CHOP_TARGET) {
          st.step = 'sell';
          return { advanced: true, step: 'sell' };
        }
        return { advanced: false, chopped: st.progress.chopped };
      }
      return null;
    }
    if (event === 'sell') {
      if (st.step === 'sell') { st.progress.sold = true; st.step = 'buy'; return { advanced: true, step: 'buy' }; }
      return null;
    }
    if (event === 'buy') {
      if (st.step === 'buy') { st.progress.bought = true; st.step = 'feed'; return { advanced: true, step: 'feed' }; }
      return null;
    }
    if (event === 'feed') {
      if (st.step === 'feed') { st.progress.fed = true; st.step = 'matam1'; return { advanced: true, step: 'matam1' }; }
      return null;
    }
    if (event === 'placeTrap') {
      return placeTrap(player, d.x, d.y);
    }
    if (event === 'siegeWaveClear') {
      return onSiegeWaveClear(player);
    }
    if (event && event.indexOf('kill:') === 0) {
      var speciesId = event.slice(5);
      if (st.battle.id) {
        var bk = onBattleKill(player, speciesId);
        if (bk.completed || st.battle.kills > 0) return { battle: bk };
      }
      if (st.siege.active) {
        var sk = onSiegeKill(player, speciesId);
        if (sk.counted) return { siege: sk };
      }
      return null;
    }
    if (event && event.indexOf('talk:') === 0) {
      var npcId = event.slice(5);
      if (npcId === 'npc_linhnhi' && !st.gatePassed) {
        st.linhNhiFollows = true;
        return { follows: true };
      }
      if (npcId === 'npc_chuongmon' && canKiemTrac(player)) {
        var kt = applyKiemTrac(player);
        return { kiemTrac: kt };
      }
      return null;
    }
    return null;
  }

  // ==========================================================================
  // GIA VIÊN 2 NẤC (§9.1)
  // ==========================================================================
  function giaVienStatus(player) {
    var st = ensureState(player);
    if (!st) return { tier: 0 };
    return { tier: st.giaVien.tier, gatePassed: st.gatePassed };
  }

  // Kiểm điều kiện nâng cấp. counts: { boCui, daNung } — engine đọc từ túi.
  // realmRank: hạng cảnh giới thật từ GameState.getRealmRank.
  function canUpgradeGiaVien(player, tier, counts, realmRank) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    if (!st.gatePassed) return { ok: false, reason: 'gate_not_passed' };
    var c = counts || {};
    if (tier === 1) {
      if (st.giaVien.tier !== 0) return { ok: false, reason: 'wrong_tier' };
      if ((c.boCui || 0) < GIAVIEN_T1_WOOD) return { ok: false, reason: 'missing_wood', need: GIAVIEN_T1_WOOD, have: c.boCui || 0 };
      if ((player.tienDong || 0) < GIAVIEN_T1_COINS) return { ok: false, reason: 'not_enough_coins', need: GIAVIEN_T1_COINS, have: player.tienDong || 0 };
      return { ok: true };
    }
    if (tier === 2) {
      if (st.giaVien.tier !== 1) return { ok: false, reason: 'wrong_tier' };
      if ((realmRank || 0) < GIAVIEN_T2_MIN_RANK) return { ok: false, reason: 'realm_too_low', need: GIAVIEN_T2_MIN_RANK, have: realmRank || 0 };
      if ((c.boCui || 0) < GIAVIEN_T2_WOOD) return { ok: false, reason: 'missing_wood', need: GIAVIEN_T2_WOOD, have: c.boCui || 0 };
      if ((c.daNung || 0) < GIAVIEN_T2_STONE) return { ok: false, reason: 'missing_stone', need: GIAVIEN_T2_STONE, have: c.daNung || 0 };
      if ((player.linhThach || 0) < GIAVIEN_T2_LT) return { ok: false, reason: 'not_enough_lt', need: GIAVIEN_T2_LT, have: player.linhThach || 0 };
      return { ok: true };
    }
    return { ok: false, reason: 'unknown_tier' };
  }

  // Trừ phí + nâng nấc. Engine đã kiểm canUpgradeGiaVien trước.
  function applyGiaVienUpgrade(player, tier, api) {
    var st = ensureState(player);
    if (!st) return { ok: false, reason: 'no_player' };
    var a = api || getStateAPI();
    if (!a) return { ok: false, reason: 'no_state_api' };
    if (tier === 1) {
      a.removeItemFromBag(player, 'bo-cui', GIAVIEN_T1_WOOD);
      player.tienDong = Math.max(0, (player.tienDong || 0) - GIAVIEN_T1_COINS);
      st.giaVien.tier = 1;
      return { ok: true, tier: 1 };
    }
    if (tier === 2) {
      a.removeItemFromBag(player, 'bo-cui', GIAVIEN_T2_WOOD);
      a.removeItemFromBag(player, 'da-nung', GIAVIEN_T2_STONE);
      player.linhThach = Math.max(0, (player.linhThach || 0) - GIAVIEN_T2_LT);
      st.giaVien.tier = 2;
      return { ok: true, tier: 2 };
    }
    return { ok: false, reason: 'unknown_tier' };
  }

  // Điểm nghỉ tại miếu (nấc 1): hồi đầy HP/MP, không hồi chiêu.
  function restAtTemple(player) {
    var st = ensureState(player);
    if (!st || st.giaVien.tier < 1) return { ok: false, reason: 'tier_too_low' };
    player.hp = player.hpMax;
    player.linhLuc = player.linhLucMax;
    return { ok: true };
  }

  // Thiền định (nấc 2). Engine gọi meditateTick mỗi khung khi đang ngồi.
  function canMeditate(player) {
    var st = ensureState(player);
    return !!(st && st.gatePassed && st.giaVien.tier >= 2);
  }

  function startMeditation(player) {
    var st = ensureState(player);
    if (!st || !canMeditate(player)) return { ok: false, reason: 'not_ready' };
    st.meditation.active = true;
    st.meditation.accSec = 0;
    st.meditation.sessionSec = 0;
    return { ok: true };
  }

  function stopMeditation(player) {
    var st = ensureState(player);
    if (!st) return false;
    var was = st.meditation.active;
    st.meditation.active = false;
    return was;
  }

  // Mỗi 60 giây: +tuVi mỗi đường = 5% trần mốc hiện tại, qua addTuViCapped
  // (tôn trọng trần mốc) và calcTuViGain (tôn trọng trần mềm ngày 65 khi có
  // stateAPI). Tối đa 30 phút/phiên — hết phiên tự dừng, giữ phần đã tích.
  function meditateTick(player, dt, api) {
    var st = ensureState(player);
    if (!st || !st.meditation.active) return { granted: false };
    var sec = (typeof dt === 'number' && isFinite(dt) && dt > 0) ? dt : 0;
    if (sec <= 0) return { granted: false };
    st.meditation.sessionSec += sec;
    st.meditation.accSec += sec;
    if (st.meditation.sessionSec >= MEDITATE_MAX_SESSION_SEC) {
      st.meditation.active = false;
      return { granted: false, sessionEnded: true };
    }
    if (st.meditation.accSec < MEDITATE_INTERVAL_SEC) return { granted: false };
    st.meditation.accSec -= MEDITATE_INTERVAL_SEC;
    var a = api || getStateAPI();
    var perPath = MEDITATE_FALLBACK_TUVI;
    if (a && typeof a.getMocCap === 'function') {
      var cap = a.getMocCap(player);
      if (typeof cap === 'number' && isFinite(cap) && cap > 0) {
        perPath = Math.max(1, Math.floor(cap * MEDITATE_PCT_OF_CAP));
      }
    }
    var granted = {};
    var dateKey = new Date().toISOString().slice(0, 10);
    if (!player.daily) player.daily = {};
    if (!player.daily[dateKey]) player.daily[dateKey] = { farmTuVi: 0, farmLinhThach: 0 };
    var today = player.daily[dateKey];
    for (var i = 0; i < PATH_KEYS.length; i++) {
      var k = PATH_KEYS[i];
      var amount = perPath;
      if (a && typeof a.calcTuViGain === 'function') {
        amount = a.calcTuViGain(today.farmTuVi, perPath);
      }
      var added = 0;
      if (amount > 0) {
        if (a && typeof a.addTuViCapped === 'function') added = a.addTuViCapped(player, k, amount);
        else {
          if (!player.paths) player.paths = {};
          if (!player.paths[k]) player.paths[k] = { tuVi: 0 };
          player.paths[k].tuVi = (player.paths[k].tuVi || 0) + amount;
          added = amount;
        }
      }
      granted[k] = added;
      today.farmTuVi += added;
    }
    if (a && typeof a.syncRealmLabel === 'function') a.syncRealmLabel(player);
    return { granted: true, perPath: perPath, grantedByPath: granted };
  }

  // ==========================================================================
  // TUYẾN GIẢ MẠO TÔNG CHỦ — KỲ 1–2 (§9.2)
  // stage: 0 chưa mở/đang kỳ 1 (có thư), 1 xong kỳ 1, 2 đang kỳ 2, 3 xong kỳ 2.
  // ==========================================================================
  function fakeSectEligible(player) {
    var st = ensureState(player);
    if (!st) return false;
    return st.gatePassed && player.quests && (player.quests.sectStage || 0) >= 4;
  }

  function getFakeSectTarget(player) {
    if (!fakeSectEligible(player)) return null;
    var st = ensureState(player);
    var fs = st.fakeSect;
    if (fs.stage === 3) return null;
    if (fs.stage === 0 && !fs.hasLetter) {
      return { stepId: 'modau_fake_meet', stage: 4, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_lao_gia', title: 'Lão Già Bị Tố', desc: 'Một lão già lạ mặt ở tông môn muốn nhờ vả.' };
    }
    if (fs.stage === 0 && fs.hasLetter) {
      return { stepId: 'modau_fake_letter', stage: 4, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu', title: 'Đưa Thư Cho Chấp Sự', desc: 'Mang Thư Gửi của lão già tới Chấp Sự Đường.' };
    }
    if (fs.stage === 1) {
      return { stepId: 'modau_fake_k2', stage: 4, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_lao_gia', title: 'Vật Chứng Đầu Tiên', desc: 'Quay lại gặp lão già nghe việc tiếp theo.' };
    }
    if (fs.stage === 2 && !fs.hasEvidence) {
      return { stepId: 'modau_fake_evidence', stage: 4, mapId: 'dai-dien', kind: 'point', x: EVIDENCE_POINT.x, y: EVIDENCE_POINT.y, title: 'Tìm Vật Chứng', desc: 'Tìm vật chứng ở góc tối sau Đại Điện.' };
    }
    if (fs.stage === 2 && fs.hasEvidence) {
      return { stepId: 'modau_fake_return', stage: 4, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_lao_gia', title: 'Giao Vật Chứng', desc: 'Mang Vật Chứng về giao cho lão già.' };
    }
    return null;
  }

  var FAKE_LAO_GIA_LINES = {
    meet: [
      'Tiểu huynh đệ, khoan đã! Lão phu có chuyện muốn nhờ... Ngươi có tin không, lão phu mới là tông chủ thật của Thanh Vân Tông này!',
      'Ba mươi năm trước, lão phu bị kẻ gian hãm hại, đánh mất trí nhớ, lưu lạc tới nay mới nhớ ra đôi chút. Ngươi giúp lão phu đưa bức thư này cho Chấp Sự được không?',
      'Trong thư lão phu viết rõ mọi chuyện. Đưa thư xong, ngươi tự nghe xem Chấp Sự nói gì — rồi hãy phán xét lão phu là thật hay giả.'
    ],
    waiting: [
      'Thư đã đưa cho Chấp Sự chưa, tiểu huynh đệ? Lão phu đợi tin của ngươi.'
    ],
    k2offer: [
      'Chấp Sự nói lão phu là kẻ giả mạo ư? Ha... lão phu đoán trước rồi. Lời nói suông ai tin được — cần vật chứng!',
      'Sau Đại Điện có một góc tối, năm xưa lão phu giấu ở đó một thứ. Ngươi tìm giúp lão phu, mang về đây — vật chứng sẽ tự nói lên sự thật.'
    ],
    k2waiting: [
      'Góc tối sau Đại Điện, tiểu huynh đệ nhớ kỹ. Tìm được thì mang ngay về cho lão phu.'
    ],
    done: [
      'Nửa miếng ngọc bội... đúng là nó! Nửa còn lại ở trong tay kẻ đã hãm hại lão phu năm xưa.',
      'Tiểu huynh đệ, ân này lão phu ghi nhớ. Chuyện tông chủ thật giả, rồi sẽ có ngày sáng tỏ. Ngươi cứ tu luyện cho tốt, đừng dính vào vội.'
    ]
  };

  var FAKE_CHAPSU_LINES = [
    'Thư của lão già đó ư? Hừ, lão ta lại đi khắp nơi nói mình là tông chủ thật...',
    'Tông chủ của Thanh Vân Tông đang ngồi ngay trong Đại Điện, có ấn tín, có trưởng lão làm chứng. Một lão già mất trí nhớ, lời nói làm sao tin được?',
    'Ngươi trẻ người non dạ, đừng để lão ta lừa. Nhưng... nể mặt ngươi mang thư tới, ta cũng không làm khó lão ta nữa.'
  ];

  function getFakeSectLines(player, who) {
    var st = ensureState(player);
    if (!st) return null;
    var fs = st.fakeSect;
    if (who === 'laoGia') {
      if (fs.stage === 3) return FAKE_LAO_GIA_LINES.done.slice();
      if (fs.stage === 2) return fs.hasEvidence ? FAKE_LAO_GIA_LINES.k2waiting.slice() : FAKE_LAO_GIA_LINES.k2waiting.slice();
      if (fs.stage === 1) return FAKE_LAO_GIA_LINES.k2offer.slice();
      if (fs.hasLetter) return FAKE_LAO_GIA_LINES.waiting.slice();
      return FAKE_LAO_GIA_LINES.meet.slice();
    }
    if (who === 'chapsu') return FAKE_CHAPSU_LINES.slice();
    return null;
  }

  // Nói chuyện với Lão Già: nhận thư (kỳ 1) / nhận việc kỳ 2 / giao vật
  // chứng (xong kỳ 2). Engine lo việc cộng/trừ vật phẩm + Linh Thạch theo
  // kết quả trả về — module này chỉ đổi trạng thái.
  function talkLaoGia(player) {
    var st = ensureState(player);
    if (!st || !fakeSectEligible(player)) return { ok: false, reason: 'not_eligible' };
    var fs = st.fakeSect;
    if (fs.stage === 0 && !fs.hasLetter) {
      fs.hasLetter = true;
      return { ok: true, action: 'give_letter' };
    }
    if (fs.stage === 1) {
      fs.stage = 2;
      return { ok: true, action: 'accept_k2' };
    }
    if (fs.stage === 2 && fs.hasEvidence) {
      fs.stage = 3;
      fs.hasEvidence = false;
      return { ok: true, action: 'deliver_evidence', rewardLt: FAKE_REWARD_K2 };
    }
    return { ok: false, reason: 'nothing_new' };
  }

  // Giao thư cho Chấp Sự: xong kỳ 1, nghe hai lời kể.
  function deliverLetter(player) {
    var st = ensureState(player);
    if (!st || !fakeSectEligible(player)) return { ok: false, reason: 'not_eligible' };
    var fs = st.fakeSect;
    if (fs.stage !== 0 || !fs.hasLetter) return { ok: false, reason: 'no_letter' };
    fs.hasLetter = false;
    fs.heardBoth = true;
    fs.stage = 1;
    return { ok: true, rewardLt: FAKE_REWARD_K1 };
  }

  // Nhặt vật chứng tại góc tối Đại Điện.
  function pickupEvidence(player) {
    var st = ensureState(player);
    if (!st || !fakeSectEligible(player)) return { ok: false, reason: 'not_eligible' };
    var fs = st.fakeSect;
    if (fs.stage !== 2 || fs.hasEvidence) return { ok: false, reason: 'not_ready' };
    fs.hasEvidence = true;
    return { ok: true };
  }

  // ==========================================================================
  // API
  // ==========================================================================
  var API = {
    CONSTANTS: {
      DAY_SECONDS: DAY_SECONDS,
      WOOD_RESPAWN_SEC: WOOD_RESPAWN_SEC,
      CHICKEN_RESPAWN_SEC: CHICKEN_RESPAWN_SEC,
      HOMUOI_DECAY_SEC: HOMUOI_DECAY_SEC,
      HOMUOI_GIVE_AMOUNT: HOMUOI_GIVE_AMOUNT,
      HOMUOI_START: HOMUOI_START,
      GIVE_RANGE: GIVE_RANGE,
      FOLLOW_STOP_DIST: FOLLOW_STOP_DIST,
      PRICE_BANH_BAO: PRICE_BANH_BAO,
      PRICE_THUOC_CAM: PRICE_THUOC_CAM,
      PRICE_CUI_SUOI: PRICE_CUI_SUOI,
      PRICE_BAY_SAN: PRICE_BAY_SAN,
      HEAL_BANH_BAO: HEAL_BANH_BAO,
      HEAL_THUOC_CAM: HEAL_THUOC_CAM,
      TAY_CHAN_COIN_MIN: TAY_CHAN_COIN_MIN,
      TAY_CHAN_COIN_MAX: TAY_CHAN_COIN_MAX,
      MATAM_PURSE_COINS: MATAM_PURSE_COINS,
      TRAP_MAX: TRAP_MAX,
      TRAP_DAMAGE: TRAP_DAMAGE,
      TRAP_SLOW_RATIO: TRAP_SLOW_RATIO,
      TRAP_SLOW_SEC: TRAP_SLOW_SEC,
      TRAP_TRIGGER_RADIUS: TRAP_TRIGGER_RADIUS,
      SIEGE_WAVE_COUNTS: SIEGE_WAVE_COUNTS.slice(),
      SIEGE_REST_SEC: SIEGE_REST_SEC,
      SIEGE_CIRCLE_RADIUS: SIEGE_CIRCLE_RADIUS,
      SIEGE_SPAWN_RADIUS: SIEGE_SPAWN_RADIUS,
      SIEGE_HANDS: SIEGE_HANDS,
      CYCLE_LOCK_SEC: CYCLE_LOCK_SEC,
      CHOP_TARGET: CHOP_TARGET,
      GIAVIEN_T1_WOOD: GIAVIEN_T1_WOOD,
      GIAVIEN_T1_COINS: GIAVIEN_T1_COINS,
      GIAVIEN_T2_WOOD: GIAVIEN_T2_WOOD,
      GIAVIEN_T2_STONE: GIAVIEN_T2_STONE,
      GIAVIEN_T2_LT: GIAVIEN_T2_LT,
      GIAVIEN_T2_MIN_RANK: GIAVIEN_T2_MIN_RANK,
      MEDITATE_INTERVAL_SEC: MEDITATE_INTERVAL_SEC,
      MEDITATE_PCT_OF_CAP: MEDITATE_PCT_OF_CAP,
      MEDITATE_FALLBACK_TUVI: MEDITATE_FALLBACK_TUVI,
      MEDITATE_MAX_SESSION_SEC: MEDITATE_MAX_SESSION_SEC,
      GATE_TUVI_FALLBACK: GATE_TUVI_FALLBACK,
      FAKE_REWARD_K1: FAKE_REWARD_K1,
      FAKE_REWARD_K2: FAKE_REWARD_K2
    },
    POINTS: {
      CHOP_NODES: CHOP_NODES,
      AMBUSH_POINT: AMBUSH_POINT,
      TEMPLE_FRONT: TEMPLE_FRONT,
      SIEGE_CENTER: SIEGE_CENTER,
      MATAM_HOUSE_POINT: MATAM_HOUSE_POINT,
      GIAVIEN_POINT: GIAVIEN_POINT,
      MEDITATE_POINT: MEDITATE_POINT,
      EVIDENCE_POINT: EVIDENCE_POINT,
      LAO_GIA_POINT: LAO_GIA_POINT
    },
    STEP_DEFS: STEP_DEFS,
    BATTLE_DEFS: BATTLE_DEFS,
    KIEM_TRAC_LINES: KIEM_TRAC_LINES,
    MATAM_RETREAT_LINES: MATAM_RETREAT_LINES,
    FAKE_LAO_GIA_LINES: FAKE_LAO_GIA_LINES,
    FAKE_CHAPSU_LINES: FAKE_CHAPSU_LINES,
    SHOP_ITEMS: SHOP_ITEMS,
    ensureState: ensureState,
    looksLikeOldSave: looksLikeOldSave,
    isLinhThachLocked: isLinhThachLocked,
    canEnterRungDoc: canEnterRungDoc,
    getWoodPrice: getWoodPrice,
    getPrices: getPrices,
    sellWood: sellWood,
    buyItem: buyItem,
    tick: tick,
    checkMilestones: checkMilestones,
    giveToLinhNhi: giveToLinhNhi,
    useForSelf: useForSelf,
    getLinhNhiLines: getLinhNhiLines,
    acknowledgeMilestone: acknowledgeMilestone,
    getQuestTargetInfo: getQuestTargetInfo,
    battleIdForStep: battleIdForStep,
    startBattle: startBattle,
    resetBattle: resetBattle,
    isBattleActive: isBattleActive,
    completeBattle: completeBattle,
    onBattleKill: onBattleKill,
    placeTrap: placeTrap,
    explodeTrap: explodeTrap,
    canKiemTrac: canKiemTrac,
    applyKiemTrac: applyKiemTrac,
    canStartSiege: canStartSiege,
    startSiege: startSiege,
    getWaveSpec: getWaveSpec,
    onSiegeKill: onSiegeKill,
    onSiegeWaveClear: onSiegeWaveClear,
    resetSiege: resetSiege,
    isSiegeActive: isSiegeActive,
    passGate: passGate,
    onEvent: onEvent,
    giaVienStatus: giaVienStatus,
    canUpgradeGiaVien: canUpgradeGiaVien,
    applyGiaVienUpgrade: applyGiaVienUpgrade,
    restAtTemple: restAtTemple,
    canMeditate: canMeditate,
    startMeditation: startMeditation,
    stopMeditation: stopMeditation,
    meditateTick: meditateTick,
    fakeSectEligible: fakeSectEligible,
    getFakeSectTarget: getFakeSectTarget,
    getFakeSectLines: getFakeSectLines,
    talkLaoGia: talkLaoGia,
    deliverLetter: deliverLetter,
    pickupEvidence: pickupEvidence
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') {
    window.GameMoDau = API;
  }
  if (typeof global !== 'undefined') {
    global.GameMoDau = API;
  }
})(typeof window !== 'undefined' ? window : this);
