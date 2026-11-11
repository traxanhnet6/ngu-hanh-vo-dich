/**
 * engine.js — Vòng lặp trò chơi, kết xuất Canvas, chiến đấu thời gian thực,
 * quản lý đa bản đồ, quái vật, kỹ năng, rớt đồ & hiệu ứng hình ảnh (Canvas VFX).
 */
(function (global) {
  'use strict';

  var canvas = null;
  var ctx = null;
  var player = null;
  var mapData = null;
  var stateAPI = null;
  var audioAPI = null;
  var pathfinder = null;
  var combatAPI = null;
  var monstersAPI = null;
  var skillsAPI = null; // Đợt K1: registry kỹ năng (js/skills.js)

  var currentMapId = 'mieu_hoang';
  var isRunning = false;
  var lastFrameTime = 0;
  var lastCombatState = false;
  var onReadyCallback = null;

  var camera = {
    x: 0,
    y: 0,
    scale: 1,
    viewportW: 800,
    viewportH: 600
  };

  var SPEED = 138; // Tốc độ di chuyển người chơi (px/s)
  var INTERACTION_RANGE = 48;

  var keysDown = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  var joystickVector = { x: 0, y: 0 };
  function setJoystickVector(vx, vy) {
    joystickVector.x = vx || 0;
    joystickVector.y = vy || 0;
  }

  var currentPath = [];
  var pendingInteraction = null;
  var clickRipple = null;
  var exitChip = { text: '', timer: 0 };
  var stepSoundAccumulator = 0;

  var playerMoving = false;
  var walkAnimTime = 0;
  // Đợt 3 (Note 6): pha đi bộ KHÓA THEO QUÃNG ĐƯỜNG (chuẩn Vô Sắc), không theo thời gian.
  // Chu kỳ bước đi hết 51.2px mặt đất ở tỉ lệ sheet (WALK3-REPORT: cycle ground distance 51px,
  // cadence 5.4 bước/s ở tốc độ 138px/s). Áp cho cả sheet 24 khung lẫn bản 8 khung.
  var WALK_CYCLE_DIST = 51.2;
  var walkDist = 0;
  var lastPX = null;
  var lastPY = null;
  // Đợt 3 (Note 8): chất lượng đồ họa do người chơi chọn — 'thap' tắt các hiệu ứng
  // tốn GPU nhất (vũng sáng gradient sau quái, quầng sáng điểm hái, mọi shadowBlur)
  // để máy yếu chạy mượt; 'trung'/'cao' giữ nguyên.
  var currentQuality = 'cao';
  function setQuality(q) {
    currentQuality = (q === 'thap' || q === 'trung' || q === 'cao') ? q : 'cao';
  }
  function qualityShadow(v) {
    return currentQuality === 'thap' ? 0 : v;
  }
  var playerSnareTimer = 0;
  var playerSlowTimer = 0;
  var playerSlowRatio = 0;

  // Chiến đấu người chơi
  var targetMonster = null;
  var basicAttackCd = 0;
  // Đợt SWINGFIX 2026-11-09: nhịp VUNG KIẾM của đòn thường. Người chơi báo
  // "đã cầm kiếm nhưng khi đánh quái không thấy vung kiếm": chẩn đoán đo
  // trong Chrome thật cho thấy lớp kiếm của GRIPFIX quay một góc TĨNH theo
  // hướng mặt (biên độ quay 0,0° ở cả 8 hướng trong suốt cửa sổ đánh) và
  // sát thương áp ngay trong cùng một lời gọi — thân không có khung đánh,
  // kiếm không có chuyển động, đòn không có khoảnh khắc ra đòn. Đợt này
  // diễn hoạt LỚP KIẾM quanh đúng điểm nắm đo của GRIPFIX (lên gối → ra
  // đòn → thu kiếm) và dời khoảnh khắc áp sát thương về đúng pha ra đòn;
  // mọi con số sát thương/hồi chiêu giữ nguyên bản live.
  var basicSwing = null; // { timer, duration, target, struck, whiff, whiffDir, armed }
  var SWING_DURATION = 0.26;
  var SWING_STRIKE_P = 0.50; // tiến độ mà lưỡi kiếm quét qua đường hướng mặt
  // Hình học vung theo hướng mặt (độ, 0 = đông, tăng theo chiều kim đồng
  // hồ như HH_WEAPON_BLADE): lưỡi quét 140° qua đúng đường hướng mặt —
  // điểm lên gối W = face − 95·dir, điểm qua đòn F = face + 45·dir.
  var HH_SWING = {
    south: { face: 90, dir: 1 }, southeast: { face: 45, dir: 1 },
    east: { face: 0, dir: 1 }, northeast: { face: -45, dir: -1 },
    north: { face: -90, dir: -1 }, northwest: { face: -135, dir: 1 },
    west: { face: 180, dir: -1 }, southwest: { face: 135, dir: -1 }
  };
  var lastGripWorld = null; // điểm nắm trên thế giới của khung vẽ gần nhất (SWINGFIX: tâm vệt chém)

  function swingShortestDelta(from, to) {
    var d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  /** Góc lưỡi kiếm (độ, cùng quy ước HH_WEAPON_BLADE) tại tiến độ vung hiện tại. */
  function swingBladeAngle(dirName, restBlade) {
    if (!basicSwing) return restBlade;
    var sw = HH_SWING[dirName];
    if (!sw) return restBlade;
    var p = 1 - (basicSwing.timer / basicSwing.duration);
    var W = sw.face - 95 * sw.dir;
    var F = sw.face + 45 * sw.dir;
    var windDelta = swingShortestDelta(restBlade, W);
    if (p < 0.32) {
      // Lên gối: lưỡi đi từ tư thế treo về điểm W theo cung ngắn nhất
      var t = p / 0.32;
      var e = 1 - Math.pow(1 - t, 3);
      return restBlade + windDelta * e;
    }
    if (p < 0.54) {
      // Ra đòn: quét 140° qua đường hướng mặt, tăng tốc dần
      var t2 = (p - 0.32) / 0.22;
      return W + 140 * sw.dir * (t2 * t2);
    }
    // Thu kiếm: đi NGƯỢC LẠI đúng đường vừa vung ra (F -> W -> treo).
    // Cung ngắn nhất từ F về treo có hướng bắc chạy tiếp 141° theo chiều
    // ra đòn, cộng thành một vòng quay 360° quét qua cả sau lưng — đã đo
    // trong cổng swing-check và loại; thu theo vết vung đọc như một nhát
    // chém có đi có về, không vòng quay, không quét qua thân.
    var t3 = (p - 0.54) / 0.46;
    var e3 = t3 * t3 * (3 - 2 * t3);
    return F + (-140 * sw.dir - windDelta) * e3;
  }
  // Tự tìm đường theo nhiệm vụ + nút hành động theo ngữ cảnh (Đợt 2, lệnh Bui)
  var autoPath = { active: false, lastLegAt: 0, combatStamp: 0 };
  var currentActionMode = 'attack';
  var ACTION_PICKUP_RADIUS = 72;
  var DIR_VECTORS = [
    { x: 0, y: 1 }, { x: 0.7071, y: 0.7071 }, { x: 1, y: 0 }, { x: 0.7071, y: -0.7071 },
    { x: 0, y: -1 }, { x: -0.7071, y: -0.7071 }, { x: -1, y: 0 }, { x: -0.7071, y: 0.7071 }
  ];
  // Đợt K1: hồi chiêu theo id chiêu (registry là nguồn sự thật duy nhất về
  // thời gian hồi/tầm/hao phí — không còn biến cứng skill1Cd/skill2Cd).
  var skillCds = {};    // { skillId: giây còn lại }
  var castState = null; // chiêu đang vận: { def, target, timer, total }
  // Đợt K2: Tương Sinh Liên Hoàn (hồ sơ 02 §5) — chuỗi hệ của đòn vừa chuyển.
  var lienHoanState = { elem: null, stacks: 0 };
  // Đợt K2: hoạt ảnh tung chiêu bằng khung thật (vd Thái Cực Chưởng):
  // { def, timer, duration, row, frames } — thay hình nhân vật khi đang diễn.
  var skillCastAnim = null;
  // Đợt K2: ngưỡng đòn nặng ngắt vận chiêu = 10% máu tối đa (đầu trên của
  // khung "một đòn 5–10% máu tối đa" ở hồ sơ 49; hồ sơ 52 §3 không chốt
  // con số — cách đọc này ghi rõ trong docs/k2-report.md).
  var INTERRUPT_HP_FRACTION = 0.10;
  var lastCombatTime = 0;

  // Danh sách thực thể thế giới
  var fieldMonsters = [];
  var groundDrops = [];
  var floatingTexts = [];
  var projectiles = [];
  var visualEffects = []; // slash, vine snare, telegraphs, etc.

  // Đợt 6 (mục 15): bộ nhớ đệm cài đặt cho các cổng vẽ theo khung hình (tránh đọc kho lưu mỗi khung)
  var _settingsCache = null;
  var _settingsCacheAt = 0;
  function getSettingsCached() {
    var nowMs = Date.now();
    if (!_settingsCache || nowMs - _settingsCacheAt > 500) {
      try { _settingsCache = stateAPI ? stateAPI.loadSettings() : {}; } catch (e) { _settingsCache = {}; }
      _settingsCacheAt = nowMs;
    }
    return _settingsCache || {};
  }

  // Chuyển map fade
  var mapFade = {
    alpha: 0,
    dir: 0, // 1: fade to black, -1: fade to game
    callback: null
  };
  // Yêu cầu chuyển map đến trong lúc đang fade: XẾP HÀNG chờ fade xong rồi chạy,
  // không được nuốt mất (trước đây switchMap bỏ qua lặng lẽ khi alpha > 0 — người
  // chơi bấm cửa/cổng ngay sau khi chuyển cảnh, nhất là máy yếu fade lâu, sẽ thấy
  // "bấm mà không vào được"; bản kiểm thử B6 vấp đúng lỗi này khi tải máy cao).
  var pendingMapSwitch = null;

  // Chống cổng nảy về (hotfix 2026-11-09): sau mỗi lần chuyển map, cổng thoát bị
  // KHÓA cho tới khi (a) qua 1,6 giây kể từ lúc tới nơi VÀ (b) người chơi đã đứng
  // NGOÀI mọi vùng cổng của map mới ít nhất một khung hình. Lý do: các điểm xuất
  // hiện nằm sát vùng cổng quay về (Tông Môn -> Miếu chỉ cách 50px, Đài Truyền
  // Tống chỉ 32-35px) nên người chơi giữ nguyên hướng đi sau khi qua cổng sẽ
  // chạm lại vùng cổng quay về trong chưa đầy nửa giây và bị trả về map cũ.
  // GUIDEFIX (cùng ngày): điều kiện (b) có thêm nhánh "đã dừng hẳn trong vùng
  // cổng" ở chỗ mở khóa — nếu không, người đi theo dẫn đường vào thẳng tâm cổng
  // của Đài Truyền Tống (điểm rơi cách cổng 32-82px) sẽ đứng trong vùng cổng
  // trước khi hết ân hạn và khóa không bao giờ mở, kẹt ngay trong cổng.
  var portalsArmed = true;
  var portalRearmAt = 0;

  // Tài nguyên đồ họa
  var assets = {};
  var assetsLoaded = false;
  var harvestReadyTimes = {};

  // Đợt CHARINTEG 2026-11-09: bộ nhân vật Hà Nhân SINH HÌNH đã được duyệt
  // ghép (Idle 8 hướng × 6 khung + Walk 8 hướng × 8 khung, atlas 2048×2048
  // kèm JSON tọa độ ĐO THẬT từ bản đóng gói). Dữ liệu khung nạp riêng dạng
  // JSON; khi dữ liệu chưa về hoặc atlas chưa đúng khổ 2048×2048, bộ máy vẽ
  // tự lùi về sheet cũ — đường cũ giữ nguyên, đảo ngược được.
  // Thứ tự hướng khớp player.dir: 0 nam, 1 đông nam, 2 đông, 3 đông bắc,
  // 4 bắc, 5 tây bắc, 6 tây, 7 tây nam (cùng quy ước hàng atlas của K2).
  var HH_GEN_DIRS = ['south', 'southeast', 'east', 'northeast', 'north', 'northwest', 'west', 'southwest'];
  var HH_GEN_DISPLAY_H = 112; // chiều cao nhân vật trên màn hình — khớp cỡ hình cũ (~111px đo thật)
  var hanhanGenData = { idle: null, walk: null };
  var genFrameDest = null; // hộp đích của khung sinh hình vừa vẽ xong (lớp kiếm trang bị bám theo)
  var hanhanGenHat = null; // Đợt HATLAYER: dữ liệu lớp nón cho bộ sinh hình

  function buildGenIndex(json) {
    if (!json || !Array.isArray(json.frames)) return null;
    var dirs = {};
    for (var gi = 0; gi < json.frames.length; gi++) {
      var fr = json.frames[gi];
      if (!fr || !fr.rect || !fr.pivot) continue;
      var dir = String(fr.strip || '').replace(/^(idle|walk)_/, '');
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir][fr.index] = {
        x: fr.rect.x, y: fr.rect.y, w: fr.rect.w, h: fr.rect.h,
        px: fr.pivot.x, py: fr.pivot.y, fps: fr.fps || 6
      };
    }
    return {
      dirs: dirs,
      scaleFromMaster: json.scale_from_master || 1,
      charH: (json.master && json.master.char_height_px) || 440
    };
  }

  // Vẽ MỘT khung của bộ sinh hình: kích thước đích suy từ hình chữ nhật thật
  // nằm trong bitmap ĐÃ NẠP (đúng luật npcfix — không ép hộp theo số khai
  // báo ngoài), neo pivot (điểm chạm đất của khung) trùng đúng điểm chân
  // (player.x, player.y). Trả false khi bộ sinh hình chưa sẵn sàng để nơi
  // gọi lùi về đường vẽ cũ.
  function drawGenFrame(img, data, dirName, frameIdx) {
    if (!img || !img.complete || !data) return false;
    if (img.naturalWidth !== 2048 || img.naturalHeight !== 2048) return false;
    var frames = data.dirs[dirName];
    if (!frames || !frames.length) return false;
    var f = frames[frameIdx % frames.length];
    if (!f) return false;
    if (!(f.w > 0 && f.h > 0) || f.x < 0 || f.y < 0 ||
        f.x + f.w > img.naturalWidth || f.y + f.h > img.naturalHeight) return false;
    if (!isFinite(f.px) || !isFinite(f.py)) return false;
    var k = HH_GEN_DISPLAY_H / (data.charH * data.scaleFromMaster);
    genFrameDest = {
      // Đợt KIẾP VÂN vòng 2/3: trừ playerLiftY — nhân vật bay lên trong pha
      // kết độ kiếp; playerLiftY là 0 ngoài cảnh độ kiếp nên không đổi
      // hành vi thường ngày. Lớp kiếm GRIPFIX bám theo genFrameDest này
      // nên tự nhấc theo thân.
      x: player.x - f.px * k, y: player.y - playerLiftY - f.py * k, w: f.w * k, h: f.h * k
    };
    ctx.drawImage(img, f.x, f.y, f.w, f.h,
      genFrameDest.x, genFrameDest.y, genFrameDest.w, genFrameDest.h);
    return f;
  }

  // Đợt JOYFIX 2026-11-09: LỚP KIẾM TRANG BỊ CẦM TAY cho nhân vật.
  // Triệu chứng người chơi báo: trang bị kiếm mà nhân vật không cầm kiếm —
  // đường vẽ cũ lẫn bộ sinh hình đều không có lớp vũ khí (khung gốc tay không).
  // Vẽ icon THẬT của món vũ khí đang trang bị (ô icon trong assets/art/
  // icons-sheet.png — cùng tài sản game dùng cho túi đồ) tại vị trí bàn tay.
  // Không trang bị vũ khí -> không vẽ gì. Lớp này chỉ chạy ở nhánh đứng yên/
  // đi bộ thường; nhánh diễn tung chiêu Thái Cực (K2) trả về sớm ở trên nên
  // không bị đụng.
  //
  // Đợt GRIPFIX 2026-11-09: người chơi phán "tay nhân vật phải NẮM kiếm" —
  // bản JOYFIX mới đặt icon cạnh tay nên kiếm trông như dán/lơ lửng. Bản này
  // đo lại toàn bộ theo số thật (tools/build-grip-data.py):
  //  - Điểm nắm TRONG icon tính riêng từng món (giữa chuôi thật, không phải
  //    đốc kiếm như bản cũ) + góc trục lưỡi riêng từng icon; góc xoay suy ra
  //    từ góc lưỡi đích theo hướng mặt trừ góc trục icon — cổ tay, chuôi và
  //    lưỡi thành một đường thẳng, lưỡi chúc xuống theo hướng nhân vật.
  //  - Tỉ lệ icon 1.0 (bản cũ 1.7 làm chuôi to gấp đôi nắm tay thật ~7px).
  //  - Vị trí nắm tay ĐO TRÊN TỪNG KHUNG (assets/chars/hanhan-gen-grip-v1.json:
  //    tâm + hộp nắm tay phải/chắp sau lưng cho đủ 112 khung idle+walk) —
  //    kiếm bám tay khi tay vung theo bước đi, không trượt như neo tĩnh cũ;
  //    khung nào tay bị áo choàng che hẳn thì ẩn kiếm (đúng chiều sâu).
  //  - Sau khi vẽ kiếm, vẽ LẠI vùng nắm tay của chính khung nhân vật lên
  //    trên chuôi: nắm tay che đoạn chuôi nằm trong tay nên đọc đúng là tay
  //    đang nắm chặt chuôi ( đốc + lưỡi ló hai đầu nắm tay).
  // Thiếu dữ liệu grip (nạp hỏng) thì lùi về neo tĩnh của JOYFIX với toán
  // nắm mới — hành vi an toàn, không vỡ hình.
  var HH_WEAPON_SCALE = 1.0;
  var HH_WEAPON_ICON = {
    'kiem-de-tu': { gx: 7.6, gy: 25.5, axis: -49.9 },
    'kiem-sat': { gx: 5.9, gy: 24.3, axis: -42.2 },
    'kiem-go': { gx: 6.7, gy: 25.3, axis: -47.4 },
    'dao-cui-cu': { gx: 6.2, gy: 23.4, axis: -38.9 },
    'gay-co-thu': { gx: 15.7, gy: 15.0, axis: -48.6 }
  };
  var HH_WEAPON_ICON_DEFAULT = { gx: 8, gy: 25, axis: -47 };
  // Góc lưỡi đích trên màn hình theo hướng mặt (độ, 0 = hướng đông, chiều
  // kim đồng hồ): lưỡi treo chúc xuống, hơi nghiêng về phía nhân vật nhìn.
  var HH_WEAPON_BLADE = {
    south: 72, southeast: 62, east: 68, northeast: 78,
    north: 84, northwest: 96, west: 112, southwest: 118
  };
  var HH_HAND_GEN_IDLE = {
    south: [0.14, 0.70], southeast: [0.22, 0.71], east: [0.42, 0.72], northeast: [0.47, 0.68],
    north: [0.50, 0.68], northwest: [0.52, 0.68], west: [0.60, 0.72], southwest: [0.80, 0.71]
  };
  var HH_HAND_GEN_WALK = {
    south: [0.85, 0.64], southeast: [0.80, 0.55], east: [0.68, 0.55], northeast: [0.30, 0.60],
    north: [0.47, 0.62], northwest: [0.52, 0.63], west: [0.14, 0.60], southwest: [0.10, 0.60]
  };
  var HH_HAND_OLD = {
    south: [0.27, 0.62], southeast: [0.30, 0.62], east: [0.46, 0.62], northeast: [0.50, 0.58],
    north: [0.50, 0.58], northwest: [0.50, 0.58], west: [0.54, 0.62], southwest: [0.73, 0.62]
  };
  var hanhanGrip = null; // Đợt GRIPFIX: dữ liệu nắm tay đo từng khung

  function drawHeldWeapon(dest, dirName, handTable, gripCtx) {
    if (!dest || !player || !player.equipment || !player.equipment.weapon) return;
    var sheet = assets.icons_sheet;
    if (!sheet || !sheet.complete || !sheet.naturalWidth) return;
    var def = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS[player.equipment.weapon] : null;
    if (!def || typeof def.iconCol !== 'number' || typeof def.iconRow !== 'number') return;
    var icon = HH_WEAPON_ICON[player.equipment.weapon] || HH_WEAPON_ICON_DEFAULT;
    var blade = HH_WEAPON_BLADE[dirName];
    if (typeof blade !== 'number') return;
    // Đợt SWINGFIX: đang trong nhịp vung đòn thường thì góc lưỡi đi theo
    // đường vung (lên gối → ra đòn → thu) quanh ĐÚNG điểm nắm của khung —
    // cổ tay, chuôi, lưỡi vẫn một đường thẳng, vá nắm tay vẫn phủ chuôi.
    if (basicSwing) blade = swingBladeAngle(dirName, blade);
    var rot = (blade - icon.axis) * Math.PI / 180;
    var s = HH_WEAPON_SCALE;

    // Đường GRIPFIX: có dữ liệu nắm của đúng khung đang vẽ.
    var entry = null;
    if (gripCtx && hanhanGrip && hanhanGrip.gen && gripCtx.f) {
      var per = hanhanGrip.gen[gripCtx.mode] && hanhanGrip.gen[gripCtx.mode][dirName];
      if (per && per.length) entry = per[gripCtx.frameIdx % per.length];
    }
    if (entry) {
      // Tay bị che hẳn trong khung này -> kiếm cũng khuất; NGOẠI LỆ duy
      // nhất của SWINGFIX: đang giữa nhịp vung thì cánh tay đã đưa ra
      // khỏi áo choàng để ra đòn nên kiếm vẫn hiện (chỉ trong 0,26 giây
      // của nhịp vung; lúc nghỉ luật ẩn của GRIPFIX giữ nguyên tuyệt đối).
      if (entry.hidden && !basicSwing) return;
      if (!(entry.cx > 0) || !(gripCtx.f.w > 0)) entry = null;
    }
    if (entry) {
      var k = dest.w / gripCtx.f.w;
      var hx = dest.x + entry.cx * k;
      var hy = dest.y + entry.cy * k;
      lastGripWorld = { x: hx, y: hy, dirName: dirName };
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(rot);
      ctx.drawImage(sheet, def.iconCol * 32, def.iconRow * 32, 32, 32,
        -icon.gx * s, -icon.gy * s, 32 * s, 32 * s);
      ctx.restore();
      // Vá nắm tay: vẽ lại đúng vùng nắm tay của khung nhân vật lên trên
      // chuôi — nắm tay che đoạn chuôi trong tay, đọc thành nắm thật.
      var f = gripCtx.f;
      var pad = 2;
      var sx = Math.max(f.x, f.x + entry.x0 - pad);
      var sy = Math.max(f.y, f.y + entry.y0 - pad);
      var sx2 = Math.min(f.x + f.w, f.x + entry.x1 + pad);
      var sy2 = Math.min(f.y + f.h, f.y + entry.y1 + pad);
      if (sx2 > sx && sy2 > sy) {
        ctx.drawImage(gripCtx.img, sx, sy, sx2 - sx, sy2 - sy,
          dest.x + (sx - f.x) * k, dest.y + (sy - f.y) * k,
          (sx2 - sx) * k, (sy2 - sy) * k);
      }
      return;
    }

    // Đường dự phòng (sheet cũ / thiếu dữ liệu grip): neo tĩnh JOYFIX nhưng
    // dùng điểm nắm trong icon + góc lưỡi + tỉ lệ của GRIPFIX.
    var anchor = handTable ? handTable[dirName] : null;
    if (!anchor) return;
    var ax = dest.x + anchor[0] * dest.w;
    var ay = dest.y + anchor[1] * dest.h;
    lastGripWorld = { x: ax, y: ay, dirName: dirName };
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(rot);
    ctx.drawImage(sheet, def.iconCol * 32, def.iconRow * 32, 32, 32,
      -icon.gx * s, -icon.gy * s, 32 * s, 32 * s);
    ctx.restore();
  }

  function buildGenHatIndex(json) {
    if (!json || !json.sprites || !json.frames || !json.size) return null;
    if (!(json.size.w > 0 && json.size.h > 0)) return null;
    return { w: json.size.w, h: json.size.h, sprites: json.sprites, frames: json.frames };
  }

  // Đợt HATLAYER: vẽ lớp nón trang bị phủ lên khung sinh hình VỪA vẽ.
  // Sprite nón trích từ các dải "có nón" của chính đợt sản xuất (không
  // sinh hình mới); vị trí neo theo ĐẦU của đúng khung đang vẽ: gói dữ
  // liệu mang sẵn, cho từng khung, điểm neo đầu (ax, ay — tọa độ cục bộ
  // của khung nhân vật) đo thật từ hình khung, và điểm ngồi của nón
  // (seat) trong sprite. Cùng hệ số tỉ lệ k và cùng neo pivot với khung
  // nhân vật nên nón bám đầu ở mọi hướng/khung; thiếu dữ liệu thì bỏ qua
  // lặng lẽ (đầu trần như hành vi đã duyệt của CHARINTEG).
  function drawGenHat(img, mode, dirName, frameIdx, f, data) {
    var hat = hanhanGenHat;
    if (!hat || !img || !img.complete || !f || !data) return false;
    if (img.naturalWidth !== hat.w || img.naturalHeight !== hat.h) return false;
    var per = hat.frames[mode] && hat.frames[mode][dirName];
    if (!per || !per.length) return false;
    var e = per[frameIdx % per.length];
    if (!e) return false;
    var spr = hat.sprites[e.sprite];
    if (!spr || !spr.rect || !spr.seat) return false;
    var r = spr.rect;
    if (!(r.w > 0 && r.h > 0) || r.x < 0 || r.y < 0 ||
        r.x + r.w > img.naturalWidth || r.y + r.h > img.naturalHeight) return false;
    if (!isFinite(e.ax) || !isFinite(e.ay) || !isFinite(spr.seat.x) || !isFinite(spr.seat.y)) return false;
    var k = HH_GEN_DISPLAY_H / (data.charH * data.scaleFromMaster);
    ctx.drawImage(img, r.x, r.y, r.w, r.h,
      player.x - f.px * k + (e.ax - spr.seat.x) * k,
      player.y - playerLiftY - f.py * k + (e.ay - spr.seat.y) * k,
      r.w * k, r.h * k);
    return true;
  }

  function preloadAssets(callback) {
    if (typeof Image === 'undefined') {
      if (callback) callback();
      return;
    }

    var urls = [
      'assets/chars/hanhan-idle.png',
      'assets/chars/hanhan-walk.png',
      'assets/chars/hanhan-gen-idle-v1.png',
      'assets/chars/hanhan-gen-walk-v1.png',
      'assets/chars/hanhan-gen-hat-v1.png',
      'assets/chars/hanhan-face.png',
      'assets/chars/thaotinh-sheet.png',
      'assets/chars/nhenxanh-sheet.png',
      'assets/chars/cothuye-sheet.png',
      'assets/art/icons-sheet.png',
      'assets/chars/hanhan-thaicuc-atlas.png',
      'assets/chars/fx-thaicuc-yinyang.png',
      // Đợt KIẾP VÂN vòng 3: tài sản thật của cảnh độ kiếp — mây bão + sương
      // (vòng 1), tia lôi kiếp sinh hình trắng–tím (thang nặng dần 1→4),
      // cung điện bò trong mây (2 tím + 1 hồng đỏ), khung bùng nổ tia cuối.
      'assets/art/fx-kiep-van-1.png',
      'assets/art/fx-kiep-van-2.png',
      'assets/art/fx-kiep-van-3.png',
      'assets/art/fx-kiep-suong.png',
      'assets/art/fx-loi-kiep-1.png',
      'assets/art/fx-loi-kiep-2.png',
      'assets/art/fx-loi-kiep-3.png',
      'assets/art/fx-loi-kiep-4.png',
      'assets/art/fx-cung-dien-1.png',
      'assets/art/fx-cung-dien-2.png',
      'assets/art/fx-cung-dien-3.png',
      'assets/art/fx-bung-no.png',
      // Đợt KIẾP VÂN vòng 4: bộ mây bão sinh thật nhiều tầng có thể tích
      // (trần bão xa, bụng mây xoáy sấm, hai cụm mây gần cuộn trào gờ sáng)
      'assets/art/fx-kiep-van4-xa.png',
      'assets/art/fx-kiep-van4-bung.png',
      'assets/art/fx-kiep-van4-gan-1.png',
      'assets/art/fx-kiep-van4-gan-2.png'
    ];

    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
    var allMaps = (holder && holder.maps) ? holder.maps : {};
    for (var mId in allMaps) {
      var m = allMaps[mId];
      if (m.bgImage && urls.indexOf(m.bgImage) === -1) urls.push(m.bgImage);
      if (m.standees) {
        for (var s = 0; s < m.standees.length; s++) {
          if (m.standees[s].asset && urls.indexOf(m.standees[s].asset) === -1) {
            urls.push(m.standees[s].asset);
          }
        }
      }
      if (m.npcs) {
        for (var n = 0; n < m.npcs.length; n++) {
          if (m.npcs[n].asset && urls.indexOf(m.npcs[n].asset) === -1) {
            urls.push(m.npcs[n].asset);
          }
        }
      }
    }

    // Đợt 4A: nạp sheet quái theo SPECIES — khóa assets là speciesId + '_sheet'
    // (và speciesId + '_skill_sheet' cho sheet chiêu của boss).
    var speciesSheetKeys = {};
    var monstersHolder = (typeof window !== 'undefined' && window.GameMonsters) ? window.GameMonsters : null;
    if (monstersHolder && monstersHolder.SPECIES) {
      for (var spId in monstersHolder.SPECIES) {
        var spDef = monstersHolder.SPECIES[spId];
        if (spDef.sheetAsset) {
          if (urls.indexOf(spDef.sheetAsset) === -1) urls.push(spDef.sheetAsset);
          (speciesSheetKeys[spDef.sheetAsset] = speciesSheetKeys[spDef.sheetAsset] || []).push(spId + '_sheet');
        }
        if (spDef.skillAsset) {
          if (urls.indexOf(spDef.skillAsset) === -1) urls.push(spDef.skillAsset);
          (speciesSheetKeys[spDef.skillAsset] = speciesSheetKeys[spDef.skillAsset] || []).push(spId + '_skill_sheet');
        }
      }
    }

    var remaining = urls.length;
    function checkDone() {
      remaining--;
      if (remaining <= 0) {
        assetsLoaded = true;
        if (callback) callback();
      }
    }

    for (var i = 0; i < urls.length; i++) {
      (function (url) {
        var img = new Image();
        img.onload = checkDone;
        img.onerror = function () {
          console.error('Không thể nạp tài nguyên:', url);
          checkDone();
        };
        img.src = url;
        assets[url] = img;
        if (speciesSheetKeys[url]) {
          for (var sk2 = 0; sk2 < speciesSheetKeys[url].length; sk2++) {
            assets[speciesSheetKeys[url][sk2]] = img;
          }
        }
        // Bí danh tương thích ngược
        if (url === 'assets/art/map-mieu-hoang-bg.png') assets['map_bg'] = img;
        if (url === 'assets/art/map-rung-doc-bg.png') assets['map_rung_doc_bg'] = img;
        if (url === 'assets/art/obj-temple.png') assets['temple'] = img;
        if (url === 'assets/art/obj-tree-pine.png') assets['pine'] = img;
        if (url === 'assets/art/obj-tree-broadleaf.png') assets['broadleaf_tree'] = img;
        if (url === 'assets/art/obj-fallen-log.png') assets['fallen_log'] = img;
        if (url === 'assets/art/npc-linhnhi.png') assets['linhnhi'] = img;
        if (url === 'assets/chars/hanhan-idle.png') assets['hanhan_idle'] = img;
        if (url === 'assets/chars/hanhan-walk.png') assets['hanhan_walk'] = img;
        if (url === 'assets/chars/hanhan-face.png') assets['hanhan_face'] = img;
        if (url === 'assets/chars/hanhan-gen-idle-v1.png') assets['hanhan_gen_idle'] = img;
        if (url === 'assets/chars/hanhan-gen-walk-v1.png') assets['hanhan_gen_walk'] = img;
        if (url === 'assets/chars/hanhan-gen-hat-v1.png') assets['hanhan_gen_hat'] = img;
        if (url === 'assets/chars/thaotinh-sheet.png') assets['thaotinh_sheet'] = img;
        if (url === 'assets/chars/nhenxanh-sheet.png') assets['nhenxanh_sheet'] = img;
        if (url === 'assets/chars/cothuye-sheet.png') assets['cothuye_sheet'] = img;
        if (url === 'assets/art/icons-sheet.png') assets['icons_sheet'] = img;
        if (url === 'assets/chars/hanhan-thaicuc-atlas.png') assets['thaicuc_atlas'] = img;
        if (url === 'assets/chars/fx-thaicuc-yinyang.png') assets['thaicuc_yinyang'] = img;
        if (url === 'assets/art/fx-kiep-van-1.png') assets['kiep_van_1'] = img;
        if (url === 'assets/art/fx-kiep-van-2.png') assets['kiep_van_2'] = img;
        if (url === 'assets/art/fx-kiep-van-3.png') assets['kiep_van_3'] = img;
        if (url === 'assets/art/fx-kiep-suong.png') assets['kiep_suong'] = img;
        if (url === 'assets/art/fx-loi-kiep-1.png') assets['loi_kiep_1'] = img;
        if (url === 'assets/art/fx-loi-kiep-2.png') assets['loi_kiep_2'] = img;
        if (url === 'assets/art/fx-loi-kiep-3.png') assets['loi_kiep_3'] = img;
        if (url === 'assets/art/fx-loi-kiep-4.png') assets['loi_kiep_4'] = img;
        if (url === 'assets/art/fx-cung-dien-1.png') assets['cung_dien_1'] = img;
        if (url === 'assets/art/fx-cung-dien-2.png') assets['cung_dien_2'] = img;
        if (url === 'assets/art/fx-cung-dien-3.png') assets['cung_dien_3'] = img;
        if (url === 'assets/art/fx-bung-no.png') assets['bung_no'] = img;
        if (url === 'assets/art/fx-kiep-van4-xa.png') assets['kiep_van4_xa'] = img;
        if (url === 'assets/art/fx-kiep-van4-bung.png') assets['kiep_van4_bung'] = img;
        if (url === 'assets/art/fx-kiep-van4-gan-1.png') assets['kiep_van4_gan_1'] = img;
        if (url === 'assets/art/fx-kiep-van4-gan-2.png') assets['kiep_van4_gan_2'] = img;
      })(urls[i]);
    }

    if (typeof Image !== 'undefined') {
      try {
        var hIdle = new Image();
        hIdle.onload = function () { assets.hanhan_hat_idle = hIdle; };
        hIdle.onerror = function () { assets.hanhan_hat_idle = null; };
        hIdle.src = 'assets/chars/hanhan-hat-idle.png';

        var hWalk = new Image();
        hWalk.onload = function () { assets.hanhan_hat_walk = hWalk; };
        hWalk.onerror = function () { assets.hanhan_hat_walk = null; };
        hWalk.src = 'assets/chars/hanhan-hat-walk.png';
      } catch (e) {}
    }

    // Đợt CHARINTEG: nạp JSON tọa độ khung của hai atlas sinh hình. Không
    // chặn vòng nạp chính — bộ máy vẽ tự lùi về sheet cũ cho tới khi dữ
    // liệu về, và lùi hẳn nếu nạp hỏng.
    if (typeof fetch === 'function') {
      try {
        fetch('assets/chars/hanhan-gen-idle-v1.json').then(function (r) {
          return r && r.ok ? r.json() : null;
        }).then(function (j) {
          var idx = buildGenIndex(j);
          if (idx) hanhanGenData.idle = idx;
        }).catch(function () {});
        fetch('assets/chars/hanhan-gen-walk-v1.json').then(function (r) {
          return r && r.ok ? r.json() : null;
        }).then(function (j) {
          var idx = buildGenIndex(j);
          if (idx) hanhanGenData.walk = idx;
        }).catch(function () {});
        fetch('assets/chars/hanhan-gen-hat-v1.json').then(function (r) {
          return r && r.ok ? r.json() : null;
        }).then(function (j) {
          var idx = buildGenHatIndex(j);
          if (idx) hanhanGenHat = idx;
        }).catch(function () {});
        fetch('assets/chars/hanhan-gen-grip-v1.json').then(function (r) {
          return r && r.ok ? r.json() : null;
        }).then(function (j) {
          if (j && j.gen && j.gen.idle && j.gen.walk) hanhanGrip = j;
        }).catch(function () {});
      } catch (e) {}
    }
  }

  function initEngine(canvasEl, playerObj, mapObj, onReady) {
    canvas = canvasEl;
    ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    player = playerObj;
    if (player) {
      try {
        Object.defineProperty(player, 'path', {
          get: function () { return currentPath; },
          set: function (val) { currentPath = Array.isArray(val) ? val : []; },
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        player.path = currentPath;
      }
    }
    if (typeof mapObj === 'string') {
      currentMapId = mapObj;
      var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null);
      if (holder && holder.maps && holder.maps[mapObj]) {
        mapData = holder.maps[mapObj];
      } else if (holder && holder.getMap) {
        mapData = holder.getMap(mapObj);
      } else {
        mapData = holder;
      }
    } else if (mapObj) {
      mapData = mapObj;
      if (mapObj.id) currentMapId = mapObj.id;
    } else {
      mapData = typeof window !== 'undefined' ? window.MapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null);
      currentMapId = 'mieu_hoang';
    }
    stateAPI = typeof window !== 'undefined' ? window.GameState : (typeof require !== 'undefined' ? require('./state.js') : null);
    audioAPI = typeof window !== 'undefined' ? window.GameAudio : null;
    pathfinder = typeof window !== 'undefined' ? window.Pathfinder : (typeof require !== 'undefined' ? require('./pathfind.js') : null);
    combatAPI = typeof window !== 'undefined' ? window.GameCombat : null;
    monstersAPI = typeof window !== 'undefined' ? window.GameMonsters : (typeof require !== 'undefined' ? require('./monsters.js') : null);
    skillsAPI = typeof window !== 'undefined' ? window.GameSkills : (typeof require !== 'undefined' ? require('./skills.js') : null);
    // Tương thích save cũ: đã nhận nhiệm vụ tông môn đầu tiên (sectStage >= 2) mà chưa
    // có kiếm nào trong túi/trang bị thì được cấp Kiếm Đệ Tử một lần ngay khi nạp.
    // Đợt JOYFIX: điều kiện cấp bù xét theo cờ ĐÃ NHẬN THẬT (starterSwordReceived)
    // để cả save từng bị bản cũ đóng cờ oan (Granted=true mà chưa hề nhận kiếm)
    // cũng được cấp bù khi nạp lại.
    if (player && player.quests && (player.quests.sectStage || 0) >= 2 && !player.quests.starterSwordReceived) {
      grantStarterSword(false);
    }
    onReadyCallback = onReady;

    if (canvas) resizeCanvas();
    if (player && mapData) updateCamera();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resizeCanvas);
      setupInputs();
    }

    preloadAssets(function () {
      initFieldMonsters();
      if (onReadyCallback) onReadyCallback();
    });
  }

  var userZoom = 1.0;

  function getUserZoom() {
    return userZoom;
  }

  function setUserZoom(f) {
    var val = Number(f);
    if (!isFinite(val)) val = 1.0;
    userZoom = Math.max(0.75, Math.min(1.5, Math.round(val * 100) / 100));
    resizeCanvas();
    return userZoom;
  }

  function getCameraScale() {
    return camera.scale;
  }

  function resizeCanvas() {
    if (!canvas || typeof window === 'undefined') return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    var baseScale = h / 720;
    var targetScale = baseScale * userZoom;
    camera.scale = Math.max(0.4, Math.min(2.5, targetScale));
    camera.viewportW = w / camera.scale;
    camera.viewportH = h / camera.scale;
  }

  function initFieldMonsters() {
    spawnFieldMonstersForMap(mapData);
  }

  function spawnFieldMonstersForMap(map) {
    fieldMonsters = [];
    if (!monstersAPI || !map) return;
    var packs = map.monsterPacks;
    if (!packs && map.id === 'rung-doc') {
      packs = monstersAPI.RUNG_DOC_PACKS;
    }
    if (!packs || packs.length === 0) return;

    for (var p = 0; p < packs.length; p++) {
      var pack = packs[p];
      for (var c = 0; c < pack.count; c++) {
        var angle = Math.random() * Math.PI * 2;
        var dist = (c === 0) ? 0 : (15 + Math.random() * (pack.spread || 40));
        var mx = pack.anchor.x + Math.cos(angle) * dist;
        var my = pack.anchor.y + Math.sin(angle) * dist;
        var m = monstersAPI.createMonster(pack.speciesId, mx, my, pack.anchor.x, pack.anchor.y, {
          spawnGraceTimer: 0
        });
        m.packId = pack.id;
        m.mapId = map.id;
        fieldMonsters.push(m);
      }
    }
  }

  function setupInputs() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      var handled = true;
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysDown.up = true;
          break;
        case 's':
        case 'arrowdown':
          keysDown.down = true;
          break;
        case 'a':
        case 'arrowleft':
          keysDown.left = true;
          break;
        case 'd':
        case 'arrowright':
          keysDown.right = true;
          break;
        case ' ':
        case 'e':
          // Phím Space/E = nút hành động theo ngữ cảnh (cùng hành vi với nút trên HUD)
          e.preventDefault();
          performContextAction();
          break;
        default:
          handled = false;
      }
      if (handled) {
        cancelAutoPath(true);
        cancelTravel();
        currentPath = [];
        pendingInteraction = null;
        if (audioAPI) audioAPI.init();
      }
    });

    window.addEventListener('keyup', function (e) {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysDown.up = false;
          break;
        case 's':
        case 'arrowdown':
          keysDown.down = false;
          break;
        case 'a':
        case 'arrowleft':
          keysDown.left = false;
          break;
        case 'd':
        case 'arrowright':
          keysDown.right = false;
          break;
      }
    });

    canvas.addEventListener('pointerdown', function (e) {
      if (audioAPI) audioAPI.init();
      var rect = canvas.getBoundingClientRect();
      var screenX = e.clientX - rect.left;
      var screenY = e.clientY - rect.top;

      var worldX = camera.x + screenX / camera.scale;
      var worldY = camera.y + screenY / camera.scale;

      handleWorldClick(worldX, worldY);
    });
  }

  function isNpcActive(npc) {
    if (!npc) return false;
    if (!npc.questGate) return true;
    var s = (player && player.quests && player.quests.sectStage !== undefined) ? player.quests.sectStage : 0;
    if (npc.questGate === 'before_departure') return s < 1;
    if (npc.questGate === 'after_departure') return s >= 1;
    return true;
  }

  /**
   * Kiểm tra người chơi có đang đứng trong tầm tương tác của NPC:
   * 1. Khoảng cách chân-chân <= INTERACTION_RANGE (48px) — tầm tương tác chuẩn của game
   * 2. Hoặc khoảng cách tới standTile <= 60px
   * 3. Hoặc khoảng cách tâm-tâm <= 110px
   */
  function isPlayerInNpcRange(npc) {
    if (!player || !npc) return false;
    var distFeet = Math.hypot(player.x - npc.feetX, player.y - npc.feetY);
    if (distFeet <= INTERACTION_RANGE) return true;
    if (npc.standTile) {
      var distStand = Math.hypot(player.x - npc.standTile.x, player.y - npc.standTile.y);
      if (distStand <= 60) return true;
    }
    var cx = (npc.x || 0) + (npc.w || 72) / 2;
    var cy = (npc.y || 0) + (npc.h || 120) / 2;
    if (Math.hypot(player.x - cx, player.y - cy) <= 110) return true;
    return false;
  }

  function handleWorldClick(worldX, worldY) {
    if (!player || !mapData) return;
    if (autoPath.active) cancelAutoPath(true);
    if (travelState.active) cancelTravel();
    currentPath = [];
    pendingInteraction = null;
    if (player) player.path = currentPath;

    // 1. Kiểm tra click vào quái vật
    if (fieldMonsters.length > 0) {
      var clickedMonster = findMonsterAt(worldX, worldY);
      if (clickedMonster) {
        targetMonster = clickedMonster;
        var distM = Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y);
        if (distM > 50) {
          triggerPathTo(targetMonster.x, targetMonster.y, null);
        }
        return;
      }
    }

    targetMonster = null;

    // 2. Click vào NPC
    var npcsToCheck = (mapData.npcs && mapData.npcs.length > 0) ? mapData.npcs : [];
    if (mapData.linhnhi && npcsToCheck.indexOf(mapData.linhnhi) === -1) {
      npcsToCheck = npcsToCheck.concat([mapData.linhnhi]);
    }
    if (npcsToCheck.length > 0) {
      for (var n = 0; n < npcsToCheck.length; n++) {
        var npc = npcsToCheck[n];
        if (!isNpcActive(npc)) continue;
        var bounds = {
          x: npc.x - 10,
          y: npc.y - 10,
          w: npc.w + 20,
          h: npc.h + 20
        };
        if (worldX >= bounds.x && worldX <= bounds.x + bounds.w &&
            worldY >= bounds.y && worldY <= bounds.y + bounds.h) {
          if (isPlayerInNpcRange(npc)) {
            // Đứng gần: Mở thoại ngay trong cùng sự kiện chạm, không tạo đường đi, không di chuyển 1 pixel
            currentPath = [];
            pendingInteraction = null;
            if (player) player.path = currentPath;
            triggerDialogue(npc);
          } else {
            // Ở xa: Tự tìm đường tới cạnh NPC, mở thoại đúng một lần khi tới nơi
            (function (targetNpc) {
              var destX = (targetNpc.standTile && targetNpc.standTile.x !== undefined) ? targetNpc.standTile.x : targetNpc.feetX;
              var destY = (targetNpc.standTile && targetNpc.standTile.y !== undefined) ? targetNpc.standTile.y : targetNpc.feetY;
              triggerPathTo(destX, destY, {
                type: 'npc',
                onArrive: function () { triggerDialogue(targetNpc); }
              });
            })(npc);
          }
          return;
        }
      }
    }

    // 3. Click vào Harvest Node
    if (mapData.harvestNodes && mapData.harvestNodes.length > 0) {
      for (var h = 0; h < mapData.harvestNodes.length; h++) {
        var hn = mapData.harvestNodes[h];
        var hr = hn.radius || 48;
        if (Math.hypot(worldX - hn.x, worldY - hn.y) <= hr) {
          var distToHn = Math.hypot(player.x - hn.x, player.y - hn.y);
          if (distToHn <= hr) {
            currentPath = [];
            pendingInteraction = null;
            if (player) player.path = currentPath;
            executeHarvestNode(hn);
          } else {
            (function (targetHn) {
              triggerPathTo(targetHn.x, targetHn.y, {
                type: 'harvest',
                onArrive: function () { executeHarvestNode(targetHn); }
              });
            })(hn);
          }
          return;
        }
      }
    }

    // 4. Click vào Interactable
    if (mapData.interactables && mapData.interactables.length > 0) {
      for (var i = 0; i < mapData.interactables.length; i++) {
        var it = mapData.interactables[i];
        var ir = it.radius || 48;
        if (Math.hypot(worldX - it.x, worldY - it.y) <= ir) {
          var distToIt = Math.hypot(player.x - it.x, player.y - it.y);
          if (distToIt <= ir) {
            currentPath = [];
            pendingInteraction = null;
            if (player) player.path = currentPath;
            executeInteractableAction(it);
          } else {
            (function (targetIt) {
              triggerPathTo(targetIt.x, targetIt.y, {
                type: 'interactable',
                onArrive: function () { executeInteractableAction(targetIt); }
              });
            })(it);
          }
          return;
        }
      }
    }

    // 5. Click di chuyển thông thường
    triggerPathTo(worldX, worldY, null);
  }

  var lastOpenedDialogue = null;
  function triggerDialogue(npc) {
    if (!npc) return;
    var stepInfo = getQuestTargetInfo();
    var isTarget = stepInfo && stepInfo.kind === 'npc' && stepInfo.npcId === npc.id;
    var lines = (isTarget && npc.dialogueQuest && npc.dialogueQuest.length > 0) ? npc.dialogueQuest : (npc.dialogueDefault || npc.dialogue || []);
    var resolvedNpc = Object.assign({}, npc, { dialogue: lines });
    lastOpenedDialogue = resolvedNpc;

    var ui = (typeof window !== 'undefined' && window.GameUI)
      ? window.GameUI
      : (typeof globalThis !== 'undefined' && globalThis.GameUI)
        ? globalThis.GameUI
        : (global && global.GameUI ? global.GameUI : null);
    if (ui && ui.openDialogue) {
      ui.openDialogue(resolvedNpc);
    }
  }

  function triggerDialogueLinhNhi() {
    triggerDialogue(mapData.linhnhi);
  }

  function triggerLockedDoorToast() {
    if (audioAPI) audioAPI.playDoorKnock();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast((mapData.temple && mapData.temple.lockedToast) ? mapData.temple.lockedToast : 'Miếu đang khóa — đợt sau mở');
    }
  }

  // ---- Đợt questsword: TẶNG KIẾM ĐỆ TỬ khi nhận nhiệm vụ tông môn đầu tiên ----
  var STARTER_SWORD_ID = 'kiem-de-tu';
  var SWORD_ITEM_IDS = ['kiem-de-tu', 'kiem-go', 'kiem-sat'];
  var pendingSwordToast = false;

  // Đợt JOYFIX 2026-11-09: "đã có kiếm" phải là có đúng KIẾM ĐỆ TỬ. Bản cũ
  // tính cả Kiếm Gỗ/Kiếm Sắt là "đã có kiếm" rồi ĐÓNG cờ cấp trong im lặng —
  // đệ tử nào có kiếm khác trong người trước mốc nhập môn sẽ mất hẳn lần cấp
  // tông môn (không kiếm, không thông báo), đúng triệu chứng người chơi báo
  // "nhập Thanh Vân Tông mà chưa thấy nhiệm vụ cấp kiếm ở đầu".
  function playerOwnsSword() {
    if (!player) return false;
    if (player.equipment && player.equipment.weapon === STARTER_SWORD_ID) return true;
    if (player.bag && player.bag.slots) {
      for (var i = 0; i < player.bag.slots.length; i++) {
        var s = player.bag.slots[i];
        if (s && s.itemId === STARTER_SWORD_ID) return true;
      }
    }
    return false;
  }

  // Tặng Kiếm Đệ Tử đúng một lần: hai cờ tách bạch (đợt JOYFIX) —
  // quests.starterSwordGranted = đã xử lý mốc cấp; quests.starterSwordReceived
  // = đã THẬT SỰ nhận kiếm vào túi/trang bị. Save cũ bị bản trước nuốt cấp có
  // Granted=true nhưng Received trống và trong người không có Kiếm Đệ Tử:
  // được cấp bù đúng một lần ở lần nạp/mốc này, rồi Received khóa lại (đã nhận
  // thật mà bán/thả mất thì không cấp lại).
  // Trả true nếu vừa tặng xong. feedback=false khi chạy lúc nạp save (toast hoãn tới start()).
  function grantStarterSword(feedback) {
    if (!player || !player.quests || !stateAPI) return false;
    var q = player.quests;
    if (playerOwnsSword()) {
      if (!q.starterSwordGranted || !q.starterSwordReceived) {
        q.starterSwordGranted = true;
        q.starterSwordReceived = true;
        stateAPI.savePlayer(player);
      }
      return false;
    }
    if (q.starterSwordReceived) return false;
    var res = stateAPI.addItemToBag(player, STARTER_SWORD_ID, 1);
    if (!res || !res.success) return false; // Túi đầy: giữ cờ tắt, lần nạp sau thử lại
    q.starterSwordGranted = true;
    q.starterSwordReceived = true;
    stateAPI.savePlayer(player);
    if (feedback) {
      spawnFloatingText('Nhận được: Kiếm Đệ Tử', player.x, player.y - 35, '#ffe9a8');
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.refreshHUD();
        window.GameUI.showToast('Nhận được: Kiếm Đệ Tử');
      }
    } else {
      pendingSwordToast = true;
    }
    return true;
  }

  function handleNpcTalked(npcId) {
    if (!player || !player.quests) return;
    var q = player.quests;
    if (npcId === 'npc_linhnhi') {
      if (!q.talked_linhnhi) {
        q.talked_linhnhi = true;
        q.current = 'hunt';
        q.thaotinhKills = 0;
        q.huntCompleted = false;
        if (stateAPI) stateAPI.savePlayer(player);
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Săn Thảo Tinh ở Rừng Độc (0/5)');
        }
      } else if (q.huntCompleted && (q.sectStage || 0) === 0) {
        q.sectStage = 1;
        if (stateAPI) stateAPI.savePlayer(player);
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Báo danh ở Lối Vào tông môn');
        }
      }
    } else if (npcId === 'npc_tiepdan') {
      if ((q.sectStage || 0) === 1) {
        q.sectStage = 2;
        if (stateAPI) stateAPI.savePlayer(player);
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Diện kiến Chưởng Môn ở Đại Điện');
        }
        // Nhận nhiệm vụ tông môn đầu tiên: tông môn cấp ngay Kiếm Đệ Tử (toast kiếm hiện sau cùng)
        grantStarterSword(true);
      }
    } else if (npcId === 'npc_chuongmon') {
      if ((q.sectStage || 0) === 2) {
        q.sectStage = 3;
        player.linhThach = (player.linhThach || 0) + 20;
        if (audioAPI) audioAPI.playChime();
        spawnFloatingText('+20 Linh Thạch', player.x, player.y - 35, '#ffe9a8');
        if (stateAPI) stateAPI.savePlayer(player);
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhiệm vụ mới: Nhận lệnh từ Chấp Sự');
        }
      }
    } else if (npcId === 'npc_chapsu') {
      if ((q.sectStage || 0) === 3) {
        q.sectStage = 4;
        if (!q.mainStage) q.mainStage = 1;
        player.linhThach = (player.linhThach || 0) + 30;
        if (audioAPI) audioAPI.playChime();
        spawnFloatingText('+30 Linh Thạch', player.x, player.y - 35, '#ffe9a8');
        if (stateAPI) stateAPI.savePlayer(player);
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nhập môn hoàn thành! Đài Truyền Tống phía đông nam đã mở.');
        }
        // Đợt JOYFIX: lưới an toàn cấp kiếm — mốc này kích hoạt nhiệm vụ chính
        // đầu tiên "Rèn Luyện Căn Bản" (mainStage 1); nếu vì bất kỳ lý do gì lần
        // cấp ở Tiếp Dẫn chưa chạy (save cũ, đường thoại khác), cấp ngay tại đây
        // để đệ tử mới luôn có Kiếm Đệ Tử khi bắt đầu nhiệm vụ căn bản. Hàm cấp
        // tự khóa một lần duy nhất nên gọi trùng vô hại.
        grantStarterSword(true);
      } else if ((q.sectStage || 0) >= 4) {
        if (q.mainStage === 8) {
          var countItem = function (id) {
            return stateAPI ? stateAPI.countItemInBag(player, id) : 0;
          };
          var c1 = countItem('linh-chi-rung');
          var c2 = countItem('bang-tuy');
          var c3 = countItem('hoa-tinh-tho');
          var c4 = countItem('nguyen-tinh-moc');
          var c5 = countItem('nguyen-tinh-thuy');
          var lt = player.linhThach || 0;
          if (c1 >= 3 && c2 >= 1 && c3 >= 2 && c4 >= 1 && c5 >= 1 && lt >= 200) {
            refineTrucCoDan();
          }
        }
      }
    }
  }

  function executeInteractableAction(it) {
    if (!it || !it.action) return;
    switch (it.action) {
      case 'temple_door':
        triggerLockedDoorToast();
        break;
      case 'door_enter':
        if (it.targetMap) {
          switchMap(it.targetMap, it.targetSpawn || { x: 600, y: 690 });
        }
        break;
      case 'teleport':
        if (typeof window !== 'undefined' && window.GameUI && window.GameUI.openTeleportModal) {
          window.GameUI.openTeleportModal();
        }
        break;
      case 'restore_spring':
        var now = Date.now();
        var last = player.lastSpringUse || 0;
        var cdMs = (it.cooldownSec || 60) * 1000;
        if (now - last < cdMs) {
          var remSec = Math.ceil((cdMs - (now - last)) / 1000);
          if (typeof window !== 'undefined' && window.GameUI) {
            window.GameUI.showToast('Linh tuyền đang tích tụ linh khí (' + remSec + 's)');
          }
          return;
        }
        player.lastSpringUse = now;
        player.hp = player.hpMax;
        player.linhLuc = player.linhLucMax;
        spawnFloatingText('Khí huyết & Linh lực đầy!', player.x, player.y - 35, '#7ce898');
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Đã hồi phục toàn bộ Khí Huyết và Linh Lực');
        }
        break;
      case 'meditate':
        player.linhLuc = player.linhLucMax;
        spawnFloatingText('Linh lực đầy!', player.x, player.y - 35, '#6ee7b7');
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Đả tọa tĩnh tâm: Linh Lực đã hồi phục');
        }
        // Đợt T1: đả tọa tại điểm này trong lúc ở tầng 3 = hoàn thành tiểu
        // bình cảnh NGỘ ĐẠO của mốc 3->4 (hồ sơ 06: "lên linh mạch đả tọa
        // ngộ đạo 1 lần tại điểm linh mạch").
        if (typeof window !== 'undefined' && window.GameTieuMoc && window.GameTieuMoc.noteNgoDao) {
          window.GameTieuMoc.noteNgoDao(player);
        }
        break;
      case 'rest_inn':
        player.hp = player.hpMax;
        player.linhLuc = player.linhLucMax;
        spawnFloatingText('Hồi phục hoàn toàn!', player.x, player.y - 35, '#7ce898');
        if (audioAPI) audioAPI.playChime();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.refreshHUD();
          window.GameUI.showToast('Nghỉ ngơi tại nhà trọ: Khí Huyết và Linh Lực đã tràn đầy');
        }
        break;
      case 'notice_board':
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Bảng Tông Môn: Sự kiện bí cảnh sẽ mở ở đợt sau.');
        }
        break;
      case 'dan_phong':
        // Đợt DANPHONG: Lò Đan ở khu dược Tông Môn — mở bảng Đan Phòng (thẻ Luyện Đan)
        if (typeof window !== 'undefined' && window.GameDanPhong && window.GameDanPhong.openPanel) {
          window.GameDanPhong.openPanel('refine');
        }
        break;
      case 'practice_dummy':
        var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { attack: 10 };
        var dmg = Math.round(stats.attack * (0.9 + Math.random() * 0.2));
        player.dir = getDirFromVelocity(it.x - player.x, it.y - player.y);
        if (audioAPI) audioAPI.playSlash();
        visualEffects.push({
          type: 'slash_crescent',
          x: player.x,
          y: player.y - 25,
          targetX: it.x,
          targetY: it.y - 15,
          timer: 0.22,
          duration: 0.22
        });
        spawnFloatingText(dmg + '', it.x, it.y - 35, '#ffffff');
        break;
      case 'locked_portal':
        if (audioAPI) audioAPI.playDoorKnock();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Bí cảnh mở theo sự kiện — đợt sau');
        }
        break;
      case 'locked_arena':
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Luận võ mở ở đợt sau');
        }
        break;
      default:
        break;
    }
  }

  function executeHarvestNode(node) {
    if (!node || !player) return;
    var nowSec = performance.now() / 1000;
    var readyAt = harvestReadyTimes[node.id] || 0;
    if (nowSec < readyAt) {
      var remSec = Math.ceil(readyAt - nowSec);
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Linh dược đang lớn (' + remSec + 's)');
      }
      return;
    }
    harvestReadyTimes[node.id] = nowSec + (node.respawnSec || 90);
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.harvests = (player.stats.harvests || 0) + 1;

    if (node.itemId === 'linh-thach') {
      var min = node.countMin || 3;
      var max = node.countMax || 5;
      var count = min + Math.floor(Math.random() * (max - min + 1));
      player.linhThach = (player.linhThach || 0) + count;
      spawnFloatingText('+' + count + ' Linh Thạch', player.x, player.y - 35, '#ffe9a8');
    } else {
      var countItem = node.count || 1;
      if (stateAPI) stateAPI.addItemToBag(player, node.itemId, countItem);
      var def = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS[node.itemId] : null;
      var name = def ? def.name : (node.name || node.itemId);
      spawnFloatingText('+' + countItem + ' ' + name, player.x, player.y - 35, '#7ce898');
    }

    if (audioAPI) audioAPI.playPickup();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.refreshHUD();
    }
  }

  // ============================================================
  // NHẶT ĐỒ RƠI — hàm dùng chung cho "bước qua nhặt" và nút "Nhặt Đồ"
  // ============================================================
  function collectDropAtIndex(i, todayData) {
    var drop = groundDrops[i];
    if (!drop) return false;
    if (drop.itemId === 'linh-thach') {
      // Tính Linh Thạch qua trần farm theo ngày (Hồ sơ 50 §7 — đợt T1: trần
      // theo ĐẠI CẢNH GIỚI của người chơi, không còn ngưỡng cứng 300/600)
      var gainedLt = stateAPI ? stateAPI.calcLinhThachGain(todayData.farmLinhThach, drop.count, player) : drop.count;
      player.linhThach = (player.linhThach || 0) + gainedLt;
      todayData.farmLinhThach += gainedLt;
      if (player.farmSession) {
        player.farmSession.linhThach += gainedLt;
      }
      spawnFloatingText('+' + gainedLt + ' Linh Thạch', player.x, player.y - 35, '#ffe9a8');
      if (audioAPI) audioAPI.playPickup();
      groundDrops.splice(i, 1);
      return true;
    }
    // Cho vào túi trữ vật (Brief §6)
    var addResult = stateAPI ? stateAPI.addItemToBag(player, drop.itemId, drop.count) : { success: true };
    if (addResult.success) {
      var def = monstersAPI.ITEM_DEFS[drop.itemId];
      var itemName = def ? def.name : drop.itemId;
      spawnFloatingText('+' + drop.count + ' ' + itemName, player.x, player.y - 35, '#7ce898');
      if (player.farmSession && def) {
        player.farmSession.notableLoot.push(def.name);
      }
      if (audioAPI) audioAPI.playPickup();
      groundDrops.splice(i, 1);
      return true;
    }
    // Túi đầy -> để lại trên đất
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast('Túi đầy');
    }
    return false;
  }

  function collectDropsInRadius() {
    // Cách nhặt bằng nút đã chốt: nhặt TẤT CẢ đồ trong bán kính, món gần nhất trước
    if (!player) return;
    var dateKey = new Date().toISOString().slice(0, 10);
    if (!player.daily) player.daily = {};
    if (!player.daily[dateKey]) player.daily[dateKey] = { farmTuVi: 0, farmLinhThach: 0 };
    var todayData = player.daily[dateKey];
    var inRange = [];
    for (var i = 0; i < groundDrops.length; i++) {
      var d = Math.hypot(player.x - groundDrops[i].x, player.y - groundDrops[i].y);
      if (d <= ACTION_PICKUP_RADIUS) inRange.push({ drop: groundDrops[i], d: d });
    }
    inRange.sort(function (a, b) { return a.d - b.d; });
    for (var k = 0; k < inRange.length; k++) {
      var idx = groundDrops.indexOf(inRange[k].drop);
      if (idx >= 0) collectDropAtIndex(idx, todayData);
    }
  }

  // ============================================================
  // NÚT HÀNH ĐỘNG THEO NGỮ CẢNH (Đợt 2 & Đợt 3)
  // Ưu tiên: thu hái (48px) > vật tương tác (radius) > nói chuyện NPC (48px) > nhặt đồ (72px) > đánh
  // ============================================================
  function computeActionContext() {
    if (!player || !mapData) return { mode: 'attack', label: 'Đánh' };

    // 1. Ready harvest node (radius <= 48px)
    if (mapData.harvestNodes) {
      var nowSec = performance.now() / 1000;
      for (var h = 0; h < mapData.harvestNodes.length; h++) {
        var hn = mapData.harvestNodes[h];
        var isReady = nowSec >= (harvestReadyTimes[hn.id] || 0);
        if (isReady && Math.hypot(player.x - hn.x, player.y - hn.y) <= (hn.radius || 48)) {
          return { mode: 'harvest', label: 'Hái', harvestNode: hn };
        }
      }
    }

    // 2. Interactables in radius
    if (mapData.interactables) {
      for (var i = 0; i < mapData.interactables.length; i++) {
        var it = mapData.interactables[i];
        if (Math.hypot(player.x - it.x, player.y - it.y) <= (it.radius || 48)) {
          return { mode: 'interact', label: it.label || 'Tương Tác', interactable: it };
        }
      }
    }

    // 3. Active NPCs in interaction range
    if (mapData.npcs) {
      for (var n = 0; n < mapData.npcs.length; n++) {
        var npc = mapData.npcs[n];
        if (isNpcActive(npc) && isPlayerInNpcRange(npc)) {
          return { mode: 'talk', label: 'Nói Chuyện', npc: npc };
        }
      }
    }

    // 4. Ground drops in 72px
    for (var d = 0; d < groundDrops.length; d++) {
      if (Math.hypot(player.x - groundDrops[d].x, player.y - groundDrops[d].y) <= ACTION_PICKUP_RADIUS) {
        return { mode: 'pickup', label: 'Nhặt Đồ' };
      }
    }

    return { mode: 'attack', label: 'Đánh' };
  }

  function performContextAction() {
    if (!player || !mapData || player.hp <= 0) return;
    if (typeof document !== 'undefined') {
      var dlg = document.getElementById('dialogue-box');
      if (dlg && !dlg.classList.contains('hidden')) return; // Đang trong hội thoại
    }
    if (autoPath.active) autoPath.active = false; // Bấm nút hành động = người chơi tự điều khiển
    var ctx = computeActionContext();
    if (ctx.mode === 'harvest' && ctx.harvestNode) { executeHarvestNode(ctx.harvestNode); return; }
    if (ctx.mode === 'interact' && ctx.interactable) { executeInteractableAction(ctx.interactable); return; }
    if (ctx.mode === 'talk' && ctx.npc) { triggerDialogue(ctx.npc); return; }
    if (ctx.mode === 'pickup') { collectDropsInRadius(); return; }

    // Đánh: mục tiêu đã chọn còn trong tầm, hoặc quái gần nhất trong tầm 60; không có thì vung kiếm theo hướng mặt
    var m = null;
    if (targetMonster && targetMonster.state !== 'dead' && targetMonster.hp > 0 &&
        Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y) <= 60) {
      m = targetMonster;
    } else {
      var best = 60;
      for (var i = 0; i < fieldMonsters.length; i++) {
        var fm = fieldMonsters[i];
        if (fm.state === 'dead' || fm.hp <= 0) continue;
        var fd = Math.hypot(player.x - fm.x, player.y - fm.y);
        if (fd <= best) { best = fd; m = fm; }
      }
    }
    if (basicAttackCd > 0) return;
    basicAttackCd = 0.45;
    if (m) {
      targetMonster = m;
      player.dir = getDirFromVelocity(m.x - player.x, m.y - player.y);
      executePlayerBasicAttack(m);
    } else {
      // Đợt SWINGFIX: vung hụt cũng đi qua nhịp vung như đòn trúng — kiếm
      // vung thật theo hướng mặt, tiếng vút + vệt chém phát tại pha ra đòn
      // trong updateBasicSwing (trước đây phát ngay lúc bấm, kiếm đứng yên).
      basicSwing = {
        timer: SWING_DURATION, duration: SWING_DURATION,
        target: null, struck: false, whiff: true, whiffDir: player.dir,
        armed: !!(player.equipment && player.equipment.weapon)
      };
      lastCombatTime = performance.now();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('combat_action'));
    }
  }

  // ============================================================
  // NÚT TỰ TÌM ĐƯỜNG THEO NHIỆM VỤ & ĐỊNH TUYẾN ĐA CHẶNG (BFS)
  // Single Source of Truth cho Mũi tên dẫn đường, Tự tìm đường & Panel nhiệm vụ
  // ============================================================
  function getWeakestTuVi(p) {
    if (!p || !p.paths) return 0;
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var min = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var v = (p.paths[keys[i]] && typeof p.paths[keys[i]].tuVi === 'number') ? p.paths[keys[i]].tuVi : 0;
      if (v < min) min = v;
    }
    return isFinite(min) ? min : 0;
  }

  function getQuestTargetInfo() {
    if (!player || !player.quests) return null;
    var q = player.quests;
    if (!q.talked_linhnhi) {
      return { stepId: 'talk_linhnhi', stage: 0, mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' };
    }
    if (!q.huntCompleted) {
      return { stepId: 'hunt', stage: 0, mapId: 'rung-doc', kind: 'hunt' };
    }
    var sectStage = (q.sectStage !== undefined) ? q.sectStage : 0;
    if (sectStage === 0) {
      return { stepId: 'farewell_linhnhi', stage: 0, mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' };
    }
    if (sectStage === 1) {
      return { stepId: 'report_gate', stage: 1, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_tiepdan' };
    }
    if (sectStage === 2) {
      return { stepId: 'meet_master', stage: 2, mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon' };
    }
    if (sectStage === 3) {
      return { stepId: 'orders', stage: 3, mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' };
    }

    // Đợt DANPHONG: nhiệm vụ BẢNG THU THẬP đang được theo dõi — dẫn đường
    // (mũi tên, Tự Tìm Đường, bảng theo dõi) ưu tiên chỉ tới mục tiêu của
    // nhiệm vụ bảng. Chuỗi chính không đổi bước/ngưỡng/thoại; khi nhiệm vụ
    // bảng không còn được theo dõi (đã trả, đã hủy, hoặc tắt theo dõi),
    // hàm này trả null và dẫn đường quay về chuỗi chính ngay bên dưới.
    var dpAPI = (typeof window !== 'undefined' && window.GameDanPhong)
      ? window.GameDanPhong
      : (typeof global !== 'undefined' && global.GameDanPhong ? global.GameDanPhong : null);
    if (dpAPI && dpAPI.getTrackedTargetInfo) {
      var boardTarget = dpAPI.getTrackedTargetInfo(player);
      if (boardTarget) return boardTarget;
    }

    // Đợt T1: DẪN ĐƯỜNG ĐỘT PHÁ TIỂU MỐC — chỉ hoạt động khi người chơi đã
    // bấm "Chỉ đường" trong bảng Đột Phá cho một điều kiện còn thiếu (móc
    // duy nhất kiểu DANPHONG, cùng mức ưu tiên nhiệm vụ bảng): mũi tên và
    // dấu chỉ tới nguồn THẬT của món còn thiếu (bãi quái/điểm hái/Lò Đan/
    // điểm Đả Tọa/Chấp Sự), đúng bản đồ đúng cổng theo chuẩn hồ sơ 09. Khi
    // điều kiện đã đủ hoặc người chơi tắt theo dõi, móc trả null và dẫn
    // đường quay về chuỗi chính ngay bên dưới.
    var tmAPI = (typeof window !== 'undefined' && window.GameTieuMoc)
      ? window.GameTieuMoc
      : (typeof global !== 'undefined' && global.GameTieuMoc ? global.GameTieuMoc : null);
    if (tmAPI && tmAPI.getTrackedTargetInfo) {
      var tmTarget = tmAPI.getTrackedTargetInfo(player);
      if (tmTarget) return tmTarget;
    }

    // Đợt T2: DẪN ĐƯỜNG ĐỘT PHÁ TRÚC CƠ — chỉ hoạt động khi người chơi đã
    // bấm "Chỉ đường" trong Bảng Đột Phá Trúc Cơ cho một mục còn thiếu
    // (Trúc Cơ Đan / nguyên liệu gốc): mũi tên chỉ tới nguồn THẬT của mục
    // đó. Đủ rồi hoặc tắt theo dõi thì móc trả null, dẫn đường quay về
    // chuỗi chính.
    var dpqAPI = getDotPhaAPI();
    if (dpqAPI && dpqAPI.getTrackedTargetInfo) {
      var dpTarget = dpqAPI.getTrackedTargetInfo(player);
      if (dpTarget) return dpTarget;
    }

    // Đợt T3: DẪN ĐƯỜNG ĐỘT PHÁ KIM ĐAN — chỉ hoạt động khi người chơi đã
    // bấm "Chỉ đường" trong Bảng Đột Phá Kim Đan cho một mục còn thiếu
    // (Quy Nguyên Đan / nguyên liệu gốc): mũi tên chỉ tới nguồn THẬT của
    // mục đó (boss trấn vùng / tinh anh Hoang Mạc / Lò Đan). Đủ rồi thì
    // móc trả null, dẫn đường quay về chuỗi chính.
    var kdAPI2 = getKimDanAPI();
    if (kdAPI2 && kdAPI2.getTrackedTargetInfo) {
      var kdTarget = kdAPI2.getTrackedTargetInfo(player);
      if (kdTarget) return kdTarget;
    }

    // Khi sectStage >= 4: Chuỗi nhiệm vụ chính (Đợt 6 - Việc 1)
    var mainStage = q.mainStage;
    if (!mainStage || mainStage === 0) {
      return { stepId: 'done', stage: 4, mapId: null, kind: 'point' };
    }

    var minTuVi = getWeakestTuVi(player);
    var hasItem = function (id, count) {
      return stateAPI ? stateAPI.hasItemInBag(player, id, count) : false;
    };

    // Tự động thăng tiến mainStage khi đạt điều kiện
    if (mainStage === 1 && minTuVi >= 30) {
      q.mainStage = 2;
      mainStage = 2;
    }
    if (mainStage === 2 && (q.nhenKills || 0) >= 3) {
      q.mainStage = 3;
      mainStage = 3;
    }
    if (mainStage === 3 && hasItem('nguyen-tinh-moc', 1)) {
      q.mainStage = 4;
      mainStage = 4;
    }
    if (mainStage === 4 && minTuVi >= 300) {
      q.mainStage = 5;
      mainStage = 5;
    }
    if (mainStage === 5 && (q.bangXaKills || 0) >= 4) {
      q.mainStage = 6;
      mainStage = 6;
    }
    if (mainStage === 6 && hasItem('nguyen-tinh-thuy', 1) && hasItem('bang-tuy', 1)) {
      q.mainStage = 7;
      mainStage = 7;
    }
    if (mainStage === 7 && minTuVi >= 600) {
      q.mainStage = 8;
      mainStage = 8;
    }
    if (mainStage === 8 && hasItem('truc-co-dan', 1)) {
      q.mainStage = 9;
      mainStage = 9;
    }
    if (mainStage === 9 && (player.realm === 'Trúc Cơ Sơ Kỳ' || (minTuVi >= 900 && !hasItem('truc-co-dan', 1) && player.realm !== 'Phàm Nhân' && player.realm.indexOf('Luyện Khí') === -1))) {
      q.mainStage = 10;
      mainStage = 10;
    }

    switch (mainStage) {
      case 1:
        return {
          stepId: 'main_1',
          mainStage: 1,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'point',
          x: 960,
          y: 1250,
          title: 'Rèn Luyện Căn Bản',
          desc: 'Đưa cả 5 đường tu đạt 30 tu vi (săn Rừng Độc, hái Vườn Linh Dược Sơn Cốc, đổi đan chỗ Chấp Sự).'
        };
      case 2:
        return {
          stepId: 'main_2',
          mainStage: 2,
          stage: 4,
          mapId: 'rung-doc',
          kind: 'monster',
          speciesId: 'nhen_xanh',
          title: 'Trừ Nhện Rừng Xanh',
          desc: 'Tiêu diệt 3 Nhện Rừng Xanh ở Rừng Độc Thanh Tụy.'
        };
      case 3:
        return {
          stepId: 'main_3',
          mainStage: 3,
          stage: 4,
          mapId: 'rung-doc',
          kind: 'point',
          x: 1640,
          y: 745,
          title: 'Thử Thách Cổ Thụ',
          desc: 'Hạ gục Mộc Linh Cổ Vương ở Rừng Độc và đoạt lấy Nguyên Tinh Mộc.'
        };
      case 4:
        return {
          stepId: 'main_4',
          mainStage: 4,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'point',
          x: 960,
          y: 1250,
          title: 'Mở Cổng Hồ Băng',
          desc: 'Tu luyện cả 5 đường đạt 300 tu vi (Luyện Khí tầng 4) để mở cổng Hồ Băng Hàn Kính.'
        };
      case 5:
        return {
          stepId: 'main_5',
          mainStage: 5,
          stage: 4,
          mapId: 'ho-bang',
          kind: 'monster',
          speciesId: 'han_xa',
          title: 'Săn Băng Xà',
          desc: 'Tiêu diệt 4 Băng Xà (Hàn Kính Thủy Xà) tại Hồ Băng Hàn Kính.'
        };
      case 6:
        return {
          stepId: 'main_6',
          mainStage: 6,
          stage: 4,
          mapId: 'ho-bang',
          kind: 'point',
          x: 1180,
          y: 680,
          title: 'Chúa Tể Hồ Băng',
          desc: 'Hạ gục Hàn Kính Giao Vương tại Hồ Băng, thu thập Nguyên Tinh Thủy và Băng Tủy.'
        };
      case 7:
        return {
          stepId: 'main_7',
          mainStage: 7,
          stage: 4,
          mapId: 'dai-truyen-tong',
          kind: 'point',
          x: 480,
          y: 320,
          title: 'Cân Bằng Ngũ Hành',
          desc: 'Tu luyện cả 5 đường đạt 600 tu vi (Luyện Khí tầng 7) để mở cổng Mỏ Lửa Xích Diệm.'
        };
      case 8:
        var countItem = function (id) {
          return stateAPI ? stateAPI.countItemInBag(player, id) : 0;
        };
        if (countItem('linh-chi-rung') < 3) {
          return {
            stepId: 'main_8_linhchi',
            mainStage: 8,
            stage: 4,
            mapId: 'son-coc',
            kind: 'point',
            x: 460,
            y: 320,
            title: 'Luyện Trúc Cơ Đan',
            desc: 'Thu thập 3 Linh Chi Rừng tại Sơn Cốc để luyện đan.'
          };
        }
        if (countItem('hoa-tinh-tho') < 2) {
          return {
            stepId: 'main_8_hoatinh',
            mainStage: 8,
            stage: 4,
            mapId: 'mo-lua',
            kind: 'monster',
            speciesId: 'diem_ma',
            title: 'Luyện Trúc Cơ Đan',
            desc: 'Thu thập 2 Hỏa Tinh Thổ từ quái Mỏ Lửa Xích Diệm để luyện đan.'
          };
        }
        return {
          stepId: 'main_8_chapsu',
          mainStage: 8,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'npc',
          npcId: 'npc_chapsu',
          title: 'Luyện Trúc Cơ Đan',
          desc: 'Đem đủ nguyên liệu và 200 Linh Thạch tới gặp Chấp Sự Đường để luyện Trúc Cơ Đan.'
        };
      case 9:
        return {
          stepId: 'main_9',
          mainStage: 9,
          stage: 4,
          mapId: 'tong-mon',
          kind: 'point',
          x: 960,
          y: 700,
          title: 'Đột Phá Trúc Cơ',
          desc: 'Đưa cả 5 đường đạt 900 tu vi (Luyện Khí viên mãn), sau đó dùng Trúc Cơ Đan để đột phá!'
        };
      default:
        // mainStage >= 10: Bước dự phòng KHÔNG BAO GIỜ TRỐNG
        return {
          stepId: 'post_main_kiem_trung',
          mainStage: 10,
          stage: 10,
          mapId: 'dai-truyen-tong',
          kind: 'point',
          x: 480,
          y: 320,
          title: 'Chinh Phục Kiếm Trủng',
          desc: 'Rèn luyện đạt Trúc Cơ Trung Kỳ để mở cổng Kiếm Trủng Vô Danh.'
        };
    }
  }

  function resolveQuestDestination(info) {
    if (!info) return null;
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    var targetMap = holder ? (holder.getMap ? holder.getMap(info.mapId) : holder.maps[info.mapId]) : mapData;

    if (info.kind === 'npc') {
      if (!targetMap || !targetMap.npcs) return null;
      for (var i = 0; i < targetMap.npcs.length; i++) {
        var n = targetMap.npcs[i];
        if (n.id === info.npcId) {
          var st = n.standTile || { x: n.feetX, y: n.feetY };
          return { x: st.x, y: st.y, radius: 26, npc: n, mapId: info.mapId };
        }
      }
      return null;
    }
    if (info.kind === 'hunt') {
      var near = getNearestLivingThaoTinh();
      if (near) return { x: near.x, y: near.y, radius: 64, mapId: 'rung-doc' };
      if (monstersAPI && monstersAPI.RUNG_DOC_PACKS) {
        for (var p = 0; p < monstersAPI.RUNG_DOC_PACKS.length; p++) {
          var pk = monstersAPI.RUNG_DOC_PACKS[p];
          if (pk.speciesId === 'thao_tinh' && pk.anchor) {
            return { x: pk.anchor.x, y: pk.anchor.y, radius: 44, mapId: 'rung-doc' };
          }
        }
      }
      return { x: 420, y: 750, radius: 64, mapId: 'rung-doc' };
    }
    if (info.kind === 'monster') {
      if (currentMapId === info.mapId && fieldMonsters && fieldMonsters.length > 0) {
        var bestM = null;
        var bestDist = Infinity;
        for (var mIdx = 0; mIdx < fieldMonsters.length; mIdx++) {
          var fm = fieldMonsters[mIdx];
          if (fm.state === 'dead' || fm.hp <= 0) continue;
          var matchSpec = (fm.speciesId === info.speciesId) ||
            (info.speciesId === 'han_xa' && fm.speciesId === 'bang_xa') ||
            (info.speciesId === 'bang_xa' && fm.speciesId === 'han_xa');
          if (matchSpec) {
            var d = Math.hypot(player.x - fm.x, player.y - fm.y);
            if (d < bestDist) {
              bestDist = d;
              bestM = fm;
            }
          }
        }
        if (bestM) {
          return { x: bestM.x, y: bestM.y, radius: 44, mapId: info.mapId };
        }
      }
      if (targetMap && targetMap.monsterPacks) {
        for (var pi = 0; pi < targetMap.monsterPacks.length; pi++) {
          var pack = targetMap.monsterPacks[pi];
          var matchPack = (pack.speciesId === info.speciesId) ||
            (info.speciesId === 'han_xa' && pack.speciesId === 'bang_xa') ||
            (info.speciesId === 'bang_xa' && pack.speciesId === 'han_xa');
          if (matchPack && pack.anchor) {
            return { x: pack.anchor.x, y: pack.anchor.y, radius: 44, mapId: info.mapId };
          }
        }
      }
      return { x: 960, y: 640, radius: 44, mapId: info.mapId };
    }
    if (info.kind === 'point' || (info.x !== undefined && info.y !== undefined)) {
      return { x: info.x, y: info.y, radius: info.radius || 32, mapId: info.mapId };
    }
    return null;
  }

  function findRoute(fromMapId, toMapId) {
    if (!fromMapId || !toMapId) return null;
    if (fromMapId === toMapId) return [fromMapId];
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    if (!holder || !holder.maps) return null;

    var queue = [[fromMapId]];
    var visited = {};
    visited[fromMapId] = true;

    while (queue.length > 0) {
      var pathArr = queue.shift();
      var node = pathArr[pathArr.length - 1];
      var m = holder.getMap ? holder.getMap(node) : holder.maps[node];
      if (!m || !m.exits) continue;

      for (var i = 0; i < m.exits.length; i++) {
        var nextHop = m.exits[i].targetMap;
        if (!nextHop) continue;
        if (nextHop === toMapId) {
          return pathArr.concat([nextHop]);
        }
        if (!visited[nextHop]) {
          visited[nextHop] = true;
          queue.push(pathArr.concat([nextHop]));
        }
      }
    }
    return null;
  }

  function findNextHopExit(fromMapId, toMapId) {
    var route = findRoute(fromMapId, toMapId);
    if (!route || route.length < 2) return null;
    var nextHopMapId = route[1];
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    var currentM = (holder && holder.getMap) ? holder.getMap(fromMapId) : mapData;
    if (!currentM || !currentM.exits) return null;

    for (var i = 0; i < currentM.exits.length; i++) {
      var ex = currentM.exits[i];
      if (ex.targetMap === nextHopMapId) {
        var x = ex.target ? ex.target.x : (ex.rect ? ex.rect.x + ex.rect.w / 2 : 0);
        var y = ex.target ? ex.target.y : (ex.rect ? ex.rect.y + ex.rect.h / 2 : 0);
        // GUIDEFIX: cổng chỉ kích hoạt khi nhân vật đứng TRONG vùng cổng (rect),
        // nên điểm dẫn đường bắt buộc phải nằm trong rect. Nếu dữ liệu cổng khai
        // target nằm ngoài rect (đã từng xảy ra: Rừng Độc khai nhầm tọa độ map
        // đích, 4 map săn khai lệch 15px) thì dẫn về tâm vùng cổng thay vì dắt
        // người chơi tới một điểm không bao giờ mở cổng được.
        if (ex.rect && (x < ex.rect.x || x > ex.rect.x + ex.rect.w || y < ex.rect.y || y > ex.rect.y + ex.rect.h)) {
          x = ex.rect.x + ex.rect.w / 2;
          y = ex.rect.y + ex.rect.h / 2;
        }
        return { exit: ex, target: { x: x, y: y }, targetMap: nextHopMapId };
      }
    }
    return null;
  }

  // Các map săn chỉ tới được bằng Đài Truyền Tống — không map nào có cổng đi
  // bộ vào chúng (chúng chỉ có cổng quay về Đài). Dùng chung cho
  // planTravelRoute và findGuidanceHop.
  var TELEPORT_ONLY_MAPS = ['ho-bang', 'mo-lua', 'hoang-mac', 'kiem-trung'];

  // HOBANGFIX (2026-11-11): hop dẫn đường NHIỆM VỤ (mũi tên + Tự Tìm Đường)
  // biết chặng truyền tống. findNextHopExit chỉ đi theo đồ thị cổng nên với
  // đích là map truyền tống nó luôn trả null — mọi mục tiêu ở Hồ Băng / Mỏ
  // Lửa / Hoang Mạc / Kiếm Trủng (nhiệm vụ chính giai đoạn 5, 6, 8; nhiệm vụ
  // bảng thu thập; chỉ đường đột phá) đều gãy: game báo "Không tìm được đường
  // sang ho-bang" và mũi tên biến mất. Luật hop đúng như tuyến di chuyển bản
  // đồ tổng quan (planTravelRoute): chưa ở Đài thì hop là cổng tới Đài gần
  // nhất; đang ở Đài thì hop là điểm đài (480,320) kèm cờ teleportToMap để
  // Tự Tìm Đường gọi truyền tống khi đã vào đủ gần.
  function findGuidanceHop(fromMapId, toMapId) {
    var hop = findNextHopExit(fromMapId, toMapId);
    if (hop) return hop;
    if (!fromMapId || !toMapId || TELEPORT_ONLY_MAPS.indexOf(toMapId) === -1) return null;
    if (fromMapId === 'dai-truyen-tong') {
      return { exit: null, target: { x: 480, y: 320 }, targetMap: toMapId, teleportToMap: toMapId };
    }
    return findNextHopExit(fromMapId, 'dai-truyen-tong');
  }

  function startAutoQuestPath(autoStarted) {
    var info = getQuestTargetInfo();
    if (!info || info.stepId === 'done') {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Chưa có mục tiêu nhiệm vụ.');
      }
      return;
    }
    autoPath.active = true;
    autoPath.autoStarted = !!autoStarted;
    autoPath.lastLegAt = 0;
    autoPath.combatStamp = lastCombatTime;
    targetMonster = null;
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.syncAutoPathButton) {
      window.GameUI.syncAutoPathButton();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('autopath_started'));
    }
  }

  function cancelAutoPath(clearPath) {
    autoPath.active = false;
    autoPath.autoStarted = false;
    if (clearPath) {
      currentPath = [];
      pendingInteraction = null;
      if (player) player.path = currentPath;
    }
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.syncAutoPathButton) {
      window.GameUI.syncAutoPathButton();
    }
  }

  function failAutoPath(msg) {
    cancelAutoPath(true);
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(msg);
    }
  }

  function toggleAutoQuestPath() {
    if (autoPath.active) {
      cancelAutoPath(true);
      return;
    }
    startAutoQuestPath(false);
  }

  function updateAutoPath() {
    if (!autoPath.active || !player || !mapData) return;
    if (mapFade.alpha > 0) return; // Đang chuyển cảnh: chờ sang hẳn bản đồ mới
    var info = getQuestTargetInfo();
    if (!info || info.stepId === 'done') { cancelAutoPath(false); return; }
    var now = performance.now();

    if (info.mapId === currentMapId) {
      var dest = resolveQuestDestination(info);
      if (!dest) { failAutoPath('Mục tiêu chưa xuất hiện, hãy thử lại sau.'); return; }
      var d = Math.hypot(player.x - dest.x, player.y - dest.y);
      if (d <= dest.radius) { cancelAutoPath(false); return; } // Đã tới nơi: dừng cạnh mục tiêu, không tự mở thoại
    }

    if (lastCombatTime > autoPath.combatStamp) {
      cancelAutoPath(true);
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Vào chiến đấu — đã dừng tự tìm đường.');
      }
      return;
    }

    if (info.mapId === currentMapId) {
      if (currentPath.length === 0 && now - autoPath.lastLegAt > 500) {
        autoPath.lastLegAt = now;
        triggerPathTo(dest.x, dest.y, null);
        if (currentPath.length === 0) failAutoPath('Không tìm được đường tới mục tiêu.');
      }
    } else {
      // HOBANGFIX: hop dẫn đường biết chặng truyền tống (findGuidanceHop).
      var hopNow = findGuidanceHop(currentMapId, info.mapId);
      if (hopNow && hopNow.teleportToMap) {
        // Đang ở Đài Truyền Tống, đích là map truyền tống: đi tới điểm đài,
        // vào đủ gần (bán kính tương tác của đài = 64, cùng chuẩn updateTravel)
        // thì truyền tống sang map đích và để Tự Tìm Đường chạy tiếp ở map mới.
        var altarDist = Math.hypot(player.x - hopNow.target.x, player.y - hopNow.target.y);
        if (altarDist <= 64) {
          if (autoPath.teleportStamp && now - autoPath.teleportStamp < 4000) return; // vừa gọi truyền tống, chờ chuyển cảnh
          autoPath.teleportStamp = now;
          teleportTo(hopNow.teleportToMap);
          if (currentMapId === 'dai-truyen-tong' && mapFade.dir === 0 && !pendingMapSwitch) {
            // teleportTo bị cổng cảnh giới chặn (đã tự hiện lý do) — dừng lặng
            cancelAutoPath(true);
          }
          return;
        }
        if (currentPath.length === 0 && now - autoPath.lastLegAt > 500) {
          autoPath.lastLegAt = now;
          triggerPathTo(hopNow.target.x, hopNow.target.y, null);
          if (currentPath.length === 0) failAutoPath('Không tìm được đường tới Đài Truyền Tống.');
        }
        return;
      }
      if (currentPath.length === 0 && now - autoPath.lastLegAt > 500) {
        if (!hopNow) { failAutoPath('Không tìm được đường sang ' + info.mapId); return; }
        autoPath.lastLegAt = now;
        triggerPathTo(hopNow.target.x, hopNow.target.y, null);
        if (currentPath.length === 0) failAutoPath('Không tìm được đường ra cổng.');
      }
    }
  }

  function findMonsterAt(wx, wy) {
    for (var i = fieldMonsters.length - 1; i >= 0; i--) {
      var m = fieldMonsters[i];
      if (m.state === 'dead') continue;
      var spec = monstersAPI.SPECIES[m.speciesId];
      var w = (spec.cellW || 72) * (spec.drawScale || 1.0);
      var h = (spec.cellH || 72) * (spec.drawScale || 1.0);
      var top = m.y - spec.feetOffsetY;
      var left = m.x - spec.feetOffsetX;
      if (wx >= left && wx <= left + w && wy >= top && wy <= top + h) {
        return m;
      }
    }
    return null;
  }

  function triggerPathTo(worldX, worldY, interaction) {
    if (!pathfinder || !mapData || !player) return;

    clickRipple = {
      x: worldX,
      y: worldY,
      radius: 4,
      maxRadius: 22,
      alpha: 0.95
    };

    var grid = mapData.collisionGrid;
    var gs = mapData.gridSize || 24;
    var rows = grid ? grid.length : 0;
    var cols = (rows > 0 && grid[0]) ? grid[0].length : 0;

    var path = pathfinder.findPath(
      player.x,
      player.y,
      worldX,
      worldY,
      grid,
      gs
    );

    // Nếu không tìm được đường, dùng findNearestWalkable hoặc quét bán kính tăng dần quanh đích (Đợt 6 - Việc 3)
    if ((!path || path.length === 0) && grid && rows > 0 && cols > 0) {
      var tgx = Math.max(0, Math.min(cols - 1, Math.floor(worldX / gs)));
      var tgy = Math.max(0, Math.min(rows - 1, Math.floor(worldY / gs)));

      var near = pathfinder.findNearestWalkable ? pathfinder.findNearestWalkable(tgx, tgy, grid) : null;
      if (near) {
        var altX = (near.gx + 0.5) * gs;
        var altY = (near.gy + 0.5) * gs;
        path = pathfinder.findPath(player.x, player.y, altX, altY, grid, gs);
      }

      // Quét bán kính tăng dần tìm ô đi được mà findPath tới được
      if (!path || path.length === 0) {
        var maxR = 25;
        for (var r = 1; r <= maxR && (!path || path.length === 0); r++) {
          for (var dx = -r; dx <= r && (!path || path.length === 0); dx++) {
            for (var dy = -r; dy <= r; dy++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              var nx = tgx + dx;
              var ny = tgy + dy;
              if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] === 0) {
                var candX = (nx + 0.5) * gs;
                var candY = (ny + 0.5) * gs;
                var testPath = pathfinder.findPath(player.x, player.y, candX, candY, grid, gs);
                if (testPath && testPath.length > 0) {
                  path = testPath;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (path && path.length > 0) {
      if (path.length > 1 && Math.hypot(path[0].x - player.x, path[0].y - player.y) < 6) {
        path.shift();
      }
      currentPath = path;
      if (player) player.path = currentPath;
      pendingInteraction = interaction;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('player_first_move'));
      }
      return path;
    } else {
      currentPath = [];
      if (player) player.path = currentPath;
      pendingInteraction = null;
      return [];
    }
  }

  function triggerDialogueLinhNhi() {
    triggerDialogue(mapData.linhnhi);
  }

  function triggerLockedDoorToast() {
    if (audioAPI) audioAPI.playDoorKnock();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(mapData.temple.lockedToast);
    }
  }

  /**
   * Chuyển đổi giữa 2 bản đồ với hiệu ứng mờ dần (Fade)
   */
  function switchMap(targetMapId, targetSpawn) {
    if (mapFade.alpha > 0 || mapFade.dir !== 0) {
      // Đang fade chuyển cảnh: xếp hàng (yêu cầu cuối thắng), chạy ngay khi fade xong
      pendingMapSwitch = { id: targetMapId, spawn: targetSpawn };
      return;
    }
    mapFade.dir = 1;
    mapFade.callback = function () {
      // Nếu rời Rừng Độc về Miếu Hoang -> hiển thị tổng kết buổi farm (Brief §6 & Hồ sơ 41 §8)
      if (currentMapId === 'rung-doc' && targetMapId === 'mieu_hoang') {
        if (player.farmSession && (player.farmSession.kills > 0 || player.farmSession.linhThach > 0 || player.farmSession.tuViMoc > 0)) {
          if (typeof window !== 'undefined' && window.GameUI) {
            window.GameUI.showSessionSummary(player.farmSession);
          }
        }
        player.farmSession = null;
        if (stateAPI) stateAPI.breakHuntChain(player);
      } else if (targetMapId === 'rung-doc') {
        // Bắt đầu farm session mới
        player.farmSession = {
          startTime: Date.now(),
          kills: 0,
          tuViMoc: 0,
          linhThach: 0,
          notableLoot: []
        };
      }

      currentMapId = targetMapId;
      // Đợt 3 (Note 3B): chuyển theme nhạc + môi trường theo map, crossfade trong GameMusic
      if (typeof window !== 'undefined' && window.GameMusic) {
        window.GameMusic.setMap(targetMapId);
      }
      var mapHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
      if (mapHolder && mapHolder.getMap) {
        mapData = mapHolder.getMap(targetMapId);
      }

      spawnFieldMonstersForMap(mapData);

      player.x = targetSpawn.x;
      player.y = targetSpawn.y;
      // Khóa cổng thoát sau khi tới nơi (xem portalsArmed ở trên): chỉ mở lại khi
      // đã qua thời gian ân hạn và người chơi ra khỏi mọi vùng cổng.
      portalsArmed = false;
      portalRearmAt = performance.now() + 1600;
      // Yêu cầu chuyển map xếp hàng trùng hệt chuyến vừa hoàn thành (do đứng trong
      // vùng cổng suốt lúc fade-out gọi lại switchMap mỗi khung hình) là dư thừa:
      // hủy để khỏi fade hai lần vô ích. Yêu cầu khác map/điểm đến vẫn giữ nguyên.
      if (pendingMapSwitch && pendingMapSwitch.id === targetMapId && pendingMapSwitch.spawn &&
          pendingMapSwitch.spawn.x === targetSpawn.x && pendingMapSwitch.spawn.y === targetSpawn.y) {
        pendingMapSwitch = null;
      }
      currentPath = [];
      targetMonster = null;
      castState = null; // đổi map = ngắt chiêu đang vận
      skillCastAnim = null; // Đợt K2: khung tung chiêu + chuỗi Liên Hoàn cũng gãy khi đổi map
      basicSwing = null; // Đợt SWINGFIX: đổi map = nhịp vung gãy theo cùng luật
      lienHoanState = { elem: null, stacks: 0 };
      groundDrops = [];
      visualEffects = [];
      projectiles = [];
      currentZoneId = null;

      updateCamera();
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.refreshHUD();
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('map_switched'));
      }
    };
  }

  function teleportTo(mapId, x, y) {
    var gateHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
    var gateMap = (gateHolder && gateHolder.getMap) ? gateHolder.getMap(mapId) : null;
    if (gateMap && gateMap.minRealmRank) {
      var gateState = (typeof window !== 'undefined' && window.GameState) ? window.GameState : stateAPI;
      var myRank = (gateState && gateState.getRealmRank && player) ? gateState.getRealmRank(player) : 99;
      if (myRank < gateMap.minRealmRank) {
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Cảnh giới chưa đủ — ' + gateMap.name + ' cần ' + (gateMap.minRealmLabel || '') + '. Hãy tu luyện cân bằng cả năm đường.');
        }
        return;
      }
    }
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.closeTeleportModal) {
      window.GameUI.closeTeleportModal();
    }
    var mapHolder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : null);
    var targetMap = (mapHolder && mapHolder.getMap) ? mapHolder.getMap(mapId) : mapData;
    var spawn = (x !== undefined && y !== undefined) ? { x: x, y: y } : (targetMap ? targetMap.spawn : { x: 560, y: 620 });
    switchMap(mapId, spawn);
  }

  // ============================================================
  // DI CHUYỂN BẰNG BẢN ĐỒ TỔNG QUAN & DÙNG VẬT PHẨM (Đợt 6 - Việc 1 & 4)
  // ============================================================
  var travelState = {
    active: false,
    targetMapId: null,
    routePlan: null,
    combatStamp: 0,
    lastLegAt: 0
  };

  function planTravelRoute(fromMapId, toMapId) {
    if (!fromMapId || !toMapId) return null;
    if (fromMapId === toMapId) return { route: [fromMapId], needsTeleport: false, finalMapId: toMapId };

    var directRoute = findRoute(fromMapId, toMapId);
    if (directRoute) {
      return { route: directRoute, needsTeleport: false, finalMapId: toMapId };
    }

    if (TELEPORT_ONLY_MAPS.indexOf(toMapId) !== -1) {
      var routeToAltar = findRoute(fromMapId, 'dai-truyen-tong');
      if (routeToAltar) {
        return { route: routeToAltar.concat([toMapId]), needsTeleport: true, finalMapId: toMapId };
      }
    }
    return null;
  }

  function travelToMap(mapId) {
    if (!mapId || !player) return { ok: false, reason: 'invalid_param' };

    var weakestTuVi = getWeakestTuVi(player);

    // 1. Cùng map
    if (mapId === currentMapId) {
      return { ok: true, sameMap: true };
    }

    // 2. Khóa cảnh giới
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (mapData && mapData.maps ? mapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null));
    var gateMap = (holder && holder.getMap) ? holder.getMap(mapId) : null;
    if (gateMap && gateMap.minRealmRank) {
      var gateState = (typeof window !== 'undefined' && window.GameState) ? window.GameState : stateAPI;
      var myRank = (gateState && gateState.getRealmRank && player) ? gateState.getRealmRank(player) : 0;
      if (myRank < gateMap.minRealmRank) {
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Cảnh giới chưa đủ — ' + gateMap.name + ' cần ' + (gateMap.minRealmLabel || '') + '. Hãy tu luyện cân bằng cả năm đường.');
        }
        return { ok: false, reason: 'realm_rank_low', minRank: gateMap.minRealmRank, reqTuVi: gateMap.minRealmRank * 100, curTuVi: weakestTuVi };
      }
    }

    // 3. Lập tuyến di chuyển
    var plan = planTravelRoute(currentMapId, mapId);
    if (!plan || !plan.route || plan.route.length === 0) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Không tìm được đường tới ' + (gateMap ? gateMap.name : mapId));
      }
      return { ok: false, reason: 'no_route' };
    }

    cancelAutoPath(true);
    travelState = {
      active: true,
      targetMapId: mapId,
      routePlan: plan,
      combatStamp: lastCombatTime,
      lastLegAt: 0
    };

    return { ok: true, route: plan.route, needsTeleport: plan.needsTeleport };
  }

  function cancelTravel() {
    travelState.active = false;
    travelState.targetMapId = null;
    travelState.routePlan = null;
    currentPath = [];
    pendingInteraction = null;
    return { ok: true };
  }

  function updateTravel() {
    if (!travelState.active || !player || !mapData) return;
    if (mapFade.alpha > 0) return;

    if (currentMapId === travelState.targetMapId) {
      cancelTravel();
      return;
    }

    if (lastCombatTime > travelState.combatStamp) {
      cancelTravel();
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Vào chiến đấu — đã dừng di chuyển.');
      }
      return;
    }

    var now = performance.now();

    if (travelState.routePlan && travelState.routePlan.needsTeleport && currentMapId === 'dai-truyen-tong') {
      var altarDist = Math.hypot(player.x - 480, player.y - 320);
      if (altarDist <= 64) {
        teleportTo(travelState.targetMapId);
        cancelTravel();
        return;
      }
      if (currentPath.length === 0 && now - travelState.lastLegAt > 500) {
        travelState.lastLegAt = now;
        triggerPathTo(480, 320, null);
      }
      return;
    }

    var nextTargetMap = (travelState.routePlan && travelState.routePlan.needsTeleport) ? 'dai-truyen-tong' : travelState.targetMapId;
    if (currentPath.length === 0 && now - travelState.lastLegAt > 500) {
      var exitHop = findNextHopExit(currentMapId, nextTargetMap);
      if (!exitHop) {
        cancelTravel();
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast('Không tìm được đường sang chặng tiếp theo.');
        }
        return;
      }
      travelState.lastLegAt = now;
      triggerPathTo(exitHop.target.x, exitHop.target.y, null);
    }
  }

  function useItem(itemId) {
    if (!player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    if (!stateAPI.hasItemInBag(player, itemId, 1)) {
      var msgNoItem = 'Không có vật phẩm trong túi đồ.';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgNoItem);
      }
      return { ok: false, msg: msgNoItem };
    }

    var pillElemMap = {
      'dan-kim': 'kim',
      'dan-moc': 'moc',
      'dan-thuy': 'thuy',
      'dan-hoa': 'hoa',
      'dan-tho': 'tho'
    };
    var elem = pillElemMap[itemId];
    if (elem) {
      if (!player.paths[elem]) player.paths[elem] = { tuVi: 0 };
      // Đợt T1: đan cũng không đẩy tu vi vượt TRẦN MỐC chưa đột phá. Đường
      // đã đầy trần: KHÔNG trừ đan, báo rõ lý do. Còn thiếu một ít thì đan
      // chỉ hấp thụ tới trần và vẫn bị tiêu hao (báo trước trong thông báo).
      var elemNames = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
      var capNow = (stateAPI && stateAPI.getMocCap) ? stateAPI.getMocCap(player) : Infinity;
      var roomNow = capNow - (player.paths[elem].tuVi || 0);
      if (roomNow <= 0) {
        var msgCap = 'Đường ' + (elemNames[elem] || elem) + ' đã đầy trần mốc hiện tại (' + capNow + ' tu vi) — hãy Đột Phá Tiểu Mốc (gặp Chấp Sự) để mở trần trước khi dùng đan.';
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast(msgCap);
        }
        return { ok: false, reason: 'path_capped', msg: msgCap };
      }
      stateAPI.removeItemFromBag(player, itemId, 1);
      var addedPill = Math.min(20, roomNow);
      player.paths[elem].tuVi = (player.paths[elem].tuVi || 0) + addedPill;

      var stats = stateAPI.deriveStats(player.paths, player.equipment);
      player.hpMax = stats.hpMax;
      player.linhLucMax = stats.linhLucMax;
      stateAPI.savePlayer(player);

      var msg = 'Đã dùng ' + (elemNames[elem] || elem) + ' Linh Đan, +' + addedPill + ' tu vi ' + (elemNames[elem] || elem) + '!' +
        (addedPill < 20 ? ' (Đan chỉ hấp thụ tới trần mốc ' + capNow + '.)' : '');
      if (audioAPI) audioAPI.playChime();
      spawnFloatingText('+' + addedPill + ' Tu vi ' + (elemNames[elem] || elem), player.x, player.y - 35, '#ffe9a8');
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msg);
        window.GameUI.refreshHUD();
      }
      return { ok: true, msg: msg, tuVi: player.paths[elem].tuVi, added: addedPill };
    }

    // Đợt T1: đan PHỤ TRỢ TẦNG (hồ sơ 06) không uống trực tiếp — chúng là
    // điều kiện tiêu hao tại thời điểm đột phá tiểu mốc (Tụ Khí Tán ở mốc
    // 4->5, Ngưng Khí Đan ở mốc 7->8). Bấm dùng: chỉ đường, không tiêu hao.
    if (itemId === 'tu-khi-tan' || itemId === 'ngung-khi-dan') {
      var auxName = itemId === 'tu-khi-tan' ? 'Tụ Khí Tán' : 'Ngưng Khí Đan';
      var msgAux = auxName + ' là đan phụ trợ đột phá tiểu mốc — không uống trực tiếp. Hãy mở bảng Đột Phá Tiểu Mốc (gặp Chấp Sự Đường hoặc nút trong Bảng Nhân Vật), đan sẽ được tiêu hao đúng lúc đột phá.';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgAux);
      }
      return { ok: false, reason: 'aux_breakthrough_pill', msg: msgAux };
    }

    if (itemId === 'truc-co-dan') {
      return tryBreakthrough();
    }

    // Đợt T3: Ngũ Hành Quy Nguyên Đan không uống trực tiếp — nó là đan của
    // mốc đột phá ĐẠI cảnh giới Kim Đan (phải qua tâm ma + độ kiếp trong
    // Bảng Đột Phá Kim Đan). Bấm dùng: mở bảng, không tiêu hao.
    if (itemId === 'ngu-hanh-quy-nguyen-dan') {
      var msgKD = 'Ngũ Hành Quy Nguyên Đan là đan kết đan — hãy mở Bảng Đột Phá Kim Đan (nút trong Bảng Nhân Vật): thắng tâm ma rồi chịu độ kiếp 5 tia mới kết đan được. Đan chỉ tiêu hao khi kết đan thành công.';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgKD);
      }
      if (typeof window !== 'undefined' && window.GameKimDan && window.GameKimDan.openPanel) {
        window.GameKimDan.openPanel();
      }
      return { ok: false, reason: 'grand_breakthrough_pill', msg: msgKD };
    }

    return { ok: false, msg: 'Vật phẩm không thể sử dụng trực tiếp' };
  }

  // Đợt T2: module Đột Phá Đại Cảnh Giới (js/dotpha.js) giữ CẤU HÌNH (tỉ lệ
  // khóa 1.0 theo phán của Bui) + logic thuần của bảng đột phá và dẫn
  // đường. Engine lấy qua một cửa duy nhất — trình duyệt đọc window, Node
  // đọc global/require như các module khác.
  function getDotPhaAPI() {
    if (typeof window !== 'undefined' && window.GameDotPha) return window.GameDotPha;
    if (typeof global !== 'undefined' && global.GameDotPha) return global.GameDotPha;
    if (typeof require !== 'undefined') {
      try { return require('./dotpha.js'); } catch (e) { return null; }
    }
    return null;
  }

  // =========================================================================
  // ĐỘ KIẾP TRÚC CƠ — CẢNH DIỄN THẬT 3 TIA (Đợt T2)
  // Chuẩn diễn theo tài liệu độ kiếp Vô Sắc (docs/realm-prep mục 10): mây
  // kiếp xoáy tối kéo tới (lớp phủ cục bộ quanh nhân vật, KHÔNG dùng lớp
  // tối ngày đêm), từng tia sét vẽ bằng đường gấp khúc sáng từ mây xuống
  // nhân vật + chớp sáng + rung màn hình tăng dần + hạt điện tóe; kết thúc
  // mây tan THEO VÒNG TRÒN từ nhân vật kèm cột sáng. Theo phán của Bui
  // 14:12 ngày 2026-11-10 ("Giữ 100% như hiện tại, chỉ thêm độ kiếp diễn
  // thật"), đột phá đủ điều kiện là CHẮC CHẮN thành công — cảnh chỉ có một
  // kết cục thành công, không tồn tại nhánh thất bại. Cảnh chỉ là lớp DIỄN
  // — kết quả đột phá đã áp đồng bộ trong tryBreakthrough (luật nhãn
  // REALMFIX: nhãn chỉ đổi khi đột phá thành công, áp ngay tại thời điểm bấm).
  // =========================================================================
  var tribulation = null;

  // boltCount: số tia của thang độ kiếp (hồ sơ 05D §3 — Trúc Cơ 3, Kim Đan
  // 5, Nguyên Anh 7, Hóa Thần 9). Không truyền -> 3 (độ kiếp Trúc Cơ của T2
  // giữ nguyên hành vi). Đợt T3 dùng startTribulation(5) cho Kim Đan.
  function startTribulation(boltCount) {
    if (!player) return;
    tribulation = {
      t: 0,
      phase: 'gather',
      gatherDur: 1.4,
      boltInterval: 0.85,
      boltsTotal: (typeof boltCount === 'number' && boltCount > 0) ? Math.floor(boltCount) : 3,
      boltsHit: 0,
      nextBoltAt: 1.4,
      outcome: 'success',
      outcomeDur: 1.7,
      outcomeT: 0,
      bolt: null, // { topX, topY, botX, botY, age, seed, power, variant, flip }
      flash: 0,
      sparks: [],
      // Đợt KIẾP VÂN vòng 3 — trạng thái THUẦN HÌNH ẢNH (không đụng kịch
      // bản pha/con số): hạt sáng bay lên + mưa tia lửa vàng ở pha kết,
      // cung điện bò trong mây ở pha tụ/đánh, vụ nổ của tia cuối.
      motes: [],
      rain: [],
      arcs: [],
      arcTimer: 0.3,
      burst: null, // { t, x, y }
      burstSparks: [],
      seed: Math.random() * 1000
    };
    // Âm thanh vòng 3: sấm rền lớn dần suốt pha tụ thay tiếng sấm xa một
    // lần của T2 (playThunderFar giữ làm đường lùi cho môi trường thiếu
    // hàm mới — stub kiểm tra cũ).
    if (audioAPI && audioAPI.startTribRumble) audioAPI.startTribRumble();
    else if (audioAPI && audioAPI.playThunderFar) audioAPI.playThunderFar();
  }

  function tribulationStrike() {
    if (!tribulation || !player) return;
    var topX = player.x + (Math.random() - 0.5) * 50;
    var topY = player.y - 380;
    var botX = player.x;
    var botY = player.y - 14;
    tribulation.boltsHit++;
    // Đợt KIẾP VÂN vòng 3: tia là HÌNH SINH THẬT (không vẽ polyline nữa —
    // đường thủ tục đã hỏng hai vòng). Biến thể đi theo thang nặng dần:
    // tia i dùng ảnh round(i/(total-1)*3) trong bộ 4 (nhẹ → nặng nhất);
    // lật ngang ngẫu nhiên để các tia không lặp hình. power giữ thang
    // 1..total như vòng 2 (tia sau mạnh hơn tia trước).
    var total = tribulation.boltsTotal;
    var idx = total > 1 ? Math.round((tribulation.boltsHit - 1) / (total - 1) * 3) : 3;
    tribulation.bolt = {
      topX: topX, topY: topY, botX: botX, botY: botY,
      age: 0,
      seed: Math.random() * 100,
      power: tribulation.boltsHit,
      variant: idx,
      flip: Math.random() < 0.5
    };
    tribulation.flash = 1;
    // Rung màn hình tăng dần theo tia (thang neo của chuẩn độ kiếp: tia
    // cuối rung mạnh nhất).
    triggerScreenShake(0.28 + tribulation.boltsHit * 0.08, 5 + tribulation.boltsHit * 3);
    // Tiếng sét tỉ lệ sức tia: p01 đi 0 → 1 theo thứ tự tia (cả thang 3
    // lẫn thang 5), tia cuối to và trầm nhất + dư âm rền sau đòn.
    if (audioAPI && audioAPI.playBolt) {
      audioAPI.playBolt(total > 1 ? (tribulation.boltsHit - 1) / (total - 1) : 1);
    }
    for (var s = 0; s < 14; s++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 40 + Math.random() * 130;
      tribulation.sparks.push({
        x: botX, y: botY,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40,
        t: 0, dur: 0.4 + Math.random() * 0.3
      });
    }
    // Tia CUỐI là một vụ nổ (theo video mẫu của Bui): khung bùng nổ tỏa
    // tròn trắng–tím tại điểm chạm + vệt tia lửa văng ra. Thuần hình ảnh:
    // burst sống 0,5s trong lớp vẽ, không đổi nhịp pha.
    if (tribulation.boltsHit >= total) {
      tribulation.burst = { t: 0, x: botX, y: botY };
      for (var bs = 0; bs < 26; bs++) {
        var ba = Math.random() * Math.PI * 2;
        var bsp = 120 + Math.random() * 320;
        tribulation.burstSparks.push({
          x: botX, y: botY - 6,
          vx: Math.cos(ba) * bsp, vy: Math.sin(ba) * bsp - 60,
          t: 0, dur: 0.45 + Math.random() * 0.4
        });
      }
    }
  }

  // Đợt KIẾP VÂN vòng 3: sinh một cung điện bò trong mây (pha tụ + pha
  // đánh). Cung sống ngắn 0,16–0,38s, nhấp nháy mạnh; vị trí neo TƯƠNG
  // ĐỐI theo nhân vật (dx quanh vòng mây, dy quanh bụng mây py−150) nên
  // bám mây khi vẽ. Cửa sổ nguồn ngẫu nhiên trên ảnh cung + lật ngang để
  // không lộ lặp; biến thể hồng đỏ hiếm (~16%).
  function spawnTribArc(tr, strength) {
    var imgs = [assets.cung_dien_1, assets.cung_dien_2, assets.cung_dien_3];
    var pick = Math.random();
    var vi = pick < 0.42 ? 0 : (pick < 0.84 ? 1 : 2);
    var img = imgs[vi];
    if (!img || !img.complete || !img.naturalWidth) return;
    var winFrac = 0.4 + Math.random() * 0.3;
    tr.arcs.push({
      img: img,
      vi: vi,
      dx: (Math.random() - 0.5) * 320,
      dy: -330 + (Math.random() - 0.5) * 76,
      w: (110 + Math.random() * 90) * (0.55 + 0.6 * strength) * 1.15,
      sx: Math.random() * (1 - winFrac),
      sw: winFrac,
      flip: Math.random() < 0.5,
      seed: Math.random() * 100,
      t: 0,
      dur: 0.22 + Math.random() * 0.28
    });
  }

  function updateTribulation(dt) {
    if (!tribulation) return;
    var tr = tribulation;
    tr.t += dt;
    if (tr.flash > 0) tr.flash = Math.max(0, tr.flash - dt * 5.5);
    if (tr.bolt) {
      tr.bolt.age += dt;
      if (tr.bolt.age > 0.22) tr.bolt = null;
    }
    for (var i = tr.sparks.length - 1; i >= 0; i--) {
      var sp = tr.sparks[i];
      sp.t += dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 260 * dt;
      if (sp.t >= sp.dur) tr.sparks.splice(i, 1);
    }
    // Vòng 3: tuổi của vụ nổ tia cuối + vệt lửa văng (thuần hình ảnh).
    if (tr.burst) {
      tr.burst.t += dt;
      if (tr.burst.t > 0.5) tr.burst = null;
    }
    for (var bi2 = tr.burstSparks.length - 1; bi2 >= 0; bi2--) {
      var bsp2 = tr.burstSparks[bi2];
      bsp2.t += dt;
      bsp2.x += bsp2.vx * dt;
      bsp2.y += bsp2.vy * dt;
      bsp2.vy += 300 * dt;
      if (bsp2.t >= bsp2.dur) tr.burstSparks.splice(bi2, 1);
    }
    // Vòng 3: cung điện trong mây — sinh dày dần theo độ tụ, sống ở cả
    // pha tụ lẫn pha đánh (sét sống trong mây trước và giữa các tia
    // giáng, đúng ngôn ngữ video mẫu).
    if (tr.phase === 'gather' || tr.phase === 'bolts') {
      var strength = tr.phase === 'gather' ? Math.min(1, tr.t / tr.gatherDur) : 1;
      tr.arcTimer -= dt;
      var maxArcs = tr.phase === 'gather' ? 3 + Math.round(3 * strength) : 5;
      if (tr.arcTimer <= 0 && tr.arcs.length < maxArcs) {
        spawnTribArc(tr, strength);
        tr.arcTimer = (tr.phase === 'gather' ? 0.30 - 0.19 * strength : 0.15) * (0.7 + Math.random() * 0.6);
      }
      // Sấm rền bám độ tụ của mây.
      if (audioAPI && audioAPI.setTribRumbleLevel) audioAPI.setTribRumbleLevel(strength);
    }
    for (var ai = tr.arcs.length - 1; ai >= 0; ai--) {
      tr.arcs[ai].t += dt;
      if (tr.arcs[ai].t >= tr.arcs[ai].dur) tr.arcs.splice(ai, 1);
    }

    if (tr.phase === 'gather') {
      if (tr.t >= tr.gatherDur) {
        tr.phase = 'bolts';
      }
      return;
    }
    if (tr.phase === 'bolts') {
      if (tr.boltsHit < tr.boltsTotal && tr.t >= tr.nextBoltAt) {
        tribulationStrike();
        tr.nextBoltAt = tr.t + tr.boltInterval;
      }
      if (tr.boltsHit >= tr.boltsTotal && tr.t >= tr.nextBoltAt - tr.boltInterval + 0.55) {
        tr.phase = 'outcome';
        tr.outcomeT = 0;
        // Âm thanh pha kết: rền tắt, thiên âm sáng lên, gió nổi theo
        // độ bay của nhân vật.
        if (audioAPI && audioAPI.stopTribRumble) audioAPI.stopTribRumble();
        if (audioAPI && audioAPI.playHeavenChime) audioAPI.playHeavenChime();
        if (audioAPI && audioAPI.startTribWind) audioAPI.startTribWind();
      }
      return;
    }
    if (tr.phase === 'outcome') {
      tr.outcomeT += dt;
      // Gió bám độ cao bay lên (0 khi chạm đất, 1 ở đỉnh 84px).
      if (audioAPI && audioAPI.setTribWindLevel) {
        audioAPI.setTribWindLevel(Math.max(0, Math.min(1, computeTribulationLift() / TRIB_LIFT_H)));
      }
      // Đợt KIẾP VÂN vòng 2: hạt sáng sinh quanh chân nhân vật và bay lên
      // trong cột sáng suốt pha kết (tối đa ~26 hạt sống cùng lúc).
      if (player && tr.motes.length < 26 && Math.random() < 0.55) {
        tr.motes.push({
          x: player.x + (Math.random() - 0.5) * 96,
          y: player.y - Math.random() * 12,
          vy: -(26 + Math.random() * 38),
          sway: Math.random() * Math.PI * 2,
          t: 0, dur: 1.0 + Math.random() * 0.9,
          r: 1.1 + Math.random() * 1.9
        });
      }
      for (var mi = tr.motes.length - 1; mi >= 0; mi--) {
        var mo = tr.motes[mi];
        mo.t += dt;
        mo.y += mo.vy * dt;
        mo.x += Math.sin(mo.t * 3 + mo.sway) * 9 * dt;
        if (mo.t >= mo.dur) tr.motes.splice(mi, 1);
      }
      // Vòng 3: mưa tia lửa VÀNG rơi từ khe mây xé phía trên xuống quanh
      // nhân vật (ngôn ngữ pha kết của video mẫu), suốt pha kết.
      if (player && tr.rain.length < 48 && Math.random() < 0.9) {
        tr.rain.push({
          x: player.x + (Math.random() - 0.5) * 680,
          y: player.y - 430 + Math.random() * 120,
          vy: 130 + Math.random() * 90,
          sway: Math.random() * Math.PI * 2,
          len: 7 + Math.random() * 5,
          t: 0, dur: 2.6
        });
      }
      for (var rj = tr.rain.length - 1; rj >= 0; rj--) {
        var rd = tr.rain[rj];
        rd.t += dt;
        rd.y += rd.vy * dt;
        rd.x += Math.sin(rd.t * 2.2 + rd.sway) * 7 * dt;
        if (rd.t >= rd.dur || rd.y > player.y + 8) tr.rain.splice(rj, 1);
      }
      if (tr.outcomeT >= tr.outcomeDur) {
        if (audioAPI && audioAPI.stopTribWind) audioAPI.stopTribWind();
        if (audioAPI && audioAPI.stopTribRumble) audioAPI.stopTribRumble();
        tribulation = null;
      }
    }
  }

  function getTribulationState() {
    if (!tribulation) return null;
    return {
      active: true,
      phase: tribulation.phase,
      boltsHit: tribulation.boltsHit,
      boltsTotal: tribulation.boltsTotal,
      outcome: tribulation.outcome,
      liftY: Math.round(computeTribulationLift())
    };
  }

  // =========================================================================
  // Đợt KIẾP VÂN vòng 2 + vòng 3 (Bui chỉ rõ 17:32–17:33 ngày 2026-11-10,
  // video mẫu 04:30 ngày 2026-11-11): mây thật (vòng 1, giữ nguyên) + sét
  // SINH HÌNH THẬT trắng–tím + cung điện bò trong mây + tia cuối bùng nổ
  // + hào quang pha kết vàng (cột sáng mép mềm, vòng nhiều lớp, nắng vàng
  // xuyên mây, mưa tia lửa vàng) + NHÂN VẬT BAY LÊN khi thành công. Kịch
  // bản pha + mọi con số của T2/T3 giữ nguyên — đây thuần là lớp hình.
  // =========================================================================
  function tribSmooth(u) {
    u = Math.max(0, Math.min(1, u));
    return u * u * (3 - 2 * u);
  }

  // Độ nhấc nhân vật (px) theo tiến trình pha kết: bốc lên mềm trong
  // 38% đầu, lơ lửng ở đỉnh (nhấp nhô rất nhẹ) tới 68% — trùng cửa sổ hào
  // quang tỏa mạnh nhất — rồi hạ xuống mềm, về đúng 0 khi cảnh kết thúc.
  // Đỉnh đã chọn: 84px (đọc rõ ở kích thước thật, bóng đất tách hẳn).
  var TRIB_LIFT_H = 84;
  var playerLiftY = 0; // độ nhấc của KHUNG VẼ hiện tại — CHỈ là lệch vẽ, player.y không bao giờ đổi
  function computeTribulationLift() {
    if (!tribulation || tribulation.phase !== 'outcome') return 0;
    var op = tribulation.outcomeT / tribulation.outcomeDur;
    if (op < 0.38) return TRIB_LIFT_H * tribSmooth(op / 0.38);
    if (op < 0.68) return TRIB_LIFT_H * (1 + 0.03 * Math.sin(tribulation.outcomeT * 2.4));
    return TRIB_LIFT_H * (1 - tribSmooth((op - 0.68) / 0.32));
  }

  // Kết cấu sáng vẽ sẵn một lần (vẽ lại bằng drawImage mỗi khung, rẻ hơn
  // tạo gradient lớn lặp lại): quầng radial trắng ấm + cột sáng (hồ sơ
  // ngang mềm hai mép, phai dần lên đỉnh) nướng sẵn màu vàng ấm.
  var tribGlowTex = null;
  var tribBeamTex = null;
  function getTribTextures() {
    if (tribGlowTex && tribBeamTex) return;
    var c1 = document.createElement('canvas');
    c1.width = 256; c1.height = 256;
    var g1 = c1.getContext('2d');
    var rg = g1.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255, 250, 224, 1)');
    rg.addColorStop(0.25, 'rgba(255, 244, 200, 0.55)');
    rg.addColorStop(0.6, 'rgba(255, 238, 180, 0.15)');
    rg.addColorStop(1, 'rgba(255, 238, 180, 0)');
    g1.fillStyle = rg;
    g1.fillRect(0, 0, 256, 256);
    tribGlowTex = c1;

    var c2 = document.createElement('canvas');
    c2.width = 256; c2.height = 256;
    var g2 = c2.getContext('2d');
    var hg = g2.createLinearGradient(0, 0, 256, 0);
    hg.addColorStop(0, 'rgba(255, 240, 196, 0)');
    hg.addColorStop(0.22, 'rgba(255, 242, 204, 0.30)');
    hg.addColorStop(0.5, 'rgba(255, 252, 232, 0.82)');
    hg.addColorStop(0.78, 'rgba(255, 242, 204, 0.30)');
    hg.addColorStop(1, 'rgba(255, 240, 196, 0)');
    g2.fillStyle = hg;
    g2.fillRect(0, 0, 256, 256);
    g2.globalCompositeOperation = 'destination-in';
    var vg = g2.createLinearGradient(0, 0, 0, 256);
    vg.addColorStop(0, 'rgba(255,255,255,0)');
    vg.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    vg.addColorStop(0.75, 'rgba(255,255,255,0.88)');
    vg.addColorStop(1, 'rgba(255,255,255,1)');
    g2.fillStyle = vg;
    g2.fillRect(0, 0, 256, 256);
    tribBeamTex = c2;
  }

  // Quầng radial theo tông màu (tím cho lôi kiếp, hồng cho cung đỏ) —
  // dùng cho mây phát sáng từ bên trong quanh cung điện và miệng tia.
  var tribGlowTexByKey = {};
  function getTribGlowTex(key) {
    if (tribGlowTexByKey[key]) return tribGlowTexByKey[key];
    if (typeof document === 'undefined') return null;
    var rgb = key === 'pink' ? '255, 120, 160' : '168, 130, 255';
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, 'rgba(' + rgb + ', 0.9)');
    rg.addColorStop(0.3, 'rgba(' + rgb + ', 0.42)');
    rg.addColorStop(0.65, 'rgba(' + rgb + ', 0.12)');
    rg.addColorStop(1, 'rgba(' + rgb + ', 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 256, 256);
    tribGlowTexByKey[key] = c;
    return c;
  }

  // Cường độ tia theo tuổi: chớp mạnh nhất lúc chạm đất, suy giảm nhanh
  // kèm nhấp nháy tần số cao và một nhịp lóe lại (restrike) — tia sống
  // trong 0,22 giây chứ không phải một khung tĩnh mờ dần đều. (Vòng 2)
  function boltIntensity(bolt) {
    var u = bolt.age / 0.22;
    if (u >= 1) return 0;
    var decay = Math.pow(1 - u, 0.75);
    var flick = 0.84 + 0.16 * Math.sin(bolt.age * 170 + bolt.seed * 11);
    var restrike = 0.22 * Math.max(0, Math.sin(u * 9 + bolt.seed)) * (1 - u);
    return Math.max(0, Math.min(1.15, decay * flick + restrike));
  }

  // Vòng 3: vẽ tia lôi kiếp bằng ẢNH SINH THẬT — ảnh neo theo trục
  // mây→điểm chạm (xoay theo độ lệch ngang của miệng tia), bề rộng lớn
  // dần theo sức tia; kèm mây phát sáng từ bên trong quanh miệng tia và
  // vũng sáng tím tại điểm chạm đất (bloom như video mẫu).
  function drawLightningBolt(bolt, px, py) {
    var inten = boltIntensity(bolt);
    if (inten <= 0.01) return;
    var total = tribulation ? tribulation.boltsTotal : bolt.power;
    var p01 = total > 1 ? (bolt.power - 1) / (total - 1) : 1;
    var dx = bolt.botX - bolt.topX, dy = bolt.botY - bolt.topY;
    var len = Math.sqrt(dx * dx + dy * dy);
    var midX = (bolt.topX + bolt.botX) / 2, midY = (bolt.topY + bolt.botY) / 2;
    var theta = Math.atan2(-dx, dy);
    var aClamped = Math.min(1, inten);
    getTribTextures();
    var glowV = getTribGlowTex('violet');

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Mây phát sáng từ bên trong quanh miệng tia.
    if (glowV) {
      ctx.globalAlpha = 0.5 * aClamped;
      ctx.drawImage(glowV, bolt.topX - 175, bolt.topY - 28, 350, 195);
      ctx.globalAlpha = 0.35 * aClamped;
      ctx.drawImage(glowV, bolt.topX - 95, bolt.topY - 12, 190, 110);
    }
    // Vũng sáng tại điểm chạm.
    ctx.fillStyle = 'rgba(178, 142, 255, ' + (0.20 * aClamped).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(bolt.botX, bolt.botY + 6, 76, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    if (glowV) {
      ctx.globalAlpha = 0.55 * aClamped;
      ctx.drawImage(glowV, bolt.botX - 62, bolt.botY - 62, 124, 124);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Thân tia: ảnh sinh thật; lượt hai 'lighter' nhẹ cho bloom.
    var imgs = [assets.loi_kiep_1, assets.loi_kiep_2, assets.loi_kiep_3, assets.loi_kiep_4];
    var img = imgs[Math.max(0, Math.min(3, bolt.variant || 0))];
    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(theta);
    if (bolt.flip) ctx.scale(-1, 1);
    if (img && img.complete && img.naturalWidth > 0) {
      var drawH = len * 1.05;
      var drawW = drawH * (img.naturalWidth / img.naturalHeight) * (0.8 + 0.38 * p01);
      ctx.globalAlpha = aClamped;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 * aClamped;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      // Đường lùi tối thiểu khi ảnh chưa về kịp (cảnh không bao giờ
      // trống tia): một nét trắng–tím dày có hào quang.
      ctx.globalAlpha = aClamped;
      ctx.strokeStyle = 'rgba(196, 168, 255, 0.8)';
      ctx.lineWidth = 7;
      ctx.shadowColor = 'rgba(168, 130, 255, 0.9)';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(-dx / 2, -dy / 2);
      ctx.lineTo(dx / 2, dy / 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 2.4;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(-dx / 2, -dy / 2);
      ctx.lineTo(dx / 2, dy / 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Vòng 3: vẽ các cung điện đang sống trong mây (pha tụ + pha đánh) —
  // bụng mây phát sáng đúng tông quanh mỗi cung rồi mới tới thân cung.
  function drawTribArcs(tr, px, py, visStrength) {
    if (!tr.arcs.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < tr.arcs.length; i++) {
      var arc = tr.arcs[i];
      var u = Math.min(1, arc.t / arc.dur);
      var env = Math.pow(Math.sin(Math.PI * u), 0.7);
      var flick = 0.72 + 0.28 * Math.sin(arc.t * 150 + arc.seed * 23);
      var a = env * flick * visStrength;
      if (a <= 0.02) continue;
      var cx = px + arc.dx, cy = py + arc.dy;
      var glow = getTribGlowTex(arc.vi === 2 ? 'pink' : 'violet');
      if (glow) {
        ctx.globalAlpha = 0.32 * a;
        ctx.drawImage(glow, cx - arc.w * 0.55, cy - arc.w * 0.17, arc.w * 1.1, arc.w * 0.34);
      }
      var img = arc.img;
      var swPx = img.naturalWidth * arc.sw;
      var sxPx = img.naturalWidth * arc.sx;
      var dh = arc.w * (img.naturalHeight / swPx);
      ctx.save();
      ctx.translate(cx, cy);
      if (arc.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = 0.95 * a;
      ctx.drawImage(img, sxPx, 0, swPx, img.naturalHeight, -arc.w / 2, -dh / 2, arc.w, dh);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Vòng 3: vụ nổ của tia cuối — khung tỏa tròn trắng–tím nở bung tại
  // điểm chạm + vệt tia lửa văng (theo khung cao trào của video mẫu).
  function drawTribBurst(tr) {
    if (tr.burstSparks.length) {
      ctx.save();
      ctx.lineCap = 'round';
      for (var i = 0; i < tr.burstSparks.length; i++) {
        var s = tr.burstSparks[i];
        var a = Math.max(0, 1 - s.t / s.dur);
        if (a <= 0.01) continue;
        ctx.strokeStyle = (i % 3 === 0)
          ? 'rgba(255, 255, 255, ' + (0.85 * a).toFixed(3) + ')'
          : 'rgba(216, 182, 255, ' + (0.8 * a).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 0.045, s.y - s.vy * 0.045);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (!tr.burst) return;
    var u = Math.min(1, tr.burst.t / 0.5);
    var ease = 1 - Math.pow(1 - u, 3);
    var dia = 110 + ease * 430;
    var alpha = Math.pow(1 - u, 1.25) * 0.95;
    var img = assets.bung_no;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, tr.burst.x - dia / 2, tr.burst.y - 14 - dia / 2, dia, dia);
    }
    var glowV = getTribGlowTex('violet');
    if (glowV) {
      ctx.globalAlpha = 0.5 * (1 - u);
      var gd = 150 * (1 - u * 0.4);
      ctx.drawImage(glowV, tr.burst.x - gd / 2, tr.burst.y - 14 - gd / 2, gd, gd);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function renderTribulation() {
    if (!tribulation || !player || !ctx) return;
    var tr = tribulation;
    var px = player.x;
    var py = player.y;

    // Mức tụ mây theo pha: gather 0->1, bolts giữ 1, outcome tan dần.
    var gatherP = 0;
    if (tr.phase === 'gather') gatherP = Math.min(1, tr.t / tr.gatherDur);
    else if (tr.phase === 'bolts') gatherP = 1;
    else gatherP = Math.max(0, 1 - (tr.outcomeT / tr.outcomeDur));

    ctx.save();

    // =========================================================================
    // Đợt KIẾP VÂN vòng 4 — Việc 3: Không khí bão toàn cảnh (giảm sáng nền +
    // tối viền) ở mức trình diễn thuần túy để khối mây đúng tông mẫu.
    // Kết thúc cảnh tự động trả toàn bộ cảnh về trạng thái ban đầu.
    // =========================================================================
    var stormP = (tr.phase === 'outcome')
      ? Math.max(0, 1 - (tr.outcomeT / tr.outcomeDur))
      : gatherP;

    if (stormP > 0.01) {
      // 1. Lớp phủ tối nền giông bão (chìm tông cả bản đồ, cây cối, mặt đất)
      var darkA = 0.44 * stormP;
      ctx.fillStyle = 'rgba(6, 8, 16, ' + darkA.toFixed(3) + ')';
      ctx.fillRect(camera.x - 60, camera.y - 60, camera.viewportW + 120, camera.viewportH + 120);

      // 2. Tối viền (vignette giông bão) tỏa từ tâm người chơi ra ngoài
      var vigGrad = ctx.createRadialGradient(
        px, py - 90, camera.viewportW * 0.28,
        px, py - 90, camera.viewportW * 1.05
      );
      vigGrad.addColorStop(0, 'rgba(4, 5, 12, 0)');
      vigGrad.addColorStop(0.55, 'rgba(4, 5, 12, ' + (0.22 * stormP).toFixed(3) + ')');
      vigGrad.addColorStop(1, 'rgba(4, 5, 12, ' + (0.50 * stormP).toFixed(3) + ')');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(camera.x - 60, camera.y - 60, camera.viewportW + 120, camera.viewportH + 120);
    }

    // =========================================================================
    // Đợt KIẾP VÂN vòng 4 — Việc 1 & 2: Làm lại toàn bộ lớp mây kiếp
    // Bộ mây bão 3 tầng có thể tích thật:
    //  - Tầng 1 (xa): Trần bão xa (fx-kiep-van4-xa.png) che phủ vòm trời phía trên
    //  - Tầng 2 (trung): Bụng mây / miệng xoáy (fx-kiep-van4-bung.png) ngay trên đầu nhân vật
    //  - Tầng 3 (gần): Hai cụm mây cuộn trào có gờ sáng lạnh (fx-kiep-van4-gan-1/2)
    // =========================================================================
    var imgXa = assets.kiep_van4_xa;
    var imgBung = assets.kiep_van4_bung;
    var imgGan1 = assets.kiep_van4_gan_1;
    var imgGan2 = assets.kiep_van4_gan_2;

    var kv4Ready = imgXa && imgXa.complete && imgXa.naturalWidth > 0 &&
                   imgBung && imgBung.complete && imgBung.naturalWidth > 0 &&
                   imgGan1 && imgGan1.complete && imgGan1.naturalWidth > 0 &&
                   imgGan2 && imgGan2.complete && imgGan2.naturalWidth > 0;

    if (kv4Ready) {
      var isOutcome = (tr.phase === 'outcome');
      var op = isOutcome ? (tr.outcomeT / tr.outcomeDur) : 0;
      var opEase = tribSmooth(op);
      var cloudAlpha = isOutcome ? Math.max(0, 1 - op * 1.1) : (0.40 + 0.58 * gatherP);
      var tearX = isOutcome ? (opEase * 380) : 0;

      // Hơi sương mờ tầng nền
      var mist = assets.kiep_suong;
      if (mist && mist.complete && mist.naturalWidth > 0 && !isOutcome) {
        var mistW = Math.max(camera.viewportW * 1.5, 780);
        var mistH = mistW * mist.naturalHeight / mist.naturalWidth;
        var mistX = px + Math.sin(tr.t * 0.08 + tr.seed) * 20;
        ctx.save();
        ctx.globalAlpha = 0.12 * gatherP;
        ctx.drawImage(mist, mistX - mistW / 2, py - 240 - mistH / 2, mistW, mistH);
        ctx.restore();
      }

      // 1. Tầng xa: Trần bão kéo tới che phủ bầu trời phía trên
      var ceilW = Math.max(camera.viewportW * 1.45, 820);
      var ceilH = ceilW * (imgXa.naturalHeight / imgXa.naturalWidth);
      var ceilBaseY = camera.y - 40 + (1 - gatherP) * -80;
      var ceilSwayX = Math.sin(tr.t * 0.08 + tr.seed) * 16;
      var cxCenter = camera.x + camera.viewportW / 2 + ceilSwayX;

      ctx.save();
      ctx.globalAlpha = cloudAlpha * 0.96;
      if (!isOutcome || tearX < 1) {
        ctx.drawImage(imgXa, cxCenter - ceilW / 2, ceilBaseY, ceilW, ceilH);
      } else {
        // Pha kết: xé mở trần bão làm hai nửa tách về hai phía
        var halfNatW = imgXa.naturalWidth / 2;
        var halfDrawW = ceilW / 2;
        ctx.drawImage(imgXa, 0, 0, halfNatW, imgXa.naturalHeight,
          cxCenter - halfDrawW - tearX, ceilBaseY, halfDrawW, ceilH);
        ctx.drawImage(imgXa, halfNatW, 0, halfNatW, imgXa.naturalHeight,
          cxCenter + tearX, ceilBaseY, halfDrawW, ceilH);
      }
      ctx.restore();

      // 2. Tầng trung: Bụng mây / xoáy sấm ngay phía trên đầu nhân vật
      var bungBaseW = 440;
      var bungW = (bungBaseW + Math.sin(tr.t * 0.35 + tr.seed) * 14) * (0.82 + 0.18 * gatherP);
      var bungH = bungW * (imgBung.naturalHeight / imgBung.naturalWidth);
      var bungCX = px + Math.sin(tr.t * 0.12 + tr.seed) * 8;
      var bungCY = py - 335 + Math.sin(tr.t * 0.16 + tr.seed) * 6;

      ctx.save();
      ctx.globalAlpha = cloudAlpha;
      if (!isOutcome || tearX < 1) {
        ctx.save();
        ctx.translate(bungCX, bungCY);
        ctx.rotate(tr.t * 0.04 + tr.seed);
        ctx.drawImage(imgBung, -bungW / 2, -bungH / 2, bungW, bungH);
        ctx.restore();
      } else {
        var bScale = 1 + opEase * 0.35;
        var bW = bungW * bScale;
        var bH = bungH * bScale;
        var halfBW = bW / 2;
        var halfBNat = imgBung.naturalWidth / 2;
        ctx.drawImage(imgBung, 0, 0, halfBNat, imgBung.naturalHeight,
          bungCX - halfBW - tearX * 0.9, bungCY - bH / 2, halfBW, bH);
        ctx.drawImage(imgBung, halfBNat, 0, halfBNat, imgBung.naturalHeight,
          bungCX + tearX * 0.9, bungCY - bH / 2, halfBW, bH);
      }
      ctx.restore();

      // Bụng mây phát sáng từ bên trong khi sét giáng
      if (tr.bolt) {
        getTribTextures();
        var glowV2 = getTribGlowTex('violet');
        if (glowV2) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.40 * Math.min(1, boltIntensity(tr.bolt));
          ctx.drawImage(glowV2, bungCX - 210, bungCY - 130, 420, 260);
          ctx.restore();
        }
      }

      // 3. Tầng gần: Các cụm mây cuộn trào có gờ sáng lạnh (nổi khối, tương phản)
      ctx.save();
      ctx.globalAlpha = cloudAlpha;

      // Cụm gần A (bên trái): dải mây ngang gờ sáng trên
      var c1W = 380;
      var c1H = c1W * (imgGan1.naturalHeight / imgGan1.naturalWidth);
      var c1X = px - 130 - (1 - gatherP) * 50 - tearX * 1.1 + Math.sin(tr.t * 0.18) * 8;
      var c1Y = py - 280 + Math.sin(tr.t * 0.22) * 5;
      ctx.drawImage(imgGan1, c1X - c1W / 2, c1Y - c1H / 2, c1W, c1H);

      // Cụm gần B (bên phải): lật ngang đối xứng, gờ sáng viền ngoài
      var c2W = 360;
      var c2H = c2W * (imgGan1.naturalHeight / imgGan1.naturalWidth);
      var c2X = px + 130 + (1 - gatherP) * 50 + tearX * 1.1 + Math.sin(tr.t * 0.15 + 1.2) * 8;
      var c2Y = py - 265 + Math.sin(tr.t * 0.20 + 0.8) * 5;
      ctx.save();
      ctx.translate(c2X, c2Y);
      ctx.scale(-1, 1);
      ctx.drawImage(imgGan1, -c2W / 2, -c2H / 2, c2W, c2H);
      ctx.restore();

      // Cụm gần C (phía trên / đe mây): đe mây cuộn tầng sâu
      var c3W = 320;
      var c3H = c3W * (imgGan2.naturalHeight / imgGan2.naturalWidth);
      var c3X = px + 25 + Math.sin(tr.t * 0.10 + 2.1) * 10;
      var c3Y = py - 380 - (isOutcome ? tearX * 0.6 : 0) + Math.sin(tr.t * 0.14) * 6;
      ctx.drawImage(imgGan2, c3X - c3W / 2, c3Y - c3H / 2, c3W, c3H);

      ctx.restore();
    } else {
      // Đường lùi khi ảnh đợt 4 chưa nạp xong
      var cloudR;
      if (tr.phase === 'gather') cloudR = 430 - 290 * gatherP;
      else if (tr.phase === 'bolts') cloudR = 140;
      else cloudR = 140 + 400 * (tr.outcomeT / tr.outcomeDur);
      var cloudAlphaOld = tr.phase === 'outcome' ? 0.55 * gatherP : 0.28 + 0.3 * gatherP;
      var kiepImgs = [assets.kiep_van_1, assets.kiep_van_2, assets.kiep_van_3];
      var kiepReady = false;
      for (var ki = 0; ki < kiepImgs.length; ki++) {
        if (kiepImgs[ki] && kiepImgs[ki].complete && kiepImgs[ki].naturalWidth > 0) { kiepReady = true; break; }
      }
      if (kiepReady) {
        for (var ci = 0; ci < 9; ci++) {
          var ang = (ci / 9) * Math.PI * 2 + tr.seed + tr.t * 0.12;
          var cxp = px + Math.cos(ang) * cloudR;
          var cyp = py - 150 + Math.sin(ang) * cloudR * 0.30 + Math.sin(tr.t * 0.5 + ci * 2.1) * 4;
          var imgK = kiepImgs[ci % 3] || kiepImgs[0];
          if (!imgK || !imgK.complete || !imgK.naturalWidth) continue;
          var drawW = 2 * (120 + (ci % 3) * 36) * ((ci % 3) === 2 ? 0.82 : 1.06);
          var drawH = drawW * imgK.naturalHeight / imgK.naturalWidth;
          ctx.save();
          ctx.globalAlpha = cloudAlphaOld;
          ctx.translate(cxp, cyp);
          ctx.rotate(tr.t * 0.05 * (ci % 2 === 0 ? 1 : -1) + ci * 0.35);
          if (ci % 2 === 1) ctx.scale(-1, 1);
          ctx.drawImage(imgK, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }
      } else {
        for (var ci2 = 0; ci2 < 9; ci2++) {
          var ang2 = (ci2 / 9) * Math.PI * 2 + tr.seed + tr.t * 0.12;
          var cxp2 = px + Math.cos(ang2) * cloudR;
          var cyp2 = py - 150 + Math.sin(ang2) * cloudR * 0.30;
          var crx2 = 120 + (ci2 % 3) * 36;
          var cry2 = 34 + (ci2 % 4) * 7;
          ctx.fillStyle = 'rgba(24, 22, 38, ' + cloudAlphaOld.toFixed(3) + ')';
          ctx.beginPath();
          ctx.ellipse(cxp2, cyp2, crx2, cry2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Vòng 3: cung điện bò TRONG mây ở pha tụ + pha đánh, bụng mây phát
    // sáng theo cung (lớp còn thiếu hẳn ở hai vòng trước).
    if (tr.phase !== 'outcome') {
      drawTribArcs(tr, px, py, tr.phase === 'gather' ? 0.35 + 0.65 * gatherP : 0.95);
    }

    // Tia lôi kiếp đang đánh xuống — Đợt KIẾP VÂN vòng 3: HÌNH SINH
    // THẬT trắng–tím (thay polyline hai nét của T2 và đường thủ tục ba
    // lớp của vòng 2 — cả hai đã bị Bui bác).
    if (tr.bolt) drawLightningBolt(tr.bolt, px, py);

    // Vụ nổ của tia cuối (nở bung + vệt lửa) — thuần lớp vẽ.
    drawTribBurst(tr);

    // Hạt điện tóe ở điểm chạm (tông trắng–tím theo ngôn ngữ mẫu).
    for (var si = 0; si < tr.sparks.length; si++) {
      var spark = tr.sparks[si];
      var sa = Math.max(0, 1 - spark.t / spark.dur);
      ctx.fillStyle = 'rgba(208, 188, 255, ' + (0.85 * sa).toFixed(3) + ')';
      ctx.fillRect(spark.x - 1.6, spark.y - 1.6, 3.2, 3.2);
    }

    // Pha kết — Đợt KIẾP VÂN vòng 2 + vòng 3: hào quang VÀNG làm lại
    // toàn bộ (thay cột gradient chữ nhật + nét elip phẳng cũ): quầng
    // sáng đất, hai vòng hào quang tỏa nhiều lớp, nắng vàng xuyên khe
    // mây xé xuống, cột sáng mép mềm, hào quang ôm nhân vật ĐANG BAY ở
    // độ cao playerLiftY, hạt sáng bay lên + mưa tia lửa vàng rơi. Mây
    // tan theo vòng tròn ở trên giữ nguyên của vòng 1.
    if (tr.phase === 'outcome') {
      var op = tr.outcomeT / tr.outcomeDur;
      // Bao sáng chung: bốc nhanh, giữ đỉnh giữa pha (trùng lúc nhân vật
      // lơ lửng ở đỉnh), tắt hẳn cuối pha.
      var beamEnv = tribSmooth(op / 0.16) * (1 - tribSmooth((op - 0.6) / 0.4));
      var liftHere = playerLiftY;
      getTribTextures();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Quầng sáng dẹt trên mặt đất dưới nhân vật.
      ctx.globalAlpha = 0.22 * beamEnv;
      ctx.drawImage(tribGlowTex, px - 110, py - 34, 220, 68);

      // Hai vòng hào quang lan trên mặt đất: vòng chính + vòng phụ trễ
      // nhịp, mỗi vòng ba lớp (tỏa mềm / dải chính / lõi mảnh).
      var ringSpecs = [
        { o: op, maxR: 512, a: 1 },
        { o: Math.max(0, (op - 0.22) / 0.78), maxR: 330, a: 0.55 }
      ];
      for (var ri = 0; ri < ringSpecs.length; ri++) {
        var rs = ringSpecs[ri];
        if (rs.o <= 0) continue;
        var rr = 24 + (1 - Math.pow(1 - rs.o, 2.2)) * rs.maxR;
        var rEnv = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, rs.o * 1.08))), 0.8) * rs.a;
        if (rEnv <= 0.01) continue;
        var ry = (py - 8);
        var squash = 0.36;
        ctx.shadowColor = 'rgba(255, 220, 140, 0.8)';
        ctx.strokeStyle = 'rgba(255, 214, 130, ' + (0.10 * rEnv).toFixed(3) + ')';
        ctx.lineWidth = 30;
        ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.ellipse(px, ry, rr, rr * squash, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 226, 156, ' + (0.42 * rEnv).toFixed(3) + ')';
        ctx.lineWidth = 9;
        ctx.beginPath(); ctx.ellipse(px, ry, rr, rr * squash, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 250, 224, ' + (0.8 * rEnv).toFixed(3) + ')';
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.ellipse(px, ry, rr, rr * squash, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // Vòng 3: nắng VÀNG xuyên xuống từ khe mây xé phía trên (god rays
      // của video mẫu) — 5 dải xòe quạt, sáng nhất ở miệng khe (lật
      // ngược kết cấu cột để đầu sáng nằm trên), lắc rất nhẹ. Miệng khe
      // neo ở py−380: ngay trên vành mây đang tan (vành vươn tới ~py−312)
      // để đầu sáng của các dải nằm trong khung nhìn điện thoại.
      var riftX = px + Math.sin(tr.outcomeT * 0.8) * 6;
      var riftY = py - 380;
      var shaftSpecs = [
        { a: -0.46, w: 34 }, { a: -0.22, w: 50 }, { a: 0, w: 66 },
        { a: 0.22, w: 50 }, { a: 0.46, w: 34 }
      ];
      for (var gi = 0; gi < shaftSpecs.length; gi++) {
        var sh = shaftSpecs[gi];
        ctx.save();
        ctx.translate(riftX, riftY);
        ctx.rotate(sh.a + Math.sin(tr.outcomeT * 0.6 + gi * 1.7) * 0.02);
        ctx.globalAlpha = (0.16 + 0.04 * Math.sin(tr.outcomeT * 1.1 + gi * 1.9)) * beamEnv;
        ctx.drawImage(tribBeamTex, -sh.w / 2, 500, sh.w, -500);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Hào quang ôm nhân vật đang lơ lửng + vòng hào quang trên đầu.
      // Độ đậm đã hiệu chỉnh sau lượt soi đầu: cột + quầng mà quá tay là
      // cháy trắng nuốt mất nhân vật — giữ mức nhân vật còn đọc rõ hình.
      var charCY = py - liftHere - 56;
      ctx.globalAlpha = 0.2 * beamEnv;
      ctx.drawImage(tribGlowTex, px - 115, charCY - 115, 230, 230);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255, 236, 180, ' + (0.55 * beamEnv).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255, 226, 150, 0.9)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(px, py - liftHere - 122, 30, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Cột sáng chính: lớp tỏa rộng mờ + lõi mép mềm, bề rộng thở nhẹ.
      var beamW = 96 * (0.93 + 0.07 * Math.sin(tr.outcomeT * 3.1));
      var beamSway = Math.sin(tr.outcomeT * 0.9) * 3;
      ctx.globalAlpha = 0.13 * beamEnv;
      ctx.drawImage(tribBeamTex, px - beamW * 0.95 + beamSway, py - 466, beamW * 1.9, 472);
      ctx.globalAlpha = 0.4 * beamEnv;
      ctx.drawImage(tribBeamTex, px - beamW / 2 + beamSway, py - 466, beamW, 472);
      ctx.globalAlpha = 1;

      // Hạt sáng bay lên trong cột.
      for (var pi = 0; pi < tr.motes.length; pi++) {
        var mote = tr.motes[pi];
        var ma = Math.max(0, 1 - mote.t / mote.dur) * 0.8 * beamEnv;
        if (ma <= 0.01) continue;
        ctx.fillStyle = 'rgba(255, 246, 214, ' + ma.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Vòng 3: mưa tia lửa VÀNG rơi từ khe mây xuống quanh nhân vật.
      ctx.lineCap = 'round';
      for (var rdi = 0; rdi < tr.rain.length; rdi++) {
        var drop = tr.rain[rdi];
        var ra = 0.8 * beamEnv * Math.min(1, (py + 6 - drop.y) / 40 + 0.3);
        if (ra <= 0.01) continue;
        ctx.strokeStyle = 'rgba(255, 226, 150, ' + ra.toFixed(3) + ')';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + 1.5, drop.y + drop.len);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Chớp sáng trắng toàn khung ngay khoảnh khắc tia chạm đất.
    if (tr.flash > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.38 * tr.flash).toFixed(3) + ')';
      ctx.fillRect(camera.x - 60, camera.y - 60, camera.viewportW + 120, camera.viewportH + 120);
    }

    ctx.restore();
  }

  function tryBreakthrough(opts) {
    if (!player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    opts = opts || {};

    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var minTuVi = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var v = (player.paths && player.paths[keys[i]] && player.paths[keys[i]].tuVi) || 0;
      if (v < minTuVi) minTuVi = v;
    }

    if (minTuVi < 900) {
      var msgLow = 'Chưa đủ tu vi để đột phá — cả 5 hệ phải đạt 900 tu vi (hiện tại yếu nhất: ' + minTuVi + '/900).';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgLow);
      }
      return { ok: false, reason: 'insufficient_tuvi', minTuVi: minTuVi, msg: msgLow };
    }

    var hasPill = stateAPI.hasItemInBag(player, 'truc-co-dan', 1);
    if (!hasPill) {
      var msgNoPill = 'Thiếu Trúc Cơ Đan — hãy tìm Chấp Sự tại Tông Môn để luyện đan.';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgNoPill);
      }
      return { ok: false, reason: 'missing_pill', msg: msgNoPill };
    }

    // Đợt T2 — PHÁN CỦA BUI 14:12 ngày 2026-11-10: "Giữ 100% như hiện tại,
    // chỉ thêm độ kiếp diễn thật". Tỉ lệ cấu hình ở js/dotpha.js CONFIG
    // khóa 1.0: đủ hai điều kiện ở trên là CHẮC CHẮN thành công — hàm này
    // KHÔNG có nhánh thất bại và KHÔNG có đường mã án phạt nào (bản nháp
    // tỉ lệ 80% + phạt nửa nguyên liệu + đan phụ trợ đã hủy theo lệnh Bui,
    // ghi lại trong báo cáo đợt t2-report.md). Viên đan tiêu hao, cảnh độ
    // kiếp 3 tia diễn kèm, nhãn Trúc Cơ mở tại đây như luật REALMFIX.
    var dpAPI = getDotPhaAPI();
    var rate = (dpAPI && dpAPI.CONFIG && typeof dpAPI.CONFIG.successRate === 'number')
      ? dpAPI.CONFIG.successRate : 1;
    var roll = dpAPI ? dpAPI.rollOnce(opts) : Math.random();

    stateAPI.removeItemFromBag(player, 'truc-co-dan', 1);
    startTribulation();

    player.realm = 'Trúc Cơ Sơ Kỳ';
    // Đợt T1: đột phá ĐẠI cảnh giới thành công -> mốc tiểu đột phá chuyển
    // sang giai đoạn Trúc Cơ đầu tiên (mốc 10, trần 1.300/đường).
    if (stateAPI.setMocIndex) stateAPI.setMocIndex(player, 10);
    if (player.quests) {
      player.quests.mainStage = 10;
    }
    stateAPI.savePlayer(player);

    if (audioAPI) audioAPI.playChime();
    spawnFloatingText('ĐỘT PHÁ TRÚC CƠ ĐẠI THÀNH!', player.x, player.y - 45, '#ffe9a8');
    var successMsg = 'Thiên địa rung chuyển! Đã đột phá thành công Trúc Cơ Sơ Kỳ!';
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(successMsg);
      window.GameUI.refreshHUD();
    }
    return { ok: true, realm: 'Trúc Cơ Sơ Kỳ', newRealm: 'Trúc Cơ Sơ Kỳ', msg: successMsg, rate: rate, roll: roll };
  }

  // Đợt T3: module Đột Phá Kim Đan (js/kimdan.js) giữ công thức, phẩm đan,
  // bảng đột phá và trận tâm ma; engine là nơi duy nhất ÁP kết quả kết đan
  // (khuôn tryBreakthrough của Trúc Cơ).
  function getKimDanAPI() {
    if (typeof window !== 'undefined' && window.GameKimDan) return window.GameKimDan;
    if (typeof global !== 'undefined' && global.GameKimDan) return global.GameKimDan;
    if (typeof require !== 'undefined') {
      try { return require('./kimdan.js'); } catch (e) { return null; }
    }
    return null;
  }

  /**
   * KẾT ĐAN — áp kết quả đột phá Kim Đan sau khi người chơi đã THẮNG TÂM MA
   * trong Bảng Đột Phá Kim Đan (js/kimdan.js). Mọi điều kiện được kiểm LẠI
   * tại đây (module dẫn luồng không phải nguồn tin cậy): mốc đúng 13 (Trúc
   * Cơ Viên Mãn), năm đường đầy trần mốc, còn giữ Ngũ Hành Quy Nguyên Đan
   * và cờ thắng tâm ma. Theo luật Bui đợt T2: đủ điều kiện là CHẮC CHẮN
   * thành công (tỉ lệ khóa 1.0 trong kimdan.js CONFIG) — không nhánh thất
   * bại, không án phạt; đan chỉ tiêu hao TẠI THỜI ĐIỂM NÀY. Phẩm Kim Đan =
   * phẩm của viên đan (tính theo Hài Hòa lúc luyện, kimdan.js ghi vào
   * player.kimDan.pillPham). Độ kiếp 5 TIA diễn kèm (hồ sơ 05D §3), nhãn
   * Kim Đan mở tại đây như luật REALMFIX/DOTPHA-LABEL.
   */
  function tryKimDanBreakthrough(opts) {
    opts = opts || {};
    var p = opts.player || player;
    if (!p) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    var st = stateAPI || (typeof window !== 'undefined' ? window.GameState : (typeof require !== 'undefined' ? require('./state.js') : null));

    var moc = st && st.getMocIndex ? st.getMocIndex(p) : 0;
    if (moc !== 13) {
      var msgMoc = 'Đột phá Kim Đan chỉ mở ở mốc Trúc Cơ Viên Mãn (mốc 13).';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgMoc);
      }
      return { ok: false, reason: 'wrong_moc', msg: msgMoc };
    }

    var cap = st && st.getMocCap ? st.getMocCap(p) : 2500;
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var minTuVi = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var v = (p.paths && p.paths[keys[i]] && p.paths[keys[i]].tuVi) || 0;
      if (v < minTuVi) minTuVi = v;
    }
    if (minTuVi < cap) {
      var msgLow = 'Chưa đủ tu vi để kết đan — cả 5 hệ phải đầy trần ' + cap + ' (hiện tại yếu nhất: ' + minTuVi + '/' + cap + ').';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgLow);
      }
      return { ok: false, reason: 'insufficient_tuvi', minTuVi: minTuVi, msg: msgLow };
    }

    var hasPill = st && st.hasItemInBag ? st.hasItemInBag(p, 'ngu-hanh-quy-nguyen-dan', 1) : false;
    if (!hasPill) {
      var msgNoPill = 'Thiếu Ngũ Hành Quy Nguyên Đan — hãy luyện tại Đan Phòng Tông Môn (5 Nguyên Tinh + 2 Nước Ốc Đảo Tinh Khiết + 1.500 Linh Thạch).';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgNoPill);
      }
      return { ok: false, reason: 'missing_pill', msg: msgNoPill };
    }

    if (!opts.tamMaWon) {
      var msgTM = 'Phải thắng tâm ma trước khi kết đan — hãy vào cảnh giới tâm ma trong Bảng Đột Phá Kim Đan.';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgTM);
      }
      return { ok: false, reason: 'tam_ma_required', msg: msgTM };
    }

    var kdAPI = getKimDanAPI();
    var kd = st && st.ensureKimDan ? st.ensureKimDan(p) : (p.kimDan || {});
    // Phẩm của viên đan đã luyện; đường luyện chuẩn luôn ghi phẩm >= 1 —
    // phòng hờ đan lọt vào túi qua đường khác thì tối thiểu Nhất phẩm.
    var pham = (kd && kd.pillPham >= 1) ? kd.pillPham : 1;
    var phamName = (kdAPI && kdAPI.PHAM_NAMES && kdAPI.PHAM_NAMES[pham]) || '';

    if (st && st.removeItemFromBag) st.removeItemFromBag(p, 'ngu-hanh-quy-nguyen-dan', 1);
    if (kd) {
      kd.pham = pham;
      kd.pillPham = 0;
      kd.focus = null;
    }
    startTribulation(5);

    p.realm = 'Kim Đan Sơ Kỳ';
    // Đợt T3: mốc tiểu đột phá chuyển sang giai đoạn Kim Đan đầu tiên
    // (mốc 14, trần 3.700/đường — thang trần đã có sẵn từ đợt T1).
    if (st && st.setMocIndex) st.setMocIndex(p, 14);
    if (st && st.savePlayer) st.savePlayer(p);

    if (audioAPI) audioAPI.playChime();
    var px = (p && typeof p.x === 'number') ? p.x : 0;
    var py = (p && typeof p.y === 'number') ? p.y : 0;
    if (typeof spawnFloatingText === 'function') {
      spawnFloatingText('KẾT ĐAN ĐẠI THÀNH — ' + phamName.toUpperCase() + '!', px, py - 45, '#ffe9a8');
    }
    var successMsg = 'Năm nguyên tinh quy nguyên, lôi kiếp năm tia đã tan — đã kết Kim Đan Sơ Kỳ, phẩm đan: ' + phamName + ' (theo cả đời)!';
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(successMsg);
      window.GameUI.refreshHUD();
    }
    return { ok: true, realm: 'Kim Đan Sơ Kỳ', newRealm: 'Kim Đan Sơ Kỳ', pham: pham, msg: successMsg };
  }

  function exchangePill(elem) {
    if (!player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    var valid = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    if (valid.indexOf(elem) === -1) {
      return { ok: false, reason: 'invalid_element', msg: 'Hệ không hợp lệ' };
    }
    var cost = 15;
    if ((player.linhThach || 0) < cost) {
      var msgFail = 'Không đủ Linh Thạch — cần 15 Linh Thạch để đổi Tu Luyện Đan (' + elem.toUpperCase() + ').';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msgFail);
      }
      return { ok: false, reason: 'insufficient_linh_thach', msg: msgFail };
    }

    player.linhThach -= cost;
    var itemId = 'dan-' + elem;
    stateAPI.addItemToBag(player, itemId, 1);
    stateAPI.savePlayer(player);

    var elemNames = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
    var elemName = elemNames[elem] || elem;
    var msgSuccess = 'Đổi thành công 1 Tu Luyện Đan (' + elemName + ')!';
    if (audioAPI) audioAPI.playChime();
    spawnFloatingText('-15 Linh Thạch', player.x, player.y - 35, '#ff9a5c');
    spawnFloatingText('+1 Tu Luyện Đan', player.x, player.y - 55, '#ffe9a8');

    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(msgSuccess);
      window.GameUI.refreshHUD();
    }
    return { ok: true, itemId: itemId, msg: msgSuccess };
  }

  function refineTrucCoDan() {
    if (!player) return { ok: false, reason: 'no_player' };
    var countItem = function (id) {
      return stateAPI ? stateAPI.countItemInBag(player, id) : 0;
    };
    var c1 = countItem('linh-chi-rung');
    var c2 = countItem('bang-tuy');
    var c3 = countItem('hoa-tinh-tho');
    var c4 = countItem('nguyen-tinh-moc');
    var c5 = countItem('nguyen-tinh-thuy');
    var lt = player.linhThach || 0;

    if (c1 < 3 || c2 < 1 || c3 < 2 || c4 < 1 || c5 < 1 || lt < 200) {
      var msg = 'Chưa đủ nguyên liệu luyện Trúc Cơ Đan (cần 3 Linh Chi Rừng, 1 Băng Tủy, 2 Hỏa Tinh Thổ, 1 Nguyên Tinh Mộc, 1 Nguyên Tinh Thủy và 200 Linh Thạch).';
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(msg);
      }
      return { ok: false, reason: 'missing_materials', msg: msg };
    }

    stateAPI.removeItemFromBag(player, 'linh-chi-rung', 3);
    stateAPI.removeItemFromBag(player, 'bang-tuy', 1);
    stateAPI.removeItemFromBag(player, 'hoa-tinh-tho', 2);
    stateAPI.removeItemFromBag(player, 'nguyen-tinh-moc', 1);
    stateAPI.removeItemFromBag(player, 'nguyen-tinh-thuy', 1);
    player.linhThach -= 200;
    stateAPI.addItemToBag(player, 'truc-co-dan', 1);
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.refines = (player.stats.refines || 0) + 1;

    if (player.quests) {
      player.quests.mainStage = 9;
    }
    stateAPI.savePlayer(player);

    if (audioAPI) audioAPI.playChime();
    spawnFloatingText('Luyện thành Trúc Cơ Đan!', player.x, player.y - 45, '#ffe9a8');
    var successMsg = 'Khai lò luyện đan thành công! Đã nhận 1 Trúc Cơ Đan.';
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast(successMsg);
      window.GameUI.refreshHUD();
    }
    return { ok: true, msg: successMsg };
  }

  function equipItem(slotIndex) {
    if (!stateAPI || !player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    var res = stateAPI.equipItem(player, slotIndex);
    if (res.ok) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(res.msg);
        window.GameUI.refreshHUD();
      }
    }
    return res;
  }

  function unequipItem(slotName) {
    if (!stateAPI || !player) return { ok: false, msg: 'Chưa khởi tạo nhân vật' };
    var res = stateAPI.unequipItem(player, slotName);
    if (res.ok) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast(res.msg);
        window.GameUI.refreshHUD();
      }
    }
    return res;
  }

  function pathToPoint(x, y) {
    cancelAutoPath(true);
    cancelTravel();
    return triggerPathTo(x, y, null);
  }

  /** Số ô (1-based) của chiêu trên thanh kỹ năng, 0 nếu không nằm trên thanh. */
  function getSkillSlotNumber(skillId) {
    if (!skillsAPI) return 0;
    var idx = skillsAPI.slotOf(skillId);
    return idx >= 0 ? idx + 1 : 0;
  }

  /**
   * Tung kỹ năng từ bàn phím hoặc nút giao diện — Đợt K1: đường ống tổng quát
   * theo registry (js/skills.js), không còn nhánh cứng theo từng chiêu:
   *   kiểm tra mở khóa → kiểm tra tung chiêu thuần (skills.checkCast) →
   *   trừ phí + bắt đầu hồi chiêu → vận chiêu (castState, thanh vận chiêu) →
   *   phát chiêu tại điểm phát (releaseSkill) → đạn/diện/tức thì → trúng đích.
   * Số học giữ nguyên bản live: phí và hồi chiêu tính từ lúc bắt đầu vận,
   * raw = nền công × damage.ratio của chiêu, bạo kích chiêu 5% như cũ.
   */
  function castSkill(skillId) {
    if (!player || player.hp <= 0) return;
    if (!skillsAPI) return;
    var def = skillsAPI.getSkill(skillId);
    if (!def) return;
    var hasPacks = mapData && mapData.monsterPacks && mapData.monsterPacks.length > 0;
    if (!hasPacks && mapData.id !== 'rung-doc') {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Kỹ năng chỉ dùng trong khu vực săn bắn');
      }
      return;
    }

    if (!skillsAPI.isUnlocked(def, player)) {
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Chưa mở khóa chiêu này');
      }
      return;
    }

    var target = null;
    var targetDist = null;
    if (def.targetMode === 'single') {
      target = getSkillTarget(def.range);
      if (target) targetDist = Math.hypot(player.x - target.x, player.y - target.y);
    }

    var verdict = skillsAPI.checkCast(def, {
      casting: !!castState,
      cooldownLeft: skillCds[skillId] || 0,
      resource: def.cost && def.cost.type === 'linhLuc' ? player.linhLuc : 0,
      hasTarget: !!target,
      targetDist: targetDist
    });
    if (!verdict.ok) {
      if (verdict.code === 'cost') {
        if (audioAPI) audioAPI.playDull();
        if (typeof window !== 'undefined' && window.GameUI) {
          var slotNum = getSkillSlotNumber(skillId);
          if (slotNum > 0) window.GameUI.triggerSkillShake(slotNum);
          window.GameUI.showToast(verdict.reason);
        }
      } else if (verdict.code === 'target' || verdict.code === 'range') {
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.showToast(verdict.reason);
        }
      }
      // 'cooldown' / 'casting': im lặng như bản live (bấm lúc đang hồi không báo)
      return;
    }

    // Trừ phí + bắt đầu hồi chiêu ngay khi bắt đầu vận (nhịp bản live giữ nguyên)
    if (def.cost && def.cost.type === 'linhLuc' && def.cost.amount > 0) {
      player.linhLuc -= def.cost.amount;
    }
    skillCds[skillId] = def.cooldown;
    lastCombatTime = performance.now();
    if (target) {
      player.dir = getDirFromVelocity(target.x - player.x, target.y - player.y);
    }

    if (def.castTime > 0) {
      castState = { def: def, target: target, timer: def.castTime, total: def.castTime };
      spawnCastGather(def);
    } else {
      releaseSkill(def, target);
    }
    // Đợt K2: chiêu có bộ khung tung chiêu riêng thì diễn ngay từ lúc vận
    // (hướng đã chốt về phía mục tiêu ở trên).
    startSkillCastAnim(def);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('combat_action'));
    }
  }

  /** Cập nhật chiêu đang vận mỗi khung; hết giờ vận thì phát chiêu. */
  function updateCast(dt) {
    if (skillCastAnim) {
      skillCastAnim.timer -= dt;
      if (skillCastAnim.timer <= 0) skillCastAnim = null;
    }
    if (!castState) return;
    castState.timer -= dt;
    if (castState.timer > 0) return;
    var cs = castState;
    castState = null;
    releaseSkill(cs.def, cs.target);
  }

  /**
   * Đợt K2: bắt đầu hoạt ảnh tung chiêu bằng khung thật của chiêu (nếu có
   * castAnim trong registry). Hàng atlas theo thứ tự dirs của gói khung;
   * player.dir (0 = nam ... 4 = bắc, DIR_VECTORS) đổi sang hàng atlas
   * [n, ne, e, se, s, sw, w, nw] bằng (12 − dir) mod 8. Thời lượng phủ
   * hết thời gian vận + nhịp thu chiêu, tối thiểu đủ một lượt 8 khung.
   */
  function startSkillCastAnim(def) {
    if (!def || !def.castAnim || !player) return;
    var ca = def.castAnim;
    var dur = Math.max((def.castTime || 0) + 0.45, (ca.framesPerDir || 8) / (ca.fps || 16));
    skillCastAnim = {
      def: def,
      timer: dur,
      duration: dur,
      row: (12 - (player.dir || 0)) % 8,
      frames: ca.framesPerDir || 8
    };
  }

  /**
   * Đợt K2 — Tương Sinh Liên Hoàn: bước chuỗi cho MỘT hành động tung đòn
   * (một lần tung chiêu hoặc một đòn thường). Toán thuần nằm ở skills.js
   * (lienHoanStep); ở đây chỉ đọc HH hiện tại và giữ trạng thái chuỗi.
   * Trả null khi HH < 0,8 (chuỗi gãy, đặt lại từ đầu).
   */
  function advanceLienHoan() {
    if (!skillsAPI || !player || !player.paths) return null;
    var hh = stateAPI ? stateAPI.harmonyRatio(player.paths) : skillsAPI.harmonyRatioOf(player.paths);
    var step = skillsAPI.lienHoanStep(lienHoanState, hh);
    if (!step.active) {
      if (lienHoanState.stacks > 0) lienHoanState = { elem: null, stacks: 0 };
      return null;
    }
    lienHoanState = { elem: step.elem, stacks: step.stacks };
    return step;
  }

  /** Phản hồi UI của Liên Hoàn: chữ nổi theo hệ vừa chuyển + vòng phù dưới chân. */
  function spawnLienHoanFeedback(step) {
    var shown = Math.min(step.stacks, skillsAPI.LIEN_HOAN.maxStacks);
    spawnFloatingText('Liên Hoàn ×' + shown, player.x, player.y - 100, fxLang(step.elem).glow);
    visualEffects.push({
      kind: 'runecircle', elem: step.elem, lang: fxLang(step.elem),
      x: player.x, y: player.y, timer: 0.8, duration: 0.8, radius: 42
    });
    if (step.stacks === 1 && typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast('Tương Sinh Liên Hoàn kích hoạt — đòn đánh tự chuyển hệ theo vòng tương sinh!');
    }
  }

  /**
   * Đợt K2: đòn hoàn thành một vòng Liên Hoàn (tầng 5, 10, ...) gây thêm
   * một lần sát thương hệ Ngũ Hành bằng 50% đòn chính lên mục tiêu chính
   * (hồ sơ 02 §5).
   */
  function applyLienHoanCycleBonus(def, target, mainDealt) {
    if (!target || target.hp <= 0 || !(mainDealt > 0) || !skillsAPI) return;
    var bonus = mainDealt * skillsAPI.LIEN_HOAN.cycleBonusRatio;
    monstersAPI.damageMonster(target, bonus, player);
    spawnDamageNumber(target.x, target.y - 58, Math.round(bonus), 'nguhanh', false);
    spawnReleaseBurst(target.x, target.y - 20, 'nguhanh', def && def.tier);
    if (target.hp <= 0) handleMonsterDeath(target);
  }

  /**
   * Đợt K2 — Luật ngắt vận chiêu (hồ sơ 52 §3): đang vận chiêu mà trúng
   * đòn NẶNG (>= ngưỡng INTERRUPT_HP_FRACTION của máu tối đa) thì chiêu
   * bị ngắt: mất lần tung, hoàn nửa linh lực đã trừ, hồi chiêu của chiêu
   * đó xóa sạch (tung lại được ngay), hiệu ứng tụ khí và khung tung chiêu
   * tan theo. Đòn nhẹ không ngắt. Trả true nếu vừa ngắt.
   */
  function tryInterruptCast(dealtToPlayer) {
    if (!castState || !player || !(dealtToPlayer > 0)) return false;
    var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { hpMax: 100, linhLucMax: 20 };
    if (dealtToPlayer < INTERRUPT_HP_FRACTION * stats.hpMax) return false;
    var def = castState.def;
    castState = null;
    skillCastAnim = null;
    for (var i = visualEffects.length - 1; i >= 0; i--) {
      if (visualEffects[i].kind === 'gather' && visualEffects[i].skillId === def.id) {
        visualEffects.splice(i, 1);
      }
    }
    if (def.cost && def.cost.type === 'linhLuc' && def.cost.amount > 0) {
      player.linhLuc = Math.min(player.linhLuc + Math.floor(def.cost.amount / 2), stats.linhLucMax);
    }
    skillCds[def.id] = 0;
    spawnFloatingText('Bị ngắt!', player.x, player.y - 100, '#ff9d5c');
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showToast('Chiêu bị ngắt giữa chừng — hoàn nửa linh lực, tung lại được ngay.');
    }
    return true;
  }

  /**
   * Phát chiêu tại điểm phát (tay nhân vật): âm thanh theo chiêu, hiệu ứng
   * điểm phát (bùng sáng + vòng chấn động, mạnh dần theo bậc), rồi chuyển
   * giao theo delivery của chiêu: đạn truy đuổi / tức thì / (K2: diện, mưa).
   */
  function releaseSkill(def, target) {
    if (!player) return;
    var elem = skillsAPI ? skillsAPI.elementOf(def) : 'neutral';
    if (audioAPI) {
      if (def.sfx === 'leafCast' && audioAPI.playLeafCast) audioAPI.playLeafCast();
      else if (def.sfx === 'vineSnare' && audioAPI.playVineSnare) audioAPI.playVineSnare();
      else if (def.sfx === 'slash' && audioAPI.playSlash) audioAPI.playSlash();
    }
    spawnReleaseBurst(player.x, player.y - 30, elem, def.tier);

    var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { attack: 10 };
    var baseRaw = 10 + (stats.attack - 10);
    var raw = baseRaw * (def.damage ? def.damage.ratio : 1) +
      (def.damage && def.damage.flat ? def.damage.flat : 0);

    // Đợt K2 — Tương Sinh Liên Hoàn: chuyển hệ + cộng uy lực MỘT LẦN cho
    // cả hành động tung chiêu này (đạn mang theo hệ đã chuyển tới đích;
    // chiêu diện áp một hệ cho cả vùng). Hệ số Hài Hòa đã nằm sẵn trong
    // stats.attack (deriveStats) nên số hiện trên bảng nhân vật và số
    // gây ra luôn là một.
    var conv = advanceLienHoan();
    if (conv) {
      elem = conv.elem;
      raw = raw * conv.mult;
      spawnLienHoanFeedback(conv);
    }
    var cycleBonus = !!(conv && conv.completedCycle);

    if (def.delivery === 'projectile') {
      if (!target || target.state === 'dead') return; // đích đã gục trong lúc vận: chiêu tan
      projectiles.push({
        kind: 'skill',
        skillId: def.id,
        x: player.x,
        y: player.y - 30,
        target: target,
        speed: def.projectileSpeed || 520,
        raw: raw,
        element: elem,
        status: def.status || null,
        cycleBonus: cycleBonus,
        trail: []
      });
    } else if (def.delivery === 'instant') {
      if (!target || target.state === 'dead') return;
      var dealtInstant = resolveSkillHit(def, target, raw, elem);
      if (cycleBonus) applyLienHoanCycleBonus(def, target, dealtInstant);
    } else if (def.delivery === 'area') {
      // Đợt K2: chiêu diện — mọi địch còn sống trong bán kính quanh mục
      // tiêu chính đều trúng cùng một đòn (cùng hệ, cùng uy lực).
      if (!target || target.state === 'dead') return;
      var radius = def.radius || 90;
      var victims = [];
      for (var vi = 0; vi < fieldMonsters.length; vi++) {
        var vm = fieldMonsters[vi];
        if (vm.state === 'dead' || vm.hp <= 0) continue;
        if (Math.hypot(vm.x - target.x, vm.y - target.y) <= radius) victims.push(vm);
      }
      if (victims.indexOf(target) < 0) victims.push(target);
      var dealtMain = 0;
      for (var vj = 0; vj < victims.length; vj++) {
        var dealtV = resolveSkillHit(def, victims[vj], raw, elem);
        if (victims[vj] === target) dealtMain = dealtV;
      }
      if (cycleBonus) applyLienHoanCycleBonus(def, target, dealtMain);
    }
    // delivery 'melee' đi qua kênh đánh tự động (executePlayerBasicAttack);
    // 'rain' / 'self' vẫn để ngỏ cho các đợt nội dung sau trên cùng khung này.
  }

  /**
   * Giải quyết một đòn chiêu trúng mục tiêu: khung sát thương combat.js
   * (khắc hệ → giáp cong → bạo kích 5% như bản live), trạng thái kèm chiêu,
   * số sát thương bay và hiệu ứng trúng đích theo ngôn ngữ hình của hệ.
   */
  function resolveSkillHit(def, target, raw, elem) {
    var elemFac = combatAPI ? combatAPI.getElementFactor(elem, target.element) : 1.0;
    var dealt = combatAPI ? combatAPI.calcDamage(raw, elemFac, target.armor) : raw;
    var isCrit = combatAPI ? combatAPI.rollCrit(0.05) : false;
    if (isCrit) dealt *= (combatAPI ? combatAPI.CRIT_MULTIPLIER : 1.5);

    monstersAPI.damageMonster(target, dealt, player);
    spawnDamageNumber(target.x, target.y - 40, Math.round(dealt), elem === 'neutral' ? 'moc' : elem, isCrit);
    spawnImpactFx(target.x, target.y, elem, def);

    // Trạng thái kèm chiêu áp SAU damageMonster: hàm đó tự đặt choáng nhẹ
    // 0.2s + aggro, sẽ ghi đè mất thời gian trói của chiêu nếu áp trước
    // (bản live cũ áp trước nên trói 1,2s thực tế chỉ còn 0,2s — K1 sửa
    // đúng đặc tả chiêu, số sát thương/hao phí/hồi chiêu không đổi).
    // Đợt K2 mở đủ bốn họ trạng thái của khung: trói/choáng (đứng yên),
    // làm chậm (monsters.js tự giảm tốc), đốt (engine tự trừ máu theo nhịp).
    if (def.status && target.hp > 0) {
      var st = def.status;
      if (st.type === 'snare' || st.type === 'stun') {
        target.state = 'hit';
        target.hitStunTimer = Math.max(target.hitStunTimer || 0, st.duration);
      } else if (st.type === 'slow') {
        target.slowTimer = st.duration;
        target.slowRatio = st.ratio || 0.4;
      } else if (st.type === 'dot') {
        target.dotTimer = st.duration;
        target.dotDps = dealt * (st.ratio || 0.3) / st.duration;
        target.dotElem = elem;
        target.dotSource = player;
      }
    }

    if (target.hp <= 0) {
      handleMonsterDeath(target);
    }
    return dealt;
  }

  /* ==================================================================
   * ENGINE HIỆU ỨNG K1 (chuyển ngôn ngữ VFX của Vô Sắc, viết lại cho
   * ngũ hành): mọi hiệu ứng là CHUYỂN ĐỘNG SỐNG tính theo timer/duration,
   * không ảnh tĩnh. Nguyên thủy (primitives) dùng chung cho mọi chiêu:
   *   gather     — tụ linh khí xoáy vào điểm phát trong lúc vận chiêu
   *   burst      — bùng hạt sáng tại một điểm (điểm phát / trúng đích)
   *   ring       — vòng chấn động nở ra (ellipse nén theo phối cảnh đất)
   *   swirl      — vòng xoáy/trận xoay thật quanh một tâm
   *   runecircle — vòng phù văn mặt đất: 2 vòng + sao tương sinh xoay
   *   rain       — mưa đạn theo nhịp trong một bán kính
   *   streak     — vệt lướt theo quỹ đạo cong (triệu hồi/lướt)
   *   crescent   — vệt chém cong thon hai đầu quét theo hướng đòn
   *   ground_motif — hình mặt đất theo motif hệ (dây leo/lưỡi/giọt...)
   * Màu + motif lấy từ ngôn ngữ hình của hệ trong skills.js (ELEMENTS);
   * kích thước/cường độ phóng theo bậc qua tierScale.
   * ================================================================== */

  function fxLang(elem) {
    return skillsAPI ? skillsAPI.elementLang(elem) : { core: '#ffffff', glow: '#cccccc', deep: '#888888', motif: 'slash', trail: 'plain' };
  }

  function fxScale(tier) {
    return skillsAPI ? skillsAPI.tierScale(tier) : 1;
  }

  /** Tụ linh khí tại điểm phát trong lúc vận chiêu (xoáy vào + nhân sáng lớn dần). */
  function spawnCastGather(def) {
    var elem = skillsAPI ? skillsAPI.elementOf(def) : 'neutral';
    var lang = fxLang(elem);
    var parts = [];
    var n = 10;
    for (var i = 0; i < n; i++) {
      parts.push({ ang: (i / n) * Math.PI * 2, rad: 26 + (i % 3) * 5, speed: 5.2 + (i % 4) * 0.7, size: 1.8 + (i % 3) * 0.7 });
    }
    visualEffects.push({
      kind: 'gather', elem: elem, lang: lang, skillId: def.id,
      x: player.x, y: player.y - 30, followPlayer: true,
      timer: def.castTime, duration: Math.max(0.05, def.castTime),
      particles: parts
    });
  }

  /** Hiệu ứng tại điểm phát chiêu: bùng sáng + vòng chấn động, mạnh dần theo bậc. */
  function spawnReleaseBurst(x, y, elem, tier) {
    var s = fxScale(tier);
    var lang = fxLang(elem);
    var parts = [];
    var n = Math.round(10 * s);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (i % 5) * 0.13;
      var sp = (60 + (i % 4) * 26) * s;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 14,
        size: (1.6 + (i % 3) * 0.8) * s, drag: 3.2
      });
    }
    visualEffects.push({
      kind: 'burst', elem: elem, lang: lang, x: x, y: y,
      timer: 0.34, duration: 0.34, particles: parts
    });
    visualEffects.push({
      kind: 'ring', elem: elem, lang: lang, x: x, y: y + 16,
      timer: 0.32, duration: 0.32, maxR: 36 * s, ground: true
    });
  }

  /** Hiệu ứng trúng đích: bùng hạt theo hệ + vòng nhỏ; chiêu trói thêm hình mặt đất. */
  function spawnImpactFx(x, yFeet, elem, def) {
    var tier = def ? def.tier : 1;
    var s = fxScale(tier);
    var lang = fxLang(elem);
    var parts = [];
    var n = Math.round(8 * s);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (i % 4) * 0.21;
      var sp = (46 + (i % 3) * 22) * s;
      parts.push({
        x: x, y: yFeet - 22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        size: (1.5 + (i % 3) * 0.7) * s, drag: 3.6
      });
    }
    visualEffects.push({
      kind: 'burst', elem: elem, lang: lang, x: x, y: yFeet - 22,
      timer: 0.3, duration: 0.3, particles: parts
    });
    visualEffects.push({
      kind: 'ring', elem: elem, lang: lang, x: x, y: yFeet,
      timer: 0.28, duration: 0.28, maxR: 26 * s, ground: true
    });
    if (def && def.effect === 'vine_snare') {
      visualEffects.push({
        kind: 'ground_motif', elem: elem, lang: lang, x: x, y: yFeet,
        timer: def.status ? def.status.duration : 1.2,
        duration: def.status ? def.status.duration : 1.2
      });
    }
  }

  /** Vệt chém cong thon hai đầu cho đòn thường (thay slash_crescent cũ). */
  function spawnSlashCrescent(x, y, targetX, targetY, elem, tier) {
    visualEffects.push({
      kind: 'crescent', elem: elem, lang: fxLang(elem),
      x: x, y: y, targetX: targetX, targetY: targetY,
      timer: 0.22, duration: 0.22, scale: fxScale(tier)
    });
  }

  /**
   * Đợt SWINGFIX: vệt kiếm của đòn thường — dải cung chạy dọc ĐÚNG quỹ đạo
   * lưỡi kiếm vừa quét trong nhịp vung (từ điểm lên gối W qua đường hướng
   * mặt tới điểm qua đòn F, tổng 140°), tâm tại điểm nắm đo thật của khung
   * gần nhất, bán kính bằng tầm với của lưỡi (~26px). Sinh tại pha ra đòn
   * cùng khoảnh khắc áp sát thương. Đang diễn khung chiêu riêng (Thái Cực)
   * thì không sinh — lúc đó thân không cầm kiếm theo lớp này.
   */
  function spawnSwordArc(elem) {
    if (skillCastAnim) return;
    var dirName = (lastGripWorld && lastGripWorld.dirName) || HH_GEN_DIRS[(player.dir || 0) % 8];
    var sw = HH_SWING[dirName];
    if (!sw) return;
    visualEffects.push({
      kind: 'sword_arc', elem: elem, lang: fxLang(elem),
      x: lastGripWorld ? lastGripWorld.x : player.x,
      y: lastGripWorld ? lastGripWorld.y : player.y - 40,
      a0: sw.face - 95 * sw.dir, sweep: 140 * sw.dir,
      timer: 0.17, duration: 0.17
    });
  }

  /**
   * Móc kiểm thử/trình diễn: sinh một nguyên thủy VFX bất kỳ tại một điểm.
   * Dùng bởi test/k1-playtest.js để nghiệm thu renderer; không gắn nội dung.
   */
  function debugSpawnVfx(kind, x, y, elem, tier) {
    var lang = fxLang(elem || 'neutral');
    var s = fxScale(tier || 1);
    var base = { kind: kind, elem: elem || 'neutral', lang: lang, x: x, y: y };
    if (kind === 'burst') {
      var parts = [];
      for (var i = 0; i < 14; i++) {
        var a = (i / 14) * Math.PI * 2;
        var sp = (60 + (i % 4) * 26) * s;
        parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 14, size: 2 * s, drag: 3.2 });
      }
      base.timer = 0.4; base.duration = 0.4; base.particles = parts;
    } else if (kind === 'ring') {
      base.timer = 0.5; base.duration = 0.5; base.maxR = 52 * s; base.ground = true;
    } else if (kind === 'swirl') {
      base.timer = 1.4; base.duration = 1.4; base.radius = 34 * s;
    } else if (kind === 'runecircle') {
      base.timer = 1.6; base.duration = 1.6; base.radius = 40 * s;
    } else if (kind === 'rain') {
      base.timer = 1.5; base.duration = 1.5; base.radius = 56 * s; base.drops = [];
    } else if (kind === 'streak') {
      base.timer = 0.9; base.duration = 0.9;
      base.x0 = x - 130 * s; base.y0 = y - 90; base.x1 = x + 40 * s; base.y1 = y - 6;
      base.cx = x - 40 * s; base.cy = y - 110;
    } else if (kind === 'crescent') {
      base.timer = 0.3; base.duration = 0.3; base.targetX = x + 60; base.targetY = y - 6; base.scale = s;
    } else if (kind === 'gather') {
      var gp = [];
      for (var g = 0; g < 10; g++) gp.push({ ang: (g / 10) * Math.PI * 2, rad: 27, speed: 5.4, size: 2 });
      base.timer = 1.2; base.duration = 1.2; base.particles = gp;
    } else if (kind === 'ground_motif') {
      base.timer = 1.4; base.duration = 1.4;
    } else {
      return false;
    }
    visualEffects.push(base);
    return true;
  }

  function getSkillTarget(maxRange) {
    if (targetMonster && targetMonster.state !== 'dead') {
      var d = Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y);
      if (d <= maxRange) return targetMonster;
    }
    // Tìm quái gần nhất trong tầm
    var closest = null;
    var closestDist = maxRange + 1;
    for (var i = 0; i < fieldMonsters.length; i++) {
      var m = fieldMonsters[i];
      if (m.state === 'dead') continue;
      var dist = Math.hypot(player.x - m.x, player.y - m.y);
      if (dist <= maxRange && dist < closestDist) {
        closestDist = dist;
        closest = m;
      }
    }
    return closest;
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    if (pendingSwordToast) {
      pendingSwordToast = false;
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.showToast('Nhận được: Kiếm Đệ Tử');
      }
    }
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
    // Note 8: nạp cờ chất lượng độc lập với hệ âm thanh
    if (stateAPI) {
      var qSettings = stateAPI.loadSettings();
      if (qSettings) {
        setQuality(qSettings.quality || 'cao');
        if (qSettings.zoom !== undefined) userZoom = qSettings.zoom;
        else if (qSettings.display && qSettings.display.zoom !== undefined) userZoom = qSettings.display.zoom;
        resizeCanvas();
      }
    }
    if (audioAPI) {
      var settings = stateAPI ? stateAPI.loadSettings() : null;
      if (settings) {
        audioAPI.setMusicVolume(settings.musicVol);
        audioAPI.setSfxVolume(settings.sfxVol);
        setQuality(settings.quality || 'cao'); // Note 8: nạp cờ chất lượng đã lưu
      }
      // Đợt 3 (Note 3B): nhạc theo map + âm thanh môi trường do GameMusic đảm nhiệm
      // (thay vòng nhạc đơn của audio.js: có theme riêng từng map + lớp chiến đấu).
      if (typeof window !== 'undefined' && window.GameMusic) {
        window.GameMusic.unlock();
        if (settings) {
          window.GameMusic.setMusicVolume(settings.musicVol);
          window.GameMusic.setAmbienceVolume(settings.ambVol != null ? settings.ambVol : 0.6);
          window.GameMusic.setMuted(!!settings.muted);
        }
        window.GameMusic.setMap(currentMapId);
      }
      // Đợt 3 (Note 3A): nạp bản kê lồng tiếng
      if (typeof window !== 'undefined' && window.GameVoice) {
        window.GameVoice.load();
        if (settings) {
          window.GameVoice.setVolume(settings.voiceVol != null ? settings.voiceVol : 0.9);
          window.GameVoice.setEnabled(settings.voiceEnabled !== false);
          window.GameVoice.setMuted(!!settings.muted);
        }
      }
    }
  }

  function stop() {
    isRunning = false;
    if (audioAPI) audioAPI.stopMusic();
  }

  function gameLoop(currentTime) {
    if (!isRunning) return;
    // Đợt 6 (mục 15, hồ sơ 25): giới hạn 30 FPS khi người chơi chọn tiết kiệm pin
    if (Number(getSettingsCached().fpsLimit) === 30 && lastFrameTime && (currentTime - lastFrameTime) < 31) {
      requestAnimationFrame(gameLoop);
      return;
    }
    var dt = (currentTime - lastFrameTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastFrameTime = currentTime;

    update(dt);

    // Đợt 3 (Note 3B): lớp nhạc chiến đấu bật/tắt theo trạng thái giao tranh
    if (typeof window !== 'undefined' && window.GameMusic) {
      var combatNow = !!targetMonster;
      if (!combatNow) {
        for (var ci = 0; ci < fieldMonsters.length; ci++) {
          var cs = fieldMonsters[ci].state;
          if (cs === 'aggro' || cs === 'attack') { combatNow = true; break; }
        }
      }
      if (combatNow !== lastCombatState) {
        lastCombatState = combatNow;
        window.GameMusic.setCombat(combatNow);
      }
    }

    render();

    requestAnimationFrame(gameLoop);
  }

  function update(dt) {
    if (!player || !mapData) return;
    // Đợt 6 (mục 15, hồ sơ 29): thống kê thời gian chơi
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.playSec = (player.stats.playSec || 0) + dt;

    if (screenShakeTimer > 0) {
      screenShakeTimer -= dt;
      if (screenShakeTimer <= 0) {
        screenShakeTimer = 0;
        screenShakeIntensity = 0;
      }
    }

    var now = performance.now();

    // Cập nhật hiệu ứng chuyển map fade
    if (mapFade.dir !== 0) {
      mapFade.alpha += mapFade.dir * dt * 4.0;
      if (mapFade.dir === 1 && mapFade.alpha >= 1) {
        mapFade.alpha = 1;
        mapFade.dir = -1;
        if (mapFade.callback) {
          mapFade.callback();
          mapFade.callback = null;
        }
      } else if (mapFade.dir === -1 && mapFade.alpha <= 0) {
        mapFade.alpha = 0;
        mapFade.dir = 0;
        // Fade xong: chạy yêu cầu chuyển map đã xếp hàng trong lúc fade (nếu có)
        if (pendingMapSwitch) {
          var pendingSwitch = pendingMapSwitch;
          pendingMapSwitch = null;
          switchMap(pendingSwitch.id, pendingSwitch.spawn);
        }
      }
    }

    // Nếu người chơi đã gục ngã (HP = 0)
    if (player.hp <= 0) {
      currentPath = [];
      targetMonster = null;
      castState = null; // gục ngã = ngắt chiêu đang vận (K1: ngắt khi gục/đổi map)
      skillCastAnim = null; // Đợt K2: khung tung chiêu + chuỗi Liên Hoàn cũng gãy khi gục
      basicSwing = null; // Đợt SWINGFIX: gục ngã = nhịp vung gãy, đòn chưa phát thì mất
      lienHoanState = { elem: null, stacks: 0 };
      return;
    }

    // Cập nhật hồi chiêu kỹ năng người chơi (theo id chiêu trong registry)
    if (basicAttackCd > 0) basicAttackCd = Math.max(0, basicAttackCd - dt);
    for (var cdId in skillCds) {
      if (skillCds[cdId] > 0) skillCds[cdId] = Math.max(0, skillCds[cdId] - dt);
    }
    // Cập nhật chiêu đang vận (hết giờ vận -> phát chiêu tại điểm phát)
    updateCast(dt);
    // Cập nhật nhịp vung đòn thường (tới pha ra đòn -> phát đúng một đòn)
    updateBasicSwing(dt);

    // Cập nhật hiệu ứng khống chế lên người chơi (Trói chân / Làm chậm)
    var canMove = true;
    if (playerSnareTimer > 0) {
      playerSnareTimer = Math.max(0, playerSnareTimer - dt);
      canMove = false;
    }
    var currentSpeed = SPEED;
    if (playerSlowTimer > 0) {
      playerSlowTimer = Math.max(0, playerSlowTimer - dt);
      currentSpeed = SPEED * (1.0 - playerSlowRatio);
    }

    // Cập nhật hồi phục khí huyết và linh lực theo giây (Brief §5)
    var inCombat = (now - lastCombatTime) < 5000;
    if (!inCombat) {
      player.hp = Math.min(player.hpMax, player.hp + 1.5 * dt);
      player.linhLuc = Math.min(player.linhLucMax, player.linhLuc + 2.0 * dt);
    } else {
      player.linhLuc = Math.min(player.linhLucMax, player.linhLuc + 0.4 * dt);
    }

    // Cập nhật Chuỗi Săn (Hunt Chain: 20s đếm lùi)
    if (player.huntChain && player.huntChain.timer > 0) {
      player.huntChain.timer -= dt;
      if (player.huntChain.timer <= 0) {
        if (stateAPI) stateAPI.breakHuntChain(player);
      }
    }

    // Di chuyển người chơi (WASD hoặc Click A*)
    var moved = false;
    var vx = 0;
    var vy = 0;

    if (canMove) {
      if (keysDown.up) vy -= 1;
      if (keysDown.down) vy += 1;
      if (keysDown.left) vx -= 1;
      if (keysDown.right) vx += 1;
      if (joystickVector.x !== 0 || joystickVector.y !== 0) {
        vx += joystickVector.x;
        vy += joystickVector.y;
      }

      if (vx !== 0 || vy !== 0) {
        var len = Math.hypot(vx, vy);
        vx /= len;
        vy /= len;

        var stepDist = currentSpeed * dt;
        var targetX = player.x + vx * stepDist;
        var targetY = player.y + vy * stepDist;

        if (mapData.isWalkable(targetX, player.y)) {
          player.x = targetX;
          moved = true;
        }
        if (mapData.isWalkable(player.x, targetY)) {
          player.y = targetY;
          moved = true;
        }

        player.dir = getDirFromVelocity(vx, vy);
        currentPath = [];
        pendingInteraction = null;
        targetMonster = null;
        if (autoPath.active) cancelAutoPath(true);
        if (travelState.active) cancelTravel();
      } else if (currentPath.length > 0) {
        var targetWP = currentPath[0];
        var dwx = targetWP.x - player.x;
        var dwy = targetWP.y - player.y;
        var dist = Math.hypot(dwx, dwy);

        var moveDist = currentSpeed * dt;
        if (dist <= moveDist) {
          player.x = targetWP.x;
          player.y = targetWP.y;
          currentPath.shift();
          if (currentPath.length === 0) {
            if (pendingInteraction && pendingInteraction.onArrive) {
              pendingInteraction.onArrive();
              pendingInteraction = null;
            }
          }
        } else {
          var nvx = dwx / dist;
          var nvy = dwy / dist;
          player.x += nvx * moveDist;
          player.y += nvy * moveDist;
          player.dir = getDirFromVelocity(nvx, nvy);
        }
        moved = true;
      }
    }

    playerMoving = moved;
    if (moved) walkAnimTime += dt;
    // Đợt 3 (Note 6): cộng quãng đường THẬT đã đi vào bộ tích lũy pha (teleport không tính)
    if (lastPX === null) { lastPX = player.x; lastPY = player.y; }
    if (moved) {
      walkDist += Math.hypot(player.x - lastPX, player.y - lastPY);
    }
    lastPX = player.x;
    lastPY = player.y;

    if (moved) {
      stepSoundAccumulator += dt;
      if (stepSoundAccumulator >= 0.32) {
        stepSoundAccumulator = 0;
        if (audioAPI) audioAPI.playStep();
      }
    } else {
      stepSoundAccumulator = 0.28;
    }

    // Tự động đánh cơ bản khi đã chọn mục tiêu quái
    if (targetMonster) {
      if (targetMonster.state === 'dead' || targetMonster.hp <= 0) {
        targetMonster = null;
      } else {
        var distM = Math.hypot(player.x - targetMonster.x, player.y - targetMonster.y);
        if (distM <= 55) {
          currentPath = [];
          player.dir = getDirFromVelocity(targetMonster.x - player.x, targetMonster.y - player.y);

          if (basicAttackCd <= 0) {
            var basicDef = skillsAPI ? skillsAPI.getSkill('basic') : null;
            basicAttackCd = basicDef ? basicDef.cooldown : 0.45;
            executePlayerBasicAttack(targetMonster);
          }
        } else if (!playerMoving && currentPath.length === 0) {
          // Tự động bước tới trong tầm đánh
          triggerPathTo(targetMonster.x, targetMonster.y, null);
        }
      }
    }

    // Mở khóa cổng sau khi tới nơi: cần qua thời gian ân hạn VÀ (đã đứng ngoài
    // mọi vùng cổng ít nhất một khung hình — đang đi xuyên qua vùng cổng thì giữ
    // khóa, nên giữ nguyên hướng đi qua cổng không bao giờ bị trả về).
    // GUIDEFIX: thêm nhánh mở khóa khi người chơi ĐÃ DỪNG HẲN trong vùng cổng
    // (không còn đường đi, không di chuyển). Điểm rơi của Đài Truyền Tống chỉ
    // cách cổng về Tông Môn 32-82px: người chơi đi theo dẫn đường vào thẳng
    // vùng cổng trong chưa đầy 1,6 giây ân hạn rồi đứng tại tâm cổng — theo
    // điều kiện cũ, khóa không bao giờ mở vì nhân vật không hề ra khỏi vùng
    // cổng, kẹt vĩnh viễn ngay trong cổng. Người còn đang đi xuyên qua (còn
    // đường đi/đang di chuyển) vẫn bị giữ khóa như cũ nên chống nảy còn nguyên.
    if (!portalsArmed) {
      var insideAnyExit = false;
      for (var gi = 0; gi < mapData.exits.length; gi++) {
        var gr = mapData.exits[gi].rect;
        if (player.x >= gr.x && player.x <= gr.x + gr.w &&
            player.y >= gr.y && player.y <= gr.y + gr.h) { insideAnyExit = true; break; }
      }
      var stoppedInsideExit = insideAnyExit && !playerMoving && currentPath.length === 0;
      if ((!insideAnyExit || stoppedInsideExit) && performance.now() >= portalRearmAt) portalsArmed = true;
    }

    // Kiểm tra các vùng thoát (Portals)
    for (var i = 0; i < mapData.exits.length; i++) {
      var ex = mapData.exits[i];
      var r = ex.rect;
      if (player.x >= r.x && player.x <= r.x + r.w &&
          player.y >= r.y && player.y <= r.y + r.h) {
        if (ex.targetMap) {
          // Lối chuyển map thật (đang khóa sau khi vừa tới nơi thì bỏ qua)
          if (portalsArmed) {
            switchMap(ex.targetMap, ex.targetSpawn || ex.target);
          }
          break;
        } else {
          // Lối thoát stub
          if (ex.id === 'exit_bottom') {
            player.y = Math.min(player.y, r.y);
          }
          currentPath = [];
          showExitChip(ex.chipLabel);
        }
      }
    }

    // Tự tìm đường theo nhiệm vụ + đồng bộ nút hành động theo ngữ cảnh
    updateAutoPath();
    updateTravel();
    var actx = computeActionContext();
    if (actx.mode !== currentActionMode) {
      currentActionMode = actx.mode;
      if (typeof window !== 'undefined' && window.GameUI && window.GameUI.setActionMode) {
        window.GameUI.setActionMode(actx.mode, actx.label);
      }
    }

    // Cập nhật quái vật trên bất kỳ bản đồ nào có quái
    if (fieldMonsters.length > 0) {
      updateFieldMonsters(dt);
    }

    // Cập nhật vùng (Zones)
    updateZone();

    // Cập nhật nhặt chiến lợi phẩm (Ground Drops)
    updateGroundDrops(dt);

    // Cập nhật đường đạn kỹ năng (Projectiles)
    updateProjectiles(dt);

    // Cập nhật hiệu ứng hình ảnh (VFX & Telegraphs)
    updateVisualEffects(dt);
    updateTribulation(dt); // Đợt T2: cảnh độ kiếp Trúc Cơ (mây tụ / 3 tia / pha kết)

    // Cập nhật chữ sát thương nổi
    updateFloatingTexts(dt);

    // Cập nhật gợn sóng nhấp chuột
    if (clickRipple) {
      clickRipple.radius += 38 * dt;
      clickRipple.alpha -= 1.8 * dt;
      if (clickRipple.alpha <= 0 || clickRipple.radius >= clickRipple.maxRadius) {
        clickRipple = null;
      }
    }

    if (exitChip.timer > 0) {
      exitChip.timer -= dt;
    }

    updateCamera();

    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.update(player, mapData, {
        monsters: (mapData.id === 'rung-doc') ? fieldMonsters : [],
        skillsCd: Object.assign({}, skillCds)
      });
    }
  }

  /**
   * Đợt SWINGFIX: điểm vào của đòn thường (cả nút đánh lẫn tự đánh) — chỉ
   * BẮT ĐẦU nhịp vung kiếm; sát thương áp tại pha ra đòn trong
   * updateBasicSwing (lưỡi quét qua mục tiêu mới tính đòn), để số sát
   * thương không bao giờ hiện trước khi lưỡi kiếm tới nơi. Mọi con số
   * (công thức, bạo kích, Liên Hoàn, hồi chiêu 0,45s) giữ nguyên bản live.
   */
  function executePlayerBasicAttack(m) {
    lastCombatTime = performance.now();
    basicSwing = {
      timer: SWING_DURATION, duration: SWING_DURATION,
      target: m, struck: false, whiff: false,
      armed: !!(player && player.equipment && player.equipment.weapon)
    };
  }

  /** Cập nhật nhịp vung mỗi khung; tới pha ra đòn thì phát đúng một đòn. */
  function updateBasicSwing(dt) {
    if (!basicSwing) return;
    basicSwing.timer -= dt;
    var p = 1 - (basicSwing.timer / basicSwing.duration);
    if (!basicSwing.struck && p >= SWING_STRIKE_P) {
      basicSwing.struck = true;
      if (basicSwing.whiff) {
        // Vung vào không khí (bấm đánh khi không có mục tiêu): tiếng vút +
        // vệt chém cũ + vệt kiếm mới tại pha ra đòn như đòn trúng.
        var v = DIR_VECTORS[basicSwing.whiffDir] || DIR_VECTORS[0];
        if (audioAPI) audioAPI.playSlash();
        visualEffects.push({
          type: 'slash_crescent',
          x: player.x,
          y: player.y - 25,
          targetX: player.x + v.x * 46,
          targetY: player.y - 20 + v.y * 46,
          timer: 0.22,
          duration: 0.22
        });
        if (basicSwing.armed) spawnSwordArc('neutral');
        lastCombatTime = performance.now();
      } else {
        executeBasicHit(basicSwing.target);
      }
    }
    if (basicSwing.timer <= 0) basicSwing = null;
  }

  /**
   * Thân đòn thường nguyên bản (toàn bộ số học của bản live) — SWINGFIX
   * chỉ đổi THỜI ĐIỂM chạy: tại pha ra đòn của nhịp vung thay vì ngay lúc
   * bấm. Quái đã gục trong 0,13 giây lên gối (đốt cháy/chất độc/đồng đội)
   * thì đòn bỏ qua lặng lẽ như một nhát chém hụt — không đòn ma.
   */
  function executeBasicHit(m) {
    if (!m || m.state === 'dead' || m.hp <= 0) return;
    // Đợt K1: thông số đòn thường đọc từ registry (id 'basic'); ratio 1.0 nên
    // số học giữ nguyên bản live từng ly.
    var basicDef = skillsAPI ? skillsAPI.getSkill('basic') : null;
    var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { attack: 10, critRate: 5 };
    var raw = (10 + (stats.attack - 10)) * (basicDef && basicDef.damage ? basicDef.damage.ratio : 1);
    // Đợt K2: đòn thường cũng là một nhịp của Tương Sinh Liên Hoàn — bước
    // chuỗi TRƯỚC khi tính sát thương để hệ số khắc dùng đúng hệ vừa
    // chuyển, uy lực nhân hệ số tầng TRƯỚC bạo kích (cùng một luật với
    // chiêu ở releaseSkill: hệ của đòn = hệ đã chuyển).
    var conv = advanceLienHoan();
    var elemFac = combatAPI ? combatAPI.getElementFactor(conv ? conv.elem : 'neutral', m.element) : 1.0;
    var dealt = combatAPI ? combatAPI.calcDamage(raw, elemFac, m.armor) : raw;
    if (conv) {
      dealt = dealt * conv.mult;
      spawnLienHoanFeedback(conv);
    }
    var isCrit = combatAPI ? combatAPI.rollCrit((stats.critRate || 5) / 100) : false;
    if (isCrit) dealt *= 1.5;

    if (audioAPI) audioAPI.playSlash();

    // Vệt chém cong thon hai đầu hướng về phía quái (nguyên thủy crescent của K1)
    spawnSlashCrescent(player.x, player.y - 25, m.x, m.y - 20, conv ? conv.elem : 'neutral', basicDef ? basicDef.tier : 1);
    // Đợt SWINGFIX: vệt kiếm dọc đúng đường lưỡi vừa quét, tâm tại điểm nắm
    if (basicSwing && basicSwing.armed) spawnSwordArc(conv ? conv.elem : 'neutral');

    monstersAPI.damageMonster(m, dealt, player);
    spawnDamageNumber(m.x, m.y - 35, Math.round(dealt), conv ? conv.elem : 'moc', isCrit);

    if (m.hp <= 0) {
      handleMonsterDeath(m);
    } else if (conv && conv.completedCycle) {
      applyLienHoanCycleBonus(basicDef, m, dealt);
    }
  }

  function updateFieldMonsters(dt) {
    var playerPos = { x: player.x, y: player.y };

    for (var i = 0; i < fieldMonsters.length; i++) {
      var m = fieldMonsters[i];

      // Xử lý quái đã chết -> đếm thời gian hồi sinh (Brief §4: thường 60s, elite 600s)
      if (m.state === 'dead') {
        var spec = monstersAPI.SPECIES[m.speciesId];
        var respawnTotal = spec.respawnTime || 60;
        if (m.deathTimer >= respawnTotal) {
          // Hồi sinh lại tại nhà
          m.hp = m.maxHp;
          m.x = m.homeX;
          m.y = m.homeY;
          m.state = 'roam';
          m.deathTimer = 0;
          m.spawnGraceTimer = 2.0; // 2s ân hạn hồi sinh
          m.summonedAdds = false;
          // Đợt K2: hồi sinh sạch trạng thái khống chế/đốt của kiếp trước
          m.slowTimer = 0; m.slowRatio = 0;
          m.dotTimer = 0; m.dotDps = 0; m.dotAcc = 0;
        } else {
          m.deathTimer += dt;
        }
        continue;
      }

      // Kỹ năng tinh anh: triệu hồi 2 Thảo Tinh ở mốc 50% HP (Brief §4)
      if (m.isElite && m.hp <= m.maxHp * 0.5 && !m.summonedAdds) {
        m.summonedAdds = true;
        spawnEliteAdds(m);
      }

      // Cập nhật máy trạng thái quái vật
      if (m.skillAnimTimer > 0) {
        m.skillAnimTimer = Math.max(0, m.skillAnimTimer - dt);
      }
      monstersAPI.updateMonster(m, playerPos, dt, {
        onMonsterAttack: function (attacker) {
          handleMonsterAttackPlayer(attacker);
        }
      });

      // Đợt K2: hiệu ứng đốt trừ máu theo nhịp tích lũy (không qua giáp —
      // giá trị đã chốt từ đòn gây đốt); đốt kết liễu thì tính là hạ quái
      // như một đòn thường, qua đúng handleMonsterDeath.
      if (m.dotTimer > 0 && m.dotDps > 0 && m.state !== 'dead' && m.hp > 0) {
        m.dotAcc = (m.dotAcc || 0) + m.dotDps * dt;
        if (m.dotAcc >= 1) {
          var tickDmg = Math.floor(m.dotAcc);
          m.dotAcc -= tickDmg;
          m.hp -= tickDmg;
          spawnDamageNumber(m.x, m.y - 46, tickDmg, m.dotElem || 'hoa', false);
          if (m.hp <= 0) {
            m.state = 'dead';
            m.deathTimer = 0;
            m.animRow = 4;
            handleMonsterDeath(m);
          }
        }
      }

      // Nếu quái tung kỹ năng Rễ Trói (Telegraph r=90, 1.2s nổ, 12 dmg + snare 1.5s)
      if (m.activeTelegraph) {
        var tg = m.activeTelegraph;
        var elemColors = { moc: '#8be26b', thuy: '#7fd4ff', hoa: '#ff9a5c', tho: '#e8c56b', kim: '#e8ecf2' };
        visualEffects.push({
          type: 'telegraph_re_troi',
          x: tg.x,
          y: tg.y,
          radius: tg.radius,
          timer: tg.timer,
          duration: tg.timer,
          damage: tg.damage,
          snareDuration: tg.snareDuration,
          slowRatio: tg.slowRatio || 0,
          slowDuration: tg.slowDuration || 0,
          color: tg.isBossSkill ? (elemColors[tg.element] || '#c9a0ff') : null
        });
        // Boss diễn hoạt ảnh tung chiêu song song với telegraph
        if (tg.isBossSkill) {
          m.skillAnimTimer = 0.85;
        }
        m.activeTelegraph = null;
      }
    }

    // Đợt 3: tách quái chồng nhau — mỗi con giữ khoảng cách tối thiểu 30px
    // (trước đây cả bầy dồn đúng một điểm quanh người chơi, không đọc được từng con)
    for (var si = 0; si < fieldMonsters.length; si++) {
      var sa = fieldMonsters[si];
      if (sa.state === 'dead' || sa.hp <= 0) continue;
      for (var sj = si + 1; sj < fieldMonsters.length; sj++) {
        var sb = fieldMonsters[sj];
        if (sb.state === 'dead' || sb.hp <= 0) continue;
        var sdx = sb.x - sa.x, sdy = sb.y - sa.y;
        var sd = Math.hypot(sdx, sdy);
        var minD = (sa.isElite || sb.isElite) ? 90 : 32;
        if (sd > 0.01 && sd < minD) {
          var push = (minD - sd) / 2;
          var ux = sdx / sd, uy = sdy / sd;
          sa.x -= ux * push; sa.y -= uy * push;
          sb.x += ux * push; sb.y += uy * push;
        } else if (sd <= 0.01) {
          sb.x += 16; sb.y += 8;
        }
      }
    }
  }

  function spawnEliteAdds(elite) {
    if (!monstersAPI) return;
    for (var i = 0; i < 2; i++) {
      var offset = (i === 0) ? -45 : 45;
      var add = monstersAPI.createMonster('thao_tinh', elite.x + offset, elite.y + 20, elite.homeX, elite.homeY, {
        state: 'aggro',
        spawnGraceTimer: 0
      });
      fieldMonsters.push(add);
    }
    spawnFloatingText('Triệu hồi Thảo Tinh!', elite.x, elite.y - 65, '#ffe9a8');
  }

  function handleMonsterAttackPlayer(m) {
    lastCombatTime = performance.now();
    var stats = stateAPI ? stateAPI.deriveStats(player.paths, player.equipment) : { defense: 5 };
    var elemFac = combatAPI ? combatAPI.getElementFactor(m.element, 'moc') : 1.0;
    var rawDmg = m.damage;
    var dealt = combatAPI ? combatAPI.calcDamage(rawDmg, elemFac, stats.defense) : rawDmg;

    // Bảo hộ 1 đòn (Brief §5 & Hồ sơ 49 §6): quái thường không gây quá 25% max HP người chơi
    if (!m.isElite && combatAPI) {
      dealt = combatAPI.applyOneHitProtection(dealt, player.hpMax);
    }

    player.hp = Math.max(0, player.hp - dealt);
    // Đợt K2: đòn nặng trúng giữa lúc vận chiêu thì ngắt chiêu (hồ sơ 52 §3)
    if (player.hp > 0) tryInterruptCast(dealt);
    if (audioAPI) audioAPI.playHit();
    triggerScreenShake(0.2, 5);

    // Làm chậm nếu trúng đòn Nhện Rừng Xanh
    if (m.slowOnHit) {
      playerSlowTimer = m.slowOnHit.duration;
      playerSlowRatio = m.slowOnHit.ratio;
    }

    spawnDamageNumber(player.x, player.y - 45, Math.round(dealt), 'player_damage', false);

    if (player.hp <= 0) {
      handlePlayerDeath();
    }
  }

  function handleMonsterDeath(m) {
    // 1. Tăng Chuỗi Săn (+1/kill, thời gian 20s)
    if (stateAPI) {
      stateAPI.incrementHuntChain(player);
    }

    // 2. Tích lũy Tu vi Mộc theo trần mềm ngày (65/ngày)
    var dateKey = new Date().toISOString().slice(0, 10);
    if (!player.daily) player.daily = {};
    if (!player.daily[dateKey]) player.daily[dateKey] = { farmTuVi: 0, farmLinhThach: 0 };
    var todayData = player.daily[dateKey];

    // Đợt 4A: tu vi cộng vào đường theo hệ của quái (trước đây khóa cứng đường Mộc)
    var tuViElem = m.tuViElement || 'moc';
    var rawTuVi = (m.tuViAmount !== undefined && m.tuViAmount !== null) ? m.tuViAmount : (m.tuViMoc || 2);
    var gainedTuVi = stateAPI ? stateAPI.calcTuViGain(todayData.farmTuVi, rawTuVi) : rawTuVi;
    if (!player.paths[tuViElem]) player.paths[tuViElem] = { tuVi: 0 };
    // Đợt T1: TRẦN TU VI THEO MỐC — tu vi săn được không vượt trần của mốc
    // chưa đột phá (hồ sơ 02 §1/§3.3). Bể ngày 65 vẫn áp trước như cũ (D.2
    // giữ nguyên); trần mốc kẹp tiếp sau: đạt trần thì dừng tăng dù bể còn,
    // và bể ngày chỉ tính phần tu vi THỰC nhận. Tu vi sẵn có vượt trần (save
    // cũ) không bao giờ bị cắt — addTuViCapped chỉ không cộng thêm.
    var cappedAtMoc = false;
    if (stateAPI && stateAPI.addTuViCapped) {
      var beforeCap = gainedTuVi;
      gainedTuVi = stateAPI.addTuViCapped(player, tuViElem, gainedTuVi);
      cappedAtMoc = gainedTuVi < beforeCap;
    } else {
      player.paths[tuViElem].tuVi += gainedTuVi;
    }
    // REALMFIX: đồng bộ nhãn cảnh giới ngay khi tu vi đổi (trước đây nhãn
    // chỉ đổi ở savePlayer/loadPlayer — hạ quái không lưu ngay nên HUD
    // phải chờ; nay nhãn khớp hạng tại đúng khoảnh khắc cộng tu vi)
    if (stateAPI && stateAPI.syncRealmLabel) stateAPI.syncRealmLabel(player);
    todayData.farmTuVi += gainedTuVi;

    if (player.farmSession) {
      player.farmSession.kills++;
      player.farmSession.tuViMoc += gainedTuVi;
    }

    var tuViNames = { moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ', kim: 'Kim' };
    var tuViColors = { moc: '#55d882', thuy: '#7fd4ff', hoa: '#ff9a5c', tho: '#e8c56b', kim: '#e8ecf2' };
    if (cappedAtMoc && gainedTuVi <= 0) {
      spawnFloatingText('Tu vi ' + (tuViNames[tuViElem] || 'Mộc') + ' đã đầy trần mốc — hãy Đột Phá Tiểu Mốc!', m.x, m.y - 25, '#ffd76a');
    } else {
      spawnFloatingText('+' + gainedTuVi + ' Tu vi ' + (tuViNames[tuViElem] || 'Mộc'), m.x, m.y - 25, tuViColors[tuViElem] || '#55d882');
    }

    // Đợt T1: hạ quái TINH ANH trong lúc ở tầng 6 = hoàn thành tiểu bình cảnh
    // của mốc 6->7 (hồ sơ 06 — điều kiện phụ lên tầng 7).
    if (m.isElite && typeof window !== 'undefined' && window.GameTieuMoc && window.GameTieuMoc.noteEliteKill) {
      window.GameTieuMoc.noteEliteKill(player);
    }

    // 3. Tiến độ nhiệm vụ (Săn 5 Thảo Tinh ở Rừng Độc)
    if (player.quests && player.quests.talked_linhnhi && !player.quests.huntCompleted && m.mapId === 'rung-doc') {
      if (m.speciesId === 'thao_tinh') {
        player.quests.thaotinhKills = (player.quests.thaotinhKills || 0) + 1;
        if (player.quests.thaotinhKills >= 5) {
          player.quests.huntCompleted = true;
          // Thưởng 10 Linh Thạch nhiệm vụ (không tính vào trần farm)
          player.linhThach = (player.linhThach || 0) + 10;
          if (audioAPI) audioAPI.playChime();
          if (typeof window !== 'undefined' && window.GameUI) {
            window.GameUI.showToast('Nhiệm vụ hoàn thành! Nhận 10 Linh Thạch thưởng.');
          }
        }
      }
    }

    // Bộ đếm quái cho chuỗi nhiệm vụ chính (Đợt 6 - Việc 1)
    if (player.quests) {
      if (m.speciesId === 'nhen_xanh') {
        player.quests.nhenKills = (player.quests.nhenKills || 0) + 1;
      }
      if (m.speciesId === 'han_xa' || m.speciesId === 'bang_xa') {
        player.quests.bangXaKills = (player.quests.bangXaKills || 0) + 1;
      }
    }

    // Thống kê cá nhân (Đợt 6 - mục 15, hồ sơ 29 mục 5)
    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.kills = (player.stats.kills || 0) + 1;
    if (m.isBoss) player.stats.bossKills = (player.stats.bossKills || 0) + 1;

    // 4. Rớt chiến lợi phẩm (Brief §6)
    var chainCount = (player.huntChain && player.huntChain.count) || 0;
    var drops = monstersAPI.rollDrops(m.speciesId, chainCount);
    var nowSec = performance.now() / 1000;

    for (var d = 0; d < drops.length; d++) {
      var dropItem = drops[d];
      var dropX = m.x + (Math.random() - 0.5) * 36;
      var dropY = m.y + (Math.random() - 0.5) * 24;

      groundDrops.push({
        itemId: dropItem.itemId,
        count: dropItem.count,
        x: dropX,
        y: dropY,
        spawnTime: nowSec,
        ownerUntil: nowSec + 30.0, // Khóa chủ nhân 30s
        despawnTime: nowSec + 60.0  // Biến mất sau 60s
      });
    }

    if (targetMonster === m) {
      targetMonster = null;
    }
  }

  function handlePlayerDeath() {
    player.hp = 0;
    if (stateAPI) {
      stateAPI.breakHuntChain(player);
    }
    if (audioAPI) audioAPI.playDeathGong();
    if (typeof window !== 'undefined' && window.GameUI) {
      window.GameUI.showDeathModal(player.revivalPool);
    }
  }

  function handleRevive(type) {
    autoPath.active = false; // Hồi sinh -> dừng tự tìm đường
    if (type === 'spot') {
      if (stateAPI && stateAPI.revivePlayer(player, 'spot')) {
        // Đẩy lùi quái gần điểm chết về trạng thái roam/nhà
        for (var i = 0; i < fieldMonsters.length; i++) {
          var m = fieldMonsters[i];
          if (Math.hypot(m.x - player.x, m.y - player.y) < 300) {
            m.state = 'return';
          }
        }
        if (typeof window !== 'undefined' && window.GameUI) {
          window.GameUI.hideDeathModal();
          window.GameUI.showToast('Đã hồi sinh tại chỗ');
        }
      }
    } else {
      // Về Miếu Hoang: miễn phí, chuyển map về Miếu
      if (stateAPI) {
        stateAPI.revivePlayer(player, 'home');
      }
      if (typeof window !== 'undefined' && window.GameUI) {
        window.GameUI.hideDeathModal();
      }
      var templeSpawn = { x: 560, y: 620 };
      switchMap('mieu_hoang', templeSpawn);
    }
  }

  function updateGroundDrops(dt) {
    var nowSec = performance.now() / 1000;
    var dateKey = new Date().toISOString().slice(0, 10);
    if (!player.daily) player.daily = {};
    if (!player.daily[dateKey]) player.daily[dateKey] = { farmTuVi: 0, farmLinhThach: 0 };
    var todayData = player.daily[dateKey];

    for (var i = groundDrops.length - 1; i >= 0; i--) {
      var drop = groundDrops[i];

      // Hết hạn biến mất
      if (nowSec >= drop.despawnTime) {
        groundDrops.splice(i, 1);
        continue;
      }

      // Người chơi bước qua để nhặt (khoảng cách <= 26px, hoặc <= 72px nếu bật Tự Nhặt Đồ)
      var curSettings = stateAPI ? stateAPI.loadSettings() : null;
      var maxPickupDist = (curSettings && curSettings.autoPickup === true) ? 72 : 26;
      var dist = Math.hypot(player.x - drop.x, player.y - drop.y);
      var canCollect = dist <= 26;
      if (!canCollect && dist <= maxPickupDist) {
        // Đợt 6 (mục 15, hồ sơ 25): tự nhặt chỉ áp cho vật phẩm từ phẩm đã chọn trở lên
        var minRank = (curSettings && curSettings.autoPickupRank) ? Number(curSettings.autoPickupRank) : 1;
        var dropDef = monstersAPI && monstersAPI.ITEM_DEFS ? monstersAPI.ITEM_DEFS[drop.itemId] : null;
        var rankMap = { common: 1, good: 2, rare: 3, epic: 4, legend: 5 };
        var dropRank = dropDef ? (rankMap[dropDef.quality] || 1) : 1;
        canCollect = dropRank >= minRank;
      }
      if (canCollect) {
        collectDropAtIndex(i, todayData);
      }
    }
  }

  function updateProjectiles(dt) {
    for (var i = projectiles.length - 1; i >= 0; i--) {
      var p = projectiles[i];
      if (!p.target || p.target.state === 'dead') {
        projectiles.splice(i, 1);
        continue;
      }

      var dx = p.target.x - p.x;
      var dy = (p.target.y - 25) - p.y;
      var dist = Math.hypot(dx, dy);
      var moveStep = p.speed * dt;

      if (dist <= moveStep) {
        // Đạn chạm đích: giải quyết qua cùng đường resolveSkillHit như chiêu tức thì
        var def = p.skillId && skillsAPI ? skillsAPI.getSkill(p.skillId) : null;
        if (def) {
          var dealtP = resolveSkillHit(def, p.target, p.raw, p.element);
          // Đợt K2: đạn mang cờ hoàn vòng Liên Hoàn từ lúc phát chiêu
          if (p.cycleBonus) applyLienHoanCycleBonus(def, p.target, dealtP);
        } else {
          var elemFac = combatAPI ? combatAPI.getElementFactor(p.element, p.target.element) : 1.0;
          var dealt = combatAPI ? combatAPI.calcDamage(p.raw, elemFac, p.target.armor) : p.raw;
          var isCrit = combatAPI ? combatAPI.rollCrit(0.05) : false;
          if (isCrit) dealt *= 1.5;
          monstersAPI.damageMonster(p.target, dealt, player);
          spawnDamageNumber(p.target.x, p.target.y - 40, Math.round(dealt), p.element, isCrit);
          if (p.target.hp <= 0) {
            handleMonsterDeath(p.target);
          }
        }
        projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * moveStep;
        p.y += (dy / dist) * moveStep;
        // Ghi vệt đuôi: giữ tối đa 14 điểm vị trí gần nhất cho renderer vẽ dải mờ dần
        if (p.trail) {
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 14) p.trail.shift();
        }
      }
    }
  }

  function updateVisualEffects(dt) {
    for (var i = visualEffects.length - 1; i >= 0; i--) {
      var vfx = visualEffects[i];
      vfx.timer -= dt;

      // Đợt K1: cập nhật vật lý cho các nguyên thủy VFX mới
      if (vfx.kind === 'burst' && vfx.particles) {
        for (var bp = 0; bp < vfx.particles.length; bp++) {
          var pt = vfx.particles[bp];
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          var dragF = Math.max(0, 1 - (pt.drag || 3) * dt);
          pt.vx *= dragF;
          pt.vy = pt.vy * dragF + 30 * dt; // hạt hơi rơi xuống
        }
      } else if (vfx.kind === 'gather' && vfx.followPlayer && player) {
        vfx.x = player.x;
        vfx.y = player.y - 30;
      } else if (vfx.kind === 'rain') {
        // Mưa đạn theo nhịp: duy trì ~14 giọt trong bán kính, rơi nhanh, chạm đất thì tái sinh trên cao
        if (!vfx.drops) vfx.drops = [];
        var targetDrops = 14;
        while (vfx.drops.length < targetDrops) {
          var ang = Math.random() * Math.PI * 2;
          var rr = Math.sqrt(Math.random()) * (vfx.radius || 50);
          vfx.drops.push({
            x: vfx.x + Math.cos(ang) * rr,
            y: vfx.y - 70 - Math.random() * 50,
            groundY: vfx.y + Math.sin(ang) * rr * 0.42,
            vy: 330 + Math.random() * 120
          });
        }
        for (var rd = vfx.drops.length - 1; rd >= 0; rd--) {
          var dr = vfx.drops[rd];
          dr.y += dr.vy * dt;
          if (dr.y >= dr.groundY) vfx.drops.splice(rd, 1);
        }
      }

      // Xử lý nổ kỹ năng Rễ Trói khi hết 1.2s telegraph
      if (vfx.type === 'telegraph_re_troi' && vfx.timer <= 0) {
        var distToPlayer = Math.hypot(player.x - vfx.x, player.y - vfx.y);
        if (distToPlayer <= vfx.radius) {
          player.hp = Math.max(0, player.hp - vfx.damage);
          // Đợt K2: nổ trấn vùng của boss cũng là đòn nặng — ngắt vận chiêu
          if (player.hp > 0) tryInterruptCast(vfx.damage);
          playerSnareTimer = vfx.snareDuration;
          if (vfx.slowRatio && vfx.slowDuration) {
            playerSlowTimer = Math.max(playerSlowTimer, vfx.slowDuration);
            playerSlowRatio = vfx.slowRatio;
          }
          spawnDamageNumber(player.x, player.y - 45, vfx.damage, 'player_damage', false);
          if (audioAPI) audioAPI.playHit();
          if (player.hp <= 0) handlePlayerDeath();
        }
      }

      if (vfx.timer <= 0) {
        visualEffects.splice(i, 1);
      }
    }
  }

  function updateFloatingTexts(dt) {
    for (var i = floatingTexts.length - 1; i >= 0; i--) {
      var ft = floatingTexts[i];
      ft.y -= 30 * dt;
      ft.timer -= dt;
      if (ft.timer <= 0) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  function spawnDamageNumber(x, y, amount, type, isCrit) {
    var curSettings = stateAPI ? stateAPI.loadSettings() : null;
    if (curSettings && curSettings.showDamageNumbers === false) return;
    floatingTexts.push({
      text: '-' + amount,
      x: x + (Math.random() - 0.5) * 16,
      y: y,
      type: type,
      isCrit: !!isCrit,
      timer: 0.9,
      duration: 0.9
    });
  }

  function spawnFloatingText(text, x, y, color) {
    floatingTexts.push({
      text: text,
      x: x,
      y: y,
      customColor: color,
      timer: 1.1,
      duration: 1.1
    });
  }

  var currentZoneId = null;
  function updateZone() {
    if (!player || !mapData || !mapData.zones || mapData.zones.length === 0) {
      currentZoneId = null;
      return;
    }
    var foundZone = null;
    for (var i = 0; i < mapData.zones.length; i++) {
      var z = mapData.zones[i];
      if (z.rect &&
          player.x >= z.rect.x && player.x <= z.rect.x + z.rect.w &&
          player.y >= z.rect.y && player.y <= z.rect.y + z.rect.h) {
        foundZone = z;
        break;
      }
    }
    if (foundZone) {
      if (foundZone.id !== currentZoneId) {
        currentZoneId = foundZone.id;
        if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showZoneTitle) {
          window.GameUI.showZoneTitle(foundZone.name, foundZone.desc);
        }
      }
    } else {
      currentZoneId = null;
    }
  }

  function getCurrentZone() {
    if (!player || !mapData || !mapData.zones) return null;
    for (var i = 0; i < mapData.zones.length; i++) {
      var z = mapData.zones[i];
      if (z.rect &&
          player.x >= z.rect.x && player.x <= z.rect.x + z.rect.w &&
          player.y >= z.rect.y && player.y <= z.rect.y + z.rect.h) {
        return z;
      }
    }
    return null;
  }

  var screenShakeTimer = 0;
  var screenShakeIntensity = 0;

  function triggerScreenShake(duration, intensity) {
    var s = stateAPI ? stateAPI.loadSettings() : null;
    if (s && s.screenShake === false) return;
    screenShakeTimer = duration || 0.2;
    screenShakeIntensity = intensity || 5;
  }

  function updateCamera() {
    if (!player || !mapData) return;

    var targetCamX = player.x - camera.viewportW / 2;
    var targetCamY = player.y - camera.viewportH / 2;

    if (camera.viewportW >= mapData.width) {
      camera.x = (mapData.width - camera.viewportW) / 2;
    } else {
      camera.x = Math.max(0, Math.min(mapData.width - camera.viewportW, targetCamX));
    }

    if (camera.viewportH >= mapData.height) {
      camera.y = (mapData.height - camera.viewportH) / 2;
    } else {
      camera.y = Math.max(0, Math.min(mapData.height - camera.viewportH, targetCamY));
    }
  }

  function render() {
    if (!ctx || !canvas) return;

    // Đợt KIẾP VÂN vòng 2/3: độ nhấc vẽ của nhân vật trong pha kết độ
    // kiếp — tính MỘT lần cho cả khung (thân, nón, kiếm, hào quang dùng
    // chung một giá trị nên không lệch nhau); ngoài cảnh độ kiếp là 0.
    playerLiftY = computeTribulationLift();

    ctx.save();
    ctx.fillStyle = '#141a16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.scale(camera.scale, camera.scale);
    var renderCamX = camera.x;
    var renderCamY = camera.y;
    if (screenShakeTimer > 0) {
      renderCamX += (Math.random() - 0.5) * screenShakeIntensity;
      renderCamY += (Math.random() - 0.5) * screenShakeIntensity;
    }
    ctx.translate(-renderCamX, -renderCamY);

    // 1. Vẽ ảnh nền bản đồ hiện tại (Brief §2: 1920x1280)
    var bgImg = assets[mapData.bgImage] || (mapData.id === 'rung-doc' ? assets.map_rung_doc_bg : assets.map_bg);
    if (bgImg && bgImg.complete) {
      ctx.drawImage(bgImg, 0, 0, mapData.width, mapData.height);
    }

    // 2. Gợn sóng nhấp chuột
    if (clickRipple) {
      ctx.save();
      ctx.strokeStyle = 'rgba(233, 217, 168, ' + Math.max(0, clickRipple.alpha) + ')';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(clickRipple.x, clickRipple.y, clickRipple.radius * 1.3, clickRipple.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Vẽ hiệu ứng cảnh báo kỹ năng dưới đất (Telegraphs)
    for (var v = 0; v < visualEffects.length; v++) {
      var vfx = visualEffects[v];
      if (vfx.type === 'telegraph_re_troi' && getSettingsCached().showBossTelegraph !== false) {
        ctx.save();
        var progress = 1.0 - (vfx.timer / vfx.duration);
        ctx.strokeStyle = vfx.color ? vfx.color : 'rgba(180, 70, 220, 0.85)';
        ctx.lineWidth = 2.5;
        if (vfx.color) {
          ctx.save();
          ctx.globalAlpha = 0.15 + progress * 0.25;
          ctx.fillStyle = vfx.color;
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(140, 40, 180, ' + (0.15 + progress * 0.25) + ')';
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Vòng co lại báo thời điểm nổ
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, vfx.radius * (1.0 - progress), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3b. (Đợt K1) Hiệu ứng mặt đất của engine VFX mới: vòng phù văn, hình
    // motif hệ trên đất, vòng chấn động — vẽ cùng lớp đất như telegraph.
    renderGroundVfx();

    // 4. (Đợt 6) Chiến lợi phẩm được vẽ SAU lớp thực thể (bước 5b) để tán cây tiền cảnh
    // không nuốt mất đế sáng + nhãn tên — vật rơi phải luôn đọc được từ xa.

    // 4b. Vẽ các điểm thu hái (Harvest Nodes)
    if (mapData.harvestNodes) {
      var nowSecH = performance.now() / 1000;
      for (var h = 0; h < mapData.harvestNodes.length; h++) {
        var node = mapData.harvestNodes[h];
        var isReady = nowSecH >= (harvestReadyTimes[node.id] || 0);
        // Đợt 6 (Việc 3 — mục 4): luống linh điền vẽ riêng cho Vườn Linh Dược tông môn
        var isGardenPlot = (currentMapId === 'tong-mon');
        if (isGardenPlot) drawGardenPlot(node, isReady, nowSecH, h);
        if (isReady) {
          var bobH = Math.sin(nowSecH * 3 + h) * 3;
          // Note 8: 'thap' bỏ quầng sáng gradient của điểm hái (icon vẫn nhấp nhô như cũ)
          if (currentQuality !== 'thap') {
            ctx.save();
            var gradH = ctx.createRadialGradient(node.x, node.y - 12 + bobH, 2, node.x, node.y - 12 + bobH, 18);
            gradH.addColorStop(0, 'rgba(124, 232, 152, 0.45)');
            gradH.addColorStop(1, 'rgba(124, 232, 152, 0)');
            ctx.fillStyle = gradH;
            ctx.beginPath();
            ctx.arc(node.x, node.y - 12 + bobH, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          var iconImg = assets['assets/art/icons-sheet.png'] || assets.icons_sheet;
          if (iconImg && iconImg.complete) {
            var defH = (monstersAPI && monstersAPI.ITEM_DEFS) ? monstersAPI.ITEM_DEFS[node.itemId] : null;
            var colH = defH ? (defH.iconCol || 0) : 0;
            var rowH = defH ? (defH.iconRow || 0) : 0;
            ctx.drawImage(iconImg, colH * 32, rowH * 32, 32, 32, node.x - 12, node.y - 24 + bobH, 24, 24);
          }
        } else if (!isGardenPlot) {
          ctx.save();
          ctx.fillStyle = 'rgba(80, 140, 80, 0.35)';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // 5. Thu thập toàn bộ thực thể hiển thị và sắp xếp chiều sâu Painter's Algorithm
    var entities = [];

    // Standees
    if (mapData.standees) {
      for (var s = 0; s < mapData.standees.length; s++) {
        (function (std) {
          entities.push({
            type: 'standee',
            baseY: std.baseY,
            draw: function () {
              var sImg = assets[std.asset] || (std.id === 'fallen_log_1' ? assets.fallen_log : (std.id === 'broadleaf_1' || std.id === 'broadleaf_2' || std.id === 'broadleaf_3' ? assets.broadleaf_tree : assets[std.id]));
              if (std.trunk) {
                ctx.save();
                ctx.fillStyle = 'rgba(10, 15, 10, 0.35)';
                ctx.beginPath();
                ctx.ellipse(std.trunk.x, std.trunk.y + 4, std.trunk.r * 2.0, std.trunk.r * 1.0, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
              if (sImg && sImg.complete) {
                ctx.drawImage(sImg, std.x, std.y, std.w, std.h);
              }
            }
          });
        })(mapData.standees[s]);
      }
    }

    // NPCs
    if (mapData.npcs) {
      for (var n = 0; n < mapData.npcs.length; n++) {
        (function (npc) {
          if (!isNpcActive(npc)) return;
          entities.push({
            type: 'npc',
            baseY: npc.baseY || npc.feetY,
            draw: function () {
              ctx.save();
              ctx.fillStyle = 'rgba(10, 15, 10, 0.4)';
              ctx.beginPath();
              ctx.ellipse(npc.feetX, npc.feetY, (npc.w / 2) * 0.75, 8, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();

              var nImg = assets[npc.asset] || (npc.id === 'npc_linhnhi' ? assets.linhnhi : null);
              if (nImg && nImg.complete) {
                // NPCFIX 2026-11-09 "NPC đứng bị vỡ hình": bề rộng vẽ suy từ tỉ lệ của
                // chính bitmap ĐÃ NẠP (naturalWidth/naturalHeight), neo tâm tại feetX,
                // đáy giữ nguyên feetY. GitHub Pages phát Cache-Control max-age=600:
                // sau mỗi đợt deploy đổi khổ ảnh, máy người chơi có thể còn giữ ảnh
                // phiên bản cũ khác tỉ lệ với mapdata mới trong cửa sổ cache — vẽ ép
                // vào hộp (w,h) của dữ liệu sẽ bóp NPC tới 31% (đợt 6B). Vẽ theo tỉ
                // lệ bitmap thật thì mọi cặp (dữ liệu, ảnh) đều đúng hình.
                var npcDrawW = npc.w;
                var npcDrawX = npc.x;
                if (nImg.naturalWidth > 0 && nImg.naturalHeight > 0) {
                  npcDrawW = npc.h * nImg.naturalWidth / nImg.naturalHeight;
                  npcDrawX = (typeof npc.feetX === 'number' ? npc.feetX : npc.x + npc.w / 2) - npcDrawW / 2;
                }
                ctx.drawImage(nImg, npcDrawX, npc.y, npcDrawW, npc.h);
              }

              var qTarget = getQuestTargetInfo();
              if (qTarget && qTarget.kind === 'npc' && qTarget.npcId === npc.id) {
                var bobN = Math.sin(performance.now() / 250) * 4;
                drawQuestExclamation(npc.feetX, npc.y - 18 + bobN);
              }

              var dPlayer = Math.hypot(player.x - npc.feetX, player.y - npc.feetY);
              if (dPlayer <= INTERACTION_RANGE || isPlayerInNpcRange(npc)) {
                drawHintChip(npc.feetX, npc.y - 6, 'Nói chuyện');
              }
            }
          });
        })(mapData.npcs[n]);
      }
    }

    // Quái vật
    for (var mIdx = 0; mIdx < fieldMonsters.length; mIdx++) {
      (function (monster) {
        if (monster.state === 'dead') return;
        entities.push({
          type: 'monster',
          baseY: monster.y,
          draw: function () {
            drawMonster(monster);
          }
        });
      })(fieldMonsters[mIdx]);
    }

    // Người chơi Hà Nhân
    entities.push({
      type: 'player',
      baseY: player.y,
      draw: function () {
        // Đợt KIẾP VÂN vòng 2/3: bóng chân Ở LẠI mặt đất khi nhân vật bay
        // lên (pha kết độ kiếp) — nhỏ lại và mờ dần theo tỉ lệ độ cao,
        // đúng luật bóng theo độ cao; thân vẽ nhấc lên ở các neo dưới.
        var liftR = Math.max(0, Math.min(1, playerLiftY / TRIB_LIFT_H));
        ctx.save();
        ctx.fillStyle = 'rgba(10, 15, 10, ' + (0.45 * (1 - 0.5 * liftR)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(player.x, player.y, 22 * (1 - 0.4 * liftR), 9 * (1 - 0.4 * liftR), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        var isHat = player && player.equipment && player.equipment.head === 'non-la' && getSettingsCached().hideHat !== true;
        var hatWalk = assets.hanhan_hat_walk;
        var hatIdle = assets.hanhan_hat_idle;

        // Đợt K2: đang diễn khung tung chiêu riêng (Thái Cực Chưởng) thì
        // hình nhân vật lấy từ atlas của chiêu: ô 256×256 neo bằng pivot
        // của gói khung [128, 238], chân bám đúng điểm chân nhân vật;
        // lớp nón trang bị không phủ thêm (khung chiêu đã là hình trọn).
        var tcSheet = assets.thaicuc_atlas;
        if (skillCastAnim && tcSheet && tcSheet.complete && tcSheet.naturalWidth >= 2048) {
          var tcCa = skillCastAnim.def.castAnim;
          var tcScale = (tcCa.displayH || 192) / tcCa.frameH;
          var tcProg = 1 - (skillCastAnim.timer / skillCastAnim.duration);
          var tcFrame = Math.min(skillCastAnim.frames - 1, Math.floor(tcProg * skillCastAnim.frames));
          ctx.drawImage(
            tcSheet,
            tcFrame * tcCa.frameW, skillCastAnim.row * tcCa.frameH, tcCa.frameW, tcCa.frameH,
            player.x - tcCa.pivotX * tcScale, player.y - playerLiftY - tcCa.pivotY * tcScale,
            tcCa.frameW * tcScale, tcCa.frameH * tcScale
          );
          return;
        }

        // Đợt CHARINTEG: ưu tiên bộ sinh hình đã duyệt — đang đi thì diễn
        // Walk chọn khung theo quãng đường đã đi (chân khớp đất như luật
        // đợt 3), đứng yên thì diễn Idle theo nhịp fps của gói khung. Bộ
        // chưa sẵn sàng (thiếu JSON, atlas chưa nạp hoặc sai khổ) thì lùi
        // nguyên về đường sheet cũ ở dưới.
        // Đợt HATLAYER: khi đang trang bị nón (đúng điều kiện isHat của
        // đường cũ) thì phủ thêm lớp nón của bộ sinh hình ngay trên khung
        // vừa vẽ; chưa trang bị thì đầu trần như thiết kế gốc.
        var genDirName = HH_GEN_DIRS[(player.dir || 0) % 8];
        var genDrawn = false;
        var genFrameObj = null;
        if (playerMoving) {
          var genWalkFrames = hanhanGenData.walk && hanhanGenData.walk.dirs[genDirName];
          var genWalkCount = genWalkFrames ? genWalkFrames.length : 8;
          var genWalkFrame = Math.floor(walkDist / WALK_CYCLE_DIST * genWalkCount) % genWalkCount;
          genFrameObj = drawGenFrame(assets.hanhan_gen_walk, hanhanGenData.walk, genDirName, genWalkFrame);
          genDrawn = !!genFrameObj;
          if (genDrawn && isHat) {
            drawGenHat(assets.hanhan_gen_hat, 'walk', genDirName, genWalkFrame, genFrameObj, hanhanGenData.walk);
          }
        } else {
          var genIdleFrames = hanhanGenData.idle && hanhanGenData.idle.dirs[genDirName];
          var genIdleFps = (genIdleFrames && genIdleFrames[0] && genIdleFrames[0].fps) || 6;
          var genIdleFrame = Math.floor(performance.now() / 1000 * genIdleFps);
          genFrameObj = drawGenFrame(assets.hanhan_gen_idle, hanhanGenData.idle, genDirName, genIdleFrame);
          genDrawn = !!genFrameObj;
          if (genDrawn && isHat) {
            drawGenHat(assets.hanhan_gen_hat, 'idle', genDirName, genIdleFrame, genFrameObj, hanhanGenData.idle);
          }
        }

        // Đợt JOYFIX: kiếm trang bị cầm tay trên bộ sinh hình (vẽ ngay sau thân)
        // Đợt GRIPFIX: truyền kèm khung đang vẽ để kiếm bám nắm tay đo thật
        // của đúng khung đó + vá nắm tay phủ lên chuôi sau khi vẽ kiếm.
        if (genDrawn) {
          drawHeldWeapon(genFrameDest, genDirName,
            playerMoving ? HH_HAND_GEN_WALK : HH_HAND_GEN_IDLE,
            playerMoving
              ? { mode: 'walk', frameIdx: genWalkFrame, img: assets.hanhan_gen_walk, f: genFrameObj }
              : { mode: 'idle', frameIdx: genIdleFrame, img: assets.hanhan_gen_idle, f: genFrameObj });
        }

        var walkSheet = assets.hanhan_walk;
        if (!genDrawn && playerMoving && walkSheet && walkSheet.complete && walkSheet.naturalWidth >= 768) {
          // Đợt 3 (Note 6): khung hình suy từ quãng đường đã đi — chân khớp mặt đất, không trượt theo thời gian
          var sheetCols = Math.max(1, Math.round(walkSheet.naturalWidth / 96));
          var wFrame = Math.floor(walkDist / WALK_CYCLE_DIST * sheetCols) % sheetCols;
          var wFrameY = (player.dir || 0) * 120;
          ctx.drawImage(
            walkSheet,
            wFrame * 96, wFrameY, 96, 120,
            player.x - 48, player.y - playerLiftY - 118, 96, 120
          );
          if (isHat && hatWalk && hatWalk.complete && hatWalk.naturalWidth > 0) {
            var hatCols = Math.max(1, Math.round(hatWalk.naturalWidth / 96));
            var hFrame = Math.floor(walkDist / WALK_CYCLE_DIST * hatCols) % hatCols;
            ctx.drawImage(
              hatWalk,
              hFrame * 96, wFrameY, 96, 120,
              player.x - 48, player.y - playerLiftY - 118, 96, 120
            );
          }
          drawHeldWeapon({ x: player.x - 48, y: player.y - playerLiftY - 118, w: 96, h: 120 }, genDirName, HH_HAND_OLD);
        } else if (!genDrawn && assets.hanhan_idle && assets.hanhan_idle.complete) {
          var frameY = (player.dir || 0) * 120;
          ctx.drawImage(
            assets.hanhan_idle,
            0, frameY, 96, 120,
            player.x - 48, player.y - playerLiftY - 118, 96, 120
          );
          if (isHat && hatIdle && hatIdle.complete && hatIdle.naturalWidth > 0) {
            ctx.drawImage(
              hatIdle,
              0, frameY, 96, 120,
              player.x - 48, player.y - playerLiftY - 118, 96, 120
            );
          }
          drawHeldWeapon({ x: player.x - 48, y: player.y - playerLiftY - 118, w: 96, h: 120 }, genDirName, HH_HAND_OLD);
        }
      }
    });

    // Sắp xếp Painter's algorithm với tie-break < 4px: vẽ NPC/quái trước player (Brief §8 fix 3)
    entities.sort(function (a, b) {
      if (Math.abs(a.baseY - b.baseY) < 4) {
        if (a.type === 'player' && b.type !== 'player') return 1;
        if (b.type === 'player' && a.type !== 'player') return -1;
      }
      return a.baseY - b.baseY;
    });

    for (var e = 0; e < entities.length; e++) {
      entities[e].draw();
    }

    // 5b. Vẽ chiến lợi phẩm rớt dưới đất — sau lớp thực thể để luôn đọc được (Đợt 6, mục 3)
    for (var g = 0; g < groundDrops.length; g++) {
      drawGroundDrop(groundDrops[g]);
    }

    // 6. Vẽ đạn bay & hiệu ứng trên không (Projectiles & VFX)
    renderCombatVfx();

    // 7. Vẽ chữ sát thương nổi (Floating Numbers)
    renderFloatingTexts();
    renderTribulation(); // Đợt T2: mây kiếp + tia sét độ kiếp vẽ trên cùng lớp thế giới

    // 7b. Biển chỉ tên tại các điểm chuyển map (Đợt 3, Note 4)
    drawGateSigns();

    // 7c. Mũi tên chỉ xuống tại mọi lối vào / điểm chuyển map (Đợt 6 - Việc 1, mục 12)
    drawEntranceArrows();

    // 8. Mũi tên dẫn đường nhiệm vụ (Guidance Arrow)
    var settings = stateAPI ? stateAPI.loadSettings() : null;
    var showArrow = !settings || settings.arrowGuidance !== false;
    if (showArrow && player && player.quests) {
      var qInfo = getQuestTargetInfo();
      if (qInfo && qInfo.stepId !== 'done') {
        if (qInfo.mapId === currentMapId) {
          var destA = resolveQuestDestination(qInfo);
          if (destA) {
            drawGuidanceArrow(player.x, player.y, destA.x, destA.y);
          }
        } else {
          var exitHop = findGuidanceHop(currentMapId, qInfo.mapId);
          if (exitHop && exitHop.target) {
            drawGuidanceArrow(player.x, player.y, exitHop.target.x, exitHop.target.y);
          }
        }
      }
    }

    // 9. Chip thông báo lối thoát
    if (exitChip.timer > 0) {
      drawExitChip(player.x, player.y - 130, exitChip.text);
    }

    // 10. Màn đen chuyển cảnh (Fade)
    if (mapFade.alpha > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, ' + Math.min(1.0, mapFade.alpha) + ')';
      ctx.fillRect(camera.x, camera.y, camera.viewportW, camera.viewportH);
      ctx.restore();
    }

    ctx.restore();

    // 11. Bảng tên cổng cỡ lớn theo không gian màn hình (Đợt 3, Note 4)
    drawSignPlate();
  }

  function getNearestLivingThaoTinh() {
    var nearest = null;
    var minDist = 99999;
    for (var i = 0; i < fieldMonsters.length; i++) {
      var m = fieldMonsters[i];
      if (m.speciesId === 'thao_tinh' && m.state !== 'dead') {
        var d = Math.hypot(player.x - m.x, player.y - m.y);
        if (d < minDist) {
          minDist = d;
          nearest = m;
        }
      }
    }
    return nearest;
  }

  function drawMonster(m) {
    var spec = monstersAPI.SPECIES[m.speciesId];
    if (!spec) return;

    // Đợt 3 (Note: độ rõ của quái ở cỡ điện thoại): vũng sáng ấm sau lưng quái
    // giúp quái xanh tách khỏi nền lá xanh — nhận ra là SINH VẬT ngay, không cần thanh máu.
    // Note 8: chất lượng 'thap' bỏ gradient này (tốn GPU nhất) — quái vẫn có bóng + viền.
    if (currentQuality !== 'thap') {
      ctx.save();
      var poolR = m.isElite ? 120 : 62;
      var poolGrad = ctx.createRadialGradient(m.x, m.y - 20, 4, m.x, m.y - 20, poolR);
      poolGrad.addColorStop(0, m.isElite ? 'rgba(255, 225, 150, 0.34)' : 'rgba(255, 240, 190, 0.26)');
      poolGrad.addColorStop(1, 'rgba(255, 240, 190, 0)');
      ctx.fillStyle = poolGrad;
      ctx.beginPath();
      ctx.arc(m.x, m.y - 20, poolR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Vòng phát sáng ngũ hành cho quái tinh anh (Brief §4 & Hồ sơ 36/49)
    if (m.isElite) {
      ctx.save();
      ctx.strokeStyle = '#55d882';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#55d882';
      ctx.shadowBlur = qualityShadow(10);
      ctx.beginPath();
      var ringW = Math.max(75, Math.round(spec.cellW * (spec.drawScale || 1) * 0.38));
      var ringH = Math.max(26, Math.round(spec.cellW * (spec.drawScale || 1) * 0.12));
      ctx.ellipse(m.x, m.y, ringW, ringH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Bóng tiếp xúc dưới chân (Đợt 3: to và đậm hơn để đọc rõ ở cỡ điện thoại)
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 8, 0.52)';
    ctx.beginPath();
    // Đợt 4A: bóng tinh anh/boss tỉ lệ theo bề rộng sprite (boss ô 280 không còn bóng 70px)
    var shadowW = m.isElite ? Math.max(70, Math.round(spec.cellW * (spec.drawScale || 1) * 0.36)) : 31;
    var shadowH = m.isElite ? Math.max(22, Math.round(spec.cellW * (spec.drawScale || 1) * 0.11)) : 11;
    ctx.ellipse(m.x, m.y, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sprite quái vật từ sheet đã keyout
    // LƯU Ý (bài học Đợt 3): khóa nạp trước là thaotinh_sheet/nhenxanh_sheet/cothuye_sheet,
    // KHÔNG khớp speciesId + '_sheet' — từng làm sprite quái không bao giờ được vẽ.
    var sheetKey = m.speciesId + '_sheet';
    var sheet = assets[sheetKey];
    if (!sheet) {
      var aliasKey = { thao_tinh: 'thaotinh_sheet', nhen_xanh: 'nhenxanh_sheet', co_thu_yeu: 'cothuye_sheet' }[m.speciesId];
      if (aliasKey) sheet = assets[aliasKey];
    }
    if (sheet && sheet.complete) {
      var cellW = spec.cellW;
      var cellH = spec.cellH;
      var row = m.animRow || 0;
      var col = 0;

      // Tính khung hình hoạt ảnh theo hàng
      if (row === 0) col = Math.floor(m.animTime * 2.5) % 2; // Idle 2 frames
      else if (row === 1) col = Math.floor(m.animTime * 6.0) % 4; // Walk 4 frames
      else if (row === 2) col = Math.floor(m.animTime * 5.0) % 3; // Attack 3 frames
      else if (row === 3) col = Math.floor(m.animTime * 4.0) % 2; // Hit 2 frames
      else if (row === 4) col = Math.min(2, Math.floor(m.deathTimer * 3.0)); // Death 3 frames

      // Đợt 4A: đang diễn chiêu boss -> phát skill-sheet (1 hàng x 4 cột), không nhún thở
      var skillSheetImg = (m.skillAnimTimer > 0) ? assets[m.speciesId + '_skill_sheet'] : null;
      var inSkillAnim = !!(skillSheetImg && skillSheetImg.complete);
      if (inSkillAnim) {
        sheet = skillSheetImg;
        row = 0;
        col = Math.min(3, Math.floor((0.85 - Math.max(0, m.skillAnimTimer)) / 0.85 * 4));
      }

      // Đợt 3: biên độ nhún thở/idle phải đọc được ở cỡ điện thoại
      var bobY = 0;
      if (!inSkillAnim) {
        if (row === 0) bobY = Math.sin(m.animTime * 2.4 + (m.x % 7)) * (m.isElite ? 3.5 : 2.4);
        else if (row === 1) bobY = -Math.abs(Math.sin(m.animTime * 6.0)) * 2;
      }

      ctx.save();
      // Lật X nếu di chuyển sang trái
      if (m.facingLeft) {
        ctx.translate(m.x, m.y);
        ctx.scale(-1, 1);
        ctx.drawImage(
          sheet,
          col * cellW, row * cellH, cellW, cellH,
          -spec.feetOffsetX, -spec.feetOffsetY - bobY, cellW, cellH
        );
      } else {
        ctx.drawImage(
          sheet,
          col * cellW, row * cellH, cellW, cellH,
          m.x - spec.feetOffsetX, m.y - spec.feetOffsetY - bobY, cellW, cellH
        );
      }
      ctx.restore();

      // Đợt 3: tinh anh có bào tử sáng bay quanh — dấu hiệu "sinh vật" không lẫn với cây nền
      if (m.isElite && row !== 4) {
        ctx.save();
        for (var sp = 0; sp < 3; sp++) {
          var ang = m.animTime * 0.9 + sp * (Math.PI * 2 / 3);
          var spx = m.x + Math.cos(ang) * 58;
          var spy = m.y - 95 + Math.sin(ang * 1.7) * 16;
          ctx.fillStyle = 'rgba(150, 255, 170, 0.75)';
          ctx.beginPath();
          ctx.arc(spx, spy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Thanh máu trên đầu quái (Elite: thanh dài hơn + bảng tên)
    drawMonsterHpBar(m, spec);
  }

  function drawMonsterHpBar(m, spec) {
    var barW = m.isBoss ? 150 : (m.isElite ? 100 : 42);
    var barH = m.isElite ? 7 : 4;
    var topY = m.y - spec.feetOffsetY - (m.isElite ? 22 : 12);
    var leftX = m.x - barW / 2;

    // Tên quái tinh anh
    if (m.isElite) {
      ctx.save();
      ctx.font = 'bold 12px "Noto Serif", serif';
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = qualityShadow(4);
      ctx.fillText(m.name, m.x, topY - 5);
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(leftX - 1, topY - 1, barW + 2, barH + 2);

    var hpRatio = Math.max(0, m.hp / m.maxHp);
    ctx.fillStyle = m.isElite ? '#e8a53c' : '#e84545';
    ctx.fillRect(leftX, topY, barW * hpRatio, barH);
    ctx.restore();

    // Đợt 6 (mục 15, hồ sơ 28): hiện số máu chính xác khi bật
    if (getSettingsCached().showMonsterHpText === true) {
      ctx.save();
      ctx.font = 'bold 10px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = qualityShadow(3);
      ctx.fillText(Math.max(0, Math.ceil(m.hp)) + '/' + m.maxHp, m.x, topY - 3);
      ctx.restore();
    }

    // Đợt 6 (mục 15, hồ sơ 28): vòng tầm phát hiện của quái tinh anh/boss khi bật
    if ((m.isElite || m.isBoss) && getSettingsCached().showAggroRing === true) {
      var ringR = m.aggroRange || spec.aggroRange || 150;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 90, 90, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(m.x, m.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Đợt 6 (Việc 3 — mục 4): vẽ LUỐNG LINH ĐIỀN tại các nút hái Vườn Linh Dược (tong-mon).
   * Luống 124x88: gò đất nâu có rãnh + viền sáng hơn nền + bóng tiếp xúc.
   * Trạng thái: sẵn sàng = cụm linh thảo phát sáng + dấu ngọc nảy; đang mọc lại =
   * mầm theo tiến độ hồi (đất trơ / mầm hai lá / cây non) + vòng tiến độ.
   */
  function drawHerbCluster(cx, cy, scale, glow) {
    ctx.save();
    if (glow && currentQuality !== 'thap') {
      ctx.shadowColor = 'rgba(85, 216, 130, 0.9)';
      ctx.shadowBlur = qualityShadow(9);
    }
    ctx.strokeStyle = '#2f9e57';
    ctx.lineWidth = 2.2;
    ctx.fillStyle = '#55d882';
    for (var k = -2; k <= 2; k++) {
      var sx = cx + k * 9 * scale;
      var tx = cx + k * 12 * scale;
      var ty = cy - (16 - Math.abs(k) * 2.5) * scale;
      ctx.beginPath();
      ctx.moveTo(sx, cy + 8 * scale);
      ctx.quadraticCurveTo(sx + (tx - sx) * 0.4, cy - 4 * scale, tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(tx, ty, 5.2 * scale, 2.8 * scale, (k * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(tx - 4 * scale, ty + 4 * scale, 4 * scale, 2.2 * scale, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGardenPlot(node, isReady, nowSec, idx) {
    var cx = node.x;
    var cy = node.y;
    var x0 = cx - 62;
    var y0 = cy - 44;
    var flourish = getSettingsCached().flourishEffects !== false;

    ctx.save();
    // Bóng tiếp xúc
    ctx.fillStyle = 'rgba(8, 10, 6, 0.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 42, 68, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Gò đất + rãnh
    ctx.beginPath();
    ctx.roundRect(x0, y0, 124, 88, 9);
    ctx.fillStyle = '#5b4130';
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x0 + 6, y0 + 6, 112, 76, 7);
    ctx.fillStyle = '#684b33';
    ctx.fill();
    ctx.strokeStyle = 'rgba(43, 28, 15, 0.6)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (var f = -1; f <= 1; f++) {
      ctx.beginPath();
      ctx.moveTo(cx + f * 32, y0 + 14);
      ctx.lineTo(cx + f * 32, y0 + 74);
      ctx.stroke();
    }
    // Đốm đất tạo hạt (vị trí tất định theo chỉ số nút, không nhấp nháy giữa các khung)
    ctx.fillStyle = 'rgba(255, 230, 180, 0.10)';
    for (var sp = 0; sp < 14; sp++) {
      var spx = x0 + 12 + ((Math.sin(idx * 37.7 + sp * 91.3) * 0.5 + 0.5) * 100);
      var spy = y0 + 10 + ((Math.cos(idx * 21.9 + sp * 57.1) * 0.5 + 0.5) * 68);
      ctx.beginPath();
      ctx.arc(spx, spy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Viền luống sáng hơn nền
    ctx.beginPath();
    ctx.roundRect(x0, y0, 124, 88, 9);
    ctx.strokeStyle = '#9c8a66';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x0 + 3, y0 + 3, 118, 82, 7);
    ctx.strokeStyle = 'rgba(255, 233, 168, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    if (isReady) {
      drawHerbCluster(cx, cy + 6, 1, true);
      // Dấu hiệu trạng thái: viên ngọc nảy trên luống
      var bobM = flourish ? Math.sin(nowSec * 3 + idx) * 3.5 : 0;
      ctx.save();
      ctx.translate(cx, cy - 56 + bobM);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#7dffb0';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = 'rgba(125, 255, 176, 0.9)';
      ctx.shadowBlur = qualityShadow(8);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeRect(-6, -6, 12, 12);
      ctx.restore();
    } else {
      var readyAt = harvestReadyTimes[node.id] || 0;
      var respawn = node.respawnSec || 90;
      var prog = 1 - Math.max(0, (readyAt - nowSec)) / respawn;
      if (prog < 0) prog = 0;
      if (prog > 1) prog = 1;
      if (prog >= 0.66) drawHerbCluster(cx, cy + 6, 0.8, false);
      else if (prog >= 0.33) drawHerbCluster(cx, cy + 6, 0.45, false);
      // Vòng tiến độ hồi
      ctx.save();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
      ctx.beginPath();
      ctx.arc(cx, cy - 56, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(cx, cy - 56, 9, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Đợt 6 (Việc 2 — mục 3): màu đế vật rơi theo loại + phẩm chất
  var DROP_QUALITY_COLORS = {
    common: '#cfd8dc', good: '#7ed491', rare: '#b78bfa', epic: '#ffb74d', legend: '#ff8a65'
  };
  function drawGroundDrop(drop) {
    var def = monstersAPI.ITEM_DEFS[drop.itemId];
    var isCurrency = (drop.itemId === 'linh-thach');
    var flourish = getSettingsCached().flourishEffects !== false;
    var nowMs = performance.now();

    var plateColor = '#55d882';
    if (isCurrency) plateColor = '#ffd94d';
    else if (def && def.type === 'gear') plateColor = DROP_QUALITY_COLORS[def.quality] || '#cfd8dc';
    else if (def && def.type === 'consumable') plateColor = '#7fd4ff';
    else if (def && def.quality && def.type !== 'material') plateColor = DROP_QUALITY_COLORS[def.quality] || plateColor;

    var pulse = flourish ? (1 + Math.sin(nowMs / 320 + drop.x) * 0.08) : 1;

    ctx.save();
    // Đế sáng theo phẩm: quầng mềm + đĩa đặc + viền sáng
    ctx.shadowColor = plateColor;
    ctx.shadowBlur = qualityShadow(12);
    ctx.fillStyle = plateColor;
    ctx.globalAlpha = 0.26;
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 4, 21 * pulse, 9.5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 4, 14.5 * pulse, 6.5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = plateColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(drop.x, drop.y + 4, 15.5 * pulse, 7 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Icon thật 30x30 nổi trên đế
    var iconsImg = assets.icons_sheet;
    var bob = flourish ? Math.sin(nowMs / 300 + drop.x) * 3 : 0;
    if (iconsImg && iconsImg.complete && def) {
      var col = def.iconCol || 0;
      var row = def.iconRow || 0;
      ctx.drawImage(
        iconsImg,
        col * 32, row * 32, 32, 32,
        drop.x - 15, drop.y - 30 + bob, 30, 30
      );
    }

    // Nhãn tên khi người chơi ở gần (<= 150px) — đọc rõ ở 390px
    if (player && def && Math.hypot(player.x - drop.x, player.y - drop.y) <= 150) {
      var label = def.name || drop.itemId;
      if (drop.count && drop.count > 1) label += ' ×' + drop.count;
      ctx.font = 'bold 11px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = qualityShadow(4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      var labelY = drop.y - 36 + bob;
      ctx.strokeText(label, drop.x, labelY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, drop.x, labelY);
    }
    ctx.restore();
  }

  /**
   * Lớp mặt đất của engine VFX K1: runecircle (vòng phù văn + sao tương
   * sinh xoay), ground_motif (hình theo motif hệ), ring chạm đất.
   * Mọi thứ đều xoay/chuyển động theo thời gian sống — không hình tĩnh.
   */
  function renderGroundVfx() {
    var nowSec = performance.now() / 1000;
    for (var i = 0; i < visualEffects.length; i++) {
      var vfx = visualEffects[i];
      var lang = vfx.lang;
      if (!lang) continue;
      var progress = 1.0 - (vfx.timer / vfx.duration);
      var fadeIn = Math.min(1, progress / 0.18);
      var fadeOut = Math.min(1, vfx.timer / Math.min(0.3, vfx.duration * 0.4));
      var alpha = Math.max(0, Math.min(fadeIn, fadeOut));

      if (vfx.kind === 'runecircle') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = lang.glow;
        ctx.fillStyle = lang.core;
        ctx.shadowColor = lang.glow;
        ctx.shadowBlur = qualityShadow(6);
        var R = vfx.radius || 40;
        // Hai vòng tròn (ellipse theo phối cảnh đất)
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(vfx.x, vfx.y, R, R * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(vfx.x, vfx.y, R * 0.78, R * 0.78 * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
        // Vạch phù văn xoay quanh vòng ngoài
        var rot = nowSec * 0.9;
        ctx.lineWidth = 2;
        for (var t = 0; t < 10; t++) {
          var ta = rot + (t / 10) * Math.PI * 2;
          var x1 = vfx.x + Math.cos(ta) * R * 0.86, y1 = vfx.y + Math.sin(ta) * R * 0.86 * 0.42;
          var x2 = vfx.x + Math.cos(ta) * R * 0.97, y2 = vfx.y + Math.sin(ta) * R * 0.97 * 0.42;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
        // Sao tương sinh 5 cánh xoay ngược chiều trong lòng vòng
        var rot2 = -nowSec * 0.55;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (var sIdx = 0; sIdx <= 5; sIdx++) {
          var sa = rot2 + ((sIdx * 2) % 5) / 5 * Math.PI * 2 - Math.PI / 2;
          var sx = vfx.x + Math.cos(sa) * R * 0.66, sy = vfx.y + Math.sin(sa) * R * 0.66 * 0.42;
          if (sIdx === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();
      } else if (vfx.kind === 'ground_motif') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = lang.glow;
        ctx.shadowColor = lang.deep;
        ctx.shadowBlur = qualityShadow(4);
        var grow = 0.55 + 0.45 * Math.min(1, progress / 0.25);
        var motif = lang.motif;
        ctx.lineWidth = 2.2;
        if (motif === 'leaf') {
          // Dây leo: 6 nhánh cong bò ra từ tâm (kế thừa hình bản live của Dây Leo Trói)
          for (var a = 0; a < 6; a++) {
            var ang = a * Math.PI / 3 + Math.sin(nowSec * 2 + a) * 0.05;
            var ex = vfx.x + Math.cos(ang) * 24 * grow, ey = vfx.y + Math.sin(ang) * 12 * grow;
            var mx = vfx.x + Math.cos(ang + 0.5) * 13 * grow, my = vfx.y + Math.sin(ang + 0.5) * 6 * grow;
            ctx.beginPath(); ctx.moveTo(vfx.x, vfx.y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
          }
        } else if (motif === 'blade') {
          for (var b = 0; b < 5; b++) {
            var ba = (b / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(vfx.x + Math.cos(ba) * 6, vfx.y + Math.sin(ba) * 3);
            ctx.lineTo(vfx.x + Math.cos(ba) * 22 * grow, vfx.y + Math.sin(ba) * 11 * grow);
            ctx.stroke();
          }
        } else if (motif === 'drop') {
          for (var c = 0; c < 3; c++) {
            var cr = (6 + c * 7) * grow;
            ctx.beginPath(); ctx.ellipse(vfx.x, vfx.y, cr, cr * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
          }
        } else if (motif === 'flame') {
          for (var f = 0; f < 7; f++) {
            var fa = (f / 7) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(vfx.x, vfx.y);
            ctx.lineTo(vfx.x + Math.cos(fa) * 18 * grow, vfx.y + Math.sin(fa) * 9 * grow);
            ctx.stroke();
          }
        } else {
          // shard/slash: các mảnh nứt tỏa ra
          for (var g2 = 0; g2 < 6; g2++) {
            var ga = (g2 / 6) * Math.PI * 2 + 0.3;
            ctx.beginPath();
            ctx.moveTo(vfx.x + Math.cos(ga) * 4, vfx.y + Math.sin(ga) * 2);
            ctx.lineTo(vfx.x + Math.cos(ga) * 20 * grow, vfx.y + Math.sin(ga) * 10 * grow);
            ctx.stroke();
          }
        }
        ctx.restore();
      } else if (vfx.kind === 'ring' && vfx.ground) {
        renderRingVfx(vfx, progress);
      }
    }
  }

  /** Vòng chấn động nở ra (dùng cho cả lớp đất và lớp không). */
  function renderRingVfx(vfx, progress) {
    var ease = 1 - Math.pow(1 - progress, 2.2);
    var r = (vfx.maxR || 36) * ease;
    var alpha = Math.max(0, 1 - progress);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = vfx.lang.glow;
    ctx.shadowColor = vfx.lang.glow;
    ctx.shadowBlur = qualityShadow(7);
    ctx.lineWidth = 3 * (1 - progress * 0.6);
    ctx.beginPath();
    if (vfx.ground) ctx.ellipse(vfx.x, vfx.y, r, r * 0.42, 0, 0, Math.PI * 2);
    else ctx.arc(vfx.x, vfx.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    var r2 = r * 0.72;
    if (vfx.ground) ctx.ellipse(vfx.x, vfx.y, r2, r2 * 0.42, 0, 0, Math.PI * 2);
    else ctx.arc(vfx.x, vfx.y, r2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function renderCombatVfx() {
    var nowSec = performance.now() / 1000;
    for (var i = 0; i < visualEffects.length; i++) {
      var vfx = visualEffects[i];
      if (vfx.type === 'slash_crescent') {
        ctx.save();
        var progress = 1.0 - (vfx.timer / vfx.duration);
        ctx.strokeStyle = 'rgba(255, 245, 190, ' + (1.0 - progress) + ')';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        var angle = Math.atan2(vfx.targetY - vfx.y, vfx.targetX - vfx.x);
        var dist = 28 * progress;
        var cx = vfx.x + Math.cos(angle) * dist;
        var cy = vfx.y + Math.sin(angle) * dist;
        ctx.arc(cx, cy, 20, angle - 0.7, angle + 0.7);
        ctx.stroke();
        ctx.restore();
      } else if (vfx.type === 'vine_snare') {
        ctx.save();
        ctx.strokeStyle = '#55d882';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (var a = 0; a < 6; a++) {
          var ang = a * Math.PI / 3;
          ctx.moveTo(vfx.x, vfx.y);
          ctx.lineTo(vfx.x + Math.cos(ang) * 24, vfx.y + Math.sin(ang) * 12);
        }
        ctx.stroke();
        ctx.restore();
      } else if (vfx.kind === 'burst') {
        // Bùng hạt: mỗi hạt sáng lõi + hào quang, mờ dần theo tuổi
        var bAlpha = Math.max(0, vfx.timer / vfx.duration);
        ctx.save();
        ctx.shadowColor = vfx.lang.glow;
        ctx.shadowBlur = qualityShadow(7);
        for (var bp = 0; bp < (vfx.particles || []).length; bp++) {
          var pt = vfx.particles[bp];
          ctx.globalAlpha = bAlpha;
          ctx.fillStyle = vfx.lang.core;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(0.4, pt.size * bAlpha), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (vfx.kind === 'ring' && !vfx.ground) {
        renderRingVfx(vfx, 1.0 - (vfx.timer / vfx.duration));
      } else if (vfx.kind === 'gather') {
        // Tụ linh khí: hạt xoáy vào điểm phát, nhân sáng lớn dần theo tiến độ vận
        var gProg = 1.0 - (vfx.timer / vfx.duration);
        ctx.save();
        for (var gp = 0; gp < (vfx.particles || []).length; gp++) {
          var gpt = vfx.particles[gp];
          var gAng = gpt.ang + nowSec * gpt.speed;
          var gRad = gpt.rad * (1 - gProg * 0.82);
          var gx = vfx.x + Math.cos(gAng) * gRad;
          var gy = vfx.y + Math.sin(gAng) * gRad * 0.7;
          ctx.globalAlpha = 0.35 + gProg * 0.65;
          ctx.fillStyle = vfx.lang.core;
          ctx.shadowColor = vfx.lang.glow;
          ctx.shadowBlur = qualityShadow(6);
          ctx.beginPath();
          ctx.arc(gx, gy, gpt.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.25 + gProg * 0.55;
        ctx.fillStyle = vfx.lang.glow;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, 3 + gProg * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (vfx.kind === 'swirl') {
        // Vòng xoáy/trận xoay: 3 cung xoay thật quanh tâm
        var sProg = 1.0 - (vfx.timer / vfx.duration);
        var sAlpha = Math.min(1, sProg / 0.15) * Math.min(1, vfx.timer / 0.3);
        ctx.save();
        ctx.globalAlpha = Math.max(0, sAlpha);
        ctx.strokeStyle = vfx.lang.glow;
        ctx.shadowColor = vfx.lang.glow;
        ctx.shadowBlur = qualityShadow(6);
        ctx.lineWidth = 2.4;
        var sR = vfx.radius || 34;
        for (var sw = 0; sw < 3; sw++) {
          var sA0 = nowSec * 3.4 + sw * (Math.PI * 2 / 3);
          ctx.beginPath();
          ctx.ellipse(vfx.x, vfx.y, sR, sR * 0.45, 0, sA0, sA0 + Math.PI * 0.85);
          ctx.stroke();
        }
        ctx.restore();
      } else if (vfx.kind === 'rain') {
        // Mưa đạn: giọt rơi có vệt, màu theo hệ, chạm đất tắt
        ctx.save();
        ctx.strokeStyle = vfx.lang.core;
        ctx.shadowColor = vfx.lang.glow;
        ctx.shadowBlur = qualityShadow(5);
        ctx.lineWidth = 2;
        var drops = vfx.drops || [];
        for (var rd = 0; rd < drops.length; rd++) {
          var dr = drops[rd];
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(dr.x + 3, dr.y - 13);
          ctx.lineTo(dr.x, dr.y);
          ctx.stroke();
        }
        ctx.restore();
      } else if (vfx.kind === 'streak') {
        // Vệt lướt theo quỹ đạo cong bậc hai: đầu sao chổi + đuôi thon mờ dần
        var tProg = 1.0 - (vfx.timer / vfx.duration);
        ctx.save();
        ctx.lineCap = 'round';
        var SEG = 14;
        for (var sg = 1; sg <= SEG; sg++) {
          var t1 = tProg * (sg / SEG);
          var t0 = tProg * ((sg - 1) / SEG);
          var qx1 = (1 - t1) * (1 - t1) * vfx.x0 + 2 * (1 - t1) * t1 * vfx.cx + t1 * t1 * vfx.x1;
          var qy1 = (1 - t1) * (1 - t1) * vfx.y0 + 2 * (1 - t1) * t1 * vfx.cy + t1 * t1 * vfx.y1;
          var qx0 = (1 - t0) * (1 - t0) * vfx.x0 + 2 * (1 - t0) * t0 * vfx.cx + t0 * t0 * vfx.x1;
          var qy0 = (1 - t0) * (1 - t0) * vfx.y0 + 2 * (1 - t0) * t0 * vfx.cy + t0 * t0 * vfx.y1;
          var segA = (sg / SEG) * (sg / SEG);
          ctx.strokeStyle = vfx.lang.glow;
          ctx.globalAlpha = segA * 0.85;
          ctx.lineWidth = 1 + 4.5 * segA;
          ctx.shadowColor = vfx.lang.glow;
          ctx.shadowBlur = qualityShadow(6);
          ctx.beginPath(); ctx.moveTo(qx0, qy0); ctx.lineTo(qx1, qy1); ctx.stroke();
        }
        var hx = (1 - tProg) * (1 - tProg) * vfx.x0 + 2 * (1 - tProg) * tProg * vfx.cx + tProg * tProg * vfx.x1;
        var hy = (1 - tProg) * (1 - tProg) * vfx.y0 + 2 * (1 - tProg) * tProg * vfx.cy + tProg * tProg * vfx.y1;
        ctx.globalAlpha = 1;
        ctx.fillStyle = vfx.lang.core;
        ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (vfx.kind === 'crescent') {
        // Vệt chém cong thon hai đầu: dải lưỡi liềm quét từ góc bắt đầu sang góc kết,
        // bề dày phình ở giữa và thon về hai đầu, lõi trắng nóng + viền hào quang hệ.
        var cProg = 1.0 - (vfx.timer / vfx.duration);
        var cAngle = Math.atan2(vfx.targetY - vfx.y, vfx.targetX - vfx.x);
        var sweep = Math.PI * 0.95;
        var a0 = cAngle - sweep / 2 + sweep * cProg * 0.55;
        var a1 = a0 + sweep * 0.62;
        var cR = 30 * (vfx.scale || 1);
        var cFade = Math.sin(Math.min(1, cProg * 1.15) * Math.PI);
        ctx.save();
        ctx.translate(vfx.x + Math.cos(cAngle) * 10, vfx.y + Math.sin(cAngle) * 10);
        for (var pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          var STEPS = 12;
          for (var ci = 0; ci <= STEPS; ci++) {
            var ct = ci / STEPS;
            var ca = a0 + (a1 - a0) * ct;
            var wHalf = Math.sin(ct * Math.PI) * (pass === 0 ? 5.2 : 2.4) * (vfx.scale || 1);
            var px = Math.cos(ca) * (cR + wHalf), py = Math.sin(ca) * (cR + wHalf);
            if (ci === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          for (var cj = STEPS; cj >= 0; cj--) {
            var ct2 = cj / STEPS;
            var ca2 = a0 + (a1 - a0) * ct2;
            var wHalf2 = Math.sin(ct2 * Math.PI) * (pass === 0 ? 5.2 : 2.4) * (vfx.scale || 1);
            ctx.lineTo(Math.cos(ca2) * (cR - wHalf2), Math.sin(ca2) * (cR - wHalf2));
          }
          ctx.closePath();
          ctx.globalAlpha = cFade * (pass === 0 ? 0.55 : 0.95);
          ctx.fillStyle = pass === 0 ? vfx.lang.glow : vfx.lang.core;
          ctx.shadowColor = vfx.lang.glow;
          ctx.shadowBlur = qualityShadow(pass === 0 ? 10 : 4);
          ctx.fill();
        }
        ctx.restore();
      } else if (vfx.kind === 'sword_arc') {
        // Vệt kiếm đòn thường (SWINGFIX): dải cung thon hai đầu chạy dọc
        // quỹ đạo lưỡi vừa quét — từng đoạn cung có bề dày phình ở giữa
        // dải và thon về hai đầu, sáng mạnh nhất ở nửa cuối (nơi lưỡi vừa
        // đi qua), lõi trắng nóng trong hào quang màu hệ; mờ dần 0,17s.
        var saProg = 1.0 - (vfx.timer / vfx.duration);
        var saFade = Math.pow(1 - saProg, 0.75) * Math.min(1, saProg / 0.12 + 0.25);
        var saR = 26;
        var saA0 = vfx.a0 * Math.PI / 180;
        var saSweep = vfx.sweep * Math.PI / 180;
        ctx.save();
        ctx.lineCap = 'round';
        for (var saPass = 0; saPass < 2; saPass++) {
          var SEG2 = 12;
          for (var si = 0; si < SEG2; si++) {
            var st = si / SEG2;
            var segA0 = saA0 + saSweep * st;
            var segA1 = saA0 + saSweep * ((si + 1) / SEG2);
            var taper = Math.sin((st + 0.5 / SEG2) * Math.PI);
            var headW = 0.35 + 0.65 * st;
            ctx.beginPath();
            ctx.arc(vfx.x, vfx.y, saR, segA0, segA1, vfx.sweep < 0);
            ctx.strokeStyle = saPass === 0 ? vfx.lang.glow : vfx.lang.core;
            ctx.globalAlpha = saFade * headW * (saPass === 0 ? 0.38 : 0.92);
            ctx.lineWidth = (saPass === 0 ? 9.5 : 4.6) * taper + 0.6;
            ctx.shadowColor = vfx.lang.glow;
            ctx.shadowBlur = qualityShadow(saPass === 0 ? 9 : 3);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }

    // Đạn chiêu: vệt đuôi mờ dần + đầu đạn theo motif hệ (K1 thay vòng tròn lá cũ)
    for (var p = 0; p < projectiles.length; p++) {
      var proj = projectiles[p];
      var pLang = fxLang(proj.element);
      ctx.save();
      // Vệt đuôi: dải nối các điểm đã ghi, mảnh và mờ dần về đuôi
      if (proj.trail && proj.trail.length > 1) {
        ctx.lineCap = 'round';
        for (var ti = 1; ti < proj.trail.length; ti++) {
          var tA = ti / proj.trail.length;
          ctx.strokeStyle = pLang.glow;
          ctx.globalAlpha = tA * 0.5;
          ctx.lineWidth = 1 + 4 * tA;
          ctx.beginPath();
          ctx.moveTo(proj.trail[ti - 1].x, proj.trail[ti - 1].y);
          ctx.lineTo(proj.trail[ti].x, proj.trail[ti].y);
          ctx.stroke();
        }
      }
      // Đầu đạn theo motif ngôn ngữ hình của hệ
      ctx.globalAlpha = 1;
      ctx.fillStyle = pLang.core;
      ctx.shadowColor = pLang.glow;
      ctx.shadowBlur = qualityShadow(9);
      var headAng = proj.trail && proj.trail.length > 1
        ? Math.atan2(proj.y - proj.trail[0].y, proj.x - proj.trail[0].x) : 0;
      var motif = pLang.motif;
      if (motif === 'leaf') {
        ctx.translate(proj.x, proj.y);
        ctx.rotate(headAng);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pLang.deep;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
      } else if (motif === 'blade') {
        ctx.translate(proj.x, proj.y);
        ctx.rotate(headAng);
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(-6, -3.4); ctx.lineTo(-3.4, 0); ctx.lineTo(-6, 3.4);
        ctx.closePath(); ctx.fill();
      } else if (motif === 'flame') {
        ctx.beginPath(); ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pLang.glow;
        ctx.beginPath(); ctx.arc(proj.x - Math.cos(headAng) * 4, proj.y - Math.sin(headAng) * 4, 3.6, 0, Math.PI * 2); ctx.fill();
      } else if (motif === 'drop') {
        ctx.beginPath(); ctx.arc(proj.x, proj.y, 5.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(proj.x - 1.8, proj.y - 1.8, 1.8, 0, Math.PI * 2); ctx.fill();
      } else if (motif === 'shard') {
        ctx.translate(proj.x, proj.y);
        ctx.rotate(headAng + Math.PI / 4);
        ctx.fillRect(-4.4, -4.4, 8.8, 8.8);
      } else {
        ctx.beginPath(); ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // Thanh vận chiêu trên đầu nhân vật khi đang vận chiêu (hồ sơ 52§3, bản K1):
    // viền theo màu hệ + phần đã vận sáng lõi; hết vận là chiêu phát ngay.
    if (castState && player) {
      var csProg = 1 - Math.max(0, castState.timer) / Math.max(0.01, castState.total);
      var csLang = fxLang(skillsAPI ? skillsAPI.elementOf(castState.def) : 'neutral');
      var barW = 46, barH = 5.5;
      var barX = player.x - barW / 2, barY = player.y - 138;
      ctx.save();
      ctx.fillStyle = 'rgba(8, 10, 14, 0.72)';
      ctx.beginPath(); ctx.rect(barX - 1.5, barY - 1.5, barW + 3, barH + 3); ctx.fill();
      ctx.fillStyle = csLang.deep;
      ctx.beginPath(); ctx.rect(barX, barY, barW, barH); ctx.fill();
      ctx.fillStyle = csLang.core;
      ctx.shadowColor = csLang.glow;
      ctx.shadowBlur = qualityShadow(6);
      ctx.beginPath(); ctx.rect(barX, barY, barW * Math.min(1, csProg), barH); ctx.fill();
      ctx.restore();
    }
  }

  function renderFloatingTexts() {
    ctx.save();
    for (var i = 0; i < floatingTexts.length; i++) {
      var ft = floatingTexts[i];
      var alpha = Math.max(0, ft.timer / ft.duration);

      if (ft.customColor) {
        ctx.fillStyle = ft.customColor;
        ctx.font = 'bold 13px "Noto Serif", serif';
      } else if (ft.type === 'player_damage') {
        ctx.fillStyle = 'rgba(240, 70, 70, ' + alpha + ')';
        ctx.font = 'bold 15px "Noto Serif", serif';
      } else if (ft.isCrit) {
        ctx.fillStyle = 'rgba(255, 220, 80, ' + alpha + ')';
        ctx.font = 'bold 19px "Noto Serif", serif';
      } else {
        ctx.fillStyle = 'rgba(85, 216, 130, ' + alpha + ')';
        ctx.font = 'bold 14px "Noto Serif", serif';
      }

      ctx.shadowColor = '#000000';
      ctx.shadowBlur = qualityShadow(4);
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  function drawQuestExclamation(x, y) {
    ctx.save();
    ctx.shadowColor = 'rgba(243, 217, 78, 0.85)';
    ctx.shadowBlur = qualityShadow(12);
    ctx.fillStyle = '#8a2b22';
    ctx.strokeStyle = '#f3d94e';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff7dd';
    ctx.beginPath();
    ctx.rect(x - 1.8, y - 6.5, 3.6, 6.5);
    ctx.arc(x, y + 3.2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGuidanceArrow(fromX, fromY, toX, toY) {
    var angle = Math.atan2(toY - fromY, toX - fromX);
    var dist = Math.hypot(toX - fromX, toY - fromY);
    if (dist < 70) return;

    var radius = 48;
    var arrowX = fromX + Math.cos(angle) * radius;
    var arrowY = fromY - 30 + Math.sin(angle) * radius;

    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);
    ctx.shadowColor = 'rgba(218, 175, 55, 0.8)';
    ctx.shadowBlur = qualityShadow(8);
    ctx.fillStyle = '#f3d94e';
    ctx.strokeStyle = '#5d4a1e';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawHintChip(x, y, text) {
    ctx.save();
    ctx.font = '11px "Noto Serif", serif';
    var textMetrics = ctx.measureText(text);
    var boxW = textMetrics.width + 12;
    var boxH = 18;

    ctx.fillStyle = 'rgba(20, 26, 20, 0.85)';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff4d0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Đợt 3 (Note 4): biển chỉ tên tại MỌI điểm chuyển map.
   * Biển gỗ trong thế giới (cột + bảng + tên map đích) vẽ thường trực;
   * khi nhân vật tới gần (<= 320px) hiện thêm bảng tên cỡ lớn theo không gian
   * màn hình để đọc rõ ở bề ngang điện thoại 390px.
   */
  function collectGateSigns() {
    var signs = [];
    if (!mapData) return signs;
    var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : null;
    function destName(id) {
      var m = holder && holder.getMap ? holder.getMap(id) : null;
      return m ? m.name : id;
    }
    if (mapData.exits) {
      for (var i = 0; i < mapData.exits.length; i++) {
        var ex = mapData.exits[i];
        if (ex.targetMap && ex.rect) {
          // Cửa Đại Điện đã có biển tên riêng ngay cửa (plaque) — không cắm thêm biển cổng trùng
          if (ex.targetMap === 'dai-dien') continue;
          // Đợt 6: nếu đã có điểm tương tác cửa cùng đích ngay tại cổng thì chỉ giữ MỘT biển (biển cửa)
          var ecx = ex.rect.x + ex.rect.w / 2;
          var ecy = ex.rect.y + ex.rect.h / 2;
          var hasDoorSign = false;
          if (mapData.interactables) {
            for (var di = 0; di < mapData.interactables.length; di++) {
              var dit = mapData.interactables[di];
              if (dit.targetMap === ex.targetMap && Math.hypot(dit.x - ecx, dit.y - ecy) < 90) { hasDoorSign = true; break; }
            }
          }
          if (hasDoorSign) continue;
          var sx = ex.rect.x + ex.rect.w / 2;
          var sy = ex.rect.y + ex.rect.h / 2;
          // Cổng sát mép bản đồ: cắm biển lùi vào trong để không bị cắt khỏi khung hình
          if (ex.rect.y <= 2) sy = ex.rect.y + ex.rect.h + 36;
          else if (ex.rect.y + ex.rect.h >= mapData.height - 2) sy = ex.rect.y - 36;
          if (ex.rect.x <= 2) sx = ex.rect.x + ex.rect.w + 36;
          else if (ex.rect.x + ex.rect.w >= mapData.width - 2) sx = ex.rect.x - 36;
          signs.push({ x: sx, y: sy, label: destName(ex.targetMap), kind: 'gate' });
        }
      }
    }
    if (mapData.interactables) {
      for (var j = 0; j < mapData.interactables.length; j++) {
        var it = mapData.interactables[j];
        if (it.action === 'door_enter') {
          // Đợt 6: biển cửa ghi đúng đích — cửa vào Đại Điện ghi "Đại Điện", cửa ra trong điện ghi "Ra Sơn Môn"
          if (it.targetMap === 'dai-dien') {
            signs.push({ x: it.x + 118, y: it.y - 40, label: 'Đại Điện', kind: 'plaque' });
          } else {
            signs.push({ x: it.x, y: it.y - 46, label: 'Ra ' + destName(it.targetMap), kind: 'plaque' });
          }
        } else if (it.action === 'door_exit') {
          signs.push({ x: it.x, y: it.y - 46, label: 'Ra Sơn Môn', kind: 'plaque' });
        } else if (it.action === 'open_teleport') {
          signs.push({ x: it.x, y: it.y - 96, label: 'Đài Truyền Tống', kind: 'plaque' });
        }
      }
    }
    // Đài Truyền Tống: bia đá ghi từng điểm đến quanh đài (thấy trước khi dùng)
    if (mapData.id === 'dai-truyen-tong' || currentMapId === 'dai-truyen-tong') {
      signs.push({ x: 268, y: 300, label: 'Miếu Hoang', kind: 'stele' });
      signs.push({ x: 692, y: 300, label: 'Rừng Độc Thanh Tụy', kind: 'stele' });
      signs.push({ x: 480, y: 486, label: 'Sơn Môn', kind: 'stele' });
      signs.push({ x: 150, y: 180, label: 'Hồ Băng Hàn Kính', kind: 'stele' });
      signs.push({ x: 810, y: 180, label: 'Mỏ Lửa Xích Diệm', kind: 'stele' });
      signs.push({ x: 150, y: 486, label: 'Hoang Mạc Hoàng Sa', kind: 'stele' });
      signs.push({ x: 810, y: 486, label: 'Kiếm Trủng Huyền Thiết', kind: 'stele' });
    }
    return signs;
  }

  function drawOneSign(s) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (s.kind === 'gate') {
      // Cột gỗ + bảng gỗ treo
      ctx.fillStyle = 'rgba(10, 12, 8, 0.35)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 26, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6d4c2f';
      ctx.fillRect(s.x - 3, s.y - 16, 6, 42);
      ctx.font = 'bold 15px "Noto Serif", serif';
      var gw = ctx.measureText(s.label).width + 26;
      ctx.fillStyle = '#7d5a36';
      ctx.strokeStyle = '#4a3220';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(s.x - gw / 2, s.y - 44, gw, 30, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(s.label, s.x, s.y - 29);
    } else if (s.kind === 'plaque') {
      ctx.font = 'bold 15px "Noto Serif", serif';
      var pw = ctx.measureText(s.label).width + 26;
      ctx.fillStyle = 'rgba(74, 32, 24, 0.92)';
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(s.x - pw / 2, s.y - 15, pw, 30, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd977';
      ctx.fillText(s.label, s.x, s.y);
    } else { // stele — bia đá nhỏ
      ctx.font = 'bold 13px "Noto Serif", serif';
      var sw = ctx.measureText(s.label).width + 20;
      ctx.fillStyle = 'rgba(96, 104, 100, 0.95)';
      ctx.strokeStyle = '#3f4a44';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(s.x - sw / 2, s.y - 14, sw, 28, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#eaf5ec';
      ctx.fillText(s.label, s.x, s.y);
    }
    ctx.restore();
  }

  function drawGateSigns() {
    var signs = collectGateSigns();
    for (var i = 0; i < signs.length; i++) drawOneSign(signs[i]);
  }

  /**
   * Đợt 6 (Việc 1 — mục 12): mũi tên CHỈ XUỐNG động tại mọi điểm chuyển map:
   * mọi exit của map hiện tại + cửa tòa nhà (door_enter) + đài truyền tống (teleport).
   * Chevron đôi trắng-xanh ngọc viền tối, nảy nhẹ — khác hẳn mũi tên dẫn nhiệm vụ
   * (tam giác vàng ở chân nhân vật). Ẩn khi đang mờ chuyển map.
   */
  function drawEntranceArrows() {
    if (!mapData || !player) return;
    if (mapFade && (mapFade.alpha > 0.02 || mapFade.dir !== 0)) return;
    var flourish = getSettingsCached().flourishEffects !== false;
    var t = performance.now() / 1000;
    var bounce = flourish ? Math.sin(t * 3.2) * 4 : 0;

    var points = [];
    if (mapData.exits) {
      for (var i = 0; i < mapData.exits.length; i++) {
        var ex = mapData.exits[i];
        if (ex.rect) points.push({ x: ex.rect.x + ex.rect.w / 2, y: ex.rect.y + ex.rect.h / 2 });
      }
    }
    if (mapData.interactables) {
      for (var j = 0; j < mapData.interactables.length; j++) {
        var it = mapData.interactables[j];
        if (it.action === 'door_enter' || it.action === 'door_exit' || it.action === 'teleport' || it.action === 'open_teleport') {
          points.push({ x: it.x, y: it.y - 6 });
        }
      }
    }

    for (var p = 0; p < points.length; p++) {
      var px = points[p].x;
      var py = points[p].y - 30 + bounce;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var c = 0; c < 2; c++) {
        var cy = py + c * 11;
        ctx.beginPath();
        ctx.moveTo(px - 13, cy);
        ctx.lineTo(px, cy + 10);
        ctx.lineTo(px + 13, cy);
        ctx.strokeStyle = 'rgba(10, 20, 24, 0.9)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px - 13, cy);
        ctx.lineTo(px, cy + 10);
        ctx.lineTo(px + 13, cy);
        ctx.strokeStyle = c === 0 ? '#aef3ff' : '#4fd8ef';
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Bảng tên cỡ lớn (không gian màn hình) cho cổng gần nhất — đọc rõ ở 390px. */
  function drawSignPlate() {
    if (!player) return;
    var signs = collectGateSigns();
    var best = null, bestD = 330;
    for (var i = 0; i < signs.length; i++) {
      // Đợt 6: bảng lớn chỉ dành cho biển cổng — biển cửa (plaque) đã nằm ngay tại cửa, hiện thêm bảng lớn là trùng hai lớp
      if (signs[i].kind !== 'gate') continue;
      var d = Math.hypot(player.x - signs[i].x, player.y - signs[i].y);
      if (d < bestD) { bestD = d; best = signs[i]; }
    }
    // Đợt 6: đứng sát cổng (dưới 190px) thì biển gỗ tại cổng đã đọc rõ — ẩn bảng lớn để không trùng hai lớp cùng một tên
    if (best && bestD < 190) return;
    if (!best) return;
    var sx = (best.x - camera.x) * camera.scale;
    var sy = (best.y - camera.y) * camera.scale - 58;
    ctx.save();
    ctx.font = 'bold 17px "Noto Serif", serif';
    var tw = ctx.measureText(best.label).width;
    var bw = tw + 34, bh = 38;
    var bx = Math.max(8, Math.min(canvas.width - bw - 8, sx - bw / 2));
    var by = Math.max(8, sy - bh);
    ctx.fillStyle = 'rgba(46, 32, 18, 0.94)';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe9b0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(best.label, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
  }

  function drawExitChip(x, y, text) {
    ctx.save();
    ctx.font = 'bold 13px "Noto Serif", serif';
    var textMetrics = ctx.measureText(text);
    var boxW = textMetrics.width + 24;
    var boxH = 28;

    ctx.fillStyle = 'rgba(20, 26, 20, 0.88)';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff4d0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function getDirFromVelocity(vx, vy) {
    var angle = Math.atan2(vy, vx);
    var octant = Math.round((8 * angle) / (2 * Math.PI) + 8) % 8;
    var dirMap = [2, 1, 0, 7, 6, 5, 4, 3];
    return dirMap[octant] !== undefined ? dirMap[octant] : 0;
  }

  var EngineAPI = {
    init: initEngine,
    start: start,
    stop: stop,
    triggerPathTo: triggerPathTo,
    getDirFromVelocity: getDirFromVelocity,
    getCamera: function () { return camera; },
    setQuality: setQuality,
    getQuality: function () { return currentQuality; },
    castSkill: castSkill,
    // Đợt K1: móc kiểm thử renderer VFX + đọc trạng thái vận chiêu/hồi chiêu
    debugSpawnVfx: debugSpawnVfx,
    getCastState: function () {
      return castState ? { skillId: castState.def.id, timer: castState.timer, total: castState.total } : null;
    },
    getSkillCds: function () { return Object.assign({}, skillCds); },
    // Đợt K2: móc kiểm thử Liên Hoàn + khung tung chiêu + tỉ lệ Hài Hòa
    getLienHoan: function () {
      return { elem: lienHoanState.elem, stacks: lienHoanState.stacks };
    },
    getSkillCastAnim: function () {
      return skillCastAnim ? { skillId: skillCastAnim.def.id, row: skillCastAnim.row, timer: skillCastAnim.timer, duration: skillCastAnim.duration } : null;
    },
    // Đợt SWINGFIX: móc kiểm thử nhịp vung đòn thường (cùng mẫu getSkillCastAnim)
    getBasicSwing: function () {
      return basicSwing ? { timer: basicSwing.timer, duration: basicSwing.duration, struck: basicSwing.struck } : null;
    },
    getHarmonyRatio: function () {
      return (stateAPI && player) ? stateAPI.harmonyRatio(player.paths) : null;
    },
    handleRevive: handleRevive,
    switchMap: switchMap,
    teleportTo: teleportTo,
    handleNpcTalked: handleNpcTalked,
    getCurrentMap: function () { return mapData; },
    getCurrentMapId: function () { return currentMapId; },
    getCurrentZone: getCurrentZone,
    getQuestTargetInfo: getQuestTargetInfo,
    resolveQuestDestination: resolveQuestDestination,
    findRoute: findRoute,
    findGuidanceHop: findGuidanceHop,
    getFieldMonsters: function () { return fieldMonsters; },
    // Kiểm chứng sprite quái nạp đúng khóa (bắt lỗi lệch khóa nạp/tra cứu như Đợt 3)
    getMonsterSheetStatus: function () {
      var alias = { thao_tinh: 'thaotinh_sheet', nhen_xanh: 'nhenxanh_sheet', co_thu_yeu: 'cothuye_sheet' };
      var out = {};
      var species = (monstersAPI && monstersAPI.SPECIES) ? monstersAPI.SPECIES : {};
      for (var sid in species) {
        var img = assets[sid + '_sheet'] || (alias[sid] ? assets[alias[sid]] : null);
        out[sid] = !!(img && img.complete && img.naturalWidth > 0);
        if (species[sid].skillAsset) {
          var skImg = assets[sid + '_skill_sheet'];
          out[sid + '_skill'] = !!(skImg && skImg.complete && skImg.naturalWidth > 0);
        }
      }
      return out;
    },
    getGroundDrops: function () { return groundDrops; },
    getPlayer: function () { return player; },
    performContextAction: performContextAction,
    getActionContext: function () { return computeActionContext(); },
    startAutoQuestPath: startAutoQuestPath,
    toggleAutoQuestPath: toggleAutoQuestPath,
    cancelAutoPath: function () { cancelAutoPath(true); },
    isAutoPathActive: function () { return autoPath.active; },
    hasQuestTarget: function () { return getQuestTargetInfo() !== null && getQuestTargetInfo().stepId !== 'done'; },
    travelToMap: travelToMap,
    cancelTravel: cancelTravel,
    planTravelRoute: planTravelRoute,
    getTravelState: function () { return travelState; },
    useItem: useItem,
    tryBreakthrough: tryBreakthrough,
    tryKimDanBreakthrough: tryKimDanBreakthrough,
    startTribulation: startTribulation,
    getTribulationState: getTribulationState,
    exchangePill: exchangePill,
    refineTrucCoDan: refineTrucCoDan,
    equipItem: equipItem,
    unequipItem: unequipItem,
    pathToPoint: pathToPoint,
    getUserZoom: getUserZoom,
    setUserZoom: setUserZoom,
    getCameraScale: getCameraScale,
    setJoystickVector: setJoystickVector,
    triggerScreenShake: triggerScreenShake,
    triggerPathTo: triggerPathTo,
    handleWorldClick: handleWorldClick,
    getCurrentPath: function () { return currentPath; },
    getPendingInteraction: function () { return pendingInteraction; },
    isPlayerInNpcRange: isPlayerInNpcRange,
    triggerDialogue: triggerDialogue,
    getLastOpenedDialogue: function () { return lastOpenedDialogue; },
    setCurrentMap: function (mapId) {
      currentMapId = mapId;
      var holder = (typeof window !== 'undefined' && window.GameMapData) ? window.GameMapData : (typeof require !== 'undefined' ? require('./mapdata.js') : null);
      if (holder && holder.maps && holder.maps[mapId]) {
        mapData = holder.maps[mapId];
      } else if (holder && holder.getMap) {
        mapData = holder.getMap(mapId);
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EngineAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameEngine = EngineAPI;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
