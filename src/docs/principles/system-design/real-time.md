---
title: Real-Time
description: WebSockets, streaming, backpressure, and the patterns that make live experiences survive a degraded network.
status: active
last_reviewed: 2026-05-26
---
# Real-Time

## TL;DR

Real-time features are long-lived bidirectional contracts between client and server, not request-response interactions. They must survive reconnection, handle backpressure without losing state, and never treat the network as a guarantee. Every real-time feature we ship is designed against the assumption that the connection will drop mid-flight.

## Why this matters

The difference between a real-time product that feels smooth and one that feels broken is almost always the difference in how the implementers thought about failure modes: reconnection, duplicated messages, out-of-order delivery, and backpressure. Getting real-time right is less about picking a protocol and more about having a disciplined stance on those failure modes.

## Our principles

### 1. Transport is a per-direction decision

**SSE** is the default for server→client streaming — auto-reconnecting, CDN-friendly, no sticky sessions, plain HTTP — and it is the streaming substrate for AI (MCP and LLM token delivery ride it). **WebSockets** are for genuinely bidirectional connections where the client also pushes frequently. Reaching for a WebSocket to push a one-way stream is over-engineering; long-polling is rejected outright.

### 2. Every message carries a sequence number

Every event on the wire carries a monotonic sequence. The client can detect gaps; the server can detect duplicates; the pair of them can resynchronise after a reconnect without the client having to refetch everything. Sequence numbers are per-session, not global.

### 3. Reconnection is the normal case, not the error case

Clients reconnect with exponential backoff, jitter, and a resumption token that tells the server where they left off. "Reconnected" is logged, not paged. If a reconnection rate spikes, that is a signal about network or server health — not a client bug.

### 4. Backpressure is explicit

When the server is producing faster than the client is consuming, the server either **sheds** (drops non-critical messages, logs the shed rate), **coalesces** (merges consecutive updates into a single event), or **blocks** (applies flow control). What it does *not* do is buffer unbounded. Buffering unbounded is how a real-time service dies.

### 5. Echo suppression is a design concern

In streaming scenarios where a client's own output may be re-ingested as incoming events, the suppression mechanism — whether it is a sender ID on the stream, a per-session filter at the gateway, or client-side gating — is part of the protocol design, not a bolt-on fix. Echo handling is specified before the first line of code.

### 6. Idempotent handlers

The client will reconnect and resend. The server must handle the resend gracefully — the same sequence number processed twice has no additional effect. This is the same principle as HTTP idempotency keys ([API Design](api-design.md)), applied to the streaming surface.

### 7. Observability is unbroken across the socket

A trace that enters via HTTP, opens a WebSocket, streams many events, and closes — all of it belongs to the same trace. OTel instrumentation propagates the trace context into the socket, and every event carries it forward. A broken real-time trace is a test failure, not a nuisance (see [Testing](../foundations/testing.md)).

### 8. Client state is recoverable, not sacred

Any state held on the client that matters must be recoverable from the server. We do not rely on the client's in-memory view surviving. If the client crashes or navigates away, rejoining the session should produce the same observable state — the server is the source of truth.

### 9. LLM streaming and local-first collaboration

The canonical AI real-time pattern is **SSE for the token data-plane** plus a WebSocket (or internal gRPC) **control-plane** for cancel and feedback injection — its failure modes (slow first token, partial-response loss on a provider retry, backpressure stalls) extend the ones above. For multi-user editing and offline-first apps, **CRDTs** (Yjs, Automerge) make the local copy the source of truth with background sync — the principled answer where echo suppression and recoverable state were gesturing. WebTransport is promising but not shippable in 2026 (no Safari) — prototype only.

## How we apply this

- [Reliability](../quality/reliability.md) — the broader resiliency patterns these principles sit inside.
- [Observability](../quality/observability.md) — how we trace across streaming connections.

## Anti-patterns we reject

- **Treating the socket as a fire-and-forget event bus.** No sequence numbers, no resumption, no idempotency. Works in demos; breaks in production.
- **Per-connection unbounded buffers.** A slow client should not kill the server's memory. Shed, coalesce, or block.
- **Reconnect-then-refetch-everything.** If the full state refresh is the recovery strategy, the protocol is broken. Use resumption tokens.
- **Ad-hoc event schemas.** Real-time events are contracts. They belong in AsyncAPI specs, versioned, generated.
- **Client-side reconciliation of echoes.** Echo suppression on the client is a fallback, not a design. Handle it at the gateway where the full context is available.

## Further reading

- *Designing Data-Intensive Applications*, Martin Kleppmann — the chapters on streaming, ordering, and exactly-once semantics.
- *The Little Book of Semaphores*, Allen B. Downey — the fundamentals of flow control.
- *High Performance Browser Networking*, Ilya Grigorik — the chapters on WebSocket and real-time transports.
- The WebSocket RFC (RFC 6455) — worth reading at least once if you are going to build on top of it.
