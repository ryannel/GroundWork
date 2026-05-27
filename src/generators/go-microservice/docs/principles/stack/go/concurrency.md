---
title: Concurrency
description: Goroutine lifecycle, errgroup, context cancellation, and supervised concurrency in Go services.
status: active
last_reviewed: 2026-05-26
---
# Concurrency

## TL;DR

Every goroutine we launch has an owner. We use `errgroup.WithContext` as the default supervision primitive, pass context everywhere, and never leave a goroutine running past the lifetime of the work it was started for.

## Why this matters

A goroutine is cheap to start and invisible when it leaks. Service memory that grows slowly but never recovers is almost always leaked goroutines holding references. Cancellation signals that never propagate are why graceful shutdowns stall. Getting goroutine ownership right is not defensive programming — it is the minimum bar for production Go code.

## The core rules

### Never use bare `go func()`

A bare `go func()` that fires and forgets is a goroutine with no owner and no cancellation path. We don't write them. Every `go` statement launches a goroutine that is either:

1. Tracked by an `errgroup.Group` or `sync.WaitGroup` that the caller waits on, or
2. A long-lived background worker started at program entry and shut down via a dedicated `context.Context` and `sync.WaitGroup` on the composition root.

### `errgroup.WithContext` is the default

For any fan-out work — fetching multiple resources concurrently, processing items in parallel — `errgroup.WithContext` is the idiomatic choice:

```go
g, ctx := errgroup.WithContext(ctx)

g.Go(func() error {
    return fetchTranscript(ctx, id)
})
g.Go(func() error {
    return fetchMetadata(ctx, id)
})

if err := g.Wait(); err != nil {
    return fmt.Errorf("fetching resources: %w", err)
}
```

When the first goroutine returns an error, the derived `ctx` is cancelled, signalling the others to stop. `g.Wait()` collects and returns the first non-nil error after all goroutines exit.

### Context propagation is non-negotiable

Every function that launches goroutines accepts a `context.Context` and passes it down. Every goroutine checks `ctx.Done()` on any blocking operation — I/O, channel receives, sleeps:

```go
select {
case result := <-ch:
    process(result)
case <-ctx.Done():
    return ctx.Err()
}
```

A goroutine that ignores its context will run past cancellation, block graceful shutdown, and mask errors. There are no exceptions.

### Limit concurrency with semaphores

Unconstrained fan-out (one goroutine per item in a slice) exhausts file descriptors and saturates downstream services. Use a semaphore channel to bound parallelism:

```go
const maxConcurrency = 10
sem := make(chan struct{}, maxConcurrency)

g, ctx := errgroup.WithContext(ctx)
for _, item := range items {
    item := item
    sem <- struct{}{}
    g.Go(func() error {
        defer func() { <-sem }()
        return process(ctx, item)
    })
}
if err := g.Wait(); err != nil {
    return fmt.Errorf("processing items: %w", err)
}
```

### Shared state: channels first, mutexes second

When goroutines need to coordinate, pass ownership via channels rather than sharing pointers through mutexes. Channels make the ownership transfer explicit and visible. Use a `sync.Mutex` when a channel would be awkward — for example, protecting a map that is read from many goroutines and written to occasionally.

Never access shared state without synchronisation. The Go race detector (`-race`) is a required gate in CI.

## Graceful shutdown

Background workers started at program entry must respect the root context. The composition root in `cmd/` creates a context cancelled by `SIGTERM`/`SIGINT`, and every long-lived worker selects on `ctx.Done()` to exit:

```go
func (w *Worker) Run(ctx context.Context) error {
    for {
        select {
        case <-ctx.Done():
            return nil
        case job := <-w.queue:
            if err := w.process(ctx, job); err != nil {
                // log, metric, continue — or propagate if fatal
            }
        }
    }
}
```

The composition root waits on all workers before the process exits. A service that kills itself with `os.Exit` rather than waiting for goroutines to drain is a service that drops in-flight requests and corrupts state.

## Anti-patterns

- **Fire-and-forget goroutines.** If you don't track it, you don't own it.
- **Sharing context derivations across goroutines.** Each goroutine that needs cancellation derives its own from the parent via `errgroup.WithContext` or `context.WithCancel`.
- **Goroutines in `init()` or package-level `var`.** Goroutines belong in functions with explicit lifecycle management.
- **Infinite retry loops without backoff and cancellation.** A retry loop that ignores `ctx.Done()` will spin forever after shutdown.
- **Mutexes without deferred unlock.** Always `defer mu.Unlock()` immediately after acquiring the lock.

## Further reading

- [sync/errgroup package](https://pkg.go.dev/golang.org/x/sync/errgroup) — the official docs with examples.
- *The Go Memory Model* (golang.org/ref/mem) — what happens before what, and why it matters.
- *Concurrency in Go*, Katherine Cox-Buday — patterns and pitfalls from production experience.
