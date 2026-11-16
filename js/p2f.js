/**
 * Đợt P2F — THÀNH TỰU + DANH HIỆU + SỔ TỬ
 * (P2-DESIGN §7; hồ sơ 16§7, 48§8, 15§2/§8).
 *
 * Đọc dữ liệu đã có (stats, deathLog, thapTuLuyen, luanVo, tieuMoc,
 * professions, skills) — không đổi luật. Mọi ngưỡng là PROVISIONAL.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ (PROVISIONAL)
  // ==========================================================================
  var DEATH_LOG_CAP = 200; // hồ sơ 47§? P2B giữ tối đa 200

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

  function safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  function ensureState(player) {
    if (!player || typeof player !== 'object') return null;
    if (!player.stats || typeof player.stats !== 'object') player.stats = { kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    if (!player.tieuMoc || typeof player.tieuMoc !== 'object') player.tieuMoc = { moc: 1 };
    if (!Array.isArray(player.deathLog)) player.deathLog = [];
    if (!player.thapTuLuyen || typeof player.thapTuLuyen !== 'object') {
      player.thapTuLuyen = { bestFloor: 0, climbs: 0, milestones: {}, week: { key: '', bestFloor: 0 } };
    }
    if (!player.luanVo || typeof player.luanVo !== 'object') {
      player.luanVo = { wins: 0, losses: 0, wonPeriods: [], lastResult: null, matchCount: 0 };
    }
    if (!Array.isArray(player.luanVo.wonPeriods)) player.luanVo.wonPeriods = [];
    if (!player.p2f || typeof player.p2f !== 'object') {
      player.p2f = { achievements: {}, title: null };
    }
    if (!player.p2f.achievements || typeof player.p2f.achievements !== 'object') player.p2f.achievements = {};
    if (typeof player.p2f.title !== 'string' && player.p2f.title !== null) player.p2f.title = null;
    return player.p2f;
  }

  // ==========================================================================
  // NGUỒN ĐẾM (chỉ đọc)
  // ==========================================================================
  function countUnlockedSkills(player) {
    var SK = (typeof window !== 'undefined') ? window.GameSkills : null;
    if (!SK || typeof SK.listSkills !== 'function' || typeof SK.isUnlocked !== 'function') return 0;
    var all = SK.listSkills();
    if (!Array.isArray(all)) return 0;
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      try { if (SK.isUnlocked(all[i], player)) n++; } catch (e) {}
    }
    return n;
  }
  function sumProfessionLevels(player) {
    var profs = (player && player.professions) || {};
    var sum = 0;
    var keys = Object.keys(profs);
    for (var i = 0; i < keys.length; i++) {
      var p = profs[keys[i]];
      if (p && typeof p.level === 'number') sum += p.level;
    }
    return sum;
  }
  function forgeCount(player) {
    var lk = player && player.luyenKhi;
    if (lk && lk.stats && typeof lk.stats.totalForged === 'number') return lk.stats.totalForged;
    return 0;
  }

  // ==========================================================================
  // DANH SÁCH THÀNH TỰU (PROVISIONAL ngưỡng)
  // ==========================================================================
  var ACHIEVEMENTS = [
    // Tu luyện
    { id: 'tuluyen_moc_5', cat: 'Tu luyện', name: 'Tiểu Mốc 5', desc: 'Đạt mốc tiểu cảnh giới 5.', counter: function (p) { return (p.tieuMoc && p.tieuMoc.moc) || 0; }, target: 5, reward: 50, title: 'Tu Luyện Sơ Thành' },
    { id: 'tuluyen_moc_10', cat: 'Tu luyện', name: 'Tiểu Mốc 10', desc: 'Đạt mốc tiểu cảnh giới 10.', counter: function (p) { return (p.tieuMoc && p.tieuMoc.moc) || 0; }, target: 10, reward: 100, title: 'Tu Luyện Tinh Nhuệ' },
    { id: 'tuluyen_moc_13', cat: 'Tu luyện', name: 'Tiểu Mốc 13 (Viên Mãn)', desc: 'Đạt mốc Trúc Cơ Viên Mãn.', counter: function (p) { return (p.tieuMoc && p.tieuMoc.moc) || 0; }, target: 13, reward: 200, title: 'Trúc Cơ Viên Mãn' },
    { id: 'tuluyen_trucco', cat: 'Tu luyện', name: 'Đột Phá Trúc Cơ', desc: 'Đột phá lên Trúc Cơ Sơ Kỳ.', counter: function (p) { return (p.realm || '').indexOf('Trúc Cơ') >= 0 ? 1 : 0; }, target: 1, reward: 150, title: 'Trúc Cơ Đạo Hữu' },
    { id: 'tuluyen_kimdan', cat: 'Tu luyện', name: 'Kết Kim Đan', desc: 'Đột phá lên Kim Đan.', counter: function (p) { return (p.realm || '').indexOf('Kim Đan') >= 0 ? 1 : 0; }, target: 1, reward: 300, title: 'Kim Đan Chân Nhân' },
    { id: 'tuluyen_thap_10', cat: 'Tu luyện', name: 'Leo Tháp 10', desc: 'Vượt tầng 10 Tháp Tu Luyện.', counter: function (p) { return ((p.thapTuLuyen || {}).bestFloor) || 0; }, target: 10, reward: 100 },
    { id: 'tuluyen_thap_25', cat: 'Tu luyện', name: 'Leo Tháp 25', desc: 'Vượt tầng 25 Tháp Tu Luyện.', counter: function (p) { return ((p.thapTuLuyen || {}).bestFloor) || 0; }, target: 25, reward: 200 },
    { id: 'tuluyen_thap_50', cat: 'Tu luyện', name: 'Leo Tháp 50', desc: 'Vượt tầng 50 Tháp Tu Luyện.', counter: function (p) { return ((p.thapTuLuyen || {}).bestFloor) || 0; }, target: 50, reward: 300, title: 'Người Leo Tháp' },
    { id: 'tuluyen_thap_100', cat: 'Tu luyện', name: 'Leo Tháp 100', desc: 'Vượt tầng 100 Tháp Tu Luyện.', counter: function (p) { return ((p.thapTuLuyen || {}).bestFloor) || 0; }, target: 100, reward: 500, title: 'Tháp Vương' },
    // Săn boss
    { id: 'boss_1', cat: 'Săn boss', name: 'Sơ Hạ Boss', desc: 'Hạ 1 boss.', counter: function (p) { return ((p.stats || {}).bossKills) || 0; }, target: 1, reward: 50 },
    { id: 'boss_5', cat: 'Săn boss', name: 'Thợ Săn Boss', desc: 'Hạ 5 boss.', counter: function (p) { return ((p.stats || {}).bossKills) || 0; }, target: 5, reward: 100 },
    { id: 'boss_20', cat: 'Săn boss', name: 'Sát Boss', desc: 'Hạ 20 boss.', counter: function (p) { return ((p.stats || {}).bossKills) || 0; }, target: 20, reward: 300, title: 'Sát Boss' },
    { id: 'boss_50', cat: 'Săn boss', name: 'Boss Bá Chủ', desc: 'Hạ 50 boss.', counter: function (p) { return ((p.stats || {}).bossKills) || 0; }, target: 50, reward: 500 },
    // Trồng trọt
    { id: 'harvest_10', cat: 'Trồng trọt', name: 'Thu Hoạch 10', desc: 'Thu hoạch 10 lần.', counter: function (p) { return ((p.stats || {}).harvests) || 0; }, target: 10, reward: 50 },
    { id: 'harvest_50', cat: 'Trồng trọt', name: 'Thu Hoạch 50', desc: 'Thu hoạch 50 lần.', counter: function (p) { return ((p.stats || {}).harvests) || 0; }, target: 50, reward: 150 },
    { id: 'harvest_100', cat: 'Trồng trọt', name: 'Nông Phu Linh Điền', desc: 'Thu hoạch 100 lần.', counter: function (p) { return ((p.stats || {}).harvests) || 0; }, target: 100, reward: 300, title: 'Nông Phu Linh Điền' },
    // Nghề
    { id: 'prof_5', cat: 'Nghề', name: 'Nghề Cấp 5', desc: 'Tổng cấp nghề đạt 5.', counter: function (p) { return sumProfessionLevels(p); }, target: 5, reward: 100 },
    { id: 'prof_15', cat: 'Nghề', name: 'Nghề Cấp 15', desc: 'Tổng cấp nghề đạt 15.', counter: function (p) { return sumProfessionLevels(p); }, target: 15, reward: 200 },
    { id: 'forge_5', cat: 'Nghề', name: 'Luyện Khí 5', desc: 'Rèn thành công 5 món.', counter: function (p) { return forgeCount(p); }, target: 5, reward: 100 },
    { id: 'forge_20', cat: 'Nghề', name: 'Luyện Khí 20', desc: 'Rèn thành công 20 món.', counter: function (p) { return forgeCount(p); }, target: 20, reward: 200 },
    // Sưu tầm trang bí tịch
    { id: 'skill_10', cat: 'Sưu tầm bí tịch', name: 'Nhập Môn Bí Tịch', desc: 'Mở khóa 10 chiêu.', counter: function (p) { return countUnlockedSkills(p); }, target: 10, reward: 100, title: 'Nhập Môn Bí Tịch' },
    { id: 'skill_25', cat: 'Sưu tầm bí tịch', name: 'Tàng Kinh Các', desc: 'Mở khóa 25 chiêu.', counter: function (p) { return countUnlockedSkills(p); }, target: 25, reward: 200 },
    { id: 'skill_40', cat: 'Sưu tầm bí tịch', name: 'Tàng Kinh Các Chủ', desc: 'Mở khóa 40 chiêu.', counter: function (p) { return countUnlockedSkills(p); }, target: 40, reward: 300, title: 'Tàng Kinh Các Chủ' },
    // Luận võ
    { id: 'luanvo_win_1', cat: 'Luận võ', name: 'Chiến Thắng Đầu Tiên', desc: 'Thắng 1 trận luận võ.', counter: function (p) { return ((p.luanVo || {}).wins) || 0; }, target: 1, reward: 100, title: 'Võ Sĩ Sảnh Thi Đấu' },
    { id: 'luanvo_win_5', cat: 'Luận võ', name: 'Võ Sĩ 5 Trận', desc: 'Thắng 5 trận luận võ.', counter: function (p) { return ((p.luanVo || {}).wins) || 0; }, target: 5, reward: 300 },
    { id: 'luanvo_period_1', cat: 'Luận võ', name: 'Vô Địch Một Kỳ', desc: 'Thắng ít nhất một kỳ luận võ.', counter: function (p) { return (((p.luanVo || {}).wonPeriods) || []).length; }, target: 1, reward: 150 },
    // Sổ tử
    { id: 'death_10', cat: 'Sổ tử', name: 'Thập Tử', desc: 'Gục 10 lần.', counter: function (p) { return (p.deathLog || []).length; }, target: 10, reward: 50 },
    { id: 'death_50', cat: 'Sổ tử', name: 'Ngũ Thập Tử', desc: 'Gục 50 lần.', counter: function (p) { return (p.deathLog || []).length; }, target: 50, reward: 100 },
    { id: 'death_100', cat: 'Sổ tử', name: 'Bất Khuất', desc: 'Gục 100 lần vẫn quay lại.', counter: function (p) { return (p.deathLog || []).length; }, target: 100, reward: 200, title: 'Bất Khuất' }
  ];

  // ==========================================================================
  // ĐÁNH GIÁ / TRAO THƯỞNG
  // ==========================================================================
  function evaluate(player) {
    var st = ensureState(player);
    if (!st || !player) return { newUnlocks: [] };
    var newUnlocks = [];
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var ach = ACHIEVEMENTS[i];
      if (st.achievements[ach.id]) continue;
      var val = 0;
      try { val = ach.counter(player) || 0; } catch (e) { val = 0; }
      if (val >= ach.target) {
        st.achievements[ach.id] = { at: Date.now(), value: val };
        player.linhThach = (player.linhThach || 0) + (ach.reward || 0);
        newUnlocks.push(ach);
      }
    }
    if (newUnlocks.length > 0) {
      save(player);
      toast('Thành tựu mới: ' + newUnlocks.length + ' (+' + newUnlocks.reduce(function (a, b) { return a + (b.reward || 0); }, 0) + ' Linh Thạch)');
    }
    return { newUnlocks: newUnlocks };
  }

  // ==========================================================================
  // DANH HIỆU
  // ==========================================================================
  function availableTitles(player) {
    ensureState(player);
    var out = [{ id: 'none', name: 'Chưa chọn danh hiệu' }];
    var seen = {};
    function add(name) {
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push({ id: name, name: name });
    }
    var deaths = (player && Array.isArray(player.deathLog)) ? player.deathLog.length : 0;
    if (deaths >= 100) add('Bất Khuất');
    var thap = (player && player.thapTuLuyen) ? (player.thapTuLuyen.bestFloor || 0) : 0;
    var milestones = (player && player.thapTuLuyen) ? (player.thapTuLuyen.milestones || {}) : {};
    if (thap >= 10 || milestones[10] || milestones['10']) add('Người Leo Tháp');
    var lv = (player && player.luanVo) ? player.luanVo : {};
    if ((lv.wins || 0) >= 1) add('Võ Sĩ Sảnh Thi Đấu');
    var bossKills = (player && player.stats) ? (player.stats.bossKills || 0) : 0;
    if (bossKills >= 20) add('Sát Boss');
    var harvests = (player && player.stats) ? (player.stats.harvests || 0) : 0;
    if (harvests >= 100) add('Nông Phu Linh Điền');
    var st = ensureState(player);
    if (st && st.achievements) {
      for (var i = 0; i < ACHIEVEMENTS.length; i++) {
        var ach = ACHIEVEMENTS[i];
        if (st.achievements[ach.id] && ach.title) add(ach.title);
      }
    }
    return out;
  }

  function getTitle(player) {
    var st = ensureState(player);
    return st ? st.title : null;
  }

  function setTitle(player, titleName) {
    var st = ensureState(player);
    if (!st || !player) return { ok: false };
    if (!titleName || titleName === 'none' || titleName === 'Chưa chọn danh hiệu') {
      st.title = null;
      player.title = null;
      save(player);
      return { ok: true };
    }
    var avail = availableTitles(player);
    var names = [];
    for (var i = 0; i < avail.length; i++) names.push(avail[i].name);
    if (names.indexOf(titleName) === -1) return { ok: false, reason: 'not_available' };
    st.title = titleName;
    player.title = titleName;
    save(player);
    return { ok: true };
  }

  function refreshTitle(player) {
    var el = document.getElementById('char-panel-title');
    if (el) {
      var t = (player && player.p2f) ? player.p2f.title : null;
      el.textContent = t ? t : 'Chưa chọn';
    }
  }

  // ==========================================================================
  // GIAO DIỆN
  // ==========================================================================
  var modalEl = null, modalBodyEl = null;

  function buildModal() {
    if (typeof document === 'undefined' || modalEl) return;
    modalEl = document.createElement('div');
    modalEl.id = 'p2f-modal';
    modalEl.className = 'modal-overlay hidden';

    var box = document.createElement('div');
    box.className = 'panel modal-box';

    var header = document.createElement('div');
    header.className = 'modal-header';
    var title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = 'SỔ THÀNH TỰU & SỔ TỬ';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () { closeModal(); });
    header.appendChild(title);
    header.appendChild(closeBtn);

    modalBodyEl = document.createElement('div');
    modalBodyEl.id = 'p2f-body';
    modalBodyEl.style.cssText = 'padding:6px 4px 2px;font-size:13px;line-height:1.9;max-height:70vh;overflow:auto;';

    var actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.style.marginTop = '14px';
    var closeBottom = document.createElement('button');
    closeBottom.type = 'button';
    closeBottom.className = 'btn wood';
    closeBottom.textContent = 'Đóng';
    closeBottom.addEventListener('click', function () { closeModal(); });
    actions.appendChild(closeBottom);

    box.appendChild(header);
    box.appendChild(modalBodyEl);
    box.appendChild(actions);
    modalEl.appendChild(box);
    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
    document.body.appendChild(modalEl);
  }

  function renderAchievements(player) {
    var st = ensureState(player);
    var groups = {};
    var order = [];
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var ach = ACHIEVEMENTS[i];
      if (!groups[ach.cat]) { groups[ach.cat] = []; order.push(ach.cat); }
      groups[ach.cat].push(ach);
    }
    var html = '';
    for (var c = 0; c < order.length; c++) {
      var cat = order[c];
      html += '<h3 class="section-title" style="margin-top:10px;">' + cat + '</h3>';
      var list = groups[cat];
      for (var j = 0; j < list.length; j++) {
        var ach = list[j];
        var unlocked = !!(st && st.achievements && st.achievements[ach.id]);
        var val = 0;
        try { val = ach.counter(player) || 0; } catch (e) { val = 0; }
        var progress = Math.min(val, ach.target);
        var status = unlocked ? '✓ đã nhận' : (progress + '/' + ach.target);
        html += '<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed rgba(200,180,120,.18);padding:3px 0;">' +
          '<span>' + (unlocked ? '✓ ' : '') + ach.name + '</span>' +
          '<b style="color:' + (unlocked ? '#9fe870' : '#ffe9a8') + ';">' + status + '</b></div>';
        html += '<div style="font-size:11px;color:#9a8f76;margin-bottom:4px;">' + ach.desc +
          (ach.reward ? ' · Thưởng +' + ach.reward + ' Linh Thạch' : '') + '</div>';
      }
    }
    return html;
  }

  function renderDeathLog(player) {
    var log = (player && Array.isArray(player.deathLog)) ? player.deathLog : [];
    var html = '<h3 class="section-title" style="margin-top:10px;">Sổ Tử</h3>';
    html += '<div><b>Số lần gục:</b> ' + log.length + ' / ' + DEATH_LOG_CAP + '</div>';
    if (log.length === 0) {
      html += '<div style="color:#9a8f76;">Chưa có bản ghi.</div>';
      return html;
    }
    var recent = log.slice(-15).reverse();
    html += '<div style="margin-top:6px;max-height:200px;overflow:auto;border:1px solid rgba(200,180,120,.2);padding:4px;border-radius:6px;">';
    for (var i = 0; i < recent.length; i++) {
      var e = recent[i];
      var when = '';
      try { when = new Date(e.at).toLocaleString(); } catch (err) { when = ''; }
      html += '<div style="border-bottom:1px dashed rgba(200,180,120,.15);padding:3px 0;">' +
        '<b>#' + (e.id || '') + '</b> · ' + (e.mapName || e.mapId || '—') +
        ' · ' + (e.killerName || e.cause || '—') + ' · ' + when + '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderModal() {
    if (!modalBodyEl) return;
    var player = getPlayer();
    evaluate(player);
    var st = ensureState(player);
    var titles = availableTitles(player);
    var cur = getTitle(player);

    var html = '';
    // Danh hiệu
    html += '<h3 class="section-title">Danh Hiệu Đang Chọn</h3>';
    html += '<div style="margin-bottom:8px;"><b>' + (cur ? cur : 'Chưa chọn') + '</b></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      var label = t.name + (t.name === cur ? ' (đang chọn)' : '');
      html += '<button type="button" class="btn wood" data-p2f-title="' + t.name + '" style="font-size:12px;padding:4px 8px;">' + label + '</button>';
    }
    html += '</div>';

    // Thành tựu
    html += renderAchievements(player);
    // Sổ tử
    html += renderDeathLog(player);

    modalBodyEl.innerHTML = html;

    // wire title buttons
    var btns = modalBodyEl.querySelectorAll('[data-p2f-title]');
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute('data-p2f-title');
          setTitle(player, name);
          refreshTitle(player);
          renderModal();
        });
      })(btns[b]);
    }
  }

  function openModal() {
    buildModal();
    if (!modalEl) return;
    renderModal();
    modalEl.classList.remove('hidden');
  }
  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
  }

  function init() {
    if (typeof window === 'undefined') return;
    buildModal();
    var btn = document.getElementById('btn-p2f-open');
    if (btn) btn.addEventListener('click', openModal);
  }

  exports.ensureState = ensureState;
  exports.evaluate = evaluate;
  exports.availableTitles = availableTitles;
  exports.getTitle = getTitle;
  exports.setTitle = setTitle;
  exports.refreshTitle = refreshTitle;
  exports.openModal = openModal;
  exports.closeModal = closeModal;

  if (typeof window !== 'undefined') {
    window.GameP2F = exports;
    // init sau khi DOM sẵn sàng
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof module !== 'undefined' && module.exports ? module.exports : {});
