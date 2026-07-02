# Platform, Delivery & Cost

How the system is deployed, released, and paid for is an architectural concern, not an operational afterthought. The topology you choose constrains how fast the team can ship and what it costs to run — decide it with the boundaries, not after them.

## Platform: the substrate is a product

The platform is the substrate every team builds on — the local stack, the CI/CD pipeline, the observability collector, the secrets manager, the dev CLI fronting all of it. Treat it as a product with users, a backlog, and a quality bar. A good platform makes the right thing the easy thing.

1. **Self-service is the goal.** Spinning up a service, requesting a secret, adding a dashboard, flipping a flag — all self-service. When a team files a ticket and waits, the platform is the bottleneck.
2. **Golden paths over policy.** Pave the specific routes (create a service, deploy, observe) and make them the easiest path. Policy without a paved path produces compliance in shape, drift in substance.
3. **One paved-road pipeline per service type.** One pipeline definition for every service of a kind; deviation earns the cost of its own maintenance. This is how snowflake CI configurations are prevented.
4. **Observability is part of the platform.** One collector, one backend, one set of dashboards — telemetry set up independently by each team is broken in five different ways.

## Progressive delivery: decouple deploy from release

Deploying code and releasing a feature are different acts. Ship to production many times a day from one branch, but users see a change only when a flag opens, a canary routes, or a cohort is promoted. Deploys become small and boring; releases become observable, controllable, reversible.

1. **Trunk-based development, short-lived branches.** Every change lands on `main` when ready; branches measured in days, not weeks. Long-lived branches accumulate integration bugs quietly.
2. **Feature flags separate deploy from release.** New features deploy behind a flag defaulted off (use the vendor-neutral **OpenFeature** standard so the flag system is swappable). A bad feature is disabled without a redeploy; a risky one rolls to 1% before 100%. Every flag has an owner, a purpose, and an expiry — stale flags are removed in the normal course of work.
3. **Canary before promote, driven by GitOps.** Anything that could affect latency, reliability, or experience goes through a canary — a small traffic fraction for a bounded window — evaluated against SLO burn rates by automated comparison, not eyeballs. The progressive-delivery engine follows the GitOps tool (Argo Rollouts with ArgoCD, Flagger with Flux), which owns the traffic-weight and automated analysis.
4. **Release is reversible, cheaply.** Every release has a rollback any on-call engineer can execute in minutes: reversible migrations, flippable flags, re-routable canaries. "We can't roll that back" is a red flag on the release itself.

## Cost: a non-functional requirement with a dollar sign

Most teams discover cost too late — after a quarterly bill, when the decisions that drove it are already in production with consumers. Make the economic consequence visible at the point of the decision.

1. **Cost is a first-class metric.** Cost-per-call, cost-per-user, cost-per-feature, tracked alongside latency and error rate. A team that does not know what its features cost cannot reason about the trade-offs that matter.
2. **Budgets are set and defended.** Every significant service runs inside a cost budget set at design time; exceeding it triggers the same response as any SLO breach.
3. **Egress is expensive; plan for it.** Inter-region chatter, chatty logs, large frequent payloads add up. Place data where its consumers are; batch and compress where cheap.
4. **AI spend runs through a gateway.** Every model call is mediated by an **AI gateway** — a token-aware control plane between apps/agents and providers — so routing, caching, and budget enforcement are a platform capability, not each team's own retrofit. The cost/routing doctrine itself is [ai-native-architecture.md](ai-native-architecture.md) #7.

## Substrate choices

- **IaC is a real choice now, not a default.** Name it: **Terraform** (incumbent), **OpenTofu** (OSS-governed, diverging — it has state encryption Terraform lacks, and provider compatibility may drift, so it is no longer a silent drop-in), or **Pulumi** (real languages). Pick deliberately.
- **Buy-vs-build the IDP.** Backstage is the share leader but self-hosting it is a platform-team tax; under a couple hundred engineers, a managed portal usually wins. The platform is a product — including the build/buy decision.

## Carbon is a design input

Sustainable software has crossed into a first-class concern: measure with the Green Software Foundation's SCI, and shift demand for *carbon* the way you already shift it for cost — run deferrable/batch work when and where the grid is cleaner (carbon-aware scheduling). This extends the demand-shaping you already do; express it as a fitness function so it does not regress silently.

## Antipatterns to catch

- **Platform-as-gatekeeper** — a platform that says "no" more than "self-serve" is a bottleneck.
- **Release trains** — batching a month of changes into a Friday deploy that breaks unlocalisably.
- **Flags without expiry** — a year-old "temporary" flag is a permanent decision hidden in runtime config.
- **Canary-by-eyeball** — promoting because the graph "looks fine." Automate the comparison.
- **"Optimise cost later"** — later never comes; by then the architecture is what it is.
