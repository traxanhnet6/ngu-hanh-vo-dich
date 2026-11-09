/**
 * danphong.js — ĐAN PHÒNG tông môn + BẢNG NHIỆM VỤ THU THẬP (Đợt DANPHONG
 * 2026-11-09, lệnh Bui 18:53–18:54: "Tạo các nhiệm vụ để thu thập nguyên liệu
 * tăng cấp luyện khí" + "Cày nguyên liệu để chế đan nâng cấp" + "Nhờ đan phòng
 * chế đan").
 *
 * Vòng lặp: cày nguyên liệu theo vùng/hệ -> về Đan Phòng ở Tông Môn luyện
 * Tu Luyện Đan bằng NGUYÊN LIỆU (mới) -> dùng đan tăng tu vi từng đường ->
 * leo tầng Luyện Khí. Bảng nhiệm vụ thu thập do Chấp Sự giao (nhận/trả tại
 * Chấp Sự, lặp lại được, mở theo tiến độ) nuôi vòng lặp bằng Linh Thạch và
 * đan thưởng; dẫn đường của nhiệm vụ bảng đi qua getQuestTargetInfo của
 * engine (móc duy nhất ở engine.js) nên dùng chung mũi tên + dấu chỉ đường +
 * Tự Tìm Đường của chuỗi chính.
 *
 * Giữ nguyên không đụng: đường đổi nhanh 15 Linh Thạch/viên ở thoại Chấp Sự
 * (engine.exchangePill), công thức Trúc Cơ Đan (engine.refineTrucCoDan —
 * bảng Đan Phòng chỉ hiển thị lại đúng danh sách nguyên liệu đó và gọi đúng
 * hàm đó), hiệu lực đan +20 tu vi/viên (engine.useItem), chuỗi nhiệm vụ
 * chính mainStage.
 *
 * Mọi con số MỚI của đợt này (nguyên liệu từng công thức, số lượng mục tiêu
 * và phần thưởng của nhiệm vụ bảng) đều là SỐ ĐỘI SOẠN — ghi rõ trong báo cáo
 * đợt tại docs/danphong-report.md. Tỉ lệ luyện thành Tu Luyện Đan: 100%
 * (không bịa cơ chế luyện hỏng).
 *
 * Trạng thái lưu trong player.danPhong, khởi tạo lười để tương thích save cũ.
 * Node-loadable & chạy trên trình duyệt (khuôn mẫu linhdien.js).
 */

