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

    if (typeof document === 'undefined') return;

    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
      minimapCtx = minimapCanvas.getContext('2d');
      updateMinimapBackground();
    }

    bindEvents();
    renderRingWidget();
    refreshHUD();
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
  }

  // ---------- ĐỢT 6 (mục 15): CÁC ĐIỀU KHIỂN CÀI ĐẶT BỔ SUNG ----------
  var GIFTCODES = {
    'NGUHANH2026': { linhThach: 50, msg: 'Mã quà tặng: nhận 50 Linh Thạch!' },
    'TANTHU': { itemId: 'dan-moc', count: 2, msg: 'Mã quà tặng: nhận 2 Đan Mộc!' }
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

  function sortBag() {
    if (!player || !player.bag) return;
    var defs = itemDefs();
    var rank = { legend: 5, epic: 4, rare: 3, good: 2, common: 1 };
    // Gộp chồng cùng loại trước
    var merged = {};
    var order = [];
    for (var i = 0; i < player.bag.slots.length; i++) {
      var sd = player.bag.slots[i];
      if (!sd || !sd.itemId) continue;
      if (merged[sd.itemId]) merged[sd.itemId].count += (sd.count || 1);
      else { merged[sd.itemId] = { itemId: sd.itemId, count: sd.count || 1 }; order.push(sd.itemId); }
    }
    var arr = order.map(function (id) { return merged[id]; });
    arr.sort(function (a, b) {
      var da = defs[a.itemId] || {};
      var db = defs[b.itemId] || {};
      var ra = rank[da.quality] || 0;
      var rb = rank[db.quality] || 0;
      if (rb !== ra) return rb - ra;
      return String(da.type || '').localeCompare(String(db.type || ''));
    });
    for (var j = 0; j < player.bag.slots.length; j++) {
      player.bag.slots[j] = arr[j] || null;
    }
    player.bagLocks = {};
    selectedBagSlot = null;
    if (stateAPI) stateAPI.savePlayer(player);
    renderBagGrid();
    showToast('Đã sắp xếp túi đồ');
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
    renderBagGrid();
    bagModal.classList.remove('hidden');
  }

  function closeBagModal() {
    if (audioAPI) audioAPI.playClick();
    var bagModal = document.getElementById('bag-modal');
    if (bagModal) bagModal.classList.add('hidden');
  }

  function renderBagGrid() {
    var gridEl = document.getElementById('bag-grid');
    var ltVal = document.getElementById('bag-linh-thach-val');
    if (ltVal && player) {
      ltVal.textContent = player.linhThach || 0;
    }
    if (!gridEl || !player) return;

    if (!player.bag) player.bag = { slots: new Array(48).fill(null) };
    while (player.bag.slots.length < 48) player.bag.slots.push(null);

    gridEl.innerHTML = '';
    var defs = monstersAPI ? monstersAPI.ITEM_DEFS : {};

    for (var i = 0; i < player.bag.slots.length; i++) {
      (function (slotIndex) {
        var slotData = player.bag.slots[slotIndex];
        var slotDiv = document.createElement('div');
        slotDiv.className = 'bag-slot';
        if (selectedBagSlot === slotIndex) slotDiv.classList.add('selected');

        if (slotData && slotData.itemId) {
          var def = defs[slotData.itemId] || { name: slotData.itemId, iconCol: 0, iconRow: 0 };
          var iconDiv = document.createElement('div');
          iconDiv.className = 'bag-slot-icon';
          // Tọa độ sprite icon: mỗi ô 32px
          var posX = -(def.iconCol || 0) * 32;
          var posY = -(def.iconRow || 0) * 32;
          iconDiv.style.backgroundPosition = posX + 'px ' + posY + 'px';
          slotDiv.appendChild(iconDiv);

          if (slotData.count > 1) {
            var countSpan = document.createElement('span');
            countSpan.className = 'bag-slot-count';
            countSpan.textContent = slotData.count;
            slotDiv.appendChild(countSpan);
          }

          if (player.bagLocks && player.bagLocks[slotIndex]) {
            var lockSpan = document.createElement('span');
            lockSpan.className = 'bag-slot-lock';
            lockSpan.textContent = 'KHÓA';
            slotDiv.appendChild(lockSpan);
          }
        }

        slotDiv.addEventListener('click', function () {
          selectedBagSlot = slotIndex;
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
    el.style.backgroundSize = (192 * scale) + 'px ' + (224 * scale) + 'px';
    el.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.width = cellPx + 'px';
    el.style.height = cellPx + 'px';
  }

  function renderEquipSlots() {
    if (!player) return;
    if (!player.equipment) player.equipment = { weapon: null, armor: null, head: null };
    var defs = itemDefs();
    var slots = ['head', 'weapon', 'armor'];
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
    } else if (selectedBagSlot !== null && selectedBagSlot !== undefined && player.bag && player.bag.slots[selectedBagSlot]) {
      itemId = player.bag.slots[selectedBagSlot].itemId;
      count = player.bag.slots[selectedBagSlot].count || 1;
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
    var descEl = document.getElementById('detail-card-desc');
    if (descEl) descEl.textContent = def.desc || '';

    if (btnUse) btnUse.classList.toggle('hidden', !(def.type === 'consumable' && !equipped));
    if (btnEquip) btnEquip.classList.toggle('hidden', !(def.type === 'gear' && !equipped));
    if (btnUnequip) btnUnequip.classList.toggle('hidden', !equipped);
    // Đợt 6 (mục 15, hồ sơ 25): vật phẩm đã khóa thì không bỏ được
    var isLocked = !equipped && selectedBagSlot !== null && selectedBagSlot !== undefined &&
      !!(player.bagLocks && player.bagLocks[selectedBagSlot]);
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
    disarmDrop();
  }

  function afterBagAction() {
    if (stateAPI && player) stateAPI.savePlayer(player);
    renderBagGrid();
    refreshHUD();
  }

  function wireBagDetailControls() {
    var btnUse = document.getElementById('btn-card-use');
    if (btnUse && !btnUse.dataset.wired) {
      btnUse.dataset.wired = '1';
      btnUse.addEventListener('click', function () {
        if (selectedBagSlot === null || !player.bag.slots[selectedBagSlot]) return;
        var itemId = player.bag.slots[selectedBagSlot].itemId;
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
          var res = window.GameEngine.equipItem(selectedBagSlot);
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
    var btnLock = document.getElementById('btn-card-lock');
    if (btnLock && !btnLock.dataset.wired) {
      btnLock.dataset.wired = '1';
      btnLock.addEventListener('click', function () {
        if (selectedBagSlot === null || !player.bag.slots[selectedBagSlot]) return;
        player.bagLocks = player.bagLocks || {};
        if (player.bagLocks[selectedBagSlot]) delete player.bagLocks[selectedBagSlot];
        else player.bagLocks[selectedBagSlot] = true;
        showToast(player.bagLocks[selectedBagSlot] ? 'Đã khóa vật phẩm — không thể bỏ nhầm' : 'Đã mở khóa vật phẩm');
        afterBagAction();
      });
    }
    var btnDrop = document.getElementById('btn-card-drop');
    if (btnDrop && !btnDrop.dataset.wired) {
      btnDrop.dataset.wired = '1';
      btnDrop.addEventListener('click', function () {
        if (selectedBagSlot === null || !player.bag.slots[selectedBagSlot]) return;
        if (player.bagLocks && player.bagLocks[selectedBagSlot]) {
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
        var slotData = player.bag.slots[selectedBagSlot];
        var def = itemDefs()[slotData.itemId];
        if (stateAPI && stateAPI.removeItemFromBag) {
          stateAPI.removeItemFromBag(player, slotData.itemId, 1);
        }
        showToast('Đã bỏ 1 ' + (def ? def.name : slotData.itemId));
        if (!player.bag.slots[selectedBagSlot]) selectedBagSlot = null;
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

    var nameEl = document.getElementById('hud-player-name');
    var realmEl = document.getElementById('hud-player-realm');
    var hpBar = document.getElementById('hud-hp-bar');
    var hpVal = document.getElementById('hud-hp-val');
    var llBar = document.getElementById('hud-linhluc-bar');
    var llVal = document.getElementById('hud-linhluc-val');

    if (nameEl) nameEl.textContent = player.name;
    if (realmEl) realmEl.textContent = player.realm || 'Phàm Nhân';

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

    var harmony = stateAPI.harmonyOf(player.paths);
    if (harmonyEl) harmonyEl.textContent = harmony;

    // Tu vi 5 trụ
    var p = player.paths || {};
    var tuviTho = document.getElementById('tuvi-tho');
    var tuviKim = document.getElementById('tuvi-kim');
    var tuviHoa = document.getElementById('tuvi-hoa');
    var tuviThuy = document.getElementById('tuvi-thuy');
    var tuviMoc = document.getElementById('tuvi-moc');

    if (tuviTho) tuviTho.textContent = (p.tho && p.tho.tuVi) || 0;
    if (tuviKim) tuviKim.textContent = (p.kim && p.kim.tuVi) || 0;
    if (tuviHoa) tuviHoa.textContent = (p.hoa && p.hoa.tuVi) || 0;
    if (tuviThuy) tuviThuy.textContent = (p.thuy && p.thuy.tuVi) || 0;
    if (tuviMoc) tuviMoc.textContent = (p.moc && p.moc.tuVi) || 0;

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
    if (ltEl) ltEl.textContent = farmLt + ' / 300';
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

    if (minimapBgImg && minimapBgImg.complete) {
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
    } else {
      closeDialogue();
    }
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
    mkBtn('Rời đi', function () { closeDialogue(); });
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
    var toast = document.getElementById('game-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameUI = UIAPI;
  }
})(typeof window !== 'undefined' ? window : this);
