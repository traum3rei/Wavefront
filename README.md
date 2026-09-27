# Patchbay

A real-time collaborative visual canvas — built as a portfolio project to
demonstrate real-time systems engineering (WebSocket sync, conflict
resolution, presence), not just a UI demo.

## Status: step 1–2 of the build order done

- **Step 1 — shared state model**: see `schema.md`. Every object is
  `{id, type, x, y, size, color, version, updatedAt, updatedBy}`. `version`
  is what conflict resolution will key off later — not wall-clock time.
- **Step 2 — single-user sandbox**: `index.html` is a fully working local
  version. Open it in a browser, no build step needed:

  ```
  open index.html
  ```

  You can add circles/rectangles, drag them, recolor them, delete them.
  Every edit already goes through one function, `commitEdit()` — that's
  intentional, it's the single seam where networking gets added next.

## Next up (step 3)

Add a Node WebSocket server (`ws` or `socket.io`). Each client connects,
joins a room, and `commitEdit()` also does:

```js
ws.send(JSON.stringify({ type: "edit", object: obj }));
```

The server rebroadcasts to everyone else in the room. At that point you
have naive (last-write-wins-by-luck) real-time sync — fragile, but it's
the baseline step 4 (real conflict resolution via the `version` field, or
Yjs/CRDTs) improves on.

## Why this structure

Keeping the state model and the single "edit happens here" chokepoint
decided up front means adding real-time sync later is additive — you're
not rewriting the rendering or interaction code, just adding a transport
that ships the same object shape you're already mutating locally. That's
also the thing worth explaining in an interview: the design choice that
made the hard part (networking) bolt on cleanly instead of requiring a
rewrite.
