/**
 * skills.js — Khung kỹ năng Ngũ Hành Vô Địch (Đợt K1)
 *
 * Chuyển PHẦN MÁY của hệ bí pháp Vô Sắc sang (hồ sơ 13A): định nghĩa chiêu
 * dạng dữ liệu (bậc/thức, hồi chiêu, tầm, điều kiện mở), hàm kiểm tra tung
 * chiêu thuần trả kết quả có cấu trúc { ok, code, reason } (đúng khuôn
 * castWord của Vô Sắc), và ngôn ngữ hình theo hệ để engine hiệu ứng dùng.
 * Nội dung chiêu là của Ngũ Hành: tổ chức theo NĂM ĐƯỜNG (Kim/Mộc/Thủy/
 * Hỏa/Thổ) — K2 sẽ viết 5 họ chiêu + Liên Hoàn trên chính schema này.
 *
 * Module thuần: Node-loadable (module.exports) và chạy trên trình duyệt
 * (window.GameSkills). Engine (engine.js) và giao diện (ui.js) chỉ đọc
 * dữ liệu từ đây — không nơi nào khác được gán cứng thông số chiêu.
 */

(function (exports) {
  'use strict';

  /* ------------------------------------------------------------------
   * Ngôn ngữ hình theo hệ (hồ sơ 13B: mỗi hệ một ngôn ngữ hình riêng,
   * phân biệt rõ như Thất Tinh = sao / Thanh Phong = gió của Vô Sắc).
   * core = màu lõi sáng, glow = màu hào quang, deep = màu đậm viền/bóng,
   * motif = kiểu hình đầu đạn/hình mặt đất, trail = kiểu vệt đuôi.
   * ------------------------------------------------------------------ */
  var ELEMENTS = {
    kim: {
      id: 'kim', name: 'Kim',
      core: '#f4f8ff', glow: '#a9c6ff', deep: '#5f7fb8',
      motif: 'blade', trail: 'spark',
      desc: 'Lưỡi và tia sắc lạnh, vệt đuôi tóe tia kim loại'
    },
    moc: {
      id: 'moc', name: 'Mộc',
      core: '#d9ffdf', glow: '#55d882', deep: '#2c7a44',
      motif: 'leaf', trail: 'leaf',
      desc: 'Lá, dây leo, độc — cong mềm, vệt đuôi lá rơi'
    },
    thuy: {
      id: 'thuy', name: 'Thủy',
      core: '#dcf7ff', glow: '#57c8f2', deep: '#2b6f9e',
      motif: 'drop', trail: 'wave',
      desc: 'Băng, sóng, gương — giọt và gợn tròn lan'
    },
    hoa: {
      id: 'hoa', name: 'Hỏa',
      core: '#fff3c4', glow: '#ff9a3d', deep: '#c33d1e',
      motif: 'flame', trail: 'ember',
      desc: 'Lửa, dung nham, nổ — vệt đuôi tàn lửa bốc lên'
    },
    tho: {
      id: 'tho', name: 'Thổ',
      core: '#ffefc4', glow: '#d9b45f', deep: '#8a6a2f',
      motif: 'shard', trail: 'dust',
      desc: 'Đá, cát, chấn địa — mảnh vỡ và bụi đất rơi xuống'
    },
    neutral: {
      id: 'neutral', name: 'Trung tính',
      core: '#fff6d8', glow: '#e8dcc0', deep: '#9a8a68',
      motif: 'slash', trail: 'plain',
      desc: 'Đòn vật lý thuần, vệt chém sáng nhạt'
    },
    nguhanh: {
      id: 'nguhanh', name: 'Ngũ Hành',
      core: '#ffffff', glow: '#f3d74e', deep: '#7a5c14',
      motif: 'star', trail: 'spark',
      desc: 'Năm sắc tương sinh quyện một — đòn hợp kích của vòng ngũ hành'
    },
    amduong: {
      id: 'amduong', name: 'Âm Dương',
      core: '#ffffff', glow: '#ffd968', deep: '#3a3a44',
      motif: 'taiji', trail: 'swirl',
      desc: 'Thái cực âm dương xoay tròn — vàng kim và mực đen quyện nhau'
    }
  };

  /** Năm đường tu hợp lệ (path = null nghĩa là chiêu trung tính/không đường). */
  var PATHS = ['kim', 'moc', 'thuy', 'hoa', 'tho'];

  /** Vòng tương sinh: SINH_MAP[a] = hệ mà a sinh ra (cho K2: hao phí/Liên Hoàn). */
  var SINH_MAP = { kim: 'thuy', thuy: 'moc', moc: 'hoa', hoa: 'tho', tho: 'kim' };
  /** Vòng tương khắc: KHAC_MAP[a] = hệ mà a khắc (khớp combat.js). */
  var KHAC_MAP = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' };

  var COST_TYPES = ['linhLuc'];           // K2+ có thể thêm 'hp'...
  var TARGET_MODES = ['single', 'self', 'point'];
  var DELIVERIES = ['melee', 'projectile', 'instant', 'area', 'rain', 'self'];
  var STATUS_TYPES = ['snare', 'slow', 'stun', 'dot'];

  /* ------------------------------------------------------------------
   * SCHEMA MỘT CHIÊU (mọi trường đều là dữ liệu, engine không đoán):
   *   id          khóa duy nhất, ổn định vĩnh viễn (save/UI bám vào id)
   *   name        tên hiển thị đầy đủ
   *   shortName   tên ngắn trên nút chiêu
   *   family      họ chiêu (vd 'co-ban', 'moc') — K2 nhóm theo họ
   *   path        đường hệ: 'kim'|'moc'|'thuy'|'hoa'|'tho'|null (null = trung tính)
   *   tier        bậc (1..; hiệu ứng tại điểm phát mạnh dần theo bậc)
   *   thuc        thức thứ mấy trong họ (1..)
   *   unlock      null = dùng ngay; hoặc { type:'pathTuVi', path, min }:
   *               mở khi tu vi của đường path đạt min (cấp đường);
   *               hoặc { type:'harmony', min }: mở khi Hài Hòa ≥ min.
   *   element     (tùy chọn) hệ sát thương riêng khi khác đường
   *               ('nguhanh' cho hợp kích, 'amduong' cho Thái Cực).
   *   radius      bán kính tác động, chỉ khi delivery = 'area'.
   *   provisional true = số theo KHUÔN CHIÊU CHỨNG, chờ đợt thiết kế
   *               kỹ năng riêng chốt số cuối (hồ sơ 02 §5 để mở).
   *   cost        { type:'linhLuc', amount } — tài nguyên trừ khi tung chiêu
   *   cooldown    giây hồi chiêu (bắt đầu tính từ lúc bắt đầu vận chiêu)
   *   castTime    giây vận chiêu trước khi chiêu phát ra (0 = tức thì)
   *   range       tầm tối đa (px) tới mục tiêu
   *   targetMode  'single' (một mục tiêu) | 'self' | 'point' (điểm mặt đất)
   *   delivery    cách chiêu tới đích: 'melee' | 'projectile' | 'instant'
   *               | 'area' | 'rain' | 'self'
   *   projectileSpeed  px/giây, chỉ khi delivery = 'projectile'
   *   damage      { stat:'attack', ratio, flat } — raw = attackNền × ratio + flat,
   *               sau đó chạy qua khung combat.js (khắc hệ, giáp cong, bạo kích)
   *   status      null hoặc { type:'snare'|'slow'|'stun'|'dot', duration, ... }
   *   effect      id hiệu ứng trong engine VFX (xem engine.js VFX)
   *   icon        class CSS của icon trên nút chiêu
   *   sfx         khóa âm thanh khi phát chiêu (ánh xạ sang audio.js)
   *   desc        mô tả ngắn cho tooltip/sổ chiêu
   * ------------------------------------------------------------------ */
  var SKILL_REGISTRY = [
    {
      id: 'basic',
      name: 'Chém Dao Củi',
      shortName: 'Đánh',
      family: 'co-ban',
      path: null,
      tier: 1,
      thuc: 1,
      unlock: null,
      cost: { type: 'linhLuc', amount: 0 },
      cooldown: 0.45,
      castTime: 0,
      range: 55,
      targetMode: 'single',
      delivery: 'melee',
      damage: { stat: 'attack', ratio: 1.0, flat: 0 },
      status: null,
      effect: 'slash_basic',
      icon: 'skill-basic',
      sfx: 'slash',
      desc: 'Đòn chém thường bằng dao củi — kênh đánh tự động khi đã chọn mục tiêu.'
    },
    {
      id: 'phi_diep',
      name: 'Phi Diệp Trảm',
      shortName: 'Phi Diệp',
      family: 'moc',
      path: 'moc',
      tier: 1,
      thuc: 1,
      unlock: { type: 'pathTuVi', path: 'moc', min: 0 },
      cost: { type: 'linhLuc', amount: 4 },
      cooldown: 3.0,
      castTime: 0.22,
      range: 280,
      targetMode: 'single',
      delivery: 'projectile',
      projectileSpeed: 520,
      damage: { stat: 'attack', ratio: 1.6, flat: 0 },
      status: null,
      effect: 'leaf_projectile',
      icon: 'skill-phi-diep',
      sfx: 'leafCast',
      desc: 'Phóng một lá linh khí sắc bén truy đuổi mục tiêu, gây 160% sát thương đòn thường.'
    },
    {
      id: 'day_leo',
      name: 'Dây Leo Trói',
      shortName: 'Dây Leo',
      family: 'moc',
      path: 'moc',
      tier: 1,
      thuc: 2,
      unlock: { type: 'pathTuVi', path: 'moc', min: 0 },
      cost: { type: 'linhLuc', amount: 6 },
      cooldown: 8.0,
      castTime: 0.3,
      range: 240,
      targetMode: 'single',
      delivery: 'instant',
      damage: { stat: 'attack', ratio: 0.8, flat: 0 },
      status: { type: 'snare', duration: 1.2 },
      effect: 'vine_snare',
      icon: 'skill-day-leo',
      sfx: 'vineSnare',
      desc: 'Dây leo trồi lên trói chân mục tiêu 1,2 giây và gây 80% sát thương đòn thường.'
    },
    /* ==================================================================
     * ĐỢT K2 — Nội dung năm họ bí pháp (hồ sơ 03 §1.4: mỗi họ 3 chiêu ở
     * mức cơ bản, mở theo cấp đường) + họ hợp kích (hồ sơ 02 §5) + Thái
     * Cực Chưởng (bảng chiêu Bui gửi 2026-11-09).
     * Kỷ luật số: hồ sơ chốt CẤU TRÚC (3 chiêu/họ, vòng tương sinh, mốc
     * Hài Hòa của hợp kích) nhưng để số từng chiêu cho "đợt thiết kế kỹ
     * năng riêng" (hồ sơ 02 §5). Các chiêu dưới đây dùng KHUÔN CHIÊU
     * CHỨNG của bản live (Phi Diệp: đạn ×1,6, tốn 4, hồi 3,0s; Dây Leo:
     * khống chế ×0,8, tốn 6, hồi 8,0s, trạng thái 1,2s) đổi theo ngôn
     * ngữ hình từng hệ (hồ sơ 13B) — mọi chiêu khuôn đều gắn
     * provisional: true để đợt thiết kế kỹ năng riêng chốt số cuối.
     * Hai chiêu chứng Phi Diệp/Dây Leo ở trên giữ nguyên từng con số.
     * ================================================================== */
    {
      id: 'kim_mang',
      name: 'Kim Mang Xuyên',
      shortName: 'Kim Mang',
      family: 'kim',
      path: 'kim',
      tier: 1,
      thuc: 1,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'kim', min: 0 },
      cost: { type: 'linhLuc', amount: 4 },
      cooldown: 3.0,
      castTime: 0.22,
      range: 280,
      targetMode: 'single',
      delivery: 'projectile',
      projectileSpeed: 520,
      damage: { stat: 'attack', ratio: 1.6, flat: 0 },
      status: null,
      effect: 'kim_blade_projectile',
      icon: 'skill-elem-kim',
      sfx: 'slash',
      desc: 'Một tia kim mang sắc lạnh xuyên thẳng mục tiêu, gây 160% sát thương đòn thường.'
    },
    {
      id: 'kim_cham',
      name: 'Kim Châm Định Thân',
      shortName: 'Kim Châm',
      family: 'kim',
      path: 'kim',
      tier: 1,
      thuc: 2,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'kim', min: 0 },
      cost: { type: 'linhLuc', amount: 6 },
      cooldown: 8.0,
      castTime: 0.3,
      range: 240,
      targetMode: 'single',
      delivery: 'instant',
      damage: { stat: 'attack', ratio: 0.8, flat: 0 },
      status: { type: 'stun', duration: 1.2 },
      effect: 'kim_needle_pin',
      icon: 'skill-elem-kim',
      sfx: 'slash',
      desc: 'Kim châm ghim trúng huyệt, làm mục tiêu choáng 1,2 giây và gây 80% sát thương đòn thường.'
    },
    {
      id: 'kim_nhan_bao',
      name: 'Kim Nhận Bạo',
      shortName: 'Nhận Bạo',
      family: 'kim',
      path: 'kim',
      tier: 1,
      thuc: 3,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'kim', min: 50 },
      cost: { type: 'linhLuc', amount: 10 },
      cooldown: 12.0,
      castTime: 0.4,
      range: 260,
      targetMode: 'single',
      delivery: 'area',
      radius: 90,
      damage: { stat: 'attack', ratio: 1.2, flat: 0 },
      status: null,
      effect: 'kim_blade_burst',
      icon: 'skill-elem-kim',
      sfx: 'slash',
      desc: 'Vạn lưỡi kim nhận nổ tung quanh mục tiêu, gây 120% sát thương đòn thường cho mọi địch trong vùng.'
    },
    {
      id: 'doc_bung',
      name: 'Độc Tụy Bùng',
      shortName: 'Độc Bùng',
      family: 'moc',
      path: 'moc',
      tier: 1,
      thuc: 3,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'moc', min: 50 },
      cost: { type: 'linhLuc', amount: 10 },
      cooldown: 12.0,
      castTime: 0.4,
      range: 260,
      targetMode: 'single',
      delivery: 'area',
      radius: 90,
      damage: { stat: 'attack', ratio: 1.2, flat: 0 },
      status: { type: 'dot', duration: 2, ratio: 0.25 },
      effect: 'moc_poison_burst',
      icon: 'skill-elem-moc',
      sfx: 'vineSnare',
      desc: 'Độc tụy bùng nổ quanh mục tiêu: 120% sát thương cho mọi địch trong vùng, độc tiếp tục đốt 2 giây.'
    },
    {
      id: 'bang_tien',
      name: 'Băng Tiễn',
      shortName: 'Băng Tiễn',
      family: 'thuy',
      path: 'thuy',
      tier: 1,
      thuc: 1,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'thuy', min: 0 },
      cost: { type: 'linhLuc', amount: 4 },
      cooldown: 3.0,
      castTime: 0.22,
      range: 280,
      targetMode: 'single',
      delivery: 'projectile',
      projectileSpeed: 520,
      damage: { stat: 'attack', ratio: 1.6, flat: 0 },
      status: null,
      effect: 'thuy_ice_projectile',
      icon: 'skill-elem-thuy',
      sfx: 'leafCast',
      desc: 'Một mũi băng tiễn lạnh buốt truy đuổi mục tiêu, gây 160% sát thương đòn thường.'
    },
    {
      id: 'han_bang_toa',
      name: 'Hàn Băng Tỏa',
      shortName: 'Băng Tỏa',
      family: 'thuy',
      path: 'thuy',
      tier: 1,
      thuc: 2,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'thuy', min: 0 },
      cost: { type: 'linhLuc', amount: 6 },
      cooldown: 8.0,
      castTime: 0.3,
      range: 240,
      targetMode: 'single',
      delivery: 'instant',
      damage: { stat: 'attack', ratio: 0.8, flat: 0 },
      status: { type: 'slow', duration: 2.0, ratio: 0.4 },
      effect: 'thuy_frost_lock',
      icon: 'skill-elem-thuy',
      sfx: 'leafCast',
      desc: 'Hàn băng khóa cứng bước chân: mục tiêu chậm 40% trong 2 giây và nhận 80% sát thương đòn thường.'
    },
    {
      id: 'song_bang',
      name: 'Sóng Băng Vỡ',
      shortName: 'Sóng Băng',
      family: 'thuy',
      path: 'thuy',
      tier: 1,
      thuc: 3,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'thuy', min: 50 },
      cost: { type: 'linhLuc', amount: 10 },
      cooldown: 12.0,
      castTime: 0.4,
      range: 260,
      targetMode: 'single',
      delivery: 'area',
      radius: 90,
      damage: { stat: 'attack', ratio: 1.2, flat: 0 },
      status: null,
      effect: 'thuy_ice_wave',
      icon: 'skill-elem-thuy',
      sfx: 'leafCast',
      desc: 'Sóng băng vỡ tung quanh mục tiêu, gây 120% sát thương đòn thường cho mọi địch trong vùng.'
    },
    {
      id: 'hoa_cau',
      name: 'Hỏa Cầu',
      shortName: 'Hỏa Cầu',
      family: 'hoa',
      path: 'hoa',
      tier: 1,
      thuc: 1,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'hoa', min: 0 },
      cost: { type: 'linhLuc', amount: 4 },
      cooldown: 3.0,
      castTime: 0.22,
      range: 280,
      targetMode: 'single',
      delivery: 'projectile',
      projectileSpeed: 520,
      damage: { stat: 'attack', ratio: 1.6, flat: 0 },
      status: null,
      effect: 'hoa_fire_projectile',
      icon: 'skill-elem-hoa',
      sfx: 'leafCast',
      desc: 'Một quả hỏa cầu rực lửa truy đuổi mục tiêu, gây 160% sát thương đòn thường.'
    },
    {
      id: 'diem_thieu',
      name: 'Liệt Diệm Thiêu',
      shortName: 'Diệm Thiêu',
      family: 'hoa',
      path: 'hoa',
      tier: 1,
      thuc: 2,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'hoa', min: 0 },
      cost: { type: 'linhLuc', amount: 6 },
      cooldown: 8.0,
      castTime: 0.3,
      range: 240,
      targetMode: 'single',
      delivery: 'instant',
      damage: { stat: 'attack', ratio: 0.8, flat: 0 },
      status: { type: 'dot', duration: 3, ratio: 0.3 },
      effect: 'hoa_burn',
      icon: 'skill-elem-hoa',
      sfx: 'leafCast',
      desc: 'Liệt diệm bám thân mục tiêu: 80% sát thương ngay và tiếp tục thiêu đốt 3 giây.'
    },
    {
      id: 'nham_boc',
      name: 'Dung Nham Bộc',
      shortName: 'Nham Bộc',
      family: 'hoa',
      path: 'hoa',
      tier: 1,
      thuc: 3,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'hoa', min: 50 },
      cost: { type: 'linhLuc', amount: 10 },
      cooldown: 12.0,
      castTime: 0.4,
      range: 260,
      targetMode: 'single',
      delivery: 'area',
      radius: 90,
      damage: { stat: 'attack', ratio: 1.2, flat: 0 },
      status: null,
      effect: 'hoa_lava_burst',
      icon: 'skill-elem-hoa',
      sfx: 'leafCast',
      desc: 'Dung nham bùng nổ quanh mục tiêu, gây 120% sát thương đòn thường cho mọi địch trong vùng.'
    },
    {
      id: 'thach_nhan',
      name: 'Thạch Nhận',
      shortName: 'Thạch Nhận',
      family: 'tho',
      path: 'tho',
      tier: 1,
      thuc: 1,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'tho', min: 0 },
      cost: { type: 'linhLuc', amount: 4 },
      cooldown: 3.0,
      castTime: 0.22,
      range: 280,
      targetMode: 'single',
      delivery: 'projectile',
      projectileSpeed: 520,
      damage: { stat: 'attack', ratio: 1.6, flat: 0 },
      status: null,
      effect: 'tho_shard_projectile',
      icon: 'skill-elem-tho',
      sfx: 'slash',
      desc: 'Một mảnh thạch nhận nặng trịch lao thẳng mục tiêu, gây 160% sát thương đòn thường.'
    },
    {
      id: 'dia_chan',
      name: 'Địa Chấn',
      shortName: 'Địa Chấn',
      family: 'tho',
      path: 'tho',
      tier: 1,
      thuc: 2,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'tho', min: 0 },
      cost: { type: 'linhLuc', amount: 6 },
      cooldown: 8.0,
      castTime: 0.3,
      range: 240,
      targetMode: 'single',
      delivery: 'instant',
      damage: { stat: 'attack', ratio: 0.8, flat: 0 },
      status: { type: 'stun', duration: 1.0 },
      effect: 'tho_quake',
      icon: 'skill-elem-tho',
      sfx: 'slash',
      desc: 'Đất dưới chân mục tiêu rung chấn, làm choáng 1 giây và gây 80% sát thương đòn thường.'
    },
    {
      id: 'son_bang',
      name: 'Sơn Băng',
      shortName: 'Sơn Băng',
      family: 'tho',
      path: 'tho',
      tier: 1,
      thuc: 3,
      provisional: true,
      unlock: { type: 'pathTuVi', path: 'tho', min: 50 },
      cost: { type: 'linhLuc', amount: 10 },
      cooldown: 12.0,
      castTime: 0.4,
      range: 260,
      targetMode: 'single',
      delivery: 'area',
      radius: 90,
      damage: { stat: 'attack', ratio: 1.2, flat: 0 },
      status: null,
      effect: 'tho_rock_collapse',
      icon: 'skill-elem-tho',
      sfx: 'slash',
      desc: 'Núi đá sụp đổ quanh mục tiêu, gây 120% sát thương đòn thường cho mọi địch trong vùng.'
    },
    {
      id: 'hop_kich',
      name: 'Ngũ Hành Hợp Kích',
      shortName: 'Hợp Kích',
      family: 'hop-kich',
      path: null,
      element: 'nguhanh',
      tier: 1,
      thuc: 1,
      provisional: true,
      unlock: { type: 'harmony', min: 0.6 },
      cost: { type: 'linhLuc', amount: 12 },
      cooldown: 20.0,
      castTime: 0.5,
      range: 280,
      targetMode: 'single',
      delivery: 'area',
      radius: 100,
      damage: { stat: 'attack', ratio: 2.0, flat: 0 },
      status: null,
      effect: 'nguhanh_burst',
      icon: 'skill-elem-nguhanh',
      sfx: 'leafCast',
      desc: 'Hợp kích bậc 1 của vòng tương sinh: năm sắc quyện một, gây 200% sát thương cho mọi địch quanh mục tiêu. Mở khi Hài Hòa đạt 0,6 trở lên.'
    },
    {
      id: 'thai_cuc_chuong',
      name: 'Thái Cực Chưởng',
      shortName: 'Thái Cực',
      family: 'vo-hoc',
      path: null,
      element: 'amduong',
      tier: 1,
      thuc: 1,
      provisional: true,
      unlock: null,
      cost: { type: 'linhLuc', amount: 5 },
      cooldown: 4.0,
      castTime: 0.35,
      range: 75,
      targetMode: 'single',
      delivery: 'instant',
      damage: { stat: 'attack', ratio: 1.3, flat: 0 },
      status: null,
      effect: 'thaicuc_swirl',
      icon: 'skill-elem-amduong',
      sfx: 'slash',
      // Khung tung chiêu THẬT: bộ 64 khung Bui gửi đã tách sạch, bản
      // TĂNG NÉT HD (atlas 4096×4096, 8 hướng × 8 pha, pivot
      // [256, 476], 16 khung/giây — số lấy nguyên từ
      // hanhan_thaicuc_atlas.json của gói HD, hợp đồng hiển thị giữ
      // nguyên displayH nên hình trong game không đổi kích thước).
      castAnim: {
        src: 'assets/chars/hanhan-thaicuc-atlas.png',
        frameW: 512, frameH: 512,
        pivotX: 256, pivotY: 476,
        fps: 16, framesPerDir: 8,
        dirs: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'],
        displayH: 192
      },
      desc: 'Võ học tay không hệ Âm Dương: chưởng lực thái cực xoay tròn đánh gần, diễn bằng bộ khung Thái Cực Chưởng 64 khung (8 hướng × 8 giai đoạn).'
    }
  ];

  /**
   * Thứ tự chiêu trên thanh kỹ năng (phím 1..9). Đánh thường đi kênh riêng.
   * Hai ô nút HUD hiện hữu giữ đúng Phi Diệp (1) và Dây Leo (2) như bản
   * live; các chiêu mở khóa khác xếp tiếp theo phím 3..8 và tung được từ
   * Sổ Chiêu trong Bảng Nhân Vật. Đợt K2.
   */
  var LOADOUT = ['phi_diep', 'day_leo', 'kim_mang', 'bang_tien', 'hoa_cau', 'thach_nhan', 'thai_cuc_chuong', 'hop_kich'];

  var INDEX = {};
  for (var i = 0; i < SKILL_REGISTRY.length; i++) {
    INDEX[SKILL_REGISTRY[i].id] = SKILL_REGISTRY[i];
  }

  function getSkill(id) {
    return INDEX[id] || null;
  }

  function listSkills() {
    return SKILL_REGISTRY.slice();
  }

  function getLoadout() {
    var out = [];
    for (var i = 0; i < LOADOUT.length; i++) {
      var def = INDEX[LOADOUT[i]];
      if (def) out.push(def);
    }
    return out;
  }

  /** Vị trí 0-based của chiêu trên thanh kỹ năng (-1 nếu không có). */
  function slotOf(id) {
    return LOADOUT.indexOf(id);
  }

  /**
   * Hệ gây sát thương của chiêu: trường element riêng (hợp kích = 'nguhanh',
   * Thái Cực = 'amduong') thắng; còn lại theo đường, trung tính nếu không đường.
   */
  function elementOf(def) {
    if (!def) return 'neutral';
    if (def.element) return def.element;
    return def.path ? def.path : 'neutral';
  }

  function elementLang(elementId) {
    return ELEMENTS[elementId] || ELEMENTS.neutral;
  }

  /** Hệ số phóng hiệu ứng theo bậc: bậc 1 = 1, mỗi bậc thêm +35%. */
  function tierScale(tier) {
    var t = (typeof tier === 'number' && tier >= 1) ? tier : 1;
    return 1 + 0.35 * (t - 1);
  }

  /**
   * Tỉ lệ Hài Hòa HH của một bộ năm đường — BẢN THUẦN trong skills.js,
   * phải khớp từng con số với state.js harmonyDetail (kiểm chéo ở
   * test/k2-check.js). Xem state.js để đọc luật gốc (hồ sơ 02 §5).
   */
  function harmonyRatioOf(paths) {
    var keys = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    var vals = {};
    var min = Infinity;
    for (var i = 0; i < keys.length; i++) {
      var p = paths ? paths[keys[i]] : null;
      var v = (p && typeof p.tuVi === 'number') ? p.tuVi : 0;
      vals[keys[i]] = v;
      if (v < min) min = v;
    }
    if (!isFinite(min)) min = 0;
    var base, cap;
    if (min < 900) { base = Math.floor(min / 100) * 100; cap = 100; }
    else if (min < 2500) { base = 900 + Math.floor((min - 900) / 400) * 400; cap = 400; }
    else if (min < 7300) { base = 2500 + Math.floor((min - 2500) / 1200) * 1200; cap = 1200; }
    else if (min < 21700) { base = 7300 + Math.floor((min - 7300) / 3600) * 3600; cap = 3600; }
    else { base = 21700 + Math.floor((min - 21700) / 9000) * 9000; cap = 9000; }
    var minF = Infinity, maxF = 0;
    for (var j = 0; j < keys.length; j++) {
      var f = (vals[keys[j]] - base) / cap;
      if (f < 0) f = 0;
      if (f > 1) f = 1;
      if (f < minF) minF = f;
      if (f > maxF) maxF = f;
    }
    return maxF > 0 ? (minF / maxF) : 1;
  }

  /**
   * Chiêu đã mở khóa cho người chơi chưa.
   * - 'pathTuVi': tu vi của đường đạt ngưỡng (mở theo cấp đường, hồ sơ 03 §1.4).
   * - 'harmony': Hài Hòa hiện tại đạt ngưỡng (họ hợp kích, hồ sơ 02 §5 —
   *   điều kiện "giữ mốc HH đủ số ngày tích lũy" thuộc đợt tiến trình,
   *   ở đây mới khóa theo HH hiện tại).
   */
  function isUnlocked(def, player) {
    if (!def) return false;
    if (!def.unlock) return true;
    if (def.unlock.type === 'pathTuVi') {
      if (!player || !player.paths) return false;
      var p = player.paths[def.unlock.path];
      var tuVi = p && typeof p.tuVi === 'number' ? p.tuVi : 0;
      return tuVi >= (def.unlock.min || 0);
    }
    if (def.unlock.type === 'harmony') {
      if (!player || !player.paths) return false;
      return harmonyRatioOf(player.paths) >= (def.unlock.min || 0);
    }
    return false;
  }

  /* ==================================================================
   * TƯƠNG SINH LIÊN HOÀN — hồ sơ 02 §5 (máy thuần, engine chỉ thi hành):
   * khi HH ≥ 0,8, mỗi đòn trúng TỰ CHUYỂN HỆ theo vòng
   * Kim → Thủy → Mộc → Hỏa → Thổ → Kim; mỗi lần chuyển cộng +6% uy lực
   * cho đòn kế tiếp, cộng dồn tối đa 5 tầng (+30%); đòn hoàn thành một
   * vòng (tầng 5, 10, 15...) gây thêm một lần sát thương Ngũ Hành bằng
   * 50% đòn đó. Chuỗi gãy khi HH rơi dưới 0,8.
   * state = { elem: hệ của đòn vừa chuyển (null = chưa bắt đầu),
   *           stacks: số lần chuyển đã tích }
   * ================================================================== */
  var LIEN_HOAN = {
    minHH: 0.8,
    bonusPerStack: 0.06,
    maxStacks: 5,
    cycleBonusRatio: 0.5,
    cycle: ['kim', 'thuy', 'moc', 'hoa', 'tho']
  };

  /**
   * Bước một đòn qua máy Liên Hoàn. Trả:
   * { active, converted, elem, mult, stacks, completedCycle, nextElem }
   * - hh < minHH: chuỗi gãy — state phải đặt lại { elem: null, stacks: 0 }.
   * - converted: hệ của đòn NÀY sau chuyển (đòn đầu vào vòng là Kim).
   * - mult: hệ số uy lực của đòn này = 1 + 6% × min(tầng trước, 5).
   */
  function lienHoanStep(state, hh) {
    state = state || { elem: null, stacks: 0 };
    if (typeof hh !== 'number' || hh < LIEN_HOAN.minHH) {
      return { active: false, converted: false, elem: null, mult: 1, stacks: 0, completedCycle: false, nextElem: null };
    }
    var elem = state.elem ? (SINH_MAP[state.elem] || 'kim') : 'kim';
    var mult = 1 + LIEN_HOAN.bonusPerStack * Math.min(state.stacks || 0, LIEN_HOAN.maxStacks);
    var stacks = (state.stacks || 0) + 1;
    return {
      active: true,
      converted: true,
      elem: elem,
      mult: mult,
      stacks: stacks,
      completedCycle: (stacks % LIEN_HOAN.cycle.length) === 0,
      nextElem: SINH_MAP[elem] || 'kim'
    };
  }

  /**
   * Kiểm tra tung chiêu THUẦN (không chạm engine) — khuôn castWord của Vô Sắc:
   * trả { ok:true } hoặc { ok:false, code, reason } để engine phản hồi đúng cớ.
   * ctx = { casting, cooldownLeft, resource, hasTarget, targetDist }
   * Thứ tự kiểm như bản live: đang vận → hồi chiêu → không đủ tài nguyên →
   * không có mục tiêu/ngoài tầm. Chiêu self/point không cần mục tiêu đơn.
   */
  function checkCast(def, ctx) {
    if (!def) return { ok: false, code: 'unknown', reason: 'Không có chiêu này.' };
    ctx = ctx || {};
    if (ctx.casting) {
      return { ok: false, code: 'casting', reason: 'Đang vận chiêu khác.' };
    }
    if (ctx.cooldownLeft && ctx.cooldownLeft > 0) {
      return { ok: false, code: 'cooldown', reason: 'Đang hồi chiêu.' };
    }
    var amount = def.cost ? (def.cost.amount || 0) : 0;
    if (amount > 0 && (typeof ctx.resource !== 'number' || ctx.resource < amount)) {
      return { ok: false, code: 'cost', reason: 'Linh lực không đủ (cần ' + amount + ')' };
    }
    if (def.targetMode === 'single') {
      if (!ctx.hasTarget) {
        return { ok: false, code: 'target', reason: 'Không có mục tiêu trong tầm ' + def.range + 'px' };
      }
      if (typeof ctx.targetDist === 'number' && ctx.targetDist > def.range) {
        return { ok: false, code: 'range', reason: 'Không có mục tiêu trong tầm ' + def.range + 'px' };
      }
    }
    return { ok: true };
  }

  /**
   * Kiểm toàn vẹn registry — trả mảng chuỗi lỗi (rỗng = sạch).
   * Chạy trong smoke để mọi chiêu K2 thêm vào sau đều bị khóa chuẩn này.
   */
  function validateRegistry() {
    var problems = [];
    var seenIds = {};
    var seenFamilyThuc = {};

    for (var i = 0; i < SKILL_REGISTRY.length; i++) {
      var def = SKILL_REGISTRY[i];
      var tag = 'skill[' + i + '](' + (def && def.id ? def.id : '?') + '): ';
      if (!def || typeof def !== 'object') { problems.push(tag + 'không phải object'); continue; }
      if (!def.id || typeof def.id !== 'string') problems.push(tag + 'thiếu id');
      else if (seenIds[def.id]) problems.push(tag + 'id trùng');
      else seenIds[def.id] = true;
      if (!def.name) problems.push(tag + 'thiếu name');
      if (!def.family) problems.push(tag + 'thiếu family');
      if (def.path !== null && PATHS.indexOf(def.path) < 0) problems.push(tag + 'path không hợp lệ: ' + def.path);
      if (!(typeof def.tier === 'number' && def.tier >= 1 && Math.floor(def.tier) === def.tier)) problems.push(tag + 'tier phải là số nguyên >= 1');
      if (!(typeof def.thuc === 'number' && def.thuc >= 1 && Math.floor(def.thuc) === def.thuc)) problems.push(tag + 'thuc phải là số nguyên >= 1');
      var ftKey = def.family + '#' + def.thuc;
      if (seenFamilyThuc[ftKey]) problems.push(tag + '(family, thuc) trùng: ' + ftKey);
      else seenFamilyThuc[ftKey] = true;

      if (def.element !== null && def.element !== undefined) {
        if (!ELEMENTS[def.element]) problems.push(tag + 'element không có ngôn ngữ hình: ' + def.element);
        if (def.path && def.element !== def.path) problems.push(tag + 'element khác path của chiêu');
      }
      if (def.unlock !== null && def.unlock !== undefined) {
        var u = def.unlock;
        if (u.type === 'pathTuVi') {
          if (PATHS.indexOf(u.path) < 0) problems.push(tag + 'unlock.path không hợp lệ: ' + u.path);
          if (def.path && u.path !== def.path) problems.push(tag + 'unlock.path khác path của chiêu');
          if (!(typeof u.min === 'number' && u.min >= 0)) problems.push(tag + 'unlock.min phải là số >= 0');
        } else if (u.type === 'harmony') {
          if (!(typeof u.min === 'number' && u.min > 0 && u.min <= 1)) problems.push(tag + 'unlock.min của harmony phải trong (0, 1]');
        } else {
          problems.push(tag + 'unlock.type chưa hỗ trợ: ' + u.type);
        }
      }
      if (!def.cost || COST_TYPES.indexOf(def.cost.type) < 0) problems.push(tag + 'cost.type không hợp lệ');
      else if (!(typeof def.cost.amount === 'number' && def.cost.amount >= 0)) problems.push(tag + 'cost.amount phải là số >= 0');
      if (!(typeof def.cooldown === 'number' && def.cooldown >= 0)) problems.push(tag + 'cooldown phải là số >= 0');
      if (!(typeof def.castTime === 'number' && def.castTime >= 0)) problems.push(tag + 'castTime phải là số >= 0');
      if (!(typeof def.range === 'number' && def.range > 0)) problems.push(tag + 'range phải là số > 0');
      if (TARGET_MODES.indexOf(def.targetMode) < 0) problems.push(tag + 'targetMode không hợp lệ: ' + def.targetMode);
      if (DELIVERIES.indexOf(def.delivery) < 0) problems.push(tag + 'delivery không hợp lệ: ' + def.delivery);
      if (def.delivery === 'projectile' && !(typeof def.projectileSpeed === 'number' && def.projectileSpeed > 0)) {
        problems.push(tag + 'delivery projectile cần projectileSpeed > 0');
      }
      if (def.delivery === 'area' && !(typeof def.radius === 'number' && def.radius > 0)) {
        problems.push(tag + 'delivery area cần radius > 0');
      }
      if (def.castAnim !== null && def.castAnim !== undefined) {
        var ca = def.castAnim;
        if (!(typeof ca.frameW === 'number' && ca.frameW > 0 && typeof ca.frameH === 'number' && ca.frameH > 0)) {
          problems.push(tag + 'castAnim cần frameW/frameH > 0');
        }
        if (!(typeof ca.fps === 'number' && ca.fps > 0)) problems.push(tag + 'castAnim.fps phải > 0');
        if (!(typeof ca.framesPerDir === 'number' && ca.framesPerDir >= 1)) problems.push(tag + 'castAnim.framesPerDir phải >= 1');
        if (!Array.isArray(ca.dirs) || ca.dirs.length !== 8) problems.push(tag + 'castAnim.dirs phải đủ 8 hướng');
      }
      if (!def.damage || def.damage.stat !== 'attack' ||
          !(typeof def.damage.ratio === 'number' && def.damage.ratio > 0) ||
          !(def.damage.flat === undefined || (typeof def.damage.flat === 'number' && def.damage.flat >= 0))) {
        problems.push(tag + 'damage phải là { stat:"attack", ratio > 0, flat >= 0 }');
      }
      if (def.status !== null && def.status !== undefined) {
        if (STATUS_TYPES.indexOf(def.status.type) < 0) problems.push(tag + 'status.type không hợp lệ: ' + def.status.type);
        else if (!(typeof def.status.duration === 'number' && def.status.duration > 0)) problems.push(tag + 'status.duration phải > 0');
        if (def.status.ratio !== undefined && !(typeof def.status.ratio === 'number' && def.status.ratio > 0 && def.status.ratio <= 1)) {
          problems.push(tag + 'status.ratio (làm chậm/đốt theo tỉ lệ) phải trong (0, 1]');
        }
      }
      if (!def.effect || typeof def.effect !== 'string') problems.push(tag + 'thiếu effect id');
      if (!def.icon || typeof def.icon !== 'string') problems.push(tag + 'thiếu icon class');
      if (!ELEMENTS[elementOf(def)]) problems.push(tag + 'thiếu ngôn ngữ hình cho hệ ' + elementOf(def));
    }

    for (var j = 0; j < LOADOUT.length; j++) {
      if (!INDEX[LOADOUT[j]]) problems.push('LOADOUT chứa id không có trong registry: ' + LOADOUT[j]);
    }
    if (!INDEX.basic) problems.push('registry thiếu chiêu cơ bản id=basic');

    for (var e = 0; e < PATHS.length; e++) {
      var lang = ELEMENTS[PATHS[e]];
      if (!lang || !lang.core || !lang.glow || !lang.deep || !lang.motif || !lang.trail) {
        problems.push('ELEMENTS thiếu ngôn ngữ hình đầy đủ cho hệ ' + PATHS[e]);
      }
    }
    if (!ELEMENTS.neutral) problems.push('ELEMENTS thiếu hệ neutral');

    // Đợt K2: khóa đủ nội dung — mỗi đường đúng 3 chiêu trong họ của nó
    // (hồ sơ 03 §1.4), họ hợp kích và Thái Cực Chưởng phải có mặt.
    for (var f = 0; f < PATHS.length; f++) {
      var famCount = 0;
      for (var s2 = 0; s2 < SKILL_REGISTRY.length; s2++) {
        if (SKILL_REGISTRY[s2].family === PATHS[f]) famCount++;
      }
      if (famCount !== 3) problems.push('họ ' + PATHS[f] + ' phải có đúng 3 chiêu, hiện có ' + famCount);
    }
    if (!INDEX.hop_kich) problems.push('registry thiếu hợp kích id=hop_kich');
    if (!INDEX.thai_cuc_chuong) problems.push('registry thiếu Thái Cực Chưởng id=thai_cuc_chuong');

    return problems;
  }

  exports.ELEMENTS = ELEMENTS;
  exports.PATHS = PATHS;
  exports.SINH_MAP = SINH_MAP;
  exports.KHAC_MAP = KHAC_MAP;
  exports.COST_TYPES = COST_TYPES;
  exports.TARGET_MODES = TARGET_MODES;
  exports.DELIVERIES = DELIVERIES;
  exports.STATUS_TYPES = STATUS_TYPES;
  exports.SKILL_REGISTRY = SKILL_REGISTRY;
  exports.LOADOUT = LOADOUT;
  exports.getSkill = getSkill;
  exports.listSkills = listSkills;
  exports.getLoadout = getLoadout;
  exports.slotOf = slotOf;
  exports.elementOf = elementOf;
  exports.elementLang = elementLang;
  exports.tierScale = tierScale;
  exports.isUnlocked = isUnlocked;
  exports.harmonyRatioOf = harmonyRatioOf;
  exports.LIEN_HOAN = LIEN_HOAN;
  exports.lienHoanStep = lienHoanStep;
  exports.checkCast = checkCast;
  exports.validateRegistry = validateRegistry;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameSkills = {}));
