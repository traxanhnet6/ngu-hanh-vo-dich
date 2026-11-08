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

    // Phím tắt bàn phím: B mở túi, 1 cast Phi Diệp, 2 cast Dây Leo
    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'b' || e.key === 'B') {
        toggleBag();
      } else if (e.key === '1') {
        if (window.GameEngine && window.GameEngine.castSkill) {
          window.GameEngine.castSkill('phi_diep');
        }
      } else if (e.key === '2') {
        if (window.GameEngine && window.GameEngine.castSkill) {
          window.GameEngine.castSkill('day_leo');
        }
      }
    });

    // 5. Skill Buttons click
    var s1 = document.getElementById('skill-slot-1');
    var s2 = document.getElementById('skill-slot-2');
    if (s1) {
      s1.addEventListener('click', function () {
        if (window.GameEngine && window.GameEngine.castSkill) {
          window.GameEngine.castSkill('phi_diep');
        }
      });
    }
    if (s2) {
      s2.addEventListener('click', function () {
        if (window.GameEngine && window.GameEngine.castSkill) {
          window.GameEngine.castSkill('day_leo');
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
        }

        slotDiv.addEventListener('click', function () {
          selectedBagSlot = slotIndex;
          renderBagGrid();
          updateItemInfo(slotData, defs);
        });

        gridEl.appendChild(slotDiv);
      })(i);
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
  function refreshHUD() {
    if (!player) return;

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

    // Chỉ số phái sinh
    var stats = stateAPI.deriveStats(player.paths);
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
  }

  /**
   * Cập nhật Bảng theo dõi nhiệm vụ
   */
  function updateQuestPanel() {
    if (!player || !mapData) return;

    var titleEl = document.getElementById('quest-title');
    var descEl = document.getElementById('quest-desc');
    var distEl = document.getElementById('quest-dist');

    if (!player.quests || !player.quests.talked_linhnhi) {
      if (titleEl) titleEl.textContent = 'Nói chuyện với Linh Nhi';
      if (descEl) {
        descEl.textContent = 'Linh Nhi đang đợi ở trước miếu hoang.';
        descEl.classList.remove('greyed');
      }
      var dist = Math.round(Math.hypot(player.x - mapData.linhnhi.feetX, player.y - mapData.linhnhi.feetY) / 24);
      if (distEl) distEl.textContent = 'Khoảng cách: ~' + dist + ' bước';
    } else if (!player.quests.huntCompleted) {
      var kills = player.quests.thaotinhKills || 0;
      if (titleEl) titleEl.textContent = 'Săn Thảo Tinh ở Rừng Độc (' + kills + '/5)';
      if (descEl) {
        if (mapData.id === 'mieu_hoang') {
          descEl.textContent = 'Đi qua lối thoát phía đông để sang Rừng Độc Thanh Tụy.';
        } else {
          descEl.textContent = 'Hạ gục 5 Thảo Tinh Nhỏ ở vành ngoài Rừng Độc.';
        }
        descEl.classList.remove('greyed');
      }
      if (distEl) {
        distEl.textContent = (mapData.id === 'mieu_hoang') ? 'Theo lối thoát Đông' : 'Bãi quái vành ngoài';
      }
    } else {
      if (titleEl) titleEl.textContent = 'Tự Do Săn Bắn & Khám Phá Rừng Độc';
      if (descEl) {
        descEl.textContent = 'Đã hoàn thành thử thách sơ nhập. Tiếp tục săn quái và tìm kiếm kỳ ngộ.';
        descEl.classList.add('greyed');
      }
      if (distEl) distEl.textContent = 'Tự do rèn luyện';
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

    // Cập nhật Cooldown kỹ năng trên thanh skill
    if (extras.skillsCd) {
      updateSkillSlotUI(1, extras.skillsCd.phi_diep, 3.0);
      updateSkillSlotUI(2, extras.skillsCd.day_leo, 8.0);
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

    var dialogueBox = document.getElementById('dialogue-box');
    var nameEl = document.getElementById('dialogue-npc-name');
    var portraitEl = document.getElementById('dialogue-portrait');

    if (nameEl) nameEl.textContent = npc.name;
    if (portraitEl) {
      portraitEl.style.backgroundImage = 'url(' + npc.asset + ')';
    }

    if (dialogueBox) dialogueBox.classList.remove('hidden');
    renderDialogueLine();
  }

  function renderDialogueLine() {
    var textEl = document.getElementById('dialogue-text');
    if (textEl && dialogueState.lines[dialogueState.step]) {
      textEl.textContent = dialogueState.lines[dialogueState.step];
    }
  }

  function advanceDialogue() {
    if (!dialogueState.active) return;
    if (audioAPI) audioAPI.playClick();

    dialogueState.step++;
    if (dialogueState.step < dialogueState.lines.length) {
      renderDialogueLine();
    } else {
      closeDialogue();
    }
  }

  function closeDialogue() {
    dialogueState.active = false;
    var dialogueBox = document.getElementById('dialogue-box');
    if (dialogueBox) dialogueBox.classList.add('hidden');

    if (dialogueState.npc && dialogueState.npc.id === 'npc_linhnhi') {
      if (!player.quests.talked_linhnhi) {
        player.quests.talked_linhnhi = true;
        player.quests.current = 'hunt_thaotinh';
        player.quests.thaotinhKills = 0;
        player.quests.huntCompleted = false;
        if (stateAPI) stateAPI.savePlayer(player);
        if (audioAPI) audioAPI.playChime();
        showToast('Nhiệm vụ mới: Săn Thảo Tinh ở Rừng Độc');
        refreshHUD();
      }
    }
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

  function openSettingsModal() {
    var modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
  }

  var UIAPI = {
    init: initUI,
    update: update,
    refreshHUD: refreshHUD,
    openDialogue: openDialogue,
    showToast: showToast,
    triggerSkillShake: triggerSkillShake,
    showDeathModal: showDeathModal,
    hideDeathModal: hideDeathModal,
    showSessionSummary: showSessionSummary
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameUI = UIAPI;
  }
})(typeof window !== 'undefined' ? window : this);
