/**
 * Đợt P2C — THÁP THÍ LUYỆN (P2-DESIGN §3; hồ sơ 15§2, 22)
 *
 * Tháp leo tầng không đỉnh tại khu `thap_tu_luyen` (map Tông Môn). Mỗi tầng là
 * MỘT đợt quái trong sân tháp, dùng quái + steering HIỆN CÓ của monsters.js,
 * KHÔNG vẽ quái mới. Cứ 10 tầng một boss nhỏ dùng boss HIỆN CÓ theo hệ của tầng.
 *
 * Ràng buộc đợt này:
 *  - KHÔNG sửa `rollDrops` / bảng rơi. Thưởng tháp cộng qua ĐƯỜNG RIÊNG
 *    (`awardBossFloor`) sau khi hạ boss tầng: đọc bảng rơi hiện có để biết vật
 *    phẩm, rồi cộng bằng `GameState.addItemToBag`.
 *  - KHÔNG đụng luật chết/hồi sinh: module chỉ QUAN SÁT `player.hp <= 0` ở
 *    nhịp riêng rồi dừng lượt leo; engine/P2B vẫn là nơi xử lý chết.
 *  - Danh hiệu thuộc P2F: module chỉ GHI mốc tầng đã đạt vào
 *    `player.thapTuLuyen.milestones` để P2F đọc.
 *
 * Mọi số cân bằng dưới đây là PROVISIONAL (đợt P2C đề xuất, chờ Bui phán) —
 * xem P2C-REPORT.md trong cây làm việc.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ (PROVISIONAL trừ khi ghi "HỒ SƠ")
  // ==========================================================================

  // HỒ SƠ: cứ 10 tầng một boss nhỏ.
  var BOSS_EVERY = 10;

  // Mỗi chục tầng là một "cánh" một hệ, đi từ yếu tới mạnh theo đúng thứ tự
  // vùng đất trong game (Rừng Độc Mộc -> Hồ Băng Thủy -> Mỏ Lửa Hỏa -> Hoang
  // Mạc Thổ -> Kiếm Trủng Kim). Nhờ vậy boss tầng 10/20/30/40/50 lần lượt là
  // 5 boss hiện có khác nhau, không lặp cùng một hệ.
  var ELEMENTS = ['moc', 'thuy', 'hoa', 'tho', 'kim'];
  var ELEMENT_NAME = { moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', kim: 'Kim' };

  // Quái thường HIỆN CÓ theo hệ (không bịa loài mới). Mỗi hệ lấy loài không
  // tinh anh để đợt quái còn đánh nổi; riêng hệ Mộc có 2 loài để đa dạng.
  var TRASH_BY_ELEMENT = {
    moc: ['thao_tinh', 'nhen_xanh'],
    thuy: ['bang_tinh'],
    hoa: ['hoa_thu'],
    tho: ['sa_trung'],
    kim: ['kiem_linh']
  };
  // Loài tinh anh HIỆN CÓ của hệ — chỉ dùng để đọc `gearPool` trong bảng rơi
  // hiện có khi thưởng trang bị ở tầng boss, KHÔNG spawn làm quái thường.
  var ELITE_BY_ELEMENT = {
    moc: 'co_thu_yeu',
    thuy: 'han_xa',
    hoa: 'diem_ma',
    tho: 'sa_tuong',
    kim: 'thiet_giap'
  };
  // Boss HIỆN CÓ theo hệ (không bịa boss mới).
  var BOSS_BY_ELEMENT = {
    moc: 'boss_moc_linh_co_vuong',
    thuy: 'boss_han_kinh_giao_vuong',
    hoa: 'boss_xich_diem_viem_quan',
    tho: 'boss_hoang_sa_co_vuong',
    kim: 'boss_tan_kiem_vo_danh'
  };

  // Sân tháp: các điểm spawn đã kiểm đi được trên lưới va chạm Tông Môn
  // (mapdata.js buildGrid), nằm trong sân trước cửa tháp, tránh baseRect tháp
  // (1635,795,210x55) và vách đá đông.
  var ARENA_SLOTS = [
    { x: 1520, y: 880 }, { x: 1560, y: 895 }, { x: 1600, y: 900 },
    { x: 1640, y: 895 }, { x: 1680, y: 888 }, { x: 1520, y: 845 },
    { x: 1560, y: 860 }, { x: 1640, y: 860 }, { x: 1690, y: 850 },
    { x: 1480, y: 895 }
  ];
  var BOSS_SPOT = { x: 1605, y: 862 };
  var DOOR_SPOT = { x: 1740, y: 875 };
  var TOWER_MAP_ID = 'tong-mon';

  // Hệ số mạnh dần theo tầng — PROVISIONAL. Lý do chọn: HP tăng 18%/tầng (đủ
  // nặng nhưng không thành "tường máu" sau vài chục tầng, trần ×6 ở tầng 29),
  // sát thương tăng 8%/tầng (trần ×3 ở tầng 26) để người chơi còn sống sót khi
  // leo, giáp cộng phẳng 1 mỗi ~20 tầng (trần +10) cho cảm giác "quái cứng hơn".
  var SCALE = { hpPer: 0.18, hpCap: 6.0, dmgPer: 0.08, dmgCap: 3.0, armorPer: 0.05, armorCap: 10 };

  // Mốc tầng để P2F gắn danh hiệu — PROVISIONAL: module chỉ ghi mốc, P2F chọn
  // danh hiệu/tên. Danh sách này KHÔNG phải hệ danh hiệu.
  var TITLE_MILESTONES = [10, 20, 30, 40, 50, 75, 100];

  var TAG = 'thap_tu_luyen_p2c';
  var RESPAWN_GUARD_MS = 900; // giữ xác quái ~0,9s cho khớp diễn hoạt chết
  var NEXT_FLOOR_DELAY_MS = 1200;

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
    try { return require('./monsters.js'); } catch (e) { return null; }
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
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Khóa tuần = ngày thứ Hai (giờ máy) của tuần đang sống, dạng YYYY-MM-DD.
  // Dùng NGÀY THẬT, cùng tinh thần `dailyCompletions` (state.js) nhưng theo
  // tuần: sang thứ Hai 00:00 khóa đổi -> bảng tuần tự đặt lại.
  function weekKey(ms) {
    var d = new Date(ms === undefined ? Date.now() : ms);
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = (t.getDay() + 6) % 7; // 0 = thứ Hai
    t.setDate(t.getDate() - dow);
    return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
  }

  function ensureState(player) {
    if (!player) return null;
    if (!player.thapTuLuyen || typeof player.thapTuLuyen !== 'object') {
      player.thapTuLuyen = { bestFloor: 0, climbs: 0, milestones: {}, week: { key: weekKey(), bestFloor: 0 } };
    }
    var st = player.thapTuLuyen;
    if (typeof st.bestFloor !== 'number' || !isFinite(st.bestFloor)) st.bestFloor = 0;
    if (typeof st.climbs !== 'number' || !isFinite(st.climbs)) st.climbs = 0;
    if (!st.milestones || typeof st.milestones !== 'object') st.milestones = {};
    if (!st.week || typeof st.week !== 'object') st.week = { key: weekKey(), bestFloor: 0 };
    if (typeof st.week.bestFloor !== 'number' || !isFinite(st.week.bestFloor)) st.week.bestFloor = 0;
    // Đặt lại bảng tuần khi sang tuần mới (kỷ lục cá nhân `bestFloor` giữ nguyên).
    if (st.week.key !== weekKey()) st.week = { key: weekKey(), bestFloor: 0 };
    return st;
  }

  // ==========================================================================
  // BẬC THANG / HỆ SỐ
  // ==========================================================================
  function floorElement(floor) {
    var f = Math.max(1, Math.floor(floor || 1));
    return ELEMENTS[Math.floor((f - 1) / BOSS_EVERY) % ELEMENTS.length];
  }
  function isBossFloor(floor) {
    return Math.max(1, Math.floor(floor || 1)) % BOSS_EVERY === 0;
  }
  function waveSize(floor) {
    // PROVISIONAL: 2 quái ở tầng 1-5, +1 mỗi 5 tầng, trần 6.
    return Math.min(6, 2 + Math.floor((Math.max(1, Math.floor(floor)) - 1) / 5));
  }
  function scaleFor(floor) {
    var f = Math.max(1, Math.floor(floor || 1));
    return {
      hp: Math.min(SCALE.hpCap, 1 + SCALE.hpPer * (f - 1)),
      dmg: Math.min(SCALE.dmgCap, 1 + SCALE.dmgPer * (f - 1)),
      armorAdd: Math.min(SCALE.armorCap, Math.floor(SCALE.armorPer * (f - 1)))
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
  // PRNG có hạt giống để một tầng luôn bày quái giống nhau (chạy lại được).
  function seeded(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ==========================================================================
  // LƯỢT LEO (chỉ trong bộ nhớ — tải lại trang là hủy lượt leo)
  // ==========================================================================
  var run = null;
  var tickTimer = null;

  function getRun() {
    return run ? { floor: run.floor, startedAt: run.startedAt, monsters: (run.monsters || []).length, transitioning: !!run.transition } : null;
  }

  function spawnWave() {
    var eng = getEngine();
    var player = getPlayer();
    if (!eng || !player || !run) return [];
    var tower = eng.tower;
    if (!tower || !tower.spawn) return [];
    tower.clear();

    var floor = run.floor;
    var elem = floorElement(floor);
    var s = scaleFor(floor);
    var rnd = seeded(floor * 7919 + 13);
    var created = [];
    var slotIndex = 0;
    var nextSlot = function () {
      var base = ARENA_SLOTS[slotIndex % ARENA_SLOTS.length];
      slotIndex++;
      return {
        x: base.x + (rnd() - 0.5) * 14,
        y: base.y + (rnd() - 0.5) * 10
      };
    };

    if (isBossFloor(floor)) {
      // HỒ SƠ: boss nhỏ mỗi 10 tầng, dùng boss HIỆN CÓ theo hệ của tầng.
      var bossId = BOSS_BY_ELEMENT[elem];
      var boss = tower.spawn(bossId, BOSS_SPOT.x, BOSS_SPOT.y);
      if (boss) {
        applyScale(boss, s);
        boss.towerTag = TAG;
        created.push(boss);
      }
      // Hai quái kèm cho boss đỡ "đơn điệu" — PROVISIONAL, vẫn là quái hiện có.
      var adds = 2;
      for (var a = 0; a < adds; a++) {
        var spotA = nextSlot();
        var rosterA = TRASH_BY_ELEMENT[elem];
        var addId = rosterA[a % rosterA.length];
        var addM = tower.spawn(addId, spotA.x, spotA.y);
        if (addM) {
          applyScale(addM, s);
          addM.towerTag = TAG;
          created.push(addM);
        }
      }
    } else {
      var count = waveSize(floor);
      var roster = TRASH_BY_ELEMENT[elem];
      for (var i = 0; i < count; i++) {
        var spot = nextSlot();
        var speciesId = roster[i % roster.length];
        var m = tower.spawn(speciesId, spot.x, spot.y);
        if (m) {
          applyScale(m, s);
          m.towerTag = TAG;
          created.push(m);
        }
      }
    }

    run.monsters = created;
    run.transition = false;
    return created;
  }

  function recordClear(player, floor) {
    var st = ensureState(player);
    if (!st) return null;
    st.week.bestFloor = Math.max(st.week.bestFloor || 0, floor);
    st.bestFloor = Math.max(st.bestFloor || 0, floor);
    var hit = null;
    for (var i = 0; i < TITLE_MILESTONES.length; i++) {
      var mark = TITLE_MILESTONES[i];
      if (floor >= mark && !st.milestones[mark]) {
        st.milestones[mark] = Date.now();
        hit = mark; // mốc cao nhất vừa mở trong lần này
      }
    }
    return hit;
  }

  // ĐƯỜNG THƯỞNG RIÊNG (CẤM SỬA rollDrops): đọc BẢNG RƠI HIỆN CÓ của boss
  // (và gearPool của loài tinh anh cùng hệ) rồi cộng thẳng vào túi.
  function awardBossFloor(player, floor) {
    var mon = getMonstersAPI();
    var stateAPI = getStateAPI();
    if (!mon || !stateAPI || !player) return { ok: false, items: [] };
    var elem = floorElement(floor);
    var bossId = BOSS_BY_ELEMENT[elem];
    var spec = mon.SPECIES[bossId];
    if (!spec || !spec.dropTable) return { ok: false, items: [] };

    var gained = [];
    var addItem = function (id, count) {
      if (!id || !count) return;
      stateAPI.addItemToBag(player, id, count);
      gained.push({ id: id, count: count });
    };

    // 1. Nguyên liệu hiếm: mục isMaterial có tỉ lệ thấp nhất trong bảng rơi
    //    của chính boss (mỗi boss hiện có đúng một mục ~15%).
    var rare = null;
    for (var i = 0; i < spec.dropTable.length; i++) {
      var e = spec.dropTable[i];
      if (e && e.isMaterial && e.chance <= 0.2) {
        if (!rare || e.chance < rare.chance) rare = e;
      }
    }
    if (rare) addItem(rare.id, Math.max(1, rare.min || 1));

    // 2. Trang bị: lấy gearPool HIỆN CÓ của loài tinh anh cùng hệ (bảng rơi
    //    hiện có), chọn 1 món theo hạt giống tầng. Hồ sơ ghi "trang bị tịch"
    //    nhưng mã hiện KHÔNG có vật phẩm bí tịch -> không bịa, xem báo cáo.
    var eliteId = ELITE_BY_ELEMENT[elem];
    var eliteSpec = mon.SPECIES[eliteId];
    var gearPool = null;
    if (eliteSpec && eliteSpec.dropTable) {
      for (var g = 0; g < eliteSpec.dropTable.length; g++) {
        var ge = eliteSpec.dropTable[g];
        if (ge && ge.gearPool && ge.gearPool.length) { gearPool = ge.gearPool; break; }
      }
    }
    if (gearPool && gearPool.length) {
      var rnd = seeded(floor * 104729 + 7);
      addItem(gearPool[Math.floor(rnd() * gearPool.length) % gearPool.length], 1);
    }

    // 3. Linh Thạch thưởng tháp: đúng khoảng min-max của mục linh-thach trong
    //    bảng rơi boss (không bịa số mới).
    var linhRange = null;
    for (var l = 0; l < spec.dropTable.length; l++) {
      var le = spec.dropTable[l];
      if (le && le.id === 'linh-thach') { linhRange = le; break; }
    }
    if (linhRange) {
      var min = linhRange.min || 1;
      var max = linhRange.max || min;
      var amount = min + Math.floor(Math.random() * (max - min + 1));
      player.linhThach = (player.linhThach || 0) + amount;
      gained.push({ id: 'linh-thach', count: amount });
    }

    return { ok: true, items: gained, bossId: bossId, element: elem };
  }

  function floorCleared(runRef) {
    var player = getPlayer();
    if (!runRef || !player) return;
    runRef.transition = true;
    var cleared = runRef.floor;
    var milestone = recordClear(player, cleared);

    var msgs = [];
    if (isBossFloor(cleared)) {
      var award = awardBossFloor(player, cleared);
      if (award.ok) {
        var names = [];
        var mon = getMonstersAPI();
        for (var i = 0; i < award.items.length; i++) {
          var it = award.items[i];
          var def = mon && mon.ITEM_DEFS ? mon.ITEM_DEFS[it.id] : null;
          names.push('+' + it.count + ' ' + (def ? def.name : it.id));
        }
        msgs.push('Hạ boss tầng ' + cleared + ' (' + (ELEMENT_NAME[floorElement(cleared)] || '') + ')');
        if (names.length) msgs.push('Thưởng tháp: ' + names.join(', '));
      }
    }
    if (milestone) {
      msgs.push('Mốc tầng ' + milestone + ' đã ghi cho danh hiệu (P2F)');
    }
    toast('Tầng ' + cleared + ' hoàn thành' + (msgs.length ? ' — ' + msgs.join(' · ') : ''));
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.spawnFloatingText) {
      window.GameEngine.spawnFloatingText('Tầng ' + cleared + ' hoàn thành', player.x, player.y - 50, '#ffe9a8');
    }
    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) {
      // âm thanh hiện có; module audio của engine đã có playChime qua GameAudio (nếu có)
      try { window.GameAudio.playChime(); } catch (e) {}
    }
    save(player);
    updateHud();

    setTimeout(function () {
      if (!run || run !== runRef) return;
      run.floor = cleared + 1;
      run.transition = false;
      spawnWave();
      updateHud();
      toast('Tháp Tu Luyện — Tầng ' + run.floor + ' (' + ELEMENT_NAME[floorElement(run.floor)] + ')');
    }, NEXT_FLOOR_DELAY_MS);
  }

  function tick() {
    var eng = getEngine();
    if (!eng || !run) return;
    var player = eng.getPlayer();
    if (!player) return;

    if (eng.getCurrentMapId() !== TOWER_MAP_ID) { stopRun('map'); return; }
    // Chỉ QUAN SÁT máu; luật chết/hồi sinh vẫn do engine/P2B xử lý.
    if (player.hp <= 0) { stopRun('death'); return; }

    var tower = eng.tower;
    var list = tower && tower.getMonsters ? tower.getMonsters() : [];
    var alive = 0;
    var bossAlive = false;
    var now = Date.now();
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.hp <= 0 || m.state === 'dead') {
        if (!m._p2cDeadAt) m._p2cDeadAt = now;
        if (now - m._p2cDeadAt >= RESPAWN_GUARD_MS) tower.remove(m);
      } else {
        alive++;
        if (m.isBoss) bossAlive = true;
      }
    }
    // Đợt quái rỗng bất thường (spawn lỗi): thử bày lại sau vài nhịp.
    if (list.length === 0) {
      run.emptyTicks = (run.emptyTicks || 0) + 1;
      if (run.emptyTicks >= 3 && !run.transition) {
        run.emptyTicks = 0;
        spawnWave();
      }
      return;
    }
    run.emptyTicks = 0;
    // Tầng boss: hạ boss là qua tầng (quái kèm còn sống do chiêu triệu hồi của
    // boss hiện có sẽ bị dọn khi sang tầng mới). Tầng thường: hết quái mới qua.
    if (!run.transition) {
      if (isBossFloor(run.floor)) {
        if (!bossAlive && list.length > 0) floorCleared(run);
      } else if (alive === 0) {
        floorCleared(run);
      }
    }
  }

  // ==========================================================================
  // VÀO / RỜI THÁP
  // ==========================================================================
  function enterTower() {
    var eng = getEngine();
    var player = getPlayer();
    if (!eng || !player) return { ok: false, msg: 'Chưa sẵn sàng.' };
    if (eng.getCurrentMapId() !== TOWER_MAP_ID) {
      toast('Tháp Tu Luyện nằm trong Tông Môn.');
      return { ok: false, msg: 'Sai bản đồ.' };
    }
    if (player.hp <= 0) {
      toast('Đang gục — không thể leo tháp.');
      return { ok: false, msg: 'Đang gục.' };
    }
    if (run) {
      showHud();
      updateHud();
      toast('Đang leo tháp — tầng ' + run.floor + '.');
      return { ok: true, resumed: true, floor: run.floor };
    }
    var st = ensureState(player);
    st.climbs = (st.climbs || 0) + 1;
    run = { floor: 1, startedAt: Date.now(), transition: false, monsters: [] };
    spawnWave();
    showHud();
    updateHud();
    toast('Vào Tháp Tu Luyện — Tầng 1 (' + ELEMENT_NAME[floorElement(1)] + ')');
    save(player);
    return { ok: true, floor: 1 };
  }

  function stopRun(reason) {
    var eng = getEngine();
    var player = getPlayer();
    if (!run) { hideHud(); return; }
    var reached = Math.max(1, run.floor) - 1; // số tầng đã vượt qua
    var floorAtStop = run.floor;
    run = null;
    if (eng && eng.tower && eng.tower.clear) eng.tower.clear();
    hideHud();
    if (player) {
      var st = ensureState(player);
      st.lastRun = { at: Date.now(), reachedFloor: reached, stoppedBy: reason };
      save(player);
      if (reason === 'death') {
        toast('Gục trong tháp — dừng ở tầng ' + reached + ' (cao nhất tuần: ' + (st.week.bestFloor || 0) + ').');
      } else if (reason === 'leave') {
        toast('Rời tháp tại tầng ' + floorAtStop + ' — tầng cao nhất tuần: ' + (st.week.bestFloor || 0) + '.');
      }
    }
    if (reason === 'leave' && eng && eng.teleportTo) {
      eng.teleportTo(TOWER_MAP_ID, DOOR_SPOT.x, DOOR_SPOT.y);
    }
    return { ok: true, reached: reached };
  }

  function leaveTower() {
    return stopRun('leave');
  }

  // ==========================================================================
  // GIAO DIỆN TỐI THIỂU: HUD trong tháp + bảng tuần ở cửa tháp
  // ==========================================================================
  var hudEl = null, hudFloorEl = null, hudElemEl = null;
  var boardEl = null, boardBodyEl = null;

  function buildHud() {
    if (typeof document === 'undefined' || hudEl) return;
    hudEl = document.createElement('div');
    hudEl.id = 'tower-hud';
    hudEl.className = 'panel hud-panel hidden';
    hudEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:45;' +
      'display:none;align-items:center;gap:10px;padding:6px 12px;pointer-events:auto;';

    var badge = document.createElement('span');
    badge.textContent = 'THÁP TU LUYỆN';
    badge.style.cssText = 'font-size:11px;letter-spacing:1px;color:#c9a55a;font-weight:700;';

    hudFloorEl = document.createElement('span');
    hudFloorEl.id = 'tower-hud-floor';
    hudFloorEl.style.cssText = 'font-size:14px;font-weight:700;color:#f4e6c2;';

    hudElemEl = document.createElement('span');
    hudElemEl.id = 'tower-hud-element';
    hudElemEl.style.cssText = 'font-size:12px;color:#9fd4ff;';

    var leaveBtn = document.createElement('button');
    leaveBtn.type = 'button';
    leaveBtn.id = 'btn-tower-leave';
    leaveBtn.className = 'btn wood';
    leaveBtn.style.cssText = 'font-size:12px;padding:4px 10px;';
    leaveBtn.textContent = 'Rời Tháp';
    leaveBtn.addEventListener('click', function () { leaveTower(); });

    hudEl.appendChild(badge);
    hudEl.appendChild(hudFloorEl);
    hudEl.appendChild(hudElemEl);
    hudEl.appendChild(leaveBtn);
    document.body.appendChild(hudEl);
  }

  function showHud() {
    buildHud();
    if (!hudEl) return;
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
      hudElemEl.textContent = (isBossFloor(run.floor) ? 'BOSS · ' : '') + (ELEMENT_NAME[elem] || '');
    }
  }

  function buildBoard() {
    if (typeof document === 'undefined' || boardEl) return;
    boardEl = document.createElement('div');
    boardEl.id = 'tower-board-modal';
    boardEl.className = 'modal-overlay hidden';

    var box = document.createElement('div');
    box.className = 'panel modal-box';

    var header = document.createElement('div');
    header.className = 'modal-header';
    var title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = 'BẢNG LEO THÁP TUẦN';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () { closeBoard(); });
    header.appendChild(title);
    header.appendChild(closeBtn);

    boardBodyEl = document.createElement('div');
    boardBodyEl.id = 'tower-board-body';
    boardBodyEl.style.cssText = 'padding:6px 4px 2px;font-size:13px;line-height:1.9;';

    var actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.style.marginTop = '14px';
    var startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'btn btn-main';
    startBtn.textContent = 'Vào Tháp';
    startBtn.addEventListener('click', function () {
      closeBoard();
      enterTower();
    });
    var closeBottom = document.createElement('button');
    closeBottom.type = 'button';
    closeBottom.className = 'btn wood';
    closeBottom.textContent = 'Đóng';
    closeBottom.addEventListener('click', function () { closeBoard(); });
    actions.appendChild(startBtn);
    actions.appendChild(closeBottom);

    box.appendChild(header);
    box.appendChild(boardBodyEl);
    box.appendChild(actions);
    boardEl.appendChild(box);
    boardEl.addEventListener('click', function (e) { if (e.target === boardEl) closeBoard(); });
    document.body.appendChild(boardEl);
  }

  function renderBoard() {
    var player = getPlayer();
    if (!player || !boardBodyEl) return;
    var st = ensureState(player);
    var mon = getMonstersAPI();
    var marks = [];
    for (var i = 0; i < TITLE_MILESTONES.length; i++) {
      var mark = TITLE_MILESTONES[i];
      marks.push(mark + (st.milestones[mark] ? ' ✓' : ''));
    }
    var row = function (label, value, cls) {
      return '<div style="display:flex;justify-content:space-between;gap:14px;border-bottom:1px dashed rgba(200,180,120,.18);">' +
        '<span style="color:#bfae86;">' + label + '</span>' +
        '<b style="color:' + (cls || '#f4e6c2') + ';">' + value + '</b></div>';
    };
    var html = '';
    html += row('Tuần này (từ thứ Hai)', st.week.key, '#9fd4ff');
    html += row('Tầng cao nhất tuần', '' + (st.week.bestFloor || 0), '#ffe9a8');
    html += row('Kỷ lục cá nhân (mọi tuần)', '' + (st.bestFloor || 0));
    html += row('Số lần leo tháp', '' + (st.climbs || 0));
    html += row('Mốc danh hiệu đã đạt (P2F đọc)', marks.join(' · '));
    html += '<div style="margin-top:8px;color:#9a8f76;font-size:11px;line-height:1.6;">' +
      'Bảng ghi tầng cao nhất đã vượt qua và tự đặt lại vào thứ Hai (giờ máy). ' +
      'Cứ 10 tầng có một boss nhỏ; hạ boss nhận nguyên liệu hiếm + trang bị theo bảng rơi hiện có.</div>';
    boardBodyEl.innerHTML = html;
  }

  function openBoard() {
    buildBoard();
    if (!boardEl) return;
    renderBoard();
    boardEl.classList.remove('hidden');
  }
  function closeBoard() {
    if (!boardEl) return;
    boardEl.classList.add('hidden');
  }

  // Chuyển map (kể cả về Miếu Hoang) = rời tháp.
  // Chết: engine/P2B xử lý; module chỉ dừng lượt leo khi thấy máu <= 0 (tick).
  function findMonsterSpecies(id) {
    var mon = getMonstersAPI();
    return mon && mon.SPECIES ? mon.SPECIES[id] : null;
  }

  // ==========================================================================
  // KHỞI ĐỘNG
  // ==========================================================================
  function init() {
    if (typeof window === 'undefined') return;
    buildHud();
    buildBoard();
    window.addEventListener('map_switched', function () {
      if (run && window.GameEngine && window.GameEngine.getCurrentMapId() !== TOWER_MAP_ID) stopRun('map');
    });
    if (!tickTimer) tickTimer = setInterval(tick, 200);
  }

  exports.enterTower = enterTower;
  exports.leaveTower = leaveTower;
  exports.openBoard = openBoard;
  exports.closeBoard = closeBoard;
  exports.ensureState = ensureState;
  exports.weekKey = weekKey;
  exports.tick = tick;
  exports.getRun = getRun;
  // Móc kiểm thử / đọc số (không phải nút HUD)
  exports.floorElement = floorElement;
  exports.isBossFloor = isBossFloor;
  exports.waveSize = waveSize;
  exports.scaleFor = scaleFor;
  exports.bossForFloor = function (floor) { return BOSS_BY_ELEMENT[floorElement(floor)]; };
  exports.awardBossFloor = awardBossFloor;
  exports.findMonsterSpecies = findMonsterSpecies;
  exports.TITLE_MILESTONES = TITLE_MILESTONES.slice();
  exports.PROVISIONAL = { BOSS_EVERY: BOSS_EVERY, SCALE: SCALE, waveSize: '2 + floor((f-1)/5), trần 6', elements: ELEMENTS.slice(), titleMilestones: TITLE_MILESTONES.slice(), arenaSlots: ARENA_SLOTS.length };
  exports.bossEvery = BOSS_EVERY;

  init();
})(typeof window !== 'undefined' ? (window.GameThap = {}) : (module.exports = {}));
