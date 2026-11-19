"use strict";
/* Ngũ Hành Vô Địch — ONLINE chặng 1: lớp client (thiết kế: ONLINE-DESIGN.md).
 *
 * Chỉ kích hoạt khi URL có ?online (tùy chọn ?online=ws://host:port và
 * ?pname=<tên>). Không có ?online thì module này hoàn toàn không làm gì và
 * game là bản đơn như cũ.
 *
 * Khi bật: nối WebSocket tới server/server.mjs, đăng nhập bằng tên nhân vật
 * (máy chủ kiểm trùng), gửi vị trí ~8Hz, vẽ người chơi khác qua
 * GameEngine.setRemotePlayers(), chat trong map. Rớt mạng thì tự nối lại
 * (tối đa 5 lần) rồi thôi — không làm phiền game đơn.
 */
window.NHNET = (function () {
  var params = new URLSearchParams(location.search);
  var enabledFlag = params.has("online");
  var urlParam = params.get("online");
  var wsUrl = (urlParam && urlParam.indexOf("ws") === 0) ? urlParam
    : (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  var pnameParam = params.get("pname") || null;

  var ws = null;
  var connectedFlag = false;
  var loggedInFlag = false;
  var myId = null;
  var myName = null;
  var currentMap = null;
  var lastSentPos = { x: 0, y: 0 };
  var reconnects = 0;
  var MAX_RECONNECTS = 5;
  var remotes = new Map(); // playerId -> public player record
  var eventLog = [];

  function note(kind, data) {
    eventLog.push({ t: Date.now(), kind, data: data || null });
    if (eventLog.length > 120) eventLog.shift();
  }
  function eng() { return window.GameEngine; }
  function player() {
    try { return eng() && eng().getPlayer ? eng().getPlayer() : null; } catch (e) { return null; }
  }
  function pushRemotes() {
    try {
      if (eng() && eng().setRemotePlayers) {
        eng().setRemotePlayers([...remotes.values()].filter(function (r) { return r.id !== myId; }));
      }
    } catch (e) { /* không để lớp online làm chết game */ }
  }
  function send(obj) {
    if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; } }
    return false;
  }

  // ---- hộp chat + trạng thái (DOM riêng, không đụng HUD game) ----
  var panel = null, logEl = null, inputEl = null, statusEl = null;
  function ensurePanel() {
    if (panel || !enabledFlag) return;
    panel = document.createElement("div");
    panel.id = "nhnet-panel";
    panel.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;width:280px;" +
      "background:rgba(10,18,14,0.85);color:#dfe9dc;border:1px solid #4a6b52;border-radius:8px;" +
      "font:12px/1.5 sans-serif;padding:6px 8px;";
    statusEl = document.createElement("div");
    statusEl.id = "nhnet-status";
    statusEl.textContent = "Online: đang nối…";
    logEl = document.createElement("div");
    logEl.id = "nhnet-log";
    logEl.style.cssText = "max-height:96px;overflow-y:auto;margin:4px 0;";
    inputEl = document.createElement("input");
    inputEl.id = "nhnet-chat-input";
    inputEl.placeholder = "Chat trong map… (Enter để gửi)";
    inputEl.maxLength = 200;
    inputEl.style.cssText = "width:100%;box-sizing:border-box;background:#12231a;color:#e8f2e4;" +
      "border:1px solid #4a6b52;border-radius:4px;padding:4px 6px;";
    // Không để phím game ăn chữ đang gõ trong ô chat.
    inputEl.addEventListener("keydown", function (ev) { ev.stopPropagation(); });
    inputEl.addEventListener("keyup", function (ev) { ev.stopPropagation(); });
    inputEl.addEventListener("keypress", function (ev) { ev.stopPropagation(); });
    inputEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && inputEl.value.trim()) {
        send({ type: "chat", text: inputEl.value.trim() });
        inputEl.value = "";
        inputEl.blur();
      }
    });
    panel.appendChild(statusEl);
    panel.appendChild(logEl);
    panel.appendChild(inputEl);
    document.body.appendChild(panel);
  }
  function setStatus(t) { if (statusEl) statusEl.textContent = t; ensurePanel(); }
  function addChatLine(name, text) {
    ensurePanel();
    if (!logEl) return;
    var div = document.createElement("div");
    div.textContent = name + ": " + text;
    logEl.appendChild(div);
    while (logEl.children.length > 30) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function applyWorld(world) {
    if (!world || !world.players) return;
    remotes.clear();
    for (var i = 0; i < world.players.length; i++) {
      var p = world.players[i];
      if (p.id !== myId) remotes.set(p.id, p);
    }
    pushRemotes();
  }

  function handle(msg) {
    note(msg.type, msg);
    switch (msg.type) {
      case "login_ok": {
        myId = msg.playerId;
        loggedInFlag = true;
        reconnects = 0;
        if (msg.you) myName = msg.you.name;
        setStatus("Online: " + (myName || "?") + " @ " + (msg.you ? msg.you.map : "?"));
        applyWorld(msg.world);
        break;
      }
      case "login_error": {
        loggedInFlag = false;
        var why = msg.reason === "name_taken" ? "tên đã có người dùng"
          : msg.reason === "name_invalid" ? "tên không hợp lệ (2–20 ký tự)"
          : msg.reason;
        setStatus("Online: đăng nhập lỗi — " + why + " (thử ?pname=TênKhác)");
        note("login_error", { reason: msg.reason });
        break;
      }
      case "map_state": {
        if (msg.map) currentMap = msg.map;
        applyWorld(msg.world);
        break;
      }
      case "world_sync": applyWorld(msg.world); break;
      case "player_joined":
        if (msg.player) { remotes.set(msg.player.id, msg.player); pushRemotes(); }
        break;
      case "player_moved": case "player_state": {
        if (msg.player) {
          var prev = remotes.get(msg.player.id) || {};
          var merged = {};
          for (var k in prev) merged[k] = prev[k];
          for (var k2 in msg.player) merged[k2] = msg.player[k2];
          remotes.set(msg.player.id, merged);
          pushRemotes();
        }
        break;
      }
      case "player_left": remotes.delete(msg.playerId); pushRemotes(); break;
      case "player_died": {
        var d = remotes.get(msg.playerId);
        if (d) { d.dead = true; pushRemotes(); }
        break;
      }
      case "pos_reject": {
        // Máy chủ bác vị trí: sửa nhân vật về chỗ cuối được chấp nhận.
        var pl = player();
        if (pl && typeof msg.x === "number" && typeof msg.y === "number") {
          pl.x = msg.x; pl.y = msg.y;
        }
        note("pos_reject", { reason: msg.reason });
        break;
      }
      case "kicked": {
        setStatus("Online: bị ngắt — " + (msg.reason || "vi phạm di chuyển"));
        try { if (ws) ws.close(); } catch (e) { /* ignore */ }
        break;
      }
      case "chat": {
        if (msg.name) addChatLine(msg.name, msg.text || "");
        break;
      }
      case "chat_reject": {
        setStatus("Online: chat bị từ chối (" + (msg.reason || "?") + ")");
        break;
      }
    }
  }

  function connect() {
    if (!enabledFlag || ws) return;
    var sock;
    try { sock = new WebSocket(wsUrl); } catch (e) { return; }
    ws = sock;
    setStatus("Online: đang nối…");
    ws.onopen = function () {
      connectedFlag = true;
      var pl = player();
      var map = null;
      try { map = eng() && eng().getCurrentMapId ? eng().getCurrentMapId() : null; } catch (e) { map = null; }
      currentMap = map || "mieu_hoang";
      var name = pnameParam || (pl && pl.name) || "Tu Sĩ";
      send({ type: "login", name: name, map: currentMap,
             x: pl ? Math.round(pl.x) : 560, y: pl ? Math.round(pl.y) : 620 });
      note("login_sent", { name: name, map: currentMap });
    };
    ws.onmessage = function (ev) { try { handle(JSON.parse(ev.data)); } catch (e) { /* bad frame */ } };
    ws.onclose = function () {
      connectedFlag = false; loggedInFlag = false; ws = null;
      remotes.clear(); pushRemotes();
      note("socket_closed", {});
      if (reconnects < MAX_RECONNECTS) {
        reconnects++;
        setStatus("Online: mất nối, thử lại " + reconnects + "/" + MAX_RECONNECTS + "…");
        setTimeout(connect, 3000);
      } else {
        setStatus("Online: đã ngắt (hết lần thử lại) — game đơn vẫn chơi bình thường.");
      }
    };
    ws.onerror = function () { try { ws.close(); } catch (e) { /* ignore */ } };
  }

  // Boot khi game sẵn sàng; báo vị trí / đổi map ~8Hz.
  if (enabledFlag) {
    ensurePanel();
    var bootTimer = setInterval(function () {
      var pl = player();
      if (eng() && eng().getPlayer && pl && pl.name) {
        clearInterval(bootTimer);
        connect();
      }
    }, 300);
    setInterval(function () {
      if (!connectedFlag || !loggedInFlag) return;
      var pl = player();
      if (!pl) return;
      var map = null;
      try { map = eng().getCurrentMapId(); } catch (e) { map = null; }
      if (map && currentMap && map !== currentMap) {
        currentMap = map;
        send({ type: "enter_map", map: map, x: Math.round(pl.x), y: Math.round(pl.y) });
        return;
      }
      if (Math.hypot(pl.x - lastSentPos.x, pl.y - lastSentPos.y) > 3) {
        lastSentPos = { x: pl.x, y: pl.y };
        send({ type: "pos", x: Math.round(pl.x), y: Math.round(pl.y), dir: pl.dir || 0 });
      }
    }, 120);
  }

  return {
    enabled: function () { return enabledFlag; },
    connected: function () { return connectedFlag; },
    loggedIn: function () { return loggedInFlag; },
    playerId: function () { return myId; },
    sendChat: function (t) { return send({ type: "chat", text: t }); },
    // Chẩn đoán cho harness kiểm (chỉ đọc).
    state: function () {
      return {
        enabled: enabledFlag, connected: connectedFlag, loggedIn: loggedInFlag,
        playerId: myId, name: myName, map: currentMap,
        remotes: [...remotes.values()],
        eventLog: eventLog.slice(-30),
      };
    },
  };
})();
