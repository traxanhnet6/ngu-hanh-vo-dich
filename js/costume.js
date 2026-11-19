/**
 * costume.js — Đợt COSTUMEPREP (chuẩn bị ghép đồng phục tông môn, CHƯA NGHIỆM THU)
 *
 * Adapter + loader nạp lười cho 25 bộ đồng phục (F01–F15, M01–M10).
 * Nguồn: assets/chars/costumes/costumes-{idle,walk,run,combat}.json + 92 atlas PNG.
 *
 * BẪY PIVOT (xem COSTUME-ASSET-AUDIT §2): pivot trong JSON đồng phục là
 * TỌA ĐỘ CỤC BỘ trong rect, KHÔNG phải tuyệt đối trên atlas. drawGenFrame
 * của engine cũng dùng pivot cục bộ (neo theo rect) nên adapter truyền
 * thẳng pivot, KHÔNG cộng (x, y) của rect. Ai cộng thêm sẽ lệch neo chân.
 *
 * Schema đồng phục KHÔNG khớp buildGenIndex (frames là dict khóa
 * "F01/idle_east_f0", rect phẳng, không có fps/strip/index, nhiều atlas
 * theo chỉ số int) — adapter này đổi sang đúng shape buildGenIndex trả về
 * ({dirs, scaleFromMaster, charH} + từng khung {x,y,w,h,px,py,fps,atlas})
 * để drawGenFrame dùng lại được nguyên vẹn, không sửa drawGenFrame.
 *
 * Tỉ lệ: charH × scaleFromMaster = 264 → k = 112/264 = 0.424242 = scale_K
 * trong meta (display_height_px 112). fps mặc định: idle 6, walk/combat 10.
 *
 * Nạp lười theo mã: chỉ fetch JSON + nạp atlas của mã đang mặc. Cây đợt
 * này chỉ copy atlas của 3 mã demo (F01, M06, F04); mã khác chưa có PNG
 * trên đĩa → ensureCode thất bại lặng lẽ, isReady false, engine lùi về
 * Hà Nhân. Lúc gộp thật phải copy đủ 92 atlas (bước cơ học, xem
 * COSTUME-MERGE-PREP-REPORT.md).
 *
 * Combat đồng phục chỉ có 2 động tác (attack, bao) so với 5 thế engine —
 * ánh xạ ở nhánh vẽ trong engine.js: draw → bao, 4 đòn còn lại → attack.
 * Run chưa có nhánh vẽ trong engine — file run JSON có nạp nhưng không vẽ.
 */
