/**
 * mapdata.js — Định nghĩa Bản đồ 1 "Miếu Hoang" & Bản đồ 2 "Rừng Độc Thanh Tụy"
 * Bao gồm: tranh nền, standees, vùng va chạm, điểm neo cửa, NPC Linh Nhi, điểm xuất hiện, lối thoát / cổng dịch chuyển.
 * Tương thích cả Browser và Node.js.
 */
(function (global) {
  'use strict';

  var WORLD_WIDTH = 1920;
  var WORLD_HEIGHT = 1280;
  var GRID_SIZE = 24;
  var COLS = Math.ceil(WORLD_WIDTH / GRID_SIZE); // 80
  var ROWS = Math.ceil(WORLD_HEIGHT / GRID_SIZE); // 54

  // ============================================================
  // MAP 1: MIẾU HOANG
  // ============================================================

  var TEMPLE = {
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
    collisionRadius: 14, // Va chạm hình tròn r=14 (Brief §8 fix 3)
    standTile: {
      x: 676,
      y: 560
    },
    dialogue: [
      'Ca ca đã về rồi! Hôm nay tuyết lạnh quá, muội lo ca ca gặp chuyện chẳng lành...',
      'Bó củi này... Mã Tam ở thành Tây Lương lại ép giá nữa phải không? Ba đồng thì chỉ vừa mua hai cái bánh bao...',
      'Ngày mai người của Mã Tam lại đến đòi nợ tiền thuốc. Chúng ta... phải làm sao đây ca ca?',
      'Ca ca nghỉ ngơi một lát đi. Lát nữa muội đi nhóm bếp nấu chút cháo ấm.'
    ]
  };

  var SPAWN_MIEU = {
    x: 560,
    y: 620
  };

  // Cổng thoát Bản đồ 1: Lối thoát Đông thông sang Rừng Độc (Brief §2)
  var EXITS_MIEU = [
    {
      id: 'exit_right',
      name: 'Rừng Độc Thanh Tụy',
      rect: { x: 1880, y: 430, w: 40, h: 90 },
      chipLabel: null, // Đã mở ở Đợt 2!
      target: { x: 1890, y: 475 },
      targetMap: 'rung-doc',
      targetSpawn: { x: 90, y: 560 }
    },
    {
      id: 'exit_bottom',
      name: 'Đường xuống núi',
      rect: { x: 780, y: 1240, w: 100, h: 40 },
      chipLabel: 'Đường xuống núi — mở ở đợt sau',
      target: { x: 830, y: 1250 }
    }
  ];

  function isWalkableMieu(x, y) {
    if (x < 10 || x > WORLD_WIDTH - 10 || y < 10 || y > WORLD_HEIGHT - 10) {
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

    // Va chạm chân đế miếu
    var tRect = TEMPLE.baseRect;
    if (x >= tRect.x && x <= tRect.x + tRect.w && y >= tRect.y && y <= tRect.y + tRect.h) {
      return false;
    }

    // Va chạm thân cây thông
    for (var i = 0; i < TREES_MIEU.length; i++) {
      var tr = TREES_MIEU[i].trunk;
      var dx = x - tr.x;
      var dy = y - tr.y;
      if (dx * dx + dy * dy <= tr.r * tr.r) {
        return false;
      }
    }

    // Va chạm Linh Nhi (r=14 quanh feetX=700, feetY=560)
    var dxLn = x - LINH_NHI.feetX;
    var dyLn = y - LINH_NHI.feetY;
    if (dxLn * dxLn + dyLn * dyLn <= LINH_NHI.collisionRadius * LINH_NHI.collisionRadius) {
      return false;
    }

    // Va chạm viền cảnh vật
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
        if (ox * ox + oy * oy <= obs.r * obs.r) {
          return false;
        }
      }
    }

    return true;
  }

  // Khởi tạo lưới va chạm Bản đồ 1
  var collisionGridMieu = [];
  for (var r1 = 0; r1 < ROWS; r1++) {
    var row1 = [];
    for (var c1 = 0; c1 < COLS; c1++) {
      var wx1 = c1 * GRID_SIZE + GRID_SIZE / 2;
      var wy1 = r1 * GRID_SIZE + GRID_SIZE / 2;
      row1.push(isWalkableMieu(wx1, wy1) ? 0 : 1);
    }
    collisionGridMieu.push(row1);
  }

  function forceWalkable(grid, wx, wy) {
    var c = Math.floor(wx / GRID_SIZE);
    var r = Math.floor(wy / GRID_SIZE);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      grid[r][c] = 0;
    }
  }

  forceWalkable(collisionGridMieu, SPAWN_MIEU.x, SPAWN_MIEU.y);
  forceWalkable(collisionGridMieu, TEMPLE.doorAnchor.x, TEMPLE.doorAnchor.y);
  forceWalkable(collisionGridMieu, LINH_NHI.standTile.x, LINH_NHI.standTile.y);
  forceWalkable(collisionGridMieu, EXITS_MIEU[0].target.x, EXITS_MIEU[0].target.y);
  forceWalkable(collisionGridMieu, EXITS_MIEU[1].target.x, EXITS_MIEU[1].target.y);

  var MAP_MIEU_HOANG = {
    id: 'mieu_hoang',
    name: 'Miếu Hoang',
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    gridSize: GRID_SIZE,
    cols: COLS,
    rows: ROWS,
    bgImage: 'assets/art/map-mieu-hoang-bg.png',
    spawn: SPAWN_MIEU,
    temple: TEMPLE,
    linhnhi: LINH_NHI,
    trees: TREES_MIEU,
    obstacles: SCENERY_OBSTACLES_MIEU,
    exits: EXITS_MIEU,
    collisionGrid: collisionGridMieu,
    isWalkable: isWalkableMieu
  };

  // ============================================================
  // MAP 2: RỪNG ĐỘC THANH TỤY (VÀNH NGOÀI)
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

  // Standees trên bản đồ Rừng Độc (Brief §2: 2-3 cây lá rộng + 1 thân gỗ mục/gốc cây)
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
      trunk: { x: 1020, y: 730, r: 20 }
    }
  ];

  var SCENERY_OBSTACLES_RUNG_DOC = [
    // Biên trên & biên dưới
    { rect: { x: 0, y: 0, w: 1920, h: 45 } },
    { rect: { x: 0, y: 1255, w: 1920, h: 25 } },
    // Biên trái (chừa portal y 480-640)
    { rect: { x: 0, y: 0, w: 25, h: 475 } },
    { rect: { x: 0, y: 645, w: 25, h: 635 } },
    // Biên phải
    { rect: { x: 1900, y: 0, w: 20, h: 1280 } },
    // Một vài mỏm đá/vũng trũng nhỏ
    { x: 300, y: 200, r: 22 },
    { x: 780, y: 1100, r: 22 },
    { x: 1680, y: 220, r: 24 }
  ];

  function isWalkableRungDoc(x, y) {
    if (x < 10 || x > WORLD_WIDTH - 10 || y < 10 || y > WORLD_HEIGHT - 10) {
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

    // Va chạm thân cây / gốc gỗ mục
    for (var i = 0; i < STAND_OBJECTS_RUNG_DOC.length; i++) {
      var tr = STAND_OBJECTS_RUNG_DOC[i].trunk;
      var dx = x - tr.x;
      var dy = y - tr.y;
      if (dx * dx + dy * dy <= tr.r * tr.r) {
        return false;
      }
    }

    // Va chạm biên và chướng ngại
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
        if (ox * ox + oy * oy <= obs.r * obs.r) {
          return false;
        }
      }
    }

    return true;
  }

  // Khởi tạo ma trận lưới va chạm Rừng Độc
  var collisionGridRungDoc = [];
  for (var r2 = 0; r2 < ROWS; r2++) {
    var row2 = [];
    for (var c2 = 0; c2 < COLS; c2++) {
      var wx2 = c2 * GRID_SIZE + GRID_SIZE / 2;
      var wy2 = r2 * GRID_SIZE + GRID_SIZE / 2;
      row2.push(isWalkableRungDoc(wx2, wy2) ? 0 : 1);
    }
    collisionGridRungDoc.push(row2);
  }

  // Đảm bảo spawn và các điểm mấu chốt luôn walkable
  forceWalkable(collisionGridRungDoc, SPAWN_RUNG_DOC.x, SPAWN_RUNG_DOC.y);
  forceWalkable(collisionGridRungDoc, EXITS_RUNG_DOC[0].target.x, EXITS_RUNG_DOC[0].target.y);
  // Các điểm neo bầy quái và tinh anh (Check 12)
  var RUNG_DOC_KEY_ANCHORS = [
    { x: 420, y: 750 },
    { x: 550, y: 360 },
    { x: 920, y: 920 },
    { x: 1080, y: 460 },
    { x: 1380, y: 820 },
    { x: 1540, y: 420 } // Elite anchor
  ];
  for (var a = 0; a < RUNG_DOC_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridRungDoc, RUNG_DOC_KEY_ANCHORS[a].x, RUNG_DOC_KEY_ANCHORS[a].y);
  }

  var MAP_RUNG_DOC = {
    id: 'rung-doc',
    name: 'Rừng Độc Thanh Tụy',
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    gridSize: GRID_SIZE,
    cols: COLS,
    rows: ROWS,
    bgImage: 'assets/art/map-rung-doc-bg.png',
    spawn: SPAWN_RUNG_DOC,
    standees: STAND_OBJECTS_RUNG_DOC,
    obstacles: SCENERY_OBSTACLES_RUNG_DOC,
    exits: EXITS_RUNG_DOC,
    collisionGrid: collisionGridRungDoc,
    isWalkable: isWalkableRungDoc,
    keyAnchors: RUNG_DOC_KEY_ANCHORS
  };

  // Đối tượng xuất ra duy trì tương thích 100% với Đợt 1
  var MapData = Object.assign({}, MAP_MIEU_HOANG, {
    maps: {
      'mieu_hoang': MAP_MIEU_HOANG,
      'rung-doc': MAP_RUNG_DOC
    },
    getMap: function (id) {
      if (id === 'rung-doc' || id === 'rung_doc') {
        return MAP_RUNG_DOC;
      }
      return MAP_MIEU_HOANG;
    }
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapData;
  }
  if (typeof global !== 'undefined') {
    global.GameMapData = MapData;
    global.MapData = MapData; // Bí danh tương thích Đợt 1 (main/engine/ui đọc window.MapData)
  }
})(typeof window !== 'undefined' ? window : this);
