---
title: Cost Engineering
description: FinOps, cost-aware architecture, and the economics of autoscaling.
status: active
last_reviewed: 2026-06-19
---
# Cost Engineering

## TL;DR

Cost is a non-functional requirement with a dashboard and a dollar sign. Every significant architectural decision considers cost-per-user and cost-per-call; every service has a budget it lives inside; surprising spend is an incident. FinOps is how we stay honest about the economics of running what we build.

## Why this matters

Most teams discover cost too late — after a quarterly bill raises eyebrows in a meeting. By then, the decisions that drove the cost are in production, have consumers, and are expensive to reverse. Cost engineering is the discipline of making the economic consequences of decisions visible at the point of the decision. It turns cost from a finance concern into an engineering variable.

## Our principles

### 1. Cost is a first-class metric

Cost-per-call, cost-per-user, cost-per-feature — all tracked alongside latency and error rate. A feature's success includes its unit economics, not just its engagement numbers. A team that does not know what its features cost cannot reason about trade-offs that matter.

### 2. Budgets are set and defended

Every significant service runs inside a cost budget. The budget is set at design time, reviewed monthly, and treated as a commitment. Exceeding budget triggers the same response as exceeding any other SLO: investigate, remediate, or explicitly negotiate an increase.

### 3. Autoscaling is designed, not enabled

Autoscaling is a tool with sharp edges. Aggressive autoscaling on a bursty workload can multiply cost without improving user experience; conservative autoscaling on a steady workload wastes headroom. Each scaling policy is tuned per workload with the production load profile in mind, not set to vendor defaults and left.

The shape of the load picks the mechanism. Steady baseline with modest peaks → run a reserved floor and let the autoscaler add thin headroom on top. Spiky, event-driven, or queue-backed work → scale on the real driver (queue depth, request concurrency via KEDA or equivalent), not lagging CPU, and scale to zero when idle if the cold-start budget allows. Latency-sensitive request paths → never scale to zero; the cold start is paid by the user. Defaults are a starting hypothesis, not a setting.

### 4. Cheap queries beat fast queries — until staleness has a cost

The fastest query is the one that does not run. We cache what we can, compute what we must, and denormalise when the read-to-write ratio justifies it. But "cheap" is not free: a cache buys read cost down with invalidation complexity, and the bugs born of stale or inconsistent reads can cost more than the queries they replaced. Denormalisation trades read cost for write amplification and a second copy of the truth to keep in sync.

The decision rule is the read-to-write ratio weighed against the tolerance for staleness. Read-heavy data that tolerates seconds or minutes of lag (catalogues, dashboards, feeds) → cache or denormalise aggressively, with an explicit TTL and an invalidation path. Data where a stale read is a correctness or money bug (balances, inventory, auth) → pay for the live query and optimise the query itself. Never add a cache to mask a query you have not first tried to make cheap at the source.

### 5. Egress is expensive; plan for it

Cloud provider egress is the most mispriced line item in most bills. Inter-region chatter, chatty logs, large payloads sent frequently — these add up. We place data where its consumers are, batch where we can, and compress where it is cheap to do so.

### 6. AI spend has the same discipline

Every model call has a measured cost and a caching strategy. Prompts are versioned with token-count measurement; expensive prompts are justified by value. Output tokens are the dominant cost — major providers price them roughly 4-5× input — so a verbose model talking to itself is the silent budget killer, and trimming output earns more than trimming input. Prompt caching is the highest-leverage lever for any workload that resends a large, stable prefix (system prompt, repo, retrieved context): a cache hit bills a small fraction of the input rate, so structure prompts with the stable bytes first and the variable bytes last. "Just pass the whole context to the largest model" is how an AI feature becomes a cost incident.

### 7. Rightsize before you commit

Reserved instances and committed-use discounts save roughly 30-50% over on-demand for predictable baseline workloads — but the discount is only as good as the baseline it is bought against. Commit to an oversized or idle fleet and you have locked in waste at a discount. So the order is fixed: rightsize first, then commit. Rightsizing cleans the baseline — often returning 15-25% on its own — and only then is there a number worth committing to.

