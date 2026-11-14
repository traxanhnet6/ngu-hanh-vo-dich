/**
 * spell-vfx.js — Hiệu ứng hình ảnh 4 pháp quyết linh điền (Đợt SPELLFX-INTEGRATE)
 *
 * Bui báo 14:23 ngày 2026-11-13: nhân vật thi triển pháp quyết nhưng không hiện
 * hiệu ứng kỹ năng đã chọn. Căn nguyên: window.GameVFX chưa từng được định nghĩa
 * — mọi điểm gọi GameVFX.onSpellCast (linhdien.js thị phạm + nút quyết, ui.js
 * thanh kỹ năng ruộng + nút quyết trong modal Vườn) đều có lính gác nên lặng lẽ
 * không làm gì. Mô đun này hiện thực móc đó: phát chuỗi khung hiệu ứng SPELLFX
 * đúng quyết + đúng bậc, đúng vị trí ô trên ruộng, lớp trên mặt đất dưới thực thể.
 *
 * Hình hiệu ứng: CHƯA NGHIỆM THU (Bui đang phán 4 clip mẫu vòng 3 / Linh Vũ V3B).
 * Khung: assets/fx/spell/<quyết>/tier<1-3>/{frames,shadow}/f000..f015.png,
 * 16 khung/bậc, 12fps. Hình học neo theo đúng clip đã dựng (clip geo khớp tọa độ
 * ô thật trong js/tong-mon-farm.js PLOTS_CONFIG — xem SPELLFX-INTEGRATE-REPORT.md).
 *
 * Node-loadable & chạy trên trình duyệt. Không đổi số/phí/hồi chiêu/logic nào.
 */

