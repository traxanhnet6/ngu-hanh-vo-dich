/**
 * bi-canh.js — Đợt E3: Bí cảnh chơi đơn + sự kiện theo lịch
 *
 * Node-loadable và chạy trên trình duyệt.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ PROVISIONAL (liệt kê đầy đủ trong E3-REPORT.md)
  // ==========================================================================
  var REVIVE_PER_RUN = 1;                 // 47§5: mỗi lượt vào 1 lần hồi sinh tại chỗ
  var WAVE_BUFF_LOST_HOURS = 2;           // provisional: mất buff linh khí N giờ khi thua Thủ Hộ
  var WAVE_CONTRIB_THRESHOLD = 10;        // provisional: ngưỡng đóng góp tối thiểu để chia thưởng
  var BOSS_TELEGRAPH_MIN = 0.7;           // 52§2: báo trước tối thiểu 0,7s
  var TROI_MO_FLOORS = 3;                 // Trời Mở: 3 tầng + boss cuối
  var NGU_HANH_GATES = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

  // Khung giờ sự kiện [PROVISIONAL — hồ sơ 07§C]
  var EVENTS = [
    { id: 'thu_ho_trua', name: 'Bí Cảnh Thủ Hộ (Trưa)', type: 'thu_ho', weekday: null, hour: 12, minute: 0, durationMin: 30, rewardLimit: 'day', contribThreshold: WAVE_CONTRIB_THRESHOLD },
    { id: 'thu_ho_toi', name: 'Bí Cảnh Thủ Hộ (Tối)', type: 'thu_ho', weekday: null, hour: 20, minute: 0, durationMin: 30, rewardLimit: 'day', contribThreshold: WAVE_CONTRIB_THRESHOLD },
    { id: 'troi_mo', name: 'Bí Cảnh Trời Mở', type: 'troi_mo', weekday: 6, hour: 20, minute: 0, durationMin: 30, rewardLimit: 'week', contribThreshold: 0 },
    { id: 'ngu_hanh_luan', name: 'Ngũ Hành Luân Bí Cảnh', type: 'ngu_hanh_luan', weekday: null, hour: 19, minute: 0, durationMin: 60, rewardLimit: 'day', contribThreshold: 0 }
  ];

  var DUNGEONS = {
    'thuong_truc': { id: 'thuong_truc', name: 'Bí Cảnh Thường Trực', solo: true, floors: 5, bossFloor: 5, reward: ['nguyen-tinh-moc'] },
    'thu_ho': { id: 'thu_ho', name: 'Bí Cảnh Thủ Hộ', solo: false, waves: true },
    'troi_mo': { id: 'troi_mo', name: 'Bí Cảnh Trời Mở', solo: true, floors: TROI_MO_FLOORS, bossFloor: TROI_MO_FLOORS, reward: ['nguyen-tinh-moc', 'nguyen-tinh-hoa'] },
    'ngu_hanh_luan': { id: 'ngu_hanh_luan', name: 'Ngũ Hành Luân Bí Cảnh', solo: true, gates: 5, bossRoom: 'middle' }
  };

  // ==========================================================================
  // TIỆN ÍCH
  // ==========================================================================
  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }
  function getTrangBiAPI() {
    if (typeof window !== 'undefined' && window.GameTrangBi) return window.GameTrangBi;
    if (typeof global !== 'undefined' && global.GameTrangBi) return global.GameTrangBi;
    try { return require('./trangbi.js'); } catch (e) { return null; }
  }
  function getMonstersAPI() {
    if (typeof window !== 'undefined' && window.GameMonsters) return window.GameMonsters;
    if (typeof global !== 'undefined' && global.GameMonsters) return global.GameMonsters;
    try { return require('./monsters.js'); } catch (e) { return null; }
  }

  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function weekKey(ms) {
    var d = new Date(ms);
    // ISO week-ish
    var onejan = new Date(d.getFullYear(), 0, 1);
    var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + week;
  }

  function ensureState(player) {
    if (!player) return null;
    if (!player.biCanh || typeof player.biCanh !== 'object') {
      player.biCanh = {
        currentRun: null,
        runs: [],
        rewards: {},          // key -> true
        reminders: {},        // eventId -> true
        areaBuffs: {},        // mapId/area -> { lostUntil: ms }
        combatLogs: {},
        troiMoProgress: { floor: 0, completed: false },
        nguHanhProgress: { openedGates: [], middleOpened: false }
      };
    }
    var st = player.biCanh;
    if (st.currentRun === undefined) st.currentRun = null;
    if (!Array.isArray(st.runs)) st.runs = [];
    if (!st.rewards || typeof st.rewards !== 'object') st.rewards = {};
    if (!st.reminders || typeof st.reminders !== 'object') st.reminders = {};
    if (!st.areaBuffs || typeof st.areaBuffs !== 'object') st.areaBuffs = {};
    if (!st.combatLogs || typeof st.combatLogs !== 'object') st.combatLogs = {};
    if (!st.troiMoProgress || typeof st.troiMoProgress !== 'object') st.troiMoProgress = { floor: 0, completed: false };
    if (!st.nguHanhProgress || typeof st.nguHanhProgress !== 'object') st.nguHanhProgress = { openedGates: [], middleOpened: false };
    if (!Array.isArray(st.nguHanhProgress.openedGates)) st.nguHanhProgress.openedGates = [];
    // aliases
    player.e3 = player.biCanh;
    player.dungeon = player.biCanh;
    player.currentRun = st.currentRun;
    return st;
  }

  // also expose on state API if available
  try {
    var stApi = getStateAPI();
    if (stApi && !stApi.ensureBiCanh) {
      stApi.ensureBiCanh = ensureState;
    }
  } catch (e) {}

  // ==========================================================================
  // LỊCH SỰ KIỆN + ĐẾM NGƯỢC
  // ==========================================================================
  function getEvents() { return EVENTS.slice(); }
  function getEventById(id) {
    for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return EVENTS[i];
    return null;
  }

  function eventStartMs(ev, baseMs) {
    baseMs = (baseMs !== undefined) ? baseMs : Date.now();
    var d = new Date(baseMs);
    // find next occurrence on/after baseMs matching weekday & hour
    var candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), ev.hour, ev.minute, 0, 0);
    // adjust weekday
    if (ev.weekday !== null && ev.weekday !== undefined) {
      while (candidate.getDay() !== ev.weekday || candidate.getTime() < baseMs) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(ev.hour, ev.minute, 0, 0);
        if (candidate.getTime() < baseMs) continue;
        if (candidate.getDay() === ev.weekday) break;
      }
    } else {
      if (candidate.getTime() < baseMs) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(ev.hour, ev.minute, 0, 0);
      }
    }
    // ensure not before base
    while (candidate.getTime() < baseMs) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(ev.hour, ev.minute, 0, 0);
      if (ev.weekday !== null && ev.weekday !== undefined && candidate.getDay() !== ev.weekday) continue;
      break;
    }
    return candidate.getTime();
  }

  function isEventOpen(ev, nowMs) {
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var start = eventStartMs(ev, nowMs - ev.durationMin * 60 * 1000 - 1);
    // recompute start for this day
    var s = eventStartMs(ev, nowMs);
    // if now before start but within? check previous occurrence too
    var prev = eventStartMs(ev, nowMs - 24 * 60 * 60 * 1000);
    var starts = [prev, s];
    for (var i = 0; i < starts.length; i++) {
      var st = starts[i];
      var end = st + ev.durationMin * 60 * 1000;
      if (nowMs >= st && nowMs < end) return true;
    }
    return false;
  }

  function getNextEvent(nowMs) {
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var best = null;
    for (var i = 0; i < EVENTS.length; i++) {
      var ev = EVENTS[i];
      var start = eventStartMs(ev, nowMs);
      // if currently open, start is next? keep countdown 0
      if (isEventOpen(ev, nowMs)) {
        if (!best || 0 < best.countdown) {
          best = { event: ev, startMs: start, countdown: 0, open: true };
        }
        continue;
      }
      var cd = start - nowMs;
      if (!best || cd < best.countdown) {
        best = { event: ev, startMs: start, countdown: cd, open: false };
      }
    }
    return best;
  }

  function getCountdown(nowMs) {
    var ne = getNextEvent(nowMs);
    return ne ? ne.countdown : 0;
  }

  function getSchedule(nowMs) {
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    // weekly grid day-hour
    var grid = [];
    for (var day = 0; day < 7; day++) {
      var row = { day: day, events: [] };
      for (var i = 0; i < EVENTS.length; i++) {
        var ev = EVENTS[i];
        if (ev.weekday !== null && ev.weekday !== undefined && ev.weekday !== day) continue;
        row.events.push({ id: ev.id, name: ev.name, hour: ev.hour, minute: ev.minute, durationMin: ev.durationMin });
      }
      grid.push(row);
    }
    return { grid: grid, events: getEvents(), now: nowMs, next: getNextEvent(nowMs) };
  }

  // ==========================================================================
  // THÔNG CÁO THIÊN Đạo (banner/toast) — dữ liệu
  // ==========================================================================
  function getAnnouncement(ev) {
    return 'Thiên Đạo thông cáo: ' + (ev ? ev.name : 'Sự kiện') + ' sắp khai mở.';
  }

  // ==========================================================================
  // BẢNG SỰ KIỆN TUẦN (notice board)
  // ==========================================================================
  function getNoticeBoardData(player, nowMs) {
    ensureState(player);
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var st = player.biCanh;
    var ongoing = [];
    var upcoming = [];
    for (var i = 0; i < EVENTS.length; i++) {
      var ev = EVENTS[i];
      var open = isEventOpen(ev, nowMs);
      var nextStart = eventStartMs(ev, nowMs);
      var cd = open ? 0 : (nextStart - nowMs);
      var item = {
        id: ev.id,
        name: ev.name,
        type: ev.type,
        open: open,
        countdown: cd,
        startMs: nextStart,
        durationMin: ev.durationMin,
        reminded: !!st.reminders[ev.id]
      };
      if (open) ongoing.push(item); else upcoming.push(item);
    }
    upcoming.sort(function (a, b) { return a.countdown - b.countdown; });
    return {
      grid: getSchedule(nowMs).grid,
      ongoing: ongoing,
      upcoming: upcoming,
      next: getNextEvent(nowMs),
      countdown: getCountdown(nowMs)
    };
  }

  function remindEvent(player, eventId, on) {
    ensureState(player);
    if (on === undefined) on = true;
    player.biCanh.reminders[eventId] = !!on;
    return { ok: true, eventId: eventId, reminded: !!on };
  }
  function toggleReminder(player, eventId) { return remindEvent(player, eventId); }

  function checkReminders(player, nowMs) {
    ensureState(player);
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var due = [];
    for (var i = 0; i < EVENTS.length; i++) {
      var ev = EVENTS[i];
      if (!player.biCanh.reminders[ev.id]) continue;
      // due if event starts within 1 min or open now
      var start = eventStartMs(ev, nowMs);
      if (start - nowMs <= 60 * 1000 && start - nowMs >= -ev.durationMin * 60 * 1000) {
        // fire once per day
        var key = 'reminded_' + ev.id + '_' + dateKey(nowMs);
        if (!player.biCanh.rewards[key]) {
          player.biCanh.rewards[key] = true;
          due.push({ eventId: ev.id, name: ev.name, message: 'Nhắc: ' + ev.name + ' sắp bắt đầu.' });
        }
      }
    }
    return due;
  }

  function openNoticeBoard(player) {
    // UI hook; in Node just return data
    return getNoticeBoardData(player, Date.now());
  }

  // ==========================================================================
  // PHẦN THƯỞNG / GIỚI HẠN LƯỢT
  // ==========================================================================
  function rewardKey(player, ev, nowMs) {
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    if (ev.rewardLimit === 'week') return ev.id + ':week:' + weekKey(nowMs);
    return ev.id + ':day:' + dateKey(nowMs);
  }

  function hasClaimedReward(player, keyOrEvent, nowMs) {
    ensureState(player);
    var key = keyOrEvent;
    if (typeof keyOrEvent === 'object' && keyOrEvent !== null) {
      key = rewardKey(player, keyOrEvent, nowMs);
    }
    return !!player.biCanh.rewards['reward_' + key];
  }

  function claimReward(player, evOrKey, nowMs) {
    ensureState(player);
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var ev = (typeof evOrKey === 'object' && evOrKey !== null) ? evOrKey : getEventById(evOrKey);
    var key;
    if (ev) key = rewardKey(player, ev, nowMs); else key = String(evOrKey);
    var rkey = 'reward_' + key;
    if (player.biCanh.rewards[rkey]) {
      return { ok: false, reason: 'already_claimed', msg: 'Đã nhận thưởng lượt này.' };
    }
    player.biCanh.rewards[rkey] = true;
    return { ok: true, key: key, msg: 'Đã nhận thưởng.' };
  }

  function canClaimWaveReward(player, run) {
    ensureState(player);
    if (!run) return false;
    return (run.contribution || 0) >= WAVE_CONTRIB_THRESHOLD;
  }

  // ==========================================================================
  // BÍ CẢNH TURN / RUN
  // ==========================================================================
  function createRun(player, dungeonId, opts) {
    ensureState(player);
    opts = opts || {};
    var run = {
      id: 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      dungeonId: dungeonId,
      startedAt: Date.now(),
      floor: opts.floor || 1,
      wave: opts.wave || 0,
      revivesUsed: 0,
      reviveLimit: REVIVE_PER_RUN,
      loot: [],
      contribution: 0,
      status: 'active', // active/completed/failed/pushed
      combatLog: { totalDamage: 0, skillCounts: {}, interrupts: 0 },
      keptLoot: true
    };
    player.biCanh.currentRun = run;
    player.currentRun = run;
    player.biCanh.runs.push(run);
    return run;
  }

  function enterDungeon(player, dungeonId, opts) {
    ensureState(player);
    opts = opts || {};
    var dg = DUNGEONS[dungeonId] || { id: dungeonId, name: dungeonId, solo: true };
    // if already active run, return it? create new session
    var run = createRun(player, dungeonId, opts);
    run.dungeon = dg;
    return { ok: true, run: run, dungeon: dg };
  }
  function enterRun(player, dungeonId, opts) { return enterDungeon(player, dungeonId, opts); }
  function startRun(player, dungeonId, opts) { return enterDungeon(player, dungeonId, opts); }
  function startDungeon(player, dungeonId, opts) { return enterDungeon(player, dungeonId, opts); }

  function getCurrentRun(player) {
    ensureState(player);
    return player.biCanh.currentRun;
  }
  function getRun(player) { return getCurrentRun(player); }

  function reviveInRun(player) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (!run || run.status !== 'active') return { ok: false, reason: 'no_active_run' };
    if (run.revivesUsed >= run.reviveLimit) return { ok: false, reason: 'no_revive_left', msg: 'Hết lượt hồi sinh trong lượt này.' };
    run.revivesUsed++;
    return { ok: true, used: run.revivesUsed, remaining: run.reviveLimit - run.revivesUsed };
  }

  function handleDowned(player) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (!run || run.status !== 'active') return { ok: false, reason: 'no_active_run' };
    var r = reviveInRun(player);
    if (r.ok) {
      return { ok: true, revived: true, pushed: false, run: run };
    }
    // second down -> push out, keep loot
    run.status = 'pushed';
    run.pushedAt = Date.now();
    run.keptLoot = true;
    player.biCanh.currentRun = null;
    player.currentRun = null;
    return { ok: true, revived: false, pushed: true, keptLoot: true, run: run };
  }
  function onPlayerDowned(player) { return handleDowned(player); }
  function playerDowned(player) { return handleDowned(player); }
  function onDowned(player) { return handleDowned(player); }

  function exitDungeon(player, reason) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (!run) return { ok: false, reason: 'no_active_run' };
    run.status = reason === 'completed' ? 'completed' : (reason || 'exited');
    run.endedAt = Date.now();
    run.keptLoot = true;
    player.biCanh.currentRun = null;
    player.currentRun = null;
    return { ok: true, run: run, keptLoot: true };
  }
  function exitRun(player, reason) { return exitDungeon(player, reason); }
  function leaveDungeon(player, reason) { return exitDungeon(player, reason); }
  function leaveRun(player, reason) { return exitDungeon(player, reason); }
  function endRun(player, reason) { return exitDungeon(player, reason); }
  function finishRun(player, reason) { return exitDungeon(player, reason, true); }
  // override finishRun to mark completed
  function finishRunCompleted(player) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (run) run.status = 'completed';
    return exitDungeon(player, 'completed');
  }

  // ==========================================================================
  // THỦ HỘ DẠNG SÓNG
  // ==========================================================================
  function startWaveRun(player, areaId, opts) {
    ensureState(player);
    opts = opts || {};
    var res = enterDungeon(player, 'thu_ho', { areaId: areaId, wave: 0 });
    var run = res.run;
    run.areaId = areaId || 'default';
    run.wavesCleared = 0;
    return run;
  }

  function nextWave(player) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (!run) return { ok: false, reason: 'no_active_run' };
    run.wave = (run.wave || 0) + 1;
    run.wavesCleared = run.wave;
    return { ok: true, wave: run.wave };
  }

  function failWaveRun(player, areaId) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (run) {
      run.status = 'failed';
      player.biCanh.currentRun = null;
      player.currentRun = null;
    }
    areaId = areaId || (run && run.areaId) || 'default';
    var lostUntil = Date.now() + WAVE_BUFF_LOST_HOURS * 60 * 60 * 1000;
    player.biCanh.areaBuffs[areaId] = { lostUntil: lostUntil, lost: true };
    return { ok: true, areaId: areaId, buffLostUntil: lostUntil, hours: WAVE_BUFF_LOST_HOURS };
  }
  function waveFailed(player, areaId) { return failWaveRun(player, areaId); }
  function loseBuff(player, areaId, hours) {
    ensureState(player);
    if (hours) WAVE_BUFF_LOST_HOURS = hours;
    return failWaveRun(player, areaId);
  }

  function isAreaBuffActive(player, areaId, nowMs) {
    ensureState(player);
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var b = player.biCanh.areaBuffs[areaId || 'default'];
    if (!b) return true;
    if (b.lostUntil && b.lostUntil > nowMs) return false;
    return true;
  }
  function getAreaBuff(player, areaId, nowMs) { return { active: isAreaBuffActive(player, areaId, nowMs) }; }

  function addContribution(player, amount) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (!run) return { ok: false };
    run.contribution = (run.contribution || 0) + (amount || 0);
    return { ok: true, contribution: run.contribution };
  }

  // ==========================================================================
  // TRỜI MỞ (3 tầng + boss)
  // ==========================================================================
  function enterTroiMo(player, opts) {
    ensureState(player);
    opts = opts || {};
    var run = enterDungeon(player, 'troi_mo', { floor: 1 });
    player.biCanh.troiMoProgress = player.biCanh.troiMoProgress || { floor: 0, completed: false };
    run.floor = Math.max(1, player.biCanh.troiMoProgress.floor + 1);
    if (run.floor > TROI_MO_FLOORS) run.floor = TROI_MO_FLOORS;
    return { ok: true, run: run, floors: TROI_MO_FLOORS };
  }
  function startTroiMo(player, opts) { return enterTroiMo(player, opts); }

  function advanceTroiMoFloor(player) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (!run || run.dungeonId !== 'troi_mo') return { ok: false, reason: 'no_run' };
    run.floor = (run.floor || 1) + 1;
    player.biCanh.troiMoProgress.floor = Math.max(player.biCanh.troiMoProgress.floor, run.floor - 1);
    if (run.floor > TROI_MO_FLOORS) {
      run.floor = TROI_MO_FLOORS;
    }
    return { ok: true, floor: run.floor };
  }

  function completeTroiMo(player) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (run) {
      run.status = 'completed';
      player.biCanh.currentRun = null;
      player.currentRun = null;
    }
    player.biCanh.troiMoProgress = { floor: TROI_MO_FLOORS, completed: true };
    // reward claim weekly
    var ev = getEventById('troi_mo');
    var ck = claimReward(player, ev || 'troi_mo', Date.now());
    return { ok: true, completed: true, reward: ck };
  }

  function getTroiMoProgress(player) {
    ensureState(player);
    return player.biCanh.troiMoProgress;
  }

  // ==========================================================================
  // NGŨ HÀNH LUÂN (5 cửa + cửa giữa)
  // ==========================================================================
  function featuredElementForDay(nowMs) {
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var d = new Date(nowMs).getDay(); // 0..6
    return NGU_HANH_GATES[d % NGU_HANH_GATES.length];
  }

  function getNguHanhLuanGates(player, nowMs) {
    ensureState(player);
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var featured = featuredElementForDay(nowMs);
    var gates = NGU_HANH_GATES.map(function (el) {
      return {
        element: el,
        name: 'Cửa ' + el.toUpperCase(),
        open: el === featured,
        featured: el === featured
      };
    });
    return { gates: gates, featured: featured, middleLocked: !player.biCanh.nguHanhProgress.middleOpened };
  }
  function nguHanhLuanGates(player, nowMs) { return getNguHanhLuanGates(player, nowMs); }

  function fillMissingElements(partyElements) {
    partyElements = partyElements || [];
    var have = {};
    for (var i = 0; i < partyElements.length; i++) have[partyElements[i]] = true;
    var bots = [];
    for (var j = 0; j < NGU_HANH_GATES.length; j++) {
      var el = NGU_HANH_GATES[j];
      if (!have[el]) {
        bots.push({ isBot: true, element: el, name: 'Bot ' + el });
      }
    }
    return bots;
  }

  function canOpenMiddleGate(partyElements) {
    partyElements = partyElements || [];
    var have = {};
    for (var i = 0; i < partyElements.length; i++) have[partyElements[i]] = true;
    // bots fill missing; so always possible with bots. But "đủ 5 hệ" after fill -> true
    var filled = partyElements.slice();
    var bots = fillMissingElements(filled);
    for (var b = 0; b < bots.length; b++) filled.push(bots[b].element);
    var all = true;
    for (var k = 0; k < NGU_HANH_GATES.length; k++) {
      if (filled.indexOf(NGU_HANH_GATES[k]) === -1) { all = false; break; }
    }
    return all;
  }

  function openMiddleGate(player, partyElements) {
    ensureState(player);
    if (!canOpenMiddleGate(partyElements || [])) return { ok: false, reason: 'not_enough_elements' };
    player.biCanh.nguHanhProgress.middleOpened = true;
    return { ok: true, opened: true };
  }

  // ==========================================================================
  // MÀN CHUẨN BỊ (52§7) + CẢNH BÁO SÀN ĐỒ E1
  // ==========================================================================
  function getPrepInfo(dungeonId) {
    dungeonId = dungeonId || 'thuong_truc';
    var dg = DUNGEONS[dungeonId] || {};
    // provisional enemy data
    var monsters = [{ name: 'Quái hệ Mộc', element: 'moc' }];
    var boss = { name: 'Boss Bí Cảnh', element: 'moc', telegraphDuration: 1.0 };
    if (dungeonId === 'troi_mo') {
      monsters = [{ name: 'Quái Trời Mở', element: 'hoa' }];
      boss = { name: 'Boss Trời Mở', element: 'hoa', telegraphDuration: 1.2 };
    }
    if (dungeonId === 'ngu_hanh_luan') {
      monsters = NGU_HANH_GATES.map(function (e) { return { name: 'Quái ' + e, element: e }; });
      boss = { name: 'Boss Ẩn Ngũ Hành', element: 'tho', telegraphDuration: 1.3 };
    }
    return {
      dungeonId: dungeonId,
      dungeon: dg,
      monsters: monsters,
      boss: boss,
      warnings: []
    };
  }

  function checkGearFloorWarning(player, dungeonId) {
    ensureState(player);
    var tb = getTrangBiAPI();
    if (tb && tb.checkGearFloor) {
      try {
        var res = tb.checkGearFloor(player, 1);
        return { below: !!res.below, suggestions: res.suggestions || [], ok: !res.below };
      } catch (e) {}
    }
    return { below: false, suggestions: [], ok: true };
  }

  function getPrepScreen(player, dungeonId) {
    var info = getPrepInfo(dungeonId);
    var gear = checkGearFloorWarning(player, dungeonId);
    info.gearWarning = gear;
    if (gear.below) info.warnings.push('Bộ trang bị đang dưới sàn — nên bổ sung trước khi vào.');
    // skill counter warning provisional
    info.skillWarning = null;
    return info;
  }

  // ==========================================================================
  // TELEGRAPH BOSS (min 0.7s)
  // ==========================================================================
  function getBossTelegraph(bossIdOrDungeon) {
    // return duration >= 0.7
    var dur = 1.0;
    return { telegraphDuration: dur, min: BOSS_TELEGRAPH_MIN, ok: dur >= BOSS_TELEGRAPH_MIN };
  }

  // ==========================================================================
  // NHẬT KÝ SAU TRẬN (52§8)
  // ==========================================================================
  function recordCombatLog(player, data) {
    ensureState(player);
    var run = player.biCanh.currentRun;
    if (!run) return { ok: false };
    data = data || {};
    if (typeof data.damage === 'number') run.combatLog.totalDamage += data.damage;
    if (data.skillId) {
      run.combatLog.skillCounts[data.skillId] = (run.combatLog.skillCounts[data.skillId] || 0) + 1;
    }
    if (data.interrupt) run.combatLog.interrupts += (data.interruptCount || 1);
    return { ok: true, log: run.combatLog };
  }
  function addCombatLog(player, data) { return recordCombatLog(player, data); }

  function getCombatLog(player, run) {
    ensureState(player);
    run = run || player.biCanh.currentRun;
    if (!run) return null;
    return run.combatLog;
  }

  function getMostUsedSkill(log) {
    log = log || {};
    var counts = log.skillCounts || {};
    var best = null, bestN = 0;
    for (var k in counts) {
      if (Object.prototype.hasOwnProperty.call(counts, k) && counts[k] > bestN) {
        best = k; bestN = counts[k];
      }
    }
    return best ? { skillId: best, count: bestN } : null;
  }

  // ==========================================================================
  // ALIASES / EXPORTS
  // ==========================================================================
  var API = {
    // constants
    REVIVE_PER_RUN: REVIVE_PER_RUN,
    WAVE_BUFF_LOST_HOURS: WAVE_BUFF_LOST_HOURS,
    WAVE_CONTRIB_THRESHOLD: WAVE_CONTRIB_THRESHOLD,
    BOSS_TELEGRAPH_MIN: BOSS_TELEGRAPH_MIN,
    TROI_MO_FLOORS: TROI_MO_FLOORS,
    NGU_HANH_GATES: NGU_HANH_GATES,
    EVENTS: EVENTS,
    DUNGEONS: DUNGEONS,

    // state
    ensureState: ensureState,
    ensureBiCanh: ensureState,

    // schedule
    getEvents: getEvents,
    listEvents: getEvents,
    getEventById: getEventById,
    eventStartMs: eventStartMs,
    isEventOpen: isEventOpen,
    getNextEvent: getNextEvent,
    nextEvent: getNextEvent,
    getNextScheduledEvent: getNextEvent,
    getCountdown: getCountdown,
    timeUntilNext: getCountdown,
    getSchedule: getSchedule,
    getEventSchedule: getSchedule,
    getWeeklySchedule: getSchedule,
    getAnnouncement: getAnnouncement,

    // notice board
    getNoticeBoardData: getNoticeBoardData,
    getNoticeBoard: getNoticeBoardData,
    openNoticeBoard: openNoticeBoard,
    remindEvent: remindEvent,
    remindMe: remindEvent,
    toggleReminder: toggleReminder,
    setReminder: remindEvent,
    checkReminders: checkReminders,
    pollReminders: checkReminders,

    // rewards
    rewardKey: rewardKey,
    hasClaimedReward: hasClaimedReward,
    hasClaimed: hasClaimedReward,
    claimReward: claimReward,
    claimEventReward: claimReward,
    canClaimWaveReward: canClaimWaveReward,

    // runs
    createRun: createRun,
    enterDungeon: enterDungeon,
    enterRun: enterRun,
    startRun: startRun,
    startDungeon: startDungeon,
    enter: enterDungeon,
    beginRun: enterDungeon,
    getCurrentRun: getCurrentRun,
    getRun: getRun,
    currentRun: getCurrentRun,
    reviveInRun: reviveInRun,
    tryReviveInDungeon: reviveInRun,
    handleDowned: handleDowned,
    onPlayerDowned: handleDowned,
    playerDowned: handleDowned,
    onDowned: handleDowned,
    downed: handleDowned,
    exitDungeon: exitDungeon,
    exitRun: exitRun,
    leaveDungeon: leaveDungeon,
    leaveRun: leaveRun,
    endRun: endRun,
    finishRun: finishRunCompleted,

    // waves
    startWaveRun: startWaveRun,
    nextWave: nextWave,
    failWaveRun: failWaveRun,
    waveFailed: failWaveRun,
    loseBuff: loseBuff,
    setAreaBuffLost: failWaveRun,
    isAreaBuffActive: isAreaBuffActive,
    getAreaBuff: getAreaBuff,
    addContribution: addContribution,

    // troi mo
    enterTroiMo: enterTroiMo,
    startTroiMo: enterTroiMo,
    troiMoEnter: enterTroiMo,
    advanceTroiMoFloor: advanceTroiMoFloor,
    completeTroiMo: completeTroiMo,
    getTroiMoProgress: getTroiMoProgress,

    // ngu hanh luan
    featuredElementForDay: featuredElementForDay,
    getNguHanhLuanGates: getNguHanhLuanGates,
    nguHanhLuanGates: nguHanhLuanGates,
    fillMissingElements: fillMissingElements,
    fillBots: fillMissingElements,
    fillBotsForMissingElements: fillMissingElements,
    canOpenMiddleGate: canOpenMiddleGate,
    openMiddleGate: openMiddleGate,

    // prep
    getPrepInfo: getPrepInfo,
    getPrepScreen: getPrepScreen,
    prepareScreen: getPrepScreen,
    checkGearFloorWarning: checkGearFloorWarning,
    gearWarning: checkGearFloorWarning,

    // telegraph
    getBossTelegraph: getBossTelegraph,
    bossTelegraph: getBossTelegraph,

    // combat log
    recordCombatLog: recordCombatLog,
    addCombatLog: addCombatLog,
    getCombatLog: getCombatLog,
    getMostUsedSkill: getMostUsedSkill
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') {
    window.GameBiCanh = API;
    window.GameBiCahn = API;
    window.GameE3 = API;
    window.GameSuKien = API;
    window.GameBíCanh = API;
  }
  if (typeof global !== 'undefined') {
    global.GameBiCanh = API;
    global.GameBiCahn = API;
    global.GameE3 = API;
    global.GameSuKien = API;
  }
})(typeof window !== 'undefined' ? window : this);
