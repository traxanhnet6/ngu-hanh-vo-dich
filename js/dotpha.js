/**
 * dotpha.js — Đợt T2: ĐỘT PHÁ ĐẠI CẢNH GIỚI Trúc Cơ + BẢNG ĐỘT PHÁ.
 *
 * PHÁN CỦA BUI 14:12 ngày 2026-11-10: "Giữ 100% như hiện tại, chỉ thêm độ
 * kiếp diễn thật". Theo phán này:
 *   - Tỉ lệ đột phá KHÓA 1.0 (100%) như bản live: đủ điều kiện là thành
 *     công, tryBreakthrough (js/engine.js) không có nhánh thất bại và
 *     không có đường mã án phạt nào.
 *   - Bản nháp trước của đợt (tỉ lệ 80%, phạt mất nửa nguyên liệu, Hộ Mạch
 *     Đan/Định Căn Đan cộng tỉ lệ/chặn phạt, kỳ trân cộng tỉ lệ theo đường
 *     yếu nhất) ĐÃ HỦY theo lệnh Bui — toàn bộ mã liên quan đã gỡ sạch;
 *     công thức/ý tưởng của bản nháp chỉ còn ghi trong báo cáo đợt
 *     (game-ngu-hanh-design/wave-reports-2026-11-10/t2-report.md).
 *
 * Module này giữ:
 *   1. CONFIG — cấu hình đột phá ở MỘT chỗ duy nhất (tỉ lệ khóa + số tia).
 *   2. Bảng Đột Phá Trúc Cơ (bản sao khuôn bảng tieumoc.js): liệt kê đủ/
 *      thiếu từng đường tu vi, Trúc Cơ Đan và từng nguyên liệu gốc của
 *      công thức, kèm nút Chỉ đường theo chuẩn T1 cho mục còn thiếu.
 *   3. Dẫn đường đột phá: engine.getQuestTargetInfo hỏi module này khi
 *      người chơi đã chọn một mục tiêu trong bảng (player.dotPha.focus).
 *
 * CÔNG THỨC Trúc Cơ Đan — Đợt ƯU TIÊN (2026-11-23) VỀ CHUẨN ĐÃ DUYỆT
 * (Bui duyệt 19:05 ngày 2026-11-01): 1 Linh Chi Sau Núi + 1 Yêu Đan cấp 1
 * + 3 Thanh Tâm Thảo + 30 Linh Thạch (phí tính ở bước luyện). "Sau Núi" =
 * Sơn Cốc (ánh xạ TẠM, chờ Bui chốt). Công thức cũ (3 Linh Chi Rừng +
 * 1 Băng Tủy + 2 Hỏa Tinh Thổ + 1 Nguyên Tinh Mộc + 1 Nguyên Tinh Thủy +
 * 200 Linh Thạch) đã bỏ.
 */
