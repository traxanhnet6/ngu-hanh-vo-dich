// Alias -> luyendan.js (Đợt D2)
(function (exports) {
  'use strict';
  var core = null;
  try { core = require('./luyendan.js'); } catch (e) { core = {}; }
  if (core) {
    for (var k in core) exports[k] = core[k];
  }
  if (typeof window !== 'undefined') window.GameLuyenDan = window.GameLuyenDan || exports;
})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameDan = {}));
