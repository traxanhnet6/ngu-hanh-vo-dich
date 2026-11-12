/**
 * zonequests.js — HỆ THỐNG VIỆC MỞ VÙNG THEO HỒ SƠ 01 (V1 chặng 7)
 *
 * Cài đặt 4 việc mở vùng hồ sơ 01 yêu cầu mà game chưa có:
 *  1. Hồ Băng Hàn Kính (Thủy, Luyện Khí tầng 4): Nhận Băng Phù chống rét tại trạm
 *     dừng chân (hồ sơ 01 §2).
 *  2. Mỏ Lửa Xích Diệm (Hỏa, Luyện Khí tầng 7): Sửa cầu sắt cửa mỏ bằng nguyên liệu
 *     Mộc và Thủy đã tích lũy — tính liên vùng (hồ sơ 01 §3).
 *  3. Hoang Mạc Hoàng Sa (Thổ, Trúc Cơ Sơ Kỳ): Hộ tống đoàn thương lần đầu vào
 *     tới ốc đảo, mở trạm dịch chuyển (hồ sơ 01 §4).
 *  4. Kiếm Trủng Huyền Thiết (Kim, Trúc Cơ Trung Kỳ): Nhận Huyền Thiết Kiếm Lệnh
 *     tại tông môn (hồ sơ 01 §5).
 *
 * Nguyên tắc brief:
 *  - Gắn vào hệ nhiệm vụ hiện có, có dẫn đường đầy đủ (mũi tên + dấu tại mục tiêu,
 *    qua được chặng Đài Truyền Tống như HOBANGFIX đã chuẩn hóa).
 *  - Không phá luồng mở vùng bằng cảnh giới đang chạy.
 *  - Dữ liệu save cũ nạp an toàn qua state.ensureV1().
 *  - Node-loadable & chạy trên trình duyệt.
 */

