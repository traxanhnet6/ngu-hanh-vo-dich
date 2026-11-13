/**
 * intro.js — Phân cảnh mở đầu giới thiệu khi vào game (GameIntro)
 * Dựa trên tài liệu INTRO-DESIGN.md theo chuẩn Hiến chương ANTIGRAVITY GAME STUDIO.
 * Tương thích cả Trình duyệt (DOM) và Node.js (Kiểm thử).
 * Tuyệt đối không dùng emoji.
 */
(function (global) {
  'use strict';

  var INTRO_SCENES = [
    {
      id: 1,
      speaker: 'Người Kể Chuyện',
      title: 'Miếu Hoang Núi Tuyết',
      bg: 'assets/art/map-mieu-hoang-bg.png',
      portrait: 'assets/chars/hanhan-face.png',
      text: 'Biên cương tuyết lạnh, gió bấc gào thét quanh đỉnh núi hoang sơ. Trong ngôi miếu cổ đổ nát qua bao năm tháng gió sương, thiếu niên phàm trần Hà Nhân cùng muội muội Linh Nhi nương tựa nhau để tìm một con đường sống sót giữa thế gian khắc nghiệt.',
      voiceHookId: 'intro-scene-1'
    },
    {
      id: 2,
      speaker: 'Linh Nhi',
      title: 'Nghịch Cảnh Phàm Trần',
      bg: 'assets/art/map-mieu-hoang-bg.png',
      portrait: 'assets/art/npc-linhnhi.png',
      text: 'Ca ca... Tuyết lớn thế này, ca ca lại lên rừng đốn củi. Bó củi nặng nhọc cả ngày chỉ đổi được ba đồng bạc vụn từ gã Mã Tam ở thành Tây Lương, chẳng đủ mua hai chiếc bánh bao, nói chi đến tiền thuốc men ngày mai hắn lại tới đòi...',
      voiceHookId: 'intro-scene-2'
    },
    {
      id: 3,
      speaker: 'Hà Nhân',
      title: 'Cơ Duyên Tiên Môn',
      bg: 'assets/art/map-tong-mon-bg.png',
      portrait: 'assets/chars/hanhan-face.png',
      text: 'Linh Nhi, muội đừng sợ! Phía nam Miếu Hoang chính là lối xuống Thanh Vân Tông. Nghe nói hôm nay Tiên Môn mở cửa thu nhận đệ tử. Dù chỉ là một tia hy vọng mong manh, ta cũng phải xuống núi cầu đạo, kiếm tìm linh đan cứu mạng muội!',
      voiceHookId: 'intro-scene-3'
    },
    {
      id: 4,
      speaker: 'Cổ Thư',
      title: 'Bí Ẩn Ngũ Hành',
      bg: 'assets/art/map-dai-dien-bg.png',
      portrait: 'assets/chars/fx-thaicuc-yinyang.png',
      text: 'Thế gian coi Ngũ Hành Tạp Linh Căn là phế vật, tu luyện gian nan gấp bội. Nhưng họ đâu biết: Kim sinh Thủy, Thủy sinh Mộc, Mộc sinh Hỏa, Hỏa sinh Thổ, Thổ lại sinh Kim! Vạn vật luân chuyển không ngừng. Nếu tu đều cả năm nhánh, đó chính là con đường Ngũ Hành Vô Địch!',
      voiceHookId: 'intro-scene-4'
    },
    {
      id: 5,
      speaker: 'Người Kể Chuyện',
      title: 'Khởi Hành Cầu Đạo',
      bg: 'assets/art/map-mieu-hoang-bg.png',
      portrait: 'assets/art/npc-linhnhi.png',
      text: 'Linh Nhi đã thu xếp xong tay nải, quyết tâm đi cùng ca ca. Tuyết ngoài miếu vẫn rơi, nhưng ngọn lửa nghịch thiên cải mệnh đã bùng cháy trong tâm khảm. Hãy bước tới nói chuyện với Linh Nhi để bắt đầu hành trình tu tiên!',
      voiceHookId: 'intro-scene-5'
    }
  ];

  var currentIndex = 0;
  var isShowingState = false;
  var onCompleteCallback = null;
  var isReplayMode = false;
  var activePlayerRef = null;

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    return null;
  }

  function getVoiceAPI() {
    if (typeof window !== 'undefined' && window.GameVoice) return window.GameVoice;
    if (typeof global !== 'undefined' && global.GameVoice) return global.GameVoice;
    return null;
  }

  function getAudioAPI() {
    if (typeof window !== 'undefined' && window.GameAudio) return window.GameAudio;
    if (typeof global !== 'undefined' && global.GameAudio) return global.GameAudio;
    return null;
  }

  function initIntro() {
    if (typeof document === 'undefined') return;

    var btnSkip = document.getElementById('btn-skip-intro');
    if (btnSkip && !btnSkip.dataset.wired) {
      btnSkip.dataset.wired = '1';
      btnSkip.addEventListener('click', function (e) {
        e.stopPropagation();
        var audio = getAudioAPI();
        if (audio && audio.playClick) audio.playClick();
        skipIntro();
      });
    }

    var btnNext = document.getElementById('btn-intro-next');
    if (btnNext && !btnNext.dataset.wired) {
      btnNext.dataset.wired = '1';
      btnNext.addEventListener('click', function (e) {
        e.stopPropagation();
        var audio = getAudioAPI();
        if (audio && audio.playClick) audio.playClick();
        nextIntroScene();
      });
    }

    var btnPrev = document.getElementById('btn-intro-prev');
    if (btnPrev && !btnPrev.dataset.wired) {
      btnPrev.dataset.wired = '1';
      btnPrev.addEventListener('click', function (e) {
        e.stopPropagation();
        var audio = getAudioAPI();
        if (audio && audio.playClick) audio.playClick();
        prevIntroScene();
      });
    }

    // Nhấp vào vùng nội dung hoặc phông nền mở đầu để chuyển cảnh nhanh (ngoại trừ nhấp nút)
    var overlay = document.getElementById('intro-overlay');
    if (overlay && !overlay.dataset.wired) {
      overlay.dataset.wired = '1';
      overlay.addEventListener('click', function (e) {
        var target = e.target;
        if (target.tagName === 'BUTTON' || target.closest('button')) {
          return;
        }
        var audio = getAudioAPI();
        if (audio && audio.playClick) audio.playClick();
        nextIntroScene();
      });
    }

    // Lắng nghe phím bấm: Phím Space / Enter để tiếp tục, phím Esc để bỏ qua
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', function (e) {
        if (!isShowingState) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          skipIntro();
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          nextIntroScene();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevIntroScene();
        }
      });
    }
  }

  function startIntro(player, onComplete, isReplay) {
    activePlayerRef = player || null;
    onCompleteCallback = typeof onComplete === 'function' ? onComplete : null;
    isReplayMode = !!isReplay;
    currentIndex = 0;
    isShowingState = true;

    if (typeof document !== 'undefined') {
      var overlay = document.getElementById('intro-overlay');
      if (overlay) {
        overlay.classList.remove('hidden');
      }
    }

    showScene(0);
  }

  function showScene(index) {
    if (index < 0) index = 0;
    if (index >= INTRO_SCENES.length) {
      finishIntro();
      return;
    }

    currentIndex = index;
    var scene = INTRO_SCENES[index];

    // Phát móc giọng qua GameVoice nếu có sẵn
    var voice = getVoiceAPI();
    if (voice && voice.playFor) {
      voice.stop();
      voice.playFor(scene.speaker, scene.text);
    }

    if (typeof document === 'undefined') return;

    var overlay = document.getElementById('intro-overlay');
    var bgEl = document.getElementById('intro-bg');
    var speakerEl = document.getElementById('intro-speaker');
    var titleEl = document.getElementById('intro-scene-title');
    var textEl = document.getElementById('intro-text');
    var portraitEl = document.getElementById('intro-portrait');
    var portraitWrap = document.getElementById('intro-portrait-wrap');
    var progressEl = document.getElementById('intro-progress-tag');
    var btnPrev = document.getElementById('btn-intro-prev');
    var btnNext = document.getElementById('btn-intro-next');

    if (overlay) overlay.classList.remove('hidden');

    if (bgEl && scene.bg) {
      bgEl.style.backgroundImage = 'url("' + scene.bg + '")';
    }

    if (speakerEl) speakerEl.textContent = scene.speaker;
    if (titleEl) titleEl.textContent = scene.title;
    if (textEl) {
      // Thay thế tên nhân vật thực tế nếu người chơi đổi tên
      var textContent = scene.text;
      if (activePlayerRef && activePlayerRef.name && activePlayerRef.name !== 'Hà Nhân') {
        textContent = textContent.replace(/Hà Nhân/g, activePlayerRef.name);
      }
      textEl.textContent = textContent;
    }

    if (portraitEl && portraitWrap) {
      if (scene.portrait) {
        portraitEl.src = scene.portrait;
        portraitEl.alt = scene.speaker;
        portraitWrap.style.display = 'flex';
      } else {
        portraitWrap.style.display = 'none';
      }
    }

    if (progressEl) {
      progressEl.textContent = 'MỞ ĐẦU — Cảnh ' + (index + 1) + '/' + INTRO_SCENES.length;
    }

    if (btnPrev) {
      btnPrev.style.visibility = (index === 0) ? 'hidden' : 'visible';
    }

    if (btnNext) {
      if (index === INTRO_SCENES.length - 1) {
        btnNext.textContent = isReplayMode ? 'Đóng' : 'Bắt Đầu Tu Luyện';
      } else {
        btnNext.textContent = 'Tiếp Theo';
      }
    }
  }

  function nextIntroScene() {
    if (!isShowingState) return;
    if (currentIndex >= INTRO_SCENES.length - 1) {
      finishIntro();
    } else {
      showScene(currentIndex + 1);
    }
  }

  function prevIntroScene() {
    if (!isShowingState) return;
    if (currentIndex > 0) {
      showScene(currentIndex - 1);
    }
  }

  function skipIntro() {
    if (!isShowingState) return;
    finishIntro();
  }

  function finishIntro() {
    isShowingState = false;

    var voice = getVoiceAPI();
    if (voice && voice.stop) {
      voice.stop();
    }

    // Đánh dấu cờ introSeen cho người chơi và cấu hình hệ thống
    if (!isReplayMode) {
      var state = getStateAPI();
      if (state) {
        // Lưu vào cài đặt
        var currentSettings = state.loadSettings();
        currentSettings.introSeen = true;
        state.saveSettings(currentSettings);

        // Lưu vào dữ liệu nhân vật nếu có
        if (activePlayerRef) {
          activePlayerRef.introSeen = true;
          state.savePlayer(activePlayerRef);
        }
      } else if (activePlayerRef) {
        activePlayerRef.introSeen = true;
      }
    }

    if (typeof document !== 'undefined') {
      var overlay = document.getElementById('intro-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }

    if (onCompleteCallback) {
      var cb = onCompleteCallback;
      onCompleteCallback = null;
      cb();
    }
  }

  /**
   * Kiểm tra xem nhân vật có cần hiện mở đầu không
   * Luật:
   * - Nhân vật mới (chưa có introSeen): return true
   * - Save cũ: nếu đã có introSeen, hoặc đã có tu vi/đã từng nói chuyện Linh Nhi/đã có trang bị: return false
   */
  function shouldShowIntroForPlayer(player) {
    if (!player) return false;
    if (player.introSeen === true) return false;

    // Kiểm tra dấu hiệu save cũ để tuyệt đối không ép người chơi cũ xem lại
    if (player.quests && (player.quests.talked_linhnhi || player.quests.sectStage > 0 || player.quests.huntCompleted)) {
      return false;
    }
    if (player.tuVi && (player.tuVi.kim > 0 || player.tuVi.moc > 0 || player.tuVi.thuy > 0 || player.tuVi.hoa > 0 || player.tuVi.tho > 0)) {
      return false;
    }
    if (player.paths && (
      (player.paths.kim && player.paths.kim.tuVi > 0) ||
      (player.paths.moc && player.paths.moc.tuVi > 0) ||
      (player.paths.thuy && player.paths.thuy.tuVi > 0) ||
      (player.paths.hoa && player.paths.hoa.tuVi > 0) ||
      (player.paths.tho && player.paths.tho.tuVi > 0)
    )) {
      return false;
    }
    if (player.equipment && (player.equipment.weapon || player.equipment.armor)) {
      return false;
    }

    // Kiểm tra cài đặt toàn cục: nếu đã từng đánh dấu hoàn thành mở đầu trên máy này và là nhân vật cũ
    var state = getStateAPI();
    if (state) {
      var s = state.loadSettings();
      if (s && s.introSeen && player.lastSaved) {
        return false;
      }
    }

    return true;
  }

  var GameIntro = {
    init: initIntro,
    startIntro: startIntro,
    showScene: showScene,
    nextScene: nextIntroScene,
    prevScene: prevIntroScene,
    skipIntro: skipIntro,
    finishIntro: finishIntro,
    shouldShowIntroForPlayer: shouldShowIntroForPlayer,
    isShowing: function () { return isShowingState; },
    getCurrentIndex: function () { return currentIndex; },
    getScenes: function () { return INTRO_SCENES.slice(); }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameIntro;
  }
  if (typeof global !== 'undefined') {
    global.GameIntro = GameIntro;
  }
})(typeof window !== 'undefined' ? window : this);
