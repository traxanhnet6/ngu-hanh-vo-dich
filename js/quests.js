/**
 * quests.js — HỆ THỐNG NHIỆM VỤ DẠNG DỮ LIỆU TẬP TRUNG (Đợt E4 - Bước 1 & 2)
 *
 * Quản lý toàn bộ nhiệm vụ trong game dưới dạng dữ liệu (Data-driven):
 *  - Chuỗi nhiệm vụ chính Q1–Q13 & nhập môn tông môn
 *  - Nhiệm vụ thu thập Đan Phòng (8 việc)
 *  - Nhiệm vụ mở vùng ZoneQuests (4 việc)
 *  - Bảng treo thưởng 2 bảng: Bảng Trấn (Town) + Bảng Tông (Sect) [Bước 2]
 *  - Cơ chế nhận / trả / hủy, nhiều việc song song
 *  - Theo dõi tối đa 5 việc trên HUD (Hồ sơ 35§3), 1 việc ghim dẫn đường (Hồ sơ 09)
 *  - Điểm cống hiến tông môn & đổi Thổ/Kim Nguyên Tán (Hồ sơ 02§3.1, 14§6)
 *  - Chức vụ tông môn 4 bậc (Ngoại môn, Nội môn, Chân truyền, Chấp sự) + đặc quyền
 *  - Tương thích ngược 100% với save cũ (Migration & Bi-directional synchronization)
 *
 * Chạy được trên cả Trình duyệt (Browser) và Node.js.
 */

