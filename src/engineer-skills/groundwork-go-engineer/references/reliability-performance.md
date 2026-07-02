# Reliability

SLOs over uptime percentages, error budgets governing velocity, designed-in degradation, default timeouts/retries/circuit breakers, blast-radius isolation, rehearsed failure, user-impact alerting, specific postmortem lessons — the full principle set is `docs/principles/quality/reliability.md`; this file states only Go's implementation shape.

## Anti-Patterns

- **"99.999% uptime" as a target.** Five-nines for a non-core service is reckless.
- **Retries without policies.** Retry-forever is a self-inflicted DDoS.
- **Mechanism alerts.** Paging on CPU without user-impact signal.
- **Postmortems that blame humans.** The action item is the system fix.
- **SLOs nobody tracks.** An SLO without a dashboard and burn-rate alert is theatre.

---

# Performance

Latency as a top-down budget, tail latency over average, deliberate pre-compute/cache/denormalise, designed-in backpressure, profile-before-optimise, CI-enforced budgets — the full principle set is `docs/principles/quality/performance.md`; this file states only Go's implementation shape.

## Load Shedding Protects the System

When saturated, serve fewer requests well. Shed on clearly-defined criteria using inbound concurrency limits.

```go
import "golang.org/x/sync/semaphore"

var maxInflight = semaphore.NewWeighted(1000)

func LoadSheddingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !maxInflight.TryAcquire(1) {
            http.Error(w, "Service Unavailable", http.StatusServiceUnavailable)
            return
        }
        defer maxInflight.Release(1)
        next.ServeHTTP(w, r)
    })
}
```

Hot paths get allocation-aware code (every allocation is a GC pause in waiting) and a `pprof` profile before optimising — the "obvious" bottleneck is almost always wrong; run `go tool pprof` against a CPU or heap profile, not intuition.

## Anti-Patterns

- **Optimising on hunch.** No profile, no optimisation.
- **Average-as-metric.** p50 is a lie. Use percentiles.
- **Unbounded queues.** A queue without a max is a latency bomb.
- **"We will fix performance later."** If you ship slow, users remember slow.
