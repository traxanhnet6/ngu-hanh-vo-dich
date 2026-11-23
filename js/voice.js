/**
 * voice.js — Lồng tiếng thoại (GameVoice)
 * Đợt 3 (Parent Note 3A): mọi câu thoại đều có audio, mỗi nhân vật một giọng.
 * Cơ chế: tải assets/voice/manifest.json (lineId -> {speaker, text, file, status}),
 * tra cứu theo NỘI DUNG CÂU THOẠI (chuẩn hoá khoảng trắng) + tên người nói,
 * phát qua một phần tử Audio duy nhất; chuyển câu/đóng thoại thì dừng câu cũ.
 * Câu chưa có audio (status khác 'ok' hoặc chưa có trong manifest) -> im lặng an toàn,
 * manifest vẫn ghi 'missing' trung thực — không bịa tệp.
 */
(function (global) {
  'use strict';

  var manifest = null;
  var byText = {};        // normText -> [{file, speaker}]
  var audioEl = null;
  var volume = 0.9;
  var enabled = true;
  var muted = false;
  var loaded = false;

  function norm(t) {
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  function addEntry(entry) {
    if (!entry || entry.status !== 'ok' || !entry.text || !entry.file) return;
    var key = norm(entry.text);
    if (!byText[key]) byText[key] = [];
    byText[key].push({ file: entry.file, speaker: entry.speaker || '' });
  }

  function load() {
    if (loaded) return;
    loaded = true;
    if (typeof fetch === 'undefined') return;
    fetch('assets/voice/manifest.json').then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (m) {
      if (!m) return;
      manifest = m;
      byText = {};
      if (Array.isArray(m)) {
        m.forEach(addEntry);
      } else {
        Object.keys(m).forEach(function (id) {
          var e = m[id];
          if (e && !e.file && e.status === 'ok') e.file = id + '.mp3';
          addEntry(e);
        });
      }
    }).catch(function () { /* không có manifest -> hệ giọng im lặng an toàn */ });
  }

  function ensureEl() {
    if (!audioEl && typeof Audio !== 'undefined') {
      audioEl = new Audio();
      audioEl.preload = 'auto';
      // Đợt 6: hết câu thoại thì trả nhạc nền về mức cũ
      audioEl.addEventListener('ended', function () { unduckMusic(); });
    }
    return audioEl;
  }

  // LIPSYNC-PROTO (2026-11-20, phương án A): đo độ to giọng realtime để lái miệng chân dung.
  // Gắn MediaElementAudioSourceNode + AnalyserNode vào đúng thẻ <audio> phát giọng.
  // Chỉ gắn khi AudioContext đang chạy (trong cử chỉ người dùng) — nếu ctx còn
  // 'suspended' thì KHÔNG gắn, giọng vẫn phát bình thường qua thẻ <audio> (không câm).
  // Mọi lỗi đều nuốt im: prototype không được phá giọng game.
  var lipCtx = null, lipAnalyser = null, lipData = null, lipLevel = 0, lipWarmTried = false;
  function warmLipSync() {
    try {
      var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      if (!lipCtx) lipCtx = new AC();
      if (lipCtx.state === 'suspended') {
        if (lipCtx.resume) { var pr = lipCtx.resume(); if (pr && pr.catch) pr.catch(function () {}); }
        return; // chưa chạy thì chưa gắn — thử lại ở cử chỉ sau
      }
      if (lipAnalyser || lipCtx.state !== 'running') return;
      var el = ensureEl();
      if (!el) return;
      var src = lipCtx.createMediaElementSource(el);
      lipAnalyser = lipCtx.createAnalyser();
      lipAnalyser.fftSize = 512;
      lipAnalyser.smoothingTimeConstant = 0;
      lipData = new Uint8Array(lipAnalyser.fftSize);
      src.connect(lipAnalyser);
      lipAnalyser.connect(lipCtx.destination);
    } catch (e) { lipCtx = null; lipAnalyser = null; lipData = null; }
  }
  function armLipSync() {
    // Gắn sớm ngay từ cử chỉ đầu tiên (pointerdown/keydown) để ctx chạy 'running'
    // trước khi câu thoại đầu tiên phát.
    if (lipWarmTried) return;
    lipWarmTried = true;
    try {
      var h = function () { warmLipSync(); };
      if (typeof document !== 'undefined') {
        document.addEventListener('pointerdown', h, true);
        document.addEventListener('keydown', h, true);
      }
    } catch (e) {}
  }
  // Độ to giọng hiện tại 0..1 (RMS của sóng, qua ngưỡng nhiễu, mượt hoá).
  // 0 = im lặng / chưa gắn analyser.
  function getVoiceLevel() {
    if (!lipAnalyser || !lipData) return 0;
    try {
      lipAnalyser.getByteTimeDomainData(lipData);
      var sum = 0;
      for (var i = 0; i < lipData.length; i++) { var v = (lipData[i] - 128) / 128; sum += v * v; }
      var rms = Math.sqrt(sum / lipData.length);
      var target = rms < 0.015 ? 0 : Math.max(0, Math.min(1, (rms - 0.02) / 0.16));
      lipLevel = target > lipLevel ? target : lipLevel * 0.7 + target * 0.3;
      return lipLevel;
    } catch (e) { return 0; }
  }
  function isVoicePlaying() {
    return !!audioEl && !audioEl.paused && !audioEl.ended && audioEl.currentTime > 0;
  }
  armLipSync();

  var ducked = false;
  function duckMusic() {
    try {
      if (typeof window === 'undefined' || !window.GameMusic || !window.GameMusic.setDucked) return;
      var st = window.GameState ? window.GameState.loadSettings() : null;
      if (st && st.duckMusic === false) return;
      window.GameMusic.setDucked(true);
      ducked = true;
    } catch (e) {}
  }
  function unduckMusic() {
    if (!ducked) return;
    ducked = false;
    try {
      if (typeof window !== 'undefined' && window.GameMusic && window.GameMusic.setDucked) window.GameMusic.setDucked(false);
    } catch (e) {}
  }

  /**
   * Phát giọng cho một câu thoại.
   * @param {string} speakerName - tên hiển thị của NPC đang nói (để phân biệt khi trùng câu)
   * @param {string} text - nội dung câu thoại đang hiển thị
   */
  function playFor(speakerName, text) {
    stop();
    if (!enabled || muted || !text) return;
    var list = byText[norm(text)];
    if (!list || list.length === 0) return;
    var entry = list[0];
    if (list.length > 1 && speakerName) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].speaker && speakerName.indexOf(list[i].speaker) !== -1) { entry = list[i]; break; }
        if (list[i].speaker && list[i].speaker.indexOf(speakerName) !== -1) { entry = list[i]; break; }
      }
    }
    var el = ensureEl();
    if (!el) return;
    try {
      warmLipSync(); // gắn analyser nếu ctx đã chạy (không gắn thì giọng vẫn phát thường)
      el.src = 'assets/voice/' + entry.file;
      el.volume = Math.max(0, Math.min(1, volume));
      duckMusic();
      var p = el.play();
      if (p && p.catch) p.catch(function () { unduckMusic(); });
    } catch (e) { unduckMusic(); }
  }

  function stop() {
    unduckMusic();
    if (audioEl) {
      try { audioEl.pause(); audioEl.currentTime = 0; } catch (e) {}
    }
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (audioEl) { try { audioEl.volume = volume; } catch (e) {} }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) stop();
  }

  function setMuted(on) {
    muted = !!on;
    if (muted) stop();
  }

  /** Thống kê bao phủ để kiểm thử: {total, ok} theo manifest đã tải (null nếu chưa tải). */
  function getCoverage() {
    if (!manifest) return null;
    var total = 0, ok = 0;
    var entries = Array.isArray(manifest) ? manifest : Object.keys(manifest).map(function (k) { return manifest[k]; });
    entries.forEach(function (e) {
      if (!e || typeof e !== 'object' || !('status' in e)) return;
      total++;
      if (e.status === 'ok') ok++;
    });
    return { total: total, ok: ok };
  }

  var GameVoice = {
    load: load,
    playFor: playFor,
    stop: stop,
    setVolume: setVolume,
    setEnabled: setEnabled,
    setMuted: setMuted,
    getCoverage: getCoverage,
    getVoiceLevel: getVoiceLevel,
    isVoicePlaying: isVoicePlaying,
    isLoaded: function () { return !!manifest; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameVoice;
  }
  if (typeof global !== 'undefined') {
    global.GameVoice = GameVoice;
  }
})(typeof window !== 'undefined' ? window : this);