(function (global) {
  'use strict';

  var COSTUME_CODES = [];
  var i;
  for (i = 1; i <= 15; i++) COSTUME_CODES.push('F' + (i < 10 ? '0' + i : '' + i));
  for (i = 1; i <= 10; i++) COSTUME_CODES.push('M' + (i < 10 ? '0' + i : '' + i));

  var BASE = 'assets/chars/costumes/costumes-';
  var CHAR_H = 264; // charH × scaleFromMaster = 264 → k = 112/264
  var FPS = { idle: 6, walk: 10, run: 10, attack: 10, bao: 10 };
  var DIRS = ['south', 'southeast', 'east', 'northeast', 'north', 'northwest', 'west', 'southwest'];

  var jsonCache = {};   // mode -> json đã fetch (idle/walk/run/combat)
  var jsonPending = {}; // mode -> Promise fetch
  var indexCache = {};  // code -> {idle, walk, combat:{attack,bao}}
  var imgCache = {};    // "mode-idx" -> Image
  var imgPending = {};  // "mode-idx" -> Promise
  var readyState = {};  // code -> {idle:bool, walk:bool, combat:bool}
  var ensurePending = {}; // code -> Promise

  function isCostumeCode(id) {
    return typeof id === 'string' && COSTUME_CODES.indexOf(id) >= 0;
  }

  function genderLabel(code) {
    return code.charAt(0) === 'F' ? 'Nữ' : 'Nam';
  }

  // "F01/idle_east_f0" | "F01/attack_southwest_f0" -> {code, sub, dir, index}
  function parseKey(key) {
    var m = /^([FM]\d{2})\/(idle|walk|run|attack|bao)_([a-z]+)_f(\d+)$/.exec(key || '');
    if (!m) return null;
    return { code: m[1], sub: m[2], dir: m[3], index: parseInt(m[4], 10) };
  }

  function buildSubIndex(modeJson, code, subs) {
    var out = {};
    var s;
    for (s = 0; s < subs.length; s++) {
      out[subs[s]] = { dirs: {}, scaleFromMaster: 1, charH: CHAR_H };
    }
    var frames = (modeJson && modeJson.frames) || {};
    var keys = Object.keys(frames);
    for (var k = 0; k < keys.length; k++) {
      var p = parseKey(keys[k]);
      if (!p || p.code !== code || subs.indexOf(p.sub) < 0) continue;
      var v = frames[keys[k]];
      if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' ||
          typeof v.w !== 'number' || typeof v.h !== 'number' ||
          !v.pivot || typeof v.pivot.x !== 'number' || typeof v.pivot.y !== 'number') continue;
      var d = out[p.sub].dirs;
      if (!d[p.dir]) d[p.dir] = [];
      // pivot truyền thẳng (cục bộ trong rect) — KHÔNG cộng (x, y). Xem đầu file.
      d[p.dir][p.index] = {
        x: v.x, y: v.y, w: v.w, h: v.h,
        px: v.pivot.x, py: v.pivot.y,
        fps: FPS[p.sub] || 10,
        atlas: v.atlas
      };
    }
    return out;
  }

  function fetchJson(mode) {
    if (jsonCache[mode]) return Promise.resolve(jsonCache[mode]);
    if (jsonPending[mode]) return jsonPending[mode];
    jsonPending[mode] = fetch(BASE + mode + '.json').then(function (r) {
      if (!r.ok) throw new Error('costume json ' + mode + ' HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      jsonCache[mode] = j;
      return j;
    }).catch(function (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('[costume] không nạp được JSON ' + mode + ':', e && e.message);
      return null;
    });
    return jsonPending[mode];
  }

  function loadAtlas(mode, idx) {
    var key = mode + '-' + idx;
    if (imgCache[key]) return Promise.resolve(imgCache[key]);
    if (imgPending[key]) return imgPending[key];
    imgPending[key] = new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth === 2048 && img.naturalHeight === 2048) {
          imgCache[key] = img;
          resolve(img);
        } else {
          if (typeof console !== 'undefined' && console.warn) console.warn('[costume] atlas sai khổ: ' + key + ' ' + img.naturalWidth + 'x' + img.naturalHeight);
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = BASE + mode + '-' + idx + '.png';
    });
    return imgPending[key];
  }

  function atlasSetFor(idxObj) {
    // idxObj: {sub -> {dirs}} — gom mọi chỉ số atlas mà mã này chạm tới
    var set = {};
    var subs = Object.keys(idxObj);
    for (var s = 0; s < subs.length; s++) {
      var dirs = idxObj[subs[s]].dirs;
      var names = Object.keys(dirs);
      for (var d = 0; d < names.length; d++) {
        var arr = dirs[names[d]];
        for (var f = 0; f < arr.length; f++) {
          if (arr[f] && typeof arr[f].atlas === 'number') set[arr[f].atlas] = true;
        }
      }
    }
    return Object.keys(set).map(function (x) { return parseInt(x, 10); }).sort(function (a, b) { return a - b; });
  }

  function countFrames(idxObj) {
    var n = 0;
    var subs = Object.keys(idxObj);
    for (var s = 0; s < subs.length; s++) {
      var dirs = idxObj[subs[s]].dirs;
      var names = Object.keys(dirs);
      for (var d = 0; d < names.length; d++) {
        var arr = dirs[names[d]];
        for (var f = 0; f < arr.length; f++) if (arr[f]) n++;
      }
    }
    return n;
  }

  function dirsComplete(idxObj, expectedPerDir) {
    var subs = Object.keys(idxObj);
    for (var s = 0; s < subs.length; s++) {
      var dirs = idxObj[subs[s]].dirs;
      for (var d = 0; d < DIRS.length; d++) {
        var arr = dirs[DIRS[d]];
        if (!arr) return false;
        var n = 0;
        for (var f = 0; f < arr.length; f++) if (arr[f]) n++;
        if (n < expectedPerDir) return false;
      }
    }
    return true;
  }

  // Nạp lười toàn bộ dữ liệu + atlas của 1 mã (idle/walk/combat). Không
  // throw: mã thiếu atlas trên đĩa (cây đợt chỉ có demo) thì mode đó
  // ready=false, engine lùi về Hà Nhân.
  function ensureCode(code) {
    if (!isCostumeCode(code)) return Promise.resolve(false);
    if (indexCache[code] && readyState[code] && readyState[code].idle && readyState[code].walk && readyState[code].combat) {
      return Promise.resolve(true);
    }
    if (ensurePending[code]) return ensurePending[code];
    ensurePending[code] = Promise.all([fetchJson('idle'), fetchJson('walk'), fetchJson('combat')])
      .then(function (js) {
        var built = { idle: null, walk: null, combat: null };
        if (js[0]) built.idle = buildSubIndex(js[0], code, ['idle']).idle;
        if (js[1]) built.walk = buildSubIndex(js[1], code, ['walk']).walk;
        if (js[2]) built.combat = buildSubIndex(js[2], code, ['attack', 'bao']);
        indexCache[code] = built;
        readyState[code] = { idle: false, walk: false, combat: false };
        var jobs = [];
        function loadMode(mode, idxObj, perDir) {
          if (!idxObj || !dirsComplete(idxObj, perDir)) return;
          var atlases = atlasSetFor(idxObj);
          jobs.push(Promise.all(atlases.map(function (a) { return loadAtlas(mode, a); })).then(function (imgs) {
            var ok = true;
            for (var q = 0; q < imgs.length; q++) if (!imgs[q]) ok = false;
            if (ok) readyState[code][mode] = true;
          }));
        }
        // combat: idle/walk/combat gom chung — combat cần cả attack + bao đủ 8 hướng
        loadMode('idle', built.idle ? { idle: built.idle } : null, 6);
        loadMode('walk', built.walk ? { walk: built.walk } : null, 8);
        if (built.combat) {
          var cOk = dirsComplete({ attack: built.combat.attack }, 8) && dirsComplete({ bao: built.combat.bao }, 8);
          if (cOk) {
            var cAtlases = atlasSetFor(built.combat);
            jobs.push(Promise.all(cAtlases.map(function (a) { return loadAtlas('combat', a); })).then(function (imgs) {
              var ok = true;
              for (var q = 0; q < imgs.length; q++) if (!imgs[q]) ok = false;
              if (ok) readyState[code].combat = true;
            }));
          }
        }
        return Promise.all(jobs).then(function () {
          return readyState[code].idle && readyState[code].walk;
        });
      });
    return ensurePending[code];
  }

  function isReady(code, mode) {
    return !!(readyState[code] && readyState[code][mode]);
  }

  function combatReady(code) {
    return isReady(code, 'combat');
  }

  function getData(code, mode, sub) {
    var b = indexCache[code];
    if (!b) return null;
    if (mode === 'combat') return (b.combat && b.combat[sub]) || null;
    return b[mode] || null;
  }

  // Trả {f, img} cho 1 khung, hoặc null khi chưa nạp đủ (nơi gọi lùi về base).
  function frameFor(code, mode, sub, dirName, frameIdx) {
    var data = getData(code, mode, sub);
    if (!data) return null;
    var arr = data.dirs[dirName];
    if (!arr || !arr.length) return null;
    var f = arr[frameIdx % arr.length];
    if (!f) return null;
    var img = imgCache[mode + '-' + f.atlas];
    if (!img) return null;
    return { f: f, img: img };
  }

  // Phục vụ báo cáo/kiểm kê: mã này chạm atlas nào, đủ khung không.
  function atlasesFor(code) {
    var out = {};
    var b = indexCache[code];
    if (!b) return out;
    if (b.idle) out.idle = atlasSetFor({ idle: b.idle });
    if (b.walk) out.walk = atlasSetFor({ walk: b.walk });
    if (b.combat) out.combat = atlasSetFor(b.combat);
    return out;
  }

  function debugState(code) {
    var b = indexCache[code];
    return {
      code: code,
      ready: readyState[code] || null,
      frames: b ? {
        idle: b.idle ? countFrames({ idle: b.idle }) : 0,
        walk: b.walk ? countFrames({ walk: b.walk }) : 0,
        combat: b.combat ? countFrames(b.combat) : 0
      } : null,
      atlases: atlasesFor(code)
    };
  }

  var api = {
    CODES: COSTUME_CODES,
    CHAR_H: CHAR_H,
    DIRS: DIRS,
    isCostumeCode: isCostumeCode,
    genderLabel: genderLabel,
    ensureCode: ensureCode,
    isReady: isReady,
    combatReady: combatReady,
    getData: getData,
    frameFor: frameFor,
    atlasesFor: atlasesFor,
    debugState: debugState,
    // Chỉ dùng cho kiểm thử nội bộ (không gọi trong game thường).
    _buildSubIndex: buildSubIndex,
    _parseKey: parseKey
  };

  if (typeof window !== 'undefined') window.CostumeOutfits = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
