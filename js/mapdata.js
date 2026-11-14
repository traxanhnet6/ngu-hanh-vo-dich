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
    { id: 'ruined_m1', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 240, h: 191, x: 70, y: 619, baseY: 810, ellipse: { cx: 182.3, cy: 776.5, rx: 107.4, ry: 32.3 } },
    { id: 'ruined_m2', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 200, h: 159, x: 300, y: 624, baseY: 783, ellipse: { cx: 393.6, cy: 755.1, rx: 89.5, ry: 26.9 } }
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
    originalW: 221,
    originalH: 560,
    h: 118,
    w: 47,
    x: 676.5,
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

  // Đợt ELDER: NPC Trưởng Lão Dược Điền tại Ruộng Linh Mễ Tông Môn (Bui 01:32 & Chốt 01:52)
  var TRUONG_LAO_DUOC_DIEN = {
    id: 'npc_truonglao_duocdien',
    name: 'Trưởng Lão Dược Điền',
    asset: 'assets/art/npc-truonglao.png',
    originalW: 235,
    originalH: 560,
    w: 50,
    h: 120,
    x: 200,
    y: 300,
    feetX: 225,
    feetY: 420,
    baseY: 420,
    collisionRadius: 14,
    standTile: {
      x: 225,
      y: 450
    },
    mapId: 'ruong-linh-me',
    questGate: null,
    dialogueDefault: [
      'Ruộng Linh Mễ này là căn cơ nông nghiệp của Thanh Vân Tông ta. Người tu đạo cũng không thể thiếu linh lương dưỡng mạch.'
    ],
    dialogueQuest: [
      'Ngươi chính là tân đệ tử nhập môn do Chấp Sự tiến cử? Tốt lắm, hãy xem ta thị phạm 4 pháp quyết canh tác linh điền tông môn!'
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
    },
    // Đợt N1: điểm hành nghề — tọa độ theo N1-DESIGN.md §3.3, đã kiểm lưới
    // va chạm bằng Node (ô đi lại được, không chồng vùng bấm NPC/cổng).
    {
      id: 'gather_wood_mieu_1',
      label: 'Đốn Củi',
      x: 480,
      y: 720,
      radius: 48,
      action: 'n1_gather',
      nodeId: 'gather_wood_mieu_1'
    },
    {
      id: 'gather_mine_mieu_1',
      label: 'Đào Khoáng',
      x: 1050,
      y: 350,
      radius: 48,
      action: 'n1_gather',
      nodeId: 'gather_mine_mieu_1'
    },
    {
      id: 'gather_fish_mieu_1',
      label: 'Câu Cá',
      x: 250,
      y: 860,
      radius: 48,
      action: 'n1_gather',
      nodeId: 'gather_fish_mieu_1'
    },
    {
      id: 'interact_board_town',
      label: 'Bảng Treo Thưởng',
      x: 580,
      y: 490,
      radius: 48,
      action: 'board_town'
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

  // PROVISIONAL: điểm hái dại Miếu Hoang — số/vị trí TẠM, chờ Bui phán.
  // Cùng luật như tông: itemId la-thanh-tuy, respawnSec 90, count 1.
  // HERB-CODE: lấy ĐÚNG 5 vị trí trong game-ngu-hanh-linhduoc/qa/mieu-positions-proposal.md
  // (CHƯA NGHIỆM THU). respawnSec 120 = nhịp Lá Thanh Tụy dại ở Rừng Độc (TẠM).
  var HARVEST_NODES_MIEU_HOANG = [
    { id: 'harvest_mh_1', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 350, y: 950, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_mh_2', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 1050, y: 950, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_mh_3', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 1450, y: 750, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_mh_4', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 1350, y: 250, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_mh_5', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 1560, y: 350, radius: 48, respawnSec: 120, count: 1 }
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
  for (var hmh = 0; hmh < HARVEST_NODES_MIEU_HOANG.length; hmh++) {
    forceWalkable(collisionGridMieu, HARVEST_NODES_MIEU_HOANG[hmh].x, HARVEST_NODES_MIEU_HOANG[hmh].y);
  }
  // PLOTFIELD: ép 12 tâm ô Linh Điền thành đi được (tọa độ trùng
  // FIELD_PLOTS_CONFIG trong js/linhdien.js — nguồn thật duy nhất; sao chép
  // tại đây vì lưới va chạm dựng trong mapdata, trước khi linhdien nạp).
  for (var pfr = 0; pfr < 3; pfr++) {
    for (var pfc = 0; pfc < 4; pfc++) {
      forceWalkable(collisionGridMieu, 1260 + pfc * 90, 940 + pfr * 80);
    }
  }

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
    harvestNodes: HARVEST_NODES_MIEU_HOANG,
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
      // target là điểm DẪN ĐƯỜNG trên chính map này (phải nằm trong rect cổng —
      // cổng chỉ kích hoạt khi nhân vật đứng trong rect). Bản cũ ghi nhầm tọa độ
      // điểm rơi ở map đích (1850,475) khiến dẫn đường về tông môn dắt người chơi
      // sang bờ đông Rừng Độc rồi kẹt — đã sửa về tâm vùng cổng (đợt GUIDEFIX).
      target: { x: 22, y: 560 },
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

  // Đợt V1 chặng 1: TRŨNG SƯƠNG ĐỘC Rừng Độc (hồ sơ 01 §1) — một hazard với ba
  // vị trí trũng luân phiên theo zoneClock (chu kỳ POISON_FOG_CYCLE_SEC).
  // Vị trí đã kiểm bằng tay: ngoài bán kính an toàn 150px quanh spawn/cổng
  // vào, đi được (không nằm trong lòng suối hay cây/đá chặn), tâm trũng cách
  // điểm sinh quái gần nhất ≥ 200px. Hoa Giải Độc mọc ở MÉP từng trũng.
  var POISON_FOG_POOLS = [
    { kind: 'circle', cx: 700, cy: 950, r: 120 },
    { kind: 'circle', cx: 1250, cy: 300, r: 120 },
    { kind: 'circle', cx: 1600, cy: 1100, r: 120 }
  ];
  // PROVISIONAL: chu kỳ đổi vị trí trũng — hồ sơ 01 ghi [ĐỀ XUẤT] 3 phút,
  // chờ Bui phán.
  var POISON_FOG_CYCLE_SEC = 180;
  var ZONE_HAZARDS_RUNG_DOC = [
    {
      id: 'doc_suong_trung',
      kind: 'poison_fog',
      name: 'Trũng Sương Độc',
      shape: POISON_FOG_POOLS[0],
      positions: POISON_FOG_POOLS,
      cycleSec: POISON_FOG_CYCLE_SEC
    }
  ];
  // Đợt V1 chặng 6: Điểm hái đầy đủ Rừng Độc theo hồ sơ 01 §1
  // Lá Thanh Tụy (hồi 120s) · Linh Chi Rừng (900s) · Hoa Giải Độc (300s) · Nhựa Cây Ngàn Năm (1800s)
  var HARVEST_NODES_RUNG_DOC = [
    { id: 'harvest_rd_flower_1', itemId: 'hoa-giai-doc', name: 'Hoa Giải Độc', x: 700, y: 1110, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_rd_flower_2', itemId: 'hoa-giai-doc', name: 'Hoa Giải Độc', x: 1410, y: 300, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_rd_flower_3', itemId: 'hoa-giai-doc', name: 'Hoa Giải Độc', x: 1760, y: 1100, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_rd_la_1', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 380, y: 500, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_rd_la_2', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 950, y: 420, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_rd_la_3', itemId: 'la-thanh-tuy', name: 'Lá Thanh Tụy', x: 1250, y: 850, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_rd_linhchi_1', itemId: 'linh-chi-rung', name: 'Linh Chi Rừng', x: 820, y: 260, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_rd_linhchi_2', itemId: 'linh-chi-rung', name: 'Linh Chi Rừng', x: 1550, y: 750, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_rd_nhua_1', itemId: 'nhua-cay-ngan-nam', name: 'Nhựa Cây Ngàn Năm', x: 1680, y: 450, radius: 48, respawnSec: 1800, count: 1 }
  ];

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
    // Đợt N1: điểm hành nghề (thiết kế §3.3, đã kiểm lưới va chạm).
    interactables: [
      {
        id: 'gather_wood_rd_1',
        label: 'Đốn Củi',
        x: 820,
        y: 550,
        radius: 48,
        action: 'n1_gather',
        nodeId: 'gather_wood_rd_1'
      },
      {
        // Đợt N1FIX (§8.3): Trầm Hương Cổ Thụ — điểm cấp 3 rơi Gỗ Trầm Hương.
        id: 'gather_wood_rd_2',
        label: 'Đốn Củi',
        x: 1100,
        y: 600,
        radius: 48,
        action: 'n1_gather',
        nodeId: 'gather_wood_rd_2'
      },
      {
        id: 'gather_fish_rd_1',
        label: 'Câu Cá',
        x: 1360,
        y: 960,
        radius: 48,
        action: 'n1_gather',
        nodeId: 'gather_fish_rd_1'
      }
    ],
    harvestNodes: HARVEST_NODES_RUNG_DOC,
    zoneHazards: ZONE_HAZARDS_RUNG_DOC, // Đợt V1 chặng 1: trũng sương độc (3 vị trí luân phiên) + Hoa Giải Độc ở mép trũng
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
    },
    {
      id: 'exit_to_ruong_linhme',
      name: 'Ruộng Linh Mễ',
      rect: { x: 440, y: 590, w: 60, h: 70 },
      chipLabel: 'Ruộng Linh Mễ',
      target: { x: 470, y: 625 },
      targetMap: 'ruong-linh-me',
      targetSpawn: { x: 120, y: 420 }
    },
    {
      // Đợt DANMAP: Cổng vào Phòng Luyện Đan (gian phòng riêng ở Tông Môn)
      id: 'exit_to_phong_luyen_dan',
      name: 'Đan Phòng',
      rect: { x: 820, y: 535, w: 60, h: 50 },
      chipLabel: 'Đan Phòng',
      target: { x: 850, y: 560 },
      targetMap: 'phong-luyen-dan',
      targetSpawn: { x: 800, y: 700 }
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
      h: 223,
      x: 90,
      y: -3,
      baseY: 220,
      ellipse: { cx: 150.2, cy: 205.7, rx: 18.1, ry: 5.3 }
    },
    {
      id: 'bamboo_2',
      asset: 'assets/art/standee-bamboo-cluster.png',
      originalW: 258,
      originalH: 480,
      w: 130,
      h: 242,
      x: 300,
      y: -29,
      baseY: 213,
      ellipse: { cx: 365.3, cy: 197.5, rx: 19.6, ry: 5.8 }
    },
    {
      id: 'bamboo_3',
      asset: 'assets/art/standee-bamboo-cluster.png',
      originalW: 258,
      originalH: 480,
      w: 110,
      h: 205,
      x: 430,
      y: 32,
      baseY: 237,
      ellipse: { cx: 485.2, cy: 223.8, rx: 16.6, ry: 4.9 }
    },
    {
      id: 'bamboo_4',
      asset: 'assets/art/standee-bamboo-cluster.png',
      originalW: 258,
      originalH: 480,
      w: 125,
      h: 233,
      x: 170,
      y: 84,
      baseY: 317,
      ellipse: { cx: 232.8, cy: 302.0, rx: 18.9, ry: 5.6 }
    },
    { id: 'bamboo_tm60', asset: 'assets/art/standee-bamboo-cluster.png', originalW: 258, originalH: 480, w: 150, h: 279, x: 60, y: 621, baseY: 900, ellipse: { cx: 135.3, cy: 882.1, rx: 22.6, ry: 6.7 } },
    { id: 'bamboo_tm240', asset: 'assets/art/standee-bamboo-cluster.png', originalW: 258, originalH: 480, w: 130, h: 242, x: 240, y: 551, baseY: 793, ellipse: { cx: 305.3, cy: 777.5, rx: 19.6, ry: 5.8 } },
    { id: 'bush_tm1', asset: 'assets/art/standee-bush.png', originalW: 309, originalH: 313, w: 130, h: 132, x: 700, y: 1080, baseY: 1212, ellipse: { cx: 766.7, cy: 1190.9, rx: 49.2, ry: 14.8 } },
    { id: 'rock_tm1', asset: 'assets/art/standee-rock-cluster.png', originalW: 417, originalH: 313, w: 130, h: 98, x: 1230, y: 130, baseY: 228, ellipse: { cx: 1288.8, cy: 207.6, rx: 53.3, ry: 16.1 } }
  ];

  var NPCS_TONG_MON = [
    { id: 'npc_tuan_thu_su', name: 'Tuần Thú Sư', asset: 'assets/art/npc-tiepdan.png', originalW: 239, originalH: 560, w: 51, h: 120, x: 790, y: 945, feetX: 816, feetY: 1065, baseY: 1065, collisionRadius: 14, standTile: { x: 816, y: 1085 }, questGate: null, dialogueDefault: ['Tuần Thú Sư: xem thú, chuồng và đổi Đan Thú.'], dialogueQuest: ['Linh Thú Hoàn đầu tiên tặng một lần.'] },
    {
      id: 'npc_tiepdan',
      name: 'Tiếp Dẫn Đệ Tử',
      asset: 'assets/art/npc-tiepdan.png',
      originalW: 239,
      originalH: 560,
      w: 51,
      h: 120,
      x: 859.5,
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
      originalW: 247,
      originalH: 560,
      w: 53,
      h: 120,
      x: 1018.5,
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
      originalW: 235,
      originalH: 560,
      w: 50,
      h: 120,
      x: 1155,
      y: 350,
      feetX: 1180,
      feetY: 470,
      baseY: 470,
      collisionRadius: 14,
      standTile: { x: 1180, y: 498 },
      questGate: null,
      dialogueDefault: [
        'Đứng trên đỉnh Tiên Môn ngắm biển mây, lòng người tự khắc tĩnh lặng. Nghe nói phía bắc Rừng Trúc có một vị ẩn sĩ lánh đời...'
      ]
    },
    {
      id: 'npc_duocsu',
      name: 'Dược Sư',
      asset: 'assets/art/npc-duocsu.png',
      originalW: 260,
      originalH: 560,
      w: 56,
      h: 120,
      x: 717,
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
      originalW: 259,
      originalH: 560,
      w: 56,
      h: 120,
      x: 212,
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
      originalW: 221,
      originalH: 560,
      w: 47,
      h: 118,
      x: 456.5,
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
      id: 'interact_door_ruong_linhme',
      label: 'Ruộng Linh Mễ',
      x: 470,
      y: 625,
      radius: 48,
      action: 'door_enter',
      targetMap: 'ruong-linh-me',
      targetSpawn: { x: 120, y: 420 }
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
      // Đợt DANMAP: Cửa vào Phòng Luyện Đan đặt ở khu dược, cạnh Vườn Linh Dược
      // và Dược Sư (745,610) — điểm đứng (850,560) đã kiểm đi lại được.
      id: 'interact_dan_phong',
      label: 'Vào Đan Phòng',
      x: 850,
      y: 560,
      radius: 48,
      action: 'door_enter',
      targetMap: 'phong-luyen-dan',
      targetSpawn: { x: 800, y: 700 }
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
    },
    // Đợt N1: điểm hành nghề + lò rèn + bảng đơn hàng. Lò rèn KHÔNG đặt ở
    // (1040,680) như thiết kế §4.1 vì điểm đó nằm trong vùng bấm của NPC
    // Chấp Sự (x 1008..1081, y 615..755) — bấm vào sẽ mở thoại thay vì mở
    // lò; dời sang (1120,620), đã kiểm lưới va chạm + vùng bấm. Bảng đơn
    // KHÔNG đặt ở (920,700) như thiết kế §7.1 vì chồng vùng bấm Bảng Thông
    // Cáo (880,700); dời sang (960,790), vẫn cạnh bảng cũ.
    {
      id: 'gather_wood_tm_1',
      label: 'Đốn Củi',
      x: 350,
      y: 850,
      radius: 48,
      action: 'n1_gather',
      nodeId: 'gather_wood_tm_1'
    },
    {
      id: 'gather_fish_tm_1',
      label: 'Câu Cá',
      x: 650,
      y: 1120,
      radius: 48,
      action: 'n1_gather',
      nodeId: 'gather_fish_tm_1'
    },
    {
      id: 'interact_lo_ren',
      label: 'Lò Rèn',
      x: 1120,
      y: 620,
      radius: 50,
      action: 'lo_ren'
    },
    {
      id: 'interact_bang_don_hang',
      label: 'Bảng Đơn Hàng',
      x: 960,
      y: 790,
      radius: 44,
      action: 'bang_don_hang'
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
    // Đợt CLIFFCOLLISION (Bui 06:56 ngày 2026-11-14): va chạm mặt vách/vực vẽ trên tranh nền
    // phía đông map — trước đây chỉ biên đông x>=1895 bị chặn, nhân vật đi được lên tranh mặt vách.
    // Các hình đo từ PNG nền ở tỉ lệ 1:1, bám mép vách nhìn thấy; chừa bãi cỏ/mỏm đá + hành lang
    // đường đá tới tháp (tuyến towerpath, sân trước cửa tới x=1784) + mọi điểm neo gameplay.
    { rect: { x: 1704, y: 0, w: 216, h: 48 } }, // cliff_ne_1: Góc đông-bắc: mép nền Bí Cảnh chạy chéo, bậc 1
    { rect: { x: 1728, y: 48, w: 192, h: 24 } }, // cliff_ne_2: Mép nền Bí Cảnh, bậc 2
    { rect: { x: 1752, y: 72, w: 168, h: 24 } }, // cliff_ne_3: Mép nền Bí Cảnh, bậc 3
    { rect: { x: 1776, y: 96, w: 144, h: 24 } }, // cliff_ne_4: Mép nền Bí Cảnh, bậc 4
    { rect: { x: 1800, y: 120, w: 120, h: 72 } }, // cliff_ne_5: Góc đông nền Bí Cảnh + mép đông-nam nền
    { rect: { x: 1776, y: 192, w: 144, h: 48 } }, // cliff_ne_6: Dốc đá dưới mép đông-nam nền Bí Cảnh
    { rect: { x: 1824, y: 240, w: 96, h: 192 } }, // cliff_e_1: Dốc đông + gờ đá + sương, y 240-432
    { rect: { x: 1848, y: 432, w: 72, h: 192 } }, // cliff_e_2: Mép cỏ/cụm đá ven vực, y 432-624
    { rect: { x: 1752, y: 624, w: 168, h: 96 } }, // cliff_arena: Gờ đá phía đông đấu trường, y 624-720
    { rect: { x: 1728, y: 720, w: 192, h: 96 } }, // cliff_tower_w: Mặt vách phía tây tháp, y 720-816
    { rect: { x: 1800, y: 816, w: 120, h: 96 } }, // cliff_tower_e: Vực phía đông sân trước cửa tháp, y 816-912 (giữ mở sân tới x=1784)
    { rect: { x: 1728, y: 912, w: 192, h: 343 } }, // cliff_south: Vách nam + khối đá đông-nam, y 912-1255
    // Mái nhà vẽ nhô ở mép nam và mép tây nam của Khu Dân Cư (sân đá trước nhà vẫn đi được)
    { rect: { x: 60, y: 1185, w: 760, h: 70 } },
    { rect: { x: 0, y: 950, w: 60, h: 330 } }
  ];

  // Đợt 6 (Việc 3): va chạm luống Vườn Linh Dược — luống tương tác (co 14px mỗi phía so với hình vẽ 124x88)
  // cộng các khối luống vẽ sẵn trên tranh nền (đo từ PNG nền, nới ra viền đá ~10px, chừa lối đi giữa vườn)
  var GARDEN_BED_OBSTACLES_TONG_MON = [
    { rect: { x: 512, y: 360, w: 96, h: 60 } },
    { rect: { x: 637, y: 420, w: 96, h: 60 } },
    { rect: { x: 567, y: 810, w: 96, h: 60 } },
    { rect: { x: 722, y: 810, w: 96, h: 60 } },
    { rect: { x: 482, y: 353, w: 140, h: 50 } },
    { rect: { x: 529, y: 442, w: 94, h: 144 } },
    { rect: { x: 573, y: 672, w: 125, h: 80 } },
    { rect: { x: 536, y: 776, w: 148, h: 48 } },
    { rect: { x: 693, y: 877, w: 64, h: 159 } },
    { rect: { x: 756, y: 881, w: 88, h: 168 } },
    { rect: { x: 537, y: 881, w: 152, h: 53 } },
    { rect: { x: 560, y: 919, w: 127, h: 52 } }
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

    // Va chạm luống Vườn Linh Dược (Đợt 6 - Việc 3)
    for (var g = 0; g < GARDEN_BED_OBSTACLES_TONG_MON.length; g++) {
      var gr = GARDEN_BED_OBSTACLES_TONG_MON[g].rect;
      if (x >= gr.x && x <= gr.x + gr.w && y >= gr.y && y <= gr.y + gr.h) {
        return false;
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
      originalW: 260,
      originalH: 560,
      w: 56,
      h: 120,
      x: 572,
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
    // Đợt 6 (Việc 4c): bàn lớn trước bệ và lư hương bên phải vẽ trên tranh nền — phải chặn đường
    { rect: { x: 470, y: 245, w: 260, h: 60 } },
    { x: 1085, y: 430, r: 22 },
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
  // MAP: PHÒNG LUYỆN ĐAN — NỘI THẤT (1200 x 800) (Đợt DANMAP)
  // Theo lệnh Bui 03:29 & 03:31 ngày 2026-11-13 (DANMAP)
  // và chỉ thị 04:25 ngày 2026-11-13 (DANMAP-WIDE):
  // Map luyện đan là GIAN PHÒNG nội thất rộng hơn (1600x800 PROVISIONAL),
  // ghép hình Đan Lô đã duyệt (532x706, hiển thị 213x282, pivot chân).
  // ============================================================

  var SPAWN_PHONG_LUYEN_DAN = {
    x: 800,
    y: 700
  };

  var ZONES_PHONG_LUYEN_DAN = [
    {
      id: 'phong_luyen_dan',
      name: 'Phòng Luyện Đan',
      desc: 'Nơi đệ tử tông môn khai lò luyện đan, hấp thu địa mạch linh hỏa.',
      rect: { x: 0, y: 0, w: 1600, h: 800 }
    }
  ];

  var EXITS_PHONG_LUYEN_DAN = [
    {
      id: 'exit_to_tong_mon',
      name: 'Sơn Môn',
      rect: { x: 765, y: 755, w: 70, h: 45 },
      chipLabel: null,
      target: { x: 800, y: 770 },
      targetMap: 'tong-mon',
      targetSpawn: { x: 850, y: 590 }
    }
  ];

  var NPCS_PHONG_LUYEN_DAN = [
    {
      id: 'npc_dandong',
      name: 'Tiểu Đan Đồng',
      asset: 'assets/art/npc-duocsu.png',
      originalW: 240,
      originalH: 560,
      w: 50,
      h: 110,
      x: 420,
      y: 220,
      feetX: 445,
      feetY: 330,
      baseY: 330,
      collisionRadius: 14,
      standTile: { x: 445, y: 350 },
      questGate: null,
      dialogueDefault: [
        'Đan đạo huyền diệu, hỏa hầu là cốt tủy! Sư huynh/sư tỉ hãy tới Đan Lô ở giữa phòng để khai lò luyện đan.',
        'Luyện đan phải chú ý tương sinh ngũ hành: Mộc sinh Hỏa, Hỏa sinh Thổ, Thổ sinh Kim, Kim sinh Thủy, Thủy sinh Mộc.',
        'Nếu ăn nhiều Tu Luyện Đan sẽ tích tụ Đan Độc trong kinh mạch. Ngươi có thể sang Bồ Đoàn góc Tây để tịnh tọa tiêu độc, hoặc uống Thanh Độc Đan!'
      ]
    }
  ];

  var STAND_OBJECTS_PHONG_LUYEN_DAN = [
    {
      id: 'standee_dan_lo',
      asset: 'assets/art/danlo-cold.png',
      burningAsset: 'assets/art/danlo-burning.png',
      originalW: 532,
      originalH: 706,
      w: 213,
      h: 282,
      x: 694,
      y: 155,
      baseY: 430,
      feetX: 800,
      feetY: 430,
      baseRect: { x: 740, y: 405, w: 120, h: 40 },
      groundEllipse: { cx: 800, cy: 423.8, rx: 97.6, ry: 6 }
    }
  ];

  var INTERACTABLES_PHONG_LUYEN_DAN = [
    {
      id: 'interact_dan_lo',
      label: 'Đan Lô Tông Môn',
      x: 800,
      y: 430,
      standPoint: { x: 800, y: 455 },
      radius: 65,
      action: 'dan_lo',
      furnaceId: 'dan-phong',
      desc: 'Đan Lô môn phái — linh hỏa ổn định, tăng tỉ lệ thành công khi luyện đan.'
    },
    {
      id: 'interact_danphong_board',
      label: 'Bảng Nhiệm Vụ',
      x: 1320,
      y: 300,
      radius: 50,
      action: 'danphong_board',
      desc: 'Bảng nhiệm vụ thu thập thảo dược và nguyên liệu đan phòng.'
    },
    {
      id: 'interact_bodoan_danphong',
      label: 'Bồ Đoàn Tiêu Độc',
      x: 260,
      y: 300,
      radius: 50,
      action: 'detox_mat',
      desc: 'Tịnh tọa tịnh tâm, giải trừ đan độc tích tụ.'
    },
    {
      id: 'interact_door_exit',
      label: 'Ra Sơn Môn',
      x: 800,
      y: 770,
      radius: 48,
      action: 'door_exit',
      targetMap: 'tong-mon',
      targetSpawn: { x: 850, y: 590 }
    }
  ];

  var SCENERY_OBSTACLES_PHONG_LUYEN_DAN = [
    // Biên tường phòng (chừa khe cửa Nam x: 765..835)
    { rect: { x: 0, y: 0, w: 1600, h: 100 } },
    { rect: { x: 0, y: 0, w: 60, h: 800 } },
    { rect: { x: 1540, y: 0, w: 60, h: 800 } },
    { rect: { x: 0, y: 755, w: 765, h: 45 } },
    { rect: { x: 835, y: 755, w: 765, h: 45 } },
    // Kệ thảo dược phía Tây Bắc
    { rect: { x: 100, y: 110, w: 160, h: 60 } },
    // Giá đan phương phía Đông Bắc
    { rect: { x: 1340, y: 110, w: 160, h: 60 } },
    // Bệ đá Đan Lô ở trung tâm phòng
    { rect: { x: 740, y: 405, w: 120, h: 40 } }
  ];

  function isWalkablePhongLuyenDan(x, y) {
    if (x < 10 || x > 1600 - 10 || y < 10 || y > 800 - 10) {
      var inExit = false;
      for (var e = 0; e < EXITS_PHONG_LUYEN_DAN.length; e++) {
        var er = EXITS_PHONG_LUYEN_DAN[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    for (var j = 0; j < SCENERY_OBSTACLES_PHONG_LUYEN_DAN.length; j++) {
      var obs = SCENERY_OBSTACLES_PHONG_LUYEN_DAN[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_PHONG_LUYEN_DAN.length; k++) {
          var exr = EXITS_PHONG_LUYEN_DAN[k].rect;
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

    // NPC Tiểu Đan Đồng
    for (var n = 0; n < NPCS_PHONG_LUYEN_DAN.length; n++) {
      var npc = NPCS_PHONG_LUYEN_DAN[n];
      var ndx = x - npc.feetX;
      var ndy = y - npc.feetY;
      if (ndx * ndx + ndy * ndy <= npc.collisionRadius * npc.collisionRadius) {
        return false;
      }
    }

    return true;
  }

  var collisionGridPhongLuyenDan = buildGrid(1600, 800, isWalkablePhongLuyenDan);
  forceWalkable(collisionGridPhongLuyenDan, SPAWN_PHONG_LUYEN_DAN.x, SPAWN_PHONG_LUYEN_DAN.y);
  for (var epld = 0; epld < EXITS_PHONG_LUYEN_DAN.length; epld++) {
    forceWalkable(collisionGridPhongLuyenDan, EXITS_PHONG_LUYEN_DAN[epld].target.x, EXITS_PHONG_LUYEN_DAN[epld].target.y);
  }
  for (var npld = 0; npld < NPCS_PHONG_LUYEN_DAN.length; npld++) {
    forceWalkable(collisionGridPhongLuyenDan, NPCS_PHONG_LUYEN_DAN[npld].standTile.x, NPCS_PHONG_LUYEN_DAN[npld].standTile.y);
  }
  for (var ipld = 0; ipld < INTERACTABLES_PHONG_LUYEN_DAN.length; ipld++) {
    // Đợt COLLISION-FIX: điểm tương tác có standPoint (Đan Lô) thì mở ô của
    // điểm đứng, KHÔNG mở ô của điểm neo — điểm neo lò (800,430) nằm trong
    // rect bệ lò, mở ô đó sẽ đục lỗ cho nhân vật chui vào trong lò.
    var itpld = INTERACTABLES_PHONG_LUYEN_DAN[ipld];
    var sp = itpld.standPoint || itpld;
    forceWalkable(collisionGridPhongLuyenDan, sp.x, sp.y);
  }

  var MAP_PHONG_LUYEN_DAN = {
    id: 'phong-luyen-dan',
    name: 'Phòng Luyện Đan',
    width: 1600,
    height: 800,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1600 / GRID_SIZE),
    rows: Math.ceil(800 / GRID_SIZE),
    bgImage: 'assets/art/map-dan-phong-bg.png',
    spawn: SPAWN_PHONG_LUYEN_DAN,
    standees: STAND_OBJECTS_PHONG_LUYEN_DAN,
    npcs: NPCS_PHONG_LUYEN_DAN,
    interactables: INTERACTABLES_PHONG_LUYEN_DAN,
    harvestNodes: [],
    monsterPacks: [],
    zones: ZONES_PHONG_LUYEN_DAN,
    obstacles: SCENERY_OBSTACLES_PHONG_LUYEN_DAN,
    exits: EXITS_PHONG_LUYEN_DAN,
    collisionGrid: collisionGridPhongLuyenDan,
    isWalkable: isWalkablePhongLuyenDan
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
      originalW: 251,
      originalH: 560,
      w: 54,
      h: 120,
      x: 803,
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
    // Đợt 6 (Việc 4d): lõi đá của đài truyền tống phải chặn — người chơi đứng ở vành đài để kích hoạt (bán kính tương tác 64)
    { rect: { x: 450, y: 290, w: 60, h: 60 } },
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
  // MAP LINH MỄ: RUỘNG LINH MỄ (1200 x 800) — Đợt LINHME-MAP
  // ============================================================

  var SPAWN_RUONG_LINH_ME = {
    x: 120,
    y: 420
  };

  var ZONES_RUONG_LINH_ME = [
    {
      id: 'ruong_linhme',
      name: 'Ruộng Linh Mễ',
      desc: 'Linh điền màu mỡ của Tông Môn, nơi gieo cấy Linh Mễ và thi triển pháp quyết canh tác.',
      rect: { x: 0, y: 0, w: 1200, h: 800 }
    }
  ];

  var EXITS_RUONG_LINH_ME = [
    {
      id: 'exit_to_tong_mon',
      name: 'Sơn Môn',
      rect: { x: 20, y: 380, w: 70, h: 80 },
      chipLabel: 'Về Tông Môn',
      target: { x: 55, y: 420 },
      targetMap: 'tong-mon',
      targetSpawn: { x: 520, y: 625 }
    }
  ];

  var INTERACTABLES_RUONG_LINH_ME = [
    {
      id: 'ruong_linhme_gate',
      label: 'Ra Sơn Môn',
      x: 55,
      y: 420,
      radius: 44,
      action: 'door_enter',
      targetMap: 'tong-mon',
      targetSpawn: { x: 520, y: 625 }
    },
    {
      id: 'ruong_linhme_stele',
      label: 'Bia Nông Vụ',
      x: 180,
      y: 350,
      radius: 36,
      action: 'open_linhme_farm'
    }
  ];

  var SCENERY_OBSTACLES_RUONG_LINH_ME = [
    { rect: { x: 0, y: 0, w: 1200, h: 40 } },
    { rect: { x: 0, y: 760, w: 1200, h: 40 } },
    { rect: { x: 1160, y: 0, w: 40, h: 800 } },
    { rect: { x: 0, y: 0, w: 30, h: 370 } },
    { rect: { x: 0, y: 470, w: 30, h: 330 } }
  ];

  function isWalkableRuongLinhMe(x, y) {
    if (x < 15 || x > 1200 - 15 || y < 15 || y > 800 - 15) {
      var inExit = false;
      for (var e = 0; e < EXITS_RUONG_LINH_ME.length; e++) {
        var er = EXITS_RUONG_LINH_ME[e].rect;
        if (x >= er.x && x <= er.x + er.w && y >= er.y && y <= er.y + er.h) {
          inExit = true;
          break;
        }
      }
      if (!inExit) return false;
    }

    for (var j = 0; j < SCENERY_OBSTACLES_RUONG_LINH_ME.length; j++) {
      var obs = SCENERY_OBSTACLES_RUONG_LINH_ME[j];
      if (obs.rect) {
        var inExitZone = false;
        for (var k = 0; k < EXITS_RUONG_LINH_ME.length; k++) {
          var exr = EXITS_RUONG_LINH_ME[k].rect;
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

  var collisionGridRuongLinhMe = buildGrid(1200, 800, isWalkableRuongLinhMe);
  forceWalkable(collisionGridRuongLinhMe, SPAWN_RUONG_LINH_ME.x, SPAWN_RUONG_LINH_ME.y);
  forceWalkable(collisionGridRuongLinhMe, EXITS_RUONG_LINH_ME[0].target.x, EXITS_RUONG_LINH_ME[0].target.y);
  forceWalkable(collisionGridRuongLinhMe, INTERACTABLES_RUONG_LINH_ME[0].x, INTERACTABLES_RUONG_LINH_ME[0].y);
  forceWalkable(collisionGridRuongLinhMe, INTERACTABLES_RUONG_LINH_ME[1].x, INTERACTABLES_RUONG_LINH_ME[1].y);

  var MAP_RUONG_LINH_ME = {
    id: 'ruong-linh-me',
    name: 'Ruộng Linh Mễ',
    width: 1200,
    height: 800,
    gridSize: GRID_SIZE,
    cols: Math.ceil(1200 / GRID_SIZE),
    rows: Math.ceil(800 / GRID_SIZE),
    bgImage: null, // Procedural canvas background
    spawn: SPAWN_RUONG_LINH_ME,
    standees: [],
    npcs: [],
    interactables: INTERACTABLES_RUONG_LINH_ME,
    harvestNodes: [],
    monsterPacks: [],
    zones: ZONES_RUONG_LINH_ME,
    obstacles: SCENERY_OBSTACLES_RUONG_LINH_ME,
    exits: EXITS_RUONG_LINH_ME,
    collisionGrid: collisionGridRuongLinhMe,
    isWalkable: isWalkableRuongLinhMe
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
      // target phải nằm TRONG rect cổng (tâm vùng cổng) ở cả 4 map săn qua Đài
      // Truyền Tống — bản cũ để (60,640) nằm ngoài rect 15px khiến dẫn đường
      // dừng ngay trước cổng và kẹt (đợt GUIDEFIX)
      target: { x: 22, y: 640 },
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

  // Đợt V1 chặng 2: MẶT BĂNG TRƯỢT + Ô BĂNG NỨT Hồ Băng (hồ sơ 01 §2).
  // - Mặt băng: hình chữ nhật lớn giữa hồ (x 300–1800, y 150–1130); bờ tây
  //   (x < 300, nơi spawn/cổng vào) là bãi tuyết đi thường — người chơi
  //   bước qua mép băng mới bắt đầu trượt. Mép băng cách spawn (90,640)
  //   210px và cách tâm cổng vào (22,640) 278px — ngoài bán kính an toàn
  //   150px. Đảo băng giữa hồ (boss Hàn Kính Giao Vương, 1180,680) nằm
  //   trong mặt băng như hồ sơ mô tả.
  // - Ô băng nứt: 6 ô tròn r=70 trong mặt băng; đứng lâu trên ô thì nứt
  //   theo cấp rồi vỡ — rơi xuống nước lạnh, trừ máu, đẩy về bờ gần nhất
  //   (shore: bờ tây = điểm spawn). Vị trí đã kiểm bằng tay: ngoài 150px
  //   quanh spawn/cổng vào; tâm ô cách điểm sinh quái gần nhất ≥ 130px;
  //   không chồng vật cản (thông băng/đá băng), tâm ô đi được.
  var ICE_SHEET_HO_BANG = { kind: 'rect', x: 300, y: 150, w: 1500, h: 980 };
  var ICE_CRACK_TILES_HO_BANG = [
    { id: 'bang_nut_1', kind: 'circle', cx: 700, cy: 300, r: 70 },
    { id: 'bang_nut_2', kind: 'circle', cx: 1000, cy: 300, r: 70 },
    { id: 'bang_nut_3', kind: 'circle', cx: 1450, cy: 400, r: 70 },
    { id: 'bang_nut_4', kind: 'circle', cx: 700, cy: 1000, r: 70 },
    { id: 'bang_nut_5', kind: 'circle', cx: 1150, cy: 950, r: 70 },
    { id: 'bang_nut_6', kind: 'circle', cx: 1550, cy: 800, r: 70 }
  ];
  var HO_BANG_SHORE_POINTS = [{ x: 90, y: 640 }]; // bờ tây = điểm spawn
  var ZONE_HAZARDS_HO_BANG = [
    {
      id: 'mat_bang_truot',
      kind: 'ice_sheet',
      name: 'Mặt Băng Trượt',
      shape: ICE_SHEET_HO_BANG,
      shore: HO_BANG_SHORE_POINTS
    }
  ];
  for (var _iceT = 0; _iceT < ICE_CRACK_TILES_HO_BANG.length; _iceT++) {
    ZONE_HAZARDS_HO_BANG.push({
      id: ICE_CRACK_TILES_HO_BANG[_iceT].id,
      kind: 'ice_crack',
      name: 'Ô Băng Nứt',
      shape: ICE_CRACK_TILES_HO_BANG[_iceT]
    });
  }

  var collisionGridHoBang = buildGrid(1920, 1280, isWalkableHoBang);
  forceWalkable(collisionGridHoBang, SPAWN_HO_BANG.x, SPAWN_HO_BANG.y);
  forceWalkable(collisionGridHoBang, EXITS_HO_BANG[0].target.x, EXITS_HO_BANG[0].target.y);
  for (var a = 0; a < HO_BANG_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridHoBang, HO_BANG_KEY_ANCHORS[a].x, HO_BANG_KEY_ANCHORS[a].y);
  }

  // Đợt V1 chặng 6: Điểm hái đầy đủ Hồ Băng theo hồ sơ 01 §2
  // Băng Tinh (hồi 300s) · Ngọc Trai Hồ (600s) · Tuyết Liên (1200s) · Băng Tủy (1800s)
  var HARVEST_NODES_HO_BANG = [
    { id: 'harvest_hb_bangtinh_1', itemId: 'bang-tinh', name: 'Băng Tinh', x: 220, y: 480, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_hb_bangtinh_2', itemId: 'bang-tinh', name: 'Băng Tinh', x: 250, y: 800, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_hb_bangtinh_3', itemId: 'bang-tinh', name: 'Băng Tinh', x: 520, y: 240, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_hb_ngoctrai_1', itemId: 'ngoc-trai-ho', name: 'Ngọc Trai Hồ', x: 480, y: 520, radius: 48, respawnSec: 600, count: 1 },
    { id: 'harvest_hb_ngoctrai_2', itemId: 'ngoc-trai-ho', name: 'Ngọc Trai Hồ', x: 620, y: 860, radius: 48, respawnSec: 600, count: 1 },
    { id: 'harvest_hb_tuyetlien_1', itemId: 'tuyet-lien', name: 'Tuyết Liên', x: 1380, y: 260, radius: 48, respawnSec: 1200, count: 1 },
    { id: 'harvest_hb_tuyetlien_2', itemId: 'tuyet-lien', name: 'Tuyết Liên', x: 1680, y: 950, radius: 48, respawnSec: 1200, count: 1 },
    { id: 'harvest_hb_bangtuy_1', itemId: 'bang-tuy', name: 'Băng Tủy', x: 1150, y: 600, radius: 48, respawnSec: 1800, count: 1 }
  ];

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
    // Đợt N1: điểm hành nghề (thiết kế §3.3, đã kiểm lưới va chạm).
    interactables: [
      {
        id: 'gather_fish_hb_1',
        label: 'Câu Cá',
        x: 140,
        y: 680,
        radius: 48,
        action: 'n1_gather',
        nodeId: 'gather_fish_hb_1'
      }
    ],
    harvestNodes: HARVEST_NODES_HO_BANG,
    zoneHazards: ZONE_HAZARDS_HO_BANG, // Đợt V1 chặng 2: mặt băng trượt (1) + ô băng nứt (6)
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
      target: { x: 22, y: 640 },
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

  // Đợt V1 chặng 3: HỌNG PHUN DUNG NHAM Mỏ Lửa (hồ sơ 01 §3) — 4 họng phun
  // ở sân mỏ, phun theo nhịp chung 8 giây với boss Hỏa (xem LAVA_CYCLE_SEC
  // trong js/engine.js). Vị trí đã kiểm bằng tay: tâm họng đi được, ngoài
  // bán kính an toàn 150px quanh spawn/cổng vào (tâm cách spawn gần nhất
  // 487px, cách điểm rơi cổng 587px — tính tới mép họng còn dư ≥ 150px),
  // tâm họng cách điểm sinh quái gần nhất ≥ 238px (không họng nào phủ
  // điểm sinh quái — bãi farm vẫn chơi được), không chồng vật cản.
  var LAVA_VENTS_MO_LUA = [
    { id: 'hong_phun_1', kind: 'circle', cx: 500, cy: 300, r: 80 },
    { id: 'hong_phun_2', kind: 'circle', cx: 1300, cy: 400, r: 80 },
    { id: 'hong_phun_3', kind: 'circle', cx: 550, cy: 800, r: 80 },
    { id: 'hong_phun_4', kind: 'circle', cx: 1450, cy: 950, r: 80 }
  ];
  var ZONE_HAZARDS_MO_LUA = [];
  for (var _lavaV = 0; _lavaV < LAVA_VENTS_MO_LUA.length; _lavaV++) {
    ZONE_HAZARDS_MO_LUA.push({
      id: LAVA_VENTS_MO_LUA[_lavaV].id,
      kind: 'lava_vent',
      name: 'Họng Phun Dung Nham',
      shape: LAVA_VENTS_MO_LUA[_lavaV]
    });
  }

  // Đợt V1 chặng 6: Điểm hái đầy đủ Mỏ Lửa theo hồ sơ 01 §3
  // Quặng Đỏ (hồi 300s) · Hỏa Tinh Thô (900s) · Lưu Huỳnh Vàng (600s) · Tâm Lò Nguội (1800s)
  var HARVEST_NODES_MO_LUA = [
    { id: 'harvest_ml_quangdo_1', itemId: 'quang-do', name: 'Quặng Đỏ', x: 320, y: 450, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_ml_quangdo_2', itemId: 'quang-do', name: 'Quặng Đỏ', x: 820, y: 320, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_ml_quangdo_3', itemId: 'quang-do', name: 'Quặng Đỏ', x: 1100, y: 850, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_ml_hoatinh_1', itemId: 'hoa-tinh-tho', name: 'Hỏa Tinh Thô', x: 900, y: 650, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_ml_hoatinh_2', itemId: 'hoa-tinh-tho', name: 'Hỏa Tinh Thô', x: 1580, y: 620, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_ml_luuhuynh_1', itemId: 'luu-huynh-vang', name: 'Lưu Huỳnh Vàng', x: 680, y: 750, radius: 48, respawnSec: 600, count: 1 },
    { id: 'harvest_ml_luuhuynh_2', itemId: 'luu-huynh-vang', name: 'Lưu Huỳnh Vàng', x: 1200, y: 480, radius: 48, respawnSec: 600, count: 1 },
    { id: 'harvest_ml_tamlo_1', itemId: 'tam-lo-nguoi', name: 'Tâm Lò Nguội', x: 1620, y: 350, radius: 48, respawnSec: 1800, count: 1 }
  ];

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
    // Đợt N1: điểm hành nghề (thiết kế §3.3, đã kiểm lưới va chạm).
    interactables: [
      {
        id: 'gather_mine_ml_1',
        label: 'Đào Khoáng',
        x: 640,
        y: 500,
        radius: 48,
        action: 'n1_gather',
        nodeId: 'gather_mine_ml_1'
      },
      {
        id: 'gather_mine_ml_2',
        label: 'Đào Khoáng',
        x: 1440,
        y: 700,
        radius: 48,
        action: 'n1_gather',
        nodeId: 'gather_mine_ml_2'
      }
    ],
    harvestNodes: HARVEST_NODES_MO_LUA,
    zoneHazards: ZONE_HAZARDS_MO_LUA, // Đợt V1 chặng 3: 4 họng phun dung nham theo nhịp chung với boss Hỏa
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
      target: { x: 22, y: 640 },
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
    { id: 'rb1', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 200, h: 153, x: 526, y: 927, baseY: 1080, ellipse: { cx: 620.0, cy: 1052.1, rx: 89.5, ry: 26.9 } },
    { id: 'rb2', asset: 'assets/art/standee-ruined-blocks.png', originalW: 409, originalH: 313, w: 180, h: 138, x: 1116, y: 42, baseY: 180, ellipse: { cx: 1200.0, cy: 154.9, rx: 80.5, ry: 24.2 } },
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

  // Đợt V1 chặng 4: ô cát lún Hoang Mạc (hồ sơ 01 §4) — hazard kind
  // 'cat_lun' (tròn r=90) khai trong zoneHazards của map. Đứng trong ô thì
  // người chơi chậm dần qua playerSlowRatio theo thời gian đứng, thoát ra
  // thì tốc độ hồi dần (xem khối V1 chặng 4 ở js/engine.js).
  // Vị trí: tâm ô đi được; ngoài bán kính an toàn 150px quanh spawn và
  // điểm rơi cổng vào (map không có NPC/điểm trả nhiệm vụ); tâm ô cách
  // điểm sinh quái gần nhất ≥ 200px và không phủ điểm sinh quái nào (bãi
  // farm vẫn chơi được); các ô không chồng nhau. Cổng zoneCheckHazardsSafe
  // kiểm lại toàn bộ ở test/v1-hoang-mac.mjs.
  var QUICKSAND_CELLS_HOANG_MAC = [
    { id: 'cat_lun_1', cx: 300, cy: 400, r: 90 },
    { id: 'cat_lun_2', cx: 600, cy: 600, r: 90 },
    { id: 'cat_lun_3', cx: 800, cy: 700, r: 90 },
    { id: 'cat_lun_4', cx: 1250, cy: 700, r: 90 },
    { id: 'cat_lun_5', cx: 1100, cy: 1100, r: 90 },
    { id: 'cat_lun_6', cx: 1500, cy: 900, r: 90 },
    { id: 'cat_lun_7', cx: 300, cy: 1050, r: 90 }
  ];
  var ZONE_HAZARDS_HOANG_MAC = [];
  for (var _qsI = 0; _qsI < QUICKSAND_CELLS_HOANG_MAC.length; _qsI++) {
    var _qsCell = QUICKSAND_CELLS_HOANG_MAC[_qsI];
    ZONE_HAZARDS_HOANG_MAC.push({
      id: _qsCell.id,
      kind: 'cat_lun',
      name: 'Cát Lún',
      shape: { kind: 'circle', cx: _qsCell.cx, cy: _qsCell.cy, r: _qsCell.r }
    });
  }

  var isWalkableHoangMac = makeZoneIsWalkable(EXITS_HOANG_MAC, STAND_OBJECTS_HOANG_MAC, SCENERY_OBSTACLES_HOANG_MAC);

  var collisionGridHoangMac = buildGrid(1920, 1280, isWalkableHoangMac);
  forceWalkable(collisionGridHoangMac, SPAWN_HOANG_MAC.x, SPAWN_HOANG_MAC.y);
  forceWalkable(collisionGridHoangMac, EXITS_HOANG_MAC[0].target.x, EXITS_HOANG_MAC[0].target.y);
  for (var a = 0; a < HOANG_MAC_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridHoangMac, HOANG_MAC_KEY_ANCHORS[a].x, HOANG_MAC_KEY_ANCHORS[a].y);
  }

  // Đợt V1 chặng 6: Điểm hái đầy đủ Hoang Mạc theo hồ sơ 01 §4
  // Cát Tinh (hồi 300s) · Xương Linh Thảo (600s) · Nước Ốc Đảo (900s) · Địa Tâm Thạch Vụn (1800s)
  var HARVEST_NODES_HOANG_MAC = [
    { id: 'harvest_hm_cattinh_1', itemId: 'cat-tinh', name: 'Cát Tinh', x: 450, y: 480, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_hm_cattinh_2', itemId: 'cat-tinh', name: 'Cát Tinh', x: 950, y: 520, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_hm_cattinh_3', itemId: 'cat-tinh', name: 'Cát Tinh', x: 1380, y: 650, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_hm_xuonglinh_1', itemId: 'xuong-linh-thao', name: 'Xương Linh Thảo', x: 680, y: 350, radius: 48, respawnSec: 600, count: 1 },
    { id: 'harvest_hm_xuonglinh_2', itemId: 'xuong-linh-thao', name: 'Xương Linh Thảo', x: 1320, y: 950, radius: 48, respawnSec: 600, count: 1 },
    { id: 'harvest_hm_nuococdao_1', itemId: 'nuoc-oc-dao-tinh-khiet', name: 'Nước Ốc Đảo Tinh Khiết', x: 980, y: 820, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_hm_nuococdao_2', itemId: 'nuoc-oc-dao-tinh-khiet', name: 'Nước Ốc Đảo Tinh Khiết', x: 1050, y: 860, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_hm_diatam_1', itemId: 'dia-tam-thach-vun', name: 'Địa Tâm Thạch Vụn', x: 1650, y: 550, radius: 48, respawnSec: 1800, count: 1 }
  ];

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
    harvestNodes: HARVEST_NODES_HOANG_MAC,
    zoneHazards: ZONE_HAZARDS_HOANG_MAC, // Đợt V1 chặng 4: 7 ô cát lún (kind 'cat_lun')
    // Đợt V1 chặng 4: map có bão cát theo chu kỳ (engine đọc cờ này; số chu kỳ/
    // mức giảm tầm nhìn/mức ảnh hưởng di chuyển nằm ở khối V1 chặng 4 js/engine.js).
    sandStorm: { enabled: true },
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
      target: { x: 22, y: 640 },
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

  // Đợt V1 chặng 5: 2 làn kiếm khí quét cố định ở Kiếm Trủng (hồ sơ 01 §5)
  // kind 'sword_sweep' khai trong zoneHazards của map.
  // Khi quét (theo chu kỳ SWORD_SWEEP_CYCLE_SEC trong engine.js), có telegraph
  // vệt sáng bạc ≥ 700ms trước khi kiếm khí quét qua gây sát thương Kim.
  // Vị trí ngoài bán kính an toàn 150px quanh spawn (90, 640) và cổng Đài Truyền Tống (22, 640).
  var SWORD_SWEEP_LANES_KIEM_TRUNG = [
    { id: 'kiem_khi_1', name: 'Kiếm Khí Lối Bắc', shape: { kind: 'rect', x: 450, y: 530, w: 550, h: 60 } },
    { id: 'kiem_khi_2', name: 'Kiếm Khí Lối Nam', shape: { kind: 'rect', x: 600, y: 780, w: 650, h: 60 } }
  ];

  // Đợt V1 chặng 5: 8 điểm rơi Kiếm Vũ tiềm năng (hồ sơ 01 §5)
  // Mỗi đợt Kiếm Vũ kéo dài 20s, các điểm rơi luân phiên có vệt sáng bạc báo trước
  // rồi kiếm cắm xuống gây sát thương Kim diện rộng. Bán kính rơi r=65.
  // Toàn bộ các điểm đều ngoài bán kính an toàn 150px quanh spawn và cổng ra.
  var SWORD_RAIN_SPOTS_KIEM_TRUNG = [
    { id: 'kiem_vu_spot_1', cx: 380, cy: 420, r: 65 },
    { id: 'kiem_vu_spot_2', cx: 620, cy: 460, r: 65 },
    { id: 'kiem_vu_spot_3', cx: 780, cy: 660, r: 65 },
    { id: 'kiem_vu_spot_4', cx: 980, cy: 520, r: 65 },
    { id: 'kiem_vu_spot_5', cx: 1150, cy: 780, r: 65 },
    { id: 'kiem_vu_spot_6', cx: 1380, cy: 460, r: 65 },
    { id: 'kiem_vu_spot_7', cx: 1420, cy: 720, r: 65 },
    { id: 'kiem_vu_spot_8', cx: 1620, cy: 580, r: 65 }
  ];

  var ZONE_HAZARDS_KIEM_TRUNG = [];
  for (var _skI = 0; _skI < SWORD_SWEEP_LANES_KIEM_TRUNG.length; _skI++) {
    var _lane = SWORD_SWEEP_LANES_KIEM_TRUNG[_skI];
    ZONE_HAZARDS_KIEM_TRUNG.push({
      id: _lane.id,
      kind: 'sword_sweep',
      name: _lane.name,
      shape: _lane.shape
    });
  }
  for (var _srI = 0; _srI < SWORD_RAIN_SPOTS_KIEM_TRUNG.length; _srI++) {
    var _spot = SWORD_RAIN_SPOTS_KIEM_TRUNG[_srI];
    ZONE_HAZARDS_KIEM_TRUNG.push({
      id: _spot.id,
      kind: 'sword_rain_spot',
      name: 'Điểm Rơi Kiếm Vũ',
      shape: { kind: 'circle', cx: _spot.cx, cy: _spot.cy, r: _spot.r }
    });
  }

  var collisionGridKiemTrung = buildGrid(1920, 1280, isWalkableKiemTrung);
  forceWalkable(collisionGridKiemTrung, SPAWN_KIEM_TRUNG.x, SPAWN_KIEM_TRUNG.y);
  forceWalkable(collisionGridKiemTrung, EXITS_KIEM_TRUNG[0].target.x, EXITS_KIEM_TRUNG[0].target.y);
  for (var a = 0; a < KIEM_TRUNG_KEY_ANCHORS.length; a++) {
    forceWalkable(collisionGridKiemTrung, KIEM_TRUNG_KEY_ANCHORS[a].x, KIEM_TRUNG_KEY_ANCHORS[a].y);
  }

  // Đợt V1 chặng 6: Điểm hái đầy đủ Kiếm Trủng theo hồ sơ 01 §5
  // Sắt Huyền Vụn (hồi 300s) · Huyền Thiết Khối (900s) · Bột Kiếm Khí (120s) · Tâm Kiếm Vỡ (1800s)
  var HARVEST_NODES_KIEM_TRUNG = [
    { id: 'harvest_kt_sathuyen_1', itemId: 'sat-huyen-vun', name: 'Sắt Huyền Vụn', x: 320, y: 520, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_kt_sathuyen_2', itemId: 'sat-huyen-vun', name: 'Sắt Huyền Vụn', x: 820, y: 420, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_kt_sathuyen_3', itemId: 'sat-huyen-vun', name: 'Sắt Huyền Vụn', x: 1280, y: 860, radius: 48, respawnSec: 300, count: 1 },
    { id: 'harvest_kt_huyenthiet_1', itemId: 'huyen-thiet-khoi', name: 'Huyền Thiết Khối', x: 1050, y: 620, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_kt_huyenthiet_2', itemId: 'huyen-thiet-khoi', name: 'Huyền Thiết Khối', x: 1550, y: 750, radius: 48, respawnSec: 900, count: 1 },
    { id: 'harvest_kt_botkiem_1', itemId: 'bot-kiem-khi', name: 'Bột Kiếm Khí', x: 720, y: 340, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_kt_botkiem_2', itemId: 'bot-kiem-khi', name: 'Bột Kiếm Khí', x: 1620, y: 360, radius: 48, respawnSec: 120, count: 1 },
    { id: 'harvest_kt_tamkiem_1', itemId: 'tam-kiem-vo', name: 'Tâm Kiếm Vỡ', x: 1480, y: 520, radius: 48, respawnSec: 1800, count: 1 }
  ];

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
    // Đợt N1: điểm hành nghề (thiết kế §3.3, đã kiểm lưới va chạm).
    interactables: [
      {
        id: 'gather_mine_kt_1',
        label: 'Đào Khoáng',
        x: 440,
        y: 760,
        radius: 48,
        action: 'n1_gather',
        nodeId: 'gather_mine_kt_1'
      }
    ],
    harvestNodes: HARVEST_NODES_KIEM_TRUNG,
    zoneHazards: ZONE_HAZARDS_KIEM_TRUNG, // Đợt V1 chặng 5: 2 làn kiếm khí quét + 8 điểm rơi kiếm vũ
    swordStorm: { enabled: true },
    monsterPacks: KIEM_TRUNG_PACKS,
    packs: KIEM_TRUNG_PACKS,
    zones: ZONES_KIEM_TRUNG,
    minRealmRank: 11,
    minRealmLabel: 'Trúc Cơ Trung Kỳ'
  };

  // ============================================================
  // ĐỢT V1 — CHẶNG 0: KHUNG CƠ CHẾ VÙNG DÙNG CHUNG (hình học + cổng an toàn)
  // Các hàm thuần, không chạm DOM/canvas — gọi được từ Node (test) lẫn trình duyệt.
  // Hình vùng nguy hiểm (hazard.shape): một trong ba dạng:
  //   { kind: 'circle', cx, cy, r }
  //   { kind: 'polygon', points: [[x, y], ...] }   (đa giác khép, >= 3 đỉnh)
  //   { kind: 'rect', x, y, w, h }
  // Một hazard đầy đủ: { id, kind: 'poison-fog' | ..., shape: {...} } — các
  // chặng 1–5 điền thêm trường riêng của từng cơ chế (chu kỳ, sát thương...).
  // ============================================================

  // PROVISIONAL: bán kính an toàn quanh cổng vào/Đài Truyền Tống/NPC/điểm trả
  // nhiệm vụ — hồ sơ 01 không cho số, chờ Bui phán. 150px lớn hơn bán kính
  // telegraph boss vùng (85–90px) và hơn 1 giây di chuyển (SPEED 138px/s).
  var V1_SAFE_RADIUS = 150;

  /** Điểm (x, y) có nằm trong hình shape không (biên tính là trong). */
  function v1PointInShape(x, y, shape) {
    if (!shape || typeof x !== 'number' || typeof y !== 'number' ||
        !isFinite(x) || !isFinite(y)) return false;
    if (shape.kind === 'circle') {
      if (typeof shape.cx !== 'number' || typeof shape.cy !== 'number' ||
          typeof shape.r !== 'number' || shape.r < 0) return false;
      var dx = x - shape.cx;
      var dy = y - shape.cy;
      return dx * dx + dy * dy <= shape.r * shape.r;
    }
    if (shape.kind === 'rect') {
      if (typeof shape.x !== 'number' || typeof shape.y !== 'number' ||
          typeof shape.w !== 'number' || typeof shape.h !== 'number') return false;
      return x >= shape.x && x <= shape.x + shape.w &&
             y >= shape.y && y <= shape.y + shape.h;
    }
    if (shape.kind === 'polygon') {
      if (!Array.isArray(shape.points) || shape.points.length < 3) return false;
      // Ray casting (tia ngang sang phải); điểm trên biên tính là trong.
      var inside = false;
      var pts = shape.points;
      for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var xi = pts[i][0], yi = pts[i][1];
        var xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    return false;
  }

  /** Khoảng cách từ điểm tới đoạn thẳng AB (phụ cho v1PointShapeDistance). */
  function v1DistToSegment(px, py, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay;
    var lenSq = abx * abx + aby * aby;
    var t = 0;
    if (lenSq > 0) {
      t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }
    var cx = ax + t * abx, cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
  }

  /** Khoảng cách ngắn nhất từ điểm tới hình shape (0 nếu điểm nằm trong hình). */
  function v1PointShapeDistance(x, y, shape) {
    if (!shape || typeof x !== 'number' || typeof y !== 'number' ||
        !isFinite(x) || !isFinite(y)) return Infinity;
    if (shape.kind === 'circle') {
      if (typeof shape.cx !== 'number' || typeof shape.cy !== 'number' ||
          typeof shape.r !== 'number' || shape.r < 0) return Infinity;
      return Math.max(0, Math.hypot(x - shape.cx, y - shape.cy) - shape.r);
    }
    if (shape.kind === 'rect') {
      if (typeof shape.x !== 'number' || typeof shape.y !== 'number' ||
          typeof shape.w !== 'number' || typeof shape.h !== 'number') return Infinity;
      var rdx = Math.max(shape.x - x, 0, x - (shape.x + shape.w));
      var rdy = Math.max(shape.y - y, 0, y - (shape.y + shape.h));
      return Math.hypot(rdx, rdy);
    }
    if (shape.kind === 'polygon') {
      if (!Array.isArray(shape.points) || shape.points.length < 3) return Infinity;
      if (v1PointInShape(x, y, shape)) return 0;
      var min = Infinity;
      var pts = shape.points;
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        var d = v1DistToSegment(x, y, a[0], a[1], b[0], b[1]);
        if (d < min) min = d;
      }
      return min;
    }
    return Infinity;
  }

  /**
   * Các điểm móc an toàn tuyệt đối của một map: điểm xuất hiện (spawn), tâm
   * vùng cổng ra + điểm rơi của cổng (exit target), vị trí NPC, vị trí
   * interactable (Đài Truyền Tống, điểm trả nhiệm vụ...). Mọi vùng nguy hiểm
   * khai báo phải nằm ngoài V1_SAFE_RADIUS quanh từng điểm này.
   */
  function v1SafeAnchorsForMap(map) {
    var anchors = [];
    if (!map) return anchors;
    if (map.spawn && typeof map.spawn.x === 'number' && typeof map.spawn.y === 'number') {
      anchors.push({ label: 'spawn', x: map.spawn.x, y: map.spawn.y });
    }
    if (Array.isArray(map.exits)) {
      for (var e = 0; e < map.exits.length; e++) {
        var ex = map.exits[e];
        if (!ex) continue;
        if (ex.rect && typeof ex.rect.x === 'number') {
          anchors.push({
            label: 'exit:' + (ex.id || e),
            x: ex.rect.x + (ex.rect.w || 0) / 2,
            y: ex.rect.y + (ex.rect.h || 0) / 2
          });
        }
        if (ex.target && typeof ex.target.x === 'number' && typeof ex.target.y === 'number') {
          anchors.push({ label: 'exit-target:' + (ex.id || e), x: ex.target.x, y: ex.target.y });
        }
      }
    }
    if (Array.isArray(map.npcs)) {
      for (var n = 0; n < map.npcs.length; n++) {
        var npc = map.npcs[n];
        if (npc && typeof npc.x === 'number' && typeof npc.y === 'number') {
          anchors.push({ label: 'npc:' + (npc.id || npc.name || n), x: npc.x, y: npc.y });
        }
      }
    }
    if (Array.isArray(map.interactables)) {
      for (var k = 0; k < map.interactables.length; k++) {
        var it = map.interactables[k];
        if (it && typeof it.x === 'number' && typeof it.y === 'number') {
          anchors.push({ label: 'interactable:' + (it.id || it.name || k), x: it.x, y: it.y });
        }
      }
    }
    return anchors;
  }

  /**
   * Cổng an toàn chặng 0: kiểm tra mọi vùng nguy hiểm khai báo trong map có
   * nằm ngoài bán kính an toàn quanh mọi điểm móc an toàn không.
   * Trả về { ok, hazardCount, anchorCount, safeRadius, violations: [...] },
   * mỗi violation: { hazardId, anchor, distance, safeRadius }.
   * Map chưa khai hazard nào (zoneHazards rỗng) thì đạt.
   */
  function v1CheckHazardsSafe(map, safeRadius) {
    var radius = (typeof safeRadius === 'number' && isFinite(safeRadius) && safeRadius >= 0)
      ? safeRadius : V1_SAFE_RADIUS;
    var hazards = (map && Array.isArray(map.zoneHazards)) ? map.zoneHazards : [];
    var anchors = v1SafeAnchorsForMap(map);
    var violations = [];
    for (var h = 0; h < hazards.length; h++) {
      var hz = hazards[h];
      if (!hz) continue;
      // Đợt V1 chặng 1: hazard có nhiều vị trí luân phiên (trũng sương độc)
      // thì kiểm TỪNG vị trí — trũng sẽ chiếm lần lượt mọi vị trí theo chu kỳ.
      var shapes = (hz.positions && Array.isArray(hz.positions) && hz.positions.length > 0)
        ? hz.positions : [hz.shape || hz];
      var hzId = hz.id || ('hazard-' + h);
      for (var s = 0; s < shapes.length; s++) {
        for (var a = 0; a < anchors.length; a++) {
          var d = v1PointShapeDistance(anchors[a].x, anchors[a].y, shapes[s]);
          if (d < radius) {
            var violation = {
              hazardId: hzId,
              anchor: anchors[a].label,
              distance: Math.round(d * 10) / 10,
              safeRadius: radius
            };
            if (shapes.length > 1) violation.positionIndex = s;
            violations.push(violation);
          }
        }
      }
    }
    return {
      ok: violations.length === 0,
      hazardCount: hazards.length,
      anchorCount: anchors.length,
      safeRadius: radius,
      violations: violations
    };
  }

  // ============================================================
  // HỆ THỐNG QUẢN LÝ BẢN ĐỒ TOÀN CỤC
  // ============================================================

  var ALL_MAPS = {
    'mieu_hoang': MAP_MIEU_HOANG,
    'rung-doc': MAP_RUNG_DOC,
    'tong-mon': MAP_TONG_MON,
    'dai-dien': MAP_DAI_DIEN,
    'phong-luyen-dan': MAP_PHONG_LUYEN_DAN,
    'phong_luyen_dan': MAP_PHONG_LUYEN_DAN,
    'dan-phong': MAP_PHONG_LUYEN_DAN,
    'dan_phong': MAP_PHONG_LUYEN_DAN,
    'son-coc': MAP_SON_COC,
    'dai-truyen-tong': MAP_DAI_TRUYEN_TONG,
    'ruong-linh-me': MAP_RUONG_LINH_ME,
    'ho-bang': MAP_HO_BANG,
    'mo-lua': MAP_MO_LUA,
    'hoang-mac': MAP_HOANG_MAC,
    'kiem-trung': MAP_KIEM_TRUNG
  };

  // Đợt N2: Tuần Thú Sư — quà gặp đầu (Linh Thú Hoàn) còn nhận được không?
  // Đọc qua GameLinhThu để một nguồn sự thật duy nhất với bảng thú/UI.
  function tuanThuSuFirstGiftAvailable(player) {
    try {
      var lt = null;
      if (typeof window !== 'undefined' && window.GameLinhThu) lt = window.GameLinhThu;
      else if (typeof global !== 'undefined' && global.GameLinhThu) lt = global.GameLinhThu;
      else if (typeof require === 'function') lt = require('./linh-thu.js');
      if (!lt || !lt.ensureState) return false;
      var s = lt.ensureState(player);
      return !!(s && !s.firstHoanGiven);
    } catch (e) { return false; }
  }

  // Đợt ELDER (Bui 01:52): Cơ chế guarded registration đăng ký Trưởng Lão Dược Điền vào map ruong-linh-me khi map tồn tại
  function registerElderToRuongLinhMe(registry) {
    var reg = registry || ALL_MAPS;
    if (!reg) return false;
    var targetMap = reg['ruong-linh-me'] || reg['ruong_linh_me'];
    if (!targetMap) return false;
    if (!Array.isArray(targetMap.npcs)) targetMap.npcs = [];
    if (!targetMap.npcs.some(function (n) { return n.id === TRUONG_LAO_DUOC_DIEN.id; })) {
      targetMap.npcs.push(TRUONG_LAO_DUOC_DIEN);
    }
    targetMap.truonglao_duocdien = TRUONG_LAO_DUOC_DIEN;
    if (targetMap.collisionGrid && typeof forceWalkable === 'function') {
      forceWalkable(targetMap.collisionGrid, TRUONG_LAO_DUOC_DIEN.standTile.x, TRUONG_LAO_DUOC_DIEN.standTile.y);
    }
    return true;
  }

  // Tự động kiểm tra đăng ký có điều kiện (nếu map ruong-linh-me đã có trong ALL_MAPS)
  registerElderToRuongLinhMe(ALL_MAPS);

  var MapData = Object.assign({}, MAP_MIEU_HOANG, {
    maps: ALL_MAPS,
    buildGrid: buildGrid,
    forceWalkable: forceWalkable,
    TRUONG_LAO_DUOC_DIEN: TRUONG_LAO_DUOC_DIEN,
    registerElderToRuongLinhMe: registerElderToRuongLinhMe,
    // Đợt V1 chặng 0: khung cơ chế vùng dùng chung (hình học + cổng an toàn)
    V1_SAFE_RADIUS: V1_SAFE_RADIUS,
    // Đợt V1 chặng 1: chu kỳ đổi vị trí trũng sương độc Rừng Độc (PROVISIONAL)
    POISON_FOG_CYCLE_SEC: POISON_FOG_CYCLE_SEC,
    // Đợt V1 chặng 2: mặt băng trượt + ô băng nứt Hồ Băng
    ICE_SHEET_HO_BANG: ICE_SHEET_HO_BANG,
    ICE_CRACK_TILES_HO_BANG: ICE_CRACK_TILES_HO_BANG,
    HO_BANG_SHORE_POINTS: HO_BANG_SHORE_POINTS,
    // Đợt V1 chặng 3: họng phun dung nham Mỏ Lửa
    LAVA_VENTS_MO_LUA: LAVA_VENTS_MO_LUA,
    // Đợt V1 chặng 4: ô cát lún Hoang Mạc
    QUICKSAND_CELLS_HOANG_MAC: QUICKSAND_CELLS_HOANG_MAC,
    // Đợt V1 chặng 5: kiếm khí quét + điểm rơi kiếm vũ Kiếm Trủng
    SWORD_SWEEP_LANES_KIEM_TRUNG: SWORD_SWEEP_LANES_KIEM_TRUNG,
    SWORD_RAIN_SPOTS_KIEM_TRUNG: SWORD_RAIN_SPOTS_KIEM_TRUNG,
    // Đợt V1 chặng 6: danh mục điểm hái 5 vùng theo hồ sơ 01
    HARVEST_NODES_TONG_MON: HARVEST_NODES_TONG_MON,
    HARVEST_NODES_MIEU_HOANG: HARVEST_NODES_MIEU_HOANG,
    HARVEST_NODES_RUNG_DOC: HARVEST_NODES_RUNG_DOC,
    HARVEST_NODES_HO_BANG: HARVEST_NODES_HO_BANG,
    HARVEST_NODES_MO_LUA: HARVEST_NODES_MO_LUA,
    HARVEST_NODES_HOANG_MAC: HARVEST_NODES_HOANG_MAC,
    HARVEST_NODES_KIEM_TRUNG: HARVEST_NODES_KIEM_TRUNG,
    zonePointInShape: v1PointInShape,
    zonePointShapeDistance: v1PointShapeDistance,
    zoneSafeAnchorsForMap: v1SafeAnchorsForMap,
    zoneCheckHazardsSafe: v1CheckHazardsSafe,
    // Đợt N2: trạng thái quà gặp đầu của Tuần Thú Sư (qua GameLinhThu)
    tuanThuSuFirstGiftAvailable: tuanThuSuFirstGiftAvailable,
    getMap: function (id) {
      if (!id) return MAP_MIEU_HOANG;
      var clean = id.replace('_', '-');
      if (ALL_MAPS[id]) return ALL_MAPS[id];
      if (ALL_MAPS[clean]) return ALL_MAPS[clean];
      if (id === 'rung_doc' || id === 'rung-doc') return MAP_RUNG_DOC;
      if (id === 'tong_mon' || id === 'tong-mon') return MAP_TONG_MON;
      if (id === 'dai_dien' || id === 'dai-dien') return MAP_DAI_DIEN;
      if (id === 'phong-luyen-dan' || id === 'phong_luyen_dan' || id === 'dan-phong' || id === 'dan_phong' || id === 'dan-phong-map') return MAP_PHONG_LUYEN_DAN;
      if (id === 'son_coc' || id === 'son-coc') return MAP_SON_COC;
      if (id === 'dai_truyen_tong' || id === 'dai-truyen-tong') return MAP_DAI_TRUYEN_TONG;
      if (id === 'ruong_linh_me' || id === 'ruong-linh-me' || id === 'ruong_linhme') {
        if (typeof MAP_RUONG_LINH_ME !== 'undefined' && MAP_RUONG_LINH_ME) return MAP_RUONG_LINH_ME;
        return ALL_MAPS['ruong-linh-me'] || ALL_MAPS['ruong_linh_me'] || null;
      }
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
