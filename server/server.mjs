"use strict";
/* Ngũ Hành Vô Địch — ONLINE chặng 1: khung tối thiểu (thiết kế: ONLINE-DESIGN.md).
 *
 * Pure Node.js, zero external packages, theo mẫu server GD3 của Tiên Lộ
 * (server.mjs 472 dòng, đã live Render): HTTP phục vụ file tĩnh + WebSocket
 * RFC 6455 tự viết trên cùng cổng. Khác GD3 ở 2 điểm chính:
 *   1. Vị trí ĐƯỢC XÁC MINH phía máy chủ (GD3 còn để client báo tự do):
 *      kiểm từng bước + cửa sổ 2 giây + biên map; vi phạm thì bác + sửa
 *      + đủ 5 lần/60s thì kick.
 *   2. Đăng nhập tên duy nhất phía máy chủ + sổ đăng ký tên và vị trí lưu
 *      tối thiểu trên đĩa (server/data/*.json).
 *
 * Chặng 1 CHƯA làm: mật khẩu, save đầy đủ phía server, combat/rơi đồ phía
 * server, Lệnh Mở Phong. Mọi số dưới đây là PROVISIONAL (xem ONLINE-DESIGN.md §10).
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || process.env.NH_PORT || 8918);
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

// ---- số PROVISIONAL (ONLINE-DESIGN.md §10) ----
const WALK_SPEED = 138;      // px/s — số thật trong js/engine.js:44
const STEP_SLACK = 40;       // px dung sai từng bước (làm tròn + trượt băng)
const WINDOW_MS = 2000;      // cửa sổ cộng dồn quãng đường
const WINDOW_SLACK = 120;    // px dung sai cửa sổ 2s
const RESYNC_MS = 2000;      // mất dấu quá lâu thì chấp nhận đồng bộ lại
const WORLD_SYNC_MS = 1000;
const KICK_STRIKES = 5;      // vi phạm trong 60s thì kick
const KICK_WINDOW_MS = 60000;
const CHAT_MAX_LEN = 200;
const CHAT_MIN_INTERVAL_MS = 1500;
const SAVE_INTERVAL_MS = 30000;

// Map thật trong js/mapdata.js (chạy Node trích MapData.maps).
const MAPS = {
  "mieu_hoang": [1920, 1280], "rung-doc": [1920, 1280], "tong-mon": [1920, 1280],
  "dai-dien": [1200, 800], "phong-luyen-dan": [1600, 800], "son-coc": [1152, 768],
  "dai-truyen-tong": [960, 672], "ruong-linh-me": [1200, 800],
  "ho-bang": [1920, 1280], "mo-lua": [1920, 1280], "hoang-mac": [1920, 1280],
  "kiem-trung": [1920, 1280], "tay-luong": [1600, 1000], "dinh-tien-mon": [1920, 1280],
};
const DEFAULT_MAP = "mieu_hoang";
const DEFAULT_SPAWN = { x: 560, y: 620 }; // khớp state.js createPlayer

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ------------------------------------------------------- lưu bền tối thiểu
mkdirSync(DATA_DIR, { recursive: true });
function loadJson(name, fallback) {
  try {
    const p = join(DATA_DIR, name);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  } catch { /* file hỏng -> dùng mặc định */ }
  return fallback;
}
function saveJson(name, obj) {
  try { writeFileSync(join(DATA_DIR, name), JSON.stringify(obj, null, 2), "utf8"); } catch (e) { log("[SAVE-ERR]", name, e.message); }
}
// accounts: { lowerName: { name, firstSeen, lastSeen } } — sổ đăng ký tên,
// CHƯA phải quyền sở hữu (chưa có mật khẩu — xem ONLINE-DESIGN.md §4.1).
// saves: { lowerName: { map, x, y, savedAt } } — vị trí cuối lúc ngắt kết nối.
let accounts = loadJson("accounts.json", {});
let saves = loadJson("saves.json", {});
let dirty = false;
function persist() {
  if (!dirty) return;
  saveJson("accounts.json", accounts);
  saveJson("saves.json", saves);
  dirty = false;
}
setInterval(persist, SAVE_INTERVAL_MS);

