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
    playThunderFar: playThunderFar,
    playBolt: playBolt,
    startTribRumble: startTribRumble,
    setTribRumbleLevel: setTribRumbleLevel,
    stopTribRumble: stopTribRumble,
    playHeavenChime: playHeavenChime,
    startTribWind: startTribWind,
    setTribWindLevel: setTribWindLevel,
    stopTribWind: stopTribWind,
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
