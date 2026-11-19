/**
 * portraits.js — Danh mục chân dung tạo nhân vật (Đợt P2J).
 *
 * Nguồn hình: gói CHARPORTRAITS sinh trực tiếp bám ảnh mẫu Bui gửi
 * (bảng chọn chibi tiên hiệp: 15 nữ F01–F15 + 10 nam M01–M10).
 * Toàn bộ hình CHƯA NGHIỆM THU — dùng nguyên trạng, không sửa hình.
 *
 * Tag lọc theo tab CHỈ LÀ NGOẠI HÌNH (Bui chốt 10:52 ngày 2026-11-15:
 * 4 tab chỉ lọc ngoại hình, không chọn đường tu; chọn đường Kiếm/Pháp/Thể
 * sau Trúc Cơ giữ nguyên). Gán tag theo đạo cụ/trang phục trong manifest
 * — PROVISIONAL, chờ Bui phán sau. Mỗi tab có ít nhất 2 mẫu mỗi giới.
 *
 * Tương thích cả Browser và Node.js.
 */
(function (global) {
  'use strict';

  var BASE_PATH = 'assets/portraits/';

  // Tab lọc ngoại hình. 'all' hiện toàn bộ 25 mẫu.
  var TABS = [
    { id: 'all', label: 'Tất cả' },
    { id: 'kiem-tu', label: 'Kiếm Tu' },
    { id: 'linh-thuc', label: 'Linh Thực Phu' },
    { id: 'luyen-dan', label: 'Luyện Đan Sư' },
    { id: 'luyen-khi', label: 'Luyện Khí Sư' }
  ];

  // gender: 'nu' | 'nam'. tab: tab lọc chính (PROVISIONAL).
  var CATALOG = [
    // Nữ tu F01–F15
    { code: 'F01', gender: 'nu', tab: 'luyen-khi', desc: 'Áo trắng viền bạc, quạt giấy' },
    { code: 'F02', gender: 'nu', tab: 'luyen-dan', desc: 'Áo hồng phấn, dải lụa hồng' },
    { code: 'F03', gender: 'nu', tab: 'linh-thuc', desc: 'Áo lam nhạt, hoa trắng cài tóc' },
    { code: 'F04', gender: 'nu', tab: 'kiem-tu', desc: 'Đuôi ngựa cao, áo teal viền đỏ' },
    { code: 'F05', gender: 'nu', tab: 'luyen-dan', desc: 'Áo tím đậm, tay áo rộng' },
    { code: 'F06', gender: 'nu', tab: 'luyen-khi', desc: 'Áo tím oải hương nhạt' },
    { code: 'F07', gender: 'nu', tab: 'linh-thuc', desc: 'Áo xanh bạc hà nhạt' },
    { code: 'F08', gender: 'nu', tab: 'linh-thuc', desc: 'Áo xanh lá nhạt, dải lụa trắng' },
    { code: 'F09', gender: 'nu', tab: 'luyen-khi', desc: 'Tóc dài xõa, áo xám tro' },
    { code: 'F10', gender: 'nu', tab: 'linh-thuc', desc: 'Áo xanh ngọc' },
    { code: 'F11', gender: 'nu', tab: 'kiem-tu', desc: 'Áo đen viền bạc' },
    { code: 'F12', gender: 'nu', tab: 'luyen-dan', desc: 'Tóc dài xõa, áo tím thẫm' },
    { code: 'F13', gender: 'nu', tab: 'luyen-khi', desc: 'Áo lam-trắng, dải lụa lam' },
    { code: 'F14', gender: 'nu', tab: 'luyen-dan', desc: 'Áo đỏ viền vàng' },
    { code: 'F15', gender: 'nu', tab: 'luyen-khi', desc: 'Áo kem/vàng nhạt' },
    // Nam tu M01–M10 (M06–M10 suy đoán theo manifest — hàng 2 nam trong
    // ảnh mẫu bị cắt; Bui phán riêng)
    { code: 'M01', gender: 'nam', tab: 'kiem-tu', desc: 'Áo tím đậm, kiếm đeo sau lưng' },
    { code: 'M02', gender: 'nam', tab: 'linh-thuc', desc: 'Tóc trắng dài, áo trắng/bạc' },
    { code: 'M03', gender: 'nam', tab: 'luyen-khi', desc: 'Áo lam nhạt, trâm ngọc' },
    { code: 'M04', gender: 'nam', tab: 'luyen-dan', desc: 'Áo đỏ, thắt lưng đen' },
    { code: 'M05', gender: 'nam', tab: 'luyen-khi', desc: 'Áo vàng kim' },
    { code: 'M06', gender: 'nam', tab: 'kiem-tu', desc: 'Áo lam đậm, kiếm đeo sau lưng' },
    { code: 'M07', gender: 'nam', tab: 'luyen-khi', desc: 'Áo đen viền vàng, kim quan' },
    { code: 'M08', gender: 'nam', tab: 'linh-thuc', desc: 'Áo xanh lá đậm, sáo ngọc' },
    { code: 'M09', gender: 'nam', tab: 'luyen-dan', desc: 'Áo nâu sẫm, hồ lô nhỏ' },
    { code: 'M10', gender: 'nam', tab: 'luyen-khi', desc: 'Áo lam-trắng, quạt' }
  ];

  // Mặc định chọn F04 — đúng mẫu được tô viền đỏ trong ảnh mẫu Bui gửi.
  var DEFAULT_CODE = 'F04';

  function portraitUrl(code) {
    return BASE_PATH + code + '.png';
  }

  function getPortrait(code) {
    if (!code) return null;
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].code === code) return CATALOG[i];
    }
    return null;
  }

  function listByTab(tabId) {
    if (!tabId || tabId === 'all') return CATALOG.slice();
    var out = [];
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].tab === tabId) out.push(CATALOG[i]);
    }
    return out;
  }

  var api = {
    TABS: TABS,
    CATALOG: CATALOG,
    DEFAULT_CODE: DEFAULT_CODE,
    BASE_PATH: BASE_PATH,
    portraitUrl: portraitUrl,
    getPortrait: getPortrait,
    listByTab: listByTab
  };

  if (typeof window !== 'undefined') {
    window.GamePortraits = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined' && global && !global.GamePortraits) {
    global.GamePortraits = api;
  }
})(typeof window !== 'undefined' ? window : this);