(function () {
  'use strict';

  // =========================================================================
  // CẤU HÌNH ĐỘT PHÁ — MỘT CHỖ DUY NHẤT.
  // successRate khóa 1.0 theo phán của Bui 2026-11-10. Hạ con số này xuống
  // dưới 1.0 KHÔNG tự sinh ra nhánh thất bại: tryBreakthrough hiện không
  // có nhánh thất bại — muốn đổi luật phải cài lại cả nhánh theo lệnh mới.
  // =========================================================================
  var CONFIG = {
    successRate: 1.0,
    bolts: 3
  };

  var PATH_KEYS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
  var PATH_VI = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  var PILL_ID = 'truc-co-dan';
  var PILL_NAME = 'Trúc Cơ Đan';
  // Nguyên liệu gốc của công thức Trúc Cơ Đan (khớp refineTrucCoDan).
  // Đợt ƯU TIÊN: về chuẩn đã duyệt (Bui 2026-11-01).
  var RECIPE = [
    { itemId: 'linh-chi-sau-nui', count: 1 },
    { itemId: 'yeu-dan-cap-1', count: 1 },
    { itemId: 'thanh-tam-thao', count: 3 }
  ];
  var RECIPE_LT_FEE = 30;

  var SOURCE_TEXT = {
    'truc-co-dan': 'Luyện tại Đan Phòng Tông Môn hoặc nhờ Chấp Sự Đường: 1 Linh Chi Sau Núi + 1 Yêu Đan cấp 1 + 3 Thanh Tâm Thảo + 30 Linh Thạch.',
    'linh-chi-sau-nui': 'Điểm hái Linh Chi Sau Núi ở Sơn Cốc (sau núi Thanh Vân — ánh xạ tạm, chờ Bui chốt). Hái nó ở giai đoạn chương 8 sẽ gặp toán phục kích Huyết Bạc Cung.',
    'yeu-dan-cap-1': 'Diệt cả toán phục kích Huyết Bạc Cung (3 thích khách) ở Sơn Cốc trong chương 8 — rơi CHẮC CHẮN 1 viên. Chết/chạy trước khi lấy được thì hái lại Linh Chi Sau Núi để gọi toán phục kích mới.',
    'thanh-tam-thao': '4 điểm hái Thanh Tâm Thảo ở Sơn Cốc (hồi 120s như Lá Thanh Tụy).'
  };

  var FOCUS_PILL = 'pill';
  var FOCUS_MAT_PREFIX = 'mat_';

  // --- Truy cập module khác (trình duyệt: window; Node: global/require) ---
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
  function monstersAPI() {
    var r = root();
    if (r.GameMonsters) return r.GameMonsters;
    try { return require('./monsters.js'); } catch (e) { return null; }
  }
  function engineAPI() {
    var r = root();
    return r.GameEngine || null;
  }
  function uiAPI() {
    var r = root();
    return r.GameUI || null;
  }

  function getItemDef(itemId) {
    var m = monstersAPI();
    if (m && m.ITEM_DEFS && m.ITEM_DEFS[itemId]) return m.ITEM_DEFS[itemId];
    return { id: itemId, name: itemId, iconCol: 0, iconRow: 0 };
  }

  function itemName(itemId) {
    var d = getItemDef(itemId);
    return d && d.name ? d.name : itemId;
  }

  function bagCount(player, itemId) {
    var st = stateAPI();
    if (st && typeof st.countItemInBag === 'function') {
      return st.countItemInBag(player, itemId);
    }
    var n = 0;
    var bag = (player && player.bag) || [];
    for (var i = 0; i < bag.length; i++) {
      if (bag[i] && bag[i].itemId === itemId) n += bag[i].count || 0;
    }
    return n;
  }

  // Trạng thái đột phá nằm trên bản lưu: player.dotPha = { focus }.
  // Khởi tạo lười: bản lưu cũ không có trường này vẫn tải bình thường.
  function ensureState(player) {
    if (!player) return null;
    if (!player.dotPha || typeof player.dotPha !== 'object') {
      player.dotPha = { focus: null };
    }
    if (typeof player.dotPha.focus === 'undefined') player.dotPha.focus = null;
    return player.dotPha;
  }

  function setFocus(player, focus) {
    var st = ensureState(player);
    if (st) st.focus = focus || null;
  }

  // =========================================================================
  // TRẠNG THÁI ĐỘT PHÁ (thuần, kiểm được bằng Node): năm đường + đan +
  // nguyên liệu gốc đủ/thiếu từng mục.
  // =========================================================================
  function computeStatus(player) {
    var st = stateAPI();
    var moc = 1;
    var cap = 900;
    if (st && typeof st.getMocIndex === 'function') moc = st.getMocIndex(player);
    if (st && typeof st.getMocCap === 'function') cap = st.getMocCap(player);
    var rows = [];
    var pathsOk = moc >= 9;
    for (var i = 0; i < PATH_KEYS.length; i++) {
      var k = PATH_KEYS[i];
      var have = (player && player.paths && player.paths[k] && player.paths[k].tuVi) || 0;
      var ok = have >= cap;
      if (!ok) pathsOk = false;
      rows.push({ key: k, name: PATH_VI[k], have: have, cap: cap, ok: ok });
    }
    var pillHave = bagCount(player, PILL_ID);
    var recipeRows = [];
    for (var j = 0; j < RECIPE.length; j++) {
      var r = RECIPE[j];
      recipeRows.push({
        itemId: r.itemId,
        name: itemName(r.itemId),
        need: r.count,
        have: bagCount(player, r.itemId),
        source: SOURCE_TEXT[r.itemId] || ''
      });
    }
    return {
      moc: moc,
      cap: cap,
      paths: rows,
      pathsOk: pathsOk,
      pillHave: pillHave,
      pillOk: pillHave >= 1,
      recipe: recipeRows,
      ready: pathsOk && pillHave >= 1
    };
  }

  // =========================================================================
  // DẪN ĐƯỜNG (khớp khuôn tieumoc/danphong — logic quái/nguồn tại chỗ).
  // =========================================================================
  function monsterSourceList(monsterId) {
    var m = monstersAPI();
    if (!m || typeof m.getMonsters !== 'function') return [];
    var all = m.getMonsters() || [];
    var list = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].id === monsterId && all[i].spawnPoints) {
        for (var j = 0; j < all[i].spawnPoints.length; j++) {
          list.push({ mapId: all[i].mapId, x: all[i].spawnPoints[j].x, y: all[i].spawnPoints[j].y });
        }
      }
    }
    return list;
  }

  function nearestSource(list, player) {
    if (!list || !list.length) return null;
    var px = (player && player.x) || 0;
    var py = (player && player.y) || 0;
    var cur = player && player.currentMap;
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var dx = s.x - px;
      var dy = s.y - py;
      var d = dx * dx + dy * dy + (s.mapId === cur ? 0 : 100000000);
      if (d < bestScore) { bestScore = d; best = s; }
    }
    return best;
  }

  function bossSourceTarget(player, monsterId, title, desc) {
    var src = nearestSource(monsterSourceList(monsterId), player);
    if (!src) return null;
    return {
      stepId: 'dotpha_src_' + monsterId,
      stage: 4,
      mapId: src.mapId,
      kind: 'monster',
      monsterId: monsterId,
      x: src.x,
      y: src.y,
      title: title,
      desc: desc
    };
  }

  function matSourceTarget(player, itemId) {
    // Đợt ƯU TIÊN: dẫn đường theo công thức chuẩn đã duyệt — cả ba nguyên
    // liệu đều ở Sơn Cốc ("Sau Núi", ánh xạ tạm).
    switch (itemId) {
      case 'linh-chi-sau-nui':
        return {
          stepId: 'dotpha_src_linh_chi_sn', stage: 4, mapId: 'son-coc', kind: 'point',
          x: 980, y: 380, title: 'Đột Phá Trúc Cơ — Linh Chi Sau Núi',
          desc: 'Tới điểm hái Linh Chi Sau Núi ở Sơn Cốc để thu thập. Hái nó ở giai đoạn chương 8 sẽ gặp toán phục kích Huyết Bạc Cung.'
        };
      case 'yeu-dan-cap-1':
        return {
          stepId: 'dotpha_src_yeu_dan', stage: 4, mapId: 'son-coc', kind: 'point',
          x: 980, y: 380, title: 'Đột Phá Trúc Cơ — Yêu Đan cấp 1',
          desc: 'Hái Linh Chi Sau Núi ở Sơn Cốc rồi diệt cả toán phục kích Huyết Bạc Cung (3 thích khách) — rơi CHẮC CHẮN 1 Yêu Đan cấp 1.'
        };
      case 'thanh-tam-thao':
        return {
          stepId: 'dotpha_src_thanh_tam', stage: 4, mapId: 'son-coc', kind: 'point',
          x: 700, y: 660, title: 'Đột Phá Trúc Cơ — Thanh Tâm Thảo',
          desc: 'Tới các điểm hái Thanh Tâm Thảo ở Sơn Cốc để thu thập đủ 3 cây.'
        };
      default:
        return null;
    }
  }

  // Engine hỏi khi nhiệm vụ chính đang hiển thị: chỉ trả mục tiêu khi
  // người chơi đã bấm "Chỉ đường" trong Bảng Đột Phá (player.dotPha.focus).
  function getGuideTarget(player) {
    if (!player) return null;
    var st = ensureState(player);
    var focus = st ? st.focus : null;
    if (!focus) return null;
    if (focus === FOCUS_PILL) {
      if (bagCount(player, PILL_ID) >= 1) { setFocus(player, null); return null; }
      return {
        stepId: 'dotpha_pill_' + PILL_ID,
        stage: 4,
        mapId: 'tong-mon',
        kind: 'point',
        x: 850,
        y: 560,
        title: 'Đột Phá Trúc Cơ — ' + PILL_NAME,
        desc: 'Tới Lò Đan của Đan Phòng ở Tông Môn để luyện Trúc Cơ Đan.'
      };
    }
    if (focus.indexOf(FOCUS_MAT_PREFIX) === 0) {
      var itemId = focus.slice(FOCUS_MAT_PREFIX.length);
      var need = 0;
      for (var i = 0; i < RECIPE.length; i++) {
        if (RECIPE[i].itemId === itemId) need = RECIPE[i].count;
      }
      if (!need || bagCount(player, itemId) >= need) { setFocus(player, null); return null; }
      return matSourceTarget(player, itemId);
    }
    return null;
  }

  // =========================================================================
  // XÚC XẮC — giữ một cửa duy nhất để cổng kiểm chứng ép được giá trị.
  // Với tỉ lệ khóa 1.0, mọi giá trị xúc xắc trong [0,1) đều nhỏ hơn tỉ lệ.
  // =========================================================================
  var rollOverride = null;
  function setRollOverride(fn) {
    rollOverride = (typeof fn === 'function') ? fn : null;
  }
  function rollOnce(opts) {
    if (opts && typeof opts.roll === 'number') return opts.roll;
    if (rollOverride) return rollOverride();
    return Math.random();
  }

  // =========================================================================
  // BẢNG ĐỘT PHÁ TRÚC CƠ (DOM — bản sao khuôn tieumoc.js). Chỉ HIỂN THỊ
  // điều kiện đủ/thiếu và nút Chỉ đường; hành động đột phá thật vẫn qua
  // GameEngine.tryBreakthrough (nơi duy nhất mở nhãn Trúc Cơ).
  // =========================================================================
  var playerRef = null;
  var modalEl = null;
  var bodyEl = null;
  var wired = false;

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

  // Đặt biểu tượng vật phẩm từ bảng icons-sheet (bản sao khuôn tieumoc.js).
  function setIcon(elm, itemId) {
    var def = getItemDef(itemId);
    if (!elm || !def) return false;
    var cellPx = 40;
    var scale = cellPx / 32;
    elm.style.backgroundImage = "url('assets/art/icons-sheet.png')";
    elm.style.backgroundSize = (192 * scale) + 'px ' + (256 * scale) + 'px';
    elm.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    elm.style.backgroundRepeat = 'no-repeat';
    elm.style.width = cellPx + 'px';
    elm.style.height = cellPx + 'px';
    return true;
  }

  function guideButton(label, onTap) {
    var b = el('button', 'tieumoc-btn-guide', label || 'Chỉ đường');
    b.type = 'button';
    b.addEventListener('click', function () { onTap(); });
    return b;
  }

  function startGuide(focusKey) {
    var p = getPlayer();
    if (!p) return;
    setFocus(p, focusKey);
    var st = stateAPI();
    if (st && typeof st.savePlayer === 'function') st.savePlayer(p);
    closePanel();
    var eng = engineAPI();
    if (eng && typeof eng.startQuestGuidance === 'function') {
      eng.startQuestGuidance('main');
    }
    var ui = uiAPI();
    if (ui && typeof ui.showToast === 'function') {
      ui.showToast('Đã ghim mục tiêu — đi theo mũi tên dẫn đường trên màn hình.');
    }
  }

  function statusRow(label, valueText, ok, guideFocus) {
    var row = el('div', 'tieumoc-row' + (ok ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
    row.appendChild(el('span', 'tieumoc-row-label', label));
    row.appendChild(el('span', 'tieumoc-row-value', valueText));
    if (!ok && guideFocus) {
      row.appendChild(guideButton('Chỉ đường', function () { startGuide(guideFocus); }));
    }
    return row;
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
    var info = computeStatus(p);

    var note = el('p', 'tieumoc-note',
      'Đột phá ĐẠI cảnh giới lên Trúc Cơ Sơ Kỳ có ĐỘ KIẾP diễn thật 3 tia: mây kiếp kéo tới, ba tia sét đánh xuống ngay trong game, mây tan theo vòng tròn khi kiếp qua. Đủ mọi điều kiện dưới đây là đột phá thành công — mục nào còn thiếu có nút Chỉ đường tới đúng nơi lấy.');
    bodyEl.appendChild(note);

    if (!info.pathsOk && info.moc < 9) {
      bodyEl.appendChild(el('p', 'tieumoc-note',
        'Đột phá Trúc Cơ mở khi đạt mốc Luyện Khí tầng 9 với cả 5 đường đầy trần ' + info.cap + '. Hãy đột phá tiểu mốc dần lên tầng 9 trước (bảng Đột Phá Tiểu Mốc, gặp Chấp Sự Đường).'));
    }

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Điều kiện — năm đường đầy trần ' + info.cap));
    for (var i = 0; i < info.paths.length; i++) {
      var pr = info.paths[i];
      bodyEl.appendChild(statusRow(
        'Tu vi ' + pr.name,
        pr.have + '/' + pr.cap + (pr.ok ? ' — ĐẦY TRẦN' : ' — còn thiếu ' + (pr.cap - pr.have)),
        pr.ok,
        null
      ));
    }

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Đan đột phá'));
    var pillRow = el('div', 'tieumoc-row' + (info.pillOk ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
    var pillIcon = el('span', 'tieumoc-item-icon');
    if (!setIcon(pillIcon, PILL_ID)) pillIcon.textContent = '💊';
    pillRow.appendChild(pillIcon);
    pillRow.appendChild(el('span', 'tieumoc-row-label', PILL_NAME));
    pillRow.appendChild(el('span', 'tieumoc-row-value', info.pillHave + '/1'));
    if (!info.pillOk) {
      pillRow.appendChild(guideButton('Chỉ đường', function () { startGuide(FOCUS_PILL); }));
    }
    bodyEl.appendChild(pillRow);
    bodyEl.appendChild(el('p', 'tieumoc-note',
      'Luyện Trúc Cơ Đan tại Đan Phòng hoặc chỗ Chấp Sự Đường: 1 Linh Chi Sau Núi + 1 Yêu Đan cấp 1 + 3 Thanh Tâm Thảo + ' + RECIPE_LT_FEE + ' Linh Thạch (phí tính ở bước luyện). Công thức theo chuẩn đã duyệt (Bui 2026-11-01).'));

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Nguyên liệu gốc của viên đan (đủ/thiếu từng món)'));
    for (var j = 0; j < info.recipe.length; j++) {
      var rr = info.recipe[j];
      var row = el('div', 'tieumoc-row' + (rr.have >= rr.need ? ' tieumoc-row-ok' : ' tieumoc-row-miss'));
      var ic = el('span', 'tieumoc-item-icon');
      if (!setIcon(ic, rr.itemId)) ic.textContent = '◆';
      row.appendChild(ic);
      row.appendChild(el('span', 'tieumoc-row-label', rr.name));
      row.appendChild(el('span', 'tieumoc-row-value',
        'trong túi ' + rr.have + ' · cần ' + rr.need + (rr.have >= rr.need ? ' — ĐỦ' : ' — thiếu ' + (rr.need - rr.have))));
      if (rr.have < rr.need) {
        (function (focusKey) {
          row.appendChild(guideButton('Chỉ đường', function () { startGuide(focusKey); }));
        })(FOCUS_MAT_PREFIX + rr.itemId);
      }
      bodyEl.appendChild(row);
      if (rr.source) bodyEl.appendChild(el('p', 'tieumoc-note', 'Nguồn: ' + rr.source));
    }

    var actions = el('div', 'tieumoc-actions');
    var btnBreak = el('button', 'btn gold tieumoc-btn tieumoc-btn-break',
      info.ready ? '⚡ ĐỘT PHÁ — CHỊU ĐỘ KIẾP' : 'Chưa đủ điều kiện đột phá');
    btnBreak.type = 'button';
    btnBreak.id = 'dotpha-btn-break';
    btnBreak.disabled = !info.ready;
    btnBreak.addEventListener('click', function () {
      var eng = engineAPI();
      if (!eng || typeof eng.tryBreakthrough !== 'function') return;
      var res = eng.tryBreakthrough();
      if (res && res.ok) {
        closePanel();
      } else {
        renderPanel();
      }
    });
    actions.appendChild(btnBreak);
    var btnClose = el('button', 'btn wood tieumoc-btn', 'Đóng bảng');
    btnClose.type = 'button';
    btnClose.id = 'dotpha-btn-close';
    btnClose.addEventListener('click', closePanel);
    actions.appendChild(btnClose);
    bodyEl.appendChild(actions);
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
    modalEl = document.getElementById('dotpha-modal');
    bodyEl = document.getElementById('dotpha-body');
    if (!modalEl || !bodyEl) return;
    wired = true;
    var closeX = document.getElementById('close-dotpha-modal');
    if (closeX) closeX.addEventListener('click', closePanel);
    modalEl.addEventListener('click', function (ev) {
      if (ev.target === modalEl) closePanel();
    });
    var openBtn = document.getElementById('btn-dotpha-open');
    if (openBtn) openBtn.addEventListener('click', openPanel);
  }

  var api = {
    CONFIG: CONFIG,
    computeStatus: computeStatus,
    getGuideTarget: getGuideTarget,
    getTrackedTargetInfo: getGuideTarget,
    setRollOverride: setRollOverride,
    rollOnce: rollOnce,
    attach: attach,
    openPanel: openPanel,
    closePanel: closePanel
  };

  var r = root();
  r.GameDotPha = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
