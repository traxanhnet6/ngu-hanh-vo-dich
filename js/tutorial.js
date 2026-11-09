/**
 * tutorial.js — Hệ thống hướng dẫn tân thủ (Đợt 6 — Giai đoạn 2 Việc 6 & Hồ sơ 16, 26)
 * Lắng nghe sự kiện thật trong game, không chặn thao tác của người chơi.
 */
(function (global) {
  'use strict';

  var TUTORIAL_STEPS = [
    {
      id: 1,
      targetSelector: '#game-container',
      text: 'Chào mừng đạo hữu! Chạm vào mặt đất để bước đi.',
      pos: 'bottom-center'
    },
    {
      id: 2,
      targetSelector: '#joystick-zone',
      text: 'Cần gậy điều khiển ở góc trái dưới giúp di chuyển mượt mà.',
      pos: 'bottom-left'
    },
    {
      id: 3,
      targetSelector: '#char-frame',
      text: 'Tới gần và chạm vào Linh Nhi trước miếu hoang để nói chuyện.',
      pos: 'top-left'
    },
    {
      id: 4,
      targetSelector: '#quest-panel',
      text: 'Mũi tên vàng + dấu ! chỉ mục tiêu. Nhiệm vụ đầu game sẽ tự dẫn đường — cứ đi theo!',
      pos: 'top-left',
      autoFinishMs: 6000
    },
    {
      id: 5,
      targetSelector: '#skill-bar',
      text: 'Chiến đấu: Nút Đánh + hai chiêu Phi Diệp/Dây Leo ở góc phải dưới.',
      pos: 'bottom-right'
    },
    {
      id: 6,
      targetSelector: '#btn-bag',
      text: 'Nút Túi: xem và dùng vật phẩm, trang bị đồ hộ thân.',
      pos: 'top-right'
    },
    {
      id: 7,
      targetSelector: '#minimap-wrap',
      text: 'Thấy mũi tên chỉ xuống ở cổng? Đó là lối sang bản đồ khác.',
      pos: 'top-right'
    },
    {
      id: 8,
      targetSelector: '#char-frame',
      text: 'Năm đường tu Kim Mộc Thủy Hỏa Thổ — đường yếu nhất kéo sức mạnh chung; hãy tu đều!',
      pos: 'top-left'
    }
  ];

  var currentStep = 1;
  var isDone = false;
  var isActive = false;
  var autoTimer = null;

  function getSettingsAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    return null;
  }

  function initTutorial() {
    var st = getSettingsAPI();
    if (!st) return;
    var s = st.loadSettings();

    // Chỉ tự bật lần đầu cho nhân vật mới (settings chưa có cờ tutorialDone)
    if (s.tutorialDone) {
      isDone = true;
      currentStep = s.tutorialStep || 8;
      hideOverlay();
      return;
    }

    currentStep = s.tutorialStep || 1;
    isDone = false;
    showStep(currentStep);
    bindEvents();
  }

  function showStep(stepNum) {
    if (isDone) return;
    if (stepNum > TUTORIAL_STEPS.length) {
      finishTutorial();
      return;
    }

    currentStep = stepNum;
    var st = getSettingsAPI();
    if (st) {
      st.saveSettings({ tutorialStep: currentStep });
    }

    var stepDef = TUTORIAL_STEPS[stepNum - 1];
    if (!stepDef) return;

    var overlay = document.getElementById('tutorial-overlay');
    var textEl = document.getElementById('tutorial-text');
    var stepTextEl = document.getElementById('tutorial-step-text');
    var box = document.getElementById('tutorial-box');
    var spotlight = document.getElementById('tutorial-spotlight');

    if (!overlay || !textEl || !box) return;

    textEl.textContent = stepDef.text;
    if (stepTextEl) {
      stepTextEl.textContent = 'Bước ' + stepNum + '/' + TUTORIAL_STEPS.length;
    }

    // Định vị khung spotlight và hộp chữ
    updateHighlight(stepDef.targetSelector, stepDef.pos);

    overlay.classList.remove('hidden');
    isActive = true;

    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }

    if (stepDef.autoFinishMs) {
      autoTimer = setTimeout(function () {
        advanceStep(stepNum);
      }, stepDef.autoFinishMs);
    }
  }

  function updateHighlight(selector, posHint) {
    var spotlight = document.getElementById('tutorial-spotlight');
    var box = document.getElementById('tutorial-box');
    if (!spotlight || !box) return;

    var targetEl = selector ? document.querySelector(selector) : null;
    if (targetEl) {
      var r = targetEl.getBoundingClientRect();
      spotlight.style.display = 'block';
      spotlight.style.left = (r.left - 6) + 'px';
      spotlight.style.top = (r.top - 6) + 'px';
      spotlight.style.width = (r.width + 12) + 'px';
      spotlight.style.height = (r.height + 12) + 'px';
    } else {
      spotlight.style.display = 'none';
    }

    // Định vị hộp chữ theo gợi ý hoặc góc màn hình phù hợp
    box.className = 'panel tutorial-box pos-' + (posHint || 'bottom-center');
  }

  function advanceStep(fromStep) {
    if (fromStep !== undefined && fromStep !== currentStep) return;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    if (currentStep >= TUTORIAL_STEPS.length) {
      finishTutorial();
    } else {
      showStep(currentStep + 1);
    }
  }

  function finishTutorial() {
    isDone = true;
    isActive = false;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    var st = getSettingsAPI();
    if (st) {
      st.saveSettings({ tutorialDone: true, tutorialStep: TUTORIAL_STEPS.length });
    }
    hideOverlay();
  }

  function skipTutorial() {
    finishTutorial();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast('Đã bỏ qua hướng dẫn tân thủ.');
    }
  }

  function restartTutorial() {
    isDone = false;
    currentStep = 1;
    var st = getSettingsAPI();
    if (st) {
      st.saveSettings({ tutorialDone: false, tutorialStep: 1 });
    }
    showStep(1);
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast('Bắt đầu lại hướng dẫn tân thủ.');
    }
  }

  function resumeTutorial() {
    isDone = false;
    var st = getSettingsAPI();
    if (st) {
      var s = st.loadSettings();
      currentStep = s.tutorialStep || 1;
      st.saveSettings({ tutorialDone: false });
    }
    showStep(currentStep);
  }

  function hideOverlay() {
    var overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.classList.add('hidden');
    isActive = false;
  }

  // Lắng nghe sự kiện thật từ Engine và UI
  function bindEvents() {
    var btnSkip = document.getElementById('btn-skip-tutorial');
    if (btnSkip && !btnSkip.dataset.wired) {
      btnSkip.dataset.wired = '1';
      btnSkip.addEventListener('click', skipTutorial);
    }

    // Bước 1: Nhân vật di chuyển bằng chạm lần đầu
    if (typeof window !== 'undefined') {
      window.addEventListener('player_first_move', function () {
        if (currentStep === 1) advanceStep(1);
      });
      // Bước 2: Joystick được dùng
      window.addEventListener('joystick_used', function () {
        if (currentStep === 2) advanceStep(2);
      });
      // Bước 3: Mở thoại lần đầu
      window.addEventListener('dialogue_opened', function () {
        if (currentStep === 3) advanceStep(3);
      });
      // Bước 4: Bấm nút panel hoặc tự tìm đường
      window.addEventListener('autopath_started', function () {
        if (currentStep === 4) advanceStep(4);
      });
      // Bước 5: Chiến đấu tung đòn / chiêu
      window.addEventListener('combat_action', function () {
        if (currentStep === 5) advanceStep(5);
      });
      // Bước 6: Mở túi đồ
      window.addEventListener('bag_opened', function () {
        if (currentStep === 6) advanceStep(6);
      });
      // Bước 7: Chuyển bản đồ qua cổng
      window.addEventListener('map_switched', function () {
        if (currentStep === 7) advanceStep(7);
      });
      // Bước 8: Đóng bảng nhân vật
      window.addEventListener('char_panel_closed', function () {
        if (currentStep === 8) advanceStep(8);
      });
    }
  }

  var TutorialAPI = {
    init: initTutorial,
    showStep: showStep,
    advanceStep: advanceStep,
    finishTutorial: finishTutorial,
    skipTutorial: skipTutorial,
    restartTutorial: restartTutorial,
    resumeTutorial: resumeTutorial,
    getCurrentStep: function () { return currentStep; },
    isDone: function () { return isDone; },
    isActive: function () { return isActive; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TutorialAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameTutorial = TutorialAPI;
  }
})(typeof window !== 'undefined' ? window : this);
