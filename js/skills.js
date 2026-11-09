/**
 * skills.js — Khung kỹ năng Ngũ Hành Vô Địch (Đợt K1)
 *
 * Chuyển PHẦN MÁY của hệ bí pháp Vô Sắc sang (hồ sơ 13A): định nghĩa chiêu
 * dạng dữ liệu (bậc/thức, hồi chiêu, tầm, điều kiện mở), hàm kiểm tra tung
 * chiêu thuần trả kết quả có cấu trúc { ok, code, reason } (đúng khuôn
 * castWord của Vô Sắc), và ngôn ngữ hình theo hệ để engine hiệu ứng dùng.
 * Nội dung chiêu là của Ngũ Hành: tổ chức theo NĂM ĐƯỜNG (Kim/Mộc/Thủy/
 * Hỏa/Thổ) — K2 sẽ viết 5 họ chiêu + Liên Hoàn trên chính schema này.
 *
 * Module thuần: Node-loadable (module.exports) và chạy trên trình duyệt
 * (window.GameSkills). Engine (engine.js) và giao diện (ui.js) chỉ đọc
 * dữ liệu từ đây — không nơi nào khác được gán cứng thông số chiêu.
 */

(function (exports) {
  'use strict';

  /* ------------------------------------------------------------------
   * Ngôn ngữ hình theo hệ (hồ sơ 13B: mỗi hệ một ngôn ngữ hình riêng,
   * phân biệt rõ như Thất Tinh = sao / Thanh Phong = gió của Vô Sắc).
   * core = màu lõi sáng, glow = màu hào quang, deep = màu đậm viền/bóng,
   * motif = kiểu hình đầu đạn/hình mặt đất, trail = kiểu vệt đuôi.
   * ------------------------------------------------------------------ */
  var ELEMENTS = {
    kim: {
      id: 'kim', name: 'Kim',
      core: '#f4f8ff', glow: '#a9c6ff', deep: '#5f7fb8',
      motif: 'blade', trail: 'spark',
      desc: 'Lưỡi và tia sắc lạnh, vệt đuôi tóe tia kim loại'
    },
    moc: {
      id: 'moc', name: 'Mộc',
      core: '#d9ffdf', glow: '#55d882', deep: '#2c7a44',
      motif: 'leaf', trail: 'leaf',
      desc: 'Lá, dây leo, độc — cong mềm, vệt đuôi lá rơi'
    },
    thuy: {
      id: 'thuy', name: 'Thủy',
      core: '#dcf7ff', glow: '#57c8f2', deep: '#2b6f9e',
      motif: 'drop', trail: 'wave',
      desc: 'Băng, sóng, gương — giọt và gợn tròn lan'
    },
    hoa: {
      id: 'hoa', name: 'Hỏa',
      core: '#fff3c4', glow: '#ff9a3d', deep: '#c33d1e',
      motif: 'flame', trail: 'ember',
      desc: 'Lửa, dung nham, nổ — vệt đuôi tàn lửa bốc lên'
    },
    tho: {
      id: 'tho', name: 'Thổ',
      core: '#ffefc4', glow: '#d9b45f', deep: '#8a6a2f',
      motif: 'shard', trail: 'dust',
      desc: 'Đá, cát, chấn địa — mảnh vỡ và bụi đất rơi xuống'
    },
    neutral: {
      id: 'neutral', name: 'Trung tính',
      core: '#fff6d8', glow: '#e8dcc0', deep: '#9a8a68',
      motif: 'slash', trail: 'plain',
      desc: 'Đòn vật lý thuần, vệt chém sáng nhạt'
    }
  };

  /** Năm đường tu hợp lệ (path = null nghĩa là chiêu trung tính/không đường). */
  var PATHS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

  /** Vòng tương sinh: SINH_MAP[a] = hệ mà a sinh ra (cho K2: hao phí/Liên Hoàn). */
  var SINH_MAP = { kim: 'thuy', thuy: 'moc', moc: 'hoa', hoa: 'tho', tho: 'kim' };
  /** Vòng tương khắc: KHAC_MAP[a] = hệ mà a khắc (khớp combat.js). */
  var KHAC_MAP = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' };

  var COST_TYPES = ['linhLuc'];           // K2+ có thể thêm 'hp'...
  var TARGET_MODES = ['single', 'self', 'point'];
  var DELIVERIES = ['melee', 'projectile', 'instant', 'area', 'rain', 'self'];
  var STATUS_TYPES = ['snare', 'slow', 'stun', 'dot'];

  /* ------------------------------------------------------------------
   * SCHEMA MỘT CHIÊU (mọi trường đều là dữ liệu, engine không đoán):
   *   id          khóa duy nhất, ổn định vĩnh viễn (save/UI bám vào id)
   *   name        tên hiển thị đầy đủ
   *   shortName   tên ngắn trên nút chiêu
   *   family      họ chiêu (vd 'co-ban', 'moc') — K2 nhóm theo họ
   *   path        đường hệ: 'kim'|'moc'|'thuy'|'hoa'|'tho'|null (null = trung tính)
   *   tier        bậc (1..; hiệu ứng tại điểm phát mạnh dần theo bậc)
   *   thuc        thức thứ mấy trong họ (1..)
   *   unlock      null = dùng ngay; hoặc { type:'pathTuVi', path, min }:
   *               mở khi tu vi của đường path đạt min (cấp đường)
   *   cost        { type:'linhLuc', amount } — tài nguyên trừ khi tung chiêu
   *   cooldown    giây hồi chiêu (bắt đầu tính từ lúc bắt đầu vận chiêu)
   *   castTime    giây vận chiêu trước khi chiêu phát ra (0 = tức thì)
   *   range       tầm tối đa (px) tới mục tiêu
   *   targetMode  'single' (một mục tiêu) | 'self' | 'point' (điểm mặt đất)
   *   delivery    cách chiêu tới đích: 'melee' | 'projectile' | 'instant'
   *               | 'area' | 'rain' | 'self'
   *   projectileSpeed  px/giây, chỉ khi delivery = 'projectile'
   *   damage      { stat:'attack', ratio, flat } — raw = attackNền × ratio + flat,
   *               sau đó chạy qua khung combat.js (khắc hệ, giáp cong, bạo kích)
   *   status      null hoặc { type:'snare'|'slow'|'stun'|'dot', duration, ... }
   *   effect      id hiệu ứng trong engine VFX (xem engine.js VFX)
   *   icon        class CSS của icon trên nút chiêu
   *   sfx         khóa âm thanh khi phát chiêu (ánh xạ sang audio.js)
   *   desc        mô tả ngắn cho tooltip/sổ chiêu
   * ------------------------------------------------------------------ */
  var SKILL_REGISTRY = [
    {
      id: 'basic',
      name: 'Chém Dao Củi',
      shortName: 'Đánh',
      family: 'co-ban',
      path: null,
      tier: 1,
      thuc: 1,
      unlock: null,
      cost: { type: 'linhLuc', amount: 0 },
      cooldown: 0.45,
      castTime: 0,
      range: 55,
      targetMode: 'single',
      delivery: 'melee',
      damage: { stat: 'attack', ratio: 1.0, flat: 0 },
      status: null,
      effect: 'slash_basic',
      icon: 'skill-basic',
      sfx: 'slash',
      desc: 'Đòn chém thường bằng dao củi — kênh đánh tự động khi đã chọn mục tiêu.'
    },
    {
      id: 'phi_diep',
      name: 'Phi Diệp Trảm',
      shortName: 'Phi Diệp',
      family: 'moc',
      path: 'moc',
      tier: 1,
      thuc: 1,
      unlock: { type: 'pathTuVi', path: 'moc', min: 0 },
      cost: { type: 'linhLuc', amount: 4 },
      cooldown: 3.0,
      castTime: 0.22,
      range: 280,
      targetMode: 'single',
      delivery: 'projectile',
      projectileSpeed: 520,
      damage: { stat: 'attack', ratio: 1.6, flat: 0 },
      status: null,
      effect: 'leaf_projectile',
      icon: 'skill-phi-diep',
      sfx: 'leafCast',
      desc: 'Phóng một lá linh khí sắc bén truy đuổi mục tiêu, gây 160% sát thương đòn thường.'
    },
    {
      id: 'day_leo',
      name: 'Dây Leo Trói',
      shortName: 'Dây Leo',
      family: 'moc',
      path: 'moc',
      tier: 1,
      thuc: 2,
      unlock: { type: 'pathTuVi', path: 'moc', min: 0 },
      cost: { type: 'linhLuc', amount: 6 },
      cooldown: 8.0,
      castTime: 0.3,
      range: 240,
      targetMode: 'single',
      delivery: 'instant',
      damage: { stat: 'attack', ratio: 0.8, flat: 0 },
      status: { type: 'snare', duration: 1.2 },
      effect: 'vine_snare',
      icon: 'skill-day-leo',
      sfx: 'vineSnare',
      desc: 'Dây leo trồi lên trói chân mục tiêu 1,2 giây và gây 80% sát thương đòn thường.'
    }
  ];

  /** Thứ tự chiêu trên thanh kỹ năng (nút 1, 2, ...). Đánh thường đi kênh riêng. */
  var LOADOUT = ['phi_diep', 'day_leo'];

  var INDEX = {};
  for (var i = 0; i < SKILL_REGISTRY.length; i++) {
    INDEX[SKILL_REGISTRY[i].id] = SKILL_REGISTRY[i];
  }

  function getSkill(id) {
    return INDEX[id] || null;
  }

  function listSkills() {
    return SKILL_REGISTRY.slice();
  }

  function getLoadout() {
    var out = [];
    for (var i = 0; i < LOADOUT.length; i++) {
      var def = INDEX[LOADOUT[i]];
      if (def) out.push(def);
    }
    return out;
  }

  /** Vị trí 0-based của chiêu trên thanh kỹ năng (-1 nếu không có). */
  function slotOf(id) {
    return LOADOUT.indexOf(id);
  }

  /** Hệ gây sát thương của chiêu: theo đường, trung tính nếu không đường. */
  function elementOf(def) {
    return def && def.path ? def.path : 'neutral';
  }

  function elementLang(elementId) {
    return ELEMENTS[elementId] || ELEMENTS.neutral;
  }

  /** Hệ số phóng hiệu ứng theo bậc: bậc 1 = 1, mỗi bậc thêm +35%. */
  function tierScale(tier) {
    var t = (typeof tier === 'number' && tier >= 1) ? tier : 1;
    return 1 + 0.35 * (t - 1);
  }

  /**
   * Chiêu đã mở khóa cho người chơi chưa (luật mở theo cấp đường).
   * player.paths[path].tuVi so với unlock.min.
   */
  function isUnlocked(def, player) {
    if (!def) return false;
    if (!def.unlock) return true;
    if (def.unlock.type === 'pathTuVi') {
      if (!player || !player.paths) return false;
      var p = player.paths[def.unlock.path];
      var tuVi = p && typeof p.tuVi === 'number' ? p.tuVi : 0;
      return tuVi >= (def.unlock.min || 0);
    }
    return false;
  }

  /**
   * Kiểm tra tung chiêu THUẦN (không chạm engine) — khuôn castWord của Vô Sắc:
   * trả { ok:true } hoặc { ok:false, code, reason } để engine phản hồi đúng cớ.
   * ctx = { casting, cooldownLeft, resource, hasTarget, targetDist }
   * Thứ tự kiểm như bản live: đang vận → hồi chiêu → không đủ tài nguyên →
   * không có mục tiêu/ngoài tầm. Chiêu self/point không cần mục tiêu đơn.
   */
  function checkCast(def, ctx) {
    if (!def) return { ok: false, code: 'unknown', reason: 'Không có chiêu này.' };
    ctx = ctx || {};
    if (ctx.casting) {
      return { ok: false, code: 'casting', reason: 'Đang vận chiêu khác.' };
    }
    if (ctx.cooldownLeft && ctx.cooldownLeft > 0) {
      return { ok: false, code: 'cooldown', reason: 'Đang hồi chiêu.' };
    }
    var amount = def.cost ? (def.cost.amount || 0) : 0;
    if (amount > 0 && (typeof ctx.resource !== 'number' || ctx.resource < amount)) {
      return { ok: false, code: 'cost', reason: 'Linh lực không đủ (cần ' + amount + ')' };
    }
    if (def.targetMode === 'single') {
      if (!ctx.hasTarget) {
        return { ok: false, code: 'target', reason: 'Không có mục tiêu trong tầm ' + def.range + 'px' };
      }
      if (typeof ctx.targetDist === 'number' && ctx.targetDist > def.range) {
        return { ok: false, code: 'range', reason: 'Không có mục tiêu trong tầm ' + def.range + 'px' };
      }
    }
    return { ok: true };
  }

  /**
   * Kiểm toàn vẹn registry — trả mảng chuỗi lỗi (rỗng = sạch).
   * Chạy trong smoke để mọi chiêu K2 thêm vào sau đều bị khóa chuẩn này.
   */
  function validateRegistry() {
    var problems = [];
    var seenIds = {};
    var seenFamilyThuc = {};

    for (var i = 0; i < SKILL_REGISTRY.length; i++) {
      var def = SKILL_REGISTRY[i];
      var tag = 'skill[' + i + '](' + (def && def.id ? def.id : '?') + '): ';
      if (!def || typeof def !== 'object') { problems.push(tag + 'không phải object'); continue; }
      if (!def.id || typeof def.id !== 'string') problems.push(tag + 'thiếu id');
      else if (seenIds[def.id]) problems.push(tag + 'id trùng');
      else seenIds[def.id] = true;
      if (!def.name) problems.push(tag + 'thiếu name');
      if (!def.family) problems.push(tag + 'thiếu family');
      if (def.path !== null && PATHS.indexOf(def.path) < 0) problems.push(tag + 'path không hợp lệ: ' + def.path);
      if (!(typeof def.tier === 'number' && def.tier >= 1 && Math.floor(def.tier) === def.tier)) problems.push(tag + 'tier phải là số nguyên >= 1');
      if (!(typeof def.thuc === 'number' && def.thuc >= 1 && Math.floor(def.thuc) === def.thuc)) problems.push(tag + 'thuc phải là số nguyên >= 1');
      var ftKey = def.family + '#' + def.thuc;
      if (seenFamilyThuc[ftKey]) problems.push(tag + '(family, thuc) trùng: ' + ftKey);
      else seenFamilyThuc[ftKey] = true;

      if (def.unlock !== null && def.unlock !== undefined) {
        var u = def.unlock;
        if (u.type !== 'pathTuVi') problems.push(tag + 'unlock.type chưa hỗ trợ: ' + u.type);
        else {
          if (PATHS.indexOf(u.path) < 0) problems.push(tag + 'unlock.path không hợp lệ: ' + u.path);
          if (def.path && u.path !== def.path) problems.push(tag + 'unlock.path khác path của chiêu');
          if (!(typeof u.min === 'number' && u.min >= 0)) problems.push(tag + 'unlock.min phải là số >= 0');
        }
      }
      if (!def.cost || COST_TYPES.indexOf(def.cost.type) < 0) problems.push(tag + 'cost.type không hợp lệ');
      else if (!(typeof def.cost.amount === 'number' && def.cost.amount >= 0)) problems.push(tag + 'cost.amount phải là số >= 0');
      if (!(typeof def.cooldown === 'number' && def.cooldown >= 0)) problems.push(tag + 'cooldown phải là số >= 0');
      if (!(typeof def.castTime === 'number' && def.castTime >= 0)) problems.push(tag + 'castTime phải là số >= 0');
      if (!(typeof def.range === 'number' && def.range > 0)) problems.push(tag + 'range phải là số > 0');
      if (TARGET_MODES.indexOf(def.targetMode) < 0) problems.push(tag + 'targetMode không hợp lệ: ' + def.targetMode);
      if (DELIVERIES.indexOf(def.delivery) < 0) problems.push(tag + 'delivery không hợp lệ: ' + def.delivery);
      if (def.delivery === 'projectile' && !(typeof def.projectileSpeed === 'number' && def.projectileSpeed > 0)) {
        problems.push(tag + 'delivery projectile cần projectileSpeed > 0');
      }
      if (!def.damage || def.damage.stat !== 'attack' ||
          !(typeof def.damage.ratio === 'number' && def.damage.ratio > 0) ||
          !(def.damage.flat === undefined || (typeof def.damage.flat === 'number' && def.damage.flat >= 0))) {
        problems.push(tag + 'damage phải là { stat:"attack", ratio > 0, flat >= 0 }');
      }
      if (def.status !== null && def.status !== undefined) {
        if (STATUS_TYPES.indexOf(def.status.type) < 0) problems.push(tag + 'status.type không hợp lệ: ' + def.status.type);
        else if (!(typeof def.status.duration === 'number' && def.status.duration > 0)) problems.push(tag + 'status.duration phải > 0');
      }
      if (!def.effect || typeof def.effect !== 'string') problems.push(tag + 'thiếu effect id');
      if (!def.icon || typeof def.icon !== 'string') problems.push(tag + 'thiếu icon class');
      if (!ELEMENTS[elementOf(def)]) problems.push(tag + 'thiếu ngôn ngữ hình cho hệ ' + elementOf(def));
    }

    for (var j = 0; j < LOADOUT.length; j++) {
      if (!INDEX[LOADOUT[j]]) problems.push('LOADOUT chứa id không có trong registry: ' + LOADOUT[j]);
    }
    if (!INDEX.basic) problems.push('registry thiếu chiêu cơ bản id=basic');

    for (var e = 0; e < PATHS.length; e++) {
      var lang = ELEMENTS[PATHS[e]];
      if (!lang || !lang.core || !lang.glow || !lang.deep || !lang.motif || !lang.trail) {
        problems.push('ELEMENTS thiếu ngôn ngữ hình đầy đủ cho hệ ' + PATHS[e]);
      }
    }
    if (!ELEMENTS.neutral) problems.push('ELEMENTS thiếu hệ neutral');

    return problems;
  }

  exports.ELEMENTS = ELEMENTS;
  exports.PATHS = PATHS;
  exports.SINH_MAP = SINH_MAP;
  exports.KHAC_MAP = KHAC_MAP;
  exports.COST_TYPES = COST_TYPES;
  exports.TARGET_MODES = TARGET_MODES;
  exports.DELIVERIES = DELIVERIES;
  exports.STATUS_TYPES = STATUS_TYPES;
  exports.SKILL_REGISTRY = SKILL_REGISTRY;
  exports.LOADOUT = LOADOUT;
  exports.getSkill = getSkill;
  exports.listSkills = listSkills;
  exports.getLoadout = getLoadout;
  exports.slotOf = slotOf;
  exports.elementOf = elementOf;
  exports.elementLang = elementLang;
  exports.tierScale = tierScale;
  exports.isUnlocked = isUnlocked;
  exports.checkCast = checkCast;
  exports.validateRegistry = validateRegistry;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameSkills = {}));
