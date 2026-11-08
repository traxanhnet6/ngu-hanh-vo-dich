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

  function pointInEllipse(x, y, e) {
    var dx = (x - e.cx) / e.rx;
    var dy = (y - e.cy) / e.ry;
    return dx * dx + dy * dy <= 1;
  }

  // ============================================================
  // MAP 1: MIẾU HOANG (1920 x 1280)
  // ============================================================

  var TEMPLE = {
    id: 'temple_main',
    asset: 'assets/art/standee-temple.png',
    originalW: 760,
    originalH: 613,
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
    { id: 'pine_1', asset: 'assets/art/standee-pine.png', originalW: 299, originalH: 543, w: 140, h: 243, x: 140, y: 140, baseY: 383, ellipse: { cx: 196.8, cy: 362.5, rx: 32.8, ry: 9.8 } },
    { id: 'pine_2', asset: 'assets/art/standee-pine.png', originalW: 299, originalH: 543, w: 150, h: 260, x: 1160, y: 30, baseY: 290, ellipse: { cx: 1220.9, cy: 268.0, rx: 35.1, ry: 10.5 } },
    { id: 'pine_3', asset: 'assets/art/standee-pine.png', originalW: 299, originalH: 543, w: 140, h: 243, x: 180, y: 720, baseY: 963, ellipse: { cx: 236.8, cy: 942.5, rx: 32.8, ry: 9.8 } }
  ];

  var STANDEES_MIEU_EXTRA = [
    { id: 'bamboo_m1', asset: 'assets/art/standee-bamboo-cluster.png', originalW: 258, originalH: 480, w: 170, h: 315, x: 1640, y: 240, baseY: 555, ellipse: { cx: 1725.3, cy: 529.7, rx: 25.7, ry: 7.6 } },
    { id: 'bamboo_m2', asset: 'assets/art/standee-bamboo-cluster.png', originalW: 258, originalH: 480, w: 180, h: 335, x: 1660, y: 600, baseY: 935, ellipse: { cx: 1750.4, cy: 908.1, rx: 27.2, ry: 8.0 } },
    { id: 'rock_m1', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 150, h: 113, x: 949, y: 287, baseY: 400, ellipse: { cx: 1016.8, cy: 376.4, rx: 61.5, ry: 18.5 } },
    { id: 'rock_m2', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 130, h: 98, x: 947, y: 522, baseY: 620, ellipse: { cx: 1005.8, cy: 599.6, rx: 53.3, ry: 16.1 } },
    { id: 'bush_m1', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 120, h: 121, x: 718, y: 83, baseY: 204, ellipse: { cx: 779.6, cy: 184.6, rx: 45.4, ry: 13.6 } },
    { id: 'bush_m2', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 130, h: 132, x: 933, y: 383, baseY: 515, ellipse: { cx: 999.7, cy: 493.9, rx: 49.2, ry: 14.8 } },
    { id: 'bush_m3', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 140, h: 142, x: 1072, y: 442, baseY: 584, ellipse: { cx: 1143.8, cy: 561.3, rx: 53.0, ry: 15.9 } },
    { id: 'ruined_m1', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 240, h: 191, x: 70, y: 619, baseY: 810, ellipse: { cx: 182.3, cy: 748.4, rx: 107.4, ry: 32.3 } },
    { id: 'ruined_m2', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 200, h: 159, x: 300, y: 624, baseY: 783, ellipse: { cx: 393.6, cy: 731.7, rx: 89.5, ry: 26.9 } }
  ];

  var SCENERY_OBSTACLES_MIEU = [
    { rect: { x: 0, y: 0, w: 1920, h: 50 } },
    { rect: { x: 0, y: 0, w: 50, h: 1280 } },
    { rect: { x: 1900, y: 0, w: 20, h: 425 } },
    { rect: { x: 1900, y: 525, w: 20, h: 755 } },
    { rect: { x: 0, y: 1260, w: 775, h: 20 } },
    { rect: { x: 885, y: 1260, w: 1035, h: 20 } }
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

    var solidsMieu = [TEMPLE].concat(TREES_MIEU, STANDEES_MIEU_EXTRA);
    for (var si2 = 0; si2 < solidsMieu.length; si2++) {
      var so = solidsMieu[si2];
      if (so.baseRect) {
        if (x >= so.baseRect.x && x <= so.baseRect.x + so.baseRect.w && y >= so.baseRect.y && y <= so.baseRect.y + so.baseRect.h) return false;
      } else if (so.ellipse) {
        if (pointInEllipse(x, y, so.ellipse)) return false;
      } else if (so.trunk) {
        var sdx = x - so.trunk.x, sdy = y - so.trunk.y;
        if (sdx * sdx + sdy * sdy <= so.trunk.r * so.trunk.r) return false;
      }
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
      Object.assign({}, TEMPLE, { id: 'temple_main' })
    ].concat(TREES_MIEU, STANDEES_MIEU_EXTRA),
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
    { id: 'giant_tree_1', asset: 'assets/art/standee-giant-tree.png', originalW: 666, originalH: 815, w: 520, h: 636, x: 1210, y: 4, baseY: 640, ellipse: { cx: 1463.2, cy: 551.1, rx: 203.1, ry: 60.8 } },
    { id: 'broadleaf_1', asset: 'assets/art/standee-broadleaf.png', originalW: 453, originalH: 564, w: 260, h: 310, x: 620, y: 120, baseY: 430, ellipse: { cx: 748.2, cy: 385.0, rx: 102.7, ry: 30.7 } },
    { id: 'broadleaf_2', asset: 'assets/art/standee-broadleaf.png', originalW: 453, originalH: 564, w: 250, h: 300, x: 1240, y: 580, baseY: 880, ellipse: { cx: 1363.2, cy: 836.7, rx: 98.8, ry: 29.5 } },
    { id: 'broadleaf_3', asset: 'assets/art/standee-broadleaf.png', originalW: 453, originalH: 564, w: 240, h: 290, x: 340, y: 780, baseY: 1070, ellipse: { cx: 458.3, cy: 1028.3, rx: 94.8, ry: 28.3 } },
    { id: 'twisted_tree_1', asset: 'assets/art/standee-twisted-tree.png', originalW: 387, originalH: 585, w: 270, h: 408, x: 610, y: 520, baseY: 928, ellipse: { cx: 740.7, cy: 873.6, rx: 120.7, ry: 36.3 } },
    { id: 'fallen_log_1', asset: 'assets/art/standee-fallen-log.png', originalW: 400, originalH: 256, w: 200, h: 122, x: 920, y: 640, baseY: 762, trunk: { x: 948, y: 668, r: 14 } },
    { id: 'rock_rd1', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 140, h: 105, x: 435, y: 455, baseY: 560, ellipse: { cx: 498.3, cy: 538.0, rx: 57.4, ry: 17.3 } },
    { id: 'rock_rd2', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 150, h: 113, x: 1493, y: 1072, baseY: 1185, ellipse: { cx: 1560.8, cy: 1161.4, rx: 61.5, ry: 18.5 } },
    { id: 'bush_rd1', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 140, h: 142, x: 548, y: 693, baseY: 835, ellipse: { cx: 619.8, cy: 812.3, rx: 53.0, ry: 15.9 } },
    { id: 'bush_rd2', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 130, h: 132, x: 1817, y: 658, baseY: 790, ellipse: { cx: 1883.7, cy: 768.9, rx: 49.2, ry: 14.8 } },
    { id: 'bush_rd3', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 120, h: 121, x: 285, y: 234, baseY: 355, ellipse: { cx: 346.6, cy: 335.6, rx: 45.4, ry: 13.6 } }
  ];

  var SCENERY_OBSTACLES_RUNG_DOC = [
    { rect: { x: 0, y: 0, w: 1920, h: 45 } },
    { rect: { x: 0, y: 1255, w: 1920, h: 25 } },
    { rect: { x: 0, y: 0, w: 25, h: 475 } },
    { rect: { x: 0, y: 645, w: 25, h: 635 } },
    { rect: { x: 1900, y: 0, w: 20, h: 1280 } }
  ];

  // Đợt 3 (Note 2): SUỐI LÀ CHƯỚNG NGẠI THẬT — lòng suối vẽ trong nền chặn đường,
  // chỉ qua được tại cầu gỗ (khúc gỗ bắc ngang ~ (1060,705)) và bãi cạn phía nam.
  var STREAM_SEGMENTS_RUNG_DOC = [
    [1005, 440], [960, 540], [885, 620], [940, 705], [1005, 800],
    [1065, 900], [1185, 1000], [1250, 1100], [1295, 1200], [1380, 1280]
  ];
  var STREAM_HALF_WIDTH = 38;
  var STREAM_CROSSINGS_RUNG_DOC = [
    { x: 940, y: 705, r: 95 },
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
    { x: 1460, y: 905 },
    { x: 1440, y: 720 },
    { x: 1640, y: 745 }
  ];

  var RUNG_DOC_PACKS = [
    { id: 'pack_thaotinh_1', speciesId: 'thao_tinh', anchor: { x: 420, y: 750 }, count: 4, spread: 60 },
    { id: 'pack_thaotinh_2', speciesId: 'thao_tinh', anchor: { x: 550, y: 360 }, count: 4, spread: 60 },
    { id: 'pack_thaotinh_3', speciesId: 'thao_tinh', anchor: { x: 920, y: 920 }, count: 5, spread: 60 },
    { id: 'pack_nhenxanh_1', speciesId: 'nhen_xanh', anchor: { x: 1080, y: 460 }, count: 3, spread: 50 },
    { id: 'pack_nhenxanh_2', speciesId: 'nhen_xanh', anchor: { x: 1460, y: 905 }, count: 3, spread: 50 },
    { id: 'pack_elite_cothuye', speciesId: 'co_thu_yeu', anchor: { x: 1440, y: 720 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_boss_moc_linh', speciesId: 'boss_moc_linh_co_vuong', anchor: { x: 1640, y: 745 }, count: 1, spread: 0, isBoss: true }
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
      var obj = STAND_OBJECTS_RUNG_DOC[i];
      if (obj.ellipse) {
        if (pointInEllipse(x, y, obj.ellipse)) return false;
      } else if (obj.trunk) {
        var dx = x - obj.trunk.x;
        var dy = y - obj.trunk.y;
        if (dx * dx + dy * dy <= obj.trunk.r * obj.trunk.r) return false;
      }
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
      asset: 'assets/art/standee-dai-dien.png',
      originalW: 603,
      originalH: 509,
      w: 660,
      h: 380,
      x: 630,
      y: 40,
      baseY: 420,
      baseRect: { x: 675, y: 320, w: 590, h: 95 }
    },
    {
      id: 'standee_thap',
      asset: 'assets/art/standee-thap.png',
      originalW: 280,
      originalH: 687,
      w: 280,
      h: 430,
      x: 1600,
      y: 430,
      baseY: 860,
      baseRect: { x: 1635, y: 795, w: 210, h: 55 }
    },
    {
      id: 'standee_portal',
      asset: 'assets/art/standee-portal.png',
      originalW: 133,
      originalH: 257,
      w: 170,
      h: 180,
      x: 1560,
      y: 70,
      baseY: 250,
      trunk: { x: 1645, y: 215, r: 25 }
    },
    {
      id: 'bamboo_1',
      asset: 'assets/art/standee-bamboo-cluster.png',
      originalW: 258,
      originalH: 480,
      w: 120,
      h: 160,
      x: 90,
      y: 60,
      baseY: 220,
      ellipse: { cx: 150.2, cy: 205.7, rx: 18.1, ry: 5.3 }
    },
    {
      id: 'bamboo_2',
      asset: 'assets/art/standee-bamboo-cluster.png',
      originalW: 258,
      originalH: 480,
      w: 130,
      h: 173,
      x: 300,
      y: 40,
      baseY: 213,
      ellipse: { cx: 365.3, cy: 197.5, rx: 19.6, ry: 5.8 }
    },
    {
      id: 'bamboo_3',
      asset: 'assets/art/standee-bamboo-cluster.png',
      originalW: 258,
      originalH: 480,
      w: 110,
      h: 147,
      x: 430,
      y: 90,
      baseY: 237,
      ellipse: { cx: 485.2, cy: 223.8, rx: 16.6, ry: 4.9 }
    },
    {
      id: 'bamboo_4',
      asset: 'assets/art/standee-bamboo-cluster.png',
      originalW: 258,
      originalH: 480,
      w: 125,
      h: 167,
      x: 170,
      y: 150,
      baseY: 317,
      ellipse: { cx: 232.8, cy: 302.0, rx: 18.9, ry: 5.6 }
    },
    { id: 'bamboo_tm60', asset: 'assets/art/standee-bamboo-cluster.png', originalW: 258, originalH: 480, w: 150, h: 200, x: 60, y: 700, baseY: 900, ellipse: { cx: 135.3, cy: 882.1, rx: 22.6, ry: 6.7 } },
    { id: 'bamboo_tm240', asset: 'assets/art/standee-bamboo-cluster.png', originalW: 258, originalH: 480, w: 130, h: 173, x: 240, y: 620, baseY: 793, ellipse: { cx: 305.3, cy: 777.5, rx: 19.6, ry: 5.8 } },
    { id: 'bush_tm1', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 130, h: 132, x: 700, y: 1080, baseY: 1212, ellipse: { cx: 766.7, cy: 1190.9, rx: 49.2, ry: 14.8 } },
    { id: 'rock_tm1', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 130, h: 98, x: 1230, y: 130, baseY: 228, ellipse: { cx: 1288.8, cy: 207.6, rx: 53.3, ry: 16.1 } }
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
      } else if (st.ellipse) {
        if (pointInEllipse(x, y, st.ellipse)) return false;
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
  // HÀM TRỢ GIÚP DÙNG CHUNG CHO CÁC MAP VÙNG SĂN
  // ============================================================

  function makeZoneIsWalkable(exits, standees, obstacles) {
    return function (x, y) {
      if (x < 10 || x > 1920 - 10 || y < 10 || y > 1280 - 10) {
        var inExit = false;
        for (var e = 0; e < exits.length; e++) {
          var er = exits[e].rect;
          if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) { inExit = true; break; }
        }
        if (!inExit) return false;
      }
      for (var i = 0; i < standees.length; i++) {
        var obj = standees[i];
        if (obj.ellipse) {
          if (pointInEllipse(x, y, obj.ellipse)) return false;
        } else if (obj.trunk) {
          var dx = x - obj.trunk.x, dy = y - obj.trunk.y;
          if (dx * dx + dy * dy <= obj.trunk.r * obj.trunk.r) return false;
        }
      }
      for (var j = 0; j < obstacles.length; j++) {
        var obs = obstacles[j];
        if (obs.rect) {
          var inExitZone = false;
          for (var k = 0; k < exits.length; k++) {
            var exr = exits[k].rect;
            if (x >= exr.x && x <= exr.x + exr.w && y >= exr.y && y <= exr.y + exr.h) { inExitZone = true; break; }
          }
          if (!inExitZone && x >= obs.rect.x && x <= obs.rect.x + obs.rect.w &&
              y >= obs.rect.y && y <= obs.rect.y + obs.rect.h) return false;
        } else if (obs.r) {
          var ox = x - obs.x, oy = y - obs.y;
          if (ox * ox + oy * oy <= obs.r * obs.r) return false;
        }
      }
      return true;
    };
  }

  // ============================================================
  // MAP 7: HỒ BĂNG HÀN KÍNH (1920 x 1280)
  // ============================================================

  var SPAWN_HO_BANG = {
    x: 90,
    y: 640
  };

  var EXITS_HO_BANG = [
    {
      id: 'exit_to_teleport',
      name: 'Đài Truyền Tống',
      rect: { x: 0, y: 560, w: 45, h: 160 },
      chipLabel: null,
      target: { x: 60, y: 640 },
      targetMap: 'dai-truyen-tong',
      targetSpawn: { x: 480, y: 560 }
    }
  ];

  var ZONES_HO_BANG = [
    {
      id: 'ho_bang',
      name: 'Hồ Băng Hàn Kính',
      desc: 'Hồ băng trong như gương trên cao nguyên tuyết, gió cắt quanh năm và mặt băng nứt dưới chân.',
      rect: { x: 0, y: 0, w: 1920, h: 1280 }
    }
  ];

  var STAND_OBJECTS_HO_BANG = [
    { id: 'ip1', asset: 'assets/art/standee-ice-pine.png', originalW: 392, originalH: 585, w: 150, h: 224, x: 134, y: 96, baseY: 320, ellipse: { cx: 210.0, cy: 299.7, rx: 34.6, ry: 10.4 } },
    { id: 'ip2', asset: 'assets/art/standee-ice-pine.png', originalW: 392, originalH: 585, w: 165, h: 246, x: 216, y: 874, baseY: 1120, ellipse: { cx: 300.0, cy: 1097.8, rx: 38.1, ry: 11.4 } },
    { id: 'ip3', asset: 'assets/art/standee-ice-pine.png', originalW: 392, originalH: 585, w: 120, h: 179, x: 59, y: 701, baseY: 880, ellipse: { cx: 120.0, cy: 863.8, rx: 27.7, ry: 8.3 } },
    { id: 'ip4', asset: 'assets/art/standee-ice-pine.png', originalW: 392, originalH: 585, w: 140, h: 209, x: 1429, y: -29, baseY: 180, ellipse: { cx: 1500.0, cy: 161.1, rx: 32.3, ry: 9.7 } },
    { id: 'ip5', asset: 'assets/art/standee-ice-pine.png', originalW: 392, originalH: 585, w: 120, h: 179, x: 1719, y: 121, baseY: 300, ellipse: { cx: 1780.0, cy: 283.8, rx: 27.7, ry: 8.3 } },
    { id: 'ir1', asset: 'assets/art/standee-ice-rock.png', originalW: 306, originalH: 355, w: 170, h: 197, x: 351, y: 323, baseY: 520, ellipse: { cx: 430.0, cy: 490.0, rx: 71.1, ry: 21.3 } },
    { id: 'ir2', asset: 'assets/art/standee-ice-rock.png', originalW: 306, originalH: 355, w: 190, h: 220, x: 1662, y: 860, baseY: 1080, ellipse: { cx: 1750.0, cy: 1046.4, rx: 79.5, ry: 23.9 } },
    { id: 'ir3', asset: 'assets/art/standee-ice-rock.png', originalW: 306, originalH: 355, w: 150, h: 174, x: 830, y: 956, baseY: 1130, ellipse: { cx: 900.0, cy: 1103.5, rx: 62.8, ry: 18.8 } },
    { id: 'ir4', asset: 'assets/art/standee-ice-rock.png', originalW: 306, originalH: 355, w: 140, h: 162, x: 555, y: 18, baseY: 180, ellipse: { cx: 620.0, cy: 155.3, rx: 58.6, ry: 17.6 } }
  ];

  var SCENERY_OBSTACLES_HO_BANG = [
    { rect: { x: 0, y: 0, w: 1920, h: 45 } },
    { rect: { x: 0, y: 1255, w: 1920, h: 25 } },
    { rect: { x: 0, y: 0, w: 25, h: 555 } },
    { rect: { x: 0, y: 725, w: 25, h: 555 } },
    { rect: { x: 1900, y: 0, w: 20, h: 1280 } }
  ];

  var HO_BANG_KEY_ANCHORS = [
    { x: 420, y: 750 },
    { x: 550, y: 360 },
    { x: 920, y: 920 },
    { x: 1460, y: 905 },
    { x: 1080, y: 460 },
    { x: 1620, y: 980 },
    { x: 1180, y: 680 }
  ];

  var HO_BANG_PACKS = [
    { id: 'pack_bangtinh_1', speciesId: 'bang_tinh', anchor: { x: 420, y: 750 }, count: 4, spread: 60 },
    { id: 'pack_bangtinh_2', speciesId: 'bang_tinh', anchor: { x: 550, y: 360 }, count: 4, spread: 60 },
    { id: 'pack_bangtinh_3', speciesId: 'bang_tinh', anchor: { x: 920, y: 920 }, count: 5, spread: 60 },
    { id: 'pack_bangtinh_4', speciesId: 'bang_tinh', anchor: { x: 1460, y: 905 }, count: 4, spread: 60 },
    { id: 'pack_elite_hanxa_1', speciesId: 'han_xa', anchor: { x: 1080, y: 460 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_elite_hanxa_2', speciesId: 'han_xa', anchor: { x: 1620, y: 980 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_boss_han_kinh', speciesId: 'boss_han_kinh_giao_vuong', anchor: { x: 1180, y: 680 }, count: 1, spread: 0, isBoss: true }
  ];

  var isWalkableHoBang = makeZoneIsWalkable(EXITS_HO_BANG, STAND_OBJECTS_HO_BANG, SCENERY_OBSTACLES_HO_BANG);

  var collisionGridHoBang = buildGrid(1920, 1280, isWalkableHoBang);
  forceWalkable(collisionGridHoBang, SPAWN_HO_BANG.x, SPAWN_HO_BANG.y);
  forceWalkable(collisionGridHoBang, EXITS_HO_BANG[0].target.x, EXITS_HO_BANG[0].target.y);
  for (var a = 0; a < HO_BANG_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridHoBang, HO_BANG_KEY_ANCHORS[a].x, HO_BANG_KEY_ANCHORS[a].y);
  }

  var MAP_HO_BANG = {
    id: 'ho-bang',
    name: 'Hồ Băng Hàn Kính',
    width: 1920,
    height: 1280,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1920 / GRID_SIZE),
    rows: Math.ceil(1280 / GRID_SIZE),
    bgImage: 'assets/art/map-ho-bang-bg.png',
    spawn: SPAWN_HO_BANG,
    standees: STAND_OBJECTS_HO_BANG,
    obstacles: SCENERY_OBSTACLES_HO_BANG,
    exits: EXITS_HO_BANG,
    collisionGrid: collisionGridHoBang,
    isWalkable: isWalkableHoBang,
    keyAnchors: HO_BANG_KEY_ANCHORS,
    npcs: [],
    interactables: [],
    harvestNodes: [],
    monsterPacks: HO_BANG_PACKS,
    packs: HO_BANG_PACKS,
    zones: ZONES_HO_BANG,
    minRealmRank: 4,
    minRealmLabel: 'Luyện Khí tầng 4'
  };

  // ============================================================
  // MAP 8: MỎ LỬA XÍCH DIỆM (1920 x 1280)
  // ============================================================

  var SPAWN_MO_LUA = {
    x: 90,
    y: 640
  };

  var EXITS_MO_LUA = [
    {
      id: 'exit_to_teleport',
      name: 'Đài Truyền Tống',
      rect: { x: 0, y: 560, w: 45, h: 160 },
      chipLabel: null,
      target: { x: 60, y: 640 },
      targetMap: 'dai-truyen-tong',
      targetSpawn: { x: 480, y: 560 }
    }
  ];

  var ZONES_MO_LUA = [
    {
      id: 'mo_lua',
      name: 'Mỏ Lửa Xích Diệm',
      desc: 'Mỏ quặng bỏ hoang trong lòng núi lửa, dung nham chảy ở rãnh thấp, tro nóng bay theo gió.',
      rect: { x: 0, y: 0, w: 1920, h: 1280 }
    }
  ];

  var STAND_OBJECTS_MO_LUA = [
    { id: 'os1', asset: 'assets/art/standee-obsidian-spire.png', originalW: 245, originalH: 647, w: 110, h: 290, x: 193, y: 10, baseY: 300, ellipse: { cx: 250.0, cy: 272.6, rx: 48.5, ry: 14.6 } },
    { id: 'os2', asset: 'assets/art/standee-obsidian-spire.png', originalW: 245, originalH: 647, w: 130, h: 343, x: 633, y: -163, baseY: 180, ellipse: { cx: 700.0, cy: 147.7, rx: 57.3, ry: 17.2 } },
    { id: 'os3', asset: 'assets/art/standee-obsidian-spire.png', originalW: 245, originalH: 647, w: 120, h: 317, x: 1688, y: -67, baseY: 250, ellipse: { cx: 1750.0, cy: 220.2, rx: 52.9, ry: 15.9 } },
    { id: 'os4', asset: 'assets/art/standee-obsidian-spire.png', originalW: 245, originalH: 647, w: 115, h: 304, x: 990, y: 776, baseY: 1080, ellipse: { cx: 1050.0, cy: 1051.4, rx: 50.7, ry: 15.2 } },
    { id: 'lr1', asset: 'assets/art/standee-lava-rock.png', originalW: 426, originalH: 313, w: 170, h: 125, x: 401, y: 895, baseY: 1020, ellipse: { cx: 480.0, cy: 1004.2, rx: 34.3, ry: 10.3 } },
    { id: 'lr2', asset: 'assets/art/standee-lava-rock.png', originalW: 426, originalH: 313, w: 150, h: 110, x: 831, y: 190, baseY: 300, ellipse: { cx: 900.0, cy: 286.1, rx: 30.3, ry: 9.1 } },
    { id: 'lr3', asset: 'assets/art/standee-lava-rock.png', originalW: 426, originalH: 313, w: 140, h: 103, x: 185, y: 847, baseY: 950, ellipse: { cx: 250.0, cy: 937.0, rx: 28.3, ry: 8.5 } },
    { id: 'lr4', asset: 'assets/art/standee-lava-rock.png', originalW: 426, originalH: 313, w: 160, h: 118, x: 1576, y: 902, baseY: 1020, ellipse: { cx: 1650.0, cy: 1005.1, rx: 32.3, ry: 9.7 } },
    { id: 'lr5', asset: 'assets/art/standee-lava-rock.png', originalW: 426, originalH: 313, w: 130, h: 96, x: 560, y: 464, baseY: 560, ellipse: { cx: 620.0, cy: 547.9, rx: 26.3, ry: 7.9 } }
  ];

  var SCENERY_OBSTACLES_MO_LUA = [
    { rect: { x: 0, y: 0, w: 1920, h: 45 } },
    { rect: { x: 0, y: 1130, w: 1920, h: 150 } },
    { rect: { x: 0, y: 0, w: 25, h: 555 } },
    { rect: { x: 0, y: 725, w: 25, h: 405 } },
    { rect: { x: 1820, y: 0, w: 100, h: 1280 } }
  ];

  var MO_LUA_KEY_ANCHORS = [
    { x: 1150, y: 880 },
    { x: 880, y: 700 },
    { x: 1250, y: 1080 },
    { x: 700, y: 1010 },
    { x: 1000, y: 560 },
    { x: 1620, y: 760 },
    { x: 1400, y: 700 }
  ];

  var MO_LUA_PACKS = [
    { id: 'pack_hoathu_1', speciesId: 'hoa_thu', anchor: { x: 1150, y: 880 }, count: 4, spread: 60 },
    { id: 'pack_hoathu_2', speciesId: 'hoa_thu', anchor: { x: 880, y: 700 }, count: 4, spread: 60 },
    { id: 'pack_hoathu_3', speciesId: 'hoa_thu', anchor: { x: 1250, y: 1080 }, count: 5, spread: 60 },
    { id: 'pack_hoathu_4', speciesId: 'hoa_thu', anchor: { x: 700, y: 1010 }, count: 4, spread: 60 },
    { id: 'pack_elite_diemma_1', speciesId: 'diem_ma', anchor: { x: 1000, y: 560 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_elite_diemma_2', speciesId: 'diem_ma', anchor: { x: 1620, y: 760 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_boss_xich_diem', speciesId: 'boss_xich_diem_viem_quan', anchor: { x: 1400, y: 700 }, count: 1, spread: 0, isBoss: true }
  ];

  var isWalkableMoLua = makeZoneIsWalkable(EXITS_MO_LUA, STAND_OBJECTS_MO_LUA, SCENERY_OBSTACLES_MO_LUA);

  var collisionGridMoLua = buildGrid(1920, 1280, isWalkableMoLua);
  forceWalkable(collisionGridMoLua, SPAWN_MO_LUA.x, SPAWN_MO_LUA.y);
  forceWalkable(collisionGridMoLua, EXITS_MO_LUA[0].target.x, EXITS_MO_LUA[0].target.y);
  for (var a = 0; a < MO_LUA_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridMoLua, MO_LUA_KEY_ANCHORS[a].x, MO_LUA_KEY_ANCHORS[a].y);
  }

  var MAP_MO_LUA = {
    id: 'mo-lua',
    name: 'Mỏ Lửa Xích Diệm',
    width: 1920,
    height: 1280,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1920 / GRID_SIZE),
    rows: Math.ceil(1280 / GRID_SIZE),
    bgImage: 'assets/art/map-mo-lua-bg.png',
    spawn: SPAWN_MO_LUA,
    standees: STAND_OBJECTS_MO_LUA,
    obstacles: SCENERY_OBSTACLES_MO_LUA,
    exits: EXITS_MO_LUA,
    collisionGrid: collisionGridMoLua,
    isWalkable: isWalkableMoLua,
    keyAnchors: MO_LUA_KEY_ANCHORS,
    npcs: [],
    interactables: [],
    harvestNodes: [],
    monsterPacks: MO_LUA_PACKS,
    packs: MO_LUA_PACKS,
    zones: ZONES_MO_LUA,
    minRealmRank: 7,
    minRealmLabel: 'Luyện Khí tầng 7'
  };

  // ============================================================
  // MAP 9: HOANG MẠC HOÀNG SA (1920 x 1280)
  // ============================================================

  var SPAWN_HOANG_MAC = {
    x: 90,
    y: 640
  };

  var EXITS_HOANG_MAC = [
    {
      id: 'exit_to_teleport',
      name: 'Đài Truyền Tống',
      rect: { x: 0, y: 560, w: 45, h: 160 },
      chipLabel: null,
      target: { x: 60, y: 640 },
      targetMap: 'dai-truyen-tong',
      targetSpawn: { x: 480, y: 560 }
    }
  ];

  var ZONES_HOANG_MAC = [
    {
      id: 'hoang_mac',
      name: 'Hoang Mạc Hoàng Sa',
      desc: 'Hoang mạc cát vàng với tàn tích thành cổ nửa chìm trong cát, xương thú khổng lồ làm mốc giữa biển cát.',
      rect: { x: 0, y: 0, w: 1920, h: 1280 }
    }
  ];

  var STAND_OBJECTS_HOANG_MAC = [
    { id: 'rp1', asset: 'assets/art/standee-ruin-pillar.png', originalW: 220, originalH: 585, w: 120, h: 319, x: 192, y: 101, baseY: 420, ellipse: { cx: 250.0, cy: 388.6, rx: 57.8, ry: 17.4 } },
    { id: 'rp2', asset: 'assets/art/standee-ruin-pillar.png', originalW: 220, originalH: 585, w: 140, h: 372, x: 733, y: -172, baseY: 200, ellipse: { cx: 800.0, cy: 163.4, rx: 67.5, ry: 20.2 } },
    { id: 'rp3', asset: 'assets/art/standee-ruin-pillar.png', originalW: 220, originalH: 585, w: 125, h: 332, x: 1690, y: 368, baseY: 700, ellipse: { cx: 1750.0, cy: 667.3, rx: 60.2, ry: 18.1 } },
    { id: 'rp4', asset: 'assets/art/standee-ruin-pillar.png', originalW: 220, originalH: 585, w: 135, h: 359, x: 885, y: 761, baseY: 1120, ellipse: { cx: 950.0, cy: 1084.7, rx: 65.1, ry: 19.5 } },
    { id: 'db1', asset: 'assets/art/standee-desert-bone.png', originalW: 536, originalH: 449, w: 340, h: 285, x: 302, y: -125, baseY: 160, ellipse: { cx: 480.0, cy: 114.9, rx: 108.8, ry: 32.6 } },
    { id: 'db2', asset: 'assets/art/standee-desert-bone.png', originalW: 536, originalH: 449, w: 300, h: 251, x: 1522, y: 829, baseY: 1080, ellipse: { cx: 1680.0, cy: 1040.2, rx: 96.0, ry: 28.8 } },
    { id: 'rb1', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 200, h: 153, x: 526, y: 927, baseY: 1080, ellipse: { cx: 620.0, cy: 1046.4, rx: 89.5, ry: 26.9 } },
    { id: 'rb2', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 180, h: 138, x: 1116, y: 42, baseY: 180, ellipse: { cx: 1200.0, cy: 149.7, rx: 80.5, ry: 24.2 } },
    { id: 'rc1', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 140, h: 105, x: 1437, y: 1075, baseY: 1180, ellipse: { cx: 1500.0, cy: 1158.2, rx: 57.4, ry: 17.2 } }
  ];

  var SCENERY_OBSTACLES_HOANG_MAC = [
    { rect: { x: 0, y: 0, w: 1920, h: 45 } },
    { rect: { x: 0, y: 1255, w: 1920, h: 25 } },
    { rect: { x: 0, y: 0, w: 25, h: 555 } },
    { rect: { x: 0, y: 725, w: 25, h: 555 } },
    { rect: { x: 1900, y: 0, w: 20, h: 1280 } }
  ];

  var HOANG_MAC_KEY_ANCHORS = [
    { x: 420, y: 750 },
    { x: 550, y: 360 },
    { x: 920, y: 920 },
    { x: 700, y: 1100 },
    { x: 1150, y: 300 },
    { x: 1250, y: 950 },
    { x: 1470, y: 420 }
  ];

  var HOANG_MAC_PACKS = [
    { id: 'pack_satrung_1', speciesId: 'sa_trung', anchor: { x: 420, y: 750 }, count: 4, spread: 60 },
    { id: 'pack_satrung_2', speciesId: 'sa_trung', anchor: { x: 550, y: 360 }, count: 4, spread: 60 },
    { id: 'pack_satrung_3', speciesId: 'sa_trung', anchor: { x: 920, y: 920 }, count: 5, spread: 60 },
    { id: 'pack_satrung_4', speciesId: 'sa_trung', anchor: { x: 700, y: 1100 }, count: 4, spread: 60 },
    { id: 'pack_elite_satuong_1', speciesId: 'sa_tuong', anchor: { x: 1150, y: 300 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_elite_satuong_2', speciesId: 'sa_tuong', anchor: { x: 1250, y: 950 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_boss_hoang_sa', speciesId: 'boss_hoang_sa_co_vuong', anchor: { x: 1470, y: 420 }, count: 1, spread: 0, isBoss: true }
  ];

  var isWalkableHoangMac = makeZoneIsWalkable(EXITS_HOANG_MAC, STAND_OBJECTS_HOANG_MAC, SCENERY_OBSTACLES_HOANG_MAC);

  var collisionGridHoangMac = buildGrid(1920, 1280, isWalkableHoangMac);
  forceWalkable(collisionGridHoangMac, SPAWN_HOANG_MAC.x, SPAWN_HOANG_MAC.y);
  forceWalkable(collisionGridHoangMac, EXITS_HOANG_MAC[0].target.x, EXITS_HOANG_MAC[0].target.y);
  for (var a = 0; a < HOANG_MAC_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridHoangMac, HOANG_MAC_KEY_ANCHORS[a].x, HOANG_MAC_KEY_ANCHORS[a].y);
  }

  var MAP_HOANG_MAC = {
    id: 'hoang-mac',
    name: 'Hoang Mạc Hoàng Sa',
    width: 1920,
    height: 1280,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1920 / GRID_SIZE),
    rows: Math.ceil(1280 / GRID_SIZE),
    bgImage: 'assets/art/map-hoang-mac-bg.png',
    spawn: SPAWN_HOANG_MAC,
    standees: STAND_OBJECTS_HOANG_MAC,
    obstacles: SCENERY_OBSTACLES_HOANG_MAC,
    exits: EXITS_HOANG_MAC,
    collisionGrid: collisionGridHoangMac,
    isWalkable: isWalkableHoangMac,
    keyAnchors: HOANG_MAC_KEY_ANCHORS,
    npcs: [],
    interactables: [],
    harvestNodes: [],
    monsterPacks: HOANG_MAC_PACKS,
    packs: HOANG_MAC_PACKS,
    zones: ZONES_HOANG_MAC,
    minRealmRank: 10,
    minRealmLabel: 'Trúc Cơ Sơ Kỳ'
  };

  // ============================================================
  // MAP 10: KIẾM TRỦNG HUYỀN THIẾT (1920 x 1280)
  // ============================================================

  var SPAWN_KIEM_TRUNG = {
    x: 90,
    y: 640
  };

  var EXITS_KIEM_TRUNG = [
    {
      id: 'exit_to_teleport',
      name: 'Đài Truyền Tống',
      rect: { x: 0, y: 560, w: 45, h: 160 },
      chipLabel: null,
      target: { x: 60, y: 640 },
      targetMap: 'dai-truyen-tong',
      targetSpawn: { x: 480, y: 560 }
    }
  ];

  var ZONES_KIEM_TRUNG = [
    {
      id: 'kiem_trung',
      name: 'Kiếm Trủng Huyền Thiết',
      desc: 'Thung lũng chôn kiếm cổ sau đại chiến thượng cổ, sương lạnh và tiếng kim loại va nhau khi gió qua.',
      rect: { x: 0, y: 0, w: 1920, h: 1280 }
    }
  ];

  var STAND_OBJECTS_KIEM_TRUNG = [
    { id: 'sm1', asset: 'assets/art/standee-sword-monolith.png', originalW: 304, originalH: 668, w: 150, h: 330, x: 645, y: -30, baseY: 300, ellipse: { cx: 720.0, cy: 263.1, rx: 74.8, ry: 22.4 } },
    { id: 'sm2', asset: 'assets/art/standee-sword-monolith.png', originalW: 304, originalH: 668, w: 160, h: 352, x: 1540, y: -22, baseY: 330, ellipse: { cx: 1620.0, cy: 290.6, rx: 79.8, ry: 23.9 } },
    { id: 'sm3', asset: 'assets/art/standee-sword-monolith.png', originalW: 304, originalH: 668, w: 150, h: 330, x: 1605, y: 650, baseY: 980, ellipse: { cx: 1680.0, cy: 943.1, rx: 74.8, ry: 22.4 } },
    { id: 'rl1', asset: 'assets/art/standee-rust-blades.png', originalW: 371, originalH: 334, w: 150, h: 135, x: 322, y: 345, baseY: 480, ellipse: { cx: 400.0, cy: 457.1, rx: 56.6, ry: 17.0 } },
    { id: 'rl2', asset: 'assets/art/standee-rust-blades.png', originalW: 371, originalH: 334, w: 160, h: 144, x: 536, y: 936, baseY: 1080, ellipse: { cx: 620.0, cy: 1055.6, rx: 60.4, ry: 18.1 } },
    { id: 'rl3', asset: 'assets/art/standee-rust-blades.png', originalW: 371, originalH: 334, w: 140, h: 126, x: 977, y: 54, baseY: 180, ellipse: { cx: 1050.0, cy: 158.6, rx: 52.9, ry: 15.9 } },
    { id: 'rl4', asset: 'assets/art/standee-rust-blades.png', originalW: 371, originalH: 334, w: 150, h: 135, x: 1372, y: 985, baseY: 1120, ellipse: { cx: 1450.0, cy: 1097.1, rx: 56.6, ry: 17.0 } },
    { id: 'rl5', asset: 'assets/art/standee-rust-blades.png', originalW: 371, originalH: 334, w: 130, h: 117, x: 232, y: 783, baseY: 900, ellipse: { cx: 300.0, cy: 880.2, rx: 49.1, ry: 14.7 } },
    { id: 'rc1', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 140, h: 105, x: 837, y: 1045, baseY: 1150, ellipse: { cx: 900.0, cy: 1128.2, rx: 57.4, ry: 17.2 } },
    { id: 'rc2', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 150, h: 113, x: 1732, y: 487, baseY: 600, ellipse: { cx: 1800.0, cy: 576.6, rx: 61.5, ry: 18.4 } }
  ];

  var SCENERY_OBSTACLES_KIEM_TRUNG = [
    { rect: { x: 0, y: 0, w: 1920, h: 45 } },
    { rect: { x: 0, y: 1255, w: 1920, h: 25 } },
    { rect: { x: 0, y: 0, w: 25, h: 555 } },
    { rect: { x: 0, y: 725, w: 25, h: 555 } },
    { rect: { x: 1900, y: 0, w: 20, h: 1280 } }
  ];

  var KIEM_TRUNG_KEY_ANCHORS = [
    { x: 420, y: 750 },
    { x: 550, y: 360 },
    { x: 920, y: 920 },
    { x: 1500, y: 905 },
    { x: 1080, y: 460 },
    { x: 920, y: 300 },
    { x: 1250, y: 640 }
  ];

  var KIEM_TRUNG_PACKS = [
    { id: 'pack_kiemlinh_1', speciesId: 'kiem_linh', anchor: { x: 420, y: 750 }, count: 4, spread: 60 },
    { id: 'pack_kiemlinh_2', speciesId: 'kiem_linh', anchor: { x: 550, y: 360 }, count: 4, spread: 60 },
    { id: 'pack_kiemlinh_3', speciesId: 'kiem_linh', anchor: { x: 920, y: 920 }, count: 5, spread: 60 },
    { id: 'pack_kiemlinh_4', speciesId: 'kiem_linh', anchor: { x: 1500, y: 905 }, count: 4, spread: 60 },
    { id: 'pack_elite_thietgiap_1', speciesId: 'thiet_giap', anchor: { x: 1080, y: 460 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_elite_thietgiap_2', speciesId: 'thiet_giap', anchor: { x: 920, y: 300 }, count: 1, spread: 0, isElite: true },
    { id: 'pack_boss_tan_kiem', speciesId: 'boss_tan_kiem_vo_danh', anchor: { x: 1250, y: 640 }, count: 1, spread: 0, isBoss: true }
  ];

  var isWalkableKiemTrung = makeZoneIsWalkable(EXITS_KIEM_TRUNG, STAND_OBJECTS_KIEM_TRUNG, SCENERY_OBSTACLES_KIEM_TRUNG);

  var collisionGridKiemTrung = buildGrid(1920, 1280, isWalkableKiemTrung);
  forceWalkable(collisionGridKiemTrung, SPAWN_KIEM_TRUNG.x, SPAWN_KIEM_TRUNG.y);
  forceWalkable(collisionGridKiemTrung, EXITS_KIEM_TRUNG[0].target.x, EXITS_KIEM_TRUNG[0].target.y);
  for (var a = 0; a < KIEM_TRUNG_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridKiemTrung, KIEM_TRUNG_KEY_ANCHORS[a].x, KIEM_TRUNG_KEY_ANCHORS[a].y);
  }

  var MAP_KIEM_TRUNG = {
    id: 'kiem-trung',
    name: 'Kiếm Trủng Huyền Thiết',
    width: 1920,
    height: 1280,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1920 / GRID_SIZE),
    rows: Math.ceil(1280 / GRID_SIZE),
    bgImage: 'assets/art/map-kiem-trung-bg.png',
    spawn: SPAWN_KIEM_TRUNG,
    standees: STAND_OBJECTS_KIEM_TRUNG,
    obstacles: SCENERY_OBSTACLES_KIEM_TRUNG,
    exits: EXITS_KIEM_TRUNG,
    collisionGrid: collisionGridKiemTrung,
    isWalkable: isWalkableKiemTrung,
    keyAnchors: KIEM_TRUNG_KEY_ANCHORS,
    npcs: [],
    interactables: [],
    harvestNodes: [],
    monsterPacks: KIEM_TRUNG_PACKS,
    packs: KIEM_TRUNG_PACKS,
    zones: ZONES_KIEM_TRUNG,
    minRealmRank: 11,
    minRealmLabel: 'Trúc Cơ Trung Kỳ'
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
    'dai-truyen-tong': MAP_DAI_TRUYEN_TONG,
    'ho-bang': MAP_HO_BANG,
    'mo-lua': MAP_MO_LUA,
    'hoang-mac': MAP_HOANG_MAC,
    'kiem-trung': MAP_KIEM_TRUNG
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
      if (id === 'ho_bang' || id === 'ho-bang') return MAP_HO_BANG;
      if (id === 'mo_lua' || id === 'mo-lua') return MAP_MO_LUA;
      if (id === 'hoang_mac' || id === 'hoang-mac') return MAP_HOANG_MAC;
      if (id === 'kiem_trung' || id === 'kiem-trung') return MAP_KIEM_TRUNG;
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
