# Real-Time & Streaming

Real-time features are long-lived bidirectional contracts between client and server, not request-response interactions. The difference between a live experience that feels smooth and one that feels broken is almost always how the implementers thought about failure modes — reconnection, duplicate messages, out-of-order delivery, backpressure. Design every real-time feature against the assumption that **the connection will drop mid-flight.**

## The design decisions

1. **Transport is a per-direction decision.** **SSE** is the default for server→client streaming — auto-reconnecting, CDN-friendly, no sticky sessions, plain HTTP — and it is the streaming substrate for AI (MCP and token delivery ride it). **WebSockets** are for genuinely bidirectional connections where the client also pushes frequently. Reaching for WebSockets to push a one-way stream is over-engineering; long-polling is rejected.
2. **Every message carries a sequence number.** A monotonic, per-session sequence lets the client detect gaps, the server detect duplicates, and the pair resynchronise after a reconnect without refetching everything.
3. **Reconnection is the normal case.** Clients reconnect with exponential backoff, jitter, and a resumption token telling the server where they left off. "Reconnected" is logged, not paged. A reconnection-rate spike is a signal about network or server health, not a client bug.
4. **Backpressure is explicit.** When the server produces faster than the client consumes, it **sheds** (drops non-critical messages, logs the shed rate), **coalesces** (merges consecutive updates), or **blocks** (flow control). What it never does is buffer unbounded — that is how a real-time service dies.
5. **Echo suppression is a design concern.** Where a client's own output may be re-ingested as an incoming event, the suppression mechanism — a sender ID on the stream, a per-session gateway filter, client-side gating — is part of the protocol, specified before the first line of code, not bolted on later.
6. **Idempotent handlers.** The client will reconnect and resend; the same sequence number processed twice has no additional effect. The HTTP idempotency principle applied to the streaming surface.
7. **Observability is unbroken across the socket.** A trace that enters via HTTP, opens a socket, streams many events, and closes belongs to one trace. Propagate trace context into the socket and carry it on every event.
8. **Client state is recoverable, not sacred.** Any client state that matters must be reconstructable from the server. Rejoining a session produces the same observable state — the server is the source of truth.

## LLM streaming and collaboration

- **LLM streaming** is the canonical real-time pattern for a model in the loop: **SSE for the token data-plane**, a WebSocket (or internal gRPC) for the **control-plane** (cancel, feedback injection). Its failure modes extend the ones above — slow first token, partial-response loss on a provider retry, backpressure stalls — so apply sequencing and backpressure to the token stream.
- **Collaborative / offline-first → CRDTs.** For multi-user editing and local-first apps, **CRDTs** (Yjs the ecosystem default, Automerge for Git-like history) make the local copy the source of truth with background sync — the principled answer where "echo suppression + recoverable client state" was gesturing. Don't hand-roll last-write-wins where a CRDT is the right tool.

## Antipatterns to catch

- **Socket as a fire-and-forget event bus** — no sequence numbers, no resumption, no idempotency. Works in demos; breaks in production.
- **Per-connection unbounded buffers** — a slow client should not exhaust server memory. Shed, coalesce, or block.
- **Reconnect-then-refetch-everything** — if a full state refresh is the recovery strategy, the protocol is broken. Use resumption tokens.
- **Ad-hoc event schemas** — real-time events are contracts. They belong in AsyncAPI specs, versioned and generated, not invented per feature.
- **Client-side echo reconciliation as the design** — handle echoes at the gateway where the full context lives; client-side gating is a fallback, not the plan.
