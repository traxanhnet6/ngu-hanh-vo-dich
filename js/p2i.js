/**
 * Đợt P2I — THƯƠNG NHÂN LƯU ĐỘNG + CHỢ ĐÊM NPC
 * (P2-DESIGN §10; hồ sơ 16§4).
 *
 * - Thương nhân lưu động: lịch theo GIỜ THẬT (không phụ thuộc đồng hồ M1).
 *   Mỗi chu kỳ 8 giờ, hạt giống tất định từ số chu kỳ -> giờ mở, độ dài,
 *   vùng xuất hiện, mặt hàng, số lượng còn. Hàng lấy từ ITEM_DEFS HIỆN CÓ.
 * - Chợ đêm NPC: mở cố định cuối tuần (Thứ Bảy/Chủ Nhật) 18:00–23:00 tại
 *   Khu Dân Cư (Tông Môn); sạp NPC bán hàng theo TUẦN (hạt giống theo tuần).
 *   KHÔNG có bày sạp người chơi (phần đó là online, ngoài phạm vi đợt này).
 *
 * Mọi tên/số đều PROVISIONAL — bảng hằng số ở P2I_CONST, chờ Bui chốt.
 * Không sửa rollDrops / HH_SWORD_DISPLAY / exchangePill / refineTrucCoDan /
 * getLinhThachTaperFactor / 8 nút skill / LOADOUT.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // BẢNG HẰNG SỐ PROVISIONAL (ghi đầy đủ trong P2I-REPORT.md)
  // ==========================================================================
  var P2I_CONST = {
    CYCLE_MS: 8 * 60 * 60 * 1000,   // chu kỳ thương nhân lưu động: 8 giờ
    EPOCH_MS: 1767225600000,        // 2026-01-01T00:00:00Z — mốc tính chu kỳ
    OFFSET_MIN_MAX: 300,            // cửa sổ mở muộn nhất trong chu kỳ: 300 phút
    WINDOW_MIN_LO: 120,             // xuất hiện ngắn nhất: 2 giờ
    WINDOW_MIN_HI: 180,             // xuất hiện dài nhất: 3 giờ
    KINDS_LO: 3,                    // số mặt hàng ít nhất mỗi lượt
    KINDS_HI: 4,                    // số mặt hàng nhiều nhất mỗi lượt
    WANDER_STOCK_LO: 1,             // hàng ít: 1–3 món mỗi mặt hàng
    WANDER_STOCK_HI: 3,
    MARKET_WEEKDAYS: [6, 0],        // Thứ Bảy, Chủ Nhật (getDay)
    MARKET_OPEN_HOUR: 18,           // chợ đêm mở 18:00
    MARKET_CLOSE_HOUR: 23,          // chợ đêm đóng 23:00
    MARKET_STOCK_LO: 2,             // tồn mỗi mặt hàng mỗi tuần: 2–4
    MARKET_STOCK_HI: 4,
    ANNOUNCE_MIN_GAP_MS: 1000,      // nhịp tick kiểm lịch
    // Toạ độ NPC (đã kiểm isWalkable trên mapdata.js của cây này)
    WANDER_FEET: { x: 170, y: 640 },
    WANDER_STAND: { x: 170, y: 662 },
    STALL_FEET: [
      { x: 330, y: 1160 },
      { x: 420, y: 1140 },
      { x: 560, y: 1120 }
    ]
  };

  // Vùng ĐÃ CÓ trong game — nơi thương nhân lưu động có thể xuất hiện.
  var ZONES = [
    { mapId: 'rung-doc', npcId: 'p2i_khach_la_rd', name: 'Rừng Độc Thanh Tụy', hint: 'chỗ trũng sương độc dưới chân núi' },
    { mapId: 'ho-bang', npcId: 'p2i_khach_la_hb', name: 'Hồ Băng Hàn Kính', hint: 'bờ hồ băng phía bắc' },
    { mapId: 'mo-lua', npcId: 'p2i_khach_la_ml', name: 'Mỏ Lửa Xích Diệm', hint: 'miệng mỏ lửa phía đông' },
    { mapId: 'hoang-mac', npcId: 'p2i_khach_la_hm', name: 'Hoang Mạc Hoàng Sa', hint: 'rìa hoang mạc cát trắng' },
    { mapId: 'kiem-trung', npcId: 'p2i_khach_la_kt', name: 'Kiếm Trủng Huyền Thiết', hint: 'lối mòn vào kiếm trủng' }
  ];

  // Giá PROVISIONAL (Linh Thạch). Vật phẩm phải CÓ THẬT trong ITEM_DEFS.
  var PRICES = {
    'hat-giong-linh-me': 60,
    'nguyen-tinh-kim': 180,
    'nguyen-tinh-hoa': 180,
    'nguyen-tinh-thuy': 170,
    'nguyen-tinh-tho': 170,
    'nguyen-tinh-moc': 170,
    'linh-chi-ngan-nam': 220,
    'bang-tuy-ngan-nam': 220,
    'loi-huyen-thiet': 320,
    'tuyet-lien': 260,
    'ngoc-trai-ho': 260,
    'nuoc-oc-dao-tinh-khiet': 240,
    'bp_kiem_truc_van': 400,
    'bp_giap_truc_van': 400,
    'bp_phap_khi_dong': 320,
    'bp_kiem_thanh_bo': 260,
    'bp_dai_thanh_bo': 260,
    'dia-tam-thach': 150,
    'tinh-thiet-tho': 110,
    'go-tram-huong': 90,
    'linh-chi-rung': 45,
    'hoa-giai-doc': 35,
    'la-thanh-tuy': 20,
    'quang-sat-huyen': 40,
    'go-thiet-moc': 35,
    'da-tay-luyen': 60,
    'canh-go-muc': 25,
    'bang-tuy': 120
  };

  // Hàng thương nhân lưu động: hạt giống lạ / bí tịch / nguyên liệu hiếm.
  var WANDER_POOL = [
    { itemId: 'hat-giong-linh-me' },
    { itemId: 'bp_kiem_truc_van' },
    { itemId: 'bp_giap_truc_van' },
    { itemId: 'bp_phap_khi_dong' },
    { itemId: 'bp_kiem_thanh_bo' },
    { itemId: 'nguyen-tinh-kim' },
    { itemId: 'nguyen-tinh-hoa' },
    { itemId: 'nguyen-tinh-thuy' },
    { itemId: 'nguyen-tinh-tho' },
    { itemId: 'nguyen-tinh-moc' },
    { itemId: 'linh-chi-ngan-nam' },
    { itemId: 'bang-tuy-ngan-nam' },
    { itemId: 'loi-huyen-thiet' },
    { itemId: 'tuyet-lien' },
    { itemId: 'ngoc-trai-ho' },
    { itemId: 'nuoc-oc-dao-tinh-khiet' },
    { itemId: 'dia-tam-thach' },
    { itemId: 'tinh-thiet-tho' },
    { itemId: 'go-tram-huong' }
  ];

  // Sạp chợ đêm NPC — tên TẠM, chờ Bui chốt.
  var STALLS = [
    {
      id: 'p2i_stall_1',
      name: 'Sạp Đêm · Dược Phòng',
      goods: [{ itemId: 'la-thanh-tuy' }, { itemId: 'linh-chi-rung' }, { itemId: 'hoa-giai-doc' }]
    },
    {
      id: 'p2i_stall_2',
      name: 'Sạp Đêm · Khí Cụ',
      goods: [{ itemId: 'quang-sat-huyen' }, { itemId: 'go-thiet-moc' }, { itemId: 'canh-go-muc' }]
    },
    {
      id: 'p2i_stall_3',
      name: 'Sạp Đêm · Hàng Lạ',
      goods: [{ itemId: 'da-tay-luyen' }, { itemId: 'hat-giong-linh-me' }, { itemId: 'nguyen-tinh-moc' }]
    }
  ];

  // Hàng xoay theo TUẦN: mỗi sạp thêm 1 món chọn tất định từ danh sách này.
  var WEEKLY_ROTATION = [
    { itemId: 'nguyen-tinh-hoa' },
    { itemId: 'nguyen-tinh-kim' },
    { itemId: 'tinh-thiet-tho' },
    { itemId: 'go-tram-huong' },
    { itemId: 'linh-chi-ngan-nam' },
    { itemId: 'bang-tuy' },
    { itemId: 'bp_dai_thanh_bo' },
    { itemId: 'dia-tam-thach' }
  ];

  var SHOP_MODAL_ID = 'p2i-shop-modal';
  var currentShop = null;
  var nowProvider = null;
  var lastTickMs = 0;

  // ==========================================================================
  // TIỆN ÍCH
  // ==========================================================================
  function nowMs() {
    if (typeof nowProvider === 'function') {
      var v = nowProvider();
      if (typeof v === 'number' && isFinite(v)) return v;
    }
    return Date.now();
  }
  function getEngine() {
    return (typeof window !== 'undefined' && window.GameEngine) ? window.GameEngine : null;
  }
  function getPlayer() {
    var eng = getEngine();
    return eng && eng.getPlayer ? eng.getPlayer() : null;
  }
  function getStateAPI() {
    if (typeof window !== 'undefined' && window.GameState) return window.GameState;
    if (typeof global !== 'undefined' && global.GameState) return global.GameState;
    try { return require('./state.js'); } catch (e) { return null; }
  }
  function getItemDefs() {
    if (typeof window !== 'undefined' && window.GameMonsters && window.GameMonsters.ITEM_DEFS) return window.GameMonsters.ITEM_DEFS;
    if (typeof global !== 'undefined' && global.GameMonsters && global.GameMonsters.ITEM_DEFS) return global.GameMonsters.ITEM_DEFS;
    try { return require('./monsters.js').ITEM_DEFS; } catch (e) { return {}; }
  }
  function toast(msg) {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) window.GameUI.showToast(msg);
  }
  function refreshHUD() {
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.refreshHUD) window.GameUI.refreshHUD();
  }
  function save(player) {
    var st = getStateAPI();
    if (st && st.savePlayer && player) st.savePlayer(player);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) {
    var d = new Date(ms);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // Hạt giống 32-bit tất định: cùng số chu kỳ -> cùng lịch/hàng trên mọi máy.
  function hash32(n) {
    var x = n | 0;
    x = (x ^ 61) ^ (x >>> 16);
    x = (x + (x << 3)) | 0;
    x = x ^ (x >>> 4);
    x = Math.imul(x, 0x27d4eb2d);
    x = x ^ (x >>> 15);
    return x >>> 0;
  }

  // ==========================================================================
  // TRẠNG THÁI NGƯỜI CHƠI (chỉ thêm khóa p2i, không đụng khóa khác)
  // ==========================================================================
  function ensureState(player) {
    if (!player || typeof player !== 'object') return null;
    if (!player.p2i || typeof player.p2i !== 'object') player.p2i = {};
    var s = player.p2i;
    if (!s.wander || typeof s.wander !== 'object') s.wander = { cycleKey: null, sold: {} };
    if (!s.wander.sold || typeof s.wander.sold !== 'object') s.wander.sold = {};
    if (!s.market || typeof s.market !== 'object') s.market = { weekKey: '', sold: {} };
    if (!s.market.sold || typeof s.market.sold !== 'object') s.market.sold = {};
    if (typeof s.announceCycle !== 'number') s.announceCycle = -1;
    if (typeof s.announceMarketWeek !== 'string') s.announceMarketWeek = '';
    return s;
  }

  // ==========================================================================
  // LỊCH THƯƠNG NHÂN LƯU ĐỘNG (giờ thật)
  // ==========================================================================
  function cycleFor(now) {
    var t = (now === undefined) ? nowMs() : now;
    var idx = Math.floor((t - P2I_CONST.EPOCH_MS) / P2I_CONST.CYCLE_MS);
    var base = P2I_CONST.EPOCH_MS + idx * P2I_CONST.CYCLE_MS;
    var h = hash32(idx + 1);
    var offsetMin = h % (P2I_CONST.OFFSET_MIN_MAX + 1);
    var durMin = P2I_CONST.WINDOW_MIN_LO + ((h >>> 9) % (P2I_CONST.WINDOW_MIN_HI - P2I_CONST.WINDOW_MIN_LO + 1));
    var start = base + offsetMin * 60000;
    var end = start + durMin * 60000;
    var zone = ZONES[(h >>> 17) % ZONES.length];
    return { cycleKey: idx, start: start, end: end, durMin: durMin, zone: zone };
  }

  function wanderState(now) {
    var t = (now === undefined) ? nowMs() : now;
    var c = cycleFor(t);
    var active = t >= c.start && t < c.end;
    // Lượt kế tiếp: nếu lượt này chưa mở thì chính nó, nếu đã đóng thì sang chu kỳ sau.
    var nextOpenAt = active ? null : (t < c.start ? c.start : cycleFor(c.start + P2I_CONST.CYCLE_MS).start);
    return {
      active: active,
      cycleKey: c.cycleKey,
      zoneId: c.zone.mapId,
      zoneName: c.zone.name,
      hint: c.zone.hint,
      npcId: c.zone.npcId,
      opensAt: c.start,
      endsAt: c.end,
      nextOpenAt: nextOpenAt,
      durMin: c.durMin
    };
  }

  // Nhãn ngày cho câu thông báo: hôm nay / mai / thứ trong tuần.
  function dayLabel(ms) {
    var a = new Date(nowMs());
    var b = new Date(ms);
    var da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    var db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    var diff = Math.round((db - da) / 86400000);
    if (diff === 0) return 'hôm nay ';
    if (diff === 1) return 'mai ';
    return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][b.getDay()] + ' ';
  }

  function buildWanderStock(cycleKey) {
    var h = hash32(Math.imul(cycleKey, 2654435761) + 7);
    var kinds = P2I_CONST.KINDS_LO + (h % (P2I_CONST.KINDS_HI - P2I_CONST.KINDS_LO + 1));
    var pool = WANDER_POOL.slice();
    var out = [];
    var seed = h;
    for (var i = 0; i < kinds && pool.length > 0; i++) {
      seed = hash32(seed + i * 131 + 17);
      var idx = seed % pool.length;
      var entry = pool.splice(idx, 1)[0];
      var stock = P2I_CONST.WANDER_STOCK_LO + ((seed >>> 7) % (P2I_CONST.WANDER_STOCK_HI - P2I_CONST.WANDER_STOCK_LO + 1));
      out.push({ itemId: entry.itemId, price: priceOf(entry.itemId), stock: stock });
    }
    return out;
  }

  function syncWander(player, cycleKey) {
    var st = ensureState(player);
    if (!st) return null;
    if (st.wander.cycleKey !== cycleKey) {
      st.wander.cycleKey = cycleKey;
      st.wander.sold = {};
    }
    return st.wander;
  }

  // ==========================================================================
  // LỊCH CHỢ ĐÊM NPC (cuối tuần, giờ thật)
  // ==========================================================================
  function weekKeyOf(now) {
    var d = new Date(now);
    // Tuần bắt đầu Thứ Hai, giờ địa phương — cùng khóa tuần với
    // js/thap-tu-luyen.js (bảng tuần đặt lại lúc thứ Hai 00:00).
    var wd = (d.getDay() + 6) % 7; // Thứ Hai = 0
    var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd);
    return monday.getFullYear() + '-' + pad2(monday.getMonth() + 1) + '-' + pad2(monday.getDate());
  }

  function marketState(now) {
    var t = (now === undefined) ? nowMs() : now;
    var d = new Date(t);
    var wd = d.getDay();
    var isMarketDay = P2I_CONST.MARKET_WEEKDAYS.indexOf(wd) >= 0;
    var hour = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    var open = isMarketDay && hour >= P2I_CONST.MARKET_OPEN_HOUR && hour < P2I_CONST.MARKET_CLOSE_HOUR;

    var openAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), P2I_CONST.MARKET_OPEN_HOUR, 0, 0, 0);
    var closeAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), P2I_CONST.MARKET_CLOSE_HOUR, 0, 0, 0);
    if (open) {
      // đang mở: giờ đóng hôm nay; nếu chưa mở thì tìm buổi chợ kế tiếp
    } else if (t >= closeAt.getTime() || !isMarketDay) {
      var probe = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, P2I_CONST.MARKET_OPEN_HOUR, 0, 0, 0);
      var guard = 0;
      while (P2I_CONST.MARKET_WEEKDAYS.indexOf(probe.getDay()) < 0 && guard < 8) {
        probe.setDate(probe.getDate() + 1);
        guard++;
      }
      openAt = probe;
      closeAt = new Date(probe.getFullYear(), probe.getMonth(), probe.getDate(), P2I_CONST.MARKET_CLOSE_HOUR, 0, 0, 0);
    }
    return {
      open: open,
      weekKey: weekKeyOf(t),
      opensAt: openAt.getTime(),
      closesAt: open ? closeAt.getTime() : new Date(openAt.getTime() + 5 * 3600 * 1000).getTime()
    };
  }

  function syncMarket(player, weekKey) {
    var st = ensureState(player);
    if (!st) return null;
    if (st.market.weekKey !== weekKey) {
      st.market.weekKey = weekKey;
      st.market.sold = {};
    }
    return st.market;
  }

  function priceOf(itemId) {
    var p = PRICES[itemId];
    return (typeof p === 'number') ? p : 100;
  }

  function weeklyPick(weekKey, stallIdx) {
    var h = hash32(stallIdx * 97 + 3);
    for (var i = 0; i < weekKey.length; i++) h = hash32(h + weekKey.charCodeAt(i) * (i + 1));
    return WEEKLY_ROTATION[h % WEEKLY_ROTATION.length].itemId;
  }

  // Hàng của một sạp trong tuần: 3 món cố định + 1 món xoay tuần.
  function buildMarketStock(stallIdx, weekKey) {
    var stall = STALLS[stallIdx];
    if (!stall) return [];
    var out = [];
    var h = hash32(stallIdx * 613 + 11);
    for (var w = 0; w < weekKey.length; w++) h = hash32(h + weekKey.charCodeAt(w) * (w + 3));
    for (var i = 0; i < stall.goods.length; i++) {
      var itemId = stall.goods[i].itemId;
      var stock = P2I_CONST.MARKET_STOCK_LO + (hash32(h + i * 53) % (P2I_CONST.MARKET_STOCK_HI - P2I_CONST.MARKET_STOCK_LO + 1));
      out.push({ itemId: itemId, price: priceOf(itemId), stock: stock, weekly: false });
    }
    var extra = weeklyPick(weekKey, stallIdx);
    var dup = false;
    for (var k = 0; k < out.length; k++) if (out[k].itemId === extra) dup = true;
    if (!dup) {
      out.push({ itemId: extra, price: priceOf(extra), stock: 1, weekly: true });
    }
    return out;
  }

  // ==========================================================================
  // CỔNG HIỂN THỊ NPC (engine gọi qua isNpcActive)
  // ==========================================================================
  function isNpcVisible(npcId) {
    if (!npcId) return false;
    var now = nowMs();
    for (var i = 0; i < ZONES.length; i++) {
      if (ZONES[i].npcId === npcId) {
        var ws = wanderState(now);
        return ws.active && ws.zoneId === ZONES[i].mapId;
      }
    }
    for (var s = 0; s < STALLS.length; s++) {
      if (STALLS[s].id === npcId) return marketState(now).open;
    }
    return false;
  }

  // ==========================================================================
  // BÁO MẬP MỜ (toast + bảng thông báo hiện có)
  // ==========================================================================
  function noticeLine(now) {
    var t = (now === undefined) ? nowMs() : now;
    var ws = wanderState(t);
    var ms = marketState(t);
    var parts = [];
    if (ws.active) {
      parts.push('Nghe nói có khách lạ ở ' + ws.hint + ' (tới ' + hhmm(ws.endsAt) + ').');
    } else {
      var at = ws.nextOpenAt || ws.opensAt;
      parts.push('Khách lạ: chưa ai thấy, nghe đâu ' + dayLabel(at) + hhmm(at) + ' mới xuất hiện.');
    }
    parts.push(ms.open
      ? 'Chợ đêm đang mở ở Khu Dân Cư tới ' + hhmm(ms.closesAt) + '.'
      : 'Chợ đêm mở ' + hhmm(ms.opensAt) + ' (cuối tuần).');
    return parts.join(' ');
  }

  function tick() {
    var t = nowMs();
    if (t - lastTickMs < P2I_CONST.ANNOUNCE_MIN_GAP_MS) return;
    lastTickMs = t;
    var player = getPlayer();
    if (!player) return;
    var st = ensureState(player);
    if (!st) return;

    var ws = wanderState(t);
    if (ws.active && st.announceCycle !== ws.cycleKey) {
      st.announceCycle = ws.cycleKey;
      save(player);
      toast('Nghe nói có khách lạ ở ' + ws.hint + '. Hàng hiếm, chậm chân là hết.');
    }

    var ms = marketState(t);
    if (ms.open && st.announceMarketWeek !== ms.weekKey) {
      st.announceMarketWeek = ms.weekKey;
      save(player);
      toast('Chợ đêm mở ở Khu Dân Cư tới ' + hhmm(ms.closesAt) + ' — sạp NPC bán hàng theo tuần.');
    }
  }

  // ==========================================================================
  // BẢNG MUA BÁN
  // ==========================================================================
  function goodsFor(shop, player) {
    var st = ensureState(player);
    if (!st) return [];
    var t = nowMs();
    var defs = getItemDefs();
    var list = [];
    var sold = {};
    var key = '';

    if (shop.kind === 'wander') {
      var ws = wanderState(t);
      if (!ws.active) return [];
      var wst = syncWander(player, ws.cycleKey);
      sold = wst.sold;
      key = 'w';
      var built = buildWanderStock(ws.cycleKey);
      for (var i = 0; i < built.length; i++) {
        list.push({
          itemId: built[i].itemId,
          price: built[i].price,
          stock: built[i].stock,
          weekly: false,
          key: key + ':' + built[i].itemId
        });
      }
    } else {
      var ms = marketState(t);
      if (!ms.open) return [];
      var mst = syncMarket(player, ms.weekKey);
      sold = mst.sold;
      key = 'm' + (shop.stallIdx || 0);
      var builtM = buildMarketStock(shop.stallIdx || 0, ms.weekKey);
      for (var j = 0; j < builtM.length; j++) {
        list.push({
          itemId: builtM[j].itemId,
          price: builtM[j].price,
          stock: builtM[j].stock,
          weekly: builtM[j].weekly,
          key: key + ':' + builtM[j].itemId
        });
      }
    }

    for (var k = 0; k < list.length; k++) {
      var def = defs[list[k].itemId];
      list[k].name = def ? def.name : list[k].itemId;
      list[k].desc = def ? (def.desc || '') : 'Chưa có mô tả.';
      var soldN = sold[list[k].key] || 0;
      list[k].remaining = Math.max(0, list[k].stock - soldN);
    }
    return list;
  }

  function buyItem(itemId) {
    var player = getPlayer();
    if (!player || !currentShop) return { ok: false, msg: 'Không có dữ liệu.' };
    var list = goodsFor(currentShop, player);
    var good = null;
    for (var i = 0; i < list.length; i++) if (list[i].itemId === itemId) good = list[i];
    if (!good) return { ok: false, msg: currentShop.kind === 'wander' ? 'Khách đã đi rồi.' : 'Sạp đã đóng.' };
    if (good.remaining <= 0) return { ok: false, msg: 'Món này hết hàng rồi.' };
    if ((player.linhThach || 0) < good.price) {
      return { ok: false, msg: 'Không đủ Linh Thạch (cần ' + good.price + ', đang có ' + (player.linhThach || 0) + ').' };
    }

    var stateAPI = getStateAPI();
    var add = stateAPI && stateAPI.addItemToBag
      ? stateAPI.addItemToBag(player, itemId, 1, getItemDefs())
      : { success: false };
    if (!add || !add.success) return { ok: false, msg: 'Túi đầy — không mua được.' };

    player.linhThach = (player.linhThach || 0) - good.price;
    if (currentShop.kind === 'wander') {
      var ws = wanderState();
      var wst = syncWander(player, ws.cycleKey);
      wst.sold[good.key] = (wst.sold[good.key] || 0) + 1;
    } else {
      var ms = marketState();
      var mst = syncMarket(player, ms.weekKey);
      mst.sold[good.key] = (mst.sold[good.key] || 0) + 1;
    }
    save(player);
    refreshHUD();
    var left = good.remaining - 1;
    return { ok: true, msg: 'Mua ' + good.name + ' — ' + good.price + ' Linh Thạch. Còn ' + left + ' món.' };
  }

  // ==========================================================================
  // GIAO DIỆN (dùng lại khung bảng tiệm hiện có: modal-overlay/panel/sect-shop-*)
  // ==========================================================================
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function shopHeaderText(shop) {
    if (shop.kind === 'wander') {
      var ws = wanderState();
      return {
        title: 'KHÁCH LẠ — HÀNG HIẾM (tên tạm)',
        sub: 'Dừng chân ở ' + ws.zoneName + ' tới ' + hhmm(ws.endsAt) + ' · giá PROVISIONAL'
      };
    }
    var ms = marketState();
    var stall = STALLS[shop.stallIdx || 0];
    return {
      title: (stall ? stall.name : 'SẠP ĐÊM') + ' (tên tạm)',
      sub: 'Chợ đêm Khu Dân Cư tới ' + hhmm(ms.closesAt) + ' · hàng theo tuần · giá PROVISIONAL'
    };
  }

  function renderShop() {
    if (typeof document === 'undefined' || !currentShop) return;
    var player = getPlayer();
    var bodyEl = document.getElementById('p2i-shop-body');
    var titleEl = document.getElementById('p2i-shop-title');
    var subEl = document.getElementById('p2i-shop-sub');
    var statusEl = document.getElementById('p2i-shop-status');
    if (!bodyEl) return;

    var head = shopHeaderText(currentShop);
    if (titleEl) titleEl.textContent = head.title;
    if (subEl) subEl.textContent = head.sub;
    if (statusEl) {
      statusEl.innerHTML = '<span>Linh Thạch: <b>' + (player ? (player.linhThach || 0) : 0) + '</b></span>' +
        '<span>Hàng ít, mua xong là hết</span>';
    }

    bodyEl.innerHTML = '';
    var list = goodsFor(currentShop, player);
    if (!list.length) {
      bodyEl.appendChild(el('div', 'sect-shop-desc', 'Không còn hàng để bán lúc này.'));
      return;
    }

    for (var i = 0; i < list.length; i++) {
      (function (good) {
        var card = el('div', 'sect-shop-card');
        var info = el('div', 'sect-shop-info');
        info.appendChild(el('div', 'sect-shop-title', good.name + (good.weekly ? '  (hàng tuần)' : '')));
        info.appendChild(el('div', 'sect-shop-desc', good.desc));
        var meta = el('div', 'sect-shop-meta');
        meta.innerHTML = 'Giá: <span class="reward-lt">' + good.price + ' LT</span> · Còn: ' + good.remaining + '/' + good.stock;
        info.appendChild(meta);
        card.appendChild(info);

        var btn = document.createElement('button');
        btn.type = 'button';
        if (good.remaining <= 0) {
          btn.className = 'btn wood disabled';
          btn.disabled = true;
          btn.textContent = 'Hết Hàng';
        } else if (player && (player.linhThach || 0) < good.price) {
          btn.className = 'btn wood disabled';
          btn.disabled = true;
          btn.textContent = 'Thiếu Linh Thạch';
        } else {
          btn.className = 'btn wood';
          btn.textContent = 'Mua 1';
          btn.addEventListener('click', function () {
            var r = buyItem(good.itemId);
            if (r && r.msg) toast(r.msg);
            renderShop();
          });
        }
        card.appendChild(btn);
        bodyEl.appendChild(card);
      })(list[i]);
    }
  }

  function openShop(kind, stallIdx) {
    if (kind === 'market') currentShop = { kind: 'market', stallIdx: stallIdx || 0 };
    else currentShop = { kind: 'wander' };
    renderShop();
    var modal = document.getElementById(SHOP_MODAL_ID);
    if (modal) modal.classList.remove('hidden');
  }

  function closeShop() {
    var modal = document.getElementById(SHOP_MODAL_ID);
    if (modal) modal.classList.add('hidden');
  }

  function wireShopModal() {
    if (typeof document === 'undefined') return;
    var closeBtn = document.getElementById('close-p2i-shop-modal');
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = '1';
      closeBtn.addEventListener('click', closeShop);
    }
    var modal = document.getElementById(SHOP_MODAL_ID);
    if (modal && !modal.dataset.wired) {
      modal.dataset.wired = '1';
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeShop();
      });
    }
  }

  // Gọi từ engine khi đóng thoại NPC (móc hẹp trong handleNpcTalked).
  function onNpcTalked(npcId) {
    if (!npcId) return false;
    if (npcId === 'p2i_khach_la' || npcId.indexOf('p2i_khach_la_') === 0) {
      if (!isNpcVisible(npcId)) return false;
      openShop('wander');
      return true;
    }
    for (var s = 0; s < STALLS.length; s++) {
      if (STALLS[s].id === npcId) {
        if (!isNpcVisible(npcId)) return false;
        openShop('market', s);
        return true;
      }
    }
    return false;
  }

  var API = {
    P2I_CONST: P2I_CONST,
    ZONES: ZONES,
    STALLS: STALLS,
    PRICES: PRICES,
    ensureState: ensureState,
    nowMs: nowMs,
    cycleFor: cycleFor,
    wanderState: wanderState,
    buildWanderStock: buildWanderStock,
    marketState: marketState,
    buildMarketStock: buildMarketStock,
    weekKeyOf: weekKeyOf,
    isNpcVisible: isNpcVisible,
    noticeLine: noticeLine,
    tick: tick,
    goodsFor: goodsFor,
    buyItem: buyItem,
    openShop: openShop,
    closeShop: closeShop,
    renderShop: renderShop,
    onNpcTalked: onNpcTalked,
    setNowProvider: function (fn) { nowProvider = fn; lastTickMs = 0; }
  };

  exports.GameP2I = API;

  if (typeof window !== 'undefined') {
    window.GameP2I = API;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireShopModal);
    } else {
      wireShopModal();
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : (typeof exports !== 'undefined' ? exports : this));
