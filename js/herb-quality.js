/** HERBQ — phẩm chất linh dược, Node-loadable và trình duyệt. */
(function (exports) {
  'use strict';
  var LABELS = ['Hạ phẩm', 'Trung phẩm', 'Thượng phẩm', 'Cực phẩm'];
  var SHORT_LABELS = ['Hạ', 'Trung', 'Thượng', 'Cực'];
  var COLORS = ['#8b8b8b', '#4f9d69', '#4f83c4', '#b07ad6'];
  function normalizeQuality(v) { v = Number(v); if (!isFinite(v)) return 1; return Math.max(0, Math.min(3, Math.floor(v))); }
  function getQualityLabel(v) { return LABELS[normalizeQuality(v)]; }
  function getQualityShortLabel(v) { return SHORT_LABELS[normalizeQuality(v)]; }
  function getQualityColor(v) { return COLORS[normalizeQuality(v)]; }
  function scoreToQuality(score) { score = Math.max(0, Math.min(100, Number(score) || 0)); return score >= 75 ? 3 : score >= 50 ? 2 : score >= 25 ? 1 : 0; }
  function harvestScore(context) {
    context = context || {};
    var p = 25 + (Number(context.soilLevel) || 0) * 8;
    if (context.watered) p += 10;
    p += Math.min(10, (Number(context.fertilizedCount) || 0) * 5);
    p += Math.min(15, Math.max(0, Number(context.soilFertility) || 0));
    if (context.weed) p -= 12;
    if (context.pest) p -= 12;
    if (context.withered) p -= 25;
    if (context.spellWatered) p += 5;
    if (context.spellPurified) p += 8;
    if (context.spellGuided) p += 4;
    return Math.max(0, Math.min(100, p));
  }
  function qualityForHarvest(context) { return scoreToQuality(harvestScore(context)); }
  function normalizeItem(item) { if (!item || typeof item !== 'object') return item; if (item.herbQuality === undefined) item.herbQuality = 1; item.herbQuality = normalizeQuality(item.herbQuality); item.herbQualityName = getQualityLabel(item.herbQuality); return item; }
  function weightedAverage(values) { if (!Array.isArray(values) || !values.length) return 1; var total = 0, weight = 0; for (var i=0;i<values.length;i++) { var w = i === 0 ? 2 : 1; total += normalizeQuality(values[i]) * w; weight += w; } return total / weight; }
  exports.LABELS = LABELS; exports.SHORT_LABELS = SHORT_LABELS; exports.COLORS = COLORS; exports.normalizeQuality = normalizeQuality; exports.getQualityLabel = getQualityLabel; exports.getQualityShortLabel = getQualityShortLabel; exports.getQualityColor = getQualityColor; exports.harvestScore = harvestScore; exports.qualityForHarvest = qualityForHarvest; exports.scoreToQuality = scoreToQuality; exports.normalizeItem = normalizeItem; exports.weightedAverage = weightedAverage;
})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameHerbQuality = {}));