(function (exports) {
  'use strict';

  var ELEM_NAMES = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  var RANK_LABELS = { 4: 'Luyện Khí tầng 4', 7: 'Luyện Khí tầng 7', 10: 'Trúc Cơ Sơ Kỳ', 11: 'Trúc Cơ Trung Kỳ' };

  // ---------------------------------------------------------------------------
  // CÔNG THỨC LUYỆN TU LUYỆN ĐAN BẰNG NGUYÊN LIỆU (số đội soạn đợt DANPHONG)
  // Mỗi công thức chỉ dùng nguyên liệu thật sự rơi/thu hái được ở vùng mở
  // tương ứng với mốc mở khóa (đã đối chiếu bảng rơi trong monsters.js và
  // điểm thu hái trong mapdata.js — xem bảng kiểm chứng tiền đề ở báo cáo đợt).
  // ---------------------------------------------------------------------------
  var RECIPES = [
    {
      elem: 'moc', pillId: 'dan-moc', minRank: 0,
      materials: [
        { itemId: 'la-thanh-tuy', count: 3 },
        { itemId: 'linh-chi-rung', count: 1 }
      ],
      sourceNote: 'Lá Thanh Tụy: Thảo Tinh ở Rừng Độc (rơi 70%) và luống dược ở Tông Môn. Linh Chi Rừng: điểm hái ở Sơn Cốc.'
    },
    {
      elem: 'thuy', pillId: 'dan-thuy', minRank: 4,
      materials: [
        { itemId: 'bang-tinh', count: 3 },
        { itemId: 'ngoc-bang-tam', count: 1 }
      ],
      sourceNote: 'Băng Tinh: Băng Tinh Linh ở Hồ Băng (rơi 50%). Ngọc Băng Tâm: Hàn Kính Thủy Xà tinh anh ở Hồ Băng (rơi 100%).'
    },
    {
      elem: 'hoa', pillId: 'dan-hoa', minRank: 7,
      materials: [
        { itemId: 'hoa-tinh-tho', count: 2 },
        { itemId: 'da-nung', count: 2 }
      ],
      sourceNote: 'Hỏa Tinh Thổ và Đá Nung: Hỏa Nham Thú (70%/55%) và Xích Diệm Ma tinh anh (100%/70%) ở Mỏ Lửa.'
    },
    {
      elem: 'tho', pillId: 'dan-tho', minRank: 10,
      materials: [
        { itemId: 'cat-tinh', count: 3 },
        { itemId: 'ngoc-cat-tam', count: 1 }
      ],
      sourceNote: 'Cát Tinh: Hoàng Sa Trùng ở Hoang Mạc (rơi 60%). Ngọc Cát Tâm: Sa Thạch Tượng tinh anh ở Hoang Mạc (rơi 100%).'
    },
    {
      elem: 'kim', pillId: 'dan-kim', minRank: 11,
      materials: [
        { itemId: 'hon-kiem-nho', count: 3 },
        { itemId: 'manh-kiem-gay', count: 2 }
      ],
      sourceNote: 'Hồn Kiếm Nhỏ và Mảnh Kiếm Gãy: Tàn Kiếm Linh ở Kiếm Trủng (rơi 55%/30%).'
    }
  ];

  // Danh sách nguyên liệu Trúc Cơ Đan CHỈ ĐỂ HIỂN THỊ trong bảng Đan Phòng.
  // Việc trừ đồ/cấp đan do engine.refineTrucCoDan đảm nhiệm (nguồn sự thật
  // duy nhất); danh sách này phải khớp engine.js — refineTrucCoDan tự báo
  // thiếu nguyên liệu theo đúng các mục này.
  var TRUC_CO_DISPLAY = [
    { itemId: 'linh-chi-rung', count: 3 },
    { itemId: 'bang-tuy', count: 1 },
    { itemId: 'hoa-tinh-tho', count: 2 },
    { itemId: 'nguyen-tinh-moc', count: 1 },
    { itemId: 'nguyen-tinh-thuy', count: 1 }
  ];
  var TRUC_CO_LINH_THACH = 200;

  // ---------------------------------------------------------------------------
  // BẢNG NHIỆM VỤ THU THẬP (số đội soạn đợt DANPHONG)
  // Mô hình "thu thập và nộp": tiến độ = số vật phẩm mục tiêu đang có trong
  // túi; đủ số thì về trả Chấp Sự, nộp vật phẩm và nhận thưởng. Lặp lại được
  // không giới hạn (sau khi trả, nhiệm vụ quay lại bảng). Mỗi lần chỉ nhận
  // MỘT nhiệm vụ bảng để dẫn đường luôn rõ ràng.
  // kind/speciesId/x/y là đích dẫn đường THẬT: quái đích theo bãi quái của
  // mapdata, điểm hái theo đúng điểm thu hái trong mapdata.
  // ---------------------------------------------------------------------------
  var BOARD_QUESTS = [
    {
      id: 'q_moc_la', name: 'Thu Thập Lá Thanh Tụy', elem: 'moc',
      itemId: 'la-thanh-tuy', need: 6, minRank: 0,
      mapId: 'rung-doc', zoneName: 'Rừng Độc Thanh Tụy', kind: 'hunt',
      rewardLT: 30, rewardDanElem: 'moc',
      desc: 'Hái và săn Thảo Tinh ở Rừng Độc để thu thập Lá Thanh Tụy — dược liệu nền của Mộc Linh Đan.'
    },
    {
      id: 'q_moc_to', name: 'Săn Tơ Nhện Xanh', elem: 'moc',
      itemId: 'to-nhen-xanh', need: 4, minRank: 0,
      mapId: 'rung-doc', zoneName: 'Rừng Độc Thanh Tụy', kind: 'monster', speciesId: 'nhen_xanh',
      rewardLT: 40, rewardDanElem: null,
      desc: 'Hạ Nhện Rừng Xanh ở Rừng Độc, thu Tơ Nhện Xanh về cho Đan Phòng dệt túi đựng đan.'
    },
    {
      id: 'q_moc_linhchi', name: 'Hái Linh Chi Rừng', elem: 'moc',
      itemId: 'linh-chi-rung', need: 3, minRank: 0,
      mapId: 'son-coc', zoneName: 'Sơn Cốc', kind: 'point', x: 200, y: 600,
      rewardLT: 45, rewardDanElem: 'moc',
      desc: 'Lên Sơn Cốc hái Linh Chi Rừng — nguyên liệu chính luyện Mộc Linh Đan và Trúc Cơ Đan.'
    },
    {
      id: 'q_thuy_tinh', name: 'Thu Băng Tinh', elem: 'thuy',
      itemId: 'bang-tinh', need: 5, minRank: 4,
      mapId: 'ho-bang', zoneName: 'Hồ Băng Hàn Kính', kind: 'monster', speciesId: 'bang_tinh',
      rewardLT: 60, rewardDanElem: 'thuy',
      desc: 'Hạ Băng Tinh Linh ở Hồ Băng Hàn Kính, thu Băng Tinh về luyện Thủy Linh Đan.'
    },
    {
      id: 'q_thuy_ngoc', name: 'Ngọc Băng Tâm', elem: 'thuy',
      itemId: 'ngoc-bang-tam', need: 1, minRank: 4,
      mapId: 'ho-bang', zoneName: 'Hồ Băng Hàn Kính', kind: 'monster', speciesId: 'han_xa',
      rewardLT: 80, rewardDanElem: null,
      desc: 'Hạ Hàn Kính Thủy Xà tinh anh ở Hồ Băng, đoạt Ngọc Băng Tâm — tim băng của Thủy Linh Đan.'
    },
    {
      id: 'q_hoa_danung', name: 'Đá Nung Lò Lửa', elem: 'hoa',
      itemId: 'da-nung', need: 4, minRank: 7,
      mapId: 'mo-lua', zoneName: 'Mỏ Lửa Xích Diệm', kind: 'monster', speciesId: 'hoa_thu',
      rewardLT: 70, rewardDanElem: 'hoa',
      desc: 'Hạ Hỏa Nham Thú ở Mỏ Lửa Xích Diệm, thu Đá Nung về lót lò luyện Hỏa Linh Đan.'
    },
    {
      id: 'q_hoa_tinh', name: 'Hỏa Tinh Thổ', elem: 'hoa',
      itemId: 'hoa-tinh-tho', need: 2, minRank: 7,
      mapId: 'mo-lua', zoneName: 'Mỏ Lửa Xích Diệm', kind: 'monster', speciesId: 'diem_ma',
      rewardLT: 90, rewardDanElem: null,
      desc: 'Hạ Xích Diệm Ma tinh anh ở Mỏ Lửa, thu Hỏa Tinh Thổ — nguyên liệu của Hỏa Linh Đan và Trúc Cơ Đan.'
    },
    {
      id: 'q_tho_cat', name: 'Cát Tinh Hoàng Sa', elem: 'tho',
      itemId: 'cat-tinh', need: 4, minRank: 10,
      mapId: 'hoang-mac', zoneName: 'Hoang Mạc Hoàng Sa', kind: 'monster', speciesId: 'sa_trung',
      rewardLT: 100, rewardDanElem: 'tho',
      desc: 'Hạ Hoàng Sa Trùng ở Hoang Mạc, thu Cát Tinh về luyện Thổ Linh Đan.'
    },
    {
      id: 'q_kim_hon', name: 'Hồn Kiếm Trủng', elem: 'kim',
      itemId: 'hon-kiem-nho', need: 3, minRank: 11,
      mapId: 'kiem-trung', zoneName: 'Kiếm Trủng Huyền Thiết', kind: 'monster', speciesId: 'kiem_linh',
      rewardLT: 120, rewardDanElem: 'kim',
      desc: 'Hạ Tàn Kiếm Linh ở Kiếm Trủng, thu Hồn Kiếm Nhỏ về luyện Kim Linh Đan.'
    }
  ];

  var livePlayer = null;
  var currentTab = 'refine';

  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }

  function getMonstersAPI() {
    if (typeof window !== 'undefined' && window.GameMonsters) return window.GameMonsters;
    if (typeof global !== 'undefined' && global.GameMonsters) return global.GameMonsters;
    try { return require('./monsters.js'); } catch (e) { return null; }
  }

  function getItemDef(itemId) {
    var m = getMonstersAPI();
    if (m && m.ITEM_DEFS && m.ITEM_DEFS[itemId]) return m.ITEM_DEFS[itemId];
    return { id: itemId, name: itemId, iconCol: 0, iconRow: 0 };
  }

  function itemName(itemId) {
    var d = getItemDef(itemId);
    return d && d.name ? d.name : itemId;
  }

  function showToast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast(msg);
    }
  }

  function playChime() {
    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) {
      window.GameAudio.playChime();
    }
  }

  function refreshHUD() {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) {
      window.GameUI.refreshHUD();
    }
  }

  // ---------------------------------------------------------------------------
  // TRẠNG THÁI
  // ---------------------------------------------------------------------------

  /**
   * Khởi tạo lười player.danPhong cho save cũ (không có trường này) và dọn
   * các giá trị không hợp lệ (nhiệm vụ không còn tồn tại -> bỏ nhận).
   */
  function ensureState(player) {
    if (!player) return null;
    if (!player.danPhong || typeof player.danPhong !== 'object') {
      player.danPhong = { activeQuestId: null, tracked: true, completions: {} };
    }
    var st = player.danPhong;
    if (typeof st.tracked !== 'boolean') st.tracked = true;
    if (!st.completions || typeof st.completions !== 'object') st.completions = {};
    if (st.activeQuestId && !getQuestDef(st.activeQuestId)) st.activeQuestId = null;
    return st;
  }

  function realmRank(player) {
    var st = getStateAPI();
    if (st && st.getRealmRank) return st.getRealmRank(player) || 0;
    return 0;
  }

  function rankLabel(minRank) {
    return RANK_LABELS[minRank] || ('Hạng ' + minRank);
  }

  function boardUnlocked(player) {
    return !!(player && player.quests && (player.quests.sectStage || 0) >= 4);
  }

  function getRecipe(elem) {
    for (var i = 0; i < RECIPES.length; i++) {
      if (RECIPES[i].elem === elem) return RECIPES[i];
    }
    return null;
  }

  function getQuestDef(questId) {
    for (var i = 0; i < BOARD_QUESTS.length; i++) {
      if (BOARD_QUESTS[i].id === questId) return BOARD_QUESTS[i];
    }
    return null;
  }

  function recipeUnlocked(player, recipe) {
    return !!recipe && realmRank(player) >= recipe.minRank;
  }

  function countOf(player, itemId) {
    var st = getStateAPI();
    if (!st || !player) return 0;
    return st.countItemInBag(player, itemId) || 0;
  }

  function missingList(player, materials) {
    var missing = [];
    for (var i = 0; i < materials.length; i++) {
      var have = countOf(player, materials[i].itemId);
      if (have < materials[i].count) {
        missing.push(itemName(materials[i].itemId) + ' ' + have + '/' + materials[i].count);
      }
    }
    return missing;
  }

  // ---------------------------------------------------------------------------
  // LUYỆN ĐAN BẰNG NGUYÊN LIỆU
  // ---------------------------------------------------------------------------

  /**
   * Luyện 1 viên Tu Luyện Đan của hệ elem bằng nguyên liệu trong túi.
   * Thiếu nguyên liệu hoặc chưa mở khóa vùng: từ chối rõ ràng, không trừ gì.
   * Túi đầy không nhận nổi đan: hoàn lại nguyên liệu, không mất mát.
   */
  function refine(player, elem) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var recipe = getRecipe(elem);
    if (!recipe) return { ok: false, msg: 'Không có công thức cho hệ này.' };
    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };

    if (!recipeUnlocked(player, recipe)) {
      var msgLocked = 'Công thức ' + itemName(recipe.pillId) + ' mở ở ' + rankLabel(recipe.minRank) + ' (vùng nguyên liệu chưa mở).';
      showToast(msgLocked);
      return { ok: false, reason: 'locked', msg: msgLocked };
    }

    var missing = missingList(player, recipe.materials);
    if (missing.length > 0) {
      var msgMiss = 'Chưa đủ nguyên liệu luyện ' + itemName(recipe.pillId) + ': ' + missing.join(' · ') + '.';
      showToast(msgMiss);
      return { ok: false, reason: 'missing_materials', msg: msgMiss };
    }

    var i;
    for (i = 0; i < recipe.materials.length; i++) {
      st.removeItemFromBag(player, recipe.materials[i].itemId, recipe.materials[i].count);
    }
    var m = getMonstersAPI();
    var addRes = st.addItemToBag(player, recipe.pillId, 1, m ? m.ITEM_DEFS : undefined);
    if (!addRes || !addRes.success) {
      // Hoàn nguyên liệu — không để người chơi mất đồ vì túi đầy
      for (i = 0; i < recipe.materials.length; i++) {
        st.addItemToBag(player, recipe.materials[i].itemId, recipe.materials[i].count, m ? m.ITEM_DEFS : undefined);
      }
      var msgFull = 'Túi đồ đã đầy, không nhận thêm được ' + itemName(recipe.pillId) + '. Hãy dọn túi trước.';
      showToast(msgFull);
      return { ok: false, reason: 'bag_full', msg: msgFull };
    }

    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.refines = (player.stats.refines || 0) + 1;
    st.savePlayer(player);

    var msgOk = 'Luyện thành công 1 ' + itemName(recipe.pillId) + '! Dùng đan để tăng 20 tu vi ' + ELEM_NAMES[elem] + '.';
    playChime();
    showToast(msgOk);
    refreshHUD();
    return { ok: true, msg: msgOk, pillId: recipe.pillId };
  }

  // ---------------------------------------------------------------------------
  // BẢNG NHIỆM VỤ THU THẬP
  // ---------------------------------------------------------------------------

  function questProgress(player, def) {
    if (!player || !def) return { have: 0, need: 0, ready: false };
    var have = countOf(player, def.itemId);
    return { have: have, need: def.need, ready: have >= def.need };
  }

  function activeQuest(player) {
    if (!player) return null;
    var st = ensureState(player);
    if (!st || !st.activeQuestId) return null;
    return getQuestDef(st.activeQuestId);
  }

  function acceptQuest(player, questId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };
    ensureState(player);

    if (!boardUnlocked(player)) {
      return { ok: false, msg: 'Hoàn thành nhập môn tông môn trước đã — Chấp Sự sẽ giao nhiệm vụ thu thập sau.' };
    }
    var def = getQuestDef(questId);
    if (!def) return { ok: false, msg: 'Nhiệm vụ không tồn tại.' };
    if (player.danPhong.activeQuestId) {
      var cur = getQuestDef(player.danPhong.activeQuestId);
      var msgBusy = 'Đang nhận nhiệm vụ "' + (cur ? cur.name : '') + '" — hãy trả hoặc hủy nhiệm vụ đó trước.';
      showToast(msgBusy);
      return { ok: false, reason: 'busy', msg: msgBusy };
    }
    if (realmRank(player) < def.minRank) {
      var msgLock = 'Nhiệm vụ "' + def.name + '" mở ở ' + rankLabel(def.minRank) + ' — vùng ' + def.zoneName + ' chưa mở.';
      showToast(msgLock);
      return { ok: false, reason: 'locked', msg: msgLock };
    }

    player.danPhong.activeQuestId = questId;
    player.danPhong.tracked = true;
    st.savePlayer(player);

    var msgOk = 'Đã nhận nhiệm vụ: ' + def.name + ' — thu thập ' + def.need + ' ' + itemName(def.itemId) + ' tại ' + def.zoneName + '.';
    playChime();
    showToast(msgOk);
    refreshHUD();
    return { ok: true, msg: msgOk, questId: questId };
  }

  function abandonQuest(player) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    ensureState(player);
    if (!player.danPhong.activeQuestId) return { ok: false, msg: 'Chưa nhận nhiệm vụ thu thập nào.' };
    var def = getQuestDef(player.danPhong.activeQuestId);
    player.danPhong.activeQuestId = null;
    var st = getStateAPI();
    if (st) st.savePlayer(player);
    var msg = 'Đã hủy nhiệm vụ "' + (def ? def.name : '') + '". Vật phẩm đã thu thập vẫn giữ trong túi.';
    showToast(msg);
    refreshHUD();
    return { ok: true, msg: msg };
  }

  function setTracked(player, on) {
    if (!player) return;
    ensureState(player);
    player.danPhong.tracked = !!on;
    var st = getStateAPI();
    if (st) st.savePlayer(player);
    refreshHUD();
  }

  /**
   * Trả nhiệm vụ tại Chấp Sự: nộp đủ vật phẩm mục tiêu, nhận Linh Thạch và
   * (nếu có) 1 Tu Luyện Đan của hệ tương ứng. Nhiệm vụ quay lại bảng, nhận
   * lại được ngay. Túi đầy không nhận nổi đan thưởng: từ chối, chưa nộp gì.
   */
  function turnInQuest(player) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };
    ensureState(player);

    var def = activeQuest(player);
    if (!def) return { ok: false, msg: 'Chưa nhận nhiệm vụ thu thập nào.' };

    var prog = questProgress(player, def);
    if (!prog.ready) {
      var msgEarly = 'Chưa đủ ' + itemName(def.itemId) + ': hiện có ' + Math.min(prog.have, prog.need) + '/' + prog.need + '. Hãy tới ' + def.zoneName + ' thu thập thêm.';
      showToast(msgEarly);
      return { ok: false, reason: 'not_ready', msg: msgEarly };
    }

    var removed = st.removeItemFromBag(player, def.itemId, def.need);
    if (!removed) {
      return { ok: false, msg: 'Không nộp được vật phẩm — hãy kiểm tra lại túi đồ.' };
    }

    var danId = def.rewardDanElem ? ('dan-' + def.rewardDanElem) : null;
    if (danId) {
      var m = getMonstersAPI();
      var addRes = st.addItemToBag(player, danId, 1, m ? m.ITEM_DEFS : undefined);
      if (!addRes || !addRes.success) {
        st.addItemToBag(player, def.itemId, def.need, m ? m.ITEM_DEFS : undefined);
        var msgFull = 'Túi đồ đã đầy, không nhận thêm được đan thưởng. Hãy dọn túi rồi trả nhiệm vụ lại.';
        showToast(msgFull);
        return { ok: false, reason: 'bag_full', msg: msgFull };
      }
    }

    player.linhThach = (player.linhThach || 0) + (def.rewardLT || 0);
    player.danPhong.completions[def.id] = (player.danPhong.completions[def.id] || 0) + 1;
    player.danPhong.activeQuestId = null;
    st.savePlayer(player);

    var rewardText = '+' + (def.rewardLT || 0) + ' Linh Thạch' + (danId ? ' và 1 ' + itemName(danId) : '');
    var msgOk = 'Hoàn thành "' + def.name + '"! Nhận ' + rewardText + '. Nhiệm vụ đã quay lại bảng — nhận lại bất cứ lúc nào.';
    playChime();
    showToast(msgOk);
    refreshHUD();
    return { ok: true, msg: msgOk, questId: def.id, rewardLT: def.rewardLT || 0, rewardDanId: danId };
  }

  /**
   * Đích dẫn đường cho nhiệm vụ bảng đang được THEO DÕI — engine.js gọi hàm
   * này trong getQuestTargetInfo (móc DANPHONG). Trả cùng khuôn đối tượng
   * với các bước chuỗi chính: { stepId, stage, mapId, kind, npcId/speciesId/
   * x/y, title, desc }. Chưa đủ vật phẩm: chỉ tới bãi quái/điểm hái THẬT.
   * Đã đủ: chỉ về Chấp Sự ở Tông Môn để trả nhiệm vụ.
   */
  function getTrackedTargetInfo(player) {
    if (!player) return null;
    ensureState(player);
    var st = player.danPhong;
    if (!st || !st.activeQuestId || !st.tracked) return null;
    if (!boardUnlocked(player)) return null;
    var def = getQuestDef(st.activeQuestId);
    if (!def) return null;

    var prog = questProgress(player, def);
    if (prog.ready) {
      return {
        stepId: 'board_turnin',
        boardQuestId: def.id,
        stage: 4,
        mapId: 'tong-mon',
        kind: 'npc',
        npcId: 'npc_chapsu',
        title: def.name + ' — Trả Nhiệm Vụ',
        desc: 'Đã đủ ' + def.need + ' ' + itemName(def.itemId) + '. Về Tông Môn gặp Chấp Sự Đường để trả nhiệm vụ và nhận thưởng.'
      };
    }

    var info = {
      stepId: 'board_' + def.id,
      boardQuestId: def.id,
      stage: 4,
      mapId: def.mapId,
      kind: def.kind,
      title: def.name,
      desc: 'Thu thập ' + itemName(def.itemId) + ' tại ' + def.zoneName + ' (đang có ' + prog.have + '/' + prog.need + '). Đủ số thì về trả Chấp Sự Đường ở Tông Môn.'
    };
    if (def.kind === 'monster') info.speciesId = def.speciesId;
    if (def.kind === 'point') { info.x = def.x; info.y = def.y; }
    return info;
  }

  // =========================================================================
  // GIAO DIỆN BẢNG ĐAN PHÒNG (hai thẻ: Luyện Đan / Nhiệm Vụ Thu Thập)
  // =========================================================================

  function setElementIconSprite(el, def, cellPx) {
    if (!el || !def) return;
    var scale = cellPx / 32;
    el.style.backgroundImage = "url('assets/art/icons-sheet.png')";
    el.style.backgroundSize = (192 * scale) + 'px ' + (224 * scale) + 'px';
    el.style.backgroundPosition = (-(def.iconCol || 0) * cellPx) + 'px ' + (-(def.iconRow || 0) * cellPx) + 'px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.width = cellPx + 'px';
    el.style.height = cellPx + 'px';
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function materialLine(player, mat) {
    var row = el('div', 'danphong-mat-row');
    var icon = el('div', 'danphong-mat-icon');
    setElementIconSprite(icon, getItemDef(mat.itemId), 28);
    row.appendChild(icon);
    var have = countOf(player, mat.itemId);
    var name = el('span', 'danphong-mat-name', itemName(mat.itemId));
    var cnt = el('span', 'danphong-mat-count' + (have >= mat.count ? ' enough' : ' lacking'), have + '/' + mat.count);
    row.appendChild(name);
    row.appendChild(cnt);
    return row;
  }

  function renderRefineTab(body) {
    var player = livePlayer;
    if (!player) return;

    var intro = el('div', 'danphong-intro',
      'Đan Phòng luyện Tu Luyện Đan bằng nguyên liệu cày được ở các vùng săn. Mỗi viên đan dùng ngay tăng 20 tu vi cho đường tương ứng. Đổi nhanh bằng Linh Thạch vẫn còn ở chỗ Chấp Sự Đường (15 Linh Thạch/viên).');
    body.appendChild(intro);

    RECIPES.forEach(function (recipe) {
      var unlocked = recipeUnlocked(player, recipe);
      var missing = missingList(player, recipe.materials);
      var pillDef = getItemDef(recipe.pillId);
      var pillCount = countOf(player, recipe.pillId);

      var card = el('div', 'danphong-card' + (unlocked ? '' : ' locked'));
      var head = el('div', 'danphong-card-head');
      var icon = el('div', 'danphong-card-icon');
      setElementIconSprite(icon, pillDef, 40);
      head.appendChild(icon);
      var titles = el('div', 'danphong-card-titles');
      titles.appendChild(el('div', 'danphong-card-name', itemName(recipe.pillId)));
      titles.appendChild(el('div', 'danphong-card-sub', 'Dùng: +20 tu vi ' + ELEM_NAMES[recipe.elem] + ' · Trong túi: ' + pillCount + ' viên'));
      head.appendChild(titles);
      card.appendChild(head);

      var mats = el('div', 'danphong-mats');
      recipe.materials.forEach(function (mat) { mats.appendChild(materialLine(player, mat)); });
      card.appendChild(mats);
      card.appendChild(el('div', 'danphong-source', recipe.sourceNote));

      var actions = el('div', 'danphong-actions');
      if (!unlocked) {
        actions.appendChild(el('span', 'danphong-lock-note', 'Mở ở ' + rankLabel(recipe.minRank)));
      } else {
        var btnRefine = el('button', 'btn wood danphong-btn danphong-btn-refine', 'Luyện Đan');
        btnRefine.type = 'button';
        // Cố ý KHÔNG khóa nút khi thiếu nguyên liệu: người chơi bấm vào phải nhận
        // được thông báo từ chối rõ ràng (đang có bao nhiêu / cần bao nhiêu) từ
        // refine() — nút disabled thì bấm không ra thông báo gì cả.
        btnRefine.addEventListener('click', function () {
          refine(livePlayer, recipe.elem);
          renderPanel();
        });
        actions.appendChild(btnRefine);

        var btnUse = el('button', 'btn wood danphong-btn danphong-btn-use', 'Dùng Ngay');
        btnUse.type = 'button';
        if (pillCount <= 0) btnUse.disabled = true;
        btnUse.addEventListener('click', function () {
          if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.useItem) {
            window.GameEngine.useItem(recipe.pillId);
          }
          renderPanel();
        });
        actions.appendChild(btnUse);
        if (missing.length > 0) {
          actions.appendChild(el('span', 'danphong-miss-note', 'Thiếu: ' + missing.join(' · ')));
        }
      }
      card.appendChild(actions);
      body.appendChild(card);
    });

    // Thẻ Trúc Cơ Đan — luyện qua đúng hàm của engine (giữ nguyên công thức cũ)
    var tcCard = el('div', 'danphong-card danphong-card-trucco');
    var tcHead = el('div', 'danphong-card-head');
    var tcIcon = el('div', 'danphong-card-icon');
    setElementIconSprite(tcIcon, getItemDef('truc-co-dan'), 40);
    tcHead.appendChild(tcIcon);
    var tcTitles = el('div', 'danphong-card-titles');
    tcTitles.appendChild(el('div', 'danphong-card-name', 'Trúc Cơ Đan'));
    tcTitles.appendChild(el('div', 'danphong-card-sub', 'Đan đột phá Luyện Khí viên mãn lên Trúc Cơ · Trong túi: ' + countOf(player, 'truc-co-dan') + ' viên · Linh Thạch: ' + (player.linhThach || 0) + '/' + TRUC_CO_LINH_THACH));
    tcHead.appendChild(tcTitles);
    tcCard.appendChild(tcHead);
    var tcMats = el('div', 'danphong-mats');
    TRUC_CO_DISPLAY.forEach(function (mat) { tcMats.appendChild(materialLine(player, mat)); });
    tcCard.appendChild(tcMats);
    var tcActions = el('div', 'danphong-actions');
    var btnTc = el('button', 'btn wood danphong-btn danphong-btn-refine-trucco', 'Luyện Trúc Cơ Đan');
    btnTc.type = 'button';
    btnTc.addEventListener('click', function () {
      if (typeof window !== 'undefined' && window.GameEngine && window.GameEngine.refineTrucCoDan) {
        window.GameEngine.refineTrucCoDan();
      }
      renderPanel();
    });
    tcActions.appendChild(btnTc);
    tcActions.appendChild(el('span', 'danphong-miss-note', 'Luyện tại Đan Phòng hay gặp Chấp Sự đều cùng một công thức.'));
    tcCard.appendChild(tcActions);
    body.appendChild(tcCard);
  }

  function rewardText(def) {
    var t = '+' + (def.rewardLT || 0) + ' Linh Thạch';
    if (def.rewardDanElem) t += ' + 1 ' + itemName('dan-' + def.rewardDanElem);
    return t;
  }

  function renderBoardTab(body) {
    var player = livePlayer;
    if (!player) return;
    ensureState(player);
    var rank = realmRank(player);

    var intro = el('div', 'danphong-intro',
      'Bảng nhiệm vụ thu thập của Chấp Sự Đường. Nhận một nhiệm vụ, đi theo dẫn đường tới đúng vùng thu thập, gom đủ vật phẩm rồi quay về trả cho Chấp Sự. Xong là nhận lại được ngay.');
    body.appendChild(intro);

    var active = activeQuest(player);
    if (active) {
      var prog = questProgress(player, active);
      var card = el('div', 'danphong-card danphong-card-active');
      var head = el('div', 'danphong-card-head');
      var icon = el('div', 'danphong-card-icon');
      setElementIconSprite(icon, getItemDef(active.itemId), 40);
      head.appendChild(icon);
      var titles = el('div', 'danphong-card-titles');
      titles.appendChild(el('div', 'danphong-card-name', 'Đang làm: ' + active.name));
      titles.appendChild(el('div', 'danphong-card-sub',
        itemName(active.itemId) + ': ' + Math.min(prog.have, prog.need) + '/' + prog.need + ' · ' + active.zoneName + ' · Thưởng: ' + rewardText(active)));
      head.appendChild(titles);
      card.appendChild(head);
      card.appendChild(el('div', 'danphong-source', prog.ready
        ? 'Đã gom đủ vật phẩm. Dẫn đường đang chỉ về Chấp Sự Đường — về Tông Môn nói chuyện với Chấp Sự để trả nhiệm vụ.'
        : active.desc));

      var actions = el('div', 'danphong-actions');
      var btnTrack = el('button', 'btn wood danphong-btn', player.danPhong.tracked ? 'Đang Theo Dõi (Chạm Để Bỏ)' : 'Theo Dõi Nhiệm Vụ Này');
      btnTrack.type = 'button';
      btnTrack.addEventListener('click', function () {
        setTracked(livePlayer, !livePlayer.danPhong.tracked);
        renderPanel();
      });
      actions.appendChild(btnTrack);
      var btnAbandon = el('button', 'btn wood danphong-btn danphong-btn-danger', 'Hủy Nhiệm Vụ');
      btnAbandon.type = 'button';
      btnAbandon.addEventListener('click', function () {
        abandonQuest(livePlayer);
        renderPanel();
      });
      actions.appendChild(btnAbandon);
      card.appendChild(actions);
      body.appendChild(card);
    }

    BOARD_QUESTS.forEach(function (def) {
      if (active && def.id === active.id) return;
      var unlocked = rank >= def.minRank;
      var card = el('div', 'danphong-card' + (unlocked ? '' : ' locked'));
      var head = el('div', 'danphong-card-head');
      var icon = el('div', 'danphong-card-icon');
      setElementIconSprite(icon, getItemDef(def.itemId), 40);
      head.appendChild(icon);
      var titles = el('div', 'danphong-card-titles');
      titles.appendChild(el('div', 'danphong-card-name', def.name));
      titles.appendChild(el('div', 'danphong-card-sub',
        'Nộp ' + def.need + ' ' + itemName(def.itemId) + ' · ' + def.zoneName + ' · Thưởng: ' + rewardText(def) +
        ' · Đã xong ' + ((player.danPhong.completions[def.id]) || 0) + ' lần'));
      head.appendChild(titles);
      card.appendChild(head);
      card.appendChild(el('div', 'danphong-source', def.desc));

      var actions = el('div', 'danphong-actions');
      if (!unlocked) {
        actions.appendChild(el('span', 'danphong-lock-note', 'Mở ở ' + rankLabel(def.minRank)));
      } else if (active) {
        actions.appendChild(el('span', 'danphong-miss-note', 'Hãy trả hoặc hủy nhiệm vụ đang làm trước.'));
      } else {
        var btnAccept = el('button', 'btn wood danphong-btn danphong-btn-accept', 'Nhận Nhiệm Vụ');
        btnAccept.type = 'button';
        btnAccept.addEventListener('click', function () {
          var res = acceptQuest(livePlayer, def.id);
          if (res.ok) closePanel();
          renderPanel();
        });
        actions.appendChild(btnAccept);
      }
      card.appendChild(actions);
      body.appendChild(card);
    });
  }

  function renderPanel() {
    if (typeof document === 'undefined') return;
    if (!livePlayer) return;
    ensureState(livePlayer);

    var tabRefine = document.getElementById('danphong-tab-refine');
    var tabBoard = document.getElementById('danphong-tab-board');
    if (tabRefine) tabRefine.classList.toggle('active', currentTab === 'refine');
    if (tabBoard) tabBoard.classList.toggle('active', currentTab === 'board');

    var body = document.getElementById('danphong-body');
    if (!body) return;
    body.innerHTML = '';
    if (currentTab === 'board') renderBoardTab(body);
    else renderRefineTab(body);
  }

  function openPanel(tab) {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('danphong-modal');
    if (!modal) return;
    if (tab === 'board' || tab === 'refine') currentTab = tab;
    modal.classList.remove('hidden');
    renderPanel();
  }

  function closePanel() {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('danphong-modal');
    if (modal) modal.classList.add('hidden');
  }

  function isPanelOpen() {
    if (typeof document === 'undefined') return false;
    var modal = document.getElementById('danphong-modal');
    return !!modal && !modal.classList.contains('hidden');
  }

  /**
   * Móc nối với player đang sống (ui.js gọi trong initUI, cùng khuôn Linh Điền)
   */
  function attach(player) {
    livePlayer = player;
    ensureState(livePlayer);

    if (typeof document === 'undefined') return;

    var btnClose = document.getElementById('close-danphong-modal');
    if (btnClose && !btnClose.dataset.wired) {
      btnClose.dataset.wired = '1';
      btnClose.addEventListener('click', function () { closePanel(); });
    }

    var tabRefine = document.getElementById('danphong-tab-refine');
    if (tabRefine && !tabRefine.dataset.wired) {
      tabRefine.dataset.wired = '1';
      tabRefine.addEventListener('click', function () { currentTab = 'refine'; renderPanel(); });
    }
    var tabBoard = document.getElementById('danphong-tab-board');
    if (tabBoard && !tabBoard.dataset.wired) {
      tabBoard.dataset.wired = '1';
      tabBoard.addEventListener('click', function () { currentTab = 'board'; renderPanel(); });
    }

    var modal = document.getElementById('danphong-modal');
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closePanel();
      });
    }

    if (!document.body.dataset.danphongEscWired) {
      document.body.dataset.danphongEscWired = '1';
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var md = document.getElementById('danphong-modal');
          if (md && !md.classList.contains('hidden')) closePanel();
        }
      });
    }
  }

  // Xuất API
  exports.RECIPES = RECIPES;
  exports.BOARD_QUESTS = BOARD_QUESTS;
  exports.TRUC_CO_DISPLAY = TRUC_CO_DISPLAY;
  exports.ensureState = ensureState;
  exports.getRecipe = getRecipe;
  exports.getQuestDef = getQuestDef;
  exports.recipeUnlocked = recipeUnlocked;
  exports.refine = refine;
  exports.acceptQuest = acceptQuest;
  exports.abandonQuest = abandonQuest;
  exports.turnInQuest = turnInQuest;
  exports.questProgress = questProgress;
  exports.activeQuest = activeQuest;
  exports.setTracked = setTracked;
  exports.getTrackedTargetInfo = getTrackedTargetInfo;
  exports.attach = attach;
  exports.openPanel = openPanel;
  exports.closePanel = closePanel;
  exports.renderPanel = renderPanel;
  exports.isPanelOpen = isPanelOpen;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameDanPhong = {}));
