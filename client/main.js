// ---- state, shaped exactly per schema.md, so step 3 (networking) -----------
// only has to add a transport, not redesign this.
const CLIENT_ID = "local-" + Math.random().toString(36).slice(2, 8);
document.getElementById("clientId").textContent = CLIENT_ID;

const COLORS = ["#e3a548", "#4fb3a9", "#c4574b", "#8a8d97", "#edeae3", "#6b5530"];
let objects = {}; // id -> object
let selectedId = null;
let dragging = null; // { id, dx, dy }

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeObject(type, x, y) {
  const id = uid();
  const obj = {
    id, type, x, y,
    size: type === "circle" ? 28 : 48,
    color: COLORS[Object.keys(objects).length % COLORS.length],
    version: 1,
    updatedAt: Date.now(),
    updatedBy: CLIENT_ID,
  };
  objects[id] = obj;
  return obj;
}

// Every mutation goes through this single function. This is deliberate:
// when step 3 adds a websocket, this is the one place that needs to also
// broadcast the change — nothing else in the render/interaction code
// needs to know networking exists.
function commitEdit(obj) {
  obj.version += 1;
  obj.updatedAt = Date.now();
  obj.updatedBy = CLIENT_ID;
  objects[obj.id] = obj;
  // TODO(step 3): ws.send(JSON.stringify({ type: "edit", object: obj }))
  render();
}

function deleteObject(id) {
  delete objects[id];
  if (selectedId === id) selectedId = null;
  // TODO(step 3): broadcast a delete message too — schema.md doesn't have
  // one yet, add it when you get here.
  render();
}

// ---- canvas setup ------------------------------------------------------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function resize() {
  const wrap = document.querySelector(".stage-wrap");
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  render();
}
window.addEventListener("resize", resize);

function hitTest(x, y) {
  const list = Object.values(objects);
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (o.type === "circle") {
      const d = Math.hypot(x - o.x, y - o.y);
      if (d <= o.size) return o;
    } else {
      const half = o.size / 2;
      if (x >= o.x - half && x <= o.x + half && y >= o.y - half && y <= o.y + half) return o;
    }
  }
  return null;
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const hit = hitTest(x, y);
  selectedId = hit ? hit.id : null;
  if (hit) dragging = { id: hit.id, dx: x - hit.x, dy: y - hit.y };
  render();
});

canvas.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const obj = objects[dragging.id];
  if (!obj) return;
  obj.x = x - dragging.dx;
  obj.y = y - dragging.dy;
  render(); // visual feedback every frame, but no version bump mid-drag
});

canvas.addEventListener("mouseup", () => {
  if (dragging) {
    const obj = objects[dragging.id];
    // Version bumps once per drag, not once per pixel — this is the same
    // batching a real client should do before shipping edits over the wire.
    if (obj) commitEdit(obj);
  }
  dragging = null;
});

// ---- rendering -----------------------------------------------------------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // faint grid, patchbay-hardware feel
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  const grid = 32;
  for (let x = 0; x < canvas.width; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  for (const obj of Object.values(objects)) {
    ctx.fillStyle = obj.color;
    if (obj.type === "circle") {
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(obj.x - obj.size / 2, obj.y - obj.size / 2, obj.size, obj.size);
    }
    if (obj.id === selectedId) {
      ctx.strokeStyle = "#e3a548";
      ctx.lineWidth = 2;
      if (obj.type === "circle") {
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.size + 5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(obj.x - obj.size / 2 - 5, obj.y - obj.size / 2 - 5, obj.size + 10, obj.size + 10);
      }
    }
  }

  renderList();
  renderSwatches();
  document.getElementById("objCount").textContent = Object.keys(objects).length;
}

function renderList() {
  const el = document.getElementById("objList");
  const list = Object.values(objects).sort((a, b) => b.updatedAt - a.updatedAt);
  if (list.length === 0) {
    el.innerHTML = '<div class="empty">nothing yet — add a circle or rectangle</div>';
    return;
  }
  el.innerHTML = list.map(o => `
    <div class="obj-row ${o.id === selectedId ? 'selected' : ''}" data-id="${o.id}">
      <div class="obj-dot" style="background:${o.color}"></div>
      <div>
        <div class="obj-id">${o.type}·${o.id.slice(0,4)}</div>
        <div class="obj-meta">v${o.version} · ${Math.max(0, Math.round((Date.now()-o.updatedAt)/1000))}s ago</div>
      </div>
    </div>
  `).join("");
  el.querySelectorAll(".obj-row").forEach(row => {
    row.addEventListener("click", () => {
      selectedId = row.dataset.id;
      render();
    });
  });
}

function renderSwatches() {
  const el = document.getElementById("swatches");
  const selected = selectedId ? objects[selectedId] : null;
  el.innerHTML = COLORS.map(c => `
    <button class="swatch ${selected && selected.color === c ? 'active' : ''}" style="background:${c}" data-color="${c}"></button>
  `).join("");
  el.querySelectorAll(".swatch").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!selectedId || !objects[selectedId]) return;
      const obj = objects[selectedId];
      obj.color = btn.dataset.color;
      commitEdit(obj);
    });
  });
}

// ---- toolbar ---------------------------------------------------------
document.getElementById("addCircle").addEventListener("click", () => {
  const obj = makeObject("circle", canvas.width / 2 + (Math.random()-0.5)*80, canvas.height / 2 + (Math.random()-0.5)*80);
  selectedId = obj.id;
  render();
});
document.getElementById("addRect").addEventListener("click", () => {
  const obj = makeObject("rect", canvas.width / 2 + (Math.random()-0.5)*80, canvas.height / 2 + (Math.random()-0.5)*80);
  selectedId = obj.id;
  render();
});
document.getElementById("deleteObj").addEventListener("click", () => {
  if (selectedId) deleteObject(selectedId);
});

// tick the "Ns ago" labels without needing an edit
setInterval(renderList, 1000);

resize();