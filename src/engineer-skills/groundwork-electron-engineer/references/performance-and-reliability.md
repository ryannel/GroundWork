# Performance & Reliability

## Table of Contents
- [Where a Desktop App Spends Its Budget](#where-a-desktop-app-spends-its-budget)
- [The Main Process Is Never Blocked](#the-main-process-is-never-blocked)
- [Renderer Performance Is Web Performance](#renderer-performance-is-web-performance)
- [IPC Efficiency](#ipc-efficiency)
- [Memory Across Long-Lived Windows](#memory-across-long-lived-windows)
- [Cold Boot](#cold-boot)
- [Reliability of the IPC Layer](#reliability-of-the-ipc-layer)
- [A Backend That Is Unreachable](#a-backend-that-is-unreachable)
- [What Lives in the Core, Not Here](#what-lives-in-the-core-not-here)
- [Anti-Patterns](#anti-patterns)

---

## Where a Desktop App Spends Its Budget

Performance is a budget spent deliberately, allocated top-down and measured at the tail, not the average (`docs/principles/quality/performance.md`). A desktop shell spends it across three surfaces with different failure modes: the **main process**, where blocking work freezes every window at once; the **renderer**, which is a web app and pays the web's bundle and frame costs; and the **bridge** between them, where a chatty IPC pattern turns a cheap call into a per-frame tax. The process boundaries that contain these costs are the process-model's subject (`references/process-model.md`); this is the performance and reliability lens on them.

## The Main Process Is Never Blocked

One main process serves every window. A synchronous parse, hash, or file walk on it freezes all of them simultaneously — there is no per-window isolation to fall back on (`references/process-model.md`). The test for any main-process code is the one the process model states: **can this take longer than a frame?** Reading a config file or registering a handler — no, main is fine. Parsing a large file, indexing, image work — yes, and it goes to a `utilityProcess` with its ports wired renderer↔utility directly so the heavy traffic never transits or blocks main (`references/process-model.md`).

`sendSync` over IPC is forbidden for the same reason from the other side: it blocks the renderer's event loop for the full round trip (`references/ipc-contracts.md`). Every privileged call is an async `invoke`.

## Renderer Performance Is Web Performance

The renderer is a normal Vite + React app, so the web stack's performance discipline applies unchanged: lazy-load routes and heavy components behind code-split boundaries, keep the bundle lean, and gate deterministic budgets — bundle size, not noisy wall-clock — in CI (`docs/principles/quality/performance.md`). Two desktop-specific notes:

- **The bundle is local, but it is not free.** It loads from the bundle protocol rather than a network, so transfer cost is near zero — but parse and execute cost is not, and a bloated main chunk still slows cold boot. Code-split anyway.
- **One window is one renderer.** A second window (settings, about) is a second renderer with its own bundle and memory; share chunks through the build, and do not spawn windows the app does not need.

## IPC Efficiency

The bridge is a serialization boundary: every `invoke` structured-clones its arguments and result across the process line. That cost is invisible per call and ruinous in a loop. Two rules keep it cheap:

- **Never call the bridge in a hot loop.** A per-row or per-frame `invoke` pays the clone cost every iteration. Fetch the collection in one call and iterate in the renderer.
- **Batch and coarsen the contract.** Design channels around the renderer's actual unit of work — `items:list` returning a page, not `item:get` called N times. A coarse channel is one clone; a chatty one is N (`references/ipc-contracts.md`).

Push channels (main → renderer) carry coarse events too: a file-watcher that fires per-keystroke should coalesce before it `webContents.send`s, so the renderer invalidates once, not a hundred times (`references/ipc-contracts.md`).

## Memory Across Long-Lived Windows

A desktop window lives for hours or days, so a leak that a page reload would have swept never gets swept. The discipline is lifecycle hygiene at the boundaries:

- **Every subscription returns its unsubscribe, and the renderer calls it.** A bridge push subscription returns a remover; an effect that registers one must return it for cleanup, or the listener and its closure outlive the component (`references/ipc-contracts.md`).
- **Bound caches.** TanStack Query's cache is bounded by its garbage-collection time; an ad-hoc `Map` accumulating per-result entries is not — it is the unbounded queue the performance canon rejects, in client form.
- **Tear down `utilityProcess` workers** when their work is done. A spawned worker that is never killed is retained memory and a retained handle.

## Cold Boot

Time-to-first-window is the desktop app's first impression. Keep main's startup to the four things it must do — register the protocol, apply the security policy, register handlers, create the window — and defer everything else until after the window is visible (`references/process-model.md`). Show the window with a skeleton and let data arrive into it over IPC; do not block window creation on a gateway call or a heavy index. Build the index in a `utilityProcess` after the first frame, not before it.

## Reliability of the IPC Layer

Reliability is designed in, not hoped for, and for the renderer the IPC seam is the dependency that fails (`docs/principles/quality/reliability.md`). TanStack Query is the renderer's resilience layer over that seam, exactly as it would be over HTTP: its `queryFn`s call the typed bridge, and its caching, retry, and invalidation give the renderer bounded retries with backoff and a served-from-cache fallback for free (`references/ipc-contracts.md`). Configure retry to back off and to retry only transient failures — a rejected privileged call from a validation failure is a bug or an attack, not a state to retry into (`references/ipc-contracts.md`). A failed `invoke` rejects the query, and the component renders that error state rather than letting the rejection escape.

## A Backend That Is Unreachable

When the workspace has a hosted core, main holds the HTTP client and the renderer reaches the gateway only through main (`references/ipc-contracts.md`). That places the gateway's reliability in main, and the discipline is the one the resilience patterns describe at any client edge:

- **Timeout and bounded retry on main's HTTP client.** Every outbound call to the gateway has a timeout and a jittered, bounded retry for transient failures — a hung gateway connection otherwise stalls the IPC call that is waiting on it.
- **Map unreachable to a domain result.** Main returns a typed "unreachable" result the renderer can render, not a raw thrown error — the gateway being down is an expected state with a designed UI, decided at design time alongside the happy path (`docs/principles/quality/reliability.md`).
- **Degrade, do not blank.** A feature whose gateway data is unavailable serves cached data or an explicit unavailable state while the rest of the app works; the window stays usable when one capability is down.

## What Lives in the Core, Not Here

Server reliability patterns belong to the capability core and its services, not the desktop shell (`docs/principles/quality/reliability.md`). **SLOs and error budgets** are defined and measured server-side. **Load shedding** protects the server from overload regardless of how clients behave — a backstop the server owns, not something a client implements for it. **Server-side circuit breakers** are earned against slow downstreams and tuned against real traffic in the core. The client's share is the right amount of resilience at the edge: timeout, bounded retry, a cache fallback, and a designed degraded state. The business rules about a failure — recoverability, retry budget, what a result means — are proven in the core, and the renderer renders the result.

## Anti-Patterns

- **Blocking the main process.** A synchronous parse or hash freezes every window — `utilityProcess` it.
- **`sendSync`.** Blocks the renderer event loop for the round trip; always async.
- **IPC in a hot loop.** Per-row or per-frame `invoke` pays the clone cost every iteration — fetch once, iterate locally.
- **Chatty fine-grained channels.** N calls where one coarse channel would do; design channels around the renderer's unit of work.
- **Leaked subscriptions.** A push listener registered without its unsubscribe outlives the component across a multi-day session.
- **Unbounded ad-hoc caches.** A `Map` that only grows is the latency bomb in client form; let TanStack Query bound it.
- **Blank on unreachable.** No designed state for a down gateway ships a frozen or empty window.
- **Reimplementing server reliability in the shell.** Load shedding, SLOs, and reflexive circuit breakers live in the core.
