# Partition Digest Schema

Every partition — whether scanned by a sub-agent (parallel) or in a sequential batch — yields exactly one digest in this shape. The schema is identical across both execution paths on purpose: a consumer reading a digest cannot tell, and must not need to tell, which path produced it.

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
  "theme_framework": ["Tailwind with class-strategy dark mode", "CSS modules", "lipgloss terminal rendering"],
  "interaction_a11y": ["aria labels on form components", "focus-visible ring convention", "prefers-reduced-motion variants", "i18n via locale files"],
  "product_signals": ["README value prop", "user-facing features inferred from routes"],
  "inferred_users": ["admin vs member roles in auth middleware", "onboarding copy addresses ops teams"],
  "licensing_signals": ["LICENSE (MIT)", "billing integration", "plan tiers in config"],
  "interface_type": "graphical-ui | cli | agentic-protocol | none",
  "risks_todos": ["TODO: replace polling with webhooks", "v1 client deprecated", "no OpenAPI spec for public routes"],
  "evidence_paths": ["file paths backing the claims above"]
}
```

## Field → Findings-File Routing

Route each field into the findings file its downstream consumer reads. A field can feed more than one file.

| Digest field | Findings file / section |
|---|---|
| `purpose` (product framing), `product_signals` | `scan/product-findings.md` → Value Proposition, User-Facing Capabilities |
| `inferred_users` | `scan/product-findings.md` → Inferred Users |
| `licensing_signals` | `scan/product-findings.md` → Licensing & Monetisation Signals |
| `design_tokens`, `ui_components` | `scan/design-findings.md` → Design Tokens, Component Library |
| `theme_framework` | `scan/design-findings.md` → Theme & Framework |
| `interaction_a11y` | `scan/design-findings.md` → Interaction & Accessibility Signals |
| `interface_type` | `scan/product-findings.md` → Product Surface; `scan/design-findings.md` → Interface Surfaces; `scan/architecture-findings.md` → Service / Partition Map (Surface column) |
| `purpose`, `entry_points`, `exported_surface` | `scan/architecture-findings.md` → Service / Partition Map, Entry Points |
| `external_contracts` | `scan/architecture-findings.md` → External Contracts |
| `data_models`, `persistence` | `scan/architecture-findings.md` → Data Models & Persistence |
| `dependencies` | `scan/architecture-findings.md` → Dependencies |
| `communication` | `scan/architecture-findings.md` → Communication Patterns |
| `infra_deployment` | `scan/architecture-findings.md` → Infrastructure & Deployment |
| `notable_patterns` | `scan/architecture-findings.md` → Notable Patterns |
| `risks_todos` | `scan/architecture-findings.md` → Risks & TODOs |
| `project_type`, repo shape | `scan/overview.md` → Parts, Partition Map |

`infra_deployment` is a distinct field, not a kind of contract — docker-compose, IaC, CI, and env examples have a guaranteed home so they are never lost between the contract and dependency slots.

The audience- and surface-facing fields read from predictable places. `inferred_users` is who the partition appears built for — the auth model (roles, permission tiers, tenancy), user-facing copy, and the shape of admin versus consumer routes; record it as inference, never as fact. `licensing_signals` comes from LICENSE files, package-manifest license metadata, and anything monetisation-shaped: billing integrations, plan tiers, paywall gates. `theme_framework` names the UI framework and styling approach — Tailwind, CSS-in-JS, CSS modules, a terminal rendering library — plus dark-mode handling; `design_tokens` holds the token sources themselves, `theme_framework` holds how the surface is styled. `interaction_a11y` records the interaction and accessibility posture visible in components: ARIA usage, focus and keyboard handling, motion and reduced-motion conventions, i18n setup. A backend partition legitimately leaves most of these empty — an empty field is itself a finding, and the extract phases interview for what no partition surfaced.

When `external_contracts` is empty for a partition that exposes routes, record the absence in `risks_todos` as a missing-contract gap. The architecture extract phase promotes it to a blocks-delivery entry in the gap ledger — the contract-driven bet loop depends on machine-readable contracts.

Every partition whose `interface_type` is not `none` is an **interface surface**, and the findings record all of them — a repo can carry a web app and a CLI, and each gets its own line in both destinations. The design extract recovers a design section per surface type and the architecture extract writes the surface registry from these lines; a surface dropped here never reaches either.
