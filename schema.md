# Wavefront — shared state model (v1)

This is the contract every client and the future server agree on. Keep it
boring and flat for now — no nested scene graphs, no shader graphs. The goal
is a model simple enough that sync/conflict logic (step 4) stays tractable.

## Object

```
{
  id: string,          // uuid, assigned at creation, never reused
  type: "circle" | "rect",
  x: number,            // canvas px
  y: number,
  size: number,         // radius (circle) or side length (rect)
  color: string,        // hex, e.g. "#f2a71b"
  version: number,      // increments on every edit to THIS object
  updatedAt: number,    // ms epoch, set by the client that made the edit
  updatedBy: string,    // client id (random per session for now)
}
```

## Room state

```
{
  roomId: string,
  objects: { [id]: Object },
  clients: { [clientId]: { color: string, cursor: {x, y} | null } }
}
```

## Why `version` + `updatedAt` both exist

`version` is the field the future conflict-resolution step (build-order step 4)
will actually key off — whoever has the higher version for an object wins,
full stop, no clock-skew ambiguity. `updatedAt` is kept alongside for
debugging/UI ("edited 2s ago") — never make merge decisions on wall-clock
time alone once multiple machines are involved.

## Message shapes (for step 3 — not implemented yet)

```
// client -> server, on any local edit
{ type: "edit", object: Object }

// server -> all clients in room, after applying an edit
{ type: "edit", object: Object }

// server -> a client, on join
{ type: "sync", state: RoomState }
```

These aren't wired up yet — `index.html` right now is a single-user
sandbox that already shapes its local state exactly this way, so step 3
becomes "add a WebSocket that ships this same object whenever it changes"
rather than a redesign.
