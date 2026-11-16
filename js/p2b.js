/**
 * p2b.js — Đợt P2B: trạng thái hồn + trọng thương + điểm tử + Bùa Hộ Mệnh
 * + log chết (hồ sơ 47 §3/§4/§7, 48 §2/§7/§8). CHỈ phần chơi đơn.
 *
 * Năm việc đúng phạm vi TASK-P2B:
 *   1. Trạng thái hồn: hồn lìa xác tối đa SOUL_MAX_SEC giây, đứng tại điểm chết,
 *      không bị đánh/không nhặt đồ (engine khóa update khi hp = 0), hết giờ thì
 *      modal chết như cũ. Không vẽ hình hồn mới.
 *   2. Trọng thương: sau hồi sinh giảm chỉ số chiến đấu theo bảng dưới, chồng
 *      tầng khi chết liên tiếp trong cửa sổ, tự tan theo phút hoặc hết ngay khi
 *      ăn món hồi máu hiện có (engine gọi clearWound ở nhánh FOOD_DEFS).
 *   3. Điểm tử: 1 điểm mới nhất (map + toạ độ), có mũi tên riêng ở engine và
 *      chấm riêng ở minimap; rời xa rồi quay lại đúng bán kính thì tự xóa.
 *   4. Bùa Hộ Mệnh: mang tối đa 1 lá (item 'bua-ho-menh'), đòn kết liễu thì bùa
 *      vỡ, sống với 10% máu tối đa + 3 giây vô địch, mất lá bùa khỏi túi.
 *   5. player.deathLog: mỗi lần chết 1 bản ghi đủ trường cho sổ tử P2F đọc.
 *
 * LUẬT SỐ: mọi con số đội đề xuất nằm trong MỘT object P2B_CONST dưới đây, mỗi
 * dòng ghi PROVISIONAL (trừ số hồ sơ 47§7: mang tối đa 1 lá). Không rải số cứng
 * trong logic.
 *
 * Module thuần dữ liệu + số học, không đụng DOM: test Node chạy thẳng.
 * Nguồn dữ liệu thật (không bịa):
 *   - item id 'bua-ho-menh' (entry mới duy nhất trong js/monsters.js ITEM_DEFS).
 *   - map id/name do engine truyền vào từ mapdata.js hiện tại.
 *   - món ăn hồi máu: js/food-buff.js FOOD_DEFS (Cơm/Cháo Linh Mễ) — đường thật.
 */
