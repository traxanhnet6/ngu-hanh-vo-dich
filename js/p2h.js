/**
 * Đợt P2H — KHO BÁU TÀN ĐỒ (P2-DESIGN §9; hồ sơ 15§6)
 *
 * Nội dung:
 *   1. Tàn đồ: vật phẩm mới (mảnh) rơi RẤT NHỎ khi hạ quái + mở rương.
 *      Rơi qua đường CỘNG THÊM sau rơi đồ — KHÔNG sửa `rollDrops`.
 *   2. Ghép đủ số mảnh -> một bản đồ kho báu chỉ MỘT vị trí đào ở MỘT vùng.
 *   3. Chỉ đường: mượn mũi tên dẫn đường hiện có (getQuestTargetInfo +
 *      startAutoPathTo), chỉ tới VÙNG; tới vùng rồi tự tìm điểm đào.
 *   4. Đào bằng tương tác tại điểm (móc interactables của mapdata.js).
 *   5. Kho báu cho Linh Thạch + nguyên liệu + tỉ lệ nhỏ bản vẽ/hạt giống.
 *
 * MỌI số/tên dưới đây là PROVISIONAL — đợt P2H đề xuất, chờ Bui chốt.
 * Mọi số gom trong MỘT bảng P2H_CONST để Bui đổi số không phải sửa logic.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ (PROVISIONAL — chờ Bui phán)
  // ==========================================================================
  var P2H_CONST = {
    // Tên tạm: "Tàn Đồ" / "Bản Đồ Kho Báu" — chờ Bui chốt tên.
    FRAGMENT_ITEM: 'tan-do',
    MAP_ITEM: 'ban-do-kho-bau',
    FRAGMENTS_NEEDED: 5,          // số mảnh ghép thành 1 bản đồ

    DROP_CHANCE_KILL: 0.006,      // 0,6%/lần hạ quái (rất nhỏ)
    DROP_CHANCE_CHEST: 0.08,      // 8%/lần mở rương

    DIG_RADIUS: 42,               // bán kính tương tác điểm đào
    DIG_HINT_RADIUS: 220,         // trong bán kính này mới hiện chip "Điểm đào"

    // Vị trí đào + điểm dẫn vùng: PROVISIONAL, đã kiểm isWalkable của mapdata.
    // guideX/guideY là điểm ĐẦU VÙNG cho mũi tên (không phải điểm đào).
    ZONES: [
      { mapId: 'rung-doc',  name: 'Rừng Độc Thanh Tụy',  x: 1170, y: 780, guideX: 700,  guideY: 760 },
      { mapId: 'ho-bang',   name: 'Hồ Băng Hàn Kính',     x: 1220, y: 640, guideX: 700,  guideY: 760 },
      { mapId: 'mo-lua',    name: 'Mỏ Lửa Xích Diệm',     x: 980,  y: 700, guideX: 1600, guideY: 1000 },
      { mapId: 'hoang-mac', name: 'Hoang Mạc Hoàng Sa',   x: 1020, y: 560, guideX: 500,  guideY: 900 },
      { mapId: 'kiem-trung',name: 'Kiếm Trủng Huyền Thiết', x: 1120, y: 660, guideX: 600, guideY: 900 }
    ],

    // Thưởng kho báu — chỉ dùng vật phẩm ĐÃ CÓ trong ITEM_DEFS.
    LINH_THACH_MIN: 60,
    LINH_THACH_MAX: 120,
    MAT_MIN: 2,
    MAT_MAX: 4,
    CHANCE_RARE_MAT: 0.06,        // nguyên tinh của vùng
    CHANCE_SEED: 0.04,            // hạt giống quý đang có trong game
    CHANCE_BLUEPRINT: 0.03,       // bản vẽ (chưa có vật phẩm "bí tịch" trong ITEM_DEFS)
    ZONE_MATERIALS: {
      'rung-doc': ['la-thanh-tuy', 'to-nhen-xanh', 'linh-chi-rung', 'tim-go-co-thu', 'nhua-cay-ngan-nam'],
      'ho-bang': ['bang-tinh', 'ngoc-bang-tam', 'bang-tuy', 'tuyet-lien', 'ngoc-trai-ho'],
      'mo-lua': ['quang-do', 'luu-huynh-vang', 'tam-lo-nguoi', 'hoa-tinh-tho', 'da-nung'],
      'hoang-mac': ['cat-tinh', 'ngoc-cat-tam', 'xuong-linh-thao', 'dia-tam-thach', 'nuoc-oc-dao-tinh-khiet'],
      'kiem-trung': ['manh-kiem-gay', 'hon-kiem-nho', 'loi-huyen-thiet', 'sat-huyen-vun', 'huyen-thiet-khoi']
    },
    ZONE_RARE_MAT: {
      'rung-doc': 'linh-chi-ngan-nam',
      'ho-bang': 'nguyen-tinh-thuy',
      'mo-lua': 'nguyen-tinh-hoa',
      'hoang-mac': 'nguyen-tinh-tho',
      'kiem-trung': 'nguyen-tinh-kim'
    },
    BLUEPRINTS: [
      'bp_kiem_thanh_bo', 'bp_ao_thanh_bo', 'bp_giay_thanh_bo',
      'bp_dai_thanh_bo', 'bp_phap_khi_dong', 'bp_kiem_truc_van', 'bp_giap_truc_van'
    ],
    // Hạt giống duy nhất đang có trong ITEM_DEFS là Hạt Giống Linh Mễ.
    SEED_ITEM: 'hat-giong-linh-me'
  };

  // ==========================================================================
  // TIỆN ÍCH
  // ==========================================================================
  function getEngine() {
    return (typeof window !== 'undefined' && window.GameEngine) ? window.GameEngine : null;
  }
  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }
  function getItemDefs() {
    if (typeof window !== 'undefined' && window.GameMonsters && window.GameMonsters.ITEM_DEFS) {
      return window.GameMonsters.ITEM_DEFS;
    }
    if (typeof global !== 'undefined' && global.GameMonsters && global.GameMonsters.ITEM_DEFS) {
      return global.GameMonsters.ITEM_DEFS;
    }
    try { return require('./monsters.js').ITEM_DEFS; } catch (e) { return {}; }
  }
  function getPlayer() {
    var eng = getEngine();
    return eng && eng.getPlayer ? eng.getPlayer() : null;
  }
  function getCurrentMapId() {
    var eng = getEngine();
    return (eng && eng.getCurrentMapId) ? eng.getCurrentMapId() : null;
  }
  function toast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast(msg);
    }
  }
  function save(player) {
    var st = getStateAPI();
    if (st && st.savePlayer && player) st.savePlayer(player);
  }
  function itemName(itemId) {
    var defs = getItemDefs();
    return (defs && defs[itemId] && defs[itemId].name) ? defs[itemId].name : itemId;
  }
  function randi(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function ensureState(player) {
    if (!player || typeof player !== 'object') return null;
    if (!player.p2h || typeof player.p2h !== 'object') {
      player.p2h = { maps: [], tracking: false, digs: 0, fragsLifetime: 0 };
    }
    if (!Array.isArray(player.p2h.maps)) player.p2h.maps = [];
    if (typeof player.p2h.tracking !== 'boolean') player.p2h.tracking = false;
    if (typeof player.p2h.digs !== 'number') player.p2h.digs = 0;
    if (typeof player.p2h.fragsLifetime !== 'number') player.p2h.fragsLifetime = 0;
    return player.p2h;
  }

  function fragmentCount(player) {
    var st = getStateAPI();
    if (!st || !st.countItemInBag || !player) return 0;
    return st.countItemInBag(player, P2H_CONST.FRAGMENT_ITEM) || 0;
  }

  function zoneById(mapId) {
    for (var i = 0; i < P2H_CONST.ZONES.length; i++) {
      if (P2H_CONST.ZONES[i].mapId === mapId) return P2H_CONST.ZONES[i];
    }
    return null;
  }

  function getActiveMap(player) {
    var s = ensureState(player);
    if (!s || s.maps.length === 0) return null;
    return s.maps[0];
  }

  // ==========================================================================
  // 1. RƠI TÀN ĐỒ — ĐƯỜNG CỘNG THÊM (không đụng rollDrops)
  // ==========================================================================
  /**
   * Gọi từ engine SAU vòng rơi đồ thường. Trả {itemId,count} để engine thả
   * xuống đất như mọi món rơi khác, hoặc null.
   * Không áp cho quái leo tháp (P2C có thưởng riêng) — PROVISIONAL.
   */
  function rollKillDrop(player, m) {
    if (!player || !m || m.towerTag) return null;
    ensureState(player);
    if (Math.random() >= P2H_CONST.DROP_CHANCE_KILL) return null;
    player.p2h.fragsLifetime += 1;
    return { itemId: P2H_CONST.FRAGMENT_ITEM, count: 1 };
  }

  /**
   * Gọi từ chỗ mở rương đang chạy thật trong game (hoat-dong.js claimChest).
   * Rương cho thẳng vào túi (không thả đất).
   */
  function onChestOpened(player, chestName) {
    player = player || getPlayer();
    if (!player) return { ok: false, reason: 'no_player' };
    var s = ensureState(player);
    if (Math.random() >= P2H_CONST.DROP_CHANCE_CHEST) {
      return { ok: true, dropped: false };
    }
    var st = getStateAPI();
    var add = st && st.addItemToBag
      ? st.addItemToBag(player, P2H_CONST.FRAGMENT_ITEM, 1, getItemDefs())
      : { success: false };
    if (!add || add.success === false) {
      toast('Mảnh tàn đồ trong rương rơi mất — túi đồ đã đầy.');
      return { ok: false, reason: 'bag_full' };
    }
    s.fragsLifetime += 1;
    save(player);
    // Sửa P2H-VERIFY-1: túi chính đầy thì mảnh tràn sang Rương Tạm
    // (add.tempChest) — countItemInBag không đếm Rương Tạm nên mảnh đó
    // không ghép được; phải báo đúng sự thật, không báo "nhận được".
    if (add.tempChest) {
      toast('Mảnh tàn đồ trong ' + (chestName || 'rương') + ' vào Rương Tạm — túi đồ đã đầy.');
      return { ok: true, dropped: true, tempChest: true };
    }
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast('Trong ' + (chestName || 'rương') + ' có một mảnh tàn đồ!');
    }
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.spawnFloatingText && player) {
      window.GameEngine.spawnFloatingText('+' + 1 + ' Tàn Đồ', player.x, player.y - 55, '#e8c56b');
    }
    return { ok: true, dropped: true };
  }

  // ==========================================================================
  // 2. GHÉP TÀN ĐỒ
  // ==========================================================================
  function canCombine(player) {
    player = player || getPlayer();
    if (!player) return false;
    var s = ensureState(player);
    if (s.maps.length > 0) return false;                    // mỗi lúc chỉ 1 bản đồ
    return fragmentCount(player) >= P2H_CONST.FRAGMENTS_NEEDED;
  }

  function combine(player) {
    player = player || getPlayer();
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var s = ensureState(player);
    if (s.maps.length > 0) {
      return { ok: false, msg: 'Đang giữ một bản đồ kho báu chưa đào — đào xong mới ghép tiếp.' };
    }
    var have = fragmentCount(player);
    if (have < P2H_CONST.FRAGMENTS_NEEDED) {
      return { ok: false, msg: 'Chưa đủ mảnh tàn đồ (' + have + '/' + P2H_CONST.FRAGMENTS_NEEDED + ').' };
    }
    var st = getStateAPI();
    if (!st || !st.removeItemFromBag) return { ok: false, msg: 'Túi đồ chưa sẵn sàng.' };
    st.removeItemFromBag(player, P2H_CONST.FRAGMENT_ITEM, P2H_CONST.FRAGMENTS_NEEDED);

    var zone = pick(P2H_CONST.ZONES);
    var map = {
      mapId: zone.mapId,
      zoneName: zone.name,
      x: zone.x,
      y: zone.y,
      guideX: zone.guideX,
      guideY: zone.guideY,
      madeAt: Date.now()
    };
    s.maps.push(map);
    s.tracking = false;
    // Sửa P2H-VERIFY-1: kiểm tra kết quả thêm vật phẩm bản đồ — túi chính
    // đầy thì vật phẩm tràn sang Rương Tạm (tempChest), phải báo đúng.
    var mapAdd = (st && st.addItemToBag)
      ? st.addItemToBag(player, P2H_CONST.MAP_ITEM, 1, getItemDefs())
      : { success: false };
    save(player);
    if (mapAdd && mapAdd.tempChest) {
      toast('Ghép đủ tàn đồ — bản đồ chỉ tới ' + zone.name + '. Vật phẩm bản đồ vào Rương Tạm (túi đầy).');
    } else if (!mapAdd || mapAdd.success === false) {
      toast('Ghép đủ tàn đồ — bản đồ chỉ tới ' + zone.name + '. Vật phẩm bản đồ không vào được túi (túi đầy).');
    } else {
      toast('Ghép đủ tàn đồ — bản đồ chỉ tới ' + zone.name + '. Mở bảng Tàn Đồ để xem.');
    }
    renderIfOpen(player);
    return { ok: true, map: map, tempChest: !!(mapAdd && mapAdd.tempChest) };
  }

  // ==========================================================================
  // 3. CHỈ ĐƯỜNG (mượn mũi tên + Tự Tìm Đường hiện có)
  // ==========================================================================
  /**
   * Móc vào chuỗi ưu tiên getQuestTargetInfo của engine. Chỉ trả mục tiêu khi
   * người chơi ĐÃ BẤM "Chỉ đường" (cùng kiểu T1/T2/T3), và chỉ khi CHƯA tới
   * vùng đào — tới nơi thì mũi tên tắt, người chơi tự tìm điểm đào trên map.
   */
  function getTrackedTargetInfo(pl) {
    var player = pl || getPlayer();
    if (!player) return null;
    var s = ensureState(player);
    if (!s.tracking) return null;
    var map = getActiveMap(player);
    if (!map) return null;
    if (getCurrentMapId() === map.mapId) return null;   // đã tới vùng
    return {
      stepId: 'p2h_treasure',
      mapId: map.mapId,
      kind: 'point',
      x: map.guideX,
      y: map.guideY,
      radius: 60,
      title: 'Bản đồ kho báu',
      desc: 'Đi tới ' + map.zoneName + ' rồi tự tìm điểm đào.'
    };
  }

  function startGuidance(player) {
    player = player || getPlayer();
    if (!player) return false;
    var s = ensureState(player);
    var map = getActiveMap(player);
    if (!map) { toast('Chưa có bản đồ kho báu — ghép đủ tàn đồ trước.'); return false; }
    var eng = getEngine();
    if (getCurrentMapId() === map.mapId) {
      // Đang đứng ngay trong vùng: không ghim mũi tên nữa, chỉ nhắc tự tìm.
      s.tracking = false;
      save(player);
      toast('Đang ở ' + map.zoneName + ' — hãy tự tìm điểm đào quanh đây.');
      renderIfOpen(player);
      return true;
    }
    s.tracking = true;
    save(player);
    if (eng && eng.startAutoQuestPath) {
      eng.startAutoQuestPath(false);
    }
    toast('Đã ghim ' + map.zoneName + ' — đi theo mũi tên dẫn đường.');
    renderIfOpen(player);
    return true;
  }

  function stopGuidance(player) {
    player = player || getPlayer();
    if (!player) return;
    var s = ensureState(player);
    s.tracking = false;
    save(player);
    var eng = getEngine();
    if (eng && eng.cancelAutoPath) eng.cancelAutoPath(true);
    toast('Đã tắt dẫn đường kho báu.');
    renderIfOpen(player);
  }

  /** Điểm đào đang hiệu lực trên một map (engine vẽ + tương tác dùng). */
  function getDigSpotForMap(mapId) {
    var player = getPlayer();
    if (!player) return null;
    var map = getActiveMap(player);
    if (!map || map.mapId !== mapId) return null;
    return { x: map.x, y: map.y, zoneName: map.zoneName };
  }

  // ==========================================================================
  // 4. ĐÀO KHO BÁU
  // ==========================================================================
  function grantRewards(player, map) {
    var st = getStateAPI();
    var defs = getItemDefs();
    var granted = [];
    var failed = [];
    var tempChest = [];
    // Sửa P2H-VERIFY-1: đồ tràn Rương Tạm (res.tempChest) tách khỏi danh
    // sách "nhận được" — countItemInBag không đếm Rương Tạm.
    function record(res, grantedLabel, failedLabel) {
      if (res && res.success !== false) {
        if (res.tempChest) tempChest.push(grantedLabel);
        else granted.push(grantedLabel);
      } else failed.push(failedLabel);
    }

    var lt = randi(P2H_CONST.LINH_THACH_MIN, P2H_CONST.LINH_THACH_MAX);
    player.linhThach = (player.linhThach || 0) + lt;
    granted.push('+' + lt + ' ' + itemName('linh-thach'));

    var mats = P2H_CONST.ZONE_MATERIALS[map.mapId] || [];
    var n = randi(P2H_CONST.MAT_MIN, P2H_CONST.MAT_MAX);
    for (var i = 0; i < n; i++) {
      var matId = pick(mats);
      var cnt = randi(1, 3);
      var r = st && st.addItemToBag ? st.addItemToBag(player, matId, cnt, defs) : { success: false };
      record(r, '+' + cnt + ' ' + itemName(matId), itemName(matId));
    }

    if (Math.random() < P2H_CONST.CHANCE_RARE_MAT) {
      var rare = P2H_CONST.ZONE_RARE_MAT[map.mapId];
      if (rare) {
        var rr = st && st.addItemToBag ? st.addItemToBag(player, rare, 1, defs) : { success: false };
        record(rr, '+' + 1 + ' ' + itemName(rare), itemName(rare));
      }
    }
    if (Math.random() < P2H_CONST.CHANCE_SEED) {
      var sr = st && st.addItemToBag ? st.addItemToBag(player, P2H_CONST.SEED_ITEM, 1, defs) : { success: false };
      record(sr, '+' + 1 + ' ' + itemName(P2H_CONST.SEED_ITEM), itemName(P2H_CONST.SEED_ITEM));
    }
    if (Math.random() < P2H_CONST.CHANCE_BLUEPRINT) {
      var bp = pick(P2H_CONST.BLUEPRINTS);
      var br = st && st.addItemToBag ? st.addItemToBag(player, bp, 1, defs) : { success: false };
      record(br, '+' + 1 + ' ' + itemName(bp), itemName(bp));
    }
    return { granted: granted, failed: failed, tempChest: tempChest, linhThach: lt };
  }

  function dig(player, it) {
    player = player || getPlayer();
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var s = ensureState(player);
    var map = getActiveMap(player);
    if (!map) return { ok: false, msg: 'Không có bản đồ kho báu nào đang giữ.' };
    if (getCurrentMapId() !== map.mapId) return { ok: false, msg: 'Sai vùng — bản đồ chỉ một vị trí đào.' };
    var dx = player.x - map.x;
    var dy = player.y - map.y;
    if (Math.sqrt(dx * dx + dy * dy) > (P2H_CONST.DIG_RADIUS + 12)) {
      return { ok: false, msg: 'Chưa đứng đúng điểm đào.' };
    }

    var reward = grantRewards(player, map);
    var st = getStateAPI();
    if (st && st.removeItemFromBag) st.removeItemFromBag(player, P2H_CONST.MAP_ITEM, 1);
    s.maps.shift();
    s.digs += 1;
    s.tracking = false;
    save(player);

    var eng = getEngine();
    if (eng && eng.spawnFloatingText) {
      eng.spawnFloatingText('Kho báu!', map.x, map.y - 45, '#ffd76a');
    }
    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) {
      window.GameAudio.playChime();
    }
    toast('Đào được kho báu: ' + reward.granted.join(', ') +
      (reward.tempChest && reward.tempChest.length ? ' (vào Rương Tạm: ' + reward.tempChest.join(', ') + ')' : '') +
      (reward.failed.length ? ' (túi đầy, mất: ' + reward.failed.join(', ') + ')' : ''));
    renderIfOpen(player);
    return { ok: true, reward: reward, map: map };
  }

  // ==========================================================================
  // 5. ĐIỂM TƯƠNG TÁC ĐÀO (móc interactables của mapdata.js)
  // ==========================================================================
  var injectedMaps = {};

  function syncMapInteractable() {
    var eng = getEngine();
    if (!eng || !eng.getCurrentMap || !eng.getCurrentMapId) return;
    var mapData = eng.getCurrentMap();
    if (!mapData) return;
    var mapId = eng.getCurrentMapId();
    var spot = getDigSpotForMap(mapId);

    // Dọn điểm đào đã cắm ở map khác
    for (var id in injectedMaps) {
      if (id === mapId) continue;
      var oldMap = findMapObject(id);
      if (oldMap && oldMap.interactables) {
        for (var i = oldMap.interactables.length - 1; i >= 0; i--) {
          if (oldMap.interactables[i].id === 'p2h_dig') oldMap.interactables.splice(i, 1);
        }
      }
      delete injectedMaps[id];
    }

    if (!Array.isArray(mapData.interactables)) return;
    var idx = -1;
    for (var j = 0; j < mapData.interactables.length; j++) {
      if (mapData.interactables[j].id === 'p2h_dig') { idx = j; break; }
    }
    if (!spot) {
      if (idx >= 0) mapData.interactables.splice(idx, 1);
      delete injectedMaps[mapId];
      return;
    }
    var entry = {
      id: 'p2h_dig',
      label: 'Đào',
      x: spot.x,
      y: spot.y,
      radius: P2H_CONST.DIG_RADIUS,
      action: 'p2h_dig'
    };
    if (idx >= 0) mapData.interactables[idx] = entry;
    else mapData.interactables.push(entry);
    injectedMaps[mapId] = true;
  }

  function findMapObject(mapId) {
    var holder = null;
    if (typeof window !== 'undefined' && window.GameMapData) holder = window.GameMapData;
    if (!holder) { try { holder = require('./mapdata.js'); } catch (e) { return null; } }
    if (!holder) return null;
    if (holder.getMap) return holder.getMap(mapId);
    return holder.maps ? holder.maps[mapId] : null;
  }

  /**
   * Nhịp 500ms: giữ điểm tương tác khớp map hiện tại + tự tắt dẫn đường khi
   * đã vào vùng đào (mũi tên tắt, người chơi tự tìm điểm).
   */
  function tick() {
    var player = getPlayer();
    if (!player) return;
    ensureState(player);
    mountButton();          // thử lại nếu khung HUD dựng sau lần init đầu
    syncMapInteractable();
    var s = player.p2h;
    var map = s.maps[0];
    if (s.tracking) {
      if (!map) { s.tracking = false; return; }
      // Đã vào VÙNG của bản đồ: mũi tên dẫn vùng tắt hẳn (không rơi về mũi tên
      // nhiệm vụ chính — dễ tưởng nhầm là còn đường của kho báu), người chơi
      // tự tìm điểm đào trên map.
      if (getCurrentMapId() === map.mapId) {
        s.tracking = false;
        save(player);
        toast('Đã tới ' + map.zoneName + ' — tìm điểm đào quanh đây.');
      }
    }
  }

  // ==========================================================================
  // 6. GIAO DIỆN (bảng Tàn Đồ — cùng kiểu panel P2E, không thêm CSS)
  // ==========================================================================
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderPanel(player) {
    player = player || getPlayer();
    if (!player) return;
    var modal = document.getElementById(PANEL_ID);
    if (!modal) return;
    var body = modal.querySelector('[data-p2h-body]');
    if (!body) return;
    var s = ensureState(player);
    var have = fragmentCount(player);
    var map = s.maps[0] || null;

    var html = '';
    html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<div><div style="font-size:11px;opacity:.7;">Mảnh tàn đồ</div><div style="font-size:22px;font-weight:700;">'
      + have + ' / ' + P2H_CONST.FRAGMENTS_NEEDED + '</div></div>'
      + '<div><div style="font-size:11px;opacity:.7;">Kho báu đã đào</div><div style="font-size:22px;font-weight:700;">'
      + s.digs + '</div></div>'
      + '</div>';

    html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:8px;margin-bottom:10px;">'
      + '<div style="flex:1;font-size:12px;opacity:.85;">Ghép đủ ' + P2H_CONST.FRAGMENTS_NEEDED
      + ' mảnh thành một bản đồ kho báu (một vị trí đào). Mảnh rơi rất nhỏ khi hạ quái và trong rương.</div>'
      + '<button type="button" class="btn btn-main small" data-p2h-combine="1"'
      + (canCombine(player) ? '' : ' disabled') + '>Ghép</button>'
      + '</div>';

    if (map) {
      html += '<div style="padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:8px;">'
        + '<div style="font-size:13px;"><b>Bản đồ kho báu</b> · ' + esc(map.zoneName) + '</div>'
        + '<div style="font-size:11px;opacity:.75;margin-bottom:6px;">Một vị trí đào duy nhất trong vùng. Tới nơi hãy tự tìm điểm đào.</div>'
        + '<div style="display:flex;gap:8px;">'
        + '<button type="button" class="btn btn-main small" data-p2h-guide="1">Chỉ đường</button>'
        + '<button type="button" class="btn wood small" data-p2h-unguide="1"' + (s.tracking ? '' : ' disabled') + '>Tắt dẫn đường</button>'
        + '</div></div>';
    }

    body.innerHTML = html;
    var cb = body.querySelector('[data-p2h-combine]');
    if (cb) cb.onclick = function () { combine(player); };
    var gb = body.querySelector('[data-p2h-guide]');
    if (gb) gb.onclick = function () { startGuidance(player); };
    var ub = body.querySelector('[data-p2h-unguide]');
    if (ub) ub.onclick = function () { stopGuidance(player); };
  }

  var PANEL_ID = 'p2h-panel';

  function renderIfOpen(player) {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById(PANEL_ID);
    if (modal && !modal.classList.contains('hidden')) renderPanel(player);
  }

  function openPanel() {
    if (typeof document === 'undefined') return;
    var player = getPlayer();
    if (!player) return;
    var modal = document.getElementById(PANEL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = PANEL_ID;
      modal.className = 'modal-overlay hidden';
      modal.innerHTML = '<div class="panel modal-box" style="max-width:460px;width:94%;max-height:86vh;overflow:auto;">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
        + '<div style="flex:1;font-size:15px;font-weight:700;letter-spacing:.5px;">TÀN ĐỒ · KHO BÁU</div>'
        + '<button type="button" class="btn wood small" data-p2h-close="1">Đóng</button>'
        + '</div>'
        + '<div data-p2h-body></div>'
        + '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closePanel();
      });
      var closeBtn = modal.querySelector('[data-p2h-close]');
      if (closeBtn) closeBtn.onclick = closePanel;
    }
    modal.classList.remove('hidden');
    renderPanel(player);
  }

  function closePanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById(PANEL_ID);
    if (modal) modal.classList.add('hidden');
  }

  function mountButton() {
    if (typeof document === 'undefined') return;
    var panel = document.getElementById('hud-toolbar-panel');
    if (!panel || document.getElementById('btn-p2h-tan-do')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-p2h-tan-do';
    btn.type = 'button';
    btn.className = 'btn wood hud-tool-btn';
    btn.setAttribute('aria-label', 'Tàn Đồ');
    btn.title = 'Tàn Đồ · Bản Đồ Kho Báu';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"></path>'
      + '<path d="M9 4v14"></path><path d="M15 6v14"></path>'
      + '</svg><span class="hud-tool-label">Tàn Đồ</span>';
    btn.addEventListener('click', function () { openPanel(); });
    panel.appendChild(btn);
  }

  // ==========================================================================
  // KHỞI ĐỘNG
  // ==========================================================================
  var tickTimer = null;
  function init() {
    if (typeof window === 'undefined') return;
    mountButton();
    if (!tickTimer && typeof setInterval === 'function') {
      tickTimer = setInterval(tick, 500);
    }
  }

  exports.P2H_CONST = P2H_CONST;
  exports.ensureState = ensureState;
  exports.fragmentCount = fragmentCount;
  exports.rollKillDrop = rollKillDrop;
  exports.onChestOpened = onChestOpened;
  exports.canCombine = canCombine;
  exports.combine = combine;
  exports.getActiveMap = getActiveMap;
  exports.getTrackedTargetInfo = getTrackedTargetInfo;
  exports.startGuidance = startGuidance;
  exports.stopGuidance = stopGuidance;
  exports.getDigSpotForMap = getDigSpotForMap;
  exports.dig = dig;
  exports.syncMapInteractable = syncMapInteractable;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;

  if (typeof window !== 'undefined') {
    window.GameP2H = exports;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof module !== 'undefined' && module.exports ? module.exports : {});
