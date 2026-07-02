# Phase 1: Ingestion & Service Mapping

Read `docs/architecture/index.md` to identify every service, database, and messaging component the system requires. This document is the source of truth for what needs to be built.

Read `.groundwork/config/generators.json` to discover the available generators. Then read the schema for each generator relevant to the architecture — schemas define the full parameter space (authentication models, messaging integrations, WebSocket support, database inclusion) and understanding them before mapping ensures each generator is configured correctly.

Also read `.groundwork/config/config.toml` if it exists: entries under `[defaults.generators]` (flags keyed by generator name) and `[defaults]` (llm_provider, llm_model) are the user's standing preferences. Fold them into the mapping proposal as the configured starting position — named as coming from their config, never silently applied, and overridden without ceremony when the architecture demands it.

With the architecture and schemas in hand, **propose the full service-to-generator mapping in a single structured pass** — one row per service with the generator choice, key parameters, and a one-line rationale. Proposing everything at once exposes cross-service inconsistencies that per-service interrogation hides, and lets the user react to the complete picture rather than approving one service at a time.

For each service in the proposal:
- Identify which generator produces this service.
- Determine the parameters from the architecture's capability decisions: authentication model, messaging integration, WebSocket requirement. Use the Generator Capability Mapping below to translate architectural language into specific flag values — architecture documents are written in vendor-neutral capability terms, and the generators are flag-driven, so an explicit translation table is the contract between the two.
- Derive a service name that follows the architecture's naming conventions.

Planning ends before execution begins because running generators from a partially-confirmed plan generates services that don't match the architecture — fixing generated code is harder than correcting a mapping. Once every service is confirmed, write the complete execution plan to `scaffold-cache.md` — every generator command in order with all parameters — and get final approval for the full plan before proceeding. Mark the Ingestion & Service Mapping phase complete in `scaffold-cache.md`.

Count the services in `docs/architecture/index.md`, count the confirmed mappings, and verify they match before closing Phase 1.

**Surfaces:** Read the surface registry — `docs/surfaces.md` and its machine twin `.groundwork/surfaces.json` — when it exists. The registry, not the design system, decides what gets scaffolded and how it gets tested, because the architecture phase already settled each surface's scaffold target and test medium there. Each `active` surface drives two mapping decisions:

- **Scaffold target.** A surface whose `scaffold` field names a generator (`nextjs-app`, `cli-app`, `flutter-app`, `electron-app`) gets its own generator invocation in the execution plan, named by its slug. A `scaffold: forged` surface gets no generator invocation either — `groundwork-stack-forge` builds its seed directly (see the unsupported-stack options below) — but it joins the test fixtures via `--surfaces` like any other surface. A `scaffold: manual` surface gets no generator invocation — the registry never blocks on tooling — but the execution plan still records its three obligations: an entry in `docs/architecture/infrastructure.md`'s Surfaces group (Phase 5), registration in the test fixtures via the `--surfaces` entry below, and an operational-expectations note stating what the manual implementation must meet to keep that registration honest — a health endpoint, `./dev` integration, and a reach value the fixtures can use.
- **Test medium.** Run `system-test-runner` once, passing every active surface in `--surfaces` (flag shape and `reach` rules: `.groundwork/skills/surfaces-contract.md` § `--surfaces` Invocation Contract). The generator emits a session `surfaces` fixture keyed by slug plus one runner fixture per surface — `<slug>_page` (`playwright`), `<slug>_runner` (`subprocess-cli`, and `flutter-integration`/`playwright-electron`, where it drives the app's own integration_test or Playwright `_electron` suite as a subprocess through the app's toolchain guard), `<slug>_client` (`protocol-client`) — and includes `pytest-playwright` whenever a `playwright` surface is present. A medium with no fixture family is registered in the `surfaces` fixture and nothing more; its tests arrive with its tooling.

**When no registry exists**, the project predates it — behave exactly as before: read `docs/design-system.md`, identify the single interface track (`graphical-ui`, `cli`, or `agentic-protocol`), and pass it as `--interfaceMedium`, the deprecated single-surface alias. That flag alone determines whether `pytest-playwright` and the `frontend_base_url` fixture are generated. Browser-driven interface proof is fully supported for `graphical-ui`; for `cli` and `agentic-protocol`, bet-progress tests use `subprocess`/HTTP against the running endpoint (no shared fixture is generated — write those tests against bare `subprocess`/HTTP).