// ------------------------------------------------------------- ws core
// (Cùng mẫu GD3: handshake + frame RFC 6455 tự viết, không dependency.)
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
function wsAccept(key) { return createHash("sha1").update(key + WS_GUID).digest("base64"); }
function encodeFrame(str) {
  const payload = Buffer.from(str, "utf8");
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.from([0x81, len]); }
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
class WSConn {
  constructor(socket) {
    this.socket = socket; this.buf = Buffer.alloc(0); this.frag = [];
    this.player = null; this.room = null; this.alive = true;
    socket.on("data", d => this.onData(d));
    socket.on("close", () => this.onClose());
    socket.on("error", () => this.onClose());
  }
  send(obj) { if (this.alive) { try { this.socket.write(encodeFrame(JSON.stringify(obj))); } catch { /* gone */ } } }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = !!(b0 & 0x80), op = b0 & 0x0f, masked = !!(b1 & 0x80);
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const maskOff = off; if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = this.buf.subarray(off, off + len);
      if (masked) {
        const mask = this.buf.subarray(maskOff, maskOff + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
        payload = out;
      }
      this.buf = this.buf.subarray(off + len);
      if (op === 0x9) { // ping -> pong
        const head = Buffer.from([0x8a, payload.length]);
        try { this.socket.write(Buffer.concat([head, payload])); } catch { /* gone */ }
        continue;
      }
      if (op === 0x8) { this.onClose(); try { this.socket.end(); } catch { /* gone */ } return; }
      if (op === 0x1 || op === 0x0) {
        this.frag.push(payload);
        if (fin) {
          const full = Buffer.concat(this.frag).toString("utf8");
          this.frag = [];
          let msg; try { msg = JSON.parse(full); } catch { continue; }
          try { handleMessage(this, msg); } catch (e) { log("[ERR]", e && e.message); }
        }
      }
    }
  }
  onClose() {
    if (!this.alive) return;
    this.alive = false;
    if (this.player && this.room) {
      this.room.players.delete(this.player.id);
      broadcast(this.room, { type: "player_left", playerId: this.player.id }, null);
      savePlayerPos(this.player);
      log(`[LEAVE] ${this.player.id} (${this.player.name}) from ${this.room.map}`);
    }
    this.player = null; this.room = null;
  }
}
function broadcast(room, obj, except) {
  for (const p of room.players.values()) if (p.conn !== except) p.conn.send(obj);
}

// ------------------------------------------------------------- worlds
const rooms = new Map();
function getRoom(map) {
  if (!rooms.has(map)) rooms.set(map, { map, players: new Map() });
  return rooms.get(map);
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y),
           dir: p.dir | 0, map: p.map };
}
function roomSnapshot(room) {
  return { players: [...room.players.values()].map(publicPlayer) };
}
function savePlayerPos(p) {
  saves[p.lowerName] = { map: p.map, x: Math.round(p.x), y: Math.round(p.y), savedAt: Date.now() };
  if (accounts[p.lowerName]) accounts[p.lowerName].lastSeen = Date.now();
  dirty = true;
  persist();
}

// ------------------------------------------------- xác minh di chuyển (§5)
function clampToMap(map, x, y) {
  const [w, h] = MAPS[map];
  return { x: Math.max(0, Math.min(w, x)), y: Math.max(0, Math.min(h, y)) };
}
function validateMove(p, nx, ny, now) {
  const dt = (now - p.lastT) / 1000;
  if (dt <= 0) return { ok: true, d: 0 };
  if (dt * 1000 > RESYNC_MS) return { ok: true, d: 0, resync: true };
  const d = Math.hypot(nx - p.lastX, ny - p.lastY);
  if (d > WALK_SPEED * dt + STEP_SLACK) {
    return { ok: false, reason: "step_too_far", d, allowed: WALK_SPEED * dt + STEP_SLACK };
  }
  p.window = p.window.filter(w => now - w.t <= WINDOW_MS);
  const wsum = p.window.reduce((a, w) => a + w.d, 0) + d;
  if (wsum > WALK_SPEED * (WINDOW_MS / 1000) + WINDOW_SLACK) {
    return { ok: false, reason: "window_too_far", d: wsum };
  }
  return { ok: true, d };
}
function recordStrike(p, reason) {
  const now = Date.now();
  p.strikes = p.strikes.filter(t => now - t <= KICK_WINDOW_MS);
  p.strikes.push(now);
  log(`[CHEAT] ${p.id} (${p.name}) ${reason} strikes=${p.strikes.length}`);
  if (p.strikes.length >= KICK_STRIKES) {
    p.conn.send({ type: "kicked", reason: "too_many_invalid_moves" });
    try { p.conn.socket.end(); } catch { /* gone */ }
    return true;
  }
  return false;
}

