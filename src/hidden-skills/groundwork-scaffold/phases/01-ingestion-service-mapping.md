# Phase 1: Ingestion & Service Mapping

Read `docs/architecture.md` to identify every service, database, and messaging component the system requires. This document is the source of truth for what needs to be built.

Read `.groundwork/config/generators.json` to discover the available generators. Then read the schema for each generator relevant to the architecture — schemas define the full parameter space (authentication models, messaging integrations, WebSocket support, database inclusion) and understanding them before mapping ensures each generator is configured correctly.

Also read `.groundwork/config/config.toml` if it exists: entries under `[defaults.generators]` (flags keyed by generator name) and `[defaults]` (llm_provider, llm_model) are the user's standing preferences. Fold them into the mapping proposal as the configured starting position — named as coming from their config, never silently applied, and overridden without ceremony when the architecture demands it.

With the architecture and schemas in hand, **propose the full service-to-generator mapping in a single structured pass** — one row per service with the generator choice, key parameters, and a one-line rationale. Proposing everything at once exposes cross-service inconsistencies that per-service interrogation hides, and lets the user react to the complete picture rather than approving one service at a time.

For each service in the proposal:
- Identify which generator produces this service.
- Determine the parameters from the architecture's capability decisions: authentication model, messaging integration, WebSocket requirement. Use the Generator Capability Mapping below to translate architectural language into specific flag values — architecture documents are written in vendor-neutral capability terms, and the generators are flag-driven, so an explicit translation table is the contract between the two.
- Derive a service name that follows the architecture's naming conventions.

Planning ends before execution begins because running generators from a partially-confirmed plan generates services that don't match the architecture — fixing generated code is harder than correcting a mapping. Once every service is confirmed, write the complete execution plan to `scaffold-cache.md` — every generator command in order with all parameters — and get final approval for the full plan before proceeding. Mark the Service Mapping phase complete in `scaffold-cache.md`.

Count the services in `docs/architecture.md`, count the confirmed mappings, and verify they match before closing Phase 1.

**Surfaces:** Read the surface registry — `docs/surfaces.md` and its machine twin `.groundwork/surfaces.json` — when it exists. The registry, not the design system, decides what gets scaffolded and how it gets tested, because the architecture phase already settled each surface's scaffold target and test medium there. Each `active` surface drives two mapping decisions:

- **Scaffold target.** A surface whose `scaffold` field names a generator (`nextjs-app`, `cli-app`, `flutter-app`, `electron-app`) gets its own generator invocation in the execution plan, named by its slug. A `scaffold: manual` surface gets no generator invocation — the registry never blocks on tooling — but the execution plan still records its three obligations: an entry in `docs/infrastructure.md`'s Surfaces group (Phase 5), registration in the test fixtures via the `--surfaces` entry below, and an operational-expectations note stating what the manual implementation must meet to keep that registration honest — a health endpoint, `./dev` integration, and a reach value the fixtures can use.
- **Test medium.** Run `system-test-runner` once, passing every active surface in `--surfaces`: a JSON array of `{"slug", "medium", "reach"?}` where `medium` is the surface's registry `testMedium` and `reach` is a static base URL (`playwright`/`protocol-client` surfaces — omit it to discover the docker-compose service named after the slug) or the launch command for a `subprocess-cli` surface (a generated `cli-app` builds to `node services/<slug>/dist/cli.js`); `flutter-integration` and `playwright-electron` surfaces omit it — their reach is the app's own test-harness command, discovered as `npx nx run <slug>:test-integration` / `npx nx run <slug>:smoke` once `services/<slug>` is scaffolded. The generator emits a session `surfaces` fixture keyed by slug plus one runner fixture per surface — `<slug>_page` (`playwright`), `<slug>_runner` (`subprocess-cli`, and `flutter-integration`/`playwright-electron`, where it drives the app's own integration_test or Playwright `_electron` suite as a subprocess through the app's toolchain guard), `<slug>_client` (`protocol-client`) — and includes `pytest-playwright` whenever a `playwright` surface is present. A medium with no fixture family is registered in the `surfaces` fixture and nothing more; its tests arrive with its tooling.

**When no registry exists**, the project predates it — behave exactly as before: read `docs/design-system.md`, identify the single interface track (`graphical-ui`, `cli`, or `agentic-protocol`), and pass it as `--interfaceMedium`, the deprecated single-surface alias. That flag alone determines whether `pytest-playwright` and the `frontend_base_url` fixture are generated. Browser-driven interface proof is fully supported for `graphical-ui`; for `cli` and `agentic-protocol`, bet-progress tests use `subprocess`/HTTP against the running endpoint (no shared fixture is generated — write those tests against bare `subprocess`/HTTP).

**Generator Capability Mapping:**

