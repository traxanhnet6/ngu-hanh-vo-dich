/**
 * monsters.js — Dữ liệu quái vật, bầy đàn, bảng rớt đồ & máy trạng thái (Hồ sơ 01, 36, 41, 49 & Brief Đợt 2)
 * Node-loadable và chạy trên trình duyệt.
 */

(function (exports) {
  'use strict';

  // Định nghĩa các vật phẩm trong game (Brief §6 & Check 9)
  var ITEM_DEFS = {
    'linh-thach': {
      id: 'linh-thach',
      name: 'Linh Thạch',
      type: 'currency',
      iconCol: 0,
      iconRow: 0,
      desc: 'Đá chứa linh khí trời đất, tiền tệ cơ bản của giới tu tiên.'
    },
    'la-thanh-tuy': {
      id: 'la-thanh-tuy',
      name: 'Lá Thanh Tụy',
      type: 'material',
      stackable: true,
      iconCol: 1,
      iconRow: 5,
      desc: 'Lá cây sáng linh quang thu hái từ Rừng Độc Thanh Tụy, dùng luyện Mộc Linh Đan.'
    },
    'to-nhen-xanh': {
      id: 'to-nhen-xanh',
      name: 'Tơ Nhện Xanh',
      type: 'material',
      stackable: true,
      iconCol: 2,
      iconRow: 0,
      desc: 'Tơ nhện rừng bền chắc ánh biếc, dùng dệt pháp y và đan lưới hộ thân.'
    },
    'tim-go-co-thu': {
      id: 'tim-go-co-thu',
      name: 'Tim Gỗ Cổ Thụ',
      type: 'material',
      stackable: true,
      iconCol: 3,
      iconRow: 0,
      desc: 'Lõi gỗ nghìn năm tụ linh mộc khí của Cổ Thụ Yêu, nguyên liệu quý để chế tạo pháp bảo.'
    },
    'linh-chi-rung': {
      id: 'linh-chi-rung',
      name: 'Linh Chi Rừng',
      type: 'material',
      stackable: true,
      iconCol: 0,
      iconRow: 1,
      desc: 'Nấm linh chi đỏ tía mọc ở gốc cổ thụ, bồi bổ khí huyết và tăng tu vi.'
    },
    'non-la': {
      id: 'non-la',
      name: 'Nón Lá',
      type: 'gear',
      slot: 'head',
      def: 1,
      quality: 'common',
      stackable: false,
      iconCol: 4,
      iconRow: 1,
      desc: 'Nón lá quê nhà, che nắng che mưa. +1 phòng thủ'
    },
    'kiem-go': {
      id: 'kiem-go',
      name: 'Kiếm Gỗ',
      type: 'gear',
      slot: 'weapon',
      atk: 2,
      quality: 'common',
      stackable: false,
      iconCol: 4,
      iconRow: 0,
      desc: 'Kiếm gỗ tập luyện cho đệ tử mới vào tông (+2 công kích).'
    },
    'kiem-de-tu': {
      id: 'kiem-de-tu',
      name: 'Kiếm Đệ Tử',
      type: 'gear',
      slot: 'weapon',
      atk: 3,
      quality: 'common',
      stackable: false,
      iconCol: 5,
      iconRow: 1,
      desc: 'Kiếm thép thô tông môn cấp phát cho đệ tử mới nhập môn (+3 công kích).'
    },
    'kiem-sat': {
      id: 'kiem-sat',
      name: 'Kiếm Sắt',
      type: 'gear',
      slot: 'weapon',
      atk: 5,
      quality: 'good',
      stackable: false,
      iconCol: 5,
      iconRow: 0,
      desc: 'Kiếm rèn từ huyền thiết thô, lưỡi sắc bén (+5 công kích).'
    },
    'ao-vai': {
      id: 'ao-vai',
      name: 'Áo Vải',
      type: 'gear',
      slot: 'armor',
      def: 1,
      quality: 'common',
      stackable: false,
      iconCol: 1,
      iconRow: 6,
      desc: 'Áo vải thanh đạm mộc mạc (+1 phòng thủ).'
    },
    'ao-linh': {
      id: 'ao-linh',
      name: 'Áo Linh',
      type: 'gear',
      slot: 'armor',
      def: 3,
      quality: 'good',
      stackable: false,
      iconCol: 5,
      iconRow: 4,
      desc: 'Áo dệt từ linh tơ mềm mại, ngăn cản khí độc (+3 phòng thủ).'
    },
    'dao-cui-cu': {
      id: 'dao-cui-cu',
      name: 'Dao Củi Cũ',
      type: 'gear',
      slot: 'weapon',
      atk: 2,
      quality: 'common',
      stackable: false,
      iconCol: 1,
      iconRow: 1,
      desc: 'Thanh dao chém củi cũ kỹ của Hà Nhân, hơi cùn nhưng chắc tay (+2 công kích).'
    },
    'ao-vai-tho': {
      id: 'ao-vai-tho',
      name: 'Áo Vải Thô',
      type: 'gear',
      slot: 'armor',
      def: 2,
      quality: 'common',
      stackable: false,
      iconCol: 2,
      iconRow: 1,
      desc: 'Áo vải thô của thợ săn và tiều phu (+2 giáp).'
    },
    'gay-co-thu': {
      id: 'gay-co-thu',
      name: 'Gậy Cổ Thụ',
      type: 'gear',
      slot: 'weapon',
      atk: 5,
      quality: 'good',
      stackable: false,
      iconCol: 3,
      iconRow: 1,
      desc: 'Gậy làm từ cành cổ thụ linh mộc, ẩn chứa linh lực tự nhiên (+5 công kích, +10 linh lực).'
    },
    'nguyen-tinh-moc': {
      id: 'nguyen-tinh-moc',
      name: 'Nguyên Tinh Mộc',
      type: 'material',
      stackable: true,
      iconCol: 0,
      iconRow: 3,
      desc: 'Tinh hoa mộc khí kết tinh trong tim Mộc Linh Cổ Vương, vật mốc để luyện đan đột phá đại cảnh giới.'
    },
    'nguyen-tinh-thuy': {
      id: 'nguyen-tinh-thuy',
      name: 'Nguyên Tinh Thủy',
      type: 'material',
      stackable: true,
      iconCol: 1,
      iconRow: 3,
      desc: 'Tinh hoa thủy khí kết tinh của Hàn Kính Giao Vương, vật mốc để luyện đan đột phá đại cảnh giới.'
    },
    'nguyen-tinh-hoa': {
      id: 'nguyen-tinh-hoa',
      name: 'Nguyên Tinh Hỏa',
      type: 'material',
      stackable: true,
      iconCol: 2,
      iconRow: 3,
      desc: 'Tinh hoa hỏa khí kết tinh của Xích Diệm Viêm Quân, vật mốc để luyện đan đột phá đại cảnh giới.'
    },
    'nguyen-tinh-tho': {
      id: 'nguyen-tinh-tho',
      name: 'Nguyên Tinh Thổ',
      type: 'material',
      stackable: true,
      iconCol: 3,
      iconRow: 3,
      desc: 'Tinh hoa thổ khí kết tinh của Hoàng Sa Cổ Vương, vật mốc để luyện đan đột phá đại cảnh giới.'
    },
    'nguyen-tinh-kim': {
      id: 'nguyen-tinh-kim',
      name: 'Nguyên Tinh Kim',
      type: 'material',
      stackable: true,
      iconCol: 4,
      iconRow: 3,
      desc: 'Tinh hoa kim khí kết tinh của Tàn Kiếm Vô Danh, vật mốc để luyện đan đột phá đại cảnh giới.'
    },
    'mui-kiem-vo-danh': {
      id: 'mui-kiem-vo-danh',
      name: 'Mũi Kiếm Vô Danh',
      type: 'material',
      stackable: true,
      iconCol: 5,
      iconRow: 3,
      desc: 'Mũi kiếm gãy của thanh cự kiếm vô chủ ở Kiếm Trủng, sắc lạnh như còn vương kiếm ý ngàn năm.'
    },
    'linh-chi-ngan-nam': {
      id: 'linh-chi-ngan-nam',
      name: 'Linh Chi Ngàn Năm',
      type: 'material',
      stackable: true,
      iconCol: 0,
      iconRow: 4,
      desc: 'Linh chi vàng hiếm có ngàn năm mới gặp, dược liệu trấn sơn của Rừng Độc Thanh Tụy.'
    },
    'bang-tuy-ngan-nam': {
      id: 'bang-tuy-ngan-nam',
      name: 'Băng Tủy Ngàn Năm',
      type: 'material',
      stackable: true,
      iconCol: 4,
      iconRow: 4,
      desc: 'Băng tủy trong veo kết tinh ngàn năm dưới hồ băng, chạm vào lạnh thấu xương.'
    },
    'loi-viem-quan': {
      id: 'loi-viem-quan',
      name: 'Lõi Viêm Quân',
      type: 'material',
      stackable: true,
      iconCol: 2,
      iconRow: 4,
      desc: 'Lõi lò luyện nguội dần trong ngực Xích Diệm Viêm Quân, vẫn âm ỉ cháy không tắt.'
    },
    'dia-tam-thach': {
      id: 'dia-tam-thach',
      name: 'Địa Tâm Thạch',
      type: 'material',
      stackable: true,
      iconCol: 3,
      iconRow: 4,
      desc: 'Khối đá vân vàng lấy từ địa tâm hoang mạc, nặng trĩu linh khí hệ Thổ.'
    },
    'bang-tinh': {
      id: 'bang-tinh',
      name: 'Băng Tinh',
      type: 'material',
      stackable: true,
      iconCol: 0,
      iconRow: 5,
      desc: 'Mảnh tinh thể băng kết từ mặt hồ Hàn Kính, lạnh thấu xương.'
    },
    'ngoc-bang-tam': {
      id: 'ngoc-bang-tam',
      name: 'Ngọc Băng Tâm',
      type: 'material',
      stackable: true,
      iconCol: 2,
      iconRow: 5,
      desc: 'Ngọc hàn tâm trong thân Hàn Kính Thủy Xà, nghìn năm không tan.'
    },
    'hoa-tinh-tho': {
      id: 'hoa-tinh-tho',
      name: 'Hỏa Tinh Thổ',
      type: 'material',
      stackable: true,
      iconCol: 3,
      iconRow: 5,
      desc: 'Tinh hỏa trong lòng đất nung, hơi nóng bốc mãi không tắt.'
    },
    'da-nung': {
      id: 'da-nung',
      name: 'Đá Nung',
      type: 'material',
      stackable: true,
      iconCol: 4,
      iconRow: 5,
      desc: 'Mảnh đá bị dung nham nung đỏ bong ra từ Hỏa Nham Thú, cầm lâu bỏng tay.'
    },
    'cat-tinh': {
      id: 'cat-tinh',
      name: 'Cát Tinh',
      type: 'material',
      stackable: true,
      iconCol: 0,
      iconRow: 6,
      desc: 'Hạt cát kết tinh trong Hoàng Sa, nặng hơn cát thường nhiều lần.'
    },
    'ngoc-cat-tam': {
      id: 'ngoc-cat-tam',
      name: 'Ngọc Cát Tâm',
      type: 'material',
      stackable: true,
      iconCol: 2,
      iconRow: 6,
      desc: 'Viên ngọc chôn sâu trong thân Sa Thạch Tượng, giữ cát nghìn năm.'
    },
    'manh-kiem-gay': {
      id: 'manh-kiem-gay',
      name: 'Mảnh Kiếm Gãy',
      type: 'material',
      stackable: true,
      iconCol: 3,
      iconRow: 6,
      desc: 'Mảnh thép gãy bong ra từ giáp Huyền Thiết, vẫn còn sắc.'
    },
    'hon-kiem-nho': {
      id: 'hon-kiem-nho',
      name: 'Hồn Kiếm Nhỏ',
      type: 'material',
      stackable: true,
      iconCol: 4,
      iconRow: 6,
      desc: 'Vệt hồn kiếm vụn lơ lửng quanh Tàn Kiếm Linh, nắm vào như có tiếng chuông ngân.'
    },
    'loi-huyen-thiet': {
      id: 'loi-huyen-thiet',
      name: 'Lõi Huyền Thiết',
      type: 'material',
      stackable: true,
      iconCol: 5,
      iconRow: 6,
      desc: 'Lõi thép huyền thiết trong ngực Giáp Thú, lạnh và nặng như một lời thề chưa trả.'
    },
    'bang-tuy': {
      id: 'bang-tuy',
      name: 'Băng Tủy',
      type: 'material',
      stackable: true,
      iconCol: 1,
      iconRow: 4,
      desc: 'Băng tủy tinh khiết kết tinh từ hàn khí hồ băng, nguyên liệu luyện Trúc Cơ Đan.'
    },
    'dan-kim': {
      id: 'dan-kim',
      name: 'Tu Luyện Đan (Kim)',
      type: 'consumable',
      stackable: true,
      iconCol: 0,
      iconRow: 2,
      desc: 'Đan dược chứa kim khí tinh khiết, khi dùng tăng 20 tu vi hệ Kim.'
    },
    'dan-moc': {
      id: 'dan-moc',
      name: 'Tu Luyện Đan (Mộc)',
      type: 'consumable',
      stackable: true,
      iconCol: 1,
      iconRow: 2,
      desc: 'Đan dược chứa mộc khí tinh khiết, khi dùng tăng 20 tu vi hệ Mộc.'
    },
    'dan-thuy': {
      id: 'dan-thuy',
      name: 'Tu Luyện Đan (Thủy)',
      type: 'consumable',
      stackable: true,
      iconCol: 2,
      iconRow: 2,
      desc: 'Đan dược chứa thủy khí tinh khiết, khi dùng tăng 20 tu vi hệ Thủy.'
    },
    'dan-hoa': {
      id: 'dan-hoa',
      name: 'Tu Luyện Đan (Hỏa)',
      type: 'consumable',
      stackable: true,
      iconCol: 3,
      iconRow: 2,
      desc: 'Đan dược chứa hỏa khí tinh khiết, khi dùng tăng 20 tu vi hệ Hỏa.'
    },
    'dan-tho': {
      id: 'dan-tho',
      name: 'Tu Luyện Đan (Thổ)',
      type: 'consumable',
      stackable: true,
      iconCol: 4,
      iconRow: 2,
      desc: 'Đan dược chứa thổ khí tinh khiết, khi dùng tăng 20 tu vi hệ Thổ.'
    },
    'truc-co-dan': {
      id: 'truc-co-dan',
      name: 'Trúc Cơ Đan',
      type: 'consumable',
      stackable: true,
      iconCol: 5,
      iconRow: 2,
      desc: 'Đan dược nghịch thiên cải mệnh, phụ trợ tu sĩ Luyện Khí viên mãn đột phá Trúc Cơ Kỳ.'
    },
    'tu-khi-tan': {
      id: 'tu-khi-tan',
      name: 'Tụ Khí Tán',
      type: 'consumable',
      stackable: true,
      iconCol: 5,
      iconRow: 5,
      desc: 'Bột thuốc tụ linh khí (hồ sơ 06 — đan phụ trợ tầng): tiêu hao 2 gói khi đột phá tiểu mốc từ tầng 4 lên tầng 5. Luyện tại Đan Phòng Tông Môn.'
    },
    'ngung-khi-dan': {
      id: 'ngung-khi-dan',
      name: 'Ngưng Khí Đan',
      type: 'consumable',
      stackable: true,
      iconCol: 1,
      iconRow: 0,
      desc: 'Viên đan ngưng tụ linh khí thành hình (hồ sơ 06 — đan phụ trợ tầng): tiêu hao 1 viên khi đột phá tiểu mốc từ tầng 7 lên tầng 8. Luyện tại Đan Phòng Tông Môn.'
    }
  };

  // Các nhóm trang bị (Gear Pools) & tokens rơi đồ
  var COMMON_GEAR_POOL = ['dao-cui-cu', 'ao-vai-tho'];
  var BETTER_GEAR_POOL = ['gay-co-thu', 'ao-vai-tho'];
  var LINH_THACH = 'linh-thach';
  var GEAR_WORSE = COMMON_GEAR_POOL;
  var GEAR_BETTER = BETTER_GEAR_POOL;

  // Định nghĩa chỉ số 3 loài quái vật Rừng Độc Thanh Tụy (Brief §4)
  var SPECIES = {
    thao_tinh: {
      id: 'thao_tinh',
      name: 'Thảo Tinh Nhỏ',
      element: 'moc',
      hp: 26,
      damage: 3,
      armor: 0,
      speed: 62, // px/s
      aggroRange: 170,
      attackRange: 40,
      attackCd: 1.1,
      tuViMoc: 2,
      isElite: false,
      respawnTime: 60, // 60s
      sheetAsset: 'assets/chars/thaotinh-sheet.png',
      cellW: 72,
      cellH: 72,
      feetOffsetX: 36,
      feetOffsetY: 60,
      drawScale: 1.0,
      dropTable: [
        { id: 'la-thanh-tuy', chance: 0.70, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 0.40, min: 1, max: 2, isCurrency: true },
        { gearPool: COMMON_GEAR_POOL, chance: 0.04, isGear: true }
      ]
    },
    nhen_xanh: {
      id: 'nhen_xanh',
      name: 'Nhện Rừng Xanh',
      element: 'moc',
      hp: 40,
      damage: 4,
      armor: 2,
      speed: 118,
      aggroRange: 190,
      attackRange: 44,
      attackCd: 1.3,
      tuViMoc: 3,
      slowOnHit: { ratio: 0.20, duration: 1.5 },
      isElite: false,
      respawnTime: 60,
      sheetAsset: 'assets/chars/nhenxanh-sheet.png',
      cellW: 96,
      cellH: 80,
      feetOffsetX: 48,
      feetOffsetY: 68,
      drawScale: 1.0,
      dropTable: [
        { id: 'to-nhen-xanh', chance: 0.60, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 0.50, min: 1, max: 3, isCurrency: true },
        { gearPool: COMMON_GEAR_POOL, chance: 0.05, isGear: true }
      ]
    },
    co_thu_yeu: {
      id: 'co_thu_yeu',
      name: 'Cổ Thụ Yêu (Tinh Anh)',
      element: 'moc',
      hp: 400,
      damage: 11,
      armor: 6,
      speed: 40,
      aggroRange: 210,
      attackRange: 64,
      attackCd: 1.6,
      tuViMoc: 25,
      isElite: true,
      respawnTime: 600, // 600s
      sheetAsset: 'assets/chars/cothuye-sheet.png',
      cellW: 200,
      cellH: 220,
      feetOffsetX: 100,
      feetOffsetY: 190,
      drawScale: 1.0,
      dropTable: [
        { id: 'tim-go-co-thu', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'linh-chi-rung', chance: 0.50, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 8, max: 15, isCurrency: true },
        { gearPool: BETTER_GEAR_POOL, chance: 0.35, isGear: true }
      ],
      // Kỹ năng Rễ Trói (Brief §4)
      reTroi: {
        interval: 9.0, // hồi ~9s
        telegraphRadius: 90,
        telegraphDuration: 1.2,
        damage: 12,
        snareDuration: 1.5
      }
    },
    // --- 8 loài quái vật 4 vùng săn mới (Đợt 5) ---
    bang_tinh: {
      id: 'bang_tinh',
      name: 'Băng Tinh Linh',
      element: 'thuy',
      majorPath: 'THUY',
      hp: 85,
      damage: 10,
      armor: 0,
      speed: 118,
      aggroRange: 190,
      attackRange: 46,
      attackCd: 1.2,
      leashDistance: 340,
      tuViAmount: 4,
      isElite: false,
      isBoss: false,
      respawnTime: 60,
      sheetAsset: 'assets/chars/bangtinh-sheet.png',
      cellW: 96,
      cellH: 80,
      feetOffsetX: 48,
      feetOffsetY: 68,
      drawScale: 1.0,
      dropTable: [
        { id: 'bang-tinh', chance: 0.50, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 0.18, min: 1, max: 2, isCurrency: true },
        { gearPool: COMMON_GEAR_POOL, chance: 0.04, isGear: true }
      ]
    },
    han_xa: {
      id: 'han_xa',
      name: 'Hàn Kính Thủy Xà',
      element: 'thuy',
      majorPath: 'THUY',
      hp: 950,
      damage: 18,
      armor: 6,
      speed: 96,
      aggroRange: 300,
      attackRange: 80,
      attackCd: 1.6,
      leashDistance: 900,
      tuViAmount: 45,
      isElite: true,
      isBoss: false,
      respawnTime: 600,
      sheetAsset: 'assets/chars/hanxa-sheet.png',
      cellW: 128,
      cellH: 96,
      feetOffsetX: 64,
      feetOffsetY: 82,
      drawScale: 1.0,
      dropTable: [
        { id: 'ngoc-bang-tam', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'bang-tinh', chance: 0.70, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 6, max: 10, isCurrency: true },
        { gearPool: BETTER_GEAR_POOL, chance: 0.35, isGear: true }
      ]
    },
    hoa_thu: {
      id: 'hoa_thu',
      name: 'Hỏa Nham Thú',
      element: 'hoa',
      majorPath: 'HOA',
      hp: 160,
      damage: 15,
      armor: 2,
      speed: 104,
      aggroRange: 190,
      attackRange: 46,
      attackCd: 1.2,
      leashDistance: 340,
      tuViAmount: 6,
      isElite: false,
      isBoss: false,
      respawnTime: 60,
      sheetAsset: 'assets/chars/hoathu-sheet.png',
      cellW: 96,
      cellH: 80,
      feetOffsetX: 48,
      feetOffsetY: 68,
      drawScale: 1.0,
      dropTable: [
        { id: 'hoa-tinh-tho', chance: 0.70, min: 1, max: 1, isMaterial: true },
        { id: 'da-nung', chance: 0.55, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 0.18, min: 1, max: 2, isCurrency: true },
        { gearPool: COMMON_GEAR_POOL, chance: 0.04, isGear: true }
      ]
    },
    diem_ma: {
      id: 'diem_ma',
      name: 'Xích Diệm Ma',
      element: 'hoa',
      majorPath: 'HOA',
      hp: 1500,
      damage: 26,
      armor: 11,
      speed: 68,
      aggroRange: 300,
      attackRange: 80,
      attackCd: 1.6,
      leashDistance: 900,
      tuViAmount: 70,
      isElite: true,
      isBoss: false,
      respawnTime: 600,
      sheetAsset: 'assets/chars/diemma-sheet.png',
      cellW: 112,
      cellH: 96,
      feetOffsetX: 56,
      feetOffsetY: 82,
      drawScale: 1.0,
      dropTable: [
        { id: 'hoa-tinh-tho', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'da-nung', chance: 0.70, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 8, max: 12, isCurrency: true },
        { gearPool: BETTER_GEAR_POOL, chance: 0.35, isGear: true }
      ]
    },
    sa_trung: {
      id: 'sa_trung',
      name: 'Hoàng Sa Trùng',
      element: 'tho',
      majorPath: 'THO',
      hp: 290,
      damage: 22,
      armor: 0,
      speed: 92,
      aggroRange: 190,
      attackRange: 46,
      attackCd: 1.2,
      leashDistance: 340,
      tuViAmount: 9,
      isElite: false,
      isBoss: false,
      respawnTime: 60,
      sheetAsset: 'assets/chars/satrung-sheet.png',
      cellW: 96,
      cellH: 80,
      feetOffsetX: 48,
      feetOffsetY: 68,
      drawScale: 1.0,
      dropTable: [
        { id: 'cat-tinh', chance: 0.60, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 0.18, min: 1, max: 2, isCurrency: true },
        { gearPool: COMMON_GEAR_POOL, chance: 0.04, isGear: true }
      ]
    },
    sa_tuong: {
      id: 'sa_tuong',
      name: 'Sa Thạch Tượng',
      element: 'tho',
      majorPath: 'THO',
      hp: 2600,
      damage: 40,
      armor: 14,
      speed: 44,
      aggroRange: 300,
      attackRange: 80,
      attackCd: 1.6,
      leashDistance: 900,
      tuViAmount: 110,
      isElite: true,
      isBoss: false,
      respawnTime: 600,
      sheetAsset: 'assets/chars/satuong-sheet.png',
      cellW: 128,
      cellH: 112,
      feetOffsetX: 64,
      feetOffsetY: 98,
      drawScale: 1.0,
      dropTable: [
        { id: 'ngoc-cat-tam', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'cat-tinh', chance: 0.70, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 10, max: 16, isCurrency: true },
        { gearPool: BETTER_GEAR_POOL, chance: 0.35, isGear: true }
      ]
    },
    kiem_linh: {
      id: 'kiem_linh',
      name: 'Tàn Kiếm Linh',
      element: 'kim',
      majorPath: 'KIM',
      hp: 590,
      damage: 34,
      armor: 0,
      speed: 126,
      aggroRange: 190,
      attackRange: 46,
      attackCd: 1.2,
      leashDistance: 340,
      tuViAmount: 14,
      isElite: false,
      isBoss: false,
      respawnTime: 60,
      sheetAsset: 'assets/chars/kiemlinh-sheet.png',
      cellW: 80,
      cellH: 80,
      feetOffsetX: 40,
      feetOffsetY: 66,
      drawScale: 1.0,
      dropTable: [
        { id: 'hon-kiem-nho', chance: 0.55, min: 1, max: 1, isMaterial: true },
        { id: 'manh-kiem-gay', chance: 0.30, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 0.20, min: 1, max: 3, isCurrency: true },
        { gearPool: COMMON_GEAR_POOL, chance: 0.05, isGear: true }
      ]
    },
    thiet_giap: {
      id: 'thiet_giap',
      name: 'Huyền Thiết Giáp Thú',
      element: 'kim',
      majorPath: 'KIM',
      hp: 4200,
      damage: 55,
      armor: 16,
      speed: 58,
      aggroRange: 300,
      attackRange: 80,
      attackCd: 1.6,
      leashDistance: 900,
      tuViAmount: 160,
      isElite: true,
      isBoss: false,
      respawnTime: 600,
      sheetAsset: 'assets/chars/thietgiap-sheet.png',
      cellW: 128,
      cellH: 96,
      feetOffsetX: 64,
      feetOffsetY: 82,
      drawScale: 1.0,
      dropTable: [
        { id: 'loi-huyen-thiet', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'manh-kiem-gay', chance: 0.70, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 14, max: 20, isCurrency: true },
        { gearPool: BETTER_GEAR_POOL, chance: 0.40, isGear: true }
      ]
    },
    boss_moc_linh_co_vuong: {
      id: 'boss_moc_linh_co_vuong',
      name: 'Mộc Linh Cổ Vương',
      element: 'moc',
      hp: 1200,
      damage: 15,
      armor: 8,
      speed: 46,
      aggroRange: 240,
      attackRange: 92,
      attackCd: 1.8,
      tuViAmount: 60,
      isElite: true,
      isBoss: true,
      respawnTime: 14400, // Chu kỳ boss trấn vùng 4 giờ (Hồ sơ 02)
      sheetAsset: 'assets/chars/boss-moc-sheet.png',
      skillAsset: 'assets/chars/boss-moc-skill-sheet.png',
      cellW: 280,
      cellH: 300,
      feetOffsetX: 140,
      feetOffsetY: 258,
      drawScale: 1.0,
      dropTable: [
        { id: 'nguyen-tinh-moc', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'tim-go-co-thu', chance: 1.0, min: 2, max: 2, isMaterial: true },
        { id: 'linh-chi-ngan-nam', chance: 0.15, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 40, max: 80, isCurrency: true }
      ],
      // Chiêu trấn vùng: Rễ Trói Diện Rộng quanh người chơi
      bossSkill: {
        interval: 10.0,
        telegraphRadius: 115,
        telegraphDuration: 1.3,
        damage: 16,
        snareDuration: 1.5,
        center: 'player',
        firstDelay: 5.0
      }
    },
    boss_han_kinh_giao_vuong: {
      id: 'boss_han_kinh_giao_vuong',
      name: 'Hàn Kính Giao Vương',
      element: 'thuy',
      hp: 2400,
      damage: 20,
      armor: 10,
      speed: 50,
      aggroRange: 240,
      attackRange: 92,
      attackCd: 1.7,
      tuViAmount: 90,
      isElite: true,
      isBoss: true,
      respawnTime: 14400,
      sheetAsset: 'assets/chars/boss-hanky-sheet.png',
      skillAsset: 'assets/chars/boss-hanky-skill-sheet.png',
      cellW: 280,
      cellH: 300,
      feetOffsetX: 140,
      feetOffsetY: 258,
      drawScale: 1.0,
      dropTable: [
        { id: 'nguyen-tinh-thuy', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'bang-tuy', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'bang-tuy-ngan-nam', chance: 0.15, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 60, max: 110, isCurrency: true }
      ],
      // Chiêu trấn vùng: Bão Tuyết quanh thân khi máu xuống thấp (Hồ sơ 01)
      bossSkill: {
        interval: 9.0,
        telegraphRadius: 150,
        telegraphDuration: 1.4,
        damage: 22,
        slowRatio: 0.45,
        slowDuration: 2.5,
        center: 'self',
        lowHpOnly: true,
        lowHpThreshold: 0.4,
        firstDelay: 4.0
      }
    },
    boss_xich_diem_viem_quan: {
      id: 'boss_xich_diem_viem_quan',
      name: 'Xích Diệm Viêm Quân',
      element: 'hoa',
      hp: 4200,
      damage: 26,
      armor: 13,
      speed: 48,
      aggroRange: 240,
      attackRange: 92,
      attackCd: 1.7,
      tuViAmount: 130,
      isElite: true,
      isBoss: true,
      respawnTime: 14400,
      sheetAsset: 'assets/chars/boss-viemquan-sheet.png',
      skillAsset: 'assets/chars/boss-viemquan-skill-sheet.png',
      cellW: 280,
      cellH: 300,
      feetOffsetX: 140,
      feetOffsetY: 258,
      drawScale: 1.0,
      dropTable: [
        { id: 'nguyen-tinh-hoa', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'hoa-tinh-tho', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'loi-viem-quan', chance: 0.15, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 90, max: 160, isCurrency: true }
      ],
      // Chiêu trấn vùng: Cột Dung Nham dựng tại vị trí người chơi
      bossSkill: {
        interval: 8.0,
        telegraphRadius: 85,
        telegraphDuration: 1.1,
        damage: 30,
        center: 'player',
        firstDelay: 5.0
      }
    },
    boss_hoang_sa_co_vuong: {
      id: 'boss_hoang_sa_co_vuong',
      name: 'Hoàng Sa Cổ Vương',
      element: 'tho',
      hp: 9000,
      damage: 38,
      armor: 18,
      speed: 44,
      aggroRange: 240,
      attackRange: 92,
      attackCd: 1.9,
      tuViAmount: 220,
      isElite: true,
      isBoss: true,
      respawnTime: 14400,
      sheetAsset: 'assets/chars/boss-hoangsa-sheet.png',
      skillAsset: 'assets/chars/boss-hoangsa-skill-sheet.png',
      cellW: 280,
      cellH: 300,
      feetOffsetX: 140,
      feetOffsetY: 258,
      drawScale: 1.0,
      dropTable: [
        { id: 'nguyen-tinh-tho', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'dia-tam-thach', chance: 0.15, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 150, max: 260, isCurrency: true }
      ],
      // Chiêu trấn vùng: Hố Cát Sụp tại vị trí người chơi, trói chân ngắn
      bossSkill: {
        interval: 11.0,
        telegraphRadius: 125,
        telegraphDuration: 1.3,
        damage: 34,
        snareDuration: 1.0,
        center: 'player',
        firstDelay: 6.0
      }
    },
    boss_tan_kiem_vo_danh: {
      id: 'boss_tan_kiem_vo_danh',
      name: 'Tàn Kiếm Vô Danh',
      element: 'kim',
      hp: 14000,
      damage: 48,
      armor: 22,
      speed: 56,
      aggroRange: 250,
      attackRange: 100,
      attackCd: 1.6,
      tuViAmount: 300,
      isElite: true,
      isBoss: true,
      respawnTime: 14400,
      sheetAsset: 'assets/chars/boss-tankiem-sheet.png',
      skillAsset: 'assets/chars/boss-tankiem-skill-sheet.png',
      cellW: 280,
      cellH: 300,
      feetOffsetX: 140,
      feetOffsetY: 244,
      drawScale: 1.0,
      dropTable: [
        { id: 'nguyen-tinh-kim', chance: 1.0, min: 1, max: 1, isMaterial: true },
        { id: 'mui-kiem-vo-danh', chance: 0.15, min: 1, max: 1, isMaterial: true },
        { id: 'linh-thach', chance: 1.0, min: 220, max: 380, isCurrency: true }
      ],
      // Chiêu trấn vùng: Kiếm Vũ quanh thân ở pha cuối (Hồ sơ 01)
      bossSkill: {
        interval: 9.0,
        telegraphRadius: 175,
        telegraphDuration: 1.5,
        damage: 42,
        center: 'self',
        lowHpOnly: true,
        lowHpThreshold: 0.5,
        firstDelay: 4.0
      }
    }
  };

  // Bí danh tương thích cho nhiệm vụ và sự kiện
  SPECIES.bang_xa = SPECIES.han_xa;
  SPECIES.boss_bang_xa = SPECIES.boss_han_kinh_giao_vuong;
  SPECIES.boss_co_thu = SPECIES.boss_moc_linh_co_vuong;

  /**
   * Tính toán rớt đồ từ bảng rớt của quái có áp dụng thưởng Chuỗi Săn (Brief §6)
   * bonus = min(50, floor(chain/10) * 5)%
   */
  function rollDrops(speciesId, chainCount) {
    var spec = SPECIES[speciesId];
    if (!spec || !spec.dropTable) return [];
    var chain = chainCount || 0;
    var matBonusPct = Math.min(50, Math.floor(chain / 10) * 5); // 0..50
    var matMultiplier = 1.0 + (matBonusPct / 100.0);

    var drops = [];
    for (var i = 0; i < spec.dropTable.length; i++) {
      var entry = spec.dropTable[i];
      var effectiveChance = entry.chance;
      if (entry.isMaterial) {
        effectiveChance = Math.min(1.0, entry.chance * matMultiplier);
      }

      if (Math.random() <= effectiveChance) {
        var itemId = entry.id;
        if (entry.gearPool && entry.gearPool.length > 0) {
          var gIdx = Math.floor(Math.random() * entry.gearPool.length);
          itemId = entry.gearPool[gIdx];
        }
        var count = 1;
        if (entry.min !== undefined && entry.max !== undefined) {
          count = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
        }
        drops.push({
          itemId: itemId,
          count: count
        });
      }
    }
    return drops;
  }

  /**
   * Tạo thực thể quái vật mới
   */
  var monsterIdCounter = 1;
  function createMonster(speciesId, x, y, homeX, homeY, options) {
    var spec = SPECIES[speciesId];
    if (!spec) throw new Error('Unknown monster species: ' + speciesId);

    var opts = options || {};
    var hX = (homeX !== undefined) ? homeX : x;
    var hY = (homeY !== undefined) ? homeY : y;

    return {
      id: 'm_' + (monsterIdCounter++),
      speciesId: speciesId,
      name: spec.name,
      element: spec.element,
      isElite: spec.isElite,
      maxHp: spec.hp,
      hp: spec.hp,
      damage: spec.damage,
      armor: spec.armor,
      speed: spec.speed,
      aggroRange: spec.aggroRange,
      attackRange: spec.attackRange,
      attackCd: spec.attackCd,
      tuViMoc: spec.tuViMoc,
      tuViElement: spec.element,
      tuViAmount: (spec.tuViAmount !== undefined) ? spec.tuViAmount : (spec.tuViMoc || 0),
      isBoss: !!spec.isBoss,
      slowOnHit: spec.slowOnHit || null,

      // Vị trí và lãnh thổ
      x: x,
      y: y,
      homeX: hX,
      homeY: hY,
      dir: 0, // 0: right/down, 1: left... (dùng flipX theo hướng vận tốc)
      facingLeft: false,

      // Máy trạng thái: roam, aggro, attack, return, hit, dead
      state: opts.state || 'roam',
      spawnGraceTimer: opts.spawnGraceTimer !== undefined ? opts.spawnGraceTimer : 2.0, // 2s ân hạn hồi sinh
      leashDistance: (spec.leashDistance !== undefined) ? spec.leashDistance : 340,

      // Đồng hồ đếm thời gian
      attackTimer: 0,
      hitStunTimer: 0,
      roamPauseTimer: 0,
      roamTarget: null,
      deathTimer: 0,

      // Đợt K2: trạng thái người chơi áp lên (làm chậm / đốt theo thời gian) —
      // engine ghi, updateMonster ở đây chỉ đọc làm chậm để tính tốc độ.
      slowTimer: 0,     // > 0: đang bị làm chậm
      slowRatio: 0,     // tỉ lệ giảm tốc (0.4 = chậm 40%)
      dotTimer: 0,      // > 0: đang bị đốt — engine tự trừ máu theo dotDps
      dotDps: 0,        // sát thương mỗi giây của hiệu ứng đốt
      dotElem: 'hoa',   // hệ của hiệu ứng đốt (để hiện số sát thương đúng màu)
      dotSource: null,  // nguồn gây đốt (engine gắn để tính công trạng hạ quái)

      // Đặc tính tinh anh
      summonedAdds: false,
      reTroiTimer: spec.bossSkill ? (spec.bossSkill.firstDelay || 5.0) : (spec.reTroi ? 4.0 : 0), // đếm chiêu đặc biệt (rễ trói / chiêu boss)
      skillAnimTimer: 0, // > 0 khi đang diễn hoạt ảnh chiêu boss (engine dùng)
      activeTelegraph: null, // { x, y, radius, timer, duration, damage, snare }

      // Hoạt ảnh
      animRow: 0,
      animCol: 0,
      animTime: 0
    };
  }

  /**
   * Cập nhật máy trạng thái quái vật theo thời gian (dt tính bằng giây)
   */
  function updateMonster(m, playerPos, dt, options) {
    var opts = options || {};
    var spec = SPECIES[m.speciesId];

    // Cập nhật ân hạn xuất hiện
    if (m.spawnGraceTimer > 0) {
      m.spawnGraceTimer = Math.max(0, m.spawnGraceTimer - dt);
    }

    // Nếu đã chết
    if (m.hp <= 0 && m.state !== 'dead') {
      m.state = 'dead';
      m.deathTimer = 0;
      m.animRow = 4; // Hàng death
      m.animCol = 0;
      return;
    }

    if (m.state === 'dead') {
      m.deathTimer += dt;
      return;
    }

    // Cập nhật hoạt ảnh và thời gian hồi đòn
    m.animTime += dt;
    if (m.attackTimer > 0) {
      m.attackTimer = Math.max(0, m.attackTimer - dt);
    }
    // Đợt K2: làm chậm tự hết hạn (hệ số tốc độ tính ở spdMul bên dưới);
    // hiệu ứng đốt do engine tự trừ máu (nơi duy nhất được phép kết liễu).
    if (m.slowTimer > 0) m.slowTimer = Math.max(0, m.slowTimer - dt);
    if (m.dotTimer > 0) m.dotTimer = Math.max(0, m.dotTimer - dt);
    var spdMul = (m.slowTimer > 0 && m.slowRatio > 0) ? (1 - m.slowRatio) : 1;

    // Khoảng cách tới điểm nhà (home) và tới người chơi
    var distHome = Math.hypot(m.x - m.homeX, m.y - m.homeY);
    var distPlayer = playerPos ? Math.hypot(m.x - playerPos.x, m.y - playerPos.y) : 99999;

    // Kỹ năng đặc biệt của tinh anh/boss: Rễ Trói (co_thu_yeu) hoặc chiêu trấn vùng (bossSkill).
    // Cấu hình hợp nhất: reTroi cũ được bọc thành skillCfg có center 'player' để giữ nguyên hành vi.
    var skillCfg = spec.bossSkill || (spec.reTroi ? {
      interval: spec.reTroi.interval,
      telegraphRadius: spec.reTroi.telegraphRadius,
      telegraphDuration: spec.reTroi.telegraphDuration,
      damage: spec.reTroi.damage,
      snareDuration: spec.reTroi.snareDuration,
      center: 'player'
    } : null);
    if (m.isElite && skillCfg && m.state !== 'return') {
      m.reTroiTimer -= dt;
      if (m.reTroiTimer <= 0 && playerPos && distPlayer < 520) {
        if (skillCfg.lowHpOnly && m.hp > m.maxHp * (skillCfg.lowHpThreshold || 0.4)) {
          // Chưa tới pha dùng chiêu — hẹn kiểm lại sau 1 giây
          m.reTroiTimer = 1.0;
        } else {
          m.reTroiTimer = skillCfg.interval;
          m.activeTelegraph = {
            x: skillCfg.center === 'self' ? m.x : playerPos.x,
            y: skillCfg.center === 'self' ? m.y : playerPos.y,
            radius: skillCfg.telegraphRadius,
            timer: skillCfg.telegraphDuration,
            damage: skillCfg.damage,
            snareDuration: skillCfg.snareDuration || 0,
            slowRatio: skillCfg.slowRatio || 0,
            slowDuration: skillCfg.slowDuration || 0,
            element: spec.element,
            isBossSkill: !!spec.bossSkill
          };
        }
      }
    }

    // 1. Kiểm tra Leash: khoảng cách từ nhà > 340px -> return
    if ((m.state === 'aggro' || m.state === 'attack') && distHome > m.leashDistance) {
      m.state = 'return';
      m.roamTarget = null;
    }

    // 2. Xử lý theo từng trạng thái
    switch (m.state) {
      case 'return':
        // Hồi máu 20% mỗi giây khi quay về
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.20 * dt);
        // Không nhận aggro cho tới khi về nhà
        var dxHome = m.homeX - m.x;
        var dyHome = m.homeY - m.y;
        var dHome = Math.hypot(dxHome, dyHome);
        if (dHome <= 8) {
          m.x = m.homeX;
          m.y = m.homeY;
          m.hp = m.maxHp;
          m.state = 'roam';
          m.roamTarget = null;
        } else {
          var moveStep = m.speed * 1.3 * spdMul * dt;
          m.x += (dxHome / dHome) * Math.min(moveStep, dHome);
          m.y += (dyHome / dHome) * Math.min(moveStep, dHome);
          m.facingLeft = (dxHome < 0);
          m.animRow = 1; // Walk
        }
        break;

      case 'roam':
        m.animRow = 0; // Idle
        // Kiểm tra vào phạm vi aggro nếu đã hết ân hạn 2s
        if (playerPos && m.spawnGraceTimer <= 0 && distPlayer <= m.aggroRange) {
          m.state = 'aggro';
          m.roamTarget = null;
          break;
        }

        // Lang thang quanh nhà trong bán kính ~100px
        if (m.roamPauseTimer > 0) {
          m.roamPauseTimer -= dt;
        } else {
          if (!m.roamTarget) {
            var angle = Math.random() * Math.PI * 2;
            var rDist = Math.random() * 80;
            m.roamTarget = {
              x: m.homeX + Math.cos(angle) * rDist,
              y: m.homeY + Math.sin(angle) * rDist
            };
          }
          var rx = m.roamTarget.x - m.x;
          var ry = m.roamTarget.y - m.y;
          var rd = Math.hypot(rx, ry);
          if (rd <= 6) {
            m.roamTarget = null;
            m.roamPauseTimer = 2.0 + Math.random() * 2.0; // Nghỉ 2-4s
          } else {
            var rstep = (m.speed * 0.5 * spdMul) * dt;
            m.x += (rx / rd) * Math.min(rstep, rd);
            m.y += (ry / rd) * Math.min(rstep, rd);
            m.facingLeft = (rx < 0);
            m.animRow = 1; // Walk
          }
        }
        break;

      case 'aggro':
        m.animRow = 1; // Walk
        if (!playerPos) {
          m.state = 'roam';
          break;
        }
        // Nếu trong tầm đánh -> chuyển attack
        if (distPlayer <= m.attackRange) {
          m.state = 'attack';
          break;
        }
        // Đuổi theo người chơi
        var px = playerPos.x - m.x;
        var py = playerPos.y - m.y;
        if (distPlayer > 0) {
          var aStep = m.speed * spdMul * dt;
          m.x += (px / distPlayer) * aStep;
          m.y += (py / distPlayer) * aStep;
          m.facingLeft = (px < 0);
        }
        break;

      case 'attack':
        m.animRow = 2; // Attack
        if (!playerPos || distPlayer > m.attackRange + 25) {
          m.state = 'aggro';
          break;
        }
        m.facingLeft = (playerPos.x < m.x);
        // Tấn công khi hết cooldown
        if (m.attackTimer <= 0) {
          m.attackTimer = m.attackCd;
          if (typeof opts.onMonsterAttack === 'function') {
            opts.onMonsterAttack(m, playerPos);
          }
        }
        break;

      case 'hit':
        m.animRow = 3; // Hit
        m.hitStunTimer -= dt;
        if (m.hitStunTimer <= 0) {
          m.state = 'aggro';
        }
        break;
    }
  }

  /**
   * Gọi khi quái vật bị tấn công
   */
  function damageMonster(m, damage, playerPos) {
    if (m.state === 'dead') return 0;
    m.hp = Math.max(0, m.hp - damage);

    if (m.hp <= 0) {
      m.state = 'dead';
      m.deathTimer = 0;
      m.animRow = 4;
      return damage;
    }

    // Bị đánh thì aggro ngay (nếu không đang leash)
    if (m.state !== 'return') {
      m.state = 'aggro';
    }

    // Choáng nhẹ
    m.hitStunTimer = 0.2;

    return damage;
  }

  // Định nghĩa các bầy quái vật trên bản đồ Rừng Độc (Brief §4)
  // Packs: Thảo Tinh x3 packs of 4-5 (outer ring), Nhện x2 packs of 3 (mid), Cổ Thụ Yêu x1 (NE)
  var RUNG_DOC_PACKS = [
    // Pack 1 Thảo Tinh (Vành ngoài Tây-Nam: gần đường vào từ cổng Miếu)
    {
      id: 'pack_thaotinh_1',
      speciesId: 'thao_tinh',
      anchor: { x: 420, y: 750 },
      count: 4,
      spread: 60
    },
    // Pack 2 Thảo Tinh (Vành ngoài Tây-Bắc)
    {
      id: 'pack_thaotinh_2',
      speciesId: 'thao_tinh',
      anchor: { x: 550, y: 360 },
      count: 5,
      spread: 70
    },
    // Pack 3 Thảo Tinh (Vành ngoài Nam-Trung)
    {
      id: 'pack_thaotinh_3',
      speciesId: 'thao_tinh',
      anchor: { x: 920, y: 920 },
      count: 4,
      spread: 65
    },
    // Pack 4 Nhện Xanh (Vành giữa Bắc)
    {
      id: 'pack_nhen_1',
      speciesId: 'nhen_xanh',
      anchor: { x: 1080, y: 460 },
      count: 3,
      spread: 50
    },
    // Pack 5 Nhện Xanh (Vành giữa Đông-Nam)
    {
      id: 'pack_nhen_2',
      speciesId: 'nhen_xanh',
      anchor: { x: 1460, y: 905 },
      count: 3,
      spread: 55
    },
    // Anchor Cổ Thụ Yêu (Gốc đại cổ thụ Đông-Bắc, Vành trong)
    {
      id: 'pack_cothuye',
      speciesId: 'co_thu_yeu',
      anchor: { x: 1440, y: 720 },
      count: 1,
      spread: 0
    },
    // Boss trấn vùng Rừng Độc — Mộc Linh Cổ Vương (dưới chân đại thụ cổ)
    {
      id: 'pack_boss_moc_linh',
      speciesId: 'boss_moc_linh_co_vuong',
      anchor: { x: 1640, y: 745 },
      count: 1,
      spread: 0
    }
  ];

  exports.ITEM_DEFS = ITEM_DEFS;
  exports.COMMON_GEAR_POOL = COMMON_GEAR_POOL;
  exports.BETTER_GEAR_POOL = BETTER_GEAR_POOL;
  exports.LINH_THACH = LINH_THACH;
  exports.GEAR_WORSE = GEAR_WORSE;
  exports.GEAR_BETTER = GEAR_BETTER;
  exports.SPECIES = SPECIES;
  exports.rollDrops = rollDrops;
  exports.createMonster = createMonster;
  exports.updateMonster = updateMonster;
  exports.damageMonster = damageMonster;
  exports.RUNG_DOC_PACKS = RUNG_DOC_PACKS;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameMonsters = {}));
