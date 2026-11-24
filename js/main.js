/**
 * main.js — Điểm khởi động trò chơi Ngũ Hành Vô Địch
 * Quản lý màn hình khởi đầu, chọn/tạo nhân vật, nối dây các module và khởi chạy.
 * Tương thích cả Browser và Node.js.
 */
(function (global) {
  'use strict';

  function boot() {
    if (typeof document === 'undefined') return;

    var stateAPI = window.GameState;
    var audioAPI = window.GameAudio;
    var mapData = window.MapData;
    var engineAPI = window.GameEngine;
    var uiAPI = window.GameUI;

    var screenStart = document.getElementById('screen-start');
    var screenGame = document.getElementById('screen-game');
    var canvas = document.getElementById('game-canvas');

    var charList = stateAPI.listCharacters();
    var activeCharName = window.localStorage ? window.localStorage.getItem(stateAPI.STORAGE_PREFIX + 'active_char') : null;

    // Đợt P2J: trạng thái bảng chọn hình dáng — khai báo TRƯỚC khi dựng
    // bảng (initPortraitPicker) để thẻ mặc định F04 được tô chọn ngay.
    var selectedPortraitCode = (window.GamePortraits && window.GamePortraits.DEFAULT_CODE) || 'F04';
    var activePortraitTab = 'all';

    if (!activeCharName && charList.length > 0) {
      activeCharName = charList[0];
    }

    renderStartScreen(charList, activeCharName);

    // Đợt P2J: dựng bảng chọn hình dáng tu sĩ trong khối tạo nhân vật.
    // Dựng ngay cả khi khối tạo đang ẩn (có save cũ) để hình được nạp sẵn.
    initPortraitPicker();

    if (window.GameIntro && window.GameIntro.init) {
      window.GameIntro.init();
    }

    // Đợt 3 (Note 8): áp cài đặt hiển thị đã lưu ngay khi mở trang (cỡ HUD, cỡ nút
    // chạm, chất lượng đồ họa) + đăng ký service worker tối thiểu cho PWA
    // (pass-through, không cache — xem sw.js).
    if (uiAPI && uiAPI.applyDisplaySettings) {
      uiAPI.applyDisplaySettings(stateAPI.loadSettings());
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
        typeof window !== 'undefined' && window.location && /^https?:$/.test(window.location.protocol)) {
      // Đăng ký SAU sự kiện load để không tranh băng thông với tài sản game lúc mở trang
      var registerSW = function () {
        try {
          var swReg = navigator.serviceWorker.register('sw.js');
          if (swReg && swReg.catch) swReg.catch(function () {});
        } catch (e) { /* Môi trường không hỗ trợ — bỏ qua */ }
      };
      if (document.readyState === 'complete') registerSW();
      else window.addEventListener('load', registerSW);
    }

    function kickCostumeLoad(outfitId) {
      // Đợt COSTUMEPREP: kích nạp lười atlas của mã vừa chọn; render lùi
      // về Hà Nhân cho tới khi đủ dữ liệu (không chặn vào game).
      if (typeof window !== 'undefined' && window.CostumeOutfits &&
          window.CostumeOutfits.isCostumeCode(outfitId)) {
        window.CostumeOutfits.ensureCode(outfitId);
      }
    }

    // Xử lý tạo nhân vật mới
    // (Đợt P2J: tên bắt buộc + không trùng tên save đã có trên máy —
    // luật tên duy nhất; phía máy chủ thuộc pha online. Chân dung +
    // giới tính chọn trong bảng lấy từ GamePortraits.)
    var btnStartNew = document.getElementById('btn-start-game');
    if (btnStartNew) {
      btnStartNew.addEventListener('click', function () {
        if (audioAPI) audioAPI.init();
        if (window.GameMusic) window.GameMusic.unlock();
        var nameInput = document.getElementById('input-char-name');
        var charName = (nameInput && nameInput.value.trim()) || '';
        var errorEl = document.getElementById('create-error');

        if (!charName) {
          if (errorEl) {
            errorEl.textContent = 'Hãy nhập tên nhân vật.';
            errorEl.classList.remove('hidden');
          }
          return;
        }
        var existingNames = stateAPI.listCharacters();
        if (existingNames.indexOf(charName) !== -1) {
          if (errorEl) {
            errorEl.textContent = 'Tên "' + charName + '" đã có nhân vật. Hãy chọn tên khác.';
            errorEl.classList.remove('hidden');
          }
          return;
        }
        if (errorEl) errorEl.classList.add('hidden');

        // Đợt COSTUMEPREP: đọc select trang phục ở màn bắt đầu (mặc định Hà Nhân).
        var outfitSel = document.getElementById('input-char-outfit');
        var chosenOutfit = (outfitSel && outfitSel.value) || 'hanhan-live';

        var portraitChoice = getSelectedPortrait();
        var player = stateAPI.createPlayer(charName, {
          x: mapData.spawn.x,
          y: mapData.spawn.y,
          dir: 0,
          outfit: chosenOutfit,
          portrait: portraitChoice ? portraitChoice.code : null,
          gender: portraitChoice ? portraitChoice.gender : null
        });
        stateAPI.savePlayer(player);
        kickCostumeLoad(chosenOutfit);

        var introAPI = window.GameIntro;
        if (introAPI && introAPI.shouldShowIntroForPlayer && introAPI.shouldShowIntroForPlayer(player)) {
          if (screenStart) screenStart.classList.add('hidden');
          introAPI.startIntro(player, function () {
            launchGame(player);
          }, false);
        } else {
          launchGame(player);
        }
      });
    }

    // Đợt P2J: bảng chọn hình dáng tu sĩ (tab lọc ngoại hình + lưới thẻ).
    // (selectedPortraitCode / activePortraitTab khai báo ở đầu boot.)
    function getSelectedPortrait() {
      if (window.GamePortraits && window.GamePortraits.getPortrait) {
        return window.GamePortraits.getPortrait(selectedPortraitCode);
      }
      return null;
    }

    function initPortraitPicker() {
      if (!window.GamePortraits) return;
      renderPortraitTabs();
      renderPortraitGroups();
    }

    function renderPortraitTabs() {
      var tabsEl = document.getElementById('portrait-tabs');
      if (!tabsEl) return;
      tabsEl.innerHTML = '';
      var tabs = window.GamePortraits.TABS || [];
      for (var i = 0; i < tabs.length; i++) {
        (function (tab) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'portrait-tab' + (tab.id === activePortraitTab ? ' active' : '');
          btn.textContent = tab.label;
          btn.setAttribute('role', 'tab');
          btn.setAttribute('aria-selected', tab.id === activePortraitTab ? 'true' : 'false');
          btn.addEventListener('click', function () {
            if (audioAPI) audioAPI.playClick();
            activePortraitTab = tab.id;
            renderPortraitTabs();
            renderPortraitGroups();
          });
          tabsEl.appendChild(btn);
        })(tabs[i]);
      }
    }

    function renderPortraitGroups() {
      var groupsEl = document.getElementById('portrait-groups');
      if (!groupsEl || !window.GamePortraits) return;
      groupsEl.innerHTML = '';
      var list = window.GamePortraits.listByTab(activePortraitTab);
      var genders = [
        { id: 'nu', label: 'Nữ tu' },
        { id: 'nam', label: 'Nam tu' }
      ];
      for (var g = 0; g < genders.length; g++) {
        (function (gender) {
          var items = [];
          for (var i = 0; i < list.length; i++) {
            if (list[i].gender === gender.id) items.push(list[i]);
          }
          if (items.length === 0) return;
          var title = document.createElement('div');
          title.className = 'portrait-group-title';
          title.textContent = gender.label;
          groupsEl.appendChild(title);
          var grid = document.createElement('div');
          grid.className = 'portrait-grid';
          for (var j = 0; j < items.length; j++) {
            (function (entry) {
              var card = document.createElement('button');
              card.type = 'button';
              card.className = 'portrait-card' + (entry.code === selectedPortraitCode ? ' selected' : '');
              card.setAttribute('data-code', entry.code);
              card.setAttribute('aria-label', entry.code + ' — ' + (entry.desc || ''));
              var img = document.createElement('img');
              img.src = window.GamePortraits.portraitUrl(entry.code);
              img.alt = entry.code;
              img.draggable = false;
              var codeEl = document.createElement('span');
              codeEl.className = 'portrait-code';
              codeEl.textContent = entry.code;
              card.appendChild(img);
              card.appendChild(codeEl);
              card.addEventListener('click', function () {
                if (audioAPI) audioAPI.playClick();
                selectedPortraitCode = entry.code;
                var cards = groupsEl.querySelectorAll('.portrait-card');
                for (var k = 0; k < cards.length; k++) {
                  cards[k].classList.toggle('selected', cards[k].getAttribute('data-code') === selectedPortraitCode);
                }
              });
              grid.appendChild(card);
            })(items[j]);
          }
          groupsEl.appendChild(grid);
        })(genders[g]);
      }
    }

    // Xử lý nút xem mở đầu ở màn hình bắt đầu
    var btnStartIntro = document.getElementById('btn-start-intro');
    if (btnStartIntro) {
      btnStartIntro.addEventListener('click', function () {
        if (audioAPI) audioAPI.playClick();
        if (window.GameIntro) {
          var nameInput = document.getElementById('input-char-name');
          var charName = (nameInput && nameInput.value.trim()) || activeCharName || 'Hà Nhân';
          var mockPlayer = { name: charName };
          window.GameIntro.startIntro(mockPlayer, function () {}, true);
        }
      });
    }

    // Xử lý nút mở Cài đặt ở màn hình bắt đầu
    var btnStartSettings = document.getElementById('btn-start-settings');
    if (btnStartSettings) {
      btnStartSettings.addEventListener('click', function () {
        if (audioAPI) audioAPI.playClick();
        if (uiAPI) uiAPI.openSettingsModal();
      });
    }

    function renderStartScreen(list, activeName) {
      var continueBox = document.getElementById('continue-box');
      var createBox = document.getElementById('create-box');
      var savedListContainer = document.getElementById('saved-char-list');

      if (list && list.length > 0) {
        if (continueBox) continueBox.classList.remove('hidden');
        if (createBox) createBox.classList.add('hidden');

        var btnContinue = document.getElementById('btn-continue-game');
        if (btnContinue) {
          btnContinue.textContent = 'Tiếp Tục — ' + (activeName || list[0]);
          btnContinue.onclick = function () {
            if (audioAPI) audioAPI.init();
        if (window.GameMusic) window.GameMusic.unlock();
            var targetName = activeName || list[0];
            var player = stateAPI.loadPlayer(targetName);
            if (!player) {
              player = stateAPI.createPlayer(targetName);
              stateAPI.savePlayer(player);
            }
            // Đợt COSTUMEPREP: áp trang phục đã chọn ở màn tiếp tục.
            var cSel = document.getElementById('continue-outfit-select');
            var cOutfit = (cSel && cSel.value) || 'hanhan-live';
            if (stateAPI.setPlayerOutfit) {
              stateAPI.setPlayerOutfit(player, cOutfit);
              stateAPI.savePlayer(player);
            }
            kickCostumeLoad(cOutfit);
            var introAPI = window.GameIntro;
            if (introAPI && introAPI.shouldShowIntroForPlayer && introAPI.shouldShowIntroForPlayer(player)) {
              if (screenStart) screenStart.classList.add('hidden');
              introAPI.startIntro(player, function () {
                launchGame(player);
              }, false);
            } else {
              launchGame(player);
            }
          };
        }

        // Đợt PENDING (OUTFITSWAP §2.2): màn tiếp tục phải giữ đúng trang
        // phục đã lưu — trước đây select luôn mặc định 'hanhan-live' nên
        // bấm Tiếp Tục là ghi đè mất bộ đã chọn trong bảng nhân vật.
        var cSelSync = document.getElementById('continue-outfit-select');
        if (cSelSync) {
          var savedOutfit = null;
          try {
            var savedPl = stateAPI.loadPlayer(activeName || list[0]);
            if (savedPl && savedPl.outfit) savedOutfit = savedPl.outfit;
          } catch (e) {}
          if (savedOutfit) cSelSync.value = savedOutfit;
        }

        // Danh sách các nhân vật đã lưu
        if (savedListContainer) {
          savedListContainer.innerHTML = '';
          for (var i = 0; i < list.length; i++) {
            (function (name) {
              var itemBtn = document.createElement('button');
              itemBtn.className = 'btn wood small char-select-btn' + (name === activeName ? ' active' : '');
              itemBtn.textContent = name;
              itemBtn.onclick = function () {
                activeName = name;
                if (window.localStorage) {
                  window.localStorage.setItem(stateAPI.STORAGE_PREFIX + 'active_char', name);
                }
                renderStartScreen(list, activeName);
              };
              savedListContainer.appendChild(itemBtn);
            })(list[i]);
          }
        }

        var btnShowNewForm = document.getElementById('btn-show-new-form');
        if (btnShowNewForm) {
          btnShowNewForm.onclick = function () {
            var errorEl = document.getElementById('create-error');
            if (errorEl) errorEl.classList.add('hidden');
            if (continueBox) continueBox.classList.add('hidden');
            if (createBox) createBox.classList.remove('hidden');
          };
        }

        var btnBackToContinue = document.getElementById('btn-back-continue');
        if (btnBackToContinue) {
          // Đợt P2J: nút Hủy phải hiện khi mở khối tạo từ danh sách (trước
          // đây nút này mang sẵn class hidden mà không nơi nào gỡ).
          btnBackToContinue.classList.remove('hidden');
          btnBackToContinue.onclick = function () {
            if (createBox) createBox.classList.add('hidden');
            if (continueBox) continueBox.classList.remove('hidden');
          };
        }
      } else {
        if (continueBox) continueBox.classList.add('hidden');
        if (createBox) createBox.classList.remove('hidden');
        var backBtn = document.getElementById('btn-back-continue');
        if (backBtn) backBtn.classList.add('hidden');
      }
    }

    function launchGame(player) {
      if (screenStart) screenStart.classList.add('hidden');
      if (screenGame) screenGame.classList.remove('hidden');

      engineAPI.init(canvas, player, mapData, function () {
        uiAPI.init(player, mapData);
        // PHONEFIX2: nối sống hệ thống hướng dẫn tân thủ (chỉ chạy 1 lần cho save mới)
        if (typeof window !== 'undefined' && window.GameTutorial && typeof window.GameTutorial.init === 'function') {
          window.GameTutorial.init();
        }
        engineAPI.start();
        // ZOOM-PHONE (Bui lệnh 19:33 ngày 2026-11-24): điện thoại mặc định
        // góc nhìn XA NHẤT (zoom nhỏ nhất = 0.5) mỗi khi vào game; PC giữ
        // nguyên. Người chơi pinch/nút +/− để đổi trong phiên; giá trị đó
        // vẫn lưu lại như cũ nhưng lần vào sau điện thoại lại về 0.5.
        // Đặt SAU engineAPI.start() vì start() nạp zoom đã lưu và ghi đè.
        if (typeof document !== 'undefined' && document.body &&
            document.body.classList.contains('uikit-phone')) {
          if (engineAPI.setUserZoom) engineAPI.setUserZoom(0.5);
          try {
            if (stateAPI && stateAPI.saveSettings) {
              stateAPI.saveSettings({ zoom: 0.5, display: { zoom: 0.5 } });
            }
          } catch (e) {}
          var zvEl = document.getElementById('setting-zoom-val');
          if (zvEl) zvEl.textContent = '50%';
        }
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', boot);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { boot: boot };
  }
})(typeof window !== 'undefined' ? window : this);
