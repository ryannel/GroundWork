# Capability Ports & Providers Registry Contract

`docs/architecture.md` §3 ("Key Capabilities & Technical Decisions" → Capability Ports & Providers) is the canonical, human record of which technical capabilities the system depends on and how each is satisfied. `.groundwork/capability-ports.json` is its machine-readable twin, written in the same commit (the contract-grade rule: every reviewed artifact has a machine-checkable twin). The architecture commit writes both at greenfield setup; `groundwork-architecture-extract` writes both at brownfield adoption; the scaffold phase reads the twin to compose generators, infrastructure, and runners.

> **Not the capability ledger.** `docs/surfaces.md` carries a *capability ledger* — user-facing **features** mapped across **surfaces** (`checkout/guest-checkout` delivered on web, planned on mobile). This registry is a different axis: **technical ports** (LLM inference, a data store, telemetry) and the **providers/adapters** that satisfy them. Features reach surfaces; ports are satisfied by providers. Keep the two distinct.

**The model.** GroundWork preaches hexagonal architecture — a domain port, swappable adapters at the edge. A **capability** is such a port (a domain interface). A **provider** is an adapter that satisfies it. Each provider declares an **operational footprint** — exactly one of:

| Footprint | Meaning | Materialized by the scaffold as |
|---|---|---|
| `env` | A hosted API reached by key/URL | environment variables in the service config; no infrastructure |
| `compose-service` | A container the local stack runs | a `docker-compose.yml` service injected on demand (e.g. a pgvector store → `db`) |
| `runner` | A native host process | an entry in `.dev/dev.config.json` `runners[]` that `./dev` start/stop/status manage |
| `none` | A **raw gateway** — a bet | the port + a not-yet-implemented stub adapter + a strict-xfail contract test; no provider SDK, no infra |

There are no default providers, and therefore no default infrastructure: a database appears *because* a store provider's footprint is a compose service; a tracing backend appears *because* a telemetry provider was selected. `none` is GroundWork's own thesis turned on the scaffold — the port is the spec, the adapter is a bet the delivery loop later cashes.

---

## Schema — `.groundwork/capability-ports.json`

```json
{
  "schema": "groundwork.capability-ports",
  "version": 1,
  "ports": [
    {
      "capability": "llm",
      "service": "compute-service",
      "provider": "anthropic",
      "footprint": "env",
      "rationale": "Hosted Claude; product committed to Anthropic."
    },
    {
      "capability": "datastore",
      "service": "api",
      "provider": "postgres",
      "footprint": "compose-service",
      "rationale": "Relational + vector store for the catalogue."
    },
    {
      "capability": "llm",
      "service": "drafting-service",
      "provider": "none",
      "footprint": "none",
      "rationale": "Provider undecided — ship the port as a bet, build the adapter in the first delivery."
    }
  ]
}
```

| Field | Values | Meaning |
|---|---|---|
| `capability` | a capability id in the registry (`src/generators/capabilities/<id>/`) | the port |
| `service` | a service slug, or omit for a workspace-wide capability | which service owns the port |
| `provider` | a provider in the capability's catalog, or `none` | the chosen adapter |
| `footprint` | `env` · `compose-service` · `runner` · `none` | the provider's operational cost; the scaffold materializes exactly this |
| `rationale` | free text | why this provider — including "raw gateway, to be built as a bet" for `none` |

A `provider` of `none` always has `footprint: "none"`. An empty `ports` array is legal — a product with no technical capability ports.

---

## How the scaffold consumes it

The scaffold phase (`groundwork-scaffold` Phase 1) reads this twin alongside the surface registry and maps each port to a generator action:

- An `env` / `compose-service` / `runner` provider becomes a generator flag (e.g. `python-microservice --llm --llmProvider anthropic`, `--postgres`) or, for an existing service, an `add-capability --service <s> --capability <c> --provider <p>` invocation.
- A `none` provider scaffolds the raw gateway (`--provider none` / `add-capability ... --provider none`): the port, the stub, and the strict-xfail contract test.

Phase 4 reconciles: every `compose-service` footprint must be a service in `docker-compose.yml`, every `runner` a registered runner in `dev.config.json`, every `env` documented in `infrastructure.md`, and every `none` a service with its xfail contract test present — a mismatch is a gap between the architecture and the scaffold.
