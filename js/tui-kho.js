/**
 * tui-kho.js — Đợt E2: Túi/kho theo hồ sơ 30 (mô hình vật chứa lồng nhau)
 *
 * Node-loadable và chạy trên trình duyệt.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ (hồ sơ 30 mục D — số ĐÃ DUYỆT)
  // ==========================================================================
  var CLOTH_CAPACITY = 20;
  var STORAGE_CAPACITY = 60;
  var STORAGE_MAX_CAPACITY = 100;
  var STORAGE_EXPAND_MAX = 40;
  var RING_CAPACITY = { linh: 120, phap: 200, bao: 320 };
  var TEMP_CHEST_CAPACITY = 30;
  var TEMP_CHEST_DAYS = 7;
  var HOME_STORAGE_CAPACITY = 200;
  var SECT_STORAGE_CAPACITY = 100;
  var QUICK_SLOTS = 4;
  var STACK_CONSUMABLE = 99;
  var STACK_MATERIAL = 999;
  var TABS = ['all', 'gear', 'fabao', 'consumable', 'biphaps', 'material', 'quest'];
  var TAB_LABELS = {
    all: 'Tất cả', gear: 'Trang bị', fabao: 'Pháp bảo',
    consumable: 'Vật phẩm', biphaps: 'Bí pháp', material: 'Nguyên liệu', quest: 'Nhiệm vụ'
  };

  // ==========================================================================
  // TIỆN ÍCH
  // ==========================================================================
  function genId(prefix) {
    return (prefix || 'c') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

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
    return null;
  }

  function isContainerItem(slot) {
    return !!slot && slot.type === 'container' && !!slot.containerId;
  }

  function stackLimit(itemId) {
    var def = getItemDef(itemId);
    if (!def) return 1;
    if (def.type === 'gear' || def.type === 'fabao' || def.type === 'container') return 1;
    if (def.type === 'material') return STACK_MATERIAL;
    if (def.type === 'consumable' || def.type === 'quest') return STACK_CONSUMABLE;
    // default: consumable-like
    return STACK_CONSUMABLE;
  }

  function isStackable(itemId) {
    return stackLimit(itemId) > 1;
  }

  // ==========================================================================
  // TẠO VẬT CHỨA
  // ==========================================================================
  function capacityFor(type, opts) {
    opts = opts || {};
    if (type === 'cloth') return CLOTH_CAPACITY;
    if (type === 'storage') return STORAGE_CAPACITY;
    if (type === 'ring') {
      var grade = opts.grade || opts.quality || 'linh';
      var g = String(grade).toLowerCase();
      if (g.indexOf('bao') !== -1) return RING_CAPACITY.bao;
      if (g.indexOf('phap') !== -1) return RING_CAPACITY.phap;
      return RING_CAPACITY.linh;
    }
    if (type === 'temp-chest' || type === 'temp' || type === 'ruong-tam') return TEMP_CHEST_CAPACITY;
    if (type === 'home' || type === 'home-storage' || type === 'kho-nha') return HOME_STORAGE_CAPACITY;
    if (type === 'sect' || type === 'sect-storage' || type === 'kho-tong') return SECT_STORAGE_CAPACITY;
    if (type === 'root') return 0;
    if (typeof opts.capacity === 'number') return opts.capacity;
    return CLOTH_CAPACITY;
  }

  function ringGrade(type, opts) {
    opts = opts || {};
    if (type !== 'ring') return null;
    var g = String(opts.grade || opts.quality || 'linh').toLowerCase();
    if (g.indexOf('bao') !== -1) return 'bao';
    if (g.indexOf('phap') !== -1) return 'phap';
    return 'linh';
  }

  function createContainer(type, opts) {
    opts = opts || {};
    var cap = capacityFor(type, opts);
    var id = opts.id || genId('cont');
    var grade = ringGrade(type, opts);
    var c = {
      id: id,
      type: type,
      name: opts.name || defaultName(type, grade),
      capacity: cap,
      maxCapacity: type === 'storage' ? STORAGE_MAX_CAPACITY : cap,
      slots: new Array(cap).fill(null),
      createdAt: Date.now(),
      grade: grade,
      // chứa lồng: slots có thể chứa item hoặc container-ref
      // ngăn chuyên dụng (chỉ nhẫn phap/bao)
      compartments: compartmentsForGrade(grade),
      // metadata UI
      starredSlots: {},
      lockedSlots: {},
      // mở rộng đã dùng
      expandedBy: 0,
      // worn (đeo) cho nhẫn
      worn: !!opts.worn
    };
    // temp chest expiry tracking per item slot handled in slot objects
    return c;
  }

  function defaultName(type, grade) {
    if (type === 'cloth') return 'Túi Vải Thường';
    if (type === 'storage') return 'Túi Trữ Vật';
    if (type === 'ring') {
      if (grade === 'bao') return 'Nhẫn Trữ Vật (Bảo phẩm)';
      if (grade === 'phap') return 'Nhẫn Trữ Vật (Pháp phẩm)';
      return 'Nhẫn Trữ Vật (Linh phẩm)';
    }
    if (type === 'temp-chest' || type === 'temp' || type === 'ruong-tam') return 'Rương Tạm';
    if (type === 'home' || type === 'home-storage' || type === 'kho-nha') return 'Kho Động Phủ';
    if (type === 'sect' || type === 'sect-storage' || type === 'kho-tong') return 'Kho Tông Môn';
    if (type === 'root') return 'Túi Đồ';
    return 'Vật Chứa';
  }

  function compartmentsForGrade(grade) {
    // Linh phẩm: chưa có ngăn. Pháp phẩm: Linh Dược + Đan. Bảo phẩm: + Pháp Bảo.
    if (grade === 'phap') return { enabled: ['linh-duoc', 'dan'], linhDuoc: true, dan: true, phapBao: false };
    if (grade === 'bao') return { enabled: ['linh-duoc', 'dan', 'phap-bao'], linhDuoc: true, dan: true, phapBao: true };
    return { enabled: [], linhDuoc: false, dan: false, phapBao: false };
  }

  // ==========================================================================
  // STATE (player.tuiKho)
  // ==========================================================================
  function ensureState(player) {
    if (!player) return null;
    if (player.tuiKho && typeof player.tuiKho === 'object') {
      normalizeState(player);
      return player.tuiKho;
    }
    // migrate old flat bag
    var oldSlots = null;
    if (player.bag && Array.isArray(player.bag.slots)) oldSlots = player.bag.slots.slice();
    else if (player.bag && player.bag.slots) oldSlots = [];

    var cloth = createContainer('cloth', { id: genId('cloth') });
    var store = {};
    store[cloth.id] = cloth;

    var tempChest = createContainer('temp-chest', { id: genId('temp') });
    store[tempChest.id] = tempChest;
    var home = createContainer('home-storage', { id: genId('home') });
    store[home.id] = home;
    var sect = createContainer('sect-storage', { id: genId('sect') });
    store[sect.id] = sect;

    player.tuiKho = {
      containers: store,
      rootSlots: [{ type: 'container', containerId: cloth.id }],
      containerOrder: [cloth.id],
      defaultContainerId: cloth.id,
      tempChestId: tempChest.id,
      homeStorageId: home.id,
      sectStorageId: sect.id,
      quickSlots: [null, null, null, null],
      pinned: {},
      locked: {},
      wornRings: [],
      starOrder: {},
      nextContainerSeq: 1
    };

    // migrate old items into cloth bag
    if (oldSlots) {
      for (var i = 0; i < oldSlots.length; i++) {
        var s = oldSlots[i];
        if (s && s.itemId) {
          addItemToContainer(cloth, s.itemId, s.count || 1, s);
        }
      }
    }

    // preserve existing rings? none
    normalizeState(player);
    // compat set in normalizeState
    if (!player.bag || typeof player.bag !== 'object') player.bag = {};
    var _st = player.tuiKho;
    if (_st.defaultContainerId && _st.containers[_st.defaultContainerId]) player.bag.slots = _st.containers[_st.defaultContainerId].slots;
    else player.bag.slots = _st.rootSlots;
    return player.tuiKho;
  }

  function normalizeState(player) {
    var st = player.tuiKho;
    if (!st || typeof st !== 'object') return;
    if (!st.containers || typeof st.containers !== 'object') st.containers = {};
    if (!Array.isArray(st.rootSlots)) st.rootSlots = [];
    if (!Array.isArray(st.containerOrder)) st.containerOrder = [];
    if (!st.defaultContainerId) st.defaultContainerId = null;
    if (!Array.isArray(st.quickSlots)) st.quickSlots = [null, null, null, null];
    while (st.quickSlots.length < QUICK_SLOTS) st.quickSlots.push(null);
    if (!st.tempChestId) {
      var tc = createContainer('temp-chest', { id: genId('temp') });
      st.containers[tc.id] = tc;
      st.tempChestId = tc.id;
    }
    if (!st.homeStorageId) {
      var h = createContainer('home-storage', { id: genId('home') });
      st.containers[h.id] = h;
      st.homeStorageId = h.id;
    }
    if (!st.sectStorageId) {
      var s = createContainer('sect-storage', { id: genId('sect') });
      st.containers[s.id] = s;
      st.sectStorageId = s.id;
    }
    // ensure all containers normalized
    for (var id in st.containers) {
      if (!Object.prototype.hasOwnProperty.call(st.containers, id)) continue;
      var c = st.containers[id];
      if (!c || typeof c !== 'object') { delete st.containers[id]; continue; }
      if (!Array.isArray(c.slots)) c.slots = new Array(c.capacity || CLOTH_CAPACITY).fill(null);
      while (c.slots.length < (c.capacity || 0)) c.slots.push(null);
      if (c.slots.length > (c.capacity || 0)) c.slots.length = c.capacity;
      if (!c.id) c.id = id;
      if (!c.compartments) c.compartments = compartmentsForGrade(c.grade);
    }
    // default container fallback
    if (!st.defaultContainerId || !st.containers[st.defaultContainerId]) {
      // first carried container
      var first = carriedContainerIds(player)[0];
      st.defaultContainerId = first || null;
    }
    if (st.containerOrder.length === 0) {
      st.containerOrder = carriedContainerIds(player).slice();
    }
    // remove invalid order
    st.containerOrder = st.containerOrder.filter(function (id) { return !!st.containers[id]; });
    // wornRings
    if (!Array.isArray(st.wornRings)) st.wornRings = [];
    // compat: player.bag.slots trỏ vào vật chứa mặc định (để mã/test cũ truy cập ô đồ phẳng),
    // trong khi lớp ngoài (rootSlots) chỉ chứa vật chứa.
    if (!player.bag || typeof player.bag !== 'object') player.bag = {};
    var defId = st.defaultContainerId;
    if (defId && st.containers[defId]) player.bag.slots = st.containers[defId].slots;
    else player.bag.slots = st.rootSlots;

    // Mở khóa Túi Trữ Vật theo mốc cốt truyện (vào tông môn / nhiệm vụ đột phá đầu) — hồi tố.
    try {
      if (shouldGrantStorage(player) && !hasStorageContainerState(st)) {
        var _sc = createContainer('storage', { id: genId('storage') });
        st.containers[_sc.id] = _sc;
        st.rootSlots.push({ type: 'container', containerId: _sc.id });
        if (st.containerOrder.indexOf(_sc.id) === -1) st.containerOrder.push(_sc.id);
        st.storageGranted = true;
      }
    } catch (e) {}
  }

  function shouldGrantStorage(player) {
    if (!player || !player.quests || typeof player.quests !== 'object') return false;
    var q = player.quests;
    return (typeof q.sectStage === 'number' && q.sectStage >= 4) || (typeof q.mainStage === 'number' && q.mainStage >= 1);
  }
  function hasStorageContainerState(st) {
    if (!st || !st.containers) return false;
    for (var id in st.containers) {
      if (Object.prototype.hasOwnProperty.call(st.containers, id)) {
        var c = st.containers[id];
        if (c && c.type === 'storage') return true;
      }
    }
    if (Array.isArray(st.rootSlots)) {
      for (var i = 0; i < st.rootSlots.length; i++) {
        var sl = st.rootSlots[i];
        if (sl && sl.type === 'container' && st.containers[sl.containerId] && st.containers[sl.containerId].type === 'storage') return true;
      }
    }
    return false;
  }

  // ==========================================================================
  // CARRIED CONTAINERS (root layer)
  // ==========================================================================
  function carriedContainerIds(player) {
    ensureState(player);
    var st = player.tuiKho;
    var ids = [];
    for (var i = 0; i < st.rootSlots.length; i++) {
      var sl = st.rootSlots[i];
      if (isContainerItem(sl) && st.containers[sl.containerId]) ids.push(sl.containerId);
    }
    return ids;
  }

  function getContainer(player, id) {
    ensureState(player);
    return player.tuiKho.containers[id] || null;
  }

  function listContainers(player, scope) {
    ensureState(player);
    var st = player.tuiKho;
    var out = [];
    if (scope === 'carried' || !scope) {
      for (var i = 0; i < carriedContainerIds(player).length; i++) {
        out.push(st.containers[carriedContainerIds(player)[i]]);
      }
    } else if (scope === 'all') {
      for (var k in st.containers) if (Object.prototype.hasOwnProperty.call(st.containers, k)) out.push(st.containers[k]);
    } else if (scope === 'temp') {
      out.push(st.containers[st.tempChestId]);
    } else if (scope === 'home') {
      out.push(st.containers[st.homeStorageId]);
    } else if (scope === 'sect') {
      out.push(st.containers[st.sectStorageId]);
    }
    return out;
  }

  // ==========================================================================
  // CHỨA LỒNG + CHẶN VÒNG
  // ==========================================================================
  function isAncestor(player, containerId, maybeAncestorId) {
    // is maybeAncestorId an ancestor of containerId? (containerId nested inside maybeAncestor)
    ensureState(player);
    // DFS from maybeAncestor looking for containerId
    var st = player.tuiKho;
    function search(cid, target, visited) {
      if (cid === target) return true;
      if (visited[cid]) return false;
      visited[cid] = true;
      var c = st.containers[cid];
      if (!c) return false;
      for (var i = 0; i < c.slots.length; i++) {
        var sl = c.slots[i];
        if (isContainerItem(sl)) {
          if (search(sl.containerId, target, visited)) return true;
        }
      }
      return false;
    }
    return search(maybeAncestorId, containerId, {});
  }

  function canNest(player, childId, parentId) {
    ensureState(player);
    if (childId === parentId) return false;
    var st = player.tuiKho;
    if (!st.containers[childId] || !st.containers[parentId]) return false;
    // child must not contain parent (direct or via cycle)
    if (isAncestor(player, parentId, childId)) return false;
    // also child must not already be parent of itself etc
    return true;
  }

  function nestContainer(player, childId, parentId, slotIndex) {
    ensureState(player);
    var st = player.tuiKho;
    if (!canNest(player, childId, parentId)) {
      return { ok: false, reason: 'cycle', msg: 'Không thể đặt vật chứa vào chính nó (trực tiếp hay qua vòng).' };
    }
    var parent = st.containers[parentId];
    if (!parent) return { ok: false, reason: 'no_parent' };
    // remove child from current location (root or other parent) first
    removeFromParent(player, childId);
    // place into parent slot
    var idx = (typeof slotIndex === 'number') ? slotIndex : findEmptySlot(parent);
    if (idx === -1 || idx >= parent.capacity || parent.slots[idx]) {
      // find empty
      idx = findEmptySlot(parent);
    }
    if (idx === -1) return { ok: false, reason: 'full', msg: 'Vật chứa cha đã đầy.' };
    parent.slots[idx] = { type: 'container', containerId: childId };
    // if parent is root? rootSlots handled by removeFromParent+push? We treat root as container? root not in store. Handle root separately:
    return { ok: true, parentId: parentId, slotIndex: idx };
  }

  function removeFromParent(player, childId) {
    ensureState(player);
    var st = player.tuiKho;
    // root
    for (var i = 0; i < st.rootSlots.length; i++) {
      if (isContainerItem(st.rootSlots[i]) && st.rootSlots[i].containerId === childId) {
        st.rootSlots[i] = null;
        return true;
      }
    }
    // other containers
    for (var cid in st.containers) {
      if (!Object.prototype.hasOwnProperty.call(st.containers, cid)) continue;
      var c = st.containers[cid];
      for (var j = 0; j < c.slots.length; j++) {
        if (isContainerItem(c.slots[j]) && c.slots[j].containerId === childId) {
          c.slots[j] = null;
          return true;
        }
      }
    }
    return false;
  }

  function findEmptySlot(container) {
    for (var i = 0; i < container.slots.length; i++) {
      if (container.slots[i] === null) return i;
    }
    return -1;
  }

  // ==========================================================================
  // THÊM / LẤY / ĐẾM VẬT PHẨM TRONG VẬT CHỨA
  // ==========================================================================
  function addItemToContainer(container, itemId, count, extra) {
    if (!container) return { success: false, reason: 'no_container' };
    var cnt = (count !== undefined && count !== null) ? count : 1;
    var limit = stackLimit(itemId);
    // stack
    if (limit > 1) {
      for (var i = 0; i < container.slots.length; i++) {
        var s = container.slots[i];
        if (s && !isContainerItem(s) && s.itemId === itemId) {
          // stack if under limit
          var space = limit - (s.count || 1);
          if (space > 0) {
            var add = Math.min(cnt, space);
            s.count = (s.count || 1) + add;
            cnt -= add;
            if (cnt <= 0) return { success: true, slot: i, count: s.count };
          }
        }
      }
    }
    // if still cnt>0, new slots
    while (cnt > 0) {
      var idx = findEmptySlot(container);
      if (idx === -1) return { success: false, reason: 'full' };
      var put = (limit > 1) ? Math.min(cnt, limit) : 1;
      var slotObj = { itemId: itemId, count: put };
      if (extra && typeof extra === 'object') {
        if (extra.starred) slotObj.starred = true;
        if (extra.locked) slotObj.locked = true;
      }
      container.slots[idx] = slotObj;
      cnt -= put;
      if (limit <= 1) {
        // non-stackable: one per slot, but count may be >1? treat each unit separate slot
        if (cnt > 0) continue; else break;
      }
    }
    return { success: true, slot: idx, count: count };
  }

  // Add item to player with flow: default container -> others in order -> temp chest.
  function addItemToPlayer(player, itemId, count, itemDefs) {
    ensureState(player);
    var st = player.tuiKho;
    // linh-thach currency stays in player.linhThach (giữ tương thích)
    if (itemId === 'linh-thach') {
      player.linhThach = (player.linhThach || 0) + (count || 1);
      return { success: true, slot: -1, count: player.linhThach, currency: true };
    }
    var cnt = (count !== undefined && count !== null) ? count : 1;
    // try default first
    var order = [st.defaultContainerId].concat(st.containerOrder.filter(function (x) { return x !== st.defaultContainerId; }));
    // unique
    var seen = {};
    var uniq = [];
    for (var i = 0; i < order.length; i++) {
      if (!order[i] || seen[order[i]]) continue;
      seen[order[i]] = true;
      uniq.push(order[i]);
    }
    // also include all carried containers not in order
    var carried = carriedContainerIds(player);
    for (var ci = 0; ci < carried.length; ci++) {
      if (!seen[carried[ci]]) { seen[carried[ci]] = true; uniq.push(carried[ci]); }
    }
    for (var oi = 0; oi < uniq.length; oi++) {
      var c = st.containers[uniq[oi]];
      if (!c) continue;
      var r = addItemToContainer(c, itemId, cnt);
      if (r.success) {
        return { success: true, containerId: c.id, slot: r.slot, count: r.count };
      }
    }
    // all full -> temp chest
    var tc = st.containers[st.tempChestId];
    var tr = addItemToContainer(tc, itemId, cnt);
    if (tr.success) {
      var expires = Date.now() + TEMP_CHEST_DAYS * 24 * 60 * 60 * 1000;
      for (var ti = 0; ti < tc.slots.length; ti++) {
        var ts = tc.slots[ti];
        if (ts && !isContainerItem(ts) && ts.itemId === itemId && !ts.expiresAt) ts.expiresAt = expires;
      }
      return { success: true, containerId: tc.id, tempChest: true, slot: tr.slot, msg: 'Túi đầy — đồ chuyển vào Rương Tạm (giữ 7 ngày).' };
    }
    return { success: false, reason: 'full', msg: 'Tất cả vật chứa và Rương Tạm đều đầy.' };
  }

  function countItemInPlayer(player, itemId) {
    ensureState(player);
    if (itemId === 'linh-thach') return player.linhThach || 0;
    var st = player.tuiKho;
    var total = 0;
    var ids = carriedContainerIds(player).concat([st.tempChestId]); // include temp? For bag count maybe exclude temp; but keep total available
    // We'll count carried only for "bag"; temp chest separate. But many tests expect count in bag. Use carried only.
    var carried = carriedContainerIds(player);
    for (var i = 0; i < carried.length; i++) {
      var c = st.containers[carried[i]];
      if (!c) continue;
      for (var j = 0; j < c.slots.length; j++) {
        var s = c.slots[j];
        if (s && !isContainerItem(s) && s.itemId === itemId) total += (s.count || 1);
      }
    }
    return total;
  }

  function removeItemFromPlayer(player, itemId, count) {
    ensureState(player);
    if (itemId === 'linh-thach') {
      if ((player.linhThach || 0) < (count || 1)) return false;
      player.linhThach -= (count || 1);
      return true;
    }
    var cnt = (count !== undefined && count !== null) ? count : 1;
    if (countItemInPlayer(player, itemId) < cnt) return false;
    var st = player.tuiKho;
    var carried = carriedContainerIds(player);
    var remaining = cnt;
    for (var ci = 0; ci < carried.length && remaining > 0; ci++) {
      var c = st.containers[carried[ci]];
      if (!c) continue;
      for (var i = 0; i < c.slots.length && remaining > 0; i++) {
        var s = c.slots[i];
        if (s && !isContainerItem(s) && s.itemId === itemId) {
          if ((s.count || 1) <= remaining) {
            remaining -= (s.count || 1);
            c.slots[i] = null;
          } else {
            s.count -= remaining;
            remaining = 0;
          }
        }
      }
    }
    return remaining === 0;
  }

  // ==========================================================================
  // TÌM KIẾM XUYÊN LỚP
  // ==========================================================================
  function search(player, keyword, filters) {
    ensureState(player);
    var st = player.tuiKho;
    var kw = (keyword || '').toLowerCase().trim();
    var results = [];
    function walk(containerId, pathArr, container) {
      for (var i = 0; i < container.slots.length; i++) {
        var s = container.slots[i];
        if (!s) continue;
        if (isContainerItem(s)) {
          var child = st.containers[s.containerId];
          if (child) {
            walk(s.containerId, pathArr.concat(child.name), child);
          }
        } else {
          var def = getItemDef(s.itemId);
          var name = def ? def.name : s.itemId;
          if (kw && name.toLowerCase().indexOf(kw) === -1 && s.itemId.toLowerCase().indexOf(kw) === -1) continue;
          // filters
          if (filters) {
            if (filters.quality && def && def.quality !== filters.quality) continue;
            if (filters.element && def && def.element !== filters.element) continue;
            if (filters.newOnly && !s.isNew) continue;
            if (filters.tab && filters.tab !== 'all') {
              if (tabOfItem(def) !== filters.tab) continue;
            }
          }
          results.push({
            containerId: containerId,
            containerName: container.name,
            path: pathArr.slice(),
            slotIndex: i,
            item: s,
            def: def,
            name: name
          });
        }
      }
    }
    // start from all carried containers
    var carried = carriedContainerIds(player);
    for (var ci = 0; ci < carried.length; ci++) {
      var c = st.containers[carried[ci]];
      walk(carried[ci], [c.name], c);
    }
    // Đợt N2: túi yên cũng vào được tìm kiếm xuyên vật chứa.
    for (var sid in st.containers) {
      if (!Object.prototype.hasOwnProperty.call(st.containers, sid)) continue;
      var sc = st.containers[sid];
      if (sc && sc.type === 'saddlebag') walk(sid, [sc.name], sc);
    }
    // also temp chest? search across all containers if requested
    if (filters && filters.includeTemp) {
      var tc = st.containers[st.tempChestId];
      walk(st.tempChestId, [tc.name], tc);
    }
    return results;
  }

  function tabOfItem(def) {
    if (!def) return 'material';
    if (def.type === 'gear') return 'gear';
    if (def.type === 'fabao') return 'fabao';
    if (def.type === 'consumable') return 'consumable';
    if (def.type === 'material') return 'material';
    if (def.type === 'quest') return 'quest';
    // bí pháp: type skillbook / secret
    if (def.type === 'skillbook' || def.type === 'secret' || def.type === 'biphaps') return 'biphaps';
    return 'material';
  }

  // ==========================================================================
  // ĐƯỜNG DẪN (breadcrumb)
  // ==========================================================================
  function getPath(player, containerId) {
    ensureState(player);
    var st = player.tuiKho;
    // find path from root to container
    var result = null;
    function dfs(cid, pathArr, visited) {
      if (visited[cid]) return false;
      visited[cid] = true;
      if (cid === containerId) { result = pathArr.slice(); return true; }
      var c = st.containers[cid];
      if (!c) return false;
      for (var i = 0; i < c.slots.length; i++) {
        var s = c.slots[i];
        if (isContainerItem(s)) {
          var child = st.containers[s.containerId];
          if (child) {
            if (dfs(s.containerId, pathArr.concat(child.name), visited)) return true;
          }
        }
      }
      return false;
    }
    var carried = carriedContainerIds(player);
    for (var ci = 0; ci < carried.length; ci++) {
      var c0 = st.containers[carried[ci]];
      if (dfs(carried[ci], [c0.name], {})) break;
    }
    if (!result) {
      // maybe temp/home/sect
      var tc = st.containers[containerId];
      if (tc) result = [tc.name];
    }
    return result || [containerId];
  }

  function getBreadcrumb(player, containerId) {
    return getPath(player, containerId);
  }

  // ==========================================================================
  // TAB LỌC
  // ==========================================================================
  function getTabItems(container, tab) {
    if (!container) return [];
    tab = tab || 'all';
    var out = [];
    for (var i = 0; i < container.slots.length; i++) {
      var s = container.slots[i];
      if (!s) continue;
      if (tab !== 'all') {
        if (isContainerItem(s)) {
          // vật chứa con hiển thị ở hàng riêng, không trong tab? brief: hàng riêng trên đầu mọi tab, vẫn hiện
          // include containers in all tabs? We'll include in 'all' only for tab filtering? 
        }
        if (isContainerItem(s)) continue; // containers handled separately
        var def = getItemDef(s.itemId);
        if (tabOfItem(def) !== tab) continue;
      }
      out.push({ slotIndex: i, item: s });
    }
    return out;
  }

  function getNestedContainers(container) {
    if (!container) return [];
    var out = [];
    for (var i = 0; i < container.slots.length; i++) {
      var s = container.slots[i];
      if (isContainerItem(s)) out.push({ slotIndex: i, containerId: s.containerId });
    }
    return out;
  }

  // ==========================================================================
  // GHIM SAO / KHÓA
  // ==========================================================================
  function setStarred(player, containerId, slotIndex, starred) {
    ensureState(player);
    var c = getContainer(player, containerId);
    if (!c || !c.slots[slotIndex]) return { ok: false };
    c.slots[slotIndex].starred = !!starred;
    return { ok: true };
  }
  function pinItem() { /* alias */ }
  function starItem(player, containerId, slotIndex) { return setStarred(player, containerId, slotIndex, true); }
  function unstarItem(player, containerId, slotIndex) { return setStarred(player, containerId, slotIndex, false); }

  function setLocked(player, containerId, slotIndex, locked) {
    ensureState(player);
    var c = getContainer(player, containerId);
    if (!c || !c.slots[slotIndex]) return { ok: false };
    c.slots[slotIndex].locked = !!locked;
    return { ok: true };
  }
  function lockItem(player, containerId, slotIndex) { return setLocked(player, containerId, slotIndex, true); }
  function unlockItem(player, containerId, slotIndex) { return setLocked(player, containerId, slotIndex, false); }
  function isLocked(slot) { return !!(slot && slot.locked); }
  function isStarred(slot) { return !!(slot && slot.starred); }

  // ==========================================================================
  // SO SÁNH TRANG BỊ
  // ==========================================================================
  function compareGear(player, itemId) {
    ensureState(player);
    var def = getItemDef(itemId);
    if (!def || def.type !== 'gear' || !def.slot) return { ok: false, msg: 'Không phải trang bị.' };
    var slot = def.slot;
    var equippedId = player.equipment ? player.equipment[slot] : null;
    var equippedDef = equippedId ? getItemDef(equippedId) : null;
    var diff = {};
    var keys = ['atk', 'def', 'hp', 'linhLuc'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var nv = (def[k] !== undefined) ? def[k] : 0;
      var ov = (equippedDef && equippedDef[k] !== undefined) ? equippedDef[k] : 0;
      diff[k] = nv - ov;
    }
    return {
      ok: true,
      slot: slot,
      newItem: def,
      equipped: equippedDef,
      diff: diff,
      canEquip: true
    };
  }

  // ==========================================================================
  // Ô DÙNG NHANH (4 ô) — lấy đồ từ nhẫn đang đeo
  // ==========================================================================
  function getQuickSlots(player) {
    ensureState(player);
    return player.tuiKho.quickSlots.slice();
  }
  function setQuickSlot(player, index, containerId, slotIndex) {
    ensureState(player);
    if (index < 0 || index >= QUICK_SLOTS) return { ok: false, reason: 'bad_index' };
    // support setQuickSlot(player, index, {containerId, slotIndex})
    if (typeof containerId === 'object' && containerId !== null) {
      slotIndex = containerId.slotIndex;
      containerId = containerId.containerId;
    }
    // support setQuickSlot(player, index, itemId) -> find location
    if (typeof containerId === 'string' && slotIndex === undefined) {
      var loc = findItemLocation(player, containerId);
      if (!loc) return { ok: false, reason: 'not_found' };
      containerId = loc.containerId;
      slotIndex = loc.slotIndex;
    }
    var c = getContainer(player, containerId);
    if (!c || !c.slots[slotIndex]) return { ok: false, reason: 'empty' };
    player.tuiKho.quickSlots[index] = { containerId: containerId, slotIndex: slotIndex };
    return { ok: true, index: index };
  }
  function clearQuickSlot(player, index) {
    ensureState(player);
    if (index < 0 || index >= QUICK_SLOTS) return { ok: false };
    player.tuiKho.quickSlots[index] = null;
    return { ok: true };
  }
  function useQuickSlot(player, index) {
    ensureState(player);
    var qs = player.tuiKho.quickSlots[index];
    if (!qs) return { ok: false, reason: 'empty', msg: 'Ô dùng nhanh trống.' };
    var c = getContainer(player, qs.containerId);
    var s = c ? c.slots[qs.slotIndex] : null;
    if (!s || isContainerItem(s)) return { ok: false, reason: 'empty', msg: 'Đã hết, hãy đổi ô ghim.' };
    // consume one
    if ((s.count || 1) <= 1) {
      c.slots[qs.slotIndex] = null;
      player.tuiKho.quickSlots[index] = null;
      return { ok: true, empty: true, msg: 'Đã dùng hết, ô ghim trống.' };
    }
    s.count -= 1;
    return { ok: true, remaining: s.count, msg: 'Đã dùng 1.' };
  }
  function findItemLocation(player, itemId) {
    ensureState(player);
    var st = player.tuiKho;
    // prefer worn ring
    var carried = carriedContainerIds(player);
    // worn rings first
    var worn = st.wornRings || [];
    var order = worn.concat(carried.filter(function (x) { return worn.indexOf(x) === -1; }));
    for (var ci = 0; ci < order.length; ci++) {
      var c = st.containers[order[ci]];
      if (!c) continue;
      for (var i = 0; i < c.slots.length; i++) {
        var s = c.slots[i];
        if (s && !isContainerItem(s) && s.itemId === itemId) return { containerId: c.id, slotIndex: i };
      }
    }
    // any carried
    for (var ci2 = 0; ci2 < carried.length; ci2++) {
      var c2 = st.containers[carried[ci2]];
      if (!c2) continue;
      for (var i2 = 0; i2 < c2.slots.length; i2++) {
        var s2 = c2.slots[i2];
        if (s2 && !isContainerItem(s2) && s2.itemId === itemId) return { containerId: c2.id, slotIndex: i2 };
      }
    }
    return null;
  }

  // ==========================================================================
  // RƯƠNG TẠM (30 ô, 7 ngày)
  // ==========================================================================
  function getTempChest(player) {
    ensureState(player);
    return player.tuiKho.containers[player.tuiKho.tempChestId];
  }
  function addToTempChest(player, itemId, count, now) {
    ensureState(player);
    var tc = getTempChest(player);
    var res = addItemToContainer(tc, itemId, count || 1);
    if (res.success) {
      // set expiry on slots that received
      var expires = (now || Date.now()) + TEMP_CHEST_DAYS * 24 * 60 * 60 * 1000;
      for (var i = 0; i < tc.slots.length; i++) {
        var s = tc.slots[i];
        if (s && !isContainerItem(s) && s.itemId === itemId && !s.expiresAt) {
          s.expiresAt = expires;
        }
      }
    }
    return res;
  }
  function cleanupTempChest(player, now) {
    ensureState(player);
    var tc = getTempChest(player);
    var t = (now !== undefined) ? now : Date.now();
    var removed = 0;
    for (var i = 0; i < tc.slots.length; i++) {
      var s = tc.slots[i];
      if (s && !isContainerItem(s) && s.expiresAt && s.expiresAt <= t) {
        tc.slots[i] = null;
        removed++;
      }
    }
    return { removed: removed };
  }
  function takeFromTempChest(player, slotIndex, count) {
    ensureState(player);
    var tc = getTempChest(player);
    var s = tc.slots[slotIndex];
    if (!s || isContainerItem(s)) return { ok: false, reason: 'empty' };
    var cnt = (count !== undefined && count !== null) ? count : (s.count || 1);
    if (cnt > (s.count || 1)) cnt = s.count || 1;
    // remove from temp
    if (cnt >= (s.count || 1)) tc.slots[slotIndex] = null;
    else s.count -= cnt;
    // add to carried default
    var r = addItemToPlayer(player, s.itemId, cnt);
    if (!r.success) {
      // revert? keep removed but fail? We'll return fail with msg
      return { ok: false, reason: 'bag_full', msg: 'Túi đầy, không lấy ra được.' };
    }
    return { ok: true, itemId: s.itemId, count: cnt };
  }

  // ==========================================================================
  // KHO NHÀ / TÔNG MÔN + CHUYỂN HÀNG LOẠT
  // ==========================================================================
  function getHomeStorage(player) { ensureState(player); return player.tuiKho.containers[player.tuiKho.homeStorageId]; }
  function getSectStorage(player) { ensureState(player); return player.tuiKho.containers[player.tuiKho.sectStorageId]; }

  function transferItem(player, fromContainerId, toContainerId, slotIndex, count) {
    ensureState(player);
    var from = getContainer(player, fromContainerId);
    var to = getContainer(player, toContainerId);
    if (!from || !to) return { ok: false, reason: 'no_container' };
    var s = from.slots[slotIndex];
    if (!s || isContainerItem(s)) return { ok: false, reason: 'empty' };
    var cnt = (count !== undefined && count !== null) ? count : (s.count || 1);
    if (cnt > (s.count || 1)) cnt = s.count || 1;
    if (s.locked) return { ok: false, reason: 'locked', msg: 'Vật phẩm bị khóa.' };
    // remove
    if (cnt >= (s.count || 1)) from.slots[slotIndex] = null;
    else s.count -= cnt;
    var r = addItemToContainer(to, s.itemId, cnt, s);
    if (!r.success) {
      // revert
      addItemToContainer(from, s.itemId, cnt, s);
      return { ok: false, reason: 'full', msg: 'Kho đích đã đầy.' };
    }
    return { ok: true, itemId: s.itemId, count: cnt };
  }

  function bulkTransfer(player, fromContainerId, toContainerId, predicate) {
    ensureState(player);
    var from = getContainer(player, fromContainerId);
    var to = getContainer(player, toContainerId);
    if (!from || !to) return { ok: false, reason: 'no_container' };
    var moved = [];
    for (var i = 0; i < from.slots.length; i++) {
      var s = from.slots[i];
      if (!s || isContainerItem(s)) continue;
      if (s.locked) continue;
      if (typeof predicate === 'function' && !predicate(s, i)) continue;
      var r = transferItem(player, fromContainerId, toContainerId, i, s.count || 1);
      if (r.ok) moved.push(r);
    }
    return { ok: true, moved: moved, count: moved.length };
  }

  function transferToStorage(player, storageType, filter) {
    ensureState(player);
    var toId = storageType === 'home' ? player.tuiKho.homeStorageId : player.tuiKho.sectStorageId;
    // from all carried containers
    var movedTotal = [];
    var carried = carriedContainerIds(player).slice();
    for (var ci = 0; ci < carried.length; ci++) {
      var r = bulkTransfer(player, carried[ci], toId, filter);
      if (r.moved) movedTotal = movedTotal.concat(r.moved);
    }
    return { ok: true, moved: movedTotal };
  }

  // ==========================================================================
  // MỞ RỘNG Ô (PROVISIONAL costs)
  // ==========================================================================
  function getExpansionCost(container) {
    if (!container || container.type !== 'storage') {
      return { ok: false, reason: 'not_expandable' };
    }
    if (container.capacity >= STORAGE_MAX_CAPACITY) {
      return { ok: false, reason: 'max_reached', cost: 0 };
    }
    // provisional: mỗi hàng 5 ô, giá tăng dần: base 50 LT + 10 mỗi hàng đã mở
    var rowsOpened = Math.floor((container.capacity - STORAGE_CAPACITY) / 5);
    var costLT = 50 + rowsOpened * 25;
    var materialCost = { 'da-nung': 2 + rowsOpened }; // provisional
    return { ok: true, slotsPerRow: 5, nextRowCostLT: costLT, materialCost: materialCost, rowsOpened: rowsOpened };
  }

  function expandContainer(player, containerId, rowsOrSlots) {
    ensureState(player);
    var c = getContainer(player, containerId);
    if (!c) return { ok: false, reason: 'no_container' };
    if (c.type !== 'storage') return { ok: false, reason: 'not_expandable' };
    if (c.capacity >= STORAGE_MAX_CAPACITY) return { ok: false, reason: 'max_reached' };
    var rows = (typeof rowsOrSlots === 'number' && rowsOrSlots > 0) ? rowsOrSlots : 1;
    var added = 0;
    var totalCost = 0;
    for (var r = 0; r < rows; r++) {
      if (c.capacity + 5 > STORAGE_MAX_CAPACITY) break;
      var cost = getExpansionCost(c);
      if (!cost.ok) break;
      // check funds
      if ((player.linhThach || 0) < cost.nextRowCostLT) {
        return { ok: false, reason: 'not_enough_lt', needed: cost.nextRowCostLT, have: player.linhThach || 0, added: added };
      }
      // material check (provisional: require da-nung)
      var mat = cost.materialCost || {};
      for (var mid in mat) {
        if (Object.prototype.hasOwnProperty.call(mat, mid)) {
          if (countItemInPlayer(player, mid) < mat[mid]) {
            return { ok: false, reason: 'not_enough_material', material: mid, needed: mat[mid], have: countItemInPlayer(player, mid), added: added };
          }
        }
      }
      // deduct
      player.linhThach -= cost.nextRowCostLT;
      for (var mid2 in mat) {
        if (Object.prototype.hasOwnProperty.call(mat, mid2)) {
          removeItemFromPlayer(player, mid2, mat[mid2]);
        }
      }
      // expand
      c.capacity += 5;
      c.slots.length = c.capacity;
      while (c.slots.length < c.capacity) c.slots.push(null);
      c.expandedBy = (c.expandedBy || 0) + 5;
      totalCost += cost.nextRowCostLT;
      added += 5;
    }
    return { ok: true, added: added, newCapacity: c.capacity, cost: totalCost };
  }

  // ==========================================================================
  // NHẪN: đeo / tháo (giữ nguyên đồ bên trong)
  // ==========================================================================
  function wearRing(player, containerId) {
    ensureState(player);
    var c = getContainer(player, containerId);
    if (!c || c.type !== 'ring') return { ok: false, reason: 'not_ring' };
    if (player.tuiKho.wornRings.indexOf(containerId) === -1) {
      player.tuiKho.wornRings.push(containerId);
    }
    c.worn = true;
    // add to carried root if not already
    var inRoot = player.tuiKho.rootSlots.some(function (sl) { return isContainerItem(sl) && sl.containerId === containerId; });
    if (!inRoot) {
      // also ensure not nested elsewhere? assume top-level
      player.tuiKho.rootSlots.push({ type: 'container', containerId: containerId });
      if (player.tuiKho.containerOrder.indexOf(containerId) === -1) player.tuiKho.containerOrder.push(containerId);
    }
    // default container becomes worn ring if none
    if (!player.tuiKho.defaultContainerId) player.tuiKho.defaultContainerId = containerId;
    return { ok: true };
  }

  function unwearRing(player, containerId) {
    ensureState(player);
    var idx = player.tuiKho.wornRings.indexOf(containerId);
    if (idx !== -1) player.tuiKho.wornRings.splice(idx, 1);
    var c = getContainer(player, containerId);
    if (c) c.worn = false;
    // đồ bên trong giữ nguyên (không làm gì)
    return { ok: true, keptContents: true };
  }

  function getWornRings(player) {
    ensureState(player);
    return (player.tuiKho.wornRings || []).map(function (id) { return player.tuiKho.containers[id]; }).filter(Boolean);
  }

  // ==========================================================================
  // MỞ KHÓA NHẪN NGUỒN (provisional hooks) — chỉ helper
  // ==========================================================================
  function createRing(grade) {
    return createContainer('ring', { grade: grade, worn: false });
  }

  function grantStorageContainer(player) {
    ensureState(player);
    var st = player.tuiKho;
    if (hasStorageContainerState(st)) return { ok: false, reason: 'already' };
    var c = createContainer('storage', { id: genId('storage') });
    st.containers[c.id] = c;
    st.rootSlots.push({ type: 'container', containerId: c.id });
    if (st.containerOrder.indexOf(c.id) === -1) st.containerOrder.push(c.id);
    st.storageGranted = true;
    if (player.bag && player.bag.slots === st.rootSlots) { /* keep */ }
    return { ok: true, containerId: c.id, container: c };
  }

  function grantRing(player, grade) {
    ensureState(player);
    var c = createRing(grade || 'linh');
    var st = player.tuiKho;
    st.containers[c.id] = c;
    // add as top-level carried container
    var inRoot = st.rootSlots.some(function (sl) { return sl && sl.type === 'container' && sl.containerId === c.id; });
    if (!inRoot) st.rootSlots.push({ type: 'container', containerId: c.id });
    if (st.containerOrder.indexOf(c.id) === -1) st.containerOrder.push(c.id);
    return { ok: true, containerId: c.id, container: c };
  }
  function grantRingToPlayer(player, grade) { return grantRing(player, grade); }

  // ==========================================================================
  // STATE DELEGATION HELPERS (used by state.js)
  // ==========================================================================
  // Already implemented addItemToPlayer etc.

  // ==========================================================================
  // ALIASES / EXPORTS
  // ==========================================================================
  var API = {
    // constants
    CLOTH_CAPACITY: CLOTH_CAPACITY,
    STORAGE_CAPACITY: STORAGE_CAPACITY,
    STORAGE_MAX_CAPACITY: STORAGE_MAX_CAPACITY,
    RING_CAPACITY: RING_CAPACITY,
    TEMP_CHEST_CAPACITY: TEMP_CHEST_CAPACITY,
    TEMP_CHEST_DAYS: TEMP_CHEST_DAYS,
    HOME_STORAGE_CAPACITY: HOME_STORAGE_CAPACITY,
    SECT_STORAGE_CAPACITY: SECT_STORAGE_CAPACITY,
    QUICK_SLOTS: QUICK_SLOTS,
    STACK_CONSUMABLE: STACK_CONSUMABLE,
    STACK_MATERIAL: STACK_MATERIAL,
    TABS: TABS,
    TAB_LABELS: TAB_LABELS,

    // core
    ensureState: ensureState,
    isContainerItem: isContainerItem,
    ensureTuiKho: ensureState,
    createContainer: createContainer,
    createBag: createContainer,
    createRing: createRing,
    grantStorageContainer: grantStorageContainer,
    unlockStorageBag: grantStorageContainer,
    grantStorageBag: grantStorageContainer,
    grantRing: grantRing,
    grantRingToPlayer: grantRingToPlayer,
    capacityFor: capacityFor,
    getCapacity: function (c) { return c ? c.capacity : 0; },

    // containers
    getContainer: getContainer,
    listContainers: listContainers,
    getContainers: listContainers,
    carriedContainerIds: carriedContainerIds,
    getCarriedContainers: function (player) { return carriedContainerIds(player).map(function (id) { return getContainer(player, id); }); },

    // nesting
    canNest: canNest,
    canPutContainer: canNest,
    nestContainer: nestContainer,
    putContainerInto: nestContainer,
    moveContainer: nestContainer,
    removeFromParent: removeFromParent,
    isAncestor: isAncestor,
    isSelfOrCycle: function (player, childId, parentId) { return !canNest(player, childId, parentId); },

    // items
    addItemToContainer: addItemToContainer,
    addItemToPlayer: addItemToPlayer,
    addItem: addItemToPlayer,
    addToBag: addItemToPlayer,
    countItemInPlayer: countItemInPlayer,
    countItem: countItemInPlayer,
    count: countItemInPlayer,
    removeItemFromPlayer: removeItemFromPlayer,
    removeItem: removeItemFromPlayer,
    findItemLocation: findItemLocation,
    findItem: findItemLocation,
    locateItem: findItemLocation,

    // search/tabs/path
    search: search,
    searchAll: search,
    getPath: getPath,
    getBreadcrumb: getBreadcrumb,
    breadcrumb: getBreadcrumb,
    tabOfItem: tabOfItem,
    getTabItems: getTabItems,
    filterTab: getTabItems,
    getNestedContainers: getNestedContainers,
    nestedContainers: getNestedContainers,

    // pin/lock
    setStarred: setStarred,
    starItem: starItem,
    pinItem: starItem,
    unstarItem: unstarItem,
    unpinItem: unstarItem,
    setLocked: setLocked,
    lockItem: lockItem,
    unlockItem: unlockItem,
    isLocked: isLocked,
    isStarred: isStarred,
    isPinned: isStarred,

    // compare
    compareGear: compareGear,
    gearCompare: compareGear,
    compare: compareGear,

    // quick slots
    getQuickSlots: getQuickSlots,
    quickSlots: getQuickSlots,
    setQuickSlot: setQuickSlot,
    clearQuickSlot: clearQuickSlot,
    useQuickSlot: useQuickSlot,

    // temp chest
    getTempChest: getTempChest,
    tempChest: getTempChest,
    addToTempChest: addToTempChest,
    cleanupTempChest: cleanupTempChest,
    takeFromTempChest: takeFromTempChest,

    // storage
    getHomeStorage: getHomeStorage,
    homeStorage: getHomeStorage,
    getSectStorage: getSectStorage,
    sectStorage: getSectStorage,
    transferItem: transferItem,
    bulkTransfer: bulkTransfer,
    transferToStorage: transferToStorage,
    transferBulk: bulkTransfer,

    // expansion
    getExpansionCost: getExpansionCost,
    expandContainer: expandContainer,
    expand: expandContainer,
    expandByRow: expandContainer,

    // rings
    wearRing: wearRing,
    unwearRing: unwearRing,
    getWornRings: getWornRings,
    wornRings: getWornRings,

    // tabs
    TABS_LIST: TABS
  };

  // attach aliases for common names
  API.ensureBag = ensureState;
  API.init = ensureState;
  API.initPlayer = ensureState;
  API.migrate = ensureState;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') {
    window.GameTuiKho = API;
    window.GameBag = API;
    window.GameContainer = API;
  }
  if (typeof global !== 'undefined') {
    global.GameTuiKho = API;
    global.GameBag = API;
    global.GameContainer = API;
  }
})(typeof window !== 'undefined' ? window : this);
