# Reliability

Reliability is not a feature added after the system is built — it is a design property paid for up front, measured in error budgets, defended by graceful-degradation patterns, and rehearsed through deliberate failure injection. Users do not experience uptime percentages; they experience "the thing I needed did not work just now." In a real-time product unreliability compounds: a dropped request becomes a failed operation becomes a broken journey. The cost of a small reliability failure is rarely proportional to its scope.

## The design decisions

1. **SLOs, not uptime percentages.** Every significant service defines a Service Level Objective — a per-endpoint or per-journey target with latency and success-rate components over a rolling window. "99.9% uptime" is not an SLO; "p95 `POST /resource` < 300ms over 30 days, 99.5% success" is. The SLO is the measurement surface everything else hangs on.
2. **Error budgets govern velocity.** The budget implied by the SLO is a spendable resource. Below budget, ship riskier changes and run experiments; above budget, pause feature work and pay down reliability debt. Reliability as a gate on velocity, not a tax on top of it.
3. **Graceful degradation is a design, not a hope.** Every user-facing feature has a defined behaviour when its downstream fails — a view without synthesis data renders a "not yet ready" state; a pipeline without a model client enqueues and returns when it can. Decided at design time, implemented alongside the happy path.
4. **Timeouts, retries, and circuit breakers are defaults.** Every outbound call has a timeout, every retry a bounded policy with jitter, every client a breaker against its important downstreams. Set in a shared library so new services inherit them; opting out requires a written reason.
5. **Isolate blast radius — cells.** A single tenant, user, or noisy consumer must not degrade everyone else. Isolate by quota (per-tenant rate limits), by resource (dedicated queues for hot workloads), and by bulkhead (separate worker pools). At scale this generalises to **cell-based architecture** — partition the system into independent cells so a failure is contained to one cell's users. The design question is always "if this goes bad, who else is affected?" — and the target answer is "only the thing that went bad."
6. **Verify failure continuously, within a policy.** Inject failures — killed pods, degraded networks, slow databases — routinely in staging and carefully in production, as *continuous verification* bounded by an automated blast-radius policy (cap the fraction of traffic/pods, forbid touching critical paths in business hours), not an occasional unguarded game-day. The goal is to discover the reliability assumptions you are making without knowing it.
7. **Alert on user impact, not mechanism.** Page on SLO burn rate and journey error spikes, not on 80% CPU. Mechanism alerts without user impact teach on-call to ignore pages — which is how a real incident gets missed.
8. **Every incident teaches a specific lesson.** A blameless postmortem names the specific assumption the incident invalidated and the specific change that would have caught it. Not "be more careful," not "add more monitoring" — one concrete, closable ticket.

## SLOs are living, and AI fails differently

SLOs are hypotheses reviewed against burn, not set-and-forget contracts: alert on **multi-window, multi-burn-rate** signals; consistently under-burning means the target is too loose, a blown budget triggers a reliability project. And a model-in-the-loop changes the failure shape: a wrong answer returns **HTTP 200, valid JSON, within latency** — semantic failure, not an exception. So AI features carry **per-SLI budgets** (an accuracy/consistency budget distinct from the latency budget, burning independently), and the model provider is treated as your least-reliable dependency (rate limits and provider drift are first-class failure modes with their own degradation path).

## RTO / RPO drive the topology

When availability is a stated requirement, pin the two numbers that shape redundancy, replication, failover, and backup: **RTO** (acceptable recovery time if the system goes down) and **RPO** (tolerable data loss in a failure). A system that must be 99.99% available is architecturally different from one where an hour of downtime is acceptable — decide which you are building before the boundaries harden.

## Antipatterns to catch

- **"Five-nines" as a reflexive target** — reckless for a non-core service. Set an SLO the team can defend.
- **Retries without policies** — retry-forever is a self-inflicted DDoS.
- **Mechanism alerts** — paging on CPU/memory/disk untied to user impact. Noise.
- **"It hasn't failed yet"** — absence of a known failure mode is not evidence of its absence. Rehearse.
- **Postmortems that blame humans** — a system that depends on everyone being perfect will fail. Fix the system.
- **SLOs nobody tracks** — an SLO without a dashboard and a burn-rate alert is theatre.
