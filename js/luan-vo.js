/**
 * Đợt P2D — LUẬN VÕ VỚI BOT (P2-DESIGN §4; hồ sơ 15§8, 22, 47§5)
 *
 * Đấu 1–1 với bot trong Sảnh Thi Đấu (map Tông Môn, vùng sanh_thi_dau).
 * Bot dùng khung quái/boss HIỆN CÓ (elite theo hệ của kỳ), chỉ đổi tên hiển thị
 * + tông môn (tên lấy từ danh sách NPC HIỆN CÓ trong mapdata.js). Không bịa
 * quái/boss/tông môn mới.
 *
 * Kỳ luận võ luân phiên hệ: mỗi kỳ (tuần) chỉ cho dùng bí pháp MỘT hệ, luân
 * phiên 5 hệ theo lịch tuần (ngày thật, theo mẫu dailyCompletions). Giới hạn
 * hệ qua skills.js elementOf. Ngoài kỳ/sai hệ thì chiêu bị chặn, báo rõ.
 *
 * Luật hồi sinh riêng trong Sảnh (47§5): chết trong luận võ hồi sinh ngay tại
 * sảnh chờ, không trọng thương, không mất gì, không ăn bể lượt. Nhánh riêng
 * trong handlePlayerDeath (engine.js) — không đổi luật chết dã ngoại.
 *
 * Thưởng: nguyên liệu HIỆN CÓ (đọc dropTable của elite cùng hệ) + ghi chiến
 * thắng (số trận thắng, kỳ đã thắng) để P2F đọc. KHÔNG thưởng pháp bảo,
 * KHÔNG làm hệ danh hiệu.
 */
