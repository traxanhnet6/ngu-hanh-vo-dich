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

    // Xử lý tạo nhân vật mới
    var btnStartNew = document.getElementById('btn-start-game');
    if (btnStartNew) {
      btnStartNew.addEventListener('click', function () {
        if (audioAPI) audioAPI.init();
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
        launchGame(player);
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
            var targetName = activeName || list[0];
            var player = stateAPI.loadPlayer(targetName);
            if (!player) {
              player = stateAPI.createPlayer(targetName);
              stateAPI.savePlayer(player);
            }
            launchGame(player);
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
