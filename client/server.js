// Patchbay server — step 3: authoritative room state + naive broadcast.
// Serves the static client and speaks the message shapes from schema.md.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;

// Whitelist, so server.js / package.json are never served.
const STATIC = {
  "/": ["index.html", "text/html"],
  "/index.html": ["index.html", "text/html"],
  "/net.js": ["net.js", "text/javascript"],
  "/main.js": ["main.js", "text/javascript"],
  "/style.css": ["style.css", "text/css"],
};

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const entry = STATIC[url];
  if (!entry) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(path.join(__dirname, entry[0]), (err, data) => {
    if (err) { res.writeHead(500); return res.end("error"); }
    res.writeHead(200, { "Content-Type": entry[1] });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

// roomId -> { objects: {id: Object}, clients: Set<WebSocket> }
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { objects: {}, clients: new Set() });
  return rooms.get(id);
}

function broadcast(room, msg, except) {
  const data = JSON.stringify(msg);
  for (const client of room.clients) {
    if (client !== except && client.readyState === 1) client.send(data);
  }
}

function leave(ws) {
  if (!ws.roomId) return;
  const room = rooms.get(ws.roomId);
  if (room) {
    room.clients.delete(ws);
    // Empty rooms are dropped, so state doesn't survive everyone leaving.
    // (Persistence is a possible later step.)
    if (room.clients.size === 0) rooms.delete(ws.roomId);
  }
  ws.roomId = null;
}

wss.on("connection", (ws) => {
  ws.roomId = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "join") {
      if (typeof msg.roomId !== "string" || !msg.roomId || msg.roomId.length > 64) return;
      leave(ws);
      const room = getRoom(msg.roomId);
      room.clients.add(ws);
      ws.roomId = msg.roomId;
      // Full snapshot for the joiner.
      ws.send(JSON.stringify({ type: "sync", state: { roomId: msg.roomId, objects: room.objects } }));
      return;
    }

    const room = ws.roomId && rooms.get(ws.roomId);
    if (!room) return; // must join first

    if (msg.type === "edit") {
      const o = msg.object;
      if (!o || typeof o.id !== "string") return;
      room.objects[o.id] = o; // naive: last message wins. Step 4 replaces this.
      broadcast(room, { type: "edit", object: o }, ws);
    } else if (msg.type === "delete") {
      if (typeof msg.id !== "string") return;
      delete room.objects[msg.id];
      broadcast(room, { type: "delete", id: msg.id }, ws);
    }
  });

  ws.on("close", () => leave(ws));
});

server.listen(PORT, () => console.log(`patchbay on http://localhost:${PORT}`));