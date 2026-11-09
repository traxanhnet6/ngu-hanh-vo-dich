/**
 * pathfind.js — Thuật toán tìm đường A* trên lưới va chạm 24px
 * Hỗ trợ 8 hướng di chuyển, chống cắt góc, tự động tìm ô đi được gần nhất khi đích bị cản.
 * Tương thích cả Browser và Node.js.
 */
(function (global) {
  'use strict';

  var SQRT2 = Math.SQRT2 || 1.41421356;

  /**
   * Tìm ô đi được gần nhất xung quanh một điểm đích bị khóa (spiral BFS)
   */
  function findNearestWalkable(gx, gy, grid) {
    var rows = grid.length;
    var cols = grid[0].length;
    if (gy >= 0 && gy < rows && gx >= 0 && gx < cols && grid[gy][gx] === 0) {
      return { gx: gx, gy: gy };
    }

    var maxRadius = 25; // bán kính tìm kiếm tối đa (~600px)
    for (var r = 1; r <= maxRadius; r++) {
      for (var dx = -r; dx <= r; dx++) {
        for (var dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) === r || Math.abs(dy) === r) {
            var nx = gx + dx;
            var ny = gy + dy;
            if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] === 0) {
              return { gx: nx, gy: ny };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Hàm heuristic khoảng cách Chebyshev / Euclidean cho 8 hướng
   */
  function heuristic(x1, y1, x2, y2) {
    var dx = Math.abs(x1 - x2);
    var dy = Math.abs(y1 - y2);
    return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
  }

  /**
   * Tìm đường A* từ (startX, startY) tới (targetX, targetY)
   * @param {number} startX Tọa độ thế giới pixel X bắt đầu
   * @param {number} startY Tọa độ thế giới pixel Y bắt đầu
   * @param {number} targetX Tọa độ thế giới pixel X đích đến
   * @param {number} targetY Tọa độ thế giới pixel Y đích đến
   * @param {Array<Array<number>>} grid Ma trận va chạm (0: đi được, 1: cản)
   * @param {number} gridSize Kích thước ô lưới pixel (mặc định 24)
   * @returns {Array<{x: number, y: number}>} Mảng các điểm mốc thế giới, hoặc rỗng nếu không tìm thấy
   */
  function findPath(startX, startY, targetX, targetY, grid, gridSize) {
    gridSize = gridSize || 24;
    var rows = grid.length;
    var cols = grid[0].length;

    var sgx = Math.max(0, Math.min(cols - 1, Math.floor(startX / gridSize)));
    var sgy = Math.max(0, Math.min(rows - 1, Math.floor(startY / gridSize)));
    var tgx = Math.max(0, Math.min(cols - 1, Math.floor(targetX / gridSize)));
    var tgy = Math.max(0, Math.min(rows - 1, Math.floor(targetY / gridSize)));

    // Nếu điểm bắt đầu bị kẹt, tìm ô gần nhất
    if (grid[sgy][sgx] !== 0) {
      var nearStart = findNearestWalkable(sgx, sgy, grid);
      if (nearStart) {
        sgx = nearStart.gx;
        sgy = nearStart.gy;
      }
    }

    // Nếu điểm đích bị cản, chuyển sang ô đi được gần nhất
    if (grid[tgy][tgx] !== 0) {
      var nearTarget = findNearestWalkable(tgx, tgy, grid);
      if (!nearTarget) return [];
      tgx = nearTarget.gx;
      tgy = nearTarget.gy;
    }

    if (sgx === tgx && sgy === tgy) {
      return [{ x: targetX, y: targetY }];
    }

    // A* với Priority Queue đơn giản
    var openSet = [];
    var closedSet = new Uint8Array(rows * cols);
    var gScore = new Float32Array(rows * cols);
    var fScore = new Float32Array(rows * cols);
    var cameFrom = new Int32Array(rows * cols);

    for (var i = 0; i < rows * cols; i++) {
      gScore[i] = 1e9;
      fScore[i] = 1e9;
      cameFrom[i] = -1;
    }

    var startIdx = sgy * cols + sgx;
    var targetIdx = tgy * cols + tgx;

    gScore[startIdx] = 0;
    fScore[startIdx] = heuristic(sgx, sgy, tgx, tgy);
    openSet.push({ idx: startIdx, f: fScore[startIdx] });

    // 8 hướng di chuyển: 4 hướng thẳng và 4 hướng chéo
    var neighbors = [
      { dx: 0, dy: -1, cost: 1 },
      { dx: 0, dy: 1, cost: 1 },
      { dx: -1, dy: 0, cost: 1 },
      { dx: 1, dy: 0, cost: 1 },
      { dx: -1, dy: -1, cost: SQRT2 },
      { dx: 1, dy: -1, cost: SQRT2 },
      { dx: -1, dy: 1, cost: SQRT2 },
      { dx: 1, dy: 1, cost: SQRT2 }
    ];

    while (openSet.length > 0) {
      // Lấy phần tử có f nhỏ nhất
      var bestIdx = 0;
      var minF = openSet[0].f;
      for (var o = 1; o < openSet.length; o++) {
        if (openSet[o].f < minF) {
          minF = openSet[o].f;
          bestIdx = o;
        }
      }

      var current = openSet.splice(bestIdx, 1)[0].idx;
      if (current === targetIdx) {
        // Tái tạo đường đi
        var path = [];
        var curr = current;
        while (curr !== -1) {
          var cy = Math.floor(curr / cols);
          var cx = curr % cols;
          path.push({
            x: cx * gridSize + gridSize / 2,
            y: cy * gridSize + gridSize / 2
          });
          curr = cameFrom[curr];
        }
        path.reverse();

        // Thay điểm đầu bằng vị trí thật của người chơi, điểm cuối bằng vị trí đích thật nếu ô đích đi được,
        // hoặc giữ tâm ô đi được gần nhất nếu đích ban đầu bị cản (Đợt 6 - Việc 3)
        if (path.length > 0) {
          path[0] = { x: startX, y: startY };
          var origTgx = Math.max(0, Math.min(cols - 1, Math.floor(targetX / gridSize)));
          var origTgy = Math.max(0, Math.min(rows - 1, Math.floor(targetY / gridSize)));
          if (grid[origTgy][origTgx] === 0) {
            path[path.length - 1] = { x: targetX, y: targetY };
          } else {
            path[path.length - 1] = { x: (tgx + 0.5) * gridSize, y: (tgy + 0.5) * gridSize };
          }
        }
        return path;
      }

      closedSet[current] = 1;
      var curX = current % cols;
      var curY = Math.floor(current / cols);

      for (var n = 0; n < neighbors.length; n++) {
        var nb = neighbors[n];
        var nx = curX + nb.dx;
        var ny = curY + nb.dy;

        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        var nIdx = ny * cols + nx;
        if (closedSet[nIdx]) continue;
        if (grid[ny][nx] !== 0) continue;

        // Chống cắt góc nhọn khi đi chéo
        if (nb.dx !== 0 && nb.dy !== 0) {
          if (grid[curY][nx] !== 0 || grid[ny][curX] !== 0) {
            continue;
          }
        }

        var tentativeG = gScore[current] + nb.cost;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = current;
          gScore[nIdx] = tentativeG;
          fScore[nIdx] = tentativeG + heuristic(nx, ny, tgx, tgy);

          var alreadyInOpen = false;
          for (var k = 0; k < openSet.length; k++) {
            if (openSet[k].idx === nIdx) {
              openSet[k].f = fScore[nIdx];
              alreadyInOpen = true;
              break;
            }
          }
          if (!alreadyInOpen) {
            openSet.push({ idx: nIdx, f: fScore[nIdx] });
          }
        }
      }
    }

    // Không tìm thấy đường đi trực tiếp
    return [];
  }

  var PathfindAPI = {
    findPath: findPath,
    findNearestWalkable: findNearestWalkable
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PathfindAPI;
  }
  if (typeof global !== 'undefined') {
    global.Pathfinder = PathfindAPI;
  }
})(typeof window !== 'undefined' ? window : this);
