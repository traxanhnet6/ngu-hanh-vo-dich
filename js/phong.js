/**
 * phong.js — Đợt ƯU TIÊN (2026-11-23): LỆNH MỞ PHONG + BẢNG PHONG.
 *
 * Mọi số/tên mới đều PROVISIONAL ("số tạm, chờ Bui chốt"):
 *   - Trần 12 phong, 1 người 1 phong, tối đa 30 thành viên/phong.
 *   - Tên phong duy nhất toàn hệ thống, 2–8 ký tự.
 *   - Lợi tức tuần: 100 Linh Thạch + 50 điểm cống hiến, chu kỳ 7 ngày.
 *   - Buff (Bui duyệt 22:37 2026-11-23, thay buff săn quái cũ):
 *     THIỀN trong khu vực phong của mình được +25% tu vi thổ nạp (SỐ TẠM,
 *     chờ Bui chốt — hằng PEAK_MEDITATE_BUFF dưới đây; móc ở nhịp thiền P2A
 *     trong js/engine.js, chỉ khi isInOwnPeakZone()). Buff cũ đã gỡ:
 *     Đỉnh Tiên Môn không có quái nên gần như không kích hoạt được.
 *   - Đất phong: DÙNG MAP CÓ SẴN Đỉnh Tiên Môn (dinh-tien-mon, 6 khu);
 *     mỗi phong gắn 1 khu (khu thứ 7 trở đi quay vòng lại 6 khu — 12 phong
 *     mà chỉ có 6 khu là điểm hở đã ghi trong báo cáo đợt; map đỉnh riêng
 *     cho từng phong để pha online). Khu vực lấy đúng rect của
 *     ZONES_DINH_TIEN_MON trong js/mapdata.js.
 *
 * Bản đơn: sổ phong lưu trong save (player.peaks[] + player.peak).
 * Server online CHỈ THIẾT KẾ trong báo cáo đợt, KHÔNG triển khai ở đây.
 *
 * Module thuần + DOM theo khuôn js/dotpha.js: Node-loadable (module.exports)
 * và chạy trên trình duyệt (window.GamePhong).
 */
