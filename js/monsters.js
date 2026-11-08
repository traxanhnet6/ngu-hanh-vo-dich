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
      iconRow: 0,
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
    'dao-cui-cu': {
      id: 'dao-cui-cu',
      name: 'Dao Củi Cũ',
      type: 'gear',
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
      quality: 'good',
      stackable: false,
      iconCol: 3,
      iconRow: 1,
      desc: 'Gậy làm từ cành cổ thụ linh mộc, ẩn chứa linh lực tự nhiên (+5 công kích, +10 linh lực).'
    }
  };

  // Các nhóm trang bị (Gear Pools)
  var COMMON_GEAR_POOL = ['dao-cui-cu', 'ao-vai-tho'];
  var BETTER_GEAR_POOL = ['gay-co-thu', 'ao-vai-tho'];

  // Định nghĩa chỉ số 3 loài quái vật Rừng Độc Thanh Tụy (Brief §4)
  var SPECIES = {
    thao_tinh: {
      id: 'thao_tinh',
      name: 'Thảo Tinh Nhỏ',
      element: 'moc',
      hp: 30,
      damage: 6,
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
      hp: 44,
      damage: 5,
      armor: 2,
      speed: 118,
      aggroRange: 190,
      attackRange: 44,
      attackCd: 1.3,
      tuViMoc: 3,
      slowOnHit: { ratio: 0.30, duration: 2.0 },
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
    }
  };

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
      leashDistance: 340,

      // Đồng hồ đếm thời gian
      attackTimer: 0,
      hitStunTimer: 0,
      roamPauseTimer: 0,
      roamTarget: null,
      deathTimer: 0,

      // Đặc tính tinh anh
      summonedAdds: false,
      reTroiTimer: spec.reTroi ? 4.0 : 0, // bắt đầu đếm chiêu rễ trói
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

    // Khoảng cách tới điểm nhà (home) và tới người chơi
    var distHome = Math.hypot(m.x - m.homeX, m.y - m.homeY);
    var distPlayer = playerPos ? Math.hypot(m.x - playerPos.x, m.y - playerPos.y) : 99999;

    // Kỹ năng Tinh Anh: Rễ Trói
    if (m.isElite && spec.reTroi && m.state !== 'return') {
      m.reTroiTimer -= dt;
      if (m.reTroiTimer <= 0 && playerPos && distPlayer < 500) {
        m.reTroiTimer = spec.reTroi.interval;
        m.activeTelegraph = {
          x: playerPos.x,
          y: playerPos.y,
          radius: spec.reTroi.telegraphRadius,
          timer: spec.reTroi.telegraphDuration,
          damage: spec.reTroi.damage,
          snareDuration: spec.reTroi.snareDuration
        };
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
          var moveStep = m.speed * 1.3 * dt;
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
            var rstep = (m.speed * 0.5) * dt;
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
          var aStep = m.speed * dt;
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
      anchor: { x: 1380, y: 820 },
      count: 3,
      spread: 55
    },
    // Anchor Cổ Thụ Yêu (Gốc đại cổ thụ Đông-Bắc, Vành trong)
    {
      id: 'pack_cothuye',
      speciesId: 'co_thu_yeu',
      anchor: { x: 1540, y: 420 },
      count: 1,
      spread: 0
    }
  ];

  exports.ITEM_DEFS = ITEM_DEFS;
  exports.COMMON_GEAR_POOL = COMMON_GEAR_POOL;
  exports.BETTER_GEAR_POOL = BETTER_GEAR_POOL;
  exports.SPECIES = SPECIES;
  exports.rollDrops = rollDrops;
  exports.createMonster = createMonster;
  exports.updateMonster = updateMonster;
  exports.damageMonster = damageMonster;
  exports.RUNG_DOC_PACKS = RUNG_DOC_PACKS;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameMonsters = {}));
