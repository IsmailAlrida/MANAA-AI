# Push transport recommendation

**Status:** implementation recommendation, 2026-11-24. This documents a transport choice for the proposed frontend/backend contract; it does not claim the backend exists.

## Recommendation

Use ordinary JSON HTTP for workspace snapshots and operator mutations, plus one **Server-Sent Events (SSE)** endpoint for backend-to-browser updates. This is a one-way stream: the backend publishes ticket, graph entity, graph relationship, and run-status updates; the browser sends commands through the existing HTTP API. No notification/toast UI is implied.

For the TypeScript demo service, use Hono's existing `streamSSE()` helper from `hono/streaming` to frame SSE responses and close the stream when the client disconnects. The Hono docs provide this helper directly and show `writeSSE()` with typed event, data, and optional ID fields: [Hono streaming helper](https://hono.dev/docs/helpers/streaming). Keep the event payload as the contract's versioned JSON DTOs so a future service in another runtime can implement the same standard SSE endpoint without adopting Hono.

On the frontend, prefer `@microsoft/fetch-event-source` if the API needs bearer/custom request headers or explicit `onopen`/retry handling. It uses Fetch, supports request headers, abort signals, status validation, retry control, and updates `Last-Event-ID` when an SSE event has an `id`. If the service uses same-origin or credentialed-cookie authentication, the browser's built-in `EventSource` is smaller and already reconnects automatically. The native constructor only accepts a URL and `withCredentials`; it cannot set an Authorization header. Sources: [Microsoft Fetch Event Source README](https://github.com/Azure/fetch-event-source/blob/main/README.md), [WHATWG EventSource interface](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface).

Use TanStack Query for snapshot/cache synchronization if adding one data library is acceptable. It is not currently installed in `MANAA-AI/apps/web`. Its `QueryClient.setQueryData()` updates a cached query imperatively and immutably, which is enough to merge individual upserts into workspace state: [TanStack Query `QueryClient`](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient). If implementation keeps state local to a single provider instead, no second event-store library is required.

## Minimal recovery behavior

Do not build an event broker, durable event log, global cursor protocol, replay window, deduplication service, or `cursor_expired` error path for the demo.

1. Start or resume the run through the JSON API.
2. Open the SSE connection. Once the connection has opened, fetch the current persisted workspace/run snapshot and merge it into the client cache.
3. Apply incoming upserts by stable object ID and object revision. If an event and the snapshot race, keep the higher revision. Run status can be replaced by the latest snapshot/status update.
4. On each SSE reconnect/open, fetch and merge the snapshot again. On a full page refresh, fetch the snapshot and then reconnect. The snapshot is the current truth; the client does not need old event history to render current tickets and graph state.

This subscription-first-then-snapshot order closes the initial/reconnect gap without retained event history: changes before subscription appear in the subsequent snapshot; changes after subscription arrive on the live stream; overlapping changes are harmless when object revisions are merged monotonically. The API still needs to persist current workspace state and return a coherent snapshot. This does **not** promise that every transient progress update is delivered, nor exactly-once event delivery. If later requirements demand an audit-grade history of every transition or lossless replay after long outages, then add a persisted event log and resume cursor as an explicit backend capability rather than simulating it in the browser.

SSE defines standard `id:` and `Last-Event-ID` behavior for reconnecting EventSource clients. That is a transport hook, not durable replay by itself: replay requires the server to retain events and honor that ID. The contract should not promise at-least-once delivery merely because it uses SSE. The WHATWG spec describes the event ID being sent on reconnect: [WHATWG Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header).

## Options considered

| Option | What it provides | Fit here |
| --- | --- | --- |
| **SSE + REST** | Standard browser-friendly, server-to-client HTTP stream; `EventSource` reconnects and can send `Last-Event-ID`; Hono offers a small server helper. | **Recommended.** Updates flow only from backend to frontend; commands already use REST. Keeps the proposed API easy for another backend to implement. |
| **Socket.IO** | Bidirectional events, rooms, built-in reconnect/backoff, acknowledgements, long-polling fallback, and optional connection-state recovery. | More machinery than this contract needs. Socket.IO's own delivery-guarantee docs say server-to-client delivery is at-most-once by default; replay requires the application to persist event IDs and offsets. This does not remove the need for application recovery. [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [connection behavior](https://socket.io/docs/v4/how-it-works/). |
| **Managed Pub/Sub (e.g. Ably)** | Hosted fan-out, history/rewind, and short reconnect continuity. | Viable if the project chooses a managed realtime vendor, but it adds vendor credentials, channel provisioning, and dependency to the public boundary. Ably documents rewind/history retention limits and offers a free tier with paid plans; it is unnecessary for this local/self-hostable demo. [Ably rewind](https://ably.com/docs/channels/options/rewind), [Ably history](https://ably.com/docs/storage-history/history), [pricing](https://ably.com/pricing/). |

## Contract implications

- Keep the existing REST routes for snapshots and writes; use one SSE stream route for the run/workspace.
- Keep domain event types and object IDs/revisions. Remove global `eventId`/cursor requirements, `?after=` plumbing, durable replay promises, expired-cursor recovery, and client-side replay/deduplication framework from the demo contract.
- The initial snapshot and reconnect snapshot should include current ticket, graph, and run-status state. Client merges domain records by ID/revision rather than replacing newer streamed values with an older in-flight response.
- Unknown event types or invalid DTOs should be surfaced as normal recoverable API/data errors; no separate notification UI layer is part of transport.
- Authentication stays deployment-configurable: same-origin cookie auth works with built-in EventSource; bearer headers favor `@microsoft/fetch-event-source`. Do not put long-lived access tokens in stream query parameters.

## Evidence limits

- WHATWG standardizes SSE framing and reconnect IDs, not server retention, durable storage, exactly-once delivery, or snapshot consistency.
- Hono's helper writes the standard SSE response; it does not provide a message broker or replay store.
- TanStack Query is a cache/update utility, not an event transport or durable store.
- Socket.IO and managed Pub/Sub are still valid future substitutions if true bidirectional operations, multi-subscriber fan-out, or retained history become requirements.
