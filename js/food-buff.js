/**
 * js/food-buff.js — Module Thức Ăn & Buff Hồi Phục Khí Huyết / Linh Lực Theo Giờ
 *
 * Thiết kế theo Brief LINHME (HEAD 5150ded) & LINHME-DESIGN.md.
 * Tính năng:
 *  1. Định nghĩa các món linh thực (Cơm Linh Mễ, Cơm Hấp Băng Tinh, Cháo Linh Chi).
 *  2. Hệ thống hồi phục liên tục theo nhịp tick (mỗi 5s hồi một lượng HP và Mana).
 *  3. Kéo dài theo giờ (1h, 2h, 3h).
 *  4. Chống cộng dồn lạm dụng (Single buff active, ăn cùng món chỉ làm mới thời gian, ăn khác món ghi đè).
 *  5. Hoạt động chính xác theo thời gian thực (real-time catch up) khi đóng game rồi mở lại.
 *  6. Đổi thức ăn tại Dược Sư / Tông Môn bằng Linh Mễ và nguyên liệu liên quan.
 *
 * Chạy trên trình duyệt (window.GameFoodBuff) và Node.js (require/exports).
 */

(function (exports) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. CẤU HÌNH & HẰNG SỐ (PROVISIONAL)
  // ---------------------------------------------------------------------------

  var TICK_INTERVAL_SEC = 5; // Nhịp hồi phục mỗi 5 giây (PROVISIONAL)

  var FOOD_DEFS = {
    'com-linh-me': {
      id: 'com-linh-me',
      name: 'Cơm Linh Mễ',
      durationSec: 3600, // 1 giờ (PROVISIONAL)
      tickIntervalSec: TICK_INTERVAL_SEC,
      hpPerTick: 10,     // 10 HP / 5s = 2.0 HP/s (PROVISIONAL)
      mpPerTick: 8,      // 8 MP / 5s = 1.6 MP/s (PROVISIONAL)
      iconCol: 5,
      iconRow: 5,
      desc: 'Bát cơm trắng ngát hương linh mễ. Ăn vào hồi +10 Khí Huyết và +8 Linh Lực mỗi 5 giây, liên tục trong 1 giờ.'
    },
    'com-linh-me-hap': {
      id: 'com-linh-me-hap',
      name: 'Cơm Linh Mễ Hấp Băng Tinh',
      durationSec: 7200, // 2 giờ (PROVISIONAL)
      tickIntervalSec: TICK_INTERVAL_SEC,
      hpPerTick: 18,     // 18 HP / 5s = 3.6 HP/s (PROVISIONAL)
      mpPerTick: 15,     // 15 MP / 5s = 3.0 MP/s (PROVISIONAL)
      iconCol: 5,
      iconRow: 5,
      desc: 'Cơm Linh Mễ hấp cùng Băng Tinh thanh lương. Ăn vào hồi +18 Khí Huyết và +15 Linh Lực mỗi 5 giây, liên tục trong 2 giờ.'
    },
    'chao-linh-me': {
      id: 'chao-linh-me',
      name: 'Cháo Linh Mễ Bổ Khí',
      durationSec: 10800, // 3 giờ (PROVISIONAL)
      tickIntervalSec: TICK_INTERVAL_SEC,
      hpPerTick: 25,      // 25 HP / 5s = 5.0 HP/s (PROVISIONAL)
      mpPerTick: 22,      // 22 MP / 5s = 4.4 MP/s (PROVISIONAL)
      iconCol: 5,
      iconRow: 5,
      desc: 'Cháo Linh Mễ ninh cùng Linh Chi Rừng đại bổ. Ăn vào hồi +25 Khí Huyết và +22 Linh Lực mỗi 5 giây, liên tục trong 3 giờ.'
    }
  };

  var FOOD_RECIPES = [
    {
      foodId: 'com-linh-me',
      name: 'Cơm Linh Mễ',
      cost: [{ itemId: 'linh-me', count: 5, name: 'Linh Mễ' }],
      rewardCount: 1,
      desc: 'Nấu từ 5 Linh Mễ tươi.'
    },
    {
      foodId: 'com-linh-me-hap',
      name: 'Cơm Linh Mễ Hấp Băng Tinh',
      cost: [
        { itemId: 'linh-me', count: 10, name: 'Linh Mễ' },
        { itemId: 'bang-tinh', count: 1, name: 'Băng Tinh' }
      ],
      rewardCount: 1,
      desc: 'Hấp từ 10 Linh Mễ và 1 Băng Tinh (hồ băng).'
    },
    {
      foodId: 'chao-linh-me',
      name: 'Cháo Linh Mễ Bổ Khí',
      cost: [
        { itemId: 'linh-me', count: 8, name: 'Linh Mễ' },
        { itemId: 'linh-chi-rung', count: 1, name: 'Linh Chi Rừng' }
      ],
      rewardCount: 1,
      desc: 'Ninh từ 8 Linh Mễ và 1 nấm Linh Chi Rừng.'
    }
  ];

  // ---------------------------------------------------------------------------
  // 2. HELPER FUNCTIONS
  // ---------------------------------------------------------------------------

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

  function ensureState(player) {
    if (!player) return null;
    if (player.foodBuff === undefined) {
      player.foodBuff = null;
    }
    return player.foodBuff;
  }

  function getFoodDef(foodId) {
    return FOOD_DEFS[foodId] || null;
  }

  function getRecipes() {
    return FOOD_RECIPES.slice();
  }

  // ---------------------------------------------------------------------------
  // 3. LOGIC ĂN THỨC ĂN & CHỐNG CỘNG DỒN LẠM DỤNG (ANTI-ABUSE)
  // ---------------------------------------------------------------------------

  /**
   * Kiểm tra người chơi có thể ăn món này không (tồn tại trong túi).
   */
  function canEat(player, foodId) {
    if (!player) return false;
    var def = getFoodDef(foodId);
    if (!def) return false;
    var st = getStateAPI();
    if (!st || !st.countItemInBag) return true;
    return st.countItemInBag(player, foodId) >= 1;
  }

  /**
   * Ăn thức ăn:
   *  - Trừ 1 món ăn trong túi.
   *  - Chống cộng dồn (Single Active Buff):
   *    + Ăn cùng loại món: Làm mới thời gian buff về tối đa (reset expireTime).
   *    + Ăn khác loại: Ghi đè buff mới lên buff cũ.
   *    + Tốc độ tick và lượng hồi tuyệt đối không cộng dồn.
   */
  function eatFood(player, foodId, nowMs) {
    if (!player) return { ok: false, msg: 'Chưa khởi tạo nhân vật.' };
    var def = getFoodDef(foodId);
    if (!def) return { ok: false, msg: 'Món ăn không tồn tại.' };

    var st = getStateAPI();
    if (!st) return { ok: false, msg: 'GameState chưa sẵn sàng.' };

    var inBag = st.countItemInBag(player, foodId);
    if (inBag < 1) {
      return { ok: false, msg: 'Không có ' + def.name + ' trong túi đồ.' };
    }

    var removed = st.removeItemFromBag(player, foodId, 1);
    if (!removed) {
      return { ok: false, msg: 'Không thể tiêu hao ' + def.name + '.' };
    }

    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var durationMs = def.durationSec * 1000;
    var prevBuff = player.foodBuff;
    var isRefresh = (prevBuff && prevBuff.foodId === foodId && now < prevBuff.expireTime);

    player.foodBuff = {
      foodId: foodId,
      name: def.name,
      startTime: now,
      expireTime: now + durationMs,
      durationSec: def.durationSec,
      tickIntervalSec: def.tickIntervalSec,
      hpPerTick: def.hpPerTick,
      mpPerTick: def.mpPerTick,
      lastTickTime: now
    };

    if (st.savePlayer) st.savePlayer(player);

    var msg = isRefresh
      ? ('Đã ăn thêm ' + def.name + ' — làm mới thời gian hồi phục êm dịu thành ' + Math.round(def.durationSec / 60) + ' phút.')
      : ('Đã dùng ' + def.name + '! Khí huyết và linh lực bắt đầu hồi phục liên tục trong ' + Math.round(def.durationSec / 60) + ' phút.');

    return {
      ok: true,
      msg: msg,
      buff: player.foodBuff,
      isRefresh: isRefresh
    };
  }

  // ---------------------------------------------------------------------------
  // 4. VÒNG LẶP HỒI PHỤC TICK & BẢO LƯU THỜI GIAN THẬT (OFFLINE CATCH-UP)
  // ---------------------------------------------------------------------------

  /**
   * Cập nhật buff theo chu kỳ thời gian (mỗi tickIntervalSec = 5s).
   * Móc vào vòng lặp chính của engine.js hoặc timer.
   */
  function updateBuffTick(player, nowMs) {
    if (!player || !player.foodBuff) {
      return { active: false, ticked: false, expired: false, hpAdded: 0, mpAdded: 0 };
    }

    var buff = player.foodBuff;
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();

    // Hết hạn buff
    if (now >= buff.expireTime) {
      // Hồi nốt khoảng thời gian còn lại trước thời điểm hết hạn
      var finalElapsed = buff.expireTime - buff.lastTickTime;
      var finalInterval = buff.tickIntervalSec * 1000;
      var finalTicks = Math.floor(Math.max(0, finalElapsed) / finalInterval);
      var fHp = 0, fMp = 0;
      if (finalTicks > 0) {
        fHp = finalTicks * buff.hpPerTick;
        fMp = finalTicks * buff.mpPerTick;
        player.hp = Math.min(player.hpMax, (player.hp || 0) + fHp);
        player.linhLuc = Math.min(player.linhLucMax, (player.linhLuc || 0) + fMp);
      }
      player.foodBuff = null;
      var st1 = getStateAPI();
      if (st1 && st1.savePlayer) st1.savePlayer(player);
      return { active: false, ticked: finalTicks > 0, expired: true, hpAdded: fHp, mpAdded: fMp };
    }

    // Tính số tick đã tích lũy
    var elapsed = now - buff.lastTickTime;
    var intervalMs = buff.tickIntervalSec * 1000;
    var ticks = Math.floor(elapsed / intervalMs);

    if (ticks <= 0) {
      return { active: true, ticked: false, expired: false, hpAdded: 0, mpAdded: 0, remainSec: Math.ceil((buff.expireTime - now) / 1000) };
    }

    var hpAdded = ticks * buff.hpPerTick;
    var mpAdded = ticks * buff.mpPerTick;

    player.hp = Math.min(player.hpMax, (player.hp || 0) + hpAdded);
    player.linhLuc = Math.min(player.linhLucMax, (player.linhLuc || 0) + mpAdded);
    buff.lastTickTime += ticks * intervalMs;

    return {
      active: true,
      ticked: true,
      expired: false,
      ticks: ticks,
      hpAdded: hpAdded,
      mpAdded: mpAdded,
      remainSec: Math.max(0, Math.ceil((buff.expireTime - now) / 1000))
    };
  }

  /**
   * Bắt kịp thời gian thực khi người chơi đóng game rồi mở lại (Offline Catch-Up).
   * Gọi lúc tải save game hoặc khởi tạo engine.
   */
  function applyOfflineCatchUp(player, nowMs) {
    if (!player || !player.foodBuff) {
      return { catchUp: false, ticks: 0, hpAdded: 0, mpAdded: 0, expired: false };
    }

    var buff = player.foodBuff;
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var lastTick = buff.lastTickTime || buff.startTime || now;

    // Giới hạn thời gian hiệu lực tối đa là lúc buff hết hạn
    var effectiveEnd = Math.min(now, buff.expireTime);
    var elapsedMs = Math.max(0, effectiveEnd - lastTick);
    var intervalMs = (buff.tickIntervalSec || TICK_INTERVAL_SEC) * 1000;
    var ticks = Math.floor(elapsedMs / intervalMs);

    var hpAdded = 0;
    var mpAdded = 0;
    var isExpired = now >= buff.expireTime;

    if (ticks > 0) {
      hpAdded = ticks * buff.hpPerTick;
      mpAdded = ticks * buff.mpPerTick;
      player.hp = Math.min(player.hpMax, (player.hp || 0) + hpAdded);
      player.linhLuc = Math.min(player.linhLucMax, (player.linhLuc || 0) + mpAdded);
      buff.lastTickTime = lastTick + ticks * intervalMs;
    }

    if (isExpired) {
      player.foodBuff = null;
    }

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      catchUp: ticks > 0,
      ticks: ticks,
      hpAdded: hpAdded,
      mpAdded: mpAdded,
      expired: isExpired,
      remainSec: isExpired ? 0 : Math.ceil((buff.expireTime - now) / 1000)
    };
  }

  /**
   * Lấy thông tin buff đang kích hoạt (cho UI/HUD).
   */
  function getActiveBuff(player, nowMs) {
    if (!player || !player.foodBuff) return null;
    var now = (nowMs !== undefined && nowMs !== null) ? nowMs : Date.now();
    var buff = player.foodBuff;
    if (now >= buff.expireTime) {
      player.foodBuff = null;
      return null;
    }
    var remainSec = Math.max(0, Math.ceil((buff.expireTime - now) / 1000));
    var min = Math.floor(remainSec / 60);
    var sec = remainSec % 60;
    var timeStr = (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
    return {
      foodId: buff.foodId,
      name: buff.name,
      remainSec: remainSec,
      timeStr: timeStr,
      hpPerTick: buff.hpPerTick,
      mpPerTick: buff.mpPerTick,
      tickIntervalSec: buff.tickIntervalSec
    };
  }

  // ---------------------------------------------------------------------------
  // 5. ĐỔI THỨC ĂN (CRAFT / EXCHANGE)
  // ---------------------------------------------------------------------------

  function canCraftFood(player, foodId) {
    if (!player) return { ok: false, msg: 'Chưa có nhân vật.' };
    var recipe = null;
    for (var i = 0; i < FOOD_RECIPES.length; i++) {
      if (FOOD_RECIPES[i].foodId === foodId) {
        recipe = FOOD_RECIPES[i];
        break;
      }
    }
    if (!recipe) return { ok: false, msg: 'Công thức không tồn tại.' };

    var st = getStateAPI();
    if (!st || !st.countItemInBag) return { ok: false, msg: 'Lỗi kiểm tra túi đồ.' };

    for (var c = 0; c < recipe.cost.length; c++) {
      var itemCost = recipe.cost[c];
      if (st.countItemInBag(player, itemCost.itemId) < itemCost.count) {
        return {
          ok: false,
          msg: 'Thiếu ' + (itemCost.name || itemCost.itemId) + ' (cần ' + itemCost.count + ').'
        };
      }
    }

    return { ok: true, recipe: recipe };
  }

  function craftFood(player, foodId) {
    var check = canCraftFood(player, foodId);
    if (!check.ok) return check;

    var recipe = check.recipe;
    var st = getStateAPI();

    // Trừ nguyên liệu
    for (var c = 0; c < recipe.cost.length; c++) {
      var itemCost = recipe.cost[c];
      st.removeItemFromBag(player, itemCost.itemId, itemCost.count);
    }

    // Thêm món ăn vào túi
    st.addItemToBag(player, foodId, recipe.rewardCount || 1);
    if (st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      msg: 'Đã đổi thành công ' + (recipe.rewardCount || 1) + ' ' + recipe.name + '!',
      foodId: foodId,
      count: recipe.rewardCount || 1
    };
  }

  // ---------------------------------------------------------------------------
  // EXPORTS
  // ---------------------------------------------------------------------------

  exports.TICK_INTERVAL_SEC = TICK_INTERVAL_SEC;
  exports.FOOD_DEFS = FOOD_DEFS;
  exports.FOOD_RECIPES = FOOD_RECIPES;
  exports.ensureState = ensureState;
  exports.getFoodDef = getFoodDef;
  exports.getRecipes = getRecipes;
  exports.canEat = canEat;
  exports.eatFood = eatFood;
  exports.updateBuffTick = updateBuffTick;
  exports.applyOfflineCatchUp = applyOfflineCatchUp;
  exports.getActiveBuff = getActiveBuff;
  exports.canCraftFood = canCraftFood;
  exports.craftFood = craftFood;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameFoodBuff = {}));
