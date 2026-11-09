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
  var lastCombatState = false;
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

  var joystickVector = { x: 0, y: 0 };
  function setJoystickVector(vx, vy) {
    joystickVector.x = vx || 0;
    joystickVector.y = vy || 0;
  }

  var currentPath = [];
  var pendingInteraction = null;
  var clickRipple = null;
  var exitChip = { text: '', timer: 0 };
  var stepSoundAccumulator = 0;

  var playerMoving = false;
  var walkAnimTime = 0;
  // Đợt 3 (Note 6): pha đi bộ KHÓA THEO QUÃNG ĐƯỜNG (chuẩn Vô Sắc), không theo thời gian.
  // Chu kỳ bước đi hết 51.2px mặt đất ở tỉ lệ sheet (WALK3-REPORT: cycle ground distance 51px,
  // cadence 5.4 bước/s ở tốc độ 138px/s). Áp cho cả sheet 24 khung lẫn bản 8 khung.
  var WALK_CYCLE_DIST = 51.2;
  var walkDist = 0;
  var lastPX = null;
  var lastPY = null;
  // Đợt 3 (Note 8): chất lượng đồ họa do người chơi chọn — 'thap' tắt các hiệu ứng
  // tốn GPU nhất (vũng sáng gradient sau quái, quầng sáng điểm hái, mọi shadowBlur)
  // để máy yếu chạy mượt; 'trung'/'cao' giữ nguyên.
  var currentQuality = 'cao';
  function setQuality(q) {
    currentQuality = (q === 'thap' || q === 'trung' || q === 'cao') ? q : 'cao';
  }
  function qualityShadow(v) {
    return currentQuality === 'thap' ? 0 : v;
  }
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

  // Đợt 6 (mục 15): bộ nhớ đệm cài đặt cho các cổng vẽ theo khung hình (tránh đọc kho lưu mỗi khung)
  var _settingsCache = null;
  var _settingsCacheAt = 0;
  function getSettingsCached() {
    var nowMs = Date.now();
    if (!_settingsCache || nowMs - _settingsCacheAt > 500) {
      try { _settingsCache = stateAPI ? stateAPI.loadSettings() : {}; } catch (e) { _settingsCache = {}; }
      _settingsCacheAt = nowMs;
    }
    return _settingsCache || {};
  }

  // Chuyển map fade
  var mapFade = {
    alpha: 0,
    dir: 0, // 1: fade to black, -1: fade to game
    callback: null
  };
  // Yêu cầu chuyển map đến trong lúc đang fade: XẾP HÀNG chờ fade xong rồi chạy,
  // không được nuốt mất (trước đây switchMap bỏ qua lặng lẽ khi alpha > 0 — người
  // chơi bấm cửa/cổng ngay sau khi chuyển cảnh, nhất là máy yếu fade lâu, sẽ thấy
  // "bấm mà không vào được"; bản kiểm thử B6 vấp đúng lỗi này khi tải máy cao).
  var pendingMapSwitch = null;

  // Chống cổng nảy về (hotfix 2026-11-09): sau mỗi lần chuyển map, cổng thoát bị
  // KHÓA cho tới khi (a) qua 1,6 giây kể từ lúc tới nơi VÀ (b) người chơi đã đứng
  // NGOÀI mọi vùng cổng của map mới ít nhất một khung hình. Lý do: các điểm xuất
  // hiện nằm sát vùng cổng quay về (Tông Môn -> Miếu chỉ cách 50px, Đài Truyền
  // Tống chỉ 32-35px) nên người chơi giữ nguyên hướng đi sau khi qua cổng sẽ
  // chạm lại vùng cổng quay về trong chưa đầy nửa giây và bị trả về map cũ.
  var portalsArmed = true;
  var portalRearmAt = 0;

  // Tài nguyên đồ họa
  var assets = {};
  var assetsLoaded = false;
  var harvestReadyTimes = {};

  function preloadAssets(callback) {
    if (typeof Image === 'undefined') {
      if (callback) callback();
      return;
    }

    var urls = [
      'assets/chars/hanhan-idle.png',
      'assets/chars/hanhan-walk.png',
      'assets/chars/hanhan-face.png',
      'assets/chars/thaotinh-sheet.png',
      'assets/chars/nhenxanh-sheet.png',
      'assets/chars/cothuye-sheet.png',
      'assets/art/icons-sheet.png'
    ];

    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
    var allMaps = (holder && holder.maps) ? holder.maps : {};
    for (var mId in allMaps) {
      var m = allMaps[mId];
      if (m.bgImage && urls.indexOf(m.bgImage) === -1) urls.push(m.bgImage);
      if (m.standees) {
        for (var s = 0; s < m.standees.length; s++) {
          if (m.standees[s].asset && urls.indexOf(m.standees[s].asset) === -1) {
            urls.push(m.standees[s].asset);
          }
        }
      }
      if (m.npcs) {
        for (var n = 0; n < m.npcs.length; n++) {
          if (m.npcs[n].asset && urls.indexOf(m.npcs[n].asset) === -1) {
            urls.push(m.npcs[n].asset);
          }
        }
      }
    }

    // Đợt 4A: nạp sheet quái theo SPECIES — khóa assets là speciesId + '_sheet'
    // (và speciesId + '_skill_sheet' cho sheet chiêu của boss).
    var speciesSheetKeys = {};
    var monstersHolder = (typeof window !== 'undefined' && window.GameMonsters) ? window.GameMonsters : null;
    if (monstersHolder && monstersHolder.SPECIES) {
      for (var spId in monstersHolder.SPECIES) {
        var spDef = monstersHolder.SPECIES[spId];
        if (spDef.sheetAsset) {
          if (urls.indexOf(spDef.sheetAsset) === -1) urls.push(spDef.sheetAsset);
          (speciesSheetKeys[spDef.sheetAsset] = speciesSheetKeys[spDef.sheetAsset] || []).push(spId + '_sheet');
        }
        if (spDef.skillAsset) {
          if (urls.indexOf(spDef.skillAsset) === -1) urls.push(spDef.skillAsset);
          (speciesSheetKeys[spDef.skillAsset] = speciesSheetKeys[spDef.skillAsset] || []).push(spId + '_skill_sheet');
        }
      }
    }

    var remaining = urls.length;
    function checkDone() {
      remaining--;
      if (remaining <= 0) {
        assetsLoaded = true;
        if (callback) callback();
      }
    }

    for (var i = 0; i < urls.length; i++) {
      (function (url) {
        var img = new Image();
        img.onload = checkDone;
        img.onerror = function () {
          console.error('Không thể nạp tài nguyên:', url);
          checkDone();
        };
        img.src = url;
        assets[url] = img;
        if (speciesSheetKeys[url]) {
          for (var sk2 = 0; sk2 < speciesSheetKeys[url].length; sk2++) {
            assets[speciesSheetKeys[url][sk2]] = img;
          }
        }
        // Bí danh tương thích ngược
        if (url === 'assets/art/map-mieu-hoang-bg.png') assets['map_bg'] = img;
        if (url === 'assets/art/map-rung-doc-bg.png') assets['map_rung_doc_bg'] = img;
        if (url === 'assets/art/obj-temple.png') assets['temple'] = img;
        if (url === 'assets/art/obj-tree-pine.png') assets['pine'] = img;
        if (url === 'assets/art/obj-tree-broadleaf.png') assets['broadleaf_tree'] = img;
        if (url === 'assets/art/obj-fallen-log.png') assets['fallen_log'] = img;
        if (url === 'assets/art/npc-linhnhi.png') assets['linhnhi'] = img;
        if (url === 'assets/chars/hanhan-idle.png') assets['hanhan_idle'] = img;
        if (url === 'assets/chars/hanhan-walk.png') assets['hanhan_walk'] = img;
        if (url === 'assets/chars/hanhan-face.png') assets['hanhan_face'] = img;
        if (url === 'assets/chars/thaotinh-sheet.png') assets['thaotinh_sheet'] = img;
        if (url === 'assets/chars/nhenxanh-sheet.png') assets['nhenxanh_sheet'] = img;
        if (url === 'assets/chars/cothuye-sheet.png') assets['cothuye_sheet'] = img;
        if (url === 'assets/art/icons-sheet.png') assets['icons_sheet'] = img;
      })(urls[i]);
    }

    if (typeof Image !== 'undefined') {
      try {
        var hIdle = new Image();
        hIdle.onload = function () { assets.hanhan_hat_idle = hIdle; };
        hIdle.onerror = function () { assets.hanhan_hat_idle = null; };
        hIdle.src = 'assets/chars/hanhan-hat-idle.png';

        var hWalk = new Image();
        hWalk.onload = function () { assets.hanhan_hat_walk = hWalk; };
        hWalk.onerror = function () { assets.hanhan_hat_walk = null; };
        hWalk.src = 'assets/chars/hanhan-hat-walk.png';
      } catch (e) {}
    }
  }

  function initEngine(canvasEl, playerObj, mapObj, onReady) {
    canvas = canvasEl;
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    player = playerObj;
    if (player) {
      try {
        Object.defineProperty(player, 'path', {
          get: function () { return currentPath; },
          set: function (val) { currentPath = Array.isArray(val) ? val : []; },
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        player.path = currentPath;
      }
    }
    if (typeof mapObj === 'string') {
      currentMapId = mapObj;
      var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null);
      if (holder && holder.maps && holder.maps[mapObj]) {
        mapData = holder.maps[mapObj];
      } else if (holder && holder.getMap) {
        mapData = holder.getMap(mapObj);
      } else {
        mapData = holder;
      }
    } else if (mapObj) {
      mapData = mapObj;
      if (mapObj.id) currentMapId = mapObj.id;
    } else {
      mapData = typeof window !== 'undefined' ? window.MapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null);
      currentMapId = 'mieu_hoang';
    }
    stateAPI = typeof window !== 'undefined' ? window.GameState : (typeof require !== 'undefined' ? require('./state.js') : null);
    audioAPI = typeof window !== 'undefined' ? window.GameAudio : null;
    pathfinder = typeof window !== 'undefined' ? window.Pathfinder : (typeof require !== 'undefined' ? require('./pathfind.js') : null);
    combatAPI = typeof window !== 'undefined' ? window.GameCombat : null;
    monstersAPI = typeof window !== 'undefined' ? window.GameMonsters : (typeof require !== 'undefined' ? require('./monsters.js') : null);
    // Tương thích save cũ: đã nhận nhiệm vụ tông môn đầu tiên (sectStage >= 2) mà chưa
    // có kiếm nào trong túi/trang bị thì được cấp Kiếm Đệ Tử một lần ngay khi nạp.
    if (player && player.quests && (player.quests.sectStage || 0) >= 2 && !player.quests.starterSwordGranted) {
      grantStarterSword(false);
    }
    onReadyCallback = onReady;

    if (canvas) resizeCanvas();
    if (player && mapData) updateCamera();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resizeCanvas);
      setupInputs();
    }

    preloadAssets(function () {
      initFieldMonsters();
      if (onReadyCallback) onReadyCallback();
    });
  }

  var userZoom = 1.0;

  function getUserZoom() {
    return userZoom;
  }

  function setUserZoom(f) {
    var val = Number(f);
    if (!isFinite(val)) val = 1.0;
    userZoom = Math.max(0.75, Math.min(1.5, Math.round(val * 100) / 100));
    resizeCanvas();
    return userZoom;
  }

  function getCameraScale() {
    return camera.scale;
  }

  function resizeCanvas() {
    if (!canvas || typeof window === 'undefined') return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    var baseScale = h / 720;
    var targetScale = baseScale * userZoom;
    camera.scale = Math.max(0.4, Math.min(2.5, targetScale));
    camera.viewportW = w / camera.scale;
    camera.viewportH = h / camera.scale;
  }

  function initFieldMonsters() {
    spawnFieldMonstersForMap(mapData);
  }

  function spawnFieldMonstersForMap(map) {
    fieldMonsters = [];
    if (!monstersAPI || !map) return;
    var packs = map.monsterPacks;
    if (!packs && map.id === 'rung-doc') {
      packs = monstersAPI.RUNG_DOC_PACKS;
    }
    if (!packs || packs.length === 0) return;

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
        m.mapId = map.id;
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
        cancelAutoPath(true);
        cancelTravel();
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

  function isNpcActive(npc) {
    if (!npc) return false;
    if (!npc.questGate) return true;
    var s = (player && player.quests && player.quests.sectStage !== undefined) ? player.quests.sectStage : 0;
    if (npc.questGate === 'before_departure') return s < 1;
    if (npc.questGate === 'after_departure') return s >= 1;
    return true;
  }

  /**
   * Kiểm tra người chơi có đang đứng trong tầm tương tác của NPC:
   * 1. Khoảng cách chân-chân <= INTERACTION_RANGE (48px) — tầm tương tác chuẩn của game
   * 2. Hoặc khoảng cách tới standTile <= 60px
   * 3. Hoặc khoảng cách tâm-tâm <= 110px
   */
  function isPlayerInNpcRange(npc) {
    if (!player || !npc) return false;
    var distFeet = Math.hypot(player.x - npc.feetX, player.y - npc.feetY);
    if (distFeet <= INTERACTION_RANGE) return true;
    if (npc.standTile) {
      var distStand = Math.hypot(player.x - npc.standTile.x, player.y - npc.standTile.y);
      if (distStand <= 60) return true;
    }
    var cx = (npc.x || 0) + (npc.w || 72) / 2;
    var cy = (npc.y || 0) + (npc.h || 120) / 2;
    if (Math.hypot(player.x - cx, player.y - cy) <= 110) return true;
    return false;
  }

  function handleWorldClick(worldX, worldY) {
    if (!player || !mapData) return;
    if (autoPath.active) cancelAutoPath(true);
    if (travelState.active) cancelTravel();
    currentPath = [];
    pendingInteraction = null;
    if (player) player.path = currentPath;

    // 1. Kiểm tra click vào quái vật
    if (fieldMonsters.length > 0) {
      var clickedMonster = findMonsterAt(worldX, worldY);
      if (clickedMonster) {
        targetMonster = clickedMonster;
        var distM = Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y);
        if (distM > 50) {
          triggerPathTo(targetMonster.x, targetMonster.y, null);
        }
        return;
      }
    }

    targetMonster = null;

    // 2. Click vào NPC
    var npcsToCheck = (mapData.npcs && mapData.npcs.length > 0) ? mapData.npcs : [];
    if (mapData.linhnhi && npcsToCheck.indexOf(mapData.linhnhi) === -1) {
      npcsToCheck = npcsToCheck.concat([mapData.linhnhi]);
    }
    if (npcsToCheck.length > 0) {
      for (var n = 0; n < npcsToCheck.length; n++) {
        var npc = npcsToCheck[n];
        if (!isNpcActive(npc)) continue;
        var bounds = {
          x: npc.x - 10,
          y: npc.y - 10,
          w: npc.w + 20,
          h: npc.h + 20
        };
        if (worldX >= bounds.x && worldX <= bounds.x + bounds.w &&
            worldY >= bounds.y && worldY <= bounds.y + bounds.h) {
          if (isPlayerInNpcRange(npc)) {
            // Đứng gần: Mở thoại ngay trong cùng sự kiện chạm, không tạo đường đi, không di chuyển 1 pixel
            currentPath = [];
            pendingInteraction = null;
            if (player) player.path = currentPath;
            triggerDialogue(npc);
          } else {
            // Ở xa: Tự tìm đường tới cạnh NPC, mở thoại đúng một lần khi tới nơi
            (function (targetNpc) {
              var destX = (targetNpc.standTile && targetNpc.standTile.x !== undefined) ? targetNpc.standTile.x : targetNpc.feetX;
              var destY = (targetNpc.standTile && targetNpc.standTile.y !== undefined) ? targetNpc.standTile.y : targetNpc.feetY;
              triggerPathTo(destX, destY, {
                type: 'npc',
                onArrive: function () { triggerDialogue(targetNpc); }
              });
            })(npc);
          }
          return;
        }
      }
    }

    // 3. Click vào Harvest Node
    if (mapData.harvestNodes && mapData.harvestNodes.length > 0) {
      for (var h = 0; h < mapData.harvestNodes.length; h++) {
        var hn = mapData.harvestNodes[h];
        var hr = hn.radius || 48;
        if (Math.hypot(worldX - hn.x, worldY - hn.y) <= hr) {
          var distToHn = Math.hypot(player.x - hn.x, player.y - hn.y);
          if (distToHn <= hr) {
            currentPath = [];
            pendingInteraction = null;
            if (player) player.path = currentPath;
            executeHarvestNode(hn);
          } else {
            (function (targetHn) {
              triggerPathTo(targetHn.x, targetHn.y, {
                type: 'harvest',
                onArrive: function () { executeHarvestNode(targetHn); }
              });
            })(hn);
          }
          return;
        }
      }
    }

    // 4. Click vào Interactable
    if (mapData.interactables && mapData.interactables.length > 0) {
      for (var i = 0; i < mapData.interactables.length; i++) {
        var it = mapData.interactables[i];
        var ir = it.radius || 48;
        if (Math.hypot(worldX - it.x, worldY - it.y) <= ir) {
          var distToIt = Math.hypot(player.x - it.x, player.y - it.y);
          if (distToIt <= ir) {
            currentPath = [];
            pendingInteraction = null;
            if (player) player.path = currentPath;
            executeInteractableAction(it);
          } else {
            (function (targetIt) {
              triggerPathTo(targetIt.x, targetIt.y, {
                type: 'interactable',
                onArrive: function () { executeInteractableAction(targetIt); }
              });
            })(it);
          }
          return;
        }
      }
    }

    // 5. Click di chuyển thông thường
    triggerPathTo(worldX, worldY, null);
  }

  var lastOpenedDialogue = null;
  function triggerDialogue(npc) {
    if (!npc) return;
    var stepInfo = getQuestTargetInfo();
    var isTarget = stepInfo && stepInfo.kind === 'npc' && stepInfo.npcId === npc.id;
    var lines = (isTarget && npc.dialogueQuest && npc.dialogueQuest.length > 0) ? npc.dialogueQuest : (npc.dialogueDefault || npc.dialogue || []);
    var resolvedNpc = Object.assign({}, npc, { dialogue: lines });
    lastOpenedDialogue = resolvedNpc;

    var ui = (typeof window !== 'undefined' && window.GameUI)
      ? window.GameUI
      : (typeof globalThis !== 'undefined' && globalThis.GameUI)
        ? globalThis.GameUI
        : (global && global.GameUI ? global.GameUI : null);
    if (ui && ui.openDialogue) {
      ui.openDialogue(resolvedNpc);
    }
  }

  function triggerDialogueLinhNhi() {
    triggerDialogue(mapData.linhnhi);
  }

  function triggerLockedDoorToast() {
    if (audioAPI) audioAPI.playDoorKnock();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast((mapData.temple && mapData.temple.lockedToast) ? mapData.temple.lockedToast : 'Miếu đang khóa — đợt sau mở');
    }
  }

  // ---- Đợt questsword: TẶNG KIẾM ĐỆ TỬ khi nhận nhiệm vụ tông môn đầu tiên ----
  var STARTER_SWORD_ID = 'kiem-de-tu';
  var SWORD_ITEM_IDS = ['kiem-de-tu', 'kiem-go', 'kiem-sat'];
  var pendingSwordToast = false;

  function playerOwnsSword() {
    if (!player) return false;
    if (player.equipment && SWORD_ITEM_IDS.indexOf(player.equipment.weapon) !== -1) return true;
    if (player.bag && player.bag.slots) {
      for (var i = 0; i < player.bag.slots.length; i++) {
        var s = player.bag.slots[i];
        if (s && SWORD_ITEM_IDS.indexOf(s.itemId) !== -1) return true;
      }
    }
    return false;
  }

  // Tặng Kiếm Đệ Tử đúng một lần: cờ quests.starterSwordGranted lưu trong save.
  // Trả true nếu vừa tặng xong. feedback=false khi chạy lúc nạp save (toast hoãn tới start()).
  function grantStarterSword(feedback) {
    if (!player || !player.quests || !stateAPI) return false;
    if (player.quests.starterSwordGranted) return false;
    if (playerOwnsSword()) {
      player.quests.starterSwordGranted = true;
      stateAPI.savePlayer(player);
      return false;
    }
    var res = stateAPI.addItemToBag(player, STARTER_SWORD_ID, 1);
    if (!res || !res.success) return false; // Túi đầy: giữ cờ tắt, lần nạp sau thử lại
    player.quests.starterSwordGranted = true;
    stateAPI.savePlayer(player);
    if (feedback) {
      spawnFloatingText('Nhận được: Kiếm Đệ Tử', player.x, player.y - 35, '#ffe9a8');
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.refreshHUD();
        window.GameUI.showToast('Nhận được: Kiếm Đệ Tử');
      }
    } else {
      pendingSwordToast = true;
    }
    return true;
  }

  function handleNpcTalked(npcId) {
    if (!player || !player.quests) return;
    var q = player.quests;
    if (npcId === 'npc_linhnhi') {
      if (!q.talked_linhnhi) {
        q.talked_linhnhi = true;
        q.current = 'hunt';
        q.thaotinhKills = 0;
        q.huntCompleted = false;
        if (stateAPI) stateAPI.savePlayer(player);
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Săn Thảo Tinh ở Rừng Độc (0/5)');
        }
      } else if (q.huntCompleted && (q.sectStage || 0) === 0) {
        q.sectStage = 1;
        if (stateAPI) stateAPI.savePlayer(player);
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Báo danh ở Lối Vào tông môn');
        }
      }
    } else if (npcId === 'npc_tiepdan') {
      if ((q.sectStage || 0) === 1) {
        q.sectStage = 2;
        if (stateAPI) stateAPI.savePlayer(player);
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Diện kiến Chưởng Môn ở Đại Điện');
        }
        // Nhận nhiệm vụ tông môn đầu tiên: tông môn cấp ngay Kiếm Đệ Tử (toast kiếm hiện sau cùng)
        grantStarterSword(true);
      }
    } else if (npcId === 'npc_chuongmon') {
      if ((q.sectStage || 0) === 2) {
        q.sectStage = 3;
        player.linhThach = (player.linhThach || 0) + 20;
        if (audioAPI) audioAPI.playChime();
        spawnFloatingText('+20 Linh Thạch', player.x, player.y - 35, '#ffe9a8');
        if (stateAPI) stateAPI.savePlayer(player);
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Nhận lệnh từ Chấp Sự');
        }
      }
    } else if (npcId === 'npc_chapsu') {
      if ((q.sectStage || 0) === 3) {
        q.sectStage = 4;
        if (!q.mainStage) q.mainStage = 1;
        player.linhThach = (player.linhThach || 0) + 30;
        if (audioAPI) audioAPI.playChime();
        spawnFloatingText('+30 Linh Thạch', player.x, player.y - 35, '#ffe9a8');
        if (stateAPI) stateAPI.savePlayer(player);
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhập môn hoàn thành! Đài Truyền Tống phía đông nam đã mở.');
        }
      } else if ((q.sectStage || 0) >= 4) {
        if (q.mainStage === 8) {
          var countItem = function (id) {
            return stateAPI ? stateAPI.countItemInBag(player, id) : 0;
          };
          var c1 = countItem('linh-chi-rung');
          var c2 = countItem('bang-tuy');
          var c3 = countItem('hoa-tinh-tho');
          var c4 = countItem('nguyen-tinh-moc');
          var c5 = countItem('nguyen-tinh-thuy');
          var lt = player.linhThach || 0;
          if (c1 >= 3 && c2 >= 1 && c3 >= 2 && c4 >= 1 && c5 >= 1 && lt >= 200) {
            refineTrucCoDan();
          }
        }
      }
    }
  }

  function executeInteractableAction(it) {
    if (!it || !it.action) return;
    switch (it.action) {
      case 'temple_door':
        triggerLockedDoorToast();
        break;
      case 'door_enter':
        if (it.targetMap) {
          switchMap(it.targetMap, it.targetSpawn || { x: 600, y: 690 });
        }
        break;
      case 'teleport':
        if (typeof window !== 'undefined' && window.GameUI && window.GameUI.openTeleportModal) {
          window.GameUI.openTeleportModal();
        }
        break;
      case 'restore_spring':
        var now = Date.now();
        var last = player.lastSpringUse || 0;
        var cdMs = (it.cooldownSec || 60) * 1000;
        if (now - last < cdMs) {
          var remSec = Math.ceil((cdMs - (now - last)) / 1000);
          if (typeof window !== 'undefined' && window.GameUI) {
            window.GameUI.showToast('Linh tuyền đang tích tụ linh khí (' + remSec + 's)');
          }
          return;
        }
        player.lastSpringUse = now;
        player.hp = player.hpMax;
        player.linhLuc = player.linhLucMax;
        spawnFloatingText('Khí huyết & Linh lực đầy!', player.x, player.y - 35, '#7ce898');
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Đã hồi phục toàn bộ Khí Huyết và Linh Lực');
        }
        break;
      case 'meditate':
        player.linhLuc = player.linhLucMax;
        spawnFloatingText('Linh lực đầy!', player.x, player.y - 35, '#6ee7b7');
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Đả tọa tĩnh tâm: Linh Lực đã hồi phục');
        }
        break;
      case 'rest_inn':
        player.hp = player.hpMax;
        player.linhLuc = player.linhLucMax;
        spawnFloatingText('Hồi phục hoàn toàn!', player.x, player.y - 35, '#7ce898');
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nghỉ ngơi tại nhà trọ: Khí Huyết và Linh Lực đã tràn đầy');
        }
        break;
      case 'notice_board':
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Bảng Tông Môn: Sự kiện bí cảnh sẽ mở ở đợt sau.');
        }
        break;
      case 'practice_dummy':
        var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { attack: 10 };
        var dmg = Math.round(stats.attack * (0.9 + Math.random() * 0.2));
        player.dir = getDirFromVelocity(it.x - player.x, it.y - player.y);
        if (audioAPI) audioAPI.playSlash();
        visualEffects.push({
          type: 'slash_crescent',
          x: player.x,
          y: player.y - 25,
          targetX: it.x,
          targetY: it.y - 15,
          timer: 0.22,
          duration: 0.22
        });
        spawnFloatingText(dmg + '', it.x, it.y - 35, '#ffffff');
        break;
      case 'locked_portal':
        if (audioAPI) audioAPI.playDoorKnock();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Bí cảnh mở theo sự kiện — đợt sau');
        }
        break;
      case 'locked_arena':
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Luận võ mở ở đợt sau');
        }
        break;
      default:
        break;
    }
  }

  function executeHarvestNode(node) {
    if (!node || !player) return;
    var nowSec = performance.now() / 1000;
    var readyAt = harvestReadyTimes[node.id] || 0;
    if (nowSec < readyAt) {
      var remSec = Math.ceil(readyAt - nowSec);
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Linh dược đang lớn (' + remSec + 's)');
      }
      return;
    }
    harvestReadyTimes[node.id] = nowSec + (node.respawnSec || 90);
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.harvests = (player.stats.harvests || 0) + 1;

    if (node.itemId === 'linh-thach') {
      var min = node.countMin || 3;
      var max = node.countMax || 5;
      var count = min + Math.floor(Math.random() * (max - min + 1));
      player.linhThach = (player.linhThach || 0) + count;
      spawnFloatingText('+' + count + ' Linh Thạch', player.x, player.y - 35, '#ffe9a8');
    } else {
      var countItem = node.count || 1;
      if (stateAPI) stateAPI.addItemToBag(player, node.itemId, countItem);
      var def = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS[node.itemId] : null;
      var name = def ? def.name : (node.name || node.itemId);
      spawnFloatingText('+' + countItem + ' ' + name, player.x, player.y - 35, '#7ce898');
    }

    if (audioAPI) audioAPI.playPickup();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.refreshHUD();
    }
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
  // NÚT HÀNH ĐỘNG THEO NGỮ CẢNH (Đợt 2 & Đợt 3)
  // Ưu tiên: thu hái (48px) > vật tương tác (radius) > nói chuyện NPC (48px) > nhặt đồ (72px) > đánh
  // ============================================================
  function computeActionContext() {
    if (!player || !mapData) return { mode: 'attack', label: 'Đánh' };

    // 1. Ready harvest node (radius <= 48px)
    if (mapData.harvestNodes) {
      var nowSec = performance.now() / 1000;
      for (var h = 0; h < mapData.harvestNodes.length; h++) {
        var hn = mapData.harvestNodes[h];
        var isReady = nowSec >= (harvestReadyTimes[hn.id] || 0);
        if (isReady && Math.hypot(player.x - hn.x, player.y - hn.y) <= (hn.radius || 48)) {
          return { mode: 'harvest', label: 'Hái', harvestNode: hn };
        }
      }
    }

    // 2. Interactables in radius
    if (mapData.interactables) {
      for (var i = 0; i < mapData.interactables.length; i++) {
        var it = mapData.interactables[i];
        if (Math.hypot(player.x - it.x, player.y - it.y) <= (it.radius || 48)) {
          return { mode: 'interact', label: it.label || 'Tương Tác', interactable: it };
        }
      }
    }

    // 3. Active NPCs in interaction range
    if (mapData.npcs) {
      for (var n = 0; n < mapData.npcs.length; n++) {
        var npc = mapData.npcs[n];
        if (isNpcActive(npc) && isPlayerInNpcRange(npc)) {
          return { mode: 'talk', label: 'Nói Chuyện', npc: npc };
        }
      }
    }

    // 4. Ground drops in 72px
    for (var d = 0; d < groundDrops.length; d++) {
      if (Math.hypot(player.x - groundDrops[d].x, player.y - groundDrops[d].y) <= ACTION_PICKUP_RADIUS) {
        return { mode: 'pickup', label: 'Nhặt Đồ' };
      }
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
    if (ctx.mode === 'harvest' && ctx.harvestNode) { executeHarvestNode(ctx.harvestNode); return; }
    if (ctx.mode === 'interact' && ctx.interactable) { executeInteractableAction(ctx.interactable); return; }
    if (ctx.mode === 'talk' && ctx.npc) { triggerDialogue(ctx.npc); return; }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('combat_action'));
    }
  }

  // ============================================================
  // NÚT TỰ TÌM ĐƯỜNG THEO NHIỆM VỤ & ĐỊNH TUYẾN ĐA CHẶNG (BFS)
  // Single Source of Truth cho Mũi tên dẫn đường, Tự tìm đường & Panel nhiệm vụ
  // ============================================================
  function getWeakestTuVi(p) {
    if (!p || !p.paths) return 0;
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var min = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var v = (p.paths[keys[i]] && typeof p.paths[keys[i]].tuVi === 'number') ? p.paths[keys[i]].tuVi : 0;
      if (v < min) min = v;
    }
    return isFinite(min) ? min : 0;
  }

  function getQuestTargetInfo() {
    if (!player || !player.quests) return null;
    var q = player.quests;
    if (!q.talked_linhnhi) {
      return { stepId: 'talk_linhnhi', stage: 0, mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' };
    }
    if (!q.huntCompleted) {
      return { stepId: 'hunt', stage: 0, mapId: 'rung-doc', kind: 'hunt' };
    }
    var sectStage = (q.sectStage !== undefined) ? q.sectStage : 0;
    if (sectStage === 0) {
      return { stepId: 'farewell_linhnhi', stage: 0, mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' };
    }
    if (sectStage === 1) {
      return { stepId: 'report_gate', stage: 1, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_tiepdan' };
    }
    if (sectStage === 2) {
      return { stepId: 'meet_master', stage: 2, mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon' };
    }
    if (sectStage === 3) {
      return { stepId: 'orders', stage: 3, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' };
    }

    // Khi sectStage >= 4: Chuỗi nhiệm vụ chính (Đợt 6 - Việc 1)
    var mainStage = q.mainStage;
    if (!mainStage || mainStage === 0) {
      return { stepId: 'done', stage: 4, mapId: null, kind: 'point' };
    }

    var minTuVi = getWeakestTuVi(player);
    var hasItem = function (id, count) {
      return stateAPI ? stateAPI.hasItemInBag(player, id, count) : false;
    };

    // Tự động thăng tiến mainStage khi đạt điều kiện
    if (mainStage === 1 && minTuVi >= 30) {
      q.mainStage = 2;
      mainStage = 2;
    }
    if (mainStage === 2 && (q.nhenKills || 0) >= 3) {
      q.mainStage = 3;
      mainStage = 3;
    }
    if (mainStage === 3 && hasItem('nguyen-tinh-moc', 1)) {
      q.mainStage = 4;
      mainStage = 4;
    }
    if (mainStage === 4 && minTuVi >= 300) {
      q.mainStage = 5;
      mainStage = 5;
    }
    if (mainStage === 5 && (q.bangXaKills || 0) >= 4) {
      q.mainStage = 6;
      mainStage = 6;
    }
    if (mainStage === 6 && hasItem('nguyen-tinh-thuy', 1) && hasItem('bang-tuy', 1)) {
      q.mainStage = 7;
      mainStage = 7;
    }
    if (mainStage === 7 && minTuVi >= 600) {
      q.mainStage = 8;
      mainStage = 8;
    }
    if (mainStage === 8 && hasItem('truc-co-dan', 1)) {
      q.mainStage = 9;
      mainStage = 9;
    }
    if (mainStage === 9 && (player.realm === 'Trúc Cơ Sơ Kỳ' || (minTuVi >= 900 && !hasItem('truc-co-dan', 1) && player.realm !== 'Phàm Nhân' && player.realm.indexOf('Luyện Khí') === -1))) {
      q.mainStage = 10;
      mainStage = 10;
    }

    switch (mainStage) {
      case 1:
        return {
          stepId: 'main_1',
          mainStage: 1,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'point',
          x: 960,
          y: 1250,
          title: 'Rèn Luyện Căn Bản',
          desc: 'Đưa cả 5 đường tu đạt 30 tu vi (săn Rừng Độc, hái Vườn Linh Dược Sơn Cốc, đổi đan chỗ Chấp Sự).'
        };
      case 2:
        return {
          stepId: 'main_2',
          mainStage: 2,
          stage: 4,
          mapId: 'rung-doc',
          kind: 'monster',
          speciesId: 'nhen_xanh',
          title: 'Trừ Nhện Rừng Xanh',
          desc: 'Tiêu diệt 3 Nhện Rừng Xanh ở Rừng Độc Thanh Tụy.'
        };
      case 3:
        return {
          stepId: 'main_3',
          mainStage: 3,
          stage: 4,
          mapId: 'rung-doc',
          kind: 'point',
          x: 1640,
          y: 745,
          title: 'Thử Thách Cổ Thụ',
          desc: 'Hạ gục Mộc Linh Cổ Vương ở Rừng Độc và đoạt lấy Nguyên Tinh Mộc.'
        };
      case 4:
        return {
          stepId: 'main_4',
          mainStage: 4,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'point',
          x: 960,
          y: 1250,
          title: 'Mở Cổng Hồ Băng',
          desc: 'Tu luyện cả 5 đường đạt 300 tu vi (Luyện Khí tầng 4) để mở cổng Hồ Băng Hàn Kính.'
        };
      case 5:
        return {
          stepId: 'main_5',
          mainStage: 5,
          stage: 4,
          mapId: 'ho-bang',
          kind: 'monster',
          speciesId: 'han_xa',
          title: 'Săn Băng Xà',
          desc: 'Tiêu diệt 4 Băng Xà (Hàn Kính Thủy Xà) tại Hồ Băng Hàn Kính.'
        };
      case 6:
        return {
          stepId: 'main_6',
          mainStage: 6,
          stage: 4,
          mapId: 'ho-bang',
          kind: 'point',
          x: 1180,
          y: 680,
          title: 'Chúa Tể Hồ Băng',
          desc: 'Hạ gục Hàn Kính Giao Vương tại Hồ Băng, thu thập Nguyên Tinh Thủy và Băng Tủy.'
        };
      case 7:
        return {
          stepId: 'main_7',
          mainStage: 7,
          stage: 4,
          mapId: 'dai-truyen-tong',
          kind: 'point',
          x: 480,
          y: 320,
          title: 'Cân Bằng Ngũ Hành',
          desc: 'Tu luyện cả 5 đường đạt 600 tu vi (Luyện Khí tầng 7) để mở cổng Mỏ Lửa Xích Diệm.'
        };
      case 8:
        var countItem = function (id) {
          return stateAPI ? stateAPI.countItemInBag(player, id) : 0;
        };
        if (countItem('linh-chi-rung') < 3) {
          return {
            stepId: 'main_8_linhchi',
            mainStage: 8,
            stage: 4,
            mapId: 'son-coc',
            kind: 'point',
            x: 460,
            y: 320,
            title: 'Luyện Trúc Cơ Đan',
            desc: 'Thu thập 3 Linh Chi Rừng tại Sơn Cốc để luyện đan.'
          };
        }
        if (countItem('hoa-tinh-tho') < 2) {
          return {
            stepId: 'main_8_hoatinh',
            mainStage: 8,
            stage: 4,
            mapId: 'mo-lua',
            kind: 'monster',
            speciesId: 'diem_ma',
            title: 'Luyện Trúc Cơ Đan',
            desc: 'Thu thập 2 Hỏa Tinh Thổ từ quái Mỏ Lửa Xích Diệm để luyện đan.'
          };
        }
        return {
          stepId: 'main_8_chapsu',
          mainStage: 8,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'npc',
          npcId: 'npc_chapsu',
          title: 'Luyện Trúc Cơ Đan',
          desc: 'Đem đủ nguyên liệu và 200 Linh Thạch tới gặp Chấp Sự Đường để luyện Trúc Cơ Đan.'
        };
      case 9:
        return {
          stepId: 'main_9',
          mainStage: 9,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'point',
          x: 960,
          y: 700,
          title: 'Đột Phá Trúc Cơ',
          desc: 'Đưa cả 5 đường đạt 900 tu vi (Luyện Khí viên mãn), sau đó dùng Trúc Cơ Đan để đột phá!'
        };
      default:
        // mainStage >= 10: Bước dự phòng KHÔNG BAO GIỜ TRỐNG
        return {
          stepId: 'post_main_kiem_trung',
          mainStage: 10,
          stage: 10,
          mapId: 'dai-truyen-tong',
          kind: 'point',
          x: 480,
          y: 320,
          title: 'Chinh Phục Kiếm Trủng',
          desc: 'Rèn luyện đạt Trúc Cơ Trung Kỳ để mở cổng Kiếm Trủng Vô Danh.'
        };
    }
  }

  function resolveQuestDestination(info) {
    if (!info) return null;
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    var targetMap = holder ? (holder.getMap ? holder.getMap(info.mapId) : holder.maps[info.mapId]) : mapData;

    if (info.kind === 'npc') {
      if (!targetMap || !targetMap.npcs) return null;
      for (var i = 0; i < targetMap.npcs.length; i++) {
        var n = targetMap.npcs[i];
        if (n.id === info.npcId) {
          var st = n.standTile || { x: n.feetX, y: n.feetY };
          return { x: st.x, y: st.y, radius: 26, npc: n, mapId: info.mapId };
        }
      }
      return null;
    }
    if (info.kind === 'hunt') {
      var near = getNearestLivingThaoTinh();
      if (near) return { x: near.x, y: near.y, radius: 64, mapId: 'rung-doc' };
      if (monstersAPI && monstersAPI.RUNG_DOC_PACKS) {
        for (var p = 0; p < monstersAPI.RUNG_DOC_PACKS.length; p++) {
          var pk = monstersAPI.RUNG_DOC_PACKS[p];
          if (pk.speciesId === 'thao_tinh' && pk.anchor) {
            return { x: pk.anchor.x, y: pk.anchor.y, radius: 44, mapId: 'rung-doc' };
          }
        }
      }
      return { x: 420, y: 750, radius: 64, mapId: 'rung-doc' };
    }
    if (info.kind === 'monster') {
      if (currentMapId === info.mapId && fieldMonsters && fieldMonsters.length > 0) {
        var bestM = null;
        var bestDist = Infinity;
        for (var mIdx = 0; mIdx < fieldMonsters.length; mIdx++) {
          var fm = fieldMonsters[mIdx];
          if (fm.state === 'dead' || fm.hp <= 0) continue;
          var matchSpec = (fm.speciesId === info.speciesId) ||
            (info.speciesId === 'han_xa' && fm.speciesId === 'bang_xa') ||
            (info.speciesId === 'bang_xa' && fm.speciesId === 'han_xa');
          if (matchSpec) {
            var d = Math.hypot(player.x - fm.x, player.y - fm.y);
            if (d < bestDist) {
              bestDist = d;
              bestM = fm;
            }
          }
        }
        if (bestM) {
          return { x: bestM.x, y: bestM.y, radius: 44, mapId: info.mapId };
        }
      }
      if (targetMap && targetMap.monsterPacks) {
        for (var pi = 0; pi < targetMap.monsterPacks.length; pi++) {
          var pack = targetMap.monsterPacks[pi];
          var matchPack = (pack.speciesId === info.speciesId) ||
            (info.speciesId === 'han_xa' && pack.speciesId === 'bang_xa') ||
            (info.speciesId === 'bang_xa' && pack.speciesId === 'han_xa');
          if (matchPack && pack.anchor) {
            return { x: pack.anchor.x, y: pack.anchor.y, radius: 44, mapId: info.mapId };
          }
        }
      }
      return { x: 960, y: 640, radius: 44, mapId: info.mapId };
    }
    if (info.kind === 'point' || (info.x !== undefined && info.y !== undefined)) {
      return { x: info.x, y: info.y, radius: info.radius || 32, mapId: info.mapId };
    }
    return null;
  }

  function findRoute(fromMapId, toMapId) {
    if (!fromMapId || !toMapId) return null;
    if (fromMapId === toMapId) return [fromMapId];
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    if (!holder || !holder.maps) return null;

    var queue = [[fromMapId]];
    var visited = {};
    visited[fromMapId] = true;

    while (queue.length > 0) {
      var pathArr = queue.shift();
      var node = pathArr[pathArr.length - 1];
      var m = holder.getMap ? holder.getMap(node) : holder.maps[node];
      if (!m || !m.exits) continue;

      for (var i = 0; i < m.exits.length; i++) {
        var nextHop = m.exits[i].targetMap;
        if (!nextHop) continue;
        if (nextHop === toMapId) {
          return pathArr.concat([nextHop]);
        }
        if (!visited[nextHop]) {
          visited[nextHop] = true;
          queue.push(pathArr.concat([nextHop]));
        }
      }
    }
    return null;
  }

  function findNextHopExit(fromMapId, toMapId) {
    var route = findRoute(fromMapId, toMapId);
    if (!route || route.length < 2) return null;
    var nextHopMapId = route[1];
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    var currentM = (holder && holder.getMap) ? holder.getMap(fromMapId) : mapData;
    if (!currentM || !currentM.exits) return null;

    for (var i = 0; i < currentM.exits.length; i++) {
      var ex = currentM.exits[i];
      if (ex.targetMap === nextHopMapId) {
        var x = ex.target ? ex.target.x : (ex.rect ? ex.rect.x + ex.rect.w / 2 : 0);
        var y = ex.target ? ex.target.y : (ex.rect ? ex.rect.y + ex.rect.h / 2 : 0);
        return { exit: ex, target: { x: x, y: y }, targetMap: nextHopMapId };
      }
    }
    return null;
  }

  function startAutoQuestPath(autoStarted) {
    var info = getQuestTargetInfo();
    if (!info || info.stepId === 'done') {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Chưa có mục tiêu nhiệm vụ.');
      }
      return;
    }
    autoPath.active = true;
    autoPath.autoStarted = !!autoStarted;
    autoPath.lastLegAt = 0;
    autoPath.combatStamp = lastCombatTime;
    targetMonster = null;
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.syncAutoPathButton) {
      window.GameUI.syncAutoPathButton();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('autopath_started'));
    }
  }

  function cancelAutoPath(clearPath) {
    autoPath.active = false;
    autoPath.autoStarted = false;
    if (clearPath) {
      currentPath = [];
      pendingInteraction = null;
      if (player) player.path = currentPath;
    }
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.syncAutoPathButton) {
      window.GameUI.syncAutoPathButton();
    }
  }

  function failAutoPath(msg) {
    cancelAutoPath(true);
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(msg);
    }
  }

  function toggleAutoQuestPath() {
    if (autoPath.active) {
      cancelAutoPath(true);
      return;
    }
    startAutoQuestPath(false);
  }

  function updateAutoPath() {
    if (!autoPath.active || !player || !mapData) return;
    if (mapFade.alpha > 0) return; // Đang chuyển cảnh: chờ sang hẳn bản đồ mới
    var info = getQuestTargetInfo();
    if (!info || info.stepId === 'done') { cancelAutoPath(false); return; }
    var now = performance.now();

    if (info.mapId === currentMapId) {
      var dest = resolveQuestDestination(info);
      if (!dest) { failAutoPath('Mục tiêu chưa xuất hiện, hãy thử lại sau.'); return; }
      var d = Math.hypot(player.x - dest.x, player.y - dest.y);
      if (d <= dest.radius) { cancelAutoPath(false); return; } // Đã tới nơi: dừng cạnh mục tiêu, không tự mở thoại
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
        var exitHop = findNextHopExit(currentMapId, info.mapId);
        if (!exitHop) { failAutoPath('Không tìm được đường sang ' + info.mapId); return; }
        autoPath.lastLegAt = now;
        triggerPathTo(exitHop.target.x, exitHop.target.y, null);
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
    if (!pathfinder || !mapData || !player) return;

    clickRipple = {
      x: worldX,
      y: worldY,
      radius: 4,
      maxRadius: 22,
      alpha: 0.95
    };

    var grid = mapData.collisionGrid;
    var gs = mapData.gridSize || 24;
    var rows = grid ? grid.length : 0;
    var cols = (rows > 0 && grid[0]) ? grid[0].length : 0;

    var path = pathfinder.findPath(
      player.x,
      player.y,
      worldX,
      worldY,
      grid,
      gs
    );

    // Nếu không tìm được đường, dùng findNearestWalkable hoặc quét bán kính tăng dần quanh đích (Đợt 6 - Việc 3)
    if ((!path || path.length === 0) && grid && rows > 0 && cols > 0) {
      var tgx = Math.max(0, Math.min(cols - 1, Math.floor(worldX / gs)));
      var tgy = Math.max(0, Math.min(rows - 1, Math.floor(worldY / gs)));

      var near = pathfinder.findNearestWalkable ? pathfinder.findNearestWalkable(tgx, tgy, grid) : null;
      if (near) {
        var altX = (near.gx + 0.5) * gs;
        var altY = (near.gy + 0.5) * gs;
        path = pathfinder.findPath(player.x, player.y, altX, altY, grid, gs);
      }

      // Quét bán kính tăng dần tìm ô đi được mà findPath tới được
      if (!path || path.length === 0) {
        var maxR = 25;
        for (var r = 1; r <= maxR && (!path || path.length === 0); r++) {
          for (var dx = -r; dx <= r && (!path || path.length === 0); dx++) {
            for (var dy = -r; dy <= r; dy++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              var nx = tgx + dx;
              var ny = tgy + dy;
              if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] === 0) {
                var candX = (nx + 0.5) * gs;
                var candY = (ny + 0.5) * gs;
                var testPath = pathfinder.findPath(player.x, player.y, candX, candY, grid, gs);
                if (testPath && testPath.length > 0) {
                  path = testPath;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (path && path.length > 0) {
      if (path.length > 1 && Math.hypot(path[0].x - player.x, path[0].y - player.y) < 6) {
        path.shift();
      }
      currentPath = path;
      if (player) player.path = currentPath;
      pendingInteraction = interaction;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('player_first_move'));
      }
      return path;
    } else {
      currentPath = [];
      if (player) player.path = currentPath;
      pendingInteraction = null;
      return [];
    }
  }

  function triggerDialogueLinhNhi() {
    triggerDialogue(mapData.linhnhi);
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
    if (mapFade.alpha > 0 || mapFade.dir !== 0) {
      // Đang fade chuyển cảnh: xếp hàng (yêu cầu cuối thắng), chạy ngay khi fade xong
      pendingMapSwitch = { id: targetMapId, spawn: targetSpawn };
      return;
    }
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
      // Đợt 3 (Note 3B): chuyển theme nhạc + môi trường theo map, crossfade trong GameMusic
      if (typeof window !== 'undefined' && window.GameMusic) {
        window.GameMusic.setMap(targetMapId);
      }
      var mapHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
      if (mapHolder && mapHolder.getMap) {
        mapData = mapHolder.getMap(targetMapId);
      }

      spawnFieldMonstersForMap(mapData);

      player.x = targetSpawn.x;
      player.y = targetSpawn.y;
      // Khóa cổng thoát sau khi tới nơi (xem portalsArmed ở trên): chỉ mở lại khi
      // đã qua thời gian ân hạn và người chơi ra khỏi mọi vùng cổng.
      portalsArmed = false;
      portalRearmAt = performance.now() + 1600;
      // Yêu cầu chuyển map xếp hàng trùng hệt chuyến vừa hoàn thành (do đứng trong
      // vùng cổng suốt lúc fade-out gọi lại switchMap mỗi khung hình) là dư thừa:
      // hủy để khỏi fade hai lần vô ích. Yêu cầu khác map/điểm đến vẫn giữ nguyên.
      if (pendingMapSwitch && pendingMapSwitch.id === targetMapId && pendingMapSwitch.spawn &&
          pendingMapSwitch.spawn.x === targetSpawn.x && pendingMapSwitch.spawn.y === targetSpawn.y) {
        pendingMapSwitch = null;
      }
      currentPath = [];
      targetMonster = null;
      groundDrops = [];
      visualEffects = [];
      projectiles = [];
      currentZoneId = null;

      updateCamera();
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.refreshHUD();
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('map_switched'));
      }
    };
  }

  function teleportTo(mapId, x, y) {
    var gateHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
    var gateMap = (gateHolder && gateHolder.getMap) ? gateHolder.getMap(mapId) : null;
    if (gateMap && gateMap.minRealmRank) {
      var gateState = (typeof window !== 'undefined' && window.GameState) ? window.GameState : stateAPI;
      var myRank = (gateState && gateState.getRealmRank && player) ? gateState.getRealmRank(player) : 99;
      if (myRank < gateMap.minRealmRank) {
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Cảnh giới chưa đủ — ' + gateMap.name + ' cần ' + (gateMap.minRealmLabel || '') + '. Hãy tu luyện cân bằng cả năm đường.');
        }
        return;
      }
    }
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.closeTeleportModal) {
      window.GameUI.closeTeleportModal();
    }
    var mapHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
    var targetMap = (mapHolder && mapHolder.getMap) ? mapHolder.getMap(mapId) : mapData;
    var spawn = (x !== undefined && y !== undefined) ? { x: x, y: y } : (targetMap ? targetMap.spawn : { x: 560, y: 620 });
    switchMap(mapId, spawn);
  }

  // ============================================================
  // DI CHUYỂN BẰNG BẢN ĐỒ TỔNG QUAN & DÙNG VẬT PHẨM (Đợt 6 - Việc 1 & 4)
  // ============================================================
  var travelState = {
    active: false,
    targetMapId: null,
    routePlan: null,
    combatStamp: 0,
    lastLegAt: 0
  };

  function planTravelRoute(fromMapId, toMapId) {
    if (!fromMapId || !toMapId) return null;
    if (fromMapId === toMapId) return { route: [fromMapId], needsTeleport: false, finalMapId: toMapId };

    var directRoute = findRoute(fromMapId, toMapId);
    if (directRoute) {
      return { route: directRoute, needsTeleport: false, finalMapId: toMapId };
    }

    var teleportMaps = ['ho-bang', 'mo-lua', 'hoang-mac', 'kiem-trung'];
    if (teleportMaps.indexOf(toMapId) !== -1) {
      var routeToAltar = findRoute(fromMapId, 'dai-truyen-tong');
      if (routeToAltar) {
        return { route: routeToAltar.concat([toMapId]), needsTeleport: true, finalMapId: toMapId };
      }
    }
    return null;
  }

  function travelToMap(mapId) {
    if (!mapId || !player) return { ok: false, reason: 'invalid_param' };

    var weakestTuVi = getWeakestTuVi(player);

    // 1. Cùng map
    if (mapId === currentMapId) {
      return { ok: true, sameMap: true };
    }

    // 2. Khóa cảnh giới
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    var gateMap = (holder && holder.getMap) ? holder.getMap(mapId) : null;
    if (gateMap && gateMap.minRealmRank) {
      var gateState = (typeof window !== 'undefined' && window.GameState) ? window.GameState : stateAPI;
      var myRank = (gateState && gateState.getRealmRank && player) ? gateState.getRealmRank(player) : 0;
      if (myRank < gateMap.minRealmRank) {
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Cảnh giới chưa đủ — ' + gateMap.name + ' cần ' + (gateMap.minRealmLabel || '') + '. Hãy tu luyện cân bằng cả năm đường.');
        }
        return { ok: false, reason: 'realm_rank_low', minRank: gateMap.minRealmRank, reqTuVi: gateMap.minRealmRank * 100, curTuVi: weakestTuVi };
      }
    }

    // 3. Lập tuyến di chuyển
    var plan = planTravelRoute(currentMapId, mapId);
    if (!plan || !plan.route || plan.route.length === 0) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Không tìm được đường tới ' + (gateMap ? gateMap.name : mapId));
      }
      return { ok: false, reason: 'no_route' };
    }

    cancelAutoPath(true);
    travelState = {
      active: true,
      targetMapId: mapId,
      routePlan: plan,
      combatStamp: lastCombatTime,
      lastLegAt: 0
    };

    return { ok: true, route: plan.route, needsTeleport: plan.needsTeleport };
  }

  function cancelTravel() {
    travelState.active = false;
    travelState.targetMapId = null;
    travelState.routePlan = null;
    currentPath = [];
    pendingInteraction = null;
    return { ok: true };
  }

  function updateTravel() {
    if (!travelState.active || !player || !mapData) return;
    if (mapFade.alpha > 0) return;

    if (currentMapId === travelState.targetMapId) {
      cancelTravel();
      return;
    }

    if (lastCombatTime > travelState.combatStamp) {
      cancelTravel();
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Vào chiến đấu — đã dừng di chuyển.');
      }
      return;
    }

    var now = performance.now();

    if (travelState.routePlan && travelState.routePlan.needsTeleport && currentMapId === 'dai-truyen-tong') {
      var altarDist = Math.hypot(player.x - 480, player.y - 320);
      if (altarDist <= 64) {
        teleportTo(travelState.targetMapId);
        cancelTravel();
        return;
      }
      if (currentPath.length === 0 && now - travelState.lastLegAt > 500) {
        travelState.lastLegAt = now;
        triggerPathTo(480, 320, null);
      }
      return;
    }

    var nextTargetMap = (travelState.routePlan && travelState.routePlan.needsTeleport) ? 'dai-truyen-tong' : travelState.targetMapId;
    if (currentPath.length === 0 && now - travelState.lastLegAt > 500) {
      var exitHop = findNextHopExit(currentMapId, nextTargetMap);
      if (!exitHop) {
        cancelTravel();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Không tìm được đường sang chặng tiếp theo.');
        }
        return;
      }
      travelState.lastLegAt = now;
      triggerPathTo(exitHop.target.x, exitHop.target.y, null);
    }
  }

  function useItem(itemId) {
    if (!player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    if (!stateAPI.hasItemInBag(player, itemId, 1)) {
      var msgNoItem = 'Không có vật phẩm trong túi đồ.';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgNoItem);
      }
      return { ok: false, msg: msgNoItem };
    }

    var pillElemMap = {
      'dan-kim': 'kim',
      'dan-moc': 'moc',
      'dan-thuy': 'thuy',
      'dan-hoa': 'hoa',
      'dan-tho': 'tho'
    };
    var elem = pillElemMap[itemId];
    if (elem) {
      stateAPI.removeItemFromBag(player, itemId, 1);
      if (!player.paths[elem]) player.paths[elem] = { tuVi: 0 };
      player.paths[elem].tuVi = (player.paths[elem].tuVi || 0) + 20;

      var stats = stateAPI.deriveStats(player.paths, player.equipment);
      player.hpMax = stats.hpMax;
      player.linhLucMax = stats.linhLucMax;
      stateAPI.savePlayer(player);

      var elemNames = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
      var msg = 'Đã dùng ' + (elemNames[elem] || elem) + ' Linh Đan, +20 tu vi ' + (elemNames[elem] || elem) + '!';
      if (audioAPI) audioAPI.playChime();
      spawnFloatingText('+20 Tu vi ' + (elemNames[elem] || elem), player.x, player.y - 35, '#ffe9a8');
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msg);
        window.GameUI.refreshHUD();
      }
      return { ok: true, msg: msg, tuVi: player.paths[elem].tuVi };
    }

    if (itemId === 'truc-co-dan') {
      return tryBreakthrough();
    }

    return { ok: false, msg: 'Vật phẩm không thể sử dụng trực tiếp' };
  }

  function tryBreakthrough() {
    if (!player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };

    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var minTuVi = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var v = (player.paths && player.paths[keys[i]] && player.paths[keys[i]].tuVi) || 0;
      if (v < minTuVi) minTuVi = v;
    }

    if (minTuVi < 900) {
      var msgLow = 'Chưa đủ tu vi để đột phá — cả 5 hệ phải đạt 900 tu vi (hiện tại yếu nhất: ' + minTuVi + '/900).';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgLow);
      }
      return { ok: false, reason: 'insufficient_tuvi', minTuVi: minTuVi, msg: msgLow };
    }

    var hasPill = stateAPI.hasItemInBag(player, 'truc-co-dan', 1);
    if (!hasPill) {
      var msgNoPill = 'Thiếu Trúc Cơ Đan — hãy tìm Chấp Sự tại Tông Môn để luyện đan.';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgNoPill);
      }
      return { ok: false, reason: 'missing_pill', msg: msgNoPill };
    }

    stateAPI.removeItemFromBag(player, 'truc-co-dan', 1);
    player.realm = 'Trúc Cơ Sơ Kỳ';
    if (player.quests) {
      player.quests.mainStage = 10;
    }
    stateAPI.savePlayer(player);

    if (audioAPI) audioAPI.playChime();
    spawnFloatingText('ĐỘT PHÁ TRÚC CƠ ĐẠI THÀNH!', player.x, player.y - 45, '#ffe9a8');
    var successMsg = 'Thiên địa rung chuyển! Đã đột phá thành công Trúc Cơ Sơ Kỳ!';
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(successMsg);
      window.GameUI.refreshHUD();
    }
    return { ok: true, realm: 'Trúc Cơ Sơ Kỳ', newRealm: 'Trúc Cơ Sơ Kỳ', msg: successMsg };
  }

  function exchangePill(elem) {
    if (!player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    var valid = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    if (valid.indexOf(elem) === -1) {
      return { ok: false, reason: 'invalid_element', msg: 'Hệ không hợp lệ' };
    }
    var cost = 15;
    if ((player.linhThach || 0) < cost) {
      var msgFail = 'Không đủ Linh Thạch — cần 15 Linh Thạch để đổi Tu Luyện Đan (' + elem.toUpperCase() + ').';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgFail);
      }
      return { ok: false, reason: 'insufficient_linh_thach', msg: msgFail };
    }

    player.linhThach -= cost;
    var itemId = 'dan-' + elem;
    stateAPI.addItemToBag(player, itemId, 1);
    stateAPI.savePlayer(player);

    var elemNames = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
    var elemName = elemNames[elem] || elem;
    var msgSuccess = 'Đổi thành công 1 Tu Luyện Đan (' + elemName + ')!';
    if (audioAPI) audioAPI.playChime();
    spawnFloatingText('-15 Linh Thạch', player.x, player.y - 35, '#ff9a5c');
    spawnFloatingText('+1 Tu Luyện Đan', player.x, player.y - 55, '#ffe9a8');

    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(msgSuccess);
      window.GameUI.refreshHUD();
    }
    return { ok: true, itemId: itemId, msg: msgSuccess };
  }

  function refineTrucCoDan() {
    if (!player) return { ok: false, reason: 'no_player' };
    var countItem = function (id) {
      return stateAPI ? stateAPI.countItemInBag(player, id) : 0;
    };
    var c1 = countItem('linh-chi-rung');
    var c2 = countItem('bang-tuy');
    var c3 = countItem('hoa-tinh-tho');
    var c4 = countItem('nguyen-tinh-moc');
    var c5 = countItem('nguyen-tinh-thuy');
    var lt = player.linhThach || 0;

    if (c1 < 3 || c2 < 1 || c3 < 2 || c4 < 1 || c5 < 1 || lt < 200) {
      var msg = 'Chưa đủ nguyên liệu luyện Trúc Cơ Đan (cần 3 Linh Chi Rừng, 1 Băng Tủy, 2 Hỏa Tinh Thổ, 1 Nguyên Tinh Mộc, 1 Nguyên Tinh Thủy và 200 Linh Thạch).';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msg);
      }
      return { ok: false, reason: 'missing_materials', msg: msg };
    }

    stateAPI.removeItemFromBag(player, 'linh-chi-rung', 3);
    stateAPI.removeItemFromBag(player, 'bang-tuy', 1);
    stateAPI.removeItemFromBag(player, 'hoa-tinh-tho', 2);
    stateAPI.removeItemFromBag(player, 'nguyen-tinh-moc', 1);
    stateAPI.removeItemFromBag(player, 'nguyen-tinh-thuy', 1);
    player.linhThach -= 200;
    stateAPI.addItemToBag(player, 'truc-co-dan', 1);
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.refines = (player.stats.refines || 0) + 1;

    if (player.quests) {
      player.quests.mainStage = 9;
    }
    stateAPI.savePlayer(player);

    if (audioAPI) audioAPI.playChime();
    spawnFloatingText('Luyện thành Trúc Cơ Đan!', player.x, player.y - 45, '#ffe9a8');
    var successMsg = 'Khai lò luyện đan thành công! Đã nhận 1 Trúc Cơ Đan.';
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(successMsg);
      window.GameUI.refreshHUD();
    }
    return { ok: true, msg: successMsg };
  }

  function equipItem(slotIndex) {
    if (!stateAPI || !player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    var res = stateAPI.equipItem(player, slotIndex);
    if (res.ok) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(res.msg);
        window.GameUI.refreshHUD();
      }
    }
    return res;
  }

  function unequipItem(slotName) {
    if (!stateAPI || !player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    var res = stateAPI.unequipItem(player, slotName);
    if (res.ok) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(res.msg);
        window.GameUI.refreshHUD();
      }
    }
    return res;
  }

  function pathToPoint(x, y) {
    cancelAutoPath(true);
    cancelTravel();
    return triggerPathTo(x, y, null);
  }

  /**
   * Tung kỹ năng từ bàn phím hoặc nút giao diện
   */
  function castSkill(skillId) {
    if (!player || player.hp <= 0) return;
    var hasPacks = mapData && mapData.monsterPacks && mapData.monsterPacks.length > 0;
    if (!hasPacks && mapData.id !== 'rung-doc') {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Kỹ năng chỉ dùng trong khu vực săn bắn');
      }
      return;
    }

    var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { attack: 10 };
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('combat_action'));
      }
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('combat_action'));
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
    if (pendingSwordToast) {
      pendingSwordToast = false;
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Nhận được: Kiếm Đệ Tử');
      }
    }
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
    // Note 8: nạp cờ chất lượng độc lập với hệ âm thanh
    if (stateAPI) {
      var qSettings = stateAPI.loadSettings();
      if (qSettings) {
        setQuality(qSettings.quality || 'cao');
        if (qSettings.zoom !== undefined) userZoom = qSettings.zoom;
        else if (qSettings.display && qSettings.display.zoom !== undefined) userZoom = qSettings.display.zoom;
        resizeCanvas();
      }
    }
    if (audioAPI) {
      var settings = stateAPI ? stateAPI.loadSettings() : null;
      if (settings) {
        audioAPI.setMusicVolume(settings.musicVol);
        audioAPI.setSfxVolume(settings.sfxVol);
        setQuality(settings.quality || 'cao'); // Note 8: nạp cờ chất lượng đã lưu
      }
      // Đợt 3 (Note 3B): nhạc theo map + âm thanh môi trường do GameMusic đảm nhiệm
      // (thay vòng nhạc đơn của audio.js: có theme riêng từng map + lớp chiến đấu).
      if (typeof window !== 'undefined' && window.GameMusic) {
        window.GameMusic.unlock();
        if (settings) {
          window.GameMusic.setMusicVolume(settings.musicVol);
          window.GameMusic.setAmbienceVolume(settings.ambVol != null ? settings.ambVol : 0.6);
          window.GameMusic.setMuted(!!settings.muted);
        }
        window.GameMusic.setMap(currentMapId);
      }
      // Đợt 3 (Note 3A): nạp bản kê lồng tiếng
      if (typeof window !== 'undefined' && window.GameVoice) {
        window.GameVoice.load();
        if (settings) {
          window.GameVoice.setVolume(settings.voiceVol != null ? settings.voiceVol : 0.9);
          window.GameVoice.setEnabled(settings.voiceEnabled !== false);
          window.GameVoice.setMuted(!!settings.muted);
        }
      }
    }
  }

  function stop() {
    isRunning = false;
    if (audioAPI) audioAPI.stopMusic();
  }

  function gameLoop(currentTime) {
    if (!isRunning) return;
    // Đợt 6 (mục 15, hồ sơ 25): giới hạn 30 FPS khi người chơi chọn tiết kiệm pin
    if (Number(getSettingsCached().fpsLimit) === 30 && lastFrameTime && (currentTime - lastFrameTime) < 31) {
      requestAnimationFrame(gameLoop);
      return;
    }
    var dt = (currentTime - lastFrameTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastFrameTime = currentTime;

    update(dt);

    // Đợt 3 (Note 3B): lớp nhạc chiến đấu bật/tắt theo trạng thái giao tranh
    if (typeof window !== 'undefined' && window.GameMusic) {
      var combatNow = !!targetMonster;
      if (!combatNow) {
        for (var ci = 0; ci < fieldMonsters.length; ci++) {
          var cs = fieldMonsters[ci].state;
          if (cs === 'aggro' || cs === 'attack') { combatNow = true; break; }
        }
      }
      if (combatNow !== lastCombatState) {
        lastCombatState = combatNow;
        window.GameMusic.setCombat(combatNow);
      }
    }

    render();

    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    if (!player || !mapData) return;
    // Đợt 6 (mục 15, hồ sơ 29): thống kê thời gian chơi
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.playSec = (player.stats.playSec || 0) + dt;

    if (screenShakeTimer > 0) {
      screenShakeTimer -= dt;
      if (screenShakeTimer <= 0) {
        screenShakeTimer = 0;
        screenShakeIntensity = 0;
      }
    }

    var now = performance.now();

    // Cập nhật hiệu ứng chuyển map fade
    if (mapFade.dir !== 0) {
      mapFade.alpha += mapFade.dir * dt * 4.0;
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
        // Fade xong: chạy yêu cầu chuyển map đã xếp hàng trong lúc fade (nếu có)
        if (pendingMapSwitch) {
          var pendingSwitch = pendingMapSwitch;
          pendingMapSwitch = null;
          switchMap(pendingSwitch.id, pendingSwitch.spawn);
        }
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
      if (joystickVector.x !== 0 || joystickVector.y !== 0) {
        vx += joystickVector.x;
        vy += joystickVector.y;
      }

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
        if (autoPath.active) cancelAutoPath(true);
        if (travelState.active) cancelTravel();
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
    // Đợt 3 (Note 6): cộng quãng đường THẬT đã đi vào bộ tích lũy pha (teleport không tính)
    if (lastPX === null) { lastPX = player.x; lastPY = player.y; }
    if (moved) {
      walkDist += Math.hypot(player.x - lastPX, player.y - lastPY);
    }
    lastPX = player.x;
    lastPY = player.y;

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

    // Mở khóa cổng sau khi tới nơi: cần qua thời gian ân hạn VÀ đã đứng ngoài
    // mọi vùng cổng ít nhất một khung hình (đang đứng trong vùng cổng thì giữ khóa,
    // nên giữ nguyên hướng đi qua cổng không bao giờ bị trả về).
    if (!portalsArmed) {
      var insideAnyExit = false;
      for (var gi = 0; gi < mapData.exits.length; gi++) {
        var gr = mapData.exits[gi].rect;
        if (player.x >= gr.x && player.x <= gr.x + gr.w &&
            player.y >= gr.y && player.y <= gr.y + gr.h) { insideAnyExit = true; break; }
      }
      if (!insideAnyExit && performance.now() >= portalRearmAt) portalsArmed = true;
    }

    // Kiểm tra các vùng thoát (Portals)
    for (var i = 0; i < mapData.exits.length; i++) {
      var ex = mapData.exits[i];
      var r = ex.rect;
      if (player.x >= r.x && player.x <= r.x + r.w &&
          player.y >= r.y && player.y <= r.y + r.h) {
        if (ex.targetMap) {
          // Lối chuyển map thật (đang khóa sau khi vừa tới nơi thì bỏ qua)
          if (portalsArmed) {
            switchMap(ex.targetMap, ex.targetSpawn || ex.target);
          }
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
    updateTravel();
    var actx = computeActionContext();
    if (actx.mode !== currentActionMode) {
      currentActionMode = actx.mode;
      if (typeof window !== 'undefined' && window.GameUI && window.GameUI.setActionMode) {
        window.GameUI.setActionMode(actx.mode, actx.label);
      }
    }

    // Cập nhật quái vật trên bất kỳ bản đồ nào có quái
    if (fieldMonsters.length > 0) {
      updateFieldMonsters(dt);
    }

    // Cập nhật vùng (Zones)
    updateZone();

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
    var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { attack: 10, critRate: 5 };
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
      if (m.skillAnimTimer > 0) {
        m.skillAnimTimer = Math.max(0, m.skillAnimTimer - dt);
      }
      monstersAPI.updateMonster(m, playerPos, dt, {
        onMonsterAttack: function (attacker) {
          handleMonsterAttackPlayer(attacker);
        }
      });

      // Nếu quái tung kỹ năng Rễ Trói (Telegraph r=90, 1.2s nổ, 12 dmg + snare 1.5s)
      if (m.activeTelegraph) {
        var tg = m.activeTelegraph;
        var elemColors = { moc: '#8be26b', thuy: '#7fd4ff', hoa: '#ff9a5c', tho: '#e8c56b', kim: '#e8ecf2' };
        visualEffects.push({
          type: 'telegraph_re_troi',
          x: tg.x,
          y: tg.y,
          radius: tg.radius,
          timer: tg.timer,
          duration: tg.timer,
          damage: tg.damage,
          snareDuration: tg.snareDuration,
          slowRatio: tg.slowRatio || 0,
          slowDuration: tg.slowDuration || 0,
          color: tg.isBossSkill ? (elemColors[tg.element] || '#c9a0ff') : null
        });
        // Boss diễn hoạt ảnh tung chiêu song song với telegraph
        if (tg.isBossSkill) {
          m.skillAnimTimer = 0.85;
        }
        m.activeTelegraph = null;
      }
    }

    // Đợt 3: tách quái chồng nhau — mỗi con giữ khoảng cách tối thiểu 30px
    // (trước đây cả bầy dồn đúng một điểm quanh người chơi, không đọc được từng con)
    for (var si = 0; si < fieldMonsters.length; si++) {
      var sa = fieldMonsters[si];
      if (sa.state === 'dead' || sa.hp <= 0) continue;
      for (var sj = si + 1; sj < fieldMonsters.length; sj++) {
        var sb = fieldMonsters[sj];
        if (sb.state === 'dead' || sb.hp <= 0) continue;
        var sdx = sb.x - sa.x, sdy = sb.y - sa.y;
        var sd = Math.hypot(sdx, sdy);
        var minD = (sa.isElite || sb.isElite) ? 90 : 32;
        if (sd > 0.01 && sd < minD) {
          var push = (minD - sd) / 2;
          var ux = sdx / sd, uy = sdy / sd;
          sa.x -= ux * push; sa.y -= uy * push;
          sb.x += ux * push; sb.y += uy * push;
        } else if (sd <= 0.01) {
          sb.x += 16; sb.y += 8;
        }
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
    var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { defense: 5 };
    var elemFac = combatAPI ? combatAPI.getElementFactor(m.element, 'moc') : 1.0;
    var rawDmg = m.damage;
    var dealt = combatAPI ? combatAPI.calcDamage(rawDmg, elemFac, stats.defense) : rawDmg;

    // Bảo hộ 1 đòn (Brief §5 & Hồ sơ 49 §6): quái thường không gây quá 25% max HP người chơi
    if (!m.isElite && combatAPI) {
      dealt = combatAPI.applyOneHitProtection(dealt, player.hpMax);
    }

    player.hp = Math.max(0, player.hp - dealt);
    if (audioAPI) audioAPI.playHit();
    triggerScreenShake(0.2, 5);

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

    // Đợt 4A: tu vi cộng vào đường theo hệ của quái (trước đây khóa cứng đường Mộc)
    var tuViElem = m.tuViElement || 'moc';
    var rawTuVi = (m.tuViAmount !== undefined && m.tuViAmount !== null) ? m.tuViAmount : (m.tuViMoc || 2);
    var gainedTuVi = stateAPI ? stateAPI.calcTuViGain(todayData.farmTuVi, rawTuVi) : rawTuVi;
    if (!player.paths[tuViElem]) player.paths[tuViElem] = { tuVi: 0 };
    player.paths[tuViElem].tuVi += gainedTuVi;
    todayData.farmTuVi += gainedTuVi;

    if (player.farmSession) {
      player.farmSession.kills++;
      player.farmSession.tuViMoc += gainedTuVi;
    }

    var tuViNames = { moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', kim: 'Kim' };
    var tuViColors = { moc: '#55d882', thuy: '#7fd4ff', hoa: '#ff9a5c', tho: '#e8c56b', kim: '#e8ecf2' };
    spawnFloatingText('+' + gainedTuVi + ' Tu vi ' + (tuViNames[tuViElem] || 'Mộc'), m.x, m.y - 25, tuViColors[tuViElem] || '#55d882');

    // 3. Tiến độ nhiệm vụ (Săn 5 Thảo Tinh ở Rừng Độc)
    if (player.quests && player.quests.talked_linhnhi && !player.quests.huntCompleted && m.mapId === 'rung-doc') {
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

    // Bộ đếm quái cho chuỗi nhiệm vụ chính (Đợt 6 - Việc 1)
    if (player.quests) {
      if (m.speciesId === 'nhen_xanh') {
        player.quests.nhenKills = (player.quests.nhenKills || 0) + 1;
      }
      if (m.speciesId === 'han_xa' || m.speciesId === 'bang_xa') {
        player.quests.bangXaKills = (player.quests.bangXaKills || 0) + 1;
      }
    }

    // Thống kê cá nhân (Đợt 6 - mục 15, hồ sơ 29 mục 5)
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.kills = (player.stats.kills || 0) + 1;
    if (m.isBoss) player.stats.bossKills = (player.stats.bossKills || 0) + 1;

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

      // Người chơi bước qua để nhặt (khoảng cách <= 26px, hoặc <= 72px nếu bật Tự Nhặt Đồ)
      var curSettings = stateAPI ? stateAPI.loadSettings() : null;
      var maxPickupDist = (curSettings && curSettings.autoPickup === true) ? 72 : 26;
      var dist = Math.hypot(player.x - drop.x, player.y - drop.y);
      var canCollect = dist <= 26;
      if (!canCollect && dist <= maxPickupDist) {
        // Đợt 6 (mục 15, hồ sơ 25): tự nhặt chỉ áp cho vật phẩm từ phẩm đã chọn trở lên
        var minRank = (curSettings && curSettings.autoPickupRank) ? Number(curSettings.autoPickupRank) : 1;
        var dropDef = monstersAPI && monstersAPI.ITEM_DEFS ? monstersAPI.ITEM_DEFS[drop.itemId] : null;
        var rankMap = { common: 1, good: 2, rare: 3, epic: 4, legend: 5 };
        var dropRank = dropDef ? (rankMap[dropDef.quality] || 1) : 1;
        canCollect = dropRank >= minRank;
      }
      if (canCollect) {
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
          if (vfx.slowRatio && vfx.slowDuration) {
            playerSlowTimer = Math.max(playerSlowTimer, vfx.slowDuration);
            playerSlowRatio = vfx.slowRatio;
          }
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
    var curSettings = stateAPI ? stateAPI.loadSettings() : null;
    if (curSettings && curSettings.showDamageNumbers === false) return;
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

  var currentZoneId = null;
  function updateZone() {
    if (!player || !mapData || !mapData.zones || mapData.zones.length === 0) {
      currentZoneId = null;
      return;
    }
    var foundZone = null;
    for (var i = 0; i < mapData.zones.length; i++) {
      var z = mapData.zones[i];
      if (z.rect &&
          player.x >= z.rect.x && player.x <= z.rect.x + z.rect.w &&
          player.y >= z.rect.y && player.y <= z.rect.y + z.rect.h) {
        foundZone = z;
        break;
      }
    }
    if (foundZone) {
      if (foundZone.id !== currentZoneId) {
        currentZoneId = foundZone.id;
        if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showZoneTitle) {
          window.GameUI.showZoneTitle(foundZone.name, foundZone.desc);
        }
      }
    } else {
      currentZoneId = null;
    }
  }

  function getCurrentZone() {
    if (!player || !mapData || !mapData.zones) return null;
    for (var i = 0; i < mapData.zones.length; i++) {
      var z = mapData.zones[i];
      if (z.rect &&
          player.x >= z.rect.x && player.x <= z.rect.x + z.rect.w &&
          player.y >= z.rect.y && player.y <= z.rect.y + z.rect.h) {
        return z;
      }
    }
    return null;
  }

  var screenShakeTimer = 0;
  var screenShakeIntensity = 0;

  function triggerScreenShake(duration, intensity) {
    var s = stateAPI ? stateAPI.loadSettings() : null;
    if (s && s.screenShake === false) return;
    screenShakeTimer = duration || 0.2;
    screenShakeIntensity = intensity || 5;
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
    var renderCamX = camera.x;
    var renderCamY = camera.y;
    if (screenShakeTimer > 0) {
      renderCamX += (Math.random() - 0.5) * screenShakeIntensity;
      renderCamY += (Math.random() - 0.5) * screenShakeIntensity;
    }
    ctx.translate(-renderCamX, -renderCamY);

    // 1. Vẽ ảnh nền bản đồ hiện tại (Brief §2: 1920x1280)
    var bgImg = assets[mapData.bgImage] || (mapData.id === 'rung-doc' ? assets.map_rung_doc_bg : assets.map_bg);
    if (bgImg && bgImg.complete) {
      ctx.drawImage(bgImg, 0, 0, mapData.width, mapData.height);
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
      if (vfx.type === 'telegraph_re_troi' && getSettingsCached().showBossTelegraph !== false) {
        ctx.save();
        var progress = 1.0 - (vfx.timer / vfx.duration);
        ctx.strokeStyle = vfx.color ? vfx.color : 'rgba(180, 70, 220, 0.85)';
        ctx.lineWidth = 2.5;
        if (vfx.color) {
          ctx.save();
          ctx.globalAlpha = 0.15 + progress * 0.25;
          ctx.fillStyle = vfx.color;
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(140, 40, 180, ' + (0.15 + progress * 0.25) + ')';
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Vòng co lại báo thời điểm nổ
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, vfx.radius * (1.0 - progress), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 4. (Đợt 6) Chiến lợi phẩm được vẽ SAU lớp thực thể (bước 5b) để tán cây tiền cảnh
    // không nuốt mất đế sáng + nhãn tên — vật rơi phải luôn đọc được từ xa.

    // 4b. Vẽ các điểm thu hái (Harvest Nodes)
    if (mapData.harvestNodes) {
      var nowSecH = performance.now() / 1000;
      for (var h = 0; h < mapData.harvestNodes.length; h++) {
        var node = mapData.harvestNodes[h];
        var isReady = nowSecH >= (harvestReadyTimes[node.id] || 0);
        // Đợt 6 (Việc 3 — mục 4): luống linh điền vẽ riêng cho Vườn Linh Dược tông môn
        var isGardenPlot = (currentMapId === 'tong-mon');
        if (isGardenPlot) drawGardenPlot(node, isReady, nowSecH, h);
        if (isReady) {
          var bobH = Math.sin(nowSecH * 3 + h) * 3;
          // Note 8: 'thap' bỏ quầng sáng gradient của điểm hái (icon vẫn nhấp nhô như cũ)
          if (currentQuality !== 'thap') {
            ctx.save();
            var gradH = ctx.createRadialGradient(node.x, node.y - 12 + bobH, 2, node.x, node.y - 12 + bobH, 18);
            gradH.addColorStop(0, 'rgba(124, 232, 152, 0.45)');
            gradH.addColorStop(1, 'rgba(124, 232, 152, 0)');
            ctx.fillStyle = gradH;
            ctx.beginPath();
            ctx.arc(node.x, node.y - 12 + bobH, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          var iconImg = assets['assets/art/icons-sheet.png'] || assets.icons_sheet;
          if (iconImg && iconImg.complete) {
            var defH = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS[node.itemId] : null;
            var colH = defH ? (defH.iconCol || 0) : 0;
            var rowH = defH ? (defH.iconRow || 0) : 0;
            ctx.drawImage(iconImg, colH * 32, rowH * 32, 32, 32, node.x - 12, node.y - 24 + bobH, 24, 24);
          }
        } else if (!isGardenPlot) {
          ctx.save();
          ctx.fillStyle = 'rgba(80, 140, 80, 0.35)';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 5. Thu thập toàn bộ thực thể hiển thị và sắp xếp chiều sâu Painter's Algorithm
    var entities = [];

    // Standees
    if (mapData.standees) {
      for (var s = 0; s < mapData.standees.length; s++) {
        (function (std) {
          entities.push({
            type: 'standee',
            baseY: std.baseY,
            draw: function () {
              var sImg = assets[std.asset] || (std.id === 'fallen_log_1' ? assets.fallen_log : (std.id === 'broadleaf_1' || std.id === 'broadleaf_2' || std.id === 'broadleaf_3' ? assets.broadleaf_tree : assets[std.id]));
              if (std.trunk) {
                ctx.save();
                ctx.fillStyle = 'rgba(10, 15, 10, 0.35)';
                ctx.beginPath();
                ctx.ellipse(std.trunk.x, std.trunk.y + 4, std.trunk.r * 2.0, std.trunk.r * 1.0, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
              if (sImg && sImg.complete) {
                ctx.drawImage(sImg, std.x, std.y, std.w, std.h);
              }
            }
          });
        })(mapData.standees[s]);
      }
    }

    // NPCs
    if (mapData.npcs) {
      for (var n = 0; n < mapData.npcs.length; n++) {
        (function (npc) {
          if (!isNpcActive(npc)) return;
          entities.push({
            type: 'npc',
            baseY: npc.baseY || npc.feetY,
            draw: function () {
              ctx.save();
              ctx.fillStyle = 'rgba(10, 15, 10, 0.4)';
              ctx.beginPath();
              ctx.ellipse(npc.feetX, npc.feetY, (npc.w / 2) * 0.75, 8, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();

              var nImg = assets[npc.asset] || (npc.id === 'npc_linhnhi' ? assets.linhnhi : null);
              if (nImg && nImg.complete) {
                // NPCFIX 2026-11-09 "NPC đứng bị vỡ hình": bề rộng vẽ suy từ tỉ lệ của
                // chính bitmap ĐÃ NẠP (naturalWidth/naturalHeight), neo tâm tại feetX,
                // đáy giữ nguyên feetY. GitHub Pages phát Cache-Control max-age=600:
                // sau mỗi đợt deploy đổi khổ ảnh, máy người chơi có thể còn giữ ảnh
                // phiên bản cũ khác tỉ lệ với mapdata mới trong cửa sổ cache — vẽ ép
                // vào hộp (w,h) của dữ liệu sẽ bóp NPC tới 31% (đợt 6B). Vẽ theo tỉ
                // lệ bitmap thật thì mọi cặp (dữ liệu, ảnh) đều đúng hình.
                var npcDrawW = npc.w;
                var npcDrawX = npc.x;
                if (nImg.naturalWidth > 0 && nImg.naturalHeight > 0) {
                  npcDrawW = npc.h * nImg.naturalWidth / nImg.naturalHeight;
                  npcDrawX = (typeof npc.feetX === 'number' ? npc.feetX : npc.x + npc.w / 2) - npcDrawW / 2;
                }
                ctx.drawImage(nImg, npcDrawX, npc.y, npcDrawW, npc.h);
              }

              var qTarget = getQuestTargetInfo();
              if (qTarget && qTarget.kind === 'npc' && qTarget.npcId === npc.id) {
                var bobN = Math.sin(performance.now() / 250) * 4;
                drawQuestExclamation(npc.feetX, npc.y - 18 + bobN);
              }

              var dPlayer = Math.hypot(player.x - npc.feetX, player.y - npc.feetY);
              if (dPlayer <= INTERACTION_RANGE || isPlayerInNpcRange(npc)) {
                drawHintChip(npc.feetX, npc.y - 6, 'Nói chuyện');
              }
            }
          });
        })(mapData.npcs[n]);
      }
    }

    // Quái vật
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

        var isHat = player && player.equipment && player.equipment.head === 'non-la' && getSettingsCached().hideHat !== true;
        var hatWalk = assets.hanhan_hat_walk;
        var hatIdle = assets.hanhan_hat_idle;

        var walkSheet = assets.hanhan_walk;
        if (playerMoving && walkSheet && walkSheet.complete && walkSheet.naturalWidth >= 768) {
          // Đợt 3 (Note 6): khung hình suy từ quãng đường đã đi — chân khớp mặt đất, không trượt theo thời gian
          var sheetCols = Math.max(1, Math.round(walkSheet.naturalWidth / 96));
          var wFrame = Math.floor(walkDist / WALK_CYCLE_DIST * sheetCols) % sheetCols;
          var wFrameY = (player.dir || 0) * 120;
          ctx.drawImage(
            walkSheet,
            wFrame * 96, wFrameY, 96, 120,
            player.x - 48, player.y - 118, 96, 120
          );
          if (isHat && hatWalk && hatWalk.complete && hatWalk.naturalWidth > 0) {
            var hatCols = Math.max(1, Math.round(hatWalk.naturalWidth / 96));
            var hFrame = Math.floor(walkDist / WALK_CYCLE_DIST * hatCols) % hatCols;
            ctx.drawImage(
              hatWalk,
              hFrame * 96, wFrameY, 96, 120,
              player.x - 48, player.y - 118, 96, 120
            );
          }
        } else if (assets.hanhan_idle && assets.hanhan_idle.complete) {
          var frameY = (player.dir || 0) * 120;
          ctx.drawImage(
            assets.hanhan_idle,
            0, frameY, 96, 120,
            player.x - 48, player.y - 118, 96, 120
          );
          if (isHat && hatIdle && hatIdle.complete && hatIdle.naturalWidth > 0) {
            ctx.drawImage(
              hatIdle,
              0, frameY, 96, 120,
              player.x - 48, player.y - 118, 96, 120
            );
          }
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

    // 5b. Vẽ chiến lợi phẩm rớt dưới đất — sau lớp thực thể để luôn đọc được (Đợt 6, mục 3)
    for (var g = 0; g < groundDrops.length; g++) {
      drawGroundDrop(groundDrops[g]);
    }

    // 6. Vẽ đạn bay & hiệu ứng trên không (Projectiles & VFX)
    renderCombatVfx();

    // 7. Vẽ chữ sát thương nổi (Floating Numbers)
    renderFloatingTexts();

    // 7b. Biển chỉ tên tại các điểm chuyển map (Đợt 3, Note 4)
    drawGateSigns();

    // 7c. Mũi tên chỉ xuống tại mọi lối vào / điểm chuyển map (Đợt 6 - Việc 1, mục 12)
    drawEntranceArrows();

    // 8. Mũi tên dẫn đường nhiệm vụ (Guidance Arrow)
    var settings = stateAPI ? stateAPI.loadSettings() : null;
    var showArrow = !settings || settings.arrowGuidance !== false;
    if (showArrow && player && player.quests) {
      var qInfo = getQuestTargetInfo();
      if (qInfo && qInfo.stepId !== 'done') {
        if (qInfo.mapId === currentMapId) {
          var destA = resolveQuestDestination(qInfo);
          if (destA) {
            drawGuidanceArrow(player.x, player.y, destA.x, destA.y);
          }
        } else {
          var exitHop = findNextHopExit(currentMapId, qInfo.mapId);
          if (exitHop && exitHop.target) {
            drawGuidanceArrow(player.x, player.y, exitHop.target.x, exitHop.target.y);
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

    // 11. Bảng tên cổng cỡ lớn theo không gian màn hình (Đợt 3, Note 4)
    drawSignPlate();
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

    // Đợt 3 (Note: độ rõ của quái ở cỡ điện thoại): vũng sáng ấm sau lưng quái
    // giúp quái xanh tách khỏi nền lá xanh — nhận ra là SINH VẬT ngay, không cần thanh máu.
    // Note 8: chất lượng 'thap' bỏ gradient này (tốn GPU nhất) — quái vẫn có bóng + viền.
    if (currentQuality !== 'thap') {
      ctx.save();
      var poolR = m.isElite ? 120 : 62;
      var poolGrad = ctx.createRadialGradient(m.x, m.y - 20, 4, m.x, m.y - 20, poolR);
      poolGrad.addColorStop(0, m.isElite ? 'rgba(255, 225, 150, 0.34)' : 'rgba(255, 240, 190, 0.26)');
      poolGrad.addColorStop(1, 'rgba(255, 240, 190, 0)');
      ctx.fillStyle = poolGrad;
      ctx.beginPath();
      ctx.arc(m.x, m.y - 20, poolR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Vòng phát sáng ngũ hành cho quái tinh anh (Brief §4 & Hồ sơ 36/49)
    if (m.isElite) {
      ctx.save();
      ctx.strokeStyle = '#55d882';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#55d882';
      ctx.shadowBlur = qualityShadow(10);
      ctx.beginPath();
      var ringW = Math.max(75, Math.round(spec.cellW * (spec.drawScale || 1) * 0.38));
      var ringH = Math.max(26, Math.round(spec.cellW * (spec.drawScale || 1) * 0.12));
      ctx.ellipse(m.x, m.y, ringW, ringH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Bóng tiếp xúc dưới chân (Đợt 3: to và đậm hơn để đọc rõ ở cỡ điện thoại)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 8, 0.52)';
    ctx.beginPath();
    // Đợt 4A: bóng tinh anh/boss tỉ lệ theo bề rộng sprite (boss ô 280 không còn bóng 70px)
    var shadowW = m.isElite ? Math.max(70, Math.round(spec.cellW * (spec.drawScale || 1) * 0.36)) : 31;
    var shadowH = m.isElite ? Math.max(22, Math.round(spec.cellW * (spec.drawScale || 1) * 0.11)) : 11;
    ctx.ellipse(m.x, m.y, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sprite quái vật từ sheet đã keyout
    // LƯU Ý (bài học Đợt 3): khóa nạp trước là thaotinh_sheet/nhenxanh_sheet/cothuye_sheet,
    // KHÔNG khớp speciesId + '_sheet' — từng làm sprite quái không bao giờ được vẽ.
    var sheetKey = m.speciesId + '_sheet';
    var sheet = assets[sheetKey];
    if (!sheet) {
      var aliasKey = { thao_tinh: 'thaotinh_sheet', nhen_xanh: 'nhenxanh_sheet', co_thu_yeu: 'cothuye_sheet' }[m.speciesId];
      if (aliasKey) sheet = assets[aliasKey];
    }
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

      // Đợt 4A: đang diễn chiêu boss -> phát skill-sheet (1 hàng x 4 cột), không nhún thở
      var skillSheetImg = (m.skillAnimTimer > 0) ? assets[m.speciesId + '_skill_sheet'] : null;
      var inSkillAnim = !!(skillSheetImg && skillSheetImg.complete);
      if (inSkillAnim) {
        sheet = skillSheetImg;
        row = 0;
        col = Math.min(3, Math.floor((0.85 - Math.max(0, m.skillAnimTimer)) / 0.85 * 4));
      }

      // Đợt 3: biên độ nhún thở/idle phải đọc được ở cỡ điện thoại
      var bobY = 0;
      if (!inSkillAnim) {
        if (row === 0) bobY = Math.sin(m.animTime * 2.4 + (m.x % 7)) * (m.isElite ? 3.5 : 2.4);
        else if (row === 1) bobY = -Math.abs(Math.sin(m.animTime * 6.0)) * 2;
      }

      ctx.save();
      // Lật X nếu di chuyển sang trái
      if (m.facingLeft) {
        ctx.translate(m.x, m.y);
        ctx.scale(-1, 1);
        ctx.drawImage(
          sheet,
          col * cellW, row * cellH, cellW, cellH,
          -spec.feetOffsetX, -spec.feetOffsetY - bobY, cellW, cellH
        );
      } else {
        ctx.drawImage(
          sheet,
          col * cellW, row * cellH, cellW, cellH,
          m.x - spec.feetOffsetX, m.y - spec.feetOffsetY - bobY, cellW, cellH
        );
      }
      ctx.restore();

      // Đợt 3: tinh anh có bào tử sáng bay quanh — dấu hiệu "sinh vật" không lẫn với cây nền
      if (m.isElite && row !== 4) {
        ctx.save();
        for (var sp = 0; sp < 3; sp++) {
          var ang = m.animTime * 0.9 + sp * (Math.PI * 2 / 3);
          var spx = m.x + Math.cos(ang) * 58;
          var spy = m.y - 95 + Math.sin(ang * 1.7) * 16;
          ctx.fillStyle = 'rgba(150, 255, 170, 0.75)';
          ctx.beginPath();
          ctx.arc(spx, spy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Thanh máu trên đầu quái (Elite: thanh dài hơn + bảng tên)
    drawMonsterHpBar(m, spec);
  }

  function drawMonsterHpBar(m, spec) {
    var barW = m.isBoss ? 150 : (m.isElite ? 100 : 42);
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
      ctx.shadowBlur = qualityShadow(4);
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

    // Đợt 6 (mục 15, hồ sơ 28): hiện số máu chính xác khi bật
    if (getSettingsCached().showMonsterHpText === true) {
      ctx.save();
      ctx.font = 'bold 10px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = qualityShadow(3);
      ctx.fillText(Math.max(0, Math.ceil(m.hp)) + '/' + m.maxHp, m.x, topY - 3);
      ctx.restore();
    }

    // Đợt 6 (mục 15, hồ sơ 28): vòng tầm phát hiện của quái tinh anh/boss khi bật
    if ((m.isElite || m.isBoss) && getSettingsCached().showAggroRing === true) {
      var ringR = m.aggroRange || spec.aggroRange || 150;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 90, 90, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Đợt 6 (Việc 3 — mục 4): vẽ LUỐNG LINH ĐIỀN tại các nút hái Vườn Linh Dược (tong-mon).
   * Luống 124x88: gò đất nâu có rãnh + viền sáng hơn nền + bóng tiếp xúc.
   * Trạng thái: sẵn sàng = cụm linh thảo phát sáng + dấu ngọc nảy; đang mọc lại =
   * mầm theo tiến độ hồi (đất trơ / mầm hai lá / cây non) + vòng tiến độ.
   */
  function drawHerbCluster(cx, cy, scale, glow) {
    ctx.save();
    if (glow && currentQuality !== 'thap') {
      ctx.shadowColor = 'rgba(85, 216, 130, 0.9)';
      ctx.shadowBlur = qualityShadow(9);
    }
    ctx.strokeStyle = '#2f9e57';
    ctx.lineWidth = 2.2;
    ctx.fillStyle = '#55d882';
    for (var k = -2; k <= 2; k++) {
      var sx = cx + k * 9 * scale;
      var tx = cx + k * 12 * scale;
      var ty = cy - (16 - Math.abs(k) * 2.5) * scale;
      ctx.beginPath();
      ctx.moveTo(sx, cy + 8 * scale);
      ctx.quadraticCurveTo(sx + (tx - sx) * 0.4, cy - 4 * scale, tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(tx, ty, 5.2 * scale, 2.8 * scale, (k * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(tx - 4 * scale, ty + 4 * scale, 4 * scale, 2.2 * scale, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGardenPlot(node, isReady, nowSec, idx) {
    var cx = node.x;
    var cy = node.y;
    var x0 = cx - 62;
    var y0 = cy - 44;
    var flourish = getSettingsCached().flourishEffects !== false;

    ctx.save();
    // Bóng tiếp xúc
    ctx.fillStyle = 'rgba(8, 10, 6, 0.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 42, 68, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Gò đất + rãnh
    ctx.beginPath();
    ctx.roundRect(x0, y0, 124, 88, 9);
    ctx.fillStyle = '#5b4130';
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x0 + 6, y0 + 6, 112, 76, 7);
    ctx.fillStyle = '#684b33';
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 28, 15, 0.6)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (var f = -1; f <= 1; f++) {
      ctx.beginPath();
      ctx.moveTo(cx + f * 32, y0 + 14);
      ctx.lineTo(cx + f * 32, y0 + 74);
      ctx.stroke();
    }
    // Đốm đất tạo hạt (vị trí tất định theo chỉ số nút, không nhấp nháy giữa các khung)
    ctx.fillStyle = 'rgba(255, 230, 180, 0.10)';
    for (var sp = 0; sp < 14; sp++) {
      var spx = x0 + 12 + ((Math.sin(idx * 37.7 + sp * 91.3) * 0.5 + 0.5) * 100);
      var spy = y0 + 10 + ((Math.cos(idx * 21.9 + sp * 57.1) * 0.5 + 0.5) * 68);
      ctx.beginPath();
      ctx.arc(spx, spy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Viền luống sáng hơn nền
    ctx.beginPath();
    ctx.roundRect(x0, y0, 124, 88, 9);
    ctx.strokeStyle = '#9c8a66';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x0 + 3, y0 + 3, 118, 82, 7);
    ctx.strokeStyle = 'rgba(255, 233, 168, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    if (isReady) {
      drawHerbCluster(cx, cy + 6, 1, true);
      // Dấu hiệu trạng thái: viên ngọc nảy trên luống
      var bobM = flourish ? Math.sin(nowSec * 3 + idx) * 3.5 : 0;
      ctx.save();
      ctx.translate(cx, cy - 56 + bobM);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#7dffb0';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = 'rgba(125, 255, 176, 0.9)';
      ctx.shadowBlur = qualityShadow(8);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
    } else {
      var readyAt = harvestReadyTimes[node.id] || 0;
      var respawn = node.respawnSec || 90;
      var prog = 1 - Math.max(0, (readyAt - nowSec)) / respawn;
      if (prog < 0) prog = 0;
      if (prog > 1) prog = 1;
      if (prog >= 0.66) drawHerbCluster(cx, cy + 6, 0.8, false);
      else if (prog >= 0.33) drawHerbCluster(cx, cy + 6, 0.45, false);
      // Vòng tiến độ hồi
      ctx.save();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
      ctx.beginPath();
      ctx.arc(cx, cy - 56, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(cx, cy - 56, 9, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Đợt 6 (Việc 2 — mục 3): màu đế vật rơi theo loại + phẩm chất
  var DROP_QUALITY_COLORS = {
    common: '#cfd8dc', good: '#7ed491', rare: '#b78bfa', epic: '#ffb74d', legend: '#ff8a65'
  };
  function drawGroundDrop(drop) {
    var def = monstersAPI.ITEM_DEFS[drop.itemId];
    var isCurrency = (drop.itemId === 'linh-thach');
    var flourish = getSettingsCached().flourishEffects !== false;
    var nowMs = performance.now();

    var plateColor = '#55d882';
    if (isCurrency) plateColor = '#ffd94d';
    else if (def && def.type === 'gear') plateColor = DROP_QUALITY_COLORS[def.quality] || '#cfd8dc';
    else if (def && def.type === 'consumable') plateColor = '#7fd4ff';
    else if (def && def.quality && def.type !== 'material') plateColor = DROP_QUALITY_COLORS[def.quality] || plateColor;

    var pulse = flourish ? (1 + Math.sin(nowMs / 320 + drop.x) * 0.08) : 1;

    ctx.save();
    // Đế sáng theo phẩm: quầng mềm + đĩa đặc + viền sáng
    ctx.shadowColor = plateColor;
    ctx.shadowBlur = qualityShadow(12);
    ctx.fillStyle = plateColor;
    ctx.globalAlpha = 0.26;
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 4, 21 * pulse, 9.5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 4, 14.5 * pulse, 6.5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = plateColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 4, 15.5 * pulse, 7 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Icon thật 30x30 nổi trên đế
    var iconsImg = assets.icons_sheet;
    var bob = flourish ? Math.sin(nowMs / 300 + drop.x) * 3 : 0;
    if (iconsImg && iconsImg.complete && def) {
      var col = def.iconCol || 0;
      var row = def.iconRow || 0;
      ctx.drawImage(
        iconsImg,
        col * 32, row * 32, 32, 32,
        drop.x - 15, drop.y - 30 + bob, 30, 30
      );
    }

    // Nhãn tên khi người chơi ở gần (<= 150px) — đọc rõ ở 390px
    if (player && def && Math.hypot(player.x - drop.x, player.y - drop.y) <= 150) {
      var label = def.name || drop.itemId;
      if (drop.count && drop.count > 1) label += ' ×' + drop.count;
      ctx.font = 'bold 11px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = qualityShadow(4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      var labelY = drop.y - 36 + bob;
      ctx.strokeText(label, drop.x, labelY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, drop.x, labelY);
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
      ctx.shadowBlur = qualityShadow(8);
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
      ctx.shadowBlur = qualityShadow(4);
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  function drawQuestExclamation(x, y) {
    ctx.save();
    ctx.shadowColor = 'rgba(243, 217, 78, 0.85)';
    ctx.shadowBlur = qualityShadow(12);
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
    ctx.shadowBlur = qualityShadow(8);
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

  function drawHintChip(x, y, text) {
    ctx.save();
    ctx.font = '11px "Noto Serif", serif';
    var textMetrics = ctx.measureText(text);
    var boxW = textMetrics.width + 12;
    var boxH = 18;

    ctx.fillStyle = 'rgba(20, 26, 20, 0.85)';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff4d0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Đợt 3 (Note 4): biển chỉ tên tại MỌI điểm chuyển map.
   * Biển gỗ trong thế giới (cột + bảng + tên map đích) vẽ thường trực;
   * khi nhân vật tới gần (<= 320px) hiện thêm bảng tên cỡ lớn theo không gian
   * màn hình để đọc rõ ở bề ngang điện thoại 390px.
   */
  function collectGateSigns() {
    var signs = [];
    if (!mapData) return signs;
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : null;
    function destName(id) {
      var m = holder && holder.getMap ? holder.getMap(id) : null;
      return m ? m.name : id;
    }
    if (mapData.exits) {
      for (var i = 0; i < mapData.exits.length; i++) {
        var ex = mapData.exits[i];
        if (ex.targetMap && ex.rect) {
          // Cửa Đại Điện đã có biển tên riêng ngay cửa (plaque) — không cắm thêm biển cổng trùng
          if (ex.targetMap === 'dai-dien') continue;
          // Đợt 6: nếu đã có điểm tương tác cửa cùng đích ngay tại cổng thì chỉ giữ MỘT biển (biển cửa)
          var ecx = ex.rect.x + ex.rect.w / 2;
          var ecy = ex.rect.y + ex.rect.h / 2;
          var hasDoorSign = false;
          if (mapData.interactables) {
            for (var di = 0; di < mapData.interactables.length; di++) {
              var dit = mapData.interactables[di];
              if (dit.targetMap === ex.targetMap && Math.hypot(dit.x - ecx, dit.y - ecy) < 90) { hasDoorSign = true; break; }
            }
          }
          if (hasDoorSign) continue;
          var sx = ex.rect.x + ex.rect.w / 2;
          var sy = ex.rect.y + ex.rect.h / 2;
          // Cổng sát mép bản đồ: cắm biển lùi vào trong để không bị cắt khỏi khung hình
          if (ex.rect.y <= 2) sy = ex.rect.y + ex.rect.h + 36;
          else if (ex.rect.y + ex.rect.h >= mapData.height - 2) sy = ex.rect.y - 36;
          if (ex.rect.x <= 2) sx = ex.rect.x + ex.rect.w + 36;
          else if (ex.rect.x + ex.rect.w >= mapData.width - 2) sx = ex.rect.x - 36;
          signs.push({ x: sx, y: sy, label: destName(ex.targetMap), kind: 'gate' });
        }
      }
    }
    if (mapData.interactables) {
      for (var j = 0; j < mapData.interactables.length; j++) {
        var it = mapData.interactables[j];
        if (it.action === 'door_enter') {
          // Đợt 6: biển cửa ghi đúng đích — cửa vào Đại Điện ghi "Đại Điện", cửa ra trong điện ghi "Ra Sơn Môn"
          if (it.targetMap === 'dai-dien') {
            signs.push({ x: it.x + 118, y: it.y - 40, label: 'Đại Điện', kind: 'plaque' });
          } else {
            signs.push({ x: it.x, y: it.y - 46, label: 'Ra ' + destName(it.targetMap), kind: 'plaque' });
          }
        } else if (it.action === 'door_exit') {
          signs.push({ x: it.x, y: it.y - 46, label: 'Ra Sơn Môn', kind: 'plaque' });
        } else if (it.action === 'open_teleport') {
          signs.push({ x: it.x, y: it.y - 96, label: 'Đài Truyền Tống', kind: 'plaque' });
        }
      }
    }
    // Đài Truyền Tống: bia đá ghi từng điểm đến quanh đài (thấy trước khi dùng)
    if (mapData.id === 'dai-truyen-tong' || currentMapId === 'dai-truyen-tong') {
      signs.push({ x: 268, y: 300, label: 'Miếu Hoang', kind: 'stele' });
      signs.push({ x: 692, y: 300, label: 'Rừng Độc Thanh Tụy', kind: 'stele' });
      signs.push({ x: 480, y: 486, label: 'Sơn Môn', kind: 'stele' });
      signs.push({ x: 150, y: 180, label: 'Hồ Băng Hàn Kính', kind: 'stele' });
      signs.push({ x: 810, y: 180, label: 'Mỏ Lửa Xích Diệm', kind: 'stele' });
      signs.push({ x: 150, y: 486, label: 'Hoang Mạc Hoàng Sa', kind: 'stele' });
      signs.push({ x: 810, y: 486, label: 'Kiếm Trủng Huyền Thiết', kind: 'stele' });
    }
    return signs;
  }

  function drawOneSign(s) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (s.kind === 'gate') {
      // Cột gỗ + bảng gỗ treo
      ctx.fillStyle = 'rgba(10, 12, 8, 0.35)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 26, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6d4c2f';
      ctx.fillRect(s.x - 3, s.y - 16, 6, 42);
      ctx.font = 'bold 15px "Noto Serif", serif';
      var gw = ctx.measureText(s.label).width + 26;
      ctx.fillStyle = '#7d5a36';
      ctx.strokeStyle = '#4a3220';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(s.x - gw / 2, s.y - 44, gw, 30, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(s.label, s.x, s.y - 29);
    } else if (s.kind === 'plaque') {
      ctx.font = 'bold 15px "Noto Serif", serif';
      var pw = ctx.measureText(s.label).width + 26;
      ctx.fillStyle = 'rgba(74, 32, 24, 0.92)';
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(s.x - pw / 2, s.y - 15, pw, 30, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd977';
      ctx.fillText(s.label, s.x, s.y);
    } else { // stele — bia đá nhỏ
      ctx.font = 'bold 13px "Noto Serif", serif';
      var sw = ctx.measureText(s.label).width + 20;
      ctx.fillStyle = 'rgba(96, 104, 100, 0.95)';
      ctx.strokeStyle = '#3f4a44';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(s.x - sw / 2, s.y - 14, sw, 28, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#eaf5ec';
      ctx.fillText(s.label, s.x, s.y);
    }
    ctx.restore();
  }

  function drawGateSigns() {
    var signs = collectGateSigns();
    for (var i = 0; i < signs.length; i++) drawOneSign(signs[i]);
  }

  /**
   * Đợt 6 (Việc 1 — mục 12): mũi tên CHỈ XUỐNG động tại mọi điểm chuyển map:
   * mọi exit của map hiện tại + cửa tòa nhà (door_enter) + đài truyền tống (teleport).
   * Chevron đôi trắng-xanh ngọc viền tối, nảy nhẹ — khác hẳn mũi tên dẫn nhiệm vụ
   * (tam giác vàng ở chân nhân vật). Ẩn khi đang mờ chuyển map.
   */
  function drawEntranceArrows() {
    if (!mapData || !player) return;
    if (mapFade && (mapFade.alpha > 0.02 || mapFade.dir !== 0)) return;
    var flourish = getSettingsCached().flourishEffects !== false;
    var t = performance.now() / 1000;
    var bounce = flourish ? Math.sin(t * 3.2) * 4 : 0;

    var points = [];
    if (mapData.exits) {
      for (var i = 0; i < mapData.exits.length; i++) {
        var ex = mapData.exits[i];
        if (ex.rect) points.push({ x: ex.rect.x + ex.rect.w / 2, y: ex.rect.y + ex.rect.h / 2 });
      }
    }
    if (mapData.interactables) {
      for (var j = 0; j < mapData.interactables.length; j++) {
        var it = mapData.interactables[j];
        if (it.action === 'door_enter' || it.action === 'door_exit' || it.action === 'teleport' || it.action === 'open_teleport') {
          points.push({ x: it.x, y: it.y - 6 });
        }
      }
    }

    for (var p = 0; p < points.length; p++) {
      var px = points[p].x;
      var py = points[p].y - 30 + bounce;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var c = 0; c < 2; c++) {
        var cy = py + c * 11;
        ctx.beginPath();
        ctx.moveTo(px - 13, cy);
        ctx.lineTo(px, cy + 10);
        ctx.lineTo(px + 13, cy);
        ctx.strokeStyle = 'rgba(10, 20, 24, 0.9)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px - 13, cy);
        ctx.lineTo(px, cy + 10);
        ctx.lineTo(px + 13, cy);
        ctx.strokeStyle = c === 0 ? '#aef3ff' : '#4fd8ef';
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Bảng tên cỡ lớn (không gian màn hình) cho cổng gần nhất — đọc rõ ở 390px. */
  function drawSignPlate() {
    if (!player) return;
    var signs = collectGateSigns();
    var best = null, bestD = 330;
    for (var i = 0; i < signs.length; i++) {
      // Đợt 6: bảng lớn chỉ dành cho biển cổng — biển cửa (plaque) đã nằm ngay tại cửa, hiện thêm bảng lớn là trùng hai lớp
      if (signs[i].kind !== 'gate') continue;
      var d = Math.hypot(player.x - signs[i].x, player.y - signs[i].y);
      if (d < bestD) { bestD = d; best = signs[i]; }
    }
    // Đợt 6: đứng sát cổng (dưới 190px) thì biển gỗ tại cổng đã đọc rõ — ẩn bảng lớn để không trùng hai lớp cùng một tên
    if (best && bestD < 190) return;
    if (!best) return;
    var sx = (best.x - camera.x) * camera.scale;
    var sy = (best.y - camera.y) * camera.scale - 58;
    ctx.save();
    ctx.font = 'bold 17px "Noto Serif", serif';
    var tw = ctx.measureText(best.label).width;
    var bw = tw + 34, bh = 38;
    var bx = Math.max(8, Math.min(canvas.width - bw - 8, sx - bw / 2));
    var by = Math.max(8, sy - bh);
    ctx.fillStyle = 'rgba(46, 32, 18, 0.94)';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe9b0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(best.label, bx + bw / 2, by + bh / 2 + 1);
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
    setQuality: setQuality,
    getQuality: function () { return currentQuality; },
    castSkill: castSkill,
    handleRevive: handleRevive,
    switchMap: switchMap,
    teleportTo: teleportTo,
    handleNpcTalked: handleNpcTalked,
    getCurrentMap: function () { return mapData; },
    getCurrentMapId: function () { return currentMapId; },
    getCurrentZone: getCurrentZone,
    getQuestTargetInfo: getQuestTargetInfo,
    resolveQuestDestination: resolveQuestDestination,
    findRoute: findRoute,
    getFieldMonsters: function () { return fieldMonsters; },
    // Kiểm chứng sprite quái nạp đúng khóa (bắt lỗi lệch khóa nạp/tra cứu như Đợt 3)
    getMonsterSheetStatus: function () {
      var alias = { thao_tinh: 'thaotinh_sheet', nhen_xanh: 'nhenxanh_sheet', co_thu_yeu: 'cothuye_sheet' };
      var out = {};
      var species = (monstersAPI && monstersAPI.SPECIES) ? monstersAPI.SPECIES : {};
      for (var sid in species) {
        var img = assets[sid + '_sheet'] || (alias[sid] ? assets[alias[sid]] : null);
        out[sid] = !!(img && img.complete && img.naturalWidth > 0);
        if (species[sid].skillAsset) {
          var skImg = assets[sid + '_skill_sheet'];
          out[sid + '_skill'] = !!(skImg && skImg.complete && skImg.naturalWidth > 0);
        }
      }
      return out;
    },
    getGroundDrops: function () { return groundDrops; },
    performContextAction: performContextAction,
    getActionContext: function () { return computeActionContext(); },
    startAutoQuestPath: startAutoQuestPath,
    toggleAutoQuestPath: toggleAutoQuestPath,
    cancelAutoPath: function () { cancelAutoPath(true); },
    isAutoPathActive: function () { return autoPath.active; },
    hasQuestTarget: function () { return getQuestTargetInfo() !== null && getQuestTargetInfo().stepId !== 'done'; },
    travelToMap: travelToMap,
    cancelTravel: cancelTravel,
    planTravelRoute: planTravelRoute,
    getTravelState: function () { return travelState; },
    useItem: useItem,
    tryBreakthrough: tryBreakthrough,
    exchangePill: exchangePill,
    refineTrucCoDan: refineTrucCoDan,
    equipItem: equipItem,
    unequipItem: unequipItem,
    pathToPoint: pathToPoint,
    getUserZoom: getUserZoom,
    setUserZoom: setUserZoom,
    getCameraScale: getCameraScale,
    setJoystickVector: setJoystickVector,
    triggerScreenShake: triggerScreenShake,
    triggerPathTo: triggerPathTo,
    handleWorldClick: handleWorldClick,
    getCurrentPath: function () { return currentPath; },
    getPendingInteraction: function () { return pendingInteraction; },
    isPlayerInNpcRange: isPlayerInNpcRange,
    triggerDialogue: triggerDialogue,
    getLastOpenedDialogue: function () { return lastOpenedDialogue; },
    setCurrentMap: function (mapId) {
      currentMapId = mapId;
      var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null);
      if (holder && holder.maps && holder.maps[mapId]) {
        mapData = holder.maps[mapId];
      } else if (holder && holder.getMap) {
        mapData = holder.getMap(mapId);
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EngineAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameEngine = EngineAPI;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
