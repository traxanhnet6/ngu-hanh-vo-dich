/**
 * combat.js — Hệ thống chiến đấu và số học sát thương (Hồ sơ 49 & Brief Đợt 2)
 * Module thuần, Node-loadable và chạy trên trình duyệt.
 */

(function (exports) {
  'use strict';

  // Chu trình tương khắc: A khắc B -> KHAC_CYCLE[A] = B
  // Kim -> Mộc -> Thổ -> Thủy -> Hỏa -> Kim
  var KHAC_MAP = {
    kim: 'moc',
    moc: 'tho',
    tho: 'thuy',
    thuy: 'hoa',
    hoa: 'kim'
  };

  /**
   * Tính hệ số giảm trừ từ giáp (Hồ sơ 49 §2)
   * reduction = giáp / (giáp + 50), trần giảm tối đa 75% -> hệ số nhận tối thiểu 0.25
   */
  function getArmorFactor(armor) {
    if (armor <= 0) return 1.0;
    var reduction = armor / (armor + 50);
    if (reduction > 0.75) reduction = 0.75; // Trần giảm tối đa 75%
    return 1.0 - reduction;
  }

  /**
   * Tính hệ số tương khắc giữa 2 hệ (Hồ sơ 49 §3)
   * Khắc: x1.25, Bị khắc: x0.8, Trung tính / cùng hệ: x1.0
   */
  function getElementFactor(atkElem, defElem) {
    if (!atkElem || !defElem) return 1.0;
    var a = atkElem.toLowerCase();
    var d = defElem.toLowerCase();
    if (a === d) return 1.0;
    if (KHAC_MAP[a] === d) {
      return 1.25; // Ta khắc địch (+25%)
    }
    if (KHAC_MAP[d] === a) {
      return 0.8; // Địch khắc ta (-20%)
    }
    return 1.0;
  }

  /**
   * Tính sát thương thực nhận
   * dealt = raw * elementFactor * (1 - armor/(armor+50))
   * floor cap = raw * elementFactor * 0.25
   */
  function calcDamage(raw, elementFactor, armor) {
    var ef = (elementFactor !== undefined && elementFactor !== null) ? elementFactor : 1.0;
    var af = getArmorFactor(armor || 0);
    var dealt = raw * ef * af;
    var floor = raw * ef * 0.25;
    return Math.max(dealt, floor);
  }

  /**
   * Hệ số bạo kích (Hồ sơ 49 §3: gấp rưỡi x1.5)
   */
  var CRIT_MULTIPLIER = 1.5;

  /**
   * Kiểm tra đòn đánh có bạo kích hay không
   */
  function rollCrit(critChance) {
    var chance = critChance !== undefined ? critChance : 0.05;
    return Math.random() < chance;
  }

  /**
   * Bảo hộ một đòn cho người chơi (Hồ sơ 49 §6 & Brief Đợt 2 §5)
   * Đòn thường của quái thường bị kẹp <= 25% max HP của người chơi
   */
  function applyOneHitProtection(damage, playerMaxHp) {
    var maxAllowed = playerMaxHp * 0.25;
    return Math.min(damage, maxAllowed);
  }

  /**
   * Định nghĩa các kỹ năng của Hà Nhân (Đợt 2)
   */
  var SKILLS = {
    basic: {
      id: 'basic',
      name: 'Chém Dao Củi',
      element: 'neutral',
      range: 50,
      cd: 0.45,
      cost: 0,
      rawBase: 10,
      vfx: 'slash'
    },
    phi_diep: {
      id: 'phi_diep',
      name: 'Phi Diệp Trảm',
      element: 'moc',
      range: 280,
      speed: 520, // px/s
      cd: 3.0,
      cost: 4,
      rawRatio: 1.6, // 160% sát thương đòn cơ bản
      vfx: 'leaf_projectile'
    },
    day_leo: {
      id: 'day_leo',
      name: 'Dây Leo Trói',
      element: 'moc',
      range: 240,
      cd: 8.0,
      cost: 6,
      rawRatio: 0.8, // 80% sát thương đòn cơ bản
      snareDuration: 1.2, // trói chân 1.2s
      vfx: 'vine_snare'
    }
  };
  function petSkillDamage(pet, ownerAttack) {
    var api = (typeof window !== 'undefined' ? window.GameLinhThu : (typeof globalThis !== 'undefined' ? globalThis.GameLinhThu : null));
    return api && api.petDamage ? api.petDamage(pet, ownerAttack) : 0;
  }

  /**
   * Tỉ lệ hồi phục khí huyết và linh lực theo giây (Brief §5)
   */
  var REGEN = {
    outOfCombatHp: 1.5,
    outOfCombatLinhLuc: 2.0,
    inCombatLinhLuc: 0.4,
    outOfCombatDelay: 5.0 // Giây rời giao tranh để hồi phục nhanh
  };

  exports.KHAC_MAP = KHAC_MAP;
  exports.getArmorFactor = getArmorFactor;
  exports.getElementFactor = getElementFactor;
  exports.calcDamage = calcDamage;
  exports.CRIT_MULTIPLIER = CRIT_MULTIPLIER;
  exports.rollCrit = rollCrit;
  exports.applyOneHitProtection = applyOneHitProtection;
  exports.SKILLS = SKILLS;
  exports.REGEN = REGEN;
  exports.petSkillDamage = petSkillDamage;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameCombat = {}));
