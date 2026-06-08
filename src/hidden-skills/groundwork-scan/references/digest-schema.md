# Partition Digest Schema

Every partition — whether scanned by a sub-agent (parallel) or in a sequential batch — yields exactly one digest in this shape. The schema is identical across both execution paths on purpose: the evaluation harness can only exercise the sequential path, so an identical output contract is what lets it certify the parallel path it cannot run.

**Every field is bounded.** Lists cap at ~12 items, each ≤20 words; strings cap at ~3 sentences. This bound is the lever that keeps the parent context lean at full fan-out and keeps each sequential batch's footprint small. A digest is the *interpreted* result of reading files — never raw file contents, never a file dump.

```json
{
  "partition_id": "api",
  "root_path": "services/api",
  "project_type": "go-service | nextjs-app | python-service | cli | library | ...",
  "purpose": "≤3 sentences: what this partition does and why it exists",
  "entry_points": ["cmd/server/main.go"],
  "exported_surface": ["public packages, exported modules, or HTTP routes"],
  "external_contracts": [
    {"kind": "openapi | asyncapi | protobuf | graphql | route-file | none", "path": "api/openapi.yaml"}
  ],
  "data_models": [{"name": "User", "source": "schema.prisma | migrations/0003.sql | models.py"}],
  "persistence": ["postgres via migrations/", "redis"],
  "infra_deployment": ["docker-compose.yml", "terraform/", ".github/workflows/ci.yml", ".env.example"],
  "dependencies": {"internal": ["services/auth"], "external": ["stripe-go", "nats.go"]},
  "communication": ["sync HTTP -> auth", "async publish order.created -> nats"],
  "notable_patterns": ["hexagonal layering", "transactional outbox"],
  "design_tokens": ["tailwind.config.ts", "tokens.css"],
  "ui_components": ["components/ui/* (shadcn)", "design-system package"],
  "product_signals": ["README value prop", "user-facing features inferred from routes"],
  "interface_type": "graphical-ui | cli | agentic-protocol | none",
  "risks_todos": ["TODO: replace polling with webhooks", "v1 client deprecated", "no OpenAPI spec for public routes"],
  "evidence_paths": ["file paths backing the claims above"]
}
```

## Field → Findings-File Routing

Route each field into the findings file its downstream consumer reads. A field can feed more than one file.

| Digest field | Findings file / section |
|---|---|
| `purpose` (product framing), `product_signals` | `scan/product-findings.md` |
| `design_tokens`, `ui_components`, `interface_type` | `scan/design-findings.md` |
| `purpose`, `entry_points`, `exported_surface` | `scan/architecture-findings.md` → Service Map, Entry Points |
| `external_contracts` | `scan/architecture-findings.md` → External Contracts |
| `data_models`, `persistence` | `scan/architecture-findings.md` → Data Models & Persistence |
| `dependencies` | `scan/architecture-findings.md` → Dependencies |
| `communication` | `scan/architecture-findings.md` → Communication Patterns |
| `infra_deployment` | `scan/architecture-findings.md` → Infrastructure & Deployment |
| `notable_patterns` | `scan/architecture-findings.md` → Notable Patterns |
| `risks_todos` | `scan/architecture-findings.md` → Risks & TODOs |
| `project_type`, repo shape | `scan/overview.md` → Parts, Partition Map |

`infra_deployment` is a distinct field, not a kind of contract — docker-compose, IaC, CI, and env examples have a guaranteed home so they are never lost between the contract and dependency slots.

When `external_contracts` is empty for a partition that exposes routes, record the absence in `risks_todos` as a missing-contract gap. The architecture extract phase promotes it to a blocks-delivery entry in the gap ledger — the contract-driven bet loop depends on machine-readable contracts.