**Capability registry:** Read the capability-ports registry — `.groundwork/capability-ports.json` and its prose twin `docs/architecture/index.md` §3 — when it exists. It records each technical capability → provider → footprint the architecture settled, and it is the authority for *which infrastructure exists and why*: infrastructure is a consequence of a provider's footprint, never a scaffold default. Map each entry to an action:

- A provider with an `env` / `compose-service` / `runner` footprint becomes a generator flag on the service that owns the capability (e.g. `python-microservice --llm --llmProvider anthropic`, `--postgres`) — or, when the service is already scaffolded, an `add-capability --service <slug> --capability <c> --provider <p>` invocation in the plan.
- A provider of `none` is the **bare interface**: scaffold it with `--provider none` (or `add-capability ... --provider none`) so the service gets the interface, a not-yet-implemented stub, and a strict-xfail contract test — the provider is a bet, recorded in the hand-off as the first delivery's work. Add no infrastructure for a `none` capability.

A capability whose provider the available generators cannot produce is the reversal path below, not a silent substitution. When no registry exists, the project predates it — derive capabilities from the architecture prose as before.

**Generator Capability Mapping.** Architecture documents are written in vendor-neutral capability terms; the generators are flag-driven. This is the one place to update when generator flags evolve — when a new flag ships, add a row under its generator; when one is removed, delete it.

**`go-microservice`** — Go API with PostgreSQL, optional auth and messaging.

| Architectural decision | Flag |
|---|---|
| End-user authentication via Clerk | `--auth clerk` |
| Service-to-service authentication | `--auth service` |
| No authentication required | `--auth none` (or omit `--auth`) |
| Transactional outbox via Kafka | `--messaging kafka` |
| Transactional outbox via GCP Pub/Sub | `--messaging gcp-pubsub` |
| WebSocket real-time delivery | `--websockets` |

**`python-microservice`** — Python FastAPI service, optional PostgreSQL and messaging.

| Architectural decision | Flag |
|---|---|
| REST surface | `--rest` |
| PostgreSQL | `--postgres` |
| Transactional outbox via Kafka | `--messaging kafka` |
| Transactional outbox via GCP Pub/Sub | `--messaging gcp-pubsub` |
| Lightweight pub/sub via Redis | `--messaging redis` |
| WebSocket real-time delivery | `--websockets` |
| LLM integration | `--llm --llmProvider <openai\|anthropic\|local>` (default `openai`; `local` = self-hosted OpenAI-compatible endpoint) |
| LLM as a bare interface / undecided provider (a bet) | `--llm --llmProvider none` |
| GPU inference on RunPod | `--runpod` |

**`nextjs-app`** — Next.js frontend with App Router.

| Architectural decision | Flag |
|---|---|
| End-user authentication via Clerk | `--auth clerk` |
| No authentication required | `--auth none` (or omit `--auth`) |
| Frontend → backend API proxy | `--apiProxy` |
| WebSocket real-time delivery | `--websockets` |

**`cli-app`** — Branded Node+TypeScript command-line application, themed from `brand-tokens.json`; standalone by default, or a frontend for workspace services with `--core`.

| Architectural decision | Flag |
|---|---|
| Command-line application as the product, or a CLI surface for a service | `--name <name>` |
| Interactive/REPL paradigm the design system specified | `--repl` |
| CLI fronts workspace services (registry access path is http-direct) | `--core` (scaffolds the core-access seam and the `status` wiring-proof command; omit for a standalone tool) |

**`flutter-app`** — Flutter mobile app (official MVVM architecture, Riverpod, go_router), themed from `brand-tokens.json`; pubspec-based, wires into Nx via run-commands targets, never joins docker-compose.

| Architectural decision | Flag |
|---|---|
| Mobile surface (registry `platform: mobile`) | `--name <slug>` (`--org` sets the reverse-domain bundle-id prefix, default `com.example`) |

**`electron-app`** — Electron desktop app (hardened main/preload/renderer split, typed IPC, React + Tailwind renderer), themed from `brand-tokens.json`; wires into Nx via run-commands targets, never joins docker-compose.

| Architectural decision | Flag |
|---|---|
| Desktop surface (registry `platform: desktop`) | `--name <slug>` (`--org` sets the reverse-domain app-id prefix, default `com.example`; the Electron binary downloads at bootstrap, and the boot smoke needs a display — xvfb on Linux CI) |