(function (exports) {
  'use strict';

  // ---------------------------------------------------------------------------
  // HẰNG SỐ HÌNH HỌC (đo từ clip SPELLFX + đối chiếu PLOTS_CONFIG)
  // ---------------------------------------------------------------------------
  var SKILLS = ['linh-vu', 'thoi-sinh', 'dan-linh', 'tru-ue'];
  var FRAMES_PER_TIER = 16;
  var FPS = 12;
  var DURATION_MS = (FRAMES_PER_TIER / FPS) * 1000; // 1333ms
  var BASE_PATH = 'assets/fx/spell/';

  // Khung phủ ruộng (linh-vu / dan-linh / tru-ue): canvas 440x540 đặt tại
  // lát camera clip (20,60) trên lát x0=280 -> tọa độ thế giới (300,60).
  // Phủ Thượng Điền + Trung Điền + Hạ Điền 1; phạm vi theo bậc nằm sẵn trong
  // từng khung hình (bậc 1: 1 ô, bậc 2: 6 ô Trung Điền, bậc 3: toàn khung).
  var FIELD_RECT = { x: 300, y: 60, w: 440, h: 540 };

  // Thôi Sinh: canvas một ô 220x220, điểm gốc (110,168) đặt tại tâm ô.
  var TS_CANVAS = { w: 220, h: 220 };
  var TS_ORIGIN = { x: 110, y: 168 };
  // Số ô theo bậc — manifest plots_per_tier (Bui 03:01): 1 -> 3 -> 6 ô Trung Điền.
  var TS_PLOTS_BY_TIER = { 1: [11], 2: [11, 12, 8], 3: [8, 9, 10, 11, 12, 13] };

  // Bảng tọa độ 32 ô ruộng (dự phòng khi GameTongMonFarm chưa sẵn sàng).
  // Sao đúng PLOTS_CONFIG trong js/tong-mon-farm.js (đã đối chiếu clip geo).
  var FALLBACK_PLOTS = [
    { x: 300, y: 160 }, { x: 390, y: 160 }, { x: 300, y: 205 }, { x: 390, y: 205 },
    { x: 300, y: 250 }, { x: 390, y: 250 }, { x: 300, y: 295 }, { x: 390, y: 295 },
    { x: 580, y: 190 }, { x: 660, y: 190 }, { x: 740, y: 190 }, { x: 580, y: 260 },
    { x: 660, y: 260 }, { x: 740, y: 260 }, { x: 360, y: 490 }, { x: 440, y: 490 },
    { x: 520, y: 490 }, { x: 360, y: 560 }, { x: 440, y: 560 }, { x: 520, y: 560 },
    { x: 750, y: 450 }, { x: 750, y: 500 }, { x: 750, y: 550 }, { x: 750, y: 600 },
    { x: 900, y: 160 }, { x: 990, y: 160 }, { x: 900, y: 205 }, { x: 990, y: 205 },
    { x: 900, y: 250 }, { x: 990, y: 250 }, { x: 900, y: 295 }, { x: 990, y: 295 }
  ];

  var MAX_CONCURRENT = 6; // chặn tăng vô hạn nếu móc bị gọi dồn dập
  var PRELOAD_CONCURRENCY = 16;

  // Đợt DEMOCAM giai đoạn 2 (Bui 14:45 "Sửa cho nhìn thấy"): thi triển từ trong
  // modal thì hiệu ứng vẽ trên canvas bị modal phủ kín nên không thấy gì. Lớp
  // fx-peek trên <body> làm modal mờ đi trong lúc hiệu ứng chạy (theo tiền lệ
  // body.photo-mode) — chỉ giấu phần nhìn, trạng thái + dữ liệu modal nguyên
  // vẹn, lớp tự gỡ khi hiệu ứng hết. Bấm trong lúc mờ vẫn trúng modal vô hình
  // (không lọt xuống canvas gây di chuyển lạc), vì modal không có bấm-nền-đóng.
  var peekTimer = null;
  var PEEK_EXTRA_MS = 150;
  function peekThroughModal() {
    try {
      if (typeof document === 'undefined' || !document.body) return false;
      document.body.classList.add('fx-peek');
      if (peekTimer) clearTimeout(peekTimer);
      peekTimer = setTimeout(function () {
        peekTimer = null;
        try { document.body.classList.remove('fx-peek'); } catch (e) {}
      }, DURATION_MS + PEEK_EXTRA_MS);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // TRẠNG THÁI
  // ---------------------------------------------------------------------------
  var cache = {}; // đường dẫn -> Image (trình duyệt) hoặc true (đã xếp hàng)
  var active = []; // { spellId, tier, start, rects:[{x,y,w,h}] }
  var preloadStarted = false;
  var loadStats = { total: 0, done: 0, failed: 0 };
  var drawStats = { drawn: 0, lastSpell: null, lastTier: 0, lastFrame: -1 };

  function now() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }

  function isKnownSkill(spellId) {
    return SKILLS.indexOf(spellId) >= 0;
  }

  // Ánh xạ bậc ↔ cấp (SPELLFX): bậc 1 = cấp 1–2, bậc 2 = cấp 3–4, bậc 3 = cấp 5+.
  function tierFromLevel(level) {
    var lv = Number(level);
    if (!isFinite(lv) || lv < 1) lv = 1;
    if (lv >= 5) return 3;
    if (lv >= 3) return 2;
    return 1;
  }

  function framePath(spellId, tier, layer, frameIdx) {
    var n = ('00' + frameIdx).slice(-3);
    return BASE_PATH + spellId + '/tier' + tier + '/' + layer + '/f' + n + '.png';
  }

  function getEngine() {
    if (typeof window !== 'undefined' && window.GameEngine) return window.GameEngine;
    if (typeof global !== 'undefined' && global.GameEngine) return global.GameEngine;
    return null;
  }

  function getFarmPlots() {
    try {
      var farm = null;
      if (typeof window !== 'undefined' && window.GameTongMonFarm) farm = window.GameTongMonFarm;
      else if (typeof global !== 'undefined' && global.GameTongMonFarm) farm = global.GameTongMonFarm;
      if (farm) {
        if (typeof farm.getPlotsConfig === 'function') {
          var cfg = farm.getPlotsConfig();
          if (cfg && cfg.length >= 32) return cfg;
        }
        if (farm.PLOTS_CONFIG && farm.PLOTS_CONFIG.length >= 32) return farm.PLOTS_CONFIG;
      }
    } catch (e) {}
    return FALLBACK_PLOTS;
  }

  function getCurrentMapId() {
    try {
      var eng = getEngine();
      if (eng && typeof eng.getCurrentMapId === 'function') return eng.getCurrentMapId();
    } catch (e) {}
    return null;
  }

  function getPlayerPos() {
    try {
      var eng = getEngine();
      if (eng && typeof eng.getPlayer === 'function') {
        var p = eng.getPlayer();
        if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
      }
    } catch (e) {}
    return null;
  }

  // ---------------------------------------------------------------------------
  // NẠP ẢNH NỀN (không chặn khởi động game; khung chưa nạp xong thì bỏ qua)
  // ---------------------------------------------------------------------------
  function preload() {
    if (preloadStarted) return;
    if (typeof window === 'undefined' || typeof window.Image !== 'function') return;
    preloadStarted = true;
    var urls = [];
    for (var s = 0; s < SKILLS.length; s++) {
      for (var t = 1; t <= 3; t++) {
        for (var f = 0; f < FRAMES_PER_TIER; f++) {
          urls.push(framePath(SKILLS[s], t, 'frames', f));
          urls.push(framePath(SKILLS[s], t, 'shadow', f));
        }
      }
    }
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

  // ---------------------------------------------------------------------------
  // MÓC CHÍNH: GameVFX.onSpellCast(castInfo)
  // ---------------------------------------------------------------------------
  // castInfo từ 4 điểm gọi đã có sẵn:
  // - thị phạm Trưởng Lão: { spellId, level: bậc 1/2/3, tier, fxLevel 1/3/5,
  //   caster, mapId:'ruong-linh-me', x, y, stepIndex, ... } (không có trường ok)
  // - castSpell / castFarmSpell: { ok, spellId, level, uses, affected,
  //   targetPlotIndex?, ... } — thất bại có ok:false, PHẢI bỏ qua.
  function onSpellCast(info) {
    try {
      if (!info || typeof info.spellId !== 'string') return false;
      if (!isKnownSkill(info.spellId)) return false;
      if (info.ok === false) return false; // thi triển thất bại: không hiện hiệu ứng

      // Bậc: demo đưa sẵn tier; còn lại suy từ fxLevel/level theo ánh xạ SPELLFX.
      var tier = 1;
      if (typeof info.tier === 'number' && info.tier >= 1 && info.tier <= 3) {
        tier = Math.floor(info.tier);
      } else {
        tier = tierFromLevel((info.fxLevel !== undefined && info.fxLevel !== null) ? info.fxLevel : info.level);
      }

      var onFieldMap = (getCurrentMapId() === 'ruong-linh-me') || (info.mapId === 'ruong-linh-me');
      var rects = [];

      if (info.spellId === 'thoi-sinh') {
        var plotIds = TS_PLOTS_BY_TIER[tier] || TS_PLOTS_BY_TIER[1];
        if (onFieldMap) {
          var plots = getFarmPlots();
          for (var i = 0; i < plotIds.length; i++) {
            var c = plots[plotIds[i]];
            if (c && typeof c.x === 'number') {
              rects.push({ x: c.x - TS_ORIGIN.x, y: c.y - TS_ORIGIN.y, w: TS_CANVAS.w, h: TS_CANVAS.h });
            }
          }
        }
        if (rects.length === 0) {
          // Dự phòng ngoài map ruộng: một khung tại vị trí nhân vật.
          var pp = getPlayerPos();
          var cx = pp ? pp.x : 600;
          var cy = pp ? pp.y : 400;
          rects.push({ x: cx - TS_ORIGIN.x, y: cy - TS_ORIGIN.y, w: TS_CANVAS.w, h: TS_CANVAS.h });
        }
      } else {
        if (onFieldMap) {
          rects.push({ x: FIELD_RECT.x, y: FIELD_RECT.y, w: FIELD_RECT.w, h: FIELD_RECT.h });
        } else {
          var pp2 = getPlayerPos();
          var px = pp2 ? pp2.x : 600;
          var py = pp2 ? pp2.y : 400;
          rects.push({ x: px - FIELD_RECT.w / 2, y: py - FIELD_RECT.h / 2, w: FIELD_RECT.w, h: FIELD_RECT.h });
        }
      }

      active.push({ spellId: info.spellId, tier: tier, start: now(), rects: rects });
      if (active.length > MAX_CONCURRENT) active.splice(0, active.length - MAX_CONCURRENT);
      peekThroughModal(); // Đợt DEMOCAM gđ2: thi triển từ modal cũng nhìn thấy hiệu ứng.
      preload(); // đảm bảo nạp nền đã chạy (lần thi triển đầu vẫn hiện khung đã nạp kịp)
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // VẼ — gọi từ render() của engine, SAU lớp đất/luống, TRƯỚC thực thể.
  // ctx đã mang biến đổi camera (scale + translate); tọa độ dùng là thế giới.
  // ---------------------------------------------------------------------------
  function draw(ctx) {
    if (!ctx || active.length === 0) return;
    var t = now();

    // Cắt khung ngoài khung nhìn (nếu đọc được camera) để khỏi vẽ thừa.
    var view = null;
    try {
      var eng = getEngine();
      if (eng && typeof eng.getCamera === 'function') {
        var cam = eng.getCamera();
        if (cam && typeof cam.x === 'number') {
          view = { x: cam.x - 40, y: cam.y - 40, w: (cam.viewportW || 800) + 80, h: (cam.viewportH || 600) + 80 };
        }
      }
    } catch (e) {}

    for (var i = active.length - 1; i >= 0; i--) {
      var eff = active[i];
      var frameIdx;
      try {
        var elapsed = (t - eff.start) / 1000;
        frameIdx = Math.floor(elapsed * FPS);
        if (frameIdx >= FRAMES_PER_TIER) { active.splice(i, 1); continue; }
        if (frameIdx < 0) frameIdx = 0;
      } catch (e) {
        active.splice(i, 1);
        continue;
      }
      // Lớp bóng TRƯỚC (dưới hiệu ứng, trên mặt đất), rồi lớp hiệu ứng.
      for (var r = 0; r < eff.rects.length; r++) {
        var rc = eff.rects[r];
        if (view && (rc.x + rc.w < view.x || rc.x > view.x + view.w || rc.y + rc.h < view.y || rc.y > view.y + view.h)) continue;
        try {
          var sh = getImage(framePath(eff.spellId, eff.tier, 'shadow', frameIdx));
          if (sh) { ctx.drawImage(sh, rc.x, rc.y, rc.w, rc.h); drawStats.drawn++; }
          var fx = getImage(framePath(eff.spellId, eff.tier, 'frames', frameIdx));
          if (fx) {
            ctx.drawImage(fx, rc.x, rc.y, rc.w, rc.h);
            drawStats.drawn++;
            drawStats.lastSpell = eff.spellId;
            drawStats.lastTier = eff.tier;
            drawStats.lastFrame = frameIdx;
          }
        } catch (e) {}
      }
    }
  }

  function getLoadStats() {
    return { total: loadStats.total, done: loadStats.done, failed: loadStats.failed, started: preloadStarted };
  }

  function getDrawStats() {
    return { drawn: drawStats.drawn, lastSpell: drawStats.lastSpell, lastTier: drawStats.lastTier, lastFrame: drawStats.lastFrame };
  }

  function activeCount() {
    return active.length;
  }

  function reset() {
    active.length = 0;
  }

  exports.onSpellCast = onSpellCast;
  exports.draw = draw;
  exports.preload = preload;
  exports.peekThroughModal = peekThroughModal;
  exports.isPeeking = function () {
    try {
      return !!(typeof document !== 'undefined' && document.body &&
        document.body.classList.contains('fx-peek'));
    } catch (e) { return false; }
  };
  exports.tierFromLevel = tierFromLevel;
  exports.getLoadStats = getLoadStats;
  exports.getDrawStats = getDrawStats;
  exports.activeCount = activeCount;
  exports.reset = reset;
  exports.FIELD_RECT = FIELD_RECT;
  exports.TS_PLOTS_BY_TIER = TS_PLOTS_BY_TIER;
  exports.TS_CANVAS = TS_CANVAS;
  exports.TS_ORIGIN = TS_ORIGIN;
  exports.FRAMES_PER_TIER = FRAMES_PER_TIER;
  exports.FPS = FPS;

  // Nạp nền sau khi game đã khởi động (không chặn preloadAssets của engine).
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(function () { try { preload(); } catch (e) {} }, 1200);
  }

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameVFX = {}));
