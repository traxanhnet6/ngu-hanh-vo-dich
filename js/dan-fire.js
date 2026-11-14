/**
 * dan-fire.js — Đợt DANFIRE: lửa 3 mức + khói Ngưng Đan + khói 2 bên cho Đan Lô.
 *
 * CHƯA NGHIỆM THU (Bui duyệt lửa/khói riêng, ghép lên web một lượt).
 * Khung thật từ moments đã sao chép vào assets/art/danlo-*.
 * Node-loadable & chạy trên trình duyệt.
 */
(function (exports) {
  'use strict';

  var FIRE_FRAMES = 96;
  var FIRE_FPS = 8;
  var SMOKE_FRAMES = 96;
  var SMOKE_FPS = 8;
  var WISP_FRAMES = 8;
  var WISP_FPS = 8;
  var PRELOAD_CONCURRENCY = 16;

  function pad3(n) { n = Math.max(0, Math.floor(n)); var s = String(n); while (s.length < 3) s = '0' + s; return s; }

  // DANFIRE3: đỉnh tượng trên nắp theo khung lửa — biên đạo nắp lặp chu kỳ 24
  // khung, giống hệt ở cả 3 mức (đo thật trên khung: 165 nắp đóng, 64 nắp mở).
  // Dải wisp neo đáy theo đỉnh tượng để vệt luôn nối liền tượng và bốc lên trên.
  var LID_TOP_24 = [165, 165, 165, 165, 135, 109, 89, 76, 67, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 89, 115, 140, 165];
  var WISP_STRETCH = 1.4;
  var WISP_BASE_OVERLAP = 8;

  function framePathFire(level, frame) {
    level = Math.max(1, Math.min(3, Math.floor(level || 1)));
    return 'assets/art/danlo-fire/level-' + level + '/f' + pad3(frame % FIRE_FRAMES) + '.png';
  }
  function framePathSmoke(frame) {
    return 'assets/art/danlo-smoke-sides/f' + pad3(frame % SMOKE_FRAMES) + '.png';
  }
  function framePathWisp(grade, frame) {
    grade = (grade === 'cuc' || grade === 'thuong' || grade === 'trung' || grade === 'ha') ? grade : 'trung';
    return 'assets/art/danlo-wisp/' + grade + '/wisp-f' + (frame % WISP_FRAMES) + '.png';
  }

  var cache = {};
  var preloadStarted = false;
  var loadStats = { total: 0, done: 0, failed: 0 };

  function getEngine() {
    if (typeof window !== 'undefined' && window.GameEngine) return window.GameEngine;
    if (typeof global !== 'undefined' && global.GameEngine) return global.GameEngine;
    try { return require('./engine.js'); } catch (e) { return null; }
  }

  function getPlayer() {
    var eng = getEngine();
    if (eng && typeof eng.getPlayer === 'function') {
      try { return eng.getPlayer(); } catch (e) { return null; }
    }
    return null;
  }

  function isBurning() {
    var eng = getEngine();
    if (eng && typeof eng.isDanLoBurning === 'function') {
      try { if (eng.isDanLoBurning()) return true; } catch (e) {}
    }
    if (typeof window !== 'undefined' && window.__danLoBurningUntil && Date.now() < window.__danLoBurningUntil) return true;
    var p = getPlayer();
    if (p && p.luyenDan && p.luyenDan.lastRefineAt) {
      if (Date.now() - p.luyenDan.lastRefineAt < 60000) return true;
    }
    return false;
  }

  function getFireLevel(player) {
    player = player || getPlayer();
    if (!player || !player.luyenDan) return 2;
    var lv = player.luyenDan.lastHeatLevel;
    if (typeof lv !== 'number' || lv < 1 || lv > 3) return 2;
    return Math.floor(lv);
  }

  function getNgungDanWisp() {
    if (typeof window !== 'undefined' && window.__danLoNgungDanUntil && Date.now() < window.__danLoNgungDanUntil) {
      return window.__danLoNgungDanWisp || null;
    }
    return null;
  }

  function preload() {
    if (preloadStarted) return;
    if (typeof window === 'undefined' || typeof window.Image !== 'function') return;
    preloadStarted = true;
    var urls = [];
    for (var l = 1; l <= 3; l++) {
      for (var f = 0; f < FIRE_FRAMES; f++) urls.push(framePathFire(l, f));
    }
    for (var s = 0; s < SMOKE_FRAMES; s++) urls.push(framePathSmoke(s));
    var grades = ['ha', 'trung', 'thuong', 'cuc'];
    for (var g = 0; g < grades.length; g++) {
      for (var w = 0; w < WISP_FRAMES; w++) urls.push(framePathWisp(grades[g], w));
    }
    // dedupe
    var seen = {};
    var uniq = [];
    for (var i = 0; i < urls.length; i++) { if (!seen[urls[i]]) { seen[urls[i]] = 1; uniq.push(urls[i]); } }
    urls = uniq;
    loadStats.total = urls.length;
    var next = 0;
    var inFlight = 0;
    function pump() {
      while (inFlight < PRELOAD_CONCURRENCY && next < urls.length) {
        (function (url) {
          inFlight++;
          var img = new window.Image();
          cache[url] = img;
          img.onload = function () { loadStats.done++; inFlight--; pump(); };
          img.onerror = function () { loadStats.failed++; inFlight--; pump(); };
          img.src = url;
        })(urls[next]);
        next++;
      }
    }
    pump();
  }

  function getImage(url) {
    var img = cache[url];
    if (img && img.complete && img.naturalWidth > 0) return img;
    return null;
  }

  function drawDanLo(ctx, std, nowMs) {
    if (!ctx || !std || !isBurning()) return false;
    nowMs = (typeof nowMs === 'number') ? nowMs : Date.now();
    var level = getFireLevel(getPlayer());
    var fi = Math.floor(nowMs / (1000 / FIRE_FPS)) % FIRE_FRAMES;
    var fireImg = getImage(framePathFire(level, fi));
    if (fireImg) {
      ctx.drawImage(fireImg, std.x, std.y, std.w, std.h);
    } else {
      return false;
    }
    // khói 2 bên thường trực khi cháy
    var si = fi % SMOKE_FRAMES;
    var smokeImg = getImage(framePathSmoke(si));
    if (smokeImg) {
      ctx.drawImage(smokeImg, std.x, std.y, std.w, std.h);
    }
    // vệt khói giữa lúc ngưng đan — DANFIRE3: dải wisp kéo dài dọc 1.4x,
    // đáy neo theo đỉnh tượng của đúng khung lửa đang vẽ để vệt luôn nối
    // liền tượng và bốc cao lên nền trống như clip mẫu ở mọi pha nắp
    var wispGrade = getNgungDanWisp();
    if (wispGrade) {
      var wi = Math.floor(nowMs / (1000 / WISP_FPS)) % WISP_FRAMES;
      var wispImg = getImage(framePathWisp(wispGrade, wi));
      if (wispImg) {
        var wH = std.h * (165 / 706) * WISP_STRETCH;
        var wBottom = std.y + std.h * ((LID_TOP_24[fi % 24] + WISP_BASE_OVERLAP) / 706);
        ctx.drawImage(wispImg, std.x, wBottom - wH, std.w, wH);
      }
    }
    return true;
  }

  exports.FIRE_FRAMES = FIRE_FRAMES;
  exports.FIRE_FPS = FIRE_FPS;
  exports.SMOKE_FRAMES = SMOKE_FRAMES;
  exports.SMOKE_FPS = SMOKE_FPS;
  exports.WISP_FRAMES = WISP_FRAMES;
  exports.WISP_FPS = WISP_FPS;
  exports.framePathFire = framePathFire;
  exports.framePathSmoke = framePathSmoke;
  exports.framePathWisp = framePathWisp;
  exports.preload = preload;
  exports.isBurning = isBurning;
  exports.getFireLevel = getFireLevel;
  exports.getNgungDanWisp = getNgungDanWisp;
  exports.drawDanLo = drawDanLo;
  exports.getLoadStats = function () { return { total: loadStats.total, done: loadStats.done, failed: loadStats.failed }; };

  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(function () { try { preload(); } catch (e) {} }, 800);
  }

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameDanFire = {}));
