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
  var skillSfxGain = null;
  var skillLimiter = null;

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

      // Chuoi skill rieng biet (SFX-CLIPFIX): skillSfxGain -> skillLimiter -> masterGain
      // Chan dinh sau diem nhan gain de khong bao gio cat song o am luong 100%
      skillSfxGain = ctx.createGain();
      skillSfxGain.gain.setValueAtTime(currentSettings.sfxVol, ctx.currentTime);

      try {
        var ws = ctx.createWaveShaper();
        var n = 65536;
        var curve = new Float32Array(n);
        var limit = 0.96; // Tran bien do -0.35 dBFS chong cat song tuyet doi
        var t = 0.88;     // Nguong tuyen tinh -1.11 dBFS, duoi nguong nay y = x (0 meo tieng)
        for (var i = 0; i < n; i++) {
          var x = (i / (n - 1)) * 2 - 1; // [-1.0, 1.0]
          var ax = Math.abs(x);
          if (ax <= t) {
            curve[i] = x;
          } else {
            var excess = ax - t;
            var sign = x < 0 ? -1 : 1;
            curve[i] = sign * (t + (limit - t) * Math.tanh(excess / (limit - t)));
          }
        }
        ws.curve = curve;
        skillLimiter = ws;
        skillSfxGain.connect(skillLimiter);
        skillLimiter.connect(masterGain);
      } catch (e) {
        skillLimiter = null;
        skillSfxGain.connect(masterGain);
      }

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
   * Đợt V1 chặng 1: tiếng tick độc — bọt khí trầm, trượt xuống (mỗi nhịp độc).
   */
  function playPoisonTick() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.18);

      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 1: tiếng hái Hoa Giải Độc — chuông nhẹ hai nốt, khác
   * playPickup (cao hơn, ngắn hơn) để nghe ra là hái hoa.
   */
  function playFlowerHarvest() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.exponentialRampToValueAtTime(784, now + 0.3);

      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 2: tiếng trượt trên băng — vệt trượt nhẹ, trượt xuống
   * (phát theo nhịp khi đang trượt quán tính, không phải mỗi khung).
   */
  function playIceSlide() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(170, now + 0.3);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 2: tiếng băng nứt — rắc sắc, ngắn (khi ô băng lên cấp nứt).
   */
  function playIceCrack() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 2: tiếng băng vỡ — trầm, nặng (khi ô băng vỡ, rơi xuống
   * nước lạnh).
   */
  function playIceBreak() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 3: tiếng rít báo trước khi dung nham phun — rít cao,
   * trượt xuống (phát một lần khi vào cửa sổ báo trước 2 giây, hồ sơ
   * 01 §3: "2 giây báo trước bằng tiếng rít và vệt sáng").
   */
  function playLavaWarn() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.5);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 3: tiếng dung nham phun trào — gầm trầm, nặng (khi cột
   * dung nham dựng lên, phát cùng lúc gây sát thương phun).
   */
  function playLavaErupt() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.5);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 4: tiếng gió bão cát Hoang Mạc — một đợt gió rít ngắn
   * (nhiễu trắng qua bandpass quét lên rồi xuống), dùng theo pha: intensity
   * thấp khi gió bắt đầu nổi (báo trước), 1 khi bão ập tới. Cùng mẫu
   * startTribWind trong tệp; Node không có WebAudio nên hàm trả về êm.
   */
  function playSandWindGust(intensity) {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var k = (typeof intensity === 'number' && isFinite(intensity)) ? Math.max(0, Math.min(1, intensity)) : 1;
      var now = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * 0.9);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.9);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045 + 0.075 * k, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      src.start(now);
      src.stop(now + 0.92);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 5: tiếng rung ngân kim loại báo trước kiếm rơi Kiếm Vũ
   * (sine rung ngân 650 -> 1100 Hz, 0.45s).
   */
  function playSwordRainWarn() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.4);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 5: tiếng kiếm rơi cắm xuống đất (triangle đanh 480 -> 90 Hz, 0.3s).
   */
  function playSwordFall() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.38, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 5: tiếng gió rít tích tụ kiếm khí quét (sawtooth 320 -> 780 Hz, 0.5s).
   */
  function playSwordSweepWarn() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.45);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  /**
   * Đợt V1 chặng 5: tiếng kiếm khí quét vụt ngang (sawtooth sắc bén 1150 -> 280 Hz, 0.35s).
   */
  function playSwordSweep() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1150, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.32);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.42, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.35);
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

  // Đợt T2 (chuẩn diễn độ kiếp — hồ sơ độ kiếp Vô Sắc mục 10): sấm xa khi
  // mây kiếp tụ + tiếng sét đánh xuống từng tia. Toàn bộ tổng hợp bằng
  // WebAudio (nhiễu qua lọc thông thấp + tiếng trầm dội), không tệp ngoài.
  var thunderNoiseBuffer = null;
  function getThunderNoiseBuffer(seconds) {
    if (!ctx) return null;
    if (thunderNoiseBuffer && thunderNoiseBuffer.duration >= seconds) return thunderNoiseBuffer;
    var len = Math.floor(ctx.sampleRate * seconds);
    thunderNoiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = thunderNoiseBuffer.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      // Nhiễu nâu (brown noise) — nền trầm của tiếng sấm
      var white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return thunderNoiseBuffer;
  }

  /** Sấm xa trầm kéo dài — pha tụ mây của độ kiếp. */
  function playThunderFar() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var buf = getThunderNoiseBuffer(2.2);
      if (!buf) return;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + 2.0);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      src.start(now);
      src.stop(now + 2.2);
    } catch (e) {}
  }

  /** Một tia sét đánh xuống: nhiễu cao tần xé rất ngắn + tiếng trầm dội nối tiếp.
   * Đợt KIẾP VÂN vòng 3: thêm đối số power01 (0..1 theo thang tia) — độ
   * lớn/độ trầm/dư âm tỉ lệ sức tia; KHÔNG truyền đối số thì giữ nguyên
   * hành vi cũ tuyệt đối (mọi nơi gọi cũ không đổi tiếng). */
  function playBolt(power01) {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var hasP = typeof power01 === 'number' && isFinite(power01);
      var p = hasP ? Math.max(0, Math.min(1, power01)) : 0;
      var crackGain = hasP ? 0.26 + 0.14 * p : 0.30;
      var crackDur = hasP ? 0.26 + 0.10 * p : 0.28;
      var subStart = hasP ? 110 - 25 * p : 120;
      var subPeak = hasP ? 0.30 + 0.18 * p : 0.34;
      var subDur = hasP ? 0.7 + 0.35 * p : 0.75;
      // Lớp xé cao tần
      var len = Math.floor(ctx.sampleRate * 0.5);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(900, now);
      var g1 = ctx.createGain();
      g1.gain.setValueAtTime(crackGain, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + crackDur);
      src.connect(hp);
      hp.connect(g1);
      g1.connect(sfxGain);
      src.start(now);
      src.stop(now + 0.5);
      // Lớp trầm dội
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(subStart, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + subDur - 0.05);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.exponentialRampToValueAtTime(subPeak, now + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + subDur);
      osc.connect(g2);
      g2.connect(sfxGain);
      osc.start(now);
      osc.stop(now + subDur + 0.05);
      // Dư âm rền ngắn sau đòn (chỉ khi có thang sức tia): nhiễu nâu qua
      // lowpass trầm, tắt dần ~0,9–1,4s — tiếng sét "lăn" sau cú nổ.
      if (hasP) {
        var tailBuf = getThunderNoiseBuffer(2.2);
        if (tailBuf) {
          var tailDur = 0.9 + 0.5 * p;
          var tSrc = ctx.createBufferSource();
          tSrc.buffer = tailBuf;
          var tFilter = ctx.createBiquadFilter();
          tFilter.type = 'lowpass';
          tFilter.frequency.setValueAtTime(140, now);
          var tGain = ctx.createGain();
          tGain.gain.setValueAtTime(0.0001, now);
          tGain.gain.exponentialRampToValueAtTime(0.10 + 0.12 * p, now + 0.04);
          tGain.gain.exponentialRampToValueAtTime(0.0001, now + tailDur);
          tSrc.connect(tFilter);
          tFilter.connect(tGain);
          tGain.connect(sfxGain);
          tSrc.start(now);
          tSrc.stop(now + tailDur + 0.05);
        }
      }
    } catch (e) {}
  }

  // =====================================================================
  // Đợt KIẾP VÂN vòng 3 — lớp nền âm thanh của cảnh độ kiếp: sấm rền khi
  // mây tụ (mức theo độ tụ), gió khi nhân vật bay lên (mức theo độ cao),
  // thiên âm khi độ kiếp thành công. Mọi lớp đều chạy qua sfxGain nên
  // tôn trọng âm lượng/tắt tiếng trong cài đặt của game; không tệp ngoài.
  // =====================================================================
  function tribClamp01(x) {
    x = (typeof x === 'number' && isFinite(x)) ? x : 0;
    return Math.max(0, Math.min(1, x));
  }

  var tribRumble = null; // { src, gain, filter }
  function startTribRumble() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      stopTribRumble(true);
      var buf = getThunderNoiseBuffer(2.2);
      if (!buf) return;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 120;
      filter.Q.value = 0.4;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      src.start();
      tribRumble = { src: src, gain: gain, filter: filter };
    } catch (e) {}
  }

  function setTribRumbleLevel(x) {
    if (!tribRumble || !ctx) return;
    try {
      tribRumble.gain.gain.setTargetAtTime(0.02 + 0.13 * tribClamp01(x), ctx.currentTime, 0.12);
    } catch (e) {}
  }

  function stopTribRumble(immediate) {
    if (!tribRumble || !ctx) { tribRumble = null; return; }
    var bed = tribRumble;
    tribRumble = null;
    try {
      var now = ctx.currentTime;
      bed.gain.gain.cancelScheduledValues(now);
      if (immediate) {
        bed.gain.gain.setValueAtTime(0.0001, now);
        bed.src.stop(now + 0.05);
      } else {
        bed.gain.gain.setTargetAtTime(0.0001, now, 0.09);
        bed.src.stop(now + 0.35);
      }
    } catch (e) {}
  }

  /** Thiên âm pha kết: ba nốt sine ngũ cung tấn công chậm, ngân dài,
   * sáng mà không chói — khác hẳn tiếng chuông nhiệm vụ playChime. */
  function playHeavenChime() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var now = ctx.currentTime;
      var notes = [
        { f: 587.33, t: 0.00 },
        { f: 880.00, t: 0.12 },
        { f: 1174.66, t: 0.24 }
      ];
      for (var i = 0; i < notes.length; i++) {
        var t0 = now + notes[i].t;
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = notes[i].f;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.075, t0 + 0.18);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
        o.connect(g);
        g.connect(sfxGain);
        o.start(t0);
        o.stop(t0 + 1.7);
        var o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = notes[i].f * 2;
        var g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, t0);
        g2.gain.exponentialRampToValueAtTime(0.018, t0 + 0.10);
        g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
        o2.connect(g2);
        g2.connect(sfxGain);
        o2.start(t0);
        o2.stop(t0 + 1.0);
      }
    } catch (e) {}
  }

  var tribWind = null; // { src, gain, lfo }
  function startTribWind() {
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      stopTribWind(true);
      var len = Math.floor(ctx.sampleRate * 1.5);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700;
      filter.Q.value = 0.6;
      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.4;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      src.start();
      lfo.start();
      tribWind = { src: src, gain: gain, lfo: lfo };
    } catch (e) {}
  }

  function setTribWindLevel(x) {
    if (!tribWind || !ctx) return;
    try {
      tribWind.gain.gain.setTargetAtTime(0.10 * tribClamp01(x), ctx.currentTime, 0.1);
    } catch (e) {}
  }

  function stopTribWind(immediate) {
    if (!tribWind || !ctx) { tribWind = null; return; }
    var bed = tribWind;
    tribWind = null;
    try {
      var now = ctx.currentTime;
      bed.gain.gain.cancelScheduledValues(now);
      bed.gain.gain.setTargetAtTime(0.0001, now, immediate ? 0.02 : 0.06);
      bed.src.stop(now + (immediate ? 0.08 : 0.25));
      if (bed.lfo) bed.lfo.stop(now + (immediate ? 0.08 : 0.25));
    } catch (e) {}
  }

  // =========================================================================
  // ÂM THANH 4 PHÁP QUYẾT LINH ĐIỀN (SKILL-SFX v1 — Bui duyệt 04:05 2026-11-13)
  // Tổng hợp thủ tục 100% bằng WebAudio, thang ngũ cung chung, hạt giống cố định.
  // =========================================================================

  // Hạt giống cố định cho giọt mưa lẻ và tia lấp lánh (LCG)
  function sfxSeededRand(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function sfxNoiseBuffer(audioCtx, seconds, seed) {
    var len = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var d = buf.getChannelData(0);
    var rnd = sfxSeededRand(seed || 12345);
    for (var i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
    return buf;
  }

  function sfxBellPartial(audioCtx, dest, freq, t0, vol, decaySec) {
    var partials = [[1, 1.0], [2.02, 0.55], [2.74, 0.32], [3.76, 0.18]];
    for (var i = 0; i < partials.length; i++) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * partials[i][0], t0);
      var gain = audioCtx.createGain();
      var d = decaySec * (1 - i * 0.13);
      gain.gain.setValueAtTime(vol * partials[i][1], t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(t0 + d + 0.05);
    }
  }

  function sfxPluck(audioCtx, dest, freq, t0, vol, decaySec) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    var filter = audioCtx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3, t0);
    filter.frequency.exponentialRampToValueAtTime(freq * 0.8, t0 + decaySec);
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decaySec);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + decaySec);
  }

  // Bảng hệ số bù gain: đưa RMS từ thang WebAudio thô lên RMS -20 dBFS (qua fader 0.8 x 0.8 = 0.64)
  // để khớp chính xác độ lớn bản clip nghe thử mà Bui đã duyệt.
  var SKILL_SFX_GAINS = {
    'linh-vu': 8.47,
    'thoi-sinh': 4.48,
    'dan-linh': 6.46,
    'tru-ue': 5.54
  };

  function createSkillDestNode(t0, gainVal) {
    var skillGain = ctx.createGain();
    skillGain.gain.setValueAtTime(gainVal, t0);
    var targetBus = skillSfxGain || sfxGain;
    try {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-1.5, t0);
      comp.ratio.setValueAtTime(12, t0);
      comp.knee.setValueAtTime(2, t0);
      comp.attack.setValueAtTime(0.002, t0);
      comp.release.setValueAtTime(0.05, t0);
      skillGain.connect(comp);
      comp.connect(targetBus);
    } catch (e) {
      skillGain.connect(targetBus);
    }
    return skillGain;
  }

  /** Skill 1 — Linh Vũ Quyết (Thủy): mưa linh tưới ruộng. ~2.1s */
  function playLinhVu() {
    if (!ctx) initAudio();
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime;
      var dest = createSkillDestNode(t0, SKILL_SFX_GAINS['linh-vu'] || 8.47);
      var buf = sfxNoiseBuffer(ctx, 2.2, 777);

      // Nền mưa chính
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, t0);
      bp.Q.value = 0.4;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.085, t0 + 0.18);
      g.gain.setValueAtTime(0.085, t0 + 1.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.05);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(t0);
      src.stop(t0 + 2.2);

      // Lớp xì cao (hạt mưa nhỏ)
      var src2 = ctx.createBufferSource();
      src2.buffer = buf;
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(4500, t0);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t0 + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.022, t0 + 0.25);
      g2.gain.setValueAtTime(0.022, t0 + 1.3);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.95);
      src2.connect(hp);
      hp.connect(g2);
      g2.connect(dest);
      src2.start(t0 + 0.05);
      src2.stop(t0 + 2.1);

      // Lớp vỗ trầm (mưa rơi xuống đất ướt)
      var src3 = ctx.createBufferSource();
      src3.buffer = buf;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(700, t0);
      var g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.0001, t0);
      g3.gain.exponentialRampToValueAtTime(0.05, t0 + 0.22);
      g3.gain.setValueAtTime(0.05, t0 + 1.3);
      g3.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);
      src3.connect(lp);
      lp.connect(g3);
      g3.connect(dest);
      src3.start(t0);
      src3.stop(t0 + 2.1);

      // Giọt mưa rơi lẻ: 12 plink cao rải đều có hạt giống
      var rnd = sfxSeededRand(4242);
      for (var i = 0; i < 12; i++) {
        var t = t0 + 0.15 + rnd() * 1.75;
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1700 + rnd() * 1400, t);
        var og = ctx.createGain();
        og.gain.setValueAtTime(0.035, t);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
        osc.connect(og);
        og.connect(dest);
        osc.start(t);
        osc.stop(t + 0.06);
      }
    } catch (e) {}
  }

  /** Skill 2 — Thôi Sinh Quyết (Mộc): thúc cây lớn nhanh. ~1.9s */
  function playThoiSinh() {
    if (!ctx) initAudio();
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime;
      var dest = createSkillDestNode(t0, SKILL_SFX_GAINS['thoi-sinh'] || 4.48);

      var notes = [293.66, 329.63, 392.00, 440.00, 523.25];
      for (var i = 0; i < notes.length; i++) {
        sfxPluck(ctx, dest, notes[i], t0 + 0.05 + i * 0.13, 0.12, 0.55);
      }

      // Nhựa dâng: triangle trầm, vào chậm, tắt ở 1.5s
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(146.83, t0);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 0.7);
      g.gain.setValueAtTime(0.05, t0 + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + 1.55);

      // Chuông đỉnh: nốt C5 ngân khi mầm chạm tán
      var t1 = t0 + 0.72;
      var o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(523.25, t1);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.001, t1);
      g2.gain.linearRampToValueAtTime(0.08, t1 + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.9);
      o2.connect(g2);
      g2.connect(dest);
      o2.start(t1);
      o2.stop(t1 + 0.95);

      var o3 = ctx.createOscillator();
      o3.type = 'sine';
      o3.frequency.setValueAtTime(1046.50, t1);
      var g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.001, t1);
      g3.gain.linearRampToValueAtTime(0.025, t1 + 0.02);
      g3.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.6);
      o3.connect(g3);
      g3.connect(dest);
      o3.start(t1);
      o3.stop(t1 + 0.65);
    } catch (e) {}
  }

  /** Skill 3 — Dẫn Linh Quyết (Vô): dẫn linh khí vào đất. ~2.2s */
  function playDanLinh() {
    if (!ctx) initAudio();
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime;
      var dest = createSkillDestNode(t0, SKILL_SFX_GAINS['dan-linh'] || 6.46);

      // Thiên âm: 3 nốt tấn công chậm, ngân dài (mẫu playHeavenChime)
      var notes = [
        { f: 392.00, t: 0.00 },
        { f: 440.00, t: 0.12 },
        { f: 587.33, t: 0.24 }
      ];
      for (var i = 0; i < notes.length; i++) {
        var t = t0 + notes[i].t;
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(notes[i].f, t);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.07, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + 1.7);
      }

      // Dải lụa vút lên: gliss sine 480 -> 1500 Hz
      var gl = ctx.createOscillator();
      gl.type = 'sine';
      gl.frequency.setValueAtTime(480, t0 + 0.1);
      gl.frequency.exponentialRampToValueAtTime(1500, t0 + 1.15);
      var gg = ctx.createGain();
      gg.gain.setValueAtTime(0.0001, t0 + 0.1);
      gg.gain.linearRampToValueAtTime(0.028, t0 + 0.45);
      gg.gain.setValueAtTime(0.028, t0 + 0.9);
      gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
      gl.connect(gg);
      gg.connect(dest);
      gl.start(t0 + 0.1);
      gl.stop(t0 + 1.25);

      // Chuông linh châu khi hội tụ
      sfxBellPartial(ctx, dest, 587.33, t0 + 1.15, 0.08, 1.0);

      // Tia lấp lánh cuối: 6 ping cao rải có hạt giống
      var rnd = sfxSeededRand(9001);
      for (var k = 0; k < 6; k++) {
        var tp = t0 + 1.25 + rnd() * 0.75;
        var op = ctx.createOscillator();
        op.type = 'sine';
        op.frequency.setValueAtTime(1700 + rnd() * 800, tp);
        var pg = ctx.createGain();
        pg.gain.setValueAtTime(0.018, tp);
        pg.gain.exponentialRampToValueAtTime(0.0001, tp + 0.07);
        op.connect(pg);
        pg.connect(dest);
        op.start(tp);
        op.stop(tp + 0.09);
      }
    } catch (e) {}
  }

  /** Skill 4 — Trừ Uế Quyết (Mộc): xua sâu bệnh cỏ dại. ~2.0s */
  function playTruUe() {
    if (!ctx) initAudio();
    if (!ctx || !sfxGain) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime;
      var dest = createSkillDestNode(t0, SKILL_SFX_GAINS['tru-ue'] || 5.54);

      // Sóng quét: bandpass 320 -> 2400 -> 520 Hz
      var buf = sfxNoiseBuffer(ctx, 1.15, 31337);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.7;
      bp.frequency.setValueAtTime(320, t0);
      bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.45);
      bp.frequency.exponentialRampToValueAtTime(520, t0 + 1.05);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.085, t0 + 0.2);
      g.gain.setValueAtTime(0.085, t0 + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.05);
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      src.start(t0);
      src.stop(t0 + 1.1);

      // Sương lắng: triangle trầm ngắn đầu tiếng
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(120, t0);
      o.frequency.exponentialRampToValueAtTime(55, t0 + 0.12);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.07, t0);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.connect(og);
      og.connect(dest);
      o.start(t0);
      o.stop(t0 + 0.15);

      // Chuông trong khi ruộng sạch + chuông phụ
      sfxBellPartial(ctx, dest, 587.33, t0 + 0.4, 0.10, 1.3);
      sfxBellPartial(ctx, dest, 880.00, t0 + 0.95, 0.05, 0.8);
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
    if (skillSfxGain && ctx) {
      skillSfxGain.gain.setValueAtTime(currentSettings.sfxVol, ctx.currentTime);
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
    playPoisonTick: playPoisonTick,
    playFlowerHarvest: playFlowerHarvest,
    playIceSlide: playIceSlide,
    playIceCrack: playIceCrack,
    playIceBreak: playIceBreak,
    playLavaWarn: playLavaWarn,
    playLavaErupt: playLavaErupt,
    playSandWindGust: playSandWindGust,
    playSwordRainWarn: playSwordRainWarn,
    playSwordFall: playSwordFall,
    playSwordSweepWarn: playSwordSweepWarn,
    playSwordSweep: playSwordSweep,
    playDull: playDull,
    playDeathGong: playDeathGong,
    playThunderFar: playThunderFar,
    playBolt: playBolt,
    startTribRumble: startTribRumble,
    setTribRumbleLevel: setTribRumbleLevel,
    stopTribRumble: stopTribRumble,
    playHeavenChime: playHeavenChime,
    startTribWind: startTribWind,
    setTribWindLevel: setTribWindLevel,
    stopTribWind: stopTribWind,
    playLinhVu: playLinhVu,
    playThoiSinh: playThoiSinh,
    playDanLinh: playDanLinh,
    playTruUe: playTruUe,
    SKILL_SFX_GAINS: SKILL_SFX_GAINS,
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
