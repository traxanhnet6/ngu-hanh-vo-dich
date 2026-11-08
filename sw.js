'use strict';
/*
 * Service worker tối thiểu cho PWA (Đợt 3, Note 8).
 * Chrome yêu cầu có service worker thì mới hiện lời mời cài ứng dụng.
 *
 * Chủ đích PASS-THROUGH và KHÔNG chen vào đường tải tài sản của game:
 * - Không cache gì cả (bản deploy mới không bao giờ bị kẹt bản cũ trong cache).
 * - Không clients.claim(): không giành quyền kiểm soát trang đang chơi.
 * - fetch: chỉ "chạm" vào yêu cầu điều hướng trang (navigate) bằng fetch thẳng
 *   ra mạng; mọi tài nguyên con (ảnh, js, css, nhạc) để trình duyệt tải nguyên
 *   bản như khi không có SW — game không bị thêm độ trễ hay điểm gãy nào.
 * (Chế độ offline/cache sẽ là một đợt riêng nếu cần.)
 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  if (event.request && event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
  }
});