| Architectural decision | Generator + flag |
|---|---|
| End-user authentication via Clerk | `nextjs-app --auth clerk`, `go-microservice --auth clerk` |
| Service-to-service authentication | `go-microservice --auth service` |
| No authentication required | `--auth none` (or omit `--auth`) |
| Transactional outbox via Kafka | `--messaging kafka` |
| Transactional outbox via GCP Pub/Sub | `--messaging gcp-pubsub` |
| Lightweight pub/sub via Redis (Python only) | `python-microservice --messaging redis` |
| WebSocket real-time delivery | `--websockets` |
| Frontend → backend API proxy | `nextjs-app --apiProxy` |
| Command-line application as the product (or a CLI surface for a service) | `cli-app --name <name>` (add `--repl` when the design system specified an interactive/REPL paradigm) |
| Mobile surface (registry `platform: mobile`) | `flutter-app --name <slug>` (never joins docker-compose; the Flutter SDK is a runtime prerequisite, not a generation one) |
| Desktop surface (registry `platform: desktop`) | `electron-app --name <slug>` (never joins docker-compose; the Electron binary downloads at bootstrap, and the boot smoke needs a display — xvfb on Linux CI) |
| LLM integration (Python service) | `python-microservice --llm --llmProvider <openai\|anthropic>` (default `openai`) |
| GPU inference on RunPod (Python service) | `python-microservice --runpod` |
| PostgreSQL on a Python service | `python-microservice --postgres` |
| REST surface on a Python service | `python-microservice --rest` |
| Docker Compose test topology (surface registry present) | `system-test-runner --surfaces '<JSON array of {slug, medium, reach?} from .groundwork/surfaces.json>'` |
| Docker Compose test topology (no registry — single interface type) | `system-test-runner --interfaceMedium <graphical-ui\|cli\|agentic-protocol>` |
| Fumadocs documentation site | `docs-site --name <slug>` |

This table is the one place to update when generator flags evolve. When a new flag ships, add a row here; when a flag is removed, delete the row. The mapping is the contract between architecture's vocabulary and scaffold's execution — keep it current.

**When the generators cannot honour an architecture decision.** This is common and expected: the architecture may have chosen a vendor, language, or topology the available generators do not produce (e.g. a TypeScript backend when only Go/Python exist, or Supabase auth when only Clerk is wired). Surface the genuine product trade-off to the user as a single decision (Protocol 4), take their call, then recognise what you are doing to the docs: **adopting the generator's path almost always *reverses* an architecture Key Decision or supersedes an ADR.** That makes it a **reversal** under Protocol 2 — not a refinement. At commit (Phase 6) you must follow the Reversal Protocol in full: reconcile the architecture *body* (not just its summary), reconcile every dependent doc the reversal touches — the domain entity docs (`Owner:`, fields), service docs, infrastructure — write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc. The committed architecture must describe the system you actually scaffolded, with no residue of the abandoned one.

**LLM provider: scaffold the boilerplate, hand the integration to the bet.** When the architecture names an LLM provider, map it to `--llmProvider` (`openai` or `anthropic`) so the generated gateway targets the right SDK and a sensible default model from the start. But be precise about what the generator delivers and what it does not. The `--llm` flag produces a *generic gateway*: a single `generate_text` call behind the abstract `LLMGateway` port, with retries and a circuit breaker. It does **not** implement the provider-specific behaviour an architecture usually depends on — prompt caching a large shared context, streaming responses, structured outputs, a moderation/safety gate, or tool use. Those are **bet/MVP development work**, not scaffold output. Record them in the scaffold hand-off as work the first bet must build, and say so plainly when presenting the scaffold. Never describe the generated gateway as "provider-agnostic" or imply it already satisfies an architectural capability it only stubs — an honest "the gateway is scaffolded; prompt caching and streaming are bet work" is worth more than a green checkmark that papers over the gap. If the architecture's provider is not one the flag offers, that is the reversal path above, not a silent substitution to whatever the generator defaults to.

**Generator availability:**

| Generator | What it produces | Key parameters |
|---|---|---|
| `go-microservice` | Go API with PostgreSQL, optional auth and messaging | `--name`, `--auth` (none/service/clerk), `--messaging` (none/kafka/gcp-pubsub), `--websockets` |
| `python-microservice` | Python FastAPI service, optional PostgreSQL and messaging | `--name`, `--rest`, `--postgres`, `--messaging` (none/redis/kafka/gcp-pubsub), `--websockets`, `--llm`, `--llmProvider` (openai/anthropic, default openai), `--runpod` |
| `nextjs-app` | Next.js frontend with App Router | `--name`, `--auth` (none/clerk), `--apiProxy`, `--websockets` |
| `cli-app` | Branded Node+TypeScript command-line application, themed from `brand-tokens.json` | `--name`, `--repl` (scaffold the interactive REPL layer) |
| `flutter-app` | Flutter mobile app (official MVVM architecture, Riverpod, go_router), themed from `brand-tokens.json`; pubspec-based — wires into Nx via run-commands targets, never joins docker-compose | `--name`, `--org` (reverse-domain bundle id prefix, default `com.example`) |
| `electron-app` | Electron desktop app (hardened main/preload/renderer split, typed IPC, React + Tailwind renderer), themed from `brand-tokens.json`; wires into Nx via run-commands targets, never joins docker-compose | `--name`, `--org` (reverse-domain app id prefix, default `com.example`) |
| `system-test-runner` | Docker Compose test topology and system test suite | `--surfaces` (JSON array of `{slug, medium, reach?}` from the surface registry), `--interfaceMedium` (deprecated single-surface alias: graphical-ui/cli/agentic-protocol, default: graphical-ui) |
| `docs-site` | Fumadocs-powered documentation site | `--name` |

`workspace-dev-cli` is handled in initialization and does not appear in service mapping.
