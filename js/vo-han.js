/**
 * vo-han.js — Đợt BI-CANH-VO-HAN: Bí Cảnh Vô Hạn, map sinh ngẫu nhiên.
 *
 * Bui lệnh 19:36 ngày 2026-11-24: "Bí cảnh vô hạn generate map random để
 * khoả lấp nhược điểm ko biết map design" — đội không mạnh map design thì
 * để máy tự sinh map. Bí cảnh vô hạn: mỗi tầng một map mới sinh bằng thuật
 * toán phòng + hành lang trên lưới, có hạt giống (seed) nên trong một tầng
 * map ổn định, sang tầng mới / vào lại thì map khác.
 *
 * Lối vào: điểm tương tác "Phong Ấn Bí Cảnh" (1645,255) đã có sẵn trên map
 * Tông Môn, trong khu 'bi_canh' — engine mở modal vào bí cảnh thay cho
 * toast cũ "mở theo sự kiện — đợt sau".
 *
 * Tái dùng hệ hiện có (không chế lại): quái + boss hiện có theo hệ của tầng
 * (cùng danh sách như Tháp Tu Luyện), steering + rơi đồ + tu vi khi hạ quái
 * giữ nguyên (rollDrops KHÔNG đụng), luật chết/hồi sinh P2B KHÔNG đụng —
 * module chỉ QUAN SÁT hp <= 0 rồi kết thúc lượt; khi hồi sinh mà còn trong
 * map bí cảnh thì đưa về Miếu Hoang.
 *
 * Mọi số dưới đây là PROVISIONAL (tên/số tạm, chờ Bui chốt) — gom một bảng
 * VOHAN duy nhất. Không bịa vật phẩm mới: thưởng chỉ dùng Linh Thạch +
 * Lá Thanh Tụy (đã có trong hệ) + tu vi theo hệ tầng.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ PROVISIONAL — MỘT BẢNG DUY NHẤT (tên/số tạm, chờ Bui chốt)
  // ==========================================================================
  var VOHAN = {
    MAP_ID: 'bi-canh-vo-han',
    MAP_NAME: 'Bí Cảnh Vô Hạn', // tên tạm
    W: 2560, H: 1920, TILE: 40, COLS: 64, ROWS: 48,
    ROOM_MIN: 10, ROOM_MAX: 14,
    ROOM_W_MIN: 6, ROOM_W_MAX: 11, ROOM_H_MIN: 5, ROOM_H_MAX: 10,
    CORRIDOR_W: 2,
    DECOR_COUNT: 24,
    // Vật trang trí V2 (BICANH-V2): ảnh PNG riêng, vẽ bằng standee sắp
    // xếp theo chiều sâu; r = bán kính va chạm, w/h = kích thước vẽ (px thế giới).
    DECOR_KINDS: {
      pillar: { r: 26, w: 64, h: 96, img: 'assets/art/dungeon/vh-decor-pillar.png' },
      crystal: { r: 24, w: 64, h: 64, img: 'assets/art/dungeon/vh-decor-crystal.png' },
      bones: { r: 24, w: 72, h: 54, img: 'assets/art/dungeon/vh-decor-bones.png' },
      broken: { r: 24, w: 56, h: 80, img: 'assets/art/dungeon/vh-decor-broken.png' }
    },
    DECOR_KIND_LIST: ['pillar', 'crystal', 'bones', 'broken'],
    FLOOR_IMGS: [
      'assets/art/dungeon/vh-floor-1.png', 'assets/art/dungeon/vh-floor-2.png',
      'assets/art/dungeon/vh-floor-3.png', 'assets/art/dungeon/vh-floor-4.png',
      'assets/art/dungeon/vh-floor-5.png', 'assets/art/dungeon/vh-floor-6.png'
    ],
    WALL_IMG: 'assets/art/dungeon/vh-wall.png',
    TORCH_IMG: 'assets/art/dungeon/vh-torch.png',
    CHEST_IMG: 'assets/art/dungeon/vh-chest.png',
    ACCENT_IMG: {
      moc: 'assets/art/dungeon/vh-acc-moc.png',
      thuy: 'assets/art/dungeon/vh-acc-thuy.png',
      hoa: 'assets/art/dungeon/vh-acc-hoa.png',
      tho: 'assets/art/dungeon/vh-acc-tho.png',
      kim: 'assets/art/dungeon/vh-acc-kim.png'
    },
    ELEMENT_WASH: {
      moc: 'rgba(46,110,60,0.10)', thuy: 'rgba(40,110,160,0.10)',
      hoa: 'rgba(170,70,30,0.10)', tho: 'rgba(140,100,50,0.10)',
      kim: 'rgba(190,160,60,0.10)'
    },
    CHEST_COUNT: 2,
    MONSTER_BASE: 4, MONSTER_PER_FLOOR: 1, MONSTER_CAP: 14,
    BOSS_EVERY: 10,
    SCALE: { hpPer: 0.15, hpCap: 8.0, dmgPer: 0.06, dmgCap: 2.5, armorPerFloors: 10, armorCap: 8 },
    CLEAR_TUVI_BASE: 4, CLEAR_TUVI_PER_FLOOR: 2, CLEAR_TUVI_CAP: 60,
    CHEST_LT_BASE: 2, CHEST_LT_PER_FLOOR: 1, CHEST_LT_CAP: 15,
    CHEST_HERB_ID: 'la-thanh-tuy',
    ELEMENTS: ['moc', 'thuy', 'hoa', 'tho', 'kim'],
    ELEMENT_NAME: { moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', kim: 'Kim' },
    TRASH_BY_ELEMENT: {
      moc: ['thao_tinh', 'nhen_xanh'],
      thuy: ['bang_tinh'],
      hoa: ['hoa_thu'],
      tho: ['sa_trung'],
      kim: ['kiem_linh']
    },
    BOSS_BY_ELEMENT: {
      moc: 'boss_moc_linh_co_vuong',
      thuy: 'boss_han_kinh_giao_vuong',
      hoa: 'boss_xich_diem_viem_quan',
      tho: 'boss_hoang_sa_co_vuong',
      kim: 'boss_tan_kiem_vo_danh'
    }
  };

  var TAG = 'vo_han';
  var RESPAWN_GUARD_MS = 900;
  var TICK_MS = 200;

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
  function getMonstersAPI() {
    if (typeof window !== 'undefined' && window.GameMonsters) return window.GameMonsters;
    if (typeof global !== 'undefined' && global.GameMonsters) return global.GameMonsters;
    try { return require('./monsters.js'); } catch (e) { return null; }
  }
  function getMapDataAPI() {
    if (typeof window !== 'undefined' && window.GameMapData) return window.GameMapData;
    if (typeof global !== 'undefined' && global.GameMapData) return global.GameMapData;
    try { return require('./mapdata.js'); } catch (e) { return null; }
  }
  function getPlayer() {
    var eng = getEngine();
    return eng && eng.getPlayer ? eng.getPlayer() : null;
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
  function dist(x1, y1, x2, y2) {
    var dx = x1 - x2, dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }
  // PRNG có hạt giống (mulberry32 — cùng mẫu với Tháp Tu Luyện): một tầng
  // luôn sinh cùng một map khi cùng seed.
  function mulberry32(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function ensureState(player) {
    if (!player) return null;
    if (!player.voHan || typeof player.voHan !== 'object') {
      player.voHan = { bestFloor: 0, totalRuns: 0, lastRun: null };
    }
    var st = player.voHan;
    if (typeof st.bestFloor !== 'number' || !isFinite(st.bestFloor)) st.bestFloor = 0;
    if (typeof st.totalRuns !== 'number' || !isFinite(st.totalRuns)) st.totalRuns = 0;
    if (!st.lastRun || typeof st.lastRun !== 'object') st.lastRun = null;
    return st;
  }

  // ==========================================================================
  // BẬC THANG / HỆ SỐ THEO TẦNG (PROVISIONAL)
  // ==========================================================================
  function floorElement(floor) {
    var f = Math.max(1, Math.floor(floor || 1));
    return VOHAN.ELEMENTS[Math.floor((f - 1) / VOHAN.BOSS_EVERY) % VOHAN.ELEMENTS.length];
  }
  function isBossFloor(floor) {
    return Math.max(1, Math.floor(floor || 1)) % VOHAN.BOSS_EVERY === 0;
  }
  function monsterCount(floor) {
    var f = Math.max(1, Math.floor(floor || 1));
    return Math.min(VOHAN.MONSTER_CAP, VOHAN.MONSTER_BASE + VOHAN.MONSTER_PER_FLOOR * f);
  }
  function scaleFor(floor) {
    var f = Math.max(1, Math.floor(floor || 1));
    return {
      hp: Math.min(VOHAN.SCALE.hpCap, 1 + VOHAN.SCALE.hpPer * (f - 1)),
      dmg: Math.min(VOHAN.SCALE.dmgCap, 1 + VOHAN.SCALE.dmgPer * (f - 1)),
      armorAdd: Math.min(VOHAN.SCALE.armorCap, Math.floor((f - 1) / VOHAN.SCALE.armorPerFloors))
    };
  }
  function applyScale(m, s) {
    if (!m || !s) return m;
    m.maxHp = Math.max(1, Math.round(m.maxHp * s.hp));
    m.hp = m.maxHp;
    m.damage = Math.round(m.damage * s.dmg * 10) / 10;
    m.armor = (m.armor || 0) + (s.armorAdd || 0);
    return m;
  }

  // ==========================================================================
  // SINH MAP NGẪU NHIÊN: phòng + hành lang trên lưới (seeded)
  // ==========================================================================
  var TILE = VOHAN.TILE, COLS = VOHAN.COLS, ROWS = VOHAN.ROWS;

  function cellCenter(gx, gy) { return { x: (gx + 0.5) * TILE, y: (gy + 0.5) * TILE }; }

  function carveCorridor(grid, a, b, rnd) {
    // Hành lang chữ L rộng CORRIDOR_W nối tâm hai phòng; thứ tự ngang/dọc
    // ngẫu nhiên để map đỡ đều.
    var x = a.cx, y = a.cy;
    var horizFirst = rnd() < 0.5;
    var carveH = function (x0, x1, cy) {
      var s = Math.min(x0, x1), e = Math.max(x0, x1);
      for (var xx = s; xx <= e; xx++) {
        for (var w = 0; w < VOHAN.CORRIDOR_W; w++) {
          var yy = cy + w;
          if (xx >= 1 && xx < COLS - 1 && yy >= 1 && yy < ROWS - 1) grid[yy][xx] = 1;
        }
      }
    };
    var carveV = function (y0, y1, cx) {
      var s = Math.min(y0, y1), e = Math.max(y0, y1);
      for (var yy = s; yy <= e; yy++) {
        for (var w = 0; w < VOHAN.CORRIDOR_W; w++) {
          var xx = cx + w;
          if (xx >= 1 && xx < COLS - 1 && yy >= 1 && yy < ROWS - 1) grid[yy][xx] = 1;
        }
      }
    };
    if (horizFirst) { carveH(x, b.cx, y); carveV(y, b.cy, b.cx); }
    else { carveV(y, b.cy, x); carveH(x, b.cx, b.cy); }
  }

  function insideDecor(layout, x, y, margin) {
    var ds = layout.decor;
    for (var i = 0; i < ds.length; i++) {
      if (dist(x, y, ds[i].x, ds[i].y) < ds[i].r + (margin || 0)) return true;
    }
    return false;
  }

  function isWalkablePx(layout, x, y) {
    if (x < 8 || x > VOHAN.W - 8 || y < 8 || y > VOHAN.H - 8) return false;
    var gx = Math.floor(x / TILE), gy = Math.floor(y / TILE);
    if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return false;
    if (layout.grid[gy][gx] !== 1) return false;
    return !insideDecor(layout, x, y, 0);
  }

  // BFS trên ô 40px: từ điểm sinh phải tới được cổng ra + mọi điểm quái/rương.
  // Vật trang trí là thứ duy nhất có thể bịt đường (phòng + hành lang nối nhau
  // theo cấu trúc) nên kiểm tra này là cổng chống map hỏng.
  function layoutConnected(layout) {
    var start = cellCenter(Math.floor(layout.spawn.x / TILE), Math.floor(layout.spawn.y / TILE));
    var seen = [];
    for (var y = 0; y < ROWS; y++) { seen.push([]); for (var x = 0; x < COLS; x++) seen[y].push(false); }
    var q = [{ x: Math.floor(layout.spawn.x / TILE), y: Math.floor(layout.spawn.y / TILE) }];
    seen[q[0].y][q[0].x] = true;
    while (q.length) {
      var c = q.shift();
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < 4; d++) {
        var nx = c.x + dirs[d][0], ny = c.y + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen[ny][nx]) continue;
        var p = cellCenter(nx, ny);
        if (!isWalkablePx(layout, p.x, p.y)) continue;
        seen[ny][nx] = true;
        q.push({ x: nx, y: ny });
      }
    }
    var reach = function (px, py) {
      var gx = Math.floor(px / TILE), gy = Math.floor(py / TILE);
      if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return false;
      return seen[gy][gx];
    };
    if (!reach(layout.exit.x, layout.exit.y)) return false;
    for (var i = 0; i < layout.monsterSpots.length; i++) {
      if (!reach(layout.monsterSpots[i].x, layout.monsterSpots[i].y)) return false;
    }
    for (var j = 0; j < layout.chests.length; j++) {
      if (!reach(layout.chests[j].x, layout.chests[j].y)) return false;
    }
    return !!start;
  }

  // Đuốc V2: ô tường có sàn ngay dưới, theo mẫu đều ((gx*5+gy*3)%11===0)
  // để đuốc rải dọc tường mà không cần thêm hạt giống.
  function computeTorches(grid) {
    var list = [];
    for (var gy = 0; gy < ROWS; gy++) {
      for (var gx = 0; gx < COLS; gx++) {
        if (grid[gy][gx] !== 0) continue;
        if (gy + 1 >= ROWS || grid[gy + 1][gx] !== 1) continue;
        if ((gx * 5 + gy * 3) % 11 !== 0) continue;
        list.push({ x: (gx + 0.5) * TILE, y: (gy + 1) * TILE });
      }
    }
    return list;
  }

  function generateFloor(floor, seed) {
    var rnd = mulberry32(seed);
    var grid = [];
    for (var y = 0; y < ROWS; y++) { grid.push([]); for (var x = 0; x < COLS; x++) grid[y].push(0); }

    var rooms = [];
    var tries = 0;
    while (rooms.length < VOHAN.ROOM_MAX && tries < 140) {
      tries++;
      var w = VOHAN.ROOM_W_MIN + Math.floor(rnd() * (VOHAN.ROOM_W_MAX - VOHAN.ROOM_W_MIN + 1));
      var h = VOHAN.ROOM_H_MIN + Math.floor(rnd() * (VOHAN.ROOM_H_MAX - VOHAN.ROOM_H_MIN + 1));
      var x = 1 + Math.floor(rnd() * (COLS - w - 2));
      var y = 1 + Math.floor(rnd() * (ROWS - h - 2));
      var ok = true;
      for (var i = 0; i < rooms.length; i++) {
        var r = rooms[i];
        if (x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y) { ok = false; break; }
      }
      if (!ok) continue;
      rooms.push({ x: x, y: y, w: w, h: h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
    }
    if (rooms.length < VOHAN.ROOM_MIN) return null;

    var ri, rj;
    for (ri = 0; ri < rooms.length; ri++) {
      var rm = rooms[ri];
      for (var yy = rm.y; yy < rm.y + rm.h; yy++) {
        for (var xx = rm.x; xx < rm.x + rm.w; xx++) grid[yy][xx] = 1;
      }
    }
    for (ri = 1; ri < rooms.length; ri++) carveCorridor(grid, rooms[ri - 1], rooms[ri], rnd);

    var spawnRoom = rooms[0];
    var exitRoom = rooms[0], bestD = -1;
    for (rj = 0; rj < rooms.length; rj++) {
      var dd = (rooms[rj].cx - spawnRoom.cx) * (rooms[rj].cx - spawnRoom.cx) +
        (rooms[rj].cy - spawnRoom.cy) * (rooms[rj].cy - spawnRoom.cy);
      if (dd > bestD) { bestD = dd; exitRoom = rooms[rj]; }
    }
    var spawn = cellCenter(spawnRoom.cx, spawnRoom.cy);
    var exit = cellCenter(exitRoom.cx, exitRoom.cy);

    // Vật trang trí: đá/bụi RIÊNG LẺ, mỗi vật có va chạm tròn khớp chân đế
    // (CHUẨN MAP NGŨ HÀNH — không vẽ vật rắn giả mà đi xuyên qua được).
    var decor = [];
    var dTries = 0;
    while (decor.length < VOHAN.DECOR_COUNT && dTries < 100) {
      dTries++;
      var dgx = 2 + Math.floor(rnd() * (COLS - 4));
      var dgy = 2 + Math.floor(rnd() * (ROWS - 4));
      if (grid[dgy][dgx] !== 1) continue;
      var dp = cellCenter(dgx, dgy);
      if (dist(dp.x, dp.y, spawn.x, spawn.y) < 120 || dist(dp.x, dp.y, exit.x, exit.y) < 100) continue;
      var tooClose = false;
      for (var d = 0; d < decor.length; d++) {
        if (dist(dp.x, dp.y, decor[d].x, decor[d].y) < 90) { tooClose = true; break; }
      }
      if (tooClose) continue;
      var kind = VOHAN.DECOR_KIND_LIST[Math.floor(rnd() * VOHAN.DECOR_KIND_LIST.length)];
      decor.push({ x: dp.x, y: dp.y, r: VOHAN.DECOR_KINDS[kind].r, kind: kind });
    }

    var layout = {
      floor: floor, seed: seed, grid: grid, rooms: rooms,
      spawn: spawn, exit: exit, decor: decor, monsterSpots: [], chests: [],
      torches: computeTorches(grid)
    };

    // Điểm quái: ô sàn, cách điểm sinh >= 160px, ngoài va chạm vật trang trí.
    var count = isBossFloor(floor) ? 2 : monsterCount(floor);
    var mTries = 0;
    while (layout.monsterSpots.length < count && mTries < 240) {
      mTries++;
      var mgx = 1 + Math.floor(rnd() * (COLS - 2));
      var mgy = 1 + Math.floor(rnd() * (ROWS - 2));
      if (grid[mgy][mgx] !== 1) continue;
      var mp = cellCenter(mgx, mgy);
      if (dist(mp.x, mp.y, spawn.x, spawn.y) < 160) continue;
      if (insideDecor(layout, mp.x, mp.y, 20)) continue;
      var far = false;
      for (var s = 0; s < layout.monsterSpots.length; s++) {
        if (dist(mp.x, mp.y, layout.monsterSpots[s].x, layout.monsterSpots[s].y) < 70) { far = true; break; }
      }
      if (far) continue;
      layout.monsterSpots.push(mp);
    }

    // Rương: 2 cái, trong phòng khác phòng sinh, cách sinh/cổng/quái.
    var cTries = 0;
    while (layout.chests.length < VOHAN.CHEST_COUNT && cTries < 140) {
      cTries++;
      var cgx = 1 + Math.floor(rnd() * (COLS - 2));
      var cgy = 1 + Math.floor(rnd() * (ROWS - 2));
      if (grid[cgy][cgx] !== 1) continue;
      var cp = cellCenter(cgx, cgy);
      if (dist(cp.x, cp.y, spawn.x, spawn.y) < 200 || dist(cp.x, cp.y, exit.x, exit.y) < 80) continue;
      if (insideDecor(layout, cp.x, cp.y, 20)) continue;
      var close = false;
      for (var cs = 0; cs < layout.chests.length; cs++) {
        if (dist(cp.x, cp.y, layout.chests[cs].x, layout.chests[cs].y) < 120) { close = true; break; }
      }
      if (close) continue;
      layout.chests.push(cp);
    }

    // Tầng boss chỉ cần 2 điểm quái (boss + 2 quái kèm); tầng thường cần >= 4.
    if (layout.monsterSpots.length < (isBossFloor(floor) ? 2 : 4)) return null;
    // Cổng liên thông: vật trang trí là thứ duy nhất có thể bịt đường
    // (phòng + hành lang nối nhau theo cấu trúc). Trượt thì bỏ hết vật
    // rồi kiểm lại — chỉ trượt thật khi cấu trúc phòng/hành lang lỗi.
    if (!layoutConnected(layout)) {
      genStats.decorStripped++;
      layout.decor = [];
      if (!layoutConnected(layout)) return null;
    }
    return layout;
  }

  // Thử tối đa 6 seed: seed đầu trượt kiểm liên thông thì đổi seed. Lần cuối
  // cùng: bỏ hết vật trang trí (thứ duy nhất có thể bịt đường) rồi kiểm lại.
  function generateFloorWithRetry(floor, seed) {
    for (var k = 0; k < 6; k++) {
      var lay = generateFloor(floor, seed + k * 7919);
      if (lay) return lay;
    }
    return null;
  }

  var genStats = { decorStripped: 0 };

  // ==========================================================================
  // ÁP LAYOUT LÊN MAP ĐĂNG KÝ 'bi-canh-vo-han' (đột biến object map)
  // ==========================================================================
  var currentLayout = null;
  var currentPortalOpen = false;
  var bgCanvas = null;

  // Ảnh nền V2 (nạp ở init; từng lớp kiểm imgReady riêng — lớp nào chưa
  // nạp thì buildBgCanvas vẽ dự phòng thủ tục như V1, map không bao giờ trống).
  var imgCache = {};
  var imgsReady = false;
  function dungeonImageUrls() {
    var urls = VOHAN.FLOOR_IMGS.slice();
    urls.push(VOHAN.WALL_IMG, VOHAN.TORCH_IMG, VOHAN.CHEST_IMG);
    var k;
    for (k in VOHAN.ACCENT_IMG) urls.push(VOHAN.ACCENT_IMG[k]);
    for (k in VOHAN.DECOR_KINDS) urls.push(VOHAN.DECOR_KINDS[k].img);
    return urls;
  }
  function imgReady(url) {
    var im = imgCache[url];
    return !!(im && im.complete && im.naturalWidth > 0);
  }
  function decorImgsReady() {
    for (var k in VOHAN.DECOR_KINDS) if (!imgReady(VOHAN.DECOR_KINDS[k].img)) return false;
    return true;
  }
  function preloadDungeonImages() {
    if (typeof document === 'undefined') return;
    var urls = dungeonImageUrls();
    var remaining = urls.length;
    urls.forEach(function (u) {
      var im = new Image();
      var done = function () { imgCache[u] = im; if (--remaining <= 0) { imgsReady = true; rebuildBgCanvas(); } };
      im.onload = done;
      im.onerror = done;
      im.src = u;
    });
  }

  function getDungeonMap() {
    var api = getMapDataAPI();
    if (!api || !api.getMap) return null;
    return api.getMap(VOHAN.MAP_ID);
  }

  function applyLayout(floor, layout, portalOpen) {
    var map = getDungeonMap();
    if (!map || !layout) return false;
    currentLayout = layout;
    currentPortalOpen = !!portalOpen;
    var walkFn = function (x, y) { return isWalkablePx(layout, x, y); };
    map.interactables = [
      { id: 'vohan_exit', label: 'Cổng Tầng Sau', x: layout.exit.x, y: layout.exit.y, radius: 52, action: 'vohan_exit' }
    ];
    for (var ci = 0; ci < layout.chests.length; ci++) {
      map.interactables.push({
        id: 'vohan_chest_' + (ci + 1), label: 'Rương Bí Cảnh',
        x: layout.chests[ci].x, y: layout.chests[ci].y, radius: 44,
        action: 'vohan_chest', chestId: 'c' + (ci + 1)
      });
    }
    map.obstacles = layout.decor.map(function (d) {
      return { x: d.x - d.r, y: d.y - d.r, rect: { x: d.x - d.r, y: d.y - d.r, w: d.r * 2, h: d.r * 2 } };
    });
    map.trees = [];
    // V2: vật trang trí là standee (engine vẽ sắp xếp theo chiều sâu,
    // bóng tiếp xúc qua trunk) — chỉ khi ảnh đã nạp; chưa nạp thì nền
    // thủ tục tự vẽ vật dự phòng (xem buildBgCanvas).
    map.standees = decorImgsReady() ? layout.decor.map(function (d, idx) {
      var def = VOHAN.DECOR_KINDS[d.kind] || VOHAN.DECOR_KINDS.pillar;
      var feetY = d.y + d.r * 0.55;
      return {
        id: 'vohan_decor_' + idx, asset: def.img,
        x: d.x - def.w / 2, y: feetY - def.h, w: def.w, h: def.h,
        baseY: feetY, feetX: d.x, feetY: feetY,
        trunk: { x: d.x, y: feetY - 4, r: def.w * 0.30 }
      };
    }) : [];
    map.npcs = [];
    map.monsterPacks = [];
    map.harvestNodes = [];
    map.exits = [];
    map.spawn = { x: layout.spawn.x, y: layout.spawn.y };
    map.zones = [{ id: 'bi_canh_vo_han', name: VOHAN.MAP_NAME, desc: 'Bí cảnh vô hạn — map sinh ngẫu nhiên mỗi tầng.', rect: { x: 0, y: 0, w: VOHAN.W, h: VOHAN.H } }];
    var api = getMapDataAPI();
    if (api && api.buildGrid) {
      map.collisionGrid = api.buildGrid(VOHAN.W, VOHAN.H, walkFn);
      // Ép các điểm neo đi được (điểm sinh, cổng, rương, điểm quái).
      if (api.forceWalkable) {
        api.forceWalkable(map.collisionGrid, layout.spawn.x, layout.spawn.y);
        api.forceWalkable(map.collisionGrid, layout.exit.x, layout.exit.y);
        for (var fi = 0; fi < layout.chests.length; fi++) {
          api.forceWalkable(map.collisionGrid, layout.chests[fi].x, layout.chests[fi].y);
        }
        for (var mi = 0; mi < layout.monsterSpots.length; mi++) {
          api.forceWalkable(map.collisionGrid, layout.monsterSpots[mi].x, layout.monsterSpots[mi].y);
        }
      }
    }
    map.isWalkable = walkFn;
    map.bgImage = null;
    if (typeof document !== 'undefined') bgCanvas = buildBgCanvas(layout, currentPortalOpen, {});
    return true;
  }

  // Vẽ nền tầng (V2): lát tile PNG theo hạt giống + wash màu theo hệ +
  // điểm nhấn theo hệ + tường lát tile có bóng đổ + đuốc phát sáng.
  // Vẽ 1 lần mỗi tầng lên canvas 2560x1920 — engine chỉ drawImage.
  // Lớp ảnh nào chưa nạp thì vẽ dự phòng thủ tục như V1 (không bao giờ trống).
  function buildBgCanvas(layout, portalOpen, openedChests) {
    if (typeof document === 'undefined') return null;
    var cv = document.createElement('canvas');
    cv.width = VOHAN.W; cv.height = VOHAN.H;
    var c = cv.getContext('2d');
    var rnd = mulberry32(layout.seed + 999);
    var elem = floorElement(layout.floor);
    var wash = VOHAN.ELEMENT_WASH[elem];
    var accentImg = imgReady(VOHAN.ACCENT_IMG[elem]) ? imgCache[VOHAN.ACCENT_IMG[elem]] : null;
    // Nền tối lót (khe giữa các ô).
    c.fillStyle = '#101216';
    c.fillRect(0, 0, VOHAN.W, VOHAN.H);
    for (var gy = 0; gy < ROWS; gy++) {
      for (var gx = 0; gx < COLS; gx++) {
        if (layout.grid[gy][gx] !== 1) continue;
        // Mỗi ô sàn tốn đúng 2 lần rnd (biến thể + điểm nhấn) ở mọi đường
        // đi — để tile không đổi khi rebuild sau khi ảnh nạp xong.
        var vi = Math.floor(rnd() * VOHAN.FLOOR_IMGS.length);
        var accRoll = rnd();
        var tileUrl = VOHAN.FLOOR_IMGS[vi];
        if (imgReady(tileUrl)) {
          c.drawImage(imgCache[tileUrl], gx * TILE, gy * TILE, TILE, TILE);
        } else {
          var v = 38 + ((vi * 2) % 14);
          c.fillStyle = 'rgb(' + v + ',' + (v - 2) + ',' + (v + 6) + ')';
          c.fillRect(gx * TILE, gy * TILE, TILE, TILE);
          c.strokeStyle = 'rgba(0,0,0,0.25)';
          c.lineWidth = 1;
          c.strokeRect(gx * TILE + 0.5, gy * TILE + 0.5, TILE - 1, TILE - 1);
        }
        // Wash màu theo hệ tầng (mỏng, chỉ phủ sàn).
        if (wash) { c.fillStyle = wash; c.fillRect(gx * TILE, gy * TILE, TILE, TILE); }
        // Điểm nhấn theo hệ (rêu/vệt nước/than hồng/đất khô/vân vàng).
        if (accentImg && accRoll < 0.16) {
          c.drawImage(accentImg, gx * TILE, gy * TILE, TILE, TILE);
        }
      }
    }
    // Tường: ô tường kề sàn thì lát tile tường (mặt trên khối đá sáng hơn)
    // + bóng đổ xuống sàn ngay dưới; tường sâu thì gần như đen.
    var wallImg = imgReady(VOHAN.WALL_IMG) ? imgCache[VOHAN.WALL_IMG] : null;
    for (var wy = 0; wy < ROWS; wy++) {
      for (var wx = 0; wx < COLS; wx++) {
        if (layout.grid[wy][wx] !== 0) continue;
        var adjFloor = (wy + 1 < ROWS && layout.grid[wy + 1][wx] === 1) ||
          (wy - 1 >= 0 && layout.grid[wy - 1][wx] === 1) ||
          (wx + 1 < COLS && layout.grid[wy][wx + 1] === 1) ||
          (wx - 1 >= 0 && layout.grid[wy][wx - 1] === 1);
        if (!adjFloor) { c.fillStyle = '#0b0c0f'; c.fillRect(wx * TILE, wy * TILE, TILE, TILE); continue; }
        if (wallImg) c.drawImage(wallImg, wx * TILE, wy * TILE, TILE, TILE);
        else { c.fillStyle = '#17191d'; c.fillRect(wx * TILE, wy * TILE, TILE, TILE); }
        if (wy + 1 < ROWS && layout.grid[wy + 1][wx] === 1) {
          var grad = c.createLinearGradient(0, (wy + 1) * TILE, 0, (wy + 1) * TILE + 10);
          grad.addColorStop(0, 'rgba(0,0,0,0.55)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = grad;
          c.fillRect(wx * TILE, (wy + 1) * TILE, TILE, 10);
        }
      }
    }
    // Đuốc trên tường kề sàn + hào quang ấm.
    var torchImg = imgReady(VOHAN.TORCH_IMG) ? imgCache[VOHAN.TORCH_IMG] : null;
    for (var ti = 0; ti < layout.torches.length; ti++) {
      var t = layout.torches[ti];
      var fx = t.x, fy = t.y; // fy = mép tường/sàn
      var glow = c.createRadialGradient(fx, fy - 30, 4, fx, fy - 30, 95);
      glow.addColorStop(0, 'rgba(255,176,66,0.20)');
      glow.addColorStop(0.5, 'rgba(255,150,50,0.08)');
      glow.addColorStop(1, 'rgba(255,150,50,0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(fx, fy - 30, 95, 0, Math.PI * 2); c.fill();
      if (torchImg) {
        c.drawImage(torchImg, fx - 16, fy - 48, 32, 48);
      } else {
        c.fillStyle = '#6b4a22'; c.fillRect(fx - 3, fy - 34, 6, 30);
        c.fillStyle = '#ffb142'; c.beginPath(); c.arc(fx, fy - 38, 8, 0, Math.PI * 2); c.fill();
      }
    }
    // Vật trang trí: ảnh PNG vẽ bằng standee (xem applyLayout). Chỉ khi
    // ảnh chưa nạp mới vẽ dự phòng thủ tục (đá tròn + bóng tiếp xúc).
    if (!decorImgsReady()) {
      for (var di = 0; di < layout.decor.length; di++) {
        var d = layout.decor[di];
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.beginPath();
        c.ellipse(d.x, d.y + d.r * 0.55, d.r * 0.95, d.r * 0.4, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#5c6068';
        c.beginPath(); c.arc(d.x, d.y, d.r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7d838e';
        c.beginPath(); c.arc(d.x - d.r * 0.25, d.y - d.r * 0.3, d.r * 0.55, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#33363d'; c.lineWidth = 2;
        c.beginPath(); c.arc(d.x, d.y, d.r, 0, Math.PI * 2); c.stroke();
      }
    }
    // Rương: ảnh PNG (chân đế chạm đáy); đã mở thì tối đi.
    // Nhãn 'Rương Bí Cảnh' vẽ mỗi khung (xem drawWorldLabels) để không
    // bị joystick/nút skill che.
    var chestImg = imgReady(VOHAN.CHEST_IMG) ? imgCache[VOHAN.CHEST_IMG] : null;
    for (var ci = 0; ci < layout.chests.length; ci++) {
      var ch = layout.chests[ci];
      var opened = openedChests && openedChests['c' + (ci + 1)];
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath(); c.ellipse(ch.x, ch.y + 14, 22, 7, 0, 0, Math.PI * 2); c.fill();
      if (chestImg) {
        if (opened) c.globalAlpha = 0.55;
        c.drawImage(chestImg, ch.x - 32, ch.y - 34, 64, 48);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = opened ? '#6b5636' : '#8a6a35';
        c.fillRect(ch.x - 18, ch.y - 12, 36, 24);
        c.fillStyle = opened ? '#7d6845' : '#a8843f';
        c.fillRect(ch.x - 18, ch.y - 18, 36, 10);
        c.fillStyle = '#e8c56b';
        c.fillRect(ch.x - 3, ch.y - 6, 6, 8);
        c.strokeStyle = '#3a2c14'; c.lineWidth = 2;
        c.strokeRect(ch.x - 18, ch.y - 18, 36, 30);
      }
    }
    // Cổng tầng sau: vòng xoáy; mở rồi thì vàng rực, chưa mở thì tím mờ.
    // Nhãn cổng cũng vẽ mỗi khung (xem drawWorldLabels).
    var ex = layout.exit;
    var glow = portalOpen ? '#ffd76a' : '#9a6ee8';
    c.save();
    c.shadowColor = glow; c.shadowBlur = portalOpen ? 26 : 14;
    c.strokeStyle = glow; c.lineWidth = 5;
    c.beginPath(); c.arc(ex.x, ex.y, 30, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2.5;
    c.beginPath(); c.arc(ex.x, ex.y, 20, 0.4, Math.PI * 1.4); c.stroke();
    c.beginPath(); c.arc(ex.x, ex.y, 12, Math.PI, Math.PI * 2.2); c.stroke();
    c.restore();
    c.fillStyle = portalOpen ? 'rgba(255, 215, 106, 0.25)' : 'rgba(154, 110, 232, 0.18)';
    c.beginPath(); c.arc(ex.x, ex.y, 28, 0, Math.PI * 2); c.fill();
    return cv;
  }

  function rebuildBgCanvas() {
    if (typeof document === 'undefined' || !currentLayout) return;
    bgCanvas = buildBgCanvas(currentLayout, currentPortalOpen, run ? run.openedChests : {});
  }

  // Engine gọi mỗi khung hình để vẽ nền tầng (nhánh bi-canh-vo-han trong render).
  function drawBackground(ctx) {
    if (!ctx) return;
    if (bgCanvas) { ctx.drawImage(bgCanvas, 0, 0); drawWorldLabels(ctx); return; }
    ctx.fillStyle = '#20242a';
    ctx.fillRect(0, 0, VOHAN.W, VOHAN.H);
  }

  // Nhãn rương/cổng vẽ MỖI KHUNG bằng tọa độ màn hình (không nướng trong
  // nền) — nhãn nào rơi vào vùng nút chạm (joystick, vòng skill, HUD,
  // minimap, cụm nút phải) thì dời tới chỗ trống gần nhất, không dời được
  // thì bỏ vẽ khung đó (nhãn không bao giờ núp sau nút).
  var lastLabelRects = {};
  function rectHit(r, o) {
    return r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y;
  }
  // V2-fix 2026-11-24 (lượt driver 2: nhãn rương mất hẳn khi rương rơi vào
  // góc dưới-trái màn hình, ngoài tầm lệch ±68/−104 cũ): lưới lệch thử
  // gần-trước-xa-sau (±170 ngang, −182..+26 dọc), xếp theo khoảng cách
  // Manhattan để nhãn ở gần điểm neo nhất có thể; ứng viên được kẹp vào
  // khung nhìn trước khi kiểm chồng lấn thay vì loại thẳng khi ngoài khung.
  var LABEL_OFFSETS = (function () {
    var dxs = [0, 34, -34, 68, -68, 102, -102, 136, -136, 170, -170];
    // V3-fix 2026-11-24 (lượt driver V3-1 @390, rương (1220,220) sát mép
    // trên map): neo nhãn rơi dưới bảng nhiệm vụ (x17–273); thoát ngang
    // là không thể vì nhãn rộng 122px, kẹp khung nhìn 390px chỉ tới x266
    // < mép phải panel 273; thoát lên cũng không (khung nhân vật). Lưới
    // cũ chỉ xuống tới +26 nên mọi ứng viên đều chạm panel → drawn:false.
    // Thêm các lệch XUỐNG +52..+182 để nhãn rơi xuống dưới bảng nhiệm vụ
    // khi neo bị kẹp phía trên. Sắp xếp theo Manhattan nên ca thường không đổi.
    var dys = [0, -26, -52, -78, -104, -130, -156, -182, 26, 52, 78, 104, 130, 156, 182];
    var list = [];
    for (var i = 0; i < dys.length; i++) for (var j = 0; j < dxs.length; j++) list.push([dxs[j], dys[i]]);
    list.sort(function (a, b) {
      var da = Math.abs(a[0]) + Math.abs(a[1]), db = Math.abs(b[0]) + Math.abs(b[1]);
      if (da !== db) return da - db;
      if (a[1] !== b[1]) return a[1] - b[1];
      return Math.abs(a[0]) - Math.abs(b[0]);
    });
    return list;
  })();

  function drawWorldLabels(ctx) {
    var eng = getEngine();
    if (!eng || !currentLayout || typeof document === 'undefined') return;
    var cam = eng.getCamera ? eng.getCamera() : null;
    if (!cam) return;
    var s = cam.scale || (eng.getCameraScale && eng.getCameraScale()) || 1;
    var vw = window.innerWidth, vh = window.innerHeight;
    var occ = [];
    // V2-fix 2026-11-24: nhãn vẽ trên canvas nằm DƯỚI mọi panel DOM nên
    // khung nhân vật + bảng nhiệm vụ (góc trên-trái) cũng là vùng che —
    // rương ở nửa trên màn hình mà nhãn rơi vào đó sẽ bị panel lấn mất.
    var occIds = ['joystick-zone', 'vohan-hud', 'minimap-wrap', 'hud-right-controls', 'char-frame', 'quest-panel', 'btn-toggle-quest-hud', 'quick-slots'];
    for (var oi = 0; oi < occIds.length; oi++) {
      var el = document.getElementById(occIds[oi]);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) occ.push({ x: r.left, y: r.top, w: r.width, h: r.height });
    }
    // Vòng skill: hộp #skill-bar nằm dưới nếp gấp (không phủ đúng nút) —
    // lấy rect từng ô skill thật thay vì hộp chứa.
    var skillSlots = document.querySelectorAll('#skill-bar .skill-slot');
    for (var si = 0; si < skillSlots.length; si++) {
      var sr = skillSlots[si].getBoundingClientRect();
      if (sr.width > 0 && sr.height > 0) occ.push({ x: sr.left, y: sr.top, w: sr.width, h: sr.height });
    }
    // V2-fix 2026-11-24 (ảnh tầng 2 lượt 3: nhãn "Rương Bí Cảnh" bị cụm
    // pha lê chẻ đôi chữ): standee do engine vẽ SAU nền nên đè lên nhãn —
    // rect màn hình của từng standee cũng là vùng che khi đặt nhãn. Chỉ
    // tính standee đang trong khung nhìn. (Vật dự phòng vẽ TRONG nền thì
    // không che nhãn nên không tính.)
    var dungeonMap = getDungeonMap();
    if (dungeonMap && dungeonMap.standees) {
      for (var sd = 0; sd < dungeonMap.standees.length; sd++) {
        var st = dungeonMap.standees[sd];
        var stx = (st.x - cam.x) * s, sty = (st.y - cam.y) * s;
        var stw = st.w * s, sth = st.h * s;
        if (stx + stw < 0 || sty + sth < 0 || stx > vw || sty > vh) continue;
        occ.push({ x: stx, y: sty, w: stw, h: sth });
      }
    }
    var items = [];
    for (var ci = 0; ci < currentLayout.chests.length; ci++) {
      var ch = currentLayout.chests[ci];
      if (run && run.openedChests && run.openedChests['c' + (ci + 1)]) continue;
      items.push({ key: 'chest_c' + (ci + 1), x: ch.x, y: ch.y - 28, text: 'Rương Bí Cảnh' });
    }
    items.push({ key: 'exit', x: currentLayout.exit.x, y: currentLayout.exit.y - 44, text: currentPortalOpen ? 'Cổng Tầng Sau — ĐÃ MỞ' : 'Cổng Tầng Sau' });
    var canvasEl = ctx.canvas;
    var dpr = (canvasEl && canvasEl.clientWidth > 0) ? (canvasEl.width / canvasEl.clientWidth) : 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = 'bold 14px "Noto Serif", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lastLabelRects = {};
    var placedRects = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var sx = (it.x - cam.x) * s, sy = (it.y - cam.y) * s;
      var w = Math.ceil(ctx.measureText(it.text).width) + 16, h = 20;
      var placed = null;
      for (var o2 = 0; o2 < LABEL_OFFSETS.length; o2++) {
        var cx = sx - w / 2 + LABEL_OFFSETS[o2][0];
        var cy = sy - h / 2 + LABEL_OFFSETS[o2][1];
        if (cx < 2) cx = 2;
        if (cy < 2) cy = 2;
        if (cx + w > vw - 2) cx = vw - w - 2;
        if (cy + h > vh - 2) cy = vh - h - 2;
        var cand = { x: cx, y: cy, w: w, h: h };
        var bad = false;
        for (var oj = 0; oj < occ.length; oj++) { if (rectHit(cand, occ[oj])) { bad = true; break; } }
        if (!bad) {
          for (var op = 0; op < placedRects.length; op++) { if (rectHit(cand, placedRects[op])) { bad = true; break; } }
        }
        if (!bad) { placed = cand; break; }
      }
      lastLabelRects[it.key] = placed
        ? { x: Math.round(placed.x), y: Math.round(placed.y), w: w, h: h, drawn: true }
        : { x: Math.round(sx - w / 2), y: Math.round(sy - h / 2), w: w, h: h, drawn: false };
      if (!placed) continue;
      placedRects.push(placed);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,10,12,0.9)';
      ctx.strokeText(it.text, placed.x + w / 2, placed.y + h / 2);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(it.text, placed.x + w / 2, placed.y + h / 2);
    }
    ctx.restore();
  }

  // ==========================================================================
  // LƯỢT CHẠY (chỉ trong bộ nhớ — tải lại trang là hủy lượt)
  // ==========================================================================
  var run = null;
  var tickTimer = null;

  function getRun() {
    if (!run) return null;
    return {
      floor: run.floor, seed: run.seed,
      monsters: (run.monsters || []).length,
      cleared: !!run.cleared, portalOpen: !!run.portalOpen,
      dead: !!run.dead
    };
  }

  function spawnFloorMonsters() {
    var eng = getEngine();
    if (!eng || !run || !currentLayout) return [];
    var dg = eng.dungeon;
    if (!dg || !dg.spawn) return [];
    dg.clear();
    var floor = run.floor;
    var elem = floorElement(floor);
    var s = scaleFor(floor);
    var rnd = mulberry32(run.seed + floor * 7919 + 13);
    var created = [];
    var spawnOne = function (speciesId, x, y) {
      var m = dg.spawn(speciesId, x, y);
      if (!m) return null;
      applyScale(m, s);
      created.push(m);
      return m;
    };
    if (isBossFloor(floor)) {
      var bossId = VOHAN.BOSS_BY_ELEMENT[elem];
      var boss = spawnOne(bossId, currentLayout.exit.x, currentLayout.exit.y - 70);
      if (boss) boss.voHanBoss = true;
      for (var a = 0; a < 2; a++) {
        var spotA = currentLayout.monsterSpots[a % currentLayout.monsterSpots.length];
        if (!spotA) break;
        var rosterA = VOHAN.TRASH_BY_ELEMENT[elem];
        spawnOne(rosterA[a % rosterA.length], spotA.x + (rnd() - 0.5) * 14, spotA.y + (rnd() - 0.5) * 10);
      }
    } else {
      var count = monsterCount(floor);
      var roster = VOHAN.TRASH_BY_ELEMENT[elem];
      for (var i = 0; i < count; i++) {
        var spot = currentLayout.monsterSpots[i % currentLayout.monsterSpots.length];
        if (!spot) break;
        spawnOne(roster[i % roster.length], spot.x + (rnd() - 0.5) * 14, spot.y + (rnd() - 0.5) * 10);
      }
    }
    run.monsters = created;
    run.spawnPending = false;
    return created;
  }

  function recordClear(player, floor) {
    var st = ensureState(player);
    if (!st) return;
    st.bestFloor = Math.max(st.bestFloor || 0, floor);
  }

  function floorCleared() {
    var player = getPlayer();
    if (!run || !player) return;
    run.cleared = true;
    run.portalOpen = true;
    var floor = run.floor;
    recordClear(player, floor);
    var elem = floorElement(floor);
    var bonus = Math.min(VOHAN.CLEAR_TUVI_CAP, VOHAN.CLEAR_TUVI_BASE + VOHAN.CLEAR_TUVI_PER_FLOOR * floor);
    var gained = 0;
    var stApi = getStateAPI();
    // Thưởng qua tầng cộng thẳng qua addTuViCapped (trần mốc vẫn áp) —
    // KHÔNG qua bể farm ngày (đây là thưởng vượt tầng, không phải farm).
    if (stApi && stApi.addTuViCapped) gained = stApi.addTuViCapped(player, elem, bonus) || 0;
    else {
      if (!player.paths[elem]) player.paths[elem] = { tuVi: 0 };
      player.paths[elem].tuVi += bonus;
      gained = bonus;
    }
    toast('Dọn sạch tầng ' + floor + ' — +' + gained + ' tu vi ' + VOHAN.ELEMENT_NAME[elem] + '. Cổng tầng sau đã mở!');
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.spawnFloatingText) {
      window.GameEngine.spawnFloatingText('+' + gained + ' Tu vi ' + VOHAN.ELEMENT_NAME[elem], player.x, player.y - 50, '#ffe9a8');
    }
    currentPortalOpen = true;
    rebuildBgCanvas();
    save(player);
    updateHud();
  }

  function tick() {
    var eng = getEngine();
    if (!eng || !run) return;
    var player = eng.getPlayer();
    if (!player) return;
    if (run.spawnPending) return; // đang chờ map_switched để bày quái
    if (eng.getCurrentMapId() !== VOHAN.MAP_ID) { stopRun('map'); return; }

    // Chết trong bí cảnh: kết thúc lượt ngay; khi hồi sinh (hp > 0) mà còn
    // trong map bí cảnh thì đưa về Miếu Hoang (luật chết P2B không đụng).
    if (player.hp <= 0) {
      if (!run.dead) {
        run.dead = true;
        onDeathInDungeon();
      }
      return;
    }
    if (run.pendingExit) {
      run.pendingExit = false;
      var diedFloor = run.floor;
      eng.teleportTo('mieu_hoang');
      toast('Gục trong bí cảnh — trở về Miếu Hoang, mất tiến trình tầng ' + diedFloor + '.');
      return; // map_switched sẽ stopRun('map')
    }

    var dg = eng.dungeon;
    var list = dg && dg.getMonsters ? dg.getMonsters() : [];
    var alive = 0, bossAlive = false, now = Date.now();
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.hp <= 0 || m.state === 'dead') {
        if (!m._vhDeadAt) m._vhDeadAt = now;
        if (now - m._vhDeadAt >= RESPAWN_GUARD_MS) dg.remove(m);
      } else {
        alive++;
        if (m.isBoss) bossAlive = true;
      }
    }
    if (list.length === 0 && !run.cleared) {
      run.emptyTicks = (run.emptyTicks || 0) + 1;
      if (run.emptyTicks >= 3) {
        run.emptyTicks = 0;
        spawnFloorMonsters();
      }
      return;
    }
    run.emptyTicks = 0;
    if (!run.cleared) {
      if (isBossFloor(run.floor)) {
        if (!bossAlive && list.length > 0) floorCleared();
      } else if (alive === 0) {
        floorCleared();
      }
    }
  }

  function onDeathInDungeon() {
    var player = getPlayer();
    if (!run || !player) return;
    var floor = run.floor;
    var st = ensureState(player);
    st.bestFloor = Math.max(st.bestFloor || 0, floor);
    st.lastRun = { at: Date.now(), reachedFloor: floor, stoppedBy: 'death' };
    var eng = getEngine();
    if (eng && eng.dungeon && eng.dungeon.clear) eng.dungeon.clear();
    run.pendingExit = true;
    save(player);
  }

  function stopRun(reason) {
    var eng = getEngine();
    if (!run) { hideHud(); return { ok: true, reached: 0 }; }
    var reached = run.floor;
    if (eng && eng.dungeon && eng.dungeon.clear) eng.dungeon.clear();
    run = null;
    hideHud();
    if (reason === 'leave') {
      toast('Rời Bí Cảnh Vô Hạn tại tầng ' + reached + '.');
      if (eng && eng.teleportTo) eng.teleportTo('mieu_hoang');
    }
    return { ok: true, reached: reached };
  }

  function leaveDungeon() { return stopRun('leave'); }

  function advanceFloor() {
    if (!run) return { ok: false, reason: 'no_run' };
    var player = getPlayer();
    var eng = getEngine();
    if (!eng) return { ok: false, reason: 'no_engine' };
    run.floor++;
    run.cleared = false;
    run.portalOpen = false;
    run.openedChests = {};
    run.dead = false;
    run.pendingExit = false;
    run.spawnPending = true;
    var seed = run.seed + run.floor * 2654435761;
    var layout = generateFloorWithRetry(run.floor, seed);
    if (!layout) return { ok: false, reason: 'gen_failed' };
    if (!applyLayout(run.floor, layout, false)) return { ok: false, reason: 'apply_failed' };
    var st = ensureState(player);
    st.bestFloor = Math.max(st.bestFloor || 0, run.floor);
    save(player);
    eng.teleportTo(VOHAN.MAP_ID, layout.spawn.x, layout.spawn.y);
    updateHud();
    showBanner('Tầng ' + run.floor + ' · ' + VOHAN.ELEMENT_NAME[floorElement(run.floor)]);
    return { ok: true, floor: run.floor };
  }

  function onExitPortal() {
    if (!run) return { ok: false, reason: 'no_run' };
    if (!run.cleared) {
      toast('Cổng còn phong ấn — dọn sạch quái tầng này mới mở!');
      return { ok: false, reason: 'not_cleared' };
    }
    return advanceFloor();
  }

  function onChest(it) {
    if (!run || !it || !it.chestId) return { ok: false, reason: 'bad_chest' };
    if (run.openedChests[it.chestId]) {
      toast('Rương này đã mở rồi.');
      return { ok: false, reason: 'already_open' };
    }
    var player = getPlayer();
    if (!player) return { ok: false, reason: 'no_player' };
    run.openedChests[it.chestId] = true;
    var floor = run.floor;
    var lt = Math.min(VOHAN.CHEST_LT_CAP, VOHAN.CHEST_LT_BASE + VOHAN.CHEST_LT_PER_FLOOR * floor);
    player.linhThach = (player.linhThach || 0) + lt;
    var stApi = getStateAPI();
    if (stApi && stApi.addItemToBag) {
      try { stApi.addItemToBag(player, VOHAN.CHEST_HERB_ID, 1); } catch (e) {}
    }
    var map = getDungeonMap();
    if (map && map.interactables) {
      for (var i = 0; i < map.interactables.length; i++) {
        if (map.interactables[i].chestId === it.chestId) { map.interactables.splice(i, 1); break; }
      }
    }
    rebuildBgCanvas();
    toast('Mở rương: +' + lt + ' Linh Thạch, +1 Lá Thanh Tụy!');
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.spawnFloatingText) {
      window.GameEngine.spawnFloatingText('+' + lt + ' Linh Thạch', player.x, player.y - 50, '#e8c56b');
    }
    save(player);
    return { ok: true, linhThach: lt };
  }

  // ==========================================================================
  // VÀO BÍ CẢNH (từ Phong Ấn Bí Cảnh trên map Tông Môn)
  // ==========================================================================
  function enterDungeon() {
    var eng = getEngine();
    var player = getPlayer();
    if (!eng || !player) return { ok: false, msg: 'Chưa sẵn sàng.' };
    if (eng.getCurrentMapId() !== 'tong-mon') {
      toast('Phong Ấn Bí Cảnh nằm trong Tông Môn.');
      return { ok: false, msg: 'Sai bản đồ.' };
    }
    if (player.hp <= 0) {
      toast('Đang gục — không thể vào bí cảnh.');
      return { ok: false, msg: 'Đang gục.' };
    }
    if (run) {
      showHud();
      updateHud();
      toast('Đang trong Bí Cảnh Vô Hạn — tầng ' + run.floor + '.');
      return { ok: true, resumed: true, floor: run.floor };
    }
    closeEntry();
    var st = ensureState(player);
    st.totalRuns = (st.totalRuns || 0) + 1;
    var seed = ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 100000)) >>> 0;
    run = {
      floor: 1, seed: seed, startedAt: Date.now(),
      monsters: [], cleared: false, portalOpen: false,
      openedChests: {}, spawnPending: true, dead: false, pendingExit: false
    };
    var layout = generateFloorWithRetry(1, seed);
    if (!layout) { run = null; return { ok: false, msg: 'Sinh map thất bại.' }; }
    if (!applyLayout(1, layout, false)) { run = null; return { ok: false, msg: 'Áp map thất bại.' }; }
    st.bestFloor = Math.max(st.bestFloor || 0, 1);
    save(player);
    eng.teleportTo(VOHAN.MAP_ID, layout.spawn.x, layout.spawn.y);
    showHud();
    updateHud();
    showBanner('Tầng 1 · ' + VOHAN.ELEMENT_NAME[floorElement(1)]);
    return { ok: true, floor: 1 };
  }

  // ==========================================================================
  // GIAO DIỆN: HUD trong bí cảnh + modal vào bí cảnh
  // ==========================================================================
  var hudEl = null, hudFloorEl = null, hudElemEl = null, hudBadgeEl = null, hudLeaveBtn = null;
  var entryEl = null, entryBodyEl = null;

  // Banner vào tầng (V2): thay toast vào tầng — toast chung nằm top 60px
  // giữa màn hình nên @390 đè cả minimap lẫn nút zoom. Banner này là chữ
  // ngắn ("Tầng N · Hệ"), neo cột phải dưới HUD (top 410px), không chạm
  // minimap/zoom/nút Rời/vòng skill, tự ẩn 2,5s.
  var bannerEl = null, bannerTimer = null;
  function showBanner(text) {
    if (typeof document === 'undefined') return;
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'vohan-banner';
      bannerEl.style.cssText = 'position:fixed;top:410px;right:10px;z-index:40;pointer-events:none;display:none;' +
        'max-width:130px;padding:6px 12px;border:1px solid #c9a227;border-radius:14px;' +
        'background:rgba(24,30,24,0.95);color:#f4e6c2;font-size:13px;font-weight:700;text-align:center;line-height:1.4;';
      document.body.appendChild(bannerEl);
    }
    bannerEl.textContent = text;
    bannerEl.style.display = 'block';
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { if (bannerEl) bannerEl.style.display = 'none'; }, 2500);
  }

  function buildHud() {
    if (typeof document === 'undefined' || hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'vohan-hud';
    hudEl.className = 'panel hud-panel hidden';
    hudEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:45;' +
      'display:none;align-items:center;gap:10px;padding:6px 12px;pointer-events:auto;' +
      'flex-wrap:nowrap;max-width:calc(100vw - 16px);';
    var badge = document.createElement('span');
    badge.textContent = 'BÍ CẢNH VÔ HẠN';
    badge.style.cssText = 'font-size:11px;letter-spacing:1px;color:#c9a55a;font-weight:700;white-space:nowrap;';
    hudBadgeEl = badge;
    hudFloorEl = document.createElement('span');
    hudFloorEl.id = 'vohan-hud-floor';
    hudFloorEl.style.cssText = 'font-size:14px;font-weight:700;color:#f4e6c2;white-space:nowrap;';
    hudElemEl = document.createElement('span');
    hudElemEl.id = 'vohan-hud-element';
    hudElemEl.style.cssText = 'font-size:12px;color:#9fd4ff;white-space:nowrap;';
    var leaveBtn = document.createElement('button');
    leaveBtn.type = 'button';
    leaveBtn.id = 'btn-vohan-leave';
    leaveBtn.className = 'btn wood';
    leaveBtn.style.cssText = 'font-size:12px;padding:4px 10px;white-space:nowrap;';
    leaveBtn.textContent = 'Rời Bí Cảnh';
    leaveBtn.addEventListener('click', function () { leaveDungeon(); });
    hudLeaveBtn = leaveBtn;
    hudEl.appendChild(badge);
    hudEl.appendChild(hudFloorEl);
    hudEl.appendChild(hudElemEl);
    hudEl.appendChild(leaveBtn);
    document.body.appendChild(hudEl);
  }
  // HUD điện thoại V2 (đo @390): dải trên y6–132 đã kín (panel nhân vật
  // x17–273 + minimap x246–384) và cột phải y135–293 là nút zoom + toolbar
  // — HUD cũ top 96px đè cả minimap lẫn nhãn tên map. HUD mới xếp dọc ở
  // cột phải dưới toolbar (top 300px, phải 10px; khe y300–650 trống).
  function layoutHud() {
    if (!hudEl) return;
    var phone = (typeof window !== 'undefined' && window.innerWidth <= 640);
    if (phone) {
      hudEl.style.top = '300px';
      hudEl.style.left = 'auto';
      hudEl.style.right = '10px';
      hudEl.style.transform = 'none';
      hudEl.style.padding = '6px 8px';
      hudEl.style.gap = '4px';
      hudEl.style.flexDirection = 'column';
      hudEl.style.alignItems = 'center';
      if (hudBadgeEl) hudBadgeEl.style.display = 'none';
      if (hudLeaveBtn) {
        hudLeaveBtn.textContent = 'Rời';
        hudLeaveBtn.style.minHeight = '28px';
        hudLeaveBtn.style.height = '28px';
        hudLeaveBtn.style.lineHeight = '28px';
        hudLeaveBtn.style.padding = '0 10px';
      }
    } else {
      hudEl.style.top = '10px';
      hudEl.style.left = '50%';
      hudEl.style.right = 'auto';
      hudEl.style.transform = 'translateX(-50%)';
      hudEl.style.padding = '6px 12px';
      hudEl.style.gap = '10px';
      hudEl.style.flexDirection = '';
      hudEl.style.alignItems = '';
      if (hudBadgeEl) hudBadgeEl.style.display = '';
      if (hudLeaveBtn) {
        hudLeaveBtn.textContent = 'Rời Bí Cảnh';
        hudLeaveBtn.style.minHeight = '';
        hudLeaveBtn.style.height = '';
        hudLeaveBtn.style.lineHeight = '';
        hudLeaveBtn.style.padding = '';
      }
    }
  }
  function showHud() {
    buildHud();
    if (!hudEl) return;
    layoutHud();
    hudEl.classList.remove('hidden');
    hudEl.style.display = 'flex';
  }
  function hideHud() {
    if (!hudEl) return;
    hudEl.classList.add('hidden');
    hudEl.style.display = 'none';
  }
  function updateHud() {
    if (!run || !hudFloorEl) return;
    hudFloorEl.textContent = 'Tầng ' + run.floor;
    if (hudElemEl) {
      var elem = floorElement(run.floor);
      hudElemEl.textContent = (isBossFloor(run.floor) ? 'BOSS · ' : '') + (VOHAN.ELEMENT_NAME[elem] || '');
    }
  }

  function buildEntryModal() {
    if (typeof document === 'undefined' || entryEl) return;
    entryEl = document.createElement('div');
    entryEl.id = 'vohan-entry-modal';
    entryEl.className = 'modal-overlay hidden';
    var box = document.createElement('div');
    box.className = 'panel modal-box';
    var header = document.createElement('div');
    header.className = 'modal-header';
    var title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = 'BÍ CẢNH VÔ HẠN';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () { closeEntry(); });
    header.appendChild(title);
    header.appendChild(closeBtn);
    entryBodyEl = document.createElement('div');
    entryBodyEl.id = 'vohan-entry-body';
    entryBodyEl.style.cssText = 'padding:6px 4px 2px;font-size:13px;line-height:1.9;';
    var actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.style.marginTop = '14px';
    var startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.id = 'btn-vohan-enter';
    startBtn.className = 'btn btn-main';
    startBtn.textContent = 'Vào Bí Cảnh';
    startBtn.addEventListener('click', function () { enterDungeon(); });
    var closeBottom = document.createElement('button');
    closeBottom.type = 'button';
    closeBottom.className = 'btn wood';
    closeBottom.textContent = 'Đóng';
    closeBottom.addEventListener('click', function () { closeEntry(); });
    actions.appendChild(startBtn);
    actions.appendChild(closeBottom);
    box.appendChild(header);
    box.appendChild(entryBodyEl);
    box.appendChild(actions);
    entryEl.appendChild(box);
    entryEl.addEventListener('click', function (e) { if (e.target === entryEl) closeEntry(); });
    document.body.appendChild(entryEl);
  }
  function renderEntry() {
    var player = getPlayer();
    if (!player || !entryBodyEl) return;
    var st = ensureState(player);
    var row = function (label, value, cls) {
      return '<div style="display:flex;justify-content:space-between;gap:14px;border-bottom:1px dashed rgba(200,180,120,.18);">' +
        '<span style="color:#bfae86;">' + label + '</span>' +
        '<b style="color:' + (cls || '#f4e6c2') + ';">' + value + '</b></div>';
    };
    var html = '';
    html += row('Kỷ lục tầng sâu nhất', '' + (st.bestFloor || 0), '#ffe9a8');
    html += row('Số lần đã vào', '' + (st.totalRuns || 0));
    html += '<div style="margin-top:8px;color:#cbbd97;font-size:12px;line-height:1.8;">' +
      'Mỗi tầng là một map sinh ngẫu nhiên — không tầng nào giống tầng nào.<br>' +
      'Dọn sạch quái tầng này để mở Cổng Tầng Sau. Quái càng sâu càng mạnh, thưởng càng tốt.<br>' +
      'Chết trong bí cảnh: trở về Miếu Hoang, mất tiến trình tầng hiện tại.</div>';
    entryBodyEl.innerHTML = html;
  }
  function openEntry() {
    var eng = getEngine();
    var player = getPlayer();
    if (!eng || !player) return { ok: false };
    if (run) {
      toast('Đang trong Bí Cảnh Vô Hạn — tầng ' + run.floor + '.');
      return { ok: true, resumed: true };
    }
    buildEntryModal();
    renderEntry();
    if (!entryEl) return { ok: false };
    entryEl.classList.remove('hidden');
    return { ok: true };
  }
  function closeEntry() {
    if (!entryEl) return;
    entryEl.classList.add('hidden');
  }

  // ==========================================================================
  // KHỞI ĐỘNG
  // ==========================================================================
  function init() {
    if (typeof window === 'undefined') return;
    preloadDungeonImages();
    buildHud();
    buildEntryModal();
    window.addEventListener('map_switched', function () {
      var eng = getEngine();
      if (!eng) return;
      var mid = eng.getCurrentMapId ? eng.getCurrentMapId() : null;
      if (run && mid === VOHAN.MAP_ID && run.spawnPending) {
        spawnFloorMonsters();
      } else if (run && mid !== VOHAN.MAP_ID) {
        stopRun('map');
      }
    });
    if (!tickTimer) tickTimer = setInterval(tick, TICK_MS);
    window.addEventListener('resize', function () { layoutHud(); });
  }

  exports.VOHAN = VOHAN;
  exports.ensureState = ensureState;
  exports.floorElement = floorElement;
  exports.isBossFloor = isBossFloor;
  exports.monsterCount = monsterCount;
  exports.scaleFor = scaleFor;
  exports.applyScale = applyScale;
  exports.generateFloor = generateFloor;
  exports.generateFloorWithRetry = generateFloorWithRetry;
  exports.genStats = genStats;
  exports.layoutConnected = layoutConnected;
  exports.isWalkablePx = function (x, y) { return currentLayout ? isWalkablePx(currentLayout, x, y) : false; };
  exports.getLayout = function () { return currentLayout; };
  exports.getDungeonMap = getDungeonMap;
  exports.drawBackground = drawBackground;
  exports.enterDungeon = enterDungeon;
  exports.leaveDungeon = leaveDungeon;
  exports.openEntry = openEntry;
  exports.closeEntry = closeEntry;
  exports.onExitPortal = onExitPortal;
  exports.onChest = onChest;
  exports.advanceFloor = advanceFloor;
  exports.getRun = getRun;
  exports.tick = tick;
  exports._labelRects = function () { return lastLabelRects; };
  exports._imgsReady = function () { return imgsReady; };

  init();
})(typeof window !== 'undefined' ? (window.GameVoHan = {}) : (module.exports = {}));
