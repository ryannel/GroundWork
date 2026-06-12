# Concurrency

## Core Rules

Every goroutine has an owner. `errgroup.WithContext` is the default supervision primitive. Context is passed everywhere. No goroutine runs past the lifetime of the work it was started for.

### Never Use Bare `go func()`

A bare `go func()` that fires and forgets is a goroutine with no owner and no cancellation path. Every `go` statement launches a goroutine that is either:

1. Tracked by an `errgroup.Group` or `sync.WaitGroup` that the caller waits on, or
2. A long-lived background worker started at program entry and shut down via a dedicated `context.Context` and `sync.WaitGroup` on the composition root.

### `errgroup.WithContext` Is the Default

For fan-out work — fetching multiple resources concurrently, processing items in parallel:

```go
g, ctx := errgroup.WithContext(ctx)

g.Go(func() error {
    return fetchResource(ctx, id)
})
g.Go(func() error {
    return fetchMetadata(ctx, id)
})

if err := g.Wait(); err != nil {
    return fmt.Errorf("fetching resources: %w", err)
}
```

When the first goroutine returns an error, the derived `ctx` is cancelled, signalling the others to stop.

### Context Propagation Is Non-Negotiable

Every function that launches goroutines accepts a `context.Context` and passes it down. Every goroutine checks `ctx.Done()` on any blocking operation:

```go
select {
case result := <-ch:
    process(result)
case <-ctx.Done():
    return ctx.Err()
}
```

### Limit Concurrency with Semaphores

Unconstrained fan-out exhausts file descriptors and saturates downstream services:

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

### Shared State: Channels First, Mutexes Second

Pass ownership via channels rather than sharing pointers through mutexes. Use `sync.Mutex` when a channel would be awkward — e.g., protecting a map read from many goroutines.

Never access shared state without synchronisation. The Go race detector (`-race`) is a required CI gate.

## Graceful Shutdown

Background workers started at program entry respect the root context. The composition root in `cmd/` creates a context cancelled by `SIGTERM`/`SIGINT`:

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

The composition root waits on all workers before the process exits. A service that kills itself with `os.Exit` rather than waiting for goroutines to drain drops in-flight requests and corrupts state.

## Anti-Patterns

- **Fire-and-forget goroutines.** If you don't track it, you don't own it.
- **Sharing context derivations across goroutines.** Each goroutine derives its own from the parent.
- **Goroutines in `init()` or package-level `var`.** Goroutines belong in functions with explicit lifecycle management.
- **Infinite retry loops without backoff and cancellation.** A retry loop that ignores `ctx.Done()` spins forever after shutdown.
- **Mutexes without deferred unlock.** Always `defer mu.Unlock()` immediately after acquiring the lock.

## References

- [sync/errgroup package](https://pkg.go.dev/golang.org/x/sync/errgroup)
- *The Go Memory Model* (golang.org/ref/mem)
- *Concurrency in Go*, Katherine Cox-Buday
