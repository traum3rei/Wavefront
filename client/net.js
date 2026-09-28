// Client networking — step 3. Loaded after the main script in index.html.
// It wraps the three local mutation points (makeObject, commitEdit,
// deleteObject) so every local change is also sent to the server, and
// applies remote messages directly to `objects` WITHOUT going through
// commitEdit — otherwise each edit would be re-broadcast forever.
(function () {
  const roomId = new URLSearchParams(location.search).get("room") || "lobby";
  const proto = location.protocol === "https:" ? "wss" : "ws";
  let ws = null;

  const dot = document.createElement("div");
  dot.style.cssText = "position:fixed;right:12px;bottom:10px;font:11px ui-monospace,monospace;color:#8a8d97";
  document.body.appendChild(dot);
  const setStatus = (s) => { dot.textContent = `room "${roomId}" · ${s}`; };

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function connect() {
    setStatus("connecting");
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => { setStatus("connected"); send({ type: "join", roomId }); };
    ws.onclose = () => { setStatus("disconnected, retrying"); setTimeout(connect, 1000); };
    ws.onmessage = (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "sync") {
        objects = msg.state.objects; // full snapshot replaces local state
      } else if (msg.type === "edit") {
        objects[msg.object.id] = msg.object;
      } else if (msg.type === "delete") {
        delete objects[msg.id];
      } else { return; }
      if (selectedId && !objects[selectedId]) selectedId = null;
      render();
    };
  }

  const origMake = makeObject;
  makeObject = function (type, x, y) {
    const o = origMake(type, x, y);
    send({ type: "edit", object: o });
    return o;
  };

  const origCommit = commitEdit;
  commitEdit = function (obj) {
    origCommit(obj);
    send({ type: "edit", object: obj });
  };

  const origDelete = deleteObject;
  deleteObject = function (id) {
    origDelete(id);
    send({ type: "delete", id });
  };

  connect();
})();