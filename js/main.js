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

    if (!activeCharName && charList.length > 0) {
      activeCharName = charList[0];
    }

    renderStartScreen(charList, activeCharName);

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

    // Xử lý tạo nhân vật mới
    var btnStartNew = document.getElementById('btn-start-game');
    if (btnStartNew) {
      btnStartNew.addEventListener('click', function () {
        if (audioAPI) audioAPI.init();
        if (window.GameMusic) window.GameMusic.unlock();
        var nameInput = document.getElementById('input-char-name');
        var charName = (nameInput && nameInput.value.trim()) || 'Hà Nhân';

        var player = stateAPI.loadPlayer(charName);
        if (!player) {
          player = stateAPI.createPlayer(charName, {
            x: mapData.spawn.x,
            y: mapData.spawn.y,
            dir: 0
          });
          stateAPI.savePlayer(player);
        }

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
            if (continueBox) continueBox.classList.add('hidden');
            if (createBox) createBox.classList.remove('hidden');
          };
        }

        var btnBackToContinue = document.getElementById('btn-back-continue');
        if (btnBackToContinue) {
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
        engineAPI.start();
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
