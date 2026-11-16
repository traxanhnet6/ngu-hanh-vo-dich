/* ==========================================================================
 * P2E — VIỆC NGÀY / ĐIỂM HOẠT ĐỘNG / RƯƠNG / GIEO QUẺ
 * --------------------------------------------------------------------------
 * - Mỗi ngày 6 việc nhẹ lấy từ hành động ĐÃ CÓ trong game. Hoàn thành lần đầu
 *   trong ngày được điểm hoạt động; đặt lại theo ngày thật (UTC, cùng kiểu
 *   `questState.dailyCompletions`).
 * - Điểm ngày mở 3 rương mốc; điểm tuần (cộng dồn từ thứ Hai) mở 2 rương lớn.
 *   Rương trao nguyên liệu HIỆN CÓ qua GameState.addItemToBag.
 * - Gieo quẻ 1 lần/ngày, ảnh hưởng nhẹ hệ số điểm hoạt động nhận sau khi gieo.
 *
 * Mọi con số mốc/điểm/thưởng đều PROVISIONAL — chờ Bui phán (xem P2E-REPORT).
 * Không đụng rollDrops, bảng rơi, luật chết/hồi sinh hay sức mạnh vĩnh viễn.
 * ========================================================================== */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // HẰNG SỐ (PROVISIONAL — ghi rõ trong báo cáo)
  // -------------------------------------------------------------------------
  var TASKS = [
    { id: 'farm',    name: 'Chăm ruộng Linh Điền', need: 1, points: 10, hint: 'Gieo hoặc thu hoạch 1 ô Linh Điền.' },
    { id: 'bounty',  name: 'Một phiếu treo thưởng', need: 1, points: 10, hint: 'Nộp 1 phiếu ở bảng treo thưởng trấn/tông môn.' },
    { id: 'hunt',    name: 'Một vòng săn',          need: 5, points: 10, hint: 'Hạ 5 yêu thú liên tiếp trong chuỗi săn.' },
    { id: 'alchemy', name: 'Một lần luyện đan',     need: 1, points: 10, hint: 'Luyện thành 1 mẻ đan.' },
    { id: 'fish',    name: 'Câu cá',                need: 1, points: 10, hint: 'Thu hoạch 1 điểm câu cá.' },
    { id: 'herb',    name: 'Hái thuốc',             need: 1, points: 10, hint: 'Hái 1 điểm dược liệu trên bản đồ.' }
  ];

  var DAILY_CHESTS = [
    { id: 'd20', name: 'Rương Đồng',  points: 20, items: [{ itemId: 'la-thanh-tuy', count: 2 }] },
    { id: 'd40', name: 'Rương Bạc',   points: 40, items: [{ itemId: 'ca-linh-ngu', count: 2 }, { itemId: 'quang-dong-tho', count: 2 }] },
    { id: 'd55', name: 'Rương Vàng',  points: 55, items: [{ itemId: 'linh-me', count: 3 }] } // BUI QUYẾT 12:29 2026-11-16: mốc 60→55 để ngày quẻ Hung (tối đa 59 điểm) vẫn mở được
  ];

  var WEEKLY_CHESTS = [
    { id: 'w180', name: 'Rương Tuần · Đồng', points: 180, items: [{ itemId: 'go-thiet-moc', count: 3 }, { itemId: 'quang-sat-huyen', count: 2 }] },
    { id: 'w360', name: 'Rương Tuần · Kim',  points: 360, items: [{ itemId: 'tinh-thiet-tho', count: 1 }, { itemId: 'linh-chi-rung', count: 1 }] }
  ];

  // Tỉ lệ PROVISIONAL: 20% Đại Cát, 40% Cát, 25% Bình An, 15% Hung.
  var FORTUNES = [
    { id: 'dai_cat', name: 'Đại Cát',  mult: 1.2,  weight: 20, desc: 'Điểm hoạt động nhận hôm nay +20%.' },
    { id: 'cat',     name: 'Cát',       mult: 1.1,  weight: 40, desc: 'Điểm hoạt động nhận hôm nay +10%.' },
    { id: 'binh',    name: 'Bình An',   mult: 1.0,  weight: 25, desc: 'Không đổi điểm hoạt động.' },
    { id: 'hung',    name: 'Hung',      mult: 0.9,  weight: 15, desc: 'Điểm hoạt động nhận hôm nay −10%.' }
  ];

  var PANEL_ID = 'hoat-dong-modal';

  var fortuneRng = null; // test hook

  // -------------------------------------------------------------------------
  // NGÀY / TUẦN
  // -------------------------------------------------------------------------
  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  // Thứ Hai của tuần chứa `dateKey` (YYYY-MM-DD), tính theo UTC cho khớp ngày thật.
  function weekKeyFor(dateKey) {
    var d = new Date(dateKey + 'T00:00:00Z');
    var dow = d.getUTCDay(); // 0 CN .. 6 T7
    var diff = (dow === 0) ? 6 : (dow - 1);
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().slice(0, 10);
  }

  function emptyTasks() {
    var t = {};
    for (var i = 0; i < TASKS.length; i++) t[TASKS[i].id] = 0;
    return t;
  }

  function ensureState(player) {
    if (!player) return null;
    if (!player.hoatDong || typeof player.hoatDong !== 'object') {
      player.hoatDong = {};
    }
    var s = player.hoatDong;
    var today = todayKey();

    if (s.date !== today) {
      s.date = today;
      s.tasks = emptyTasks();
      s.points = 0;
      s.claimed = {};
      s.fortune = { rolled: false, id: null, name: '', desc: '', mult: 1 };
    }
    if (!s.tasks || typeof s.tasks !== 'object') s.tasks = emptyTasks();
    for (var i = 0; i < TASKS.length; i++) {
      if (typeof s.tasks[TASKS[i].id] !== 'number') s.tasks[TASKS[i].id] = 0;
    }
    if (typeof s.points !== 'number') s.points = 0;
    if (!s.claimed || typeof s.claimed !== 'object') s.claimed = {};
    if (!s.fortune || typeof s.fortune !== 'object') {
      s.fortune = { rolled: false, id: null, name: '', desc: '', mult: 1 };
    }

    var wk = weekKeyFor(today);
    if (!s.week || typeof s.week !== 'object' || s.week.key !== wk) {
      s.week = { key: wk, points: 0, claimed: {} };
    }
    if (typeof s.week.points !== 'number') s.week.points = 0;
    if (!s.week.claimed || typeof s.week.claimed !== 'object') s.week.claimed = {};

    return s;
  }

  function getState(player) { return ensureState(player); }

  function taskDef(id) {
    for (var i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return TASKS[i];
    return null;
  }

  function isTaskDone(s, def) {
    return (s.tasks[def.id] || 0) >= def.need;
  }

  // -------------------------------------------------------------------------
  // API NỘI BỘ
  // -------------------------------------------------------------------------
  function getPlayer() {
    if (typeof window === 'undefined') return null;
    if (window.GameEngine && window.GameEngine.getPlayer) return window.GameEngine.getPlayer();
    return window.player || null;
  }

  function getItemDefs() {
    if (typeof window === 'undefined') return undefined;
    return (window.GameMonsters && window.GameMonsters.ITEM_DEFS) ? window.GameMonsters.ITEM_DEFS : undefined;
  }

  function showToast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast(msg);
    }
  }

  function save(player) {
    if (typeof window !== 'undefined' && window.GameState && window.GameState.savePlayer) {
      window.GameState.savePlayer(player);
    }
  }

  function addItems(player, items) {
    if (typeof window === 'undefined' || !window.GameState || !window.GameState.addItemToBag) {
      return { ok: false, msg: 'GameState chưa sẵn sàng.' };
    }
    var defs = getItemDefs();
    for (var i = 0; i < items.length; i++) {
      var r = window.GameState.addItemToBag(player, items[i].itemId, items[i].count, defs);
      if (!r || r.success === false) {
        return { ok: false, msg: 'Túi đồ đã đầy, không mở được rương.' };
      }
    }
    return { ok: true };
  }

  function itemLabel(itemId) {
    var defs = getItemDefs();
    if (defs && defs[itemId] && defs[itemId].name) return defs[itemId].name;
    return itemId;
  }

  // Ghi nhận một hành động đã hoàn thành. Trả về {ok, taskId, completed, points}.
  function note(player, kind) {
    player = player || getPlayer();
    if (!player) return { ok: false, reason: 'no_player' };
    var s = ensureState(player);
    var def = taskDef(kind);
    if (!def) return { ok: false, reason: 'unknown_kind' };
    if (isTaskDone(s, def)) {
      return { ok: false, reason: 'already_done', taskId: def.id };
    }

    s.tasks[def.id] = (s.tasks[def.id] || 0) + 1;
    if (!isTaskDone(s, def)) {
      save(player);
      renderIfOpen(player);
      return { ok: true, taskId: def.id, completed: false, count: s.tasks[def.id], need: def.need };
    }

    var mult = (s.fortune && s.fortune.rolled && typeof s.fortune.mult === 'number') ? s.fortune.mult : 1;
    var pts = Math.max(1, Math.round(def.points * mult));
    s.points += pts;
    s.week.points += pts;
    save(player);
    showToast('Việc ngày: ' + def.name + ' xong — +' + pts + ' điểm hoạt động.');
    renderIfOpen(player);
    return { ok: true, taskId: def.id, completed: true, points: pts, totalPoints: s.points };
  }

  function rollFortune(player) {
    player = player || getPlayer();
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var s = ensureState(player);
    if (s.fortune && s.fortune.rolled) {
      return { ok: false, msg: 'Hôm nay đã gieo quẻ rồi.' };
    }
    var total = 0, i;
    for (i = 0; i < FORTUNES.length; i++) total += FORTUNES[i].weight;
    var roll = (typeof fortuneRng === 'function') ? fortuneRng() : Math.random();
    if (typeof roll !== 'number' || isNaN(roll)) roll = 0;
    roll = Math.max(0, Math.min(0.999999, roll)) * total;
    var pick = FORTUNES[0];
    var acc = 0;
    for (i = 0; i < FORTUNES.length; i++) {
      acc += FORTUNES[i].weight;
      if (roll < acc) { pick = FORTUNES[i]; break; }
    }
    s.fortune = { rolled: true, id: pick.id, name: pick.name, desc: pick.desc, mult: pick.mult };
    save(player);
    showToast('Gieo quẻ: ' + pick.name + ' — ' + pick.desc);
    renderIfOpen(player);
    return { ok: true, id: pick.id, name: pick.name, desc: pick.desc, mult: pick.mult };
  }

  function claimChest(player, chestId) {
    player = player || getPlayer();
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var s = ensureState(player);
    var i, chest = null, weekly = false;
    for (i = 0; i < DAILY_CHESTS.length; i++) if (DAILY_CHESTS[i].id === chestId) chest = DAILY_CHESTS[i];
    if (!chest) {
      for (i = 0; i < WEEKLY_CHESTS.length; i++) if (WEEKLY_CHESTS[i].id === chestId) { chest = WEEKLY_CHESTS[i]; weekly = true; }
    }
    if (!chest) return { ok: false, msg: 'Không có rương này.' };

    var claimed = weekly ? s.week.claimed : s.claimed;
    var points = weekly ? s.week.points : s.points;
    if (claimed[chest.id]) return { ok: false, msg: 'Rương đã mở.' };
    if (points < chest.points) return { ok: false, msg: 'Chưa đủ ' + chest.points + ' điểm.' };

    var add = addItems(player, chest.items);
    if (!add.ok) return { ok: false, msg: add.msg };

    claimed[chest.id] = Date.now();
    save(player);
    var parts = [];
    for (i = 0; i < chest.items.length; i++) {
      parts.push('+' + chest.items[i].count + ' ' + itemLabel(chest.items[i].itemId));
    }
    showToast('Mở ' + chest.name + ': ' + parts.join(', '));
    renderIfOpen(player);
    return { ok: true, chestId: chest.id, items: chest.items };
  }

  // -------------------------------------------------------------------------
  // GIAO DIỆN TỐI THIỂU
  // -------------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function chestRows(chests, points, claimed, weekly) {
    var html = '';
    for (var i = 0; i < chests.length; i++) {
      var c = chests[i];
      var done = !!claimed[c.id];
      var can = !done && points >= c.points;
      var items = [];
      for (var j = 0; j < c.items.length; j++) {
        items.push('+' + c.items[j].count + ' ' + esc(itemLabel(c.items[j].itemId)));
      }
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(255,255,255,.08);">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;">' + esc(c.name) + ' · mốc <b>' + c.points + '</b> điểm' + (weekly ? ' tuần' : ' ngày') + '</div>'
        + '<div style="font-size:11px;opacity:.75;">' + items.join(' · ') + '</div>'
        + '</div>'
        + '<button type="button" class="btn wood small" data-chest="' + esc(c.id) + '"' + (can ? '' : ' disabled') + '>'
        + (done ? 'Đã mở' : (can ? 'Mở' : 'Chưa đủ')) + '</button>'
        + '</div>';
    }
    return html;
  }

  function renderPanel(player) {
    var s = ensureState(player);
    if (!s) return;
    var modal = document.getElementById(PANEL_ID);
    if (!modal) return;
    var body = modal.querySelector('[data-hd-body]');
    if (!body) return;

    var html = '';
    html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;">'
      + '<div><div style="font-size:11px;opacity:.7;">Điểm hôm nay</div><div style="font-size:22px;font-weight:700;">' + s.points + '</div></div>'
      + '<div><div style="font-size:11px;opacity:.7;">Điểm tuần (từ T2)</div><div style="font-size:22px;font-weight:700;">' + s.week.points + '</div></div>'
      + '</div>';

    // Gieo quẻ
    html += '<div style="padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:8px;margin-bottom:10px;">';
    if (s.fortune && s.fortune.rolled) {
      html += '<div style="font-size:13px;"><b>Quẻ hôm nay: ' + esc(s.fortune.name) + '</b></div>'
        + '<div style="font-size:11px;opacity:.8;">' + esc(s.fortune.desc) + '</div>';
    } else {
      html += '<div style="display:flex;align-items:center;gap:10px;">'
        + '<div style="flex:1;font-size:12px;opacity:.85;">Gieo quẻ 1 lần/ngày để nhận điềm tốt/xấu ảnh hưởng nhẹ điểm hoạt động.</div>'
        + '<button type="button" class="btn btn-main small" data-hd-roll="1">Gieo Quẻ</button>'
        + '</div>';
    }
    html += '</div>';

    // Việc ngày
    html += '<div style="font-size:12px;font-weight:700;letter-spacing:.5px;margin:2px 0 4px;">VIỆC NGÀY</div>';
    for (var i = 0; i < TASKS.length; i++) {
      var t = TASKS[i];
      var cnt = s.tasks[t.id] || 0;
      var done = cnt >= t.need;
      html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,.08);">'
        + '<div style="width:16px;text-align:center;color:' + (done ? '#8ee89a' : 'rgba(255,255,255,.45)') + ';">' + (done ? '✓' : '·') + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;' + (done ? 'opacity:.7;' : '') + '">' + esc(t.name) + ' <span style="font-size:11px;opacity:.75;">' + Math.min(cnt, t.need) + '/' + t.need + '</span></div>'
        + '<div style="font-size:11px;opacity:.6;">' + esc(t.hint) + '</div>'
        + '</div>'
        + '<div style="font-size:11px;white-space:nowrap;">+' + t.points + ' điểm</div>'
        + '</div>';
    }

    // Rương ngày
    html += '<div style="font-size:12px;font-weight:700;letter-spacing:.5px;margin:12px 0 2px;">RƯƠNG HOẠT ĐỘNG NGÀY</div>';
    html += chestRows(DAILY_CHESTS, s.points, s.claimed, false);

    // Rương tuần
    html += '<div style="font-size:12px;font-weight:700;letter-spacing:.5px;margin:12px 0 2px;">RƯƠNG HOẠT ĐỘNG TUẦN</div>';
    html += chestRows(WEEKLY_CHESTS, s.week.points, s.week.claimed, true);

    body.innerHTML = html;

    var rollBtn = body.querySelector('[data-hd-roll]');
    if (rollBtn) rollBtn.onclick = function () { rollFortune(player); };
    var chestBtns = body.querySelectorAll('[data-chest]');
    for (var k = 0; k < chestBtns.length; k++) {
      chestBtns[k].onclick = (function (btn) {
        return function () { claimChest(player, btn.getAttribute('data-chest')); };
      })(chestBtns[k]);
    }
  }

  function renderIfOpen(player) {
    var modal = document.getElementById(PANEL_ID);
    if (modal && !modal.classList.contains('hidden')) renderPanel(player);
  }

  function openPanel(player) {
    player = player || getPlayer();
    if (!player) return;
    var modal = document.getElementById(PANEL_ID);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = PANEL_ID;
      modal.className = 'modal-overlay hidden';
      modal.innerHTML = '<div class="panel modal-box" style="max-width:480px;width:94%;max-height:86vh;overflow:auto;">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
        + '<div style="flex:1;font-size:15px;font-weight:700;letter-spacing:.5px;">VIỆC NGÀY · HOẠT ĐỘNG</div>'
        + '<button type="button" class="btn wood small" data-hd-close="1">Đóng</button>'
        + '</div>'
        + '<div data-hd-body></div>'
        + '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closePanel();
      });
      var closeBtn = modal.querySelector('[data-hd-close]');
      if (closeBtn) closeBtn.onclick = closePanel;
    }
    modal.classList.remove('hidden');
    renderPanel(player);
  }

  function closePanel() {
    var modal = document.getElementById(PANEL_ID);
    if (modal) modal.classList.add('hidden');
  }

  function mountButton() {
    if (typeof document === 'undefined') return;
    var panel = document.getElementById('hud-toolbar-panel');
    if (!panel || document.getElementById('btn-hoat-dong')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-hoat-dong';
    btn.type = 'button';
    btn.className = 'btn wood hud-tool-btn';
    btn.setAttribute('aria-label', 'Việc Ngày');
    btn.title = 'Việc Ngày · Điểm Hoạt Động · Gieo Quẻ';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect x="3" y="4" width="18" height="17" rx="2"></rect>'
      + '<line x1="16" y1="2" x2="16" y2="6"></line>'
      + '<line x1="8" y1="2" x2="8" y2="6"></line>'
      + '<line x1="3" y1="10" x2="21" y2="10"></line>'
      + '<path d="M9 15l2 2 4-4"></path>'
      + '</svg><span class="hud-tool-label">Việc Ngày</span>';
    btn.addEventListener('click', function () { openPanel(); });
    panel.appendChild(btn);
  }

  var API = {
    TASKS: TASKS,
    DAILY_CHESTS: DAILY_CHESTS,
    WEEKLY_CHESTS: WEEKLY_CHESTS,
    FORTUNES: FORTUNES,
    ensureState: ensureState,
    getState: getState,
    todayKey: todayKey,
    weekKeyFor: weekKeyFor,
    note: note,
    rollFortune: rollFortune,
    claimChest: claimChest,
    openPanel: openPanel,
    closePanel: closePanel,
    renderPanel: renderPanel,
    setFortuneRng: function (fn) { fortuneRng = fn; }
  };

  if (typeof window !== 'undefined') {
    window.GameHoatDong = API;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountButton);
    } else {
      mountButton();
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();
