/**
 * Stream connection machine (transport metadata only — never a toast/bell).
 *
 *   idle ──SUBSCRIBE──▶ connecting ──OPEN──▶ syncing ──SNAPSHOT_OK──▶ live
 *                           ▲                  │                       │
 *                           │                  └─SNAPSHOT_FAIL──▶ error│
 *                           └──────────── reconnecting ◀──DROPPED──────┘
 *   any ──CLOSED_BY_SERVER──▶ error      any ──STOP──▶ idle
 *
 * Subscribe-first, then snapshot on every OPEN (initial + each reconnect).
 */
export type ConnectionState = "idle" | "connecting" | "syncing" | "live" | "reconnecting" | "error"

export type ConnectionEvent =
  | { type: "SUBSCRIBE" }
  | { type: "OPEN" }
  | { type: "SNAPSHOT_OK" }
  | { type: "SNAPSHOT_FAIL" }
  | { type: "DROPPED" }
  | { type: "CLOSED_BY_SERVER" }
  | { type: "STOP" }

export function connectionReducer(s: ConnectionState, e: ConnectionEvent): ConnectionState {
  if (e.type === "STOP") return "idle"
  if (e.type === "CLOSED_BY_SERVER") return s === "idle" ? s : "error"
  switch (s) {
    case "idle":
    case "error":
      return e.type === "SUBSCRIBE" ? "connecting" : s
    case "connecting":
    case "reconnecting":
      return e.type === "OPEN" ? "syncing" : s
    case "syncing":
      if (e.type === "SNAPSHOT_OK") return "live"
      if (e.type === "SNAPSHOT_FAIL") return "error"
      if (e.type === "DROPPED") return "reconnecting"
      return s
    case "live":
      if (e.type === "DROPPED") return "reconnecting"
      if (e.type === "OPEN") return "syncing" // native EventSource auto-reconnect
      return s
  }
}
