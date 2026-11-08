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
    }
    return audioEl;
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
      el.src = 'assets/voice/' + entry.file;
      el.volume = Math.max(0, Math.min(1, volume));
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* trình duyệt chặn -> bỏ qua */ });
    } catch (e) { /* bỏ qua lỗi phát */ }
  }

  function stop() {
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
    isLoaded: function () { return !!manifest; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameVoice;
  }
  if (typeof global !== 'undefined') {
    global.GameVoice = GameVoice;
  }
})(typeof window !== 'undefined' ? window : this);
