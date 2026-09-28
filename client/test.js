// Convergence test: N fake clients hammer ONE shared object concurrently.
// Passes if every client ends up holding the identical object.
// Run with the server up:  node test.js [ws://localhost:3000]
const WebSocket = require("ws");
const URL = process.argv[2] || "ws://localhost:3000";
const ROOM = "test-" + Date.now();
const N = 5, EDITS = 40;

const newer = (a, b) =>
  a.version > b.version || (a.version === b.version && a.updatedBy > b.updatedBy);

function makeClient(name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const c = { name, ws, objects: {} };
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", roomId: ROOM })));
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      if (m.type === "sync") { c.objects = m.state.objects; resolve(c); }
      else if (m.type === "edit") {
        const cur = c.objects[m.object.id];
        if (!cur || newer(m.object, cur)) c.objects[m.object.id] = m.object;
      }
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const clients = [];
  for (let i = 0; i < N; i++) clients.push(await makeClient("c" + i));

  const first = { id: "shared", type: "circle", x: 0, y: 0, size: 20, color: "#fff",
                  version: 1, updatedAt: Date.now(), updatedBy: "c0" };
  clients[0].objects.shared = first;
  clients[0].ws.send(JSON.stringify({ type: "edit", object: first }));
  await sleep(300);

  await Promise.all(clients.map(async (c) => {
    for (let i = 0; i < EDITS; i++) {
      const cur = c.objects.shared;
      const next = { ...cur, x: Math.random() * 500, version: cur.version + 1,
                     updatedAt: Date.now(), updatedBy: c.name };
      c.objects.shared = next;
      c.ws.send(JSON.stringify({ type: "edit", object: next }));
      await sleep(Math.random() * 6);
    }
  }));

  await sleep(1000); // let in-flight messages and corrections settle
  const states = clients.map((c) => JSON.stringify(c.objects.shared));
  const ok = states.every((s) => s === states[0]);
  console.log(ok ? "PASS: all clients converged" : "FAIL: clients disagree");
  if (!ok) states.forEach((s, i) => console.log("c" + i, s));
  clients.forEach((c) => c.ws.close());
  process.exit(ok ? 0 : 1);
})();
