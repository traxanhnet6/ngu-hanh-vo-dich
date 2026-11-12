/**
 * N2 Linh Thú — dữ liệu và nghiệp vụ thuần, dùng được trong trình duyệt/Node.
 * Nguồn thiết kế: hồ sơ 18 §B (BUI DUYỆT 2026-11-08) + 14§3 + 16§1 + 32§4–5 + 47§6.
 * Mọi số tự chọn đều ghi PROVISIONAL, liệt kê đủ trong N2-REPORT.md mục (b).
 *
 * Sửa đợt tự lái 2026-11-12 (đóng khung mỏng của Codex lượt 1):
 * - Sửa 3 lỗi: thú mới tạo thiếu trường attack; stage khởi tạo ghi sai
 *   'non non'; hatch() sập khi loài trứng lạ + splice sai khi trứng không
 *   trong danh sách.
 * - Bảng loài chỉ còn loài CÓ sprite thật trong monsters.js SPECIES: 6 loài
 *   thường thuần phục được + 5 loài hiếm (chỉ qua kỳ ngộ/bí cảnh/sự kiện).
 *   Ba loài da_nham/kim_tinh/kim_giap của khung mỏng KHÔNG tồn tại trong
 *   SPECIES thật nên bị loại, thay bằng kiem_linh (thường) + sa_tuong,
 *   thiet_giap (hiếm).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GameLinhThu = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ PROVISIONAL — chờ Bui phán, xem N2-REPORT.md mục (b)
  // ==========================================================================
  var TAME_MAX_HP_RATIO = 0.20;      // chỉ thuần phục khi quái còn ≤20% máu
  var TAME_BASE = 0.25;               // công thức tỉ lệ: nền + máu + cấp + mồi
  var TAME_HP_WEIGHT = 0.55;
  var TAME_LEVEL_STEP = 0.02;         // mỗi cấp chênh lệch ±2%, kẹp ±20%
  var TAME_LEVEL_CLAMP = 0.20;
  var TAME_BAIT_BONUS = 0.15;
  var TAME_MIN = 0.05;
  var TAME_MAX = 0.90;
  var AFFECTION_PER_SEC = 0.05;       // hảo cảm tăng/giây đi cùng thú chính
  var AFFECTION_PER_KILL = 0.5;       // hảo cảm tăng mỗi lần chủ hạ quái
  var AFFECTION_PER_FEED = 5;         // hảo cảm tăng mỗi lần cho ăn
  var HARMONY_MIN_AFFECTION = 60;     // ngưỡng mở hợp kích
  var STAGE_ADULT_LEVEL = 10;         // trưởng thành: cấp 10 + hảo cảm 50
  var STAGE_ADULT_AFFECTION = 50;
  var STAGE_SPIRIT_LEVEL = 20;        // linh hình: cấp 20 + hảo cảm 80
  var STAGE_SPIRIT_AFFECTION = 80;
  var PET_DAMAGE_CAP_RATIO = 0.60;    // trần sát thương thú = 60% công chủ
  var PET_SKILL_CD = 2.5;             // hồi chiêu riêng từng chiêu thú (giây)
  var PET_RANGE = 320;                // tầm tự chọn mục tiêu của thú (px)
  var PET_HP_REGEN_RATIO = 0.05;      // hồi máu thú/giây ngoài trận (tỉ lệ máu tối đa)
  var DEFEAT_HOURS_NORMAL = 3;        // dưỡng thương: thường 3 giờ, hiếm 6 giờ
  var DEFEAT_HOURS_RARE = 6;
  var MOUNT_MIN_RANK = 7;             // cưỡi từ Luyện Khí hậu kỳ (rank 7+, 16§1)
  var RIDE_MULT = 1.45;               // hệ số tốc độ khi cưỡi ngoài trận
  var HARMONY_CD = 20;                // hồi chiêu hợp kích (giây)
  var HARMONY_BASE_MULT = 2.0;        // hợp kích = sát thương thú × 2
  var HARMONY_GEN_MULT = 1.5;         // hệ thú tương sinh đường mạnh nhất của chủ
  var HARMONY_SAME_MULT = 1.2;        // hệ thú trùng đường mạnh nhất của chủ
  var EGG_DURATION_MS = 1800000;      // ấp 30 phút thời gian thật
  var EGG_CARE_COST = 5;              // chăm trứng tốn 5 Linh Lực của chủ
  var EGG_CARE_RARE = 3;              // chăm đủ 3 lần → nở phẩm hiếm
  var GUARD_WEED_DELAY = 0.25;        // thú giữ ruộng: ngưỡng cỏ chậm +25%
  var GUARD_PEST_DELAY = 0.25;        // ngưỡng sâu chậm +25%
  var GUARD_GROW_FACTOR = 0.92;       // thời gian lớn của cây × 0.92
  var GUARD_MO_GROW_FACTOR = 0.88;    // thú hệ Mộc chăm cây nhanh hơn
  var GUARD_HOA_PEST_DELAY = 0.50;    // thú hệ Hỏa xua sâu mạnh hơn
  var GATHER_INTERVAL_MS = 1800000;   // mỗi thú ở nhà gom 1 món / 30 phút vắng
  var GATHER_DAILY_CAP = 20;          // trần gom ngày (mọi thú cộng lại)
  var GATHER_WINDOW_CAP_MS = 86400000; // thời gian vắng tính tối đa 24 giờ
  var SADDLE_SLOTS = 12;              // túi yên: 12 ô khi đeo Yên
  var COLLAR_DAMAGE_BONUS = 0.10;     // Chuông: +10% sức chiêu thú
  var ARMOR_DEFENSE_BONUS = 5;        // Giáp: +5 đỡ đòn
  var ARMOR_HP_BONUS = 20;            // Giáp: +20 máu tối đa
  var PET_EXP_NEED_MULT = 10;         // kinh nghiệm lên cấp = cấp hiện tại × 10
  var PET_EXP_SHARE = 0.5;            // thú hưởng 50% tu vi chủ nhận từ trận đi cùng
  var PET_ATTACK_PER_LEVEL = 2;       // mỗi cấp thú +2 công
  var PET_HP_PER_LEVEL = 8;           // mỗi cấp thú +8 máu tối đa

  var EMPTY = function () {
    return {
      companions: [], mainId: null, eggs: [], barn: [], houseGuardPetId: null,
      gathered: { items: [], lastCollectMs: Date.now(), daily: { date: '', count: 0 } },
      metTrainer: false, firstHoanGiven: false, tamingLog: [],
      ridingPetId: null, isRiding: false
    };
  };

  // Loài bạn đồng hành. Mỗi loài có sprite thật trong monsters.js SPECIES
  // (cùng speciesId) nên engine vẽ thú bằng đúng đường vẽ sprite của loài.
  // skills: 4 chiêu — con non mở 1, trưởng thành mở 3, linh hình mở đủ 4.
  var SPECIES = {
    thao_tinh: { id: 'thao_tinh', name: 'Thảo Tinh Nhỏ', element: 'moc', work: 'chăm cây', hp: 40, attack: 7, skills: ['Mộc Diệp', 'Dây Leo Quấn', 'Gai Mộc', 'Vạn Diệp Phi'] },
    nhen_xanh: { id: 'nhen_xanh', name: 'Nhện Rừng Xanh', element: 'moc', work: 'giăng lưới', hp: 55, attack: 9, skills: ['Tơ Độc', 'Trói Tơ', 'Nọc Xanh', 'Lưới Thiên Tơ'] },
    bang_tinh: { id: 'bang_tinh', name: 'Băng Tinh Linh', element: 'thuy', work: 'tưới ruộng', hp: 80, attack: 12, skills: ['Băng Tiễn', 'Sương Lạnh', 'Băng Giáp', 'Bão Băng'] },
    han_xa: { id: 'han_xa', name: 'Hàn Kính Thủy Xà', element: 'thuy', work: 'thu thập nước', hp: 120, attack: 16, skills: ['Hàn Kích', 'Thủy Thuẫn', 'Xà Hàn', 'Hàn Kính Vạn Lý'] },
    hoa_thu: { id: 'hoa_thu', name: 'Hỏa Nham Thú', element: 'hoa', work: 'xua thú phá ruộng', hp: 100, attack: 15, skills: ['Hỏa Cầu', 'Nham Thạch Nóng', 'Lửa Bao', 'Diệm Sơn Phún'] },
    diem_ma: { id: 'diem_ma', name: 'Xích Diệm Ma', element: 'hoa', work: 'xua thú phá ruộng', hp: 150, attack: 20, skills: ['Liệt Diễm', 'Bạo Viêm', 'Ma Hỏa', 'Diệm Ma Phần'] },
    sa_trung: { id: 'sa_trung', name: 'Hoàng Sa Trùng', element: 'tho', work: 'gom khoáng', hp: 130, attack: 13, skills: ['Sa Chấn', 'Cát Xoáy', 'Sa Giáp', 'Bão Cát Vàng'] },
    sa_tuong: { id: 'sa_tuong', name: 'Sa Thạch Tượng', element: 'tho', work: 'gom khoáng', hp: 180, attack: 18, skills: ['Nham Giáp', 'Địa Chấn', 'Tượng Đạp', 'Thạch Tượng Trấn'] },
    kiem_linh: { id: 'kiem_linh', name: 'Tàn Kiếm Linh', element: 'kim', work: 'gom kim loại', hp: 90, attack: 14, skills: ['Kim Vũ', 'Kiếm Khí', 'Tàn Kiếm', 'Vạn Kiếm Ảnh'] },
    thiet_giap: { id: 'thiet_giap', name: 'Huyền Thiết Giáp Thú', element: 'kim', work: 'gom kim loại', hp: 170, attack: 21, skills: ['Kim Trảm', 'Thiết Giáp', 'Thiết Quyền', 'Huyền Thiết Sơn'] },
    co_thu_yeu: { id: 'co_thu_yeu', name: 'Cổ Thụ Yêu', element: 'moc', work: 'chăm cây', hp: 200, attack: 18, skills: ['Cổ Mộc Quyền', 'Rễ Cổ Thụ', 'Lá Độc', 'Cổ Thụ Giáng Lâm'] }
  };

  // Loài hiếm: KHÔNG thuần phục ngoài dã ngoại — chỉ qua kỳ ngộ/bí cảnh/sự
  // kiện (hệ kỳ ngộ chưa có → ghi MỞ, không bịa đường nhận giả).
  var RARE = { co_thu_yeu: true, han_xa: true, diem_ma: true, sa_tuong: true, thiet_giap: true };

  // Mồi hợp hệ: ánh xạ từ nguyên liệu đã có trong ITEM_DEFS (PROVISIONAL).
  var BAIT_MAP = { moc: 'la-thanh-tuy', thuy: 'bang-tinh', hoa: 'hoa-tinh-tho', tho: 'cat-tinh', kim: 'manh-kiem-gay' };

  // Trứng theo hệ nở ra loài thường của hệ đó (PROVISIONAL).
  var EGG_MAP = { 'trung-moc': 'thao_tinh', 'trung-thuy': 'bang_tinh', 'trung-hoa': 'hoa_thu', 'trung-tho': 'sa_trung', 'trung-kim': 'kiem_linh' };

  // Nguyên liệu thú ở nhà gom theo hệ — chỉ loại đã có trong game (PROVISIONAL).
  // Hệ Thổ thiên về khoáng.
  var GATHER_POOL = {
    moc: ['la-thanh-tuy', 'linh-chi-rung', 'hoa-giai-doc'],
    thuy: ['bang-tinh', 'nuoc-oc-dao-tinh-khiet', 'nguyen-tinh-thuy'],
    hoa: ['hoa-tinh-tho', 'nguyen-tinh-hoa', 'linh-chi-rung'],
    tho: ['cat-tinh', 'da-nung', 'nguyen-tinh-tho'],
    kim: ['manh-kiem-gay', 'nguyen-tinh-kim', 'hon-kiem-nho']
  };

  // Công thức đổi ở Tuần Thú Sư — nguyên liệu đã có, số PROVISIONAL.
  var EXCHANGE_RECIPES = {
    'dan-thu': [{ id: 'linh-chi-rung', count: 2 }, { id: 'hoa-giai-doc', count: 1 }],
    'yen-linh-thu': [{ id: 'da-nung', count: 2 }, { id: 'to-nhen-xanh', count: 1 }],
    'chuong-linh-thu': [{ id: 'manh-kiem-gay', count: 2 }, { id: 'nguyen-tinh-kim', count: 1 }],
    'giap-linh-thu': [{ id: 'da-nung', count: 3 }, { id: 'tim-go-co-thu', count: 1 }]
  };

  // Tương sinh: Mộc→Hỏa→Thổ→Kim→Thủy→Mộc.
  var GEN_MAP = { moc: 'hoa', hoa: 'tho', tho: 'kim', kim: 'thuy', thuy: 'moc' };

  // Một chiêu ký danh cho mỗi cặp hệ (thú × đường mạnh nhất của chủ).
  var HARMONY_SKILLS = {
    moc: { moc: 'Vạn Mộc Đồng Sinh', hoa: 'Mộc Sinh Hỏa Diệm', tho: 'Mộc Căn Hậu Thổ', kim: 'Mộc Linh Phá Kim', thuy: 'Mộc Thủy Tương Nhu' },
    hoa: { moc: 'Hỏa Diệm Sinh Mộc', hoa: 'Song Viêm Phần Thiên', tho: 'Hỏa Sinh Thổ Dung', kim: 'Hỏa Luyện Kim Cương', thuy: 'Hỏa Thủy Giao Dung' },
    tho: { moc: 'Thổ Dưỡng Mộc Linh', hoa: 'Thổ Nham Hỏa Sơn', tho: 'Hậu Thổ Trấn Nhạc', kim: 'Thổ Sinh Kim Mạch', thuy: 'Thổ Ngăn Thủy Triều' },
    kim: { moc: 'Kim Trảm Mộc Linh', hoa: 'Kim Dung Hỏa Luyện', tho: 'Kim Trầm Hậu Thổ', kim: 'Vạn Kiếm Quy Tông', thuy: 'Kim Sinh Thủy Hàn' },
    thuy: { moc: 'Thủy Sinh Mộc Vinh', hoa: 'Thủy Dập Hỏa Diệm', tho: 'Thủy Xâm Sa Thổ', kim: 'Thủy Hàn Kim Khí', thuy: 'Thiên Thủy Vô Ngần' }
  };

  var DRAW_SCALE = { 'con non': 0.75, 'trưởng thành': 1.0, 'linh hình': 1.15 };
  var HALO = { 'con non': 'none', 'trưởng thành': 'ring', 'linh hình': 'glow' };

  function __tk() {
    try {
      if (typeof global !== 'undefined' && global.GameTuiKho) return global.GameTuiKho;
      if (typeof window !== 'undefined' && window.GameTuiKho) return window.GameTuiKho;
      return require('./tui-kho.js');
    } catch (e) { return null; }
  }

  function ensureState(player) {
    if (!player) return null;
    var s = player.linhThu;
    if (!s || typeof s !== 'object') s = player.linhThu = EMPTY();
    var d = EMPTY();
    Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; });
    if (!Array.isArray(s.companions)) s.companions = [];
    if (!Array.isArray(s.eggs)) s.eggs = [];
    if (!Array.isArray(s.barn)) s.barn = [];
    if (!Array.isArray(s.tamingLog)) s.tamingLog = [];
    if (!s.gathered || typeof s.gathered !== 'object') s.gathered = d.gathered;
    if (!Array.isArray(s.gathered.items)) s.gathered.items = [];
    if (typeof s.gathered.lastCollectMs !== 'number') s.gathered.lastCollectMs = Date.now();
    if (!s.gathered.daily || typeof s.gathered.daily !== 'object') s.gathered.daily = { date: '', count: 0 };
    return s;
  }

  function species(id) { return SPECIES[id] || null; }

  function findPet(s, id) {
    if (!s || !id) return null;
    var lists = [s.companions, s.barn];
    for (var li = 0; li < lists.length; li++) {
      var list = lists[li] || [];
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function getMainPet(playerOrState) {
    var s = playerOrState && playerOrState.linhThu ? playerOrState.linhThu : playerOrState;
    if (!s) return null;
    var list = s.companions || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === s.mainId) return list[i];
    return null;
  }

  function isDown(pet, nowMs) {
    if (!pet || !pet.downUntil) return false;
    return (nowMs || Date.now()) < pet.downUntil;
  }

  // ==========================================================================
  // Thuần phục
  // ==========================================================================
  function canTame(monster) {
    var id = monster && (monster.speciesId || monster.id);
    if (!id || !species(id)) return { ok: false, reason: 'Loài này chưa có trong danh sách thuần phục.' };
    if (RARE[id] || (monster && (monster.isBoss || monster.isElite))) {
      return { ok: false, reason: 'Loài hiếm chỉ nhận qua kỳ ngộ, bí cảnh hoặc sự kiện.' };
    }
    return { ok: true, speciesId: id };
  }

  function tamingChance(hpRatio, levelGap, bait) {
    var c = TAME_BASE + (1 - Math.max(0, Math.min(1, hpRatio))) * TAME_HP_WEIGHT +
      Math.max(-TAME_LEVEL_CLAMP, Math.min(TAME_LEVEL_CLAMP, levelGap * TAME_LEVEL_STEP)) +
      (bait ? TAME_BAIT_BONUS : 0);
    return Math.max(TAME_MIN, Math.min(TAME_MAX, c));
  }

  function makePet(id, quality) {
    var spec = SPECIES[id];
    var p = {
      id: id + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      speciesId: id, stage: 'con non', level: 1, exp: 0, quality: quality || 'thường',
      hp: spec.hp, hpMax: spec.hp, attack: spec.attack, affection: 20, loyalty: 20,
      skills: spec.skills.slice(0, 1), gear: { saddle: null, collar: null, armor: null },
      downUntil: 0
    };
    return p;
  }

  // Thuần phục thuần túy trên state: engine/UI lo trừ Linh Thú Hoàn + mồi
  // THẬT khỏi túi trước khi gọi (mỗi lần thử đều mất vòng + mồi, kể cả thất
  // bại — luật đã chốt, ghi PROVISIONAL). opts: {hoans, bait, hpRatio,
  // levelGap, roll, id}.
  function tame(player, monster, opts) {
    var s = ensureState(player);
    var check = canTame(monster);
    if (!check.ok) return { ok: false, reason: check.reason };
    var id = check.speciesId;
    opts = opts || {};
    if ((opts.hoans || 0) < 1) return { ok: false, reason: 'Thiếu Linh Thú Hoàn.' };
    if (!opts.bait) return { ok: false, reason: 'Thiếu thức ăn hợp hệ.' };
    var hpR = opts.hpRatio === undefined ? TAME_MAX_HP_RATIO : opts.hpRatio;
    if (hpR > TAME_MAX_HP_RATIO) return { ok: false, reason: 'Quái chưa đủ yếu — cần đánh tới ≤20% máu.' };
    var chance = tamingChance(hpR, opts.levelGap || 0, true);
    if (opts.roll !== undefined && opts.roll > chance) {
      s.tamingLog.push({ speciesId: id, at: Date.now(), ok: false });
      return { ok: false, reason: 'Thuần phục thất bại.', chance: chance, consumedHoan: true };
    }
    var p = makePet(id, 'thường');
    if (opts.id) p.id = opts.id;
    s.companions.push(p);
    if (!s.mainId) s.mainId = p.id;
    s.tamingLog.push({ speciesId: id, at: Date.now(), ok: true });
    return { ok: true, pet: p, chance: chance };
  }

  // ==========================================================================
  // Hảo cảm / kinh nghiệm / lột xác
  // ==========================================================================
  function addAffection(pet, amount) {
    if (!pet) return 0;
    pet.affection = Math.max(0, Math.min(100, (pet.affection || 0) + amount));
    pet.loyalty = pet.affection;
    return pet.affection;
  }

  function feedPet(pet) { return addAffection(pet, AFFECTION_PER_FEED); }

  function petMaxHp(pet) {
    var spec = SPECIES[pet.speciesId] || { hp: 40 };
    var hp = spec.hp + Math.max(0, (pet.level || 1) - 1) * PET_HP_PER_LEVEL;
    if (pet.gear && pet.gear.armor) hp += ARMOR_HP_BONUS;
    return hp;
  }

  function refreshPetStats(pet) {
    var newMax = petMaxHp(pet);
    if (pet.hp > newMax) pet.hp = newMax;
    pet.hpMax = newMax;
    return pet;
  }

  function stage(pet) {
    var old = pet.stage;
    pet.stage = (pet.level >= STAGE_SPIRIT_LEVEL && pet.affection >= STAGE_SPIRIT_AFFECTION) ? 'linh hình'
      : (pet.level >= STAGE_ADULT_LEVEL && pet.affection >= STAGE_ADULT_AFFECTION) ? 'trưởng thành' : 'con non';
    var all = (SPECIES[pet.speciesId] || { skills: [] }).skills;
    pet.skills = all.slice(0, pet.stage === 'con non' ? 1 : pet.stage === 'trưởng thành' ? 3 : 4);
    refreshPetStats(pet);
    return pet.stage !== old;
  }

  function gainPetExp(pet, amount) {
    if (!pet) return { leveled: false, level: 0, exp: 0 };
    pet.exp = (pet.exp || 0) + Math.max(0, amount || 0);
    var leveled = false;
    var guard = 0;
    while (pet.exp >= (pet.level || 1) * PET_EXP_NEED_MULT && guard < 100) {
      pet.exp -= (pet.level || 1) * PET_EXP_NEED_MULT;
      pet.level = (pet.level || 1) + 1;
      pet.attack = (pet.attack || (SPECIES[pet.speciesId] || {}).attack || 10) + PET_ATTACK_PER_LEVEL;
      leveled = true;
      guard++;
    }
    stage(pet);
    return { leveled: leveled, level: pet.level, exp: pet.exp };
  }

  function canHarmony(pet) { return !!pet && (pet.affection || 0) >= HARMONY_MIN_AFFECTION; }

  // ==========================================================================
  // Sát thương / phòng thủ
  // ==========================================================================
  function petDefense(pet) {
    if (!pet) return 0;
    var def = 2 + Math.floor((pet.level || 1) / 2);
    if (pet.gear && pet.gear.armor) def += ARMOR_DEFENSE_BONUS;
    return def;
  }

  function petDamage(pet, ownerAttack) {
    var spec = SPECIES[pet.speciesId] || { attack: 10 };
    var atk = pet.attack || spec.attack || 10;
    var raw = Math.round(atk * (1 + (pet.level || 1) * 0.05) * ((pet.gear && pet.gear.collar) ? (1 + COLLAR_DAMAGE_BONUS) : 1));
    return Math.min(raw, Math.max(1, Math.round((ownerAttack || 10) * PET_DAMAGE_CAP_RATIO)));
  }

  // Chiêu thú đang dùng trong trận: chiêu mới mở nhất theo mốc lột xác.
  function petSkillName(pet) {
    if (!pet || !pet.skills || !pet.skills.length) return null;
    return pet.skills[pet.skills.length - 1];
  }

  function strongestPath(player) {
    var order = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var best = 'moc';
    var bestVal = -1;
    var paths = (player && player.paths) || {};
    for (var i = 0; i < order.length; i++) {
      var v = (paths[order[i]] && paths[order[i]].tuVi) || 0;
      if (v > bestVal) { bestVal = v; best = order[i]; }
    }
    return best;
  }

  function harmonySkillName(petElement, ownerElement) {
    var row = HARMONY_SKILLS[petElement] || HARMONY_SKILLS.moc;
    return row[ownerElement] || row.moc;
  }

  function harmonyDamage(pet, ownerAttack, ownerElement) {
    var spec = SPECIES[pet.speciesId] || { element: 'moc' };
    var mult = HARMONY_BASE_MULT;
    if (GEN_MAP[spec.element] === ownerElement) mult *= HARMONY_GEN_MULT;
    else if (spec.element === ownerElement) mult *= HARMONY_SAME_MULT;
    return Math.round(petDamage(pet, ownerAttack) * mult);
  }

  // ==========================================================================
  // Gục / chuồng / hồi sinh
  // ==========================================================================
  function defeat(pet, now) {
    pet.hp = 0;
    pet.downUntil = (now || Date.now()) + ((pet.quality === 'hiếm' ? DEFEAT_HOURS_RARE : DEFEAT_HOURS_NORMAL) * 3600000);
    return pet.downUntil;
  }

  function recover(pet, now, item) {
    if (item === 'dan-thu') { pet.downUntil = 0; refreshPetStats(pet); pet.hp = pet.hpMax; return true; }
    if ((now || Date.now()) >= (pet.downUntil || 0)) { pet.downUntil = 0; refreshPetStats(pet); pet.hp = pet.hpMax; return true; }
    return false;
  }

  function sendToBarn(s, id) {
    if (!s) return false;
    var idx = -1;
    for (var i = 0; i < s.companions.length; i++) if (s.companions[i].id === id) { idx = i; break; }
    if (idx < 0) return false;
    var p = s.companions.splice(idx, 1)[0];
    if (!findPet({ companions: [], barn: s.barn }, id)) s.barn.push(p);
    if (s.mainId === id) s.mainId = null;
    if (s.ridingPetId === id) { s.ridingPetId = null; s.isRiding = false; }
    return true;
  }

  function recallFromBarn(s, id, nowMs) {
    if (!s) return { ok: false, reason: 'Không có trạng thái linh thú.' };
    var idx = -1;
    for (var i = 0; i < s.barn.length; i++) if (s.barn[i].id === id) { idx = i; break; }
    if (idx < 0) return { ok: false, reason: 'Thú không ở trong chuồng.' };
    var p = s.barn[idx];
    if (isDown(p, nowMs)) return { ok: false, reason: 'Thú đang dưỡng thương, chưa gọi ra được.' };
    s.barn.splice(idx, 1);
    s.companions.push(p);
    if (!s.mainId) s.mainId = p.id;
    return { ok: true, pet: p };
  }

  function setMain(s, id) {
    if (!s) return false;
    var p = null;
    for (var i = 0; i < s.companions.length; i++) if (s.companions[i].id === id) p = s.companions[i];
    if (!p || isDown(p)) return false;
    s.mainId = id;
    if (s.houseGuardPetId === id) s.houseGuardPetId = null; // thú đi cùng thì không giữ ruộng
    return true;
  }

  function setGuard(s, id, nowMs) {
    if (!s) return false;
    if (id === null || id === undefined) { s.houseGuardPetId = null; return true; }
    var p = findPet(s, id);
    if (!p || isDown(p, nowMs)) return false;
    if (s.mainId === id) { s.mainId = null; }
    if (s.ridingPetId === id) { s.ridingPetId = null; s.isRiding = false; }
    s.houseGuardPetId = id;
    return true;
  }

  // ==========================================================================
  // Cưỡi
  // ==========================================================================
  function mount(s, id, rank) {
    var p = null;
    for (var i = 0; i < s.companions.length; i++) if (s.companions[i].id === id) p = s.companions[i];
    if (!p || rank < MOUNT_MIN_RANK || isDown(p)) return false;
    if (s.mainId !== id) return false; // chỉ cưỡi thú đang đi cùng
    s.ridingPetId = id;
    s.isRiding = true;
    return true;
  }

  function dismount(s) { s.isRiding = false; s.ridingPetId = null; }

  function rideSpeedFactor(isRiding, inCombat) {
    return (isRiding && !inCombat) ? RIDE_MULT : 1.0;
  }

  // ==========================================================================
  // Trứng và ấp
  // ==========================================================================
  function startIncubation(s, itemId, nowMs) {
    var speciesId = EGG_MAP[itemId];
    if (!speciesId) return { ok: false, reason: 'Vật phẩm này không phải trứng linh thú.' };
    var now = nowMs || Date.now();
    var spec = SPECIES[speciesId];
    var egg = {
      id: 'egg-' + now + '-' + s.eggs.length,
      itemId: itemId, speciesId: speciesId, element: spec.element,
      startedAt: now, hatchAt: now + EGG_DURATION_MS, cares: 0
    };
    s.eggs.push(egg);
    return { ok: true, egg: egg };
  }

  function careEgg(s, eggId, player) {
    var egg = null;
    for (var i = 0; i < s.eggs.length; i++) if (s.eggs[i].id === eggId) egg = s.eggs[i];
    if (!egg) return { ok: false, reason: 'Không tìm thấy trứng.' };
    if ((egg.cares || 0) >= EGG_CARE_RARE) return { ok: false, reason: 'Trứng đã được chăm đủ 3 lần.' };
    if (player) {
      if ((player.linhLuc || 0) < EGG_CARE_COST) return { ok: false, reason: 'Không đủ Linh Lực (cần ' + EGG_CARE_COST + ').' };
      player.linhLuc -= EGG_CARE_COST;
    }
    egg.cares = (egg.cares || 0) + 1;
    return { ok: true, cares: egg.cares };
  }

  function hatch(s, egg, now, care) {
    if (!egg || egg.hatchAt > (now || Date.now())) return { ok: false, reason: 'Trứng chưa đủ thời gian ấp.' };
    var id = egg.speciesId;
    if (!id || !SPECIES[id]) return { ok: false, reason: 'Trứng lạ, không rõ loài — không nở được.' };
    var careCount = (care !== undefined && care !== null) ? care : (egg.cares || 0);
    var p = makePet(id, careCount >= EGG_CARE_RARE ? 'hiếm' : 'thường');
    s.companions.push(p);
    var idx = s.eggs.indexOf(egg);
    if (idx >= 0) s.eggs.splice(idx, 1);
    if (!s.mainId) s.mainId = p.id;
    return { ok: true, pet: p };
  }

  // ==========================================================================
  // Việc khi chủ vắng: giữ ruộng + gom đồ
  // ==========================================================================
  function guardBonus(player, nowMs) {
    var inactive = { active: false, petId: null, element: null, weedDelay: 0, pestDelay: 0, growFactor: 1 };
    if (!player || !player.linhThu) return inactive;
    var s = player.linhThu;
    if (!s.houseGuardPetId) return inactive;
    if (s.houseGuardPetId === s.mainId) return inactive; // thú giữ ruộng không đi cùng
    var p = findPet(s, s.houseGuardPetId);
    if (!p || isDown(p, nowMs)) return inactive;
    var spec = SPECIES[p.speciesId] || { element: 'moc' };
    var out = {
      active: true, petId: p.id, element: spec.element,
      weedDelay: GUARD_WEED_DELAY, pestDelay: GUARD_PEST_DELAY, growFactor: GUARD_GROW_FACTOR
    };
    if (spec.element === 'moc') out.growFactor = GUARD_MO_GROW_FACTOR;
    if (spec.element === 'hoa') out.pestDelay = GUARD_HOA_PEST_DELAY;
    return out;
  }

  function collectAwayGather(player, nowMs) {
    var s = ensureState(player);
    var now = nowMs || Date.now();
    var homePets = [];
    var seen = {};
    var barn = s.barn || [];
    for (var i = 0; i < barn.length; i++) {
      if (barn[i] && !seen[barn[i].id] && !isDown(barn[i], now)) { seen[barn[i].id] = true; homePets.push(barn[i]); }
    }
    if (s.houseGuardPetId) {
      var g = findPet(s, s.houseGuardPetId);
      if (g && !seen[g.id] && !isDown(g, now)) { seen[g.id] = true; homePets.push(g); }
    }
    var startMs = Math.max(player.lastSaved || now, s.gathered.lastCollectMs || now);
    var windowMs = Math.max(0, Math.min(now - startMs, GATHER_WINDOW_CAP_MS));
    var perPet = Math.floor(windowMs / GATHER_INTERVAL_MS);
    var dateStr = new Date(now).toISOString().slice(0, 10);
    if (!s.gathered.daily || s.gathered.daily.date !== dateStr) s.gathered.daily = { date: dateStr, count: 0 };
    var room = Math.max(0, GATHER_DAILY_CAP - (s.gathered.daily.count || 0));
    var total = Math.min(perPet * homePets.length, room);
    var addedItems = [];
    for (var n = 0; n < total; n++) {
      var pet = homePets[n % homePets.length];
      var spec = SPECIES[pet.speciesId] || { element: 'moc' };
      var pool = GATHER_POOL[spec.element] || GATHER_POOL.moc;
      var itemId = pool[Math.floor(n / homePets.length) % pool.length];
      var slot = null;
      for (var j = 0; j < s.gathered.items.length; j++) if (s.gathered.items[j].itemId === itemId) slot = s.gathered.items[j];
      if (slot) slot.count += 1; else s.gathered.items.push({ itemId: itemId, count: 1 });
      addedItems.push(itemId);
    }
    s.gathered.daily.count = (s.gathered.daily.count || 0) + total;
    s.gathered.lastCollectMs = now;
    return { added: total, items: addedItems };
  }

  function claimGathered(s) {
    if (!s || !s.gathered) return [];
    var items = s.gathered.items || [];
    s.gathered.items = [];
    return items;
  }

  // ==========================================================================
  // Đồ thú + túi yên
  // ==========================================================================
  function equipPetGear(pet, slot, itemId) {
    if (!pet || !pet.gear) return null;
    if (slot !== 'saddle' && slot !== 'collar' && slot !== 'armor') return null;
    var prev = pet.gear[slot];
    pet.gear[slot] = itemId || null;
    refreshPetStats(pet);
    return prev;
  }

  function unequipPetGear(pet, slot) { return equipPetGear(pet, slot, null); }

  function saddleSlots(pet) {
    return (pet && pet.gear && pet.gear.saddle) ? SADDLE_SLOTS : 0;
  }

  function saddlebagId(petId) { return 'saddlebag-' + petId; }

  function canOpenSaddlebag(player, pet) {
    if (!pet) return { ok: false, reason: 'Chưa có linh thú.' };
    var s = player ? player.linhThu : null;
    if (!s || s.mainId !== pet.id) {
      return { ok: false, reason: 'Thú đang ở nhà — túi yên ở nhà theo thú, gọi thú đi cùng mới mở được.' };
    }
    if (isDown(pet)) return { ok: false, reason: 'Thú đang dưỡng thương, chưa mở được túi yên.' };
    if (!pet.gear || !pet.gear.saddle) return { ok: false, reason: 'Thú chưa đeo Yên Linh Thú nên chưa có túi yên.' };
    return { ok: true };
  }

  // Túi yên là vật chứa THẬT của hệ E2: tạo bằng GameTuiKho.createContainer
  // và đăng ký trong player.tuiKho.containers để UI túi + tìm kiếm xuyên
  // vật chứa nhìn thấy. Không bao giờ thu nhỏ dưới số ô đang có đồ.
  function ensureSaddlebag(player, pet) {
    var tk = __tk();
    if (!tk || !tk.ensureState || !tk.createContainer || !player || !pet) return null;
    tk.ensureState(player);
    var id = saddlebagId(pet.id);
    var c = tk.getContainer ? tk.getContainer(player, id) : (player.tuiKho.containers[id] || null);
    var want = Math.max(1, saddleSlots(pet));
    if (!c) {
      c = tk.createContainer('saddlebag', { id: id, name: 'Túi Yên — ' + ((SPECIES[pet.speciesId] || {}).name || 'Linh Thú'), capacity: want });
      player.tuiKho.containers[id] = c;
      return c;
    }
    var occupied = 0;
    for (var i = 0; i < c.slots.length; i++) if (c.slots[i]) occupied++;
    var need = Math.max(c.capacity || 0, want, occupied);
    while (c.slots.length < need) c.slots.push(null);
    c.capacity = need;
    return c;
  }

  function getSaddlebag(player, pet) {
    var tk = __tk();
    if (!tk || !player || !pet) return null;
    if (tk.ensureState) tk.ensureState(player);
    if (tk.getContainer) return tk.getContainer(player, saddlebagId(pet.id));
    return (player.tuiKho && player.tuiKho.containers) ? player.tuiKho.containers[saddlebagId(pet.id)] : null;
  }

  // ==========================================================================
  // Vẽ theo mốc lột xác (không vẽ sprite mới — dùng sprite loài + tỉ lệ/vòng)
  // ==========================================================================
  function drawScaleForStage(stageName) { return DRAW_SCALE[stageName] || 1.0; }
  function haloForStage(stageName) { return HALO[stageName] || 'none'; }

  // ==========================================================================
  // Cập nhật theo khung hình (engine gọi)
  // ==========================================================================
  function update(engineState, dt, opts) {
    var player = null;
    var s = null;
    if (engineState && engineState.linhThu !== undefined) { player = engineState; s = ensureState(engineState); }
    else if (engineState && Array.isArray(engineState.companions)) { s = engineState; }
    else if (engineState && typeof engineState === 'object') { player = engineState; s = ensureState(engineState); }
    if (!s) return null;
    opts = opts || {};
    var now = opts.nowMs || Date.now();
    var inCombat = !!opts.inCombat;
    // Hồi theo giờ cho thú dưỡng thương (cả thú đi cùng lẫn trong chuồng).
    var all = (s.companions || []).concat(s.barn || []);
    for (var i = 0; i < all.length; i++) {
      var ap = all[i];
      if (ap && ap.downUntil && now >= ap.downUntil) recover(ap, now);
    }
    var p = getMainPet(s);
    if (p && !isDown(p, now)) {
      if (dt > 0) addAffection(p, AFFECTION_PER_SEC * dt);
      if (!inCombat && p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * PET_HP_REGEN_RATIO * (dt || 0));
      stage(p);
    }
    return s;
  }

  return {
    ensureState: ensureState,
    SPECIES: SPECIES, RARE: RARE,
    BAIT_MAP: BAIT_MAP, EGG_MAP: EGG_MAP, GATHER_POOL: GATHER_POOL,
    EXCHANGE_RECIPES: EXCHANGE_RECIPES, GEN_MAP: GEN_MAP, HARMONY_SKILLS: HARMONY_SKILLS,
    species: species, findPet: findPet, getMainPet: getMainPet, isDown: isDown,
    canTame: canTame, tamingChance: tamingChance, tame: tame,
    addAffection: addAffection, feedPet: feedPet, gainPetExp: gainPetExp,
    stage: stage, canHarmony: canHarmony,
    petMaxHp: petMaxHp, petDefense: petDefense, petDamage: petDamage, petSkillName: petSkillName,
    strongestPath: strongestPath, harmonySkillName: harmonySkillName, harmonyDamage: harmonyDamage,
    defeat: defeat, recover: recover, sendToBarn: sendToBarn, recallFromBarn: recallFromBarn,
    setMain: setMain, setGuard: setGuard,
    mount: mount, dismount: dismount, rideSpeedFactor: rideSpeedFactor,
    startIncubation: startIncubation, careEgg: careEgg, hatch: hatch,
    guardBonus: guardBonus, collectAwayGather: collectAwayGather, claimGathered: claimGathered,
    equipPetGear: equipPetGear, unequipPetGear: unequipPetGear, saddleSlots: saddleSlots,
    saddlebagId: saddlebagId, canOpenSaddlebag: canOpenSaddlebag,
    ensureSaddlebag: ensureSaddlebag, getSaddlebag: getSaddlebag,
    drawScaleForStage: drawScaleForStage, haloForStage: haloForStage,
    update: update,
    ITEMS: { linhThuHoan: 'linh-thu-hoan', danThu: 'dan-thu' },
    CONSTANTS: {
      TAME_MAX_HP_RATIO: TAME_MAX_HP_RATIO, TAME_BASE: TAME_BASE, TAME_HP_WEIGHT: TAME_HP_WEIGHT,
      TAME_LEVEL_STEP: TAME_LEVEL_STEP, TAME_LEVEL_CLAMP: TAME_LEVEL_CLAMP, TAME_BAIT_BONUS: TAME_BAIT_BONUS,
      TAME_MIN: TAME_MIN, TAME_MAX: TAME_MAX,
      AFFECTION_PER_SEC: AFFECTION_PER_SEC, AFFECTION_PER_KILL: AFFECTION_PER_KILL,
      AFFECTION_PER_FEED: AFFECTION_PER_FEED, HARMONY_MIN_AFFECTION: HARMONY_MIN_AFFECTION,
      STAGE_ADULT_LEVEL: STAGE_ADULT_LEVEL, STAGE_ADULT_AFFECTION: STAGE_ADULT_AFFECTION,
      STAGE_SPIRIT_LEVEL: STAGE_SPIRIT_LEVEL, STAGE_SPIRIT_AFFECTION: STAGE_SPIRIT_AFFECTION,
      PET_DAMAGE_CAP_RATIO: PET_DAMAGE_CAP_RATIO, PET_SKILL_CD: PET_SKILL_CD, PET_RANGE: PET_RANGE,
      PET_HP_REGEN_RATIO: PET_HP_REGEN_RATIO,
      DEFEAT_HOURS_NORMAL: DEFEAT_HOURS_NORMAL, DEFEAT_HOURS_RARE: DEFEAT_HOURS_RARE,
      MOUNT_MIN_RANK: MOUNT_MIN_RANK, RIDE_MULT: RIDE_MULT, HARMONY_CD: HARMONY_CD,
      HARMONY_BASE_MULT: HARMONY_BASE_MULT, HARMONY_GEN_MULT: HARMONY_GEN_MULT, HARMONY_SAME_MULT: HARMONY_SAME_MULT,
      EGG_DURATION_MS: EGG_DURATION_MS, EGG_CARE_COST: EGG_CARE_COST, EGG_CARE_RARE: EGG_CARE_RARE,
      GUARD_WEED_DELAY: GUARD_WEED_DELAY, GUARD_PEST_DELAY: GUARD_PEST_DELAY,
      GUARD_GROW_FACTOR: GUARD_GROW_FACTOR, GUARD_MO_GROW_FACTOR: GUARD_MO_GROW_FACTOR,
      GUARD_HOA_PEST_DELAY: GUARD_HOA_PEST_DELAY,
      GATHER_INTERVAL_MS: GATHER_INTERVAL_MS, GATHER_DAILY_CAP: GATHER_DAILY_CAP,
      GATHER_WINDOW_CAP_MS: GATHER_WINDOW_CAP_MS,
      SADDLE_SLOTS: SADDLE_SLOTS, COLLAR_DAMAGE_BONUS: COLLAR_DAMAGE_BONUS,
      ARMOR_DEFENSE_BONUS: ARMOR_DEFENSE_BONUS, ARMOR_HP_BONUS: ARMOR_HP_BONUS,
      PET_EXP_NEED_MULT: PET_EXP_NEED_MULT, PET_EXP_SHARE: PET_EXP_SHARE,
      PET_ATTACK_PER_LEVEL: PET_ATTACK_PER_LEVEL, PET_HP_PER_LEVEL: PET_HP_PER_LEVEL
    }
  };
});
