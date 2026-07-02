# Surface Registry & Capability Ledger Contract

`docs/surfaces.md` is the canonical record of a product's surfaces and the capability core they adapt. The prose document is the human source of truth; `.groundwork/surfaces.json` is its machine-readable twin, kept in lockstep by the same commits (the contract-grade rule: every reviewed artifact has a machine-checkable twin). The architecture commit writes both at greenfield setup; `groundwork-architecture-extract` writes both at brownfield adoption; `groundwork-surface-activation` and bet validation maintain them for the life of the product.

**The model:** a product is one **capability core** — the domain logic, data, and contracts, always designed and validated headless — plus zero or more **surfaces**, the deployed artifacts consumers interact with (a web app, a CLI binary, a mobile app, an MCP server). Surfaces are adapters over the core. The registry names the surfaces; the **capability ledger** records which capabilities reached which surfaces, so divergence between surfaces is a decision on record, never a silent drift.

---

## Document structure

`docs/surfaces.md` carries three sections, in this order:

### 1. Capability Core

One short section describing the core: what it owns (domain logic, persistence, contracts), its **deployment** — `hosted` (services reached over a network) or `embedded` (a library in-process with its single surface) — and where its contracts live. The deployment decision is made in the architecture phase; it determines the contract spec format (OpenAPI/AsyncAPI for hosted HTTP/event boundaries, proto for gRPC, a typed public module API for an embedded core) and the transport capability tests run against. Nothing else branches on it.

### 2. Surface Registry

One entry per surface, current and planned. Each entry is a heading (`### <slug>`) with a field table:

| Field | Values | Meaning |
|---|---|---|
| `type` | `graphical-ui` \| `cli` \| `agentic-protocol` | The interface type — owns the design track, vocabulary, and test medium family. |
| `platform` | `web` \| `mobile` \| `desktop` \| `terminal` \| `protocol` | Where the artifact runs. Several surfaces can share a type across platforms (web and mobile are both `graphical-ui`). |
| `status` | `active` \| `planned` \| `dormant` \| `retired` | `active` ships and is tested; `planned` is on the roadmap with no code; `dormant` exists but is not currently maintained; `retired` is decommissioned (see the retired-column rule below). |
| `core access` | e.g. `http-gateway`, `http-direct`, `grpc`, `in-process` | How this surface reaches the core — the access path the architecture phase settled (direct, gateway, BFF). |
| `auth` | free text | The auth model this surface uses against the core. |
| `scaffold` | a generator name (`nextjs-app`, `cli-app`, `flutter-app`, `electron-app`), `forged`, or `manual` | What generates the surface's app. `manual` is first-class: a surface participates fully in design, bets, the ledger, and tests before a generator exists for it — the registry never blocks on tooling. `forged` means no generator exists but `groundwork-stack-forge` built a Day-2 seed and a stack engineer skill for it — like `manual`, no generator invocation, but unlike `manual`, a real seed already boots. |
| `test medium` | e.g. `playwright`, `subprocess-cli`, `protocol-client`, `flutter-integration`, `playwright-electron` | The fixture family `system-test-runner` provisions for this surface. |
| `design track` | section reference into `docs/design-system.md` | The interface-type section that governs this surface's design vocabulary. |

A product with zero surface entries is legal: a headless API product's only surface *is* its protocol — register the protocol itself as an `agentic-protocol` surface, or leave the registry empty and let the core's contracts stand alone.

### 3. Capability Ledger

A capability × surface matrix. **Rows** are user-meaningful capabilities, named at bet validation — typically 1–3 per bet, coarse enough to stay readable, never per-endpoint (endpoints already have `docs/architecture/api/` promotion). Row keys follow `<bet-slug>/<capability-slug>` — stable, greppable, collision-free. **Columns** are the registry's surfaces. Each cell carries exactly one state:

| State | Meaning | Required payload |
|---|---|---|
| `delivered` | Shipped on this surface | the delivering bet's slug |
| `planned` | Will ship here; not yet | a bet ref or discovery-notes pointer |
| `omitted` | Deliberate decision not to ship here | one-line rationale |
| `n/a` | Capability does not apply to this surface | — |

`omitted` and `n/a` are distinct on purpose: `n/a` is structural (offline sync has no meaning on a stateless web client), `omitted` is a product choice a future bet may revisit. **An empty cell is the only illegal state once a capability row exists** — bet validation fills every column or the bet does not close. The ledger records decisions; it never nags toward 100% parity — admin tooling belongs on web only, offline mode belongs on mobile only, and the ledger's job is to say so on the record.

### The retired-column rule

When a surface's status moves to `retired`, its ledger column freezes: existing cells keep their last state as history, new capability rows fill the retired column `n/a` automatically, and tooling (`./dev surface status`, `groundwork-check`) excludes it from sync-backlog and staleness counts. A retired surface is history, not backlog.

---

## `--surfaces` Invocation Contract

Every generator or skill that invokes `system-test-runner` passes `--surfaces`: a JSON array of `{"slug", "medium", "reach"?}`, one entry per `active` surface in `.groundwork/surfaces.json`. `medium` is the surface's `testMedium`. `reach` is optional and medium-dependent:

- `playwright` / `protocol-client` — a static base URL, or omit it to let the runner discover the docker-compose service named after the slug.
- `subprocess-cli` — the launch command (a generated `cli-app` builds to `node services/<slug>/dist/cli.js`).
- `flutter-integration` / `playwright-electron` — omit `reach` entirely; these surfaces discover their own test-harness command (`npx nx run <slug>:test-integration` / `:smoke`) once the app is scaffolded.

This is the one statement of the flag's shape. Invokers (`groundwork-scaffold`, `groundwork-infra-adopt`, `groundwork-surface-activation`) cite this section and state only their own moment-specific delta — which surfaces to include, when to re-invoke, and what generator output (fixtures, etc.) results.

---

## Example — two active surfaces plus a retired one

```markdown
# Surfaces

## Capability Core

Hosted core: three Go services behind an HTTP gateway own ordering, inventory,
and notification logic. Contracts are OpenAPI 3.x, promoted to `docs/architecture/api/` at
bet validation. All capability behaviour is provable against these contracts
with no surface running.

## Surface Registry

### web-app

| Field | Value |
|---|---|
| type | graphical-ui |
| platform | web |
| status | active |
| core access | http-gateway |
| auth | session cookie via gateway |
| scaffold | nextjs-app |
| test medium | playwright |
| design track | docs/design-system.md § Graphical UI |

### admin-cli

| Field | Value |
|---|---|
| type | cli |
| platform | terminal |
| status | active |
| core access | http-direct (service tokens) |
| auth | API token |
| scaffold | cli-app |
| test medium | subprocess-cli |
| design track | docs/design-system.md § CLI |

### beta-dashboard

| Field | Value |
|---|---|
| type | graphical-ui |
| platform | desktop |
| status | retired |
| core access | http-gateway |
| auth | session cookie via gateway |
| scaffold | manual |
| test medium | — (retired) |
| design track | docs/design-system.md § Graphical UI |

## Capability Ledger

| Capability | web-app | admin-cli | beta-dashboard (retired) |
|---|---|---|---|
| `order-flow/place-order` | delivered (`order-flow`) | omitted — operators never place orders | delivered (`order-flow`) |
| `order-flow/order-status` | delivered (`order-flow`) | delivered (`order-flow`) | delivered (`order-flow`) |
| `bulk-ops/bulk-reprice` | omitted — admin tooling is CLI-only | delivered (`bulk-ops`) | n/a |
```

The `bulk-ops/bulk-reprice` row landed after `beta-dashboard` retired, so its retired column is `n/a` automatically; the two `order-flow` rows predate the retirement and keep their `delivered` history.

