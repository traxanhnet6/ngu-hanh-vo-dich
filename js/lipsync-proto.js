/**
 * lipsync-proto.js — PROTOTYPE 30 phút, phương án (A): miệng ellipse mở/đóng theo độ to giọng.
 * Chỉ chạy trên cây prototype; KHÔNG gộp live.
 *
 * Chân dung Linh Nhi (sửa 2026-11-20): dùng ảnh chân dung riêng
 * assets/art/portrait-linhnhi.png — cắt từ sprite gốc assets/art/npc-linhnhi.png
 * (221x560), vùng cắt (20,0)-(201,213), hiển thị vừa đúng khung 68x80, KHÔNG dịch
 * khung khi nói nữa. Miệng thật trên sprite ở (112.5, 177) -> trong khung 68x80 ở
 * (35, 66) (đo bằng pixel trên ảnh crop, xem LIPSYNC-PROTO-REPORT.md § Sửa chân dung).
 * Chỉ kích hoạt khi người nói là Linh Nhi (tọa độ miệng đo riêng cho cô).
 */
(function () {
  'use strict';
  var MOUTH = { x: 35, y: 66, w: 11, maxH: 10 }; // tâm miệng trong khung 68x80 (chân dung riêng, không dịch khung)
  var TARGET = 'Linh Nhi';

  var mouthEl = null, portraitEl = null, boxEl = null, nameEl = null;
  var speaking = false, rafOn = false;

  function $(id) { return document.getElementById(id); }

  function ensureMouth() {
    portraitEl = $('dialogue-portrait');
    boxEl = $('dialogue-box');
    nameEl = $('dialogue-npc-name');
    if (!portraitEl || !boxEl) return false;
    if (!mouthEl) {
      mouthEl = document.createElement('div');
      mouthEl.id = 'lipsync-proto-mouth';
      mouthEl.style.cssText = [
        'position:absolute', 'left:' + (MOUTH.x - MOUTH.w / 2) + 'px',
        'top:' + (MOUTH.y - 1) + 'px', 'width:' + MOUTH.w + 'px', 'height:1px',
        'background:#6b3a2e', 'border-radius:50%', 'pointer-events:none',
        'display:none', 'z-index:3'
      ].join(';');
      var cs = window.getComputedStyle ? getComputedStyle(portraitEl).position : '';
      if (cs !== 'absolute' && cs !== 'relative' && cs !== 'fixed') portraitEl.style.position = 'relative';
      portraitEl.appendChild(mouthEl);
    }
    return true;
  }

  function dialogueOpen() {
    return !!(boxEl && !boxEl.classList.contains('hidden'));
  }
  function isTarget() {
    return !!(nameEl && (nameEl.textContent || '').trim() === TARGET);
  }

  function tick() {
    rafOn = true;
    try {
      if (ensureMouth() && dialogueOpen() && isTarget() &&
          window.GameVoice && window.GameVoice.isVoicePlaying && window.GameVoice.isVoicePlaying()) {
        var level = 0;
        try { level = window.GameVoice.getVoiceLevel ? window.GameVoice.getVoiceLevel() : 0; } catch (e) {}
        speaking = true;
        var h = 1 + Math.round(level * (MOUTH.maxH - 1));
        mouthEl.style.display = 'block';
        mouthEl.style.height = h + 'px';
        mouthEl.style.top = (MOUTH.y - h / 2) + 'px';
        mouthEl.style.width = (MOUTH.w - Math.round(level * 2)) + 'px';
        mouthEl.style.left = (MOUTH.x - (MOUTH.w - Math.round(level * 2)) / 2) + 'px';
      } else {
        speaking = false;
        if (mouthEl) mouthEl.style.display = 'none';
      }
    } catch (e) {}
    requestAnimationFrame(tick);
  }

  function start() {
    if (rafOn || typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(tick);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
