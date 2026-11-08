/**
 * mapdata.js — Định nghĩa các bản đồ:
 *  - mieu_hoang: Miếu Hoang (1920x1280)
 *  - rung-doc: Rừng Độc Thanh Tụy (1920x1280)
 *  - tong-mon: Tông Môn — Núi Chính (1920x1280)
 *  - dai-dien: Đại Điện Tông Môn (1200x800)
 *  - son-coc: Sơn Cốc U Tịch (1152x768)
 *  - dai-truyen-tong: Đài Truyền Tống Cổ Trận (960x672)
 *
 * Tương thích cả Browser và Node.js.
 * Theo chuẩn Brief Đợt 3 & Hồ sơ 22-chuan-tong-mon.
 */
(function (global) {
  'use strict';

  var GRID_SIZE = 24;

  function buildGrid(width, height, isWalkableFn) {
    var cols = Math.ceil(width / GRID_SIZE);
    var rows = Math.ceil(height / GRID_SIZE);
    var grid = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) {
        var wx = c * GRID_SIZE + GRID_SIZE / 2;
        var wy = r * GRID_SIZE + GRID_SIZE / 2;
        row.push(isWalkableFn(wx, wy) ? 0 : 1);
      }
      grid.push(row);
    }
    return grid;
  }

  function forceWalkable(grid, wx, wy) {
    var c = Math.floor(wx / GRID_SIZE);
    var r = Math.floor(wy / GRID_SIZE);
    if (grid && r >= 0 && r < grid.length && c >= 0 && c < grid[0].length) {
      grid[r][c] = 0;
    }
  }

  // ============================================================
  // MAP 1: MIẾU HOANG (1920 x 1280)
  // ============================================================

  var TEMPLE = {
    id: 'temple_main',
    asset: 'assets/art/obj-temple.png',
    originalW: 760,
    originalH: 587,
    w: 430,
    h: 332,
    x: 265, // 480 - 430 / 2
    y: 138, // 470 - 332
    baseY: 470,
    baseRect: {
      x: 285,
      y: 410,
      w: 390,
      h: 60
    },
    doorAnchor: {
      x: 480,
      y: 490
    },
    lockedToast: 'Miếu đang khóa — đợt sau mở'
  };

  var TREES_MIEU = [
    {
      id: 'pine_1',
      asset: 'assets/art/obj-tree-pine.png',
      originalW: 299,
      originalH: 520,
      w: 140,
      h: 243,
      x: 140,
      y: 140,
      baseY: 380,
      trunk: { x: 210, y: 375, r: 14 }
    },
    {
      id: 'pine_2',
      asset: 'assets/art/obj-tree-pine.png',
      originalW: 299,
      originalH: 520,
      w: 150,
      h: 260,
      x: 1160,
      y: 30,
      baseY: 285,
      trunk: { x: 1235, y: 280, r: 14 }
    },
    {
      id: 'pine_3',
      asset: 'assets/art/obj-tree-pine.png',
      originalW: 299,
      originalH: 520,
      w: 140,
      h: 243,
      x: 180,
      y: 720,
      baseY: 960,
      trunk: { x: 250, y: 955, r: 14 }
    }
  ];

  var SCENERY_OBSTACLES_MIEU = [
    { x: 90, y: 220, r: 18 },
    { x: 110, y: 550, r: 18 },
    { x: 1800, y: 250, r: 20 },
    { x: 1860, y: 780, r: 20 },
    { x: 130, y: 1120, r: 22 },
    { rect: { x: 0, y: 0, w: 1920, h: 50 } },
    { rect: { x: 0, y: 0, w: 50, h: 1280 } },
    { rect: { x: 1900, y: 0, w: 20, h: 425 } },
    { rect: { x: 1900, y: 525, w: 20, h: 755 } },
    { rect: { x: 0, y: 1260, w: 775, h: 20 } },
    { rect: { x: 885, y: 1260, w: 1035, h: 20 } },
    // Đợt 3 (Note 2 — kiểm toán va chạm vật vẽ sẵn): mọi vật rắn VẼ TRONG NỀN
    // đều phải chặn đường đúng chân đế nhìn thấy. Danh mục đối chiếu ở docs/dot3-report.md.
    { x: 778, y: 190, r: 14 },
    { x: 1024, y: 350, r: 12 },
    { x: 605, y: 185, r: 22 },
    { x: 450, y: 178, r: 13 },
    { x: 58, y: 395, r: 14 },
    { rect: { x: 855, y: 320, w: 410, h: 60 } },
    { rect: { x: 1595, y: 185, w: 305, h: 215 } },
    { rect: { x: 1615, y: 575, w: 285, h: 330 } },
    { x: 1142, y: 560, r: 24 },
    { x: 1012, y: 620, r: 16 },
    { x: 998, y: 495, r: 20 },
    { x: 150, y: 745, r: 38 },
    { x: 355, y: 780, r: 48 },
    { x: 242, y: 722, r: 16 },
    { x: 1798, y: 1160, r: 15 },
    { x: 148, y: 990, r: 16 }
  ];

  var LINH_NHI = {
    id: 'npc_linhnhi',
    name: 'Linh Nhi',
    asset: 'assets/art/npc-linhnhi.png',
    originalW: 252,
    originalH: 560,
    h: 118,
    w: 53,
    x: 674,
    y: 442,
    feetX: 700,
    feetY: 560,
    baseY: 560,
    collisionRadius: 14,
    standTile: {
      x: 676,
      y: 560
    },
    questGate: 'before_departure',
    dialogue: [
      'Ca ca đã về rồi! Hôm nay tuyết lạnh quá, muội lo ca ca gặp chuyện chẳng lành...',
      'Bó củi này... Mã Tam ở thành Tây Lương lại ép giá nữa phải không? Ba đồng thì chỉ vừa mua hai cái bánh bao...',
      'Ngày mai người của Mã Tam lại đến đòi nợ tiền thuốc. Chúng ta... phải làm sao đây ca ca?',
      'Ca ca nghỉ ngơi một lát đi. Lát nữa muội đi nhóm bếp nấu chút cháo ấm.'
    ],
    dialogueDefault: [
      'Ca ca đã về rồi! Hôm nay tuyết lạnh quá, muội lo ca ca gặp chuyện chẳng lành...',
      'Bó củi này... Mã Tam ở thành Tây Lương lại ép giá nữa phải không? Ba đồng thì chỉ vừa mua hai cái bánh bao...',
      'Ngày mai người của Mã Tam lại đến đòi nợ tiền thuốc. Chúng ta... phải làm sao đây ca ca?',
      'Ca ca nghỉ ngơi một lát đi. Lát nữa muội đi nhóm bếp nấu chút cháo ấm.'
    ],
    dialogueQuest: [
      'Ca ca... ca ca thực sự muốn bái nhập Thanh Vân Tông sao?',
      'Muội không ở lại một mình đâu! Muội đã dọn dẹp hành lý rồi, muội sẽ đi cùng ca ca.',
      'Đường xuống núi ở phía nam Miếu Hoang thông thẳng tới Sơn Môn. Ca ca mau dẫn đường đi!'
    ]
  };

  var SPAWN_MIEU = {
    x: 560,
    y: 620
  };

  var EXITS_MIEU = [
    {
      id: 'exit_right',
      name: 'Rừng Độc Thanh Tụy',
      rect: { x: 1880, y: 430, w: 40, h: 90 },
      chipLabel: null,
      target: { x: 1890, y: 475 },
      targetMap: 'rung-doc',
      targetSpawn: { x: 90, y: 560 }
    },
    {
      id: 'exit_bottom',
      name: 'Đường xuống núi',
      rect: { x: 780, y: 1240, w: 100, h: 40 },
      chipLabel: null, // Đã mở ở Đợt 3
      target: { x: 830, y: 1250 },
      targetMap: 'tong-mon',
      targetSpawn: { x: 960, y: 1150 }
    }
  ];

  var INTERACTABLES_MIEU = [
    {
      id: 'interact_temple_door',
      label: 'Cửa Miếu',
      x: 480,
      y: 490,
      radius: 48,
      action: 'temple_door'
    }
  ];

  var ZONES_MIEU = [
    {
      id: 'mieu_hoang',
      name: 'Miếu Hoang',
      desc: 'Ngôi miếu cổ đổ nát trên đỉnh núi tuyết, nơi hai huynh muội nương tựa nhau.',
      rect: { x: 0, y: 0, w: 1920, h: 1280 }
    }
  ];

  function isWalkableMieu(x, y) {
    if (x < 10 || x > 1920 - 10 || y < 10 || y > 1280 - 10) {
      var inExit = false;
      for (var e = 0; e < EXITS_MIEU.length; e++) {
        var er = EXITS_MIEU[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    var tRect = TEMPLE.baseRect;
    if (x >= tRect.x && x <= tRect.x + tRect.w && y >= tRect.y && y <= tRect.y + tRect.h) {
      return false;
    }

    for (var i = 0; i < TREES_MIEU.length; i++) {
      var tr = TREES_MIEU[i].trunk;
      var dx = x - tr.x;
      var dy = y - tr.y;
      if (dx * dx + dy * dy <= tr.r * tr.r) return false;
    }

    var dxLn = x - LINH_NHI.feetX;
    var dyLn = y - LINH_NHI.feetY;
    if (dxLn * dxLn + dyLn * dyLn <= LINH_NHI.collisionRadius * LINH_NHI.collisionRadius) {
      return false;
    }

    for (var j = 0; j < SCENERY_OBSTACLES_MIEU.length; j++) {
      var obs = SCENERY_OBSTACLES_MIEU[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_MIEU.length; k++) {
          var exr = EXITS_MIEU[k].rect;
          if (x >= exr.x && x <= exr.x + exr.w && y >= exr.y && y <= exr.y + exr.h) {
            inExitZone = true;
            break;
          }
        }
        if (!inExitZone && x >= obs.rect.x && x <= obs.rect.x + obs.rect.w &&
            y >= obs.rect.y && y <= obs.rect.y + obs.rect.h) {
          return false;
        }
      } else if (obs.r) {
        var ox = x - obs.x;
        var oy = y - obs.y;
        if (ox * ox + oy * oy <= obs.r * obs.r) return false;
      }
    }

    return true;
  }

  var collisionGridMieu = buildGrid(1920, 1280, isWalkableMieu);
  forceWalkable(collisionGridMieu, SPAWN_MIEU.x, SPAWN_MIEU.y);
  forceWalkable(collisionGridMieu, TEMPLE.doorAnchor.x, TEMPLE.doorAnchor.y);
  forceWalkable(collisionGridMieu, LINH_NHI.standTile.x, LINH_NHI.standTile.y);
  forceWalkable(collisionGridMieu, EXITS_MIEU[0].target.x, EXITS_MIEU[0].target.y);
  forceWalkable(collisionGridMieu, EXITS_MIEU[1].target.x, EXITS_MIEU[1].target.y);

  var MAP_MIEU_HOANG = {
    id: 'mieu_hoang',
    name: 'Miếu Hoang',
    width: 1920,
    height: 1280,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1920 / GRID_SIZE),
    rows: Math.ceil(1280 / GRID_SIZE),
    bgImage: 'assets/art/map-mieu-hoang-bg.png',
    spawn: SPAWN_MIEU,
    temple: TEMPLE,
    linhnhi: LINH_NHI,
    trees: TREES_MIEU,
    standees: [
      Object.assign({}, TEMPLE, { id: 'temple_main' }),
      TREES_MIEU[0],
      TREES_MIEU[1],
      TREES_MIEU[2]
    ],
    npcs: [LINH_NHI],
    interactables: INTERACTABLES_MIEU,
    harvestNodes: [],
    monsterPacks: [],
    zones: ZONES_MIEU,
    obstacles: SCENERY_OBSTACLES_MIEU,
    exits: EXITS_MIEU,
    collisionGrid: collisionGridMieu,
    isWalkable: isWalkableMieu
  };

  // ============================================================
  // MAP 2: RỪNG ĐỘC THANH TỤY (1920 x 1280)
  // ============================================================

  var SPAWN_RUNG_DOC = {
    x: 90,
    y: 560
  };

  var EXITS_RUNG_DOC = [
    {
      id: 'exit_to_mieu',
      name: 'Về Miếu Hoang',
      rect: { x: 0, y: 480, w: 45, h: 160 },
      chipLabel: null,
      target: { x: 1850, y: 475 },
      targetMap: 'mieu_hoang',
      targetSpawn: { x: 1850, y: 475 }
    }
  ];

  var STAND_OBJECTS_RUNG_DOC = [
    {
      id: 'broadleaf_1',
      asset: 'assets/art/obj-tree-broadleaf.png',
      originalW: 454,
      originalH: 540,
      w: 260,
      h: 310,
      x: 620,
      y: 120,
      baseY: 410,
      trunk: { x: 750, y: 410, r: 18 }
    },
    {
      id: 'broadleaf_2',
      asset: 'assets/art/obj-tree-broadleaf.png',
      originalW: 454,
      originalH: 540,
      w: 250,
      h: 300,
      x: 1240,
      y: 580,
      baseY: 860,
      trunk: { x: 1365, y: 860, r: 18 }
    },
    {
      id: 'broadleaf_3',
      asset: 'assets/art/obj-tree-broadleaf.png',
      originalW: 454,
      originalH: 540,
      w: 240,
      h: 290,
      x: 340,
      y: 780,
      baseY: 1050,
      trunk: { x: 460, y: 1050, r: 18 }
    },
    {
      id: 'fallen_log_1',
      asset: 'assets/art/obj-fallen-log.png',
      originalW: 400,
      originalH: 245,
      w: 200,
      h: 122,
      x: 920,
      y: 640,
      baseY: 730,
      // Đợt 3: thân gỗ là CẦU — va chạm chỉ ở đầu gốc phía tây, mặt cầu đi qua được
      trunk: { x: 948, y: 668, r: 14 }
    }
  ];

  var SCENERY_OBSTACLES_RUNG_DOC = [
    { rect: { x: 0, y: 0, w: 1920, h: 45 } },
    { rect: { x: 0, y: 1255, w: 1920, h: 25 } },
    { rect: { x: 0, y: 0, w: 25, h: 475 } },
    { rect: { x: 0, y: 645, w: 25, h: 635 } },
    { rect: { x: 1900, y: 0, w: 20, h: 1280 } },
    { x: 300, y: 200, r: 22 },
    { x: 780, y: 1100, r: 22 },
    { x: 1680, y: 220, r: 24 },
    // Đợt 3 (Note 2 — kiểm toán va chạm vật vẽ sẵn trong nền Rừng Độc)
    { rect: { x: 0, y: 45, w: 1920, h: 205 } },
    { x: 963, y: 352, r: 20 },
    { x: 815, y: 262, r: 16 },
    { x: 1080, y: 322, r: 24 },
    { x: 1218, y: 408, r: 20 },
    { rect: { x: 1420, y: 250, w: 280, h: 140 } },
    { x: 505, y: 522, r: 28 },
    { x: 345, y: 325, r: 18 },
    { x: 60, y: 290, r: 18 },
    { x: 745, y: 928, r: 26 },
    { x: 618, y: 805, r: 30 },
    { x: 82, y: 1085, r: 26 },
    { x: 1568, y: 1148, r: 22 },
    { x: 1555, y: 1232, r: 18 },
    { x: 1882, y: 762, r: 14 },
    { x: 140, y: 565, r: 34 }
  ];

  // Đợt 3 (Note 2): SUỐI LÀ CHƯỚNG NGẠI THẬT — lòng suối vẽ trong nền chặn đường,
  // chỉ qua được tại cầu gỗ (khúc gỗ bắc ngang ~ (1060,705)) và bãi cạn phía nam.
  var STREAM_SEGMENTS_RUNG_DOC = [
    [1005, 440], [1015, 540], [1030, 620], [1060, 705], [1095, 800],
    [1135, 900], [1180, 1000], [1235, 1100], [1290, 1200], [1335, 1280]
  ];
  var STREAM_HALF_WIDTH = 38;
  var STREAM_CROSSINGS_RUNG_DOC = [
    { x: 1060, y: 705, r: 95 },
    { rect: { x: 1245, y: 1050, w: 120, h: 110 } }
  ];

  function distToSegment(px, py, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay;
    var t = ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby);
    t = Math.max(0, Math.min(1, t));
    var cx = ax + t * abx, cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
  }

  function isInStreamRungDoc(x, y) {
    for (var c = 0; c < STREAM_CROSSINGS_RUNG_DOC.length; c++) {
      var cz = STREAM_CROSSINGS_RUNG_DOC[c];
      if (cz.r) {
        var dxc = x - cz.x, dyc = y - cz.y;
        if (dxc * dxc + dyc * dyc <= cz.r * cz.r) return false;
      } else if (cz.rect) {
        if (x >= cz.rect.x && x <= cz.rect.x + cz.rect.w && y >= cz.rect.y && y <= cz.rect.y + cz.rect.h) return false;
      }
    }
    for (var s = 0; s < STREAM_SEGMENTS_RUNG_DOC.length - 1; s++) {
      var a = STREAM_SEGMENTS_RUNG_DOC[s], b = STREAM_SEGMENTS_RUNG_DOC[s + 1];
      if (distToSegment(x, y, a[0], a[1], b[0], b[1]) < STREAM_HALF_WIDTH) return true;
    }
    return false;
  }

  var RUNG_DOC_KEY_ANCHORS = [
    { x: 420, y: 750 },
    { x: 550, y: 360 },
    { x: 920, y: 920 },
    { x: 1080, y: 460 },
    { x: 1380, y: 820 },
    { x: 1540, y: 420 }
  ];

  var RUNG_DOC_PACKS = [
    { id: 'pack_thaotinh_1', speciesId: 'thao_tinh', anchor: { x: 420, y: 750 }, count: 4, spread: 60 },
    { id: 'pack_thaotinh_2', speciesId: 'thao_tinh', anchor: { x: 550, y: 360 }, count: 4, spread: 60 },
    { id: 'pack_thaotinh_3', speciesId: 'thao_tinh', anchor: { x: 920, y: 920 }, count: 5, spread: 60 },
    { id: 'pack_nhenxanh_1', speciesId: 'nhen_xanh', anchor: { x: 1080, y: 460 }, count: 3, spread: 50 },
    { id: 'pack_nhenxanh_2', speciesId: 'nhen_xanh', anchor: { x: 1380, y: 820 }, count: 3, spread: 50 },
    { id: 'pack_elite_cothuye', speciesId: 'co_thu_yeu', anchor: { x: 1540, y: 420 }, count: 1, spread: 0, isElite: true }
  ];

  var ZONES_RUNG_DOC = [
    {
      id: 'rung_doc',
      name: 'Rừng Độc Thanh Tụy',
      desc: 'Khu rừng ngập chướng khí và độc trùng quanh năm ẩm ướt.',
      rect: { x: 0, y: 0, w: 1920, h: 1280 }
    }
  ];

  function isWalkableRungDoc(x, y) {
    if (x < 10 || x > 1920 - 10 || y < 10 || y > 1280 - 10) {
      var inExit = false;
      for (var e = 0; e < EXITS_RUNG_DOC.length; e++) {
        var er = EXITS_RUNG_DOC[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    // Lòng suối (Đợt 3, Note 2): chặn, trừ cầu gỗ + bãi cạn phía nam
    if (isInStreamRungDoc(x, y)) return false;

    for (var i = 0; i < STAND_OBJECTS_RUNG_DOC.length; i++) {
      var tr = STAND_OBJECTS_RUNG_DOC[i].trunk;
      var dx = x - tr.x;
      var dy = y - tr.y;
      if (dx * dx + dy * dy <= tr.r * tr.r) return false;
    }

    for (var j = 0; j < SCENERY_OBSTACLES_RUNG_DOC.length; j++) {
      var obs = SCENERY_OBSTACLES_RUNG_DOC[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_RUNG_DOC.length; k++) {
          var exr = EXITS_RUNG_DOC[k].rect;
          if (x >= exr.x && x <= exr.x + exr.w && y >= exr.y && y <= exr.y + exr.h) {
            inExitZone = true;
            break;
          }
        }
        if (!inExitZone && x >= obs.rect.x && x <= obs.rect.x + obs.rect.w &&
            y >= obs.rect.y && y <= obs.rect.y + obs.rect.h) {
          return false;
        }
      } else if (obs.r) {
        var ox = x - obs.x;
        var oy = y - obs.y;
        if (ox * ox + oy * oy <= obs.r * obs.r) return false;
      }
    }

    return true;
  }

  var collisionGridRungDoc = buildGrid(1920, 1280, isWalkableRungDoc);
  forceWalkable(collisionGridRungDoc, SPAWN_RUNG_DOC.x, SPAWN_RUNG_DOC.y);
  forceWalkable(collisionGridRungDoc, EXITS_RUNG_DOC[0].target.x, EXITS_RUNG_DOC[0].target.y);
  for (var a = 0; a < RUNG_DOC_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridRungDoc, RUNG_DOC_KEY_ANCHORS[a].x, RUNG_DOC_KEY_ANCHORS[a].y);
  }

  var MAP_RUNG_DOC = {
    id: 'rung-doc',
    name: 'Rừng Độc Thanh Tụy',
    width: 1920,
    height: 1280,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1920 / GRID_SIZE),
    rows: Math.ceil(1280 / GRID_SIZE),
    bgImage: 'assets/art/map-rung-doc-bg.png',
    spawn: SPAWN_RUNG_DOC,
    standees: STAND_OBJECTS_RUNG_DOC,
    obstacles: SCENERY_OBSTACLES_RUNG_DOC,
    exits: EXITS_RUNG_DOC,
    collisionGrid: collisionGridRungDoc,
    isWalkable: isWalkableRungDoc,
    keyAnchors: RUNG_DOC_KEY_ANCHORS,
    npcs: [],
    interactables: [],
    harvestNodes: [],
    monsterPacks: RUNG_DOC_PACKS,
    zones: ZONES_RUNG_DOC
  };

  // ============================================================
  // MAP 3: TÔNG MÔN — NÚI CHÍNH (1920 x 1280)
  // ============================================================

  var SPAWN_TONG_MON = {
    x: 960,
    y: 1150
  };

  var ZONES_TONG_MON = [
    {
      id: 'dinh_thien_mon',
      name: 'Đỉnh Tiên Môn',
      desc: 'Đài cao nhất của sơn môn, nơi trưởng lão tĩnh tọa ngắm mây.',
      rect: { x: 650, y: 10, w: 620, h: 260 }
    },
    {
      id: 'dai_dien',
      name: 'Đại Điện',
      desc: 'Điện chính của tông môn, nơi chưởng môn ngự tọa.',
      rect: { x: 600, y: 20, w: 720, h: 470 }
    },
    {
      id: 'quang_truong',
      name: 'Quảng Trường',
      desc: 'Sân trung tâm có vòng thái cực, nơi đệ tử tụ họp.',
      rect: { x: 740, y: 320, w: 440, h: 390 }
    },
    {
      id: 'loi_vao',
      name: 'Lối Vào',
      desc: 'Cổng chào của sơn môn, nơi tân đệ tử báo danh.',
      rect: { x: 700, y: 970, w: 520, h: 310 }
    },
    {
      id: 'dan_cu',
      name: 'Khu Dân Cư',
      desc: 'Nhà ở của đệ tử và cửa hàng tạp hóa của thương nhân.',
      rect: { x: 40, y: 990, w: 560, h: 260 }
    },
    {
      id: 'vuon_linh_duoc',
      name: 'Vườn Linh Dược',
      desc: 'Vườn thuốc của tông môn, linh thảo hái xong tự mọc lại.',
      rect: { x: 460, y: 310, w: 400, h: 750 }
    },
    {
      id: 'rung_truc',
      name: 'Rừng Trúc',
      desc: 'Rừng trúc yên tĩnh, có Thảo Tinh cho đệ tử luyện tay.',
      rect: { x: 40, y: 50, w: 540, h: 320 }
    },
    {
      id: 'khu_huan_luyen',
      name: 'Khu Huấn Luyện',
      desc: 'Sân luyện công với mộc nhân để thử chiêu thức.',
      rect: { x: 220, y: 500, w: 320, h: 340 }
    },
    {
      id: 'bi_canh',
      name: 'Bí Cảnh',
      desc: 'Cổng bí cảnh của tông môn, chỉ mở khi có sự kiện.',
      rect: { x: 1400, y: 20, w: 420, h: 340 }
    },
    {
      id: 'thap_tu_luyen',
      name: 'Tháp Tu Luyện',
      desc: 'Tháp khiêu chiến theo tầng (mở ở đợt sau); chân tháp là nơi đả tọa hồi linh.',
      rect: { x: 1500, y: 380, w: 400, h: 520 }
    },
    {
      id: 'ho_linh_tuyen',
      name: 'Hồ Linh Tuyền',
      desc: 'Hồ nước linh, ngâm tay vào là hồi phục khí huyết và linh lực.',
      rect: { x: 1200, y: 300, w: 560, h: 360 }
    },
    {
      id: 'sanh_thi_dau',
      name: 'Sảnh Thi Đấu',
      desc: 'Đấu trường tròn cho luận võ xếp hạng (mở ở đợt sau).',
      rect: { x: 1180, y: 640, w: 520, h: 420 }
    }
  ];

  var EXITS_TONG_MON = [
    {
      id: 'exit_to_mieu',
      name: 'Miếu Hoang',
      rect: { x: 905, y: 1245, w: 110, h: 35 },
      chipLabel: null,
      target: { x: 960, y: 1250 },
      targetMap: 'mieu_hoang',
      targetSpawn: { x: 830, y: 1190 }
    },
    {
      id: 'exit_to_son_coc',
      name: 'Sơn Cốc',
      rect: { x: 425, y: 0, w: 70, h: 26 },
      chipLabel: 'Sơn Cốc',
      target: { x: 460, y: 15 },
      targetMap: 'son-coc',
      targetSpawn: { x: 576, y: 690 }
    },
    {
      id: 'exit_to_teleport',
      name: 'Đài Truyền Tống',
      rect: { x: 1425, y: 1245, w: 130, h: 35 },
      chipLabel: 'Đài Truyền Tống',
      target: { x: 1490, y: 1255 },
      targetMap: 'dai-truyen-tong',
      targetSpawn: { x: 480, y: 610 }
    },
    {
      id: 'exit_to_dai_dien',
      name: 'Đại Điện',
      rect: { x: 925, y: 398, w: 70, h: 40 },
      chipLabel: null,
      target: { x: 960, y: 425 },
      targetMap: 'dai-dien',
      targetSpawn: { x: 600, y: 690 }
    }
  ];

  var STAND_OBJECTS_TONG_MON = [
    {
      id: 'standee_dai_dien',
      asset: 'assets/art/obj-dai-dien.png',
      originalW: 624,
      originalH: 488,
      w: 660,
      h: 380,
      x: 630,
      y: 40,
      baseY: 415,
      baseRect: { x: 675, y: 320, w: 590, h: 95 }
    },
    {
      id: 'standee_thap',
      asset: 'assets/art/obj-thap.png',
      originalW: 280,
      originalH: 658,
      w: 280,
      h: 430,
      x: 1600,
      y: 430,
      baseY: 850,
      baseRect: { x: 1635, y: 795, w: 210, h: 55 }
    },
    {
      id: 'standee_portal',
      asset: 'assets/art/obj-portal.png',
      originalW: 256,
      originalH: 256,
      w: 170,
      h: 180,
      x: 1560,
      y: 70,
      baseY: 245,
      trunk: { x: 1645, y: 215, r: 25 }
    },
    {
      id: 'bamboo_1',
      asset: 'assets/art/obj-bamboo.png',
      originalW: 300,
      originalH: 400,
      w: 120,
      h: 160,
      x: 90,
      y: 60,
      baseY: 210,
      trunk: { x: 150, y: 205, r: 12 }
    },
    {
      id: 'bamboo_2',
      asset: 'assets/art/obj-bamboo.png',
      originalW: 300,
      originalH: 400,
      w: 130,
      h: 173,
      x: 300,
      y: 40,
      baseY: 200,
      trunk: { x: 365, y: 195, r: 12 }
    },
    {
      id: 'bamboo_3',
      asset: 'assets/art/obj-bamboo.png',
      originalW: 300,
      originalH: 400,
      w: 110,
      h: 147,
      x: 430,
      y: 90,
      baseY: 230,
      trunk: { x: 485, y: 225, r: 12 }
    },
    {
      id: 'bamboo_4',
      asset: 'assets/art/obj-bamboo.png',
      originalW: 300,
      originalH: 400,
      w: 125,
      h: 167,
      x: 170,
      y: 150,
      baseY: 310,
      trunk: { x: 232, y: 305, r: 12 }
    }
  ];

  var NPCS_TONG_MON = [
    {
      id: 'npc_tiepdan',
      name: 'Tiếp Dẫn Đệ Tử',
      asset: 'assets/art/npc-tiepdan.png',
      originalW: 267,
      originalH: 560,
      w: 57,
      h: 120,
      x: 856,
      y: 945,
      feetX: 885,
      feetY: 1065,
      baseY: 1065,
      collisionRadius: 14,
      standTile: { x: 885, y: 1085 },
      questGate: null,
      dialogueDefault: [
        'Chào mừng đạo hữu đến Thanh Vân Tông. Muốn nhập môn cần có ấn chuẩn của Chưởng Môn.'
      ],
      dialogueQuest: [
        'Chào mừng sư đệ! Tạp linh căn không sao cả, tâm tính mới là gốc rễ.',
        'Chưởng Môn đang đợi đệ ở Đại Điện. Đi thẳng trục chính lên bắc, cửa điện luôn mở cho tân đệ tử!'
      ]
    },
    {
      id: 'npc_chapsu',
      name: 'Chấp Sự Đường',
      asset: 'assets/art/npc-chapsu.png',
      originalW: 334,
      originalH: 560,
      w: 72,
      h: 120,
      x: 1009,
      y: 625,
      feetX: 1045,
      feetY: 745,
      baseY: 745,
      collisionRadius: 14,
      standTile: { x: 1045, y: 765 },
      questGate: null,
      dialogueDefault: [
        'Môn quy tông môn nghiêm cẩn, đệ tử chớ lơ là việc tu luyện. Sắp tới sẽ mở thêm bí cảnh.'
      ],
      dialogueQuest: [
        'Chưởng Môn đã truyền ý chỉ nhận đệ làm ký danh đệ tử.',
        'Đây là 30 Linh Thạch cấp phát cùng phòng ở tại Khu Dân Cư. Đệ có thể dùng Đài Truyền Tống ở phía đông nam!'
      ]
    },
    {
      id: 'npc_truonglao',
      name: 'Truyền Công Trưởng Lão',
      asset: 'assets/art/npc-truonglao.png',
      originalW: 337,
      originalH: 560,
      w: 72,
      h: 120,
      x: 1094,
      y: 100,
      feetX: 1130,
      feetY: 220,
      baseY: 220,
      collisionRadius: 14,
      standTile: { x: 1130, y: 240 },
      questGate: null,
      dialogueDefault: [
        'Đứng trên đỉnh Tiên Môn ngắm biển mây, lòng người tự khắc tĩnh lặng. Nghe nói phía bắc Rừng Trúc có một vị ẩn sĩ lánh đời...'
      ]
    },
    {
      id: 'npc_duocsu',
      name: 'Dược Sư',
      asset: 'assets/art/npc-duocsu.png',
      originalW: 315,
      originalH: 560,
      w: 68,
      h: 120,
      x: 711,
      y: 490,
      feetX: 745,
      feetY: 610,
      baseY: 610,
      collisionRadius: 14,
      standTile: { x: 745, y: 632 },
      questGate: null,
      dialogueDefault: [
        'Linh thảo ở Vườn Dược sau khi hái sẽ tự hấp thu thiên địa linh khí để mọc lại. Lá Thanh Tụy này sau này rất cần để luyện Mộc Linh Đan.'
      ]
    },
    {
      id: 'npc_thuongnhan',
      name: 'Thương Nhân',
      asset: 'assets/art/npc-thuongnhan.png',
      originalW: 381,
      originalH: 560,
      w: 82,
      h: 120,
      x: 199,
      y: 970,
      feetX: 240,
      feetY: 1090,
      baseY: 1090,
      collisionRadius: 14,
      standTile: { x: 240, y: 1110 },
      questGate: null,
      dialogueDefault: [
        'Sạp hàng của ta đang dọn dẹp, đợt sau mới mở bán pháp bảo! Đệ tử mới cố gắng tích lũy Linh Thạch nhé.'
      ]
    },
    {
      id: 'npc_linhnhi_sect',
      name: 'Linh Nhi',
      asset: 'assets/art/npc-linhnhi.png',
      originalW: 252,
      originalH: 560,
      w: 53,
      h: 118,
      x: 453,
      y: 942,
      feetX: 480,
      feetY: 1060,
      baseY: 1060,
      collisionRadius: 14,
      standTile: { x: 480, y: 1080 },
      questGate: 'after_departure',
      dialogueDefault: [
        'Căn nhà ở tông môn ấm áp hơn Miếu Hoang nhiều ca ca ạ! Nhưng muội vẫn lo tên Mã Tam ở thành Tây Lương kéo người tới tìm...'
      ]
    }
  ];

  var INTERACTABLES_TONG_MON = [
    {
      id: 'interact_door_dai_dien',
      label: 'Vào Đại Điện',
      x: 960,
      y: 432,
      radius: 48,
      action: 'door_enter',
      targetMap: 'dai-dien',
      targetSpawn: { x: 600, y: 690 }
    },
    {
      id: 'interact_notice_board',
      label: 'Xem Bảng',
      x: 880,
      y: 700,
      radius: 44,
      action: 'notice_board'
    },
    {
      id: 'interact_rest_inn',
      label: 'Nhà Trọ',
      x: 430,
      y: 1160,
      radius: 48,
      action: 'rest_inn'
    },
    {
      id: 'dummy_1',
      label: 'Mộc Nhân',
      x: 295,
      y: 615,
      radius: 50,
      action: 'practice_dummy'
    },
    {
      id: 'dummy_2',
      label: 'Mộc Nhân',
      x: 395,
      y: 690,
      radius: 50,
      action: 'practice_dummy'
    },
    {
      id: 'dummy_3',
      label: 'Mộc Nhân',
      x: 310,
      y: 770,
      radius: 50,
      action: 'practice_dummy'
    },
    {
      id: 'interact_locked_portal',
      label: 'Phong Ấn Bí Cảnh',
      x: 1645,
      y: 255,
      radius: 52,
      action: 'locked_portal'
    },
    {
      id: 'interact_meditate',
      label: 'Đả Tọa',
      x: 1610,
      y: 525,
      radius: 48,
      action: 'meditate'
    },
    {
      id: 'interact_restore_spring',
      label: 'Linh Tuyền',
      x: 1315,
      y: 665,
      radius: 50,
      action: 'restore_spring',
      cooldownSec: 60
    },
    {
      id: 'interact_locked_arena',
      label: 'Võ Đài',
      x: 1395,
      y: 700,
      radius: 56,
      action: 'locked_arena'
    }
  ];

  var HARVEST_NODES_TONG_MON = [
    { id: 'harvest_tm_1', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 560, y: 390, radius: 48, respawnSec: 90, count: 1 },
    { id: 'harvest_tm_2', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 685, y: 450, radius: 48, respawnSec: 90, count: 1 },
    { id: 'harvest_tm_3', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 615, y: 840, radius: 48, respawnSec: 90, count: 1 },
    { id: 'harvest_tm_4', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 770, y: 840, radius: 48, respawnSec: 90, count: 1 }
  ];

  var MONSTER_PACKS_TONG_MON = [
    { id: 'pack_tm_1', speciesId: 'thao_tinh', count: 3, anchor: { x: 200, y: 230 }, spread: 55 },
    { id: 'pack_tm_2', speciesId: 'thao_tinh', count: 3, anchor: { x: 440, y: 180 }, spread: 55 }
  ];

  var SCENERY_OBSTACLES_TONG_MON = [
    // Biên bản đồ chừa cổng: nam về miếu 905-1015, nam xuống đài 1425-1555, bắc lên sơn cốc 425-495
    { rect: { x: 0, y: 0, w: 425, h: 25 } },
    { rect: { x: 495, y: 0, w: 1425, h: 25 } },
    { rect: { x: 0, y: 1255, w: 905, h: 25 } },
    { rect: { x: 1015, y: 1255, w: 410, h: 25 } },
    { rect: { x: 1555, y: 1255, w: 365, h: 25 } },
    { rect: { x: 0, y: 0, w: 25, h: 1280 } },
    { rect: { x: 1895, y: 0, w: 25, h: 1280 } },
    // Hồ Linh Tuyền theo tranh nền mới (nước 1250-1570 x 330-620, đá bờ tới 1245-1575 x 325-625); bờ tây nam tại (1315,665) để đệ tử tới ngâm tay hồi phục
    { rect: { x: 1245, y: 325, w: 330, h: 300 } },
    // Rặng trúc vẽ ở cạnh tây (trừ lối mòn quanh x=360-460 và các gốc standee đã có vòng thân riêng)
    { rect: { x: 0, y: 60, w: 185, h: 760 } },
    // Mái nhà vẽ nhô ở mép nam và mép tây nam của Khu Dân Cư (sân đá trước nhà vẫn đi được)
    { rect: { x: 60, y: 1185, w: 760, h: 70 } },
    { rect: { x: 0, y: 950, w: 60, h: 330 } }
  ];

  function isWalkableTongMon(x, y) {
    if (x < 10 || x > 1920 - 10 || y < 10 || y > 1280 - 10) {
      var inExit = false;
      for (var e = 0; e < EXITS_TONG_MON.length; e++) {
        var er = EXITS_TONG_MON[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    // Va chạm standees
    for (var s = 0; s < STAND_OBJECTS_TONG_MON.length; s++) {
      var st = STAND_OBJECTS_TONG_MON[s];
      if (st.baseRect) {
        var inDoor = false;
        if (st.id === 'standee_dai_dien') {
          // Khe cửa Đại Điện đi được
          if (x >= 920 && x <= 1000 && y >= 385 && y <= 418) inDoor = true;
        }
        if (!inDoor && x >= st.baseRect.x && x <= st.baseRect.x + st.baseRect.w &&
            y >= st.baseRect.y && y <= st.baseRect.y + st.baseRect.h) {
          return false;
        }
      } else if (st.trunk) {
        var tdx = x - st.trunk.x;
        var tdy = y - st.trunk.y;
        if (tdx * tdx + tdy * tdy <= st.trunk.r * st.trunk.r) return false;
      }
    }

    // Va chạm biên và chướng ngại
    for (var j = 0; j < SCENERY_OBSTACLES_TONG_MON.length; j++) {
      var obs = SCENERY_OBSTACLES_TONG_MON[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_TONG_MON.length; k++) {
          var exr = EXITS_TONG_MON[k].rect;
          if (x >= exr.x && x <= exr.x + exr.w && y >= exr.y && y <= exr.y + exr.h) {
            inExitZone = true;
            break;
          }
        }
        if (!inExitZone && x >= obs.rect.x && x <= obs.rect.x + obs.rect.w &&
            y >= obs.rect.y && y <= obs.rect.y + obs.rect.h) {
          return false;
        }
      } else if (obs.r) {
        var ox = x - obs.x;
        var oy = y - obs.y;
        if (ox * ox + oy * oy <= obs.r * obs.r) return false;
      }
    }

    // Va chạm NPC
    for (var n = 0; n < NPCS_TONG_MON.length; n++) {
      var npc = NPCS_TONG_MON[n];
      var ndx = x - npc.feetX;
      var ndy = y - npc.feetY;
      if (ndx * ndx + ndy * ndy <= npc.collisionRadius * npc.collisionRadius) {
        return false;
      }
    }

    return true;
  }

  var collisionGridTongMon = buildGrid(1920, 1280, isWalkableTongMon);
  forceWalkable(collisionGridTongMon, SPAWN_TONG_MON.x, SPAWN_TONG_MON.y);
  for (var etm = 0; etm < EXITS_TONG_MON.length; etm++) {
    forceWalkable(collisionGridTongMon, EXITS_TONG_MON[etm].target.x, EXITS_TONG_MON[etm].target.y);
  }
  for (var ntm = 0; ntm < NPCS_TONG_MON.length; ntm++) {
    forceWalkable(collisionGridTongMon, NPCS_TONG_MON[ntm].standTile.x, NPCS_TONG_MON[ntm].standTile.y);
  }
  for (var itm = 0; itm < INTERACTABLES_TONG_MON.length; itm++) {
    forceWalkable(collisionGridTongMon, INTERACTABLES_TONG_MON[itm].x, INTERACTABLES_TONG_MON[itm].y);
  }
  for (var htm = 0; htm < HARVEST_NODES_TONG_MON.length; htm++) {
    forceWalkable(collisionGridTongMon, HARVEST_NODES_TONG_MON[htm].x, HARVEST_NODES_TONG_MON[htm].y);
  }
  for (var ptm = 0; ptm < MONSTER_PACKS_TONG_MON.length; ptm++) {
    forceWalkable(collisionGridTongMon, MONSTER_PACKS_TONG_MON[ptm].anchor.x, MONSTER_PACKS_TONG_MON[ptm].anchor.y);
  }

  var MAP_TONG_MON = {
    id: 'tong-mon',
    name: 'Tông Môn — Núi Chính',
    width: 1920,
    height: 1280,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1920 / GRID_SIZE),
    rows: Math.ceil(1280 / GRID_SIZE),
    bgImage: 'assets/art/map-tong-mon-bg.png',
    spawn: SPAWN_TONG_MON,
    standees: STAND_OBJECTS_TONG_MON,
    npcs: NPCS_TONG_MON,
    interactables: INTERACTABLES_TONG_MON,
    harvestNodes: HARVEST_NODES_TONG_MON,
    monsterPacks: MONSTER_PACKS_TONG_MON,
    zones: ZONES_TONG_MON,
    obstacles: SCENERY_OBSTACLES_TONG_MON,
    exits: EXITS_TONG_MON,
    collisionGrid: collisionGridTongMon,
    isWalkable: isWalkableTongMon
  };

  // ============================================================
  // MAP 4: ĐẠI ĐIỆN — NỘI THẤT (1200 x 800)
  // ============================================================

  var SPAWN_DAI_DIEN = {
    x: 600,
    y: 690
  };

  var ZONES_DAI_DIEN = [
    {
      id: 'dai_dien',
      name: 'Đại Điện',
      desc: 'Điện chính của tông môn, nơi chưởng môn ngự tọa.',
      rect: { x: 0, y: 0, w: 1200, h: 800 }
    }
  ];

  var EXITS_DAI_DIEN = [
    {
      id: 'exit_to_tong_mon',
      name: 'Sơn Môn',
      rect: { x: 565, y: 762, w: 70, h: 38 },
      chipLabel: null,
      target: { x: 600, y: 775 },
      targetMap: 'tong-mon',
      targetSpawn: { x: 960, y: 640 }
    }
  ];

  var NPCS_DAI_DIEN = [
    {
      id: 'npc_chuongmon',
      name: 'Chưởng Môn',
      asset: 'assets/art/npc-chuongmon.png',
      originalW: 349,
      originalH: 560,
      w: 75,
      h: 120,
      x: 562,
      y: 193,
      feetX: 600,
      feetY: 313,
      baseY: 313,
      collisionRadius: 14,
      standTile: { x: 600, y: 335 },
      questGate: null,
      dialogueDefault: [
        'Đại đạo vô hình, sinh dục thiên địa. Tu tiên giả quý ở sự kiên trì bền bỉ.'
      ],
      dialogueQuest: [
        'Ngươi từ Miếu Hoang tới? Tạp linh căn tuy khó tu luyện, nhưng ngũ hành tương sinh, vạn vật chuyển hóa.',
        'Tạp linh căn không phế — phế là lòng người vội kết luận! Ta ban cho ngươi 20 Linh Thạch, hãy tới gặp Chấp Sự ở Quảng Trường nhận lệnh bài.'
      ]
    }
  ];

  var INTERACTABLES_DAI_DIEN = [
    {
      id: 'interact_door_exit',
      label: 'Ra Ngoài',
      x: 600,
      y: 770,
      radius: 48,
      action: 'door_enter',
      targetMap: 'tong-mon',
      targetSpawn: { x: 960, y: 640 }
    }
  ];

  var SCENERY_OBSTACLES_DAI_DIEN = [
    // Bệ ngồi chưởng môn (dais)
    { rect: { x: 430, y: 175, w: 340, h: 70 } },
    // 4 cột trụ
    { x: 300, y: 300, r: 16 },
    { x: 900, y: 300, r: 16 },
    { x: 300, y: 520, r: 16 },
    { x: 900, y: 520, r: 16 },
    // Chân cột vẽ trên tranh nền (hai cột tiền cảnh lớn + hai cột giữa) — bổ sung đợt 3 theo kiểm toán va chạm
    { x: 232, y: 618, r: 20 },
    { x: 972, y: 618, r: 20 },
    { x: 263, y: 340, r: 15 },
    { x: 938, y: 340, r: 15 },
    // Biên tường chừa cửa nam x: 565..635
    { rect: { x: 0, y: 0, w: 1200, h: 50 } },
    { rect: { x: 0, y: 0, w: 50, h: 800 } },
    { rect: { x: 1150, y: 0, w: 50, h: 800 } },
    { rect: { x: 0, y: 770, w: 565, h: 30 } },
    { rect: { x: 635, y: 770, w: 565, h: 30 } }
  ];

  function isWalkableDaiDien(x, y) {
    if (x < 10 || x > 1200 - 10 || y < 10 || y > 800 - 10) {
      var inExit = false;
      for (var e = 0; e < EXITS_DAI_DIEN.length; e++) {
        var er = EXITS_DAI_DIEN[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    for (var j = 0; j < SCENERY_OBSTACLES_DAI_DIEN.length; j++) {
      var obs = SCENERY_OBSTACLES_DAI_DIEN[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_DAI_DIEN.length; k++) {
          var exr = EXITS_DAI_DIEN[k].rect;
          if (x >= exr.x && x <= exr.x + exr.w && y >= exr.y && y <= exr.y + exr.h) {
            inExitZone = true;
            break;
          }
        }
        if (!inExitZone && x >= obs.rect.x && x <= obs.rect.x + obs.rect.w &&
            y >= obs.rect.y && y <= obs.rect.y + obs.rect.h) {
          return false;
        }
      } else if (obs.r) {
        var ox = x - obs.x;
        var oy = y - obs.y;
        if (ox * ox + oy * oy <= obs.r * obs.r) return false;
      }
    }

    // NPC Chưởng Môn
    for (var n = 0; n < NPCS_DAI_DIEN.length; n++) {
      var npc = NPCS_DAI_DIEN[n];
      var ndx = x - npc.feetX;
      var ndy = y - npc.feetY;
      if (ndx * ndx + ndy * ndy <= npc.collisionRadius * npc.collisionRadius) {
        return false;
      }
    }

    return true;
  }

  var collisionGridDaiDien = buildGrid(1200, 800, isWalkableDaiDien);
  forceWalkable(collisionGridDaiDien, SPAWN_DAI_DIEN.x, SPAWN_DAI_DIEN.y);
  forceWalkable(collisionGridDaiDien, EXITS_DAI_DIEN[0].target.x, EXITS_DAI_DIEN[0].target.y);
  forceWalkable(collisionGridDaiDien, NPCS_DAI_DIEN[0].standTile.x, NPCS_DAI_DIEN[0].standTile.y);
  forceWalkable(collisionGridDaiDien, INTERACTABLES_DAI_DIEN[0].x, INTERACTABLES_DAI_DIEN[0].y);

  var MAP_DAI_DIEN = {
    id: 'dai-dien',
    name: 'Đại Điện Tông Môn',
    width: 1200,
    height: 800,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1200 / GRID_SIZE),
    rows: Math.ceil(800 / GRID_SIZE),
    bgImage: 'assets/art/map-dai-dien-bg.png',
    spawn: SPAWN_DAI_DIEN,
    standees: [],
    npcs: NPCS_DAI_DIEN,
    interactables: INTERACTABLES_DAI_DIEN,
    harvestNodes: [],
    monsterPacks: [],
    zones: ZONES_DAI_DIEN,
    obstacles: SCENERY_OBSTACLES_DAI_DIEN,
    exits: EXITS_DAI_DIEN,
    collisionGrid: collisionGridDaiDien,
    isWalkable: isWalkableDaiDien
  };

  // ============================================================
  // MAP 5: SƠN CỐC U TỊCH (1152 x 768)
  // ============================================================

  var SPAWN_SON_COC = {
    x: 576,
    y: 690
  };

  var ZONES_SON_COC = [
    {
      id: 'son_coc',
      name: 'Sơn Cốc',
      desc: 'Thung lũng u tịch ẩn sâu sau rừng trúc, linh khí dồi dào.',
      rect: { x: 0, y: 0, w: 1152, h: 768 }
    }
  ];

  var EXITS_SON_COC = [
    {
      id: 'exit_to_tong_mon',
      name: 'Sơn Môn',
      rect: { x: 546, y: 738, w: 60, h: 30 },
      chipLabel: null,
      target: { x: 576, y: 750 },
      targetMap: 'tong-mon',
      targetSpawn: { x: 460, y: 64 }
    }
  ];

  var NPCS_SON_COC = [
    {
      id: 'npc_ansi',
      name: 'Ẩn Sĩ Tiêu Dao',
      asset: 'assets/art/npc-ansi.png',
      originalW: 334,
      originalH: 560,
      w: 72,
      h: 120,
      x: 794,
      y: 180,
      feetX: 830,
      feetY: 300,
      baseY: 300,
      collisionRadius: 14,
      standTile: { x: 830, y: 320 },
      questGate: null,
      dialogueDefault: [
        'Gió thoảng mây trôi, vạn pháp tự nhiên. Ngũ hành cân bằng mới là cảnh giới cao nhất của thiên địa. Ngươi thấy khối linh tinh kia chứ?'
      ]
    }
  ];

  var HARVEST_NODES_SON_COC = [
    { id: 'harvest_sc_1', itemId: 'linh-chi-rung', name: 'Linh Chi Rừng', x: 200, y: 600, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_sc_2', itemId: 'linh-chi-rung', name: 'Linh Chi Rừng', x: 950, y: 620, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_sc_3', itemId: 'linh-chi-rung', name: 'Linh Chi Rừng', x: 576, y: 180, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_sc_lt', itemId: 'linh-thach', name: 'Mỏ Linh Thạch', x: 790, y: 462, radius: 48, respawnSec: 300, countMin: 3, countMax: 5 }
  ];

  var SCENERY_OBSTACLES_SON_COC = [
    { rect: { x: 0, y: 0, w: 1152, h: 40 } },
    { rect: { x: 0, y: 0, w: 40, h: 768 } },
    { rect: { x: 1112, y: 0, w: 40, h: 768 } },
    { rect: { x: 0, y: 748, w: 546, h: 20 } },
    { rect: { x: 606, y: 748, w: 546, h: 20 } },
    // Mỏm đá u tịch
    { x: 300, y: 250, r: 24 },
    { x: 750, y: 550, r: 24 },
    // Kiểm toán va chạm đợt 3: mọi vật rắn vẽ trên tranh nền đều phải chặn đường
    // Hồ dưới thác (nước 170-500 x 320-550) và thác + vách đá tây bắc
    { rect: { x: 165, y: 315, w: 340, h: 240 } },
    { rect: { x: 110, y: 40, w: 230, h: 280 } },
    // Vách đá mép đông
    { rect: { x: 1085, y: 150, w: 67, h: 500 } },
    // Thân thông vẽ: tây (118,395), bắc (618,215), đông bắc (840,205), nam cạnh cổng (612,718)
    { x: 118, y: 395, r: 14 },
    { x: 618, y: 215, r: 13 },
    { x: 840, y: 205, r: 13 },
    { x: 612, y: 718, r: 13 },
    // Tảng đá lớn giữa thung (578,395), đá nâu mép đông (988,548), cụm tinh thể linh thạch (790,395)
    { x: 578, y: 395, r: 24 },
    { x: 988, y: 548, r: 22 },
    { x: 790, y: 395, r: 42 },
    // Vách đá mép tây nam
    { x: 60, y: 600, r: 40 },
    { x: 75, y: 470, r: 30 }
  ];

  function isWalkableSonCoc(x, y) {
    if (x < 10 || x > 1152 - 10 || y < 10 || y > 768 - 10) {
      var inExit = false;
      for (var e = 0; e < EXITS_SON_COC.length; e++) {
        var er = EXITS_SON_COC[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    for (var j = 0; j < SCENERY_OBSTACLES_SON_COC.length; j++) {
      var obs = SCENERY_OBSTACLES_SON_COC[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_SON_COC.length; k++) {
          var exr = EXITS_SON_COC[k].rect;
          if (x >= exr.x && x <= exr.x + exr.w && y >= exr.y && y <= exr.y + exr.h) {
            inExitZone = true;
            break;
          }
        }
        if (!inExitZone && x >= obs.rect.x && x <= obs.rect.x + obs.rect.w &&
            y >= obs.rect.y && y <= obs.rect.y + obs.rect.h) {
          return false;
        }
      } else if (obs.r) {
        var ox = x - obs.x;
        var oy = y - obs.y;
        if (ox * ox + oy * oy <= obs.r * obs.r) return false;
      }
    }

    for (var n = 0; n < NPCS_SON_COC.length; n++) {
      var npc = NPCS_SON_COC[n];
      var ndx = x - npc.feetX;
      var ndy = y - npc.feetY;
      if (ndx * ndx + ndy * ndy <= npc.collisionRadius * npc.collisionRadius) {
        return false;
      }
    }

    return true;
  }

  var collisionGridSonCoc = buildGrid(1152, 768, isWalkableSonCoc);
  forceWalkable(collisionGridSonCoc, SPAWN_SON_COC.x, SPAWN_SON_COC.y);
  forceWalkable(collisionGridSonCoc, EXITS_SON_COC[0].target.x, EXITS_SON_COC[0].target.y);
  forceWalkable(collisionGridSonCoc, NPCS_SON_COC[0].standTile.x, NPCS_SON_COC[0].standTile.y);
  for (var hsc = 0; hsc < HARVEST_NODES_SON_COC.length; hsc++) {
    forceWalkable(collisionGridSonCoc, HARVEST_NODES_SON_COC[hsc].x, HARVEST_NODES_SON_COC[hsc].y);
  }

  var MAP_SON_COC = {
    id: 'son-coc',
    name: 'Sơn Cốc U Tịch',
    width: 1152,
    height: 768,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1152 / GRID_SIZE),
    rows: Math.ceil(768 / GRID_SIZE),
    bgImage: 'assets/art/map-son-coc-bg.png',
    spawn: SPAWN_SON_COC,
    standees: [],
    npcs: NPCS_SON_COC,
    interactables: [],
    harvestNodes: HARVEST_NODES_SON_COC,
    monsterPacks: [],
    zones: ZONES_SON_COC,
    obstacles: SCENERY_OBSTACLES_SON_COC,
    exits: EXITS_SON_COC,
    collisionGrid: collisionGridSonCoc,
    isWalkable: isWalkableSonCoc
  };

  // ============================================================
  // MAP 6: ĐÀI TRUYỀN TỐNG CỔ TRẬN (960 x 672)
  // ============================================================

  var SPAWN_DAI_TRUYEN_TONG = {
    x: 480,
    y: 610
  };

  var ZONES_DAI_TRUYEN_TONG = [
    {
      id: 'dai_truyen_tong',
      name: 'Đài Truyền Tống',
      desc: 'Đài đá cổ trận trôi giữa biển mây, nối liền các sơn hà.',
      rect: { x: 0, y: 0, w: 960, h: 672 }
    }
  ];

  var EXITS_DAI_TRUYEN_TONG = [
    {
      id: 'exit_to_tong_mon',
      name: 'Sơn Môn',
      rect: { x: 450, y: 642, w: 60, h: 30 },
      chipLabel: null,
      target: { x: 480, y: 655 },
      targetMap: 'tong-mon',
      targetSpawn: { x: 1490, y: 1210 }
    }
  ];

  var INTERACTABLES_DAI_TRUYEN_TONG = [
    {
      id: 'interact_teleport_altar',
      label: 'Đài Truyền Tống',
      x: 480,
      y: 320,
      radius: 64,
      action: 'teleport'
    }
  ];

  var SCENERY_OBSTACLES_DAI_TRUYEN_TONG = [
    // Viền chừa cửa nam x: 450..510
    { rect: { x: 0, y: 0, w: 960, h: 40 } },
    { rect: { x: 0, y: 0, w: 40, h: 672 } },
    { rect: { x: 920, y: 0, w: 40, h: 672 } },
    { rect: { x: 0, y: 650, w: 450, h: 22 } },
    { rect: { x: 510, y: 650, w: 450, h: 22 } }
  ];

  function isWalkableDaiTruyenTong(x, y) {
    if (x < 10 || x > 960 - 10 || y < 10 || y > 672 - 10) {
      var inExit = false;
      for (var e = 0; e < EXITS_DAI_TRUYEN_TONG.length; e++) {
        var er = EXITS_DAI_TRUYEN_TONG[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    for (var j = 0; j < SCENERY_OBSTACLES_DAI_TRUYEN_TONG.length; j++) {
      var obs = SCENERY_OBSTACLES_DAI_TRUYEN_TONG[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_DAI_TRUYEN_TONG.length; k++) {
          var exr = EXITS_DAI_TRUYEN_TONG[k].rect;
          if (x >= exr.x && x <= exr.x + exr.w && y >= exr.y && y <= exr.y + exr.h) {
            inExitZone = true;
            break;
          }
        }
        if (!inExitZone && x >= obs.rect.x && x <= obs.rect.x + obs.rect.w &&
            y >= obs.rect.y && y <= obs.rect.y + obs.rect.h) {
          return false;
        }
      }
    }

    return true;
  }

  var collisionGridDaiTruyenTong = buildGrid(960, 672, isWalkableDaiTruyenTong);
  forceWalkable(collisionGridDaiTruyenTong, SPAWN_DAI_TRUYEN_TONG.x, SPAWN_DAI_TRUYEN_TONG.y);
  forceWalkable(collisionGridDaiTruyenTong, EXITS_DAI_TRUYEN_TONG[0].target.x, EXITS_DAI_TRUYEN_TONG[0].target.y);
  forceWalkable(collisionGridDaiTruyenTong, INTERACTABLES_DAI_TRUYEN_TONG[0].x, INTERACTABLES_DAI_TRUYEN_TONG[0].y);

  var MAP_DAI_TRUYEN_TONG = {
    id: 'dai-truyen-tong',
    name: 'Đài Truyền Tống',
    width: 960,
    height: 672,
    gridSize: GRID_SIZE,
    cols: Math.ceil(960 / GRID_SIZE),
    rows: Math.ceil(672 / GRID_SIZE),
    bgImage: 'assets/art/map-dai-truyen-tong-bg.png',
    spawn: SPAWN_DAI_TRUYEN_TONG,
    standees: [],
    npcs: [],
    interactables: INTERACTABLES_DAI_TRUYEN_TONG,
    harvestNodes: [],
    monsterPacks: [],
    zones: ZONES_DAI_TRUYEN_TONG,
    obstacles: SCENERY_OBSTACLES_DAI_TRUYEN_TONG,
    exits: EXITS_DAI_TRUYEN_TONG,
    collisionGrid: collisionGridDaiTruyenTong,
    isWalkable: isWalkableDaiTruyenTong
  };

  // ============================================================
  // HỆ THỐNG QUẢN LÝ BẢN ĐỒ TOÀN CỤC
  // ============================================================

  var ALL_MAPS = {
    'mieu_hoang': MAP_MIEU_HOANG,
    'rung-doc': MAP_RUNG_DOC,
    'tong-mon': MAP_TONG_MON,
    'dai-dien': MAP_DAI_DIEN,
    'son-coc': MAP_SON_COC,
    'dai-truyen-tong': MAP_DAI_TRUYEN_TONG
  };

  var MapData = Object.assign({}, MAP_MIEU_HOANG, {
    maps: ALL_MAPS,
    buildGrid: buildGrid,
    forceWalkable: forceWalkable,
    getMap: function (id) {
      if (!id) return MAP_MIEU_HOANG;
      var clean = id.replace('_', '-');
      if (ALL_MAPS[id]) return ALL_MAPS[id];
      if (ALL_MAPS[clean]) return ALL_MAPS[clean];
      if (id === 'rung_doc' || id === 'rung-doc') return MAP_RUNG_DOC;
      if (id === 'tong_mon' || id === 'tong-mon') return MAP_TONG_MON;
      if (id === 'dai_dien' || id === 'dai-dien') return MAP_DAI_DIEN;
      if (id === 'son_coc' || id === 'son-coc') return MAP_SON_COC;
      if (id === 'dai_truyen_tong' || id === 'dai-truyen-tong') return MAP_DAI_TRUYEN_TONG;
      return MAP_MIEU_HOANG;
    }
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapData;
  }
  if (typeof global !== 'undefined') {
    global.GameMapData = MapData;
    global.MapData = MapData;
  }
})(typeof window !== 'undefined' ? window : this);
