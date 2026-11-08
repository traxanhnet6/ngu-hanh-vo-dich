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
      'assets/chars/thaotinhtinhanh-sheet.png',
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
        if (url === 'assets/chars/thaotinhtinhanh-sheet.png') assets['thaotinhtinhanh_sheet'] = img;
        if (url === 'assets/art/icons-sheet.png') assets['icons_sheet'] = img;
      })(urls[i]);
    }
  }

  function initEngine(canvasEl, playerObj, mapObj, onReady) {
    canvas = canvasEl;
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    player = playerObj;
    mapData = mapObj || (typeof window !== 'undefined' ? window.MapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    stateAPI = typeof window !== 'undefined' ? window.GameState : (typeof require !== 'undefined' ? require('./state.js') : null);
    audioAPI = typeof window !== 'undefined' ? window.GameAudio : null;
    pathfinder = typeof window !== 'undefined' ? window.Pathfinder : (typeof require !== 'undefined' ? require('./pathfind.js') : null);
    combatAPI = typeof window !== 'undefined' ? window.GameCombat : null;
    monstersAPI = typeof window !== 'undefined' ? window.GameMonsters : null;
    onReadyCallback = onReady;

    if (canvas) resizeCanvas();
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

  function isNpcActive(npc) {
    if (!npc) return false;
    if (!npc.questGate) return true;
    var s = (player && player.quests && player.quests.sectStage !== undefined) ? player.quests.sectStage : 0;
    if (npc.questGate === 'before_departure') return s < 1;
    if (npc.questGate === 'after_departure') return s >= 1;
    return true;
  }

  function handleWorldClick(worldX, worldY) {
    if (!player || !mapData) return;
    if (autoPath.active) autoPath.active = false; // Chạm để tự đi -> dừng tự tìm đường

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
    if (mapData.npcs && mapData.npcs.length > 0) {
      for (var n = 0; n < mapData.npcs.length; n++) {
        var npc = mapData.npcs[n];
        if (!isNpcActive(npc)) continue;
        var bounds = {
          x: npc.x - 10,
          y: npc.y - 10,
          w: npc.w + 20,
          h: npc.h + 20
        };
        if (worldX >= bounds.x && worldX <= bounds.x + bounds.w &&
            worldY >= bounds.y && worldY <= bounds.y + bounds.h) {
          var distToNpc = Math.hypot(player.x - npc.feetX, player.y - npc.feetY);
          if (distToNpc <= INTERACTION_RANGE) {
            triggerDialogue(npc);
          } else {
            (function (targetNpc) {
              triggerPathTo(targetNpc.standTile.x, targetNpc.standTile.y, {
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

  function triggerDialogue(npc) {
    if (!npc) return;
    if (typeof window !== 'undefined' && window.GameUI) {
      var stepInfo = getQuestTargetInfo();
      var isTarget = stepInfo && stepInfo.kind === 'npc' && stepInfo.npcId === npc.id;
      var lines = (isTarget && npc.dialogueQuest && npc.dialogueQuest.length > 0) ? npc.dialogueQuest : (npc.dialogueDefault || npc.dialogue || []);
      var resolvedNpc = Object.assign({}, npc, { dialogue: lines });
      window.GameUI.openDialogue(resolvedNpc);
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
        player.linhThach = (player.linhThach || 0) + 30;
        if (audioAPI) audioAPI.playChime();
        spawnFloatingText('+30 Linh Thạch', player.x, player.y - 35, '#ffe9a8');
        if (stateAPI) stateAPI.savePlayer(player);
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhập môn hoàn thành! Đài Truyền Tống phía đông nam đã mở.');
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
        var stats = stateAPI ? stateAPI.deriveStats(player.paths) : { attack: 10 };
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

    // 3. Active NPCs in 48px
    if (mapData.npcs) {
      for (var n = 0; n < mapData.npcs.length; n++) {
        var npc = mapData.npcs[n];
        if (isNpcActive(npc) && Math.hypot(player.x - npc.feetX, player.y - npc.feetY) <= INTERACTION_RANGE) {
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
  }

  // ============================================================
  // NÚT TỰ TÌM ĐƯỜNG THEO NHIỆM VỤ & ĐỊNH TUYẾN ĐA CHẶNG (BFS)
  // Single Source of Truth cho Mũi tên dẫn đường, Tự tìm đường & Panel nhiệm vụ
  // ============================================================
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
    return { stepId: 'done', stage: 4, mapId: null, kind: 'point' };
  }

  function resolveQuestDestination(info) {
    if (!info) return null;
    if (info.kind === 'npc') {
      var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
      var targetMap = holder ? (holder.getMap ? holder.getMap(info.mapId) : holder.maps[info.mapId]) : mapData;
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

  function startAutoQuestPath() {
    var info = getQuestTargetInfo();
    if (!info || info.stepId === 'done') {
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
    };
  }

  function teleportTo(mapId, x, y) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.closeTeleportModal) {
      window.GameUI.closeTeleportModal();
    }
    var mapHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
    var targetMap = (mapHolder && mapHolder.getMap) ? mapHolder.getMap(mapId) : mapData;
    var spawn = (x !== undefined && y !== undefined) ? { x: x, y: y } : (targetMap ? targetMap.spawn : { x: 560, y: 620 });
    switchMap(mapId, spawn);
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
    // Note 8: nạp cờ chất lượng độc lập với hệ âm thanh
    if (stateAPI) {
      var qSettings = stateAPI.loadSettings();
      if (qSettings) setQuality(qSettings.quality || 'cao');
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

    // 4b. Vẽ các điểm thu hái (Harvest Nodes)
    if (mapData.harvestNodes) {
      var nowSecH = performance.now() / 1000;
      for (var h = 0; h < mapData.harvestNodes.length; h++) {
        var node = mapData.harvestNodes[h];
        var isReady = nowSecH >= (harvestReadyTimes[node.id] || 0);
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
        } else {
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
                ctx.drawImage(nImg, npc.x, npc.y, npc.w, npc.h);
              }

              var qTarget = getQuestTargetInfo();
              if (qTarget && qTarget.kind === 'npc' && qTarget.npcId === npc.id) {
                var bobN = Math.sin(performance.now() / 250) * 4;
                drawQuestExclamation(npc.feetX, npc.y - 18 + bobN);
              }

              var dPlayer = Math.hypot(player.x - npc.feetX, player.y - npc.feetY);
              if (dPlayer <= INTERACTION_RANGE) {
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

    // 7b. Biển chỉ tên tại các điểm chuyển map (Đợt 3, Note 4)
    drawGateSigns();

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
      ctx.ellipse(m.x, m.y, 75, 26, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Bóng tiếp xúc dưới chân (Đợt 3: to và đậm hơn để đọc rõ ở cỡ điện thoại)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 8, 0.52)';
    ctx.beginPath();
    var shadowW = m.isElite ? 70 : 31;
    var shadowH = m.isElite ? 22 : 11;
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

      // Đợt 3: biên độ nhún thở/idle phải đọc được ở cỡ điện thoại
      var bobY = 0;
      if (row === 0) bobY = Math.sin(m.animTime * 2.4 + (m.x % 7)) * (m.isElite ? 3.5 : 2.4);
      else if (row === 1) bobY = -Math.abs(Math.sin(m.animTime * 6.0)) * 2;

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
  }

  function drawGroundDrop(drop) {
    var def = monstersAPI.ITEM_DEFS[drop.itemId];
    var isCurrency = (drop.itemId === 'linh-thach');

    ctx.save();
    // Vầng sáng mềm dưới vật phẩm
    ctx.shadowColor = isCurrency ? 'rgba(90, 220, 240, 0.9)' : 'rgba(85, 216, 130, 0.8)';
    ctx.shadowBlur = qualityShadow(10);
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
          signs.push({ x: it.x + 118, y: it.y - 40, label: 'Đại Điện', kind: 'plaque' });
        } else if (it.action === 'door_exit') {
          signs.push({ x: it.x, y: it.y - 46, label: 'Ra Sơn Môn', kind: 'plaque' });
        } else if (it.action === 'open_teleport') {
          signs.push({ x: it.x, y: it.y - 96, label: 'Đài Truyền Tống', kind: 'plaque' });
        }
      }
    }
    // Đài Truyền Tống: bia đá ghi từng điểm đến quanh đài (thấy trước khi dùng)
    if (mapData.id === 'dai-truyen-tong') {
      signs.push({ x: 268, y: 300, label: 'Miếu Hoang', kind: 'stele' });
      signs.push({ x: 692, y: 300, label: 'Rừng Độc Thanh Tụy', kind: 'stele' });
      signs.push({ x: 480, y: 486, label: 'Sơn Môn', kind: 'stele' });
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

  /** Bảng tên cỡ lớn (không gian màn hình) cho cổng gần nhất — đọc rõ ở 390px. */
  function drawSignPlate() {
    if (!player) return;
    var signs = collectGateSigns();
    var best = null, bestD = 330;
    for (var i = 0; i < signs.length; i++) {
      var d = Math.hypot(player.x - signs[i].x, player.y - signs[i].y);
      if (d < bestD) { bestD = d; best = signs[i]; }
    }
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
      for (var sid in alias) {
        var img = assets[sid + '_sheet'] || assets[alias[sid]];
        out[sid] = !!(img && img.complete && img.naturalWidth > 0);
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
    hasQuestTarget: function () { return getQuestTargetInfo() !== null && getQuestTargetInfo().stepId !== 'done'; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EngineAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameEngine = EngineAPI;
  }
})(typeof window !== 'undefined' ? window : this);
