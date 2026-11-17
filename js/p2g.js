/**
 * Đợt P2G — HẢO CẢM NPC + TUYẾN ẨN (P2-DESIGN §8; hồ sơ 16§8)
 *
 * Đợt này làm MỚI hoàn toàn: bản live chưa có hảo cảm NPC (mọi `affection`
 * trong mã cũ là của linh thú). Hệ này KHÔNG nối vào hệ linh thú.
 *
 * - Dữ liệu: `player.npcAffection`, khóa theo NPC id trong mapdata.js.
 * - NPC trọng điểm: đúng 4 NPC có nhiệm vụ HIỆN CÓ trong QUEST_DEFS
 *   (giver/turnIn) — Linh Nhi, Tiếp Dẫn Đệ Tử, Chưởng Môn, Chấp Sự Đường.
 *   Không bịa NPC mới.
 * - Tăng hảo cảm: tặng quà (vật phẩm HIỆN CÓ trong ITEM_DEFS) và giúp việc
 *   (nộp nhiệm vụ có turnIn tại NPC đó).
 * - Mốc: 1 đối thoại riêng, 2 giảm giá sạp, 3 tuyến ẩn. Mọi số PROVISIONAL.
 *
 * Mọi chữ thoại trong tệp này do đội viết theo cốt game — CHỜ BUI DUYỆT CHỮ.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // BẢNG HẰNG SỐ — TOÀN BỘ LÀ PROVISIONAL, CHỜ BUI PHÁN
  // ==========================================================================
  var C = {
    // Mốc hảo cảm (điểm). Dải tham khảo Vô Sắc nhưng KHÔNG copy số Vô Sắc.
    MILESTONES: [10, 30, 60],
    // Trần điểm quà mỗi NPC mỗi ngày (chống spam quà).
    GIFT_DAILY_CAP: 12,
    // Điểm quà theo độ quý của vật phẩm.
    GIFT_POINTS: { common: 2, uncommon: 4, rare: 6 },
    // Điểm mỗi lần giúp việc (nộp nhiệm vụ hiện có tại NPC).
    HELP_POINTS: 5,
    // Giảm giá sạp theo mốc: mốc 0..3.
    SHOP_DISCOUNT_BY_MILESTONE: [0, 0, 0.10, 0.15],
    // Hiện chỉ Chấp Sự Đường có sạp thật trong game (Tiệm Cống Hiến).
    SHOP_NPC: 'npc_chapsu'
  };

  // ==========================================================================
  // NPC TRỌNG ĐIỂM — tên/quà đều lấy từ dữ liệu HIỆN CÓ
  // ==========================================================================
  var NPC_DEFS = [
    {
      id: 'npc_linhnhi',
      giftLikes: [
        { itemId: 'linh-me', tier: 'common' },
        { itemId: 'com-linh-me', tier: 'common' },
        { itemId: 'com-linh-me-hap', tier: 'common' },
        { itemId: 'chao-linh-me', tier: 'common' },
        { itemId: 'hoa-giai-doc', tier: 'uncommon' },
        { itemId: 'linh-chi-rung', tier: 'uncommon' }
      ],
      lines: {
        1: ['Ca ca tới rồi! Muội để dành phần cơm Linh Mễ cho ca ca đấy — ăn no rồi mới luyện công được.'],
        3: ['Ca ca... muội nghe người trong tông đồn ở Miếu Hoang còn giữ một mẩu sổ tay của cha. Muội không dám nhắc, nhưng nếu có dịp về đó, ca xem giúp muội với.']
      },
      secretQuests: ['q_secret_linhnhi_1', 'q_secret_linhnhi_2'],
      hasStall: false
    },
    {
      id: 'npc_tiepdan',
      giftLikes: [
        { itemId: 'la-thanh-tuy', tier: 'common' },
        { itemId: 'to-nhen-xanh', tier: 'common' },
        { itemId: 'hat-giong-linh-me', tier: 'uncommon' },
        { itemId: 'linh-chi-rung', tier: 'uncommon' }
      ],
      lines: {
        1: ['Đạo hữu chịu khó lui tới như vậy, ta cũng đỡ đơn độc trông cổng. Có việc gì cứ gọi.'],
        3: ['Ta giữ cổng bao năm, từng thấy một người mang ấn cũ của tông xin vào rồi đi thẳng lên tháp. Ngươi muốn nghe đầu đuôi thì giúp ta dọn mấy con quái ngoài vành ngoài trước đã.']
      },
      secretQuests: ['q_secret_tiepdan_1', 'q_secret_tiepdan_2'],
      hasStall: false
    },
    {
      id: 'npc_chuongmon',
      giftLikes: [
        { itemId: 'ngoc-bang-tam', tier: 'uncommon' },
        { itemId: 'hon-kiem-nho', tier: 'uncommon' },
        { itemId: 'linh-chi-ngan-nam', tier: 'rare' },
        { itemId: 'bang-tuy-ngan-nam', tier: 'rare' }
      ],
      lines: {
        1: ['Tâm tính của ngươi, bản tọa đã để mắt. Tu luyện không vội một ngày, nhớ giữ sức.'],
        3: ['Cổ Vương dưới đáy Rừng Độc không phải quái thường. Hạ được nó, tàng kinh các mở cho ngươi một tầng sâu hơn — nhưng đi một mình là chết. Hãy chuẩn bị.']
      },
      secretQuests: ['q_secret_chuongmon_1', 'q_secret_chuongmon_2'],
      hasStall: false
    },
    {
      id: 'npc_chapsu',
      giftLikes: [
        { itemId: 'to-nhen-xanh', tier: 'common' },
        { itemId: 'la-thanh-tuy', tier: 'common' },
        { itemId: 'da-nung', tier: 'common' },
        { itemId: 'hat-giong-linh-me', tier: 'uncommon' },
        { itemId: 'cat-tinh', tier: 'uncommon' }
      ],
      lines: {
        1: ['Việc tông môn ngươi làm đều đặn, sổ sách của ta không một dòng trễ. Có thiếu gì cứ nói.'],
        3: ['Ngươi đã đủ tín để ta giao việc ngoài lệ: oan hồn quanh Miếu Hoang chưa ai đếm... Ta cần một người kín tiếng.']
      },
      secretQuests: ['q_secret_chapsu_1', 'q_secret_chapsu_2'],
      hasStall: true
    }
  ];

  // ==========================================================================
  // TIỆN ÍCH
  // ==========================================================================
  function getEngine() {
    return (typeof window !== 'undefined' && window.GameEngine) ? window.GameEngine : null;
  }
  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }
  function getQuestAPI() {
    if (typeof window !== 'undefined' && window.GameQuests) return window.GameQuests;
    if (typeof global !== 'undefined' && global.GameQuests) return global.GameQuests;
    try { return require('./quests.js'); } catch (e) { return null; }
  }
  function getItemDefs() {
    if (typeof window !== 'undefined' && window.GameMonsters && window.GameMonsters.ITEM_DEFS) return window.GameMonsters.ITEM_DEFS;
    if (typeof global !== 'undefined' && global.GameMonsters && global.GameMonsters.ITEM_DEFS) return global.GameMonsters.ITEM_DEFS;
    return null;
  }
  function getMapData() {
    if (typeof window === 'undefined') return null;
    return window.GameMapData || window.MapData || null;
  }
  function resolvePlayer(p) {
    if (p && typeof p === 'object') return p;
    var eng = getEngine();
    return (eng && eng.getPlayer) ? eng.getPlayer() : null;
  }
  function toast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(msg);
  }
  function save(player) {
    var st = getStateAPI();
    if (!st || !st.savePlayer || !player) return;
    try { st.savePlayer(player); } catch (e) {}
  }
  function refreshHUD() {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) window.GameUI.refreshHUD();
  }
  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  // Linh Nhi có HAI id trong mapdata.js: `npc_linhnhi` (Miếu Hoang, trước khi xuống
  // núi) và `npc_linhnhi_sect` (Tông Môn, sau khi nhập môn) — cùng một người. Gộp
  // về một hồ sơ hảo cảm, nếu không sau chương 1 bảng hảo cảm của cô ấy biến mất.
  var NPC_ALIASES = { npc_linhnhi_sect: 'npc_linhnhi' };
  function canonicalId(npcId) { return NPC_ALIASES[npcId] || npcId; }

  function npcDef(npcId) {
    var id = canonicalId(npcId);
    for (var i = 0; i < NPC_DEFS.length; i++) {
      if (NPC_DEFS[i].id === id) return NPC_DEFS[i];
    }
    return null;
  }

  function hasNpc(npcId) { return !!npcDef(npcId); }

  // Tên + ảnh lấy từ mapdata.js (nguồn thật), không chép tay.
  function npcDisplay(npcId) {
    var md = getMapData();
    if (md && md.maps) {
      for (var k in md.maps) {
        var m = md.maps[k];
        if (!m || !Array.isArray(m.npcs)) continue;
        for (var i = 0; i < m.npcs.length; i++) {
          if (m.npcs[i] && m.npcs[i].id === npcId) {
            return { name: m.npcs[i].name || npcId, asset: m.npcs[i].asset || '' };
          }
        }
      }
    }
    var fallback = {
      npc_linhnhi: 'Linh Nhi',
      npc_tiepdan: 'Tiếp Dẫn Đệ Tử',
      npc_chuongmon: 'Chưởng Môn',
      npc_chapsu: 'Chấp Sự Đường'
    };
    return { name: fallback[npcId] || npcId, asset: '' };
  }

  // ==========================================================================
  // TRẠNG THÁI
  // ==========================================================================
  function ensureState(player) {
    if (!player || typeof player !== 'object') return null;
    if (!player.npcAffection || typeof player.npcAffection !== 'object') player.npcAffection = {};
    for (var i = 0; i < NPC_DEFS.length; i++) {
      var id = NPC_DEFS[i].id;
      var s = player.npcAffection[id];
      if (!s || typeof s !== 'object') {
        s = { pts: 0, gifts: {}, giftDay: { date: '', pts: 0 }, helped: 0, said: {}, hint: null };
        player.npcAffection[id] = s;
      }
      if (typeof s.pts !== 'number' || !isFinite(s.pts)) s.pts = 0;
      if (!s.gifts || typeof s.gifts !== 'object') s.gifts = {};
      if (!s.giftDay || typeof s.giftDay !== 'object') s.giftDay = { date: '', pts: 0 };
      if (typeof s.giftDay.pts !== 'number' || !isFinite(s.giftDay.pts)) s.giftDay.pts = 0;
      if (typeof s.giftDay.date !== 'string') s.giftDay.date = '';
      if (typeof s.helped !== 'number' || !isFinite(s.helped)) s.helped = 0;
      if (!s.said || typeof s.said !== 'object') s.said = {};
      if (typeof s.hint !== 'string') s.hint = null;
    }
    return player.npcAffection;
  }

  function getState(player, npcId) {
    var all = ensureState(resolvePlayer(player));
    return all ? (all[canonicalId(npcId)] || null) : null;
  }

  function milestoneOf(points) {
    var p = (typeof points === 'number' && isFinite(points)) ? points : 0;
    var m = 0;
    for (var i = 0; i < C.MILESTONES.length; i++) {
      if (p >= C.MILESTONES[i]) m = i + 1;
    }
    return m;
  }

  function nextThreshold(points) {
    var p = (typeof points === 'number' && isFinite(points)) ? points : 0;
    for (var i = 0; i < C.MILESTONES.length; i++) {
      if (p < C.MILESTONES[i]) return C.MILESTONES[i];
    }
    return null;
  }

  function addPoints(player, npcIdRaw, n, reason) {
    var npcId = canonicalId(npcIdRaw);
    var p = resolvePlayer(player);
    var st = ensureState(p);
    if (!st || !st[npcId]) return { ok: false };
    var def = npcDef(npcId);
    if (!def) return { ok: false };
    var amount = (typeof n === 'number' && isFinite(n)) ? n : 0;
    if (amount <= 0) return { ok: false };
    var s = st[npcId];
    var before = milestoneOf(s.pts);
    s.pts += amount;
    if (reason === 'help') s.helped += 1;
    var after = milestoneOf(s.pts);
    save(p);
    if (after > before) {
      var name = npcDisplay(npcId).name;
      toast('Hảo cảm với ' + name + ' mở mốc ' + after + ': ' + milestoneLabel(after, def) + '.');
    }
    return { ok: true, pts: s.pts, milestone: after, gained: amount, milestoneUp: after > before };
  }

  function milestoneLabel(m, def) {
    if (m === 1) return 'Đối thoại riêng';
    if (m === 2) return def && def.hasStall ? 'Giảm giá sạp' : 'Giảm giá sạp (sạp chưa mở)';
    if (m === 3) return 'Tuyến ẩn';
    return 'Chưa mở';
  }

  // ==========================================================================
  // TẶNG QUÀ
  // ==========================================================================
  function countInBag(player, itemId) {
    var st = getStateAPI();
    return (st && st.countItemInBag) ? st.countItemInBag(player, itemId) : 0;
  }

  function giftItem(npcIdRaw, itemId, playerArg) {
    var npcId = canonicalId(npcIdRaw);
    var player = resolvePlayer(playerArg);
    var def = npcDef(npcId);
    if (!player || !def) return { ok: false, msg: 'Không tìm thấy NPC/người chơi.' };

    var like = null;
    for (var i = 0; i < def.giftLikes.length; i++) {
      if (def.giftLikes[i].itemId === itemId) { like = def.giftLikes[i]; break; }
    }
    if (!like) return { ok: false, msg: 'NPC không nhận vật phẩm này.' };

    var itemDefs = getItemDefs();
    if (!itemDefs || !itemDefs[itemId]) return { ok: false, msg: 'Vật phẩm không tồn tại trong game.' };

    if (countInBag(player, itemId) < 1) return { ok: false, msg: 'Trong túi không còn vật phẩm này.' };

    var st = ensureState(player);
    var s = st[npcId];
    var today = todayKey();
    if (s.giftDay.date !== today) {
      s.giftDay.date = today;
      s.giftDay.pts = 0;
    }
    if (s.giftDay.pts >= C.GIFT_DAILY_CAP) {
      return { ok: false, msg: 'Hôm nay đã tặng đủ cho NPC này (trần ' + C.GIFT_DAILY_CAP + ' điểm quà/ngày).' };
    }

    var stAPI = getStateAPI();
    if (!stAPI || !stAPI.removeItemFromBag) return { ok: false, msg: 'GameState chưa sẵn sàng.' };

    var gained = C.GIFT_POINTS[like.tier] || C.GIFT_POINTS.common;
    if (s.giftDay.pts + gained > C.GIFT_DAILY_CAP) gained = C.GIFT_DAILY_CAP - s.giftDay.pts;
    if (gained <= 0) return { ok: false, msg: 'Hôm nay đã tặng đủ cho NPC này.' };

    stAPI.removeItemFromBag(player, itemId, 1);
    s.giftDay.pts += gained;
    s.gifts[itemId] = (s.gifts[itemId] || 0) + 1;

    var res = addPoints(player, npcId, gained, 'gift');
    save(player);
    refreshHUD();
    if (res && res.ok) {
      var name = npcDisplay(npcId).name;
      return {
        ok: true,
        msg: 'Tặng ' + (itemDefs[itemId].name || itemId) + ' cho ' + name + ' (+' + gained + ' hảo cảm).',
        gained: gained,
        pts: res.pts
      };
    }
    return { ok: false, msg: 'Không tặng được.' };
  }

  // ==========================================================================
  // GIÚP VIỆC — gọi từ quests.js khi nộp nhiệm vụ
  // ==========================================================================
  function onQuestTurnedIn(player, def) {
    var p = resolvePlayer(player);
    if (!p || !def) return;
    var npcId = canonicalId((def.turnIn && def.turnIn.npcId) || (def.giver && def.giver.npcId) || null);
    if (!npcId || !npcDef(npcId)) return;
    addPoints(p, npcId, C.HELP_POINTS, 'help');
    if (def.type === 'npc_secret' && def.p2gFinal && def.p2gHint) {
      var st = ensureState(p);
      if (st && st[npcId]) {
        st[npcId].hint = def.p2gHint;
        save(p);
      }
    }
  }

  // ==========================================================================
  // ĐỐI THOẠI RIÊNG (nối ở ui.js openDialogue)
  // ==========================================================================
  function extraDialogueFor(npcIdRaw, playerArg) {
    var npcId = canonicalId(npcIdRaw);
    var def = npcDef(npcId);
    var player = resolvePlayer(playerArg);
    if (!def || !player) return [];
    var st = ensureState(player);
    if (!st || !st[npcId]) return [];
    var s = st[npcId];
    var m = milestoneOf(s.pts);
    var out = [];
    var changed = false;
    var keys = [1, 3];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (m >= k && !s.said[k] && def.lines[k]) {
        out = out.concat(def.lines[k]);
        s.said[k] = true;
        changed = true;
      }
    }
    if (changed) save(player);
    return out;
  }

  // ==========================================================================
  // GIẢM GIÁ SẠP (nối ở quests.js getSectShopItems/buySectShopItem)
  // ==========================================================================
  function shopDiscount(npcIdRaw, playerArg) {
    var npcId = canonicalId(npcIdRaw);
    if (npcId !== C.SHOP_NPC) return 0;
    var player = resolvePlayer(playerArg);
    if (!player) return 0;
    var st = ensureState(player);
    if (!st || !st[npcId]) return 0;
    var m = milestoneOf(st[npcId].pts);
    return C.SHOP_DISCOUNT_BY_MILESTONE[m] || 0;
  }

  // ==========================================================================
  // TUYẾN ẨN
  // ==========================================================================
  function secretStatus(npcIdRaw, playerArg) {
    var npcId = canonicalId(npcIdRaw);
    var def = npcDef(npcId);
    var player = resolvePlayer(playerArg);
    if (!def || !player) return [];
    var qAPI = getQuestAPI();
    if (!qAPI) return [];
    var st = ensureState(player);
    var s = st ? st[npcId] : null;
    var unlocked = s ? milestoneOf(s.pts) >= 3 : false;
    var out = [];
    var prevCompleted = true;
    for (var i = 0; i < def.secretQuests.length; i++) {
      var qid = def.secretQuests[i];
      var qd = qAPI.getQuestDef ? qAPI.getQuestDef(qid) : null;
      if (!qd) continue;
      var status = 'locked';
      if (unlocked && prevCompleted) {
        if (qAPI.isQuestCompleted(player, qid)) {
          status = 'completed';
        } else if (qAPI.isQuestActive(player, qid)) {
          var chk = qAPI.canTurnInQuest ? qAPI.canTurnInQuest(player, qid) : { ok: false };
          status = chk.ok ? 'ready' : 'active';
        } else {
          status = 'available';
        }
      }
      prevCompleted = qAPI.isQuestCompleted(player, qid);
      out.push({ questId: qid, def: qd, status: status });
    }
    return out;
  }

  // Chặn mốc ở tầng API (không chỉ ẩn nút): nhiệm vụ tuyến ẩn chỉ nhận được khi
  // NPC đã đạt mốc 3 và đã xong bước trước của chuỗi.
  function canAcceptSecret(questId, playerArg) {
    var player = resolvePlayer(playerArg);
    var qAPI = getQuestAPI();
    if (!player || !qAPI) return { ok: false, reason: 'not_ready', msg: 'Hệ nhiệm vụ chưa sẵn sàng.' };
    var owner = null, idx = -1;
    for (var i = 0; i < NPC_DEFS.length && !owner; i++) {
      var j = NPC_DEFS[i].secretQuests.indexOf(questId);
      if (j >= 0) { owner = NPC_DEFS[i]; idx = j; }
    }
    if (!owner) return { ok: false, reason: 'not_secret', msg: 'Không phải tuyến ẩn của NPC trọng điểm.' };
    var st = ensureState(player);
    var s = st ? st[owner.id] : null;
    if (!s || milestoneOf(s.pts) < 3) {
      return { ok: false, reason: 'affection_low', msg: 'Hảo cảm chưa đạt mốc 3 — chưa mở tuyến ẩn.' };
    }
    if (idx > 0) {
      var prevId = owner.secretQuests[idx - 1];
      if (!qAPI.isQuestCompleted(player, prevId)) {
        return { ok: false, reason: 'prereq_missing', msg: 'Phải xong bước trước của tuyến ẩn.' };
      }
    }
    return { ok: true };
  }

  function acceptSecret(questId, playerArg) {
    var player = resolvePlayer(playerArg);
    var qAPI = getQuestAPI();
    if (!player || !qAPI || !qAPI.acceptQuest) return { ok: false, msg: 'Hệ nhiệm vụ chưa sẵn sàng.' };
    var gate = canAcceptSecret(questId, player);
    if (!gate.ok) {
      if (gate.msg) toast(gate.msg);
      return gate;
    }
    return qAPI.acceptQuest(player, questId);
  }

  function turnInSecret(questId, playerArg) {
    var player = resolvePlayer(playerArg);
    var qAPI = getQuestAPI();
    if (!player || !qAPI || !qAPI.turnInQuest) return { ok: false, msg: 'Hệ nhiệm vụ chưa sẵn sàng.' };
    return qAPI.turnInQuest(player, questId);
  }

  // ==========================================================================
  // GIAO DIỆN
  // ==========================================================================
  var modalEl = null, modalBodyEl = null, modalTitleEl = null;
  var currentNpcId = null;

  function buildModal() {
    if (typeof document === 'undefined' || modalEl) return;
    modalEl = document.createElement('div');
    modalEl.id = 'p2g-modal';
    modalEl.className = 'modal-overlay hidden';

    var box = document.createElement('div');
    box.className = 'panel modal-box';

    var header = document.createElement('div');
    header.className = 'modal-header';
    modalTitleEl = document.createElement('h2');
    modalTitleEl.className = 'modal-title';
    modalTitleEl.textContent = 'HẢO CẢM';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(modalTitleEl);
    header.appendChild(closeBtn);

    modalBodyEl = document.createElement('div');
    modalBodyEl.id = 'p2g-body';
    modalBodyEl.style.cssText = 'padding:6px 4px 2px;font-size:13px;line-height:1.8;max-height:66vh;overflow:auto;';

    var actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.style.marginTop = '12px';
    var closeBottom = document.createElement('button');
    closeBottom.type = 'button';
    closeBottom.className = 'btn wood';
    closeBottom.textContent = 'Đóng';
    closeBottom.addEventListener('click', closeModal);
    actions.appendChild(closeBottom);

    box.appendChild(header);
    box.appendChild(modalBodyEl);
    box.appendChild(actions);
    modalEl.appendChild(box);
    modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
    document.body.appendChild(modalEl);
  }

  function barHtml(pts) {
    var nxt = nextThreshold(pts);
    var prev = 0;
    var m = milestoneOf(pts);
    if (m > 0) prev = C.MILESTONES[m - 1];
    var pct = 100;
    var label = 'Đã đạt mốc cao nhất (' + C.MILESTONES[C.MILESTONES.length - 1] + ').';
    if (nxt !== null) {
      pct = Math.max(0, Math.min(100, Math.round(((pts - prev) / (nxt - prev)) * 100)));
      label = 'Còn ' + (nxt - pts) + ' điểm tới mốc ' + (m + 1);
    }
    return '<div style="background:#1e1a12;border:1px solid rgba(200,180,120,.35);border-radius:6px;height:12px;overflow:hidden;">' +
      '<div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#7a5b1f,#d8b94a);"></div></div>' +
      '<div style="font-size:11px;color:#c9b98a;">' + label + '</div>';
  }

  function renderModal() {
    if (!modalBodyEl || !currentNpcId) return;
    var player = resolvePlayer(null);
    var def = npcDef(currentNpcId);
    if (!def) return;
    var disp = npcDisplay(currentNpcId);
    var st = ensureState(player);
    var s = st ? st[currentNpcId] : null;
    var pts = s ? s.pts : 0;
    var m = milestoneOf(pts);
    var itemDefs = getItemDefs() || {};

    if (modalTitleEl) modalTitleEl.textContent = 'HẢO CẢM — ' + disp.name;

    var html = '';
    html += '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">';
    if (disp.asset) {
      html += '<div style="width:56px;height:96px;flex:0 0 56px;background-image:url(' + disp.asset + ');background-size:contain;background-repeat:no-repeat;background-position:center bottom;"></div>';
    }
    html += '<div style="flex:1;">';
    html += '<div><b>' + disp.name + '</b> · Hảo cảm: <b style="color:#ffd700;">' + pts + '</b> điểm (mốc ' + m + '/' + C.MILESTONES.length + ')</div>';
    html += barHtml(pts);
    html += '</div></div>';

    // Mốc
    html += '<h3 class="section-title" style="margin-top:8px;">Mốc Mở Dần</h3>';
    for (var i = 0; i < C.MILESTONES.length; i++) {
      var lvl = i + 1;
      var open = m >= lvl;
      html += '<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed rgba(200,180,120,.18);padding:3px 0;">' +
        '<span>' + (open ? '✓ ' : '○ ') + 'Mốc ' + lvl + ' (' + C.MILESTONES[i] + ' điểm)</span>' +
        '<b style="color:' + (open ? '#9fe870' : '#ffe9a8') + ';">' + milestoneLabel(lvl, def) + '</b></div>';
    }
    if (!def.hasStall) {
      html += '<div style="font-size:11px;color:#9a8f76;">NPC này chưa có sạp trong game — mốc giảm giá đã ghi dữ liệu, chờ mở sạp.</div>';
    } else {
      var disc = Math.round(shopDiscount(currentNpcId, player) * 100);
      html += '<div style="font-size:11px;color:#9a8f76;">Sạp Tiệm Cống Hiến: giảm ' + disc + '% Linh Thạch' +
        (disc > 0 ? ' (đang áp dụng)' : '') + '.</div>';
    }

    // Tặng quà
    html += '<h3 class="section-title" style="margin-top:10px;">Tặng Quà</h3>';
    var usedToday = (s && s.giftDay && s.giftDay.date === todayKey()) ? s.giftDay.pts : 0;
    html += '<div style="font-size:11px;color:#9a8f76;margin-bottom:4px;">Điểm quà hôm nay: ' + usedToday + '/' + C.GIFT_DAILY_CAP + '. Trần chống spam (PROVISIONAL).</div>';
    var anyItem = false;
    for (var g = 0; g < def.giftLikes.length; g++) {
      var like = def.giftLikes[g];
      var idef = itemDefs[like.itemId];
      if (!idef) continue; // vật phẩm không có trong ITEM_DEFS -> bỏ, không bịa
      var have = countInBag(player, like.itemId);
      if (have <= 0) continue;
      anyItem = true;
      var gain = C.GIFT_POINTS[like.tier] || C.GIFT_POINTS.common;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px dashed rgba(200,180,120,.18);padding:3px 0;">' +
        '<span>' + idef.name + ' <span style="color:#9a8f76;font-size:11px;">(có ' + have + ')</span></span>' +
        '<span style="display:flex;gap:6px;align-items:center;">' +
        '<b style="color:#ffd700;font-size:11px;">+' + gain + '</b>' +
        '<button type="button" class="btn wood" data-p2g-gift="' + like.itemId + '" style="font-size:11px;padding:2px 8px;">Tặng</button>' +
        '</span></div>';
    }
    if (!anyItem) {
      var wish = [];
      for (var w = 0; w < def.giftLikes.length; w++) {
        var wd = itemDefs[def.giftLikes[w].itemId];
        if (wd) wish.push(wd.name);
      }
      html += '<div style="font-size:12px;color:#9a8f76;">Trong túi chưa có món nào NPC thích. Món ưa thích: ' + wish.join(', ') + '.</div>';
    }

    // Giúp việc
    html += '<h3 class="section-title" style="margin-top:10px;">Giúp Việc</h3>';
    html += '<div style="font-size:12px;">Số việc đã giúp: <b>' + (s ? s.helped : 0) + '</b> · mỗi lần nộp nhiệm vụ của NPC: <b style="color:#ffd700;">+' + C.HELP_POINTS + '</b> hảo cảm.</div>';

    // Tuyến ẩn
    var sq = secretStatus(currentNpcId, player);
    if (sq.length > 0) {
      html += '<h3 class="section-title" style="margin-top:10px;">Tuyến Ẩn</h3>';
      if (m < 3) {
        html += '<div style="font-size:12px;color:#9a8f76;">Mở ở mốc 3 (' + C.MILESTONES[2] + ' điểm). Hiện ' + pts + ' điểm.</div>';
      }
      for (var q = 0; q < sq.length; q++) {
        var it = sq[q];
        var lockedHere = it.status === 'locked';
        html += '<div style="border-bottom:1px dashed rgba(200,180,120,.18);padding:4px 0;">';
        // Tuyến ẩn chưa mở thì không để lộ tên/nội dung (chỉ hiện khi đã đạt mốc 3).
        html += '<div><b>' + (lockedHere ? '???' : it.def.title) + '</b>' +
          (lockedHere ? '' : ' <span style="font-size:11px;color:#9a8f76;">(tên tạm, chờ Bui chốt)</span>') + '</div>';
        if (!lockedHere) html += '<div style="font-size:12px;color:#c9b98a;">' + it.def.desc + '</div>';
        if (lockedHere) {
          html += '<div style="font-size:11px;color:#ff9a7a;">Chưa mở: cần mốc 3 và xong bước trước.</div>';
        } else if (it.status === 'completed') {
          html += '<div style="font-size:11px;color:#9fe870;">✓ Đã hoàn thành.</div>';
        } else if (it.status === 'available') {
          html += '<button type="button" class="btn wood" data-p2g-secret-accept="' + it.questId + '" style="font-size:11px;padding:2px 8px;margin-top:2px;">Nhận tuyến ẩn</button>';
        } else if (it.status === 'active') {
          html += '<div style="font-size:11px;color:#ffe9a8;">' + objectiveProgress(player, it.questId, it.def) + '</div>';
        } else if (it.status === 'ready') {
          html += '<div style="font-size:11px;color:#9fe870;">Đã đủ điều kiện nộp.</div>';
          html += '<button type="button" class="btn wood" data-p2g-secret-turnin="' + it.questId + '" style="font-size:11px;padding:2px 8px;margin-top:2px;">Nộp tuyến ẩn</button>';
        }
        html += '</div>';
      }
    }

    if (s && s.hint) {
      html += '<h3 class="section-title" style="margin-top:10px;">Manh Mối Kỳ Ngộ</h3>';
      html += '<div style="font-size:12px;color:#ffe9a8;">' + s.hint + '</div>';
    }

    modalBodyEl.innerHTML = html;

    var giftBtns = modalBodyEl.querySelectorAll('[data-p2g-gift]');
    for (var gb = 0; gb < giftBtns.length; gb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var r = giftItem(currentNpcId, btn.getAttribute('data-p2g-gift'));
          if (r && r.msg) toast(r.msg);
          renderModal();
        });
      })(giftBtns[gb]);
    }

    var accBtns = modalBodyEl.querySelectorAll('[data-p2g-secret-accept]');
    for (var ab = 0; ab < accBtns.length; ab++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var r = acceptSecret(btn.getAttribute('data-p2g-secret-accept'));
          if (r && r.msg) toast(r.msg);
          renderModal();
        });
      })(accBtns[ab]);
    }

    var tinBtns = modalBodyEl.querySelectorAll('[data-p2g-secret-turnin]');
    for (var tb = 0; tb < tinBtns.length; tb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var r = turnInSecret(btn.getAttribute('data-p2g-secret-turnin'));
          if (r && r.msg) toast(r.msg);
          renderModal();
        });
      })(tinBtns[tb]);
    }
  }

  function objectiveProgress(player, questId, def) {
    var prog = player && player.questState && player.questState.active ? player.questState.active[questId] : null;
    if (!prog || !def.objectives) return '';
    var parts = [];
    for (var i = 0; i < def.objectives.length; i++) {
      var o = def.objectives[i];
      var cur = (prog.objectives && prog.objectives[o.id]) ? prog.objectives[o.id].current : 0;
      parts.push(cur + '/' + (o.needed || 1));
    }
    return 'Tiến độ: ' + parts.join(', ');
  }

  function openModal(npcIdRaw) {
    var npcId = canonicalId(npcIdRaw);
    if (!npcDef(npcId)) return;
    currentNpcId = npcId;
    buildModal();
    if (!modalEl) return;
    renderModal();
    modalEl.classList.remove('hidden');
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
  }

  function init() {
    if (typeof window === 'undefined') return;
    buildModal();
  }

  exports.CONST = C;
  exports.NPC_DEFS = NPC_DEFS;
  exports.ensureState = ensureState;
  exports.getState = getState;
  exports.milestoneOf = milestoneOf;
  exports.addPoints = addPoints;
  exports.giftItem = giftItem;
  exports.onQuestTurnedIn = onQuestTurnedIn;
  exports.extraDialogueFor = extraDialogueFor;
  exports.shopDiscount = shopDiscount;
  exports.hasNpc = hasNpc;
  exports.secretStatus = secretStatus;
  exports.canAcceptSecret = canAcceptSecret;
  exports.acceptSecret = acceptSecret;
  exports.turnInSecret = turnInSecret;
  exports.openModal = openModal;
  exports.closeModal = closeModal;

  if (typeof window !== 'undefined') {
    window.GameP2G = exports;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof module !== 'undefined' && module.exports ? module.exports : {});
