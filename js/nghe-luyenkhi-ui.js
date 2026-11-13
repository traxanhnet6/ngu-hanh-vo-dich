/**
 * nghe-luyenkhi-ui.js — Đợt N1: giao diện Lò Rèn + Sổ Luyện Khí + Cải Tạo
 * trang bị + Bảng Đơn Hàng NPC + Nghề Sinh Nhai (chạy trên trình duyệt).
 *
 * Khuôn theo danphong.js: modal + thẻ, một trình nghe click ủy quyền,
 * đọc player sống qua attach() (ui.js initUI) hoặc GameEngine.getPlayer().
 * Mọi tính toán gọi GameN1 (js/nghe-luyenkhi.js) — tệp này chỉ trình bày.
 * 0 emoji. Chuẩn 390px: thẻ cuộn dọc, nút cao tối thiểu 40px.
 */
(function (exports) {
  'use strict';

  var livePlayer = null;
  var currentTab = 'forge';
  var selectedBp = null;
  var selectedExtra = '';
  var selectedRerollElement = 'kim';
  var transferFrom = null; // { containerId, slotIndex }
  var dismantleArm = null; // 'containerId:slotIndex' đang chờ bấm xác nhận

  var BOARD_STEPS = [
    { key: 'fireScore', name: 'Bước 1 — Nung Phôi (Hỏa Hầu)', hint: 'Bấm Dừng khi vạch chạm vùng nhiệt lý tưởng.', ideal: 55 },
    { key: 'hammerScore', name: 'Bước 2 — Rèn Dập (Thao Thiết)', hint: 'Bấm Dừng đúng nhịp búa.', ideal: 68 },
    { key: 'quenchScore', name: 'Bước 3 — Tôi Luyện', hint: 'Bấm Dừng đúng lúc hơi nước vừa dứt.', ideal: 45 },
    { key: 'infuseScore', name: 'Bước 4 — Khai Phong (Khắc Trận)', hint: 'Bấm Dừng khi luồng linh lực cân bằng.', ideal: 60 }
  ];
  var board = { active: false, step: 0, scores: {}, pos: 0, dir: 1, timer: null, running: false, done: false };
  var lastForgeResult = null;

  var SLOT_NAMES = { weapon: 'Vũ khí', armor: 'Áo giáp', shoes: 'Giày', belt: 'Đai', jewelry: 'Trang sức', phapKhi: 'Pháp khí', head: 'Đầu' };
  var ELEM_NAMES = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };

  function n1() {
    if (typeof window !== 'undefined' && window.GameN1) return window.GameN1;
    return null;
  }

  function getPlayer() {
    var p = livePlayer;
    if (!p && typeof window !== 'undefined' && window.GameEngine && window.GameEngine.getPlayer) {
      try { p = window.GameEngine.getPlayer(); } catch (e) { p = null; }
    }
    if (p && n1() && n1().ensureState) n1().ensureState(p);
    return p;
  }

  function itemDefs() {
    if (typeof window !== 'undefined' && window.GameMonsters && window.GameMonsters.ITEM_DEFS) return window.GameMonsters.ITEM_DEFS;
    return {};
  }

  function itemName(itemId) {
    var d = itemDefs()[itemId];
    return d ? d.name : itemId;
  }

  function qualityName(q) {
    var api = n1();
    if (api && api.QUALITY_RANKS && api.QUALITY_RANKS[q]) return api.QUALITY_RANKS[q].name;
    return q || 'Hạ phẩm';
  }

  function countInBag(player, itemId) {
    if (typeof window !== 'undefined' && window.GameTuiKho && window.GameTuiKho.countItemInPlayer) {
      return window.GameTuiKho.countItemInPlayer(player, itemId);
    }
    if (typeof window !== 'undefined' && window.GameState && window.GameState.countItemInBag) {
      return window.GameState.countItemInBag(player, itemId);
    }
    return 0;
  }

  function toast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(msg);
  }

  function refreshHUD() {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) window.GameUI.refreshHUD();
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function masteryLabel(uses) {
    if (uses >= 15) return 'Tinh Thông';
    if (uses >= 5) return 'Thuần Thục';
    return 'Sơ Giải';
  }

  // ==========================================================================
  // VÁN 4 BƯỚC
  // ==========================================================================
  function stopBoardTimer() {
    if (board.timer) { clearInterval(board.timer); board.timer = null; }
    board.running = false;
  }

  function resetBoard() {
    stopBoardTimer();
    board.active = false;
    board.step = 0;
    board.scores = {};
    board.pos = 0;
    board.dir = 1;
    board.done = false;
    lastForgeResult = null;
  }

  function boardScore() {
    var ideal = BOARD_STEPS[board.step].ideal;
    var dist = Math.abs(board.pos - ideal);
    var s = 1 - dist / 50;
    if (s < 0) s = 0;
    if (s > 1) s = 1;
    return Math.round(s * 100) / 100;
  }

  function startStepTimer() {
    stopBoardTimer();
    board.running = true;
    board.pos = 0;
    board.dir = 1;
    var speed = 1.6 + board.step * 0.5;
    board.timer = setInterval(function () {
      board.pos += speed * board.dir;
      if (board.pos >= 100) { board.pos = 100; board.dir = -1; }
      if (board.pos <= 0) { board.pos = 0; board.dir = 1; }
      var marker = document.getElementById('n1-board-marker');
      if (marker) marker.style.left = board.pos + '%';
    }, 30);
  }

  function boardHtml() {
    if (!board.active) return '';
    var step = BOARD_STEPS[board.step];
    var h = '<div class="n1-board">';
    h += '<div class="n1-board-title">' + esc(step.name) + '</div>';
    h += '<div class="n1-board-hint">' + esc(step.hint) + '</div>';
    var zoneLeft = step.ideal - 12;
    h += '<div class="n1-board-track"><div class="n1-board-zone" style="left:' + zoneLeft + '%;width:24%;"></div>' +
      '<div id="n1-board-marker" class="n1-board-marker" style="left:0%;"></div></div>';
    h += '<div class="n1-btn-row">';
    if (!board.running && !board.done) {
      h += '<button type="button" class="btn wood" data-n1-action="board-start">Bắt Đầu Bước ' + (board.step + 1) + '</button>';
    } else if (board.running) {
      h += '<button type="button" class="btn wood" data-n1-action="board-stop">Dừng</button>';
    }
    h += '</div>';
    var done = [];
    for (var i = 0; i < board.step; i++) {
      done.push('Bước ' + (i + 1) + ': ' + board.scores[BOARD_STEPS[i].key]);
    }
    if (done.length > 0) h += '<div class="n1-board-done">' + esc(done.join(' · ')) + '</div>';
    if (board.done) {
      h += '<div class="n1-board-done">Đã xong 4 bước: ' + esc(BOARD_STEPS.map(function (s) { return board.scores[s.key]; }).join(' / ')) + '</div>';
      h += '<div class="n1-btn-row"><button type="button" class="btn wood" data-n1-action="forge-finish">Hoàn Thành Rèn</button></div>';
    }
    h += '</div>';
    return h;
  }

  function forgeResultHtml() {
    if (!lastForgeResult) return '';
    var r = lastForgeResult;
    if (!r.ok) return '<div class="n1-card n1-warn">' + esc(r.msg || 'Rèn thất bại.') + '</div>';
    var h = '<div class="n1-card n1-result">';
    h += '<div class="n1-card-name">' + esc(r.qualityName) + ' — ký tên [' + esc(r.crafter) + ']</div>';
    h += '<div class="n1-card-sub">Điểm ván: ' + esc(String(r.totalScore)) + '</div>';
    if (r.affixes && r.affixes.length > 0) {
      h += '<div class="n1-affixes">';
      r.affixes.forEach(function (a) {
        h += '<div>+' + esc(String(a.value)) + esc(a.unit || '') + ' ' + esc(a.name) + ' (' + esc(ELEM_NAMES[a.element] || a.element) + ')</div>';
      });
      h += '</div>';
    } else {
      h += '<div class="n1-card-sub">Không có dòng phụ.</div>';
    }
    h += '</div>';
    return h;
  }

  // ==========================================================================
  // THẺ LUYỆN KHÍ
  // ==========================================================================
  function forgeTabHtml(player) {
    var api = n1();
    var learned = api.getLearnedBlueprints(player);
    var h = '<div class="danphong-intro">Chọn bản vẽ đã học, đủ nguyên liệu rồi rèn qua ván 4 bước. Thành phẩm ký tên người rèn.</div>';
    if (learned.length === 0) {
      return h + '<div class="n1-card">Chưa học bản vẽ nào. Mở thẻ Sổ Bản Vẽ để học.</div>';
    }
    if (!selectedBp || !api.getBlueprint(selectedBp) || player.luyenKhi.recipes.indexOf(selectedBp) === -1) {
      selectedBp = learned[0].id;
    }
    var bp = api.getBlueprint(selectedBp);
    h += '<label class="n1-label" for="n1-bp-select">Bản vẽ</label>';
    h += '<select id="n1-bp-select" class="n1-select" data-n1-select="blueprint">';
    learned.forEach(function (b) {
      h += '<option value="' + esc(b.id) + '"' + (b.id === selectedBp ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    });
    h += '</select>';
    var prof = api.getBlueprintProficiency(player, bp.id);
    h += '<div class="n1-card"><div class="n1-card-name">' + esc(bp.targetName) + '</div>' +
      '<div class="n1-card-sub">' + esc(SLOT_NAMES[bp.slot] || bp.slot) + ' · Bậc ' + bp.tier + ' · Trần phẩm: ' + esc(qualityName(bp.maxQuality)) + '</div>' +
      '<div class="n1-card-sub">' + esc(bp.desc || '') + '</div>' +
      '<div class="n1-card-sub">Thông thạo: ' + esc(masteryLabel(prof.uses)) + ' (' + prof.uses + ' lần rèn, kỷ lục ' + esc(qualityName(prof.maxQualityAchieved)) + ')</div></div>';
    var chk = api.checkForgeMaterials(player, bp.id);
    h += '<div class="n1-card"><div class="n1-card-name">Nguyên liệu</div>';
    bp.reqMaterials.forEach(function (m) {
      var have = countInBag(player, m.itemId);
      var lack = have < m.count;
      h += '<div class="n1-mat-row' + (lack ? ' n1-warn' : '') + '"><span>' + esc(itemName(m.itemId)) + '</span><span>' + have + ' / ' + m.count + '</span></div>';
    });
    var ltLack = (player.linhThach || 0) < bp.costLt;
    h += '<div class="n1-mat-row' + (ltLack ? ' n1-warn' : '') + '"><span>Linh Thạch</span><span>' + (player.linhThach || 0) + ' / ' + bp.costLt + '</span></div></div>';
    // Phụ liệu ngũ hành tùy chọn: vật phẩm đang có mà module biết hệ.
    var extras = [];
    var matElems = api.MATERIAL_ELEMENTS || {};
    Object.keys(matElems).forEach(function (mid) {
      if (countInBag(player, mid) > 0) extras.push(mid);
    });
    h += '<label class="n1-label" for="n1-extra-select">Phụ liệu ngũ hành (tùy chọn, tốn 1 — quyết hệ dòng phụ)</label>';
    h += '<select id="n1-extra-select" class="n1-select" data-n1-select="extra">';
    h += '<option value="">Không dùng phụ liệu</option>';
    extras.forEach(function (mid) {
      h += '<option value="' + esc(mid) + '"' + (mid === selectedExtra ? ' selected' : '') + '>' +
        esc(itemName(mid)) + ' (' + esc(ELEM_NAMES[matElems[mid]] || matElems[mid]) + ', có ' + countInBag(player, mid) + ')</option>';
    });
    h += '</select>';
    h += '<div class="n1-btn-row">';
    if (board.active) {
      h += '<button type="button" class="btn wood" data-n1-action="forge-cancel-board">Hủy Ván Rèn</button>';
    } else {
      h += '<button type="button" class="btn wood" data-n1-action="forge-start-board"' + (chk.ok ? '' : ' disabled') + '>Bắt Đầu Rèn (Ván 4 Bước)</button>';
      if (prof.isMastered) {
        h += '<button type="button" class="btn wood" data-n1-action="forge-quick"' + (chk.ok ? '' : ' disabled') + '>Rèn Nhanh (Tinh Thông)</button>';
      }
    }
    h += '</div>';
    if (!chk.ok && chk.msg) h += '<div class="n1-warn">' + esc(chk.msg) + '</div>';
    h += boardHtml();
    h += forgeResultHtml();
    return h;
  }

  // ==========================================================================
  // THẺ SỔ BẢN VẼ
  // ==========================================================================
  function bookTabHtml(player) {
    var api = n1();
    var h = '<div class="danphong-intro">Sổ Luyện Khí: học bản vẽ bằng vật phẩm bản vẽ trong túi. Rèn đủ 15 lần một bản vẽ thì mở Rèn Nhanh.</div>';
    var ids = Object.keys(api.BLUEPRINTS);
    ids.forEach(function (id) {
      var bp = api.BLUEPRINTS[id];
      var learned = player.luyenKhi.recipes.indexOf(id) !== -1;
      var prof = api.getBlueprintProficiency(player, id);
      h += '<div class="n1-card' + (learned ? '' : ' n1-dim') + '">';
      h += '<div class="n1-card-name">' + esc(bp.name) + (learned ? '' : ' (chưa học)') + '</div>';
      h += '<div class="n1-card-sub">' + esc(bp.targetName) + ' · ' + esc(SLOT_NAMES[bp.slot] || bp.slot) + ' · Bậc ' + bp.tier + ' · Trần phẩm: ' + esc(qualityName(bp.maxQuality)) + '</div>';
      h += '<div class="n1-card-sub">Liệu: ' + esc(bp.reqMaterials.map(function (m) { return itemName(m.itemId) + ' x' + m.count; }).join(', ')) + ' · ' + bp.costLt + ' Linh Thạch</div>';
      if (learned) {
        h += '<div class="n1-card-sub">Thông thạo: ' + esc(masteryLabel(prof.uses)) + ' · ' + prof.uses + ' lần rèn · ' + prof.successes + ' lần đạt Trung phẩm trở lên · Kỷ lục ' + esc(qualityName(prof.maxQualityAchieved)) + '</div>';
      } else {
        var have = countInBag(player, id);
        if (have > 0) {
          h += '<div class="n1-btn-row"><button type="button" class="btn wood" data-n1-action="book-learn" data-bp="' + esc(id) + '">Học Bản Vẽ (có ' + have + ' trong túi)</button></div>';
        } else {
          // Đợt N1FIX (§8.2): nguồn lấy bản vẽ theo dữ liệu đơn hàng.
          var src = api.getBlueprintSource ? api.getBlueprintSource(id) : null;
          if (src) {
            h += '<div class="n1-card-sub">Nguồn: ' + esc(src.label) + '.</div>';
          } else {
            h += '<div class="n1-card-sub">Chưa có nguồn trong đợt này.</div>';
          }
        }
      }
      h += '</div>';
    });
    return h;
  }

  // ==========================================================================
  // THẺ CẢI TẠO TRANG BỊ
  // ==========================================================================
  function listBagGear(player) {
    var out = [];
    var defs = itemDefs();
    var tk = player.tuiKho;
    if (!tk || !tk.containers) return out;
    var ids = [];
    if (typeof window !== 'undefined' && window.GameTuiKho && window.GameTuiKho.carriedContainerIds) {
      try { ids = window.GameTuiKho.carriedContainerIds(player); } catch (e) { ids = []; }
    }
    if (ids.length === 0) ids = Object.keys(tk.containers);
    ids.forEach(function (cid) {
      var c = tk.containers[cid];
      if (!c || !c.slots) return;
      c.slots.forEach(function (s, idx) {
        if (!s || !s.itemId || s.containerId) return;
        var d = defs[s.itemId];
        if (!d || d.type !== 'gear') return;
        out.push({ containerId: cid, slotIndex: idx, slot: s, def: d });
      });
    });
    return out;
  }

  function refineCostPreview(slot) {
    var cur = slot.refineLevel || 0;
    var costLt = (cur + 1) * 20;
    var matId = cur < 3 ? 'quang-dong-tho' : (cur < 6 ? 'quang-sat-huyen' : 'tinh-thiet-tho');
    var matCount = Math.floor(cur / 3) + 1;
    return { costLt: costLt, matId: matId, matCount: matCount };
  }

  function gearTabHtml(player) {
    var h = '<div class="danphong-intro">Cải tạo áp dụng cho trang bị trong túi trữ vật: tinh luyện, tẩy luyện, phân giải, truyền thừa. Truyền thừa: cấp tinh luyện và dòng phụ di chuyển sang trang bị nhận; trang bị nguồn về +0 và mất dòng đã truyền.</div>';
    h += '<label class="n1-label" for="n1-reroll-select">Hệ tẩy luyện ưu tiên</label>';
    h += '<select id="n1-reroll-select" class="n1-select" data-n1-select="reroll">';
    Object.keys(ELEM_NAMES).forEach(function (e) {
      h += '<option value="' + e + '"' + (e === selectedRerollElement ? ' selected' : '') + '>' + ELEM_NAMES[e] + '</option>';
    });
    h += '</select>';
    if (transferFrom) {
      h += '<div class="n1-card">Đang chọn nguồn truyền thừa. Chạm “Nhận Truyền Thừa” ở một trang bị cùng ô có cấp tinh luyện thấp hơn, hoặc <button type="button" class="btn wood small" data-n1-action="gear-transfer-cancel">Hủy Chọn</button></div>';
    }
    var gears = listBagGear(player);
    if (gears.length === 0) return h + '<div class="n1-card">Túi không có trang bị nào.</div>';
    gears.forEach(function (g) {
      var s = g.slot;
      var key = g.containerId + ':' + g.slotIndex;
      var isSource = transferFrom && transferFrom.containerId === g.containerId && transferFrom.slotIndex === g.slotIndex;
      h += '<div class="n1-card' + (isSource ? ' n1-active' : '') + '">';
      h += '<div class="n1-card-name">' + esc(g.def.name) + ' +' + (s.refineLevel || 0) + '</div>';
      h += '<div class="n1-card-sub">' + esc(SLOT_NAMES[g.def.slot] || g.def.slot) + ' · ' + esc(qualityName(s.quality || 'ha')) + '</div>';
      if (s.crafter) h += '<div class="n1-card-sub">[Chế tác: ' + esc(s.crafter) + ']</div>';
      if (s.affixes && s.affixes.length > 0) {
        h += '<div class="n1-affixes">';
        s.affixes.forEach(function (a) {
          h += '<div>+' + esc(String(a.value)) + esc(a.unit || '') + ' ' + esc(a.name) + '</div>';
        });
        h += '</div>';
      }
      var rc = refineCostPreview(s);
      h += '<div class="n1-btn-row">';
      if ((s.refineLevel || 0) < 10) {
        h += '<button type="button" class="btn wood small" data-n1-action="gear-refine" data-c="' + esc(g.containerId) + '" data-s="' + g.slotIndex + '">Tinh Luyện (' + rc.costLt + ' LT + ' + rc.matCount + ' ' + esc(itemName(rc.matId)) + ')</button>';
      }
      h += '<button type="button" class="btn wood small" data-n1-action="gear-reroll" data-c="' + esc(g.containerId) + '" data-s="' + g.slotIndex + '">Tẩy Luyện (25 LT + đá/cá)</button>';
      if (dismantleArm === key) {
        h += '<button type="button" class="btn wood small" data-n1-action="gear-dismantle-confirm" data-c="' + esc(g.containerId) + '" data-s="' + g.slotIndex + '">Chắc Chắn Phân Giải?</button>';
      } else {
        h += '<button type="button" class="btn wood small" data-n1-action="gear-dismantle" data-c="' + esc(g.containerId) + '" data-s="' + g.slotIndex + '">Phân Giải</button>';
      }
      if (!transferFrom) {
        if ((s.refineLevel || 0) > 0) {
          h += '<button type="button" class="btn wood small" data-n1-action="gear-transfer-src" data-c="' + esc(g.containerId) + '" data-s="' + g.slotIndex + '">Chọn Làm Nguồn Truyền</button>';
        }
      } else if (!isSource) {
        h += '<button type="button" class="btn wood small" data-n1-action="gear-transfer-target" data-c="' + esc(g.containerId) + '" data-s="' + g.slotIndex + '">Nhận Truyền Thừa</button>';
      }
      h += '</div></div>';
    });
    return h;
  }

  // ==========================================================================
  // THẺ ĐƠN HÀNG + THẺ NGHỀ
  // ==========================================================================
  function ordersTabHtml(player) {
    var api = n1();
    var h = '<div class="danphong-intro">Giao đúng vật phẩm cho NPC để nhận Linh Thạch, EXP nghề và vật phẩm thưởng. Nút chỉ sáng khi đủ hàng. Đơn hàng làm mới mỗi ngày.</div>';
    api.getNpcOrders(player).forEach(function (o) {
      var can = api.canTurnInOrder(player, o.id);
      var have = api.countQualifiedItems(player, o.reqItemId, o.reqMinQuality);
      h += '<div class="n1-card' + (o.completed ? ' n1-dim' : '') + '">';
      h += '<div class="n1-card-name">' + esc(o.title) + ' — ' + esc(o.npcName) + '</div>';
      h += '<div class="n1-card-sub">' + esc(o.desc || '') + '</div>';
      var qualNote = o.reqMinQuality ? ' (' + esc(qualityName(o.reqMinQuality)) + ' trở lên)' : '';
      h += '<div class="n1-mat-row"><span>' + esc(itemName(o.reqItemId)) + qualNote + '</span><span>' + have + ' / ' + o.reqCount + '</span></div>';
      var rewards = ['+' + o.rewardLt + ' Linh Thạch'];
      if (o.rewardExp && o.rewardExp.profId) {
        var pd = api.PROFESSIONS[o.rewardExp.profId];
        rewards.push('+' + o.rewardExp.amount + ' EXP ' + (pd ? pd.name : o.rewardExp.profId));
      }
      if (o.rewardItemId) rewards.push(esc(itemName(o.rewardItemId)) + ' x' + (o.rewardItemCount || 1));
      h += '<div class="n1-card-sub">Thưởng: ' + rewards.join(' · ') + '</div>';
      if (o.completed) {
        h += '<div class="n1-card-sub">Đã giao.</div>';
      } else {
        h += '<div class="n1-btn-row"><button type="button" class="btn wood" data-n1-action="order-turnin" data-order="' + esc(o.id) + '"' + (can.ok ? '' : ' disabled') + '>Giao Hàng</button></div>';
        if (!can.ok && can.reason === 'not_enough_items') h += '<div class="n1-card-sub">' + esc(can.msg || '') + '</div>';
      }
      h += '</div>';
    });
    return h;
  }

  function profsTabHtml(player) {
    var api = n1();
    var h = '<div class="danphong-intro">Mỗi nghề lên cấp bằng hành động thật tại điểm trên map. Điểm cấp cao đòi cấp nghề cao.</div>';
    Object.keys(api.PROFESSIONS).forEach(function (pid) {
      var def = api.PROFESSIONS[pid];
      var st = player.professions[pid];
      var maxed = st.level >= def.maxLevel;
      var need = api.EXP_THRESHOLDS[st.level] || 1;
      var pct = maxed ? 100 : Math.min(100, Math.round(st.exp / need * 100));
      h += '<div class="n1-card"><div class="n1-card-name">' + esc(def.name) + ' — Cấp ' + st.level + '/' + def.maxLevel + '</div>';
      h += '<div class="n1-exp-track"><div class="n1-exp-fill" style="width:' + pct + '%;"></div></div>';
      h += '<div class="n1-card-sub">' + (maxed ? 'Đã đạt cấp tối đa.' : ('EXP: ' + st.exp + ' / ' + need)) + ' · ' + st.totalActions + ' lần hành động</div>';
      if (pid === 'herbalism') {
        h += '<div class="n1-card-sub">Luyện bằng cách hái dược liệu tại các điểm hái sẵn có trên map và giao đơn hàng.</div>';
      } else {
        var nodes = api.getGatherNodes().filter(function (nd) { return nd.profId === pid; });
        nodes.forEach(function (nd) {
          var mapName = nd.mapId;
          if (typeof window !== 'undefined' && window.GameMapData && window.GameMapData.getMap) {
            try { var m = window.GameMapData.getMap(nd.mapId); if (m && m.name) mapName = m.name; } catch (e) {}
          }
          var locked = st.level < nd.reqLevel;
          h += '<div class="n1-mat-row' + (locked ? ' n1-dim' : '') + '"><span>' + esc(nd.name) + ' (' + esc(mapName) + ')</span><span>Cần cấp ' + nd.reqLevel + (locked ? ' — khóa' : '') + '</span></div>';
        });
      }
      h += '</div>';
    });
    return h;
  }

  // ==========================================================================
  // KHUNG MODAL
  // ==========================================================================
  function renderPanel() {
    var body = document.getElementById('n1-body');
    if (!body) return;
    var player = getPlayer();
    if (!player) { body.innerHTML = '<div class="n1-card">Chưa có nhân vật.</div>'; return; }
    var tabs = ['forge', 'book', 'gear', 'orders', 'profs'];
    tabs.forEach(function (t) {
      var btn = document.getElementById('n1-tab-' + t);
      if (btn) {
        if (t === currentTab) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });
    var h = '';
    if (currentTab === 'forge') h = forgeTabHtml(player);
    else if (currentTab === 'book') h = bookTabHtml(player);
    else if (currentTab === 'gear') h = gearTabHtml(player);
    else if (currentTab === 'orders') h = ordersTabHtml(player);
    else if (currentTab === 'profs') h = profsTabHtml(player);
    body.innerHTML = h;
  }

  function openPanel(tab) {
    if (typeof document === 'undefined') return;
    if (tab) currentTab = tab;
    stopBoardTimer();
    wireOnce();
    var modal = document.getElementById('n1-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderPanel();
  }

  function closePanel() {
    stopBoardTimer();
    board.active = false;
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('n1-modal');
    if (modal) modal.classList.add('hidden');
  }

  function isPanelOpen() {
    if (typeof document === 'undefined') return false;
    var modal = document.getElementById('n1-modal');
    return !!modal && !modal.classList.contains('hidden');
  }

  function onAction(action, el) {
    var player = getPlayer();
    var api = n1();
    if (!player || !api) return;
    if (action === 'tab') {
      stopBoardTimer();
      board.active = false;
      currentTab = el.getAttribute('data-tab') || 'forge';
      renderPanel();
      return;
    }
    if (action === 'close') { closePanel(); return; }
    if (action === 'forge-start-board') {
      resetBoard();
      board.active = true;
      renderPanel();
      return;
    }
    if (action === 'forge-cancel-board') {
      resetBoard();
      renderPanel();
      return;
    }
    if (action === 'board-start') {
      // Vẽ lại trước để nút đổi thành “Dừng”, rồi mới chạy vạch trên
      // phần tử vừa vẽ (vẽ lại sau khi chạy sẽ xóa phần tử vạch).
      board.running = true;
      board.pos = 0;
      board.dir = 1;
      renderPanel();
      startStepTimer();
      return;
    }
    if (action === 'board-stop') {
      var sc = boardScore();
      stopBoardTimer();
      board.scores[BOARD_STEPS[board.step].key] = sc;
      if (board.step < BOARD_STEPS.length - 1) {
        board.step++;
      } else {
        board.done = true;
      }
      renderPanel();
      return;
    }
    if (action === 'forge-finish') {
      var res = api.calculateForgeResult(player, selectedBp, board.scores, selectedExtra || null);
      lastForgeResult = res;
      resetBoardKeepResult(res);
      refreshHUD();
      toast(res.msg || (res.ok ? 'Rèn xong.' : 'Rèn thất bại.'));
      renderPanel();
      return;
    }
    if (action === 'forge-quick') {
      var rq = api.quickForge(player, selectedBp, selectedExtra || null);
      lastForgeResult = rq;
      refreshHUD();
      toast(rq.msg || (rq.ok ? 'Rèn nhanh xong.' : 'Rèn nhanh thất bại.'));
      renderPanel();
      return;
    }
    if (action === 'book-learn') {
      var bpId = el.getAttribute('data-bp');
      var lr = api.learnBlueprint(player, bpId);
      if (lr.ok) {
        if (typeof window !== 'undefined' && window.GameTuiKho && window.GameTuiKho.removeItemFromPlayer) {
          window.GameTuiKho.removeItemFromPlayer(player, bpId, 1);
        }
        if (typeof window !== 'undefined' && window.GameState && window.GameState.savePlayer) window.GameState.savePlayer(player);
      }
      toast(lr.msg || (lr.ok ? 'Đã học.' : 'Không học được.'));
      refreshHUD();
      renderPanel();
      return;
    }
    if (action === 'gear-refine' || action === 'gear-reroll') {
      var c1 = el.getAttribute('data-c');
      var s1 = parseInt(el.getAttribute('data-s'), 10);
      var gr = action === 'gear-refine' ? api.refineGear(player, c1, s1) : api.rerollAffixes(player, c1, s1, selectedRerollElement);
      toast(gr.msg || '');
      refreshHUD();
      renderPanel();
      return;
    }
    if (action === 'gear-dismantle') {
      dismantleArm = el.getAttribute('data-c') + ':' + el.getAttribute('data-s');
      renderPanel();
      return;
    }
    if (action === 'gear-dismantle-confirm') {
      dismantleArm = null;
      var dr = api.dismantleGear(player, el.getAttribute('data-c'), parseInt(el.getAttribute('data-s'), 10));
      toast(dr.msg || '');
      refreshHUD();
      renderPanel();
      return;
    }
    if (action === 'gear-transfer-src') {
      transferFrom = { containerId: el.getAttribute('data-c'), slotIndex: parseInt(el.getAttribute('data-s'), 10) };
      renderPanel();
      return;
    }
    if (action === 'gear-transfer-cancel') {
      transferFrom = null;
      renderPanel();
      return;
    }
    if (action === 'gear-transfer-target') {
      if (!transferFrom) return;
      var tr = api.transferInheritance(player, transferFrom.containerId, transferFrom.slotIndex, el.getAttribute('data-c'), parseInt(el.getAttribute('data-s'), 10));
      transferFrom = null;
      toast(tr.msg || '');
      refreshHUD();
      renderPanel();
      return;
    }
    if (action === 'order-turnin') {
      var or = api.turnInOrder(player, el.getAttribute('data-order'));
      toast(or.msg || '');
      refreshHUD();
      renderPanel();
      return;
    }
  }

  function resetBoardKeepResult(res) {
    stopBoardTimer();
    board.active = false;
    board.step = 0;
    board.scores = {};
    board.pos = 0;
    board.dir = 1;
    board.done = false;
    lastForgeResult = res;
  }

  function wireOnce() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('n1-modal');
    if (!modal || modal.dataset.wired) return;
    modal.dataset.wired = '1';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) { closePanel(); return; }
      var el = e.target;
      while (el && el !== modal && !el.getAttribute('data-n1-action')) el = el.parentElement;
      if (!el || el === modal) return;
      var action = el.getAttribute('data-n1-action');
      if (el.disabled) return;
      onAction(action, el);
    });
    modal.addEventListener('change', function (e) {
      var el = e.target;
      var kind = el && el.getAttribute ? el.getAttribute('data-n1-select') : null;
      if (!kind) return;
      if (kind === 'blueprint') { selectedBp = el.value; resetBoard(); }
      if (kind === 'extra') { selectedExtra = el.value; }
      if (kind === 'reroll') { selectedRerollElement = el.value; }
      renderPanel();
    });
    var btnClose = document.getElementById('close-n1-modal');
    if (btnClose && !btnClose.dataset.wired) {
      btnClose.dataset.wired = '1';
      btnClose.addEventListener('click', function () { closePanel(); });
    }
    if (!document.body.dataset.n1EscWired) {
      document.body.dataset.n1EscWired = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var md = document.getElementById('n1-modal');
          if (md && !md.classList.contains('hidden')) closePanel();
        }
      });
    }
  }

  function attach(player) {
    livePlayer = player;
    if (typeof document === 'undefined') return;
    wireOnce();
  }

  exports.attach = attach;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;
  exports.isPanelOpen = isPanelOpen;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameN1UI = {}));
