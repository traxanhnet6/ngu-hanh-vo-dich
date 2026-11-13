/**
 * ui.js — Quản lý toàn bộ giao diện DOM, HUD, Vòng Tương Sinh, Bảng nhân vật,
 * Túi đồ (Bag), Thanh kỹ năng, Bảng gục ngã (Death), Tổng kết farm, Minimap, Hộp thoại.
 * Tuyệt đối không dùng emoji theo Hard Art Law.
 */
(function (global) {
  'use strict';

  var player = null;
  var mapData = null;
  var stateAPI = null;
  var audioAPI = null;
  var combatAPI = null;
  var monstersAPI = null;

  var minimapCanvas = null;
  var minimapCtx = null;
  var minimapBgImg = null;
  var currentMinimapMapId = null;

  var dialogueState = {
    active: false,
    npc: null,
    step: 0,
    lines: []
  };

  var selectedBagSlot = null;
  var selectedBagContainerId = null;
  var currentBagTab = 'all';
  var currentBagSearch = '';
  var tuiKhoAPI = null;

  /**
   * Khởi tạo giao diện người dùng
   */
  function initUI(playerObj, mapObj) {
    player = playerObj;
    mapData = mapObj || (typeof window !== 'undefined' ? window.MapData : null);
    stateAPI = typeof window !== 'undefined' ? window.GameState : null;
    audioAPI = typeof window !== 'undefined' ? window.GameAudio : null;
    combatAPI = typeof window !== 'undefined' ? window.GameCombat : null;
    monstersAPI = typeof window !== 'undefined' ? window.GameMonsters : null;
    tuiKhoAPI = typeof window !== 'undefined' ? window.GameTuiKho : null;
    if (player) {
      if (stateAPI && stateAPI.ensureTuiKho) stateAPI.ensureTuiKho(player);
      if (player.tuiKho) selectedBagContainerId = player.tuiKho.defaultContainerId;
    }

    if (typeof document === 'undefined') return;

    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
      minimapCtx = minimapCanvas.getContext('2d');
      updateMinimapBackground();
    }

    bindEvents();
    wireQuickSlots();
    renderRingWidget();
    refreshHUD();
    if (typeof window !== 'undefined' && window.GameLinhDien && window.GameLinhDien.attach) {
      window.GameLinhDien.attach(playerObj);
    }
    if (typeof window !== 'undefined' && window.GameDanPhong && window.GameDanPhong.attach) {
      window.GameDanPhong.attach(playerObj);
    }
    if (typeof window !== 'undefined' && window.GameTieuMoc && window.GameTieuMoc.attach) {
      window.GameTieuMoc.attach(playerObj);
    }
    if (typeof window !== 'undefined' && window.GameDotPha && window.GameDotPha.attach) {
      window.GameDotPha.attach(playerObj);
    }
    if (typeof window !== 'undefined' && window.GameKimDan && window.GameKimDan.attach) {
      window.GameKimDan.attach(playerObj);
    }
    // Đợt LINHME: Khởi tạo dữ liệu Vườn Linh Mễ và Thức Ăn Buff
    if (typeof window !== 'undefined' && window.GameTongMonFarm && window.GameTongMonFarm.ensureState) {
      window.GameTongMonFarm.ensureState(playerObj);
    }
    if (typeof window !== 'undefined' && window.GameFoodBuff && window.GameFoodBuff.ensureState) {
      window.GameFoodBuff.ensureState(playerObj);
    }
  }

  function updateMinimapBackground() {
    if (!mapData) return;
    if (currentMinimapMapId !== mapData.id) {
      currentMinimapMapId = mapData.id;
      minimapBgImg = new Image();
      minimapBgImg.src = mapData.bgImage;
      var lbl = document.getElementById('minimap-label');
      if (lbl) {
        lbl.textContent = mapData.name || 'Miếu Hoang';
      }
    }
  }

  /**
   * Gắn các sự kiện click, nút bấm, phím tắt
   */
  function bindEvents() {
    // 1. Vòng tương sinh / Khung nhân vật -> Mở bảng thông tin ngũ hành
    var ringWrap = document.getElementById('tuong-sinh-ring');
    var charFrame = document.getElementById('char-frame');
    var charPanel = document.getElementById('char-panel');
    var closeCharPanel = document.getElementById('close-char-panel');

    function openCharPanel() {
      if (audioAPI) audioAPI.playClick();
      updateCharPanelContent();
      charPanel.classList.remove('hidden');
    }

    if (ringWrap) ringWrap.addEventListener('click', openCharPanel);
    if (charFrame) charFrame.addEventListener('click', openCharPanel);
    if (closeCharPanel) {
      closeCharPanel.addEventListener('click', function (e) {
        e.stopPropagation();
        if (audioAPI) audioAPI.playClick();
        charPanel.classList.add('hidden');
      });
    }

    // 2. Thu gọn / bung bảng nhiệm vụ
    var questHeader = document.getElementById('quest-panel-header');
    var questPanel = document.getElementById('quest-panel');
    if (questHeader && questPanel) {
      questHeader.addEventListener('click', function () {
        if (audioAPI) audioAPI.playClick();
        questPanel.classList.toggle('collapsed');
      });
    }

    // 3. Nút Cài đặt
    var btnSettings = document.getElementById('btn-settings');
    var settingsModal = document.getElementById('settings-modal');
    var closeSettings = document.getElementById('close-settings');
    if (btnSettings && settingsModal) {
      btnSettings.addEventListener('click', function () {
        if (audioAPI) audioAPI.playClick();
        openSettingsModal();
      });
    }
    if (closeSettings && settingsModal) {
      closeSettings.addEventListener('click', function () {
        if (audioAPI) audioAPI.playClick();
        settingsModal.classList.add('hidden');
      });
    }

    // 4. Nút Túi Đồ [B]
    var btnBag = document.getElementById('btn-bag');
    var bagModal = document.getElementById('bag-modal');
    var closeBag = document.getElementById('close-bag-modal');

    function toggleBag() {
      if (!bagModal) return;
      if (bagModal.classList.contains('hidden')) {
        openBagModal();
      } else {
        closeBagModal();
      }
    }

    if (btnBag) btnBag.addEventListener('click', toggleBag);
    if (closeBag) closeBag.addEventListener('click', closeBagModal);

    // Đợt N2: nút Linh Thú (HUD) + Thuần Phục/Hợp Kích (cụm chiến đấu) + lối vào từ Cài Đặt.
    var btnLinhThu = document.getElementById('btn-linhthu');
    if (btnLinhThu && !btnLinhThu.dataset.wired) {
      btnLinhThu.dataset.wired = '1';
      btnLinhThu.addEventListener('click', function () {
        if (audioAPI) audioAPI.playClick();
        var m = document.getElementById('linh-thu-modal');
        if (m && !m.classList.contains('hidden')) closeLinhThu(); else openLinhThu();
      });
    }
    var closeLt = document.getElementById('close-linh-thu-modal');
    if (closeLt && !closeLt.dataset.wired) { closeLt.dataset.wired = '1'; closeLt.addEventListener('click', closeLinhThu); }
    var closeLtBtn = document.getElementById('btn-close-linh-thu-modal');
    if (closeLtBtn && !closeLtBtn.dataset.wired) { closeLtBtn.dataset.wired = '1'; closeLtBtn.addEventListener('click', closeLinhThu); }
    var btnTame = document.getElementById('btn-thuan-phuc');
    if (btnTame && !btnTame.dataset.wired) {
      btnTame.dataset.wired = '1';
      btnTame.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.attemptTame) window.GameEngine.attemptTame();
      });
    }
    var btnHarm = document.getElementById('btn-hop-kich');
    if (btnHarm && !btnHarm.dataset.wired) {
      btnHarm.dataset.wired = '1';
      btnHarm.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.harmonyStrike) window.GameEngine.harmonyStrike();
      });
    }
    var btnLtSettings = document.getElementById('btn-open-linhthu-settings');
    if (btnLtSettings && !btnLtSettings.dataset.wired) {
      btnLtSettings.dataset.wired = '1';
      btnLtSettings.addEventListener('click', function () {
        var sm = document.getElementById('settings-modal');
        if (sm) sm.classList.add('hidden');
        openLinhThu();
      });
    }

    // Phím tắt bàn phím: B mở túi, phím số 1..9 tung chiêu theo thứ tự
    // trên thanh kỹ năng của registry (Đợt K1 — không gán cứng id chiêu).
    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'b' || e.key === 'B') {
        toggleBag();
      } else if (/^[1-9]$/.test(e.key)) {
        var loadoutKey = window.GameSkills ? window.GameSkills.getLoadout() : [];
        var keyDef = loadoutKey[parseInt(e.key, 10) - 1];
        if (keyDef && window.GameEngine && window.GameEngine.castSkill) {
          window.GameEngine.castSkill(keyDef.id);
        }
      }
    });

    // 5. Nút kỹ năng: dựng từ registry (tên, icon, tooltip, hành vi bấm đều
    // lấy từ định nghĩa chiêu — thêm chiêu mới chỉ cần thêm dữ liệu + ô nút).
    bindSkillSlots();

    // 5b. Nút hành động theo ngữ cảnh + nút tự tìm đường theo nhiệm vụ
    var btnAction = document.getElementById('btn-action');
    if (btnAction) {
      btnAction.addEventListener('click', function () {
        if (window.GameEngine && window.GameEngine.performContextAction) {
          window.GameEngine.performContextAction();
        }
      });
    }
    var btnAutoPath = document.getElementById('btn-auto-path');
    if (btnAutoPath) {
      btnAutoPath.addEventListener('click', function () {
        if (window.GameEngine && window.GameEngine.toggleAutoQuestPath) {
          window.GameEngine.toggleAutoQuestPath();
        }
      });
    }

    // 6. Death buttons
    var btnReviveSpot = document.getElementById('btn-revive-spot');
    var btnReviveHome = document.getElementById('btn-revive-home');
    if (btnReviveSpot) {
      btnReviveSpot.addEventListener('click', function () {
        if (window.GameEngine && window.GameEngine.handleRevive) {
          window.GameEngine.handleRevive('spot');
        }
      });
    }
    if (btnReviveHome) {
      btnReviveHome.addEventListener('click', function () {
        if (window.GameEngine && window.GameEngine.handleRevive) {
          window.GameEngine.handleRevive('home');
        }
      });
    }

    // 7. Session summary close button
    var btnCloseSummary = document.getElementById('btn-close-summary');
    var closeSummaryX = document.getElementById('close-summary-modal');
    var summaryModal = document.getElementById('session-summary-modal');
    function hideSummary() {
      if (audioAPI) audioAPI.playClick();
      if (summaryModal) summaryModal.classList.add('hidden');
    }
    if (btnCloseSummary) btnCloseSummary.addEventListener('click', hideSummary);
    if (closeSummaryX) closeSummaryX.addEventListener('click', hideSummary);

    // 8. Hộp thoại: click vào box hoặc nhấn Space để tiếp tục
    var dialogueBox = document.getElementById('dialogue-box');
    if (dialogueBox) {
      dialogueBox.addEventListener('click', advanceDialogue);
    }
    window.addEventListener('keydown', function (e) {
      if (dialogueState.active && (e.key === ' ' || e.key === 'Enter')) {
        advanceDialogue();
      }
    });

    // 9. Minimap click -> Danh Mục Khu Vực (Zone Modal)
    var minimapWrap = document.getElementById('minimap-wrap');
    if (minimapWrap) {
      minimapWrap.addEventListener('click', openZoneModal);
    }
    var closeZoneModalBtn = document.getElementById('close-zone-modal');
    var btnCloseZoneModal = document.getElementById('btn-close-zone-modal');
    if (closeZoneModalBtn) closeZoneModalBtn.addEventListener('click', closeZoneModal);
    if (btnCloseZoneModal) btnCloseZoneModal.addEventListener('click', closeZoneModal);

    // 10. Đài Truyền Tống (Teleport Modal)
    var closeTeleportBtn = document.getElementById('close-teleport-modal');
    var btnCloseTeleport = document.getElementById('btn-close-teleport-modal');
    if (closeTeleportBtn) closeTeleportBtn.addEventListener('click', closeTeleportModal);
    if (btnCloseTeleport) btnCloseTeleport.addEventListener('click', closeTeleportModal);

    var tpMieu = document.getElementById('teleport-btn-mieu');
    var tpRungDoc = document.getElementById('teleport-btn-rungdoc');
    var tpTongMon = document.getElementById('teleport-btn-tongmon');
    if (tpMieu) {
      tpMieu.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.teleportTo) {
          window.GameEngine.teleportTo('mieu_hoang', 560, 620);
        }
      });
    }
    if (tpRungDoc) {
      tpRungDoc.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.teleportTo) {
          window.GameEngine.teleportTo('rung-doc', 90, 560);
        }
      });
    }
    if (tpTongMon) {
      tpTongMon.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.teleportTo) {
          window.GameEngine.teleportTo('tong-mon', 960, 1150);
        }
      });
    }

    var tpHoBang = document.getElementById('teleport-btn-hobang');
    if (tpHoBang) {
      tpHoBang.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.teleportTo) {
          window.GameEngine.teleportTo('ho-bang', 90, 640);
        }
      });
    }
    var tpMoLua = document.getElementById('teleport-btn-molua');
    if (tpMoLua) {
      tpMoLua.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.teleportTo) {
          window.GameEngine.teleportTo('mo-lua', 90, 640);
        }
      });
    }
    var tpHoangMac = document.getElementById('teleport-btn-hoangmac');
    if (tpHoangMac) {
      tpHoangMac.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.teleportTo) {
          window.GameEngine.teleportTo('hoang-mac', 90, 640);
        }
      });
    }
    var tpKiemTrung = document.getElementById('teleport-btn-kiemtrung');
    if (tpKiemTrung) {
      tpKiemTrung.addEventListener('click', function () {
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.teleportTo) {
          window.GameEngine.teleportTo('kiem-trung', 90, 640);
        }
      });
    }

    // 11. Đợt 6: zoom camera, thẻ chi tiết túi, đổi đan, hướng dẫn, xóa nhân vật, khóa zoom cử chỉ, cần gậy
    wireZoomControls();
    wireBagDetailControls();
    wirePillExchange();
    wireTutorialAndDelete();
    lockGestureZoom();
    initJoystick();
    wireSettingsExtras();
    wireQuestToggle();
    startClockAndIdleWatch();

    // Đợt LINHME: Canh tác Linh Mễ, Đổi thức ăn, Việc vụ Tông Môn
    wireTongMonFarm();
    wireFoodExchange();
    wireSectQuests();
  }

  // ---------- ĐỢT 6 (mục 15): CÁC ĐIỀU KHIỂN CÀI ĐẶT BỔ SUNG ----------
  var GIFTCODES = {
    'NGUHANH2026': { linhThach: 50, msg: 'Mã quà tặng: nhận 50 Linh Thạch!' },
    'TANTHU': { itemId: 'dan-moc', count: 2, msg: 'Mã quà tặng: nhận 2 Đan Mộc!' },
    'LINHTHACH100K': { linhThach: 100000, msg: 'Mã quà tặng: nhận 100.000 Linh Thạch!' }
  };
  var idleState = { lastActive: Date.now(), mutedByIdle: false };
  var personalTimer = { endAt: 0, interval: null };

  function applyExtraDisplaySettings(s) {
    if (!s || typeof document === 'undefined') return;
    var root = document.documentElement;
    if (root && root.style) {
      root.style.setProperty('--ctl-opacity', String((typeof s.ctlOpacity === 'number') ? s.ctlOpacity : 1));
    }
    var canvas = document.getElementById('game-canvas');
    if (canvas) canvas.style.filter = 'brightness(' + ((typeof s.brightness === 'number') ? s.brightness : 1) + ')';
    document.body.classList.toggle('lefty', !!s.lefty);
    var dlg = document.getElementById('dialogue-box');
    if (dlg) {
      dlg.classList.remove('dlg-size-nho', 'dlg-size-vua', 'dlg-size-lon');
      dlg.classList.add('dlg-size-' + (s.dialogTextSize || 'vua'));
    }
    var clock = document.getElementById('hud-clock');
    if (clock) clock.classList.toggle('hidden', !s.showClock);
  }

  function wireSettingsExtras() {
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    if (!st) return;
    applyExtraDisplaySettings(st.loadSettings());
    var bindRange = function (id, key, valId, fmt) {
      var el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('input', function () {
        var patch = {};
        patch[key] = Number(el.value) / 100;
        var merged = st.saveSettings(patch);
        var v = document.getElementById(valId);
        if (v) v.textContent = fmt(Number(el.value));
        applyDisplaySettings(merged);
        applyExtraDisplaySettings(merged);
      });
    };
    bindRange('setting-opacity', 'ctlOpacity', 'setting-opacity-val', function (v) { return v + '%'; });
    bindRange('setting-brightness', 'brightness', 'setting-brightness-val', function (v) { return v + '%'; });
    bindRange('setting-joy-deadzone', 'joyDeadzone', 'setting-joy-deadzone-val', function (v) { return v + '%'; });

    var bindToggle = function (id, key, after) {
      var el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('change', function () {
        var patch = {};
        patch[key] = el.checked;
        var merged = st.saveSettings(patch);
        applyExtraDisplaySettings(merged);
        if (after) after(el.checked);
      });
    };
    bindToggle('setting-hide-hat', 'hideHat');
    bindToggle('setting-lefty', 'lefty');
    bindToggle('setting-clock-toggle', 'showClock');
    bindToggle('setting-duck-toggle', 'duckMusic');
    bindToggle('setting-idle-mute', 'idleMute');
    bindToggle('setting-telegraph-toggle', 'showBossTelegraph');
    bindToggle('setting-monster-hp-toggle', 'showMonsterHpText');
    bindToggle('setting-ring-toggle', 'showAggroRing');
    bindToggle('setting-dest-dot-toggle', 'minimapDestDot');

    var bindSel = function (id, key, after) {
      var el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('change', function () {
        var patch = {};
        patch[key] = el.value;
        var merged = st.saveSettings(patch);
        if (after) after(el.value, merged);
      });
    };
    bindSel('setting-dialog-size', 'dialogTextSize', function () { applyExtraDisplaySettings(st.loadSettings()); });
    bindSel('setting-autopickup-rank', 'autoPickupRank');
    bindSel('setting-fps', 'fpsLimit', function (v) { showToast('Giới hạn khung hình: ' + v + ' FPS'); });
    var camSel = document.getElementById('setting-camera-dist');
    if (camSel && !camSel.dataset.wired) {
      camSel.dataset.wired = '1';
      camSel.addEventListener('change', function () {
        var z = camSel.value === 'gan' ? 1.25 : (camSel.value === 'xa' ? 0.8 : 1.0);
        applyZoom(z);
      });
    }

    var btnGift = document.getElementById('btn-giftcode');
    if (btnGift && !btnGift.dataset.wired) {
      btnGift.dataset.wired = '1';
      btnGift.addEventListener('click', function () {
        var input = document.getElementById('giftcode-input');
        var code = input ? input.value.trim().toUpperCase() : '';
        var gift = GIFTCODES[code];
        if (!gift) { showToast('Mã quà tặng không đúng hoặc đã hết hạn.'); return; }
        if (!player) { showToast('Hãy vào game trước khi đổi quà.'); return; }
        player.usedGiftcodes = player.usedGiftcodes || {};
        if (player.usedGiftcodes[code]) { showToast('Mã này đã được đổi rồi.'); return; }
        player.usedGiftcodes[code] = true;
        if (gift.linhThach) player.linhThach = (player.linhThach || 0) + gift.linhThach;
        if (gift.itemId && stateAPI && stateAPI.addItemToBag) stateAPI.addItemToBag(player, gift.itemId, gift.count || 1);
        if (stateAPI) stateAPI.savePlayer(player);
        if (input) input.value = '';
        showToast(gift.msg);
        refreshHUD();
      });
    }

    var btnStats = document.getElementById('btn-open-stats');
    if (btnStats && !btnStats.dataset.wired) {
      btnStats.dataset.wired = '1';
      btnStats.addEventListener('click', function () {
        var sm = document.getElementById('settings-modal');
        if (sm) sm.classList.add('hidden');
        openStatsModal();
      });
    }
    var closeStats = document.getElementById('close-stats-modal');
    if (closeStats) closeStats.addEventListener('click', function () { document.getElementById('stats-modal').classList.add('hidden'); });
    var btnCloseStats = document.getElementById('btn-close-stats');
    if (btnCloseStats) btnCloseStats.addEventListener('click', function () { document.getElementById('stats-modal').classList.add('hidden'); });

    var btnTimer = document.getElementById('btn-set-timer');
    if (btnTimer && !btnTimer.dataset.wired) {
      btnTimer.dataset.wired = '1';
      btnTimer.addEventListener('click', function () {
        var inp = document.getElementById('timer-minutes');
        var mins = Math.max(1, Math.min(600, Number(inp ? inp.value : 25) || 25));
        startPersonalTimer(mins);
        showToast('Đã đặt hẹn giờ ' + mins + ' phút');
      });
    }

    var btnPhoto = document.getElementById('btn-photo-mode');
    if (btnPhoto && !btnPhoto.dataset.wired) {
      btnPhoto.dataset.wired = '1';
      btnPhoto.addEventListener('click', function () {
        var sm = document.getElementById('settings-modal');
        if (sm) sm.classList.add('hidden');
        showToast('Chế độ chụp hình: chạm vào màn hình để hiện lại giao diện');
        setTimeout(function () { document.body.classList.add('photo-mode'); }, 900);
        var off = function () {
          document.body.classList.remove('photo-mode');
          document.removeEventListener('pointerdown', off, true);
        };
        setTimeout(function () { document.addEventListener('pointerdown', off, true); }, 1250);
      });
    }

    var btnExport = document.getElementById('btn-export-settings');
    if (btnExport && !btnExport.dataset.wired) {
      btnExport.dataset.wired = '1';
      btnExport.addEventListener('click', function () {
        var ta = document.getElementById('settings-code');
        if (ta) ta.value = btoa(unescape(encodeURIComponent(JSON.stringify(st.loadSettings()))));
        showToast('Đã xuất mã cấu hình — sao chép và giữ lại để mang sang máy khác');
      });
    }
    var btnImport = document.getElementById('btn-import-settings');
    if (btnImport && !btnImport.dataset.wired) {
      btnImport.dataset.wired = '1';
      btnImport.addEventListener('click', function () {
        var ta = document.getElementById('settings-code');
        try {
          var obj = JSON.parse(decodeURIComponent(escape(atob((ta ? ta.value : '').trim()))));
          var merged = st.saveSettings(obj);
          applyAudioSettings(merged);
          applyDisplaySettings(merged);
          applyExtraDisplaySettings(merged);
          refreshSettingsControls();
          showToast('Đã nhập cấu hình cài đặt thành công');
        } catch (e) {
          showToast('Mã cấu hình không hợp lệ');
        }
      });
    }

    var btnReset = document.getElementById('btn-reset-settings');
    if (btnReset && !btnReset.dataset.wired) {
      btnReset.dataset.wired = '1';
      btnReset.addEventListener('click', function () {
        if (!btnReset.dataset.armed) {
          btnReset.dataset.armed = '1';
          btnReset.textContent = 'Chắc chắn khôi phục mặc định?';
          setTimeout(function () { btnReset.dataset.armed = ''; btnReset.textContent = 'Khôi phục mặc định'; }, 3000);
          return;
        }
        btnReset.dataset.armed = '';
        btnReset.textContent = 'Khôi phục mặc định';
        var fresh = st.saveSettings(st.defaultSettings ? st.defaultSettings() : {});
        applyAudioSettings(fresh);
        applyDisplaySettings(fresh);
        applyExtraDisplaySettings(fresh);
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.setUserZoom) window.GameEngine.setUserZoom(1.0);
        refreshSettingsControls();
        showToast('Đã khôi phục cài đặt mặc định');
      });
    }

    var btnSwitch = document.getElementById('btn-switch-char');
    if (btnSwitch && !btnSwitch.dataset.wired) {
      btnSwitch.dataset.wired = '1';
      btnSwitch.addEventListener('click', function () {
        try {
          var prefix = (stateAPI && stateAPI.STORAGE_PREFIX) ? stateAPI.STORAGE_PREFIX : 'nguhanh_';
          if (window.localStorage) window.localStorage.removeItem(prefix + 'active_char');
        } catch (e) {}
        window.location.reload();
      });
    }

    var btnSort = document.getElementById('btn-sort-bag');
    if (btnSort && !btnSort.dataset.wired) {
      btnSort.dataset.wired = '1';
      btnSort.addEventListener('click', function () { sortBag(); });
    }
  }

  function openStatsModal() {
    var modal = document.getElementById('stats-modal');
    if (!modal || !player) return;
    var s = player.stats || {};
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    var mins = Math.floor((s.playSec || 0) / 60);
    set('stats-playtime', mins >= 60 ? (Math.floor(mins / 60) + ' giờ ' + (mins % 60) + ' phút') : (mins + ' phút'));
    set('stats-kills', s.kills || 0);
    set('stats-bosses', s.bossKills || 0);
    set('stats-harvests', s.harvests || 0);
    set('stats-refines', s.refines || 0);
    modal.classList.remove('hidden');
  }

  function sortBag(targetPlayer) {
    var p = targetPlayer || player;
    if (!p || !p.bag) return;
    var defs = (typeof itemDefs === 'function') ? itemDefs() : ((typeof monstersAPI !== 'undefined' && monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS : {});
    var rank = { legend: 5, epic: 4, rare: 3, good: 2, common: 1 };
    var slots = (typeof currentBagSlots === 'function' && !targetPlayer) ? currentBagSlots() : (p.bag && p.bag.slots ? p.bag.slots : []);
    if (!slots || !Array.isArray(slots)) return;

    // Gộp chồng theo cặp (itemId, herbQuality)
    var merged = {};
    var order = [];
    var containerItems = [];
    var hqAPI = (typeof window !== 'undefined' && window.GameHerbQuality) ? window.GameHerbQuality : (typeof require === 'function' ? (function () { try { return require('./herb-quality.js'); } catch (e) { return null; } })() : null);

    for (var i = 0; i < slots.length; i++) {
      var sd = slots[i];
      if (!sd) continue;
      // Bảo toàn vật chứa con nếu có
      if (tuiKhoAPI && tuiKhoAPI.isContainerItem && tuiKhoAPI.isContainerItem(sd)) {
        containerItems.push(sd);
        continue;
      }
      if (!sd.itemId) continue;

      var hasQuality = (sd.herbQuality !== undefined && sd.herbQuality !== null);
      var qVal = hasQuality ? Math.max(0, Math.min(3, Math.floor(Number(sd.herbQuality) || 0))) : undefined;
      var key = hasQuality ? (sd.itemId + '__hq_' + qVal) : sd.itemId;

      if (merged[key]) {
        merged[key].count += (sd.count || 1);
        if (sd.starred) merged[key].starred = true;
        if (sd.locked) merged[key].locked = true;
      } else {
        var entry = { itemId: sd.itemId, count: sd.count || 1 };
        if (hasQuality) {
          entry.herbQuality = qVal;
          if (sd.herbQualityName) {
            entry.herbQualityName = sd.herbQualityName;
          } else if (hqAPI && hqAPI.getQualityLabel) {
            entry.herbQualityName = hqAPI.getQualityLabel(qVal);
          } else {
            entry.herbQualityName = ['Hạ phẩm', 'Trung phẩm', 'Thượng phẩm', 'Cực phẩm'][qVal] || 'Trung phẩm';
          }
        }
        if (sd.starred) entry.starred = true;
        if (sd.locked) entry.locked = true;
        merged[key] = entry;
        order.push(key);
      }
    }

    var arr = order.map(function (k) { return merged[k]; });
    arr.sort(function (a, b) {
      var da = defs[a.itemId] || {};
      var db = defs[b.itemId] || {};
      var ra = rank[da.quality] || 0;
      var rb = rank[db.quality] || 0;
      if (rb !== ra) return rb - ra;
      var cmpType = String(da.type || '').localeCompare(String(db.type || ''));
      if (cmpType !== 0) return cmpType;
      if (a.itemId !== b.itemId) return String(a.itemId).localeCompare(String(db.itemId));
      var qa = (a.herbQuality !== undefined && a.herbQuality !== null) ? Number(a.herbQuality) : -1;
      var qb = (b.herbQuality !== undefined && b.herbQuality !== null) ? Number(b.herbQuality) : -1;
      return qb - qa;
    });

    var finalArr = containerItems.concat(arr);
    for (var j = 0; j < slots.length; j++) {
      slots[j] = finalArr[j] || null;
    }
    p.bagLocks = {};
    selectedBagSlot = null;
    if (stateAPI && stateAPI.savePlayer) stateAPI.savePlayer(p);
    if (typeof renderBagGrid === 'function' && !targetPlayer) renderBagGrid();
    if (typeof showToast === 'function') showToast('Đã sắp xếp túi đồ');
  }

  function startPersonalTimer(mins) {
    var chip = document.getElementById('hud-timer');
    personalTimer.endAt = Date.now() + mins * 60000;
    if (personalTimer.interval) clearInterval(personalTimer.interval);
    var tick = function () {
      var left = Math.max(0, Math.round((personalTimer.endAt - Date.now()) / 1000));
      if (chip) {
        chip.classList.remove('hidden');
        var mm = Math.floor(left / 60);
        var ss = left % 60;
        chip.textContent = 'Hẹn giờ: ' + mm + ':' + (ss < 10 ? '0' : '') + ss;
      }
      if (left <= 0) {
        clearInterval(personalTimer.interval);
        personalTimer.interval = null;
        if (chip) chip.classList.add('hidden');
        showToast('Hẹn giờ cá nhân đã tới!');
        if (audioAPI) audioAPI.playChime();
      }
    };
    tick();
    personalTimer.interval = setInterval(tick, 1000);
  }

  function wireQuestToggle() {
    var btn = document.getElementById('btn-toggle-quest');
    var panel = document.getElementById('quest-panel');
    if (!btn || !panel || btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('collapsed');
    });
  }

  function startClockAndIdleWatch() {
    var bump = function () {
      idleState.lastActive = Date.now();
      if (idleState.mutedByIdle) {
        idleState.mutedByIdle = false;
        var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
        if (st) applyAudioSettings(st.loadSettings());
      }
    };
    window.addEventListener('pointerdown', bump, { passive: true });
    window.addEventListener('keydown', bump);
    setInterval(function () {
      var clock = document.getElementById('hud-clock');
      var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
      var s = st ? st.loadSettings() : null;
      if (clock && s && s.showClock) {
        var d = new Date();
        var hh = d.getHours();
        var mm = d.getMinutes();
        clock.textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
      }
      if (s && s.idleMute && !idleState.mutedByIdle && Date.now() - idleState.lastActive > 5 * 60000) {
        idleState.mutedByIdle = true;
        if (audioAPI) { audioAPI.setMusicVolume(0); audioAPI.setSfxVolume(0); }
        if (typeof window !== 'undefined' && window.GameMusic) window.GameMusic.setMuted(true);
        if (typeof window !== 'undefined' && window.GameVoice) window.GameVoice.setMuted(true);
      }
    }, 5000);
  }

  // ---------- ĐỢT 6: ZOOM CAMERA BẰNG NÚT (mục 10) ----------
  function currentZoom() {
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getUserZoom) {
      return window.GameEngine.getUserZoom();
    }
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    var s = st ? st.loadSettings() : null;
    return (s && typeof s.zoom === 'number') ? s.zoom : 1.0;
  }

  function applyZoom(z) {
    var nz = Math.max(0.75, Math.min(1.5, Math.round(z * 100) / 100));
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.setUserZoom) {
      nz = window.GameEngine.setUserZoom(nz);
    }
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    if (st) st.saveSettings({ zoom: nz, display: { zoom: nz } });
    var valEl = document.getElementById('setting-zoom-val');
    if (valEl) valEl.textContent = Math.round(nz * 100) + '%';
    return nz;
  }

  function stepZoom(dir) {
    var z = applyZoom(currentZoom() + (dir > 0 ? 0.15 : -0.15));
    showToast('Thu phóng camera: ' + Math.round(z * 100) + '%');
  }

  function wireZoomControls() {
    var bindStep = function (id, dir) {
      var el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        if (audioAPI) audioAPI.playClick();
        stepZoom(dir);
      });
    };
    bindStep('btn-zoom-in', 1);
    bindStep('btn-zoom-out', -1);
    bindStep('setting-btn-zoom-in', 1);
    bindStep('setting-btn-zoom-out', -1);
    var valEl = document.getElementById('setting-zoom-val');
    if (valEl) valEl.textContent = Math.round(currentZoom() * 100) + '%';
  }

  // ---------- ĐỢT 6: KHÓA ZOOM BẰNG CỬ CHỈ (mục 10a) ----------
  function lockGestureZoom() {
    var gc = document.getElementById('game-container') || document.body;
    if (!gc || gc.dataset.zoomLocked) return;
    gc.dataset.zoomLocked = '1';
    var prevent = function (e) { e.preventDefault(); };
    gc.addEventListener('gesturestart', prevent, { passive: false });
    gc.addEventListener('gesturechange', prevent, { passive: false });
    gc.addEventListener('gestureend', prevent, { passive: false });
    gc.addEventListener('dblclick', prevent, { passive: false });
    gc.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  }

  // ---------- ĐỢT 6: CẦN GẬY ĐIỀU KHIỂN THẬT + 2 CHẾ ĐỘ (mục 15/16) ----------
  var joyRuntime = { active: false, pointerId: null, cx: 0, cy: 0, floating: false };

  function joystickMode() {
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    var s = st ? st.loadSettings() : null;
    return (s && s.joystickMode === 'linh_hoat') ? 'linh_hoat' : 'co_dinh';
  }

  function joySetVector(dx, dy) {
    var mag = Math.hypot(dx, dy);
    var dzNow = 0.15;
    try {
      var stDz = stateAPI ? stateAPI.loadSettings() : null;
      if (stDz && typeof stDz.joyDeadzone === 'number') dzNow = stDz.joyDeadzone;
    } catch (e) {}
    if (mag < dzNow) { dx = 0; dy = 0; }
    else if (mag > 1) { dx /= mag; dy /= mag; }
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.setJoystickVector) {
      window.GameEngine.setJoystickVector(dx, dy);
    }
  }

  function joyMoveStick(dxPx, dyPx) {
    var stick = document.getElementById('joystick-stick');
    if (stick) stick.style.transform = 'translate(' + dxPx + 'px, ' + dyPx + 'px)';
  }

  function joyStart(cx, cy, pointerId, floating) {
    joyRuntime.active = true;
    joyRuntime.pointerId = pointerId;
    joyRuntime.cx = cx;
    joyRuntime.cy = cy;
    joyRuntime.floating = !!floating;
    if (typeof window !== 'undefined' && window.GameEngine) {
      if (window.GameEngine.cancelAutoPath) window.GameEngine.cancelAutoPath();
      if (window.GameEngine.cancelTravel) window.GameEngine.cancelTravel();
    }
  }

  function joyDrag(clientX, clientY) {
    if (!joyRuntime.active) return;
    var maxR = 42;
    var dx = clientX - joyRuntime.cx;
    var dy = clientY - joyRuntime.cy;
    var d = Math.hypot(dx, dy);
    var sx = dx, sy = dy;
    if (d > maxR) { sx = dx / d * maxR; sy = dy / d * maxR; }
    joyMoveStick(sx, sy);
    joySetVector(dx / maxR, dy / maxR);
  }

  function joyEnd() {
    if (!joyRuntime.active) return;
    joyRuntime.active = false;
    joyRuntime.pointerId = null;
    joyMoveStick(0, 0);
    joySetVector(0, 0);
    if (joyRuntime.floating) {
      var zone = document.getElementById('joystick-zone');
      if (zone) { zone.style.left = ''; zone.style.top = ''; zone.style.bottom = ''; zone.style.right = ''; }
      joyRuntime.floating = false;
    }
  }

  function initJoystick() {
    var zone = document.getElementById('joystick-zone');
    var base = document.getElementById('joystick-base');
    if (!zone || zone.dataset.joyWired) return;
    zone.dataset.joyWired = '1';

    zone.addEventListener('pointerdown', function (e) {
      if (joyRuntime.active) return;
      e.preventDefault();
      e.stopPropagation();
      var rect = (base || zone).getBoundingClientRect();
      joyStart(rect.left + rect.width / 2, rect.top + rect.height / 2, e.pointerId, false);
      try { zone.setPointerCapture(e.pointerId); } catch (err) {}
      joyDrag(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', function (e) {
      if (joyRuntime.active && e.pointerId === joyRuntime.pointerId && !joyRuntime.floating) joyDrag(e.clientX, e.clientY);
    });
    var endH = function (e) {
      if (e.pointerId === joyRuntime.pointerId && !joyRuntime.floating) joyEnd();
    };
    zone.addEventListener('pointerup', endH);
    zone.addEventListener('pointercancel', endH);

    // Chế độ linh hoạt: chạm nửa dưới-trái vùng chơi (lên canvas) thì cần gậy xuất hiện tại điểm chạm
    var gc = document.getElementById('game-container');
    var canvas = document.getElementById('game-canvas');
    if (gc && canvas) {
      gc.addEventListener('pointerdown', function (e) {
        if (joystickMode() !== 'linh_hoat') return;
        if (e.target !== canvas) return;
        if (joyRuntime.active) return;
        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        if (e.clientX > w * 0.45 || e.clientY < h * 0.45) return;
        zone.style.left = (e.clientX - 65) + 'px';
        zone.style.top = (e.clientY - 65) + 'px';
        zone.style.bottom = 'auto';
        zone.style.right = 'auto';
        joyStart(e.clientX, e.clientY, e.pointerId, true);
        joyDrag(e.clientX, e.clientY);
      });
      window.addEventListener('pointermove', function (e) {
        if (joyRuntime.active && joyRuntime.floating && e.pointerId === joyRuntime.pointerId) joyDrag(e.clientX, e.clientY);
      });
      window.addEventListener('pointerup', function (e) {
        if (joyRuntime.floating && e.pointerId === joyRuntime.pointerId) joyEnd();
      });
      window.addEventListener('pointercancel', function (e) {
        if (joyRuntime.floating && e.pointerId === joyRuntime.pointerId) joyEnd();
      });
    }
  }

  // ---------- ĐỢT 6: MỞ LẠI HƯỚNG DẪN + XÓA NHÂN VẬT (mục 15/16) ----------
  function wireTutorialAndDelete() {
    var btnTut = document.getElementById('btn-restart-tutorial');
    if (btnTut && !btnTut.dataset.wired) {
      btnTut.dataset.wired = '1';
      btnTut.addEventListener('click', function () {
        var sm = document.getElementById('settings-modal');
        if (sm) sm.classList.add('hidden');
        if (typeof window !== 'undefined' && window.GameTutorial && window.GameTutorial.restartTutorial) {
          window.GameTutorial.restartTutorial();
          showToast('Đã mở lại hướng dẫn tân thủ');
        }
      });
    }
    var btnDel = document.getElementById('btn-delete-char');
    var confirmModal = document.getElementById('confirm-delete-modal');
    if (btnDel && confirmModal && !btnDel.dataset.wired) {
      btnDel.dataset.wired = '1';
      btnDel.addEventListener('click', function () { confirmModal.classList.remove('hidden'); });
      var btnCancel = document.getElementById('btn-cancel-delete');
      if (btnCancel) btnCancel.addEventListener('click', function () { confirmModal.classList.add('hidden'); });
      var btnConfirm = document.getElementById('btn-confirm-delete');
      if (btnConfirm) {
        btnConfirm.addEventListener('click', function () {
          try {
            var prefix = (stateAPI && stateAPI.STORAGE_PREFIX) ? stateAPI.STORAGE_PREFIX : 'nguhanh_';
            var name = player ? player.name : null;
            if (name && window.localStorage) {
              window.localStorage.removeItem(prefix + 'char_' + name);
              var listRaw = window.localStorage.getItem(prefix + 'chars');
              if (listRaw) {
                var list = JSON.parse(listRaw);
                if (Array.isArray(list)) {
                  list = list.filter(function (n) { return n !== name; });
                  window.localStorage.setItem(prefix + 'chars', JSON.stringify(list));
                }
              }
              if (window.localStorage.getItem(prefix + 'active_char') === name) {
                window.localStorage.removeItem(prefix + 'active_char');
              }
            }
          } catch (err) {}
          window.location.reload();
        });
      }
    }
  }

  function openBagModal() {
    if (audioAPI) audioAPI.playClick();
    var bagModal = document.getElementById('bag-modal');
    if (!bagModal) return;
    if (!tuiKhoAPI && typeof window !== 'undefined') tuiKhoAPI = window.GameTuiKho;
    if (player && tuiKhoAPI && tuiKhoAPI.ensureState) tuiKhoAPI.ensureState(player);
    if (!selectedBagContainerId && player && player.tuiKho) selectedBagContainerId = player.tuiKho.defaultContainerId;
    renderBagGrid();
    bagModal.classList.remove('hidden');
    // Gộp E1+E2+E3+N2: bỏ lệnh gọi wireBagContainerControls (hàm không tồn tại,
    // renderBagGrid đã dựng và nối thanh vật chứa/tab/tìm kiếm/kho).
    renderQuickSlots();
  }

  function closeBagModal() {
    if (audioAPI) audioAPI.playClick();
    var bagModal = document.getElementById('bag-modal');
    if (bagModal) bagModal.classList.add('hidden');
  }

  function currentBagContainer() {
    if (!tuiKhoAPI && typeof window !== 'undefined') tuiKhoAPI = window.GameTuiKho;
    if (!player || !tuiKhoAPI) return null;
    tuiKhoAPI.ensureState(player);
    if (!selectedBagContainerId || !tuiKhoAPI.getContainer(player, selectedBagContainerId)) {
      selectedBagContainerId = player.tuiKho.defaultContainerId;
    }
    return tuiKhoAPI.getContainer(player, selectedBagContainerId);
  }

  function currentBagSlots() {
    var c = currentBagContainer();
    return c ? c.slots : (player && player.bag ? player.bag.slots : []);
  }

  function renderQuickSlots() {
    if (!player) return;
    if (!tuiKhoAPI && typeof window !== 'undefined') tuiKhoAPI = window.GameTuiKho;
    if (tuiKhoAPI && tuiKhoAPI.ensureState) tuiKhoAPI.ensureState(player);
    var qs = (tuiKhoAPI && tuiKhoAPI.getQuickSlots) ? tuiKhoAPI.getQuickSlots(player) : [];
    var defs = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS : {};
    var els = document.querySelectorAll('.quick-slot');
    for (var i = 0; i < els.length; i++) {
      (function (el, idx) {
        el.innerHTML = '';
        var label = document.createElement('span');
        label.textContent = String(idx + 1);
        el.appendChild(label);
        var q = qs[idx];
        if (q && tuiKhoAPI.getContainer) {
          var c = tuiKhoAPI.getContainer(player, q.containerId);
          var s = c ? c.slots[q.slotIndex] : null;
          if (s && s.itemId) {
            var def = defs[s.itemId];
            if (def) {
              var icon = document.createElement('div');
              icon.className = 'quick-slot-icon';
              icon.style.backgroundImage = "url('assets/art/icons-sheet.png')";
              icon.style.backgroundPosition = (-(def.iconCol || 0) * 24) + 'px ' + (-(def.iconRow || 0) * 24) + 'px';
              icon.style.backgroundSize = '144px 192px';
              icon.style.width = '24px';
              icon.style.height = '24px';
              el.appendChild(icon);
            }
            el.title = (def ? def.name : s.itemId) + ' x' + (s.count || 1);
          } else if (tuiKhoAPI.clearQuickSlot) {
            tuiKhoAPI.clearQuickSlot(player, idx);
          }
        }
      })(els[i], i);
    }
  }

  function wireQuickSlots() {
    var els = document.querySelectorAll('.quick-slot');
    for (var i = 0; i < els.length; i++) {
      (function (el, idx) {
        if (el.dataset.wired) return;
        el.dataset.wired = '1';
        el.addEventListener('click', function () {
          if (!player || !tuiKhoAPI) return;
          var qs = tuiKhoAPI.getQuickSlots(player);
          var q = qs[idx];
          if (!q) { showToast('Ô dùng nhanh trống'); return; }
          var c = tuiKhoAPI.getContainer(player, q.containerId);
          var s = c ? c.slots[q.slotIndex] : null;
          if (!s || !s.itemId) { tuiKhoAPI.clearQuickSlot(player, idx); renderQuickSlots(); return; }
          var itemId = s.itemId;
          if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.useItem) {
            var res = window.GameEngine.useItem(itemId);
            if (res && res.msg) showToast(res.msg);
          }
          var c2 = tuiKhoAPI.getContainer(player, q.containerId);
          var s2 = c2 ? c2.slots[q.slotIndex] : null;
          if (!s2 || !s2.itemId) tuiKhoAPI.clearQuickSlot(player, idx);
          renderQuickSlots();
          if (stateAPI && stateAPI.savePlayer) stateAPI.savePlayer(player);
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) window.GameUI.refreshHUD();
        });
      })(els[i], i);
    }
  }

  function renderBagGrid() {
    var gridEl = document.getElementById('bag-grid');
    var ltVal = document.getElementById('bag-linh-thach-val');
    if (ltVal && player) {
      ltVal.textContent = player.linhThach || 0;
    }
    if (!gridEl || !player) return;
    if (!tuiKhoAPI && typeof window !== 'undefined') tuiKhoAPI = window.GameTuiKho;
    if (tuiKhoAPI && tuiKhoAPI.ensureState) tuiKhoAPI.ensureState(player);

    var container = currentBagContainer();
    if (!container) {
      if (!player.bag) player.bag = { slots: new Array(48).fill(null) };
      while (player.bag.slots.length < 48) player.bag.slots.push(null);
      container = { slots: player.bag.slots, id: null };
    }

    // breadcrumb + container bar
    renderBagContainerBar();
    renderBagBreadcrumb();
    renderBagTabs();
    renderBagStorageActions();

    gridEl.innerHTML = '';
    var defs = monstersAPI ? monstersAPI.ITEM_DEFS : {};
    var slots = container.slots || [];

    for (var i = 0; i < slots.length; i++) {
      (function (slotIndex) {
        var slotData = slots[slotIndex];
        var slotDiv = document.createElement('div');
        slotDiv.className = 'bag-slot';
        if (selectedBagSlot === slotIndex && selectedBagContainerId === container.id) slotDiv.classList.add('selected');

        // container item (vật chứa con)
        var isContainer = !!(tuiKhoAPI && tuiKhoAPI.isContainerItem && tuiKhoAPI.isContainerItem(slotData));
        if (isContainer) {
          var child = tuiKhoAPI.getContainer(player, slotData.containerId);
          slotDiv.classList.add('bag-slot-container');
          var nameSpan = document.createElement('span');
          nameSpan.className = 'bag-slot-container-name';
          nameSpan.textContent = child ? (child.name + ' (' + child.capacity + ')') : 'Vật chứa';
          slotDiv.appendChild(nameSpan);
        } else if (slotData && slotData.itemId) {
          var def = defs[slotData.itemId] || { name: slotData.itemId, iconCol: 0, iconRow: 0 };
          var iconDiv = document.createElement('div');
          iconDiv.className = 'bag-slot-icon';
          var posX = -(def.iconCol || 0) * 32;
          var posY = -(def.iconRow || 0) * 32;
          iconDiv.style.backgroundPosition = posX + 'px ' + posY + 'px';
          slotDiv.appendChild(iconDiv);

          if (slotData.herbQuality !== undefined) { var qSpan = document.createElement('span'); qSpan.className = 'bag-slot-quality'; qSpan.textContent = (window.GameHerbQuality && window.GameHerbQuality.getQualityShortLabel) ? window.GameHerbQuality.getQualityShortLabel(slotData.herbQuality) : ['Hạ','Trung','Thượng','Cực'][slotData.herbQuality]; qSpan.style.borderColor = ['#8b8b8b','#4f9d69','#4f83c4','#b07ad6'][slotData.herbQuality] || '#8b8b8b'; slotDiv.appendChild(qSpan); }

          if (slotData.count > 1) {
            var countSpan = document.createElement('span');
            countSpan.className = 'bag-slot-count';
            countSpan.textContent = slotData.count;
            slotDiv.appendChild(countSpan);
          }
          if (slotData.starred) {
            var starSpan = document.createElement('span');
            starSpan.className = 'bag-slot-star';
            starSpan.textContent = '★';
            slotDiv.appendChild(starSpan);
          }
          if (slotData.locked || (player.bagLocks && player.bagLocks[slotIndex])) {
            var lockSpan = document.createElement('span');
            lockSpan.className = 'bag-slot-lock';
            lockSpan.textContent = 'KHÓA';
            slotDiv.appendChild(lockSpan);
          }
        }

        // tab/search filtering (hide non-matching)
        var visible = true;
        if (currentBagTab && currentBagTab !== 'all' && slotData && !isContainer) {
          var def2 = defs[slotData.itemId] || {};
          var tab = (tuiKhoAPI && tuiKhoAPI.tabOfItem) ? tuiKhoAPI.tabOfItem(def2) : 'material';
          if (tab !== currentBagTab) visible = false;
        }
        if (currentBagSearch && slotData) {
          var kw = currentBagSearch.toLowerCase();
          var nm = '';
          if (isContainer) nm = (tuiKhoAPI.getContainer(player, slotData.containerId) || {}).name || '';
          else { var d = defs[slotData.itemId] || {}; nm = (d.name || slotData.itemId || '').toLowerCase(); }
          if (nm.toLowerCase().indexOf(kw) === -1 && (slotData.itemId || '').toLowerCase().indexOf(kw) === -1) visible = false;
        }
        if (!visible) slotDiv.style.display = 'none';

        slotDiv.addEventListener('click', function () {
          if (isContainer) {
            selectedBagContainerId = slotData.containerId;
            selectedBagSlot = null;
            renderBagGrid();
            return;
          }
          selectedBagSlot = slotIndex;
          selectedBagContainerId = container.id;
          selectedEquipSlot = null;
          renderBagGrid();
          updateItemInfo(slotData, defs);
        });

        gridEl.appendChild(slotDiv);
      })(i);
    }
    renderEquipSlots();
    refreshDetailCard();
  }

  function renderBagContainerBar() {
    var bar = document.getElementById('bag-container-bar');
    if (!bar || !player || !tuiKhoAPI) return;
    bar.innerHTML = '';
    var containers = tuiKhoAPI.getCarriedContainers ? tuiKhoAPI.getCarriedContainers(player) : [];
    // include temp/home/sect as buttons separately
    for (var i = 0; i < containers.length; i++) {
      (function (c) {
        var btn = document.createElement('button');
        btn.className = 'bag-container-btn' + (selectedBagContainerId === c.id ? ' active' : '');
        btn.textContent = c.name;
        btn.addEventListener('click', function () {
          selectedBagContainerId = c.id;
          selectedBagSlot = null;
          renderBagGrid();
        });
        bar.appendChild(btn);
      })(containers[i]);
    }
  }

  function renderBagBreadcrumb() {
    var bc = document.getElementById('bag-breadcrumb');
    if (!bc || !player || !tuiKhoAPI || !selectedBagContainerId) return;
    var path = tuiKhoAPI.getBreadcrumb ? tuiKhoAPI.getBreadcrumb(player, selectedBagContainerId) : [selectedBagContainerId];
    bc.innerHTML = '';
    var label = document.createElement('span');
    label.textContent = (path || []).join(' → ');
    bc.appendChild(label);
    if (path && path.length > 1) {
      var back = document.createElement('button');
      back.className = 'bag-back-btn';
      back.textContent = '← Túi chính';
      back.addEventListener('click', function () {
        if (player && player.tuiKho) {
          selectedBagContainerId = player.tuiKho.defaultContainerId;
          selectedBagSlot = null;
          renderBagGrid();
        }
      });
      bc.appendChild(back);
    }
  }

  function renderBagTabs() {
    var tabsEl = document.getElementById('bag-tabs');
    if (!tabsEl || !tuiKhoAPI) return;
    if (tabsEl.dataset.wired !== '1') {
      tabsEl.dataset.wired = '1';
    }
    tabsEl.innerHTML = '';
    var tabs = tuiKhoAPI.TABS || ['all','gear','fabao','consumable','biphaps','material','quest'];
    var labels = tuiKhoAPI.TAB_LABELS || {};
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        var btn = document.createElement('button');
        btn.className = 'bag-tab' + (currentBagTab === tab ? ' active' : '');
        btn.textContent = labels[tab] || tab;
        btn.addEventListener('click', function () {
          currentBagTab = tab;
          renderBagGrid();
        });
        tabsEl.appendChild(btn);
      })(tabs[i]);
    }
    // search input
    var searchEl = document.getElementById('bag-search');
    if (searchEl && searchEl.dataset.wired !== '1') {
      searchEl.dataset.wired = '1';
      searchEl.addEventListener('input', function () {
        currentBagSearch = searchEl.value || '';
        renderBagGrid();
      });
    }
  }

  function renderBagStorageActions() {
    var el = document.getElementById('bag-storage-actions');
    if (!el || !player || !tuiKhoAPI) return;
    el.innerHTML = '';
    var mapId = (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getCurrentMapId) ? window.GameEngine.getCurrentMapId() : null;
    var actions = [];
    // Rương Tạm: ở trấn/tông môn
    if (mapId === 'mieu_hoang' || mapId === 'tong-mon') actions.push({ label: 'Rương Tạm', id: player.tuiKho.tempChestId });
    if (mapId === 'mieu_hoang' || mapId === 'tong-mon') actions.push({ label: 'Kho Động Phủ', id: player.tuiKho.homeStorageId });
    if (mapId === 'tong-mon') actions.push({ label: 'Kho Tông Môn', id: player.tuiKho.sectStorageId });
    for (var i = 0; i < actions.length; i++) {
      (function (a) {
        var btn = document.createElement('button');
        btn.className = 'bag-storage-btn';
        btn.textContent = a.label;
        btn.addEventListener('click', function () {
          selectedBagContainerId = a.id;
          selectedBagSlot = null;
          renderBagGrid();
        });
        el.appendChild(btn);
      })(actions[i]);
    }
  }

  // ---------- ĐỢT 6: THẺ CHI TIẾT VẬT PHẨM + TRANG BỊ (mục 2 + mục 18) ----------
  var selectedEquipSlot = null;
  var dropArmTimer = null;

  var ITEM_TYPE_LABELS = { currency: 'Tiền tệ', material: 'Nguyên liệu', gear: 'Trang bị', consumable: 'Đan dược / Tiêu hao' };
  var ITEM_QUALITY_LABELS = { common: 'Phổ thông', good: 'Tốt', rare: 'Hiếm', epic: 'Sử thi', legend: 'Truyền thuyết' };
  var ITEM_QUALITY_COLORS = { common: '#cfd8dc', good: '#7ed491', rare: '#b78bfa', epic: '#ffb74d', legend: '#ff8a65' };
  var ELEM_NAMES = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };

  function itemDefs() {
    return (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS : {};
  }

  function setIconSprite(el, def, cellPx) {
    if (!el || !def) return;
    var scale = cellPx / 32; // sheet gốc: 6x7 ô 32px (nền 192x224)
    el.style.backgroundImage = "url('assets/art/icons-sheet.png')";
    el.style.backgroundSize = (192 * scale) + 'px ' + (256 * scale) + 'px';
    el.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.width = cellPx + 'px';
    el.style.height = cellPx + 'px';
  }

  function renderEquipSlots() {
    if (!player) return;
    if (!player.equipment) player.equipment = { weapon: null, armor: null, head: null, shoes: null, belt: null, jewelry: null, phapKhi: null };
    var defs = itemDefs();
    var slots = ['head', 'weapon', 'armor', 'shoes', 'belt', 'jewelry', 'phapKhi'];
    for (var i = 0; i < slots.length; i++) {
      (function (slotName) {
        var wrap = document.getElementById('equip-slot-' + slotName);
        if (!wrap) return;
        var iconEl = wrap.querySelector('.equip-slot-icon');
        var badgeEl = wrap.querySelector('.equip-slot-badge');
        var itemId = player.equipment[slotName];
        var def = itemId ? defs[itemId] : null;
        if (iconEl) {
          if (def) setIconSprite(iconEl, def, 32);
          else { iconEl.style.backgroundImage = 'none'; }
        }
        if (badgeEl) badgeEl.classList.toggle('hidden', !def);
        wrap.classList.toggle('selected', selectedEquipSlot === slotName);
        if (!wrap.dataset.wired) {
          wrap.dataset.wired = '1';
          wrap.addEventListener('click', function () {
            if (!player.equipment[slotName]) return;
            selectedEquipSlot = slotName;
            selectedBagSlot = null;
            renderBagGrid();
          });
        }
      })(slots[i]);
    }
  }

  function detailStatsHtml(def, itemId) {
    if (!def) return '';
    var lines = [];
    if (def.type === 'gear') {
      if (def.atk) lines.push('<div class="detail-stat-line">Công kích <b>+' + def.atk + '</b></div>');
      if (def.def) lines.push('<div class="detail-stat-line">Phòng thủ <b>+' + def.def + '</b></div>');
      if (!lines.length) lines.push('<div class="detail-stat-line">Trang bị vào người để nhận chỉ số.</div>');
    } else if (itemId && itemId.indexOf('dan-') === 0) {
      var elem = itemId.slice(4);
      lines.push('<div class="detail-stat-line">Dùng: <b>+20 tu vi đường ' + (ELEM_NAMES[elem] || elem) + '</b></div>');
    } else if (itemId === 'truc-co-dan') {
      lines.push('<div class="detail-stat-line">Dùng: <b>Đột phá Trúc Cơ</b> khi cả 5 đường đạt 900 tu vi</div>');
    } else if (itemId && itemId.indexOf('nguyen-tinh-') === 0) {
      lines.push('<div class="detail-stat-line">Nguyên liệu then chốt cho luyện đan và đột phá</div>');
    } else if (def.type === 'material') {
      lines.push('<div class="detail-stat-line">Nguyên liệu tu luyện / luyện chế</div>');
    } else if (def.type === 'consumable') {
      lines.push('<div class="detail-stat-line">Có thể dùng trực tiếp từ túi đồ</div>');
    }
    return lines.join('');
  }

  function refreshDetailCard() {
    var emptyEl = document.getElementById('detail-card-empty');
    var contentEl = document.getElementById('detail-card-content');
    if (!emptyEl || !contentEl || !player) return;

    var itemId = null;
    var count = null;
    var equipped = false;
    if (selectedEquipSlot && player.equipment && player.equipment[selectedEquipSlot]) {
      itemId = player.equipment[selectedEquipSlot];
      equipped = true;
    } else if (selectedBagSlot !== null && selectedBagSlot !== undefined) {
      var _slots = currentBagSlots();
      if (_slots && _slots[selectedBagSlot]) {
        itemId = _slots[selectedBagSlot].itemId;
        count = _slots[selectedBagSlot].count || 1;
      }
    }

    var btnUse = document.getElementById('btn-card-use');
    var btnEquip = document.getElementById('btn-card-equip');
    var btnUnequip = document.getElementById('btn-card-unequip');
    var btnDrop = document.getElementById('btn-card-drop');
    var disarmDrop = function () {
      if (btnDrop) { btnDrop.textContent = 'Bỏ'; btnDrop.classList.remove('armed'); }
      if (dropArmTimer) { clearTimeout(dropArmTimer); dropArmTimer = null; }
    };

    if (!itemId) {
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      disarmDrop();
      return;
    }
    var def = itemDefs()[itemId] || { name: itemId, type: 'material', desc: '' };
    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    setIconSprite(document.getElementById('detail-card-icon'), def, 64);
    var nameEl = document.getElementById('detail-card-name');
    if (nameEl) nameEl.textContent = def.name || itemId;
    var badgeEl = document.getElementById('detail-card-badge');
    if (badgeEl) badgeEl.classList.toggle('hidden', !equipped);
    var typeEl = document.getElementById('detail-card-type');
    if (typeEl) typeEl.textContent = ITEM_TYPE_LABELS[def.type] || def.type || 'Vật phẩm';
    var qualEl = document.getElementById('detail-card-quality');
    if (qualEl) {
      qualEl.textContent = ITEM_QUALITY_LABELS[def.quality] || 'Phổ thông';
      qualEl.style.color = ITEM_QUALITY_COLORS[def.quality] || ITEM_QUALITY_COLORS.common;
    }
    var countEl = document.getElementById('detail-card-count');
    if (countEl) countEl.textContent = equipped ? 'Đang trang bị' : ('Số lượng: ' + (count || 1));
    var statsEl = document.getElementById('detail-card-stats');
    if (statsEl) statsEl.innerHTML = detailStatsHtml(def, itemId);
    if (statsEl && def.type === 'gear' && tuiKhoAPI && tuiKhoAPI.compareGear) {
      var cmp = tuiKhoAPI.compareGear(player, itemId);
      if (cmp && cmp.ok && cmp.diff) {
        var cmpHtml = '<div class="detail-compare">';
        var keys = ['atk','def'];
        for (var ci = 0; ci < keys.length; ci++) {
          var k = keys[ci];
          var d = cmp.diff[k] || 0;
          var arrow = d > 0 ? '▲' : (d < 0 ? '▼' : '—');
          cmpHtml += '<div>' + k.toUpperCase() + ' ' + arrow + ' ' + (d > 0 ? '+' : '') + d + '</div>';
        }
        cmpHtml += '</div>';
        statsEl.innerHTML += cmpHtml;
      }
    }
    var descEl = document.getElementById('detail-card-desc');
    if (descEl) descEl.textContent = def.desc || '';

    if (btnUse) btnUse.classList.toggle('hidden', !(def.type === 'consumable' && !equipped));
    if (btnEquip) btnEquip.classList.toggle('hidden', !(def.type === 'gear' && !equipped));
    if (btnUnequip) btnUnequip.classList.toggle('hidden', !equipped);
    // Đợt 6 (mục 15, hồ sơ 25): vật phẩm đã khóa thì không bỏ được
    var _curSlot = (selectedBagSlot !== null && selectedBagSlot !== undefined) ? (currentBagSlots() || [])[selectedBagSlot] : null;
    var isLocked = !equipped && !!(_curSlot && _curSlot.locked) || (!equipped && selectedBagSlot !== null && selectedBagSlot !== undefined && !!(player.bagLocks && player.bagLocks[selectedBagSlot]));
    if (btnDrop) {
      btnDrop.classList.toggle('hidden', !!equipped || def.type === 'currency');
      btnDrop.disabled = isLocked;
      btnDrop.title = isLocked ? 'Vật phẩm đang khóa — mở khóa trước khi bỏ' : '';
    }
    var btnLock = document.getElementById('btn-card-lock');
    if (btnLock) {
      btnLock.classList.toggle('hidden', !!equipped || selectedBagSlot === null || selectedBagSlot === undefined);
      btnLock.textContent = isLocked ? 'Mở khóa' : 'Khóa';
    }
    var btnStar = document.getElementById('btn-card-star');
    if (btnStar) {
      btnStar.classList.toggle('hidden', !!equipped || selectedBagSlot === null || selectedBagSlot === undefined);
      btnStar.textContent = (_curSlot && _curSlot.starred) ? 'Bỏ ghim' : 'Ghim sao';
    }
    var btnQuick = document.getElementById('btn-card-quick');
    if (btnQuick) {
      btnQuick.classList.toggle('hidden', !!equipped || selectedBagSlot === null || selectedBagSlot === undefined);
    }
    disarmDrop();
  }

  function afterBagAction() {
    if (stateAPI && player) stateAPI.savePlayer(player);
    renderBagGrid();
    renderQuickSlots();
    refreshHUD();
  }

  function wireBagDetailControls() {
    var btnUse = document.getElementById('btn-card-use');
    if (btnUse && !btnUse.dataset.wired) {
      btnUse.dataset.wired = '1';
      btnUse.addEventListener('click', function () {
        if (selectedBagSlot === null) return;
        var _useSlots = currentBagSlots();
        if (!_useSlots || !_useSlots[selectedBagSlot]) return;
        var itemId = _useSlots[selectedBagSlot].itemId;
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.useItem) {
          var res = window.GameEngine.useItem(itemId);
          if (res && !res.ok && res.msg) showToast(res.msg);
        }
        afterBagAction();
      });
    }
    var btnEquip = document.getElementById('btn-card-equip');
    if (btnEquip && !btnEquip.dataset.wired) {
      btnEquip.dataset.wired = '1';
      btnEquip.addEventListener('click', function () {
        if (selectedBagSlot === null) return;
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.equipItem) {
          var res = window.GameEngine.equipItem(selectedBagContainerId, selectedBagSlot);
          if (res && !res.ok && res.msg) showToast(res.msg);
          if (res && res.ok && res.slot) selectedEquipSlot = res.slot;
        }
        afterBagAction();
      });
    }
    var btnUnequip = document.getElementById('btn-card-unequip');
    if (btnUnequip && !btnUnequip.dataset.wired) {
      btnUnequip.dataset.wired = '1';
      btnUnequip.addEventListener('click', function () {
        if (!selectedEquipSlot) return;
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.unequipItem) {
          var res = window.GameEngine.unequipItem(selectedEquipSlot);
          if (res && !res.ok && res.msg) showToast(res.msg);
        }
        selectedEquipSlot = null;
        afterBagAction();
      });
    }
    var btnStar = document.getElementById('btn-card-star');
    if (btnStar && !btnStar.dataset.wired) {
      btnStar.dataset.wired = '1';
      btnStar.addEventListener('click', function () {
        if (selectedBagSlot === null) return;
        var _stSlots = currentBagSlots();
        if (!_stSlots || !_stSlots[selectedBagSlot]) return;
        var cId = selectedBagContainerId;
        var nowStarred = !!_stSlots[selectedBagSlot].starred;
        if (tuiKhoAPI && tuiKhoAPI.setStarred) tuiKhoAPI.setStarred(player, cId, selectedBagSlot, !nowStarred);
        showToast(!nowStarred ? 'Đã ghim sao' : 'Đã bỏ ghim');
        afterBagAction();
      });
    }
    var btnQuick = document.getElementById('btn-card-quick');
    if (btnQuick && !btnQuick.dataset.wired) {
      btnQuick.dataset.wired = '1';
      btnQuick.addEventListener('click', function () {
        if (selectedBagSlot === null) return;
        if (!tuiKhoAPI) return;
        var qs = tuiKhoAPI.getQuickSlots(player);
        var idx = -1;
        for (var qi = 0; qi < qs.length; qi++) { if (!qs[qi]) { idx = qi; break; } }
        if (idx === -1) { showToast('4 ô dùng nhanh đã đầy'); return; }
        var r = tuiKhoAPI.setQuickSlot(player, idx, selectedBagContainerId, selectedBagSlot);
        if (r && r.ok) showToast('Đã gắn vào ô dùng nhanh ' + (idx + 1));
        else showToast('Không gắn được ô dùng nhanh');
        renderQuickSlots();
        afterBagAction();
      });
    }
    var btnLock = document.getElementById('btn-card-lock');
    if (btnLock && !btnLock.dataset.wired) {
      btnLock.dataset.wired = '1';
      btnLock.addEventListener('click', function () {
        if (selectedBagSlot === null) return;
        var _lkSlots = currentBagSlots();
        if (!_lkSlots || !_lkSlots[selectedBagSlot]) return;
        var cId = selectedBagContainerId;
        var nowLocked = !!_lkSlots[selectedBagSlot].locked;
        if (tuiKhoAPI && tuiKhoAPI.setLocked) tuiKhoAPI.setLocked(player, cId, selectedBagSlot, !nowLocked);
        player.bagLocks = player.bagLocks || {};
        if (nowLocked) delete player.bagLocks[selectedBagSlot]; else player.bagLocks[selectedBagSlot] = true;
        showToast(!nowLocked ? 'Đã khóa vật phẩm — không thể bỏ nhầm' : 'Đã mở khóa vật phẩm');
        afterBagAction();
      });
    }
    var btnDrop = document.getElementById('btn-card-drop');
    if (btnDrop && !btnDrop.dataset.wired) {
      btnDrop.dataset.wired = '1';
      btnDrop.addEventListener('click', function () {
        if (selectedBagSlot === null) return;
        var _lockSlots = currentBagSlots();
        if (!_lockSlots || !_lockSlots[selectedBagSlot]) return;
        if ((_lockSlots[selectedBagSlot].locked) || (player.bagLocks && player.bagLocks[selectedBagSlot])) {
          showToast('Vật phẩm đang khóa — mở khóa trước khi bỏ');
          return;
        }
        if (!btnDrop.classList.contains('armed')) {
          btnDrop.classList.add('armed');
          btnDrop.textContent = 'Chắc chắn bỏ?';
          if (dropArmTimer) clearTimeout(dropArmTimer);
          dropArmTimer = setTimeout(function () {
            btnDrop.classList.remove('armed');
            btnDrop.textContent = 'Bỏ';
          }, 3000);
          return;
        }
        var _dropSlots = currentBagSlots();
        if (!_dropSlots || !_dropSlots[selectedBagSlot]) return;
        var slotData = _dropSlots[selectedBagSlot];
        var def = itemDefs()[slotData.itemId];
        if (stateAPI && stateAPI.removeItemFromBag) {
          stateAPI.removeItemFromBag(player, slotData.itemId, 1);
        }
        showToast('Đã bỏ 1 ' + (def ? def.name : slotData.itemId));
        if (!_dropSlots || !_dropSlots[selectedBagSlot]) selectedBagSlot = null;
        afterBagAction();
      });
    }
  }

  // ---------- ĐỢT 6: MODAL ĐỔI TU LUYỆN ĐAN Ở CHẤP SỰ (mục 1) ----------
  function openPillExchangeModal() {
    var modal = document.getElementById('pill-exchange-modal');
    if (!modal) return;
    var ltEl = document.getElementById('pill-exchange-linhthach');
    if (ltEl && player) ltEl.textContent = 'Linh Thạch hiện có: ' + (player.linhThach || 0);
    modal.classList.remove('hidden');
  }

  function closePillExchangeModal() {
    var modal = document.getElementById('pill-exchange-modal');
    if (modal) modal.classList.add('hidden');
  }

  function wirePillExchange() {
    var closeX = document.getElementById('close-pill-exchange-modal');
    if (closeX && !closeX.dataset.wired) { closeX.dataset.wired = '1'; closeX.addEventListener('click', closePillExchangeModal); }
    var closeBtn = document.getElementById('btn-close-pill-modal');
    if (closeBtn && !closeBtn.dataset.wired) { closeBtn.dataset.wired = '1'; closeBtn.addEventListener('click', closePillExchangeModal); }
    var ids = ['btn-pill-kim', 'btn-pill-moc', 'btn-pill-thuy', 'btn-pill-hoa', 'btn-pill-tho'];
    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var btn = document.getElementById(id);
        if (!btn || btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', function () {
          var elem = btn.getAttribute('data-element');
          if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.exchangePill) {
            var res = window.GameEngine.exchangePill(elem);
            if (res && res.msg) showToast(res.msg);
          }
          var ltEl = document.getElementById('pill-exchange-linhthach');
          if (ltEl && player) ltEl.textContent = 'Linh Thạch hiện có: ' + (player.linhThach || 0);
          refreshHUD();
        });
      })(ids[i]);
    }
  }

  // ---------- ĐỢT LINHME: VƯỜN LINH MỄ TÔNG MÔN (32 Ô ĐẤT) ----------
  function openTongMonFarmModal() {
    var modal = document.getElementById('tong-mon-farm-modal');
    if (!modal) return;
    renderTongMonFarmModal();
    modal.classList.remove('hidden');
    if (audioAPI && audioAPI.playClick) audioAPI.playClick();
  }

  function closeTongMonFarmModal() {
    var modal = document.getElementById('tong-mon-farm-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderTongMonFarmModal() {
    var gridEl = document.getElementById('tong-mon-farm-grid');
    if (!gridEl) return;
    var farmApi = (typeof window !== 'undefined') ? window.GameTongMonFarm : null;
    if (!farmApi || !player) return;

    farmApi.ensureState(player);
    var pConfigs = farmApi.getPlotsConfig();
    var now = Date.now();
    if (farmApi.checkFarmPestSpread) farmApi.checkFarmPestSpread(player, now);
    var html = '';

    // Hàng Pháp Quyết Canh Tác (4 Kỹ Năng)
    html += '<div class="farm-spells-panel" style="margin-bottom:12px; padding:10px; background:rgba(20,28,24,0.8); border:1px solid #7c6838; border-radius:8px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
    html += '  <span style="font-size:12px; font-weight:bold; color:#ffd700;">PHÁP QUYẾT CANH TÁC (4 KỸ NĂNG)</span>';
    html += '  <span style="font-size:11px; color:#a0c0a0;">Dùng linh lực nhuận trạch toàn bộ ruộng</span>';
    html += '</div>';
    html += '<div class="farm-spells-row" style="display:flex; gap:8px; flex-wrap:wrap;">';
    var spells = farmApi.listFarmSpells ? farmApi.listFarmSpells() : [];
    for (var s = 0; s < spells.length; s++) {
      var sp = spells[s];
      var learned = farmApi.isSpellLearned(player, sp.id);
      var spState = (player.linhDien && player.linhDien.spells) ? player.linhDien.spells[sp.id] : null;
      var cdRemain = (spState && spState.cooldownUntil && spState.cooldownUntil > now)
        ? Math.ceil((spState.cooldownUntil - now) / 1000)
        : 0;
      var btnDisable = !learned || cdRemain > 0 || (player.linhLuc || 0) < (farmApi.getFarmSpellCost ? farmApi.getFarmSpellCost(player, sp.id) : sp.costMP);
      var btnText = sp.name + ' (' + (farmApi.getFarmSpellCost ? farmApi.getFarmSpellCost(player, sp.id) : sp.costMP) + ' MP)';
      if (!learned) btnText += ' [Chưa học]';
      else if (cdRemain > 0) btnText += ' [' + cdRemain + 's]';

      var btnBg = learned ? (btnDisable ? 'background:#202820; opacity:0.6;' : 'background:#243d2c; border-color:#659c6b;') : 'background:#1a1a1a; opacity:0.45;';

      html += '<button class="btn wood farm-spell-btn" data-spell="' + sp.id + '"' + (btnDisable ? ' disabled' : '') + ' style="font-size:11px; padding:6px 10px; ' + btnBg + '" title="' + sp.desc + '">';
      html += sp.icon + ' ' + btnText;
      html += '</button>';
    }
    html += '</div></div>';

    var beds = [
      { id: 'zone_thuong_dien', name: 'Thượng Điền (8 ô đất — Tây Bắc)' },
      { id: 'zone_trung_dien', name: 'Trung Điền (6 ô đất — Trung Tâm)' },
      { id: 'zone_dong_dien', name: 'Đông Điền (8 ô đất — Đông Bắc)' },
      { id: 'zone_ha_dien_1', name: 'Hạ Điền 1 (6 ô đất — Tây Nam)' },
      { id: 'zone_ha_dien_2', name: 'Hạ Điền 2 (4 ô đất — Đông Nam)' }
    ];

    for (var b = 0; b < beds.length; b++) {
      var bed = beds[b];
      html += '<div class="farm-bed-section" style="margin-bottom:10px;">';
      html += '<div class="farm-bed-title">' + bed.name + '</div>';
      html += '<div class="farm-plots-row">';

      for (var i = 0; i < pConfigs.length; i++) {
        var cfg = pConfigs[i];
        if (cfg.zoneId !== bed.id) continue;
        var view = farmApi.getPlotView(player, cfg.id, now);
        var isReady = view.state === 'ready';
        var cardClass = 'farm-plot-card' + (isReady ? ' ready' : '');
        var statusClass = 'farm-plot-status' + (isReady ? ' ready' : '');
        var statusText = '';
        var progressHtml = '';
        var btnHtml = '';

        if (view.state === 'empty') {
          statusText = 'Đất trống';
          btnHtml = '<button class="btn wood farm-plot-btn btn-plot-plant" data-plot="' + cfg.id + '">Gieo Linh Mễ</button>';
        } else if (view.state === 'growing') {
          var pct = Math.min(100, Math.max(0, Math.round(view.progress * 100)));
          var waterTag = view.watered ? ' (Đã tưới)' : '';
          var yieldTag = (view.yieldBonus && view.yieldBonus > 0) ? ' [+' + view.yieldBonus + ' hạt]' : '';
          var pestTag = '';
          if (view.weed) pestTag += ' [Cỏ dại]';
          if (view.pest) pestTag += ' [Sâu linh]';
          if (view.disease) pestTag += ' [Uế bệnh]';
          var skillTag = view.needSkill ? ' [CẦN SKILL]' : (view.needSkillHint ? ' [' + view.needSkillHint + ']' : '');
          statusText = view.name + ' (' + view.remainSec + 's' + waterTag + yieldTag + ')' + pestTag + skillTag;
          progressHtml = '<div class="farm-plot-progress-bar"><div class="farm-plot-progress-fill" style="width:' + pct + '%;"></div></div>';
          if (!view.watered) {
            btnHtml = '<button class="btn wood farm-plot-btn btn-plot-water" data-plot="' + cfg.id + '" style="background:#1b3d54; color:#7fd2ff;">Tưới Nước</button>';
          } else {
            btnHtml = '<button class="btn wood farm-plot-btn" disabled style="opacity:0.6; cursor:default;">Đang Lớn...</button>';
          }
        } else if (view.state === 'ready') {
          var rYieldTag = (view.yieldBonus && view.yieldBonus > 0) ? ' [+' + view.yieldBonus + ']' : '';
          var rPestTag = '';
          if (view.weed) rPestTag += ' [Cỏ dại]';
          if (view.pest) rPestTag += ' [Sâu linh]';
          if (view.disease) rPestTag += ' [Uế bệnh]';
          statusText = view.name + ' (Chín)' + rYieldTag + rPestTag;
          progressHtml = '<div class="farm-plot-progress-bar"><div class="farm-plot-progress-fill" style="width:100%; background:#ffd700;"></div></div>';
          btnHtml = '<button class="btn wood farm-plot-btn btn-plot-harvest" data-plot="' + cfg.id + '" style="background:#473417; color:#ffd700; font-weight:bold;">Thu Hoạch</button>';
        }

        html += '<div class="' + cardClass + '">';
        html += '<div class="farm-plot-idx">Ô #' + (cfg.id + 1) + '</div>';
        html += '<div class="' + statusClass + '">' + statusText + '</div>';
        html += progressHtml;
        html += btnHtml;
        html += '</div>';
      }

      html += '</div></div>';
    }

    gridEl.innerHTML = html;

    var spellBtns = gridEl.querySelectorAll('.farm-spell-btn');
    spellBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.getAttribute('data-spell');
        var res = farmApi.castFarmSpell(player, sid, Date.now());
        if (showToast) showToast(res.msg);
        if (res.ok && audioAPI && audioAPI.playChime) audioAPI.playChime();
        renderTongMonFarmModal();
        refreshHUD();
        if (updateFarmSkillBar) updateFarmSkillBar(typeof currentMapId !== 'undefined' ? currentMapId === 'ruong-linh-me' : false);
      });
    });

    var plantBtns = gridEl.querySelectorAll('.btn-plot-plant');
    plantBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = parseInt(btn.getAttribute('data-plot'), 10);
        var res = farmApi.plant(player, pid, 'linh-me', Date.now());
        if (showToast) showToast(res.msg);
        renderTongMonFarmModal();
        refreshHUD();
      });
    });

    var waterBtns = gridEl.querySelectorAll('.btn-plot-water');
    waterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = parseInt(btn.getAttribute('data-plot'), 10);
        var res = farmApi.water(player, pid, Date.now());
        if (showToast) showToast(res.msg);
        renderTongMonFarmModal();
      });
    });

    var harvestBtns = gridEl.querySelectorAll('.btn-plot-harvest');
    harvestBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = parseInt(btn.getAttribute('data-plot'), 10);
        var res = farmApi.harvest(player, pid, Date.now());
        if (showToast) showToast(res.msg);
        renderTongMonFarmModal();
        refreshHUD();
      });
    });
  }

  function wireTongMonFarm() {
    var btnHud = document.getElementById('btn-linhme');
    if (btnHud && !btnHud.dataset.wired) {
      btnHud.dataset.wired = '1';
      btnHud.addEventListener('click', openTongMonFarmModal);
    }
    var closeX = document.getElementById('close-tong-mon-farm-modal');
    if (closeX && !closeX.dataset.wired) {
      closeX.dataset.wired = '1';
      closeX.addEventListener('click', closeTongMonFarmModal);
    }
    var modal = document.getElementById('tong-mon-farm-modal');
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeTongMonFarmModal();
      });
    }
    var btnPlantAll = document.getElementById('btn-farm-plant-all');
    if (btnPlantAll && !btnPlantAll.dataset.wired) {
      btnPlantAll.dataset.wired = '1';
      btnPlantAll.addEventListener('click', function () {
        var farmApi = (typeof window !== 'undefined') ? window.GameTongMonFarm : null;
        if (!farmApi || !player) return;
        var res = farmApi.plantAll(player, 'linh-me', Date.now());
        if (showToast) showToast(res.msg);
        renderTongMonFarmModal();
        refreshHUD();
      });
    }
    var btnHarvestAll = document.getElementById('btn-farm-harvest-all');
    if (btnHarvestAll && !btnHarvestAll.dataset.wired) {
      btnHarvestAll.dataset.wired = '1';
      btnHarvestAll.addEventListener('click', function () {
        var farmApi = (typeof window !== 'undefined') ? window.GameTongMonFarm : null;
        if (!farmApi || !player) return;
        var res = farmApi.harvestAll(player, Date.now());
        if (showToast) showToast(res.msg);
        renderTongMonFarmModal();
        refreshHUD();
      });
    }

    var btnGotoRuong = document.getElementById('btn-goto-ruong');
    if (btnGotoRuong && !btnGotoRuong.dataset.wired) {
      btnGotoRuong.dataset.wired = '1';
      btnGotoRuong.addEventListener('click', function () {
        closeTongMonFarmModal();
        if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.switchMap) {
          window.GameEngine.switchMap('ruong-linh-me', { x: 120, y: 420 });
          if (showToast) showToast('Đang bước vào Ruộng Linh Mễ...');
        }
      });
    }

    // Modal thỉnh giáo pháp quyết canh tác
    var closeSpellX = document.getElementById('close-farm-spell-modal');
    if (closeSpellX && !closeSpellX.dataset.wired) {
      closeSpellX.dataset.wired = '1';
      closeSpellX.addEventListener('click', closeFarmSpellLearnModal);
    }
    var btnCloseSpell = document.getElementById('btn-close-farm-spell-modal');
    if (btnCloseSpell && !btnCloseSpell.dataset.wired) {
      btnCloseSpell.dataset.wired = '1';
      btnCloseSpell.addEventListener('click', closeFarmSpellLearnModal);
    }
    var spellModal = document.getElementById('farm-spell-learn-modal');
    if (spellModal && !spellModal.dataset.wired) {
      spellModal.dataset.wired = '1';
      spellModal.addEventListener('click', function (e) {
        if (e.target === spellModal) closeFarmSpellLearnModal();
      });
    }
  }

  // ---------- ĐỢT LINHME-MAP: THANH KỸ NĂNG RUỘNG & THỈNH GIÁO PHÁP QUYẾT ----------
  var lastFarmBarRefresh = 0;

  function updateFarmSkillBar(visible) {
    var bar = document.getElementById('farm-skill-bar');
    if (!bar) return;
    if (!visible) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');

    var slotsEl = document.getElementById('farm-skill-bar-slots');
    if (!slotsEl) return;
    var farmApi = (typeof window !== 'undefined') ? window.GameTongMonFarm : null;
    if (!farmApi || !player) return;

    var spells = farmApi.listFarmSpells ? farmApi.listFarmSpells() : [];
    var now = Date.now();
    slotsEl.innerHTML = '';

    for (var i = 0; i < spells.length; i++) {
      var sp = spells[i];
      var learned = farmApi.isSpellLearned(player, sp.id);
      var spState = (player.linhDien && player.linhDien.spells) ? player.linhDien.spells[sp.id] : null;
      var cdRemain = (spState && spState.cooldownUntil && spState.cooldownUntil > now)
        ? Math.ceil((spState.cooldownUntil - now) / 1000)
        : 0;
      var curCost = farmApi.getFarmSpellCost ? farmApi.getFarmSpellCost(player, sp.id) : sp.costMP;
      var disabled = !learned || cdRemain > 0 || (player.linhLuc || 0) < curCost;

      var btn = document.createElement('button');
      btn.className = 'farm-skill-btn' + (disabled ? ' disabled' : '');
      btn.type = 'button';
      btn.setAttribute('data-spell', sp.id);
      if (disabled) btn.disabled = true;
      btn.title = sp.name + ': ' + sp.desc;

      var iconEl = document.createElement('div');
      iconEl.className = 'farm-skill-icon';
      iconEl.textContent = sp.icon;
      btn.appendChild(iconEl);

      var costEl = document.createElement('div');
      costEl.className = 'farm-skill-cost';
      costEl.textContent = learned ? (curCost + 'MP') : 'Khóa';
      btn.appendChild(costEl);

      if (cdRemain > 0) {
        var cdEl = document.createElement('div');
        cdEl.className = 'farm-skill-cd-overlay';
        cdEl.textContent = String(cdRemain);
        btn.appendChild(cdEl);
      }

      (function (spellId) {
        btn.addEventListener('click', function () {
          var res = farmApi.castFarmSpell(player, spellId, Date.now());
          if (showToast) showToast(res.msg);
          if (res.ok) {
            if (audioAPI && audioAPI.playChime) audioAPI.playChime();
            if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.spawnFloatingText) {
              window.GameEngine.spawnFloatingText(res.name + '!', player.x, player.y - 40, '#7ce898');
            }
          }
          updateFarmSkillBar(true);
          refreshHUD();
        });
      })(sp.id);

      slotsEl.appendChild(btn);
    }
  }

  function openFarmSpellLearnModal() {
    var modal = document.getElementById('farm-spell-learn-modal');
    if (!modal) return;
    renderFarmSpellLearnModal();
    modal.classList.remove('hidden');
    if (audioAPI && audioAPI.playClick) audioAPI.playClick();
  }

  function closeFarmSpellLearnModal() {
    var modal = document.getElementById('farm-spell-learn-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderFarmSpellLearnModal() {
    var listEl = document.getElementById('farm-spell-learn-list');
    if (!listEl) return;
    var farmApi = (typeof window !== 'undefined') ? window.GameTongMonFarm : null;
    if (!farmApi || !player) return;

    var spells = farmApi.listFarmSpells ? farmApi.listFarmSpells() : [];
    var html = '';

    for (var i = 0; i < spells.length; i++) {
      var sp = spells[i];
      var learned = farmApi.isSpellLearned(player, sp.id);
      var curCostLearn = farmApi.getFarmSpellCost ? farmApi.getFarmSpellCost(player, sp.id) : sp.costMP;

      html += '<div class="farm-spell-learn-item">';
      html += '  <div style="flex:1;">';
      html += '    <div style="font-size:14px; font-weight:700; color:#ffd700;">' + sp.icon + ' ' + sp.name + ' <span style="font-size:11px; color:#7fd2ff;">(' + curCostLearn + ' MP, hồi ' + sp.cooldownSec + 's)</span></div>';
      html += '    <div style="font-size:12px; color:#cbd5e1; margin-top:3px;">' + sp.desc + '</div>';
      html += '  </div>';
      html += '  <div>';
      if (learned) {
        html += '    <span style="color:#58b858; font-weight:bold; font-size:13px;">Đã Lĩnh Ngộ</span>';
      } else {
        html += '    <span style="color:#ffe9a8; font-size:12px;">Bái kiến Trưởng Lão Dược Điền tại Ruộng Linh Mễ để học</span>';
      }
      html += '  </div>';
      html += '</div>';
    }

    listEl.innerHTML = html;
  }

  // ---------- ĐỢT LINHME: ĐỔI LINH THỰC (THỨC ĂN HỒI PHỤC THEO GIỜ) ----------
  function openFoodExchangeModal() {
    var modal = document.getElementById('food-exchange-modal');
    if (!modal) return;
    renderFoodExchangeModal();
    modal.classList.remove('hidden');
    if (audioAPI && audioAPI.playClick) audioAPI.playClick();
  }

  function closeFoodExchangeModal() {
    var modal = document.getElementById('food-exchange-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderFoodExchangeModal() {
    var listEl = document.getElementById('food-exchange-list');
    if (!listEl) return;
    var foodApi = (typeof window !== 'undefined') ? window.GameFoodBuff : null;
    if (!foodApi || !player) return;

    var recipes = foodApi.getRecipes();
    var html = '';

    for (var i = 0; i < recipes.length; i++) {
      var r = recipes[i];
      var def = foodApi.getFoodDef(r.foodId);
      var canCraft = foodApi.canCraftFood(player, r.foodId);

      var costParts = [];
      for (var c = 0; c < r.cost.length; c++) {
        var req = r.cost[c];
        var curCount = (stateAPI && stateAPI.countItemInBag) ? stateAPI.countItemInBag(player, req.itemId) : 0;
        var isEnough = curCount >= req.count;
        var color = isEnough ? '#98ff98' : '#ff7a7a';
        costParts.push('<span style="color:' + color + ';">' + (req.name || req.itemId) + ' (' + curCount + '/' + req.count + ')</span>');
      }

      var durationHours = def ? (def.durationSec / 3600) : 1;
      var rateText = def ? ('+' + def.hpPerTick + ' Khí Huyết & +' + def.mpPerTick + ' Linh Lực mỗi ' + def.tickIntervalSec + 's (kéo dài ' + durationHours + ' giờ)') : '';

      html += '<div class="food-exchange-item">';
      html += '  <div style="flex:1;">';
      html += '    <div class="food-info-head">' + r.name + '</div>';
      html += '    <div class="food-info-desc" style="color:#8be38b;">' + rateText + '</div>';
      html += '    <div class="food-info-desc">' + r.desc + '</div>';
      html += '    <div class="food-info-cost">Nguyên liệu: ' + costParts.join(', ') + '</div>';
      html += '  </div>';
      html += '  <div>';
      var disabledAttr = canCraft.ok ? '' : ' disabled style="opacity:0.5; cursor:not-allowed;"';
      html += '    <button class="btn wood btn-craft-food" data-food="' + r.foodId + '"' + disabledAttr + '>Nấu / Đổi</button>';
      html += '  </div>';
      html += '</div>';
    }

    listEl.innerHTML = html;

    var craftBtns = listEl.querySelectorAll('.btn-craft-food');
    craftBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var fid = btn.getAttribute('data-food');
        var res = foodApi.craftFood(player, fid);
        if (showToast) showToast(res.msg);
        renderFoodExchangeModal();
        refreshHUD();
      });
    });
  }

  function wireFoodExchange() {
    var closeX = document.getElementById('close-food-exchange-modal');
    if (closeX && !closeX.dataset.wired) {
      closeX.dataset.wired = '1';
      closeX.addEventListener('click', closeFoodExchangeModal);
    }
    var closeBtn = document.getElementById('btn-close-food-modal');
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = '1';
      closeBtn.addEventListener('click', closeFoodExchangeModal);
    }
    var modal = document.getElementById('food-exchange-modal');
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeFoodExchangeModal();
      });
    }
    var hudFoodBadge = document.getElementById('hud-food-buff');
    if (hudFoodBadge && !hudFoodBadge.dataset.wired) {
      hudFoodBadge.dataset.wired = '1';
      hudFoodBadge.addEventListener('click', openFoodExchangeModal);
    }
  }

  // ---------- ĐỢT LINHME: VIỆC VỤ TÔNG MÔN (CANH TÁC LINH MỄ) ----------
  function openSectQuestModal() {
    var modal = document.getElementById('sect-quest-modal');
    if (!modal) return;
    renderSectQuestModal();
    modal.classList.remove('hidden');
    if (audioAPI && audioAPI.playClick) audioAPI.playClick();
  }

  function closeSectQuestModal() {
    var modal = document.getElementById('sect-quest-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderSectQuestModal() {
    var listEl = document.getElementById('sect-quest-list');
    if (!listEl) return;
    var farmApi = (typeof window !== 'undefined') ? window.GameTongMonFarm : null;
    if (!farmApi || !player) return;

    farmApi.ensureState(player);
    var quests = farmApi.getSectQuests();
    var html = '';

    for (var i = 0; i < quests.length; i++) {
      var q = quests[i];
      var isActive = (player.sectQuests && player.sectQuests.activeQuestId === q.id);
      var checkCanComplete = farmApi.canCompleteSectQuest(player, q.id);
      var completedTimes = (player.sectQuests && player.sectQuests.completedCount && player.sectQuests.completedCount[q.id]) || 0;

      var reqParts = [];
      for (var r = 0; r < q.requirements.length; r++) {
        var req = q.requirements[r];
        var curCount = (stateAPI && stateAPI.countItemInBag) ? stateAPI.countItemInBag(player, req.itemId) : 0;
        var isEnough = curCount >= req.count;
        var color = isEnough ? '#98ff98' : '#ff7a7a';
        reqParts.push('<span style="color:' + color + ';">' + req.name + ' (' + curCount + '/' + req.count + ')</span>');
      }

      var rewardDesc = '+' + q.rewardLT + ' Linh Thạch';
      if (q.rewardItems && q.rewardItems.length > 0) {
        for (var rw = 0; rw < q.rewardItems.length; rw++) {
          rewardDesc += ', +' + q.rewardItems[rw].count + ' ' + (q.rewardItems[rw].name || q.rewardItems[rw].itemId);
        }
      }
      if (q.congHien > 0) {
        rewardDesc += ', +' + q.congHien + ' Cống Hiến Tông';
      }

      var actionBtn = '';
      if (!isActive) {
        actionBtn = '<button class="btn wood btn-accept-sect-quest" data-quest="' + q.id + '">Nhận Việc</button>';
      } else {
        if (checkCanComplete.ok) {
          actionBtn = '<button class="btn wood btn-complete-sect-quest" data-quest="' + q.id + '" style="background:#23591d; border-color:#58b858; color:#98ff98; font-weight:bold;">Nộp Hoàn Thành</button>';
        } else {
          actionBtn = '<button class="btn wood" disabled style="opacity:0.5; cursor:not-allowed;">Đang Làm (Chưa Đủ)</button>';
        }
      }

      html += '<div class="sect-quest-item">';
      html += '  <div style="flex:1;">';
      html += '    <div class="food-info-head" style="color:#a8d1ff;">' + q.name + (completedTimes > 0 ? (' <span style="font-size:11px; color:#88a;">(Đã hoàn thành: ' + completedTimes + ' lần)</span>') : '') + '</div>';
      html += '    <div class="food-info-desc">' + q.desc + '</div>';
      html += '    <div class="food-info-cost">Yêu cầu nộp: ' + reqParts.join(', ') + '</div>';
      html += '    <div class="food-info-cost" style="color:#ffd700;">Phần thưởng: ' + rewardDesc + '</div>';
      html += '  </div>';
      html += '  <div>' + actionBtn + '</div>';
      html += '</div>';
    }

    listEl.innerHTML = html;

    var acceptBtns = listEl.querySelectorAll('.btn-accept-sect-quest');
    acceptBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qid = btn.getAttribute('data-quest');
        var res = farmApi.acceptSectQuest(player, qid);
        if (showToast) showToast(res.msg);
        renderSectQuestModal();
        refreshHUD();
      });
    });

    var completeBtns = listEl.querySelectorAll('.btn-complete-sect-quest');
    completeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qid = btn.getAttribute('data-quest');
        var res = farmApi.completeSectQuest(player, qid);
        if (showToast) showToast(res.msg);
        renderSectQuestModal();
        refreshHUD();
      });
    });
  }

  function wireSectQuests() {
    var closeX = document.getElementById('close-sect-quest-modal');
    if (closeX && !closeX.dataset.wired) {
      closeX.dataset.wired = '1';
      closeX.addEventListener('click', closeSectQuestModal);
    }
    var closeBtn = document.getElementById('btn-close-sect-quest-modal');
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = '1';
      closeBtn.addEventListener('click', closeSectQuestModal);
    }
    var modal = document.getElementById('sect-quest-modal');
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeSectQuestModal();
      });
    }
  }

  function updateItemInfo(slotData, defs) {
    var nameEl = document.getElementById('bag-info-name');
    var descEl = document.getElementById('bag-info-desc');
    if (!slotData || !slotData.itemId) {
      if (nameEl) nameEl.textContent = 'Ô trống';
      if (descEl) descEl.textContent = '';
      return;
    }
    var def = defs[slotData.itemId];
    if (nameEl) nameEl.textContent = def ? def.name : slotData.itemId;
    if (descEl) descEl.textContent = (def ? def.desc : '') + ' (Số lượng: ' + (slotData.count || 1) + ')';
  }

  /**
   * Hiển thị bảng gục ngã (Death Modal)
   */
  function showDeathModal(revivalPool) {
    var modal = document.getElementById('death-modal');
    var titleEl = modal ? modal.querySelector('.death-title') : null;
    if (titleEl && typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getCurrentMap) {
      var cur = window.GameEngine.getCurrentMap();
      if (cur && cur.name) titleEl.textContent = 'BẠN ĐÃ GỤC TẠI ' + cur.name.toUpperCase();
    }
    var poolEl = document.getElementById('death-pool-count');
    var btnSpot = document.getElementById('btn-revive-spot');
    var pool = revivalPool !== undefined ? revivalPool : (player ? player.revivalPool : 5);

    if (poolEl) poolEl.textContent = pool + ' / 5';
    if (btnSpot) {
      if (pool <= 0) {
        btnSpot.disabled = true;
        btnSpot.style.opacity = '0.5';
        btnSpot.title = 'Đã hết lượt hồi sinh tại chỗ';
      } else {
        btnSpot.disabled = false;
        btnSpot.style.opacity = '1.0';
      }
    }
    if (modal) modal.classList.remove('hidden');
  }

  function hideDeathModal() {
    var modal = document.getElementById('death-modal');
    if (modal) modal.classList.add('hidden');
  }

  /**
   * Hiển thị bảng tổng kết farm
   */
  function showSessionSummary(summaryData) {
    var modal = document.getElementById('session-summary-modal');
    if (!modal || !summaryData) return;

    var timeEl = document.getElementById('summary-time');
    var killsEl = document.getElementById('summary-kills');
    var tuviEl = document.getElementById('summary-tuvi');
    var ltEl = document.getElementById('summary-linhthach');
    var lootListEl = document.getElementById('summary-loot-list');

    var durationSec = Math.round((Date.now() - (summaryData.startTime || Date.now())) / 1000);
    var mins = Math.floor(durationSec / 60);
    var secs = durationSec % 60;
    if (timeEl) timeEl.textContent = mins + ' phút ' + secs + ' giây';
    if (killsEl) killsEl.textContent = summaryData.kills || 0;
    if (tuviEl) tuviEl.textContent = '+' + (summaryData.tuViMoc || 0);
    if (ltEl) ltEl.textContent = '+' + (summaryData.linhThach || 0);

    if (lootListEl) {
      lootListEl.innerHTML = '';
      var lootArr = summaryData.notableLoot || [];
      if (lootArr.length === 0) {
        lootListEl.innerHTML = '<span style="font-size:12px;color:#889988;">Không có</span>';
      } else {
        for (var i = 0; i < lootArr.length; i++) {
          var chip = document.createElement('span');
          chip.className = 'loot-chip';
          chip.textContent = lootArr[i];
          lootListEl.appendChild(chip);
        }
      }
    }

    modal.classList.remove('hidden');
  }

  /**
   * Vẽ Vòng Tương Sinh SVG (~84px)
   */
  function renderRingWidget() {
    var container = document.getElementById('tuong-sinh-ring');
    if (!container || !player) return;

    var size = 84;
    var center = size / 2;
    var radius = 27;

    var nodes = [
      { id: 'kim', label: 'Kim', color: '#e8cb69', dark: '#50431a' },
      { id: 'thuy', label: 'Thủy', color: '#56a7e8', dark: '#183854' },
      { id: 'moc', label: 'Mộc', color: '#55d882', dark: '#184d2a' },
      { id: 'hoa', label: 'Hỏa', color: '#e86255', dark: '#521f1a' },
      { id: 'tho', label: 'Thổ', color: '#d89b55', dark: '#4a3217' }
    ];

    var minTuVi = stateAPI ? stateAPI.harmonyOf(player.paths) : 0;
    var weakElement = 'kim';
    var p = player.paths || {};
    var tuViMap = {
      kim: (p.kim && p.kim.tuVi) || 0,
      thuy: (p.thuy && p.thuy.tuVi) || 0,
      moc: (p.moc && p.moc.tuVi) || 0,
      hoa: (p.hoa && p.hoa.tuVi) || 0,
      tho: (p.tho && p.tho.tuVi) || 0
    };
    for (var k in tuViMap) {
      if (tuViMap[k] === minTuVi) {
        weakElement = k;
        break;
      }
    }

    var svg = ['<svg class="ring-svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">'];
    svg.push('<circle cx="' + center + '" cy="' + center + '" r="' + radius + '" fill="none" stroke="rgba(243,217,78,0.25)" stroke-width="1.2" stroke-dasharray="2,3"/>');

    var positions = [];
    for (var i = 0; i < 5; i++) {
      var angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
      var nx = center + radius * Math.cos(angle);
      var ny = center + radius * Math.sin(angle);
      positions.push({ x: nx, y: ny });
    }

    for (var j = 0; j < 5; j++) {
      var p1 = positions[j];
      var p2 = positions[(j + 1) % 5];
      svg.push('<line x1="' + p1.x + '" y1="' + p1.y + '" x2="' + p2.x + '" y2="' + p2.y + '" stroke="rgba(243,217,78,0.35)" stroke-width="1"/>');
    }

    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n];
      var pos = positions[n];
      var isWeak = (node.id === weakElement);
      var strokeColor = isWeak ? '#ff4a4a' : node.color;
      var strokeWidth = isWeak ? '2.4' : '1.2';
      var rNode = isWeak ? 8.5 : 7.5;

      svg.push('<circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + rNode + '" fill="' + node.dark + '" stroke="' + strokeColor + '" stroke-width="' + strokeWidth + '"/>');
      svg.push('<text x="' + pos.x + '" y="' + (pos.y + 3) + '" fill="' + node.color + '" font-size="7.5" font-weight="bold" text-anchor="middle" font-family="Noto Serif, serif">' + node.label + '</text>');
    }

    svg.push('</svg>');
    container.innerHTML = svg.join('');
  }

  /**
   * Cập nhật thông số HUD
   */
  var hatFaceProbe = null; // null | 'loading' | 'ok' | 'fail'
  function refreshPortraitHat() {
    var el = document.getElementById('hud-portrait');
    if (!el || !player) return;
    var s = stateAPI ? stateAPI.loadSettings() : null;
    var wearing = player.equipment && player.equipment.head === 'non-la' && !(s && s.hideHat);
    if (wearing) {
      if (hatFaceProbe === null) {
        hatFaceProbe = 'loading';
        var img = new Image();
        img.onload = function () { hatFaceProbe = 'ok'; refreshPortraitHat(); };
        img.onerror = function () { hatFaceProbe = 'fail'; };
        img.src = 'assets/chars/hanhan-face-hat.png';
      }
      if (hatFaceProbe === 'ok') {
        el.style.backgroundImage = "url('assets/chars/hanhan-face-hat.png')";
        return;
      }
    }
    el.style.backgroundImage = '';
  }

  function refreshHUD() {
    if (!player) return;
    refreshPortraitHat();
    refreshPetCombatButtons();

    var nameEl = document.getElementById('hud-player-name');
    var realmEl = document.getElementById('hud-player-realm');
    var hpBar = document.getElementById('hud-hp-bar');
    var hpVal = document.getElementById('hud-hp-val');
    var llBar = document.getElementById('hud-linhluc-bar');
    var llVal = document.getElementById('hud-linhluc-val');

    if (nameEl) nameEl.textContent = player.name;
    if (realmEl) realmEl.textContent = player.realm || 'Phàm Nhân';

    // Đợt T3: hàng PHẨM KIM ĐAN — chỉ hiện khi đã kết đan (phẩm là thưởng
    // vĩnh viễn của hồ sơ 05C: linh lực tối đa + tu vi nhận theo phẩm).
    var kdRowEl = document.getElementById('char-panel-kimdan-row');
    var kdPhamEl = document.getElementById('char-panel-kimdan-pham');
    var kdPham = (stateAPI && typeof stateAPI.getKimDanPham === 'function') ? stateAPI.getKimDanPham(player) : 0;
    if (kdRowEl && kdPhamEl) {
      if (kdPham >= 1 && typeof window !== 'undefined' && window.GameKimDan && window.GameKimDan.PHAM_NAMES) {
        kdRowEl.style.display = '';
        kdPhamEl.textContent = window.GameKimDan.PHAM_NAMES[kdPham] +
          ' (linh lực tối đa +' + ((kdPham - 1) * 5) + '%, tu vi nhận +' + ((kdPham - 1) * 2) + '%)';
      } else {
        kdRowEl.style.display = 'none';
      }
    }

    var hpPct = Math.max(0, Math.min(100, (player.hp / player.hpMax) * 100));
    var llPct = Math.max(0, Math.min(100, (player.linhLuc / player.linhLucMax) * 100));

    if (hpBar) hpBar.style.width = hpPct + '%';
    if (hpVal) hpVal.textContent = Math.round(player.hp) + ' / ' + player.hpMax;
    if (llBar) llBar.style.width = llPct + '%';
    if (llVal) llVal.textContent = Math.round(player.linhLuc) + ' / ' + player.linhLucMax;

    // Cập nhật trạng thái phím kỹ năng (linh lực)
    var s1 = document.getElementById('skill-slot-1');
    var s2 = document.getElementById('skill-slot-2');
    if (s1) {
      if (player.linhLuc < 4) s1.classList.add('low-mana');
      else s1.classList.remove('low-mana');
    }
    if (s2) {
      if (player.linhLuc < 6) s2.classList.add('low-mana');
      else s2.classList.remove('low-mana');
    }

    renderRingWidget();
    updateQuestPanel();

    // Đợt LINHME: Cập nhật huy hiệu Thức Ăn Hồi Phục (Food Buff)
    var foodBadge = document.getElementById('hud-food-buff');
    if (foodBadge) {
      var foodApi = (typeof window !== 'undefined') ? window.GameFoodBuff : null;
      var activeBuff = (foodApi && player) ? foodApi.getActiveBuff(player, Date.now()) : null;
      if (activeBuff) {
        foodBadge.classList.remove('hidden');
        var fName = document.getElementById('hud-food-name');
        var fTimer = document.getElementById('hud-food-timer');
        if (fName) fName.textContent = activeBuff.name;
        if (fTimer) fTimer.textContent = activeBuff.timeStr;
        foodBadge.title = activeBuff.name + ': +' + activeBuff.hpPerTick + ' HP, +' + activeBuff.mpPerTick + ' MP mỗi ' + activeBuff.tickIntervalSec + 's. Còn lại: ' + activeBuff.timeStr;
      } else {
        foodBadge.classList.add('hidden');
      }
    }
  }

  /**
   * Cập nhật Bảng Nhân Vật & Ngũ Hành (Popup)
   */
  function updateCharPanelContent() {
    if (!player || !stateAPI) return;

    var nameEl = document.getElementById('char-panel-name');
    var realmEl = document.getElementById('char-panel-realm');
    var harmonyEl = document.getElementById('char-panel-harmony');

    if (nameEl) nameEl.textContent = player.name;
    if (realmEl) realmEl.textContent = player.realm || 'Phàm Nhân';

    // Đợt T3: hàng PHẨM KIM ĐAN trong Bảng Nhân Vật (cùng khối ở refreshHUD).
    var kdRowEl2 = document.getElementById('char-panel-kimdan-row');
    var kdPhamEl2 = document.getElementById('char-panel-kimdan-pham');
    var kdPham2 = (stateAPI && typeof stateAPI.getKimDanPham === 'function') ? stateAPI.getKimDanPham(player) : 0;
    if (kdRowEl2 && kdPhamEl2) {
      if (kdPham2 >= 1 && typeof window !== 'undefined' && window.GameKimDan && window.GameKimDan.PHAM_NAMES) {
        kdRowEl2.style.display = '';
        kdPhamEl2.textContent = window.GameKimDan.PHAM_NAMES[kdPham2] +
          ' (linh lực tối đa +' + ((kdPham2 - 1) * 5) + '%, tu vi nhận +' + ((kdPham2 - 1) * 2) + '%)';
      } else {
        kdRowEl2.style.display = 'none';
      }
    }

    var harmony = stateAPI.harmonyOf(player.paths);
    if (harmonyEl) harmonyEl.textContent = harmony;

    // Tu vi 5 trụ
    var p = player.paths || {};
    var tuviTho = document.getElementById('tuvi-tho');
    var tuviKim = document.getElementById('tuvi-kim');
    var tuviHoa = document.getElementById('tuvi-hoa');
    var tuviThuy = document.getElementById('tuvi-thuy');
    var tuviMoc = document.getElementById('tuvi-moc');

    // Đợt T1: hiện kèm TRẦN MỐC hiện tại của từng đường và dấu ĐẦY TRẦN khi
    // đường đã chạm trần (tu vi không tăng thêm cho tới khi đột phá tiểu mốc).
    var mocCapNow = (stateAPI && stateAPI.getMocCap) ? stateAPI.getMocCap(player) : null;
    var tuviText = function (v) {
      var val = v || 0;
      if (mocCapNow === null) return '' + val;
      return val + ' / ' + mocCapNow + (val >= mocCapNow ? ' — ĐẦY TRẦN' : '');
    };
    if (tuviTho) tuviTho.textContent = tuviText(p.tho && p.tho.tuVi);
    if (tuviKim) tuviKim.textContent = tuviText(p.kim && p.kim.tuVi);
    if (tuviHoa) tuviHoa.textContent = tuviText(p.hoa && p.hoa.tuVi);
    if (tuviThuy) tuviThuy.textContent = tuviText(p.thuy && p.thuy.tuVi);
    if (tuviMoc) tuviMoc.textContent = tuviText(p.moc && p.moc.tuVi);

    // Chỉ số phái sinh (gồm cả trang bị đang mặc — khớp công thức chiến đấu của engine)
    var stats = stateAPI.deriveStats(player.paths, player.equipment);
    var statHp = document.getElementById('stat-hpmax');
    var statLl = document.getElementById('stat-llmax');
    var statAtk = document.getElementById('stat-atk');
    var statDef = document.getElementById('stat-def');
    var statCrit = document.getElementById('stat-crit');
    var statRegen = document.getElementById('stat-regen');

    if (statHp) statHp.textContent = stats.hpMax;
    if (statLl) statLl.textContent = stats.linhLucMax;
    if (statAtk) statAtk.textContent = stats.attack;
    if (statDef) statDef.textContent = stats.defense;
    if (statCrit) statCrit.textContent = stats.critRate + '%';
    if (statRegen) statRegen.textContent = stats.regenRate + ' /s';

    // Đợt 2: Soft caps & Lượt hồi sinh
    var dateKey = new Date().toISOString().slice(0, 10);
    var daily = (player.daily && player.daily[dateKey]) || {};
    var farmTuVi = daily.farmTuVi || 0;
    var farmLt = daily.farmLinhThach || 0;
    var revival = player.revivalPool !== undefined ? player.revivalPool : 5;

    var tvEl = document.getElementById('char-panel-farm-tuvi');
    var ltEl = document.getElementById('char-panel-farm-lt');
    var rvEl = document.getElementById('char-panel-revival-pool');

    if (tvEl) tvEl.textContent = farmTuVi + ' / 65';
    // Đợt T1: mẫu số là TRẦN LINH THẠCH NGÀY THEO CẢNH GIỚI (hồ sơ 50 §7:
    // 300/1.200/4.000/12.000/30.000) — trước đây ghi cứng 300 ở mọi cảnh giới.
    if (ltEl) ltEl.textContent = farmLt + ' / ' + ((stateAPI && stateAPI.getLinhThachDailyCap) ? stateAPI.getLinhThachDailyCap(player) : 300);
    if (rvEl) rvEl.textContent = revival + ' / 5';

    // Đợt K2: tỉ lệ Hài Hòa HH + trạng thái Liên Hoàn (chỉ hiển thị)
    var hhEl = document.getElementById('char-panel-hh');
    var lhEl = document.getElementById('char-panel-lienhoan');
    if (stateAPI && stateAPI.harmonyRatio) {
      var hhNow = stateAPI.harmonyRatio(player.paths);
      if (hhEl) hhEl.textContent = Math.round(hhNow * 100) + '%';
      if (lhEl) {
        var lhState = (window.GameEngine && window.GameEngine.getLienHoan) ? window.GameEngine.getLienHoan() : null;
        if (hhNow >= 0.8) {
          lhEl.textContent = 'Đang kích hoạt' + (lhState && lhState.stacks > 0 ? ' — chuỗi ×' + Math.min(lhState.stacks, 5) : '');
        } else {
          lhEl.textContent = 'Chưa kích hoạt (cần HH ≥ 80%)';
        }
      }
    }

    renderSkillBook();
  }

  /**
   * Đợt K2 — Sổ Chiêu: dựng thẳng từ registry kỹ năng (nguồn sự thật duy
   * nhất). Mọi họ đều hiện; chiêu chưa mở hiện rõ điều kiện mở; chiêu đã
   * mở hiện phím trong đội hình và nút tung chiêu (đi qua đúng một đường
   * engine.castSkill như phím số).
   */
  function renderSkillBook() {
    var host = document.getElementById('skill-book');
    if (!host) return;
    var SK = (typeof window !== 'undefined') ? window.GameSkills : null;
    if (!SK || !player) { host.innerHTML = ''; return; }
    var pathNames = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
    var groups = [
      { fam: 'kim', title: 'Họ Kim' },
      { fam: 'moc', title: 'Họ Mộc' },
      { fam: 'thuy', title: 'Họ Thủy' },
      { fam: 'hoa', title: 'Họ Hỏa' },
      { fam: 'tho', title: 'Họ Thổ' },
      { fam: 'hop-kich', title: 'Họ Hợp Kích' },
      { fam: 'vo-hoc', title: 'Võ Học Tay Không' },
      { fam: 'co-ban', title: 'Cơ Bản' }
    ];
    var loadout = SK.getLoadout();
    var all = SK.listSkills();
    var html = '';
    for (var g = 0; g < groups.length; g++) {
      var fam = groups[g].fam;
      var inFam = [];
      for (var a = 0; a < all.length; a++) if (all[a].family === fam) inFam.push(all[a]);
      if (!inFam.length) continue;
      html += '<div class="sb-group"><div class="sb-group-title">' + groups[g].title + '</div>';
      for (var s = 0; s < inFam.length; s++) {
        var d = inFam[s];
        var lang = SK.elementLang(SK.elementOf(d));
        var unlocked = SK.isUnlocked(d, player);
        var slotIdx = -1;
        for (var l = 0; l < loadout.length; l++) if (loadout[l].id === d.id) slotIdx = l;
        var meta = [];
        if (d.thuc) meta.push('Thức ' + d.thuc);
        if (d.cost && d.cost.amount) meta.push('Tốn ' + d.cost.amount + ' linh lực');
        if (typeof d.cooldown === 'number') meta.push('Hồi ' + String(d.cooldown).replace('.', ',') + ' giây');
        if (d.range) meta.push('Tầm ' + d.range);
        var stateHtml;
        if (unlocked) {
          stateHtml = '<span class="sb-open">Đã mở</span>' +
            (slotIdx >= 0 ? ' <span class="sb-key">Phím ' + (slotIdx + 1) + '</span>' : '') +
            (d.delivery !== 'melee' ? ' <button type="button" class="sb-cast" data-skill="' + d.id + '">Tung chiêu</button>' : '');
        } else if (d.unlock && d.unlock.type === 'harmony') {
          var hhCur = SK.harmonyRatioOf(player.paths);
          stateHtml = '<span class="sb-lock">Khóa — cần Hài Hòa ≥ ' + String(d.unlock.min).replace('.', ',') +
            ' (hiện tại ' + String(Math.round(hhCur * 100) / 100).replace('.', ',') + ')</span>';
        } else if (d.unlock && d.unlock.type === 'pathTuVi') {
          var cur = (player.paths && player.paths[d.unlock.path]) ? (player.paths[d.unlock.path].tuVi || 0) : 0;
          stateHtml = '<span class="sb-lock">Khóa — cần tu vi ' + (pathNames[d.unlock.path] || d.unlock.path) +
            ' ≥ ' + d.unlock.min + ' (hiện tại ' + cur + ')</span>';
        } else {
          stateHtml = '<span class="sb-lock">Khóa</span>';
        }
        html += '<div class="sb-row' + (unlocked ? '' : ' sb-locked') + '">' +
          '<span class="sb-chip" style="background:' + lang.glow + ';border-color:' + lang.deep + '"></span>' +
          '<div class="sb-main"><div class="sb-name">' + d.name +
          (d.provisional ? ' <span class="sb-prov">số tạm theo khuôn chiêu chứng</span>' : '') + '</div>' +
          '<div class="sb-meta">' + meta.join(' · ') + '</div>' +
          '<div class="sb-desc">' + (d.desc || '') + '</div></div>' +
          '<div class="sb-state">' + stateHtml + '</div></div>';
      }
      html += '</div>';
    }
    host.innerHTML = html;
    var btns = host.querySelectorAll('.sb-cast');
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', function () {
        var id = this.getAttribute('data-skill');
        var panel = document.getElementById('char-panel');
        if (panel) panel.classList.add('hidden');
        if (window.GameEngine && window.GameEngine.castSkill) window.GameEngine.castSkill(id);
      });
    }
  }

  // Đợt 6: tiến độ dạng x/y cho từng bước chuỗi chính (đọc thẳng trạng thái người chơi)
  function weakestTuViOf() {
    if (!player || !player.paths) return 0;
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var min = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var v = (player.paths[keys[i]] && player.paths[keys[i]].tuVi) || 0;
      if (v < min) min = v;
    }
    return isFinite(min) ? min : 0;
  }

  function mainStageProgressText(info) {
    if (!info || !player) return '';
    var q = player.quests || {};
    switch (info.mainStage) {
      case 1: return 'đường yếu nhất ' + weakestTuViOf() + '/30 tu vi';
      case 2: return (q.nhenKills || 0) + '/3';
      case 3: return (stateAPI && stateAPI.hasItemInBag(player, 'nguyen-tinh-moc', 1)) ? 'đã có Nguyên Tinh Mộc' : 'chưa có Nguyên Tinh Mộc';
      case 4: return 'đường yếu nhất ' + weakestTuViOf() + '/300 tu vi';
      case 5: return (q.bangXaKills || 0) + '/4';
      case 6: {
        var hasNT = stateAPI && stateAPI.hasItemInBag(player, 'nguyen-tinh-thuy', 1);
        var hasBT = stateAPI && stateAPI.hasItemInBag(player, 'bang-tuy', 1);
        return 'Nguyên Tinh Thủy ' + (hasNT ? 'đủ' : 'thiếu') + ' · Băng Tủy ' + (hasBT ? 'đủ' : 'thiếu');
      }
      case 7: return 'đường yếu nhất ' + weakestTuViOf() + '/600 tu vi';
      case 8: {
        if (!stateAPI || !stateAPI.countItemInBag) return '';
        return 'Linh Chi ' + stateAPI.countItemInBag(player, 'linh-chi-rung') + '/3 · Băng Tủy ' + stateAPI.countItemInBag(player, 'bang-tuy') + '/1 · Hỏa Tinh ' + stateAPI.countItemInBag(player, 'hoa-tinh-tho') + '/2 · Linh Thạch ' + (player.linhThach || 0) + '/200';
      }
      case 9: return 'đường yếu nhất ' + weakestTuViOf() + '/900 tu vi';
      default: return '';
    }
  }

  /**
   * Cập nhật Bảng theo dõi nhiệm vụ
   */
  function updateQuestPanel() {
    if (!player || !mapData) return;

    syncAutoPathButton();

    var titleEl = document.getElementById('quest-title');
    var descEl = document.getElementById('quest-desc');
    var distEl = document.getElementById('quest-dist');
    var q = player.quests || {};
    var sectStage = (q.sectStage !== undefined) ? q.sectStage : 0;

    var mapNames = {
      mieu_hoang: 'Miếu Hoang',
      'rung-doc': 'Rừng Độc Thanh Tụy',
      'tong-mon': 'Tông Môn',
      'dai-dien': 'Đại Điện',
      'son-coc': 'Sơn Cốc',
      'dai-truyen-tong': 'Đài Truyền Tống',
      'ho-bang': 'Hồ Băng Hàn Kính',
      'mo-lua': 'Mỏ Lửa Xích Diệm',
      'hoang-mac': 'Hoang Mạc Hoàng Sa',
      'kiem-trung': 'Kiếm Trủng Huyền Thiết'
    };

    var targetInfo = (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getQuestTargetInfo) ? window.GameEngine.getQuestTargetInfo() : null;

    if (!q.talked_linhnhi) {
      if (titleEl) titleEl.textContent = 'Nói chuyện với Linh Nhi';
      if (descEl) {
        descEl.textContent = 'Linh Nhi đang đợi ở trước miếu hoang.';
        descEl.classList.remove('greyed');
      }
    } else if (!q.huntCompleted) {
      var kills = q.thaotinhKills || 0;
      if (titleEl) titleEl.textContent = 'Săn Thảo Tinh ở Rừng Độc (' + kills + '/5)';
      if (descEl) {
        if (mapData.id === 'mieu_hoang') {
          descEl.textContent = 'Đi qua lối thoát phía đông để sang Rừng Độc Thanh Tụy.';
        } else {
          descEl.textContent = 'Hạ gục 5 Thảo Tinh Nhỏ ở vành ngoài Rừng Độc.';
        }
        descEl.classList.remove('greyed');
      }
    } else if (sectStage === 0) {
      if (titleEl) titleEl.textContent = 'Từ biệt Linh Nhi';
      if (descEl) {
        descEl.textContent = 'Linh Nhi muốn theo ca ca lên tông môn. Nói chuyện với cô bé trước khi lên đường.';
        descEl.classList.remove('greyed');
      }
    } else if (sectStage === 1) {
      if (titleEl) titleEl.textContent = 'Báo danh ở Lối Vào';
      if (descEl) {
        descEl.textContent = 'Đi đường xuống núi ở phía nam Miếu Hoang để tới sơn môn, gặp Tiếp Dẫn Đệ Tử.';
        descEl.classList.remove('greyed');
      }
    } else if (sectStage === 2) {
      if (titleEl) titleEl.textContent = 'Diện kiến Chưởng Môn';
      if (descEl) {
        descEl.textContent = 'Vào Đại Điện ở giữa trục chính của sơn môn, chưởng môn đang đợi.' +
          (q.starterSwordGranted ? ' Tông môn đã cấp Kiếm Đệ Tử — mở Túi đồ, chọn kiếm rồi bấm Trang bị để cầm kiếm.' : '');
        descEl.classList.remove('greyed');
      }
    } else if (sectStage === 3) {
      if (titleEl) titleEl.textContent = 'Nhận lệnh từ Chấp Sự';
      if (descEl) {
        descEl.textContent = 'Chấp Sự ở Quảng Trường sẽ cấp phòng ở và sổ tay đệ tử.';
        descEl.classList.remove('greyed');
      }
    } else if (targetInfo && targetInfo.title) {
      // Đợt 6: chuỗi nhiệm vụ chính mainStage — panel KHÔNG BAO GIỜ trống hướng
      var prog = mainStageProgressText(targetInfo);
      if (titleEl) titleEl.textContent = targetInfo.title + (prog ? ' (' + prog + ')' : '');
      if (descEl) {
        descEl.textContent = targetInfo.desc || '';
        descEl.classList.remove('greyed');
      }
    } else {
      if (titleEl) titleEl.textContent = 'Khám phá Tông Môn';
      if (descEl) {
        descEl.textContent = 'Đã nhập môn. Tự do tham quan 14 khu của sơn môn, luyện công ở Rừng Trúc và Khu Huấn Luyện.';
        descEl.classList.add('greyed');
      }
    }

    if (distEl) {
      if (sectStage >= 4 && targetInfo && targetInfo.mapId) {
        if (targetInfo.mapId === mapData.id) {
          var destM = (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.resolveQuestDestination) ? window.GameEngine.resolveQuestDestination(targetInfo) : null;
          if (destM) {
            var stepDistM = Math.round(Math.hypot(player.x - destM.x, player.y - destM.y) / 24);
            distEl.textContent = 'Khoảng cách: ~' + stepDistM + ' bước';
          } else {
            distEl.textContent = 'Trong khu vực';
          }
        } else {
          distEl.textContent = 'Đích ở ' + (mapNames[targetInfo.mapId] || targetInfo.mapId);
        }
      } else if (sectStage >= 4) {
        distEl.textContent = 'Tự do rèn luyện';
      } else if (targetInfo) {
        if (targetInfo.mapId === mapData.id) {
          var dest = (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.resolveQuestDestination) ? window.GameEngine.resolveQuestDestination(targetInfo) : null;
          if (dest) {
            var stepDist = Math.round(Math.hypot(player.x - dest.x, player.y - dest.y) / 24);
            distEl.textContent = 'Khoảng cách: ~' + stepDist + ' bước';
          } else if (targetInfo.kind === 'hunt') {
            distEl.textContent = 'Bãi quái vành ngoài';
          } else {
            distEl.textContent = 'Trong khu vực';
          }
        } else {
          distEl.textContent = 'Đích ở ' + (mapNames[targetInfo.mapId] || targetInfo.mapId);
        }
      } else {
        distEl.textContent = 'Tự do rèn luyện';
      }
    }
  }

  /**
   * Cập nhật bản đồ nhỏ (Minimap)
   */
  function updateMinimap(monsters) {
    if (!minimapCtx || !minimapCanvas || !player || !mapData) return;

    var mw = minimapCanvas.width;
    var mh = minimapCanvas.height;

    minimapCtx.clearRect(0, 0, mw, mh);

    updateMinimapBackground();

    if (minimapBgImg && minimapBgImg.complete && minimapBgImg.naturalWidth > 0) {
      minimapCtx.drawImage(minimapBgImg, 0, 0, mw, mh);
    } else {
      minimapCtx.fillStyle = '#222822';
      minimapCtx.fillRect(0, 0, mw, mh);
    }

    var scaleX = mw / mapData.width;
    var scaleY = mh / mapData.height;

    // Chấm Linh Nhi (khi ở Miếu Hoang)
    if (mapData.id === 'mieu_hoang' && mapData.linhnhi) {
      var lnx = mapData.linhnhi.feetX * scaleX;
      var lny = mapData.linhnhi.feetY * scaleY;

      minimapCtx.save();
      minimapCtx.shadowColor = '#b870ff';
      minimapCtx.shadowBlur = 6;
      minimapCtx.fillStyle = '#b870ff';
      minimapCtx.beginPath();
      minimapCtx.arc(lnx, lny, 3.5, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.restore();
    }

    // Chấm quái vật (khi ở Rừng Độc)
    if (mapData.id === 'rung-doc' && monsters && monsters.length > 0) {
      for (var i = 0; i < monsters.length; i++) {
        var m = monsters[i];
        if (m.state === 'dead') continue;
        var mx = m.x * scaleX;
        var my = m.y * scaleY;

        minimapCtx.save();
        if (m.isElite) {
          minimapCtx.shadowColor = '#ffe9a8';
          minimapCtx.shadowBlur = 8;
          minimapCtx.fillStyle = '#ffe9a8';
          minimapCtx.beginPath();
          minimapCtx.arc(mx, my, 4.5, 0, Math.PI * 2);
          minimapCtx.fill();
        } else {
          minimapCtx.fillStyle = '#e85555';
          minimapCtx.beginPath();
          minimapCtx.arc(mx, my, 2.2, 0, Math.PI * 2);
          minimapCtx.fill();
        }
        minimapCtx.restore();
      }
    }

    // Đợt 6 (mục 15, hồ sơ 10D): chấm vàng tại đích nhiệm vụ khi cùng bản đồ
    var mmSet = stateAPI ? stateAPI.loadSettings() : null;
    if (!mmSet || mmSet.minimapDestDot !== false) {
      try {
        var engMM = (typeof window !== 'undefined' && window.GameEngine) ? window.GameEngine : null;
        var tInfoMM = (engMM && engMM.getQuestTargetInfo) ? engMM.getQuestTargetInfo() : null;
        var destMM = (tInfoMM && engMM.resolveQuestDestination) ? engMM.resolveQuestDestination(tInfoMM) : null;
        if (destMM && (!destMM.mapId || destMM.mapId === mapData.id)) {
          var dxMM = destMM.x * scaleX;
          var dyMM = destMM.y * scaleY;
          minimapCtx.save();
          minimapCtx.shadowColor = '#ffd94d';
          minimapCtx.shadowBlur = 7;
          minimapCtx.fillStyle = '#ffd94d';
          minimapCtx.beginPath();
          minimapCtx.arc(dxMM, dyMM, 3.4, 0, Math.PI * 2);
          minimapCtx.fill();
          minimapCtx.restore();
        }
      } catch (e) { /* bản đồ nhỏ vẫn vẽ bình thường nếu đích không xác định được */ }
    }

    // Chấm người chơi Hà Nhân (trắng sáng)
    var px = player.x * scaleX;
    var py = player.y * scaleY;

    minimapCtx.save();
    minimapCtx.shadowColor = '#ffffff';
    minimapCtx.shadowBlur = 5;
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.strokeStyle = '#222222';
    minimapCtx.lineWidth = 1;
    minimapCtx.beginPath();
    minimapCtx.arc(px, py, 3.8, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.stroke();
    minimapCtx.restore();
  }

  /**
   * Cập nhật định kỳ từ Engine (mỗi khung hình)
   */
  function update(playerObj, mapObj, extraData) {
    player = playerObj;
    mapData = mapObj;
    var extras = extraData || {};

    refreshHUD();
    updateMinimap(extras.monsters);

    // Cập nhật Chuỗi Săn chip
    var chainChip = document.getElementById('hud-hunt-chain');
    var chainCountEl = document.getElementById('chain-count');
    var chainBonusEl = document.getElementById('chain-bonus');
    if (chainChip && player.huntChain) {
      if (mapData.id === 'rung-doc' && player.huntChain.count > 0) {
        chainChip.classList.remove('hidden');
        if (chainCountEl) chainCountEl.textContent = player.huntChain.count;
        var bonus = stateAPI ? stateAPI.calcChainBonus(player.huntChain.count) : 0;
        if (chainBonusEl) chainBonusEl.textContent = '(+' + bonus + '% rơi đồ)';
      } else {
        chainChip.classList.add('hidden');
      }
    }

    // Cập nhật Cooldown kỹ năng trên thanh skill (theo registry, Đợt K1):
    // tổng hồi chiêu lấy từ định nghĩa chiêu, phần còn lại từ engine.
    if (extras.skillsCd && window.GameSkills) {
      var loadoutCd = window.GameSkills.getLoadout();
      for (var si = 0; si < loadoutCd.length; si++) {
        updateSkillSlotUI(si + 1, extras.skillsCd[loadoutCd[si].id] || 0, loadoutCd[si].cooldown);
      }
    }

    // Làm mới thanh pháp quyết canh tác mỗi giây khi ở map ruộng để đếm
    // ngược hồi chiêu chạy và nút mở lại khi hết hồi chiêu (trước đây thanh
    // chỉ vẽ lại khi đổi map/bấm cast nên đếm ngược đóng băng, nút khóa cứng).
    if (mapData && mapData.id === 'ruong-linh-me') {
      var nowMs = Date.now();
      if (nowMs - lastFarmBarRefresh >= 1000) {
        lastFarmBarRefresh = nowMs;
        updateFarmSkillBar(true);
      }
    }
  }

  /**
   * Dựng các ô nút kỹ năng từ registry (Đợt K1): mỗi ô trên thanh lấy
   * chiêu theo LOADOUT của js/skills.js — tooltip gồm tên + hệ + hao phí,
   * icon theo def.icon, nhãn theo def.shortName, bấm để castSkill(id).
   */
  function bindSkillSlots() {
    if (!window.GameSkills) return;
    var loadout = window.GameSkills.getLoadout();
    for (var i = 0; i < loadout.length; i++) {
      (function (def, idx) {
        var slot = document.getElementById('skill-slot-' + (idx + 1));
        if (!slot) return;
        var lang = window.GameSkills.elementLang(window.GameSkills.elementOf(def));
        var title = '[' + (idx + 1) + '] ' + def.name + ' (' + lang.name + ')';
        if (def.cost && def.cost.amount > 0) title += ' - Tốn ' + def.cost.amount + ' Linh lực';
        if (def.desc) title += ' — ' + def.desc;
        slot.title = title;
        slot.setAttribute('aria-label', def.name);
        var icon = slot.querySelector('.skill-icon');
        if (icon) icon.className = 'skill-icon ' + def.icon;
        var tag = slot.querySelector('.skill-name-tag');
        if (tag) tag.textContent = def.shortName || def.name;
        var hk = slot.querySelector('.skill-hotkey');
        if (hk) hk.textContent = String(idx + 1);
        slot.addEventListener('click', function () {
          if (window.GameEngine && window.GameEngine.castSkill) {
            window.GameEngine.castSkill(def.id);
          }
        });
      })(loadout[i], i);
    }
  }

  function updateSkillSlotUI(slotNum, remainingCd, totalCd) {
    var slot = document.getElementById('skill-slot-' + slotNum);
    if (!slot) return;
    var overlay = slot.querySelector('.skill-cd-overlay');
    var cdText = slot.querySelector('.skill-cd-text');

    if (remainingCd > 0) {
      var ratio = remainingCd / totalCd;
      if (overlay) overlay.style.transform = 'scaleY(' + ratio + ')';
      if (cdText) cdText.textContent = remainingCd.toFixed(1) + 's';
    } else {
      if (overlay) overlay.style.transform = 'scaleY(0)';
      if (cdText) cdText.textContent = '';
    }
  }

  function triggerSkillShake(slotNum) {
    var slot = document.getElementById('skill-slot-' + slotNum);
    if (!slot) return;
    slot.classList.remove('shake');
    // void reflow to restart animation
    void slot.offsetWidth;
    slot.classList.add('shake');
  }

  /**
   * Mở hộp thoại với NPC
   */
  function openDialogue(npc) {
    if (!npc || !npc.dialogue || npc.dialogue.length === 0) return;

    dialogueState.active = true;
    dialogueState.npc = npc;
    dialogueState.step = 0;
    dialogueState.lines = npc.dialogue;
    dialogueState.choiceShown = false;
    dialogueState.prevStepId = null;
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getQuestTargetInfo) {
      var curInfo = window.GameEngine.getQuestTargetInfo();
      dialogueState.prevStepId = curInfo ? curInfo.stepId : null;
    }
    var choicesEl = document.getElementById('dialogue-choices');
    if (choicesEl) { choicesEl.innerHTML = ''; choicesEl.classList.add('hidden'); }

    var dialogueBox = document.getElementById('dialogue-box');
    var nameEl = document.getElementById('dialogue-npc-name');
    var portraitEl = document.getElementById('dialogue-portrait');

    if (nameEl) nameEl.textContent = npc.name;
    if (portraitEl) {
      portraitEl.style.backgroundImage = 'url(' + npc.asset + ')';
      // Giữ đúng tỉ lệ gốc của từng NPC (hotfix 2026-11-09): trước đây mọi NPC bị
      // ép vào khung nền 140x311 chỉnh tay cho Linh Nhi (252x560) — NPC khác bị
      // bóp ngang tới 34% và cắt lệch mặt. Nay tính bề rộng nền theo tỉ lệ thật
      // của tệp (originalW/originalH), giữ nguyên chiều cao hiển thị 311px và
      // căn giữa khuôn mặt; với Linh Nhi kết quả trùng hệt thông số cũ (140px, -36px).
      var portraitH = 311;
      var natW = npc.originalW || 252;
      var natH = npc.originalH || 560;
      var portraitW = Math.max(68, Math.round(portraitH * natW / natH));
      portraitEl.style.backgroundSize = portraitW + 'px ' + portraitH + 'px';
      portraitEl.style.backgroundPosition = Math.round(-(portraitW - 68) / 2) + 'px -12px';
      // NPCFIX 2026-11-09: chốt lại bề rộng theo bitmap THẬT khi ảnh nạp xong.
      // Cùng gốc lỗi "vỡ hình" ngoài thế giới: cache Pages còn giữ ảnh cũ khác khổ
      // với dữ liệu mới thì tỉ lệ tính từ originalW/originalH vẫn bóp chân dung.
      portraitEl.setAttribute('data-portrait-asset', npc.asset);
      (function (el, asset, ph) {
        var probe = new Image();
        probe.onload = function () {
          if (el.getAttribute('data-portrait-asset') !== asset) return;
          if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
            var pw = Math.max(68, Math.round(ph * probe.naturalWidth / probe.naturalHeight));
            el.style.backgroundSize = pw + 'px ' + ph + 'px';
            el.style.backgroundPosition = Math.round(-(pw - 68) / 2) + 'px -12px';
          }
        };
        probe.src = asset;
      })(portraitEl, npc.asset, portraitH);
    }

    if (dialogueBox) dialogueBox.classList.remove('hidden');
    renderDialogueLine();
  }

  function renderDialogueLine() {
    var textEl = document.getElementById('dialogue-text');
    if (textEl && dialogueState.lines[dialogueState.step]) {
      textEl.textContent = dialogueState.lines[dialogueState.step];
    }
    // Lồng tiếng (Đợt 3, Note 3A): phát audio của đúng câu đang hiển thị
    if (typeof window !== 'undefined' && window.GameVoice && dialogueState.lines[dialogueState.step]) {
      window.GameVoice.playFor(dialogueState.npc ? dialogueState.npc.name : '', dialogueState.lines[dialogueState.step]);
    }
  }

  function advanceDialogue() {
    if (!dialogueState.active) return;
    if (audioAPI) audioAPI.playClick();

    dialogueState.step++;
    if (dialogueState.step < dialogueState.lines.length) {
      renderDialogueLine();
    } else if (dialogueState.npc && dialogueState.npc.id === 'npc_chapsu' && !dialogueState.choiceShown) {
      showChapsuChoices();
    } else if (dialogueState.npc && dialogueState.npc.id === 'npc_tuan_thu_su' && !dialogueState.choiceShown) {
      showTuanThuSuChoices();
    } else if (dialogueState.npc && dialogueState.npc.id === 'npc_truonglao_duocdien' && !dialogueState.choiceShown) {
      showTruongLaoChoices();
    } else if (dialogueState.npc && dialogueState.npc.id === 'npc_duocsu' && !dialogueState.choiceShown) {
      showDuocSuChoices();
    } else {
      closeDialogue();
    }
  }

  // Đợt ELDER (Bui 01:32 & 01:37): Menu lựa chọn của Trưởng Lão Dược Điền
  var elderDemoTimer = null;
  function showTruongLaoChoices() {
    dialogueState.choiceShown = true;
    var box = document.getElementById('dialogue-choices');
    if (!box) { closeDialogue(); return; }
    box.innerHTML = '';
    box.classList.remove('hidden');

    var mkBtn = function (label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn wood dialogue-choice-btn';
      b.textContent = label;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      box.appendChild(b);
    };

    var q = (player && player.quests) || {};
    var sectDone = (q.sectStage || 0) >= 4;
    var ld = (typeof window !== 'undefined' && window.GameLinhDien) ? window.GameLinhDien : null;

    if (!sectDone) {
      var textEl = document.getElementById('dialogue-text');
      if (textEl) {
        textEl.textContent = 'Trưởng Lão Dược Điền: Ruộng Linh Mễ này là căn cơ nông nghiệp của Thanh Vân Tông ta. Ngươi chưa chính thức nhập môn, chớ nên nóng vội.';
      }
      mkBtn('Rời đi', function () { closeDialogue(); });
      return;
    }

    var allLearned = ld && ld.isSpellLearned &&
                     ld.isSpellLearned(player, 'linh-vu') &&
                     ld.isSpellLearned(player, 'tru-ue') &&
                     ld.isSpellLearned(player, 'thoi-sinh') &&
                     ld.isSpellLearned(player, 'dan-linh');

    if (!allLearned) {
      mkBtn('Xem Trưởng Lão thị phạm 4 Pháp Quyết', function () {
        startElderDemoUI();
      });
      mkBtn('Bái lĩnh truyền thừa 4 Pháp Quyết ngay', function () {
        learnAllSpellsFromElderUI();
      });
    } else {
      mkBtn('Mở Linh Điền (Ruộng Dược)', function () {
        closeDialogue();
        if (ld && ld.openPanel) ld.openPanel();
      });
      mkBtn('Xem lại thị phạm các cấp độ', function () {
        startElderDemoUI();
      });
    }
    mkBtn('Rời đi', function () { closeDialogue(); });
  }

  function startElderDemoUI() {
    var ld = (typeof window !== 'undefined' && window.GameLinhDien) ? window.GameLinhDien : null;
    if (!ld || !ld.ELDER_DEMO_STEPS) {
      learnAllSpellsFromElderUI();
      return;
    }

    var steps = ld.ELDER_DEMO_STEPS;
    var currentStep = 0;
    var textEl = document.getElementById('dialogue-text');
    var box = document.getElementById('dialogue-choices');
    if (box) {
      box.innerHTML = '';
      box.classList.remove('hidden');
      var skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'btn wood dialogue-choice-btn';
      skipBtn.textContent = 'Bỏ qua trình diễn (Skip)';
      skipBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (elderDemoTimer) clearTimeout(elderDemoTimer);
        ld.simulateElderDemo(player, true);
        if (textEl) {
          textEl.textContent = 'Trưởng Lão Dược Điền: Ngươi quả là kỳ tài thông tuệ, vừa nhìn đã thấu suốt bí quyết!';
        }
        showTruongLaoChoices();
      });
      box.appendChild(skipBtn);
    }

    function runStep() {
      if (currentStep >= steps.length) {
        if (player.quests && player.quests.elderQuest) {
          player.quests.elderQuest.demoDone = true;
          player.quests.elderQuest.stage = 2;
        }
        if (stateAPI) stateAPI.savePlayer(player);
        if (textEl) {
          textEl.textContent = 'Trưởng Lão Dược Điền: Đó là 4 đại pháp quyết linh điền của tông môn ở các cấp độ. Ngươi đã sẵn sàng tiếp nhận truyền thừa chưa?';
        }
        showTruongLaoChoices();
        return;
      }

      var res = ld.executeElderDemoStep(player, currentStep);
      var s = steps[currentStep];
      if (textEl) {
        textEl.textContent = 'Trưởng Lão Dược Điền: ' + s.desc;
      }
      if (audioAPI && audioAPI.playChime) audioAPI.playChime();

      var spText = '[' + s.name + ' - ' + s.rankName + ']';
      if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.spawnFloatingText) {
        var fxX = (res && typeof res.x === 'number') ? res.x : 225;
        var fxY = (res && typeof res.y === 'number') ? res.y - 20 : 400;
        window.GameEngine.spawnFloatingText(spText, fxX, fxY, s.color);
      }

      currentStep++;
      elderDemoTimer = setTimeout(runStep, 1200); // 1.2s mỗi bậc (PROVISIONAL)
    }

    runStep();
  }

  function learnAllSpellsFromElderUI() {
    if (elderDemoTimer) clearTimeout(elderDemoTimer);
    var ld = (typeof window !== 'undefined' && window.GameLinhDien) ? window.GameLinhDien : null;
    if (ld && ld.learnAllSpellsFromElder) {
      var r = ld.learnAllSpellsFromElder(player);
      if (audioAPI && audioAPI.playChime) audioAPI.playChime();
      showToast(r.msg || 'Đã lĩnh hội 4 Pháp Quyết Linh Điền!');
      refreshHUD();
    }
    closeDialogue();
  }

  // Đợt 6: lựa chọn dịch vụ của Chấp Sự hiện ở cuối thoại (đổi đan / luyện Trúc Cơ Đan)
  function showChapsuChoices() {
    dialogueState.choiceShown = true;
    var box = document.getElementById('dialogue-choices');
    if (!box) { closeDialogue(); return; }
    box.innerHTML = '';
    box.classList.remove('hidden');
    var mkBtn = function (label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn wood dialogue-choice-btn';
      b.textContent = label;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      box.appendChild(b);
    };
    mkBtn('Đổi Tu Luyện Đan (15 LT/viên)', function () {
      closeDialogue();
      openPillExchangeModal();
    });
    mkBtn('Luyện Trúc Cơ Đan', function () {
      if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.refineTrucCoDan) {
        window.GameEngine.refineTrucCoDan();
      }
      closeDialogue();
    });
    // Đợt T1: Đột Phá Tiểu Mốc — bảng điều kiện trần mốc (đầy 5 đường + Linh
    // Thạch + nguyên liệu vùng), mở tại Chấp Sự Đường bất cứ lúc nào.
    mkBtn('Đột Phá Tiểu Mốc', function () {
      closeDialogue();
      if (typeof window !== 'undefined' && window.GameTieuMoc && window.GameTieuMoc.openPanel) {
        window.GameTieuMoc.openPanel();
      }
    });
    // Đợt T2: Đột Phá Trúc Cơ — bảng đột phá đại cảnh giới (đủ/thiếu từng
    // điều kiện + nút Chỉ đường + độ kiếp diễn thật), mở tại Chấp Sự.
    mkBtn('Đột Phá Trúc Cơ (Độ Kiếp)', function () {
      closeDialogue();
      if (typeof window !== 'undefined' && window.GameDotPha && window.GameDotPha.openPanel) {
        window.GameDotPha.openPanel();
      }
    });
    // Đợt DANPHONG: Bảng Nhiệm Vụ Thu Thập + trả nhiệm vụ ngay tại Chấp Sự
    var dp = (typeof window !== 'undefined' && window.GameDanPhong) ? window.GameDanPhong : null;
    if (dp && player && player.quests && (player.quests.sectStage || 0) >= 4) {
      var activeDef = dp.activeQuest ? dp.activeQuest(player) : null;
      if (activeDef) {
        var prog = dp.questProgress(player, activeDef);
        if (prog && prog.ready) {
          mkBtn('Trả Nhiệm Vụ Thu Thập (đã đủ ' + prog.need + ' vật phẩm)', function () {
            var res = dp.turnInQuest(player);
            if (res && res.msg) showToast(res.msg);
            refreshHUD();
            closeDialogue();
          });
        }
      }
      mkBtn('Bảng Nhiệm Vụ Thu Thập', function () {
        closeDialogue();
        if (dp.openPanel) dp.openPanel('board');
      });
      mkBtn('Vào Đan Phòng (Luyện Đan)', function () {
        closeDialogue();
        if (dp.openPanel) dp.openPanel('refine');
      });
    }
    // Đợt LINHME: Việc vụ Tông Môn (Linh Mễ) tại Chấp Sự
    mkBtn('Việc Vụ Tông Môn (Linh Mễ)', function () {
      closeDialogue();
      openSectQuestModal();
    });
    mkBtn('Rời đi', function () { closeDialogue(); });
  }

  // Đợt LINHME: Lựa chọn dịch vụ của Dược Sư (Vườn Linh Mễ, Việc Tông, Đổi Thức Ăn)
  function showDuocSuChoices() {
    dialogueState.choiceShown = true;
    var box = document.getElementById('dialogue-choices');
    if (!box) { closeDialogue(); return; }
    box.innerHTML = '';
    box.classList.remove('hidden');
    var mkBtn = function (label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn wood dialogue-choice-btn';
      b.textContent = label;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      box.appendChild(b);
    };
    mkBtn('Vườn Linh Mễ Tông Môn (32 Ô Đất)', function () {
      closeDialogue();
      openTongMonFarmModal();
    });
    mkBtn('Xem Pháp Quyết Canh Tác (4 Kỹ Năng)', function () {
      closeDialogue();
      openFarmSpellLearnModal();
    });
    mkBtn('Việc Vụ Tông Môn (Canh Tác Linh Mễ)', function () {
      closeDialogue();
      openSectQuestModal();
    });
    mkBtn('Đổi Linh Thực / Thức Ăn Hồi Phục', function () {
      closeDialogue();
      openFoodExchangeModal();
    });
    mkBtn('Rời đi', function () { closeDialogue(); });
  }

  // Đợt N2: menu Tuần Thú Sư theo đúng khung menu NPC của Chấp Sự.
  function showTuanThuSuChoices() {
    dialogueState.choiceShown = true;
    var lt = getLinhThuApi();
    if (lt && player) { var s0 = lt.ensureState(player); s0.metTrainer = true; }
    var box = document.getElementById('dialogue-choices');
    if (!box) { closeDialogue(); return; }
    box.innerHTML = '';
    box.classList.remove('hidden');
    var mkBtn = function (label, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn wood dialogue-choice-btn';
      b.textContent = label;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      box.appendChild(b);
    };
    mkBtn('Xem Linh Thú', function () {
      closeDialogue();
      openLinhThu();
    });
    mkBtn('Xem Chuồng Thú', function () {
      closeDialogue();
      openLinhThu();
    });
    mkBtn('Đổi Đan Thú (2 Linh Chi Rừng + 1 Hoa Giải Độc)', function () {
      doTrainerExchange('dan-thu');
      showTuanThuSuChoices();
    });
    mkBtn('Đổi Yên Linh Thú (2 Đá Nung + 1 Tơ Nhện Xanh)', function () {
      doTrainerExchange('yen-linh-thu');
      showTuanThuSuChoices();
    });
    mkBtn('Đổi Chuông Linh Thú (2 Mảnh Kiếm Gãy + 1 Nguyên Tinh Kim)', function () {
      doTrainerExchange('chuong-linh-thu');
      showTuanThuSuChoices();
    });
    mkBtn('Đổi Giáp Linh Thú (3 Đá Nung + 1 Tim Gỗ Cổ Thụ)', function () {
      doTrainerExchange('giap-linh-thu');
      showTuanThuSuChoices();
    });
    // Quà gặp đầu: đúng một lần theo cờ firstHoanGiven, đọc qua helper
    // của mapdata.js (nguồn sự thật duy nhất qua GameLinhThu).
    var giftAvail = false;
    try {
      var md = (typeof window !== 'undefined') ? (window.GameMapData || window.MapData) : null;
      if (md && md.tuanThuSuFirstGiftAvailable) giftAvail = md.tuanThuSuFirstGiftAvailable(player);
      else if (lt && player) giftAvail = !lt.ensureState(player).firstHoanGiven;
    } catch (e) { giftAvail = false; }
    if (giftAvail) {
      mkBtn('Nhận Linh Thú Hoàn (quà gặp đầu, 1 lần duy nhất)', function () {
        var st = lt.ensureState(player);
        if (st.firstHoanGiven) {
          showToast('Đã nhận quà gặp đầu rồi.');
        } else {
          st.firstHoanGiven = true;
          if (stateAPI) stateAPI.addItemToBag(player, 'linh-thu-hoan', 1);
          if (stateAPI) stateAPI.savePlayer(player);
          showToast('Nhận 1 Linh Thú Hoàn! Đánh quái tới ≤20% máu rồi dùng nút Thuần Phục.');
          refreshHUD();
        }
        showTuanThuSuChoices();
      });
    }
    mkBtn('Rời đi', function () { closeDialogue(); });
  }

  // Đổi đồ ở Tuần Thú Sư theo công thức PROVISIONAL của GameLinhThu.
  function doTrainerExchange(itemId) {
    var lt = getLinhThuApi();
    if (!lt || !player || !stateAPI) return;
    var recipe = lt.EXCHANGE_RECIPES[itemId];
    if (!recipe) return;
    var defs = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS : {};
    for (var i = 0; i < recipe.length; i++) {
      if (stateAPI.countItemInBag(player, recipe[i].id) < recipe[i].count) {
        var d = defs[recipe[i].id];
        showToast('Thiếu nguyên liệu: ' + (d ? d.name : recipe[i].id) + ' ×' + recipe[i].count);
        return;
      }
    }
    for (var j = 0; j < recipe.length; j++) stateAPI.removeItemFromBag(player, recipe[j].id, recipe[j].count);
    stateAPI.addItemToBag(player, itemId, 1);
    stateAPI.savePlayer(player);
    var got = defs[itemId];
    showToast('Đã đổi được ' + (got ? got.name : itemId) + '.');
    refreshHUD();
  }

  function closeDialogue() {
    if (typeof window !== 'undefined' && window.GameVoice) window.GameVoice.stop();
    dialogueState.active = false;
    var dialogueBox = document.getElementById('dialogue-box');
    if (dialogueBox) dialogueBox.classList.add('hidden');
    var choicesEl = document.getElementById('dialogue-choices');
    if (choicesEl) { choicesEl.innerHTML = ''; choicesEl.classList.add('hidden'); }
    var prevStepId = dialogueState.prevStepId;

    if (dialogueState.npc) {
      if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.handleNpcTalked) {
        window.GameEngine.handleNpcTalked(dialogueState.npc.id);
      } else {
        if (dialogueState.npc.id === 'npc_linhnhi') {
          if (!player.quests.talked_linhnhi) {
            player.quests.talked_linhnhi = true;
            player.quests.current = 'hunt';
            player.quests.thaotinhKills = 0;
            player.quests.huntCompleted = false;
            if (stateAPI) stateAPI.savePlayer(player);
            if (audioAPI) audioAPI.playChime();
            showToast('Nhiệm vụ mới: Săn Thảo Tinh ở Rừng Độc');
            refreshHUD();
          }
        }
      }
    }

    // Đợt 6 (mục 17): bước nhiệm vụ vừa thăng bậc trong chuỗi mở đầu -> tự dẫn đường sau 400ms
    if (prevStepId && typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getQuestTargetInfo) {
      var newInfo = window.GameEngine.getQuestTargetInfo();
      var newStepId = newInfo ? newInfo.stepId : null;
      var qq = (player && player.quests) || {};
      if (newStepId && newStepId !== prevStepId && ((qq.sectStage || 0) <= 4)) {
        setTimeout(function () {
          if (!dialogueState.active && window.GameEngine && window.GameEngine.startAutoQuestPath) {
            window.GameEngine.startAutoQuestPath(true);
          }
        }, 400);
      }
    }
    dialogueState.prevStepId = null;
  }

  var toastTimer = null;
  function showToast(message) {
    if (typeof document === 'undefined') return;
    var toast = document.getElementById('game-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');
    // CSS .toast để opacity 0 mặc định và chỉ hiện khi có class 'visible':
    // phải bật 'visible' thì người chơi mới THẤY thông báo (trước đây thiếu
    // dòng này nên mọi toast đều chạy ngầm mà không hiện — kể cả đổi quà).
    toast.classList.add('visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('visible');
      toast.classList.add('hidden');
    }, 2800);
  }

  var zoneTitleTimer = null;
  function showZoneTitle(name, desc) {
    var chip = document.getElementById('zone-title');
    var nameEl = document.getElementById('zone-title-name');
    var descEl = document.getElementById('zone-title-desc');
    if (!chip || !nameEl) return;

    nameEl.textContent = name || '';
    if (descEl) descEl.textContent = desc || '';

    chip.classList.remove('hidden');
    if (zoneTitleTimer) clearTimeout(zoneTitleTimer);
    zoneTitleTimer = setTimeout(function () {
      chip.classList.add('hidden');
    }, 3500);
  }

  function openZoneModal() {
    if (audioAPI) audioAPI.playClick();
    var modal = document.getElementById('zone-modal');
    var titleEl = document.getElementById('zone-modal-title');
    var listEl = document.getElementById('zone-modal-list');
    if (!modal) return;

    if (titleEl) {
      titleEl.textContent = 'BẢN ĐỒ TỔNG QUAN — CHẠM ĐỂ ĐI';
    }

    renderOverviewGrid();

    if (listEl) {
      listEl.innerHTML = '';
      var zones = (mapData && mapData.zones) ? mapData.zones : [];
      if (zones.length === 0) {
        listEl.innerHTML = '<div class="zone-item"><div class="zone-item-desc">Khu vực tự nhiên, không phân khu riêng biệt.</div></div>';
      } else {
        var currentZ = (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getCurrentZone) ? window.GameEngine.getCurrentZone() : null;
        for (var i = 0; i < zones.length; i++) {
          var z = zones[i];
          var isCur = currentZ ? (currentZ.id === z.id) : (player && z.rect && player.x >= z.rect.x && player.x <= z.rect.x + z.rect.w && player.y >= z.rect.y && player.y <= z.rect.y + z.rect.h);
          var itemDiv = document.createElement('div');
          itemDiv.className = 'zone-item' + (isCur ? ' active-zone' : '');
          var headerDiv = document.createElement('div');
          headerDiv.className = 'zone-item-header';
          var nameSpan = document.createElement('span');
          nameSpan.className = 'zone-item-name';
          nameSpan.textContent = z.name;
          headerDiv.appendChild(nameSpan);
          if (isCur) {
            var tagSpan = document.createElement('span');
            tagSpan.className = 'current-tag';
            tagSpan.textContent = 'Hiện tại';
            headerDiv.appendChild(tagSpan);
          }
          itemDiv.appendChild(headerDiv);
          var descDiv = document.createElement('div');
          descDiv.className = 'zone-item-desc';
          descDiv.textContent = z.desc || '';
          itemDiv.appendChild(descDiv);
          // Đợt 6 (mục 11): chạm vào khu -> tự tìm đường tới tâm khu
          (function (zone) {
            itemDiv.addEventListener('click', function () {
              closeZoneModal();
              if (zone.rect && typeof window !== 'undefined' && window.GameEngine && window.GameEngine.pathToPoint) {
                window.GameEngine.pathToPoint(zone.rect.x + zone.rect.w / 2, zone.rect.y + zone.rect.h / 2);
              }
            });
          })(z);
          listEl.appendChild(itemDiv);
        }
      }
    }

    modal.classList.remove('hidden');
  }

  function closeZoneModal() {
    if (audioAPI) audioAPI.playClick();
    var modal = document.getElementById('zone-modal');
    if (modal) modal.classList.add('hidden');
  }

  // Đợt 6 (mục 11): lưới 10 bản đồ trong bản đồ tổng quan — chạm để di chuyển qua mạng cổng/Đài Truyền Tống
  var OVERVIEW_MAP_IDS = ['mieu_hoang', 'rung-doc', 'tong-mon', 'dai-dien', 'dai-truyen-tong', 'son-coc', 'ho-bang', 'mo-lua', 'hoang-mac', 'kiem-trung'];

  function renderOverviewGrid() {
    var grid = document.getElementById('overview-map-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : null;
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    var rank = (st && st.getRealmRank && player) ? st.getRealmRank(player) : 0;
    var curId = mapData ? mapData.id : null;
    for (var i = 0; i < OVERVIEW_MAP_IDS.length; i++) {
      (function (mid) {
        var def = null;
        if (holder && holder.getMap) {
          def = holder.getMap(mid);
          if (!def && mid.indexOf('_') >= 0) def = holder.getMap(mid.replace('_', '-'));
          if (!def && mid.indexOf('-') >= 0) def = holder.getMap(mid.replace('-', '_'));
        }
        var realId = def ? def.id : mid;
        var isCurrent = curId === realId;
        var locked = !!(def && def.minRealmRank && rank < def.minRealmRank);
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'overview-map-card' + (isCurrent ? ' is-current' : '') + (locked ? ' is-locked' : '');
        var nameSpan = document.createElement('span');
        nameSpan.className = 'overview-map-name';
        nameSpan.textContent = def ? def.name : mid;
        card.appendChild(nameSpan);
        var subSpan = document.createElement('span');
        subSpan.className = 'overview-map-sub';
        subSpan.textContent = isCurrent ? 'Đang ở đây' : (locked ? ('Cần ' + (def.minRealmLabel || '')) : 'Chạm để đi');
        card.appendChild(subSpan);
        card.addEventListener('click', function () {
          if (isCurrent) { showToast('Bạn đang ở ' + (def ? def.name : mid)); return; }
          closeZoneModal();
          if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.travelToMap) {
            window.GameEngine.travelToMap(realId);
          }
        });
        grid.appendChild(card);
      })(OVERVIEW_MAP_IDS[i]);
    }
  }

  var TELEPORT_ZONE_BTNS = [
    { id: 'teleport-btn-hobang', mapId: 'ho-bang' },
    { id: 'teleport-btn-molua', mapId: 'mo-lua' },
    { id: 'teleport-btn-hoangmac', mapId: 'hoang-mac' },
    { id: 'teleport-btn-kiemtrung', mapId: 'kiem-trung' }
  ];

  function refreshTeleportLocks() {
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    var md = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : null;
    if (!st || !st.getRealmRank || !player || !md || !md.getMap) return;
    var rank = st.getRealmRank(player);
    for (var i = 0; i < TELEPORT_ZONE_BTNS.length; i++) {
      var z = TELEPORT_ZONE_BTNS[i];
      var btn = document.getElementById(z.id);
      var map = md.getMap(z.mapId);
      if (!btn || !map) continue;
      if (!btn.dataset.baseLabel) btn.dataset.baseLabel = btn.textContent;
      var locked = !!(map.minRealmRank && rank < map.minRealmRank);
      btn.classList.toggle('teleport-locked', locked);
      btn.textContent = locked ? (btn.dataset.baseLabel + ' — cần ' + (map.minRealmLabel || '')) : btn.dataset.baseLabel;
    }
  }

  function openTeleportModal() {
    if (audioAPI) audioAPI.playClick();
    var modal = document.getElementById('teleport-modal');
    if (modal) modal.classList.remove('hidden');
    refreshTeleportLocks();
  }

  function closeTeleportModal() {
    if (audioAPI) audioAPI.playClick();
    var modal = document.getElementById('teleport-modal');
    if (modal) modal.classList.add('hidden');
  }

  // Đồng bộ nút hành động theo ngữ cảnh (engine gọi khi ngữ cảnh đổi)
  var lastActionMode = '';
  function setActionMode(mode, label) {
    if (mode === lastActionMode) return;
    lastActionMode = mode;
    var btn = document.getElementById('btn-action');
    if (!btn) return;
    btn.classList.remove('action-mode-attack', 'action-mode-talk', 'action-mode-pickup', 'action-mode-interact');
    btn.classList.add('action-mode-' + mode);
    var labelEl = document.getElementById('action-label');
    if (labelEl) labelEl.textContent = label || 'Đánh';
    btn.setAttribute('aria-label', label || 'Đánh');
  }

  // Đồng bộ nút tự tìm đường: ẩn khi không có mục tiêu nhiệm vụ; đang đi thì hiện trạng thái Dừng
  var lastAutoBtnState = '';
  function syncAutoPathButton() {
    var btn = document.getElementById('btn-auto-path');
    if (!btn || !player) return;
    var q = player.quests || {};
    var sectStage = (q.sectStage !== undefined) ? q.sectStage : 0;
    // Đợt 6: chuỗi chính + bước dự phòng luôn có mục tiêu — nút chỉ ẩn khi engine báo không còn mục tiêu nào
    var hasTarget = !q.talked_linhnhi || !q.huntCompleted || sectStage < 4 || (q.mainStage || 0) >= 1;
    if (!hasTarget && typeof window !== 'undefined' && window.GameEngine && window.GameEngine.hasQuestTarget) {
      hasTarget = window.GameEngine.hasQuestTarget();
    }
    var active = !!(typeof window !== 'undefined' && window.GameEngine && window.GameEngine.isAutoPathActive && window.GameEngine.isAutoPathActive());
    var stateKey = (hasTarget ? '1' : '0') + (active ? '1' : '0');
    if (stateKey === lastAutoBtnState) return;
    lastAutoBtnState = stateKey;
    if (!hasTarget && !active) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    btn.textContent = active ? 'Đang đi… — Dừng' : 'Tự Tìm Đường';
    btn.classList.toggle('auto-walking', active);
  }

  /**
   * Đẩy bộ cài đặt âm thanh xuống cả ba hệ: GameAudio (SFX + nhạc cũ),
   * GameMusic (nhạc theo map + môi trường, Đợt 3) và GameVoice (lồng tiếng, Đợt 3).
   */
  function applyAudioSettings(s) {
    if (!s) return;
    var muted = !!s.muted;
    if (audioAPI) {
      audioAPI.setMusicVolume(muted ? 0 : s.musicVol);
      audioAPI.setSfxVolume(muted ? 0 : s.sfxVol);
    }
    if (typeof window !== 'undefined' && window.GameMusic) {
      window.GameMusic.setMusicVolume(s.musicVol);
      window.GameMusic.setAmbienceVolume(s.ambVol != null ? s.ambVol : 0.6);
      window.GameMusic.setMuted(muted);
    }
    if (typeof window !== 'undefined' && window.GameVoice) {
      window.GameVoice.setVolume(s.voiceVol != null ? s.voiceVol : 0.9);
      window.GameVoice.setEnabled(s.voiceEnabled !== false);
      window.GameVoice.setMuted(muted);
    }
  }

  // ---------- HIỂN THỊ (Đợt 3, Note 8) ----------
  var JOY_SCALES = { nho: 0.85, vua: 1, lon: 1.2 };

  function clampUiScale(v) {
    var n = Number(v);
    if (!isFinite(n)) return 1;
    return Math.min(1.2, Math.max(0.85, n));
  }

  /**
   * Đẩy cài đặt hiển thị xuống thật: biến CSS --ui-scale (cỡ HUD) và
   * --ctl-scale (cỡ cụm nút chạm) trên :root + cờ chất lượng cho engine.
   */
  function applyDisplaySettings(s) {
    if (!s || typeof document === 'undefined') return;
    var root = document.documentElement;
    if (root && root.style) {
      root.style.setProperty('--ui-scale', String(clampUiScale(s.uiScale)));
      root.style.setProperty('--ctl-scale', String(JOY_SCALES[s.joySize] || 1));
    }
    if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.setQuality) {
      window.GameEngine.setQuality(s.quality || 'cao');
    }
    updateFullscreenButton();
  }

  function updateFullscreenButton() {
    var btn = typeof document !== 'undefined' ? document.getElementById('btn-fullscreen-toggle') : null;
    if (!btn) return;
    btn.textContent = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Bật toàn màn hình';
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (document.documentElement && document.documentElement.requestFullscreen) {
        var p = document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) { /* Trình duyệt chặn (thiếu cử chỉ người dùng) — bỏ qua lặng lẽ */ }
  }

  function wireDisplayControls() {
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    if (!st) return;
    stateAPI = st;

    var slider = document.getElementById('setting-ui-scale');
    if (slider && !slider.dataset.wired) {
      slider.dataset.wired = '1';
      slider.addEventListener('input', function () {
        var merged = st.saveSettings({ uiScale: clampUiScale(Number(slider.value) / 100) });
        var valEl = document.getElementById('setting-ui-scale-val');
        if (valEl) valEl.textContent = slider.value + '%';
        applyDisplaySettings(merged);
      });
    }

    var bindSelect = function (id, key) {
      var el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('change', function () {
        var patch = {};
        patch[key] = el.value;
        applyDisplaySettings(st.saveSettings(patch));
      });
    };
    bindSelect('setting-joy-size', 'joySize');
    bindSelect('setting-quality', 'quality');

    var fsBtn = document.getElementById('btn-fullscreen-toggle');
    if (fsBtn && !fsBtn.dataset.wired) {
      fsBtn.dataset.wired = '1';
      fsBtn.addEventListener('click', toggleFullscreen);
    }
    if (!document.dataset || !document.dataset.fsWired) {
      if (document.dataset) document.dataset.fsWired = '1';
      document.addEventListener('fullscreenchange', updateFullscreenButton);
    }
  }

  function refreshDisplayControls() {
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    if (!st) return;
    var s = st.loadSettings();
    var slider = document.getElementById('setting-ui-scale');
    if (slider) slider.value = Math.round(clampUiScale(s.uiScale) * 100);
    var valEl = document.getElementById('setting-ui-scale-val');
    if (valEl) valEl.textContent = Math.round(clampUiScale(s.uiScale) * 100) + '%';
    var joy = document.getElementById('setting-joy-size');
    if (joy) joy.value = JOY_SCALES[s.joySize] ? s.joySize : 'vua';
    var qual = document.getElementById('setting-quality');
    if (qual) qual.value = (s.quality === 'thap' || s.quality === 'trung' || s.quality === 'cao') ? s.quality : 'cao';
    updateFullscreenButton();
  }

  function refreshSettingsControls() {
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    if (!st) return;
    var s = st.loadSettings();
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.value = Math.round(v * 100); };
    var setChk = function (id, on) { var el = document.getElementById(id); if (el) el.checked = !!on; };
    set('setting-music-vol', s.musicVol);
    set('setting-sfx-vol', s.sfxVol);
    set('setting-amb-vol', s.ambVol != null ? s.ambVol : 0.6);
    set('setting-voice-vol', s.voiceVol != null ? s.voiceVol : 0.9);
    setChk('setting-voice-toggle', s.voiceEnabled !== false);
    setChk('setting-mute-toggle', !!s.muted);
    setChk('setting-arrow-toggle', s.arrowGuidance !== false);
    setChk('setting-flourish-toggle', s.flourishEffects !== false);
    // Đợt 6 (mục 15): các hàng bổ sung phải khôi phục đúng giá trị đã lưu
    setChk('setting-shake-toggle', s.screenShake !== false);
    setChk('setting-damage-toggle', s.showDamageNumbers !== false);
    setChk('setting-autopickup-toggle', !!s.autoPickup);
    var joyModeEl = document.getElementById('setting-joy-mode');
    if (joyModeEl) joyModeEl.value = (s.joystickMode === 'linh_hoat') ? 'linh_hoat' : 'co_dinh';
    var zoomValEl = document.getElementById('setting-zoom-val');
    if (zoomValEl) zoomValEl.textContent = Math.round(((typeof s.zoom === 'number') ? s.zoom : 1) * 100) + '%';
    // Đợt 6 (mục 15): khôi phục trạng thái các điều khiển bổ sung
    var setRange = function (id, valId, val, suffix) {
      var el = document.getElementById(id);
      if (el) el.value = String(Math.round(val * 100));
      var v = document.getElementById(valId);
      if (v) v.textContent = Math.round(val * 100) + suffix;
    };
    setRange('setting-opacity', 'setting-opacity-val', (typeof s.ctlOpacity === 'number') ? s.ctlOpacity : 1, '%');
    setRange('setting-brightness', 'setting-brightness-val', (typeof s.brightness === 'number') ? s.brightness : 1, '%');
    setRange('setting-joy-deadzone', 'setting-joy-deadzone-val', (typeof s.joyDeadzone === 'number') ? s.joyDeadzone : 0.15, '%');
    setChk('setting-hide-hat', !!s.hideHat);
    setChk('setting-lefty', !!s.lefty);
    setChk('setting-clock-toggle', !!s.showClock);
    setChk('setting-duck-toggle', s.duckMusic !== false);
    setChk('setting-idle-mute', !!s.idleMute);
    setChk('setting-telegraph-toggle', s.showBossTelegraph !== false);
    setChk('setting-monster-hp-toggle', !!s.showMonsterHpText);
    setChk('setting-ring-toggle', !!s.showAggroRing);
    setChk('setting-dest-dot-toggle', s.minimapDestDot !== false);
    var dlgSel = document.getElementById('setting-dialog-size');
    if (dlgSel) dlgSel.value = s.dialogTextSize || 'vua';
    var rankSel = document.getElementById('setting-autopickup-rank');
    if (rankSel) rankSel.value = String(s.autoPickupRank || 1);
    var fpsSel = document.getElementById('setting-fps');
    if (fpsSel) fpsSel.value = String(s.fpsLimit || 60);
    var camSel2 = document.getElementById('setting-camera-dist');
    if (camSel2) {
      var zv = (typeof s.zoom === 'number') ? s.zoom : 1;
      camSel2.value = zv >= 1.15 ? 'gan' : (zv <= 0.9 ? 'xa' : 'vua');
    }
    refreshDisplayControls();
  }

  function wireSettingsControls() {
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : null);
    if (!st) return;
    stateAPI = st;
    var bind = function (id, key, isToggle) {
      var el = document.getElementById(id);
      if (!el || el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('input', function () {
        var patch = {};
        patch[key] = isToggle ? el.checked : (Number(el.value) / 100);
        var merged = st.saveSettings(patch);
        applyAudioSettings(merged);
      });
    };
    bind('setting-music-vol', 'musicVol', false);
    bind('setting-sfx-vol', 'sfxVol', false);
    bind('setting-amb-vol', 'ambVol', false);
    bind('setting-voice-vol', 'voiceVol', false);
    bind('setting-voice-toggle', 'voiceEnabled', true);
    bind('setting-mute-toggle', 'muted', true);
    bind('setting-arrow-toggle', 'arrowGuidance', true);
    bind('setting-flourish-toggle', 'flourishEffects', true);
    // Đợt 6 (mục 15): rung màn hình / số sát thương / tự nhặt đồ — engine đọc trực tiếp các khóa này mỗi khung hình
    bind('setting-shake-toggle', 'screenShake', true);
    bind('setting-damage-toggle', 'showDamageNumbers', true);
    bind('setting-autopickup-toggle', 'autoPickup', true);
    var joyModeEl = document.getElementById('setting-joy-mode');
    if (joyModeEl && !joyModeEl.dataset.wired) {
      joyModeEl.dataset.wired = '1';
      joyModeEl.addEventListener('change', function () {
        st.saveSettings({ joystickMode: joyModeEl.value });
        showToast(joyModeEl.value === 'linh_hoat' ? 'Cần gậy: Linh hoạt (hiện tại điểm chạm)' : 'Cần gậy: Cố định');
      });
    }
    wireDisplayControls();
  }

  function openSettingsModal() {
    var modal = document.getElementById('settings-modal');
    if (!modal) return;
    wireSettingsControls();
    refreshSettingsControls();
    modal.classList.remove('hidden');
    // Ở màn hình bắt đầu, initUI chưa chạy nên nút đóng chưa có sự kiện: gắn tại đây (một lần duy nhất)
    var closeBtn = document.getElementById('close-settings');
    if (closeBtn && !closeBtn.dataset.closeWired) {
      closeBtn.dataset.closeWired = '1';
      closeBtn.addEventListener('click', function () {
        modal.classList.add('hidden');
      });
    }
  }


  // ================= ĐỢT N2: BẢNG LINH THÚ =================
  var selectedLinhThuPetId = null;
  var lastPetBtnRefreshMs = 0;
  var lastTameBtnState = null;
  var lastHarmonyBtnState = null;
  var LT_ELEM_NAMES = { moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', kim: 'Kim' };

  function getLinhThuApi() {
    return (typeof window !== 'undefined') ? window.GameLinhThu : null;
  }

  function ltEl(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
  }

  function ltActionBtn(label, fn, disabled) {
    var b = ltEl('button', 'btn wood lt-btn', label);
    b.type = 'button';
    if (disabled) b.disabled = true;
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    return b;
  }

  function ltSaveAndRerender() {
    if (stateAPI) stateAPI.savePlayer(player);
    renderLinhThuPanel();
    refreshHUD();
  }

  function fmtRemain(ms) {
    if (ms <= 0) return 'xong';
    var s = Math.ceil(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var ss = s % 60;
    if (h > 0) return h + ' giờ ' + m + ' phút';
    if (m > 0) return m + ' phút ' + ss + ' giây';
    return ss + ' giây';
  }

  function openLinhThu() {
    var lt = getLinhThuApi();
    if (!lt || !player) return;
    lt.ensureState(player);
    renderLinhThuPanel();
    var modal = document.getElementById('linh-thu-modal');
    if (modal) modal.classList.remove('hidden');
    if (audioAPI) audioAPI.playClick();
  }

  function closeLinhThu() {
    var modal = document.getElementById('linh-thu-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openSaddlebag() {
    var lt = getLinhThuApi();
    if (!lt || !player) return;
    var pet = lt.getMainPet(player);
    var check = lt.canOpenSaddlebag(player, pet);
    if (!check.ok) { showToast(check.reason); return; }
    var c = lt.ensureSaddlebag(player, pet);
    if (!c) { showToast('Không mở được túi yên lúc này.'); return; }
    selectedBagContainerId = c.id;
    closeLinhThu();
    openBagModal();
  }

  function renderLinhThuPanel() {
    var lt = getLinhThuApi();
    if (!lt || !player) return;
    var s = lt.ensureState(player);
    var body = document.getElementById('linh-thu-body');
    if (!body) return;
    body.innerHTML = '';
    var defs = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS : {};
    var now = Date.now();

    body.appendChild(ltEl('div', 'lt-section-title', 'THÚ ĐI CÙNG (' + s.companions.length + ')'));
    if (!s.companions.length) {
      body.appendChild(ltEl('div', 'lt-empty', 'Chưa có linh thú. Đánh quái tới ≤20% máu rồi dùng nút Thuần Phục, hoặc ấp trứng. Gặp Tuần Thú Sư ở tông môn để nhận Linh Thú Hoàn đầu tiên.'));
    }
    for (var i = 0; i < s.companions.length; i++) {
      (function (pet) {
        var spec = lt.species(pet.speciesId) || { name: pet.speciesId, element: 'moc' };
        var row = ltEl('div', 'lt-pet-row' + (selectedLinhThuPetId === pet.id ? ' selected' : ''));
        var down = lt.isDown(pet, now);
        row.appendChild(ltEl('div', 'lt-pet-head',
          (s.mainId === pet.id ? '★ ' : '') + spec.name + ' · ' + (LT_ELEM_NAMES[spec.element] || spec.element) +
          ' · ' + pet.stage + ' · Cấp ' + pet.level + ' · ' + pet.quality +
          (down ? ' · Dưỡng thương ' + fmtRemain(pet.downUntil - now) : '')));
        row.appendChild(ltEl('div', 'lt-pet-sub',
          'Máu ' + Math.ceil(pet.hp) + '/' + pet.hpMax + ' · Công ' + (pet.attack || 0) +
          ' · Hảo cảm ' + Math.floor(pet.affection || 0) + '/100' +
          (s.houseGuardPetId === pet.id ? ' · Đang giữ ruộng' : '') +
          (s.isRiding && s.ridingPetId === pet.id ? ' · Đang cưỡi' : '')));
        var barWrap = ltEl('div', 'lt-aff-bar');
        var barFill = ltEl('div', 'lt-aff-fill');
        barFill.style.width = Math.max(0, Math.min(100, pet.affection || 0)) + '%';
        barWrap.appendChild(barFill);
        row.appendChild(barWrap);
        row.addEventListener('click', function () {
          selectedLinhThuPetId = pet.id;
          renderLinhThuPanel();
        });
        body.appendChild(row);
      })(s.companions[i]);
    }

    var sel = null;
    for (var si = 0; si < s.companions.length; si++) if (s.companions[si].id === selectedLinhThuPetId) sel = s.companions[si];
    if (!sel && s.companions.length) sel = s.companions[0];
    if (sel) {
      selectedLinhThuPetId = sel.id;
      var spec2 = lt.species(sel.speciesId) || { name: sel.speciesId, element: 'moc', skills: [] };
      body.appendChild(ltEl('div', 'lt-section-title', 'CHI TIẾT: ' + spec2.name.toUpperCase()));
      var detail = ltEl('div', 'lt-detail');
      detail.appendChild(ltEl('div', 'lt-line', 'Hệ: ' + (LT_ELEM_NAMES[spec2.element] || spec2.element) + ' · Sở trường: ' + (spec2.work || '') + ' · Kinh nghiệm: ' + (sel.exp || 0) + '/' + (sel.level * 10)));
      var allSkills = spec2.skills || [];
      var skillLine = 'Chiêu: ';
      for (var k = 0; k < allSkills.length; k++) {
        skillLine += (k > 0 ? ', ' : '') + allSkills[k] + ((sel.skills || []).indexOf(allSkills[k]) >= 0 ? '' : ' (khóa)');
      }
      detail.appendChild(ltEl('div', 'lt-line', skillLine));
      detail.appendChild(ltEl('div', 'lt-line', 'Hợp kích: ' + (lt.canHarmony(sel) ? 'SẴN SÀNG (hảo cảm ≥60)' : 'chưa mở (cần hảo cảm 60, đang ' + Math.floor(sel.affection || 0) + ')')));
      body.appendChild(detail);

      var btnRow = ltEl('div', 'lt-btn-row');
      var downSel = lt.isDown(sel, now);
      btnRow.appendChild(ltActionBtn(s.mainId === sel.id ? 'Đang là thú chính' : 'Chọn làm thú chính', function () {
        if (s.isRiding && s.ridingPetId !== sel.id) lt.dismount(s);
        if (lt.setMain(s, sel.id)) showToast('Đã chọn ' + spec2.name + ' làm thú chính.');
        else showToast('Không chọn được (thú đang dưỡng thương).');
        ltSaveAndRerender();
      }, s.mainId === sel.id || downSel));
      var baitId = lt.BAIT_MAP[spec2.element];
      var baitDef = defs[baitId];
      btnRow.appendChild(ltActionBtn('Cho ăn (+5 hảo cảm, tốn 1 ' + (baitDef ? baitDef.name : baitId) + ')', function () {
        if (!stateAPI || stateAPI.countItemInBag(player, baitId) < 1) { showToast('Thiếu ' + (baitDef ? baitDef.name : baitId) + ' để cho ăn.'); return; }
        stateAPI.removeItemFromBag(player, baitId, 1);
        lt.feedPet(sel);
        showToast(spec2.name + ' rất thích! Hảo cảm +' + lt.CONSTANTS.AFFECTION_PER_FEED + '.');
        ltSaveAndRerender();
      }, downSel));
      btnRow.appendChild(ltActionBtn(s.houseGuardPetId === sel.id ? 'Bỏ giữ ruộng' : 'Gán giữ ruộng', function () {
        if (s.houseGuardPetId === sel.id) lt.setGuard(s, null);
        else if (lt.setGuard(s, sel.id, Date.now())) showToast(spec2.name + ' sẽ ở nhà giữ ruộng.');
        else showToast('Không gán được (thú đang dưỡng thương).');
        ltSaveAndRerender();
      }, downSel));
      if (s.isRiding && s.ridingPetId === sel.id) {
        btnRow.appendChild(ltActionBtn('Xuống thú', function () { lt.dismount(s); showToast('Đã xuống thú.'); ltSaveAndRerender(); }));
      } else {
        btnRow.appendChild(ltActionBtn('Cưỡi (cần rank 7+, thú chính)', function () {
          var rank = (stateAPI && stateAPI.getRealmRank) ? stateAPI.getRealmRank(player) : 1;
          if (lt.mount(s, sel.id, rank)) showToast('Đã cưỡi ' + spec2.name + ' — tốc độ tăng ngoài trận.');
          else showToast('Chưa cưỡi được: cần là thú chính, rank 7+ và thú khỏe.');
          ltSaveAndRerender();
        }, s.mainId !== sel.id || downSel));
      }
      if (downSel) {
        btnRow.appendChild(ltActionBtn('Hồi phục bằng Đan Thú', function () {
          if (!stateAPI || stateAPI.countItemInBag(player, 'dan-thu') < 1) { showToast('Thiếu Đan Thú (đổi ở Tuần Thú Sư hoặc rơi từ tinh anh).'); return; }
          stateAPI.removeItemFromBag(player, 'dan-thu', 1);
          lt.recover(sel, Date.now(), 'dan-thu');
          showToast(spec2.name + ' đã hồi phục!');
          ltSaveAndRerender();
        }));
      }
      btnRow.appendChild(ltActionBtn('Cho vào chuồng', function () {
        lt.sendToBarn(s, sel.id);
        selectedLinhThuPetId = null;
        showToast(spec2.name + ' đã vào chuồng.');
        ltSaveAndRerender();
      }));
      btnRow.appendChild(ltActionBtn('Mở Túi Yên', function () { openSaddlebag(); }, !sel.gear || !sel.gear.saddle || s.mainId !== sel.id));
      body.appendChild(btnRow);

      body.appendChild(ltEl('div', 'lt-section-title', 'ĐỒ THÚ'));
      var gearRow = ltEl('div', 'lt-btn-row');
      var gearSlots = [
        { slot: 'saddle', label: 'Yên', itemId: 'yen-linh-thu', note: 'túi yên 12 ô' },
        { slot: 'collar', label: 'Chuông', itemId: 'chuong-linh-thu', note: '+10% sức chiêu' },
        { slot: 'armor', label: 'Giáp', itemId: 'giap-linh-thu', note: '+5 đỡ đòn, +20 máu' }
      ];
      for (var gi = 0; gi < gearSlots.length; gi++) {
        (function (gs) {
          var equipped = sel.gear && sel.gear[gs.slot];
          var gDef = defs[gs.itemId];
          var wrap = ltEl('div', 'lt-gear-slot');
          wrap.appendChild(ltEl('span', 'lt-gear-label', gs.label + ': ' + (equipped ? (gDef ? gDef.name : gs.itemId) + ' (' + gs.note + ')' : 'trống')));
          if (equipped) {
            wrap.appendChild(ltActionBtn('Tháo', function () {
              var prev = lt.unequipPetGear(sel, gs.slot);
              if (prev && stateAPI) stateAPI.addItemToBag(player, prev, 1);
              ltSaveAndRerender();
            }));
          } else {
            wrap.appendChild(ltActionBtn('Mặc (' + (gDef ? gDef.name : gs.itemId) + ')', function () {
              if (!stateAPI || stateAPI.countItemInBag(player, gs.itemId) < 1) { showToast('Trong túi không có ' + (gDef ? gDef.name : gs.itemId) + ' (đổi ở Tuần Thú Sư hoặc rơi từ boss).'); return; }
              stateAPI.removeItemFromBag(player, gs.itemId, 1);
              var prev2 = lt.equipPetGear(sel, gs.slot, gs.itemId);
              if (prev2) stateAPI.addItemToBag(player, prev2, 1);
              ltSaveAndRerender();
            }));
          }
          gearRow.appendChild(wrap);
        })(gearSlots[gi]);
      }
      body.appendChild(gearRow);
    }

    body.appendChild(ltEl('div', 'lt-section-title', 'TRỨNG ĐANG ẤP (' + s.eggs.length + ')'));
    if (!s.eggs.length) body.appendChild(ltEl('div', 'lt-empty', 'Chưa có trứng nào đang ấp.'));
    for (var ei = 0; ei < s.eggs.length; ei++) {
      (function (egg) {
        var eggSpec = lt.species(egg.speciesId) || { name: egg.speciesId };
        var remain = egg.hatchAt - now;
        var row = ltEl('div', 'lt-egg-row');
        row.appendChild(ltEl('div', 'lt-line', 'Trứng ' + (LT_ELEM_NAMES[egg.element] || egg.element) + ' → ' + eggSpec.name + ' · Chăm: ' + (egg.cares || 0) + '/3' + (remain > 0 ? ' · Còn ' + fmtRemain(remain) : ' · ĐÃ ĐỦ GIỜ')));
        var er = ltEl('div', 'lt-btn-row');
        er.appendChild(ltActionBtn('Chăm (+1, tốn 5 Linh Lực)', function () {
          var r = lt.careEgg(s, egg.id, player);
          showToast(r.ok ? 'Đã chăm trứng (' + r.cares + '/3). Chăm đủ 3 lần nở phẩm hiếm.' : r.reason);
          ltSaveAndRerender();
        }, (egg.cares || 0) >= 3));
        er.appendChild(ltActionBtn('Nở', function () {
          var r2 = lt.hatch(s, egg, Date.now());
          if (r2.ok) { selectedLinhThuPetId = r2.pet.id; showToast('Trứng đã nở! ' + eggSpec.name + ' (' + r2.pet.quality + ') đã vào danh sách.'); }
          else showToast(r2.reason);
          ltSaveAndRerender();
        }, remain > 0));
        row.appendChild(er);
        body.appendChild(row);
      })(s.eggs[ei]);
    }

    var bagEggs = [];
    var eggIds = Object.keys(lt.EGG_MAP);
    for (var bi = 0; bi < eggIds.length; bi++) {
      var cnt = stateAPI ? stateAPI.countItemInBag(player, eggIds[bi]) : 0;
      if (cnt > 0) bagEggs.push({ id: eggIds[bi], count: cnt });
    }
    if (bagEggs.length) {
      body.appendChild(ltEl('div', 'lt-section-title', 'TRỨNG TRONG TÚI'));
      for (var bj = 0; bj < bagEggs.length; bj++) {
        (function (be) {
          var ed = defs[be.id];
          var row = ltEl('div', 'lt-egg-row');
          row.appendChild(ltEl('div', 'lt-line', (ed ? ed.name : be.id) + ' ×' + be.count));
          row.appendChild(ltActionBtn('Ấp (30 phút)', function () {
            stateAPI.removeItemFromBag(player, be.id, 1);
            lt.startIncubation(s, be.id, Date.now());
            showToast('Đã bắt đầu ấp ' + (ed ? ed.name : be.id) + '.');
            ltSaveAndRerender();
          }));
          body.appendChild(row);
        })(bagEggs[bj]);
      }
    }

    body.appendChild(ltEl('div', 'lt-section-title', 'CHUỒNG (' + s.barn.length + ')'));
    if (!s.barn.length) body.appendChild(ltEl('div', 'lt-empty', 'Chuồng trống. Thú gục sẽ về đây dưỡng thương.'));
    for (var ci = 0; ci < s.barn.length; ci++) {
      (function (pet) {
        var spec = lt.species(pet.speciesId) || { name: pet.speciesId };
        var down = lt.isDown(pet, now);
        var row = ltEl('div', 'lt-pet-row');
        row.appendChild(ltEl('div', 'lt-pet-head', spec.name + ' · ' + pet.stage + ' · Cấp ' + pet.level + (down ? ' · Dưỡng thương ' + fmtRemain(pet.downUntil - now) : ' · Khỏe')));
        var br = ltEl('div', 'lt-btn-row');
        br.appendChild(ltActionBtn('Đón về', function () {
          var r = lt.recallFromBarn(s, pet.id, Date.now());
          showToast(r.ok ? spec.name + ' đã về đội.' : r.reason);
          ltSaveAndRerender();
        }, down));
        if (down) {
          br.appendChild(ltActionBtn('Hồi phục bằng Đan Thú', function () {
            if (!stateAPI || stateAPI.countItemInBag(player, 'dan-thu') < 1) { showToast('Thiếu Đan Thú.'); return; }
            stateAPI.removeItemFromBag(player, 'dan-thu', 1);
            lt.recover(pet, Date.now(), 'dan-thu');
            showToast(spec.name + ' đã hồi phục!');
            ltSaveAndRerender();
          }));
        }
        row.appendChild(br);
        body.appendChild(row);
      })(s.barn[ci]);
    }

    body.appendChild(ltEl('div', 'lt-section-title', 'THU THẬP KHI VẮNG'));
    var gathered = (s.gathered && s.gathered.items) || [];
    if (!gathered.length) {
      body.appendChild(ltEl('div', 'lt-empty', 'Chưa có gì. Thú ở nhà (trong chuồng hoặc giữ ruộng) gom nguyên liệu theo thời gian vắng, tối đa 20 món/ngày.'));
    } else {
      for (var gi2 = 0; gi2 < gathered.length; gi2++) {
        var gd = defs[gathered[gi2].itemId];
        body.appendChild(ltEl('div', 'lt-line', (gd ? gd.name : gathered[gi2].itemId) + ' ×' + gathered[gi2].count));
      }
      body.appendChild(ltActionBtn('Nhận hết', function () {
        var items = lt.claimGathered(s);
        for (var qi = 0; qi < items.length; qi++) if (stateAPI) stateAPI.addItemToBag(player, items[qi].itemId, items[qi].count);
        showToast('Đã nhận ' + items.length + ' loại vật phẩm thú gom được.');
        ltSaveAndRerender();
      }));
    }
  }

  // Làm tươi trạng thái nút Thuần Phục/Hợp Kích (giới hạn 4 lần/giây để
  // khỏi quét túi mỗi khung hình).
  function refreshPetCombatButtons() {
    if (typeof document === 'undefined') return;
    var nowMs = Date.now();
    if (nowMs - lastPetBtnRefreshMs < 250) return;
    lastPetBtnRefreshMs = nowMs;
    var eng = (typeof window !== 'undefined') ? window.GameEngine : null;
    if (!eng) return;
    var tameBtn = document.getElementById('btn-thuan-phuc');
    if (tameBtn && eng.getTameState) {
      var ts = eng.getTameState();
      var key = ts.available ? '1' : '0:' + ts.reason;
      if (key !== lastTameBtnState) {
        lastTameBtnState = key;
        tameBtn.disabled = !ts.available;
        tameBtn.title = ts.available ? ('Thuần phục (tỉ lệ ' + Math.round((ts.chance || 0) * 100) + '%)') : ts.reason;
      }
    }
    var harmBtn = document.getElementById('btn-hop-kich');
    if (harmBtn && eng.getHarmonyState) {
      var hs = eng.getHarmonyState();
      var hkey = hs.ready ? '1' : '0:' + hs.reason;
      if (hkey !== lastHarmonyBtnState) {
        lastHarmonyBtnState = hkey;
        harmBtn.disabled = !hs.ready;
        harmBtn.title = hs.ready ? 'Hợp kích' : hs.reason;
      }
    }
  }

  var UIAPI = {
    init: initUI,
    update: update,
    refreshHUD: refreshHUD,
    openDialogue: openDialogue,
    closeDialogue: closeDialogue,
    showToast: showToast,
    showZoneTitle: showZoneTitle,
    openZoneModal: openZoneModal,
    closeZoneModal: closeZoneModal,
    openTeleportModal: openTeleportModal,
    closeTeleportModal: closeTeleportModal,
    triggerSkillShake: triggerSkillShake,
    showDeathModal: showDeathModal,
    hideDeathModal: hideDeathModal,
    showSessionSummary: showSessionSummary,
    openSettingsModal: openSettingsModal,
    applyDisplaySettings: applyDisplaySettings,
    setActionMode: setActionMode
  };
  UIAPI.openLinhThu = openLinhThu;
  UIAPI.closeLinhThu = closeLinhThu;
  UIAPI.openSaddlebag = openSaddlebag;
  UIAPI.renderLinhThuPanel = renderLinhThuPanel;
  // Đợt LINHME: Vườn Linh Mễ, Đổi Thức Ăn, Việc Vụ Tông
  UIAPI.openTongMonFarmModal = openTongMonFarmModal;
  UIAPI.closeTongMonFarmModal = closeTongMonFarmModal;
  UIAPI.openFoodExchangeModal = openFoodExchangeModal;
  UIAPI.closeFoodExchangeModal = closeFoodExchangeModal;
  UIAPI.openSectQuestModal = openSectQuestModal;
  UIAPI.closeSectQuestModal = closeSectQuestModal;
  // Đợt LINHME-MAP: Kỹ năng ruộng & thỉnh giáo
  UIAPI.updateFarmSkillBar = updateFarmSkillBar;
  UIAPI.openFarmSpellLearnModal = openFarmSpellLearnModal;
  UIAPI.closeFarmSpellLearnModal = closeFarmSpellLearnModal;
  UIAPI.sortBag = sortBag;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameUI = UIAPI;
  }
})(typeof window !== 'undefined' ? window : this);
