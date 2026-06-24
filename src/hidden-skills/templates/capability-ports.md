# Capability Ports & Providers Registry Contract

`docs/architecture/index.md` §3 ("Key Capabilities & Technical Decisions" → Capability Ports & Providers) is the canonical, human record of which technical capabilities the system depends on and how each is satisfied. `.groundwork/capability-ports.json` is its machine-readable twin, written in the same commit (the contract-grade rule: every reviewed artifact has a machine-checkable twin). The architecture commit writes both at greenfield setup; `groundwork-architecture-extract` writes both at brownfield adoption; the scaffold phase reads the twin to compose generators, infrastructure, and runners.

> **Not the capability ledger.** `docs/surfaces.md` carries a *capability ledger* — user-facing **features** mapped across **surfaces** (`checkout/guest-checkout` delivered on web, planned on mobile). This registry is a different axis: **technical capabilities** (LLM inference, a data store, telemetry) and the **providers** that satisfy them. Features reach surfaces; capabilities are satisfied by providers. Keep the two distinct.

**The model.** A **capability** is an interface the system depends on; a **provider** is the implementation that satisfies it, wired in at the edge and swappable. Each provider declares an **operational footprint** — exactly one of:

| Footprint | Meaning | Materialized by the scaffold as |
|---|---|---|
| `env` | A hosted API reached by key/URL | environment variables in the service config; no infrastructure |
| `compose-service` | A container the local stack runs | a `docker-compose.yml` service injected on demand (e.g. a pgvector store → `db`) |
| `runner` | A native host process | an entry in `.dev/dev.config.json` `runners[]` that `./dev` start/stop/status manage |
| `none` | A **bare interface** — a bet | the interface + a not-yet-implemented stub + a strict-xfail contract test; no provider SDK, no infra |

There are no default providers, and therefore no default infrastructure: a database appears *because* a store provider's footprint is a compose service; a tracing backend appears *because* a telemetry provider was selected. `none` is GroundWork's own thesis turned on the scaffold — the interface is the spec, the provider is a bet the delivery loop later cashes.

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
      "rationale": "Provider undecided — ship the interface as a bet, build the provider in the first delivery."
    }
  ]
}
```

| Field | Values | Meaning |
|---|---|---|
| `capability` | a capability id in the registry (`src/generators/capabilities/<id>/`) | the capability interface |
| `service` | a service slug, or omit for a workspace-wide capability | which service owns the capability |
| `provider` | a provider in the capability's catalog, or `none` | the chosen provider |
| `footprint` | `env` · `compose-service` · `runner` · `none` | the provider's operational cost; the scaffold materializes exactly this |
| `rationale` | free text | why this provider — including "bare interface, to be built as a bet" for `none` |

A `provider` of `none` always has `footprint: "none"`. An empty `ports` array is legal — a product with no technical capabilities.

---

## How the scaffold consumes it

The scaffold phase (`groundwork-scaffold` Phase 1) reads this twin alongside the surface registry and maps each capability to a generator action:

- An `env` / `compose-service` / `runner` provider becomes a generator flag (e.g. `python-microservice --llm --llmProvider anthropic`, `--postgres`) or, for an existing service, an `add-capability --service <s> --capability <c> --provider <p>` invocation.
- A `none` provider scaffolds the bare interface (`--provider none` / `add-capability ... --provider none`): the interface, the stub, and the strict-xfail contract test.

Phase 4 reconciles: every `compose-service` footprint must be a service in `docker-compose.yml`, every `runner` a registered runner in `dev.config.json`, every `env` documented in `infrastructure.md`, and every `none` a service with its xfail contract test present — a mismatch is a gap between the architecture and the scaffold.