(function (exports) {
  'use strict';

  // --- Hằng số tạm (PROVISIONAL, chờ Bui chốt) ---
  var MAX_PEAKS = 12;            // trần số phong toàn hệ thống
  var MEMBER_LIMIT = 30;         // tối đa thành viên/phong
  var NAME_MIN_LEN = 2;          // tên phong 2–8 ký tự
  var NAME_MAX_LEN = 8;
  var WEEK_MS = 7 * 24 * 3600 * 1000;  // chu kỳ lợi tức tuần
  var WEEKLY_INCOME_LT = 100;    // lợi tức tuần: Linh Thạch
  var WEEKLY_INCOME_CONTRIB = 50; // lợi tức tuần: điểm cống hiến
  var PEAK_MEDITATE_BUFF = 0.25; // +25% tu vi thổ nạp khi THIỀN trong khu phong mình (SỐ TẠM, chờ Bui chốt — Bui duyệt 22:37 2026-11-23, thay buff săn quái cũ đã gỡ)
  var ORDER_ITEM_ID = 'lenh-mo-phong';
  var ORDER_ITEM_NAME = 'Lệnh Mở Phong';

  // 6 khu trên Đỉnh Tiên Môn — tâm điểm lấy đúng từ ZONES_DINH_TIEN_MON
  // (js/mapdata.js); chỉ ghi tâm (teleport) + tên, rect đầy đủ vẫn nằm ở
  // mapdata làm nguồn sự thật duy nhất cho va chạm/khu vực.
  var PEAK_ZONES = [
    { id: 'san_luan_vo', name: 'Sàn Luận Võ', cx: 960, cy: 375 },
    { id: 'noi_tinh_toa', name: 'Nơi Tĩnh Tọa', cx: 312, cy: 352 },
    { id: 'sanh_phong', name: 'Sảnh Phong', cx: 1372, cy: 360 },
    { id: 'vuon_duoc', name: 'Vườn Dược', cx: 625, cy: 750 },
    { id: 'san_luyen', name: 'Sân Luyện', cx: 1242, cy: 757 },
    { id: 'loi_len_dinh', name: 'Lối Lên Đỉnh', cx: 962, cy: 1090 }
  ];

  var PEAK_ORDER_SOURCES = [
    'Boss Bí Cảnh Trời Mở (cuối, thứ 7 20:00): rơi 10% (số tạm).',
    'Bí Cảnh Thủ Hộ (thắng đợt waves): rơi 5% (số tạm).',
    'Bí Cảnh Thường Trực boss tầng 5: rơi 2% (số tạm).',
    'Nhiệm vụ tông môn lớn "Lập Phong Đại Điển": mở ở Trúc Cơ, yêu cầu 500 điểm cống hiến tông môn (tích lũy — số tạm), hoàn thành thưởng 1 Lệnh.'
  ];

  // --- Truy cập module khác ---
  function root() {
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined') return globalThis;
    return {};
  }
  function stateAPI() {
    var r = root();
    if (r.GameState) return r.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }
  function engineAPI() {
    var r = root();
    return r.GameEngine || null;
  }
  function uiAPI() {
    var r = root();
    return r.GameUI || null;
  }

  function getRealmRank(player) {
    var st = stateAPI();
    if (st && typeof st.getRealmRank === 'function') return st.getRealmRank(player);
    if (!player || !player.realm) return 0;
    var r = player.realm;
    if (r === 'Phàm Nhân') return 0;
    if (r.indexOf('Luyện Khí') !== -1) {
      var m = r.match(/tầng (\d+)/);
      return m ? parseInt(m[1], 10) : 1;
    }
    if (r === 'Trúc Cơ Sơ Kỳ') return 10;
    if (r === 'Trúc Cơ Trung Kỳ') return 11;
    if (r === 'Trúc Cơ Hậu Kỳ') return 12;
    if (r === 'Trúc Cơ Viên Mãn') return 13;
    if (r.indexOf('Kim Đan') !== -1) return 14;
    return 0;
  }

  function bagCount(player, itemId) {
    var st = stateAPI();
    if (st && typeof st.countItemInBag === 'function') return st.countItemInBag(player, itemId);
    var n = 0;
    var bag = (player && player.bag) || [];
    for (var i = 0; i < bag.length; i++) {
      if (bag[i] && bag[i].itemId === itemId) n += bag[i].count || 0;
    }
    return n;
  }

  function removeFromBag(player, itemId, count) {
    var st = stateAPI();
    if (st && typeof st.removeItemFromBag === 'function') return st.removeItemFromBag(player, itemId, count);
    return false;
  }

  function savePlayer(player) {
    var st = stateAPI();
    if (st && typeof st.savePlayer === 'function') st.savePlayer(player);
  }

  function toast(msg) {
    var ui = uiAPI();
    if (ui && typeof ui.showToast === 'function') ui.showToast(msg);
  }

  // Trạng thái phong nằm trên bản lưu: player.peaks = [] (sổ phong bản đơn),
  // player.peak = null | { id, name, role, zoneId, zoneName }.
  // Khởi tạo lười: bản lưu cũ không có trường này vẫn tải bình thường.
  function ensureState(player) {
    if (!player) return null;
    if (!Array.isArray(player.peaks)) player.peaks = [];
    if (typeof player.peak === 'undefined') player.peak = null;
    return player;
  }

  function getPeaks(player) {
    ensureState(player);
    return player.peaks;
  }

  function findPeak(player, peakId) {
    var list = getPeaks(player);
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === peakId) return list[i];
    }
    return null;
  }

  function myPeak(player) {
    ensureState(player);
    if (!player.peak) return null;
    return findPeak(player, player.peak.id);
  }

  function isFounder(player, peak) {
    return !!(player && peak && peak.founder === player.name);
  }

  // --- Điều kiện lập phong (a): Trúc Cơ+ + có Lệnh + chưa làm Phong Chủ
  // + tổng số phong < 12. Trả { ok, checks: [{key, label, ok, detail}] }.
  function checkFoundConditions(player) {
    ensureState(player);
    var rank = getRealmRank(player);
    var hasOrder = bagCount(player, ORDER_ITEM_ID) >= 1;
    var alreadyFounder = !!(player.peak && player.peak.role === 'Phong Chủ');
    var underCap = getPeaks(player).length < MAX_PEAKS;
    var checks = [
      { key: 'realm', label: 'Cảnh giới Trúc Cơ trở lên', ok: rank >= 10, detail: rank >= 10 ? 'đã đạt' : 'chưa đạt (hiện tại: ' + (player.realm || 'Phàm Nhân') + ')' },
      { key: 'order', label: 'Trong túi có 1 ' + ORDER_ITEM_NAME, ok: hasOrder, detail: hasOrder ? 'đã có' : 'chưa có — xem nguồn Lệnh bên dưới' },
      { key: 'founder', label: 'Chưa làm Phong Chủ của phong nào (1 người 1 phong)', ok: !alreadyFounder, detail: alreadyFounder ? 'đã là Phong Chủ của "' + player.peak.name + '"' : 'chưa làm Phong Chủ' },
      { key: 'cap', label: 'Tổng số phong < ' + MAX_PEAKS + ' (trần tạm)', ok: underCap, detail: getPeaks(player).length + '/' + MAX_PEAKS + ' phong' }
    ];
    var ok = true;
    for (var i = 0; i < checks.length; i++) if (!checks[i].ok) ok = false;
    return { ok: ok, checks: checks };
  }

  // --- Tên phong (d): 2–8 ký tự, duy nhất trong sổ phong. ---
  function validatePeakName(player, rawName) {
    var name = (rawName || '').trim();
    if (!name) return { ok: false, reason: 'empty', msg: 'Hãy nhập tên phong.' };
    if (name.length < NAME_MIN_LEN || name.length > NAME_MAX_LEN) {
      return { ok: false, reason: 'length', msg: 'Tên phong phải dài ' + NAME_MIN_LEN + '–' + NAME_MAX_LEN + ' ký tự (hiện tại ' + name.length + ').' };
    }
    var list = getPeaks(player);
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].name === name) {
        return { ok: false, reason: 'duplicate', msg: 'Tên phong "' + name + '" đã có người lập — hãy chọn tên khác.' };
      }
    }
    return { ok: true, name: name };
  }

  // --- Lập phong: kiểm tra (a) + (d) + (e) → trừ 1 Lệnh → ghi vào save. ---
  function foundPeak(player, rawName) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Chưa có nhân vật.' };
    ensureState(player);
    var cond = checkFoundConditions(player);
    if (!cond.ok) {
      for (var i = 0; i < cond.checks.length; i++) {
        if (!cond.checks[i].ok) return { ok: false, reason: cond.checks[i].key, msg: 'Chưa đủ điều kiện lập phong: ' + cond.checks[i].label + ' — ' + cond.checks[i].detail + '.' };
      }
      return { ok: false, reason: 'conditions', msg: 'Chưa đủ điều kiện lập phong.' };
    }
    var vn = validatePeakName(player, rawName);
    if (!vn.ok) return vn;
    var name = vn.name;
    if (!removeFromBag(player, ORDER_ITEM_ID, 1)) {
      return { ok: false, reason: 'order', msg: 'Không trừ được ' + ORDER_ITEM_NAME + ' khỏi túi.' };
    }
    var zone = PEAK_ZONES[getPeaks(player).length % PEAK_ZONES.length];
    var peak = {
      id: 'peak_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      name: name,
      founder: player.name,
      members: [{ name: player.name, role: 'Phong Chủ' }],
      deputy: null,
      zoneId: zone.id,
      zoneName: zone.name,
      createdAt: Date.now(),
      incomeClaimedAt: 0
    };
    player.peaks.push(peak);
    player.peak = { id: peak.id, name: peak.name, role: 'Phong Chủ', zoneId: zone.id, zoneName: zone.name };
    savePlayer(player);
    return { ok: true, peak: peak, msg: 'Đã lập phong "' + name + '" tại khu ' + zone.name + ' trên Đỉnh Tiên Môn! Ngươi là Phong Chủ.' };
  }

  // --- Lợi tức tuần (h): 100 Linh Thạch + 50 cống hiến, chu kỳ 7 ngày. ---
  function incomeStatus(player, nowMs) {
    var peak = myPeak(player);
    if (!peak) return { ok: false, reason: 'no_peak', msg: 'Chưa có phong để nhận lợi tức.' };
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    var last = peak.incomeClaimedAt || 0;
    var next = last + WEEK_MS;
    if (last && nowMs < next) {
      var remainDays = Math.ceil((next - nowMs) / (24 * 3600 * 1000));
      return { ok: false, reason: 'cooldown', msg: 'Lợi tức tuần đã nhận — còn ' + remainDays + ' ngày nữa mới nhận tiếp.', nextMs: next };
    }
    return { ok: true, peak: peak };
  }

  function claimWeeklyIncome(player, nowMs) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Chưa có nhân vật.' };
    var st = incomeStatus(player, nowMs);
    if (!st.ok) return st;
    var peak = st.peak;
    nowMs = (nowMs !== undefined) ? nowMs : Date.now();
    player.linhThach = (player.linhThach || 0) + WEEKLY_INCOME_LT;
    if (player.questState && player.questState.sect) {
      player.questState.sect.contribution = (player.questState.sect.contribution || 0) + WEEKLY_INCOME_CONTRIB;
      player.questState.sect.lifetimeContribution = (player.questState.sect.lifetimeContribution || 0) + WEEKLY_INCOME_CONTRIB;
    }
    peak.incomeClaimedAt = nowMs;
    savePlayer(player);
    return { ok: true, peak: peak, linhThach: WEEKLY_INCOME_LT, contribution: WEEKLY_INCOME_CONTRIB, msg: 'Đã nhận lợi tức tuần của phong "' + peak.name + '": +' + WEEKLY_INCOME_LT + ' Linh Thạch, +' + WEEKLY_INCOME_CONTRIB + ' điểm cống hiến.' };
  }

  // --- Quyền Phong Chủ (b): bổ nhiệm Phó Phong Chủ, giải tán phong. ---
  // Bản đơn: danh sách thành viên chỉ có người lập (dữ liệu + giao diện
  // làm sẵn cho online — mời/đuổi thành viên thật để pha online).
  function appointDeputy(player, memberName) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Chưa có nhân vật.' };
    var peak = myPeak(player);
    if (!peak) return { ok: false, reason: 'no_peak', msg: 'Chưa có phong.' };
    if (!isFounder(player, peak)) return { ok: false, reason: 'not_founder', msg: 'Chỉ Phong Chủ mới bổ nhiệm Phó Phong Chủ.' };
    if (!memberName || memberName === player.name) return { ok: false, reason: 'invalid_member', msg: 'Phó Phong Chủ phải là thành viên khác (bản đơn chỉ có người lập nên chưa bổ nhiệm được).' };
    var found = false;
    for (var i = 0; i < peak.members.length; i++) {
      if (peak.members[i].name === memberName) found = true;
    }
    if (!found) return { ok: false, reason: 'not_member', msg: memberName + ' không phải thành viên phong.' };
    peak.deputy = memberName;
    for (var j = 0; j < peak.members.length; j++) {
      if (peak.members[j].name === memberName) peak.members[j].role = 'Phó Phong Chủ';
    }
    savePlayer(player);
    return { ok: true, peak: peak, msg: 'Đã bổ nhiệm ' + memberName + ' làm Phó Phong Chủ.' };
  }

  function dissolvePeak(player) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Chưa có nhân vật.' };
    var peak = myPeak(player);
    if (!peak) return { ok: false, reason: 'no_peak', msg: 'Chưa có phong để giải tán.' };
    if (!isFounder(player, peak)) return { ok: false, reason: 'not_founder', msg: 'Chỉ Phong Chủ mới giải tán phong.' };
    var list = getPeaks(player);
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === peak.id) { list.splice(i, 1); break; }
    }
    var name = peak.name;
    player.peak = null;
    savePlayer(player);
    return { ok: true, msg: 'Đã giải tán phong "' + name + '".' };
  }

  // --- Điểm dịch chuyển "về phong" (g): tâm khu vực trên Đỉnh Tiên Môn. ---
  function getPeakZone(peak) {
    if (!peak) return null;
    for (var i = 0; i < PEAK_ZONES.length; i++) {
      if (PEAK_ZONES[i].id === peak.zoneId) return PEAK_ZONES[i];
    }
    return PEAK_ZONES[0];
  }

  function teleportToPeak(player) {
    var peak = myPeak(player);
    if (!peak) return { ok: false, reason: 'no_peak', msg: 'Chưa có phong để về.' };
    var zone = getPeakZone(peak);
    var eng = engineAPI();
    if (!eng || typeof eng.teleportTo !== 'function') return { ok: false, reason: 'no_engine', msg: 'Không gọi được dịch chuyển.' };
    closePanel();
    eng.teleportTo('dinh-tien-mon', zone.cx, zone.cy);
    return { ok: true, peak: peak, zone: zone, msg: 'Đã về phong "' + peak.name + '" (' + zone.name + ', Đỉnh Tiên Môn).' };
  }

  // --- Tỉ lệ rơi Lệnh ở bí cảnh (f) — dùng chung cho bi-canh.js. ---
  var ORDER_DROP_RATES = { troi_mo: 0.10, thu_ho: 0.05, thuong_truc: 0.02 };
  function rollPeakOrderDrop(dungeonId, rand) {
    var rate = ORDER_DROP_RATES[dungeonId];
    if (typeof rate !== 'number') return { ok: false, reason: 'unknown_dungeon' };
    var r = (typeof rand === 'number') ? rand : Math.random();
    return { ok: true, dropped: r < rate, rate: rate, roll: r };
  }

  // =========================================================================
  // BẢNG PHONG (DOM — bản sao khuôn dotpha.js). Chỉ HIỂN THỊ + gọi đúng các
  // hàm thuần trên; không tự quyết số liệu.
  // =========================================================================
  var playerRef = null;
  var modalEl = null;
  var bodyEl = null;
  var wired = false;
  var dissolveArmed = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (typeof text === 'string') e.textContent = text;
    return e;
  }

  function getPlayer() {
    if (playerRef) return playerRef;
    var eng = engineAPI();
    if (eng && typeof eng.getPlayer === 'function') return eng.getPlayer();
    return null;
  }

  function renderPanel() {
    if (!bodyEl) return;
    var p = getPlayer();
    bodyEl.innerHTML = '';
    if (!p) {
      bodyEl.appendChild(el('p', 'tieumoc-note', 'Chưa có nhân vật.'));
      return;
    }
    ensureState(p);
    dissolveArmed = false;

    bodyEl.appendChild(el('p', 'tieumoc-note',
      'Phong là đỉnh riêng của một tu sĩ trên Đỉnh Tiên Môn. Lập phong cần cảnh giới Trúc Cơ trở lên + 1 Lệnh Mở Phong. Mọi số dưới đây là SỐ TẠM, chờ Bui chốt: trần 12 phong, 1 người 1 phong, tối đa 30 thành viên/phong, lợi tức tuần 100 Linh Thạch + 50 điểm cống hiến.'));

    // --- Điều kiện lập phong ---
    var cond = checkFoundConditions(p);
    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Điều kiện lập phong'));
    for (var i = 0; i < cond.checks.length; i++) {
      var c = cond.checks[i];
      var row = el('div', 'tieumoc-row' + (c.ok ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
      row.appendChild(el('span', 'tieumoc-row-label', c.label));
      row.appendChild(el('span', 'tieumoc-row-value', c.detail));
      bodyEl.appendChild(row);
    }

    var mine = myPeak(p);
    if (!mine) {
      // --- Chưa có phong: nguồn Lệnh + form lập phong ---
      bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Nguồn Lệnh Mở Phong (số tạm)'));
      for (var s = 0; s < PEAK_ORDER_SOURCES.length; s++) {
        bodyEl.appendChild(el('p', 'tieumoc-note', '• ' + PEAK_ORDER_SOURCES[s]));
      }
      bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Lập phong mới'));
      var formRow = el('div', 'tieumoc-row');
      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'phong-name-input';
      input.placeholder = 'Tên phong (2–8 ký tự, duy nhất)';
      input.maxLength = 8;
      input.style.cssText = 'flex:1;padding:8px;border-radius:6px;border:1px solid #888;background:#222;color:#fff;';
      formRow.appendChild(input);
      var btnFound = el('button', 'btn gold tieumoc-btn', 'Lập Phong (tốn 1 Lệnh)');
      btnFound.type = 'button';
      btnFound.id = 'phong-btn-found';
      btnFound.addEventListener('click', function () {
        var res = foundPeak(p, input.value);
        toast(res.msg);
        renderPanel();
        var ui = uiAPI();
        if (ui && typeof ui.refreshHUD === 'function') ui.refreshHUD();
      });
      formRow.appendChild(btnFound);
      bodyEl.appendChild(formRow);
      bodyEl.appendChild(el('p', 'tieumoc-note', 'Lập phong trừ 1 Lệnh Mở Phong trong túi. Khu vực phong là 1 trong 6 khu có sẵn trên Đỉnh Tiên Môn (Sàn Luận Võ, Nơi Tĩnh Tọa, Sảnh Phong, Vườn Dược, Sân Luyện, Lối Lên Đỉnh) — phong thứ 7 trở đi quay vòng lại các khu này.'));
    } else {
      // --- Đã có phong: thông tin + quyền Phong Chủ ---
      bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Phong của ngươi'));
      var info = el('div', 'tieumoc-row tieumoc-row-ok');
      info.appendChild(el('span', 'tieumoc-row-label', '"' + mine.name + '" — ' + (p.peak.role || 'Phong Chủ')));
      info.appendChild(el('span', 'tieumoc-row-value', 'Khu vực: ' + mine.zoneName + ' · Phong Chủ: ' + mine.founder + (mine.deputy ? ' · Phó: ' + mine.deputy : '')));
      bodyEl.appendChild(info);
      bodyEl.appendChild(el('p', 'tieumoc-note', 'Thiền trong khu phong: +25% tu vi — số tạm, chờ Bui chốt. Tuyên chiến tranh đỉnh chỉ ghi nhận ý định ở bản đơn — trận thật ở pha online.'));

      var inc = incomeStatus(p);
      var incRow = el('div', 'tieumoc-row' + (inc.ok ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
      incRow.appendChild(el('span', 'tieumoc-row-label', 'Lợi tức tuần'));
      incRow.appendChild(el('span', 'tieumoc-row-value', inc.ok ? 'Sẵn sàng nhận: +' + WEEKLY_INCOME_LT + ' Linh Thạch, +' + WEEKLY_INCOME_CONTRIB + ' cống hiến' : inc.msg));
      if (inc.ok) {
        var btnInc = el('button', 'btn gold tieumoc-btn', 'Nhận lợi tức');
        btnInc.type = 'button';
        btnInc.id = 'phong-btn-income';
        btnInc.addEventListener('click', function () {
          var res = claimWeeklyIncome(p);
          toast(res.msg);
          renderPanel();
          var ui = uiAPI();
          if (ui && typeof ui.refreshHUD === 'function') ui.refreshHUD();
        });
        incRow.appendChild(btnInc);
      }
      bodyEl.appendChild(incRow);

      var actions = el('div', 'tieumoc-actions');
      var btnHome = el('button', 'btn gold tieumoc-btn', 'Về phong (' + mine.zoneName + ')');
      btnHome.type = 'button';
      btnHome.id = 'phong-btn-home';
      btnHome.addEventListener('click', function () {
        var res = teleportToPeak(p);
        if (!res.ok) toast(res.msg);
      });
      actions.appendChild(btnHome);
      var btnDissolve = el('button', 'btn wood tieumoc-btn', 'Giải tán phong');
      btnDissolve.type = 'button';
      btnDissolve.id = 'phong-btn-dissolve';
      btnDissolve.addEventListener('click', function () {
        if (!dissolveArmed) {
          dissolveArmed = true;
          btnDissolve.textContent = 'Chắc chắn giải tán? Bấm lại để xác nhận';
          return;
        }
        var res = dissolvePeak(p);
        toast(res.msg);
        renderPanel();
      });
      actions.appendChild(btnDissolve);
      bodyEl.appendChild(actions);

      bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Thành viên (' + mine.members.length + '/' + MEMBER_LIMIT + ')'));
      for (var m = 0; m < mine.members.length; m++) {
        var mRow = el('div', 'tieumoc-row tieumoc-row-ok');
        mRow.appendChild(el('span', 'tieumoc-row-label', mine.members[m].name));
        mRow.appendChild(el('span', 'tieumoc-row-value', mine.members[m].role));
        bodyEl.appendChild(mRow);
      }
      bodyEl.appendChild(el('p', 'tieumoc-note', 'Bản đơn: danh sách chỉ có người lập. Mời/đuổi thành viên và bổ nhiệm Phó Phong Chủ cho người khác để pha online (khi đó mới có thành viên khác để bổ nhiệm).'));
    }

    // --- Danh sách phong (bản đơn) ---
    var list = getPeaks(p);
    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Danh sách phong (' + list.length + '/' + MAX_PEAKS + ')'));
    if (!list.length) {
      bodyEl.appendChild(el('p', 'tieumoc-note', 'Chưa có phong nào được lập.'));
    } else {
      for (var li = 0; li < list.length; li++) {
        var pk = list[li];
        var pRow = el('div', 'tieumoc-row tieumoc-row-ok');
        pRow.appendChild(el('span', 'tieumoc-row-label', '"' + pk.name + '"'));
        pRow.appendChild(el('span', 'tieumoc-row-value', 'Phong Chủ: ' + pk.founder + ' · ' + pk.zoneName + ' · ' + pk.members.length + ' thành viên'));
        bodyEl.appendChild(pRow);
      }
    }

    var closeRow = el('div', 'tieumoc-actions');
    var btnClose = el('button', 'btn wood tieumoc-btn', 'Đóng bảng');
    btnClose.type = 'button';
    btnClose.id = 'phong-btn-close';
    btnClose.addEventListener('click', closePanel);
    closeRow.appendChild(btnClose);
    bodyEl.appendChild(closeRow);
  }

  function openPanel() {
    if (!modalEl) return;
    renderPanel();
    modalEl.classList.remove('hidden');
  }

  function closePanel() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
  }

  function attach(player) {
    if (player) {
      playerRef = player;
      ensureState(player);
    }
    if (wired) return;
    modalEl = document.getElementById('phong-modal');
    bodyEl = document.getElementById('phong-body');
    if (!modalEl || !bodyEl) return;
    wired = true;
    var closeX = document.getElementById('close-phong-modal');
    if (closeX) closeX.addEventListener('click', closePanel);
    modalEl.addEventListener('click', function (ev) {
      if (ev.target === modalEl) closePanel();
    });
    var openBtn = document.getElementById('btn-phong-open');
    if (openBtn) openBtn.addEventListener('click', openPanel);
  }

  var api = {
    MAX_PEAKS: MAX_PEAKS,
    MEMBER_LIMIT: MEMBER_LIMIT,
    NAME_MIN_LEN: NAME_MIN_LEN,
    NAME_MAX_LEN: NAME_MAX_LEN,
    WEEK_MS: WEEK_MS,
    WEEKLY_INCOME_LT: WEEKLY_INCOME_LT,
    WEEKLY_INCOME_CONTRIB: WEEKLY_INCOME_CONTRIB,
    PEAK_MEDITATE_BUFF: PEAK_MEDITATE_BUFF,
    ORDER_ITEM_ID: ORDER_ITEM_ID,
    PEAK_ZONES: PEAK_ZONES,
    PEAK_ORDER_SOURCES: PEAK_ORDER_SOURCES,
    ORDER_DROP_RATES: ORDER_DROP_RATES,
    ensureState: ensureState,
    getPeaks: getPeaks,
    myPeak: myPeak,
    checkFoundConditions: checkFoundConditions,
    validatePeakName: validatePeakName,
    foundPeak: foundPeak,
    incomeStatus: incomeStatus,
    claimWeeklyIncome: claimWeeklyIncome,
    appointDeputy: appointDeputy,
    dissolvePeak: dissolvePeak,
    getPeakZone: getPeakZone,
    teleportToPeak: teleportToPeak,
    rollPeakOrderDrop: rollPeakOrderDrop,
    attach: attach,
    openPanel: openPanel,
    closePanel: closePanel
  };

  var r = root();
  r.GamePhong = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