// ------------------------------------------------------------- logic
let nextPlayerId = 1;
function validName(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (name.length < 2 || name.length > 20) return null;
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}
function handleMessage(conn, msg) {
  const p = conn.player;
  switch (msg.type) {
    case "login": {
      if (p) return; // đã đăng nhập
      const name = validName(msg.name);
      if (!name) { conn.send({ type: "login_error", reason: "name_invalid" }); return; }
      const lower = name.toLowerCase();
      for (const room of rooms.values()) {
        for (const other of room.players.values()) {
          if (other.lowerName === lower) {
            conn.send({ type: "login_error", reason: "name_taken" });
            log(`[LOGIN] reject taken name=${name}`);
            return;
          }
        }
      }
      const now = Date.now();
      if (!accounts[lower]) accounts[lower] = { name, firstSeen: now, lastSeen: now };
      else accounts[lower].lastSeen = now;
      dirty = true;
      const saved = saves[lower];
      let map = DEFAULT_MAP, x = DEFAULT_SPAWN.x, y = DEFAULT_SPAWN.y;
      if (saved && MAPS[saved.map]) {
        map = saved.map;
        const c = clampToMap(map, saved.x, saved.y);
        x = c.x; y = c.y;
      } else if (typeof msg.x === "number" && typeof msg.y === "number" && MAPS[msg.map || DEFAULT_MAP]) {
        map = msg.map || DEFAULT_MAP;
        const c = clampToMap(map, msg.x, msg.y);
        x = c.x; y = c.y;
      }
      const np = {
        id: "p" + (nextPlayerId++), conn, name, lowerName: lower,
        map, x, y, dir: 0,
        lastX: x, lastY: y, lastT: now, window: [], strikes: [],
        lastChatAt: 0,
      };
      conn.player = np;
      const room = getRoom(map);
      conn.room = room;
      room.players.set(np.id, np);
      conn.send({ type: "login_ok", playerId: np.id,
                  you: { name: np.name, map, x: Math.round(x), y: Math.round(y) },
                  world: roomSnapshot(room) });
      broadcast(room, { type: "player_joined", player: publicPlayer(np) }, conn);
      log(`[LOGIN] ${np.id} (${np.name}) -> ${map} (${Math.round(x)},${Math.round(y)})`);
      break;
    }
    case "pos": {
      if (!p) return;
      const now = Date.now();
      const nx = Number(msg.x), ny = Number(msg.y);
      if (!isFinite(nx) || !isFinite(ny)) return;
      const c = clampToMap(p.map, nx, ny);
      const res = validateMove(p, c.x, c.y, now);
      if (!res.ok) {
        conn.send({ type: "pos_reject", x: Math.round(p.lastX), y: Math.round(p.lastY), reason: res.reason });
        recordStrike(p, `${res.reason} d=${Math.round(res.d)} allowed=${Math.round(res.allowed || 0)}`);
        return;
      }
      if (!res.resync && res.d > 0) p.window.push({ t: now, d: res.d });
      p.lastX = c.x; p.lastY = c.y; p.lastT = now;
      p.x = c.x; p.y = c.y;
      if (typeof msg.dir === "number") p.dir = ((msg.dir % 8) + 8) % 8;
      broadcast(conn.room, { type: "player_moved", player: publicPlayer(p) }, conn);
      break;
    }
    case "enter_map": {
      if (!p) return;
      const map = String(msg.map || "");
      if (!MAPS[map]) { conn.send({ type: "pos_reject", x: Math.round(p.lastX), y: Math.round(p.lastY), reason: "unknown_map" }); return; }
      const now = Date.now();
      const c = clampToMap(map, Number(msg.x) || 0, Number(msg.y) || 0);
      const old = conn.room;
      if (old) { old.players.delete(p.id); broadcast(old, { type: "player_left", playerId: p.id }, conn); }
      p.map = map; p.x = c.x; p.y = c.y;
      p.lastX = c.x; p.lastY = c.y; p.lastT = now; p.window = []; // đặt lại gốc
      const room = getRoom(map);
      conn.room = room;
      room.players.set(p.id, p);
      conn.send({ type: "map_state", map, world: roomSnapshot(room) });
      broadcast(room, { type: "player_joined", player: publicPlayer(p) }, conn);
      log(`[MAP] ${p.id} (${p.name}) -> ${map} (${c.x},${c.y})`);
      break;
    }
    case "chat": {
      if (!p) return;
      const now = Date.now();
      const text = typeof msg.text === "string" ? msg.text.trim() : "";
      if (!text) return;
      if (text.length > CHAT_MAX_LEN) { conn.send({ type: "chat_reject", reason: "too_long" }); return; }
      if (now - p.lastChatAt < CHAT_MIN_INTERVAL_MS) { conn.send({ type: "chat_reject", reason: "rate" }); return; }
      p.lastChatAt = now;
      broadcast(conn.room, { type: "chat", playerId: p.id, name: p.name, text: text.slice(0, CHAT_MAX_LEN) }, null);
      log(`[CHAT] ${p.name}: ${text.slice(0, 60)}`);
      break;
    }
  }
}

// ------------------------------------------------------- world sync
setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.players.size) continue;
    broadcast(room, { type: "world_sync", world: roomSnapshot(room) }, null);
  }
}, WORLD_SYNC_MS);

// ------------------------------------------------------------ http+ws
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg",
               ".json": "application/json", ".mp3": "audio/mpeg",
               ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const file = join(ROOT, p);
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end("nf"); return; }
  try {
    const data = readFileSync(file);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(500); res.end("err"); }
});
server.on("upgrade", (req, socket) => {
  const key = req.headers["sec-websocket-key"];
  if (!key) { socket.destroy(); return; }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${wsAccept(key)}\r\n\r\n`);
  new WSConn(socket);
});
server.listen(PORT, () => log(`[BOOT] Ngũ Hành online chặng 1 on http://127.0.0.1:${PORT} (HTTP+WS), root=${ROOT}`));