(function (exports) {
  'use strict';

  // ---------------------------------------------------------------------------
  // BẢNG HẰNG SỐ DUY NHẤT (PROVISIONAL — đội P2B đề xuất, Bui phán sau)
  // ---------------------------------------------------------------------------
  var P2B_CONST = {
    SOUL_MAX_SEC: 30,                 // PROVISIONAL — hồ sơ 48§2: vài giây–1 phút
    WOUND_PENALTY_PER_STACK: 0.25,    // PROVISIONAL — 25% chỉ số chiến đấu mỗi tầng
    WOUND_DECAY_MS: 5 * 60 * 1000,    // PROVISIONAL — tự tan sau 5 phút
    WOUND_MAX_STACKS: 3,              // PROVISIONAL — trần 3 tầng
    WOUND_CHAIN_WINDOW_MS: 10 * 60 * 1000, // PROVISIONAL — cửa sổ chết liên tiếp 10 phút
    CHARM_SURVIVE_HP_RATIO: 0.10,     // PROVISIONAL — bùa vỡ còn 10% máu tối đa
    CHARM_INVULN_MS: 3000,            // PROVISIONAL — vô địch 3 giây sau khi bùa vỡ
    CHARM_MAX_HELD: 1,                // HỒ SƠ 47§7 — mang tối đa 1 lá
    DEATH_POINT_CLEAR_RADIUS: 48,     // PROVISIONAL — bán kính "tới nơi" để xóa điểm tử
    DEATH_POINT_REARM_RADIUS: 96,     // PROVISIONAL — phải rời xa chừng này thì mới tính là quay lại
    DEATH_LOG_MAX: 200                // PROVISIONAL — giữ tối đa 200 sự kiện chết cho sổ tử
  };

  var CHARM_ITEM_ID = 'bua-ho-menh';

  // Trạng thái hồn là trạng thái PHIÊN (không ghi vào save): mở lại game thì
  // nhân vật vẫn đang hp = 0 trong save, engine hiện modal chết như cũ.
  var soul = { active: false, untilMs: 0, mapId: null, x: 0, y: 0 };

  function nowOr(nowMs) {
    return (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
  }

  function ensureState(player) {
    if (!player || typeof player !== 'object') return null;
    if (!player.p2b || typeof player.p2b !== 'object') player.p2b = {};
    var p = player.p2b;
    if (!p.wound || typeof p.wound !== 'object') {
      p.wound = { stacks: 0, untilMs: 0, lastDeathMs: 0, chainCount: 0 };
    }
    if (typeof p.wound.stacks !== 'number' || !isFinite(p.wound.stacks)) p.wound.stacks = 0;
    if (typeof p.wound.untilMs !== 'number' || !isFinite(p.wound.untilMs)) p.wound.untilMs = 0;
    if (typeof p.wound.lastDeathMs !== 'number' || !isFinite(p.wound.lastDeathMs)) p.wound.lastDeathMs = 0;
    if (typeof p.wound.chainCount !== 'number' || !isFinite(p.wound.chainCount)) p.wound.chainCount = 0;
    if (typeof p.invulnUntil !== 'number' || !isFinite(p.invulnUntil)) p.invulnUntil = 0;
    if (!p.deathPoint || typeof p.deathPoint !== 'object') p.deathPoint = null;
    if (!Array.isArray(player.deathLog)) player.deathLog = [];
    return p;
  }

  // ---------------------------------------------------------------------------
  // TRẠNG THÁI HỒN (48§2)
  // ---------------------------------------------------------------------------
  function beginSoul(nowMs, pos, mapId) {
    var now = nowOr(nowMs);
    soul.active = true;
    soul.untilMs = now + P2B_CONST.SOUL_MAX_SEC * 1000;
    soul.mapId = mapId || null;
    soul.x = pos && typeof pos.x === 'number' ? pos.x : 0;
    soul.y = pos && typeof pos.y === 'number' ? pos.y : 0;
    return { untilMs: soul.untilMs, seconds: P2B_CONST.SOUL_MAX_SEC };
  }

  function endSoul() {
    var was = soul.active;
    soul.active = false;
    soul.untilMs = 0;
    return was;
  }

  function isSoulActive(nowMs) {
    if (!soul.active) return false;
    return nowOr(nowMs) < soul.untilMs;
  }

  function soulRemainingSec(nowMs) {
    if (!soul.active) return 0;
    var left = soul.untilMs - nowOr(nowMs);
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }

  function soulInfo() {
    return { active: soul.active, untilMs: soul.untilMs, mapId: soul.mapId, x: soul.x, y: soul.y };
  }

  // ---------------------------------------------------------------------------
  // TRỌNG THƯƠNG (47§3)
  // ---------------------------------------------------------------------------
  function woundStacks(player, nowMs) {
    var p = ensureState(player);
    if (!p) return 0;
    var w = p.wound;
    if (w.stacks > 0 && nowOr(nowMs) >= w.untilMs) {
      w.stacks = 0;
      w.untilMs = 0;
    }
    return Math.max(0, Math.min(P2B_CONST.WOUND_MAX_STACKS, Math.floor(w.stacks)));
  }

  /** Tỉ lệ giảm chỉ số chiến đấu hiện tại (0..0.75). */
  function woundPenalty(player, nowMs) {
    var stacks = woundStacks(player, nowMs);
    return Math.min(0.99, stacks * P2B_CONST.WOUND_PENALTY_PER_STACK);
  }

  function woundInfo(player, nowMs) {
    var now = nowOr(nowMs);
    var stacks = woundStacks(player, now);
    var p = ensureState(player);
    return {
      stacks: stacks,
      penalty: woundPenalty(player, now),
      untilMs: p ? p.wound.untilMs : 0,
      remainingSec: (p && p.wound.stacks > 0) ? Math.max(0, Math.ceil((p.wound.untilMs - now) / 1000)) : 0
    };
  }

  /**
   * Gọi SAU khi hồi sinh thành công: chết trong cửa sổ 10 phút thì +1 tầng,
   * ngoài cửa sổ thì tính lại từ tầng 1. Mỗi lần đều làm mới đồng hồ 5 phút.
   */
  function applyWoundAfterRevive(player, nowMs) {
    var p = ensureState(player);
    if (!p) return null;
    var now = nowOr(nowMs);
    var w = p.wound;
    var chained = (now - w.lastDeathMs) <= P2B_CONST.WOUND_CHAIN_WINDOW_MS && w.lastDeathMs > 0;
    var chainCount = chained ? ((w.chainCount || 0) + 1) : 1;
    chainCount = Math.max(1, Math.min(P2B_CONST.WOUND_MAX_STACKS, chainCount));
    w.chainCount = chainCount;
    w.stacks = chainCount;
    w.untilMs = now + P2B_CONST.WOUND_DECAY_MS;
    w.lastDeathMs = now;
    return woundInfo(player, now);
  }

  function clearWound(player) {
    var p = ensureState(player);
    if (!p) return false;
    var had = p.wound.stacks > 0;
    p.wound.stacks = 0;
    p.wound.untilMs = 0;
    // Giữ chainCount + lastDeathMs để chết liên tiếp trong cửa sổ vẫn chồng tầng
    // dù đã ăn món hồi máu xóa trọng thương (47§3).
    return had;
  }

  // ---------------------------------------------------------------------------
  // ĐIỂM TỬ (47§4) — chỉ giữ điểm mới nhất
  // ---------------------------------------------------------------------------
  function setDeathPoint(player, pos, mapId, mapName, nowMs) {
    var p = ensureState(player);
    if (!p || !pos) return null;
    p.deathPoint = {
      x: pos.x,
      y: pos.y,
      mapId: mapId || null,
      mapName: mapName || '',
      at: nowOr(nowMs),
      armed: false
    };
    return p.deathPoint;
  }

  function getDeathPoint(player) {
    var p = ensureState(player);
    return (p && p.deathPoint) ? p.deathPoint : null;
  }

  function clearDeathPoint(player) {
    var p = ensureState(player);
    if (!p || !p.deathPoint) return false;
    p.deathPoint = null;
    return true;
  }

  /**
   * Mỗi khung: điểm tử chỉ xóa khi người chơi ĐÃ RỜI XA rồi quay lại đúng bán
   * kính (tránh trường hợp hồi sinh tại chỗ xóa luôn dấu vừa cắm).
   * Trả về true khi vừa xóa.
   */
  function tickDeathPoint(player, mapId) {
    var p = ensureState(player);
    if (!p || !p.deathPoint) return false;
    if (!player || player.hp <= 0) return false;
    if (!mapId || p.deathPoint.mapId !== mapId) return false;
    var d = Math.hypot((player.x || 0) - p.deathPoint.x, (player.y || 0) - p.deathPoint.y);
    if (!p.deathPoint.armed) {
      if (d > P2B_CONST.DEATH_POINT_REARM_RADIUS) p.deathPoint.armed = true;
      return false;
    }
    if (d <= P2B_CONST.DEATH_POINT_CLEAR_RADIUS) {
      p.deathPoint = null;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // BÙA HỘ MỆNH (47§7)
  // ---------------------------------------------------------------------------
  function countItemInSlots(player, itemId) {
    if (!player || !player.bag || !Array.isArray(player.bag.slots)) return 0;
    var n = 0;
    for (var i = 0; i < player.bag.slots.length; i++) {
      var s = player.bag.slots[i];
      if (s && s.itemId === itemId) n += (typeof s.count === 'number' ? s.count : 1);
    }
    return n;
  }

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    if (typeof require === 'function') {
      try { return require('./state.js'); } catch (e) { return null; }
    }
    return null;
  }

  function getMonstersAPI() {
    if (typeof window !== 'undefined' && window.GameMonsters) return window.GameMonsters;
    if (typeof global !== 'undefined' && global.GameMonsters) return global.GameMonsters;
    if (typeof require === 'function') {
      try { return require('./monsters.js'); } catch (e) { return null; }
    }
    return null;
  }

  function hasCharm(player) {
    return countItemInSlots(player, CHARM_ITEM_ID) >= 1;
  }

  function charmCount(player) {
    return countItemInSlots(player, CHARM_ITEM_ID);
  }

  /** Nhận bùa từ đường thưởng thật; đã có 1 lá thì không nhận thêm (47§7). */
  function grantCharm(player) {
    ensureState(player);
    if (hasCharm(player)) return { ok: false, reason: 'max', count: charmCount(player) };
    var st = getStateAPI();
    if (st && st.addItemToBag) {
      var mAPI = getMonstersAPI();
      st.addItemToBag(player, CHARM_ITEM_ID, 1, mAPI ? mAPI.ITEM_DEFS : undefined);
    } else if (player.bag && Array.isArray(player.bag.slots)) {
      var placed = false;
      for (var i = 0; i < player.bag.slots.length; i++) {
        if (!player.bag.slots[i]) {
          player.bag.slots[i] = { itemId: CHARM_ITEM_ID, count: 1 };
          placed = true;
          break;
        }
      }
      if (!placed) return { ok: false, reason: 'bag_full', count: 0 };
    } else {
      return { ok: false, reason: 'no_bag', count: 0 };
    }
    return { ok: true, count: charmCount(player) };
  }

  function consumeCharm(player) {
    if (!hasCharm(player)) return false;
    var st = getStateAPI();
    if (st && st.removeItemFromBag) {
      st.removeItemFromBag(player, CHARM_ITEM_ID, 1);
    } else {
      for (var i = 0; i < player.bag.slots.length; i++) {
        var s = player.bag.slots[i];
        if (s && s.itemId === CHARM_ITEM_ID) {
          if ((s.count || 1) > 1) s.count = (s.count || 1) - 1;
          else player.bag.slots[i] = null;
          break;
        }
      }
    }
    return true;
  }

  /**
   * Nhận đòn kết liễu: bùa vỡ, sống với CHARM_SURVIVE_HP_RATIO máu tối đa và
   * vô địch CHARM_INVULN_MS. Trả về null nếu không có bùa.
   */
  function tryCharmSave(player, nowMs) {
    if (!hasCharm(player)) return null;
    var now = nowOr(nowMs);
    consumeCharm(player);
    ensureState(player);
    var ratio = P2B_CONST.CHARM_SURVIVE_HP_RATIO;
    var hpMax = (player && player.hpMax > 0) ? player.hpMax : 100;
    player.hp = Math.max(1, Math.round(hpMax * ratio));
    player.p2b.invulnUntil = now + P2B_CONST.CHARM_INVULN_MS;
    return {
      hp: player.hp,
      hpMax: hpMax,
      invulnUntil: player.p2b.invulnUntil,
      invulnSec: P2B_CONST.CHARM_INVULN_MS / 1000
    };
  }

  function isInvulnerable(player, nowMs) {
    var p = ensureState(player);
    if (!p) return false;
    return p.invulnUntil > nowOr(nowMs);
  }

  // ---------------------------------------------------------------------------
  // LOG CHẾT (48§7/§8) — nguồn cho sổ tử P2F, P2B không làm giao diện
  // ---------------------------------------------------------------------------
  function recordDeath(player, info, nowMs) {
    ensureState(player);
    info = info || {};
    var now = nowOr(nowMs);
    var lastId = 0;
    if (player.deathLog.length > 0) {
      var last = player.deathLog[player.deathLog.length - 1];
      if (last && typeof last.id === 'number') lastId = last.id;
    }
    var entry = {
      id: lastId + 1,
      at: now,
      mapId: info.mapId || null,
      mapName: info.mapName || '',
      x: typeof info.x === 'number' ? Math.round(info.x) : 0,
      y: typeof info.y === 'number' ? Math.round(info.y) : 0,
      cause: info.cause || 'unknown',
      killerId: info.killerId || null,
      killerName: info.killerName || '',
      realm: info.realm || '',
      soulSec: P2B_CONST.SOUL_MAX_SEC,
      revive: null
    };
    player.deathLog.push(entry);
    while (player.deathLog.length > P2B_CONST.DEATH_LOG_MAX) player.deathLog.shift();
    return entry;
  }

  function noteRevive(player, type, nowMs) {
    ensureState(player);
    var log = player.deathLog;
    if (!log || log.length === 0) return null;
    var last = log[log.length - 1];
    last.revive = { type: type === 'spot' ? 'spot' : 'home', at: nowOr(nowMs) };
    return last;
  }

  // ---------------------------------------------------------------------------
  // TICK CHUNG (engine gọi mỗi khung trong gameLoop, kể cả lúc hp = 0)
  // ---------------------------------------------------------------------------
  function tick(player, nowMs) {
    var now = nowOr(nowMs);
    var out = { soulEnded: false, soulRemainingSec: 0, woundCleared: false, deathPointCleared: false };
    if (soul.active) {
      if (now >= soul.untilMs) {
        soul.active = false;
        soul.untilMs = 0;
        out.soulEnded = true;
      } else {
        out.soulRemainingSec = Math.ceil((soul.untilMs - now) / 1000);
      }
    }
    var p = ensureState(player);
    if (p && p.wound.stacks > 0 && now >= p.wound.untilMs) {
      p.wound.stacks = 0;
      p.wound.untilMs = 0;
      out.woundCleared = true;
    }
    return out;
  }

  /** Hệ của đường mạnh nhất — màu ánh sáng hồi sinh (48§7), engine đọc. */
  function strongestElement(player) {
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var best = 'moc';
    var bestVal = -1;
    for (var i = 0; i < keys.length; i++) {
      var v = (player && player.paths && player.paths[keys[i]] && player.paths[keys[i]].tuVi) || 0;
      if (v > bestVal) { bestVal = v; best = keys[i]; }
    }
    return best;
  }

  exports.P2B_CONST = P2B_CONST;
  exports.CHARM_ITEM_ID = CHARM_ITEM_ID;
  exports.ensureState = ensureState;
  exports.beginSoul = beginSoul;
  exports.endSoul = endSoul;
  exports.isSoulActive = isSoulActive;
  exports.soulRemainingSec = soulRemainingSec;
  exports.soulInfo = soulInfo;
  exports.woundStacks = woundStacks;
  exports.woundPenalty = woundPenalty;
  exports.woundInfo = woundInfo;
  exports.applyWoundAfterRevive = applyWoundAfterRevive;
  exports.clearWound = clearWound;
  exports.setDeathPoint = setDeathPoint;
  exports.getDeathPoint = getDeathPoint;
  exports.clearDeathPoint = clearDeathPoint;
  exports.tickDeathPoint = tickDeathPoint;
  exports.hasCharm = hasCharm;
  exports.charmCount = charmCount;
  exports.grantCharm = grantCharm;
  exports.consumeCharm = consumeCharm;
  exports.tryCharmSave = tryCharmSave;
  exports.isInvulnerable = isInvulnerable;
  exports.recordDeath = recordDeath;
  exports.noteRevive = noteRevive;
  exports.tick = tick;
  exports.strongestElement = strongestElement;
})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameP2B = {}));