**`system-test-runner`** — Docker Compose test topology and system test suite.

| Architectural decision | Flag |
|---|---|
| Docker Compose test topology (surface registry present) | `--surfaces '<JSON array of {slug, medium, reach?} from .groundwork/surfaces.json>'` |
| Docker Compose test topology (no registry — single interface type) | `--interfaceMedium <graphical-ui\|cli\|agentic-protocol>` (deprecated single-surface alias, default `graphical-ui`) |

**`docs-site`** — Fumadocs documentation site that serves the live `docs/` tree (product brief, architecture, bets) with H1-derived titles; registers as a native `./dev` runner (`pnpm dev`, not autostarted), never joins docker-compose.

| Architectural decision | Flag |
|---|---|
| Fumadocs documentation site | `--name <slug>` |

**`add-capability`** — adds a capability interface + provider implementation (or a bare `none` interface) to an already-scaffolded service; Day-2 / inside a bet.

| Architectural decision | Flag |
|---|---|
| Add a capability to an already-scaffolded service | `--service <slug> --capability <c> --provider <p>` (`--stack` auto-detected) |

`workspace-dev-cli` is handled in initialization and does not appear in service mapping.

**When the generators cannot honour an architecture decision.** This is common and expected: the architecture may have chosen a vendor, language, or topology the available generators do not produce (e.g. a TypeScript backend when only Go/Python exist, a native macOS AppKit app, Supabase auth when only Clerk is wired). Surface the genuine trade-off to the user as a single decision (Protocol 4) with three honest options:

1. **Reverse onto a supported stack.** Adopt the generator's path. This almost always *reverses* an architecture Key Decision or supersedes an ADR — a **reversal** under Protocol 2, not a refinement. At commit (Phase 6) follow the Reversal Protocol in full: reconcile the architecture *body* (not just its summary), reconcile every dependent doc the reversal touches — the domain entity docs (`Owner:`, fields), service docs, infrastructure — write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc. The committed architecture must describe the system you actually scaffolded, with no residue of the abandoned one.
2. **Forge it.** Keep the chosen stack and build a first-class starting point for it: **load and run `.groundwork/skills/groundwork-stack-forge/instructions.md`.** It researches the stack, authors a self-contained engineer skill, builds a Day-2 seed wired into `./dev`, and writes a Day-2 checklist into the hand-off for MVP. This is the path that keeps GroundWork worth using off the paved road — reach for it when the stack choice is deliberate and the team will keep building in it. The forged seed becomes the service/surface in this mapping; record it in the execution plan like any other unit.
3. **Hand-roll manually.** Record the surface as `scaffold: manual` with its operational obligations (a health signal, `./dev` integration, a test reach), and leave the implementation to the team with no scaffolding support. Choose this only when the component is throwaway or the team explicitly wants no help — otherwise option 2 serves them better.

Take the user's call; never silently substitute a default the architecture did not choose.

**LLM provider: scaffold the boilerplate, hand the integration to the bet.** The `--llm` flag produces a generic LLM client, not a finished integration — be precise with the user about the boundary:

- **What it scaffolds:** a single `generate_text` call behind the text-generation interface, with retries and a circuit breaker, targeting the SDK `--llmProvider` names.
- **What stays bet/MVP work:** prompt caching a large shared context, streaming responses, structured outputs, a moderation/safety gate, and tool use. Record these in the scaffold hand-off as work the first bet must build, and say so plainly when presenting the scaffold.
- **Never describe the generated client as "provider-agnostic"** or imply it already satisfies an architectural capability it only stubs — an honest "the LLM client is scaffolded; prompt caching and streaming are bet work" is worth more than a green checkmark that papers over the gap. If the architecture's provider is a real vendor the flag does not offer, that is the reversal path above, not a silent substitution to whatever the generator defaults to.

**Offer a documentation site (optional, default off).** Independent of the architecture's services, offer the user a browsable site for the project's own `docs/` — product brief, architecture, and the bets as they land. Present it once as a single optional decision (Protocol 4), **default to skipping it**, and frame it plainly: "a local site to browse your docs and bets; not part of the running product." If they accept, add `docs-site --name docs` to the execution plan — it registers as a native `./dev` runner and shows up in `infrastructure.md`'s footprint matrix like any other managed unit (Phase 5). If they decline, add nothing and say nothing further. The docs site is a developer affordance, never inferred from the architecture and never a service the architecture must justify.
