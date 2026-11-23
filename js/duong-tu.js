/**
 * duong-tu.js — Đợt ƯU TIÊN (2026-11-23): NGHI LỄ CHỌN ĐƯỜNG TU.
 *
 * Sau Trúc Cơ, người chơi chọn 1 trong 3 đường: Kiếm Tu / Pháp Tu / Thể Tu
 * (tên tạm, chờ Bui chốt). Mỗi đường 4 chiêu (js/skills.js, số tạm).
 * Nghi lễ: đánh thử chiêu đặc trưng từng đường trước khi chốt (thử chiêu
 * chỉ xem hiệu ứng — engine.trialPathSkill tung hiệu ứng tại chỗ, không
 * cần trận thật, không tốn linh lực); chốt xong cấp 4 chiêu đường đó.
 * Đổi đường: 1 lần miễn phí, lần sau tốn 500 Linh Thạch (số tạm).
 * Kiêm tu đường thứ hai ở Kim Đan: tốn 2000 Linh Thạch (số tạm); chiêu
 * đường thứ hai chỉ hiện ở Sổ Chiêu (đã học), đường chính vẫn quyết định
 * đội hình 8 ô (js/skills.js getLoadout).
 * Nhận diện: nhãn cảnh giới trên HUD + Bảng Nhân Vật thêm tên đường tu
 * (móc ở js/ui.js refreshHUD/updateCharPanelContent); viền áo nhuộm theo
 * đường tu CHƯA làm đợt này — thay bằng chấm màu đường cạnh tên đường
 * (ghi rõ trong báo cáo đợt; nhuộm áo cần đợt trang phục riêng).
 *
 * Module thuần + DOM theo khuôn js/dotpha.js: Node-loadable (module.exports)
 * và chạy trên trình duyệt (window.GameDuongTu).
 */
