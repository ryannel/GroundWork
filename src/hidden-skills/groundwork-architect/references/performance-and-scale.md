# Performance & Scale

Performance is not "fast enough" — it is a budget, spent deliberately across every hop of an interaction and enforced in CI. Users notice latency before almost anything else: a response at 800ms feels instant, at 3000ms feels broken. That gap is not four times the effort — it is the difference between treating latency as a design constraint and treating it as a post-hoc tuning problem. Performance handled as an afterthought is invariably more expensive than performance designed in.

## The design decisions

1. **Latency is a budget, allocated top-down.** Every user-facing operation starts with an edge budget (say 500ms) allocated to downstream hops. If one fetch takes 300ms and a join 150ms, the handler has 50ms of its own. When a hop overruns, someone else's budget is squeezed — the budgeting view makes the trade-off explicit.
2. **Measure tail latency, not average.** p50 is a marketing number; p95 and p99 are what users experience. Design for the tail and alert on it. A great median with a terrible p99 earns an awful reputation regardless of the dashboard.
3. **Pre-compute, cache, denormalise deliberately — across tiers.** Hot read → pre-compute. Stable computation → cache. Expensive join → denormalise. Caching is multi-tier (client, CDN/edge, service, datastore) with an explicit origin-offload/hit-ratio target, not a single layer. Each trades complexity for latency and must earn its keep with data, not intuition. Speculative caching is how cache-invalidation becomes the biggest source of data incidents.
4. **Backpressure is designed in, not hoped for.** Every producer has a bounded queue and a defined full-queue behaviour: shed, coalesce, block. "It works in load tests" is not a backpressure strategy.
5. **Load shedding protects the system from itself.** When saturated, serve fewer requests well rather than trying harder. Shed on clear criteria — low-priority first, new sessions before active ones, non-interactive before interactive. A designed degradation mode, not an accident.
6. **Profile before optimising.** The "obvious" bottleneck is almost always wrong; tuning a cold path is wasted effort. Profile in production-representative conditions — laptop profiles lie.
7. **Budgets are enforced in CI.** Bundle sizes, worst-case handler latencies, and the like are measured against committed thresholds; a regression requires a reviewed waiver. Regressions that slip in once slip in a hundred times — automation is cheaper than vigilance.

## Understand the demand shape before choosing infrastructure

Decide the scaling model from the shape of the demand, not from defaults:
- **Spiky and unpredictable** vs **stable and forecastable** demand call for fundamentally different approaches.
- For indie/hobby contexts, whether cost can reach near-zero during inactivity (**scale-to-zero**) is a legitimate architectural requirement that shapes every infrastructure choice after it.
- Fully managed services trade operational burden for higher spend and vendor dependency; self-managed trades convenience for control and cost.

Autoscaling is designed, not enabled: aggressive scaling on a bursty workload multiplies cost without improving experience; conservative scaling on a steady workload wastes headroom. Tune each policy to the production load profile. Default to **event-driven** autoscaling (KEDA on queue depth / lag / custom signals, Karpenter for nodes) with genuine **scale-to-zero** — which is what closes the idle-cost gap to serverless. CPU-only HPA is the dated reflex.

## Compute placement is a design axis

*Where* code runs is now a first-class decision, not just *how much* of it:
- **Edge** for latency-sensitive, cacheable, or geo-distributed work (auth, personalization, gateway logic) — proximity flattens tail latency; target a high edge hit ratio.
- **WebAssembly** is the edge/FaaS/plugin/multi-tenant-density compute unit (1–5ms cold start, sandboxed, polyglot) — production-ready for those, not yet a general microservice runtime.
- **Containers/serverless** for stateful or heavy work. Most teams blend all three; the placement decision trades latency, cost, and the edge's constraints (no raw TCP, limited CPU, no direct DB drivers).

## The AI-cost lever

For a model-in-the-loop feature, latency and cost track **tokens, not requests** — a latency budget that ignores token count is incomplete for an AI path. The routing / semantic-caching / gateway levers that manage it are [ai-native-architecture.md](ai-native-architecture.md) #7.

## Antipatterns to catch

- **Optimising on hunch** — no profile, no optimisation.
- **"Fast on my laptop"** — dev latency is not production latency.
- **Average-as-metric** — p50 is a lie; use percentiles.
- **Unbounded queues** — a queue without a max is a latency bomb.
- **"We'll fix performance later"** — ship slow and users remember slow.
