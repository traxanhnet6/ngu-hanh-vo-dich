/**
 * trangbi.js — Đợt E1: Trang bị không bao giờ trống + mở rộng ô đồ
 *
 * Lớp 1: bộ cấp phát theo mốc gắn thưởng nhiệm vụ (luân phiên ô).
 * Lớp 2: kiểm tra thiếu đồ + nhiệm vụ bổ sung.
 * Lớp 3: sàn trang bị khi vào nội dung mốc (hàm tái dùng).
 * Chống lạm dụng: khóa giao dịch, mua lại.
 *
 * Node-loadable & chạy trên trình duyệt.
 */
(function (exports) {
  'use strict';

  var SLOTS = ['weapon', 'armor', 'shoes', 'belt', 'jewelry', 'phapKhi'];
  // head (nón lá) không thuộc bộ cấp phát — giữ nguyên.

  var SETS = {
    1: { name: 'Thanh Bố', prefix: 'thanh-bo', tierLabel: 'Luyện Khí' },
    2: { name: 'Trúc Văn', prefix: 'truc-van', tierLabel: 'Trúc Cơ' }
  };

  // ánh xạ slot -> đuôi id (issued item id = prefix + suffix)
  var SLOT_SUFFIX = {
    weapon: 'kiem',
    armor: 'ao',
    shoes: 'giay',
    belt: 'dai',
    jewelry: 'trang-suc',
    phapKhi: 'phap-khi'
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

  function ensureState(player) {
    if (!player) return null;
    if (!player.trangBi || typeof player.trangBi !== 'object') {
      player.trangBi = {
        nextSlotIndex: 0,
        issued: [],
        grantedMilestones: [],
        supplementary: {},
        buybacks: {}
      };
    }
    var st = player.trangBi;
    if (typeof st.nextSlotIndex !== 'number' || !isFinite(st.nextSlotIndex) || st.nextSlotIndex < 0) st.nextSlotIndex = 0;
    st.nextSlotIndex = Math.floor(st.nextSlotIndex) % 6;
    if (!Array.isArray(st.issued)) st.issued = [];
    if (!Array.isArray(st.grantedMilestones)) st.grantedMilestones = [];
    if (!st.supplementary || typeof st.supplementary !== 'object') st.supplementary = {};
    if (!st.buybacks || typeof st.buybacks !== 'object') st.buybacks = {};
    return st;
  }

  function getSlots() { return SLOTS.slice(); }

  function getSets() {
    var out = {};
    for (var k in SETS) out[k] = { name: SETS[k].name, tierLabel: SETS[k].tierLabel };
    return out;
  }

  function getTierForPlayer(player) {
    var st = getStateAPI();
    var rank = st && st.getRealmRank ? st.getRealmRank(player) : 0;
    if (rank >= 10) return 2;
    return 1;
  }

  function getItemId(tier, slot) {
    tier = tier || 1;
    var set = SETS[tier] || SETS[1];
    var suffix = SLOT_SUFFIX[slot];
    if (!suffix) return null;
    return set.prefix + '-' + suffix;
  }

  function getIssuedSet(tier) {
    tier = tier || 1;
    var out = {};
    for (var i = 0; i < SLOTS.length; i++) {
      out[SLOTS[i]] = getItemId(tier, SLOTS[i]);
    }
    return out;
  }

  function getItemDef(itemId) {
    var m = getMonstersAPI();
    if (m && m.ITEM_DEFS && m.ITEM_DEFS[itemId]) return m.ITEM_DEFS[itemId];
    return null;
  }

  function itemTier(itemId) {
    var def = getItemDef(itemId);
    if (def && typeof def.tier === 'number') return def.tier;
    // issued id prefix detection
    if (typeof itemId === 'string') {
      if (itemId.indexOf('truc-van-') === 0) return 2;
      if (itemId.indexOf('thanh-bo-') === 0) return 1;
    }
    return 0;
  }

  function getNextSlot(player) {
    ensureState(player);
    return SLOTS[player.trangBi.nextSlotIndex % SLOTS.length];
  }

  function issueGear(player, tier, slot, opts) {
    opts = opts || {};
    if (!player) return { ok: false, msg: 'Không có người chơi.' };
    ensureState(player);
    tier = tier || getTierForPlayer(player);
    slot = slot || getNextSlot(player);
    if (SLOTS.indexOf(slot) === -1) return { ok: false, reason: 'bad_slot', msg: 'Ô không hợp lệ.' };
    var itemId = getItemId(tier, slot);
    if (!itemId) return { ok: false, reason: 'no_item', msg: 'Không có bộ cấp phát cho mốc này.' };
    var st = getStateAPI();
    var m = getMonstersAPI();
    var res = st && st.addItemToBag ? st.addItemToBag(player, itemId, 1, m ? m.ITEM_DEFS : undefined) : { success: true };
    if (res && res.success === false) {
      return { ok: false, reason: 'bag_full', msg: 'Túi đồ đã đầy.' };
    }
    player.trangBi.issued.push({ tier: tier, slot: slot, itemId: itemId, at: Date.now() });
    player.trangBi.nextSlotIndex = (player.trangBi.nextSlotIndex + 1) % SLOTS.length;
    if (st && st.savePlayer) st.savePlayer(player);
    // hiệu ứng/nhạc (nếu có)
    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) window.GameAudio.playChime();
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast('Nhận bộ cấp phát: ' + (getItemDef(itemId) ? getItemDef(itemId).name : itemId));
    }
    return { ok: true, tier: tier, slot: slot, itemId: itemId, msg: 'Đã cấp ' + itemId };
  }

  function issueMilestoneReward(player, opts) {
    opts = opts || {};
    ensureState(player);
    var tier = opts.tier || getTierForPlayer(player);
    // nếu breakthrough -> weapon mới
    if (opts.breakthrough) {
      var newTier = opts.newTier || tier;
      return issueGear(player, newTier, 'weapon', opts);
    }
    // nếu milestone chỉ định slot
    if (opts.slot) return issueGear(player, tier, opts.slot, opts);
    return issueGear(player, tier, null, opts);
  }

  function onMainStageAdvanced(player, newStage) {
    ensureState(player);
    if (typeof newStage !== 'number') newStage = (player && player.quests) ? player.quests.mainStage : 0;
    var tier = getTierForPlayer(player);
    // mainStage 1..6 -> 6 ô luân phiên
    if (newStage >= 1 && newStage <= 6) {
      if (player.trangBi.grantedMilestones.indexOf('ms_' + newStage) === -1) {
        player.trangBi.grantedMilestones.push('ms_' + newStage);
        return issueMilestoneReward(player, { tier: tier });
      }
    }
    return { ok: false, reason: 'no_reward', msg: 'Không có thưởng trang bị cho mốc này.' };
  }

  function grantBreakthroughWeapon(player, newTier) {
    newTier = newTier || 2;
    ensureState(player);
    var ms = 'breakthrough_' + newTier;
    if (player.trangBi.grantedMilestones.indexOf(ms) !== -1) {
      return { ok: false, reason: 'already', msg: 'Đã cấp vũ khí đột phá cảnh giới này.' };
    }
    player.trangBi.grantedMilestones.push(ms);
    return issueGear(player, newTier, 'weapon', { breakthrough: true, newTier: newTier });
  }

  // Lớp 2: kiểm tra thiếu đồ
  // Đợt N1STATS: ô trang bị có thể là object N1 — lấy id trước khi tra bậc.
  function equipmentIdOf(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && typeof value.id === 'string') return value.id;
    return null;
  }

  function isSlotMissing(player, slot, tier) {
    if (!player || !player.equipment) return true;
    var itemId = equipmentIdOf(player.equipment[slot]);
    if (!itemId) return true;
    var it = itemTier(itemId);
    // thấp hơn sàn quá 2 bậc: itemTier < tier - 1 (cách >=2)
    if (it > 0 && it < tier - 1) return true;
    return false;
  }

  function checkMissingGear(player, tier) {
    tier = tier || getTierForPlayer(player);
    ensureState(player);
    var missing = [];
    for (var i = 0; i < SLOTS.length; i++) {
      var slot = SLOTS[i];
      if (isSlotMissing(player, slot, tier)) missing.push(slot);
    }
    return missing;
  }

  function openSupplementaryQuest(player, slot, tier) {
    if (!player) return { ok: false, msg: 'Không có người chơi.' };
    ensureState(player);
    tier = tier || getTierForPlayer(player);
    slot = slot || getNextSlot(player);
    if (SLOTS.indexOf(slot) === -1) return { ok: false, reason: 'bad_slot' };
    var sup = player.trangBi.supplementary;
    if (sup[slot] && sup[slot].completed) {
      return { ok: false, reason: 'already_completed', msg: 'Đã lãnh trang bị ô này.' };
    }
    if (sup[slot] && !sup[slot].completed) {
      return { ok: true, questId: sup[slot].questId, alreadyOpen: true, msg: 'Nhiệm vụ bổ sung đã mở.' };
    }
    var qid = 'supp_gear_' + tier + '_' + slot;
    sup[slot] = { tier: tier, slot: slot, questId: qid, tracked: true, completed: false, openedAt: Date.now() };
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, questId: qid, slot: slot, tier: tier, msg: 'Mở nhiệm vụ: Đi lãnh trang bị (' + slot + ').' };
  }

  function checkAndOpenSupplementary(player, tier) {
    tier = tier || getTierForPlayer(player);
    ensureState(player);
    var missing = checkMissingGear(player, tier);
    var opened = [];
    for (var i = 0; i < missing.length; i++) {
      var r = openSupplementaryQuest(player, missing[i], tier);
      if (r && r.ok) opened.push(r);
    }
    return { missing: missing, opened: opened };
  }

  function onMainQuestReceived(player, mainStage) {
    var tier = getTierForPlayer(player);
    return checkAndOpenSupplementary(player, tier);
  }

  function turnInSupplementary(player, slot) {
    if (!player) return { ok: false };
    ensureState(player);
    var sup = player.trangBi.supplementary[slot];
    if (!sup || sup.completed) return { ok: false, reason: 'none', msg: 'Không có nhiệm vụ bổ sung cho ô này.' };
    var tier = sup.tier || getTierForPlayer(player);
    var itemId = getItemId(tier, slot);
    var st = getStateAPI();
    var m = getMonstersAPI();
    var res = st && st.addItemToBag ? st.addItemToBag(player, itemId, 1, m ? m.ITEM_DEFS : undefined) : { success: true };
    if (res && res.success === false) return { ok: false, reason: 'bag_full' };
    sup.completed = true;
    sup.tracked = false;
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, slot: slot, itemId: itemId, msg: 'Đã lãnh trang bị.' };
  }

  function getSupplementaryQuests(player) {
    ensureState(player);
    var out = [];
    var sup = player.trangBi.supplementary;
    for (var slot in sup) {
      if (Object.prototype.hasOwnProperty.call(sup, slot)) out.push(sup[slot]);
    }
    return out;
  }

  // Lớp 3: sàn trang bị
  function gearScore(player) {
    if (!player || !player.equipment) return 0;
    var defs = getMonstersAPI() ? getMonstersAPI().ITEM_DEFS : null;
    var total = 0;
    for (var i = 0; i < SLOTS.length; i++) {
      var sl = SLOTS[i];
      var id = equipmentIdOf(player.equipment[sl]);
      if (id) {
        var d = defs ? defs[id] : null;
        if (d) {
          if (typeof d.atk === 'number') total += d.atk;
          if (typeof d.def === 'number') total += d.def;
        }
      }
    }
    // head
    var hid = equipmentIdOf(player.equipment.head);
    if (hid) {
      var hd = defs ? defs[hid] : null;
      if (hd) {
        if (typeof hd.atk === 'number') total += hd.atk;
        if (typeof hd.def === 'number') total += hd.def;
      }
    }
    // weapon special
    var wid = player.equipment.weapon;
    // already counted
    return total;
  }

  function floorScore(tier) {
    tier = tier || 1;
    var set = getIssuedSet(tier);
    var defs = getMonstersAPI() ? getMonstersAPI().ITEM_DEFS : null;
    var total = 0;
    for (var slot in set) {
      if (!Object.prototype.hasOwnProperty.call(set, slot)) continue;
      var d = defs ? defs[set[slot]] : null;
      if (d) {
        if (typeof d.atk === 'number') total += d.atk;
        if (typeof d.def === 'number') total += d.def;
      }
    }
    return total;
  }

  function checkGearFloor(player, minTier) {
    minTier = minTier || getTierForPlayer(player);
    var score = gearScore(player);
    var floor = floorScore(minTier);
    var below = score < floor;
    var suggestions = [];
    if (below) {
      var set = getIssuedSet(minTier);
      for (var i = 0; i < SLOTS.length; i++) {
        var sl = SLOTS[i];
        var id = player.equipment ? equipmentIdOf(player.equipment[sl]) : null;
        var it = id ? itemTier(id) : 0;
        if (!id || it < minTier - 1) suggestions.push(set[sl]);
      }
    }
    return { ok: !below, score: score, floor: floor, below: below, suggestions: suggestions, minTier: minTier };
  }

  // Chống lạm dụng
  function isTradeable(itemId) {
    var def = getItemDef(itemId);
    if (!def) return true;
    if (def.issued === true) return false;
    if (def.tradeable === false) return false;
    return def.tradeable !== false ? (def.tradeable !== undefined ? !!def.tradeable : true) : false;
  }
  // clearer:
  function isTradeable2(itemId) {
    var def = getItemDef(itemId);
    if (!def) return true;
    if (def.tradeable === false) return false;
    if (def.issued === true) return false;
    return true;
  }

  function sellToNpc(player, itemId) {
    if (!player) return { ok: false };
    var def = getItemDef(itemId);
    if (!def || def.type !== 'gear') return { ok: false, reason: 'not_gear' };
    // issued gear: token price
    var price = (typeof def.sellPrice === 'number') ? def.sellPrice : (def.issued ? 1 : 0);
    // remove one from bag
    var st = getStateAPI();
    if (st && st.removeItemFromBag) {
      var ok = st.removeItemFromBag(player, itemId, 1);
      if (!ok) return { ok: false, reason: 'not_owned' };
    }
    player.linhThach = (player.linhThach || 0) + price;
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, price: price, msg: 'Đã bán cho NPC.' };
  }

  function buyBack(player, itemId, slot) {
    if (!player) return { ok: false };
    var def = getItemDef(itemId);
    if (!def || def.type !== 'gear') return { ok: false, reason: 'not_gear' };
    var price = (typeof def.buybackPrice === 'number') ? def.buybackPrice : 5;
    if ((player.linhThach || 0) < price) return { ok: false, reason: 'not_enough_lt', price: price };
    var st = getStateAPI();
    var m = getMonstersAPI();
    var res = st && st.addItemToBag ? st.addItemToBag(player, itemId, 1, m ? m.ITEM_DEFS : undefined) : { success: true };
    if (res && res.success === false) return { ok: false, reason: 'bag_full' };
    player.linhThach = (player.linhThach || 0) - price;
    ensureState(player);
    player.trangBi.buybacks[itemId] = (player.trangBi.buybacks[itemId] || 0) + 1;
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, price: price, itemId: itemId };
  }

  // alias tradeable
  function isTradeLocked(itemId) {
    return !isTradeable2(itemId);
  }

  var API = {
    SLOTS: SLOTS,
    SETS: SETS,
    ensureState: ensureState,
    getSlots: getSlots,
    getSets: getSets,
    getTierForPlayer: getTierForPlayer,
    getItemId: getItemId,
    getIssuedSet: getIssuedSet,
    getNextSlot: getNextSlot,
    issueGear: issueGear,
    issueMilestoneReward: issueMilestoneReward,
    onMainStageAdvanced: onMainStageAdvanced,
    grantBreakthroughWeapon: grantBreakthroughWeapon,
    isSlotMissing: isSlotMissing,
    checkMissingGear: checkMissingGear,
    openSupplementaryQuest: openSupplementaryQuest,
    checkAndOpenSupplementary: checkAndOpenSupplementary,
    onMainQuestReceived: onMainQuestReceived,
    turnInSupplementary: turnInSupplementary,
    getSupplementaryQuests: getSupplementaryQuests,
    gearScore: gearScore,
    floorScore: floorScore,
    checkGearFloor: checkGearFloor,
    isTradeable: isTradeable2,
    isTradeLocked: isTradeLocked,
    sellToNpc: sellToNpc,
    buyBack: buyBack,
    // synonyms
    getSlotsList: getSlots,
    issueNext: issueGear,
    grantMilestoneGear: issueMilestoneReward,
    checkMissing: checkMissingGear,
    openSuppQuest: openSupplementaryQuest
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') window.GameTrangBi = API;
  if (typeof global !== 'undefined') global.GameTrangBi = API;
})(typeof window !== 'undefined' ? window : this);
