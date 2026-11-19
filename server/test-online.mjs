"use strict";
/* Harness kiểm chặng 1 online (chạy local, không cần trình duyệt).
 * Khởi động server thật trên cổng test, nối bằng WebSocket client có sẵn
 * của Node 24, kiểm: đăng nhập tên duy nhất, thấy nhau di chuyển, chat,
 * máy chủ bác dịch chuyển gian lận + kick sau 5 lần, đổi map, lưu tên/vị trí.
 * Chạy: node server/test-online.mjs  (exit 0 = tất cả PASS)
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 18918;
const WS_URL = `ws://127.0.0.1:${PORT}`;
const DATA_DIR = join(ROOT, "server", "data");

const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} :: ${detail || ""}`); }
}

class Client {
  constructor(name) {
    this.name = name;
    this.msgs = [];
    this.waiters = [];
    this.closed = false;
    this.ws = new WebSocket(WS_URL);
    this.ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      this.msgs.push(m);
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        const w = this.waiters[i];
        if (w.pred(m)) { this.waiters.splice(i, 1); w.res(m); }
      }
    };
    this.ws.onclose = () => { this.closed = true; };
    this.ws.onerror = () => { /* close sẽ báo */ };
  }
  async open() {
    if (this.ws.readyState === 1) return;
    await new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
      setTimeout(() => rej(new Error("open timeout")), 5000);
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  waitFor(pred, timeoutMs = 5000) {
    const hit = this.msgs.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((res, rej) => {
      const w = { pred, res };
      this.waiters.push(w);
      setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        rej(new Error("wait timeout for " + JSON.stringify(this.msgs.slice(-3))));
      }, timeoutMs);
    });
  }
  last(pred) { for (let i = this.msgs.length - 1; i >= 0; i--) if (pred(this.msgs[i])) return this.msgs[i]; return null; }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function main() {
  // Dọn dữ liệu test cũ để kết quả độc lập với lần chạy trước.
  for (const f of ["accounts.json", "saves.json"]) {
    const p = join(DATA_DIR, f);
    if (existsSync(p)) rmSync(p);
  }
  const srv = spawn("node", ["server/server.mjs"], {
    cwd: ROOT, env: { ...process.env, NH_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let boot = false;
  srv.stdout.on("data", d => { if (String(d).includes("[BOOT]")) boot = true; });
  srv.stderr.on("data", d => process.stderr.write("[SRV-ERR] " + d));
  for (let i = 0; i < 50 && !boot; i++) await sleep(100);
  check("T0 server boot", boot, "không thấy [BOOT] sau 5s");

  // T0b: phục vụ file tĩnh (index.html có nhúng js/net.js)
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    const html = await res.text();
    check("T0b static index.html", res.status === 200 && html.includes("js/net.js"), `status=${res.status}`);
    const netRes = await fetch(`http://127.0.0.1:${PORT}/js/net.js`);
    check("T0c static js/net.js", netRes.status === 200 && (await netRes.text()).includes("NHNET"), `status=${netRes.status}`);
  } catch (e) { check("T0b static", false, e.message); }

  // T1: đăng nhập A
  const a = new Client("KiemKhach");
  await a.open();
  a.send({ type: "login", name: "KiemKhach" });
  const okA = await a.waitFor(m => m.type === "login_ok").catch(() => null);
  check("T1 login A ok", !!okA && okA.you && okA.you.name === "KiemKhach", JSON.stringify(okA));

  // T2: trùng tên (khác hoa/thường) bị từ chối
  const dup = new Client("kiemkhach");
  await dup.open();
  dup.send({ type: "login", name: "kiemkhach" });
  const dupErr = await dup.waitFor(m => m.type === "login_error").catch(() => null);
  check("T2 trùng tên bị từ chối", !!dupErr && dupErr.reason === "name_taken", JSON.stringify(dupErr));
  dup.close();

  // T3: tên không hợp lệ
  const bad = new Client("x");
  await bad.open();
  bad.send({ type: "login", name: "x" });
  const badErr = await bad.waitFor(m => m.type === "login_error").catch(() => null);
  check("T3 tên 1 ký tự bị từ chối", !!badErr && badErr.reason === "name_invalid", JSON.stringify(badErr));
  bad.close();

  // T4: đăng nhập B, A thấy B vào
  const b = new Client("LinhNhi2");
  await b.open();
  b.send({ type: "login", name: "LinhNhi2" });
  const okB = await b.waitFor(m => m.type === "login_ok").catch(() => null);
  check("T4 login B ok", !!okB, JSON.stringify(okB));
  const joined = await a.waitFor(m => m.type === "player_joined" && m.player && m.player.name === "LinhNhi2").catch(() => null);
  check("T4b A thấy B vào map", !!joined, JSON.stringify(a.msgs.slice(-2)));

  // T5: A di chuyển từng bước nhỏ, B thấy A di chuyển
  a.send({ type: "pos", x: 570, y: 620, dir: 2 });
  await sleep(150);
  a.send({ type: "pos", x: 580, y: 620, dir: 2 });
  const moved = await b.waitFor(m => m.type === "player_moved" && m.player && m.player.name === "KiemKhach" && m.player.x === 580).catch(() => null);
  check("T5 B thấy A di chuyển tới (580,620)", !!moved, JSON.stringify(b.msgs.slice(-3)));

  // T6: chat A -> B nhận
  a.send({ type: "chat", text: "Chao Linh Nhi" });
  const chat = await b.waitFor(m => m.type === "chat" && m.name === "KiemKhach" && m.text === "Chao Linh Nhi").catch(() => null);
  check("T6 chat A tới B", !!chat, JSON.stringify(b.msgs.slice(-3)));

  // T7: dịch chuyển gian lận — A nhảy +5000px trong 1 tick
  const bLastBefore = b.last(m => m.type === "player_moved" && m.player && m.player.name === "KiemKhach");
  a.send({ type: "pos", x: 5000, y: 5000, dir: 2 });
  const rej = await a.waitFor(m => m.type === "pos_reject").catch(() => null);
  check("T7a server bác dịch chuyển", !!rej && rej.reason === "step_too_far", JSON.stringify(rej));
  await sleep(300);
  const bLastAfter = b.last(m => m.type === "player_moved" && m.player && m.player.name === "KiemKhach");
  check("T7b B không thấy vị trí gian lận", bLastAfter === bLastBefore || (bLastAfter && bLastAfter.player.x <= 600),
    JSON.stringify(bLastAfter));
  // 4 lần vi phạm nữa -> đủ 5 lần -> kick
  for (let i = 0; i < 4; i++) { a.send({ type: "pos", x: 5000, y: 5000, dir: 2 }); await sleep(60); }
  const kicked = await a.waitFor(m => m.type === "kicked").catch(() => null);
  check("T7c đủ 5 vi phạm thì kick", !!kicked, JSON.stringify(a.msgs.slice(-3)));
  for (let i = 0; i < 20 && !a.closed; i++) await sleep(100);
  check("T7d socket A đóng sau kick", a.closed, "socket vẫn mở");

  // T8: B đổi map sang tay-luong; A (đã bị kick) không còn; C vào tay-luong thấy B
  b.send({ type: "enter_map", map: "tay-luong", x: 800, y: 500 });
  const mapState = await b.waitFor(m => m.type === "map_state" && m.map === "tay-luong").catch(() => null);
  check("T8a B đổi map tay-luong", !!mapState, JSON.stringify(mapState));
  const c = new Client("DaoSi");
  await c.open();
  c.send({ type: "login", name: "DaoSi", map: "tay-luong", x: 810, y: 500 });
  const okC = await c.waitFor(m => m.type === "login_ok").catch(() => null);
  const seesB = okC && okC.world && okC.world.players.some(p => p.name === "LinhNhi2" && p.map === "tay-luong");
  check("T8b C vào tay-luong thấy B", !!okC && seesB, JSON.stringify(okC && okC.world));
  // map không tồn tại
  c.send({ type: "enter_map", map: "map-khong-co", x: 0, y: 0 });
  const badMap = await c.waitFor(m => m.type === "pos_reject" && m.reason === "unknown_map").catch(() => null);
  check("T8c map lạ bị từ chối", !!badMap, JSON.stringify(badMap));

  // T9: mất dấu > 2s thì đồng bộ lại được (mạng yếu không bị đá oan)
  const d = new Client("TuSiMoi");
  await d.open();
  d.send({ type: "login", name: "TuSiMoi" });
  await d.waitFor(m => m.type === "login_ok").catch(() => null);
  d.send({ type: "pos", x: 600, y: 620, dir: 2 });
  await sleep(2500);
  d.send({ type: "pos", x: 900, y: 620, dir: 2 });
  const resync = await c.waitFor(m => m.type === "player_moved" && m.player && m.player.name === "TuSiMoi" && m.player.x === 900).catch(() => null);
  // C đang ở tay-luong, D ở mieu_hoang -> C không thấy; kiểm bằng B? B cũng ở tay-luong.
  // Dùng chính D: không bị pos_reject sau lần nhảy hợp lệ vì resync.
  const dRej = d.msgs.find(m => m.type === "pos_reject");
  check("T9 nhảy xa sau 2,5s mất dấu được chấp nhận (không reject)", !dRej, JSON.stringify(d.msgs.slice(-3)));
  void resync;

  // T10: lưu bền — ngắt kết nối rồi đọc file trên đĩa
  b.close(); c.close(); d.close();
  await sleep(800);
  let accountsOk = false, savesOk = false;
  try {
    const acc = JSON.parse(readFileSync(join(DATA_DIR, "accounts.json"), "utf8"));
    accountsOk = !!acc["kiemkhach"] && !!acc["linhnhi2"];
    const sv = JSON.parse(readFileSync(join(DATA_DIR, "saves.json"), "utf8"));
    savesOk = !!sv["linhnhi2"] && sv["linhnhi2"].map === "tay-luong";
  } catch (e) { /* fail bên dưới */ }
  check("T10a accounts.json ghi tên đã đăng nhập", accountsOk, "thiếu kiemkhach/linhnhi2");
  check("T10b saves.json ghi vị trí cuối (tay-luong)", savesOk, "thiếu linhnhi2/tay-luong");

  srv.kill("SIGTERM");
  await sleep(300);
  console.log(`\n== ${pass} PASS / ${fail} FAIL ==`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });
