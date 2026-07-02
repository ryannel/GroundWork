# Async Runtime & the Event Loop

## The One Rule: Never Block the Event Loop

One thread serves every request. A synchronous call longer than ~1ms stalls all of them, and the symptom is random, unrelated timeouts across the service. `fs.readFileSync`, `crypto.pbkdf2Sync`, `zlib.gzipSync`, and `JSON.parse` on a multi-megabyte body are the same defect on the request path. Use `node:fs/promises`, the async crypto/zlib forms, and streams for large payloads.

## CPU-heavy work runs in worker_threads

The async fs/crypto/zlib APIs already run on libuv's thread pool; your own CPU-bound work (parsing, image/audio processing, heavy serialization) does not — move it to `worker_threads`. Use one bounded pool (piscina or equivalent) created at the composition root and reused for the process lifetime; spawning a worker per request pays thread startup on the hot path. Size the pool at or below core count — beyond that, threads contend instead of computing.

## Promise Hygiene

- **No floating promises.** An unhandled rejection crashes the Node process, so a fire-and-forget that rejects is an outage. Await it, return it, or hand it to a tracked owner — a background-jobs registry the shutdown sequence drains. `@typescript-eslint/no-floating-promises` enforces this mechanically; it belongs in the lint config.
- **`Promise.all` when one failure must abort the batch; `Promise.allSettled` where partial failure is legal** — and every `rejected` entry is inspected. An `allSettled` whose rejections are never read is a silent error sink.
- **Bound your concurrency.** `Promise.all(items.map(fetchOne))` over thousands of items opens thousands of sockets at once; run large batches through a concurrency-limited pool (p-limit or equivalent).
- **Cancellation is cooperative.** Thread `AbortSignal` through the chain (`node-services.md`); a promise you cannot cancel is work you cannot shed.

## Streams Honour Backpressure

Compose with `pipeline` from `node:stream/promises` — it propagates errors and destroys every stage, where hand-chained `.pipe()` leaks the source when the destination errors:

```ts
import { pipeline } from "node:stream/promises";

await pipeline(upload, decompress, parseRecords, writeToDb, { signal });
```

When writing manually, respect `write()`'s return value and wait for `drain` — ignoring it buffers the producer's entire output in memory. Collecting an unbounded stream into an array is the same memory bomb with fewer steps.

## Timers and the Microtask Queue

- `setImmediate` yields to pending I/O — use it to break up long synchronous work.
- `process.nextTick` and microtasks run before I/O; recursive `nextTick` starves the loop. Reach for `queueMicrotask` only for ordering within a tick.
- `await setTimeout(ms, undefined, { signal })` from `node:timers/promises` replaces hand-rolled sleep and stays cancellable.

## Anti-Patterns

- **Sync fs/crypto/zlib on the request path.** Startup-only code may block; handlers never.
- **Fire-and-forget promises.** Every promise has an owner: awaited, returned, or registered for drain.
- **`new Promise` around a promise-returning API.** The explicit-construction wrapper adds a place to forget `reject`.
- **Unbounded fan-out.** `Promise.all` over an unbounded collection; use a concurrency limit.
- **Worker per request.** Pool workers; thread startup does not belong on the hot path.
