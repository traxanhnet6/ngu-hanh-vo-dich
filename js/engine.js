/**
 * engine.js — Vòng lặp trò chơi, kết xuất Canvas, chiến đấu thời gian thực,
 * quản lý đa bản đồ, quái vật, kỹ năng, rớt đồ & hiệu ứng hình ảnh (Canvas VFX).
 */
(function (global) {
  'use strict';

  var canvas = null;
  var ctx = null;
  var player = null;
  var mapData = null;
  var stateAPI = null;
  var audioAPI = null;
  var pathfinder = null;
  var combatAPI = null;
  var monstersAPI = null;

  var currentMapId = 'mieu_hoang';
  var isRunning = false;
  var lastFrameTime = 0;
  var onReadyCallback = null;

  var camera = {
    x: 0,
    y: 0,
    scale: 1,
    viewportW: 800,
    viewportH: 600
  };

  var SPEED = 138; // Tốc độ di chuyển người chơi (px/s)
  var INTERACTION_RANGE = 48;

  var keysDown = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  var currentPath = [];
  var pendingInteraction = null;
  var clickRipple = null;
  var exitChip = { text: '', timer: 0 };
  var stepSoundAccumulator = 0;

  var playerMoving = false;
  var walkAnimTime = 0;
  var playerSnareTimer = 0;
  var playerSlowTimer = 0;
  var playerSlowRatio = 0;

  // Chiến đấu người chơi
  var targetMonster = null;
  var basicAttackCd = 0;
  // Tự tìm đường theo nhiệm vụ + nút hành động theo ngữ cảnh (Đợt 2, lệnh Bui)
  var autoPath = { active: false, lastLegAt: 0, combatStamp: 0 };
  var currentActionMode = 'attack';
  var ACTION_PICKUP_RADIUS = 72;
  var DIR_VECTORS = [
    { x: 0, y: 1 }, { x: 0.7071, y: 0.7071 }, { x: 1, y: 0 }, { x: 0.7071, y: -0.7071 },
    { x: 0, y: -1 }, { x: -0.7071, y: -0.7071 }, { x: -1, y: 0 }, { x: -0.7071, y: 0.7071 }
  ];
  var skill1Cd = 0;
  var skill2Cd = 0;
  var lastCombatTime = 0;

  // Danh sách thực thể thế giới
  var fieldMonsters = [];
  var groundDrops = [];
  var floatingTexts = [];
  var projectiles = [];
  var visualEffects = []; // slash, vine snare, telegraphs, etc.

  // Chuyển map fade
  var mapFade = {
    alpha: 0,
    dir: 0, // 1: fade to black, -1: fade to game
    callback: null
  };

  // Tài nguyên đồ họa
  var assets = {};
  var assetsLoaded = false;

  function preloadAssets(callback) {
    if (typeof Image === 'undefined') {
      if (callback) callback();
      return;
    }

    var assetList = [
      { key: 'map_bg', src: 'assets/art/map-mieu-hoang-bg.png' },
      { key: 'map_rung_doc_bg', src: 'assets/art/map-rung-doc-bg.png' },
      { key: 'temple', src: 'assets/art/obj-temple.png' },
      { key: 'pine', src: 'assets/art/obj-tree-pine.png' },
      { key: 'broadleaf_tree', src: 'assets/art/obj-tree-broadleaf.png' },
      { key: 'fallen_log', src: 'assets/art/obj-fallen-log.png' },
      { key: 'linhnhi', src: 'assets/art/npc-linhnhi.png' },
      { key: 'hanhan_idle', src: 'assets/chars/hanhan-idle.png' },
      { key: 'hanhan_walk', src: 'assets/chars/hanhan-walk.png' },
      { key: 'hanhan_face', src: 'assets/chars/hanhan-face.png' },
      { key: 'thaotinh_sheet', src: 'assets/chars/thaotinh-sheet.png' },
      { key: 'nhenxanh_sheet', src: 'assets/chars/nhenxanh-sheet.png' },
      { key: 'cothuye_sheet', src: 'assets/chars/cothuye-sheet.png' },
      { key: 'icons_sheet', src: 'assets/art/icons-sheet.png' }
    ];

    var remaining = assetList.length;
    function checkDone() {
      remaining--;
      if (remaining <= 0) {
        assetsLoaded = true;
        if (callback) callback();
      }
    }

    for (var i = 0; i < assetList.length; i++) {
      (function (item) {
        var img = new Image();
        img.onload = checkDone;
        img.onerror = function () {
          console.error('Không thể nạp tài nguyên:', item.src);
          checkDone();
        };
        img.src = item.src;
        assets[item.key] = img;
      })(assetList[i]);
    }
  }

  function initEngine(canvasEl, playerObj, mapObj, onReady) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    player = playerObj;
    mapData = mapObj || (typeof window !== 'undefined' ? window.MapData : null);
    stateAPI = typeof window !== 'undefined' ? window.GameState : null;
    audioAPI = typeof window !== 'undefined' ? window.GameAudio : null;
    pathfinder = typeof window !== 'undefined' ? window.Pathfinder : null;
    combatAPI = typeof window !== 'undefined' ? window.GameCombat : null;
    monstersAPI = typeof window !== 'undefined' ? window.GameMonsters : null;
    onReadyCallback = onReady;

    resizeCanvas();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resizeCanvas);
      setupInputs();
    }

    preloadAssets(function () {
      initFieldMonsters();
      if (onReadyCallback) onReadyCallback();
    });
  }

  function resizeCanvas() {
    if (!canvas || typeof window === 'undefined') return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    var targetScale = h / 720;
    camera.scale = Math.max(0.55, Math.min(1.5, targetScale));
    camera.viewportW = w / camera.scale;
    camera.viewportH = h / camera.scale;
  }

  function initFieldMonsters() {
    if (!monstersAPI || !monstersAPI.RUNG_DOC_PACKS) return;
    fieldMonsters = [];
    var packs = monstersAPI.RUNG_DOC_PACKS;
    for (var p = 0; p < packs.length; p++) {
      var pack = packs[p];
      for (var c = 0; c < pack.count; c++) {
        var angle = Math.random() * Math.PI * 2;
        var dist = (c === 0) ? 0 : (15 + Math.random() * (pack.spread || 40));
        var mx = pack.anchor.x + Math.cos(angle) * dist;
        var my = pack.anchor.y + Math.sin(angle) * dist;
        var m = monstersAPI.createMonster(pack.speciesId, mx, my, pack.anchor.x, pack.anchor.y, {
          spawnGraceTimer: 0
        });
        m.packId = pack.id;
        fieldMonsters.push(m);
      }
    }
  }

  function setupInputs() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      var handled = true;
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysDown.up = true;
          break;
        case 's':
        case 'arrowdown':
          keysDown.down = true;
          break;
        case 'a':
        case 'arrowleft':
          keysDown.left = true;
          break;
        case 'd':
        case 'arrowright':
          keysDown.right = true;
          break;
        case ' ':
        case 'e':
          // Phím Space/E = nút hành động theo ngữ cảnh (cùng hành vi với nút trên HUD)
          e.preventDefault();
          performContextAction();
          break;
        default:
          handled = false;
      }
      if (handled) {
        autoPath.active = false; // Phím di chuyển thủ công -> dừng tự tìm đường ngay
        currentPath = [];
        pendingInteraction = null;
        if (audioAPI) audioAPI.init();
      }
    });

    window.addEventListener('keyup', function (e) {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysDown.up = false;
          break;
        case 's':
        case 'arrowdown':
          keysDown.down = false;
          break;
        case 'a':
        case 'arrowleft':
          keysDown.left = false;
          break;
        case 'd':
        case 'arrowright':
          keysDown.right = false;
          break;
      }
    });

    canvas.addEventListener('pointerdown', function (e) {
      if (audioAPI) audioAPI.init();
      var rect = canvas.getBoundingClientRect();
      var screenX = e.clientX - rect.left;
      var screenY = e.clientY - rect.top;

      var worldX = camera.x + screenX / camera.scale;
      var worldY = camera.y + screenY / camera.scale;

      handleWorldClick(worldX, worldY);
    });
  }

  function handleWorldClick(worldX, worldY) {
    if (!player || !mapData) return;
    if (autoPath.active) autoPath.active = false; // Chạm để tự đi -> dừng tự tìm đường

    // 1. Kiểm tra click vào quái vật (khi ở Rừng Độc)
    if (mapData.id === 'rung-doc') {
      var clickedMonster = findMonsterAt(worldX, worldY);
      if (clickedMonster) {
        targetMonster = clickedMonster;
        var dist = Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y);
        if (dist > 50) {
          triggerPathTo(targetMonster.x, targetMonster.y, null);
        }
        return;
      }
    }

    // Click mặt đất -> xóa mục tiêu quái, di chuyển thông thường
    targetMonster = null;

    // 2. Click vào Linh Nhi (Bản đồ Miếu Hoang)
    if (mapData.id === 'mieu_hoang' && mapData.linhnhi) {
      var ln = mapData.linhnhi;
      var lnBounds = {
        x: ln.x - 10,
        y: ln.y - 10,
        w: ln.w + 20,
        h: ln.h + 20
      };
      if (worldX >= lnBounds.x && worldX <= lnBounds.x + lnBounds.w &&
          worldY >= lnBounds.y && worldY <= lnBounds.y + lnBounds.h) {
        var distToLn = Math.hypot(player.x - ln.feetX, player.y - ln.feetY);
        if (distToLn <= INTERACTION_RANGE) {
          triggerDialogueLinhNhi();
        } else {
          triggerPathTo(ln.standTile.x, ln.standTile.y, {
            type: 'npc',
            onArrive: triggerDialogueLinhNhi
          });
        }
        return;
      }
    }

    // 3. Click vào Cửa Miếu Hoang
    if (mapData.id === 'mieu_hoang' && mapData.temple) {
      var tm = mapData.temple;
      var tmBounds = {
        x: tm.x,
        y: tm.y,
        w: tm.w,
        h: tm.h + 30
      };
      if (worldX >= tmBounds.x && worldX <= tmBounds.x + tmBounds.w &&
          worldY >= tmBounds.y && worldY <= tmBounds.y + tmBounds.h) {
        var distToDoor = Math.hypot(player.x - tm.doorAnchor.x, player.y - tm.doorAnchor.y);
        if (distToDoor <= INTERACTION_RANGE) {
          triggerLockedDoorToast();
        } else {
          triggerPathTo(tm.doorAnchor.x, tm.doorAnchor.y, {
            type: 'door',
            onArrive: triggerLockedDoorToast
          });
        }
        return;
      }
    }

    // 4. Click di chuyển thông thường
    triggerPathTo(worldX, worldY, null);
  }

  // ============================================================
  // NHẶT ĐỒ RƠI — hàm dùng chung cho "bước qua nhặt" và nút "Nhặt Đồ"
  // ============================================================
  function collectDropAtIndex(i, todayData) {
    var drop = groundDrops[i];
    if (!drop) return false;
    if (drop.itemId === 'linh-thach') {
      // Tính Linh Thạch qua trần farm theo ngày (Hồ sơ 50)
      var gainedLt = stateAPI ? stateAPI.calcLinhThachGain(todayData.farmLinhThach, drop.count) : drop.count;
      player.linhThach = (player.linhThach || 0) + gainedLt;
      todayData.farmLinhThach += gainedLt;
      if (player.farmSession) {
        player.farmSession.linhThach += gainedLt;
      }
      spawnFloatingText('+' + gainedLt + ' Linh Thạch', player.x, player.y - 35, '#ffe9a8');
      if (audioAPI) audioAPI.playPickup();
      groundDrops.splice(i, 1);
      return true;
    }
    // Cho vào túi trữ vật (Brief §6)
    var addResult = stateAPI ? stateAPI.addItemToBag(player, drop.itemId, drop.count) : { success: true };
    if (addResult.success) {
      var def = monstersAPI.ITEM_DEFS[drop.itemId];
      var itemName = def ? def.name : drop.itemId;
      spawnFloatingText('+' + drop.count + ' ' + itemName, player.x, player.y - 35, '#7ce898');
      if (player.farmSession && def) {
        player.farmSession.notableLoot.push(def.name);
      }
      if (audioAPI) audioAPI.playPickup();
      groundDrops.splice(i, 1);
      return true;
    }
    // Túi đầy -> để lại trên đất
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast('Túi đầy');
    }
    return false;
  }

  function collectDropsInRadius() {
    // Cách nhặt bằng nút đã chốt: nhặt TẤT CẢ đồ trong bán kính, món gần nhất trước
    if (!player) return;
    var dateKey = new Date().toISOString().slice(0, 10);
    if (!player.daily) player.daily = {};
    if (!player.daily[dateKey]) player.daily[dateKey] = { farmTuVi: 0, farmLinhThach: 0 };
    var todayData = player.daily[dateKey];
    var inRange = [];
    for (var i = 0; i < groundDrops.length; i++) {
      var d = Math.hypot(player.x - groundDrops[i].x, player.y - groundDrops[i].y);
      if (d <= ACTION_PICKUP_RADIUS) inRange.push({ drop: groundDrops[i], d: d });
    }
    inRange.sort(function (a, b) { return a.d - b.d; });
    for (var k = 0; k < inRange.length; k++) {
      var idx = groundDrops.indexOf(inRange[k].drop);
      if (idx >= 0) collectDropAtIndex(idx, todayData);
    }
  }

  // ============================================================
  // NÚT HÀNH ĐỘNG THEO NGỮ CẢNH (Đợt 2, lệnh Bui)
  // Ưu tiên: vật tương tác nhiệm vụ > nói chuyện NPC > nhặt đồ > đánh
  // ============================================================
  function computeActionContext() {
    if (!player || !mapData) return { mode: 'attack', label: 'Đánh' };
    if (mapData.id === 'mieu_hoang' && mapData.temple && mapData.temple.doorAnchor) {
      var dd = Math.hypot(player.x - mapData.temple.doorAnchor.x, player.y - mapData.temple.doorAnchor.y);
      if (dd <= INTERACTION_RANGE) return { mode: 'interact', label: 'Cửa Miếu' };
    }
    if (mapData.id === 'mieu_hoang' && mapData.linhnhi) {
      var nd = Math.hypot(player.x - mapData.linhnhi.feetX, player.y - mapData.linhnhi.feetY);
      if (nd <= INTERACTION_RANGE) return { mode: 'talk', label: 'Nói Chuyện' };
    }
    for (var i = 0; i < groundDrops.length; i++) {
      var gd = Math.hypot(player.x - groundDrops[i].x, player.y - groundDrops[i].y);
      if (gd <= ACTION_PICKUP_RADIUS) return { mode: 'pickup', label: 'Nhặt Đồ' };
    }
    return { mode: 'attack', label: 'Đánh' };
  }

  function performContextAction() {
    if (!player || !mapData || player.hp <= 0) return;
    if (typeof document !== 'undefined') {
      var dlg = document.getElementById('dialogue-box');
      if (dlg && !dlg.classList.contains('hidden')) return; // Đang trong hội thoại
    }
    if (autoPath.active) autoPath.active = false; // Bấm nút hành động = người chơi tự điều khiển
    var ctx = computeActionContext();
    if (ctx.mode === 'talk') { triggerDialogueLinhNhi(); return; }
    if (ctx.mode === 'interact') { triggerLockedDoorToast(); return; }
    if (ctx.mode === 'pickup') { collectDropsInRadius(); return; }
    // Đánh: mục tiêu đã chọn còn trong tầm, hoặc quái gần nhất trong tầm 60; không có thì vung kiếm theo hướng mặt
    var m = null;
    if (targetMonster && targetMonster.state !== 'dead' && targetMonster.hp > 0 &&
        Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y) <= 60) {
      m = targetMonster;
    } else {
      var best = 60;
      for (var i = 0; i < fieldMonsters.length; i++) {
        var fm = fieldMonsters[i];
        if (fm.state === 'dead' || fm.hp <= 0) continue;
        var fd = Math.hypot(player.x - fm.x, player.y - fm.y);
        if (fd <= best) { best = fd; m = fm; }
      }
    }
    if (basicAttackCd > 0) return;
    basicAttackCd = 0.45;
    if (m) {
      targetMonster = m;
      player.dir = getDirFromVelocity(m.x - player.x, m.y - player.y);
      executePlayerBasicAttack(m);
    } else {
      var v = DIR_VECTORS[player.dir] || DIR_VECTORS[0];
      if (audioAPI) audioAPI.playSlash();
      visualEffects.push({
        type: 'slash_crescent',
        x: player.x,
        y: player.y - 25,
        targetX: player.x + v.x * 46,
        targetY: player.y - 20 + v.y * 46,
        timer: 0.22,
        duration: 0.22
      });
      lastCombatTime = performance.now();
    }
  }

  // ============================================================
  // NÚT TỰ TÌM ĐƯỜNG THEO NHIỆM VỤ (Đợt 2, lệnh Bui)
  // Đích đến dùng cùng nguồn dữ kiện với mũi tên dẫn đường nên hai bên luôn khớp nhau.
  // Tới nơi: dừng CẠNH NPC, KHÔNG tự mở thoại.
  // ============================================================
  function getQuestTargetInfo() {
    if (!player || !player.quests) return null;
    if (!player.quests.talked_linhnhi) return { mapId: 'mieu_hoang', kind: 'npc' };
    if (!player.quests.huntCompleted) return { mapId: 'rung-doc', kind: 'hunt' };
    return null;
  }

  function resolveQuestDestination(info) {
    if (info.kind === 'npc') {
      var ln = mapData.linhnhi;
      if (!ln) {
        var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : null;
        var tm = holder && holder.getMap ? holder.getMap('mieu_hoang') : null;
        ln = tm ? tm.linhnhi : null;
      }
      if (!ln || !ln.standTile) return null;
      return { x: ln.standTile.x, y: ln.standTile.y, radius: 26 };
    }
    if (info.kind === 'hunt') {
      var near = getNearestLivingThaoTinh();
      if (near) return { x: near.x, y: near.y, radius: 64 };
      if (monstersAPI && monstersAPI.RUNG_DOC_PACKS) {
        for (var i = 0; i < monstersAPI.RUNG_DOC_PACKS.length; i++) {
          var pk = monstersAPI.RUNG_DOC_PACKS[i];
          if (pk.speciesId === 'thao_tinh' && pk.anchor) return { x: pk.anchor.x, y: pk.anchor.y, radius: 44 };
        }
      }
      return null;
    }
    return null;
  }

  function findExitPointTo(destMapId) {
    if (!mapData || !mapData.exits) return null;
    for (var i = 0; i < mapData.exits.length; i++) {
      var ex = mapData.exits[i];
      if (ex.targetMap === destMapId && ex.rect) {
        return { x: ex.rect.x + 10, y: ex.rect.y + ex.rect.h / 2 };
      }
    }
    return null;
  }

  function startAutoQuestPath() {
    var info = getQuestTargetInfo();
    if (!info) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Chưa có mục tiêu nhiệm vụ.');
      }
      return;
    }
    autoPath.active = true;
    autoPath.lastLegAt = 0;
    autoPath.combatStamp = lastCombatTime;
    targetMonster = null;
  }

  function cancelAutoPath(clearPath) {
    autoPath.active = false;
    if (clearPath) {
      currentPath = [];
      pendingInteraction = null;
    }
  }

  function failAutoPath(msg) {
    cancelAutoPath(true);
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(msg);
    }
  }

  function toggleAutoQuestPath() {
    if (autoPath.active) { cancelAutoPath(true); return; }
    startAutoQuestPath();
  }

  function updateAutoPath() {
    if (!autoPath.active || !player || !mapData) return;
    if (mapFade.alpha > 0) return; // Đang chuyển cảnh: chờ sang hẳn bản đồ mới
    var info = getQuestTargetInfo();
    if (!info) { cancelAutoPath(false); return; }
    var now = performance.now();
    // Ưu tiên kiểm tra tới nơi trước: chạm bãi quái là hoàn thành chuyến đi dù quái bắt đầu đánh
    if (info.mapId === currentMapId) {
      var dest = resolveQuestDestination(info);
      if (!dest) { failAutoPath('Mục tiêu chưa xuất hiện, hãy thử lại sau.'); return; }
      var d = Math.hypot(player.x - dest.x, player.y - dest.y);
      if (d <= dest.radius) { cancelAutoPath(false); return; } // Đã tới nơi
    }
    if (lastCombatTime > autoPath.combatStamp) {
      cancelAutoPath(true);
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Vào chiến đấu — đã dừng tự tìm đường.');
      }
      return;
    }
    if (info.mapId === currentMapId) {
      if (currentPath.length === 0 && now - autoPath.lastLegAt > 500) {
        autoPath.lastLegAt = now;
        triggerPathTo(dest.x, dest.y, null);
        if (currentPath.length === 0) failAutoPath('Không tìm được đường tới mục tiêu.');
      }
    } else {
      if (currentPath.length === 0 && now - autoPath.lastLegAt > 500) {
        var pt = findExitPointTo(info.mapId);
        if (!pt) { failAutoPath('Không thấy cổng sang bản đồ đích.'); return; }
        autoPath.lastLegAt = now;
        triggerPathTo(pt.x, pt.y, null);
        if (currentPath.length === 0) failAutoPath('Không tìm được đường ra cổng.');
      }
    }
  }

  function findMonsterAt(wx, wy) {
    for (var i = fieldMonsters.length - 1; i >= 0; i--) {
      var m = fieldMonsters[i];
      if (m.state === 'dead') continue;
      var spec = monstersAPI.SPECIES[m.speciesId];
      var w = (spec.cellW || 72) * (spec.drawScale || 1.0);
      var h = (spec.cellH || 72) * (spec.drawScale || 1.0);
      var top = m.y - spec.feetOffsetY;
      var left = m.x - spec.feetOffsetX;
      if (wx >= left && wx <= left + w && wy >= top && wy <= top + h) {
        return m;
      }
    }
    return null;
  }

  function triggerPathTo(worldX, worldY, interaction) {
    if (!pathfinder || !mapData) return;

    clickRipple = {
      x: worldX,
      y: worldY,
      radius: 4,
      maxRadius: 22,
      alpha: 0.95
    };

    var path = pathfinder.findPath(
      player.x,
      player.y,
      worldX,
      worldY,
      mapData.collisionGrid,
      mapData.gridSize
    );

    if (path && path.length > 0) {
      if (path.length > 1 && Math.hypot(path[0].x - player.x, path[0].y - player.y) < 6) {
        path.shift();
      }
      currentPath = path;
      pendingInteraction = interaction;
    } else {
      currentPath = [];
      pendingInteraction = null;
    }
  }

  function triggerDialogueLinhNhi() {
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.openDialogue(mapData.linhnhi);
    }
  }

  function triggerLockedDoorToast() {
    if (audioAPI) audioAPI.playDoorKnock();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(mapData.temple.lockedToast);
    }
  }

  /**
   * Chuyển đổi giữa 2 bản đồ với hiệu ứng mờ dần (Fade)
   */
  function switchMap(targetMapId, targetSpawn) {
    if (mapFade.alpha > 0) return;
    mapFade.dir = 1;
    mapFade.callback = function () {
      // Nếu rời Rừng Độc về Miếu Hoang -> hiển thị tổng kết buổi farm (Brief §6 & Hồ sơ 41 §8)
      if (currentMapId === 'rung-doc' && targetMapId === 'mieu_hoang') {
        if (player.farmSession && (player.farmSession.kills > 0 || player.farmSession.linhThach > 0 || player.farmSession.tuViMoc > 0)) {
          if (typeof window !== 'undefined' && window.GameUI) {
            window.GameUI.showSessionSummary(player.farmSession);
          }
        }
        player.farmSession = null;
        if (stateAPI) stateAPI.breakHuntChain(player);
      } else if (targetMapId === 'rung-doc') {
        // Bắt đầu farm session mới
        player.farmSession = {
          startTime: Date.now(),
          kills: 0,
          tuViMoc: 0,
          linhThach: 0,
          notableLoot: []
        };
      }

      currentMapId = targetMapId;
      var mapHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
      if (mapHolder && mapHolder.getMap) {
        mapData = mapHolder.getMap(targetMapId);
      }

      player.x = targetSpawn.x;
      player.y = targetSpawn.y;
      currentPath = [];
      targetMonster = null;
      groundDrops = [];
      visualEffects = [];
      projectiles = [];

      updateCamera();
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.refreshHUD();
      }
    };
  }

  /**
   * Tung kỹ năng từ bàn phím hoặc nút giao diện
   */
  function castSkill(skillId) {
    if (!player || player.hp <= 0) return;
    if (mapData.id !== 'rung-doc') {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Kỹ năng chỉ dùng trong khu vực săn bắn');
      }
      return;
    }

    var stats = stateAPI ? stateAPI.deriveStats(player.paths) : { attack: 10 };
    var baseRaw = 10 + (stats.attack - 10);

    if (skillId === 'phi_diep') {
      if (skill1Cd > 0) return;
      if (player.linhLuc < 4) {
        if (audioAPI) audioAPI.playDull();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.triggerSkillShake(1);
          window.GameUI.showToast('Linh lực không đủ (cần 4)');
        }
        return;
      }

      var target = getSkillTarget(280);
      if (!target) {
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Không có mục tiêu trong tầm 280px');
        }
        return;
      }

      player.linhLuc -= 4;
      skill1Cd = 3.0;
      lastCombatTime = performance.now();
      if (audioAPI) audioAPI.playLeafCast();

      projectiles.push({
        type: 'leaf',
        x: player.x,
        y: player.y - 30,
        target: target,
        speed: 520,
        raw: baseRaw * 1.6,
        element: 'moc'
      });
    } else if (skillId === 'day_leo') {
      if (skill2Cd > 0) return;
      if (player.linhLuc < 6) {
        if (audioAPI) audioAPI.playDull();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.triggerSkillShake(2);
          window.GameUI.showToast('Linh lực không đủ (cần 6)');
        }
        return;
      }

      var targetSnare = getSkillTarget(240);
      if (!targetSnare) {
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Không có mục tiêu trong tầm 240px');
        }
        return;
      }

      player.linhLuc -= 6;
      skill2Cd = 8.0;
      lastCombatTime = performance.now();
      if (audioAPI) audioAPI.playVineSnare();

      // Trói chân 1.2s và gây 80% basic damage
      targetSnare.state = 'hit';
      targetSnare.hitStunTimer = 1.2;

      var rawDmg = baseRaw * 0.8;
      var elemFac = combatAPI ? combatAPI.getElementFactor('moc', targetSnare.element) : 1.0;
      var dealt = combatAPI ? combatAPI.calcDamage(rawDmg, elemFac, targetSnare.armor) : rawDmg;
      var isCrit = combatAPI ? combatAPI.rollCrit(0.05) : false;
      if (isCrit) dealt *= 1.5;

      monstersAPI.damageMonster(targetSnare, dealt, player);
      spawnDamageNumber(targetSnare.x, targetSnare.y - 40, Math.round(dealt), 'moc', isCrit);

      // Hiệu ứng dây leo trói dưới chân
      visualEffects.push({
        type: 'vine_snare',
        x: targetSnare.x,
        y: targetSnare.y,
        timer: 1.2,
        duration: 1.2
      });

      if (targetSnare.hp <= 0) {
        handleMonsterDeath(targetSnare);
      }
    }
  }

  function getSkillTarget(maxRange) {
    if (targetMonster && targetMonster.state !== 'dead') {
      var d = Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y);
      if (d <= maxRange) return targetMonster;
    }
    // Tìm quái gần nhất trong tầm
    var closest = null;
    var closestDist = maxRange + 1;
    for (var i = 0; i < fieldMonsters.length; i++) {
      var m = fieldMonsters[i];
      if (m.state === 'dead') continue;
      var dist = Math.hypot(player.x - m.x, player.y - m.y);
      if (dist <= maxRange && dist < closestDist) {
        closestDist = dist;
        closest = m;
      }
    }
    return closest;
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
    if (audioAPI) {
      var settings = stateAPI ? stateAPI.loadSettings() : null;
      if (settings) {
        audioAPI.setMusicVolume(settings.musicVol);
        audioAPI.setSfxVolume(settings.sfxVol);
      }
      audioAPI.startMusic();
    }
  }

  function stop() {
    isRunning = false;
    if (audioAPI) audioAPI.stopMusic();
  }

  function gameLoop(currentTime) {
    if (!isRunning) return;
    var dt = (currentTime - lastFrameTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastFrameTime = currentTime;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    if (!player || !mapData) return;

    var now = performance.now();

    // Cập nhật hiệu ứng chuyển map fade
    if (mapFade.dir !== 0) {
      mapFade.alpha += mapFade.dir * dt * 2.8;
      if (mapFade.dir === 1 && mapFade.alpha >= 1) {
        mapFade.alpha = 1;
        mapFade.dir = -1;
        if (mapFade.callback) {
          mapFade.callback();
          mapFade.callback = null;
        }
      } else if (mapFade.dir === -1 && mapFade.alpha <= 0) {
        mapFade.alpha = 0;
        mapFade.dir = 0;
      }
    }

    // Nếu người chơi đã gục ngã (HP = 0)
    if (player.hp <= 0) {
      currentPath = [];
      targetMonster = null;
      return;
    }

    // Cập nhật hồi chiêu kỹ năng người chơi
    if (basicAttackCd > 0) basicAttackCd = Math.max(0, basicAttackCd - dt);
    if (skill1Cd > 0) skill1Cd = Math.max(0, skill1Cd - dt);
    if (skill2Cd > 0) skill2Cd = Math.max(0, skill2Cd - dt);

    // Cập nhật hiệu ứng khống chế lên người chơi (Trói chân / Làm chậm)
    var canMove = true;
    if (playerSnareTimer > 0) {
      playerSnareTimer = Math.max(0, playerSnareTimer - dt);
      canMove = false;
    }
    var currentSpeed = SPEED;
    if (playerSlowTimer > 0) {
      playerSlowTimer = Math.max(0, playerSlowTimer - dt);
      currentSpeed = SPEED * (1.0 - playerSlowRatio);
    }

    // Cập nhật hồi phục khí huyết và linh lực theo giây (Brief §5)
    var inCombat = (now - lastCombatTime) < 5000;
    if (!inCombat) {
      player.hp = Math.min(player.hpMax, player.hp + 1.5 * dt);
      player.linhLuc = Math.min(player.linhLucMax, player.linhLuc + 2.0 * dt);
    } else {
      player.linhLuc = Math.min(player.linhLucMax, player.linhLuc + 0.4 * dt);
    }

    // Cập nhật Chuỗi Săn (Hunt Chain: 20s đếm lùi)
    if (player.huntChain && player.huntChain.timer > 0) {
      player.huntChain.timer -= dt;
      if (player.huntChain.timer <= 0) {
        if (stateAPI) stateAPI.breakHuntChain(player);
      }
    }

    // Di chuyển người chơi (WASD hoặc Click A*)
    var moved = false;
    var vx = 0;
    var vy = 0;

    if (canMove) {
      if (keysDown.up) vy -= 1;
      if (keysDown.down) vy += 1;
      if (keysDown.left) vx -= 1;
      if (keysDown.right) vx += 1;

      if (vx !== 0 || vy !== 0) {
        var len = Math.hypot(vx, vy);
        vx /= len;
        vy /= len;

        var stepDist = currentSpeed * dt;
        var targetX = player.x + vx * stepDist;
        var targetY = player.y + vy * stepDist;

        if (mapData.isWalkable(targetX, player.y)) {
          player.x = targetX;
          moved = true;
        }
        if (mapData.isWalkable(player.x, targetY)) {
          player.y = targetY;
          moved = true;
        }

        player.dir = getDirFromVelocity(vx, vy);
        currentPath = [];
        pendingInteraction = null;
        targetMonster = null;
      } else if (currentPath.length > 0) {
        var targetWP = currentPath[0];
        var dwx = targetWP.x - player.x;
        var dwy = targetWP.y - player.y;
        var dist = Math.hypot(dwx, dwy);

        var moveDist = currentSpeed * dt;
        if (dist <= moveDist) {
          player.x = targetWP.x;
          player.y = targetWP.y;
          currentPath.shift();
          if (currentPath.length === 0) {
            if (pendingInteraction && pendingInteraction.onArrive) {
              pendingInteraction.onArrive();
              pendingInteraction = null;
            }
          }
        } else {
          var nvx = dwx / dist;
          var nvy = dwy / dist;
          player.x += nvx * moveDist;
          player.y += nvy * moveDist;
          player.dir = getDirFromVelocity(nvx, nvy);
        }
        moved = true;
      }
    }

    playerMoving = moved;
    if (moved) walkAnimTime += dt;

    if (moved) {
      stepSoundAccumulator += dt;
      if (stepSoundAccumulator >= 0.32) {
        stepSoundAccumulator = 0;
        if (audioAPI) audioAPI.playStep();
      }
    } else {
      stepSoundAccumulator = 0.28;
    }

    // Tự động đánh cơ bản khi đã chọn mục tiêu quái
    if (targetMonster) {
      if (targetMonster.state === 'dead' || targetMonster.hp <= 0) {
        targetMonster = null;
      } else {
        var distM = Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y);
        if (distM <= 55) {
          currentPath = [];
          player.dir = getDirFromVelocity(targetMonster.x - player.x, targetMonster.y - player.y);

          if (basicAttackCd <= 0) {
            basicAttackCd = 0.45;
            executePlayerBasicAttack(targetMonster);
          }
        } else if (!playerMoving && currentPath.length === 0) {
          // Tự động bước tới trong tầm đánh
          triggerPathTo(targetMonster.x, targetMonster.y, null);
        }
      }
    }

    // Kiểm tra các vùng thoát (Portals)
    for (var i = 0; i < mapData.exits.length; i++) {
      var ex = mapData.exits[i];
      var r = ex.rect;
      if (player.x >= r.x && player.x <= r.x + r.w &&
          player.y >= r.y && player.y <= r.y + r.h) {
        if (ex.targetMap) {
          // Lối chuyển map thật
          switchMap(ex.targetMap, ex.targetSpawn || ex.target);
          break;
        } else {
          // Lối thoát stub
          if (ex.id === 'exit_bottom') {
            player.y = Math.min(player.y, r.y);
          }
          currentPath = [];
          showExitChip(ex.chipLabel);
        }
      }
    }

    // Tự tìm đường theo nhiệm vụ + đồng bộ nút hành động theo ngữ cảnh
    updateAutoPath();
    var actx = computeActionContext();
    if (actx.mode !== currentActionMode) {
      currentActionMode = actx.mode;
      if (typeof window !== 'undefined' && window.GameUI && window.GameUI.setActionMode) {
        window.GameUI.setActionMode(actx.mode, actx.label);
      }
    }

    // Cập nhật quái vật trên bản đồ Rừng Độc
    if (mapData.id === 'rung-doc') {
      updateFieldMonsters(dt);
    }

    // Cập nhật nhặt chiến lợi phẩm (Ground Drops)
    updateGroundDrops(dt);

    // Cập nhật đường đạn kỹ năng (Projectiles)
    updateProjectiles(dt);

    // Cập nhật hiệu ứng hình ảnh (VFX & Telegraphs)
    updateVisualEffects(dt);

    // Cập nhật chữ sát thương nổi
    updateFloatingTexts(dt);

    // Cập nhật gợn sóng nhấp chuột
    if (clickRipple) {
      clickRipple.radius += 38 * dt;
      clickRipple.alpha -= 1.8 * dt;
      if (clickRipple.alpha <= 0 || clickRipple.radius >= clickRipple.maxRadius) {
        clickRipple = null;
      }
    }

    if (exitChip.timer > 0) {
      exitChip.timer -= dt;
    }

    updateCamera();

    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.update(player, mapData, {
        monsters: (mapData.id === 'rung-doc') ? fieldMonsters : [],
        skillsCd: { phi_diep: skill1Cd, day_leo: skill2Cd }
      });
    }
  }

  function executePlayerBasicAttack(m) {
    lastCombatTime = performance.now();
    var stats = stateAPI ? stateAPI.deriveStats(player.paths) : { attack: 10, critRate: 5 };
    var raw = 10 + (stats.attack - 10);
    var elemFac = combatAPI ? combatAPI.getElementFactor('neutral', m.element) : 1.0;
    var dealt = combatAPI ? combatAPI.calcDamage(raw, elemFac, m.armor) : raw;
    var isCrit = combatAPI ? combatAPI.rollCrit((stats.critRate || 5) / 100) : false;
    if (isCrit) dealt *= 1.5;

    if (audioAPI) audioAPI.playSlash();

    // Hiệu ứng chém vầng trăng khuyết hướng về phía quái (Brief §5)
    visualEffects.push({
      type: 'slash_crescent',
      x: player.x,
      y: player.y - 25,
      targetX: m.x,
      targetY: m.y - 20,
      timer: 0.22,
      duration: 0.22
    });

    monstersAPI.damageMonster(m, dealt, player);
    spawnDamageNumber(m.x, m.y - 35, Math.round(dealt), 'moc', isCrit);

    if (m.hp <= 0) {
      handleMonsterDeath(m);
    }
  }

  function updateFieldMonsters(dt) {
    var playerPos = { x: player.x, y: player.y };

    for (var i = 0; i < fieldMonsters.length; i++) {
      var m = fieldMonsters[i];

      // Xử lý quái đã chết -> đếm thời gian hồi sinh (Brief §4: thường 60s, elite 600s)
      if (m.state === 'dead') {
        var spec = monstersAPI.SPECIES[m.speciesId];
        var respawnTotal = spec.respawnTime || 60;
        if (m.deathTimer >= respawnTotal) {
          // Hồi sinh lại tại nhà
          m.hp = m.maxHp;
          m.x = m.homeX;
          m.y = m.homeY;
          m.state = 'roam';
          m.deathTimer = 0;
          m.spawnGraceTimer = 2.0; // 2s ân hạn hồi sinh
          m.summonedAdds = false;
        } else {
          m.deathTimer += dt;
        }
        continue;
      }

      // Kỹ năng tinh anh: triệu hồi 2 Thảo Tinh ở mốc 50% HP (Brief §4)
      if (m.isElite && m.hp <= m.maxHp * 0.5 && !m.summonedAdds) {
        m.summonedAdds = true;
        spawnEliteAdds(m);
      }

      // Cập nhật máy trạng thái quái vật
      monstersAPI.updateMonster(m, playerPos, dt, {
        onMonsterAttack: function (attacker) {
          handleMonsterAttackPlayer(attacker);
        }
      });

      // Nếu quái tung kỹ năng Rễ Trói (Telegraph r=90, 1.2s nổ, 12 dmg + snare 1.5s)
      if (m.activeTelegraph) {
        visualEffects.push({
          type: 'telegraph_re_troi',
          x: m.activeTelegraph.x,
          y: m.activeTelegraph.y,
          radius: m.activeTelegraph.radius,
          timer: m.activeTelegraph.timer,
          duration: m.activeTelegraph.timer,
          damage: m.activeTelegraph.damage,
          snareDuration: m.activeTelegraph.snareDuration
        });
        m.activeTelegraph = null;
      }
    }
  }

  function spawnEliteAdds(elite) {
    if (!monstersAPI) return;
    for (var i = 0; i < 2; i++) {
      var offset = (i === 0) ? -45 : 45;
      var add = monstersAPI.createMonster('thao_tinh', elite.x + offset, elite.y + 20, elite.homeX, elite.homeY, {
        state: 'aggro',
        spawnGraceTimer: 0
      });
      fieldMonsters.push(add);
    }
    spawnFloatingText('Triệu hồi Thảo Tinh!', elite.x, elite.y - 65, '#ffe9a8');
  }

  function handleMonsterAttackPlayer(m) {
    lastCombatTime = performance.now();
    var stats = stateAPI ? stateAPI.deriveStats(player.paths) : { defense: 5 };
    var elemFac = combatAPI ? combatAPI.getElementFactor(m.element, 'moc') : 1.0;
    var rawDmg = m.damage;
    var dealt = combatAPI ? combatAPI.calcDamage(rawDmg, elemFac, stats.defense) : rawDmg;

    // Bảo hộ 1 đòn (Brief §5 & Hồ sơ 49 §6): quái thường không gây quá 25% max HP người chơi
    if (!m.isElite && combatAPI) {
      dealt = combatAPI.applyOneHitProtection(dealt, player.hpMax);
    }

    player.hp = Math.max(0, player.hp - dealt);
    if (audioAPI) audioAPI.playHit();

    // Làm chậm nếu trúng đòn Nhện Rừng Xanh
    if (m.slowOnHit) {
      playerSlowTimer = m.slowOnHit.duration;
      playerSlowRatio = m.slowOnHit.ratio;
    }

    spawnDamageNumber(player.x, player.y - 45, Math.round(dealt), 'player_damage', false);

    if (player.hp <= 0) {
      handlePlayerDeath();
    }
  }

  function handleMonsterDeath(m) {
    // 1. Tăng Chuỗi Săn (+1/kill, thời gian 20s)
    if (stateAPI) {
      stateAPI.incrementHuntChain(player);
    }

    // 2. Tích lũy Tu vi Mộc theo trần mềm ngày (65/ngày)
    var dateKey = new Date().toISOString().slice(0, 10);
    if (!player.daily) player.daily = {};
    if (!player.daily[dateKey]) player.daily[dateKey] = { farmTuVi: 0, farmLinhThach: 0 };
    var todayData = player.daily[dateKey];

    var rawTuVi = m.tuViMoc || 2;
    var gainedTuVi = stateAPI ? stateAPI.calcTuViGain(todayData.farmTuVi, rawTuVi) : rawTuVi;
    player.paths.moc.tuVi += gainedTuVi;
    todayData.farmTuVi += gainedTuVi;

    if (player.farmSession) {
      player.farmSession.kills++;
      player.farmSession.tuViMoc += gainedTuVi;
    }

    spawnFloatingText('+' + gainedTuVi + ' Tu vi Mộc', m.x, m.y - 25, '#55d882');

    // 3. Tiến độ nhiệm vụ (Săn 5 Thảo Tinh)
    if (player.quests && player.quests.talked_linhnhi && !player.quests.huntCompleted) {
      if (m.speciesId === 'thao_tinh') {
        player.quests.thaotinhKills = (player.quests.thaotinhKills || 0) + 1;
        if (player.quests.thaotinhKills >= 5) {
          player.quests.huntCompleted = true;
          // Thưởng 10 Linh Thạch nhiệm vụ (không tính vào trần farm)
          player.linhThach = (player.linhThach || 0) + 10;
          if (audioAPI) audioAPI.playChime();
          if (typeof window !== 'undefined' && window.GameUI) {
            window.GameUI.showToast('Nhiệm vụ hoàn thành! Nhận 10 Linh Thạch thưởng.');
          }
        }
      }
    }

    // 4. Rớt chiến lợi phẩm (Brief §6)
    var chainCount = (player.huntChain && player.huntChain.count) || 0;
    var drops = monstersAPI.rollDrops(m.speciesId, chainCount);
    var nowSec = performance.now() / 1000;

    for (var d = 0; d < drops.length; d++) {
      var dropItem = drops[d];
      var dropX = m.x + (Math.random() - 0.5) * 36;
      var dropY = m.y + (Math.random() - 0.5) * 24;

      groundDrops.push({
        itemId: dropItem.itemId,
        count: dropItem.count,
        x: dropX,
        y: dropY,
        spawnTime: nowSec,
        ownerUntil: nowSec + 30.0, // Khóa chủ nhân 30s
        despawnTime: nowSec + 60.0  // Biến mất sau 60s
      });
    }

    if (targetMonster === m) {
      targetMonster = null;
    }
  }

  function handlePlayerDeath() {
    player.hp = 0;
    if (stateAPI) {
      stateAPI.breakHuntChain(player);
    }
    if (audioAPI) audioAPI.playDeathGong();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showDeathModal(player.revivalPool);
    }
  }

  function handleRevive(type) {
    autoPath.active = false; // Hồi sinh -> dừng tự tìm đường
    if (type === 'spot') {
      if (stateAPI && stateAPI.revivePlayer(player, 'spot')) {
        // Đẩy lùi quái gần điểm chết về trạng thái roam/nhà
        for (var i = 0; i < fieldMonsters.length; i++) {
          var m = fieldMonsters[i];
          if (Math.hypot(m.x - player.x, m.y - player.y) < 300) {
            m.state = 'return';
          }
        }
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.hideDeathModal();
          window.GameUI.showToast('Đã hồi sinh tại chỗ');
        }
      }
    } else {
      // Về Miếu Hoang: miễn phí, chuyển map về Miếu
      if (stateAPI) {
        stateAPI.revivePlayer(player, 'home');
      }
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.hideDeathModal();
      }
      var templeSpawn = { x: 560, y: 620 };
      switchMap('mieu_hoang', templeSpawn);
    }
  }

  function updateGroundDrops(dt) {
    var nowSec = performance.now() / 1000;
    var dateKey = new Date().toISOString().slice(0, 10);
    if (!player.daily) player.daily = {};
    if (!player.daily[dateKey]) player.daily[dateKey] = { farmTuVi: 0, farmLinhThach: 0 };
    var todayData = player.daily[dateKey];

    for (var i = groundDrops.length - 1; i >= 0; i--) {
      var drop = groundDrops[i];

      // Hết hạn biến mất
      if (nowSec >= drop.despawnTime) {
        groundDrops.splice(i, 1);
        continue;
      }

      // Người chơi bước qua để nhặt (khoảng cách <= 26px)
      var dist = Math.hypot(player.x - drop.x, player.y - drop.y);
      if (dist <= 26) {
        collectDropAtIndex(i, todayData);
      }
    }
  }

  function updateProjectiles(dt) {
    for (var i = projectiles.length - 1; i >= 0; i--) {
      var p = projectiles[i];
      if (!p.target || p.target.state === 'dead') {
        projectiles.splice(i, 1);
        continue;
      }

      var dx = p.target.x - p.x;
      var dy = (p.target.y - 25) - p.y;
      var dist = Math.hypot(dx, dy);
      var moveStep = p.speed * dt;

      if (dist <= moveStep) {
        // Đạn chạm đích
        var elemFac = combatAPI ? combatAPI.getElementFactor(p.element, p.target.element) : 1.0;
        var dealt = combatAPI ? combatAPI.calcDamage(p.raw, elemFac, p.target.armor) : p.raw;
        var isCrit = combatAPI ? combatAPI.rollCrit(0.05) : false;
        if (isCrit) dealt *= 1.5;

        monstersAPI.damageMonster(p.target, dealt, player);
        spawnDamageNumber(p.target.x, p.target.y - 40, Math.round(dealt), p.element, isCrit);

        if (p.target.hp <= 0) {
          handleMonsterDeath(p.target);
        }
        projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * moveStep;
        p.y += (dy / dist) * moveStep;
      }
    }
  }

  function updateVisualEffects(dt) {
    for (var i = visualEffects.length - 1; i >= 0; i--) {
      var vfx = visualEffects[i];
      vfx.timer -= dt;

      // Xử lý nổ kỹ năng Rễ Trói khi hết 1.2s telegraph
      if (vfx.type === 'telegraph_re_troi' && vfx.timer <= 0) {
        var distToPlayer = Math.hypot(player.x - vfx.x, player.y - vfx.y);
        if (distToPlayer <= vfx.radius) {
          player.hp = Math.max(0, player.hp - vfx.damage);
          playerSnareTimer = vfx.snareDuration;
          spawnDamageNumber(player.x, player.y - 45, vfx.damage, 'player_damage', false);
          if (audioAPI) audioAPI.playHit();
          if (player.hp <= 0) handlePlayerDeath();
        }
      }

      if (vfx.timer <= 0) {
        visualEffects.splice(i, 1);
      }
    }
  }

  function updateFloatingTexts(dt) {
    for (var i = floatingTexts.length - 1; i >= 0; i--) {
      var ft = floatingTexts[i];
      ft.y -= 30 * dt;
      ft.timer -= dt;
      if (ft.timer <= 0) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  function spawnDamageNumber(x, y, amount, type, isCrit) {
    floatingTexts.push({
      text: '-' + amount,
      x: x + (Math.random() - 0.5) * 16,
      y: y,
      type: type,
      isCrit: !!isCrit,
      timer: 0.9,
      duration: 0.9
    });
  }

  function spawnFloatingText(text, x, y, color) {
    floatingTexts.push({
      text: text,
      x: x,
      y: y,
      customColor: color,
      timer: 1.1,
      duration: 1.1
    });
  }

  function updateCamera() {
    if (!player || !mapData) return;

    var targetCamX = player.x - camera.viewportW / 2;
    var targetCamY = player.y - camera.viewportH / 2;

    if (camera.viewportW >= mapData.width) {
      camera.x = (mapData.width - camera.viewportW) / 2;
    } else {
      camera.x = Math.max(0, Math.min(mapData.width - camera.viewportW, targetCamX));
    }

    if (camera.viewportH >= mapData.height) {
      camera.y = (mapData.height - camera.viewportH) / 2;
    } else {
      camera.y = Math.max(0, Math.min(mapData.height - camera.viewportH, targetCamY));
    }
  }

  function render() {
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.fillStyle = '#141a16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);

    // 1. Vẽ ảnh nền bản đồ hiện tại (Brief §2: 1920x1280)
    var bgKey = (mapData.id === 'rung-doc') ? 'map_rung_doc_bg' : 'map_bg';
    if (assets[bgKey] && assets[bgKey].complete) {
      ctx.drawImage(assets[bgKey], 0, 0, mapData.width, mapData.height);
    }

    // 2. Gợn sóng nhấp chuột
    if (clickRipple) {
      ctx.save();
      ctx.strokeStyle = 'rgba(233, 217, 168, ' + Math.max(0, clickRipple.alpha) + ')';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(clickRipple.x, clickRipple.y, clickRipple.radius * 1.3, clickRipple.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Vẽ hiệu ứng cảnh báo kỹ năng dưới đất (Telegraphs)
    for (var v = 0; v < visualEffects.length; v++) {
      var vfx = visualEffects[v];
      if (vfx.type === 'telegraph_re_troi') {
        ctx.save();
        var progress = 1.0 - (vfx.timer / vfx.duration);
        ctx.strokeStyle = 'rgba(180, 70, 220, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(140, 40, 180, ' + (0.15 + progress * 0.25) + ')';
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Vòng co lại báo thời điểm nổ
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, vfx.radius * (1.0 - progress), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. Vẽ chiến lợi phẩm rớt dưới đất (Ground Drops có hào quang)
    for (var g = 0; g < groundDrops.length; g++) {
      var drop = groundDrops[g];
      drawGroundDrop(drop);
    }

    // 5. Thu thập toàn bộ thực thể hiển thị và sắp xếp chiều sâu Painter's Algorithm
    var entities = [];

    // Standees theo bản đồ
    if (mapData.id === 'mieu_hoang') {
      if (mapData.temple) {
        entities.push({
          type: 'temple',
          baseY: mapData.temple.baseY,
          draw: function () {
            if (assets.temple && assets.temple.complete) {
              ctx.drawImage(assets.temple, mapData.temple.x, mapData.temple.y, mapData.temple.w, mapData.temple.h);
            }
          }
        });
      }

      if (mapData.trees) {
        for (var t = 0; t < mapData.trees.length; t++) {
          (function (tree) {
            entities.push({
              type: 'tree',
              baseY: tree.baseY,
              draw: function () {
                ctx.save();
                ctx.fillStyle = 'rgba(10, 15, 10, 0.35)';
                ctx.beginPath();
                ctx.ellipse(tree.trunk.x, tree.trunk.y + 4, tree.trunk.r * 2.2, tree.trunk.r * 1.1, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                if (assets.pine && assets.pine.complete) {
                  ctx.drawImage(assets.pine, tree.x, tree.y, tree.w, tree.h);
                }
              }
            });
          })(mapData.trees[t]);
        }
      }

      if (mapData.linhnhi) {
        entities.push({
          type: 'linhnhi',
          baseY: mapData.linhnhi.baseY,
          draw: function () {
            var ln = mapData.linhnhi;
            ctx.save();
            ctx.fillStyle = 'rgba(10, 15, 10, 0.4)';
            ctx.beginPath();
            ctx.ellipse(ln.feetX, ln.feetY, 20, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (assets.linhnhi && assets.linhnhi.complete) {
              ctx.drawImage(assets.linhnhi, ln.x, ln.y, ln.w, ln.h);
            }

            if (player.quests && !player.quests.talked_linhnhi) {
              var bob = Math.sin(performance.now() / 250) * 4;
              drawQuestExclamation(ln.feetX, ln.y - 18 + bob);
            }
          }
        });
      }
    } else if (mapData.id === 'rung-doc') {
      // Standees Rừng Độc (Cây lá rộng + thân gỗ mục)
      if (mapData.standees) {
        for (var s = 0; s < mapData.standees.length; s++) {
          (function (std) {
            entities.push({
              type: 'standee',
              baseY: std.baseY,
              draw: function () {
                var assetKey = (std.id === 'fallen_log_1') ? 'fallen_log' : 'broadleaf_tree';
                if (assets[assetKey] && assets[assetKey].complete) {
                  ctx.drawImage(assets[assetKey], std.x, std.y, std.w, std.h);
                }
              }
            });
          })(mapData.standees[s]);
        }
      }

      // Quái vật trên bản đồ Rừng Độc
      for (var mIdx = 0; mIdx < fieldMonsters.length; mIdx++) {
        (function (monster) {
          if (monster.state === 'dead') return;
          entities.push({
            type: 'monster',
            baseY: monster.y,
            draw: function () {
              drawMonster(monster);
            }
          });
        })(fieldMonsters[mIdx]);
      }
    }

    // Người chơi Hà Nhân
    entities.push({
      type: 'player',
      baseY: player.y,
      draw: function () {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 15, 10, 0.45)';
        ctx.beginPath();
        ctx.ellipse(player.x, player.y, 22, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        var walkSheet = assets.hanhan_walk;
        if (playerMoving && walkSheet && walkSheet.complete && walkSheet.naturalWidth >= 768) {
          var wFrame = Math.floor(walkAnimTime * 9) % 8;
          var wFrameY = (player.dir || 0) * 120;
          ctx.drawImage(
            walkSheet,
            wFrame * 96, wFrameY, 96, 120,
            player.x - 48, player.y - 118, 96, 120
          );
        } else if (assets.hanhan_idle && assets.hanhan_idle.complete) {
          var frameY = (player.dir || 0) * 120;
          ctx.drawImage(
            assets.hanhan_idle,
            0, frameY, 96, 120,
            player.x - 48, player.y - 118, 96, 120
          );
        }
      }
    });

    // Sắp xếp Painter's algorithm với tie-break < 4px: vẽ NPC/quái trước player (Brief §8 fix 3)
    entities.sort(function (a, b) {
      if (Math.abs(a.baseY - b.baseY) < 4) {
        if (a.type === 'player' && b.type !== 'player') return 1;
        if (b.type === 'player' && a.type !== 'player') return -1;
      }
      return a.baseY - b.baseY;
    });

    for (var e = 0; e < entities.length; e++) {
      entities[e].draw();
    }

    // 6. Vẽ đạn bay & hiệu ứng trên không (Projectiles & VFX)
    renderCombatVfx();

    // 7. Vẽ chữ sát thương nổi (Floating Numbers)
    renderFloatingTexts();

    // 8. Mũi tên dẫn đường nhiệm vụ (Guidance Arrow)
    var settings = stateAPI ? stateAPI.loadSettings() : null;
    var showArrow = !settings || settings.arrowGuidance !== false;
    if (showArrow && player.quests) {
      if (!player.quests.talked_linhnhi && mapData.id === 'mieu_hoang' && mapData.linhnhi) {
        drawGuidanceArrow(player.x, player.y, mapData.linhnhi.feetX, mapData.linhnhi.feetY);
      } else if (player.quests.talked_linhnhi && !player.quests.huntCompleted) {
        if (mapData.id === 'mieu_hoang') {
          // Chỉ về phía lối thoát đông
          drawGuidanceArrow(player.x, player.y, 1890, 475);
        } else if (mapData.id === 'rung-doc') {
          // Chỉ về bầy Thảo Tinh sống gần nhất
          var targetPack = getNearestLivingThaoTinh();
          if (targetPack) {
            drawGuidanceArrow(player.x, player.y, targetPack.x, targetPack.y);
          }
        }
      }
    }

    // 9. Chip thông báo lối thoát
    if (exitChip.timer > 0) {
      drawExitChip(player.x, player.y - 130, exitChip.text);
    }

    // 10. Màn đen chuyển cảnh (Fade)
    if (mapFade.alpha > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, ' + Math.min(1.0, mapFade.alpha) + ')';
      ctx.fillRect(camera.x, camera.y, camera.viewportW, camera.viewportH);
      ctx.restore();
    }

    ctx.restore();
  }

  function getNearestLivingThaoTinh() {
    var nearest = null;
    var minDist = 99999;
    for (var i = 0; i < fieldMonsters.length; i++) {
      var m = fieldMonsters[i];
      if (m.speciesId === 'thao_tinh' && m.state !== 'dead') {
        var d = Math.hypot(player.x - m.x, player.y - m.y);
        if (d < minDist) {
          minDist = d;
          nearest = m;
        }
      }
    }
    return nearest;
  }

  function drawMonster(m) {
    var spec = monstersAPI.SPECIES[m.speciesId];
    if (!spec) return;

    // Vòng phát sáng ngũ hành cho quái tinh anh (Brief §4 & Hồ sơ 36/49)
    if (m.isElite) {
      ctx.save();
      ctx.strokeStyle = '#55d882';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#55d882';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 75, 26, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Bóng râm dưới chân
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 10, 0.4)';
    ctx.beginPath();
    var shadowW = m.isElite ? 65 : 22;
    var shadowH = m.isElite ? 20 : 8;
    ctx.ellipse(m.x, m.y, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sprite quái vật từ sheet đã keyout
    var sheetKey = m.speciesId + '_sheet';
    var sheet = assets[sheetKey];
    if (sheet && sheet.complete) {
      var cellW = spec.cellW;
      var cellH = spec.cellH;
      var row = m.animRow || 0;
      var col = 0;

      // Tính khung hình hoạt ảnh theo hàng
      if (row === 0) col = Math.floor(m.animTime * 2.5) % 2; // Idle 2 frames
      else if (row === 1) col = Math.floor(m.animTime * 6.0) % 4; // Walk 4 frames
      else if (row === 2) col = Math.floor(m.animTime * 5.0) % 3; // Attack 3 frames
      else if (row === 3) col = Math.floor(m.animTime * 4.0) % 2; // Hit 2 frames
      else if (row === 4) col = Math.min(2, Math.floor(m.deathTimer * 3.0)); // Death 3 frames

      ctx.save();
      // Lật X nếu di chuyển sang trái
      if (m.facingLeft) {
        ctx.translate(m.x, m.y);
        ctx.scale(-1, 1);
        ctx.drawImage(
          sheet,
          col * cellW, row * cellH, cellW, cellH,
          -spec.feetOffsetX, -spec.feetOffsetY, cellW, cellH
        );
      } else {
        ctx.drawImage(
          sheet,
          col * cellW, row * cellH, cellW, cellH,
          m.x - spec.feetOffsetX, m.y - spec.feetOffsetY, cellW, cellH
        );
      }
      ctx.restore();
    }

    // Thanh máu trên đầu quái (Elite: thanh dài hơn + bảng tên)
    drawMonsterHpBar(m, spec);
  }

  function drawMonsterHpBar(m, spec) {
    var barW = m.isElite ? 100 : 42;
    var barH = m.isElite ? 7 : 4;
    var topY = m.y - spec.feetOffsetY - (m.isElite ? 22 : 12);
    var leftX = m.x - barW / 2;

    // Tên quái tinh anh
    if (m.isElite) {
      ctx.save();
      ctx.font = 'bold 12px "Noto Serif", serif';
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(m.name, m.x, topY - 5);
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(leftX - 1, topY - 1, barW + 2, barH + 2);

    var hpRatio = Math.max(0, m.hp / m.maxHp);
    ctx.fillStyle = m.isElite ? '#e8a53c' : '#e84545';
    ctx.fillRect(leftX, topY, barW * hpRatio, barH);
    ctx.restore();
  }

  function drawGroundDrop(drop) {
    var def = monstersAPI.ITEM_DEFS[drop.itemId];
    var isCurrency = (drop.itemId === 'linh-thach');

    ctx.save();
    // Vầng sáng mềm dưới vật phẩm
    ctx.shadowColor = isCurrency ? 'rgba(90, 220, 240, 0.9)' : 'rgba(85, 216, 130, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = isCurrency ? 'rgba(90, 220, 240, 0.25)' : 'rgba(85, 216, 130, 0.2)';
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 4, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vẽ icon từ icons-sheet (mỗi icon 48px, vẽ thu nhỏ 24x24)
    var iconsImg = assets.icons_sheet;
    if (iconsImg && iconsImg.complete && def) {
      var col = def.iconCol || 0;
      var row = def.iconRow || 0;
      var bob = Math.sin((performance.now() / 300) + drop.x) * 3;
      ctx.drawImage(
        iconsImg,
        col * 48, row * 48, 48, 48,
        drop.x - 12, drop.y - 18 + bob, 24, 24
      );
    }
    ctx.restore();
  }

  function renderCombatVfx() {
    for (var i = 0; i < visualEffects.length; i++) {
      var vfx = visualEffects[i];
      if (vfx.type === 'slash_crescent') {
        ctx.save();
        var progress = 1.0 - (vfx.timer / vfx.duration);
        ctx.strokeStyle = 'rgba(255, 245, 190, ' + (1.0 - progress) + ')';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        var angle = Math.atan2(vfx.targetY - vfx.y, vfx.targetX - vfx.x);
        var dist = 28 * progress;
        var cx = vfx.x + Math.cos(angle) * dist;
        var cy = vfx.y + Math.sin(angle) * dist;
        ctx.arc(cx, cy, 20, angle - 0.7, angle + 0.7);
        ctx.stroke();
        ctx.restore();
      } else if (vfx.type === 'vine_snare') {
        ctx.save();
        ctx.strokeStyle = '#55d882';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (var a = 0; a < 6; a++) {
          var ang = a * Math.PI / 3;
          ctx.moveTo(vfx.x, vfx.y);
          ctx.lineTo(vfx.x + Math.cos(ang) * 24, vfx.y + Math.sin(ang) * 12);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Projectile lá bay
    for (var p = 0; p < projectiles.length; p++) {
      var proj = projectiles[p];
      ctx.save();
      ctx.fillStyle = '#55d882';
      ctx.shadowColor = '#8cd96a';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function renderFloatingTexts() {
    ctx.save();
    for (var i = 0; i < floatingTexts.length; i++) {
      var ft = floatingTexts[i];
      var alpha = Math.max(0, ft.timer / ft.duration);

      if (ft.customColor) {
        ctx.fillStyle = ft.customColor;
        ctx.font = 'bold 13px "Noto Serif", serif';
      } else if (ft.type === 'player_damage') {
        ctx.fillStyle = 'rgba(240, 70, 70, ' + alpha + ')';
        ctx.font = 'bold 15px "Noto Serif", serif';
      } else if (ft.isCrit) {
        ctx.fillStyle = 'rgba(255, 220, 80, ' + alpha + ')';
        ctx.font = 'bold 19px "Noto Serif", serif';
      } else {
        ctx.fillStyle = 'rgba(85, 216, 130, ' + alpha + ')';
        ctx.font = 'bold 14px "Noto Serif", serif';
      }

      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  function drawQuestExclamation(x, y) {
    ctx.save();
    ctx.shadowColor = 'rgba(243, 217, 78, 0.85)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#8a2b22';
    ctx.strokeStyle = '#f3d94e';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff7dd';
    ctx.beginPath();
    ctx.rect(x - 1.8, y - 6.5, 3.6, 6.5);
    ctx.arc(x, y + 3.2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGuidanceArrow(fromX, fromY, toX, toY) {
    var angle = Math.atan2(toY - fromY, toX - fromX);
    var dist = Math.hypot(toX - fromX, toY - fromY);
    if (dist < 70) return;

    var radius = 48;
    var arrowX = fromX + Math.cos(angle) * radius;
    var arrowY = fromY - 30 + Math.sin(angle) * radius;

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);
    ctx.shadowColor = 'rgba(218, 175, 55, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f3d94e';
    ctx.strokeStyle = '#5d4a1e';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawExitChip(x, y, text) {
    ctx.save();
    ctx.font = 'bold 13px "Noto Serif", serif';
    var textMetrics = ctx.measureText(text);
    var boxW = textMetrics.width + 24;
    var boxH = 28;

    ctx.fillStyle = 'rgba(20, 26, 20, 0.88)';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff4d0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function getDirFromVelocity(vx, vy) {
    var angle = Math.atan2(vy, vx);
    var octant = Math.round((8 * angle) / (2 * Math.PI) + 8) % 8;
    var dirMap = [2, 1, 0, 7, 6, 5, 4, 3];
    return dirMap[octant] !== undefined ? dirMap[octant] : 0;
  }

  var EngineAPI = {
    init: initEngine,
    start: start,
    stop: stop,
    triggerPathTo: triggerPathTo,
    getDirFromVelocity: getDirFromVelocity,
    getCamera: function () { return camera; },
    castSkill: castSkill,
    handleRevive: handleRevive,
    switchMap: switchMap,
    getFieldMonsters: function () { return fieldMonsters; },
    getGroundDrops: function () { return groundDrops; },
    performContextAction: performContextAction,
    getActionContext: function () { return computeActionContext(); },
    startAutoQuestPath: startAutoQuestPath,
    toggleAutoQuestPath: toggleAutoQuestPath,
    cancelAutoPath: function () { cancelAutoPath(true); },
    isAutoPathActive: function () { return autoPath.active; },
    hasQuestTarget: function () { return getQuestTargetInfo() !== null; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EngineAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameEngine = EngineAPI;
  }
})(typeof window !== 'undefined' ? window : this);