(function (exports) {
  'use strict';

  var ZONE_QUESTS = [
    {
      id: 'quest_bang_phu',
      zoneId: 'ho-bang',
      zoneName: 'Hồ Băng Hàn Kính',
      name: 'Nhận Băng Phù Chống Rét',
      minRank: 4,
      rankLabel: 'Luyện Khí tầng 4',
      giverMapId: 'tong-mon',
      giverNpcId: 'npc_chapsu',
      target: {
        mapId: 'dai-truyen-tong',
        kind: 'point',
        x: 480,
        y: 320,
        title: 'Nhận Băng Phù tại Trạm Dừng Chân',
        desc: 'Tới Trạm dừng chân Đài Truyền Tống nhận Băng Phù chống rét trước khi tiến vào Hồ Băng Hàn Kính (hồ sơ 01 §2).'
      },
      rewardItem: 'bang-phu',
      rewardCount: 1,
      rewardLT: 50,
      desc: 'Hồ Băng Hàn Kính rét buốt thấu xương. Hãy nhận Băng Phù Chống Rét tại trạm dừng chân để bảo vệ bản thân khi thăm dò.'
    },
    {
      id: 'quest_sua_cau',
      zoneId: 'mo-lua',
      zoneName: 'Mỏ Lửa Xích Diệm',
      name: 'Sửa Cầu Sắt Cửa Mỏ',
      minRank: 7,
      rankLabel: 'Luyện Khí tầng 7',
      giverMapId: 'tong-mon',
      giverNpcId: 'npc_chapsu',
      requiredMaterials: [
        { itemId: 'la-thanh-tuy', count: 2, name: 'Lá Thanh Tụy' },
        { itemId: 'bang-tinh', count: 1, name: 'Băng Tinh' }
      ],
      target: {
        mapId: 'dai-truyen-tong',
        kind: 'point',
        x: 480,
        y: 320,
        title: 'Gia Cố Cầu Sắt Cửa Mỏ',
        desc: 'Đem 2 Lá Thanh Tụy (Mộc) và 1 Băng Tinh (Thủy) tới trạm cửa Mỏ Lửa để sửa cầu sắt liên vùng (hồ sơ 01 §3).'
      },
      rewardLT: 60,
      desc: 'Cầu sắt dẫn vào Mỏ Lửa Xích Diệm cần được gia cố bằng vật liệu Mộc và Thủy đã tích lũy để mở đường khai thác an toàn.'
    },
    {
      id: 'quest_ho_tong',
      zoneId: 'hoang-mac',
      zoneName: 'Hoang Mạc Hoàng Sa',
      name: 'Hộ Tống Đoàn Thương Sa Mạc',
      minRank: 10,
      rankLabel: 'Trúc Cơ Sơ Kỳ',
      giverMapId: 'tong-mon',
      giverNpcId: 'npc_chapsu',
      target: {
        mapId: 'hoang-mac',
        kind: 'point',
        x: 980,
        y: 820,
        title: 'Hộ Tống Tới Ốc Đảo',
        desc: 'Đi theo đoàn thương tới Ốc Đảo Tinh Khiết giữa Hoang Mạc Hoàng Sa để khai mở trạm dịch chuyển (hồ sơ 01 §4).'
      },
      rewardLT: 80,
      desc: 'Hoang Mạc bão cát mịt mù và cát lún nguy hiểm. Lần đầu vào, hãy hộ tống đoàn thương tới ốc đảo để thiết lập dịch chuyển an toàn.'
    },
    {
      id: 'quest_kiem_lenh',
      zoneId: 'kiem-trung',
      zoneName: 'Kiếm Trủng Huyền Thiết',
      name: 'Lĩnh Nhận Huyền Thiết Kiếm Lệnh',
      minRank: 11,
      rankLabel: 'Trúc Cơ Trung Kỳ',
      giverMapId: 'dai-dien',
      giverNpcId: 'npc_chuongmon',
      target: {
        mapId: 'dai-dien',
        kind: 'npc',
        npcId: 'npc_chuongmon',
        title: 'Lĩnh Kiếm Lệnh tại Đại Điện',
        desc: 'Gặp Chưởng Môn tại Đại Điện để lĩnh nhận Huyền Thiết Kiếm Lệnh tiến vào Kiếm Trủng cổ xưa (hồ sơ 01 §5).'
      },
      rewardItem: 'kiem-lenh',
      rewardCount: 1,
      rewardLT: 100,
      desc: 'Kiếm Trủng Huyền Thiết chôn vùi muôn vàn thanh kiếm cổ sắc lạnh. Chỉ đệ tử mang Huyền Thiết Kiếm Lệnh mới được phép mở trủng.'
    }
  ];

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

  function ensureZQState(player) {
    var st = getStateAPI();
    if (st && st.ensureV1) {
      return st.ensureV1(player);
    }
    if (!player) return null;
    if (!player.v1) player.v1 = {};
    if (!player.v1.unlockedZones) player.v1.unlockedZones = {};
    if (!player.v1.zoneQuests) player.v1.zoneQuests = { activeQuestId: null, tracked: false, completed: {} };
    return player.v1;
  }

  function getQuestDef(questId) {
    for (var i = 0; i < ZONE_QUESTS.length; i++) {
      if (ZONE_QUESTS[i].id === questId) return ZONE_QUESTS[i];
    }
    return null;
  }

  function getZoneQuestForZone(zoneId) {
    for (var i = 0; i < ZONE_QUESTS.length; i++) {
      if (ZONE_QUESTS[i].zoneId === zoneId) return ZONE_QUESTS[i];
    }
    return null;
  }

  function getRealmRank(player) {
    var st = getStateAPI();
    if (st && st.getRealmRank) return st.getRealmRank(player);
    return 0;
  }

  function isZoneUnlocked(player, zoneId) {
    if (!player) return false;
    ensureZQState(player);
    return Boolean(player.v1 && player.v1.unlockedZones && player.v1.unlockedZones[zoneId]);
  }

  function isQuestCompleted(player, questId) {
    if (!player) return false;
    ensureZQState(player);
    return Boolean(player.v1 && player.v1.zoneQuests && player.v1.zoneQuests.completed && player.v1.zoneQuests.completed[questId]);
  }

  function hasRequiredMaterials(player, def) {
    if (!def.requiredMaterials || def.requiredMaterials.length === 0) return true;
    var st = getStateAPI();
    if (!st || !st.countItemInBag) return true;
    for (var i = 0; i < def.requiredMaterials.length; i++) {
      var req = def.requiredMaterials[i];
      if (st.countItemInBag(player, req.itemId) < req.count) return false;
    }
    return true;
  }

  function acceptQuest(player, questId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var def = getQuestDef(questId);
    if (!def) return { ok: false, msg: 'Nhiệm vụ không tồn tại.' };
    ensureZQState(player);

    if (isQuestCompleted(player, questId)) {
      return { ok: false, reason: 'already_completed', msg: 'Nhiệm vụ đã hoàn thành.' };
    }

    var rank = getRealmRank(player);
    if (rank < def.minRank) {
      return { ok: false, reason: 'rank_low', msg: 'Cảnh giới chưa đủ (' + def.rankLabel + ').' };
    }

    player.v1.zoneQuests.activeQuestId = questId;
    player.v1.zoneQuests.tracked = true;

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast('Đã nhận việc mở vùng: ' + def.name);
    }
    return { ok: true, questId: questId, msg: 'Nhận nhiệm vụ thành công: ' + def.name };
  }

  function turnInQuest(player, questId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    var qId = questId || (player.v1 && player.v1.zoneQuests && player.v1.zoneQuests.activeQuestId);
    var def = getQuestDef(qId);
    if (!def) return { ok: false, msg: 'Nhiệm vụ không tồn tại.' };
    ensureZQState(player);

    if (isQuestCompleted(player, def.id)) {
      return { ok: false, reason: 'already_completed', msg: 'Nhiệm vụ đã hoàn thành.' };
    }

    var st = getStateAPI();

    // Kiểm tra và trừ vật phẩm nếu có
    if (def.requiredMaterials && def.requiredMaterials.length > 0) {
      if (!hasRequiredMaterials(player, def)) {
        return { ok: false, reason: 'missing_materials', msg: 'Chưa đủ nguyên liệu yêu cầu để hoàn thành.' };
      }
      if (st && st.removeItemFromBag) {
        for (var i = 0; i < def.requiredMaterials.length; i++) {
          st.removeItemFromBag(player, def.requiredMaterials[i].itemId, def.requiredMaterials[i].count);
        }
      }
    }

    // Trao thưởng vật phẩm nhiệm vụ (Băng Phù / Kiếm Lệnh)
    if (def.rewardItem && st && st.addItemToBag) {
      var m = getMonstersAPI();
      st.addItemToBag(player, def.rewardItem, def.rewardCount || 1, m ? m.ITEM_DEFS : undefined);
    }

    // Trao Linh Thạch
    if (def.rewardLT) {
      player.linhThach = (player.linhThach || 0) + def.rewardLT;
    }

    // Đánh dấu hoàn thành
    player.v1.zoneQuests.completed[def.id] = true;
    player.v1.unlockedZones[def.zoneId] = true;
    if (player.v1.zoneQuests.activeQuestId === def.id) {
      player.v1.zoneQuests.activeQuestId = null;
    }

    if (st && st.savePlayer) st.savePlayer(player);

    if (typeof window !== 'undefined' && window.GameAudio && window.GameAudio.playChime) {
      window.GameAudio.playChime();
    }
    if (typeof window !== 'undefined' && window.GameUI && window.GameUI.showToast) {
      window.GameUI.showToast('Hoàn thành việc mở vùng: ' + def.name + '!');
    }
    return { ok: true, questId: def.id, zoneId: def.zoneId, msg: 'Hoàn thành việc mở vùng: ' + def.name };
  }

  function setTracked(player, on) {
    if (!player) return;
    ensureZQState(player);
    player.v1.zoneQuests.tracked = !!on;
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
  }

  function getTrackedTargetInfo(player) {
    if (!player) return null;
    ensureZQState(player);
    var v1 = player.v1;
    if (!v1 || !v1.zoneQuests || !v1.zoneQuests.activeQuestId || !v1.zoneQuests.tracked) return null;
    var def = getQuestDef(v1.zoneQuests.activeQuestId);
    if (!def) return null;
    if (isQuestCompleted(player, def.id)) return null;

    // Trả về đối tượng dẫn đường chuẩn của engine
    return {
      stepId: 'zone_quest_' + def.id,
      stage: 5,
      mapId: def.target.mapId,
      kind: def.target.kind || 'point',
      npcId: def.target.npcId,
      x: def.target.x,
      y: def.target.y,
      title: def.target.title || def.name,
      desc: def.target.desc || def.desc,
      isZoneQuest: true,
      questId: def.id
    };
  }

  var ZoneQuestsAPI = {
    QUESTS: ZONE_QUESTS,
    getQuestDef: getQuestDef,
    getZoneQuestForZone: getZoneQuestForZone,
    acceptQuest: acceptQuest,
    turnInQuest: turnInQuest,
    setTracked: setTracked,
    getTrackedTargetInfo: getTrackedTargetInfo,
    isZoneUnlocked: isZoneUnlocked,
    isQuestCompleted: isQuestCompleted,
    hasRequiredMaterials: hasRequiredMaterials
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZoneQuestsAPI;
  }
  if (typeof window !== 'undefined') {
    window.GameZoneQuests = ZoneQuestsAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameZoneQuests = ZoneQuestsAPI;
  }
})(typeof window !== 'undefined' ? window : this);