---

## Machine-readable twin: `.groundwork/surfaces.json`

Written and updated in the same commit as `docs/surfaces.md` — the two never disagree because both are projections of the same decisions. Read by `./dev surface status` and `groundwork-check`.

```json
{
  "schema": "groundwork.surfaces",
  "version": 1,
  "core": {
    "deployment": "hosted",
    "contractFormat": "openapi",
    "contractsPath": "docs/architecture/api/"
  },
  "surfaces": [
    {
      "slug": "web-app",
      "type": "graphical-ui",
      "platform": "web",
      "status": "active",
      "coreAccess": "http-gateway",
      "auth": "session cookie via gateway",
      "scaffold": "nextjs-app",
      "testMedium": "playwright",
      "designTrack": "graphical-ui"
    },
    {
      "slug": "admin-cli",
      "type": "cli",
      "platform": "terminal",
      "status": "active",
      "coreAccess": "http-direct",
      "auth": "API token",
      "scaffold": "cli-app",
      "testMedium": "subprocess-cli",
      "designTrack": "cli"
    },
    {
      "slug": "beta-dashboard",
      "type": "graphical-ui",
      "platform": "desktop",
      "status": "retired",
      "coreAccess": "http-gateway",
      "auth": "session cookie via gateway",
      "scaffold": "manual",
      "testMedium": null,
      "designTrack": "graphical-ui"
    }
  ],
  "capabilities": [
    {
      "key": "order-flow/place-order",
      "name": "Place an order",
      "cells": {
        "web-app": { "state": "delivered", "bet": "order-flow" },
        "admin-cli": { "state": "omitted", "rationale": "operators never place orders" },
        "beta-dashboard": { "state": "delivered", "bet": "order-flow" }
      }
    },
    {
      "key": "order-flow/order-status",
      "name": "Track order status",
      "cells": {
        "web-app": { "state": "delivered", "bet": "order-flow" },
        "admin-cli": { "state": "delivered", "bet": "order-flow" },
        "beta-dashboard": { "state": "delivered", "bet": "order-flow" }
      }
    },
    {
      "key": "bulk-ops/bulk-reprice",
      "name": "Bulk reprice inventory",
      "cells": {
        "web-app": { "state": "omitted", "rationale": "admin tooling is CLI-only" },
        "admin-cli": { "state": "delivered", "bet": "bulk-ops" },
        "beta-dashboard": { "state": "n/a" }
      }
    }
  ]
}
```

### Schema rules

- `core.deployment` — `"hosted"` or `"embedded"`. `core.contractFormat` — `"openapi"`, `"asyncapi"`, `"proto"`, or `"typed-module-api"`; a core with several boundary kinds lists the dominant one and the prose section carries the rest.
- `surfaces[].slug` is the join key everywhere: ledger cells, test fixtures (`surfaces["web-app"]`), pitch `surfaces:` frontmatter, decomposition slice `surface` fields. Slugs are kebab-case and never renamed — rename means retire + add.
- `surfaces[].testMedium` is `null` only for `planned` and `retired` surfaces; a `dormant` surface keeps its medium — recorded so reactivation knows the fixture family, exercised only while the surface is `active`; an `active` surface without a test medium is a `groundwork-check` finding.
- `capabilities[].cells` carries one entry per registry surface (including retired ones — frozen history or auto-`n/a` per the retired-column rule). A missing cell key is the machine form of the illegal empty cell.
- Cell payloads: `delivered` requires `bet`; `planned` requires `ref` (a bet slug or `discovery-notes` pointer); `omitted` requires `rationale`; `n/a` carries no payload.
- **Versioned contract.** `version` bumps only when the shape changes. Consumers ignore unknown fields. Keep changes additive.
- **One writer per moment, many readers.** Architecture (or architecture-extract) creates it; bet validation appends capability rows; surface activation appends surface entries and triages columns. `./dev surface status` and `groundwork-check` only read.
