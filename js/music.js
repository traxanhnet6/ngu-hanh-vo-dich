/**
 * music.js — Nhạc nền theo bản đồ + lớp chiến đấu + âm thanh môi trường (GameMusic)
 * Game "Ngũ Hành Vô Địch" — chuẩn âm thanh thừa hưởng từ Vô Sắc:
 * nhạc tiên hiệp Trung Hoa, nhạc cụ truyền thống TỔNG HỢP bằng WebAudio,
 * KHÔNG dùng tệp âm thanh ngoài, KHÔNG dùng bản nhạc có bản quyền.
 *
 * Nhạc cụ tổng hợp:
 *  - Cổ tranh / Cổ cầm (guzheng): dây gảy Karplus-Strong (tự sinh đệm âm theo tần số).
 *  - Sáo trúc / Tiêu (dizi/xiao): sine + triangle + rung vibrato + hơi thở (noise dải hẹp).
 *  - Dây đệm (pad): triangle detune qua lowpass, attack/release chậm.
 *  - Chuông (bell): tổng hợp cộng các partial phi điều hòa, tắt dần dài.
 *  - Trống taiko lớp chiến đấu: sine trượt pitch + màng noise qua lowpass.
 *
 * Thang âm: ngũ cung Trung Hoa trên gốc A2 = 110 Hz (chế độ Vũ / Yu — A C D E G),
 * CÙNG bảng tần số với js/audio.js (D3 146.83, E3 164.81, G3 196.00, A3 220.00,
 * C4 261.63, D4 293.66, E4 329.63, G4 392.00, A4 440.00, C5 523.25, D5 587.33...).
 *
 * API công khai (duy nhất): window.GameMusic = {
 *   unlock(), setMap(mapId), setCombat(bool),
 *   setMusicVolume(0..1), setAmbienceVolume(0..1), setMuted(bool), isStarted()
 * }
 * Âm thanh CHỈ bắt đầu sau unlock() được gọi từ một cử chỉ người dùng
 * (luật autoplay của trình duyệt). Mọi hàm đều an toàn khi WebAudio không có.
 *
 * Tương thích cả Browser và Node.js (kiểm tra cú pháp / smoke test không lỗi).
 */