(function (exports) {
  'use strict';

  // --- Hằng số tạm (PROVISIONAL, chờ Bui chốt) ---
  var PATH_CHANGE_COST_LT = 500;   // đổi đường từ lần thứ 2
  var DUAL_PATH_COST_LT = 2000;    // kiêm tu đường thứ hai ở Kim Đan

  var PATHS = {
    'kiem-tu': {
      id: 'kiem-tu', name: 'Kiếm Tu', color: '#e8ecf2',
      desc: 'Kiếm khí tung hoành, một kiếm phá vạn pháp. Bạo kích cao, tuyệt kỹ Vạn Kiếm Quy Tông.',
      signature: 'kiem-khi-tram', signatureName: 'Kiếm Khí Trảm',
      skills: ['Kiếm Khí Trảm', 'Ngự Kiếm Phi Hành', 'Vạn Kiếm Quy Tông', 'Kiếm Tâm (bị động: +10% bạo kích)']
    },
    'phap-tu': {
      id: 'phap-tu', name: 'Pháp Tu', color: '#b9a7ff',
      desc: 'Pháp ấn ngũ hành, lôi pháp dẫn thiên. Sát thương diện rộng, khiên Hộ Thể Linh Quang.',
      signature: 'ngu-hanh-phap-an', signatureName: 'Ngũ Hành Pháp Ấn',
      skills: ['Ngũ Hành Pháp Ấn', 'Lôi Pháp Dẫn', 'Hộ Thể Linh Quang', 'Thiên Lôi Dẫn (tuyệt kỹ)']
    },
    'the-tu': {
      id: 'the-tu', name: 'Thể Tu', color: '#e8a56b',
      desc: 'Thân thể như kim cang, quyền nặng phá núi. Phòng thủ cao, tuyệt kỹ Bất Diệt Kim Thân.',
      signature: 'ba-vuong-quyen', signatureName: 'Bá Vương Quyền',
      skills: ['Bá Vương Quyền', 'Kim Cang Thể (bị động: +15% phòng thủ)', 'Huyết Khí Bùng Nổ', 'Bất Diệt Kim Thân (tuyệt kỹ)']
    }
  };
  var PATH_IDS = ['kiem-tu', 'phap-tu', 'the-tu'];

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
  function skillsAPI() {
    var r = root();
    if (r.GameSkills) return r.GameSkills;
    try { return require('./skills.js'); } catch (e) { return null; }
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

  function savePlayer(player) {
    var st = stateAPI();
    if (st && typeof st.savePlayer === 'function') st.savePlayer(player);
  }

  function toast(msg) {
    var ui = uiAPI();
    if (ui && typeof ui.showToast === 'function') ui.showToast(msg);
  }

  function refreshSkillUI() {
    var ui = uiAPI();
    if (!ui) return;
    if (typeof ui.refreshSkillSlots === 'function') ui.refreshSkillSlots();
    if (typeof ui.refreshHUD === 'function') ui.refreshHUD();
    if (typeof ui.updateCharPanelContent === 'function') {
      try { ui.updateCharPanelContent(); } catch (e) {}
    }
  }

  // Trạng thái đường tu nằm trên bản lưu (js/state.js createPlayer đã có
  // mặc định; đây là chuẩn hóa lười cho save cũ).
  function ensureState(player) {
    if (!player) return null;
    if (typeof player.cultivationPath === 'undefined') player.cultivationPath = null;
    if (typeof player.dualPath === 'undefined') player.dualPath = null;
    if (typeof player.pathChangeFreeUsed === 'undefined') player.pathChangeFreeUsed = false;
    if (typeof player.pathRitualOffered === 'undefined') player.pathRitualOffered = false;
    if (typeof player.pathBuffs === 'undefined') player.pathBuffs = null;
    return player;
  }

  function pathName(pathId) {
    return (pathId && PATHS[pathId]) ? PATHS[pathId].name : '';
  }

  function isValidPath(pathId) {
    return PATH_IDS.indexOf(pathId) !== -1;
  }

  // --- Chọn đường lần đầu: cần Trúc Cơ+ và chưa chọn đường nào. ---
  function choosePath(player, pathId) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Chưa có nhân vật.' };
    ensureState(player);
    if (!isValidPath(pathId)) return { ok: false, reason: 'invalid_path', msg: 'Đường tu không hợp lệ.' };
    if (player.cultivationPath) return { ok: false, reason: 'already_chosen', msg: 'Đã chọn đường ' + pathName(player.cultivationPath) + ' — muốn đổi đường hãy dùng chức năng đổi đường.' };
    if (getRealmRank(player) < 10) return { ok: false, reason: 'realm', msg: 'Chọn đường tu mở sau khi đột phá Trúc Cơ (hiện tại: ' + (player.realm || 'Phàm Nhân') + ').' };
    player.cultivationPath = pathId;
    // Đợt SKILL-EQUIP-UI: chọn đường mới thì đội hình tự chọn cũ (chứa
    // chiêu đường chưa có) về mặc định đường mới.
    var skPick = skillsAPI();
    if (skPick && typeof skPick.resetCustomLoadout === 'function') skPick.resetCustomLoadout(player);
    savePlayer(player);
    refreshSkillUI();
    return { ok: true, path: pathId, msg: 'Đã chọn đường ' + pathName(pathId) + '! 4 chiêu đường tu đã mở — xem ở Sổ Chiêu, 4 chiêu lên ô 1–4 trên thanh kỹ năng.' };
  }

  // --- Đổi đường: 1 lần miễn phí, lần sau 500 Linh Thạch (số tạm). ---
  function changePathCost(player) {
    ensureState(player);
    return player.pathChangeFreeUsed ? PATH_CHANGE_COST_LT : 0;
  }

  function changePath(player, pathId) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Chưa có nhân vật.' };
    ensureState(player);
    if (!isValidPath(pathId)) return { ok: false, reason: 'invalid_path', msg: 'Đường tu không hợp lệ.' };
    if (!player.cultivationPath) return { ok: false, reason: 'no_path', msg: 'Chưa chọn đường nào — hãy chọn đường trước.' };
    if (player.cultivationPath === pathId) return { ok: false, reason: 'same_path', msg: 'Đang ở đường ' + pathName(pathId) + ' rồi.' };
    var cost = changePathCost(player);
    if (cost > 0 && (player.linhThach || 0) < cost) {
      return { ok: false, reason: 'insufficient_linh_thach', msg: 'Đổi đường tốn ' + cost + ' Linh Thạch (số tạm) — hiện có ' + (player.linhThach || 0) + '.' };
    }
    if (cost > 0) player.linhThach -= cost;
    var oldPath = player.cultivationPath;
    player.cultivationPath = pathId;
    player.pathChangeFreeUsed = true;
    player.pathBuffs = null;
    // Đợt SKILL-EQUIP-UI: đổi đường thì đội hình tự chọn cũ (chứa chiêu
    // đường cũ đã khóa) về mặc định đường mới.
    var skChg = skillsAPI();
    if (skChg && typeof skChg.resetCustomLoadout === 'function') skChg.resetCustomLoadout(player);
    savePlayer(player);
    refreshSkillUI();
    return { ok: true, path: pathId, cost: cost, msg: 'Đã đổi từ đường ' + pathName(oldPath) + ' sang đường ' + pathName(pathId) + (cost > 0 ? ' (tốn ' + cost + ' Linh Thạch).' : ' (lần đổi miễn phí).') + ' Đội hình 8 ô đã đổi theo đường mới.' };
  }

  // --- Kiêm tu đường thứ hai ở Kim Đan: 2000 Linh Thạch (số tạm). ---
  function learnDualPath(player, pathId) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Chưa có nhân vật.' };
    ensureState(player);
    if (!isValidPath(pathId)) return { ok: false, reason: 'invalid_path', msg: 'Đường tu không hợp lệ.' };
    if (!player.cultivationPath) return { ok: false, reason: 'no_path', msg: 'Hãy chọn đường chính trước.' };
    if (player.dualPath) return { ok: false, reason: 'already_dual', msg: 'Đã kiêm tu đường ' + pathName(player.dualPath) + ' rồi (tối đa 1 đường kiêm tu — số tạm).' };
    if (player.cultivationPath === pathId) return { ok: false, reason: 'same_path', msg: 'Đó đã là đường chính của ngươi.' };
    if (getRealmRank(player) < 14) return { ok: false, reason: 'realm', msg: 'Kiêm tu mở ở Kim Đan (hiện tại: ' + (player.realm || 'Phàm Nhân') + ').' };
    if ((player.linhThach || 0) < DUAL_PATH_COST_LT) {
      return { ok: false, reason: 'insufficient_linh_thach', msg: 'Kiêm tu tốn ' + DUAL_PATH_COST_LT + ' Linh Thạch (số tạm) — hiện có ' + (player.linhThach || 0) + '.' };
    }
    player.linhThach -= DUAL_PATH_COST_LT;
    player.dualPath = pathId;
    savePlayer(player);
    refreshSkillUI();
    return { ok: true, path: pathId, cost: DUAL_PATH_COST_LT, msg: 'Đã kiêm tu đường ' + pathName(pathId) + ' (tốn ' + DUAL_PATH_COST_LT + ' Linh Thạch). 4 chiêu đường này đã học — xem ở Sổ Chiêu; đội hình 8 ô vẫn theo đường chính.' };
  }

  // --- Thử chiêu đặc trưng: chỉ xem hiệu ứng, không tốn linh lực. ---
  function trialPathSkill(player, pathId) {
    if (!isValidPath(pathId)) return { ok: false, reason: 'invalid_path', msg: 'Đường tu không hợp lệ.' };
    var eng = engineAPI();
    if (eng && typeof eng.trialPathSkill === 'function') {
      return eng.trialPathSkill(pathId);
    }
    var info = PATHS[pathId];
    toast('Thử chiêu: ' + info.signatureName + ' — ' + info.desc);
    return { ok: true, path: pathId, msg: 'Đã thử chiêu ' + info.signatureName + '.' };
  }

  // --- Nghi lễ tự mở 1 lần ngay sau đột phá Trúc Cơ thành công. ---
  // engine.tryBreakthrough gọi hàm này (kèm setTimeout để bảng Đột Phá
  // đóng trước); "Để sau" chỉ đóng bảng, mở lại từ Bảng Nhân Vật.
  function maybeOfferRitual(player) {
    if (!player) return false;
    ensureState(player);
    if (player.cultivationPath || player.pathRitualOffered) return false;
    if (getRealmRank(player) < 10) return false;
    player.pathRitualOffered = true;
    savePlayer(player);
    openRitualPanel();
    return true;
  }

  // =========================================================================
  // BẢNG NGHI LỄ CHỌN ĐƯỜNG (DOM — bản sao khuôn dotpha.js).
  // ritualMode=true: mở ngay sau đột phá (có nút "Để sau"); false: mở lại
  // từ Bảng Nhân Vật (quản lý đường: đổi/kiêm tu).
  // =========================================================================
  var playerRef = null;
  var modalEl = null;
  var bodyEl = null;
  var wired = false;
  var ritualMode = true;

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

  function pathCard(p, pathId, mode) {
    var info = PATHS[pathId];
    var isMain = p.cultivationPath === pathId;
    var isDual = p.dualPath === pathId;
    var card = el('div', 'tieumoc-row' + (isMain ? ' tieumoc-row-ok' : ''));
    var left = el('div', '');
    left.style.cssText = 'flex:1;';
    var title = el('div', 'tieumoc-row-label', info.name + (isMain ? ' — ĐƯỜNG CHÍNH' : '') + (isDual ? ' — ĐANG KIÊM TU' : ''));
    title.style.cssText = 'color:' + info.color + ';font-weight:bold;';
    left.appendChild(title);
    left.appendChild(el('div', 'tieumoc-note', info.desc));
    left.appendChild(el('div', 'tieumoc-note', 'Chiêu: ' + info.skills.join(' · ') + '. (Tên tạm, số tạm — chờ Bui chốt.)'));
    card.appendChild(left);

    var btns = el('div', 'tieumoc-actions');
    btns.style.cssText = 'flex-direction:column;gap:6px;';
    var btnTrial = el('button', 'btn wood tieumoc-btn', 'Thử chiêu: ' + info.signatureName);
    btnTrial.type = 'button';
    btnTrial.addEventListener('click', function () {
      var res = trialPathSkill(p, pathId);
      if (res && res.msg) toast(res.msg);
    });
    btns.appendChild(btnTrial);

    if (mode === 'ritual') {
      var btnChoose = el('button', 'btn gold tieumoc-btn', 'Chọn đường này');
      btnChoose.type = 'button';
      btnChoose.id = 'duongtu-btn-choose-' + pathId;
      btnChoose.addEventListener('click', function () {
        var res = choosePath(p, pathId);
        toast(res.msg);
        if (res.ok) { closePanel(); renderPanel(); }
      });
      btns.appendChild(btnChoose);
    } else if (!isMain && !isDual) {
      var cost = changePathCost(p);
      var btnChange = el('button', 'btn gold tieumoc-btn', p.cultivationPath ? ('Đổi sang đường này' + (cost > 0 ? ' (' + cost + ' LT)' : ' (miễn phí)')) : 'Chọn đường này');
      btnChange.type = 'button';
      btnChange.id = 'duongtu-btn-change-' + pathId;
      btnChange.addEventListener('click', function () {
        var res = p.cultivationPath ? changePath(p, pathId) : choosePath(p, pathId);
        toast(res.msg);
        renderPanel();
      });
      btns.appendChild(btnChange);
      if (p.cultivationPath && getRealmRank(p) >= 14) {
        var btnDual = el('button', 'btn wood tieumoc-btn', 'Kiêm tu đường này (' + DUAL_PATH_COST_LT + ' LT)');
        btnDual.type = 'button';
        btnDual.id = 'duongtu-btn-dual-' + pathId;
        btnDual.addEventListener('click', function () {
          var res = learnDualPath(p, pathId);
          toast(res.msg);
          renderPanel();
        });
        btns.appendChild(btnDual);
      }
    }
    card.appendChild(btns);
    return card;
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
    var mode = ritualMode && !p.cultivationPath ? 'ritual' : 'manage';

    if (mode === 'ritual') {
      bodyEl.appendChild(el('p', 'tieumoc-note',
        'Chúc mừng đột phá Trúc Cơ! Giờ hãy chọn ĐƯỜNG TU của ngươi — mỗi đường một bộ 4 chiêu riêng. Bấm "Thử chiêu" để xem hiệu ứng chiêu đặc trưng từng đường trước khi chốt. Chốt xong được đổi 1 lần miễn phí; lần sau tốn 500 Linh Thạch (số tạm).'));
    } else {
      bodyEl.appendChild(el('p', 'tieumoc-note',
        'Đường chính hiện tại: ' + (p.cultivationPath ? pathName(p.cultivationPath) : 'chưa chọn') +
        (p.dualPath ? ' · Kiêm tu: ' + pathName(p.dualPath) : '') +
        '. Đổi đường: ' + (p.pathChangeFreeUsed ? 'lần đổi miễn phí đã dùng — lần sau tốn ' + PATH_CHANGE_COST_LT + ' Linh Thạch' : 'lần đổi miễn phí còn nguyên') + ' (số tạm). Kiêm tu đường thứ hai mở ở Kim Đan, tốn ' + DUAL_PATH_COST_LT + ' Linh Thạch (số tạm).'));
    }

    bodyEl.appendChild(el('h4', 'tieumoc-subtitle', 'Ba đường tu'));
    for (var i = 0; i < PATH_IDS.length; i++) {
      bodyEl.appendChild(pathCard(p, PATH_IDS[i], mode));
    }

    var actions = el('div', 'tieumoc-actions');
    if (mode === 'ritual') {
      var btnLater = el('button', 'btn wood tieumoc-btn', 'Để sau');
      btnLater.type = 'button';
      btnLater.id = 'duongtu-btn-later';
      btnLater.addEventListener('click', closePanel);
      actions.appendChild(btnLater);
    }
    var btnClose = el('button', 'btn wood tieumoc-btn', 'Đóng bảng');
    btnClose.type = 'button';
    btnClose.id = 'duongtu-btn-close';
    btnClose.addEventListener('click', closePanel);
    actions.appendChild(btnClose);
    bodyEl.appendChild(actions);
  }

  function openRitualPanel() {
    ritualMode = true;
    if (!modalEl) return;
    renderPanel();
    modalEl.classList.remove('hidden');
  }

  function openManagePanel() {
    ritualMode = false;
    if (!modalEl) return;
    renderPanel();
    modalEl.classList.remove('hidden');
  }

  function openPanel() {
    var p = getPlayer();
    if (p && !p.cultivationPath) openRitualPanel();
    else openManagePanel();
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
    modalEl = document.getElementById('duong-tu-modal');
    bodyEl = document.getElementById('duong-tu-body');
    if (!modalEl || !bodyEl) return;
    wired = true;
    var closeX = document.getElementById('close-duong-tu-modal');
    if (closeX) closeX.addEventListener('click', closePanel);
    modalEl.addEventListener('click', function (ev) {
      if (ev.target === modalEl) closePanel();
    });
    var openBtn = document.getElementById('btn-duongtu-open');
    if (openBtn) openBtn.addEventListener('click', openPanel);
  }

  var api = {
    PATH_CHANGE_COST_LT: PATH_CHANGE_COST_LT,
    DUAL_PATH_COST_LT: DUAL_PATH_COST_LT,
    PATHS: PATHS,
    PATH_IDS: PATH_IDS,
    ensureState: ensureState,
    pathName: pathName,
    isValidPath: isValidPath,
    choosePath: choosePath,
    changePathCost: changePathCost,
    changePath: changePath,
    learnDualPath: learnDualPath,
    trialPathSkill: trialPathSkill,
    maybeOfferRitual: maybeOfferRitual,
    attach: attach,
    openPanel: openPanel,
    openRitualPanel: openRitualPanel,
    openManagePanel: openManagePanel,
    closePanel: closePanel
  };

  var r = root();
  r.GameDuongTu = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
