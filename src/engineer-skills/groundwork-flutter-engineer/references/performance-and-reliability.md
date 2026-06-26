# Performance & Reliability

## Table of Contents
- [Two Budgets a Client Spends](#two-budgets-a-client-spends)
- [The Frame Budget](#the-frame-budget)
- [List Virtualization](#list-virtualization)
- [Image and Asset Memory](#image-and-asset-memory)
- [Isolates for Heavy Compute](#isolates-for-heavy-compute)
- [Startup Time](#startup-time)
- [Resilience on the Typed Client](#resilience-on-the-typed-client)
- [Optimistic UI and Offline](#optimistic-ui-and-offline)
- [Graceful Degradation](#graceful-degradation)
- [What Lives in the Core, Not Here](#what-lives-in-the-core-not-here)
- [Anti-Patterns](#anti-patterns)

---

## Two Budgets a Client Spends

Performance is a budget spent deliberately, not "fast enough" tuned afterward (`docs/principles/quality/performance.md`). A client spends two budgets. The **frame budget** is local: 16ms to produce a frame at 60Hz, 8ms at 120Hz, and a build that overruns it drops the frame the user feels as jank. The **round-trip budget** is remote: the time from a tap to a rendered result, most of which is the gateway call the app does not control. Allocate both top-down — decide the interaction's target before building it — and measure the tail, not the average: the one stutter in a scroll is the experience users remember (`docs/principles/quality/performance.md`).

## The Frame Budget

Jank is a build that does too much, too often. The mechanics of keeping builds cheap live in the widget and state references; this is the performance lens on them:

- **`const` and extracted widgets** canonicalise subtrees the framework skips on rebuild — the cheapest performance work available (`references/widgets-and-composition.md`).
- **`RepaintBoundary`** isolates a frequently-repainting subtree (an animation, a progress indicator) so its repaint does not invalidate the rest of the layer tree. Wrap the moving part, not the whole screen — a boundary has its own cost, so it earns its place only where repaint actually churns.
- **Narrow rebuild scope.** A god-provider per screen rebuilds everything when one field changes; split providers by concern so the graph recomputes at the right granularity (`references/state-management.md`). Watch the narrowest provider a widget needs, never the whole state object for one field.
- **Pure builds.** A `build` that fires work or mutates state turns rebuild cadence into behaviour and into cost (`references/widgets-and-composition.md`).

Profile before you optimise — the obvious cause of a jank is usually wrong. Flutter DevTools' timeline and the raster/UI thread split tell you whether a frame overran in build or in paint; the "obvious" bottleneck almost always isn't (`docs/principles/quality/performance.md`).

## List Virtualization

A scrollable collection of unknown or large length is built lazily — `ListView.builder` / `GridView.builder` / `SliverList`, never a `ListView(children: [...])` that constructs every row up front. Eager construction allocates the whole list before the first frame and is the most common source of scroll jank and startup memory spikes. Give reorderable or filterable rows a `ValueKey(item.id)` so element state follows identity through rebuilds (`references/widgets-and-composition.md`).

## Image and Asset Memory

Decoded images dominate a client's memory; a full-resolution image rendered into a thumbnail wastes most of what it decoded. Constrain the decode, not just the display:

```dart
Image.network(
  url,
  cacheWidth: 320, // decode to the size actually shown, not the source resolution
  fit: BoxFit.cover,
);
```

Size on-disk and remote assets to their rendered footprint, and let the framework's image cache evict — do not hold decoded bytes in app state. Oversized decodes are a memory budget overrun the same way an unbounded queue is a latency bomb.

## Isolates for Heavy Compute

The UI isolate renders frames; anything that can take longer than a frame must not run on it. Parsing a large payload, hashing, cryptographic work, image transforms — move them to a background isolate with `compute()` or a long-lived `Isolate`, so the work never blocks the frame loop:

```dart
final parsed = await compute(parseLargeReport, rawBytes);
```

This is the client's version of the hot-path discipline: the scoped, profiled paths that demand care, not every function (`docs/principles/quality/performance.md`). Repository translation of an ordinary payload stays on the UI isolate; reach for an isolate when a profile shows the work itself overrunning the frame.

## Startup Time

Cold start is the first interaction, and it spends the round-trip and frame budgets at once. Keep `main()` and the first frame thin: `ProviderScope` at the root and nothing else, no synchronous I/O before `runApp`, and defer non-critical provider initialisation until after the first frame paints. Render a skeleton from the first frame and let real data arrive into it — the app should be visible before it is fully loaded, never blank while it fetches.

## Resilience on the Typed Client

Reliability is designed in, not hoped for (`docs/principles/quality/reliability.md`). For a client, that discipline lives at the one seam that talks to the gateway — the `Dio` instance and the repositories above it (`references/data-and-contracts.md`):

- **Timeout always.** Every outbound call has connect and receive timeouts set on the one configured `Dio` instance — a hung connection otherwise holds a loading spinner forever.
- **Retry transient failures only, with jitter.** A retry interceptor retries connection errors and timeouts with bounded, jittered exponential backoff; jitter is not optional, because a fleet of clients retrying in lockstep is a thundering herd against the gateway. A `4xx` is permanent — retrying it wastes the budget. Retry at this one layer, not in every repository on top of it.
- **Map transport failures to domain states.** `DioException` never crosses above the data layer; the repository turns an unreachable gateway into a domain state the UI renders, and lets a contract violation surface as an error (`references/data-and-contracts.md`).

## Optimistic UI and Offline

A mobile process dies constantly and a network drops mid-interaction; state the app cannot rebuild from the core or the route is state it silently loses (`references/state-management.md`). Two patterns follow:

- **Optimistic update.** Reflect the user's action in state immediately, fire the mutation, and reconcile on the result — invalidate the provider to re-derive from the repository on success, roll back on failure. A Riverpod `Mutation` surfaces the pending/error lifecycle without a hand-rolled boolean (`references/state-management.md`).
- **Offline read-through.** A repository that caches can serve its last-known value while a refresh is in flight, so a dropped connection degrades to stale-but-present rather than empty. Mark served-stale state so the UI can show it honestly.

## Graceful Degradation

Every feature that depends on the gateway has a defined behaviour when the gateway is down — decided at design time, built alongside the happy path, never "we'll figure out what to show later" (`docs/principles/quality/reliability.md`). A view renders `loading` / `error` / `data` exhaustively, and the error case is a real designed state with a retry affordance, not a thrown exception reaching the user (`references/state-management.md`). A non-critical panel whose data is unavailable renders its own empty or "unavailable" state while the rest of the screen works — partial function beats a blank screen.

## What Lives in the Core, Not Here

Server reliability patterns do not belong on a client, and importing them here is miscategorised work. They live in the capability core and its services (`docs/principles/quality/reliability.md`):

- **SLOs and error budgets** are defined per service in the core, measured server-side. The client contributes client-observed latency to that picture; it does not own the objective.
- **Load shedding** protects the server from overload and must work regardless of client behaviour — it is a server-side backstop, not something a well-behaved client implements for it.
- **Circuit breakers** are earned against slow downstreams and tuned against real traffic at the service layer. A client's bounded, budgeted retry is the right amount of resilience at the edge; a breaker estimated locally by one app trips on noise. The business rules about a failure — whether it is recoverable, the retry budget — are proven in the core, and the surface renders the result.

## Anti-Patterns

- **Jank shipped, fixed later.** If you ship a stuttering scroll, users remember slow.
- **`ListView(children: [...])` for a dynamic or long list.** Eager construction of every row — use the `.builder` constructor.
- **Heavy work on the UI isolate.** A parse or hash that overruns a frame freezes the app — `compute()` it.
- **Full-resolution decode for a thumbnail.** Decoded image memory, wasted — constrain `cacheWidth`/`cacheHeight`.
- **Retry without jitter, or at every layer.** Lockstep retries are a thundering herd; layered retries multiply one tap into a storm.
- **No degraded state.** A feature with no defined behaviour when the gateway is down ships a blank screen or a raw exception.
- **Reimplementing server reliability on the client.** Load shedding, SLOs, and reflexive circuit breakers belong in the core, not the surface.