(function (global) {
  'use strict';

  var AudioContextClass = (typeof window !== 'undefined' &&
    (window.AudioContext || window.webkitAudioContext)) || null;

  // ==========================================================================
  // 1. THANG ÂM NGŨ CUNG — gốc A2 = 110 Hz, chế độ Vũ (A C D E G)
  // ==========================================================================
  var BASE_FREQ = 110; // A2
  // Số bán cung trong một quãng tám theo thứ tự bậc: A, C, D, E, G
  var PENTA_STEPS = [0, 3, 5, 7, 10];

  /**
   * Tần số của bậc thang `index` (0 = A2; 5 = A3; 10 = A4; âm = quãng tám dưới).
   * index tăng 5 = lên đúng một quãng tám — tiện cho hợp âm mở kiểu tiên hiệp.
   */
  function freqOf(index) {
    var oct = Math.floor(index / 5);
    var within = index - oct * 5;
    var semis = oct * 12 + PENTA_STEPS[within];
    return BASE_FREQ * Math.pow(2, semis / 12);
  }

  // ==========================================================================
  // 2. CHỦ ĐỀ NHẠC THEO KHU VỰC (THEME)
  //    melLow/melHigh: vùng bậc thang của giai điệu chính (bậc 5 = A3 = 220 Hz).
  //    rhythm: các step trong ô nhịp (8 step = 1 ô nhịp, step = nốt móc đơn).
  //    padChords: mảng hợp âm đệm, mỗi hợp âm là các bậc thang (quãng mở).
  //    flutePhrases: câu sáo — [lệch step, bậc, dài (step)] tính từ đầu câu.
  // ==========================================================================
  var FLUTE_TEMPLE = [
    [0, 10, 3], [3, 9, 2], [5, 8, 5], [10, 7, 2], [12, 5, 6]
  ];
  var FLUTE_FOREST = [
    [0, 8, 2], [2, 9, 2], [4, 10, 3], [7, 9, 1], [8, 8, 2], [10, 7, 2], [12, 5, 4]
  ];
  var FLUTE_SECT = [
    [0, 5, 3], [3, 10, 3], [6, 12, 4], [10, 10, 2], [12, 9, 2], [14, 10, 4]
  ];
  var FLUTE_XIAO = [ // Tiêu trầm — biến thể sect chậm, thấp hơn
    [0, 5, 4], [4, 7, 3], [7, 10, 5], [12, 8, 3], [15, 5, 6]
  ];
  var FLUTE_VALLEY = [
    [0, 9, 3], [3, 8, 2], [5, 7, 4], [9, 8, 2], [11, 10, 5]
  ];

  var THEMES = {
    // — Miếu hoang: tĩnh, thưa, gảy rời + câu tiêu/sáo dài —
    temple: {
      id: 'temple', bpm: 52, gain: 0.9,
      rhythm: [0, 3, 6], leadChance: 0.85, walkMax: 2,
      melLow: 5, melHigh: 11, arp: false,
      padChords: [[0, 3, 5], [4, 7, 9], [2, 5, 7], [3, 5, 8]], padBars: 2,
      flutePhrases: [FLUTE_TEMPLE], fluteEveryBars: 4, fluteOffsetBars: 2,
      fluteKind: 'xiao', bellEveryBars: 8, softDrum: false
    },
    // — Rừng độc: dày hơn, arpeggio chảy như suối —
    forest: {
      id: 'forest', bpm: 72, gain: 0.92,
      rhythm: [0, 2, 4, 6], leadChance: 0.7, walkMax: 2,
      melLow: 5, melHigh: 12, arp: true,
      padChords: [[0, 3, 5], [3, 5, 8], [2, 5, 7], [4, 7, 9]], padBars: 1,
      flutePhrases: [FLUTE_FOREST], fluteEveryBars: 2, fluteOffsetBars: 1,
      fluteKind: 'dizi', bellEveryBars: 0, softDrum: false
    },
    // — Tông môn: hùng tráng, quãng rộng, chuông điểm, trống nhẹ —
    sect: {
      id: 'sect', bpm: 64, gain: 1.0,
      rhythm: [0, 2, 4, 6], leadChance: 0.9, walkMax: 4,
      melLow: 5, melHigh: 13, arp: false,
      padChords: [[0, 3, 5, 7], [2, 5, 7, 10], [4, 7, 9, 12], [3, 5, 8, 10]], padBars: 2,
      flutePhrases: [FLUTE_SECT], fluteEveryBars: 4, fluteOffsetBars: 1,
      fluteKind: 'dizi', bellEveryBars: 2, softDrum: true
    },
    // — Đại điện (nội thất): biến thể sect — lặng hơn, chậm hơn, tiêu trầm —
    interior: {
      id: 'interior', bpm: 48, gain: 0.62,
      rhythm: [0, 4], leadChance: 0.6, walkMax: 2,
      melLow: 3, melHigh: 10, arp: false,
      padChords: [[0, 3, 5], [2, 5, 7], [4, 7, 9], [3, 5, 8]], padBars: 2,
      flutePhrases: [FLUTE_XIAO], fluteEveryBars: 6, fluteOffsetBars: 2,
      fluteKind: 'xiao', bellEveryBars: 0, softDrum: false
    },
    // — Sơn cốc: pha rừng + miếu, rất tĩnh —
    valley: {
      id: 'valley', bpm: 56, gain: 0.85,
      rhythm: [0, 2, 5, 7], leadChance: 0.6, walkMax: 2,
      melLow: 5, melHigh: 11, arp: true,
      padChords: [[0, 3, 5], [1, 4, 6], [2, 5, 7], [0, 3, 5]], padBars: 2,
      flutePhrases: [FLUTE_VALLEY], fluteEveryBars: 4, fluteOffsetBars: 3,
      fluteKind: 'xiao', bellEveryBars: 0, softDrum: false
    },
    // — Đài truyền tống: biến thể sect — thêm arpeggio lấp lánh tầng cao —
    teleport: {
      id: 'teleport', bpm: 68, gain: 0.95,
      rhythm: [0, 2, 4, 6], leadChance: 0.8, walkMax: 3,
      melLow: 7, melHigh: 14, arp: true,
      padChords: [[0, 3, 5, 7], [4, 7, 9, 12], [2, 5, 7, 10], [3, 5, 8, 10]], padBars: 2,
      flutePhrases: [FLUTE_SECT], fluteEveryBars: 4, fluteOffsetBars: 2,
      fluteKind: 'dizi', bellEveryBars: 4, softDrum: true
    }
  };

  // ==========================================================================
  // 3. BẢN ĐỒ mapId -> theme (chấp nhận cả dạng gạch ngang và gạch dưới;
  //    engine hiện dùng 'mieu_hoang' + 'rung-doc', hồ sơ dùng dạng gạch ngang)
  // ==========================================================================
  var MAP_TO_THEME = {
    'mieu-hoang': 'temple', 'mieu_hoang': 'temple',
    'rung-doc': 'forest', 'rung_doc': 'forest',
    'tong-mon': 'sect', 'tong_mon': 'sect',
    'dai-dien': 'interior', 'dai_dien': 'interior',
    'dai-truyen-tong': 'teleport', 'dai_truyen_tong': 'teleport',
    'son-coc': 'valley', 'son_coc': 'valley'
  };
  var DEFAULT_THEME_ID = 'temple';

  function themeIdForMap(mapId) {
    if (mapId && MAP_TO_THEME[mapId]) return MAP_TO_THEME[mapId];
    return DEFAULT_THEME_ID;
  }

  // ==========================================================================
  // 4. CẤU HÌNH ÂM THANH MÔI TRƯỜNG (AMBIENCE) THEO THEME
  //    wind/stream: lớp nền liên tục (0..1). bell/bird/insect/rustle/flap/wood:
  //    khoảng giây [min, max] giữa hai sự kiện ngẫu nhiên thưa (0 = tắt).
  // ==========================================================================
  var AMBIENCE = {
    temple: {
      wind: 0.5, windFreq: 600, stream: 0,
      bell: [14, 30], bird: [6, 16], insect: 0, rustle: 0, flap: 0, wood: 0
    },
    forest: {
      wind: 0.25, windFreq: 900, stream: 0.85,
      bell: 0, bird: [10, 24], insect: [2, 5], rustle: [5, 12], flap: 0, wood: 0
    },
    sect: {
      wind: 0.7, windFreq: 1000, stream: 0,
      bell: [22, 42], bird: 0, insect: 0, rustle: 0, flap: [3, 8], wood: [6, 14]
    },
    interior: {
      wind: 0.12, windFreq: 1500, stream: 0,
      bell: [25, 50], bird: 0, insect: 0, rustle: 0, flap: 0, wood: 0
    },
    valley: {
      wind: 0.35, windFreq: 750, stream: 0.45,
      bell: [30, 55], bird: [8, 18], insect: [6, 12], rustle: [8, 16], flap: 0, wood: 0
    },
    teleport: {
      wind: 0.6, windFreq: 1050, stream: 0,
      bell: [18, 36], bird: 0, insect: 0, rustle: 0, flap: [4, 9], wood: [10, 20]
    }
  };

  // ==========================================================================
  // 5. TRẠNG THÁI
  // ==========================================================================
  var ctx = null;
  var started = false;          // đã unlock() và dựng xong đồ thị âm thanh
  var muted = false;
  var musicVol = 0.7;           // khớp mặc định settings.musicVol của game
  var ambienceVol = 0.6;

  var masterGain = null;        // -> compressor -> destination (mute ở đây)
  var musicBus = null;          // nhận 2 deck nhạc + lớp combat; setMusicVolume ở đây
  var ambienceBus = null;       // nhận 2 deck ambience + wet của delay; setAmbienceVolume ở đây
  var combatGain = null;        // lớp chiến đấu -> musicBus (crossfade riêng)
  var delaySend = null;         // đầu vào delay dùng chung cho tiếng vọng xa

  var musicDecks = [null, null];   // [{gain}] — crossfade khi đổi theme
  var activeDeck = 0;
  var ambDecks = [null, null];     // [{gain, stop()}] — lớp nền liên tục
  var activeAmbDeck = 0;

  var noiseBuffer = null;          // đệm noise trắng 2s dùng chung

  var currentMapId = null;
  var currentTheme = THEMES[DEFAULT_THEME_ID];
  var combatActive = false;

  // Bộ lập lịch lookahead (nhạc)
  var schedTimer = null;
  var LOOKAHEAD_SEC = 0.35;
  var TICK_MS = 90;
  var nextStepTime = 0;
  var stepCounter = 0;             // step toàn cục (móc đơn)
  var melodyIndex = 7;             // vị trí bước ngẫu nhiên có hạt giống của giai điệu
  var phraseIndex = 0;

  // Bộ lập lịch sự kiện ambience thưa (giây theo ctx.currentTime)
  var nextAmb = { bell: 0, bird: 0, insect: 0, rustle: 0, flap: 0, wood: 0 };

  var CROSSFADE_SEC = 1.2;

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  // Hạt giống tất định cho giai điệu: cùng ô nhịp -> cùng lựa chọn, không dùng
  // Math.random trong nhạc để giai điệu có tính lặp lại như một bản nhạc thật.
  function seededRand(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  // ==========================================================================
  // 6. DỰNG ĐỒ THỊ ÂM THANH (chỉ chạy trong unlock — sau cử chỉ người dùng)
  // ==========================================================================
  function buildGraph() {
    ctx = new AudioContextClass();

    var out = ctx.destination;
    try {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, ctx.currentTime);
      comp.ratio.setValueAtTime(4, ctx.currentTime);
      comp.connect(ctx.destination);
      out = comp;
    } catch (e) { /* không có compressor vẫn chạy bình thường */ }

    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
    masterGain.connect(out);

    musicBus = ctx.createGain();
    musicBus.gain.setValueAtTime(musicVol * 0.85, ctx.currentTime);
    musicBus.connect(masterGain);

    ambienceBus = ctx.createGain();
    ambienceBus.gain.setValueAtTime(ambienceVol * 0.9, ctx.currentTime);
    ambienceBus.connect(masterGain);

    for (var i = 0; i < 2; i++) {
      var dg = ctx.createGain();
      dg.gain.setValueAtTime(0, ctx.currentTime);
      dg.connect(musicBus);
      musicDecks[i] = { gain: dg };
    }

    combatGain = ctx.createGain();
    combatGain.gain.setValueAtTime(0, ctx.currentTime);
    combatGain.connect(musicBus);

    // Delay vọng xa dùng chung (chuông xa, tiếng gõ gỗ ở sân tập...)
    try {
      var delay = ctx.createDelay(1.0);
      delay.delayTime.setValueAtTime(0.31, ctx.currentTime);
      var fb = ctx.createGain();
      fb.gain.setValueAtTime(0.3, ctx.currentTime);
      var wet = ctx.createGain();
      wet.gain.setValueAtTime(0.35, ctx.currentTime);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(ambienceBus);
      delaySend = delay;
    } catch (e) {
      delaySend = null;
    }

    // Đệm noise trắng 2 giây (hơi thở sáo, gió, suối, xào xạc...)
    var len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var s = 0; s < len; s++) data[s] = Math.random() * 2 - 1;
  }

  function startScheduler() {
    nextStepTime = ctx.currentTime + 0.06;
    stepCounter = 0;
    melodyIndex = currentTheme.melLow + 2;
    resetAmbTimers(ctx.currentTime);
    if (schedTimer) clearInterval(schedTimer);
    schedTimer = setInterval(schedulerTick, TICK_MS);
  }

  function resetAmbTimers(now) {
    var cfg = AMBIENCE[currentTheme.id] || AMBIENCE.temple;
    var keys = ['bell', 'bird', 'insect', 'rustle', 'flap', 'wood'];
    for (var i = 0; i < keys.length; i++) {
      var range = cfg[keys[i]];
      nextAmb[keys[i]] = range ? now + randRange(range[0], range[1]) * 0.5 : Infinity;
    }
  }

  // ==========================================================================
  // 7. NHẠC CỤ TỔNG HỢP
  // ==========================================================================
  var ksCache = {};
  var ksCacheCount = 0;

  // Đệm âm dây gảy Karplus-Strong: bùng noise ngắn rồi vòng trễ lọc trung bình.
  function getPluckBuffer(freq, decaySec) {
    var key = Math.round(freq) + ':' + decaySec.toFixed(1);
    if (ksCache[key]) return ksCache[key];
    var sr = ctx.sampleRate;
    var total = Math.floor(sr * decaySec);
    var buf = ctx.createBuffer(1, total, sr);
    var d = buf.getChannelData(0);
    var period = Math.max(2, Math.round(sr / freq));
    var i;
    for (i = 0; i < period && i < total; i++) d[i] = Math.random() * 2 - 1;
    // Hệ số tắt dần: nốt trầm ngân lâu hơn nốt cao
    var g = freq < 200 ? 0.996 : (freq < 400 ? 0.994 : 0.991);
    for (i = period; i < total; i++) {
      var prev = d[i - period];
      var prev2 = (i - period - 1 >= 0) ? d[i - period - 1] : prev;
      d[i] = g * 0.5 * (prev + prev2);
    }
    if (ksCacheCount < 48) { ksCache[key] = buf; ksCacheCount++; }
    return buf;
  }

  /** Gảy cổ tranh/cổ cầm vào một đích (deck nhạc hoặc lớp combat). */
  function playPluck(dest, freq, time, vol, decaySec) {
    if (!ctx || !dest) return;
    try {
      var src = ctx.createBufferSource();
      src.buffer = getPluckBuffer(freq, decaySec || 1.6);
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(6000, freq * 5), time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.2), time + 0.4);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, time);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(time);
      src.stop(time + (decaySec || 1.6));
    } catch (e) {}
  }

  /** Sáo trúc (dizi — sáng, rung nhanh) / Tiêu (xiao — trầm, rung chậm, hơi nhiều). */
  function playFlute(dest, freq, time, durSec, vol, kind) {
    if (!ctx || !dest) return;
    try {
      var isXiao = (kind === 'xiao');
      var osc = ctx.createOscillator();
      osc.type = isXiao ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq * (isXiao ? 0.995 : 1.0), time);
      osc.frequency.linearRampToValueAtTime(freq, time + 0.06);

      var osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, time);
      var osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(isXiao ? 0.04 : 0.08, time);

      // Vibrato: vào sau 0.15s, sâu dần
      var vib = ctx.createOscillator();
      vib.frequency.setValueAtTime(isXiao ? 4.2 : 5.6, time);
      var vibGain = ctx.createGain();
      vibGain.gain.setValueAtTime(0, time);
      vibGain.gain.linearRampToValueAtTime(freq * (isXiao ? 0.006 : 0.008), time + 0.35);
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);

      var gain = ctx.createGain();
      var attack = isXiao ? 0.14 : 0.07;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + attack);
      gain.gain.setValueAtTime(vol, time + Math.max(attack, durSec - 0.12));
      gain.gain.linearRampToValueAtTime(0.0001, time + durSec);

      osc.connect(gain);
      osc2.connect(osc2Gain);
      osc2Gain.connect(gain);
      gain.connect(dest);

      // Hơi thở: noise dải hẹp quanh 2x tần số, rất khẽ
      var breath = ctx.createBufferSource();
      breath.buffer = noiseBuffer;
      breath.loop = true;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq * 2, time);
      bp.Q.setValueAtTime(1.2, time);
      var bGain = ctx.createGain();
      bGain.gain.setValueAtTime(vol * (isXiao ? 0.16 : 0.1), time);
      bGain.gain.linearRampToValueAtTime(0.0001, time + durSec);
      breath.connect(bp);
      bp.connect(bGain);
      bGain.connect(dest);

      osc.start(time); osc.stop(time + durSec + 0.05);
      osc2.start(time); osc2.stop(time + durSec + 0.05);
      vib.start(time); vib.stop(time + durSec + 0.05);
      breath.start(time); breath.stop(time + durSec + 0.05);
    } catch (e) {}
  }

  /** Dây đệm mềm: mỗi nốt hai oscillator triangle lệch tông nhẹ qua lowpass. */
  function playPad(dest, freq, time, durSec, vol) {
    if (!ctx || !dest) return;
    try {
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, time);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + Math.min(2.0, durSec * 0.35));
      gain.gain.setValueAtTime(vol, time + durSec * 0.65);
      gain.gain.linearRampToValueAtTime(0.0001, time + durSec);
      filter.connect(gain);
      gain.connect(dest);
      var detunes = [-4, 4];
      for (var i = 0; i < detunes.length; i++) {
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.setValueAtTime(detunes[i], time);
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + durSec + 0.05);
      }
    } catch (e) {}
  }

  /** Chuông: các partial phi điều hòa tắt dần độc lập. withEcho -> vọng vào delay xa. */
  function playBell(dest, freq, time, vol, decaySec, withEcho) {
    if (!ctx || !dest) return;
    try {
      var partials = [[1, 1.0], [2.02, 0.55], [2.74, 0.32], [3.76, 0.18], [5.4, 0.08]];
      for (var i = 0; i < partials.length; i++) {
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * partials[i][0], time);
        var gain = ctx.createGain();
        var d = decaySec * (1 - i * 0.13);
        gain.gain.setValueAtTime(vol * partials[i][1], time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + d);
        osc.connect(gain);
        gain.connect(dest);
        if (withEcho && delaySend) {
          var send = ctx.createGain();
          send.gain.setValueAtTime(0.5, time);
          gain.connect(send);
          send.connect(delaySend);
        }
        osc.start(time);
        osc.stop(time + d + 0.05);
      }
    } catch (e) {}
  }

  /** Trống taiko: thân sine trượt 120->48 Hz + màng noise. big = trống lớn. */
  function playTaiko(dest, time, vol, big) {
    if (!ctx || !dest) return;
    try {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(big ? 118 : 165, time);
      osc.frequency.exponentialRampToValueAtTime(big ? 46 : 78, time + (big ? 0.22 : 0.14));
      var gain = ctx.createGain();
      var dur = big ? 0.5 : 0.28;
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur + 0.05);

      var noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(big ? 420 : 700, time);
      var nGain = ctx.createGain();
      nGain.gain.setValueAtTime(vol * 0.35, time);
      nGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
      noise.connect(lp);
      lp.connect(nGain);
      nGain.connect(dest);
      noise.start(time);
      noise.stop(time + 0.12);
    } catch (e) {}
  }

  /** Gõ gỗ xa (wood block) — tiếng tập luyện vọng lại ở tông môn. */
  function playWood(dest, time, vol, withEcho) {
    if (!ctx || !dest) return;
    try {
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, time);
      osc.frequency.exponentialRampToValueAtTime(620, time + 0.06);
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1100, time);
      bp.Q.setValueAtTime(2.5, time);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
      osc.connect(bp);
      bp.connect(gain);
      gain.connect(dest);
      if (withEcho && delaySend) {
        var send = ctx.createGain();
        send.gain.setValueAtTime(0.6, time);
        gain.connect(send);
        send.connect(delaySend);
      }
      osc.start(time);
      osc.stop(time + 0.12);
    } catch (e) {}
  }

  // ==========================================================================
  // 8. BỘ LẬP LỊCH NHẠC (lookahead) + LỚP CHIẾN ĐẤU
  // ==========================================================================
  function schedulerTick() {
    if (!ctx || !started) return;
    var theme = currentTheme;
    var stepDur = 60 / theme.bpm / 2; // step = nốt móc đơn
    while (nextStepTime < ctx.currentTime + LOOKAHEAD_SEC) {
      scheduleStep(stepCounter, nextStepTime, stepDur);
      stepCounter++;
      nextStepTime += stepDur;
    }
    scheduleAmbienceEvents(ctx.currentTime + LOOKAHEAD_SEC);
  }

  function scheduleStep(step, time, stepDur) {
    var theme = currentTheme;
    var stepsPerBar = 8;
    var bar = Math.floor(step / stepsPerBar);
    var stepInBar = step % stepsPerBar;
    var deckGain = musicDecks[activeDeck].gain;
    var chordIdx = Math.floor(bar / theme.padBars) % theme.padChords.length;
    var chord = theme.padChords[chordIdx];
    var barDur = stepDur * stepsPerBar;

    // — Đệm dây + bass ở đầu mỗi hợp âm —
    if (stepInBar === 0 && bar % theme.padBars === 0) {
      for (var c = 0; c < chord.length; c++) {
        playPad(deckGain, freqOf(chord[c]), time, barDur * theme.padBars + stepDur * 2, 0.028);
      }
      // Bass gảy trầm ở gốc hợp âm
      playPluck(deckGain, freqOf(chord[0]), time, 0.16, 2.4);
    }

    // — Trống mềm giữ nhịp cho theme tông môn —
    if (theme.softDrum && stepInBar === 0 && bar % 2 === 0) {
      playTaiko(deckGain, time, 0.05, true);
    }

    // — Chuông nhạc điểm ở đầu chu kỳ (chỉ sect/temple/teleport) —
    if (theme.bellEveryBars > 0 && stepInBar === 0 && bar % theme.bellEveryBars === 0 && bar > 0) {
      playBell(deckGain, freqOf(chord[0] + 5), time, 0.05, 3.5, false);
    }

    // — Arpeggio chảy (rừng / sơn cốc / đài truyền tống) —
    if (theme.arp) {
      var arpSeq = [0, 1, 2, 3, 2, 1, 2, 3];
      var chordTone = chord[arpSeq[stepInBar] % chord.length];
      var arpIdx = chordTone + 5; // đưa lên quãng tám giữa cho sáng
      if (theme.id === 'teleport' && stepInBar % 2 === 0) arpIdx += 5; // lấp lánh tầng cao
      playPluck(deckGain, freqOf(arpIdx), time, theme.id === 'valley' ? 0.05 : 0.065, 1.1);
    }

    // — Giai điệu gảy chính: bước ngẫu nhiên có hạt giống trong vùng bậc —
    var isRhythmStep = theme.rhythm.indexOf(stepInBar) !== -1;
    if (isRhythmStep && seededRand(bar * 8 + stepInBar * 3 + 17) < theme.leadChance) {
      var walk = Math.round((seededRand(step * 1.7 + 5) - 0.5) * 2 * theme.walkMax);
      melodyIndex += walk;
      if (melodyIndex > theme.melHigh) melodyIndex = theme.melHigh - Math.abs(walk);
      if (melodyIndex < theme.melLow) melodyIndex = theme.melLow + Math.abs(walk);
      // Neo giai điệu về tông chủ ở đầu mỗi chu kỳ hợp âm cho khỏi lạc tông
      if (bar % (theme.padBars * theme.padChords.length) === 0 && stepInBar === 0) {
        melodyIndex = chord[0] + 5;
      }
      playPluck(deckGain, freqOf(melodyIndex), time, 0.11, 1.9);
      // Thỉnh thoảng gảy đôi (hòa âm bậc 3 thang âm) ở theme sect
      if (theme.id === 'sect' && seededRand(step * 3.1) > 0.72) {
        playPluck(deckGain, freqOf(melodyIndex + 2), time + stepDur * 0.5, 0.06, 1.4);
      }
    }

    // — Câu sáo/tiêu: phát ở đầu ô nhịp mở câu, câu dài 2 ô nhịp —
    if (theme.fluteEveryBars > 0 && stepInBar === 0 &&
        bar % theme.fluteEveryBars === theme.fluteOffsetBars % theme.fluteEveryBars) {
      var phrase = theme.flutePhrases[phraseIndex % theme.flutePhrases.length];
      phraseIndex++;
      for (var f = 0; f < phrase.length; f++) {
        var note = phrase[f];
        playFlute(deckGain, freqOf(note[1]), time + note[0] * stepDur,
          note[2] * stepDur * 0.92, theme.id === 'interior' ? 0.055 : 0.075, theme.fluteKind);
      }
    }

    // — LỚP CHIẾN ĐẤU: trống taiko + ostinato gảy nhanh (qua combatGain riêng) —
    if (combatActive) {
      var drumPat = (bar % 2 === 0)
        ? [1, 0, 0, 0.6, 0, 0, 0.5, 0]   // ô chẵn:  trọng – phụ
        : [1, 0, 0.5, 0, 0.7, 0, 0.5, 0.6]; // ô lẻ: dồn dập hơn
      var dv = drumPat[stepInBar];
      if (dv > 0) playTaiko(combatGain, time, 0.22 * dv, stepInBar === 0 || stepInBar === 4);
      var ostSeq = [0, 3, 2, 3];
      var ostIdx = chord[0] + 5 + ostSeq[Math.floor(step / 2) % 4]; // quanh gốc, quãng giữa
      playPluck(combatGain, freqOf(ostIdx), time, 0.075, 0.55);
      if (stepInBar === 7) { // dồn cuối ô nhịp
        playPluck(combatGain, freqOf(ostIdx + 2), time + stepDur * 0.5, 0.06, 0.4);
      }
    }
  }

  // ==========================================================================
  // 9. AMBIENCE — LỚP NỀN LIÊN TỤC (gió / suối) THEO DECK
  // ==========================================================================
  function makeLoopNoise() {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function addLFO(destParam, rateHz, depth, baseTime) {
    var lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(rateHz, baseTime);
    var g = ctx.createGain();
    g.gain.setValueAtTime(depth, baseTime);
    lfo.connect(g);
    g.connect(destParam);
    lfo.start(baseTime);
    return lfo;
  }

  /** Dựng một deck ambience cho theme; trả {gain, stop()} — stop() ngắt mọi nguồn. */
  function buildAmbienceDeck(themeId) {
    var cfg = AMBIENCE[themeId] || AMBIENCE.temple;
    var now = ctx.currentTime;
    var deckGain = ctx.createGain();
    deckGain.gain.setValueAtTime(0, now);
    deckGain.connect(ambienceBus);
    var nodes = [];
    function track(n) { nodes.push(n); return n; }

    try {
      // Gió: noise -> bandpass -> gain có LFO thở (mọi theme đều có, mức khác nhau)
      if (cfg.wind > 0) {
        var windSrc = track(makeLoopNoise());
        var windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(cfg.windFreq, now);
        windFilter.Q.setValueAtTime(themeId === 'interior' ? 2.2 : 0.55, now);
        var windGain = ctx.createGain();
        var windLevel = cfg.wind * 0.11;
        windGain.gain.setValueAtTime(windLevel, now);
        windSrc.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(deckGain);
        track(addLFO(windGain.gain, 0.07, windLevel * 0.55, now));
        track(addLFO(windFilter.frequency, 0.045, cfg.windFreq * 0.22, now));
        windSrc.start(now);
      }
      // Suối: noise -> bandpass cao hơn, LFO gợn sóng nhanh hơn gió
      if (cfg.stream > 0) {
        var streamSrc = track(makeLoopNoise());
        var streamFilter = ctx.createBiquadFilter();
        streamFilter.type = 'bandpass';
        streamFilter.frequency.setValueAtTime(1150, now);
        streamFilter.Q.setValueAtTime(0.4, now);
        var streamGain = ctx.createGain();
        var streamLevel = cfg.stream * 0.075;
        streamGain.gain.setValueAtTime(streamLevel, now);
        streamSrc.connect(streamFilter);
        streamFilter.connect(streamGain);
        streamGain.connect(deckGain);
        track(addLFO(streamGain.gain, 0.23, streamLevel * 0.35, now));
        track(addLFO(streamFilter.frequency, 0.06, 260, now));
        streamSrc.start(now);
      }
    } catch (e) {}

    return {
      gain: deckGain,
      cfg: cfg,
      stop: function () {
        for (var i = 0; i < nodes.length; i++) {
          try { nodes[i].stop(); } catch (e) {}
          try { nodes[i].disconnect(); } catch (e) {}
        }
        try { deckGain.disconnect(); } catch (e) {}
      }
    };
  }

  // ==========================================================================
  // 10. AMBIENCE — SỰ KIỆN THƯA NGẪU NHIÊN (theo deck đang hoạt động)
  // ==========================================================================
  function ambDeckGain() {
    var d = ambDecks[activeAmbDeck];
    return d ? d.gain : null;
  }

  function scheduleAmbienceEvents(horizon) {
    var deck = ambDecks[activeAmbDeck];
    if (!deck || !ctx) return;
    var cfg = deck.cfg;
    var dest = deck.gain;
    var now = ctx.currentTime;

    if (cfg.bell && nextAmb.bell <= horizon) {
      playBell(dest, freqOf(4), Math.max(nextAmb.bell, now + 0.03),
        currentTheme.id === 'interior' ? 0.028 : 0.05, 5.0, true);
      nextAmb.bell = now + randRange(cfg.bell[0], cfg.bell[1]);
    }
    if (cfg.bird && nextAmb.bird <= horizon) {
      playBirdChirps(dest, Math.max(nextAmb.bird, now + 0.03), 0.05);
      nextAmb.bird = now + randRange(cfg.bird[0], cfg.bird[1]);
    }
    if (cfg.insect && nextAmb.insect <= horizon) {
      playInsects(dest, Math.max(nextAmb.insect, now + 0.03), currentTheme.id === 'forest' ? 0.02 : 0.012);
      nextAmb.insect = now + randRange(cfg.insect[0], cfg.insect[1]);
    }
    if (cfg.rustle && nextAmb.rustle <= horizon) {
      playRustle(dest, Math.max(nextAmb.rustle, now + 0.03), 0.055);
      nextAmb.rustle = now + randRange(cfg.rustle[0], cfg.rustle[1]);
    }
    if (cfg.flap && nextAmb.flap <= horizon) {
      playBannerFlaps(dest, Math.max(nextAmb.flap, now + 0.03), 0.06);
      nextAmb.flap = now + randRange(cfg.flap[0], cfg.flap[1]);
    }
    if (cfg.wood && nextAmb.wood <= horizon) {
      var t0 = Math.max(nextAmb.wood, now + 0.03);
      var taps = [0, 0.28, 0.56, 1.12];
      for (var i = 0; i < taps.length; i++) {
        if (Math.random() > 0.25) playWood(dest, t0 + taps[i], 0.045, true);
      }
      nextAmb.wood = now + randRange(cfg.wood[0], cfg.wood[1]);
    }
  }

  /** Tiếng chim: 2–4 tiếng líu ngắn, cao độ trượt lên rồi xuống. */
  function playBirdChirps(dest, time, vol) {
    if (!ctx || !dest) return;
    try {
      var count = 2 + Math.floor(Math.random() * 3);
      for (var i = 0; i < count; i++) {
        var t = time + i * randRange(0.16, 0.22);
        var base = randRange(2500, 3100);
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, t);
        osc.frequency.exponentialRampToValueAtTime(base * 1.3, t + 0.05);
        osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.13);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.16);
      }
    } catch (e) {}
  }

  /** Tiếng côn trùng: tràng xung cao tần ngắn đều nhịp ~0.6s. */
  function playInsects(dest, time, vol) {
    if (!ctx || !dest) return;
    try {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(randRange(4100, 4600), time);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      var pulses = 9;
      for (var i = 0; i < pulses; i++) {
        var t = time + i * 0.07;
        gain.gain.linearRampToValueAtTime(vol, t + 0.015);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.055);
      }
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + pulses * 0.07 + 0.05);
    } catch (e) {}
  }

  /** Xào xạc lá: noise dải cao, phồng lên rồi tắt như một cơn gió lùa. */
  function playRustle(dest, time, vol) {
    if (!ctx || !dest) return;
    try {
      var src = makeLoopNoise();
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2900, time);
      bp.Q.setValueAtTime(0.5, time);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.28);
      gain.gain.linearRampToValueAtTime(0.0001, time + 0.85);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(dest);
      src.start(time);
      src.stop(time + 0.9);
    } catch (e) {}
  }

  /** Tiếng phướn vải phấp phới: 3 đợt noise trầm ngắn liên tiếp, yếu dần. */
  function playBannerFlaps(dest, time, vol) {
    if (!ctx || !dest) return;
    try {
      for (var i = 0; i < 3; i++) {
        var t = time + i * 0.14;
        var src = makeLoopNoise();
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(750, t);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(vol * (1 - i * 0.22), t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        src.connect(lp);
        lp.connect(gain);
        gain.connect(dest);
        src.start(t);
        src.stop(t + 0.12);
      }
    } catch (e) {}
  }

  // ==========================================================================
  // 11. CHUYỂN THEME (crossfade ~1.2s cho cả nhạc lẫn ambience)
  // ==========================================================================
  function activateTheme(themeId, instant) {
    var theme = THEMES[themeId] || THEMES[DEFAULT_THEME_ID];
    var sameTheme = (theme.id === currentTheme.id);
    currentTheme = theme;
    if (!ctx || !started) return;
    var now = ctx.currentTime;
    var fade = instant ? 0.15 : CROSSFADE_SEC;

    if (!sameTheme || instant) {
      // Nhạc: deck cũ mờ dần, deck mới (deck còn lại) mở dần
      var oldDeck = musicDecks[activeDeck];
      activeDeck = 1 - activeDeck;
      var newDeck = musicDecks[activeDeck];
      try {
        oldDeck.gain.gain.cancelScheduledValues(now);
        oldDeck.gain.gain.setValueAtTime(oldDeck.gain.gain.value, now);
        oldDeck.gain.gain.linearRampToValueAtTime(0, now + fade);
        newDeck.gain.gain.cancelScheduledValues(now);
        newDeck.gain.gain.setValueAtTime(instant ? 0 : newDeck.gain.gain.value, now);
        newDeck.gain.gain.linearRampToValueAtTime(theme.gain, now + fade);
      } catch (e) {}
      melodyIndex = theme.melLow + 2;
    } else {
      // Cùng theme (đặt lại cùng map): chỉ đảm bảo deck đang mở đúng mức
      try {
        musicDecks[activeDeck].gain.gain.setTargetAtTime(theme.gain, now, 0.2);
      } catch (e) {}
    }

    // Ambience: dựng deck mới cho theme, crossfade, dừng deck cũ sau khi mờ hết
    var oldAmb = ambDecks[activeAmbDeck];
    activeAmbDeck = 1 - activeAmbDeck;
    var newAmb = buildAmbienceDeck(theme.id);
    ambDecks[activeAmbDeck] = newAmb;
    try {
      newAmb.gain.gain.setValueAtTime(0, now);
      newAmb.gain.gain.linearRampToValueAtTime(1, now + fade);
      if (oldAmb) {
        oldAmb.gain.gain.cancelScheduledValues(now);
        oldAmb.gain.gain.setValueAtTime(oldAmb.gain.gain.value, now);
        oldAmb.gain.gain.linearRampToValueAtTime(0, now + fade);
        var toStop = oldAmb;
        setTimeout(function () { toStop.stop(); }, (fade + 0.4) * 1000);
      }
    } catch (e) {}
    resetAmbTimers(now);
  }

  // ==========================================================================
  // 12. API CÔNG KHAI — window.GameMusic
  // ==========================================================================
  function unlock() {
    if (!AudioContextClass) return; // Không có WebAudio: im lặng, không ném lỗi
    if (started && ctx) {
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      return;
    }
    try {
      buildGraph();
      started = true;
      if (ctx.state === 'suspended') ctx.resume();
      // Deck nhạc đầu tiên mở theo theme của map đã chọn (hoặc mặc định)
      try {
        musicDecks[activeDeck].gain.gain.setValueAtTime(0, ctx.currentTime);
        musicDecks[activeDeck].gain.gain.linearRampToValueAtTime(
          currentTheme.gain, ctx.currentTime + CROSSFADE_SEC);
      } catch (e) {}
      ambDecks[activeAmbDeck] = buildAmbienceDeck(currentTheme.id);
      try {
        ambDecks[activeAmbDeck].gain.gain.setValueAtTime(0, ctx.currentTime);
        ambDecks[activeAmbDeck].gain.gain.linearRampToValueAtTime(1, ctx.currentTime + CROSSFADE_SEC);
      } catch (e) {}
      if (combatActive) {
        try { combatGain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4); } catch (e) {}
      }
      startScheduler();
    } catch (e) {
      started = false;
      ctx = null;
    }
  }

  function setMap(mapId) {
    currentMapId = mapId || null;
    var themeId = themeIdForMap(mapId);
    if (themeId === currentTheme.id && started) return;
    activateTheme(themeId, false);
    // Khi chưa unlock: activateTheme chỉ ghi theme; unlock() sẽ mở đúng theme đó.
  }

  function setCombat(active) {
    var next = !!active;
    if (next === combatActive) return; // gọi mỗi khung hình vẫn rẻ
    combatActive = next;
    if (!ctx || !started || !combatGain) return;
    try {
      var now = ctx.currentTime;
      combatGain.gain.cancelScheduledValues(now);
      combatGain.gain.setValueAtTime(combatGain.gain.value, now);
      if (combatActive) {
        combatGain.gain.linearRampToValueAtTime(0.9, now + 0.8);  // vào nhanh
      } else {
        combatGain.gain.linearRampToValueAtTime(0, now + 1.2);    // ra chậm
      }
    } catch (e) {}
  }

  function setMusicVolume(v) {
    musicVol = clamp01(v);
    if (ctx && musicBus) {
      try { musicBus.gain.setTargetAtTime(musicVol * 0.85, ctx.currentTime, 0.05); } catch (e) {}
    }
  }

  function setAmbienceVolume(v) {
    ambienceVol = clamp01(v);
    if (ctx && ambienceBus) {
      try { ambienceBus.gain.setTargetAtTime(ambienceVol * 0.9, ctx.currentTime, 0.05); } catch (e) {}
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (ctx && masterGain) {
      try { masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.06); } catch (e) {}
    }
  }

  function isStarted() {
    return !!(started && ctx);
  }

  var GameMusic = {
    unlock: unlock,
    setMap: setMap,
    setCombat: setCombat,
    setMusicVolume: setMusicVolume,
    setAmbienceVolume: setAmbienceVolume,
    setMuted: setMuted,
    isStarted: isStarted
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameMusic;
  }
  if (typeof global !== 'undefined') {
    global.GameMusic = GameMusic;
  }
})(typeof window !== 'undefined' ? window : this);
