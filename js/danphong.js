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
 *
 * Đợt DANBOARD (2026-11-13, lệnh khẩn của Bui): luyện đan trong modal này
 * đi qua VÁN 4 BƯỚC (Xếp dược liệu / Chọn lửa / Khống hỏa / Phong đan) nối
 * vào GameLuyenDan.refineBatch — xem DANBOARD-DESIGN.md. Hai hàm luyện cũ
 * refine()/refineAux() giữ lại để tương thích nhưng giao diện không gọi nữa.
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

  // ---------------------------------------------------------------------------
  // ĐAN PHỤ TRỢ TẦNG (Đợt T1 — hồ sơ 06, bảng tầng Luyện Khí: điều kiện phụ
  // đột phá lên tầng sau). Hồ sơ chỉ chốt TÊN và MỐC dùng (Tụ Khí Tán x2 khi
  // lên tầng 5, Ngưng Khí Đan x1 khi lên tầng 8), không cho công thức luyện —
  // hai công thức dưới đây là SỐ ĐỘI SOẠN đợt T1 (khai trong báo cáo đợt):
  // nguyên liệu lấy từ các vùng ĐÃ MỞ ở mốc cần dùng (Tụ Khí Tán cần ở tầng 4:
  // vùng Mộc + Thủy mở ở hạng 4; Ngưng Khí Đan cần ở tầng 7: vùng Hỏa mở ở
  // hạng 7), tỉ lệ luyện 100% như Tu Luyện Đan. Đan phụ trợ KHÔNG uống trực
  // tiếp — tiêu hao tại bảng Đột Phá Tiểu Mốc đúng thời điểm đột phá.
  // ---------------------------------------------------------------------------
  var AUX_RECIPES = [
    {
      pillId: 'tu-khi-tan', minRank: 4, usedAt: 'Đột phá tiểu mốc tầng 4 -> tầng 5 (cần 2 gói)',
      materials: [
        { itemId: 'la-thanh-tuy', count: 2 },
        { itemId: 'bang-tinh', count: 1 }
      ],
      sourceNote: 'Lá Thanh Tụy: Thảo Tinh ở Rừng Độc (rơi 70%) và luống dược ở Tông Môn. Băng Tinh: Băng Tinh Linh ở Hồ Băng (rơi 50%).'
    },
    {
      pillId: 'ngung-khi-dan', minRank: 7, usedAt: 'Đột phá tiểu mốc tầng 7 -> tầng 8 (cần 1 viên)',
      materials: [
        { itemId: 'hoa-tinh-tho', count: 2 },
        { itemId: 'bang-tinh', count: 1 }
      ],
      sourceNote: 'Hỏa Tinh Thổ: Hỏa Nham Thú ở Mỏ Lửa (rơi 70%), Xích Diệm Ma tinh anh (rơi 100%). Băng Tinh: Băng Tinh Linh ở Hồ Băng (rơi 50%).'
    }
  ];

  function getAuxRecipe(pillId) {
    for (var i = 0; i < AUX_RECIPES.length; i++) {
      if (AUX_RECIPES[i].pillId === pillId) return AUX_RECIPES[i];
    }
    return null;
  }

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
   * Đợt DANBOARD: ĐƯỜNG LUYỆN CŨ — KHÔNG CÒN ĐƯỢC GIAO DIỆN GỌI. Giữ lại để
   * tương thích API/test cũ. Giao diện Đan Phòng nay chỉ luyện qua ván 4
   * bước (openBoard -> refineBatch). Hàm này luyện 1 viên Tu Luyện Đan của
   * hệ elem bằng nguyên liệu trong túi, không tính phẩm/kỹ năng/phẩm chất.
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
    if (!player.luyenDan) player.luyenDan = {};
    player.luyenDan.lastRefineAt = Date.now();
    player.luyenDan.lastHeatLevel = player.luyenDan.lastHeatLevel || 2;
    if (typeof window !== 'undefined') {
      window.__danLoBurningUntil = Date.now() + 60000;
      window.__danLoNgungDanUntil = Date.now() + 2000;
      window.__danLoNgungDanWisp = window.__danLoNgungDanWisp || 'trung';
    }
    st.savePlayer(player);

    var msgOk = 'Luyện thành công 1 ' + itemName(recipe.pillId) + '! Dùng đan để tăng 20 tu vi ' + ELEM_NAMES[elem] + '.';
    playChime();
    showToast(msgOk);
    refreshHUD();
    return { ok: true, msg: msgOk, pillId: recipe.pillId };
  }

  /**
   * Đợt DANBOARD: ĐƯỜNG LUYỆN CŨ — KHÔNG CÒN ĐƯỢC GIAO DIỆN GỌI (xem
   * refine). Giữ lại để tương thích. Đan phụ trợ nay luyện qua ván.
   */
  function refineAux(player, pillId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var recipe = getAuxRecipe(pillId);
    if (!recipe) return { ok: false, msg: 'Không có công thức đan phụ trợ này.' };
    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };

    if (realmRank(player) < recipe.minRank) {
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
      for (i = 0; i < recipe.materials.length; i++) {
        st.addItemToBag(player, recipe.materials[i].itemId, recipe.materials[i].count, m ? m.ITEM_DEFS : undefined);
      }
      var msgFull = 'Túi đồ đã đầy, không nhận thêm được ' + itemName(recipe.pillId) + '. Hãy dọn túi trước.';
      showToast(msgFull);
      return { ok: false, reason: 'bag_full', msg: msgFull };
    }

    if (!player.stats) player.stats = { playSec: 0, kills: 0, bossKills: 0, harvests: 0, refines: 0 };
    player.stats.refines = (player.stats.refines || 0) + 1;
    if (!player.luyenDan) player.luyenDan = {};
    player.luyenDan.lastRefineAt = Date.now();
    player.luyenDan.lastHeatLevel = player.luyenDan.lastHeatLevel || 2;
    if (typeof window !== 'undefined') {
      window.__danLoBurningUntil = Date.now() + 60000;
      window.__danLoNgungDanUntil = Date.now() + 2000;
      window.__danLoNgungDanWisp = window.__danLoNgungDanWisp || 'trung';
    }
    st.savePlayer(player);

    var msgOk = 'Luyện thành công 1 ' + itemName(recipe.pillId) + '! ' + recipe.usedAt + ' — mở bảng Đột Phá Tiểu Mốc (gặp Chấp Sự) để dùng.';
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
    el.style.backgroundSize = (192 * scale) + 'px ' + (256 * scale) + 'px';
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

  // Đợt DANBOARD: nút luyện nhanh chỉ hiện khi đã mở khóa theo luật D2
  // (≥ 5 lần dùng phương); vẫn qua refineBatch nên vẫn đếm chuỗi, vẫn áp
  // buff, vẫn cộng phẩm chất — và bị trần Thượng phẩm.
  function appendQuickRefineButton(actions, pillId) {
    var ld = getLuyenDanAPI();
    if (!ld || !ld.isQuickRefineUnlocked || !ld.quickRefine) return;
    if (!ld.isQuickRefineUnlocked(livePlayer, pillId)) return;
    var btnQuick = el('button', 'btn wood danphong-btn danphong-btn-quick', 'Luyện Nhanh (tối đa Thượng phẩm)');
    btnQuick.type = 'button';
    btnQuick.addEventListener('click', function () {
      var res = ld.quickRefine(livePlayer, pillId, 'dan-phong');
      if (res && !res.ok && res.msg) showToast(res.msg);
      renderPanel();
    });
    actions.appendChild(btnQuick);
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
        var btnRefine = el('button', 'btn wood danphong-btn danphong-btn-refine', 'Mở Ván Luyện');
        btnRefine.type = 'button';
        // Đợt DANBOARD: luyện đan đi qua ván 4 bước, không còn bấm một cái
        // thành đan ngay. Cố ý KHÔNG khóa nút khi thiếu nguyên liệu: người
        // chơi bấm vào phải nhận được thông báo từ chối rõ ràng từ ván.
        btnRefine.addEventListener('click', function () {
          openBoard(recipe.pillId);
          renderPanel();
        });
        actions.appendChild(btnRefine);
        appendQuickRefineButton(actions, recipe.pillId);

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

    // Đợt T1: thẻ ĐAN PHỤ TRỢ TẦNG (hồ sơ 06) — luyện bằng nguyên liệu tại
    // Đan Phòng, tiêu hao tại bảng Đột Phá Tiểu Mốc.
    var auxTitle = el('div', 'danphong-intro',
      'Đan phụ trợ tầng (hồ sơ 06): Tụ Khí Tán và Ngưng Khí Đan không uống trực tiếp — chúng là điều kiện tiêu hao khi đột phá tiểu mốc tương ứng. Luyện tại đây, dùng tại bảng Đột Phá Tiểu Mốc (gặp Chấp Sự Đường).');
    body.appendChild(auxTitle);

    AUX_RECIPES.forEach(function (recipe) {
      var unlocked = realmRank(player) >= recipe.minRank;
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
      titles.appendChild(el('div', 'danphong-card-sub', 'Dùng tại: ' + recipe.usedAt + ' · Trong túi: ' + pillCount));
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
        var btnRefineAux = el('button', 'btn wood danphong-btn danphong-btn-refine-aux', 'Mở Ván Luyện');
        btnRefineAux.type = 'button';
        btnRefineAux.addEventListener('click', function () {
          openBoard(recipe.pillId);
          renderPanel();
        });
        actions.appendChild(btnRefineAux);
        appendQuickRefineButton(actions, recipe.pillId);
        var tm = (typeof window !== 'undefined' && window.GameTieuMoc) ? window.GameTieuMoc : null;
        if (tm && tm.openPanel) {
          var btnOpenTm = el('button', 'btn wood danphong-btn danphong-btn-open-tieumoc', 'Mở Bảng Đột Phá');
          btnOpenTm.type = 'button';
          btnOpenTm.addEventListener('click', function () {
            closePanel();
            tm.openPanel();
          });
          actions.appendChild(btnOpenTm);
        }
        if (missing.length > 0) {
          actions.appendChild(el('span', 'danphong-miss-note', 'Thiếu: ' + missing.join(' · ')));
        }
      }
      card.appendChild(actions);
      body.appendChild(card);
    });

    // Đợt DANBOARD: thẻ Thanh Độc Đan — công thức có trong PILL_RECIPES của
    // D2 nhưng trước đây chưa có thẻ luyện. Luyện qua ván như các đan khác.
    var tdRecipe = boardRecipeFor('thanh-doc-dan');
    if (tdRecipe) {
      var tdMats = boardCounts(tdRecipe.materials);
      var tdMatList = Object.keys(tdMats).map(function (id) { return { itemId: id, count: tdMats[id] }; });
      var tdMissing = missingList(player, tdMatList);
      var tdPillCount = countOf(player, 'thanh-doc-dan');
      var tdCard = el('div', 'danphong-card');
      var tdHead = el('div', 'danphong-card-head');
      var tdIcon = el('div', 'danphong-card-icon');
      setElementIconSprite(tdIcon, getItemDef('thanh-doc-dan'), 40);
      tdHead.appendChild(tdIcon);
      var tdTitles = el('div', 'danphong-card-titles');
      tdTitles.appendChild(el('div', 'danphong-card-name', itemName('thanh-doc-dan')));
      tdTitles.appendChild(el('div', 'danphong-card-sub', 'Đan giải độc · Trong túi: ' + tdPillCount + ' viên'));
      tdHead.appendChild(tdTitles);
      tdCard.appendChild(tdHead);
      var tdMatsEl = el('div', 'danphong-mats');
      tdMatList.forEach(function (mat) { tdMatsEl.appendChild(materialLine(player, mat)); });
      tdCard.appendChild(tdMatsEl);
      tdCard.appendChild(el('div', 'danphong-source', 'Băng Tinh: Băng Tinh Linh ở Hồ Băng (rơi 50%). Lá Thanh Tụy: Thảo Tinh ở Rừng Độc và luống dược ở Tông Môn.'));
      var tdActions = el('div', 'danphong-actions');
      var tdBtn = el('button', 'btn wood danphong-btn danphong-btn-refine', 'Mở Ván Luyện');
      tdBtn.type = 'button';
      tdBtn.addEventListener('click', function () {
        openBoard('thanh-doc-dan');
        renderPanel();
      });
      tdActions.appendChild(tdBtn);
      appendQuickRefineButton(tdActions, 'thanh-doc-dan');
      if (tdMissing.length > 0) {
        tdActions.appendChild(el('span', 'danphong-miss-note', 'Thiếu: ' + tdMissing.join(' · ')));
      }
      tdCard.appendChild(tdActions);
      body.appendChild(tdCard);
    }

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

    // Đợt T3 — Thẻ Ngũ Hành Quy Nguyên Đan (đan đột phá Kim Đan, hồ sơ 02
    // §3.2). Việc trừ đồ/cấp đan/phẩm do js/kimdan.js đảm nhiệm (nguồn sự
    // thật duy nhất của công thức); thẻ này hiển thị đủ/thiếu từng món +
    // phẩm dự kiến theo Hài Hòa hiện tại và gọi đúng hàm luyện của module.
    var kdAPI = (typeof window !== 'undefined' && window.GameKimDan) ? window.GameKimDan : null;
    if (kdAPI) {
      var qnCard = el('div', 'danphong-card danphong-card-trucco');
      var qnHead = el('div', 'danphong-card-head');
      var qnIcon = el('div', 'danphong-card-icon');
      setElementIconSprite(qnIcon, getItemDef('ngu-hanh-quy-nguyen-dan'), 40);
      qnHead.appendChild(qnIcon);
      var qnTitles = el('div', 'danphong-card-titles');
      qnTitles.appendChild(el('div', 'danphong-card-name', 'Ngũ Hành Quy Nguyên Đan'));
      var kdState = (player.kimDan && typeof player.kimDan === 'object') ? player.kimDan : { pillPham: 0 };
      var preview = kdAPI.previewPham(player);
      qnTitles.appendChild(el('div', 'danphong-card-sub',
        'Đan đột phá Trúc Cơ Viên Mãn lên Kim Đan · Trong túi: ' + countOf(player, 'ngu-hanh-quy-nguyen-dan') +
        ' viên · Linh Thạch: ' + (player.linhThach || 0) + '/' + kdAPI.RECIPE_LT_FEE +
        ' · Hài Hòa hiện tại ' + Math.round(preview.hh * 100) + '% → phẩm dự kiến: ' + kdAPI.phamName(preview.pham) +
        (kdState.pillPham ? ' · Phẩm đan đang giữ: ' + kdAPI.phamName(kdState.pillPham) : '')));
      qnHead.appendChild(qnTitles);
      qnCard.appendChild(qnHead);
      var qnMats = el('div', 'danphong-mats');
      kdAPI.RECIPE.forEach(function (mat) { qnMats.appendChild(materialLine(player, mat)); });
      qnCard.appendChild(qnMats);
      qnCard.appendChild(el('div', 'danphong-source',
        'Năm Nguyên Tinh rơi chắc chắn từ 5 boss trấn vùng; Nước Ốc Đảo Tinh Khiết săn ở Hoang Mạc Hoàng Sa. Phẩm viên đan tính theo Hài Hòa lúc luyện — luyện lúc năm đường càng cân bằng, phẩm Kim Đan càng cao và theo cả đời.'));
      var qnActions = el('div', 'danphong-actions');
      var btnQn = el('button', 'btn wood danphong-btn danphong-btn-refine-trucco', 'Luyện Ngũ Hành Quy Nguyên Đan');
      btnQn.type = 'button';
      btnQn.addEventListener('click', function () {
        kdAPI.refineQuyNguyen(livePlayer);
        renderPanel();
      });
      qnActions.appendChild(btnQn);
      var missingQn = missingList(player, kdAPI.RECIPE);
      if ((player.linhThach || 0) < kdAPI.RECIPE_LT_FEE) {
        missingQn.push('Linh Thạch ' + (player.linhThach || 0) + '/' + kdAPI.RECIPE_LT_FEE);
      }
      if (missingQn.length > 0) {
        qnActions.appendChild(el('span', 'danphong-miss-note', 'Thiếu: ' + missingQn.join(' · ')));
      }
      qnCard.appendChild(qnActions);
      body.appendChild(qnCard);
    }
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

  // Đợt DANSKILL: thẻ KỸ NĂNG LUYỆN ĐAN — học + thi triển 4 kỹ năng luyện
  // đan (GameDanKyNang). Nút luôn bấm được để người chơi nhận thông báo từ
  // chối rõ ràng (cùng quy ước với nút Luyện Đan của thẻ Luyện Đan).
  // Đợt DANBOARD-FIX: giao diện thi luyện đan sư — takeExam của D2 có sẵn
  // nhưng 0 nơi gọi nên Ngưng Đan Quyết không thể học qua chơi thật. Khối
  // này chỉ phơi đúng luật D2 sẵn có (ngưỡng mẻ/bài thi), không bịa thêm
  // số: nút chỉ mở khi đã đủ mẻ cho cấp kế mà còn thiếu bài thi, nên không
  // thể bấm spam lên cấp.
  function examRecipeIdFor(player, ld, rank) {
    var ids = ['dan-moc', 'dan-thuy', 'dan-hoa', 'dan-tho', 'dan-kim', 'thanh-doc-dan', 'tu-khi-tan', 'ngung-khi-dan'];
    var db = getDanBanAPI();
    if (db && db.BOARD_PILL_IDS) ids = db.BOARD_PILL_IDS;
    var rr = realmRank(player);
    var picked = 'dan-moc';
    for (var i = 0; i < ids.length; i++) {
      var r = ld.getPillRecipe ? ld.getPillRecipe(ids[i]) : null;
      if (r && rr >= (r.minRealmRank || 0) && rank >= (r.minRank || 0)) picked = ids[i];
    }
    return picked;
  }

  function renderExamBlock(body, player) {
    var ld = getLuyenDanAPI();
    if (!ld || !ld.takeExam || !ld.getAlchemistRank) return;
    var s = ld.ensureState ? ld.ensureState(player) : player.luyenDan;
    if (!s) return;
    var rank = ld.getAlchemistRank(player);
    var rankName = ld.getAlchemistRankName ? ld.getAlchemistRankName(player) : ('Cấp ' + rank);
    var ranks = ld.ALCHEMIST_RANKS || ['Học đồ', 'Đan sĩ', 'Đan sư', 'Đại đan sư'];
    var succTh = ld.RANK_SUCCESS_THRESHOLDS || [0, 5, 20, 50];
    var examTh = ld.RANK_EXAM_THRESHOLDS || [0, 1, 2, 3];
    var card = el('div', 'danphong-card');
    var head = el('div', 'danphong-card-head');
    var titles = el('div', 'danphong-card-titles');
    titles.appendChild(el('div', 'danphong-card-name', 'Thi Luyện Đan Sư'));
    titles.appendChild(el('div', 'danphong-card-sub', 'Cấp đan sư: ' + rankName + ' · Mẻ thành công: ' + (s.successes || 0) + ' · Bài thi đạt: ' + (s.examsPassed || 0)));
    head.appendChild(titles);
    card.appendChild(head);
    var actions = el('div', 'danphong-actions');
    if (rank >= ranks.length - 1) {
      card.appendChild(el('div', 'danskill-meta', 'Đã đạt cấp đan sư cao nhất.'));
    } else {
      var nextRank = rank + 1;
      var needSucc = succTh[nextRank];
      var needExam = examTh[nextRank];
      var examId = examRecipeIdFor(player, ld, rank);
      var examRecipe = ld.getPillRecipe ? ld.getPillRecipe(examId) : null;
      card.appendChild(el('div', 'danskill-meta', 'Cấp kế: ' + ranks[nextRank] + ' — cần ' + needSucc + ' mẻ thành công + ' + needExam + ' bài thi đạt. Phương thi: ' + (examRecipe ? examRecipe.name : examId) + '.'));
      var canExam = (s.successes || 0) >= needSucc && (s.examsPassed || 0) < needExam;
      var btnExam = el('button', 'btn wood danphong-btn danphong-btn-accept', 'Thi Luyện');
      btnExam.type = 'button';
      if (!canExam) btnExam.disabled = true;
      btnExam.addEventListener('click', function () {
        var res = ld.takeExam(livePlayer, examId);
        if (res && res.msg) showToast(res.msg);
        renderPanel();
      });
      actions.appendChild(btnExam);
      if (!canExam) {
        var why = (s.successes || 0) < needSucc
          ? ('Cần thêm ' + (needSucc - (s.successes || 0)) + ' mẻ thành công.')
          : 'Đã đủ bài thi cho cấp kế — luyện thêm mẻ để mở cấp tiếp theo.';
        actions.appendChild(el('span', 'danphong-miss-note', why));
      }
    }
    card.appendChild(actions);
    body.appendChild(card);
  }

  function renderSkillsTab(body) {
    var player = livePlayer;
    if (!player) return;
    var dk = (typeof window !== 'undefined' && window.GameDanKyNang) ? window.GameDanKyNang : null;
    if (!dk) {
      body.appendChild(el('div', 'danphong-intro', 'Kỹ năng luyện đan chưa sẵn sàng. Hãy tải lại game.'));
      return;
    }
    dk.ensureState(player);

    body.appendChild(el('div', 'danphong-intro',
      'Kỹ năng luyện đan: học bằng thành tích luyện đan + Linh Thạch, thi triển tốn linh lực và có hồi chiêu, lên cấp bằng số lần dùng. Ba kỹ năng đầu tăng sức cho mẻ luyện kế tiếp (ván luyện đan); Thanh Độc Quyết giải đan độc ngay lập tức.'));

    var buffs = dk.getActiveBuffs(player);
    if (buffs.length > 0) {
      var buffNames = buffs.map(function (b) {
        var d = dk.getSkillDef(b.skillId);
        return (d ? d.name : b.skillId) + ' cấp ' + b.level;
      }).join(' · ');
      body.appendChild(el('div', 'danskill-buff-note', 'Đang chờ mẻ luyện kế tiếp: ' + buffNames + '.'));
    }

    renderExamBlock(body, player);

    dk.listSkills().forEach(function (def) {
      var learned = dk.isSkillLearned(player, def.id);
      var level = dk.skillLevel(player, def.id);
      var sp = player.luyenDan.skills[def.id];
      var uses = sp ? (sp.uses || 0) : 0;
      var cost = dk.skillCost(def.id, level);
      var cdLeftSec = Math.ceil(dk.skillCooldownLeftMs(player, def.id) / 1000);

      var card = el('div', 'danphong-card' + (learned ? '' : ' locked'));
      var head = el('div', 'danphong-card-head');
      var titles = el('div', 'danphong-card-titles');
      titles.appendChild(el('div', 'danphong-card-name', def.name));
      titles.appendChild(el('div', 'danphong-card-sub',
        'Hệ ' + ELEM_NAMES[def.element] + ' · ' + (learned ? ('Cấp ' + level + ' · Đã dùng ' + uses + ' lần') : 'Chưa học')));
      head.appendChild(titles);
      card.appendChild(head);
      card.appendChild(el('div', 'danphong-source', def.desc));
      card.appendChild(el('div', 'danskill-effect', 'Hiệu quả: ' + dk.skillEffectText(def.id, level)));
      card.appendChild(el('div', 'danskill-meta',
        'Phí: ' + cost + ' linh lực (linh lực hiện có: ' + (player.linhLuc || 0) + '/' + (player.linhLucMax || 0) + ')' +
        ' · Hồi chiêu: ' + def.baseCooldownSec + ' giây' +
        (cdLeftSec > 0 ? ' · Còn hồi chiêu: ' + cdLeftSec + ' giây' : '')));

      var actions = el('div', 'danphong-actions');
      if (!learned) {
        var cond = dk.canLearnSkill(player, def.id);
        var btnLearn = el('button', 'btn wood danphong-btn danphong-btn-accept', 'Học (' + def.learnFeeLT + ' Linh Thạch)');
        btnLearn.type = 'button';
        btnLearn.addEventListener('click', function () {
          var res = dk.learnSkill(livePlayer, def.id);
          if (res && !res.ok && res.msg) showToast(res.msg);
          renderPanel();
        });
        actions.appendChild(btnLearn);
        if (!cond.ok && cond.missing && cond.missing.length > 0) {
          actions.appendChild(el('span', 'danphong-miss-note', 'Cần: ' + cond.missing.join(' · ')));
        } else {
          actions.appendChild(el('span', 'danphong-miss-note', 'Đủ điều kiện học.'));
        }
      } else {
        var btnCast = el('button', 'btn wood danphong-btn danphong-btn-refine',
          cdLeftSec > 0 ? ('Hồi Chiêu (' + cdLeftSec + ' giây)') : ('Thi Triển (' + cost + ' linh lực)'));
        btnCast.type = 'button';
        btnCast.addEventListener('click', function () {
          var res = dk.castSkill(livePlayer, def.id);
          if (res && !res.ok && res.msg) showToast(res.msg);
          renderPanel();
        });
        actions.appendChild(btnCast);
        if (def.buffKind) {
          var hasBuff = false;
          for (var i = 0; i < buffs.length; i++) if (buffs[i].skillId === def.id) hasBuff = true;
          if (hasBuff) actions.appendChild(el('span', 'danphong-miss-note', 'Đã thi triển — chờ mẻ luyện kế tiếp.'));
        }
      }
      card.appendChild(actions);
      body.appendChild(card);
    });
  }

  // =========================================================================
  // VÁN LUYỆN ĐAN 4 BƯỚC (Đợt DANBOARD — DANBOARD-DESIGN.md)
  // Luyện đan trong modal Đan Phòng đi qua ván, không còn bấm một cái thành
  // đan ngay. Ván chỉ sản xuất đầu vào cho GameLuyenDan.refineBatch (nguồn
  // sự thật duy nhất của điểm/phẩm); mọi luật điểm giữ nguyên D2.
  // =========================================================================

  var boardState = null; // { pillId, step, chosen[], fireElement, heatLevel, sealPosition, result }
  var sealTimerId = null;
  var sealStartMs = 0;

  function getLuyenDanAPI() {
    if (typeof window !== 'undefined' && window.GameLuyenDan) return window.GameLuyenDan;
    if (typeof global !== 'undefined' && global.GameLuyenDan) return global.GameLuyenDan;
    try { return require('./luyendan.js'); } catch (e) { return null; }
  }
  function getDanBanAPI() {
    if (typeof window !== 'undefined' && window.GameDanBan) return window.GameDanBan;
    if (typeof global !== 'undefined' && global.GameDanBan) return global.GameDanBan;
    try { return require('./dan-ban.js'); } catch (e) { return null; }
  }
  function getDanKyNangAPI() {
    if (typeof window !== 'undefined' && window.GameDanKyNang) return window.GameDanKyNang;
    if (typeof global !== 'undefined' && global.GameDanKyNang) return global.GameDanKyNang;
    try { return require('./dan-ky-nang.js'); } catch (e) { return null; }
  }

  function stopSealTimer() {
    if (sealTimerId) { clearInterval(sealTimerId); sealTimerId = null; }
  }

  function boardRecipeFor(pillId) {
    var db = getDanBanAPI();
    if (db && db.boardRecipeList) {
      var list = db.boardRecipeList();
      for (var i = 0; i < list.length; i++) if (list[i].pillId === pillId) return list[i];
    }
    var ld = getLuyenDanAPI();
    var r = ld && ld.getPillRecipe ? ld.getPillRecipe(pillId) : null;
    if (!r) return null;
    return { pillId: r.id, name: r.name, elem: r.elem, tier: r.tier, minRank: r.minRank || 0,
      minRealmRank: r.minRealmRank || 0, minFurnace: r.minFurnace || 0,
      materials: r.materials.slice(), heatDifficulty: r.heatDifficulty, danVanMax: r.danVanMax || 1 };
  }

  function openBoard(pillId) {
    var player = livePlayer;
    if (!player) return;
    var recipe = boardRecipeFor(pillId);
    if (!recipe) { showToast('Không có công thức này.'); return; }
    var ld = getLuyenDanAPI();
    if (ld && ld.canUseFurnace) {
      var chk = ld.canUseFurnace(player, 'dan-phong', {});
      if (!chk.ok) { showToast(chk.msg || 'Chưa dùng được lò.'); return; }
    }
    stopSealTimer();
    boardState = { pillId: pillId, step: 1, chosen: [], fireElement: null, heatLevel: null, sealPosition: null, result: null };
    currentTab = 'refine';
  }

  function closeBoard() {
    stopSealTimer();
    boardState = null;
  }

  function boardCounts(materials) {
    var c = {};
    for (var i = 0; i < materials.length; i++) c[materials[i]] = (c[materials[i]] || 0) + 1;
    return c;
  }

  function boardChosenValid(recipe, chosen) {
    if (!recipe || chosen.length !== recipe.materials.length) return false;
    var a = boardCounts(recipe.materials);
    var b = boardCounts(chosen);
    for (var k in a) if (a[k] !== b[k]) return false;
    for (var k2 in b) if (a[k2] !== b[k2]) return false;
    return true;
  }

  function boardHeader(body, recipe) {
    var player = livePlayer;
    var head = el('div', 'danboard-head');
    head.appendChild(el('div', 'danboard-title', 'Ván Luyện Đan — ' + itemName(recipe.pillId)));
    var sub = [];
    sub.push('Lò: Đan Phòng Tông Môn');
    var ld = getLuyenDanAPI();
    if (ld && ld.ensureState) {
      var s = ld.ensureState(player);
      sub.push('Đã luyện thành công: ' + (s.successes || 0) + ' mẻ');
      sub.push('Đan độc: ' + (s.toxin || 0));
    }
    var dk = getDanKyNangAPI();
    if (dk && dk.getActiveBuffs) {
      var buffs = dk.getActiveBuffs(player);
      if (buffs.length > 0) {
        var names = buffs.map(function (b) {
          var d = dk.getSkillDef(b.skillId);
          return (d ? d.name : b.skillId) + ' cấp ' + b.level;
        }).join(' · ');
        sub.push('Kỹ năng chờ mẻ này: ' + names);
      }
    }
    head.appendChild(el('div', 'danboard-sub', sub.join(' · ')));
    body.appendChild(head);

    var steps = el('div', 'danboard-steps');
    var names = ['1. Xếp dược liệu', '2. Chọn lửa', '3. Khống hỏa', '4. Phong đan'];
    for (var i = 0; i < 4; i++) {
      var chip = el('span', 'danboard-step-chip' + (boardState.step === i + 1 ? ' active' : '') + (boardState.step > i + 1 ? ' done' : ''), names[i]);
      steps.appendChild(chip);
    }
    body.appendChild(steps);
  }

  function boardNav(body, opts) {
    var nav = el('div', 'danphong-actions danboard-nav');
    if (opts.back) {
      var btnBack = el('button', 'btn wood danphong-btn', opts.backLabel || 'Quay Lại');
      btnBack.type = 'button';
      btnBack.addEventListener('click', function () { boardState.step = opts.back; renderPanel(); });
      nav.appendChild(btnBack);
    }
    var btnCancel = el('button', 'btn wood danphong-btn danphong-btn-danger', 'Hủy Ván');
    btnCancel.type = 'button';
    btnCancel.addEventListener('click', function () { closeBoard(); renderPanel(); });
    nav.appendChild(btnCancel);
    if (opts.next) {
      var btnNext = el('button', 'btn wood danphong-btn danphong-btn-refine', opts.nextLabel || 'Tiếp');
      btnNext.type = 'button';
      btnNext.addEventListener('click', opts.next);
      nav.appendChild(btnNext);
    }
    body.appendChild(nav);
  }

  function qualityShortLabel(q) {
    var hq = (typeof window !== 'undefined' && window.GameHerbQuality) ? window.GameHerbQuality : null;
    if (hq && hq.getQualityShortLabel) return hq.getQualityShortLabel(q);
    return ['Hạ', 'Trung', 'Thượng', 'Cực'][Math.max(0, Math.min(3, q || 1))];
  }
  function qualityColor(q) {
    var hq = (typeof window !== 'undefined' && window.GameHerbQuality) ? window.GameHerbQuality : null;
    if (hq && hq.getQualityColor) return hq.getQualityColor(q);
    return ['#8b8b8b', '#4f9d69', '#4f83c4', '#b07ad6'][Math.max(0, Math.min(3, q || 1))];
  }

  function renderBoardStep1(body, recipe) {
    var player = livePlayer;
    var db = getDanBanAPI();
    var peeked = db && db.peekMaterialQualities ? db.peekMaterialQualities(player, recipe.materials) : recipe.materials.map(function () { return 1; });
    var avgLabel = db && db.qualityLabelFor ? db.qualityLabelFor(peeked) : '';

    body.appendChild(el('div', 'danphong-intro',
      'Chạm từng dược liệu để bỏ vào lò theo thứ tự. Xếp đúng thứ tự công thức được trọn điểm dược liệu; xếp sai vẫn luyện được nhưng mất nửa điểm (Tịnh Dược Quyết gỡ bớt thiệt hại). Phẩm chất ghi kèm là phẩm của đơn vị sẽ bị trừ khỏi túi.'));

    var needCounts = boardCounts(recipe.materials);
    var chosenCounts = boardCounts(boardState.chosen);

    var reqTitle = el('div', 'danboard-section-title', 'Dược liệu cần dùng (theo thứ tự công thức)' + (avgLabel ? ' — phẩm dự kiến: ' + avgLabel : ''));
    body.appendChild(reqTitle);
    var reqRow = el('div', 'danboard-unit-row');
    recipe.materials.forEach(function (itemId, idx) {
      var unit = el('div', 'danboard-unit');
      var icon = el('div', 'danphong-mat-icon');
      setElementIconSprite(icon, getItemDef(itemId), 28);
      unit.appendChild(icon);
      unit.appendChild(el('span', 'danboard-unit-name', itemName(itemId)));
      var q = el('span', 'danboard-unit-quality', qualityShortLabel(peeked[idx]));
      q.style.color = qualityColor(peeked[idx]);
      unit.appendChild(q);
      reqRow.appendChild(unit);
    });
    body.appendChild(reqRow);

    var seqTitle = el('div', 'danboard-section-title', 'Thứ tự bỏ vào lò (' + boardState.chosen.length + '/' + recipe.materials.length + ') — chạm ô đã xếp để rút ra');
    body.appendChild(seqTitle);
    var seqRow = el('div', 'danboard-unit-row');
    for (var s = 0; s < recipe.materials.length; s++) {
      (function (slotIdx) {
        var slot = el('div', 'danboard-slot' + (boardState.chosen[slotIdx] ? ' filled' : ''));
        if (boardState.chosen[slotIdx]) {
          var icon2 = el('div', 'danphong-mat-icon');
          setElementIconSprite(icon2, getItemDef(boardState.chosen[slotIdx]), 28);
          slot.appendChild(icon2);
          slot.appendChild(el('span', 'danboard-slot-num', String(slotIdx + 1)));
          slot.addEventListener('click', function () {
            boardState.chosen.splice(slotIdx, 1);
            renderPanel();
          });
        } else {
          slot.appendChild(el('span', 'danboard-slot-num', String(slotIdx + 1)));
        }
        seqRow.appendChild(slot);
      })(s);
    }
    body.appendChild(seqRow);

    var pickTitle = el('div', 'danboard-section-title', 'Chạm để bỏ vào lò');
    body.appendChild(pickTitle);
    var pickRow = el('div', 'danboard-unit-row');
    Object.keys(needCounts).forEach(function (itemId) {
      var have = countOf(player, itemId);
      var remaining = needCounts[itemId] - (chosenCounts[itemId] || 0);
      var chip = el('div', 'danboard-pick' + (remaining <= 0 || have < (chosenCounts[itemId] || 0) + 1 ? ' disabled' : ''));
      var icon3 = el('div', 'danphong-mat-icon');
      setElementIconSprite(icon3, getItemDef(itemId), 28);
      chip.appendChild(icon3);
      chip.appendChild(el('span', 'danboard-unit-name', itemName(itemId)));
      chip.appendChild(el('span', 'danphong-mat-count' + (have >= needCounts[itemId] ? ' enough' : ' lacking'), have + '/' + needCounts[itemId]));
      chip.addEventListener('click', function () {
        var cur = boardCounts(boardState.chosen)[itemId] || 0;
        if (cur >= needCounts[itemId]) { showToast('Đã xếp đủ ' + itemName(itemId) + ' cho mẻ này.'); return; }
        if (countOf(livePlayer, itemId) < cur + 1) { showToast('Không đủ ' + itemName(itemId) + ' trong túi.'); return; }
        boardState.chosen.push(itemId);
        renderPanel();
      });
      pickRow.appendChild(chip);
    });
    body.appendChild(pickRow);

    var tools = el('div', 'danphong-actions');
    var btnAuto = el('button', 'btn wood danphong-btn', 'Xếp Theo Phương');
    btnAuto.type = 'button';
    btnAuto.addEventListener('click', function () {
      boardState.chosen = recipe.materials.slice();
      renderPanel();
    });
    tools.appendChild(btnAuto);
    var btnClear = el('button', 'btn wood danphong-btn', 'Xóa Hết');
    btnClear.type = 'button';
    btnClear.addEventListener('click', function () { boardState.chosen = []; renderPanel(); });
    tools.appendChild(btnClear);
    body.appendChild(tools);

    boardNav(body, { nextLabel: 'Tiếp: Chọn Lửa', next: function () {
      if (!boardChosenValid(recipe, boardState.chosen)) {
        showToast('Chưa xếp đủ dược liệu cho mẻ này (' + boardState.chosen.length + '/' + recipe.materials.length + ').');
        return;
      }
      var missing = missingList(player, Object.keys(needCounts).map(function (id) { return { itemId: id, count: needCounts[id] }; }));
      if (missing.length > 0) { showToast('Chưa đủ nguyên liệu: ' + missing.join(' · ') + '.'); return; }
      boardState.step = 2;
      renderPanel();
    } });
  }

  var SINH_PARENT = { moc: 'thuy', hoa: 'moc', tho: 'hoa', kim: 'tho', thuy: 'kim' };

  function renderBoardStep2(body, recipe) {
    var db = getDanBanAPI();
    var order = (db && db.ELEM_ORDER) || ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var names = (db && db.ELEM_NAMES) || ELEM_NAMES;
    body.appendChild(el('div', 'danphong-intro',
      'Đan hệ ' + names[recipe.elem] + '. Lửa cùng hệ tốt nhất; lửa hệ ' + names[SINH_PARENT[recipe.elem]] + ' (sinh ra hệ đan) cũng tốt; lửa hệ khác kém hẳn.'));
    var row = el('div', 'danboard-choice-row');
    order.forEach(function (elem) {
      var btn = el('button', 'btn wood danphong-btn danboard-elem-btn' + (boardState.fireElement === elem ? ' selected' : ''), names[elem]);
      btn.type = 'button';
      btn.addEventListener('click', function () { boardState.fireElement = elem; renderPanel(); });
      row.appendChild(btn);
    });
    body.appendChild(row);
    boardNav(body, { back: 1, nextLabel: 'Tiếp: Khống Hỏa', next: function () {
      if (!boardState.fireElement) { showToast('Hãy chọn hệ lửa cho lò.'); return; }
      boardState.step = 3;
      renderPanel();
    } });
  }

  function renderBoardStep3(body, recipe) {
    var db = getDanBanAPI();
    var hint = db && db.heatHintForRecipe ? db.heatHintForRecipe(recipe) : '';
    body.appendChild(el('div', 'danphong-intro',
      'Phương này hợp ' + hint + '. Chọn mức lửa — càng gần lửa hợp, điểm nhiệt càng cao. Khống Hỏa Quyết (thẻ Kỹ Năng) tăng thêm điểm nhiệt cho mẻ này.'));
    var levels = (db && db.HEAT_LEVELS) || [{ level: 1, name: 'Lửa Nhỏ' }, { level: 2, name: 'Lửa Vừa' }, { level: 3, name: 'Lửa Mạnh' }];
    var row = el('div', 'danboard-choice-row');
    levels.forEach(function (lv) {
      var btn = el('button', 'btn wood danphong-btn danboard-heat-btn' + (boardState.heatLevel === lv.level ? ' selected' : ''), lv.name);
      btn.type = 'button';
      btn.addEventListener('click', function () { boardState.heatLevel = lv.level; renderPanel(); });
      row.appendChild(btn);
    });
    body.appendChild(row);
    var dk = getDanKyNangAPI();
    if (dk && dk.getActiveBuffs) {
      var buffs = dk.getActiveBuffs(livePlayer);
      for (var i = 0; i < buffs.length; i++) {
        if (buffs[i].skillId === 'khong-hoa') {
          body.appendChild(el('div', 'danskill-buff-note', 'Khống Hỏa Quyết cấp ' + buffs[i].level + ' đang chờ — mẻ này được cộng thêm điểm nhiệt.'));
        }
      }
    }
    boardNav(body, { back: 2, nextLabel: 'Tiếp: Phong Đan', next: function () {
      if (!boardState.heatLevel) { showToast('Hãy chọn mức lửa.'); return; }
      boardState.step = 4;
      renderPanel();
    } });
  }

  function renderBoardStep4(body, recipe) {
    var db = getDanBanAPI();
    var names = (db && db.ELEM_NAMES) || ELEM_NAMES;
    var exactOrder = boardState.chosen.join('|') === recipe.materials.join('|');
    body.appendChild(el('div', 'danphong-intro',
      'Dược liệu: ' + (exactOrder ? 'đúng thứ tự phương' : 'chưa đúng thứ tự phương') +
      ' · Lửa: ' + names[boardState.fireElement] +
      ' · Mức lửa: ' + ((db && db.HEAT_LEVELS ? db.HEAT_LEVELS[boardState.heatLevel - 1].name : '') || '') +
      '. Chạm "Phong Đan" đúng lúc vạch quét ở vùng vàng giữa để phong đan trọn vẹn — Ngưng Đan Quyết (thẻ Kỹ Năng) tăng thêm điểm phong đan.'));

    var bar = el('div', 'danboard-seal-bar');
    bar.id = 'danboard-seal-bar';
    var zone = el('div', 'danboard-seal-zone');
    var half = (db && db.SEAL_ZONE_HALF) || 0.15;
    zone.style.left = ((0.5 - half) * 100) + '%';
    zone.style.width = (half * 2 * 100) + '%';
    bar.appendChild(zone);
    var marker = el('div', 'danboard-seal-marker');
    marker.id = 'danboard-seal-marker';
    bar.appendChild(marker);
    body.appendChild(bar);

    var lockBtn = el('button', 'btn wood danphong-btn danphong-btn-refine danboard-seal-btn', 'Phong Đan — Hoàn Thành Mẻ Luyện');
    lockBtn.type = 'button';
    body.appendChild(lockBtn);

    var dk = getDanKyNangAPI();
    if (dk && dk.getActiveBuffs) {
      var buffs = dk.getActiveBuffs(livePlayer);
      for (var i = 0; i < buffs.length; i++) {
        if (buffs[i].skillId === 'ngung-dan') {
          body.appendChild(el('div', 'danskill-buff-note', 'Ngưng Đan Quyết cấp ' + buffs[i].level + ' đang chờ — mẻ này được cộng thêm điểm phong đan.'));
        }
      }
    }

    function lockSeal() {
      var pos = 0.5;
      if (db && db.markerPositionAt) pos = db.markerPositionAt(Date.now() - sealStartMs);
      boardState.sealPosition = pos;
      finishBoardBatch();
    }
    lockBtn.addEventListener('click', lockSeal);
    bar.addEventListener('click', lockSeal);

    // Vạch quét: chỉ cập nhật vị trí phần tử, không vẽ lại modal.
    stopSealTimer();
    sealStartMs = Date.now();
    sealTimerId = setInterval(function () {
      var mk = document.getElementById('danboard-seal-marker');
      if (!mk) { stopSealTimer(); return; }
      var p = db && db.markerPositionAt ? db.markerPositionAt(Date.now() - sealStartMs) : 0.5;
      mk.style.left = (p * 100) + '%';
    }, 50);

    boardNav(body, { back: 3 });
  }

  function finishBoardBatch() {
    stopSealTimer();
    var player = livePlayer;
    var recipe = boardRecipeFor(boardState.pillId);
    var ld = getLuyenDanAPI();
    var db = getDanBanAPI();
    if (!ld || !ld.refineBatch || !db) {
      boardState.result = { ok: false, reason: 'no_api', msg: 'Mô đun luyện đan chưa sẵn sàng. Hãy tải lại game.' };
      boardState.step = 'result';
      renderPanel();
      return;
    }
    var built = db.buildBoardPlan(player, {
      pillId: boardState.pillId,
      materials: boardState.chosen.slice(),
      fireElement: boardState.fireElement,
      heatLevel: boardState.heatLevel,
      sealPosition: boardState.sealPosition,
      nowMs: Date.now()
    });
    var res = ld.refineBatch(player, built.plan);
    res._heatScore = built.heatScore;
    res._sealTiming = built.sealTiming;
    res._materialQualities = built.materialQualities;
    boardState.result = res;
    boardState.step = 'result';
    renderPanel();
  }

  function renderBoardResult(body, recipe) {
    var player = livePlayer;
    var res = boardState.result || { ok: false, msg: 'Không có kết quả.' };
    var card = el('div', 'danphong-card danboard-result');
    var head = el('div', 'danphong-card-head');
    var icon = el('div', 'danphong-card-icon');
    setElementIconSprite(icon, getItemDef(recipe.pillId), 40);
    head.appendChild(icon);
    var titles = el('div', 'danphong-card-titles');
    if (res.ok) {
      titles.appendChild(el('div', 'danphong-card-name', 'Luyện thành: ' + itemName(recipe.pillId)));
      titles.appendChild(el('div', 'danphong-card-sub',
        'Phẩm ' + (res.grade || '') + (res.danVan > 0 ? ' · Đan văn ' + res.danVan + ' vòng' : '') +
        ' · Điểm mẻ: ' + (typeof res.score === 'number' ? res.score.toFixed(2) : '')));
    } else if (res.reason === 'slag') {
      titles.appendChild(el('div', 'danphong-card-name', 'Mẻ hỏng thành đan cặn'));
      titles.appendChild(el('div', 'danphong-card-sub', 'Điểm mẻ: ' + (typeof res.score === 'number' ? res.score.toFixed(2) : '') + ' — dưới ngưỡng thành đan. Nửa nguyên liệu đã hoàn lại.'));
    } else {
      titles.appendChild(el('div', 'danphong-card-name', 'Mẻ luyện không chạy được'));
      titles.appendChild(el('div', 'danphong-card-sub', res.msg || 'Bị từ chối. Nguyên liệu và buff kỹ năng còn nguyên.'));
    }
    head.appendChild(titles);
    card.appendChild(head);

    var lines = [];
    if (res._materialQualities) {
      var db = getDanBanAPI();
      var lbl = db && db.qualityLabelFor ? db.qualityLabelFor(res._materialQualities) : '';
      if (lbl) lines.push('Phẩm chất nguyên liệu: ' + lbl + '.');
    }
    if (res.appliedSkills && res.appliedSkills.length > 0) {
      var dk = getDanKyNangAPI();
      var applied = res.appliedSkills.map(function (a) {
        var d = dk && dk.getSkillDef ? dk.getSkillDef(a.skillId) : null;
        return (d ? d.name : a.skillId) + ' cấp ' + a.level;
      }).join(' · ');
      lines.push('Kỹ năng đã áp vào mẻ: ' + applied + '.');
    }
    if (res.returned && res.returned.length > 0) {
      lines.push('Hoàn lại: ' + res.returned.map(function (r) { return itemName(r.itemId) + ' ×' + r.count; }).join(' · ') + '.');
    }
    var ld = getLuyenDanAPI();
    if (ld && ld.ensureState) {
      var s = ld.ensureState(player);
      lines.push('Đã luyện thành công: ' + (s.successes || 0) + ' mẻ.');
    }
    lines.forEach(function (t) { card.appendChild(el('div', 'danphong-source', t)); });

    // Gợi ý chuỗi học: vừa đủ điều kiện học quyết nào thì báo ngay tại đây.
    var dk2 = getDanKyNangAPI();
    if (dk2 && res.ok) {
      dk2.listSkills().forEach(function (def) {
        if (!dk2.isSkillLearned(player, def.id)) {
          var cond = dk2.canLearnSkill(player, def.id);
          if (cond.ok) {
            card.appendChild(el('div', 'danskill-buff-note', 'Đủ điều kiện học ' + def.name + ' — sang thẻ Kỹ Năng Luyện Đan để học.'));
          }
        }
      });
    }

    var actions = el('div', 'danphong-actions');
    var btnAgain = el('button', 'btn wood danphong-btn danphong-btn-refine', 'Luyện Mẻ Nữa');
    btnAgain.type = 'button';
    btnAgain.addEventListener('click', function () {
      var pillId = boardState.pillId;
      openBoard(pillId);
      renderPanel();
    });
    actions.appendChild(btnAgain);
    var btnBack = el('button', 'btn wood danphong-btn', 'Về Danh Sách');
    btnBack.type = 'button';
    btnBack.addEventListener('click', function () { closeBoard(); renderPanel(); });
    actions.appendChild(btnBack);
    card.appendChild(actions);
    body.appendChild(card);
  }

  function renderBoardView(body) {
    var recipe = boardRecipeFor(boardState.pillId);
    if (!recipe) { closeBoard(); renderRefineTab(body); return; }
    if (boardState.step === 'result') {
      boardHeader(body, recipe);
      renderBoardResult(body, recipe);
      return;
    }
    boardHeader(body, recipe);
    if (boardState.step === 1) renderBoardStep1(body, recipe);
    else if (boardState.step === 2) renderBoardStep2(body, recipe);
    else if (boardState.step === 3) renderBoardStep3(body, recipe);
    else if (boardState.step === 4) renderBoardStep4(body, recipe);
    else { boardState.step = 1; renderBoardStep1(body, recipe); }
  }

  // Đợt DANBOARD-FIX: đổi khung nhìn (thẻ/bước ván) thì cuộn về đầu để
  // phần đầu nội dung không bị cắt; vẽ lại cùng khung nhìn thì giữ vị trí.
  var lastRenderKey = '';

  function renderPanel() {
    if (typeof document === 'undefined') return;
    if (!livePlayer) return;
    ensureState(livePlayer);
    // Đợt DANBOARD: vẽ lại modal thì dừng vạch quét cũ; bước phong đan sẽ
    // khởi động lại vạch khi nó được vẽ.
    stopSealTimer();

    var tabRefine = document.getElementById('danphong-tab-refine');
    var tabBoard = document.getElementById('danphong-tab-board');
    if (tabRefine) tabRefine.classList.toggle('active', currentTab === 'refine');
    if (tabBoard) tabBoard.classList.toggle('active', currentTab === 'board');
    var tabSkills = document.getElementById('danphong-tab-skills');
    if (tabSkills) tabSkills.classList.toggle('active', currentTab === 'skills');

    var body = document.getElementById('danphong-body');
    if (!body) return;
    var renderKey = currentTab + '|' + (boardState ? (boardState.pillId + ':' + boardState.step) : '');
    var viewChanged = renderKey !== lastRenderKey;
    lastRenderKey = renderKey;
    body.innerHTML = '';
    if (currentTab === 'board') renderBoardTab(body);
    else if (currentTab === 'skills') renderSkillsTab(body);
    else if (boardState) renderBoardView(body);
    else renderRefineTab(body);
    if (viewChanged) body.scrollTop = 0;
  }

  function openPanel(tab) {
    if (typeof document === 'undefined') return;
    var modal = document.getElementById('danphong-modal');
    if (!modal) return;
    if (tab === 'board' || tab === 'refine' || tab === 'skills') currentTab = tab;
    modal.classList.remove('hidden');
    renderPanel();
  }

  function closePanel() {
    if (typeof document === 'undefined') return;
    stopSealTimer();
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
    var tabSkills = document.getElementById('danphong-tab-skills');
    if (tabSkills && !tabSkills.dataset.wired) {
      tabSkills.dataset.wired = '1';
      tabSkills.addEventListener('click', function () { currentTab = 'skills'; renderPanel(); });
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
  exports.AUX_RECIPES = AUX_RECIPES;
  exports.getAuxRecipe = getAuxRecipe;
  exports.refineAux = refineAux;
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
  // Đợt DANBOARD: ván luyện đan 4 bước
  exports.openBoard = openBoard;
  exports.closeBoard = closeBoard;
  exports.boardRecipeFor = boardRecipeFor;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameDanPhong = {}));

// Đợt D2: re-export API Luyện Đan tương tác qua Dan Phong module (tương thích test/import).
try {
  var _ldD2 = require('./luyendan.js');
  if (_ldD2 && typeof module !== 'undefined' && module.exports) {
    for (var _k in _ldD2) { if (!module.exports[_k]) module.exports[_k] = _ldD2[_k]; }
  }
  if (typeof window !== 'undefined') { window.GameLuyenDan = window.GameLuyenDan || _ldD2; }
} catch (e) {}
