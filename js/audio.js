/**
 * audio.js — Bộ tổng hợp âm thanh thủ tục WebAudio
 * Bao gồm: nhạc nền ngũ cung tiên hiệp (pentatonic ambient loop) và hiệu ứng (bước chân, click, chuông nhiệm vụ).
 * Hoàn toàn bằng mã, không dùng tệp âm thanh ngoài. Tương thích Node.js (không lỗi cú pháp/môi trường).
 */
(function (global) {
  'use strict';

  var AudioContextClass = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;

  var ctx = null;
  var masterGain = null;
  var musicGain = null;
  var sfxGain = null;

  var isInitialized = false;
  var isPlayingMusic = false;
  var musicTimer = null;

  var currentSettings = {
    masterVol: 0.8,
    musicVol: 0.7,
    sfxVol: 0.8
  };

  // Thang âm ngũ cung Trung Hoa (Dung - Thương - Giác - Chủy - Vũ: D, E, G, A, C)
  var PENTATONIC_FREQS = [
    146.83, // D3
    164.81, // E3
    196.00, // G3
    220.00, // A3
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33  // D5
  ];

  var MELODY_SEQUENCE = [
    { note: 5, time: 0.0, dur: 1.8 },   // D4
    { note: 7, time: 2.0, dur: 1.5 },   // G4
    { note: 8, time: 4.0, dur: 2.2 },   // A4
    { note: 7, time: 6.5, dur: 1.2 },   // G4
    { note: 6, time: 8.0, dur: 1.8 },   // E4
    { note: 4, time: 10.0, dur: 1.8 },  // C4
    { note: 5, time: 12.0, dur: 3.5 }   // D4 ngân dài
  ];

  var LOOP_LENGTH_SEC = 16.0;
  var nextLoopStartTime = 0;

  function initAudio() {
    if (isInitialized || !AudioContextClass) return;
    try {
      ctx = new AudioContextClass();

      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(currentSettings.masterVol, ctx.currentTime);
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.setValueAtTime(currentSettings.musicVol, ctx.currentTime);
      musicGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.setValueAtTime(currentSettings.sfxVol, ctx.currentTime);
      sfxGain.connect(masterGain);

      isInitialized = true;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {
      // Bỏ qua lỗi trong môi trường không hỗ trợ WebAudio
    }
  }

  function startMusic() {
    if (!ctx) initAudio();
    if (!ctx || isPlayingMusic) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    isPlayingMusic = true;
    nextLoopStartTime = ctx.currentTime + 0.1;

    function scheduleLoop() {
      if (!isPlayingMusic || !ctx) return;
      var now = ctx.currentTime;
      while (nextLoopStartTime < now + 2.0) {
        schedulePentatonicBar(nextLoopStartTime);
        nextLoopStartTime += LOOP_LENGTH_SEC;
      }
      musicTimer = setTimeout(scheduleLoop, 1000);
    }

    scheduleLoop();
  }

  function stopMusic() {
    isPlayingMusic = false;
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = null;
    }
  }

  function schedulePentatonicBar(barStart) {
    if (!ctx || !musicGain) return;

    // Hợp âm đệm nền (Pad)
    playPadNote(PENTATONIC_FREQS[0], barStart, 7.8, 0.08); // D3
    playPadNote(PENTATONIC_FREQS[3], barStart, 7.8, 0.05); // A3
    playPadNote(PENTATONIC_FREQS[2], barStart + 8.0, 7.8, 0.08); // G3
    playPadNote(PENTATONIC_FREQS[5], barStart + 8.0, 7.8, 0.05); // D4

    // Giai điệu gảy đàn (Pluck Guzheng / Guqin)
    for (var i = 0; i < MELODY_SEQUENCE.length; i++) {
      var item = MELODY_SEQUENCE[i];
      var freq = PENTATONIC_FREQS[item.note];
      playGuzhengPluck(freq, barStart + item.time, item.dur);
    }
  }

  function playPadNote(freq, time, duration, vol) {
    if (!ctx || !musicGain) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 2.0);
      gain.gain.setValueAtTime(vol, time + duration - 2.0);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(musicGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  function playGuzhengPluck(freq, time, duration) {
    if (!ctx || !musicGain) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3, time);
      filter.frequency.exponentialRampToValueAtTime(freq * 0.8, time + duration);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.03); // gảy nhanh
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(musicGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  /**
   * Hiệu ứng bước chân khẽ (gentle tap)
   */
  function playStep() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      var now = ctx.currentTime;
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  /**
   * Hiệu ứng bấm nút / tương tác (click blip)
   */
  function playClick() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      var now = ctx.currentTime;
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  /**
   * Hiệu ứng chuông hoàn thành / thông báo nhiệm vụ
   */
  function playChime() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var notes = [587.33, 880.00, 1174.66]; // D5, A5, D6

      for (var i = 0; i < notes.length; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type = 'sine';
        var t = now + i * 0.08;
        osc.frequency.setValueAtTime(notes[i], t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

        osc.connect(gain);
        gain.connect(sfxGain);

        osc.start(t);
        osc.stop(t + 0.9);
      }
    } catch (e) {}
  }

  /**
   * Hiệu ứng gõ cửa gỗ / chạm cửa khóa
   */
  function playDoorKnock() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  /**
   * Hiệu ứng chém kiếm / dao củi (Slash swoosh)
   */
  function playSlash() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  /**
   * Hiệu ứng tung chiêu Phi Diệp Trảm (vút lá mộc)
   */
  function playLeafCast() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.22);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  }

  /**
   * Hiệu ứng Dây Leo Trói chân (tiếng rễ gai quấn)
   */
  function playVineSnare() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.18);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  /**
   * Hiệu ứng trúng đòn (thump impact)
   */
  function playHit() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }

  /**
   * Hiệu ứng nhặt chiến lợi phẩm (light crystal chime)
   */
  function playPickup() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  /**
   * Tiếng báo không đủ linh lực (dull thud)
   */
  function playDull() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  /**
   * Chuông tử vong khi người chơi gục ngã (Death bell)
   */
  function playDeathGong() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now); // A2
      osc.frequency.exponentialRampToValueAtTime(80, now + 2.5);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 2.5);
    } catch (e) {}
  }

  function setMusicVolume(vol) {
    currentSettings.musicVol = Math.max(0, Math.min(1, vol));
    if (musicGain && ctx) {
      musicGain.gain.setValueAtTime(currentSettings.musicVol, ctx.currentTime);
    }
  }

  function setSfxVolume(vol) {
    currentSettings.sfxVol = Math.max(0, Math.min(1, vol));
    if (sfxGain && ctx) {
      sfxGain.gain.setValueAtTime(currentSettings.sfxVol, ctx.currentTime);
    }
  }

  function setMasterVolume(vol) {
    currentSettings.masterVol = Math.max(0, Math.min(1, vol));
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(currentSettings.masterVol, ctx.currentTime);
    }
  }

  var AudioAPI = {
    init: initAudio,
    startMusic: startMusic,
    stopMusic: stopMusic,
    playStep: playStep,
    playClick: playClick,
    playChime: playChime,
    playDoorKnock: playDoorKnock,
    playSlash: playSlash,
    playLeafCast: playLeafCast,
    playVineSnare: playVineSnare,
    playHit: playHit,
    playPickup: playPickup,
    playDull: playDull,
    playDeathGong: playDeathGong,
    setMusicVolume: setMusicVolume,
    setSfxVolume: setSfxVolume,
    setMasterVolume: setMasterVolume,
    getSettings: function () { return currentSettings; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameAudio = AudioAPI;
  }
})(typeof window !== 'undefined' ? window : this);
