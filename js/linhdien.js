/**
 * linhdien.js — Hệ thống Linh Điền trồng linh dược (Hồ sơ 12, Điều 400–420 & Brief Đợt agy-linhdien)
 * Quản lý 6 ô đất trồng dược sau Miếu Hoang, thời gian thực, lưu vào player.linhDien.
 * Node-loadable & chạy trên trình duyệt.
 */

(function (exports) {
  'use strict';

  // Bảng dữ liệu dược trồng được (Brief §2.2)
  var PLANTABLE = {
    'la-thanh-tuy': {
      itemId: 'la-thanh-tuy',
      name: 'Lá Thanh Tụy',
      growSec: 300,
      yieldCount: 2,
      seedCost: 1,
      desc: 'Linh diệp phát sáng linh quang, dược liệu nhập môn ngũ hành.'
    },
    'linh-chi-rung': {
      itemId: 'linh-chi-rung',
      name: 'Linh Chi Rừng',
      growSec: 600,
      yieldCount: 2,
      seedCost: 1,
      desc: 'Linh chi tụ linh mộc khí, nguyên liệu luyện đan quý giá.'
    }
  };

  var TOTAL_PLOTS = 6;
  var SOIL_LEVEL_LABEL = 'Phàm Thổ';

  var livePlayer = null;
  var refreshTimer = null;
  var selectedPlotIndex = null;

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }

  function getMonstersAPI() {
    if (typeof window !== 'undefined' && window.GameMonsters) return window.GameMonsters;
    if (typeof global !== 'undefined' && global.GameMonsters) return global.GameMonsters;
    try { return require('./monsters.js'); } catch (e) { return null; }
  }

  function getItemDef(itemId) {
    var m = getMonstersAPI();
    if (m && m.ITEM_DEFS && m.ITEM_DEFS[itemId]) {
      return m.ITEM_DEFS[itemId];
    }
    return { id: itemId, name: itemId, iconCol: 0, iconRow: 0 };
  }

  /**
   * Khởi tạo lười (lazy) trạng thái player.linhDien khi thiếu để tương thích save cũ (Brief §2.1 & §3)
   */
  function ensureState(player) {
    if (!player) return null;
    if (!player.linhDien || typeof player.linhDien !== 'object') {
      player.linhDien = { plots: [] };
    }
    if (!Array.isArray(player.linhDien.plots)) {
      player.linhDien.plots = [];
    }
    while (player.linhDien.plots.length < TOTAL_PLOTS) {
      player.linhDien.plots.push(null);
    }
    return player.linhDien;
  }

  /**
   * Tính toán góc nhìn chi tiết của một ô đất tại thời điểm nowMs
   * Trả về: { state: 'empty'|'growing'|'ready', itemId, progress 0..1, remainSec, stage 0..2 }
   */
  function plotView(player, plotIndex, nowMs) {
    if (!player || plotIndex < 0 || plotIndex >= TOTAL_PLOTS) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0 };
    }
    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot || !plot.itemId || !plot.plantedAt) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0 };
    }

    var plantDef = PLANTABLE[plot.itemId];
    if (!plantDef) {
      return { state: 'empty', itemId: null, progress: 0, remainSec: 0, stage: 0 };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var elapsedSec = Math.max(0, (now - plot.plantedAt) / 1000);
    var growSec = plantDef.growSec || 300;

    if (elapsedSec >= growSec) {
      return {
        state: 'ready',
        itemId: plot.itemId,
        progress: 1.0,
        remainSec: 0,
        stage: 2
      };
    }

    var progress = Math.max(0, Math.min(0.9999, elapsedSec / growSec));
    var remainSec = Math.max(0, Math.ceil(growSec - elapsedSec));

    // 3 giai đoạn sinh trưởng nhìn thấy được (mầm -> cây non -> trưởng thành)
    var stage = 0;
    if (progress >= 0.66) {
      stage = 2; // trưởng thành
    } else if (progress >= 0.33) {
      stage = 1; // cây non
    } else {
      stage = 0; // mầm
    }

    return {
      state: 'growing',
      itemId: plot.itemId,
      progress: progress,
      remainSec: remainSec,
      stage: stage
    };
  }

  /**
   * Gieo giống vào ô plotIndex
   * Trừ 1 giống trong túi (Điều 419), ghi ô, savePlayer ngay
   */
  function plant(player, plotIndex, itemId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    if (plotIndex < 0 || plotIndex >= TOTAL_PLOTS) return { ok: false, msg: 'Ô đất không hợp lệ.' };

    ensureState(player);
    if (player.linhDien.plots[plotIndex]) {
      return { ok: false, msg: 'Ô đất này đã có cây trồng.' };
    }

    var plantDef = PLANTABLE[itemId];
    if (!plantDef) {
      return { ok: false, msg: 'Loại dược thảo này không thể gieo trồng.' };
    }

    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };

    var cost = plantDef.seedCost || 1;
    var countInBag = st.countItemInBag(player, itemId);
    if (countInBag < cost) {
      return { ok: false, msg: 'Không đủ giống trong túi (cần ' + cost + ' ' + plantDef.name + ').' };
    }

    var removed = st.removeItemFromBag(player, itemId, cost);
    if (!removed) {
      return { ok: false, msg: 'Trừ hạt giống thất bại.' };
    }

    player.linhDien.plots[plotIndex] = {
      itemId: itemId,
      plantedAt: Date.now()
    };

    st.savePlayer(player);

    return {
      ok: true,
      msg: 'Đã gieo ' + plantDef.name + ' vào ô ' + (plotIndex + 1) + '.'
    };
  }

  /**
   * Thu hoạch dược thảo tại ô plotIndex
   * Kiểm chín theo Date.now(), cộng dược qua addItemToBag, xóa ô, savePlayer ngay
   * Trả { ok, msg, itemId, count }
   */
  function harvest(player, plotIndex) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.', itemId: null, count: 0 };
    if (plotIndex < 0 || plotIndex >= TOTAL_PLOTS) {
      return { ok: false, msg: 'Ô đất không hợp lệ.', itemId: null, count: 0 };
    }

    ensureState(player);
    var plot = player.linhDien.plots[plotIndex];
    if (!plot) {
      return { ok: false, msg: 'Ô đất đang trống.', itemId: null, count: 0 };
    }

    var view = plotView(player, plotIndex, Date.now());
    if (view.state !== 'ready') {
      return {
        ok: false,
        msg: 'Cây chưa chín (còn ' + view.remainSec + ' giây).',
        itemId: plot.itemId,
        count: 0
      };
    }

    var plantDef = PLANTABLE[plot.itemId];
    var yieldCount = plantDef ? (plantDef.yieldCount || 1) : 1;
    var itemId = plot.itemId;

    var st = getStateAPI();
    var m = getMonstersAPI();
    var itemDefs = m ? m.ITEM_DEFS : null;

    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.', itemId: itemId, count: 0 };

    var addRes = st.addItemToBag(player, itemId, yieldCount, itemDefs);
    if (!addRes || !addRes.success) {
      return {
        ok: false,
        msg: 'Túi đồ đã đầy, không thể thu hoạch! Hãy dọn túi trước.',
        itemId: itemId,
        count: 0
      };
    }

    player.linhDien.plots[plotIndex] = null;
    st.savePlayer(player);

    var herbName = plantDef ? plantDef.name : itemId;
    return {
      ok: true,
      msg: 'Thu hoạch thành công: +' + yieldCount + ' ' + herbName + ' vào túi!',
      itemId: itemId,
      count: yieldCount
    };
  }

  // =========================================================================
  // GIAO DIỆN & MÓC NỐI UI TRÌNH DUYỆT (attach, openPanel, closePanel, renderPanel)
  // =========================================================================

  function formatRemainTime(sec) {
    if (sec <= 0) return '0s';
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (m > 0) {
      return m + 'p ' + (s < 10 ? '0' : '') + s + 's';
    }
    return s + 's';
  }

  function setElementIconSprite(el, def, cellPx) {
    if (!el || !def) return;
    var scale = cellPx / 32;
    el.style.backgroundImage = "url('assets/art/icons-sheet.png')";
    el.style.backgroundSize = (192 * scale) + 'px ' + (224 * scale) + 'px';
    el.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.width = cellPx + 'px';
    el.style.height = cellPx + 'px';
  }

  function openSeedSelector(plotIndex) {
    if (typeof document === 'undefined') return;
    selectedPlotIndex = plotIndex;
    var modal = document.getElementById('linhdien-modal');
    if (!modal) return;
    var selector = document.getElementById('linhdien-seed-selector');
    if (!selector) return;

    var numEl = document.getElementById('selected-plot-num');
    if (numEl) numEl.textContent = (plotIndex + 1);

    selector.classList.remove('hidden');
    renderSeedList();
  }

  function closeSeedSelector() {
    if (typeof document === 'undefined') return;
    selectedPlotIndex = null;
    var selector = document.getElementById('linhdien-seed-selector');
    if (selector) selector.classList.add('hidden');
  }

  function renderSeedList() {
    if (typeof document === 'undefined') return;
    var listEl = document.getElementById('seed-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    var st = getStateAPI();
    var player = livePlayer;

    var keys = Object.keys(PLANTABLE);
    keys.forEach(function (itemId) {
      var plantDef = PLANTABLE[itemId];
      var itemDef = getItemDef(itemId);
      var inBag = (st && player) ? st.countItemInBag(player, itemId) : 0;
      var canPlant = inBag >= (plantDef.seedCost || 1);

      var card = document.createElement('div');
      card.className = 'seed-card' + (canPlant ? '' : ' disabled');

      var iconEl = document.createElement('div');
      iconEl.className = 'seed-card-icon';
      setElementIconSprite(iconEl, itemDef, 36);

      var infoEl = document.createElement('div');
      infoEl.className = 'seed-card-info';

      var nameRow = document.createElement('div');
      nameRow.className = 'seed-card-name-row';
      var nameEl = document.createElement('span');
      nameEl.className = 'seed-card-name';
      nameEl.textContent = plantDef.name;
      var bagEl = document.createElement('span');
      bagEl.className = 'seed-card-bag-count' + (canPlant ? ' has-stock' : ' out-of-stock');
      bagEl.textContent = 'Trong túi: ' + inBag;
      nameRow.appendChild(nameEl);
      nameRow.appendChild(bagEl);

      var detailRow = document.createElement('div');
      detailRow.className = 'seed-card-details';
      detailRow.textContent = 'Lớn: ' + formatRemainTime(plantDef.growSec) + ' · Thu: ' + plantDef.yieldCount + ' phần · Tốn: ' + (plantDef.seedCost || 1) + ' giống';

      infoEl.appendChild(nameRow);
      infoEl.appendChild(detailRow);

      var actionEl = document.createElement('button');
      actionEl.className = 'btn wood seed-plant-btn' + (canPlant ? '' : ' disabled');
      actionEl.type = 'button';
      actionEl.textContent = canPlant ? 'Gieo' : 'Hết giống';
      if (!canPlant) {
        actionEl.disabled = true;
      } else {
        actionEl.addEventListener('click', function (e) {
          e.stopPropagation();
          if (selectedPlotIndex === null) return;
          var res = plant(player, selectedPlotIndex, itemId);
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
            window.GameUI.showToast(res.msg);
          }
          closeSeedSelector();
          renderPanel();
        });
      }

      card.appendChild(iconEl);
      card.appendChild(infoEl);
      card.appendChild(actionEl);

      if (canPlant) {
        card.addEventListener('click', function () {
          if (selectedPlotIndex === null) return;
          var res = plant(player, selectedPlotIndex, itemId);
          if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
            window.GameUI.showToast(res.msg);
          }
          closeSeedSelector();
          renderPanel();
        });
      }

      listEl.appendChild(card);
    });
  }

  /**
   * Vẽ lại toàn bộ 6 ô đất của bảng Linh Điền
   */
  function renderPanel() {
    if (typeof document === 'undefined') return;
    var gridEl = document.getElementById('linhdien-grid');
    if (!gridEl) return;
    if (!livePlayer) return;

    ensureState(livePlayer);
    gridEl.innerHTML = '';

    var now = Date.now();

    for (var i = 0; i < TOTAL_PLOTS; i++) {
      (function (plotIndex) {
        var view = plotView(livePlayer, plotIndex, now);
        var plantDef = view.itemId ? PLANTABLE[view.itemId] : null;

        var plotEl = document.createElement('div');
        plotEl.className = 'linhdien-plot-card plot-state-' + view.state;
        plotEl.setAttribute('data-plot-index', plotIndex);

        var headEl = document.createElement('div');
        headEl.className = 'plot-card-header';
        var titleEl = document.createElement('span');
        titleEl.className = 'plot-card-title';
        titleEl.textContent = 'Ô #' + (plotIndex + 1);
        var badgeEl = document.createElement('span');
        badgeEl.className = 'plot-card-badge';
        headEl.appendChild(titleEl);
        headEl.appendChild(badgeEl);
        plotEl.appendChild(headEl);

        var bodyEl = document.createElement('div');
        bodyEl.className = 'plot-card-body';

        if (view.state === 'empty') {
          badgeEl.textContent = 'Trống';
          badgeEl.className += ' badge-empty';

          var emptyPrompt = document.createElement('div');
          emptyPrompt.className = 'plot-empty-prompt';
          emptyPrompt.innerHTML = '<div class="empty-soil-mound"></div><div class="empty-hint">+ Chạm để gieo</div>';
          bodyEl.appendChild(emptyPrompt);

          plotEl.addEventListener('click', function () {
            openSeedSelector(plotIndex);
          });
        } else if (view.state === 'growing') {
          var stageLabels = ['Mầm', 'Cây non', 'Trưởng thành'];
          badgeEl.textContent = stageLabels[view.stage] || 'Đang lớn';
          badgeEl.className += ' badge-growing';

          var visualWrap = document.createElement('div');
          visualWrap.className = 'plot-herb-visual-wrap';

          if (view.itemId === 'la-thanh-tuy') {
            var imgEl = document.createElement('img');
            imgEl.className = 'plot-herb-img stage-' + view.stage;
            imgEl.src = 'assets/art/herb-la-thanh-tuy.png';
            imgEl.alt = plantDef ? plantDef.name : 'Lá Thanh Tụy';
            visualWrap.appendChild(imgEl);
          } else {
            var spriteEl = document.createElement('div');
            spriteEl.className = 'plot-herb-sprite stage-' + view.stage;
            var itemDef = getItemDef(view.itemId);
            setElementIconSprite(spriteEl, itemDef, 56);
            visualWrap.appendChild(spriteEl);
          }

          var herbNameEl = document.createElement('div');
          herbNameEl.className = 'plot-herb-name';
          herbNameEl.textContent = plantDef ? plantDef.name : view.itemId;

          var progressWrap = document.createElement('div');
          progressWrap.className = 'plot-progress-bar-wrap';
          var barEl = document.createElement('div');
          barEl.className = 'plot-progress-bar';
          var fillEl = document.createElement('div');
          fillEl.className = 'plot-progress-fill';
          fillEl.style.width = (view.progress * 100).toFixed(1) + '%';
          barEl.appendChild(fillEl);

          var timeEl = document.createElement('div');
          timeEl.className = 'plot-remain-time';
          timeEl.textContent = 'Còn ' + formatRemainTime(view.remainSec) + ' (' + Math.floor(view.progress * 100) + '%)';

          progressWrap.appendChild(barEl);
          progressWrap.appendChild(timeEl);

          bodyEl.appendChild(visualWrap);
          bodyEl.appendChild(herbNameEl);
          bodyEl.appendChild(progressWrap);

          plotEl.addEventListener('click', function () {
            if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
              window.GameUI.showToast(herbNameEl.textContent + ' đang lớn: ' + Math.floor(view.progress * 100) + '% (còn ' + formatRemainTime(view.remainSec) + ').');
            }
          });
        } else if (view.state === 'ready') {
          badgeEl.textContent = 'Chín';
          badgeEl.className += ' badge-ready';

          var readyVisual = document.createElement('div');
          readyVisual.className = 'plot-herb-visual-wrap ready-glow';

          if (view.itemId === 'la-thanh-tuy') {
            var readyImg = document.createElement('img');
            readyImg.className = 'plot-herb-img stage-2 ready-pulse';
            readyImg.src = 'assets/art/herb-la-thanh-tuy.png';
            readyImg.alt = plantDef ? plantDef.name : 'Lá Thanh Tụy';
            readyVisual.appendChild(readyImg);
          } else {
            var readySprite = document.createElement('div');
            readySprite.className = 'plot-herb-sprite stage-2 ready-pulse';
            var readyDef = getItemDef(view.itemId);
            setElementIconSprite(readySprite, readyDef, 56);
            readyVisual.appendChild(readySprite);
          }

          var readyNameEl = document.createElement('div');
          readyNameEl.className = 'plot-herb-name ready-gold';
          readyNameEl.textContent = plantDef ? plantDef.name : view.itemId;

          var harvestBtn = document.createElement('button');
          harvestBtn.className = 'btn wood btn-harvest-plot';
          harvestBtn.type = 'button';
          var yieldCnt = plantDef ? plantDef.yieldCount : 1;
          harvestBtn.textContent = 'Thu Hoạch (+' + yieldCnt + ')';

          var doHarvest = function (e) {
            if (e) e.stopPropagation();
            var res = harvest(livePlayer, plotIndex);
            if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
              window.GameUI.showToast(res.msg);
            }
            if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) {
              window.GameAudio.playChime();
            }
            renderPanel();
          };

          harvestBtn.addEventListener('click', doHarvest);
          plotEl.addEventListener('click', doHarvest);

          bodyEl.appendChild(readyVisual);
          bodyEl.appendChild(readyNameEl);
          bodyEl.appendChild(harvestBtn);
        }

        plotEl.appendChild(bodyEl);
        gridEl.appendChild(plotEl);
      })(i);
    }

    // Nếu bảng chọn giống đang mở thì đồng bộ số lượng trong túi
    var selector = document.getElementById('linhdien-seed-selector');
    if (selector && !selector.classList.contains('hidden') && selectedPlotIndex !== null) {
      renderSeedList();
    }
  }

  /**
   * Mở modal Linh Điền và bắt đầu chu kỳ đếm nhịp mỗi giây
   */
  function openPanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('linhdien-modal');
    if (!modal) return;
    closeSeedSelector();
    modal.classList.remove('hidden');
    renderPanel();

    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    // Tự vẽ lại mỗi giây khi bảng đang mở (tiến độ chạy thật, Brief §2.3)
    refreshTimer = setInterval(function () {
      if (!modal || modal.classList.contains('hidden')) {
        clearInterval(refreshTimer);
        refreshTimer = null;
        return;
      }
      renderPanel();
    }, 1000);
  }

  /**
   * Đóng modal Linh Điền và dừng chu kỳ đếm nhịp
   */
  function closePanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('linhdien-modal');
    if (modal) modal.classList.add('hidden');
    closeSeedSelector();
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  /**
   * Móc nối với player đang sống (do ui.js gọi trong initUI)
   */
  function attach(player) {
    livePlayer = player;
    ensureState(livePlayer);

    if (typeof document === 'undefined') return;

    var btnHud = document.getElementById('btn-linhdien');
    if (btnHud && !btnHud.dataset.wired) {
      btnHud.dataset.wired = '1';
      btnHud.addEventListener('click', function () {
        openPanel();
      });
    }

    var btnClose = document.getElementById('close-linhdien-modal');
    if (btnClose && !btnClose.dataset.wired) {
      btnClose.dataset.wired = '1';
      btnClose.addEventListener('click', function () {
        closePanel();
      });
    }

    var btnCloseSelector = document.getElementById('close-seed-selector');
    if (btnCloseSelector && !btnCloseSelector.dataset.wired) {
      btnCloseSelector.dataset.wired = '1';
      btnCloseSelector.addEventListener('click', function (e) {
        e.stopPropagation();
        closeSeedSelector();
      });
    }

    var modal = document.getElementById('linhdien-modal');
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closePanel();
        }
      });
    }

    // Đóng bằng phím Escape
    if (!document.body.dataset.linhdienEscWired) {
      document.body.dataset.linhdienEscWired = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var sel = document.getElementById('linhdien-seed-selector');
          if (sel && !sel.classList.contains('hidden')) {
            closeSeedSelector();
            return;
          }
          var md = document.getElementById('linhdien-modal');
          if (md && !md.classList.contains('hidden')) {
            closePanel();
          }
        }
      });
    }
  }

  // Xuất API bắt buộc theo Brief §2.3
  exports.ensureState = ensureState;
  exports.PLANTABLE = PLANTABLE;
  exports.plant = plant;
  exports.harvest = harvest;
  exports.plotView = plotView;
  exports.attach = attach;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameLinhDien = {}));