(function (exports) {
  'use strict';

  var ELEMENTS = ['moc', 'thuy', 'hoa', 'tho', 'kim'];
  var ELEMENT_NAME = { moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', kim: 'Kim' };

  // Elite HIỆN CÓ theo hệ — dùng làm bot (không bịa quái/boss mới).
  var ELITE_BY_ELEMENT = {
    moc: 'co_thu_yeu',
    thuy: 'han_xa',
    hoa: 'diem_ma',
    tho: 'sa_tuong',
    kim: 'thiet_giap'
  };

  // Tên NPC HIỆN CÓ trong mapdata.js (NPCS_TONG_MON). Không bịa tên mới.
  var NPC_NAMES = [
    'Tuần Thú Sư', 'Tiếp Dẫn Đệ Tử', 'Chấp Sự Đường', 'Truyền Công Trưởng Lão',
    'Dược Sư', 'Thương Nhân', 'Linh Nhi'
  ];
  var BOT_SECT = 'Thanh Vân Tông';

  var TOWER_MAP_ID = 'tong-mon';
  var SANH_ZONE_ID = 'sanh_thi_dau';
  // Toạ độ đã chọn trong vùng sanh_thi_dau (1180,640,520x420). PROVISIONAL.
  var PLAYER_SPOT = { x: 1300, y: 850 };
  var BOT_SPOT = { x: 1580, y: 850 };
  var WAITING_SPOT = { x: 1280, y: 900 };

  var tickTimer = null;
  var match = null; // trận đang diễn ra

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
  function getSkillsAPI() {
    if (typeof window !== 'undefined' && window.GameSkills) return window.GameSkills;
    try { return require('./skills.js'); } catch (e) { return null; }
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

  function isInSanhThiDau() {
    var eng = getEngine();
    if (!eng || eng.getCurrentMapId() !== TOWER_MAP_ID) return false;
    var z = eng.getCurrentZone ? eng.getCurrentZone() : null;
    return !!(z && z.id === SANH_ZONE_ID);
  }

  function getWaitingSpot() { return WAITING_SPOT; }

  // J2: lượt leo tháp đang chạy thì luật luận võ không áp dụng. Viết phòng thủ:
  // khi P2C chưa gộp thì GameThap không tồn tại -> coi như không leo tháp.
  function isTowerRunActive() {
    try {
      return !!(typeof window !== 'undefined' && window.GameThap &&
        typeof window.GameThap.getRun === 'function' && window.GameThap.getRun());
    } catch (e) { return false; }
  }
  // J1/J2: luật luận võ (nhánh chết) áp dụng khi đang có trận đang chạy —
  // trận thắng kiểm vùng, vì vùng Sảnh chồng vùng tháp (getCurrentZone trả
  // tháp ở nửa đông sàn đấu) — hoặc khi đứng trong Sảnh mà không leo tháp.
  // Lượt leo tháp thắng luận võ.
  function isLuanVoRuleActive() {
    if (isTowerRunActive()) return false;
    return isInSanhThiDau() || !!match;
  }
  // J1/J2: chặn chiêu sai hệ chỉ khi đang có trận luận võ đang chạy và
  // không leo tháp — người leo tháp đứng trong vùng Sảnh không bị chặn oan.
  function isMatchRuleActive() {
    if (isTowerRunActive()) return false;
    return !!match;
  }

  // ==========================================================================
  // KỲ (TUẦN) & HỆ
  // ==========================================================================
  function periodMonday() {
    var d = new Date();
    var day = d.getDay(); // 0 CN
    var diff = (day === 0) ? -6 : (1 - day);
    var m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
    return m;
  }
  function periodKey() {
    var m = periodMonday();
    var y = m.getFullYear();
    var mo = m.getMonth() + 1;
    var da = m.getDate();
    return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (da < 10 ? '0' : '') + da;
  }
  function periodIndex() {
    var m = periodMonday();
    var weeks = Math.floor(m.getTime() / (7 * 86400000));
    var idx = weeks % 5;
    if (idx < 0) idx += 5;
    return idx;
  }
  function periodElement() {
    return ELEMENTS[periodIndex()];
  }

  // ==========================================================================
  // TRẠNG THÁI NGƯỜI CHƠI
  // ==========================================================================
  function ensureState(player) {
    if (!player) return null;
    if (!player.luanVo || typeof player.luanVo !== 'object') {
      player.luanVo = { wins: 0, losses: 0, wonPeriods: [], lastResult: null, matchCount: 0 };
    }
    if (!Array.isArray(player.luanVo.wonPeriods)) player.luanVo.wonPeriods = [];
    return player.luanVo;
  }

  // ==========================================================================
  // KIỂM TRA CHIÊU THEO KỲ
  // ==========================================================================
  function checkSkill(def) {
    // J1/J2: chỉ chặn khi đang có trận luận võ đang chạy (và không leo tháp).
    // Kiểm vùng cũ chặn oan người leo tháp đứng trong vùng Sảnh chồng lấp.
    var inScope = isMatchRuleActive();
    if (!inScope) return { ok: true };
    var skillsAPI = getSkillsAPI();
    var skillElem = 'neutral';
    if (skillsAPI && typeof skillsAPI.elementOf === 'function') {
      skillElem = skillsAPI.elementOf(def);
    } else if (def) {
      skillElem = def.element || def.path || 'neutral';
    }
    var pe = periodElement();
    if (skillElem !== pe) {
      return { ok: false, msg: 'Kỳ này chỉ cho dùng bí pháp hệ ' + (ELEMENT_NAME[pe] || pe) + '.' };
    }
    return { ok: true };
  }

  // ==========================================================================
  // BẮT ĐẦU TRẬN
  // ==========================================================================
  function pickBotName() {
    var st = null;
    var player = getPlayer();
    if (player) st = ensureState(player);
    var idx = st ? (st.matchCount || 0) : 0;
    var name = NPC_NAMES[idx % NPC_NAMES.length];
    if (st) st.matchCount = (st.matchCount || 0) + 1;
    return name;
  }

  function startMatch() {
    var eng = getEngine();
    var player = getPlayer();
    if (!eng || !player) { toast('Chưa sẵn sàng.'); return { ok: false }; }
    if (eng.getCurrentMapId() !== TOWER_MAP_ID) { toast('Cần ở Tông Môn.'); return { ok: false }; }
    if (!isInSanhThiDau()) { toast('Cần đứng trong Sảnh Thi Đấu.'); return { ok: false }; }
    if (player.hp <= 0) { toast('Đang gục.'); return { ok: false }; }
    if (match) { toast('Đang trong trận.'); return { ok: false }; }

    var elem = periodElement();
    var speciesId = ELITE_BY_ELEMENT[elem];
    var monAPI = getMonstersAPI();
    if (!monAPI || !monAPI.SPECIES || !monAPI.SPECIES[speciesId]) {
      toast('Không tìm thấy bot phù hợp.'); return { ok: false };
    }

    var botName = pickBotName();
    var lv = eng.luanVo;
    if (!lv || !lv.spawn) { toast('Không thể triệu hồi bot.'); return { ok: false }; }
    if (lv.clear) lv.clear();
    var bot = lv.spawn(speciesId, BOT_SPOT.x, BOT_SPOT.y);
    if (!bot) { toast('Không thể triệu hồi bot.'); return { ok: false }; }
    // bỏ nhãn tháp, gắn nhãn luận võ
    bot.towerTag = null;
    bot.luanVoBot = true;
    bot.name = botName;
    bot.sectName = BOT_SECT;

    // đưa người chơi về điểm đứng
    player.x = PLAYER_SPOT.x;
    player.y = PLAYER_SPOT.y;

    match = {
      element: elem,
      botName: botName,
      botSect: BOT_SECT,
      speciesId: speciesId,
      bot: bot,
      startedAt: Date.now(),
      result: null
    };

    toast('Luận võ bắt đầu: ' + botName + ' (' + BOT_SECT + ') — Hệ ' + (ELEMENT_NAME[elem] || elem));
    return { ok: true };
  }

  // ==========================================================================
  // KẾT THÚC TRẬN
  // ==========================================================================
  function endMatch(result) {
    var eng = getEngine();
    var player = getPlayer();
    if (!match) return;
    var m = match;
    match = null;

    if (eng && eng.luanVo && eng.luanVo.clear) eng.luanVo.clear();

    var st = player ? ensureState(player) : null;
    if (result === 'win') {
      // Thưởng nguyên liệu HIỆN CÓ (đọc dropTable của elite cùng hệ).
      if (player) {
        var monAPI = getMonstersAPI();
        var stateAPI = getStateAPI();
        var spec = monAPI && monAPI.SPECIES ? monAPI.SPECIES[m.speciesId] : null;
        var rare = null;
        if (spec && spec.dropTable) {
          for (var i = 0; i < spec.dropTable.length; i++) {
            var e = spec.dropTable[i];
            if (e && e.isMaterial) { rare = e; break; }
          }
        }
        if (rare && stateAPI && stateAPI.addItemToBag) {
          stateAPI.addItemToBag(player, rare.id, Math.max(1, rare.min || 1));
        }
        if (st) {
          st.wins = (st.wins || 0) + 1;
          var pk = periodKey();
          if (st.wonPeriods.indexOf(pk) === -1) st.wonPeriods.push(pk);
          st.lastResult = { win: true, periodKey: pk, element: m.element, botName: m.botName, at: Date.now() };
        }
        save(player);
      }
      toast('Chiến thắng! ' + m.botName + ' đã bị hạ.');
    } else {
      if (st) {
        st.losses = (st.losses || 0) + 1;
        st.lastResult = { win: false, periodKey: periodKey(), element: m.element, botName: m.botName, at: Date.now() };
      }
      save(player);
      toast('Thất bại trong luận võ.');
    }
  }

  // Gọi từ engine khi người chơi chết trong Sảnh.
  function onPlayerDeathInSanh() {
    if (match) {
      endMatch('loss');
    }
  }

  // ==========================================================================
  // TICK
  // ==========================================================================
  function tick() {
    var eng = getEngine();
    if (!eng) return;
    if (eng.getCurrentMapId() !== TOWER_MAP_ID) {
      if (match) endMatch('loss');
      return;
    }
    if (!match) return;
    var player = eng.getPlayer();
    if (!player) return;

    // người chơi chết -> engine branch xử lý, nhưng đề phòng:
    if (player.hp <= 0) {
      onPlayerDeathInSanh();
      return;
    }

    var bot = match.bot;
    if (!bot || bot.hp <= 0 || bot.state === 'dead') {
      endMatch('win');
    }
  }

  // ==========================================================================
  // GIAO DIỆN TỐI THIỂU
  // ==========================================================================
  var modalEl = null, modalBodyEl = null;
  function buildModal() {
    if (typeof document === 'undefined' || modalEl) return;
    modalEl = document.createElement('div');
    modalEl.id = 'luan-vo-modal';
    modalEl.className = 'modal-overlay hidden';

    var box = document.createElement('div');
    box.className = 'panel modal-box';

    var header = document.createElement('div');
    header.className = 'modal-header';
    var title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = 'LUẬN VÕ — SẢNH THI ĐẤU';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () { closeModal(); });
    header.appendChild(title);
    header.appendChild(closeBtn);

    modalBodyEl = document.createElement('div');
    modalBodyEl.id = 'luan-vo-body';
    modalBodyEl.style.cssText = 'padding:6px 4px 2px;font-size:13px;line-height:1.9;';

    var actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.style.marginTop = '14px';
    var startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'btn btn-main';
    startBtn.textContent = 'Đăng ký luận võ';
    startBtn.addEventListener('click', function () {
      var r = startMatch();
      if (r && r.ok) closeModal();
    });
    var closeBottom = document.createElement('button');
    closeBottom.type = 'button';
    closeBottom.className = 'btn wood';
    closeBottom.textContent = 'Đóng';
    closeBottom.addEventListener('click', function () { closeModal(); });
    actions.appendChild(startBtn);
    actions.appendChild(closeBottom);

    box.appendChild(header);
    box.appendChild(modalBodyEl);
    box.appendChild(actions);
    modalEl.appendChild(box);
    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
    document.body.appendChild(modalEl);
  }
  function renderModal() {
    if (!modalBodyEl) return;
    var player = getPlayer();
    var st = player ? ensureState(player) : null;
    var pe = periodElement();
    var pk = periodKey();
    var lines = [];
    lines.push('Kỳ hiện tại: ' + pk);
    lines.push('Hệ của kỳ: ' + (ELEMENT_NAME[pe] || pe));
    if (st) {
      lines.push('Số trận thắng: ' + (st.wins || 0));
      lines.push('Kỳ đã thắng: ' + (st.wonPeriods && st.wonPeriods.length ? st.wonPeriods.join(', ') : '—'));
      if (st.lastResult) {
        lines.push('Kết quả gần nhất: ' + (st.lastResult.win ? 'Thắng' : 'Thua') + ' vs ' + st.lastResult.botName + ' (hệ ' + (ELEMENT_NAME[st.lastResult.element] || st.lastResult.element) + ')');
      }
    }
    if (match) lines.push('Đang đấu: ' + match.botName + ' (' + match.botSect + ')');
    modalBodyEl.innerHTML = lines.map(function (l) { return '<div>' + l + '</div>'; }).join('');
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

  // ==========================================================================
  // KHỞI ĐỘNG
  // ==========================================================================
  function init() {
    if (typeof window === 'undefined') return;
    buildModal();
    window.addEventListener('map_switched', function () {
      if (match && getEngine() && getEngine().getCurrentMapId() !== TOWER_MAP_ID) {
        endMatch('loss');
      }
    });
    if (!tickTimer) tickTimer = setInterval(tick, 250);
  }

  exports.startMatch = startMatch;
  exports.endMatch = endMatch;
  exports.onPlayerDeathInSanh = onPlayerDeathInSanh;
  exports.checkSkill = checkSkill;
  exports.isInSanhThiDau = isInSanhThiDau;
  exports.isLuanVoRuleActive = isLuanVoRuleActive;
  exports.isMatchRuleActive = isMatchRuleActive;
  exports.isTowerRunActive = isTowerRunActive;
  exports.getWaitingSpot = getWaitingSpot;
  exports.openModal = openModal;
  exports.closeModal = closeModal;
  exports.periodKey = periodKey;
  exports.periodElement = periodElement;
  exports.ensureState = ensureState;
  exports.getMatch = function () { return match; };

  init();
})(typeof window !== 'undefined' ? (window.GameLuanVo = {}) : (module.exports = {}));
