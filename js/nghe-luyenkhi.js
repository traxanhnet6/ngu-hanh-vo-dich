/**
 * nghe-luyenkhi.js — Đợt N1: Nghề Sinh Nhai + Luyện Khí/Bản Vẽ
 *
 * 1. 4 nghề sinh nhai có cấp: đốn củi, đào khoáng, hái thuốc, câu cá.
 * 2. Lò rèn + ván 4 bước tay (chung khung D2): hỏa hầu, thao thiết, tôi luyện, khai phong.
 *    Nguyên liệu quyết định dòng thuộc tính, thành phẩm KÝ TÊN người rèn (crafter).
 * 3. Sổ Luyện Khí: học bản vẽ, phẩm trần theo bản vẽ, độ thông thạo, rèn nhanh.
 * 4. 4 thao tác trang bị: Tinh luyện (+1..+10), Tẩy luyện, Phân giải, Truyền thừa.
 * 5. Bảng đơn đặt hàng NPC: NPC đặt hàng, giao hàng nhận thưởng.
 *
 * Node-loadable & Trình duyệt.
 */
(function (exports) {
  'use strict';

  // ==========================================================================
  // HẰNG SỐ & DỮ LIỆU ĐỊNH NGHĨA (PROVISIONAL — chờ Bui duyệt)
  // ==========================================================================

  // 1. 4 Nghề sinh nhai
  var PROFESSIONS = {
    woodcutting: { id: 'woodcutting', name: 'Đốn Củi', verb: 'đốn củi', maxLevel: 5, icon: 'wood' },
    mining:      { id: 'mining',      name: 'Đào Khoáng', verb: 'đào khoáng', maxLevel: 5, icon: 'mine' },
    herbalism:   { id: 'herbalism',   name: 'Hái Thuốc', verb: 'hái thuốc', maxLevel: 5, icon: 'herb' },
    fishing:     { id: 'fishing',     name: 'Câu Cá', verb: 'câu cá', maxLevel: 5, icon: 'fish' }
  };

  // Ngưỡng EXP lên cấp cho mỗi nghề (PROVISIONAL)
  var EXP_THRESHOLDS = {
    1: 100,  // Cấp 1 -> 2
    2: 250,  // Cấp 2 -> 3
    3: 500,  // Cấp 3 -> 4
    4: 1000, // Cấp 4 -> 5
    5: 999999
  };

  // Danh mục điểm hành nghề đặt trên map thật.
  // HỘI TỤ TÍCH HỢP (2026-11-13): 6 điểm đã dời khỏi vị trí gốc của N1 để
  // qua cổng an toàn V1 (hazard >=150px) + cổng chặng 6 (điểm hái >=150px),
  // giữ nguyên tên/cấp/vật rơi — tọa độ đối chiếu trong js/mapdata.js:
  // gather_fish_mieu_1 (320,880)->(250,860); gather_fish_rd_1
  // (1350,920)->(1360,960); gather_mine_ml_1 (620,480)->(640,500);
  // gather_mine_ml_2 (1450,680)->(1440,700); gather_mine_kt_1
  // (520,620)->(440,760); gather_fish_hb_1 (920,780)->(140,680).
  var GATHER_NODES = [
    // Miếu Hoang
    { id: 'gather_wood_mieu_1', profId: 'woodcutting', name: 'Cây Khô Miếu Hoang', mapId: 'mieu_hoang', x: 480, y: 720, reqLevel: 1, respawnSec: 60, expGain: 20, drops: [{ itemId: 'canh-go-muc', count: 1, chance: 1.0 }] },
    { id: 'gather_mine_mieu_1', profId: 'mining', name: 'Vỉa Đồng Miếu Hoang', mapId: 'mieu_hoang', x: 1050, y: 350, reqLevel: 1, respawnSec: 60, expGain: 20, drops: [{ itemId: 'quang-dong-tho', count: 1, chance: 1.0 }] },
    // HỘI TỤ TÍCH HỢP (2026-11-13): dời từ (320,880) -> (250,860) vì chồng
    // cổng cách ly 90px với điểm hái harvest_mh_1 (350,950) của đợt lưới
    // linh dược (cũ chỉ 76px). Điểm mới: đi lại được, cách mh_1 134px, cách
    // điểm đốn củi 269px. Giữ nguyên tên/vật rơi.
    { id: 'gather_fish_mieu_1', profId: 'fishing', name: 'Bờ Suối Miếu Hoang', mapId: 'mieu_hoang', x: 250, y: 860, reqLevel: 1, respawnSec: 60, expGain: 20, drops: [{ itemId: 'ca-linh-ngu', count: 1, chance: 1.0 }] },
    // Rừng Độc
    { id: 'gather_wood_rd_1', profId: 'woodcutting', name: 'Thiết Mộc Rừng Độc', mapId: 'rung-doc', x: 820, y: 550, reqLevel: 2, respawnSec: 75, expGain: 35, drops: [{ itemId: 'go-thiet-moc', count: 1, chance: 0.8 }, { itemId: 'canh-go-muc', count: 2, chance: 0.5 }] },
    // Đợt N1FIX (§8.3): điểm cấp 3 duy nhất rơi Gỗ Trầm Hương — tọa độ đã
    // đo: ô đi lại được, cách điểm hái gần nhất 234px, cách điểm gỗ cũ 284px.
    { id: 'gather_wood_rd_2', profId: 'woodcutting', name: 'Trầm Hương Cổ Thụ', mapId: 'rung-doc', x: 1100, y: 600, reqLevel: 3, respawnSec: 120, expGain: 55, drops: [{ itemId: 'go-tram-huong', count: 1, chance: 0.5 }, { itemId: 'go-thiet-moc', count: 1, chance: 0.6 }] },
    { id: 'gather_fish_rd_1', profId: 'fishing', name: 'Đầm Nước Rừng Độc', mapId: 'rung-doc', x: 1360, y: 960, reqLevel: 2, respawnSec: 75, expGain: 35, drops: [{ itemId: 'ca-linh-ngu', count: 2, chance: 0.8 }, { itemId: 'ca-han-bang', count: 1, chance: 0.4 }] },
    // Tông Môn
    { id: 'gather_wood_tm_1', profId: 'woodcutting', name: 'Cây Rừng Tông Môn', mapId: 'tong-mon', x: 350, y: 850, reqLevel: 1, respawnSec: 60, expGain: 25, drops: [{ itemId: 'canh-go-muc', count: 2, chance: 0.9 }, { itemId: 'go-thiet-moc', count: 1, chance: 0.3 }] },
    { id: 'gather_fish_tm_1', profId: 'fishing', name: 'Hồ Bích Thủy Tông Môn', mapId: 'tong-mon', x: 650, y: 1120, reqLevel: 1, respawnSec: 60, expGain: 25, drops: [{ itemId: 'ca-linh-ngu', count: 2, chance: 0.9 }, { itemId: 'ca-han-bang', count: 1, chance: 0.3 }] },
    // Mỏ Lửa
    { id: 'gather_mine_ml_1', profId: 'mining', name: 'Mỏ Sắt Huyền Xích Diệm', mapId: 'mo-lua', x: 640, y: 500, reqLevel: 2, respawnSec: 90, expGain: 40, drops: [{ itemId: 'quang-sat-huyen', count: 1, chance: 0.85 }, { itemId: 'da-nung', count: 1, chance: 0.5 }] },
    // Đợt N1 tiếp nối (Muse): điểm thiết kế §3.3 còn thiếu — Vỉa Địa Hỏa Thiết.
    { id: 'gather_mine_ml_2', profId: 'mining', name: 'Vỉa Địa Hỏa Thiết', mapId: 'mo-lua', x: 1440, y: 700, reqLevel: 2, respawnSec: 90, expGain: 40, drops: [{ itemId: 'quang-sat-huyen', count: 1, chance: 0.85 }, { itemId: 'tinh-thiet-tho', count: 1, chance: 0.4 }] },
    // Kiếm Trủng
    { id: 'gather_mine_kt_1', profId: 'mining', name: 'Vỉa Tinh Thiết Kiếm Trủng', mapId: 'kiem-trung', x: 440, y: 760, reqLevel: 3, respawnSec: 120, expGain: 55, drops: [{ itemId: 'tinh-thiet-tho', count: 1, chance: 0.8 }, { itemId: 'quang-sat-huyen', count: 2, chance: 0.6 }] },
    // Hồ Băng
    { id: 'gather_fish_hb_1', profId: 'fishing', name: 'Lỗ Băng Hàn Kính', mapId: 'ho-bang', x: 140, y: 680, reqLevel: 3, respawnSec: 120, expGain: 55, drops: [{ itemId: 'ca-han-bang', count: 2, chance: 0.85 }, { itemId: 'vay-ca-linh', count: 1, chance: 0.5 }] }
  ];

  // 2. Sổ Bản Vẽ Luyện Khí (Blueprints)
  var BLUEPRINTS = {
    'bp_kiem_thanh_bo': {
      id: 'bp_kiem_thanh_bo',
      name: 'Bản vẽ Kiếm Thanh Bố',
      slot: 'weapon',
      tier: 1,
      targetItemId: 'thanh-bo-kiem',
      targetName: 'Kiếm Thanh Bố',
      maxQuality: 'thuong', // Trần phẩm chất của bản vẽ: hạ, trung, thuong, cuc
      reqMaterials: [
        { itemId: 'quang-dong-tho', count: 3 },
        { itemId: 'canh-go-muc', count: 2 }
      ],
      costLt: 10,
      desc: 'Bản vẽ rèn kiếm gỗ bọc đồng sơ cấp cho đệ tử Luyện Khí.'
    },
    'bp_ao_thanh_bo': {
      id: 'bp_ao_thanh_bo',
      name: 'Bản vẽ Áo Thanh Bố',
      slot: 'armor',
      tier: 1,
      targetItemId: 'thanh-bo-ao',
      targetName: 'Áo Thanh Bố',
      maxQuality: 'thuong',
      reqMaterials: [
        { itemId: 'canh-go-muc', count: 4 },
        { itemId: 'quang-dong-tho', count: 1 }
      ],
      costLt: 10,
      desc: 'Bản vẽ may dệt đạo bào sơ cấp với nẹp gỗ nhẹ.'
    },
    'bp_giay_thanh_bo': {
      id: 'bp_giay_thanh_bo',
      name: 'Bản vẽ Giày Thanh Bố',
      slot: 'shoes',
      tier: 1,
      targetItemId: 'thanh-bo-giay',
      targetName: 'Giày Thanh Bố',
      maxQuality: 'thuong',
      reqMaterials: [
        { itemId: 'canh-go-muc', count: 2 },
        { itemId: 'quang-dong-tho', count: 2 }
      ],
      costLt: 10,
      desc: 'Bản vẽ giày cỏ viền đồng nhẹ nhàng linh hoạt.'
    },
    'bp_dai_thanh_bo': {
      id: 'bp_dai_thanh_bo',
      name: 'Bản vẽ Đai Thanh Bố',
      slot: 'belt',
      tier: 1,
      targetItemId: 'thanh-bo-dai',
      targetName: 'Đai Thanh Bố',
      maxQuality: 'thuong',
      reqMaterials: [
        { itemId: 'quang-dong-tho', count: 2 },
        { itemId: 'canh-go-muc', count: 1 }
      ],
      costLt: 10,
      desc: 'Bản vẽ đai lưng bện dây gai khóa đồng sơ cấp.'
    },
    'bp_phap_khi_dong': {
      id: 'bp_phap_khi_dong',
      name: 'Bản vẽ Bát Quái Kính Đồng',
      slot: 'phapKhi',
      tier: 1,
      targetItemId: 'thanh-bo-phap-khi',
      targetName: 'Kính Đồng Thanh Bố',
      maxQuality: 'thuong',
      reqMaterials: [
        { itemId: 'quang-dong-tho', count: 4 },
        { itemId: 'la-thanh-tuy', count: 2 }
      ],
      costLt: 20,
      desc: 'Pháp khí gương đồng tụ khí trấn áp tà khí.'
    },
    'bp_kiem_truc_van': {
      id: 'bp_kiem_truc_van',
      name: 'Bản vẽ Trúc Văn Kiếm',
      slot: 'weapon',
      tier: 2,
      targetItemId: 'truc-van-kiem',
      targetName: 'Trúc Văn Kiếm',
      maxQuality: 'cuc',
      reqMaterials: [
        { itemId: 'quang-sat-huyen', count: 4 },
        { itemId: 'go-thiet-moc', count: 2 }
      ],
      costLt: 40,
      desc: 'Bản vẽ rèn bảo kiếm sắc bén khắc hoa văn trúc xanh mướt.'
    },
    'bp_giap_truc_van': {
      id: 'bp_giap_truc_van',
      name: 'Bản vẽ Trúc Văn Giáp',
      slot: 'armor',
      tier: 2,
      targetItemId: 'truc-van-ao',
      targetName: 'Trúc Văn Giáp',
      maxQuality: 'cuc',
      reqMaterials: [
        { itemId: 'go-thiet-moc', count: 5 },
        { itemId: 'quang-sat-huyen', count: 3 }
      ],
      costLt: 40,
      desc: 'Bản vẽ rèn giáp trúc thiết mộc bền bỉ chắn đòn uy mãnh.'
    }
  };

  var QUALITY_RANKS = {
    ha:     { rank: 0, name: 'Hạ phẩm',     affixCount: 0, statMultiplier: 1.0 },
    trung:  { rank: 1, name: 'Trung phẩm',  affixCount: 1, statMultiplier: 1.15 },
    thuong: { rank: 2, name: 'Thượng phẩm', affixCount: 2, statMultiplier: 1.35 },
    cuc:    { rank: 3, name: 'Cực phẩm',    affixCount: 3, statMultiplier: 1.6 }
  };

  // Ngũ hành nguyên liệu quyết định dòng thuộc tính (Affixes)
  var ELEMENTAL_AFFIXES = {
    kim: [
      { id: 'affix_atk', name: 'Công Kích', type: 'atk', min: 2, max: 6, unit: '' },
      { id: 'affix_crit', name: 'Tỉ Lệ Bạo Kích', type: 'crit', min: 2, max: 5, unit: '%' }
    ],
    moc: [
      { id: 'affix_hp', name: 'Khí Huyết', type: 'hp', min: 15, max: 40, unit: '' },
      { id: 'affix_hpregen', name: 'Hồi Phục Khí Huyết', type: 'hpRegen', min: 1, max: 3, unit: '/s' }
    ],
    thuy: [
      { id: 'affix_mp', name: 'Linh Lực', type: 'linhLuc', min: 10, max: 25, unit: '' },
      { id: 'affix_dodge', name: 'Né Tránh', type: 'dodge', min: 2, max: 5, unit: '%' }
    ],
    hoa: [
      { id: 'affix_pierce', name: 'Xuyên Giáp', type: 'pierce', min: 2, max: 5, unit: '' },
      { id: 'affix_firedmg', name: 'Hỏa Thương', type: 'fireDmg', min: 3, max: 8, unit: '' }
    ],
    tho: [
      { id: 'affix_def', name: 'Phòng Ngự', type: 'def', min: 2, max: 6, unit: '' },
      { id: 'affix_block', name: 'Giảm Thương', type: 'block', min: 1, max: 4, unit: '' }
    ]
  };

  // Ánh xạ nguyên liệu -> hệ ngũ hành
  var MATERIAL_ELEMENTS = {
    'quang-dong-tho': 'kim',
    'quang-sat-huyen': 'kim',
    'tinh-thiet-tho': 'kim',
    'canh-go-muc': 'moc',
    'go-thiet-moc': 'moc',
    'go-tram-huong': 'moc',
    'la-thanh-tuy': 'moc',
    'hoa-giai-doc': 'moc',
    'ca-linh-ngu': 'thuy',
    'ca-han-bang': 'thuy',
    'vay-ca-linh': 'thuy',
    'bang-tinh': 'thuy',
    'da-nung': 'hoa',
    'hoa-tinh-tho': 'hoa',
    'cat-tinh': 'tho'
  };

  // 3. Danh mục đơn đặt hàng NPC mẫu (PROVISIONAL)
  var DEFAULT_NPC_ORDERS = [
    {
      id: 'order_duoc_su_1',
      npcId: 'npc_duocsu',
      npcName: 'Dược Sư',
      title: 'Thu thập Dược Thảo',
      desc: 'Dược phòng thiếu Lá Thanh Tụy để nấu thang thuốc cứu chữa đệ tử.',
      reqItemId: 'la-thanh-tuy',
      reqCount: 5,
      reqMinQuality: null,
      rewardLt: 30,
      rewardExp: { profId: 'herbalism', amount: 40 },
      rewardItemId: 'da-tay-luyen',
      rewardItemCount: 1
    },
    {
      id: 'order_thuong_nhan_1',
      npcId: 'npc_thuongnhan',
      npcName: 'Thương Nhân',
      title: 'Thu mua Gỗ Khô',
      desc: 'Thương hội cần một lượng Cành Gỗ Mục gia cố xe chở hàng.',
      reqItemId: 'canh-go-muc',
      reqCount: 6,
      reqMinQuality: null,
      rewardLt: 35,
      rewardExp: { profId: 'woodcutting', amount: 50 },
      rewardItemId: null,
      rewardItemCount: 0
    },
    {
      id: 'order_chap_su_1',
      npcId: 'npc_chapsu',
      npcName: 'Chấp Sự',
      title: 'Quặng Đồng Rèn Binh Khí',
      desc: 'Tông môn rèn vũ khí phòng thủ, cần quặng đồng thô sạch tạp chất.',
      reqItemId: 'quang-dong-tho',
      reqCount: 5,
      reqMinQuality: null,
      rewardLt: 40,
      rewardExp: { profId: 'mining', amount: 50 },
      rewardItemId: 'quang-sat-huyen',
      rewardItemCount: 1
    },
    {
      // Đợt N1 tiếp nối (Muse): đơn thiết kế §7.2 còn thiếu — Trưởng Lão đặt Hàn Ngư.
      id: 'order_truong_lao_1',
      npcId: 'npc_truonglao',
      npcName: 'Trưởng Lão',
      title: 'Hàn Ngư Bồi Bổ',
      desc: 'Trưởng Lão cần Cá Hàn Băng bồi bổ linh lực sau buổi giảng đạo.',
      reqItemId: 'ca-han-bang',
      reqCount: 3,
      reqMinQuality: null,
      rewardLt: 50,
      rewardExp: { profId: 'fishing', amount: 80 },
      rewardItemId: null,
      rewardItemCount: 0
    },
    {
      id: 'order_tuan_thu_1',
      npcId: 'npc_tuan_thu_su',
      npcName: 'Tuần Thú Sư',
      title: 'Cá Linh Ngư Tươi',
      desc: 'Đàn linh thú non cần cá tươi hồi phục linh tính sau huấn luyện.',
      reqItemId: 'ca-linh-ngu',
      reqCount: 4,
      reqMinQuality: null,
      rewardLt: 35,
      rewardExp: { profId: 'fishing', amount: 45 },
      rewardItemId: 'da-tay-luyen',
      rewardItemCount: 1
    },
    {
      id: 'order_tiep_dan_1',
      npcId: 'npc_tiepdan',
      npcName: 'Tiếp Dẫn Đạo Nhân',
      title: 'Binh Khí Cho Đệ Tử Mới',
      desc: 'Cần một thanh Kiếm Thanh Bố rèn chắc tay để ban thưởng cho đệ tử nhập môn.',
      reqItemId: 'thanh-bo-kiem',
      reqCount: 1,
      reqMinQuality: 'ha',
      rewardLt: 60,
      rewardExp: { profId: 'mining', amount: 30 },
      rewardItemId: 'bp_giay_thanh_bo',
      rewardItemCount: 1
    },
    // Đợt N1FIX (§8.2): nguồn cho 4 bản vẽ chưa có nguồn. Số PROVISIONAL.
    // Hai đơn bậc Trúc Văn đòi đồ rèn có phẩm tối thiểu — cổng tiến trình.
    {
      id: 'order_thuong_nhan_2',
      npcId: 'npc_thuongnhan',
      npcName: 'Thương Nhân',
      title: 'Thu mua Thiết Mộc',
      desc: 'Thương hội đóng xe chở hàng mới, cần Thiết Mộc đanh cứng làm khung.',
      reqItemId: 'go-thiet-moc',
      reqCount: 6,
      reqMinQuality: null,
      rewardLt: 45,
      rewardExp: { profId: 'woodcutting', amount: 60 },
      rewardItemId: 'bp_dai_thanh_bo',
      rewardItemCount: 1
    },
    {
      id: 'order_duoc_su_2',
      npcId: 'npc_duocsu',
      npcName: 'Dược Sư',
      title: 'Linh Chi Luyện Kính',
      desc: 'Dược phòng cần Linh Chi Rừng để tôi linh khí cho Kính Đồng trấn tà.',
      reqItemId: 'linh-chi-rung',
      reqCount: 4,
      reqMinQuality: null,
      rewardLt: 50,
      rewardExp: { profId: 'herbalism', amount: 60 },
      rewardItemId: 'bp_phap_khi_dong',
      rewardItemCount: 1
    },
    {
      id: 'order_chap_su_2',
      npcId: 'npc_chapsu',
      npcName: 'Chấp Sự',
      title: 'Áo Giáp Cho Hộ Vệ',
      desc: 'Đội hộ vệ tông môn cần một chiếc Áo Thanh Bố rèn chắc (Trung phẩm trở lên).',
      reqItemId: 'thanh-bo-ao',
      reqCount: 1,
      reqMinQuality: 'trung',
      rewardLt: 80,
      rewardExp: { profId: 'mining', amount: 60 },
      rewardItemId: 'bp_kiem_truc_van',
      rewardItemCount: 1
    },
    {
      id: 'order_truong_lao_2',
      npcId: 'npc_truonglao',
      npcName: 'Trưởng Lão',
      title: 'Kiếm Tốt Ban Đệ Tử',
      desc: 'Trưởng Lão muốn một thanh Kiếm Thanh Bố rèn tinh xảo (Thượng phẩm trở lên) để ban cho đệ tử xuất sắc.',
      reqItemId: 'thanh-bo-kiem',
      reqCount: 1,
      reqMinQuality: 'thuong',
      rewardLt: 100,
      rewardExp: { profId: 'mining', amount: 80 },
      rewardItemId: 'bp_giap_truc_van',
      rewardItemCount: 1
    }
  ];

  // ==========================================================================
  // TIỆN ÍCH TRUY XUẤT MODULE KHÁC
  // ==========================================================================
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

  function getTuiKhoAPI() {
    if (typeof window !== 'undefined' && window.GameTuiKho) return window.GameTuiKho;
    if (typeof global !== 'undefined' && global.GameTuiKho) return global.GameTuiKho;
    try { return require('./tui-kho.js'); } catch (e) { return null; }
  }

  function getItemDef(itemId) {
    var m = getMonstersAPI();
    if (m && m.ITEM_DEFS && m.ITEM_DEFS[itemId]) return m.ITEM_DEFS[itemId];
    return null;
  }

  function countBagItem(player, itemId) {
    var tk = getTuiKhoAPI();
    if (tk && tk.countItemInPlayer) return tk.countItemInPlayer(player, itemId);
    var st = getStateAPI();
    if (st && st.countItemInBag) return st.countItemInBag(player, itemId);
    if (!player || !player.bag || !Array.isArray(player.bag.slots)) return 0;
    var total = 0;
    for (var i = 0; i < player.bag.slots.length; i++) {
      var s = player.bag.slots[i];
      if (s && s.itemId === itemId) total += (s.count || 1);
    }
    return total;
  }

  function removeBagItem(player, itemId, count) {
    var cnt = count || 1;
    var tk = getTuiKhoAPI();
    if (tk && tk.removeItemFromPlayer) return tk.removeItemFromPlayer(player, itemId, cnt);
    var st = getStateAPI();
    if (st && st.removeItemFromBag) return st.removeItemFromBag(player, itemId, cnt);
    if (!player || !player.bag || !Array.isArray(player.bag.slots)) return false;
    for (var i = 0; i < player.bag.slots.length; i++) {
      var s = player.bag.slots[i];
      if (s && s.itemId === itemId) {
        if ((s.count || 1) <= cnt) {
          cnt -= (s.count || 1);
          player.bag.slots[i] = null;
        } else {
          s.count -= cnt;
          cnt = 0;
        }
        if (cnt <= 0) return true;
      }
    }
    return cnt <= 0;
  }

  function addBagItem(player, itemId, count, extra) {
    var cnt = count || 1;
    var tk = getTuiKhoAPI();
    if (tk && tk.addItemToPlayer) {
      var res = tk.addItemToPlayer(player, itemId, cnt);
      if (res && res.success && extra && res.containerId && typeof res.slot === 'number') {
        var c = player.tuiKho && player.tuiKho.containers && player.tuiKho.containers[res.containerId];
        if (c && c.slots && c.slots[res.slot]) {
          for (var k in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, k)) {
              c.slots[res.slot][k] = extra[k];
            }
          }
        }
      }
      return res;
    }
    var st = getStateAPI();
    if (st && st.addItemToBag) {
      return st.addItemToBag(player, itemId, cnt);
    }
    return { success: false, reason: 'no_bag_api' };
  }

  // --- Đếm / trừ vật phẩm theo phẩm chất tối thiểu (đơn hàng trang bị) ---
  // Đợt N1 tiếp nối (Muse): bản Antigravity bỏ qua reqMinQuality — đơn đòi
  // trang bị phẩm cao vẫn nhận đồ phẩm thấp, và removeBagItem có thể trừ
  // nhầm chiếc phẩm thấp. Trang bị không ghi phẩm được tính như Hạ phẩm.
  function qualityRankOf(quality) {
    var q = QUALITY_RANKS[quality];
    return q ? q.rank : 0;
  }

  function slotQualityRank(slot) {
    if (!slot) return 0;
    return qualityRankOf(slot.quality || 'ha');
  }

  function eachCarriedSlot(player, fn) {
    if (!player) return;
    var tk = player.tuiKho;
    if (tk && tk.containers) {
      var tkApi = getTuiKhoAPI();
      var ids = null;
      if (tkApi && tkApi.carriedContainerIds) {
        try { ids = tkApi.carriedContainerIds(player); } catch (e) { ids = null; }
      }
      if (!ids) {
        ids = [];
        for (var cid in tk.containers) {
          if (Object.prototype.hasOwnProperty.call(tk.containers, cid) && cid !== tk.tempChestId) ids.push(cid);
        }
      }
      for (var i = 0; i < ids.length; i++) {
        var c = tk.containers[ids[i]];
        if (!c || !Array.isArray(c.slots)) continue;
        for (var j = 0; j < c.slots.length; j++) {
          fn(ids[i], j, c.slots[j]);
        }
      }
      return;
    }
    if (player.bag && Array.isArray(player.bag.slots)) {
      for (var k = 0; k < player.bag.slots.length; k++) {
        fn(null, k, player.bag.slots[k]);
      }
    }
  }

  function countQualifiedItems(player, itemId, minQuality) {
    if (!minQuality) return countBagItem(player, itemId);
    var need = qualityRankOf(minQuality);
    var total = 0;
    eachCarriedSlot(player, function (cid, idx, s) {
      if (s && s.itemId === itemId && slotQualityRank(s) >= need) total += 1;
    });
    return total;
  }

  function removeQualifiedItems(player, itemId, count, minQuality) {
    if (!minQuality) return removeBagItem(player, itemId, count);
    var need = qualityRankOf(minQuality);
    var remaining = count || 1;
    var tk = player && player.tuiKho;
    if (tk && tk.containers) {
      eachCarriedSlot(player, function (cid, idx, s) {
        if (remaining <= 0) return;
        if (s && s.itemId === itemId && slotQualityRank(s) >= need) {
          tk.containers[cid].slots[idx] = null;
          remaining -= 1;
        }
      });
      return remaining <= 0;
    }
    if (player && player.bag && Array.isArray(player.bag.slots)) {
      for (var i = 0; i < player.bag.slots.length && remaining > 0; i++) {
        var s2 = player.bag.slots[i];
        if (s2 && s2.itemId === itemId && slotQualityRank(s2) >= need) {
          player.bag.slots[i] = null;
          remaining -= 1;
        }
      }
      return remaining <= 0;
    }
    return false;
  }

  // ==========================================================================
  // 1. STATE & HỒI TỐ SAVE CŨ
  // ==========================================================================
  // Chuỗi ngày theo đúng quy ước gieo sẵn có (ngày UTC — ngày mới bắt đầu
  // lúc 07:00 giờ Việt Nam; giữ nhất quán, không đổi quy ước giữa chừng).
  function todayDateString() {
    return new Date().toISOString().slice(0, 10);
  }

  // Đợt N1FIX (§8.2): chỉ BỔ SUNG đơn mặc định còn thiếu (so theo id) —
  // không xóa, không đặt lại cờ completed của đơn đã có.
  function syncDefaultOrders(player) {
    var no = player.npcOrders;
    if (!no || !Array.isArray(no.orders)) return;
    var seen = {};
    for (var i = 0; i < no.orders.length; i++) {
      if (no.orders[i] && no.orders[i].id) seen[no.orders[i].id] = true;
    }
    for (var j = 0; j < DEFAULT_NPC_ORDERS.length; j++) {
      var def = DEFAULT_NPC_ORDERS[j];
      if (!seen[def.id]) {
        no.orders.push(Object.assign({}, def, { completed: false }));
      }
    }
  }

  // Đợt N1FIX (§8.4): sang ngày mới thì dựng lại toàn bộ đơn (đơn là dữ
  // liệu tĩnh nên đơn chưa giao cũng giống hệt bản dựng lại), giữ nguyên
  // completedTotal. Việc làm mới chạy trong ensureState; hàm này chỉ báo
  // cáo có làm mới hay không (so ngày trước/sau).
  function refreshOrdersIfNewDay(player) {
    var before = (player && player.npcOrders && typeof player.npcOrders.lastRefreshDate === 'string')
      ? player.npcOrders.lastRefreshDate : null;
    ensureState(player);
    var after = player.npcOrders.lastRefreshDate;
    return { refreshed: before !== null && before !== after };
  }

  function ensureState(player) {
    if (!player) return null;

    // 1.1 4 Nghề sinh nhai
    if (!player.professions || typeof player.professions !== 'object') {
      player.professions = {};
    }
    for (var pKey in PROFESSIONS) {
      if (!player.professions[pKey] || typeof player.professions[pKey] !== 'object') {
        player.professions[pKey] = { level: 1, exp: 0, totalActions: 0 };
      }
      var p = player.professions[pKey];
      if (typeof p.level !== 'number' || p.level < 1) p.level = 1;
      if (typeof p.exp !== 'number' || p.exp < 0) p.exp = 0;
      if (typeof p.totalActions !== 'number' || p.totalActions < 0) p.totalActions = 0;
    }

    // 1.2 Luyện Khí & Sổ Bản Vẽ
    if (!player.luyenKhi || typeof player.luyenKhi !== 'object') {
      player.luyenKhi = {
        recipes: ['bp_kiem_thanh_bo', 'bp_ao_thanh_bo'],
        proficiency: {},
        history: [],
        stats: { totalForged: 0, totalRefined: 0, totalRerolled: 0, totalDismantled: 0, totalTransferred: 0 }
      };
    }
    var lk = player.luyenKhi;
    if (!Array.isArray(lk.recipes)) lk.recipes = ['bp_kiem_thanh_bo', 'bp_ao_thanh_bo'];
    if (!lk.proficiency || typeof lk.proficiency !== 'object') lk.proficiency = {};
    if (!Array.isArray(lk.history)) lk.history = [];
    if (!lk.stats || typeof lk.stats !== 'object') {
      lk.stats = { totalForged: 0, totalRefined: 0, totalRerolled: 0, totalDismantled: 0, totalTransferred: 0 };
    }

    // 1.3 Bảng đơn hàng NPC
    if (!player.npcOrders || typeof player.npcOrders !== 'object') {
      player.npcOrders = {
        orders: DEFAULT_NPC_ORDERS.map(function (o) { return Object.assign({}, o, { completed: false }); }),
        lastRefreshDate: todayDateString(),
        completedTotal: 0
      };
    }
    var no = player.npcOrders;
    if (!Array.isArray(no.orders) || no.orders.length === 0) {
      no.orders = DEFAULT_NPC_ORDERS.map(function (o) { return Object.assign({}, o, { completed: false }); });
    }
    if (typeof no.completedTotal !== 'number') no.completedTotal = 0;
    // Đợt N1FIX (§8.2): save cũ có 6 đơn nhận thêm 4 đơn mới, giữ cờ đã xong.
    syncDefaultOrders(player);
    // Đợt N1FIX (§8.4): chuẩn hóa ngày làm mới; sang ngày mới thì làm mới
    // đơn ngay khi nạp (dựng lại toàn bộ, giữ completedTotal).
    if (typeof no.lastRefreshDate !== 'string' || !no.lastRefreshDate) {
      no.lastRefreshDate = todayDateString();
    } else if (no.lastRefreshDate !== todayDateString()) {
      no.orders = DEFAULT_NPC_ORDERS.map(function (o) { return Object.assign({}, o, { completed: false }); });
      no.lastRefreshDate = todayDateString();
    }

    // 1.4 Đợt N1FIX (§8.5): hồi chiêu điểm hành nghề LƯU BỀN trong save
    // (giây theo Date.now — cùng đồng hồ với executeGatherAction). Save cũ
    // hồi tố rỗng: mọi điểm sẵn sàng, không phạt ngược.
    if (!player.n1GatherReadyTimes || typeof player.n1GatherReadyTimes !== 'object') {
      player.n1GatherReadyTimes = {};
    }

    return player;
  }

  // ==========================================================================
  // 2. LOGIC 4 NGHỀ SINH NHAI CÓ CẤP
  // ==========================================================================
  function getProfession(player, profId) {
    ensureState(player);
    return player.professions[profId] || null;
  }

  function getExpThreshold(level) {
    return EXP_THRESHOLDS[level] || EXP_THRESHOLDS[1];
  }

  function addProfessionExp(player, profId, amount) {
    ensureState(player);
    var profDef = PROFESSIONS[profId];
    if (!profDef) return { ok: false, reason: 'invalid_profession' };

    var profState = player.professions[profId];
    var gained = Math.max(0, amount || 0);
    profState.exp += gained;
    profState.totalActions += 1;

    var leveledUp = false;
    var oldLevel = profState.level;

    while (profState.level < profDef.maxLevel) {
      var needed = getExpThreshold(profState.level);
      if (profState.exp >= needed) {
        profState.exp -= needed;
        profState.level += 1;
        leveledUp = true;
      } else {
        break;
      }
    }

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      profId: profId,
      profName: profDef.name,
      gainedExp: gained,
      currentLevel: profState.level,
      currentExp: profState.exp,
      neededExp: getExpThreshold(profState.level),
      leveledUp: leveledUp,
      oldLevel: oldLevel
    };
  }

  function getGatherNodes(mapId) {
    if (!mapId) return GATHER_NODES.slice();
    return GATHER_NODES.filter(function (n) { return n.mapId === mapId; });
  }

  function getGatherNodeById(nodeId) {
    for (var i = 0; i < GATHER_NODES.length; i++) {
      if (GATHER_NODES[i].id === nodeId) return GATHER_NODES[i];
    }
    return null;
  }

  // Khai thác điểm hành nghề trên bản đồ
  function executeGatherAction(player, nodeId, readyTimesTracker) {
    ensureState(player);
    var node = getGatherNodeById(nodeId);
    if (!node) return { ok: false, reason: 'node_not_found', msg: 'Không tìm thấy điểm thu thập.' };

    var profState = player.professions[node.profId];
    if (!profState) return { ok: false, reason: 'no_prof' };

    // Kiểm tra cấp nghề
    if (profState.level < node.reqLevel) {
      var pDef = PROFESSIONS[node.profId];
      return {
        ok: false,
        reason: 'level_locked',
        reqLevel: node.reqLevel,
        currentLevel: profState.level,
        msg: 'Cần nghề ' + pDef.name + ' Cấp ' + node.reqLevel + ' mới có thể thao tác.'
      };
    }

    // Kiểm tra thời gian hồi phục (cooldown). Đợt N1FIX (§8.5): không
    // truyền tracker thì dùng store BỀN trong save (player.n1GatherReadyTimes);
    // tracker truyền tường minh giữ nguyên hành vi cũ (test + đường cũ).
    var usePersistentStore = !readyTimesTracker;
    var tracker = readyTimesTracker || player.n1GatherReadyTimes;
    var nowSec = Date.now() / 1000;
    if (usePersistentStore) {
      // Tỉa mục đã hết hạn để store không phình (tối đa 12 điểm).
      for (var pk in tracker) {
        if (Object.prototype.hasOwnProperty.call(tracker, pk) && tracker[pk] <= nowSec) {
          delete tracker[pk];
        }
      }
    }
    if (tracker[node.id] && nowSec < tracker[node.id]) {
      var remSec = Math.ceil(tracker[node.id] - nowSec);
      return { ok: false, reason: 'cooldown', remSec: remSec, msg: 'Điểm đang hồi phục (' + remSec + 's).' };
    }

    // Đánh dấu thời gian sẵn sàng kế tiếp — chỉ sau khi chắc chắn đồ vào
    // túi được (túi đầy thì không tính hồi chiêu, không tính EXP).
    // Tính toán vật phẩm rơi
    var gatheredItems = [];
    var addFailed = false;
    for (var d = 0; d < node.drops.length; d++) {
      var drop = node.drops[d];
      var roll = Math.random();
      if (roll <= (drop.chance || 1.0)) {
        var cnt = drop.count || 1;
        var r = addBagItem(player, drop.itemId, cnt);
        if (r && r.success !== false) {
          var def = getItemDef(drop.itemId);
          gatheredItems.push({ itemId: drop.itemId, count: cnt, name: def ? def.name : drop.itemId });
        } else {
          addFailed = true;
        }
      }
    }
    if (addFailed) {
      return { ok: false, reason: 'bag_full', nodeId: node.id, nodeName: node.name, items: gatheredItems, msg: 'Túi đồ đã đầy — không thu thập được.' };
    }

    tracker[node.id] = nowSec + (node.respawnSec || 60);

    // Tăng EXP nghề
    var expResult = addProfessionExp(player, node.profId, node.expGain || 20);

    return {
      ok: true,
      nodeId: node.id,
      nodeName: node.name,
      profId: node.profId,
      items: gatheredItems,
      expResult: expResult,
      msg: 'Thu thập thành công!'
    };
  }

  // ==========================================================================
  // 3. LOGIC LÒ RÈN & VÁN 4 BƯỚC TAY (FORGING MINIGAME)
  // ==========================================================================
  function getBlueprint(bpId) {
    return BLUEPRINTS[bpId] || null;
  }

  function getLearnedBlueprints(player) {
    ensureState(player);
    var list = [];
    var recipes = player.luyenKhi.recipes || [];
    for (var i = 0; i < recipes.length; i++) {
      var bp = BLUEPRINTS[recipes[i]];
      if (bp) list.push(bp);
    }
    return list;
  }

  // Đợt N1FIX (§8.2): nguồn lấy bản vẽ — 2 bản học sẵn từ đầu, 5 bản còn
  // lại là thưởng đơn hàng. Trả null nếu bản vẽ không có nguồn nào.
  function getBlueprintSource(bpId) {
    var bp = BLUEPRINTS[bpId];
    if (!bp) return null;
    if (bpId === 'bp_kiem_thanh_bo' || bpId === 'bp_ao_thanh_bo') {
      return { type: 'default', label: 'Học sẵn từ đầu' };
    }
    for (var i = 0; i < DEFAULT_NPC_ORDERS.length; i++) {
      var o = DEFAULT_NPC_ORDERS[i];
      if (o.rewardItemId === bpId) {
        return { type: 'order', orderId: o.id, npcName: o.npcName, title: o.title, label: 'Thưởng đơn hàng của ' + o.npcName + ' (thẻ Đơn Hàng)' };
      }
    }
    return null;
  }

  function canLearnBlueprint(player, bpId) {
    ensureState(player);
    var bp = BLUEPRINTS[bpId];
    if (!bp) return { ok: false, reason: 'not_found', msg: 'Bản vẽ không tồn tại.' };
    if (player.luyenKhi.recipes.indexOf(bpId) !== -1) {
      return { ok: false, reason: 'already_learned', msg: 'Đã học bản vẽ này rồi.' };
    }
    return { ok: true, blueprint: bp };
  }

  function learnBlueprint(player, bpId) {
    var c = canLearnBlueprint(player, bpId);
    if (!c.ok) return c;
    player.luyenKhi.recipes.push(bpId);
    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);
    return { ok: true, blueprintId: bpId, msg: 'Đã lĩnh ngộ ' + c.blueprint.name + '.' };
  }

  function getBlueprintProficiency(player, bpId) {
    ensureState(player);
    var prof = player.luyenKhi.proficiency[bpId];
    if (!prof) return { uses: 0, successes: 0, maxQualityAchieved: 'ha', isMastered: false };
    return {
      uses: prof.uses || 0,
      successes: prof.successes || 0,
      maxQualityAchieved: prof.maxQualityAchieved || 'ha',
      isMastered: (prof.uses >= 15) // Tinh thông: rèn >= 15 lần
    };
  }

  function recordBlueprintProficiency(player, bpId, quality) {
    ensureState(player);
    if (!player.luyenKhi.proficiency[bpId]) {
      player.luyenKhi.proficiency[bpId] = { uses: 0, successes: 0, maxQualityAchieved: 'ha' };
    }
    var p = player.luyenKhi.proficiency[bpId];
    p.uses = (p.uses || 0) + 1;
    if (quality && quality !== 'ha') {
      p.successes = (p.successes || 0) + 1;
    }
    var curRank = QUALITY_RANKS[p.maxQualityAchieved] ? QUALITY_RANKS[p.maxQualityAchieved].rank : 0;
    var newRank = QUALITY_RANKS[quality] ? QUALITY_RANKS[quality].rank : 0;
    if (newRank > curRank) {
      p.maxQualityAchieved = quality;
    }
    return p;
  }

  function checkForgeMaterials(player, bpId) {
    var bp = getBlueprint(bpId);
    if (!bp) return { ok: false, reason: 'unknown_bp' };

    if ((player.linhThach || 0) < bp.costLt) {
      return { ok: false, reason: 'not_enough_lt', needLt: bp.costLt, haveLt: player.linhThach || 0, msg: 'Không đủ Linh Thạch.' };
    }

    var missing = [];
    for (var i = 0; i < bp.reqMaterials.length; i++) {
      var req = bp.reqMaterials[i];
      var have = countBagItem(player, req.itemId);
      if (have < req.count) {
        var def = getItemDef(req.itemId);
        missing.push({ itemId: req.itemId, name: def ? def.name : req.itemId, need: req.count, have: have });
      }
    }

    if (missing.length > 0) {
      return { ok: false, reason: 'missing_materials', missing: missing, msg: 'Thiếu nguyên liệu rèn.' };
    }

    return { ok: true, blueprint: bp };
  }

  // Sinh dòng thuộc tính ngẫu nhiên theo nguyên liệu phụ trợ (Ngũ hành)
  function generateAffixes(element, count) {
    var list = ELEMENTAL_AFFIXES[element] || ELEMENTAL_AFFIXES.kim;
    var affixes = [];
    var available = list.slice();
    for (var i = 0; i < count; i++) {
      if (available.length === 0) available = list.slice();
      var pickIdx = Math.floor(Math.random() * available.length);
      var template = available.splice(pickIdx, 1)[0];
      var val = template.min + Math.floor(Math.random() * (template.max - template.min + 1));
      affixes.push({
        id: template.id,
        name: template.name,
        type: template.type,
        value: val,
        unit: template.unit,
        element: element
      });
    }
    return affixes;
  }

  /**
   * Tính toán kết quả Ván 4 bước tay rèn
   * stepInputs: {
   *   fireScore: number (0..1),    // Bước 1: Hỏa hầu nung phôi
   *   hammerScore: number (0..1),  // Bước 2: Thao thiết rèn dập
   *   quenchScore: number (0..1),  // Bước 3: Tôi luyện dung dịch
   *   infuseScore: number (0..1)   // Bước 4: Khai phong ngũ hành
   * }
   * extraMaterialId: string (nguyên liệu phụ trợ quyết định hệ thuộc tính)
   */
  function calculateForgeResult(player, bpId, stepInputs, extraMaterialId) {
    ensureState(player);
    var chk = checkForgeMaterials(player, bpId);
    if (!chk.ok) return chk;
    var bp = chk.blueprint;

    // Đợt N1 tiếp nối (Muse): xác định hệ phụ liệu TRƯỚC, trừ liệu SAU khi
    // thành phẩm đã vào túi được — bản cũ trừ liệu trước rồi bỏ qua kết quả
    // thêm đồ, nên rèn lúc túi đầy sẽ nuốt nguyên liệu + Linh Thạch mà
    // không ra đồ.
    var element = 'kim';
    var consumeExtra = false;
    if (extraMaterialId && countBagItem(player, extraMaterialId) > 0) {
      consumeExtra = true;
      element = MATERIAL_ELEMENTS[extraMaterialId] || 'kim';
    } else {
      // Dựa vào nguyên liệu chính đầu tiên
      var mainMat = bp.reqMaterials[0] ? bp.reqMaterials[0].itemId : 'quang-dong-tho';
      element = MATERIAL_ELEMENTS[mainMat] || 'kim';
    }

    // Điểm 4 bước
    var s = stepInputs || {};
    var f = Math.max(0, Math.min(1, typeof s.fireScore === 'number' ? s.fireScore : 0.7));
    var h = Math.max(0, Math.min(1, typeof s.hammerScore === 'number' ? s.hammerScore : 0.7));
    var q = Math.max(0, Math.min(1, typeof s.quenchScore === 'number' ? s.quenchScore : 0.7));
    var inf = Math.max(0, Math.min(1, typeof s.infuseScore === 'number' ? s.infuseScore : 0.7));

    // Điểm thông thạo
    var prof = getBlueprintProficiency(player, bpId);
    var profBonus = Math.min(0.10, (prof.successes || 0) * 0.01);

    // Công thức tính Score tổng (PROVISIONAL)
    var totalScore = (0.25 * f) + (0.35 * h) + (0.20 * q) + (0.20 * inf) + profBonus;
    totalScore = Math.max(0, Math.min(1.0, totalScore));

    // Xác định phẩm chất từ Score
    var quality = 'ha';
    if (totalScore >= 0.95) quality = 'cuc';
    else if (totalScore >= 0.85) quality = 'thuong';
    else if (totalScore >= 0.70) quality = 'trung';
    else quality = 'ha';

    // Chặn bởi Phẩm Trần của Bản Vẽ
    var maxRank = QUALITY_RANKS[bp.maxQuality] ? QUALITY_RANKS[bp.maxQuality].rank : 2;
    var actualRank = QUALITY_RANKS[quality].rank;
    if (actualRank > maxRank) {
      quality = bp.maxQuality;
    }

    // Sinh dòng thuộc tính theo phẩm
    var affixCount = QUALITY_RANKS[quality].affixCount;
    var affixes = generateAffixes(element, affixCount);

    // Thành phẩm KÝ TÊN người rèn
    var crafterName = (player.name && player.name.trim()) || 'Hà Nhân';
    var craftedItemData = {
      itemId: bp.targetItemId,
      crafter: crafterName,
      quality: quality,
      refineLevel: 0,
      affixes: affixes,
      craftedAt: Date.now()
    };

    // Thêm vào túi đồ TRƯỚC khi trừ liệu: túi đầy thì báo lỗi, không
    // trừ gì, không ghi thông thạo/lịch sử.
    var addRes = addBagItem(player, bp.targetItemId, 1, craftedItemData);
    if (!addRes || addRes.success === false) {
      return { ok: false, reason: 'bag_full', msg: 'Túi đồ đã đầy — không rèn được.' };
    }

    // Trừ Linh Thạch, nguyên liệu chính và phụ liệu (nếu có).
    player.linhThach = (player.linhThach || 0) - bp.costLt;
    for (var m = 0; m < bp.reqMaterials.length; m++) {
      removeBagItem(player, bp.reqMaterials[m].itemId, bp.reqMaterials[m].count);
    }
    if (consumeExtra) removeBagItem(player, extraMaterialId, 1);

    // Cập nhật Sổ thông thạo & thống kê
    recordBlueprintProficiency(player, bpId, quality);
    player.luyenKhi.stats.totalForged = (player.luyenKhi.stats.totalForged || 0) + 1;
    player.luyenKhi.history.unshift({
      targetItemId: bp.targetItemId,
      quality: quality,
      crafter: crafterName,
      at: Date.now()
    });
    if (player.luyenKhi.history.length > 20) player.luyenKhi.history.pop();

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      totalScore: Math.round(totalScore * 100) / 100,
      quality: quality,
      qualityName: QUALITY_RANKS[quality].name,
      crafter: crafterName,
      affixes: affixes,
      item: craftedItemData,
      msg: 'Rèn thành công: ' + bp.targetName + ' (' + QUALITY_RANKS[quality].name + '), ký tên [' + crafterName + '].'
    };
  }

  // Rèn Nhanh (chỉ mở khi tinh thông >=15 lần)
  function quickForge(player, bpId, extraMaterialId) {
    var prof = getBlueprintProficiency(player, bpId);
    if (!prof.isMastered) {
      return { ok: false, reason: 'not_mastered', msg: 'Cần đạt độ thông thạo Tinh Thông (>=15 lần rèn) mới mở Rèn Nhanh.' };
    }
    // Giả lập điểm chuẩn rèn nhanh ở mức Thượng phẩm (score 0.88)
    var stepInputs = { fireScore: 0.88, hammerScore: 0.88, quenchScore: 0.88, infuseScore: 0.88 };
    return calculateForgeResult(player, bpId, stepInputs, extraMaterialId);
  }

  // ==========================================================================
  // 4. 4 THAO TÁC TRANG BỊ: TINH LUYỆN / TẨY LUYỆN / PHÂN GIẢI / TRUYỀN THỪA
  // ==========================================================================

  // Lấy đối tượng slot trang bị từ túi đồ
  function getSlotRef(player, containerId, slotIndex) {
    ensureState(player);
    var tk = player.tuiKho;
    if (tk && tk.containers && tk.containers[containerId]) {
      return tk.containers[containerId].slots[slotIndex] || null;
    }
    if (player.bag && Array.isArray(player.bag.slots)) {
      return player.bag.slots[slotIndex] || null;
    }
    return null;
  }

  // Đợt N1FIX (§8.6): mô tả dữ liệu N1 của một ô túi — hàm thuần để giao
  // diện túi dùng chung. Trả null nếu ô không mang dữ liệu N1 nào.
  function describeN1Slot(slot) {
    if (!slot || !slot.itemId) return null;
    var quality = slot.quality || 'ha';
    var refineLevel = slot.refineLevel || 0;
    var affixes = Array.isArray(slot.affixes) ? slot.affixes : [];
    var crafter = slot.crafter || null;
    var hasData = (quality !== 'ha') || refineLevel > 0 || affixes.length > 0 || !!crafter;
    if (!hasData) return null;
    var affixLines = affixes.map(function (a) {
      var v = (a.value > 0 ? '+' : '') + a.value + (a.unit || '');
      return v + ' ' + (a.name || a.type || a.id || 'Dòng phụ');
    });
    return {
      quality: quality,
      qualityName: QUALITY_RANKS[quality] ? QUALITY_RANKS[quality].name : quality,
      refineLevel: refineLevel,
      affixLines: affixLines,
      crafter: crafter
    };
  }

  // 4.1 Tinh luyện (+1..+10)
  function refineGear(player, containerId, slotIndex) {
    ensureState(player);
    var slot = getSlotRef(player, containerId, slotIndex);
    if (!slot || !slot.itemId) return { ok: false, reason: 'no_item', msg: 'Không tìm thấy trang bị.' };

    var def = getItemDef(slot.itemId);
    if (!def || def.type !== 'gear') return { ok: false, reason: 'not_gear', msg: 'Vật phẩm không phải trang bị.' };

    var curLevel = slot.refineLevel || 0;
    if (curLevel >= 10) return { ok: false, reason: 'max_refine', msg: 'Trang bị đã đạt cấp tinh luyện tối đa (+10).' };

    // Chi phí tinh luyện (PROVISIONAL)
    var costLt = (curLevel + 1) * 20;
    var reqMatId = curLevel < 3 ? 'quang-dong-tho' : (curLevel < 6 ? 'quang-sat-huyen' : 'tinh-thiet-tho');
    var reqMatCount = Math.floor(curLevel / 3) + 1;

    if ((player.linhThach || 0) < costLt) {
      return { ok: false, reason: 'not_enough_lt', needLt: costLt, msg: 'Không đủ Linh Thạch tinh luyện.' };
    }
    if (countBagItem(player, reqMatId) < reqMatCount) {
      var mDef = getItemDef(reqMatId);
      return { ok: false, reason: 'missing_mat', msg: 'Thiếu ' + reqMatCount + 'x ' + (mDef ? mDef.name : reqMatId) + '.' };
    }

    // Trừ chi phí
    player.linhThach -= costLt;
    removeBagItem(player, reqMatId, reqMatCount);

    // Tỉ lệ thành công (PROVISIONAL): +1..+3: 100%, +4..+6: 85%, +7..+10: 70%
    var successRate = curLevel < 3 ? 1.0 : (curLevel < 6 ? 0.85 : 0.70);
    var isSuccess = Math.random() <= successRate;

    if (isSuccess) {
      slot.refineLevel = curLevel + 1;
      player.luyenKhi.stats.totalRefined = (player.luyenKhi.stats.totalRefined || 0) + 1;
      var st = getStateAPI();
      if (st && st.savePlayer) st.savePlayer(player);
      return { ok: true, success: true, newLevel: slot.refineLevel, msg: 'Tinh luyện thành công lên +' + slot.refineLevel + '!' };
    } else {
      var stFail = getStateAPI();
      if (stFail && stFail.savePlayer) stFail.savePlayer(player);
      return { ok: true, success: false, newLevel: curLevel, msg: 'Tinh luyện thất bại, giữ nguyên cấp +' + curLevel + '.' };
    }
  }

  // 4.2 Tẩy luyện (Reroll affixes)
  function rerollAffixes(player, containerId, slotIndex, preferredElement) {
    ensureState(player);
    var slot = getSlotRef(player, containerId, slotIndex);
    if (!slot || !slot.itemId) return { ok: false, reason: 'no_item', msg: 'Không tìm thấy trang bị.' };

    var def = getItemDef(slot.itemId);
    if (!def || def.type !== 'gear') return { ok: false, reason: 'not_gear', msg: 'Vật phẩm không phải trang bị.' };

    var costLt = 25;
    if ((player.linhThach || 0) < costLt) {
      return { ok: false, reason: 'not_enough_lt', needLt: costLt, msg: 'Không đủ 25 Linh Thạch tẩy luyện.' };
    }

    // Cần 1 Đá Tẩy Luyện (hoặc 1 Cá Hàn Băng)
    var matUsed = null;
    if (countBagItem(player, 'da-tay-luyen') >= 1) {
      matUsed = 'da-tay-luyen';
    } else if (countBagItem(player, 'ca-han-bang') >= 1) {
      matUsed = 'ca-han-bang';
    } else {
      return { ok: false, reason: 'missing_mat', msg: 'Cần có Đá Tẩy Luyện hoặc Cá Hàn Băng để tẩy luyện.' };
    }

    // Trừ chi phí
    player.linhThach -= costLt;
    removeBagItem(player, matUsed, 1);

    // Xác định số dòng tẩy theo phẩm chất trang bị
    var quality = slot.quality || 'ha';
    var affixCount = QUALITY_RANKS[quality] ? QUALITY_RANKS[quality].affixCount : 1;
    if (affixCount <= 0) affixCount = 1; // Cho phép tẩy ít nhất 1 dòng nếu đã tẩy

    var elem = preferredElement || 'kim';
    slot.affixes = generateAffixes(elem, affixCount);
    player.luyenKhi.stats.totalRerolled = (player.luyenKhi.stats.totalRerolled || 0) + 1;

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      quality: quality,
      newAffixes: slot.affixes,
      msg: 'Tẩy luyện hoàn tất, nhận ' + slot.affixes.length + ' dòng thuộc tính mới!'
    };
  }

  // 4.3 Phân giải (Dismantle)
  function dismantleGear(player, containerId, slotIndex) {
    ensureState(player);
    var slot = getSlotRef(player, containerId, slotIndex);
    if (!slot || !slot.itemId) return { ok: false, reason: 'no_item', msg: 'Không tìm thấy trang bị.' };

    var def = getItemDef(slot.itemId);
    if (!def || def.type !== 'gear') return { ok: false, reason: 'not_gear', msg: 'Vật phẩm không phải trang bị.' };

    var quality = slot.quality || 'ha';
    var refineLevel = slot.refineLevel || 0;

    // Hoàn trả nguyên liệu và linh thạch tương ứng phẩm & cấp tinh luyện
    var returnLt = 10 + (QUALITY_RANKS[quality] ? QUALITY_RANKS[quality].rank * 10 : 0) + (refineLevel * 5);
    var returnMatId = 'quang-dong-tho';
    var returnMatCount = 2 + refineLevel;

    if (slot.itemId.indexOf('truc-van') !== -1) {
      returnMatId = 'quang-sat-huyen';
    }

    // Xóa trang bị khỏi túi
    var tk = player.tuiKho;
    if (tk && tk.containers && tk.containers[containerId]) {
      tk.containers[containerId].slots[slotIndex] = null;
    } else if (player.bag && Array.isArray(player.bag.slots)) {
      player.bag.slots[slotIndex] = null;
    }

    // Cộng thưởng hoàn trả
    player.linhThach = (player.linhThach || 0) + returnLt;
    addBagItem(player, returnMatId, returnMatCount);
    player.luyenKhi.stats.totalDismantled = (player.luyenKhi.stats.totalDismantled || 0) + 1;

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    var mDef = getItemDef(returnMatId);
    return {
      ok: true,
      returnedLt: returnLt,
      returnedMatId: returnMatId,
      returnedMatName: mDef ? mDef.name : returnMatId,
      returnedMatCount: returnMatCount,
      msg: 'Phân giải thành công, thu hồi ' + returnLt + ' Linh Thạch và ' + returnMatCount + 'x ' + (mDef ? mDef.name : returnMatId) + '.'
    };
  }

  // 4.4 Truyền thừa (Inheritance)
  function transferInheritance(player, fromContainerId, fromSlotIndex, toContainerId, toSlotIndex) {
    ensureState(player);
    var fromSlot = getSlotRef(player, fromContainerId, fromSlotIndex);
    var toSlot = getSlotRef(player, toContainerId, toSlotIndex);

    if (!fromSlot || !fromSlot.itemId || !toSlot || !toSlot.itemId) {
      return { ok: false, reason: 'missing_items', msg: 'Không đủ 2 trang bị để truyền thừa.' };
    }

    var fromDef = getItemDef(fromSlot.itemId);
    var toDef = getItemDef(toSlot.itemId);
    if (!fromDef || fromDef.type !== 'gear' || !toDef || toDef.type !== 'gear') {
      return { ok: false, reason: 'not_gear', msg: 'Cả 2 vật phẩm phải là trang bị.' };
    }

    if (fromDef.slot !== toDef.slot) {
      return { ok: false, reason: 'slot_mismatch', msg: 'Chỉ có thể truyền thừa giữa 2 trang bị cùng vị trí ô.' };
    }

    var fromLevel = fromSlot.refineLevel || 0;
    var toLevel = toSlot.refineLevel || 0;
    if (fromLevel <= 0) {
      return { ok: false, reason: 'no_refine_to_transfer', msg: 'Trang bị truyền chưa được tinh luyện (+0).' };
    }
    if (fromLevel <= toLevel) {
      return { ok: false, reason: 'target_level_higher', msg: 'Cấp trang bị nhận phải thấp hơn trang bị truyền.' };
    }

    var costLt = fromLevel * 30;
    if ((player.linhThach || 0) < costLt) {
      return { ok: false, reason: 'not_enough_lt', needLt: costLt, msg: 'Không đủ ' + costLt + ' Linh Thạch để truyền thừa.' };
    }

    // Trừ phí
    player.linhThach -= costLt;

    // Chuyển cấp tinh luyện
    toSlot.refineLevel = fromLevel;
    fromSlot.refineLevel = 0; // Trang bị cũ hạ về +0

    // Đợt N1FIX (§8.7) — LUẬT: dòng phụ DI CHUYỂN theo cấp tinh luyện.
    // Đồ nhận ít dòng hơn thì chép toàn bộ dòng sang và đồ nguồn MẤT dòng
    // đã truyền (không bao giờ cả hai cùng giữ một bộ dòng). Đồ nhận đã
    // đủ dòng thì không chép, đồ nguồn giữ nguyên dòng.
    var affixesTransferred = false;
    if (Array.isArray(fromSlot.affixes) && fromSlot.affixes.length > 0) {
      if (!Array.isArray(toSlot.affixes) || toSlot.affixes.length < fromSlot.affixes.length) {
        toSlot.affixes = fromSlot.affixes.slice();
        fromSlot.affixes = [];
        affixesTransferred = true;
      }
    }

    player.luyenKhi.stats.totalTransferred = (player.luyenKhi.stats.totalTransferred || 0) + 1;

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      transferredLevel: fromLevel,
      affixesTransferred: affixesTransferred,
      msg: affixesTransferred
        ? 'Truyền thừa thành công! Trang bị mới đạt cấp +' + fromLevel + ', dòng phụ đã di chuyển sang.'
        : 'Truyền thừa thành công! Trang bị mới đạt cấp +' + fromLevel + '.'
    };
  }

  // ==========================================================================
  // 5. BẢNG ĐƠN ĐẶT HÀNG NPC
  // ==========================================================================
  function getNpcOrders(player) {
    ensureState(player);
    // Đợt N1FIX (§8.4): ngày lật giữa phiên thì mở bảng đơn cũng thấy đơn mới.
    refreshOrdersIfNewDay(player);
    return player.npcOrders.orders.slice();
  }

  function getOrderById(player, orderId) {
    ensureState(player);
    var list = player.npcOrders.orders;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === orderId) return list[i];
    }
    return null;
  }

  function canTurnInOrder(player, orderId) {
    ensureState(player);
    var order = getOrderById(player, orderId);
    if (!order) return { ok: false, reason: 'not_found', msg: 'Đơn hàng không tồn tại.' };
    if (order.completed) return { ok: false, reason: 'already_completed', msg: 'Đơn hàng này đã hoàn thành.' };

    var have = countQualifiedItems(player, order.reqItemId, order.reqMinQuality);
    if (have < order.reqCount) {
      var def = getItemDef(order.reqItemId);
      var qualNote = order.reqMinQuality ? ' (' + (QUALITY_RANKS[order.reqMinQuality] ? QUALITY_RANKS[order.reqMinQuality].name : order.reqMinQuality) + ' trở lên)' : '';
      return {
        ok: false,
        reason: 'not_enough_items',
        need: order.reqCount,
        have: have,
        msg: 'Chưa đủ ' + (def ? def.name : order.reqItemId) + qualNote + ' (' + have + '/' + order.reqCount + ').'
      };
    }

    return { ok: true, order: order };
  }

  function turnInOrder(player, orderId) {
    var c = canTurnInOrder(player, orderId);
    if (!c.ok) return c;
    var order = c.order;

    // Trừ vật phẩm yêu cầu (đủ phẩm chất tối thiểu nếu đơn có yêu cầu)
    removeQualifiedItems(player, order.reqItemId, order.reqCount, order.reqMinQuality);

    // Phát thưởng Linh Thạch
    if (order.rewardLt > 0) {
      player.linhThach = (player.linhThach || 0) + order.rewardLt;
    }

    // Phát thưởng EXP nghề nếu có
    var expRes = null;
    if (order.rewardExp && order.rewardExp.profId) {
      expRes = addProfessionExp(player, order.rewardExp.profId, order.rewardExp.amount);
    }

    // Phát thưởng vật phẩm nếu có
    var itemRes = null;
    if (order.rewardItemId && order.rewardItemCount > 0) {
      itemRes = addBagItem(player, order.rewardItemId, order.rewardItemCount);
    }

    order.completed = true;
    player.npcOrders.completedTotal = (player.npcOrders.completedTotal || 0) + 1;

    var st = getStateAPI();
    if (st && st.savePlayer) st.savePlayer(player);

    return {
      ok: true,
      orderId: order.id,
      rewardLt: order.rewardLt,
      expResult: expRes,
      itemResult: itemRes,
      msg: 'Giao hàng cho ' + order.npcName + ' thành công! Nhận +' + order.rewardLt + ' Linh Thạch.'
    };
  }

  // ==========================================================================
  // XUẤT PUBLIC API
  // ==========================================================================
  var API = {
    PROFESSIONS: PROFESSIONS,
    EXP_THRESHOLDS: EXP_THRESHOLDS,
    GATHER_NODES: GATHER_NODES,
    BLUEPRINTS: BLUEPRINTS,
    QUALITY_RANKS: QUALITY_RANKS,
    ELEMENTAL_AFFIXES: ELEMENTAL_AFFIXES,
    MATERIAL_ELEMENTS: MATERIAL_ELEMENTS,
    DEFAULT_NPC_ORDERS: DEFAULT_NPC_ORDERS,

    // Quản lý state
    ensureState: ensureState,
    todayDateString: todayDateString,
    refreshOrdersIfNewDay: refreshOrdersIfNewDay,

    // Nghề sinh nhai
    getProfession: getProfession,
    addProfessionExp: addProfessionExp,
    getGatherNodes: getGatherNodes,
    getGatherNodeById: getGatherNodeById,
    executeGatherAction: executeGatherAction,

    // Luyện khí & Bản vẽ
    getBlueprint: getBlueprint,
    getBlueprintSource: getBlueprintSource,
    getLearnedBlueprints: getLearnedBlueprints,
    canLearnBlueprint: canLearnBlueprint,
    learnBlueprint: learnBlueprint,
    getBlueprintProficiency: getBlueprintProficiency,
    recordBlueprintProficiency: recordBlueprintProficiency,
    checkForgeMaterials: checkForgeMaterials,
    calculateForgeResult: calculateForgeResult,
    quickForge: quickForge,
    generateAffixes: generateAffixes,

    // 4 thao tác trang bị
    describeN1Slot: describeN1Slot,
    refineGear: refineGear,
    rerollAffixes: rerollAffixes,
    dismantleGear: dismantleGear,
    transferInheritance: transferInheritance,

    // Bảng đơn hàng NPC
    getNpcOrders: getNpcOrders,
    getOrderById: getOrderById,
    canTurnInOrder: canTurnInOrder,
    turnInOrder: turnInOrder,
    countQualifiedItems: countQualifiedItems
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  if (typeof window !== 'undefined') window.GameN1 = API;
  if (typeof global !== 'undefined') global.GameN1 = API;
})(typeof window !== 'undefined' ? window : this);