The contested zone is how much to commit and for how long. Longer terms (three years) cut the most but lock hardest; a savings plan or reservation generally cannot be cancelled or resized mid-term. Cover the *verified floor* — the level the workload never drops below — and let variable and peak demand float on-demand, where elasticity is worth its premium.

The decision rule: commit to the floor you are certain of, ladder the purchases (several small commitments across the year rather than one annual bet) so coverage tracks real growth, and bias longer terms to the stable core and shorter terms to the uncertain layer. Size to the minimum baseline, never to average or peak — basing a commitment on average usage is how a discount becomes a liability.

### 8. FinOps is a practice, not an office

Cost engineering is something every team does, not a team that does it on behalf of others. The central function provides tooling and visibility; the distributed decisions are made by the teams that built the spend.

### 9. AI cost runs through a gateway; carbon is a cost too

AI spend earns a dedicated control point: route model calls through an **AI gateway** that does model routing, semantic caching, fallback, and per-key budgets. The gateway is the difference between an experiment and a cost incident — it enforces the token discipline of Principle 6 at the edge, where every team's calls converge, rather than trusting each caller to do it alone.

Carbon sits on the same ledger. Measure it with the Green Software Foundation's Software Carbon Intensity (SCI): the energy a workload draws, the carbon intensity of that energy, and embodied hardware emissions, divided by a functional unit (per call, per user). Express the target as a fitness function so it cannot regress silently.

The contested zone is *how* you cut carbon, and the two levers are not equal. **Region-shifting** — placing or moving a workload onto a grid running cleaner energy — is usually the single largest lever; Microsoft's carbon-aware research finds the choice of region can dominate a workload's SCI. But it collides head-on with three other principles: data-residency and privacy law may forbid the move, egress (Principle 5) can erase the saving, and distance adds user latency. **Time-shifting** — deferring flexible work to low-carbon windows using grid signals (WattTime, Electricity Maps) via tooling like Microsoft's Carbon Aware SDK — is safer but bounded; published studies find simple scheduling captures most of the available reduction and sophisticated policies add little on top.

The decision rule follows the workload. Deferrable batch with no latency SLA (model training, reporting, async pipelines) → time-shift into clean windows. Stateless compute free of residency constraints → region-pin to a low-carbon region at deploy time, after checking the egress and latency bill. Latency-sensitive or residency-bound request paths → shift nothing; cut carbon by cutting waste, which is the same efficiency work that cuts cost.

## How we apply this

- [Observability](../quality/observability.md) — the measurement substrate for cost per unit.
- [Platform](platform.md) — the shared infra that every team's cost sits on.
- [Performance](../quality/performance.md) — cheap code is often also fast code.

## Anti-patterns we reject

- **"We will optimise cost later."** Later never comes; the architecture is what it is by then.
- **Autoscale-and-forget.** Default autoscaling on a workload you have not profiled is how you get a thousand-dollar day.
- **Commit before rightsizing.** A three-year commitment on an oversized fleet locks in waste at a discount, and the term cannot be unwound.
- **Chatty logs forever.** Unstructured debug logs at volume are a non-trivial line on the bill.
- **AI calls without budget.** Model spend without a measured cost-per-request grows silently until it does not.
- **"It's just pennies."** Pennies × N × daily = a real number. Track it.

## Further reading

- *Cloud FinOps*, Storment & Fuller — the canonical text on cross-functional cost management.
- *AWS Well-Architected Framework — Cost Optimization pillar* — applicable beyond AWS, useful as a checklist.
- *FinOps Foundation framework* ([finops.org](https://finops.org)) — the practitioner's handbook; see the Rate Optimization and committed-use-discount capabilities for the commitment-portfolio discipline behind Principle 7.
- *Green Software Foundation — Software Carbon Intensity (SCI) specification & Carbon Aware SDK* ([greensoftware.foundation](https://greensoftware.foundation)) — how to measure carbon per functional unit and schedule work against grid signals.
