/**
 * dan-ky-nang.js — Đợt DANSKILL: KỸ NĂNG LUYỆN ĐAN (Ngũ Hành Vô Địch).
 *
 * Bám brief DANSKILL + thiết kế DANSKILL-DESIGN.md, theo đúng mẫu 4 pháp
 * quyết Linh Điền (linhdien.js SPELLS/learnSpell/castSpell): học bằng
 * gameplay, nút bấm thật trong modal Đan Phòng, tốn linh lực, hồi chiêu,
 * lên cấp bằng số lần dùng, trần cấp theo cảnh giới.
 *
 * Bốn kỹ năng: ba kỹ năng buff mẻ luyện KẾ TIẾP qua refineBatch (Khống Hỏa
 * -> nhiệt, Tịnh Dược -> thứ tự dược liệu, Ngưng Đan -> phong đan) và một
 * kỹ năng tác dụng ngay (Thanh Độc -> trừ đan độc).
 *
 * Mọi số mới đều PROVISIONAL (xem DANSKILL-DESIGN.md mục 5). Không đổi số
 * cân bằng D2. Node-loadable & trình duyệt (khuôn mẫu linhdien.js).
 */
(function (exports) {
  'use strict';

  // PROVISIONAL: toàn bộ số dưới đây chờ Bui phán (DANSKILL-DESIGN.md mục 5).
  var SKILLS = {
    'khong-hoa': {
      id: 'khong-hoa', name: 'Khống Hỏa Quyết', element: 'hoa',
      baseCost: 8, baseCooldownSec: 30, tuViElem: 'hoa', tuViAmount: 2,
      buffKind: 'heat', buffPerLevel: 0.04,
      learnSuccesses: 5, learnRank: 0, learnFeeLT: 50,
      desc: 'Khống chế lửa lò cho mẻ luyện kế tiếp: tăng điểm nhiệt theo cấp. Cho tu vi đường Hỏa.'
    },
    'tinh-duoc': {
      id: 'tinh-duoc', name: 'Tịnh Dược Quyết', element: 'thuy',
      baseCost: 6, baseCooldownSec: 40, tuViElem: 'thuy', tuViAmount: 2,
      buffKind: 'order', buffPerLevel: 0.06,
      learnSuccesses: 10, learnRank: 0, learnFeeLT: 100,
      desc: 'Tịnh hóa dược liệu cho mẻ luyện kế tiếp: gỡ bớt thiệt hại khi xếp nguyên liệu chưa đúng thứ tự. Cho tu vi đường Thủy.'
    },
    'ngung-dan': {
      id: 'ngung-dan', name: 'Ngưng Đan Quyết', element: 'tho',
      baseCost: 10, baseCooldownSec: 45, tuViElem: 'tho', tuViAmount: 2,
      buffKind: 'seal', buffPerLevel: 0.05,
      learnSuccesses: 0, learnRank: 1, learnFeeLT: 200,
      desc: 'Ngưng tụ đan khí cho mẻ luyện kế tiếp: tăng điểm phong đan theo cấp. Cho tu vi đường Thổ.'
    },
    'thanh-doc': {
      id: 'thanh-doc', name: 'Thanh Độc Quyết', element: 'moc',
      baseCost: 6, baseCooldownSec: 25, tuViElem: 'moc', tuViAmount: 2,
      buffKind: null, detoxBase: 4, detoxPerLevel: 2,
      learnSuccesses: 20, learnRank: 0, learnFeeLT: 150,
      desc: 'Dùng linh lực quét đan độc trong người ngay lập tức. Cho tu vi đường Mộc.'
    }
  };

  var SKILL_ORDER = ['khong-hoa', 'tinh-duoc', 'ngung-dan', 'thanh-doc'];
  var BUFF_TTL_MS = 300000; // PROVISIONAL: buff hết hạn sau 300 giây
  var USES_PER_LEVEL = 5; // PROVISIONAL: 1 cấp / 5 lần dùng (mẫu pháp quyết)

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }
  function getLuyenDanAPI() {
    if (typeof window !== 'undefined' && window.GameLuyenDan) return window.GameLuyenDan;
    if (typeof global !== 'undefined' && global.GameLuyenDan) return global.GameLuyenDan;
    try { return require('./luyendan.js'); } catch (e) { return null; }
  }
  function showToast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(msg);
  }
  function playChime() {
    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) window.GameAudio.playChime();
  }
  function refreshHUD() {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) window.GameUI.refreshHUD();
  }
  function getRealmRank(player) {
    var st = getStateAPI();
    if (st && st.getRealmRank) return st.getRealmRank(player) || 0;
    return 0;
  }

  // ---------------- State ----------------
  function ensureState(player) {
    if (!player) return null;
    var ld = getLuyenDanAPI();
    if (ld && ld.ensureState) {
      ld.ensureState(player);
    } else if (!player.luyenDan || typeof player.luyenDan !== 'object') {
      player.luyenDan = {
        furnaceGrade: 0, proficiency: {}, successes: 0, examsPassed: 0,
        rank: 0, toxin: 0, recipes: [], availableRecipes: [], fragments: {},
        pillGrades: {}, lastGrade: null
      };
    }
    var s = player.luyenDan;
    if (!s.skills || typeof s.skills !== 'object') s.skills = {};
    for (var i = 0; i < SKILL_ORDER.length; i++) {
      var sid = SKILL_ORDER[i];
      if (!s.skills[sid] || typeof s.skills[sid] !== 'object') {
        s.skills[sid] = { learned: false, uses: 0, level: 1, cooldownUntil: 0 };
      } else {
        var sp = s.skills[sid];
        if (typeof sp.learned !== 'boolean') sp.learned = !!sp.learned;
        if (typeof sp.uses !== 'number' || sp.uses < 0) sp.uses = 0;
        if (typeof sp.level !== 'number' || sp.level < 1) sp.level = 1;
        if (typeof sp.cooldownUntil !== 'number') sp.cooldownUntil = 0;
      }
    }
    if (!s.skillBuffs || typeof s.skillBuffs !== 'object') s.skillBuffs = {};
    return s;
  }

  function getSkillDef(skillId) { return SKILLS[skillId] || null; }
  function listSkills() {
    return SKILL_ORDER.map(function (k) { return SKILLS[k]; });
  }
  function isSkillLearned(player, skillId) {
    ensureState(player);
    var sp = player.luyenDan.skills[skillId];
    return !!(sp && sp.learned);
  }
  function skillLevel(player, skillId) {
    ensureState(player);
    var sp = player.luyenDan.skills[skillId];
    return sp ? (sp.level || 1) : 1;
  }
  function skillCost(skillId, level) {
    var def = SKILLS[skillId];
    if (!def) return 0;
    level = level || 1;
    return def.baseCost + Math.max(0, level - 1) * 2; // PROVISIONAL (mẫu pháp quyết)
  }
  function skillCooldownLeftMs(player, skillId, nowMs) {
    ensureState(player);
    var sp = player.luyenDan.skills[skillId];
    if (!sp || !sp.cooldownUntil) return 0;
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    return Math.max(0, sp.cooldownUntil - now);
  }
  function skillLevelCap(player) {
    var cap = getRealmRank(player);
    if (cap < 5) cap = 5; // PROVISIONAL: cho phép tăng cấp ngay đầu game (mẫu pháp quyết)
    return cap;
  }

  function skillEffectText(skillId, level) {
    var def = SKILLS[skillId];
    if (!def) return '';
    level = level || 1;
    if (def.buffKind === 'heat') return 'Mẻ kế: + ' + (def.buffPerLevel * level).toFixed(2) + ' điểm nhiệt.';
    if (def.buffKind === 'order') return 'Mẻ kế: thứ tự chưa chuẩn vẫn được ' + Math.min(1, 0.5 + def.buffPerLevel * level).toFixed(2) + ' điểm dược liệu.';
    if (def.buffKind === 'seal') return 'Mẻ kế: + ' + (def.buffPerLevel * level).toFixed(2) + ' điểm phong đan.';
    return 'Trừ ngay ' + (def.detoxBase + def.detoxPerLevel * level) + ' đan độc.';
  }

  // ---------------- Learn ----------------
  function canLearnSkill(player, skillId) {
    var def = SKILLS[skillId];
    if (!def) return { ok: false, reason: 'unknown', missing: ['kỹ năng không tồn tại'] };
    var s = ensureState(player);
    var missing = [];
    if (isSkillLearned(player, skillId)) return { ok: false, reason: 'learned', missing: ['đã học rồi'] };
    var ld = getLuyenDanAPI();
    var rank = 0;
    if (ld && ld.getAlchemistRank) rank = ld.getAlchemistRank(player);
    else rank = s.rank || 0;
    if (def.learnSuccesses > 0 && (s.successes || 0) < def.learnSuccesses) {
      missing.push('luyện thành công ' + (s.successes || 0) + '/' + def.learnSuccesses + ' mẻ');
    }
    if (def.learnRank > 0 && rank < def.learnRank) {
      var names = (ld && ld.ALCHEMIST_RANKS) ? ld.ALCHEMIST_RANKS : ['Học đồ', 'Đan sĩ', 'Đan sư', 'Đại đan sư'];
      missing.push('cấp đan sư ' + (names[def.learnRank] || ('hạng ' + def.learnRank)));
    }
    if ((player.linhThach || 0) < def.learnFeeLT) {
      missing.push('Linh Thạch ' + (player.linhThach || 0) + '/' + def.learnFeeLT);
    }
    return { ok: missing.length === 0, missing: missing };
  }

  function learnSkill(player, skillId) {
    var def = SKILLS[skillId];
    if (!def) return { ok: false, reason: 'unknown', msg: 'Kỹ năng không tồn tại.' };
    ensureState(player);
    if (isSkillLearned(player, skillId)) {
      return { ok: false, reason: 'learned', msg: 'Đã học ' + def.name + ' rồi.' };
    }
    var c = canLearnSkill(player, skillId);
    if (!c.ok) {
      return { ok: false, reason: 'conditions', msg: 'Chưa đủ điều kiện học ' + def.name + ': ' + c.missing.join(', ') + '.', missing: c.missing };
    }
    player.linhThach = (player.linhThach || 0) - def.learnFeeLT;
    player.luyenDan.skills[skillId].learned = true;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    playChime();
    showToast('Đã học ' + def.name + '.');
    refreshHUD();
    return { ok: true, msg: 'Đã học ' + def.name + '.', skillId: skillId };
  }

  // ---------------- Buffs ----------------
  function getActiveBuffs(player, nowMs) {
    var s = ensureState(player);
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var out = [];
    for (var i = 0; i < SKILL_ORDER.length; i++) {
      var b = s.skillBuffs[SKILL_ORDER[i]];
      if (b && typeof b === 'object' && (now - (b.castAt || 0)) < BUFF_TTL_MS) {
        out.push({ skillId: SKILL_ORDER[i], level: b.level || 1, castAt: b.castAt });
      }
    }
    return out;
  }

  // Điểm nối refineBatch gọi: lấy buff còn hạn, XÓA mọi buff (kể cả hết
  // hạn) để mẻ luyện kế tiếp không dùng lại buff cũ. Chỉ gọi khi mẻ luyện
  // đã qua kiểm tra và chạy tới bước tính điểm — mẻ bị từ chối không tiêu buff.
  function consumeBuffs(player, nowMs) {
    var s = ensureState(player);
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var bonuses = { heatBonus: 0, orderBonus: 0, sealBonus: 0, applied: [] };
    for (var i = 0; i < SKILL_ORDER.length; i++) {
      var sid = SKILL_ORDER[i];
      var b = s.skillBuffs[sid];
      if (!b || typeof b !== 'object') continue;
      var def = SKILLS[sid];
      var fresh = (now - (b.castAt || 0)) < BUFF_TTL_MS;
      delete s.skillBuffs[sid];
      if (!fresh || !def || !def.buffKind) continue;
      var amount = def.buffPerLevel * (b.level || 1);
      if (def.buffKind === 'heat') bonuses.heatBonus += amount;
      else if (def.buffKind === 'order') bonuses.orderBonus += amount;
      else if (def.buffKind === 'seal') bonuses.sealBonus += amount;
      bonuses.applied.push({ skillId: sid, level: b.level || 1, amount: amount });
    }
    return bonuses;
  }

  // ---------------- Cast ----------------
  function castSkill(player, skillId, nowMs) {
    ensureState(player);
    var def = SKILLS[skillId];
    if (!def) return { ok: false, msg: 'Không có kỹ năng này.' };
    if (!isSkillLearned(player, skillId)) return { ok: false, msg: 'Chưa học kỹ năng này.', code: 'not_learned' };

    var s = player.luyenDan;
    var sp = s.skills[skillId];
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();

    if (sp.cooldownUntil && now < sp.cooldownUntil) {
      var leftSec = Math.ceil((sp.cooldownUntil - now) / 1000);
      return { ok: false, msg: 'Đang hồi chiêu (' + leftSec + ' giây).', code: 'cooldown', cooldownLeftSec: leftSec };
    }

    var cost = skillCost(skillId, sp.level || 1);
    var st = getStateAPI();
    if ((player.linhLuc || 0) < cost) {
      return { ok: false, msg: 'Linh lực không đủ (cần ' + cost + ').', code: 'cost' };
    }

    // Thanh Độc Quyết: từ chối khi không có độc — khỏi phí linh lực/hồi chiêu.
    var ld = getLuyenDanAPI();
    var toxinBefore = 0;
    if (!def.buffKind) {
      toxinBefore = ld && ld.getDanDoc ? ld.getDanDoc(player) : (s.toxin || 0);
      if (toxinBefore <= 0) {
        return { ok: false, msg: 'Không có đan độc để giải.', code: 'no_toxin' };
      }
    }

    player.linhLuc -= cost;

    var effect = null;
    if (def.buffKind) {
      s.skillBuffs[skillId] = { level: sp.level || 1, castAt: now };
      effect = { buffKind: def.buffKind, level: sp.level || 1, amount: def.buffPerLevel * (sp.level || 1) };
    } else {
      var cleared = def.detoxBase + def.detoxPerLevel * (sp.level || 1);
      var toxinAfter;
      if (ld && ld.addDanDoc) {
        toxinAfter = ld.addDanDoc(player, -cleared);
      } else {
        s.toxin = Math.max(0, (s.toxin || 0) - cleared);
        toxinAfter = s.toxin;
      }
      effect = { detox: cleared, toxinBefore: toxinBefore, toxinAfter: toxinAfter };
    }

    sp.uses = (sp.uses || 0) + 1;
    var rankCap = skillLevelCap(player);
    sp.level = Math.min(rankCap, 1 + Math.floor(sp.uses / USES_PER_LEVEL));
    sp.cooldownUntil = now + def.baseCooldownSec * 1000;

    if (def.tuViElem && st && st.addTuViCapped) {
      st.addTuViCapped(player, def.tuViElem, (def.tuViAmount || 1) * (sp.level || 1));
    }

    if (st && st.savePlayer) st.savePlayer(player);
    playChime();
    showToast('Đã thi ' + def.name + '.');
    refreshHUD();
    return { ok: true, msg: 'Đã thi ' + def.name + '.', skillId: skillId, effect: effect, uses: sp.uses, level: sp.level };
  }

  function castKhongHoaQuyet(player, nowMs) { return castSkill(player, 'khong-hoa', nowMs); }
  function castTinhDuocQuyet(player, nowMs) { return castSkill(player, 'tinh-duoc', nowMs); }
  function castNgungDanQuyet(player, nowMs) { return castSkill(player, 'ngung-dan', nowMs); }
  function castThanhDocQuyet(player, nowMs) { return castSkill(player, 'thanh-doc', nowMs); }

  // Exports
  exports.SKILLS = SKILLS;
  exports.SKILL_ORDER = SKILL_ORDER;
  exports.BUFF_TTL_MS = BUFF_TTL_MS;
  exports.USES_PER_LEVEL = USES_PER_LEVEL;
  exports.ensureState = ensureState;
  exports.getSkillDef = getSkillDef;
  exports.listSkills = listSkills;
  exports.isSkillLearned = isSkillLearned;
  exports.skillLevel = skillLevel;
  exports.skillCost = skillCost;
  exports.skillCooldownLeftMs = skillCooldownLeftMs;
  exports.skillLevelCap = skillLevelCap;
  exports.skillEffectText = skillEffectText;
  exports.canLearnSkill = canLearnSkill;
  exports.learnSkill = learnSkill;
  exports.getActiveBuffs = getActiveBuffs;
  exports.consumeBuffs = consumeBuffs;
  exports.castSkill = castSkill;
  exports.castKhongHoaQuyet = castKhongHoaQuyet;
  exports.castTinhDuocQuyet = castTinhDuocQuyet;
  exports.castNgungDanQuyet = castNgungDanQuyet;
  exports.castThanhDocQuyet = castThanhDocQuyet;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameDanKyNang = {}));