(function (exports) {
  'use strict';

  // ---------------------------------------------------------------------------
  // PHỤ THUỘC & TIỆN ÍCH AN TOÀN
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

  function getEngineAPI() {
    if (typeof window !== 'undefined' && window.GameEngine) return window.GameEngine;
    if (typeof global !== 'undefined' && global.GameEngine) return global.GameEngine;
    try { return require('./engine.js'); } catch (e) { return null; }
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

  function getWeakestTuVi(player) {
    if (!player || !player.paths) return 0;
    var paths = player.paths;
    var min = Infinity;
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = (paths[k] && typeof paths[k].tuVi === 'number') ? paths[k].tuVi : 0;
      if (v < min) min = v;
    }
    return isFinite(min) ? min : 0;
  }

  function getRealmRank(player) {
    var st = getStateAPI();
    if (st && st.getRealmRank) return st.getRealmRank(player);
    if (!player || !player.realm) return 0;
    var r = player.realm;
    if (r === 'Phàm Nhân') return 0;
    if (r.indexOf('Luyện Khí') !== -1) {
      var m = r.match(/tầng (\d+)/);
      return m ? parseInt(m[1], 10) : 1;
    }
    if (r === 'Trúc Cơ Sơ Kỳ') return 10;
    if (r === 'Trúc Cơ Trung Kỳ') return 11;
    if (r === 'Trúc Cơ Hậu Kỳ') return 12;
    if (r === 'Trúc Cơ Viên Mãn') return 13;
    if (r.indexOf('Kim Đan') !== -1) return 14;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // DANH MỤC ĐỊNH NGHĨA NHIỆM VỤ (QUEST DEFINITIONS)
  // ---------------------------------------------------------------------------

  var QUEST_DEFS = {
    // --- CHUỖI NHẬP MÔN / KHỞI ĐẦU (Q1 - Q6) ---
    'q_main_01_linhnhi': {
      id: 'q_main_01_linhnhi',
      legacyKey: 'talked_linhnhi',
      type: 'sect_intro',
      category: 'Chính Tuyến',
      title: 'Nói chuyện với Linh Nhi',
      desc: 'Linh Nhi đang đợi ở trước miếu hoang.',
      prereq: { minRank: 0 },
      giver: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' },
      turnIn: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' },
      target: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi', stepId: 'talk_linhnhi', stage: 0 },
      objectives: [{ id: 'talk_linhnhi', kind: 'talk_npc', npcId: 'npc_linhnhi', needed: 1 }],
      rewards: {},
      repeatable: false
    },
    'q_main_02_thaotinh': {
      id: 'q_main_02_thaotinh',
      legacyKey: 'huntCompleted',
      type: 'sect_intro',
      category: 'Chính Tuyến',
      title: 'Săn Thảo Tinh ở Rừng Độc',
      desc: 'Hạ gục 5 Thảo Tinh Nhỏ ở vành ngoài Rừng Độc.',
      prereq: { minRank: 0, completedQuests: ['q_main_01_linhnhi'] },
      giver: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' },
      turnIn: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' },
      target: { mapId: 'rung-doc', kind: 'hunt', stepId: 'hunt', stage: 0 },
      objectives: [{ id: 'kill_thaotinh', kind: 'kill_monster', speciesId: 'thao_tinh', needed: 5 }],
      rewards: { linhThach: 10 },
      repeatable: false
    },
    'q_main_03_farewell': {
      id: 'q_main_03_farewell',
      legacyKey: 'sectStage_0',
      type: 'sect_intro',
      category: 'Chính Tuyến',
      title: 'Từ biệt Linh Nhi',
      desc: 'Linh Nhi muốn theo ca ca lên tông môn. Nói chuyện với cô bé trước khi lên đường.',
      prereq: { minRank: 0, completedQuests: ['q_main_02_thaotinh'] },
      giver: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' },
      turnIn: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi' },
      target: { mapId: 'mieu_hoang', kind: 'npc', npcId: 'npc_linhnhi', stepId: 'farewell_linhnhi', stage: 0 },
      objectives: [{ id: 'farewell', kind: 'talk_npc', npcId: 'npc_linhnhi', needed: 1 }],
      rewards: {},
      repeatable: false
    },
    'q_main_04_tiepdan': {
      id: 'q_main_04_tiepdan',
      legacyKey: 'sectStage_1',
      type: 'sect_intro',
      category: 'Chính Tuyến',
      title: 'Báo danh ở Lối Vào',
      desc: 'Đi đường xuống núi ở phía nam Miếu Hoang để tới sơn môn, gặp Tiếp Dẫn Đệ Tử.',
      prereq: { minRank: 0, completedQuests: ['q_main_03_farewell'] },
      giver: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_tiepdan' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_tiepdan' },
      target: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_tiepdan', stepId: 'report_gate', stage: 1 },
      objectives: [{ id: 'report', kind: 'talk_npc', npcId: 'npc_tiepdan', needed: 1 }],
      rewards: { special: 'grant_starter_sword' },
      repeatable: false
    },
    'q_main_05_chuongmon': {
      id: 'q_main_05_chuongmon',
      legacyKey: 'sectStage_2',
      type: 'sect_intro',
      category: 'Chính Tuyến',
      title: 'Diện kiến Chưởng Môn',
      desc: 'Vào Đại Điện ở giữa trục chính của sơn môn, chưởng môn đang đợi.',
      prereq: { minRank: 0, completedQuests: ['q_main_04_tiepdan'] },
      giver: { mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon' },
      turnIn: { mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon' },
      target: { mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon', stepId: 'meet_master', stage: 2 },
      objectives: [{ id: 'meet', kind: 'talk_npc', npcId: 'npc_chuongmon', needed: 1 }],
      rewards: { linhThach: 20 },
      repeatable: false
    },
    'q_main_06_chapsu': {
      id: 'q_main_06_chapsu',
      legacyKey: 'sectStage_3',
      type: 'sect_intro',
      category: 'Chính Tuyến',
      title: 'Nhận lệnh từ Chấp Sự',
      desc: 'Chấp Sự ở Quảng Trường sẽ cấp phòng ở và sổ tay đệ tử.',
      prereq: { minRank: 0, completedQuests: ['q_main_05_chuongmon'] },
      giver: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu', stepId: 'orders', stage: 3 },
      objectives: [{ id: 'orders', kind: 'talk_npc', npcId: 'npc_chapsu', needed: 1 }],
      rewards: { special: 'enter_sect_full' },
      repeatable: false
    },

    // --- CHUỖI NHIỆM VỤ CHÍNH MAINSTAGE (Q7 - Q13) ---
    'q_main_07_ren_luyen': {
      id: 'q_main_07_ren_luyen',
      legacyMainStage: 1,
      type: 'main',
      category: 'Chính Tuyến',
      title: 'Rèn Luyện Căn Bản',
      desc: 'Đưa cả 5 đường tu đạt 30 tu vi (săn Rừng Độc, hái Vườn Linh Dược Sơn Cốc, đổi đan chỗ Chấp Sự).',
      prereq: { minRank: 0, completedQuests: ['q_main_06_chapsu'] },
      giver: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'tong-mon', kind: 'point', x: 960, y: 1250, stepId: 'main_1', mainStage: 1, stage: 4, title: 'Rèn Luyện Căn Bản' },
      objectives: [{ id: 'tuvi_30', kind: 'min_tuvi', needed: 30 }],
      rewards: {},
      repeatable: false
    },
    'q_main_08_tru_nhen': {
      id: 'q_main_08_tru_nhen',
      legacyMainStage: 2,
      type: 'main',
      category: 'Chính Tuyến',
      title: 'Trừ Nhện Rừng Xanh',
      desc: 'Tiêu diệt 3 Nhện Rừng Xanh ở Rừng Độc Thanh Tụy.',
      prereq: { minRank: 0, completedQuests: ['q_main_07_ren_luyen'] },
      target: { mapId: 'rung-doc', kind: 'monster', speciesId: 'nhen_xanh', stepId: 'main_2', mainStage: 2, stage: 4, title: 'Trừ Nhện Rừng Xanh' },
      objectives: [{ id: 'kill_nhen', kind: 'kill_monster', speciesId: 'nhen_xanh', needed: 3 }],
      rewards: {},
      repeatable: false
    },
    'q_main_09_moc_linh': {
      id: 'q_main_09_moc_linh',
      legacyMainStage: 3,
      type: 'main',
      category: 'Chính Tuyến',
      title: 'Đoạt Mộc Linh Tinh',
      desc: 'Hạ gục Mộc Linh Cổ Vương ở Rừng Độc và đoạt lấy Nguyên Tinh Mộc.',
      prereq: { minRank: 0, completedQuests: ['q_main_08_tru_nhen'] },
      target: { mapId: 'rung-doc', kind: 'point', x: 1640, y: 745, stepId: 'main_3', mainStage: 3, stage: 4, title: 'Đoạt Mộc Linh Tinh' },
      objectives: [{ id: 'collect_moc_tinh', kind: 'collect_item', itemId: 'nguyen-tinh-moc', needed: 1 }],
      rewards: {},
      repeatable: false
    },
    'q_main_10_ho_bang': {
      id: 'q_main_10_ho_bang',
      legacyMainStage: 4,
      type: 'main',
      category: 'Chính Tuyến',
      title: 'Mở Cổng Hồ Băng',
      desc: 'Tu luyện cả 5 đường đạt 300 tu vi (Luyện Khí tầng 4) để mở cổng Hồ Băng Hàn Kính.',
      prereq: { minRank: 0, completedQuests: ['q_main_09_moc_linh'] },
      target: { mapId: 'tong-mon', kind: 'point', x: 960, y: 1250, stepId: 'main_4', mainStage: 4, stage: 4, title: 'Mở Cổng Hồ Băng' },
      objectives: [{ id: 'tuvi_300', kind: 'min_tuvi', needed: 300 }],
      rewards: {},
      repeatable: false
    },
    'q_main_11_bang_xa': {
      id: 'q_main_11_bang_xa',
      legacyMainStage: 5,
      type: 'main',
      category: 'Chính Tuyến',
      title: 'Săn Băng Xà',
      desc: 'Tiêu diệt 4 Băng Xà (Hàn Kính Thủy Xà) tại Hồ Băng Hàn Kính.',
      prereq: { minRank: 4, completedQuests: ['q_main_10_ho_bang'] },
      target: { mapId: 'ho-bang', kind: 'monster', speciesId: 'han_xa', stepId: 'main_5', mainStage: 5, stage: 4, title: 'Săn Băng Xà' },
      objectives: [{ id: 'kill_bang_xa', kind: 'kill_monster', speciesId: 'han_xa', needed: 4 }],
      rewards: {},
      repeatable: false
    },
    'q_main_12_giao_vuong': {
      id: 'q_main_12_giao_vuong',
      legacyMainStage: 6,
      type: 'main',
      category: 'Chính Tuyến',
      title: 'Trảm Hàn Kính Giao Vương',
      desc: 'Hạ gục Hàn Kính Giao Vương tại Hồ Băng, thu thập Nguyên Tinh Thủy và Băng Tủy.',
      prereq: { minRank: 4, completedQuests: ['q_main_11_bang_xa'] },
      target: { mapId: 'ho-bang', kind: 'point', x: 1180, y: 680, stepId: 'main_6', mainStage: 6, stage: 4, title: 'Trảm Hàn Kính Giao Vương' },
      objectives: [
        { id: 'collect_thuy_tinh', kind: 'collect_item', itemId: 'nguyen-tinh-thuy', needed: 1 },
        { id: 'collect_bang_tuy', kind: 'collect_item', itemId: 'bang-tuy', needed: 1 }
      ],
      rewards: {},
      repeatable: false
    },
    'q_main_13_truc_co': {
      id: 'q_main_13_truc_co',
      legacyMainStage: 7, // bao gồm mainStage 7, 8, 9
      type: 'main',
      category: 'Chính Tuyến',
      title: 'Đột Phá Trúc Cơ',
      desc: 'Đưa cả 5 đường đạt 900 tu vi (Luyện Khí viên mãn), luyện Trúc Cơ Đan và vượt qua lôi kiếp để đột phá Trúc Cơ Sơ Kỳ!',
      prereq: { minRank: 0, completedQuests: ['q_main_12_giao_vuong'] },
      target: { mapId: 'tong-mon', kind: 'point', x: 960, y: 700, stepId: 'main_9', mainStage: 9, stage: 4, title: 'Đột Phá Trúc Cơ' },
      objectives: [{ id: 'reach_truc_co', kind: 'reach_realm', realm: 'Trúc Cơ Sơ Kỳ', needed: 1 }],
      rewards: {},
      repeatable: false
    },

    // --- VIỆC MỞ VÙNG THEO HỒ SƠ 01 (ZONEQUESTS) ---
    'quest_bang_phu': {
      id: 'quest_bang_phu',
      zoneId: 'ho-bang',
      type: 'zone_unlock',
      category: 'Mở Vùng',
      title: 'Nhận Băng Phù Chống Rét',
      desc: 'Hồ Băng Hàn Kính rét buốt thấu xương. Hãy nhận Băng Phù Chống Rét tại trạm dừng chân để bảo vệ bản thân khi thăm dò.',
      prereq: { minRank: 4 },
      giver: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      turnIn: { mapId: 'dai-truyen-tong', kind: 'point', x: 480, y: 320 },
      target: { mapId: 'dai-truyen-tong', kind: 'point', x: 480, y: 320, title: 'Nhận Băng Phù tại Trạm Dừng Chân' },
      objectives: [{ id: 'reach_station', kind: 'reach_point', mapId: 'dai-truyen-tong', x: 480, y: 320, needed: 1 }],
      rewards: { items: [{ itemId: 'bang-phu', count: 1 }], linhThach: 50, special: 'unlock_zone:ho-bang' },
      repeatable: false
    },
    'quest_sua_cau': {
      id: 'quest_sua_cau',
      zoneId: 'mo-lua',
      type: 'zone_unlock',
      category: 'Mở Vùng',
      title: 'Sửa Cầu Sắt Cửa Mỏ',
      desc: 'Cầu sắt dẫn vào Mỏ Lửa Xích Diệm cần được gia cố bằng vật liệu Mộc và Thủy đã tích lũy để mở đường khai thác an toàn.',
      prereq: { minRank: 7 },
      giver: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      turnIn: { mapId: 'dai-truyen-tong', kind: 'point', x: 480, y: 320 },
      target: { mapId: 'dai-truyen-tong', kind: 'point', x: 480, y: 320, title: 'Gia Cố Cầu Sắt Cửa Mỏ' },
      objectives: [
        { id: 'mat_thanh_tuy', kind: 'collect_item', itemId: 'la-thanh-tuy', needed: 2 },
        { id: 'mat_bang_tinh', kind: 'collect_item', itemId: 'bang-tinh', needed: 1 }
      ],
      rewards: { linhThach: 60, special: 'unlock_zone:mo-lua' },
      repeatable: false
    },
    'quest_ho_tong': {
      id: 'quest_ho_tong',
      zoneId: 'hoang-mac',
      type: 'zone_unlock',
      category: 'Mở Vùng',
      title: 'Hộ Tống Đoàn Thương Sa Mạc',
      desc: 'Hoang Mạc bão cát mịt mù và cát lún nguy hiểm. Lần đầu vào, hãy hộ tống đoàn thương tới ốc đảo để thiết lập dịch chuyển an toàn.',
      prereq: { minRank: 10 },
      giver: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      turnIn: { mapId: 'hoang-mac', kind: 'point', x: 980, y: 820 },
      target: { mapId: 'hoang-mac', kind: 'point', x: 980, y: 820, title: 'Hộ Tống Tới Ốc Đảo' },
      objectives: [{ id: 'reach_oasis', kind: 'reach_point', mapId: 'hoang-mac', x: 980, y: 820, needed: 1 }],
      rewards: { linhThach: 80, special: 'unlock_zone:hoang-mac' },
      repeatable: false
    },
    'quest_kiem_lenh': {
      id: 'quest_kiem_lenh',
      zoneId: 'kiem-trung',
      type: 'zone_unlock',
      category: 'Mở Vùng',
      title: 'Lĩnh Nhận Huyền Thiết Kiếm Lệnh',
      desc: 'Kiếm Trủng Huyền Thiết chôn vùi muôn vàn thanh kiếm cổ sắc lạnh. Chỉ đệ tử mang Huyền Thiết Kiếm Lệnh mới được phép mở trủng.',
      prereq: { minRank: 11 },
      giver: { mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon' },
      turnIn: { mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon' },
      target: { mapId: 'dai-dien', kind: 'npc', npcId: 'npc_chuongmon', title: 'Lĩnh Kiếm Lệnh tại Đại Điện' },
      objectives: [{ id: 'talk_master', kind: 'talk_npc', npcId: 'npc_chuongmon', needed: 1 }],
      rewards: { items: [{ itemId: 'kiem-lenh', count: 1 }], linhThach: 100, special: 'unlock_zone:kiem-trung' },
      repeatable: false
    },

    // --- VIỆC THU THẬP ĐAN PHÒNG (DANPHONG) ---
    'q_moc_to': {
      id: 'q_moc_to',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Săn Tơ Nhện Xanh',
      desc: 'Hạ Nhện Rừng Xanh ở Rừng Độc, thu Tơ Nhện Xanh về cho Đan Phòng dệt túi đựng đan.',
      prereq: { minRank: 0 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'rung-doc', kind: 'monster', speciesId: 'nhen_xanh', title: 'Săn Tơ Nhện Xanh' },
      objectives: [{ id: 'collect_to_nhen', kind: 'collect_item', itemId: 'to-nhen-xanh', needed: 4 }],
      rewards: { linhThach: 40 },
      repeatable: true
    },
    'q_moc_linhchi': {
      id: 'q_moc_linhchi',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Hái Linh Chi Rừng',
      desc: 'Lên Sơn Cốc hái Linh Chi Rừng — nguyên liệu chính luyện Mộc Linh Đan và Trúc Cơ Đan.',
      prereq: { minRank: 0 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'son-coc', kind: 'point', x: 200, y: 600, title: 'Hái Linh Chi Rừng' },
      objectives: [{ id: 'collect_linh_chi', kind: 'collect_item', itemId: 'linh-chi-rung', needed: 3 }],
      rewards: { linhThach: 45, items: [{ itemId: 'moc-linh-dan', count: 1 }] },
      repeatable: true
    },
    'q_thuy_tinh': {
      id: 'q_thuy_tinh',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Thu Băng Tinh',
      desc: 'Hạ Băng Tinh Linh ở Hồ Băng Hàn Kính, thu Băng Tinh về luyện Thủy Linh Đan.',
      prereq: { minRank: 4 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'ho-bang', kind: 'monster', speciesId: 'bang_tinh', title: 'Thu Băng Tinh' },
      objectives: [{ id: 'collect_bang_tinh', kind: 'collect_item', itemId: 'bang-tinh', needed: 5 }],
      rewards: { linhThach: 60, items: [{ itemId: 'thuy-linh-dan', count: 1 }] },
      repeatable: true
    },
    'q_thuy_ngoc': {
      id: 'q_thuy_ngoc',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Ngọc Băng Tâm',
      desc: 'Hạ Hàn Kính Thủy Xà tinh anh ở Hồ Băng, đoạt Ngọc Băng Tâm — tim băng của Thủy Linh Đan.',
      prereq: { minRank: 4 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'ho-bang', kind: 'monster', speciesId: 'han_xa', title: 'Ngọc Băng Tâm' },
      objectives: [{ id: 'collect_ngoc_bang_tam', kind: 'collect_item', itemId: 'ngoc-bang-tam', needed: 1 }],
      rewards: { linhThach: 80 },
      repeatable: true
    },
    'q_hoa_danung': {
      id: 'q_hoa_danung',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Đá Nung Lò Lửa',
      desc: 'Hạ Hỏa Nham Thú ở Mỏ Lửa Xích Diệm, thu Đá Nung về lót lò luyện Hỏa Linh Đan.',
      prereq: { minRank: 7 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'mo-lua', kind: 'monster', speciesId: 'hoa_thu', title: 'Đá Nung Lò Lửa' },
      objectives: [{ id: 'collect_da_nung', kind: 'collect_item', itemId: 'da-nung', needed: 4 }],
      rewards: { linhThach: 70, items: [{ itemId: 'hoa-linh-dan', count: 1 }] },
      repeatable: true
    },
    'q_hoa_tinh': {
      id: 'q_hoa_tinh',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Hỏa Tinh Thổ',
      desc: 'Hạ Xích Diệm Ma tinh anh ở Mỏ Lửa, thu Hỏa Tinh Thổ — nguyên liệu của Hỏa Linh Đan và Trúc Cơ Đan.',
      prereq: { minRank: 7 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'mo-lua', kind: 'monster', speciesId: 'diem_ma', title: 'Hỏa Tinh Thổ' },
      objectives: [{ id: 'collect_hoa_tinh_tho', kind: 'collect_item', itemId: 'hoa-tinh-tho', needed: 2 }],
      rewards: { linhThach: 90 },
      repeatable: true
    },
    'q_tho_cat': {
      id: 'q_tho_cat',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Cát Tinh Hoàng Sa',
      desc: 'Hạ Hoàng Sa Trùng ở Hoang Mạc, thu Cát Tinh về luyện Thổ Linh Đan.',
      prereq: { minRank: 10 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'hoang-mac', kind: 'monster', speciesId: 'sa_trung', title: 'Cát Tinh Hoàng Sa' },
      objectives: [{ id: 'collect_cat_tinh', kind: 'collect_item', itemId: 'cat-tinh', needed: 4 }],
      rewards: { linhThach: 100, items: [{ itemId: 'tho-linh-dan', count: 1 }] },
      repeatable: true
    },
    'q_kim_hon': {
      id: 'q_kim_hon',
      type: 'danphong',
      category: 'Thu Thập',
      title: 'Hồn Kiếm Trủng',
      desc: 'Hạ Tàn Kiếm Linh ở Kiếm Trủng, thu Hồn Kiếm Nhỏ về luyện Kim Linh Đan.',
      prereq: { minRank: 11 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_danphong' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'kiem-trung', kind: 'monster', speciesId: 'kiem_linh', title: 'Hồn Kiếm Trủng' },
      objectives: [{ id: 'collect_hon_kiem_nho', kind: 'collect_item', itemId: 'hon-kiem-nho', needed: 3 }],
      rewards: { linhThach: 120, items: [{ itemId: 'kim-linh-dan', count: 1 }] },
      repeatable: true
    },

    // --- BẢNG TREO THƯỞNG TRẤN (BOARD TOWN) ---
    'bounty_town_01': {
      id: 'bounty_town_01',
      boardId: 'board_town',
      type: 'bounty_town',
      category: 'Treo Thưởng Trấn',
      title: 'Trừ Thảo Tinh Quấy Nhiễu',
      desc: 'Thảo Tinh ở vành ngoài Rừng Độc đang quấy nhiễu khách bộ hành. Hãy hạ gục 5 Thảo Tinh.',
      prereq: { minRank: 0 },
      giver: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      turnIn: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      target: { mapId: 'rung-doc', kind: 'monster', speciesId: 'thao_tinh', title: 'Thảo Tinh Rừng Độc' },
      objectives: [{ id: 'kill_thaotinh', kind: 'kill_monster', speciesId: 'thao_tinh', needed: 5 }],
      rewards: { linhThach: 25 },
      repeatable: true,
      cooldownSec: 60
    },
    'bounty_town_02': {
      id: 'bounty_town_02',
      boardId: 'board_town',
      type: 'bounty_town',
      category: 'Treo Thưởng Trấn',
      title: 'Thu Thập Lá Xanh',
      desc: 'Dược điếm cần gấp 3 Lá Thanh Tụy để bào chế thuốc giải độc.',
      prereq: { minRank: 0 },
      giver: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      turnIn: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      target: { mapId: 'rung-doc', kind: 'gather', itemId: 'la-thanh-tuy', title: 'Điểm hái Thảo Dược' },
      objectives: [{ id: 'collect_la_thanh_tuy', kind: 'collect_item', itemId: 'la-thanh-tuy', needed: 3 }],
      rewards: { linhThach: 30 },
      repeatable: true,
      cooldownSec: 60
    },
    'bounty_town_03': {
      id: 'bounty_town_03',
      boardId: 'board_town',
      type: 'bounty_town',
      category: 'Treo Thưởng Trấn',
      title: 'Tiêu Diệt Nhện Độc',
      desc: 'Nhện Xanh giăng tơ độc khắp lối đi trong rừng sâu. Diệt trừ 3 Nhện Xanh.',
      prereq: { minRank: 1 },
      giver: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      turnIn: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      target: { mapId: 'rung-doc', kind: 'monster', speciesId: 'nhen_xanh', title: 'Nhện Xanh Rừng Độc' },
      objectives: [{ id: 'kill_nhen', kind: 'kill_monster', speciesId: 'nhen_xanh', needed: 3 }],
      rewards: { linhThach: 35 },
      repeatable: true,
      cooldownSec: 60
    },
    'bounty_town_04': {
      id: 'bounty_town_04',
      boardId: 'board_town',
      type: 'bounty_town',
      category: 'Treo Thưởng Trấn',
      title: 'Dẹp Loạn Băng Hồ',
      desc: 'Băng Xà ở Hồ Băng tấn công thương đoàn. Cần tu sĩ cảnh giới Luyện Khí tầng 4 trở lên tiêu diệt 4 Băng Xà.',
      prereq: { minRank: 4 },
      giver: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      turnIn: { mapId: 'mieu_hoang', kind: 'board', boardId: 'board_town' },
      target: { mapId: 'ho-bang', kind: 'monster', speciesId: 'bang_xa', title: 'Băng Xà Hồ Băng' },
      objectives: [{ id: 'kill_bang_xa', kind: 'kill_monster', speciesId: 'bang_xa', needed: 4 }],
      rewards: { linhThach: 50 },
      repeatable: true,
      cooldownSec: 60
    },

    // --- BẢNG TREO THƯỞNG TÔNG MÔN (BOARD SECT) ---
    'bounty_sect_01': {
      id: 'bounty_sect_01',
      boardId: 'board_sect',
      type: 'bounty_sect',
      category: 'Việc Tông Môn',
      title: 'Tuần Tra Sơn Môn',
      desc: 'Chấp Sự Đường phát lệnh: Tuần tra biên giới sơn môn, tiêu diệt 5 Thảo Tinh.',
      prereq: { minRank: 1, minSectRank: 1, sectStage: 4 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_sect' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'rung-doc', kind: 'monster', speciesId: 'thao_tinh', title: 'Thảo Tinh Biên Giới' },
      objectives: [{ id: 'kill_thaotinh', kind: 'kill_monster', speciesId: 'thao_tinh', needed: 5 }],
      rewards: { linhThach: 20, sectContribution: 15 },
      repeatable: true,
      cooldownSec: 60
    },
    'bounty_sect_02': {
      id: 'bounty_sect_02',
      boardId: 'board_sect',
      type: 'bounty_sect',
      category: 'Việc Tông Môn',
      title: 'Cống Nạp Băng Tinh',
      desc: 'Tông môn cần Băng Tinh để duy trì hàn trận. Cống nạp 3 Băng Tinh.',
      prereq: { minRank: 4, minSectRank: 2, sectStage: 4 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_sect' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'ho-bang', kind: 'gather', itemId: 'bang-tinh', title: 'Mỏ Băng Tinh' },
      objectives: [{ id: 'collect_bang_tinh', kind: 'collect_item', itemId: 'bang-tinh', needed: 3 }],
      rewards: { linhThach: 40, sectContribution: 25 },
      repeatable: true,
      cooldownSec: 60
    },
    'bounty_sect_03': {
      id: 'bounty_sect_03',
      boardId: 'board_sect',
      type: 'bounty_sect',
      category: 'Việc Tông Môn',
      title: 'Thảo Phạt Xích Diệm Ma',
      desc: 'Xích Diệm Ma ở Mỏ Lửa hung hãn cản trở khai thác. Hãy tiêu diệt 2 Xích Diệm Ma.',
      prereq: { minRank: 7, minSectRank: 2, sectStage: 4 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_sect' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'mo-lua', kind: 'monster', speciesId: 'diem_ma', title: 'Xích Diệm Ma' },
      objectives: [{ id: 'kill_diem_ma', kind: 'kill_monster', speciesId: 'diem_ma', needed: 2 }],
      rewards: { linhThach: 60, sectContribution: 35 },
      repeatable: true,
      cooldownSec: 60
    },
    'bounty_sect_04': {
      id: 'bounty_sect_04',
      boardId: 'board_sect',
      type: 'bounty_sect',
      category: 'Việc Tông Môn',
      title: 'Trảm Yêu Thú Đầu Đàn',
      desc: 'Trảm sát thủ lĩnh yêu thú Giao Vương tại đầm lầy băng sâu để lập công lớn cho tông môn.',
      prereq: { minRank: 10, minSectRank: 3, sectStage: 4 },
      giver: { mapId: 'tong-mon', kind: 'board', boardId: 'board_sect' },
      turnIn: { mapId: 'tong-mon', kind: 'npc', npcId: 'npc_chapsu' },
      target: { mapId: 'ho-bang', kind: 'monster', speciesId: 'giao_vuong', title: 'Giao Vương Đầu Đàn' },
      objectives: [{ id: 'kill_giao_vuong', kind: 'kill_monster', speciesId: 'giao_vuong', needed: 1 }],
      rewards: { linhThach: 100, sectContribution: 50 },
      repeatable: true,
      cooldownSec: 120
    }
  };

  // ---------------------------------------------------------------------------
  // KHỞI TẠO TRẠNG THÁI & TƯƠNG THÍCH SAVE CŨ (MIGRATION)
  // ---------------------------------------------------------------------------

  /**
   * Đảm bảo player có trường questState đầy đủ và migrate từ save cũ nếu cần.
   */
  function ensureQuestState(player) {
    if (!player) return null;

    if (!player.questState || typeof player.questState !== 'object') {
      player.questState = {
        active: {},
        completed: {},
        trackedQuestIds: [],
        pinnedQuestId: null,
        dailyCompletions: { date: new Date().toISOString().slice(0, 10), counts: {} },
        sect: {
          contribution: 0,
          lifetimeContribution: 0,
          rank: 1, // 1: Ngoại môn, 2: Nội môn, 3: Chân truyền, 4: Chấp sự
          rankName: 'Ngoại Môn Đệ Tử'
        }
      };
    }

    var qs = player.questState;
    if (!qs.active || typeof qs.active !== 'object') qs.active = {};
    if (!qs.completed || typeof qs.completed !== 'object') qs.completed = {};
    if (!Array.isArray(qs.trackedQuestIds)) qs.trackedQuestIds = [];
    if (!qs.dailyCompletions || typeof qs.dailyCompletions !== 'object') {
      qs.dailyCompletions = { date: new Date().toISOString().slice(0, 10), counts: {} };
    }
    if (!qs.sect || typeof qs.sect !== 'object') {
      qs.sect = { contribution: 0, lifetimeContribution: 0, rank: 1, rankName: 'Ngoại Môn Đệ Tử' };
    }

    // Thực hiện migration từ dữ liệu cũ (player.quests, player.danPhong, player.v1)
    if (!qs._migrated) {
      migrateFromLegacy(player);
      qs._migrated = true;
    }

    // Đồng bộ ngược lại player.quests để mã cũ đọc không gãy
    syncLegacy(player);

    return qs;
  }

  /**
   * Chuyển đổi dữ liệu từ save cũ sang questState
   */
  function migrateFromLegacy(player) {
    if (!player) return;
    var q = player.quests;
    var qs = player.questState;

    if (q) {
      var sectStage = (q.sectStage !== undefined) ? q.sectStage : 0;

      // 1. Q1 Linh Nhi
      if (sectStage >= 1 || q.talked_linhnhi) {
        qs.completed['q_main_01_linhnhi'] = qs.completed['q_main_01_linhnhi'] || { completedAt: 1, count: 1 };
        delete qs.active['q_main_01_linhnhi'];
        var idx1 = qs.trackedQuestIds.indexOf('q_main_01_linhnhi');
        if (idx1 !== -1) qs.trackedQuestIds.splice(idx1, 1);
      } else {
        if (!qs.active['q_main_01_linhnhi'] && !qs.completed['q_main_01_linhnhi']) {
          qs.active['q_main_01_linhnhi'] = {
            questId: 'q_main_01_linhnhi',
            acceptedAt: Date.now(),
            objectives: { talk_linhnhi: { current: 0, needed: 1, done: false } },
            readyToTurnIn: false
          };
          if (qs.trackedQuestIds.indexOf('q_main_01_linhnhi') === -1) {
            qs.trackedQuestIds.push('q_main_01_linhnhi');
          }
          if (!qs.pinnedQuestId) qs.pinnedQuestId = 'q_main_01_linhnhi';
        }
      }

      // 2. Q2 Săn Thảo Tinh
      if (sectStage >= 1 || q.huntCompleted) {
        qs.completed['q_main_02_thaotinh'] = qs.completed['q_main_02_thaotinh'] || { completedAt: 1, count: 1 };
        delete qs.active['q_main_02_thaotinh'];
        var idx2 = qs.trackedQuestIds.indexOf('q_main_02_thaotinh');
        if (idx2 !== -1) qs.trackedQuestIds.splice(idx2, 1);
      } else if (q.talked_linhnhi) {
        if (!qs.active['q_main_02_thaotinh'] && !qs.completed['q_main_02_thaotinh']) {
          var kills = q.thaotinhKills || 0;
          qs.active['q_main_02_thaotinh'] = {
            questId: 'q_main_02_thaotinh',
            acceptedAt: Date.now(),
            objectives: { kill_thaotinh: { current: kills, needed: 5, done: kills >= 5 } },
            readyToTurnIn: kills >= 5
          };
          if (qs.trackedQuestIds.indexOf('q_main_02_thaotinh') === -1 && qs.trackedQuestIds.length < 5) {
            qs.trackedQuestIds.push('q_main_02_thaotinh');
          }
          if (!qs.pinnedQuestId || qs.pinnedQuestId === 'q_main_01_linhnhi') qs.pinnedQuestId = 'q_main_02_thaotinh';
        }
      }

      // 3. Q3 - Q6 Chuỗi Tông Môn
      if (sectStage >= 1) {
        qs.completed['q_main_03_farewell'] = qs.completed['q_main_03_farewell'] || { completedAt: 1, count: 1 };
        delete qs.active['q_main_03_farewell'];
        var idx3 = qs.trackedQuestIds.indexOf('q_main_03_farewell');
        if (idx3 !== -1) qs.trackedQuestIds.splice(idx3, 1);
      } else if (q.huntCompleted) {
        if (!qs.active['q_main_03_farewell'] && !qs.completed['q_main_03_farewell']) {
          qs.active['q_main_03_farewell'] = {
            questId: 'q_main_03_farewell',
            acceptedAt: Date.now(),
            objectives: { farewell: { current: 0, needed: 1, done: false } },
            readyToTurnIn: false
          };
          if (qs.trackedQuestIds.indexOf('q_main_03_farewell') === -1 && qs.trackedQuestIds.length < 5) {
            qs.trackedQuestIds.push('q_main_03_farewell');
          }
          qs.pinnedQuestId = 'q_main_03_farewell';
        }
      }

      if (sectStage >= 2) {
        qs.completed['q_main_04_tiepdan'] = qs.completed['q_main_04_tiepdan'] || { completedAt: 1, count: 1 };
        delete qs.active['q_main_04_tiepdan'];
        var idx4 = qs.trackedQuestIds.indexOf('q_main_04_tiepdan');
        if (idx4 !== -1) qs.trackedQuestIds.splice(idx4, 1);
      } else if (sectStage === 1) {
        if (!qs.active['q_main_04_tiepdan'] && !qs.completed['q_main_04_tiepdan']) {
          qs.active['q_main_04_tiepdan'] = {
            questId: 'q_main_04_tiepdan',
            acceptedAt: Date.now(),
            objectives: { report: { current: 0, needed: 1, done: false } },
            readyToTurnIn: false
          };
          if (qs.trackedQuestIds.indexOf('q_main_04_tiepdan') === -1 && qs.trackedQuestIds.length < 5) {
            qs.trackedQuestIds.push('q_main_04_tiepdan');
          }
          qs.pinnedQuestId = 'q_main_04_tiepdan';
        }
      }

      if (sectStage >= 3) {
        qs.completed['q_main_05_chuongmon'] = qs.completed['q_main_05_chuongmon'] || { completedAt: 1, count: 1 };
        delete qs.active['q_main_05_chuongmon'];
        var idx5 = qs.trackedQuestIds.indexOf('q_main_05_chuongmon');
        if (idx5 !== -1) qs.trackedQuestIds.splice(idx5, 1);
      } else if (sectStage === 2) {
        if (!qs.active['q_main_05_chuongmon'] && !qs.completed['q_main_05_chuongmon']) {
          qs.active['q_main_05_chuongmon'] = {
            questId: 'q_main_05_chuongmon',
            acceptedAt: Date.now(),
            objectives: { meet: { current: 0, needed: 1, done: false } },
            readyToTurnIn: false
          };
          if (qs.trackedQuestIds.indexOf('q_main_05_chuongmon') === -1 && qs.trackedQuestIds.length < 5) {
            qs.trackedQuestIds.push('q_main_05_chuongmon');
          }
          qs.pinnedQuestId = 'q_main_05_chuongmon';
        }
      }

      if (sectStage >= 4) {
        qs.completed['q_main_06_chapsu'] = qs.completed['q_main_06_chapsu'] || { completedAt: 1, count: 1 };
        delete qs.active['q_main_06_chapsu'];
        var idx6 = qs.trackedQuestIds.indexOf('q_main_06_chapsu');
        if (idx6 !== -1) qs.trackedQuestIds.splice(idx6, 1);
      } else if (sectStage === 3) {
        if (!qs.active['q_main_06_chapsu'] && !qs.completed['q_main_06_chapsu']) {
          qs.active['q_main_06_chapsu'] = {
            questId: 'q_main_06_chapsu',
            acceptedAt: Date.now(),
            objectives: { orders: { current: 0, needed: 1, done: false } },
            readyToTurnIn: false
          };
          if (qs.trackedQuestIds.indexOf('q_main_06_chapsu') === -1 && qs.trackedQuestIds.length < 5) {
            qs.trackedQuestIds.push('q_main_06_chapsu');
          }
          qs.pinnedQuestId = 'q_main_06_chapsu';
        }
      }

      // 4. Q7 - Q13 MainStage
      var ms = q.mainStage || 0;
      if (sectStage >= 4 && ms === 0) ms = 1;

      var mainStageMapping = [
        { stage: 1, qId: 'q_main_07_ren_luyen' },
        { stage: 2, qId: 'q_main_08_tru_nhen' },
        { stage: 3, qId: 'q_main_09_moc_linh' },
        { stage: 4, qId: 'q_main_10_ho_bang' },
        { stage: 5, qId: 'q_main_11_bang_xa' },
        { stage: 6, qId: 'q_main_12_giao_vuong' },
        { stage: 7, qId: 'q_main_13_truc_co' } // mainStage 7..9 -> q_main_13_truc_co
      ];

      for (var i = 0; i < mainStageMapping.length; i++) {
        var mItem = mainStageMapping[i];
        if (ms > mItem.stage) {
          qs.completed[mItem.qId] = qs.completed[mItem.qId] || { completedAt: 1, count: 1 };
          delete qs.active[mItem.qId];
          var midx = qs.trackedQuestIds.indexOf(mItem.qId);
          if (midx !== -1) qs.trackedQuestIds.splice(midx, 1);
        } else if (ms === mItem.stage) {
          if (!qs.active[mItem.qId] && !qs.completed[mItem.qId]) {
            var objMap = {};
            if (mItem.qId === 'q_main_08_tru_nhen') {
              var nk = q.nhenKills || 0;
              objMap['kill_nhen'] = { current: nk, needed: 3, done: nk >= 3 };
            } else if (mItem.qId === 'q_main_11_bang_xa') {
              var bx = q.bangXaKills || 0;
              objMap['kill_bang_xa'] = { current: bx, needed: 4, done: bx >= 4 };
            }
            qs.active[mItem.qId] = {
              questId: mItem.qId,
              acceptedAt: Date.now(),
              objectives: objMap,
              readyToTurnIn: false
            };
            if (qs.trackedQuestIds.indexOf(mItem.qId) === -1 && qs.trackedQuestIds.length < 5) {
              qs.trackedQuestIds.push(mItem.qId);
            }
            qs.pinnedQuestId = mItem.qId;
          }
        }
      }
      if (ms >= 10) {
        qs.completed['q_main_13_truc_co'] = qs.completed['q_main_13_truc_co'] || { completedAt: 1, count: 1 };
        delete qs.active['q_main_13_truc_co'];
        var idx13 = qs.trackedQuestIds.indexOf('q_main_13_truc_co');
        if (idx13 !== -1) qs.trackedQuestIds.splice(idx13, 1);
      }
    }

    // 5. ZoneQuests
    if (player.v1 && player.v1.zoneQuests) {
      var zq = player.v1.zoneQuests;
      if (zq.completed) {
        for (var zqId in zq.completed) {
          if (zq.completed[zqId]) {
            qs.completed[zqId] = qs.completed[zqId] || { completedAt: 1, count: 1 };
          }
        }
      }
      if (zq.activeQuestId && !qs.completed[zq.activeQuestId] && !qs.active[zq.activeQuestId]) {
        qs.active[zq.activeQuestId] = {
          questId: zq.activeQuestId,
          acceptedAt: Date.now(),
          objectives: {},
          readyToTurnIn: false
        };
        if (zq.tracked && qs.trackedQuestIds.indexOf(zq.activeQuestId) === -1 && qs.trackedQuestIds.length < 5) {
          qs.trackedQuestIds.push(zq.activeQuestId);
          qs.pinnedQuestId = zq.activeQuestId;
        }
      }
    }

    // 6. Dan Phong
    if (player.danPhong) {
      var dp = player.danPhong;
      if (dp.completions) {
        for (var dpId in dp.completions) {
          if (dp.completions[dpId]) {
            qs.completed[dpId] = qs.completed[dpId] || { completedAt: 1, count: dp.completions[dpId] };
          }
        }
      }
      if (dp.activeQuestId && !qs.active[dp.activeQuestId]) {
        qs.active[dp.activeQuestId] = {
          questId: dp.activeQuestId,
          acceptedAt: Date.now(),
          objectives: {},
          readyToTurnIn: false
        };
        if (dp.tracked && qs.trackedQuestIds.indexOf(dp.activeQuestId) === -1 && qs.trackedQuestIds.length < 5) {
          qs.trackedQuestIds.push(dp.activeQuestId);
          qs.pinnedQuestId = dp.activeQuestId;
        }
      }
    }

    // Dọn dẹp pinnedQuestId nếu quest đó đã xong hoặc không còn active
    if (qs.pinnedQuestId && !qs.active[qs.pinnedQuestId]) {
      qs.pinnedQuestId = qs.trackedQuestIds.length > 0 ? qs.trackedQuestIds[0] : null;
    }
  }

  /**
   * Đồng bộ hai chiều ngược lại player.quests để giữ nguyên hành vi của các module cũ.
   */
  function syncLegacy(player) {
    if (!player || !player.questState) return;
    var qs = player.questState;
    if (!player.quests) player.quests = {};
    var q = player.quests;

    // talked_linhnhi
    if (qs.completed['q_main_01_linhnhi'] || qs.active['q_main_02_thaotinh'] || qs.completed['q_main_02_thaotinh']) {
      q.talked_linhnhi = true;
    }

    // thaotinhKills & huntCompleted
    if (qs.completed['q_main_02_thaotinh']) {
      q.huntCompleted = true;
      q.thaotinhKills = 5;
    } else if (qs.active['q_main_02_thaotinh']) {
      var obj = qs.active['q_main_02_thaotinh'].objectives && qs.active['q_main_02_thaotinh'].objectives.kill_thaotinh;
      q.thaotinhKills = obj ? obj.current : (q.thaotinhKills || 0);
      q.huntCompleted = false;
    }

    // sectStage
    var curSectStage = (q.sectStage !== undefined) ? q.sectStage : 0;
    var sStage = 0;
    if (qs.completed['q_main_06_chapsu'] || qs.active['q_main_07_ren_luyen'] || qs.completed['q_main_07_ren_luyen']) {
      sStage = 4;
    } else if (qs.completed['q_main_05_chuongmon'] || qs.active['q_main_06_chapsu']) {
      sStage = 3;
    } else if (qs.completed['q_main_04_tiepdan'] || qs.active['q_main_05_chuongmon']) {
      sStage = 2;
    } else if (qs.completed['q_main_03_farewell'] || qs.active['q_main_04_tiepdan']) {
      sStage = 1;
    }
    q.sectStage = Math.max(curSectStage, sStage);

    // mainStage
    var curMainStage = (q.mainStage !== undefined) ? q.mainStage : 0;
    var mStage = 0;
    if (qs.completed['q_main_13_truc_co']) {
      mStage = 10;
    } else if (qs.active['q_main_13_truc_co']) {
      // mainStage 7, 8, hoặc 9 tùy tiến độ
      var minTv = getWeakestTuVi(player);
      var st = getStateAPI();
      var hasDan = st ? st.hasItemInBag(player, 'truc-co-dan', 1) : false;
      if (hasDan) {
        mStage = 9;
      } else if (minTv >= 600) {
        mStage = 8;
      } else {
        mStage = 7;
      }
    } else if (qs.completed['q_main_12_giao_vuong']) {
      mStage = 7;
    } else if (qs.active['q_main_12_giao_vuong']) {
      mStage = 6;
    } else if (qs.completed['q_main_11_bang_xa']) {
      mStage = 6;
    } else if (qs.active['q_main_11_bang_xa']) {
      mStage = 5;
      var objBx = qs.active['q_main_11_bang_xa'].objectives && qs.active['q_main_11_bang_xa'].objectives.kill_bang_xa;
      q.bangXaKills = objBx ? objBx.current : (q.bangXaKills || 0);
    } else if (qs.completed['q_main_10_ho_bang']) {
      mStage = 5;
    } else if (qs.active['q_main_10_ho_bang']) {
      mStage = 4;
    } else if (qs.completed['q_main_09_moc_linh']) {
      mStage = 4;
    } else if (qs.active['q_main_09_moc_linh']) {
      mStage = 3;
    } else if (qs.completed['q_main_08_tru_nhen']) {
      mStage = 3;
    } else if (qs.active['q_main_08_tru_nhen']) {
      mStage = 2;
      var objNh = qs.active['q_main_08_tru_nhen'].objectives && qs.active['q_main_08_tru_nhen'].objectives.kill_nhen;
      q.nhenKills = objNh ? objNh.current : (q.nhenKills || 0);
    } else if (qs.completed['q_main_07_ren_luyen']) {
      mStage = 2;
    } else if (qs.active['q_main_07_ren_luyen']) {
      mStage = 1;
    } else if (q.sectStage >= 4) {
      if (!curMainStage) mStage = 1;
    }
    q.mainStage = Math.max(curMainStage, mStage);

    // Đồng bộ ngược lại cho danPhong và zoneQuests
    if (player.danPhong) {
      for (var k in qs.active) {
        if (QUEST_DEFS[k] && QUEST_DEFS[k].type === 'danphong') {
          player.danPhong.activeQuestId = k;
          player.danPhong.tracked = (qs.trackedQuestIds.indexOf(k) !== -1);
          break;
        }
      }
    }
    if (player.v1 && player.v1.zoneQuests) {
      for (var z in qs.active) {
        if (QUEST_DEFS[z] && QUEST_DEFS[z].type === 'zone_unlock') {
          player.v1.zoneQuests.activeQuestId = z;
          player.v1.zoneQuests.tracked = (qs.trackedQuestIds.indexOf(z) !== -1);
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // API QUẢN LÝ NHIỆM VỤ (CORE QUEST MANAGEMENT API)
  // ---------------------------------------------------------------------------

  function getQuestDef(questId) {
    return QUEST_DEFS[questId] || null;
  }

  function getAllQuestDefs() {
    return Object.assign({}, QUEST_DEFS);
  }

  function isQuestActive(player, questId) {
    if (!player) return false;
    ensureQuestState(player);
    return Boolean(player.questState.active && player.questState.active[questId]);
  }

  function isQuestCompleted(player, questId) {
    if (!player) return false;
    ensureQuestState(player);
    return Boolean(player.questState.completed && player.questState.completed[questId]);
  }

  function getActiveQuests(player) {
    if (!player) return [];
    ensureQuestState(player);
    var list = [];
    for (var qId in player.questState.active) {
      var def = getQuestDef(qId);
      if (def) {
        list.push({ def: def, progress: player.questState.active[qId] });
      }
    }
    return list;
  }

  function isQuestOnCooldown(player, questId) {
    if (!player) return { onCooldown: false, remainSec: 0 };
    ensureQuestState(player);
    var def = getQuestDef(questId);
    if (!def || !def.repeatable) return { onCooldown: false, remainSec: 0 };
    var qs = player.questState;
    var cInfo = qs.completed && qs.completed[questId];
    if (!cInfo || !cInfo.completedAt) return { onCooldown: false, remainSec: 0 };
    var cdSec = def.cooldownSec || 0;
    if (cdSec <= 0) return { onCooldown: false, remainSec: 0 };
    var elapsed = (Date.now() - cInfo.completedAt) / 1000;
    if (elapsed < cdSec) {
      return { onCooldown: true, remainSec: Math.ceil(cdSec - elapsed) };
    }
    return { onCooldown: false, remainSec: 0 };
  }

  function getBoardQuests(player, boardId) {
    if (!player) return [];
    ensureQuestState(player);
    var qs = player.questState;
    var list = [];

    for (var qId in QUEST_DEFS) {
      var def = QUEST_DEFS[qId];
      if (def.boardId !== boardId && def.type !== boardId) continue;

      var entry = {
        def: def,
        status: 'available',
        reason: null,
        msg: '',
        remainCooldownSec: 0
      };

      if (qs.active[qId]) {
        var chk = checkObjectivesProgress(player, qId);
        entry.status = chk.ready ? 'ready_to_turn_in' : 'in_progress';
        entry.progress = qs.active[qId];
      } else if (qs.completed[qId] && !def.repeatable) {
        entry.status = 'completed';
      } else if (def.repeatable && qs.completed[qId]) {
        var cd = isQuestOnCooldown(player, qId);
        if (cd.onCooldown) {
          entry.status = 'on_cooldown';
          entry.remainCooldownSec = cd.remainSec;
          entry.msg = 'Đang hồi (' + cd.remainSec + 's)';
        } else {
          var canAcc = canAcceptQuest(player, qId);
          if (!canAcc.ok) {
            entry.status = 'locked';
            entry.reason = canAcc.reason;
            entry.msg = canAcc.msg;
          } else {
            entry.status = 'available';
          }
        }
      } else {
        var canAcc2 = canAcceptQuest(player, qId);
        if (!canAcc2.ok) {
          entry.status = 'locked';
          entry.reason = canAcc2.reason;
          entry.msg = canAcc2.msg;
        } else {
          entry.status = 'available';
        }
      }

      list.push(entry);
    }
    return list;
  }

  function canAcceptQuest(player, questId) {
    if (!player) return { ok: false, reason: 'no_player', msg: 'Không tìm thấy người chơi.' };
    var def = getQuestDef(questId);
    if (!def) return { ok: false, reason: 'not_found', msg: 'Nhiệm vụ không tồn tại.' };

    ensureQuestState(player);
    var qs = player.questState;

    // Đang nhận rồi
    if (qs.active[questId]) {
      return { ok: false, reason: 'already_active', msg: 'Nhiệm vụ đang tiến hành.' };
    }

    // Đã hoàn thành (nếu không phải repeatable)
    if (qs.completed[questId] && !def.repeatable) {
      return { ok: false, reason: 'already_completed', msg: 'Nhiệm vụ đã hoàn thành.' };
    }

    // Kiểm tra cooldown cho nhiệm vụ lặp lại (repeatable)
    if (def.repeatable && qs.completed[questId]) {
      var cd = isQuestOnCooldown(player, questId);
      if (cd.onCooldown) {
        return { ok: false, reason: 'cooldown', msg: 'Nhiệm vụ đang hồi chiêu (' + cd.remainSec + 's nữa).' };
      }
    }

    // Kiểm tra prereq: sectStage (yêu cầu hoàn tất nhập môn)
    if (def.prereq && def.prereq.sectStage !== undefined) {
      var curSect = (player.quests && player.quests.sectStage !== undefined) ? player.quests.sectStage : 0;
      if (curSect < def.prereq.sectStage) {
        return { ok: false, reason: 'sect_stage_low', msg: 'Cần hoàn tất nhập môn trước khi nhận việc này.' };
      }
    }

    // Kiểm tra prereq: minRank
    var rank = getRealmRank(player);
    if (def.prereq && def.prereq.minRank !== undefined && rank < def.prereq.minRank) {
      return { ok: false, reason: 'rank_low', msg: 'Cảnh giới chưa đủ để nhận việc này.' };
    }

    // Kiểm tra prereq: minSectRank (chức vụ tông môn)
    if (def.prereq && def.prereq.minSectRank !== undefined) {
      var sectRank = (qs.sect && qs.sect.rank) || 1;
      if (sectRank < def.prereq.minSectRank) {
        return { ok: false, reason: 'sect_rank_low', msg: 'Chức vụ tông môn chưa đủ yêu cầu.' };
      }
    }

    // Kiểm tra prereq: completedQuests
    if (def.prereq && def.prereq.completedQuests) {
      for (var i = 0; i < def.prereq.completedQuests.length; i++) {
        var reqQId = def.prereq.completedQuests[i];
        if (!isQuestCompleted(player, reqQId)) {
          return { ok: false, reason: 'prereq_missing', msg: 'Cần hoàn thành nhiệm vụ trước đó.' };
        }
      }
    }

    // Giới hạn số lượng active (tối đa 20 việc active)
    var activeCount = Object.keys(qs.active).length;
    if (activeCount >= 20) {
      return { ok: false, reason: 'too_many_active', msg: 'Sổ nhiệm vụ đã đầy (tối đa 20 việc cùng lúc).' };
    }

    return { ok: true, msg: 'Có thể nhận nhiệm vụ.' };
  }

  function acceptQuest(player, questId) {
    var check = canAcceptQuest(player, questId);
    if (!check.ok) {
      if (check.msg) showToast(check.msg);
      return check;
    }

    var def = getQuestDef(questId);
    var qs = player.questState;

    var objMap = {};
    if (def.objectives) {
      for (var i = 0; i < def.objectives.length; i++) {
        var o = def.objectives[i];
        objMap[o.id] = { current: 0, needed: o.needed || 1, done: false };
      }
    }

    qs.active[questId] = {
      questId: questId,
      acceptedAt: Date.now(),
      objectives: objMap,
      readyToTurnIn: false
    };

    // Tự động theo dõi nếu danh sách theo dõi chưa đủ 5
    if (qs.trackedQuestIds.length < 5 && qs.trackedQuestIds.indexOf(questId) === -1) {
      qs.trackedQuestIds.push(questId);
    }
    // Ghim ưu tiên nếu chưa có ghim
    if (!qs.pinnedQuestId) {
      qs.pinnedQuestId = questId;
    }

    // Lưu và đồng bộ
    syncLegacy(player);
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    playChime();
    showToast('Đã nhận nhiệm vụ: ' + def.title);
    refreshHUD();

    return { ok: true, questId: questId, msg: 'Đã nhận nhiệm vụ: ' + def.title };
  }

  function abandonQuest(player, questId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    ensureQuestState(player);
    var qs = player.questState;
    if (!qs.active[questId]) {
      return { ok: false, msg: 'Nhiệm vụ không trong danh sách đang làm.' };
    }

    var def = getQuestDef(questId);
    if (def && (def.type === 'main' || def.type === 'sect_intro')) {
      return { ok: false, msg: 'Không thể hủy nhiệm vụ chính tuyến / nhập môn.' };
    }

    delete qs.active[questId];

    // Bỏ khỏi theo dõi
    var idx = qs.trackedQuestIds.indexOf(questId);
    if (idx !== -1) qs.trackedQuestIds.splice(idx, 1);
    if (qs.pinnedQuestId === questId) {
      qs.pinnedQuestId = qs.trackedQuestIds.length > 0 ? qs.trackedQuestIds[0] : null;
    }

    syncLegacy(player);
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    showToast('Đã hủy nhiệm vụ: ' + (def ? def.title : questId));
    refreshHUD();

    return { ok: true, questId: questId, msg: 'Đã hủy nhiệm vụ.' };
  }

  function checkObjectivesProgress(player, questId) {
    if (!player) return { ready: false };
    ensureQuestState(player);
    var prog = player.questState.active[questId];
    var def = getQuestDef(questId);
    if (!prog || !def) return { ready: false };

    var st = getStateAPI();
    var allDone = true;

    if (def.objectives) {
      for (var i = 0; i < def.objectives.length; i++) {
        var objDef = def.objectives[i];
        var oProg = prog.objectives[objDef.id] || { current: 0, needed: objDef.needed || 1, done: false };

        if (objDef.kind === 'collect_item') {
          var count = st && st.countItemInBag ? st.countItemInBag(player, objDef.itemId) : 0;
          oProg.current = count;
          oProg.done = count >= objDef.needed;
        } else if (objDef.kind === 'min_tuvi') {
          var minTv = getWeakestTuVi(player);
          oProg.current = minTv;
          oProg.done = minTv >= objDef.needed;
        } else if (objDef.kind === 'reach_realm') {
          var rank = getRealmRank(player);
          var neededRank = (objDef.realm === 'Trúc Cơ Sơ Kỳ') ? 10 : 0;
          oProg.current = rank;
          oProg.done = rank >= neededRank;
        }

        if (!oProg.done) allDone = false;
        prog.objectives[objDef.id] = oProg;
      }
    }

    prog.readyToTurnIn = allDone;
    return { ready: allDone, objectives: prog.objectives };
  }

  function canTurnInQuest(player, questId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    ensureQuestState(player);
    var prog = player.questState.active[questId];
    var def = getQuestDef(questId);
    if (!prog || !def) return { ok: false, msg: 'Nhiệm vụ không tồn tại trong danh sách đang làm.' };

    var progressCheck = checkObjectivesProgress(player, questId);
    if (!progressCheck.ready) {
      return { ok: false, reason: 'not_ready', msg: 'Chưa hoàn thành đủ mục tiêu nhiệm vụ.' };
    }

    return { ok: true, msg: 'Đã sẵn sàng trả nhiệm vụ.' };
  }

  function turnInQuest(player, questId) {
    var check = canTurnInQuest(player, questId);
    if (!check.ok) {
      if (check.msg) showToast(check.msg);
      return check;
    }

    var def = getQuestDef(questId);
    var qs = player.questState;
    var st = getStateAPI();
    var mAPI = getMonstersAPI();

    // 1. Trừ vật phẩm yêu cầu nộp (nếu có collect_item)
    if (def.objectives) {
      for (var i = 0; i < def.objectives.length; i++) {
        var obj = def.objectives[i];
        if (obj.kind === 'collect_item') {
          // Trừ nếu nhiệm vụ loại thu nộp (danphong, bounty thu nộp, hoặc zone_unlock sửa cầu)
          if (def.type === 'danphong' || def.type === 'bounty_town' || def.type === 'bounty_sect' || def.id === 'quest_sua_cau') {
            if (st && st.removeItemFromBag) {
              st.removeItemFromBag(player, obj.itemId, obj.needed);
            }
          }
        }
      }
    }

    // 2. Trao thưởng
    var rewardTextList = [];

    // Linh Thạch
    if (def.rewards && def.rewards.linhThach) {
      player.linhThach = (player.linhThach || 0) + def.rewards.linhThach;
      rewardTextList.push('+' + def.rewards.linhThach + ' Linh Thạch');
    }

    // Điểm Cống Hiến Tông Môn
    if (def.rewards && def.rewards.sectContribution) {
      qs.sect.contribution = (qs.sect.contribution || 0) + def.rewards.sectContribution;
      qs.sect.lifetimeContribution = (qs.sect.lifetimeContribution || 0) + def.rewards.sectContribution;
      rewardTextList.push('+' + def.rewards.sectContribution + ' Điểm Cống Hiến');
      checkSectRankUp(player);
    }

    // Vật phẩm thưởng
    if (def.rewards && def.rewards.items) {
      for (var j = 0; j < def.rewards.items.length; j++) {
        var it = def.rewards.items[j];
        if (st && st.addItemToBag) {
          st.addItemToBag(player, it.itemId, it.count || 1, mAPI ? mAPI.ITEM_DEFS : undefined);
        }
        var itName = it.itemId;
        if (mAPI && mAPI.ITEM_DEFS && mAPI.ITEM_DEFS[it.itemId]) itName = mAPI.ITEM_DEFS[it.itemId].name;
        rewardTextList.push('+' + (it.count || 1) + ' ' + itName);
      }
    }

    // Phần thưởng / Cờ đặc biệt
    if (def.rewards && def.rewards.special) {
      var sp = def.rewards.special;
      if (sp === 'grant_starter_sword') {
        var eng = getEngineAPI();
        if (eng && eng.grantStarterSword) eng.grantStarterSword(true);
      } else if (sp === 'enter_sect_full') {
        if (typeof window !== 'undefined' && window.GameTuiKho && window.GameTuiKho.grantStorageContainer) {
          window.GameTuiKho.grantStorageContainer(player);
        }
        if (typeof window !== 'undefined' && window.GameTrangBi && window.GameTrangBi.onMainQuestReceived) {
          window.GameTrangBi.onMainQuestReceived(player, 1);
        }
        var eng2 = getEngineAPI();
        if (eng2 && eng2.grantStarterSword) eng2.grantStarterSword(true);
      } else if (sp.indexOf('unlock_zone:') === 0) {
        var zoneId = sp.split(':')[1];
        if (!player.v1) player.v1 = {};
        if (!player.v1.unlockedZones) player.v1.unlockedZones = {};
        player.v1.unlockedZones[zoneId] = true;
      }
    }

    // 3. Cập nhật trạng thái hoàn thành
    var prevCount = (qs.completed[questId] && qs.completed[questId].count) || 0;
    qs.completed[questId] = {
      completedAt: Date.now(),
      count: prevCount + 1
    };
    delete qs.active[questId];

    // Xóa khỏi theo dõi
    var tIdx = qs.trackedQuestIds.indexOf(questId);
    if (tIdx !== -1) qs.trackedQuestIds.splice(tIdx, 1);
    if (qs.pinnedQuestId === questId) {
      qs.pinnedQuestId = qs.trackedQuestIds.length > 0 ? qs.trackedQuestIds[0] : null;
    }

    // Ghi nhận lượt làm trong ngày
    var today = new Date().toISOString().slice(0, 10);
    if (!qs.dailyCompletions || qs.dailyCompletions.date !== today) {
      qs.dailyCompletions = { date: today, counts: {} };
    }
    qs.dailyCompletions.counts[questId] = (qs.dailyCompletions.counts[questId] || 0) + 1;

    // Tự động nhận quest kế tiếp của chuỗi chính nếu có
    autoAdvanceMainChain(player, questId);

    // Đồng bộ ngược lại và lưu
    syncLegacy(player);
    if (st && st.savePlayer) st.savePlayer(player);

    playChime();
    var msgOk = 'Hoàn thành "' + def.title + '"! ' + (rewardTextList.length > 0 ? 'Nhận: ' + rewardTextList.join(', ') : '');
    showToast(msgOk);
    refreshHUD();

    return {
      ok: true,
      questId: questId,
      msg: msgOk,
      rewards: def.rewards
    };
  }

  function autoAdvanceMainChain(player, finishedQuestId) {
    var nextMap = {
      'q_main_01_linhnhi': 'q_main_02_thaotinh',
      'q_main_02_thaotinh': 'q_main_03_farewell',
      'q_main_03_farewell': 'q_main_04_tiepdan',
      'q_main_04_tiepdan': 'q_main_05_chuongmon',
      'q_main_05_chuongmon': 'q_main_06_chapsu',
      'q_main_06_chapsu': 'q_main_07_ren_luyen',
      'q_main_07_ren_luyen': 'q_main_08_tru_nhen',
      'q_main_08_tru_nhen': 'q_main_09_moc_linh',
      'q_main_09_moc_linh': 'q_main_10_ho_bang',
      'q_main_10_ho_bang': 'q_main_11_bang_xa',
      'q_main_11_bang_xa': 'q_main_12_giao_vuong',
      'q_main_12_giao_vuong': 'q_main_13_truc_co'
    };

    var nextId = nextMap[finishedQuestId];
    if (nextId) {
      acceptQuest(player, nextId);
    }
  }

  // ---------------------------------------------------------------------------
  // THEO DÕI NHIỆM VỤ (TRACKING & PINNING - TỐI ĐA 5 VIỆC)
  // ---------------------------------------------------------------------------

  function setTracked(player, questId, on) {
    if (!player) return;
    ensureQuestState(player);
    var qs = player.questState;
    var idx = qs.trackedQuestIds.indexOf(questId);

    if (on) {
      if (idx === -1) {
        if (qs.trackedQuestIds.length >= 5) {
          showToast('Đang theo dõi tối đa 5 nhiệm vụ. Hãy bỏ bớt một việc trước.');
          return false;
        }
        qs.trackedQuestIds.push(questId);
      }
      if (!qs.pinnedQuestId) qs.pinnedQuestId = questId;
    } else {
      if (idx !== -1) {
        qs.trackedQuestIds.splice(idx, 1);
      }
      if (qs.pinnedQuestId === questId) {
        qs.pinnedQuestId = qs.trackedQuestIds.length > 0 ? qs.trackedQuestIds[0] : null;
      }
    }

    syncLegacy(player);
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    refreshHUD();
    return true;
  }

  function setPinned(player, questId) {
    if (!player) return;
    ensureQuestState(player);
    var qs = player.questState;
    if (questId && qs.trackedQuestIds.indexOf(questId) === -1) {
      if (qs.trackedQuestIds.length >= 5) {
        qs.trackedQuestIds.pop(); // Thay thế vị trí cuối
      }
      qs.trackedQuestIds.push(questId);
    }
    qs.pinnedQuestId = questId;

    syncLegacy(player);
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    refreshHUD();
  }

  function getTrackedQuests(player) {
    if (!player) return [];
    ensureQuestState(player);
    var qs = player.questState;
    var list = [];
    for (var i = 0; i < qs.trackedQuestIds.length; i++) {
      var qId = qs.trackedQuestIds[i];
      var def = getQuestDef(qId);
      var prog = qs.active[qId];
      if (def && prog) {
        checkObjectivesProgress(player, qId);
        list.push({
          def: def,
          progress: prog,
          isPinned: (qs.pinnedQuestId === qId)
        });
      }
    }
    return list;
  }

  function getPinnedQuest(player) {
    if (!player) return null;
    ensureQuestState(player);
    var qs = player.questState;
    var qId = qs.pinnedQuestId;
    if (!qId && qs.trackedQuestIds.length > 0) qId = qs.trackedQuestIds[0];
    if (!qId) return null;
    var def = getQuestDef(qId);
    var prog = qs.active[qId];
    if (!def || !prog) return null;
    checkObjectivesProgress(player, qId);
    return { def: def, progress: prog, isPinned: true };
  }

  /**
   * Trả về thông tin đích dẫn đường theo chuẩn Engine.getQuestTargetInfo()
   */
  function getTrackedTargetInfo(player) {
    if (!player) return null;
    ensureQuestState(player);
    var pinned = getPinnedQuest(player);
    if (!pinned) return null;

    var def = pinned.def;
    var prog = pinned.progress;

    // Nếu đã hoàn thành mọi mục tiêu -> đích chuyển sang người nhận / trả
    if (prog.readyToTurnIn) {
      if (def.turnIn) {
        return {
          stepId: 'turnin_' + def.id,
          questId: def.id,
          stage: 4,
          mapId: def.turnIn.mapId,
          kind: def.turnIn.kind || 'npc',
          npcId: def.turnIn.npcId,
          x: def.turnIn.x,
          y: def.turnIn.y,
          title: 'Trả việc: ' + def.title,
          desc: 'Đã hoàn thành! Trở về gặp ' + (def.turnIn.npcId || 'người giao việc') + ' để nhận thưởng.'
        };
      }
    }

    // Ngược lại, đích là mục tiêu hiện tại của nhiệm vụ
    if (def.target) {
      var t = Object.assign({}, def.target);
      t.questId = def.id;
      t.stepId = t.stepId || ('quest_' + def.id);
      t.title = t.title || def.title;
      t.desc = t.desc || def.desc;
      return t;
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // HOOKS SỰ KIỆN GAMEPLAY (EVENT HOOKS)
  // ---------------------------------------------------------------------------

  function onMonsterKilled(player, monster) {
    if (!player || !monster) return;
    ensureQuestState(player);
    var qs = player.questState;
    var speciesId = monster.speciesId;
    var mapId = monster.mapId;

    var updated = false;
    for (var qId in qs.active) {
      var prog = qs.active[qId];
      var def = getQuestDef(qId);
      if (!def || !def.objectives) continue;

      for (var i = 0; i < def.objectives.length; i++) {
        var obj = def.objectives[i];
        if (obj.kind === 'kill_monster' && obj.speciesId === speciesId) {
          var oProg = prog.objectives[obj.id] || { current: 0, needed: obj.needed, done: false };
          if (oProg.current < oProg.needed) {
            oProg.current++;
            if (oProg.current >= oProg.needed) {
              oProg.done = true;
              showToast('Mục tiêu hoàn thành: ' + def.title + ' (' + oProg.needed + '/' + oProg.needed + ')');
            }
            prog.objectives[obj.id] = oProg;
            updated = true;
          }
        }
      }
      var chkM = checkObjectivesProgress(player, qId);
      if (chkM.ready && (qId === 'q_main_02_thaotinh' || def.type === 'main')) {
        turnInQuest(player, qId);
        updated = true;
      }
    }

    if (updated) {
      syncLegacy(player);
      var st = getStateAPI();
      if (st && st.savePlayer) st.savePlayer(player);
      refreshHUD();
    }
  }

  function onItemCollected(player, itemId, count) {
    if (!player) return;
    ensureQuestState(player);
    var qs = player.questState;
    var updated = false;

    for (var qId in qs.active) {
      var prog = qs.active[qId];
      var def = getQuestDef(qId);
      if (!def || !def.objectives) continue;

      for (var i = 0; i < def.objectives.length; i++) {
        var obj = def.objectives[i];
        if (obj.kind === 'collect_item' && obj.itemId === itemId) {
          checkObjectivesProgress(player, qId);
          updated = true;
        }
      }
      var chkI = checkObjectivesProgress(player, qId);
      if (chkI.ready && def.type === 'main') {
        turnInQuest(player, qId);
        updated = true;
      }
    }

    if (updated) {
      syncLegacy(player);
      var st = getStateAPI();
      if (st && st.savePlayer) st.savePlayer(player);
      refreshHUD();
    }
  }

  function onNpcTalked(player, npcId) {
    if (!player || !npcId) return;
    ensureQuestState(player);
    var qs = player.questState;
    var updated = false;

    // 1. Kiểm tra các quest đang active cần gặp NPC này
    for (var qId in qs.active) {
      var prog = qs.active[qId];
      var def = getQuestDef(qId);
      if (!def) continue;

      // Nếu quest đang readyToTurnIn và nơi trả là NPC này -> trả quest
      if (prog.readyToTurnIn && def.turnIn && def.turnIn.kind === 'npc' && def.turnIn.npcId === npcId) {
        turnInQuest(player, qId);
        updated = true;
        continue;
      }

      // Nếu quest có mục tiêu talk_npc với NPC này
      if (def.objectives) {
        for (var i = 0; i < def.objectives.length; i++) {
          var obj = def.objectives[i];
          if (obj.kind === 'talk_npc' && obj.npcId === npcId) {
            var oProg = prog.objectives[obj.id] || { current: 0, needed: 1, done: false };
            oProg.current = 1;
            oProg.done = true;
            prog.objectives[obj.id] = oProg;
            checkObjectivesProgress(player, qId);
            // Nếu là intro quest chỉ có 1 bước talk -> trả luôn
            if (def.type === 'sect_intro') {
              turnInQuest(player, qId);
            }
            updated = true;
          }
        }
      }
    }

    // 2. Kích hoạt nhận việc theo ngữ cảnh NPC nếu chưa nhận
    if (npcId === 'npc_linhnhi') {
      if (!isQuestCompleted(player, 'q_main_01_linhnhi') && !isQuestActive(player, 'q_main_01_linhnhi')) {
        acceptQuest(player, 'q_main_01_linhnhi');
        updated = true;
      }
    }

    if (updated) {
      syncLegacy(player);
      var st = getStateAPI();
      if (st && st.savePlayer) st.savePlayer(player);
      refreshHUD();
    }
  }

  function onTuViChanged(player) {
    if (!player) return;
    ensureQuestState(player);
    var qs = player.questState;
    var updated = false;

    for (var qId in qs.active) {
      var prog = qs.active[qId];
      var def = getQuestDef(qId);
      if (!def || !def.objectives) continue;

      for (var i = 0; i < def.objectives.length; i++) {
        var obj = def.objectives[i];
        if (obj.kind === 'min_tuvi') {
          checkObjectivesProgress(player, qId);
          if (prog.readyToTurnIn && def.type === 'main') {
            turnInQuest(player, qId);
            updated = true;
          }
        }
      }
    }

    if (updated) {
      syncLegacy(player);
      var st = getStateAPI();
      if (st && st.savePlayer) st.savePlayer(player);
      refreshHUD();
    }
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 2: CỐNG HIẾN TÔNG MÔN & CHỨC VỤ 4 BẬC (SECT CONTRIBUTION & RANKS)
  // ---------------------------------------------------------------------------

  var SECT_RANKS = [
    { rank: 1, name: 'Ngoại Môn Đệ Tử', minContribution: 0, minRealmRank: 0, desc: 'Đệ tử mới gia nhập sơn môn, mở Túi Trữ Vật.' },
    { rank: 2, name: 'Nội Môn Đệ Tử', minContribution: 100, minRealmRank: 4, desc: 'Đệ tử chính thức, mở đổi Thổ/Kim Nguyên Tán tại Chấp Sự Đường.' },
    { rank: 3, name: 'Chân Truyền Đệ Tử', minContribution: 300, minRealmRank: 7, desc: 'Đệ tử chân truyền, giảm 20% phí đổi Nguyên Tán.' },
    { rank: 4, name: 'Chấp Sự', minContribution: 800, minRealmRank: 10, desc: 'Chấp sự sơn môn, nhận việc treo thưởng săn boss nguy hiểm.' }
  ];

  function getSectRankInfo(rankNumber) {
    for (var i = 0; i < SECT_RANKS.length; i++) {
      if (SECT_RANKS[i].rank === rankNumber) return SECT_RANKS[i];
    }
    return SECT_RANKS[0];
  }

  function checkSectRankUp(player) {
    if (!player) return false;
    ensureQuestState(player);
    var sect = player.questState.sect;
    var realmRank = getRealmRank(player);
    var curRank = sect.rank || 1;

    var nextRank = curRank;
    for (var i = 0; i < SECT_RANKS.length; i++) {
      var rDef = SECT_RANKS[i];
      if (rDef.rank > curRank) {
        if (sect.lifetimeContribution >= rDef.minContribution && realmRank >= rDef.minRealmRank) {
          nextRank = rDef.rank;
        }
      }
    }

    if (nextRank > curRank) {
      sect.rank = nextRank;
      sect.rankName = getSectRankInfo(nextRank).name;
      playChime();
      showToast('Chúc mừng! Bạn đã thăng cấp chức vụ: ' + sect.rankName + '!');
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // TIỆM CỐNG HIẾN & ĐỔI NGUYÊN TÁN (SECT SHOP)
  // ---------------------------------------------------------------------------

  var SECT_SHOP_CATALOG = [
    {
      itemId: 'tho-nguyen-tan',
      name: 'Thổ Nguyên Tán',
      minSectRank: 2,
      baseContribution: 50,
      baseLinhThach: 20,
      desc: 'Nguyên liệu luyện Trúc Cơ Đan (Hồ sơ 02§3.1). Cần chức vụ Nội Môn trở lên.'
    },
    {
      itemId: 'kim-nguyen-tan',
      name: 'Kim Nguyên Tán',
      minSectRank: 2,
      baseContribution: 50,
      baseLinhThach: 20,
      desc: 'Nguyên liệu luyện Trúc Cơ Đan (Hồ sơ 02§3.1). Cần chức vụ Nội Môn trở lên.'
    },
    {
      itemId: 'tui-tru-vat',
      name: 'Túi Trữ Vật (60 ô)',
      minSectRank: 1,
      baseContribution: 30,
      baseLinhThach: 50,
      desc: 'Vật chứa trữ vật 60 ô tiêu chuẩn của tông môn.'
    }
  ];

  function getSectShopItems(player) {
    if (!player) return [];
    ensureQuestState(player);
    var sect = player.questState.sect || { rank: 1, contribution: 0 };
    var hasDiscount = (sect.rank >= 3);

    return SECT_SHOP_CATALOG.map(function (it) {
      var costContrib = hasDiscount ? Math.round(it.baseContribution * 0.8) : it.baseContribution;
      var canBuy = (sect.rank >= it.minSectRank) &&
                   ((sect.contribution || 0) >= costContrib) &&
                   ((player.linhThach || 0) >= it.baseLinhThach);
      var lockReason = '';
      if (sect.rank < it.minSectRank) {
        lockReason = 'Cần chức vụ ' + getSectRankInfo(it.minSectRank).name;
      } else if ((sect.contribution || 0) < costContrib) {
        lockReason = 'Thiếu ' + (costContrib - (sect.contribution || 0)) + ' điểm cống hiến';
      } else if ((player.linhThach || 0) < it.baseLinhThach) {
        lockReason = 'Thiếu ' + (it.baseLinhThach - (player.linhThach || 0)) + ' Linh Thạch';
      }

      return {
        itemId: it.itemId,
        name: it.name,
        desc: it.desc,
        minSectRank: it.minSectRank,
        baseContribution: it.baseContribution,
        costContribution: costContrib,
        costLinhThach: it.baseLinhThach,
        hasDiscount: hasDiscount,
        canBuy: canBuy,
        lockReason: lockReason
      };
    });
  }

  function buySectShopItem(player, itemId) {
    if (!player) return { ok: false, msg: 'Không tìm thấy người chơi.' };
    ensureQuestState(player);
    var sect = player.questState.sect;

    var shopDef = null;
    for (var i = 0; i < SECT_SHOP_CATALOG.length; i++) {
      if (SECT_SHOP_CATALOG[i].itemId === itemId) {
        shopDef = SECT_SHOP_CATALOG[i];
        break;
      }
    }
    if (!shopDef) return { ok: false, msg: 'Vật phẩm không có trong tiệm cống hiến.' };

    var curRank = (sect.rank || 1);
    if (curRank < shopDef.minSectRank) {
      return { ok: false, reason: 'rank_low', msg: 'Cần đạt chức vụ ' + getSectRankInfo(shopDef.minSectRank).name + ' trở lên.' };
    }

    var costContrib = (curRank >= 3) ? Math.round(shopDef.baseContribution * 0.8) : shopDef.baseContribution;
    var costLT = shopDef.baseLinhThach;

    if ((sect.contribution || 0) < costContrib) {
      return { ok: false, reason: 'contrib_low', msg: 'Không đủ Điểm Cống Hiến (cần ' + costContrib + ' điểm, hiện có ' + (sect.contribution || 0) + ').' };
    }
    if ((player.linhThach || 0) < costLT) {
      return { ok: false, reason: 'lt_low', msg: 'Không đủ Linh Thạch (cần ' + costLT + ' Linh Thạch, hiện có ' + (player.linhThach || 0) + ').' };
    }

    var st = getStateAPI();
    var mAPI = getMonstersAPI();
    if (!st || !st.addItemToBag) {
      return { ok: false, msg: 'GameState chưa sẵn sàng.' };
    }

    // Trừ tài nguyên
    sect.contribution -= costContrib;
    player.linhThach -= costLT;

    // Thêm vật phẩm vào túi
    st.addItemToBag(player, itemId, 1, mAPI ? mAPI.ITEM_DEFS : undefined);

    playChime();
    showToast('Đổi thành công 1 ' + shopDef.name + '!');
    refreshHUD();

    if (st.savePlayer) st.savePlayer(player);

    return { ok: true, itemId: itemId, msg: 'Đổi thành công 1 ' + shopDef.name + '!', costContribution: costContrib, costLinhThach: costLT };
  }

  /**
   * Đổi điểm cống hiến lấy Nguyên Tán theo Hồ sơ 02§3.1 (alias tiện lợi)
   * @param {Object} player
   * @param {'tho-nguyen-tan'|'kim-nguyen-tan'} itemId
   */
  function exchangeNguyenTan(player, itemId) {
    return buySectShopItem(player, itemId);
  }

  // ---------------------------------------------------------------------------
  // XUẤT API TOÀN CỤC
  // ---------------------------------------------------------------------------

  var QuestsAPI = {
    QUEST_DEFS: QUEST_DEFS,
    SECT_RANKS: SECT_RANKS,
    ensureQuestState: ensureQuestState,
    migrateFromLegacy: migrateFromLegacy,
    syncLegacy: syncLegacy,
    getQuestDef: getQuestDef,
    getAllQuestDefs: getAllQuestDefs,
    isQuestActive: isQuestActive,
    isQuestCompleted: isQuestCompleted,
    getActiveQuests: getActiveQuests,
    canAcceptQuest: canAcceptQuest,
    acceptQuest: acceptQuest,
    abandonQuest: abandonQuest,
    canTurnInQuest: canTurnInQuest,
    turnInQuest: turnInQuest,
    checkObjectivesProgress: checkObjectivesProgress,
    setTracked: setTracked,
    setPinned: setPinned,
    getTrackedQuests: getTrackedQuests,
    getPinnedQuest: getPinnedQuest,
    getTrackedTargetInfo: getTrackedTargetInfo,
    onMonsterKilled: onMonsterKilled,
    onItemCollected: onItemCollected,
    onNpcTalked: onNpcTalked,
    onTuViChanged: onTuViChanged,
    getSectRankInfo: getSectRankInfo,
    checkSectRankUp: checkSectRankUp,
    exchangeNguyenTan: exchangeNguyenTan,
    isQuestOnCooldown: isQuestOnCooldown,
    getBoardQuests: getBoardQuests,
    getSectShopItems: getSectShopItems,
    buySectShopItem: buySectShopItem
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestsAPI;
  }
  if (typeof window !== 'undefined') {
    window.GameQuests = QuestsAPI;
  }
  if (typeof global !== 'undefined') {
    global.GameQuests = QuestsAPI;
  }
})(typeof window !== 'undefined' ? window : this);
