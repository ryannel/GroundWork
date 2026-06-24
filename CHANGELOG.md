# Changelog

All notable changes to GroundWork are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/). Entries that require action when upgrading an
existing installation are prefixed `[migration]` — `npx groundwork update` surfaces them
automatically when it detects a version jump.

## [Unreleased]

### Changed (the docs site routes two audiences and orders its sidebar as a learning journey, 2026-06-24)

The scaffolded docs site opened on an undifferentiated link dump and rendered its canonical docs as a flat eleven-item sidebar. It now greets two audiences and reads as a product-learning journey. The architecture docs nest under one section, and a skill-authored getting-started on-ramp gives a fresh-clone developer a real front door.

- **Two-audience landing.** `app/page.tsx` keeps the brand hero, then offers two on-ramps over the section grid — "new here — get it running" → `docs/getting-started`, and "understand the product" → `docs/product-brief`. Each card renders only when its target doc exists (a route-existence guard over `source.getPages()`), so a half-populated scaffold degrades gracefully instead of linking to a 404.
- **Product-learning sidebar order.** `seedDocsMeta` orders the top level product-brief → design-system → architecture → ways-of-working → getting-started → bets → … → principles (sunk last and collapsed). Architecture is now a nested folder ordered by a seeded `docs/architecture/meta.json` (index → infrastructure → domain → services → api → decisions), and getting-started by `docs/getting-started/meta.json` (index → setup → dev-cli-reference). Each sub-meta is seeded only when absent, so a hand-tuned project is never clobbered.
- **Nested architecture docs.** `docs/architecture.md` becomes `docs/architecture/index.md`, and `infrastructure.md`, `domain/`, `services/`, `api/`, and `decisions/` move under `docs/architecture/`. The authoring skills (architecture, architecture-extract, scaffold, infra-adopt) and every live cross-reference across the skill corpus, review checklists, orchestrator, and `./dev` now point at the nested paths; the two raw `cat > docs/architecture/index.md` assemble steps gained a `mkdir -p` guard.
- **Skill-authored getting-started on-ramp.** `groundwork-scaffold` (greenfield) and `groundwork-infra-adopt` (brownfield) now author `docs/getting-started/{index,setup,dev-cli-reference}.md` — a routing index, a fresh-clone setup walkthrough (prerequisites → `./dev doctor` → install dependencies → `./dev start`, the content `infrastructure.md` never carried), and a `./dev` command reference derived from `./dev help`. `infrastructure.md` slims to the running-system shape plus the canonical three commands and a pointer to the on-ramp.
- **Docs-uplift target state.** `groundwork-docs-uplift` T4/T5 are rewritten to the nested order and two-audience landing, and route existing flat-layout sites through the migration first.
- [migration] Existing installs carry the flat architecture layout (`docs/architecture.md`, `docs/infrastructure.md`, `docs/domain/`, `docs/services/`, `docs/api/`, `docs/decisions/`); they are relocated under `docs/architecture/` with `architecture.md` becoming `index.md`, the sidebar metas rewritten, and live cross-references carried forward (gw-nest-architecture-docs)

### Changed (the bet test-suite SHA seal is replaced by a documented-vs-actual reconciliation, 2026-06-23)

The sealed test manifest (`./dev bet sign` writing a SHA-256 `test-manifest.json`, and `./dev test bet` refusing a "tampered" suite) is removed. It hashed the *test files* while the user actually approved the *doc* (`test-review.md`), caught only the crudest cheat (editing a test file) while being blind to implementation-gaming, was applied uniformly against the project's own "proportionality, not ceremony" principle, and in projects without the dev CLI degraded to a hand-written manifest nothing ever verified. The protective intent — an approved test is the fixed definition of done, changing one is a deliberate decision — is kept, but enforced by the artifacts that already exist.

- **Approval commit replaces the seal.** At Decomposition close the agent commits the approved `tests/bets/<slug>/` together with `docs/bets/<slug>/test-review.md` and records that commit's SHA as `approval_commit` in `decomposition.json`. The commit is the signature and the git baseline.
- **Delivery reconciliation replaces the hash gate.** The per-slice review (and a once-over at Validation) reconciles the documented assertions (verbatim in `test-review.md`) against the code and against `git log <approval_commit>..HEAD -- tests/bets/<slug>/`: any test change not paired with an approved amendment is a finding. The existing Acceptance auditor lens additionally owns *honest green* — implementation gamed to the test (hardcoded returns, special-cased inputs, test-only branches) is a finding even when the suite passes.
- **`./dev bet sign` is removed**; `./dev bet status` and `./dev test bet` are unchanged except that `test bet` no longer runs a seal check before pytest.
- [migration] Existing installs carry orphaned `.groundwork/bets/*/test-manifest.json` seal files; the obsolete `bet sign` command goes away with the dev-bundle update, and the stray manifests are deleted (gw-drop-test-manifest)

### Added (docs site is branded, draws diagrams, and orders its own sidebar, 2026-06-23)

The scaffolded Fumadocs site (`docs-site` generator) consumed none of the brand system GroundWork already generates, drew no diagrams, and rendered its sidebar in raw filesystem order patched by a JS hack. It now wears the project's brand, renders Mermaid client-side, orders the canonical doc set declaratively, and opens on a generated landing instead of a redirect (plan: `docs/plans/docs-quality-uplift.md`, WS-F + WS-G).

- **Shared brand projection.** The brand-token projection (`resolveVisual`, the `ResolvedVisual` type, the colour/length validators, and the neutral/role constants) is extracted from `nextjs-app` into `src/generators/shared/brand-tokens.ts`; both generators import it. The nextjs-app emitted `app/brand.css` is byte-identical — only the import path moved.
- **Branded docs theme.** `docs-site` projects the brand palette onto Fumadocs v14's `--fd-*` theme variables (HSL channel triplets) in a generated `app/brand.css`, adds an `app/docs.css` typography sheet (≈68ch measure, 1.6 line-height, an explicit h1–h4 scale), and wires the brand font + wordmark in `app/layout.tsx`. With no `brand-tokens.json`, neither file is emitted and `layout.tsx` imports nothing extra — the unbranded site is the stock Fumadocs starter, unchanged.
- **Client-side Mermaid.** A small remark transform in `source.config.ts` rewrites each fenced ` ```mermaid ` block into a `<Mermaid chart="…" />` node, and a `Mermaid` client component (`mermaid` added to deps, passed via the docs page's MDX components map) renders it in the browser, re-rendering on light/dark toggle. `rehype-mermaid` is deliberately avoided — it transitively imports `mermaid-isomorphic` → `playwright`, so merely importing it makes `next build`/codegen require Playwright even when nothing renders at build. This keeps `next build` Playwright-free and unable to fail on a diagram, while the same plain-Markdown block GitHub renders natively, so content stays dual-render.
- **Declarative sidebar order + branded landing.** The generator seeds `docs/meta.json` ordering the canonical set (product-brief → … → principles, with principles sunk last and collapsed via `docs/principles/meta.json`); the `betsFirst()` JS hack in `app/docs/layout.tsx` is retired. `app/page.tsx` is now a brand-driven hero + section cards derived live from the doc tree, with the existing `/docs` index as the fallback. `tsconfig.json` gains `target: ES2017`, fixing a pre-existing docs-site type-check failure on `Map` iteration.
- **New `groundwork-docs-uplift` maintenance skill.** The companion to the generator: it brings an *existing* doc site — one that predates the branding, was hand-built, or has drifted — to the same target state (brand theme, rendered diagrams, ordered nav, landing page), and gives the docs a reader-first pass that strips any leftover `## Summary for Downstream` residue. Routed from the orchestrator's anytime lane.
- [no-migration] The docs site is generator-produced (Tier 3); existing installs regenerate it through the normal upgrade path and pick up the branding, diagrams, and ordering — no dedicated migration step is required. The new skill clean-installs like every framework skill. The seeded `docs/meta.json` is Tier-2 sidebar config that lands in the project tree on regeneration (and is never clobbered if the project has hand-tuned it); GitHub and agents ignore it, so the docs/ tree stays effectively content-pristine.

### Changed (setup context split out of published docs/, 2026-06-23)

GroundWork's setup flows produced one artifact serving two masters: the cross-phase `## Summary for Downstream` block the *flow* reads, and the product documentation a reader needs — both crammed atop every `docs/*.md`, which made the published docs read as a report-out of the setup conversation. The two are now separate. Each setup phase writes its cross-phase contract to a temporary `.groundwork/context/<phase>.md` store; published `docs/` carry only clean reference documentation.

- **The Downstream Context store (Protocol 5).** The four-subsection contract (Key Decisions / Binding Constraints / Deferred Questions / Out of Scope) moves to `.groundwork/context/<phase>.md`, read by downstream setup phases. Published setup docs no longer open with a `## Summary for Downstream` section. The writer skill, every setup-phase commit, and the review checklists follow.
- **Setup Graduation (Protocol 10).** The context store is scaffolding, not a ledger: at the setup→delivery transition the orchestrator graduates every still-binding decision into a `docs/decisions/` ADR, reconciles the rest into `docs/`, then tears the store down. By the end of setup everything durable lives in `docs/`; nothing setup-only remains.
- [migration] Existing installs carry a stale summary section atop each setup doc; it is graduated in place — binding decisions promoted to ADRs or the doc body, then the section stripped — leaving docs/ as clean reference documentation (gw-context-split)
### Changed (repo-map is now multi-language and extensible, 2026-06-23)

The deterministic code map grew from four languages to a fidelity-tiered, project-extensible map. Graph fidelity (real import edges + PageRank centrality) now covers Go, Python, TypeScript/JavaScript, **Java, and Dart**; a further ten languages (Rust, Kotlin, C#, C/C++, Scala, Swift, PHP, Ruby, Lua) map at symbols fidelity (symbol index + module shape + external deps). `repo-map.json` gains `coverage` (per-language file count + fidelity) and `unmapped` (languages present but not mapped, with reasons), and the CLI nudges toward enabling them.

- **Project extension seam.** A repo enables any language repo-map does not cover — or overrides a built-in — by committing `.groundwork/config/repo-map.languages.js` (grammar + tree-sitter queries + an optional resolver). No fork required. A grammar that fails to load degrades gracefully (reported in `unmapped`) instead of crashing the run.
- **Grammar supply chain owned in-repo.** Enabling Dart required tree-sitter ABI 15, which forced `web-tree-sitter` `0.22.6` → `0.26.9` (a changed wasm format that the old `tree-sitter-wasms` pack could not satisfy). The shipped grammars are now built from pinned sources by `scripts/build-grammars.mjs` (tree-sitter CLI + a self-contained wasi-sdk — no Docker) and vendored under `lib/repo-map/grammars/`, replacing the `tree-sitter-wasms` dependency. Net install footprint drops (a 49 MB dependency removed; ~2.5 MB gzipped vendored).
- [no-migration] `repo-map` is run via `npx groundwork-method`; existing installs pick up the new engine and grammars automatically, and the added cache fields are regenerated on next run.

### Fixed (docs site no longer 404s at its `/docs` root, 2026-06-23)

The scaffolded Fumadocs site (`docs-site` generator) compiles the pristine root `docs/` tree untouched, which ships without an `index.md`. The home route redirects `/` → `/docs`, but the empty slug had no backing page, so a freshly provisioned site 404'd on first load even though every real page (`/docs/architecture`, `/docs/product-brief`, …) served correctly — the failure mode seen running `./dev docs`.

- The catch-all route now renders a generated overview at the `/docs` root instead of 404ing: it lists every doc grouped by its top-level section, derived live from the page list. The root `docs/` tree stays pristine (no injected `index.md`), unknown slugs still 404, and the landing title comes from the project's `navTitle`.
- [no-migration] The docs site is generator-produced (Tier 3); existing installs regenerate it through the normal upgrade path and pick up the fix — no dedicated migration step is required.

### Changed (hidden skills relocated out of `.agents/` into `.groundwork/skills/`, 2026-06-21)

On-demand methodology skills, the discipline personas, `groundwork-writer`, and the shared references are GroundWork's private, orchestrator-routed instruction files — never meant for an agent's skill scanner to discover. They now install into `.groundwork/skills/` (GroundWork's home directory) instead of `.agents/groundwork/skills/`, so no agent's discovery rules can pick them up. Only the genuinely-registered skills (`groundwork-orchestrator`, `groundwork-check`) remain under `.agents/skills/`.

- **Install destination moved.** `npx groundwork init`/`update` now copy `src/hidden-skills/*` to `.groundwork/skills/`; the orchestrator routing table, every inter-skill path reference, the install manifest (tier 1), and the docs follow.
- **Engineer skills are canon-in-`src`, promoted at scaffold only.** The five engineer skills moved to `src/engineer-skills/` and are no longer installed at the GroundWork root. A service generator still promotes the matching skill into the scaffolded project's `.agents/skills/` (the only place it becomes a registered skill).
- [migration] Existing installs have the orphaned `.agents/groundwork/skills/` tree removed on update; the new tree installs at `.groundwork/skills/`, and any promoted `.agents/skills/groundwork-*-engineer/` is left untouched (gw-relocate-hidden-skills)

### Added (high-end micro-polish: per-app atmosphere tokens, token-driven engineer, deterministic conformance, 2026-06-21)

Design craft is now specified as per-app tokens and verified deterministically, so agents deliver the micro-level polish — atmosphere, motion, optical finish — that separates high-end UI from a framework default. The lever is "specify concretely → build to spec → verify against spec," not vision-grading screenshots.

- **brand-tokens `visual` contract extended** with the atmosphere layer: `elevation` (multi-layer shadow stacks), `blur`, `gradients`, `surface` treatments (glass/elevated/hero), `motion.interactions`, and `typography.roles` (per-role line-height/tracking + `numeric`). The design system fills these per app.
- **Next.js token projection (parity with electron/flutter).** The nextjs-app generator now reads `brand-tokens.json` and projects the palette + atmosphere into a generated `app/brand.css`; `app/globals.css` maps them into Tailwind token utilities (`shadow-low/mid/high`, `backdrop-blur-*`, semantic `success/warning/info`) and surface classes (`.surface-glass/.surface-elevated/.surface-hero`).
- **Engineer skill is token-driven.** `groundwork-nextjs-engineer` no longer carries a fixed aesthetic catalogue (the glass variants, the 4-layer shadow values, named themes, the Geist mandate); its references teach the stack mechanics and point at the app's design system. Atmosphere is delivered per app, never baked into a skill.
- **Designer canon deepened** with the atmosphere/material layer (translucency, ambient glow, grain, multi-plane depth) and optical finish (optical alignment, crisp 1px rendering, tabular numerals), anti-mimicry framed.
- **Per-surface micro-polish spec + convergent technique research.** Bet design requires a token-traceable motion/atmosphere/static-micro spec per graphical surface (concreteness-gated at review); at design-settle the design system runs a convergent pass over high-end exemplars of the chosen aesthetic, recording concrete techniques (not images) as a technique library.
- **Deterministic verification.** New `test_token_conformance.py` (Tier 1) asserts the atmosphere actually landed (tokens resolve, multi-layer elevation, backdrop blur on surface treatments); the token-conformance lint now also bans raw shadow/blur/gradient literals. The vision-grading Tier-3 `visual-fidelity` review is removed — the craft bar is the concrete spec, judged for conformance by the deterministic gate and a designer spec-conformance pass at delivery.
- [migration] Existing Next.js apps regenerate their token layer — gaining `app/brand.css`, the restructured token-driven `globals.css`, and `test_token_conformance.py` — with hand-edited `globals.css` reconciled rather than clobbered (gw-nextjs-atmosphere-tokens)

### Added (off-script support: composable `./dev`, the Day-2 baseline, and customization guidance, 2026-06-21)

GroundWork now treats its shipped scaffolds and `./dev` CLI as a starting point the project owns and grows, and holds off-script work to the same bar as the paved road (plan: `docs/plans/archive/customization-and-forge.md`).

- **The `./dev` CLI is composable.** A project adds its own commands without touching the framework bundle — a JSON file under `.dev/commands/`, or a `commands` block in `.dev/dev.config.json`. Project commands appear in `./dev help` and shell completion beside the built-ins, run as subprocesses with extra args appended, and may shadow a built-in (e.g. redefine `start` for a stack the default lifecycle does not fit). The command layer is project-owned: `update` never overwrites it (the bundle that reads it is framework-owned and clean-replaces as before).
- **`./dev start` never no-ops silently.** An empty workspace — no containers, native services, or runners — prints an honest "nothing registered" notice pointing at how to register a runner or add a command (the *no empty capabilities* rule).
- **New principle — the Day-2 Operational Baseline** (`docs/principles/delivery/day-2-operational-baseline.md`): the stack-agnostic bar (config validation, typed errors, a debug entry point, observability, graceful shutdown, a pure core, a fast test, dev-CLI integration) every project clears, plus the *no empty capabilities* and *off-script still lands well* rules.
- **Customization guidance** woven into the scaffold and bet-delivery flows: adapt shipped tooling to fit, never leave a command inert, never build a parallel tool beside it.
- [no-migration] The new `./dev` bundle clean-replaces on update like any framework-owned bundle; the project command layer it reads is additive and project-owned, so old installs need nothing beyond the normal bundle refresh, and the new principle doc arrives through the Tier-2 doc refresh.

### Changed (architecture de-jargoned — keep the discipline, drop the label, 2026-06-19)

The structural discipline is unchanged — a pure domain core, dependencies pointing inward,
swappable edges, the rule enforced in CI — but it is no longer named after the "hexagonal /
ports-and-adapters" framework, and the generated services now use each language's own idiom
instead of a cross-language metaphor (plan: `docs/plans/archive/pragmatic-architecture-naming.md`).

- **Principle reframed.** `system-design/hexagonal-architecture.md` → `code-structure.md` ("How
  We Structure Code"); the manifesto, `llms.txt`, the architect persona, and every cross-reference
  follow. The whole principles corpus was deep-rewritten to research-backed, decision-grade depth.
- **Go scaffold made idiomatic.** Interfaces move from `internal/core/gateway/` into the consuming
  `internal/core/service` package; `internal/provider/` splits into technology-named packages
  (`internal/postgres`, `internal/kafka`, `internal/pubsub`, `internal/httpclient`,
  `internal/websocket`, `internal/llm`). A real `depguard` config now fails the build when the core
  imports an edge package — the inward-flow rule is an enforced gate, not a comment.
- **Python scaffold made idiomatic.** `core/domain/protocols.py` → `core/ports.py`; `src/provider/`
  → `src/adapters/` with technology-prefixed implementations. The service now uses a proper PEP
  src-layout: the importable package is `src/<service>/` (the service name in snake_case) rather
  than a flat `src`, so imports read `from <service>.core.ports import …` and the hatch wheel,
  Docker entrypoints, native runner, and `import-linter` root all target the real package. A real
  `import-linter` contract now fails when `<service>.core` imports an adapter, an entrypoint, or a
  web/db framework.
- **Engineer skills + methodology** re-expressed in the new idiom; the capability registry, the
  cross-phase "Capability Ports & Providers" contract, and the brownfield extractor de-jargoned.
  The vendor "provider" concept and the `capability-ports.json` machine twin are kept verbatim.
- New generation produces the idiomatic layout; skills clean-copy on update — `[no-migration]` for
  scaffold templates and engineer skills, which carry forward by clean-copy and affect new
  generation only. A user's already-scaffolded service code is theirs and is documented-forward,
  not rewritten.
- [migration] Installs carrying the orphaned `hexagonal-architecture.md` from before the reframe need it retired and its live cross-references carried forward to `code-structure.md` (gw-code-structure-rename)

### Changed (docs-site generator now actually serves docs/, as a native runner, 2026-06-19) `[no-migration]`

The `docs-site` generator (plan: `docs/plans/archive/docs-site-scaffold.md`) is finished and verified
against a real `next build`. It now:

- **Serves the live `docs/` tree as a native `./dev` runner**, not a docker-compose service. The
  site compiles the repo-root `docs/` at build time, which is outside any per-service Docker build
  context — so the old containerized build could never see the docs. It registers a non-autostart
  surface runner (`pnpm dev`) via the runner registry and no longer touches `docker-compose.yml`;
  the Dockerfile is removed.
- **Renders GroundWork's frontmatter-free docs with real titles.** Fumadocs requires a `title`;
  GroundWork docs carry none. `source.config.ts` now derives each page's title (sidebar + header)
  from its first `# H1`, so bets and lifecycle docs are browsable with correct labels — and the
  sidebar floats the **Bets** section to the top.
- **Pins a build-clean stack** (`fumadocs-* 14.7.7` / `fumadocs-mdx 11.10.1`, Next `15.1.8`, React
  `19.0.0` stable, matching React 19 types, `autoprefixer`) and runs `fumadocs-mdx` on `postinstall`
  so `@/.source` type-checks. The compilation test is no longer `xfail`.
- **Installs and runs cleanly under pnpm 10+.** A `pnpm-workspace.yaml` allows the first-party Next
  build deps (esbuild/sharp) to run, so `pnpm install` exits 0 and the `pnpm dev`/`pnpm build`
  pre-run dependency check passes — otherwise pnpm's build-script gating exits non-zero and blocks
  the runner from starting. Verified end-to-end: `./dev start` boots the runner and serves `/docs`.

Offered as an **optional, default-off** step in the scaffold flow. Additive for existing installs:
the generator is Tier-1/Tier-3 (clean-replaced / regenerated on upgrade), and a project without a
docs site needs nothing.

### Added (orchestrator answers scaffold-capability questions, 2026-06-18) `[no-migration]`

The orchestrator now has a capability-discovery intent handler: when a user asks "can we scaffold a
docs site?", "what can GroundWork generate?", or "is there a generator for X?", it answers from the
shipped generator catalog (`.groundwork/config/generators.json`, already deployed on init/update)
rather than guessing or loading the scaffold flow. Flag-level detail (auth, messaging, LLM provider,
docs-site engine) is read read-only from the scaffold skill's single mapping table — no second
catalog to drift. Skills are Tier-1 (clean-replaced on update), so existing installs pick this up on
their next `npx groundwork-method update` with no migration.

The framework upgrade path (design: `docs/plans/archive/framework-upgrade-path.md`): every
installed artifact gets an owner and a provenance record, and every framework change
that touches installed projects ships with a migration — so no project is left behind
as the framework improves.

### Added (deterministic code map generator, 2026-06-19) `[no-migration]`

`npx groundwork-method repo-map` builds `.groundwork/cache/repo-map.json` deterministically:
a tree-sitter pass (Go, Python, TypeScript/JavaScript) resolves import edges and ranks files
by PageRank centrality, with a per-file parse cache keyed by content hash so reruns reparse
only what changed. This makes the code map a first-class, regenerable artifact rather than
something assembled from LLM inference — closing maturity dimension D5's "regenerable on
demand" honestly. Serena stays the live, per-symbol complement (navigation, editing, impact
analysis); the generator is the whole-repo aggregate it cannot export. `repo-map --check`
(and `groundwork check`) report staleness against `generated_at_commit` as an advisory; refresh
is detect-and-lazy by default, with no git hook unless opted in. Schema: the installed
`repo-map-schema.md` reference. The installed `code-intelligence.md` guide (renamed from
`serena-tools.md`) gives a working agent the orientation workflow — build/refresh the map,
read centrality for the hubs, navigate and edit with Serena — and the engineer skills point
to it. Adds runtime deps `web-tree-sitter` and `tree-sitter-wasms` (pinned; bundled grammars,
no network at run time). The greenfield scaffold seeds an initial map at verification time
(Phase 4) so a project is born with one, and `getting-started.md` documents a CI lane
(`repo-map` then `check`).

### Changed (honest dev infrastructure + native runner registry, 2026-06-16) `[no-migration]`

The scaffolded `./dev` CLI no longer assumes a server (plan: `docs/plans/archive/dev-cli-native-runners.md`).
db (Postgres+pgvector) and jaeger are no longer seeded into the base docker-compose — they are
injected on demand by the service generators that use them, exactly like redis/pubsub. A workspace
with no containerized service (a desktop, CLI, or local-first app) provisions no infrastructure, and
`./dev start` reports "nothing to start" instead of faking a success on an empty stack.

A native **runner registry** decouples "managed by `./dev`" from "is a docker-compose service": the
`runners` array in `.dev/dev.config.json` declares native processes (surfaces, sidecars) that
`./dev` start/stop/status/logs now manage. Surface generators (electron-app, flutter-app, cli-app)
and `python-microservice --native` self-register their runner, so a desktop app and a native sidecar
finally appear in `./dev status` and boot with `./dev start`.

Additive for existing installs: the CLI bundle is Tier-1 (clean-replaced on update), the `runners`
field is optional (configs without it manage zero runners), and existing docker-compose files are
left untouched (the template change affects new generation only) — hence `[no-migration]`.
Retro-registering surfaces in pre-existing projects ships as the `gw-runner-retro-registration` agent migration (below).

- **`workspace-dev-cli`**: db/jaeger removed from `docker-compose.yml.template`; CLI bundle gains
  `cli-src/util/runners.ts`, runner-aware start (Phase C) / stop / clean / status / logs, an honest
  empty-start notice, a db-less `migrate` no-op, and `runners: []` seeding + preservation on re-run.
- **`ensureOptionalInfra`**: injects db (+`db_data` volume) and jaeger on demand; `createNode` fix
  for creating the services/volumes maps when the base compose ships neither.
- **Service generators** (go / python / nextjs / docs-site): create the compose services map on
  demand and inject db/jaeger per what each service uses.
- **Surface/sidecar generators**: electron / flutter / cli / `python --native` self-register a
  runner via the new shared `registerRunner` helper; `./dev status --json` gains a `runners` array.

### Added (composable capability ports & providers, 2026-06-17) `[no-migration]`

Infrastructure is now a consequence of providers, not a default (plan: `docs/plans/archive/dev-cli-native-runners.md`,
WS-F core). A **capability** is a hexagonal port plus a catalog of swappable **providers**; choosing a
provider chooses an adapter, and each provider declares an operational **footprint** — `env`,
`compose-service`, `runner`, or `none`. The registry is data, not code
(`src/generators/capabilities/<capability>/`), so adding a provider is a folder, not a generator change.

LLM ships as the first worked family (`capabilities/llm/`, Python stack) with providers `anthropic`,
`openai`, `local` (self-hosted, OpenAI-compatible), and **`none`** — the raw gateway: the `LLMGateway`
port + a not-yet-implemented stub + a strict-xfail contract test. `none` is GroundWork's own thesis
turned on the scaffold — the port is the spec, the adapter is a **bet**; the suite stays green while the
bet is open and flips red the moment you implement it.

- **`add-capability` generator** (new): bolts a capability port + provider (or a raw `none` gateway)
  onto an existing service on Day 2 / inside a bet — the standalone surface over the shared injector.
- **`src/generators/shared/capabilities.ts`** (new): one `applyCapability` injector consumed by both
  the service generators (scaffold time) and `add-capability` (Day 2) — port + adapter + contract test
  + provider dependency + env footprint, no per-provider drift.
- **`python-microservice`**: `--llm` now routes through the capability registry; `--llmProvider` gains
  `local` and `none`. The `LLMGateway` port moved from `protocols.py` to its own `llm_port.py` so the
  port is reusable by `add-capability`. Generated output for the existing `anthropic`/`openai` providers
  is unchanged. Additive for installs (new generator + registry; existing services untouched) — `[no-migration]`.

Still open in WS-F: architecture phase declaring capabilities (F7), scaffold reconciliation (F8/WS-D),
engineer-skill alignment doc (F6), and provider families for the Go/Next.js stacks (F5/O9).

### Added (architecture declares capability ports; scaffold reconciles, 2026-06-17) `[no-migration]`

The composable capability-port model (above) is now driven by the architecture, not just generator flags (plan: `docs/plans/archive/dev-cli-native-runners.md`, WS-F F7/F8). The architecture phase elicits, per technical capability, its **provider** and **operational footprint** (`env` / `compose-service` / `runner` / `none`) and records them in `docs/architecture.md` §3 "Capability Ports & Providers" plus a machine twin `.groundwork/capability-ports.json`. The scaffold reads that twin to choose generator flags (or an `add-capability` invocation), injects only the infrastructure providers require, and **reconciles** at boot: every `compose-service` footprint is a running container, every `runner` is in `./dev status`, every `env` is documented, every `none` raw gateway has its strict-xfail contract test — a declared footprint with no materialization is a build error, not a silent gap.

- **`groundwork-architecture`**: template §3 gains the Capability Ports & Providers table; Phase 5 elicits provider + footprint per port (`none` = raw gateway / bet); Phase 7 writes the `.groundwork/capability-ports.json` twin. `groundwork-architecture-extract` recovers ports from brownfield code (unimplemented port → `none`).
- **`groundwork-scaffold`**: Phase 1 reads the registry and maps ports to flags / `add-capability`; Phases 2 + 4 reconcile footprints. `--llmProvider` mapping extended with `local` and `none`.
- New contract `.agents/groundwork/skills/templates/capability-ports.md` (schema + footprint model, disambiguated from the surface capability *ledger*); Cross-Phase Contracts table updated. Skills clean-copy on update — `[no-migration]`.

### Added (Go LLM capability family, 2026-06-17) `[no-migration]`

The capability layer (above) now spans the Go stack, proving it is genuinely general and not Python-only (plan: `docs/plans/archive/dev-cli-native-runners.md`, WS-F F5/O9 — Go only; surfaces and frontend stacks consume the LLM via the backend's contract rather than embedding an adapter, keeping keys server-side and one port per owner).

- `capabilities/llm` gains a `go` stack: the `gateway.LLMGateway` port (`internal/core/gateway/`), adapters in `internal/provider/`, and a contract test with a compile-time `var _ gateway.LLMGateway` conformance assertion plus a Skip-based bet test for `none`.
- Go adapters are **`net/http` against the provider REST APIs** (Anthropic Messages, OpenAI/`local` Chat Completions) — no SDK dependency, so `go.mod` is untouched and the generated code compiles standalone. A transparent starting point to extend or swap for an SDK behind the same port.
- `add-capability` detects the Go stack (go.mod) and is the entry point for adding the LLM port to a Go service; `applyCapability` resolves the module import path from `go.mod` and records the env footprint in `.env`.

### Added (capability footprint completion + retro-registration, 2026-06-17)

WS-F rounding-out (plan: `docs/plans/archive/dev-cli-native-runners.md`, F6/F9/D2 + WS-E1). The footprint
matrix is now complete and the runner registry is reachable by existing installs.

- **`applyCapability` materializes all four footprints.** It already wrote `env`/`none`; it now
  injects a `compose-service` footprint's container into the workspace `docker-compose.yml` (the
  capability-driven form of WS-A's on-demand db/jaeger) and registers a `runner` footprint with
  `./dev` via `dev.config.json`. Two new LLM providers exercise these arms and prove "swap the
  footprint, keep the port and adapter": **`ollama`** (runner — `ollama serve`) and **`localai`**
  (compose-service — a model-server container), both reusing the OpenAI-compatible adapter.
- **Engineer-skill reference** `capability-ports.md` added to `groundwork-go-engineer` and
  `groundwork-python-engineer` (the stacks that emit ports): the generated port/adapter/footprint
  shape and the `none` bet, so a hand-written adapter matches the generated one. Skills clean-copy
  on update — `[no-migration]`.
- **`infrastructure.md` gains a "What `./dev start` does" section** (scaffold Phase 5): one row per
  managed unit (container / native app-service / runner) with its run mode, cross-checked against
  `./dev status --json`, so the doc can never describe a stack the CLI cannot run.
- Generation tests cover the full footprint matrix (env / compose-service / runner / none).
- [migration] Projects scaffolded before the runner registry have a runner-less `dev.config.json`; register their surfaces and native sidecars as runners without touching db/jaeger compose (gw-runner-retro-registration)

### Changed (resize work on worth + stakes, not effort, 2026-06-16)

Refines the unreleased product-principles corpus (plan: `docs/plans/archive/appetite-stakes-resize.md`).
Reframes how GroundWork sizes work for an AI-native shop: appetite is re-denominated from
calendar time to **worth** (opportunity cost), and **stakes** (blast radius × reversibility ×
review/judgement load) is promoted to a first-class measure of a bet's size — effort/complexity
named as the axis AI deflated. No shipped surface has changed yet (the corpus is unreleased), so
no migration is involved.

- **`foundations/prioritization-and-appetite`**: re-denominated appetite (worth, not a
  time-budget — "N weeks" demoted to one optional lens); new principle **"Size is stakes, not
  effort"**; "Sizing by complexity" added to the anti-patterns.
- **`foundations/product-risks`** §6: stakes named as blast radius × reversibility × review load,
  cross-linked to the canonical definition; effort framing dropped.
- **`groundwork-product` references** (`shaping-and-appetite`, `scope-and-sequencing`) + sync-anchor
  re-pinned to the edited sources.
- **Bet artifacts**: pitch template gains a **Stakes** line and a worth-framed appetite; bet
  discovery + MVP workflows elicit worth + stakes; `bet-pitch` and `technical-design` review
  checklists verify stakes is sized and not confused with effort.
- **Vocabulary aligned** in `product-engineering` §3, `ways-of-working/units-of-work`, `docs/product.md`.

### Added (product-discipline persona + product-principles corpus, 2026-06-14) `[no-migration]`

The second discipline-expert persona (after `groundwork-architect`), with a first-class
product-principles corpus behind it (plan: `docs/plans/archive/architecture-2026-refresh.md`
sibling — product wave). Modelled on the same persona-in-a-workflow-route pattern;
research-grounded against 2026 product practice (Cagan's four risks, Torres's continuous
discovery, AI-native product).

- **`groundwork-product` skill** (new hidden skill): a persistent product-discipline persona
  (Cagan/Torres/Bezos lineage) owning the **value + viability** risks. Persona header +
  operating contract + context routing + four-risk handoffs, with **7 self-contained
  `references/`** (discovery-and-opportunity, product-risks, requirements-and-specs,
  success-metrics-and-signals, shaping-and-appetite, scope-and-sequencing, ai-native-product)
  sync-anchored to the source pages. Ships on `init`; present in every project.
- **Product-principles corpus** (6 new first-class pages): `foundations/continuous-discovery`
  (opportunity-solution tree, problem space before solution), `foundations/product-risks`
  (the four risks + owner table), `foundations/success-metrics` (North Star, counter-metrics,
  signal before ship), `foundations/requirements-and-specs` (JTBD, journeys, stable-ID FRs,
  Given/When/Then), `foundations/prioritization-and-appetite` (the portfolio view: appetite,
  the bet, scoring frameworks in their place), and `ai-native/ai-native-product` (the AI-native
  loop, evals as a product responsibility, dual metrics, the three cost layers). `product-engineering`
  refreshed as the corpus anchor; 6 `llms.txt` entries added.
- **Persona wired into the lifecycle**: product-brief setup (`Step 0` activation), bet discovery
  (`01-discovery.md` — the pitch shaped as the persona, both tracks), bet validation
  (`05-validation.md` — product-brief refinements + re-pitch judgement). Architect's product
  handoff flipped from "(when available)" to active; the two personas now divide the product-risk
  space (product: value + viability · architect/engineers: feasibility · designer *planned*:
  usability). Orchestrator + contributor guide updated.

### Added (architecture 2026 refresh — P0, 2026-06-14)

Research-driven refresh of the architecture guidance against 2026 best practices
(plan: `docs/plans/archive/architecture-2026-refresh.md`). P0 — the AI/agentic cross-cut +
enforcement layer:

- **`agentic-systems` principle + architect reference** (new): architecting systems where
  AI agents are first-class actors — single-agent-first topology (naive multi-agent is the
  anti-pattern), the MCP + A2A + AG-UI protocol stack, context engineering + tiered memory,
  durable execution for long-running agents, the prompt-injection threat model + guardrails,
  least-agency + human-in/on-the-loop, and trace/eval-based reliability.
- **`evolutionary-architecture` principle + architect reference** (new): designing for change
  and governing it with **fitness functions** ("a record documents; a fitness function
  assures"), architecture-as-code, strangler-fig modernization, reversibility, and advisory
  governance (advice process / guild) over a review-board gate.
- **`ai-native-architecture` reference sharpened**: the agent protocol stack (A2A/AG-UI beside
  MCP, Resources vs Tools), the RAG pattern taxonomy (naive→advanced→agentic→adaptive,
  GraphRAG), and cost mechanism (model routing, semantic caching, AI gateway); topology/memory/
  durability/guardrails handed to `agentic-systems`.
- **AI-ops + 2026 cross-cut** woven through the operational principles + architect references:
  reliability (cell-based isolation, living burn-reviewed SLOs, AI semantic-failure + per-SLI
  budgets), observability (OTel GenAI conventions, eBPF/OBI auto-instrumentation, wide events),
  security (SPIFFE workload identity, Sigstore provenance/SLSA levels, prompt-injection + agent
  security as OWASP LLM01), performance (compute placement / edge / WebAssembly, KEDA event-driven
  scale-to-zero, model-routing + semantic-caching cost levers), platform/delivery (OpenTofu vs
  Terraform vs Pulumi, OpenFeature, GitOps rollout engines, AI gateway control plane, carbon-aware
  scheduling).
- **Enforcement/governance**: contract testing + `can-i-deploy` gate + Spectral linting + RFC 9457
  + protocol-selection added to API guidance; advice-process governance + fitness-function pairing
  added to decision records.
- **Three new structural principle pages + architect references** (P1): **`surface-architecture`**
  (surfaces as adapters over the core — the BFF seam, micro-frontend decomposition, render
  placement, design-system-as-contract), **`identity-and-access`** (authn/authz as architecture —
  OIDC/OAuth 2.1, SPIFFE workload identity, first-class agent identity + delegation, modelled
  authorization), and **`durable-execution`** (workflow-as-code — checkpointed long-running and
  multi-step processes, orchestration vs choreography, the reliability substrate for durable agents).
- **Topic improvements** (P2) to existing principles + references: integration (dead-letter handling,
  backoff-with-jitter, orchestration-vs-choreography, modern webhooks via JWKS/CloudEvents), data
  (CDC vs outbox, registry-enforced schema compatibility, the AI-era vector/RAG/feature-store layer,
  lakehouse + Iceberg), real-time (SSE as the per-direction default + LLM token-streaming pattern,
  CRDTs/local-first, WebTransport deferred), and boundaries (modular-monolith-default, the
  distributed-monolith smell + consolidation signal, Conway/Team-Topologies). Edge/WebAssembly +
  carbon-aware (P3) folded into performance/platform/cost rather than promoted to standalone pages.
- Tier-2 manifesto pages refresh on `update`; architect skill is clean-copied. `[no-migration]`.



- **`groundwork-architect`** (new hidden skill): a persistent architecture-discipline
  persona built on the engineer-skill anatomy (`SKILL.md` + `sync-anchor.md` +
  self-contained `references/`). It is adopted *within* the architecture setup workflow
  and the bet design phase (`groundwork-bet/workflows/02-design.md`) — bringing the
  house engineering principles (boundaries/hexagonal, contracts, integration,
  reliability, security, performance, observability, data, platform/delivery,
  AI-native, ADRs) to bear at every point an architecture decision is made. The
  principles are distilled into the skill's own `references/` and sync-anchored to
  `src/docs/principles/*`, which previously had no reader in the design flow.
  `[no-migration]` — skills are carried forward by clean-copy on `update`.
- **Architecture Decisions principle + governed ADR template**: a new first-class
  principle page (`docs/principles/system-design/architecture-decisions.md`) establishing
  the modern governed-decision standard — records carry **assumptions**, a **review
  trigger**, and an **owner**; they are immutable as records (superseded, never overwritten)
  and double as the decision-context layer humans and agents read before revisiting a
  choice. The shipped ADR template (`templates/adr.md`) and manifesto belief #7 are updated
  to match; the architecture commit phase now emits the governed fields. Tier-2 docs refresh
  on `update`; the template is framework-owned (clean-replaced).

### Added (upgrade path, 2026-06-12)

- **Install manifest**: init/update write `.groundwork/config/manifest.json` — every
  deployed tier-1/tier-2 file with source, package version, and SHA-256 at deploy;
  generators record provenance (name, version, options, file hashes) into the same
  ledger. Pre-manifest installs are backfilled on their next update (pristine vs
  `adopted` classification).
- **Migration registry**: `migrations/index.json` ships in the package. `cli`
  migrations (detect-first, idempotent, forward-only) run inside `update` and record
  completions in `state.json`; `agent` migrations are Detect/Transform/Accept briefs
  executed by the new skill. Changelog `[migration]` lines now reference registry ids.
- **Seeded docs stop fossilizing**: `update` hash-classifies `docs/` foundations,
  `AGENTS.md`, and `llms.txt` — pristine copies refresh to the current package, edited
  copies are queued for a skill-mediated merge, absent ones are copied as before.
- **The `./dev` bundle is framework-owned**: `update` clean-replaces `.dev/dev-bundle.js`
  and the `dev` launcher (a customized launcher is queued for judgment instead); the
  bundle embeds its version (`./dev --version`) and `./dev doctor` flags a bundle that
  trails the framework stamp.
- **`groundwork-upgrade`** (nineteenth hidden skill): executes the upgrade brief
  `update` compiles — one item, one explained proposal, one commit. Distinct from
  `groundwork-update` (project docs); the orchestrator surfaces an unconsumed brief at
  session start.
- **`update --dry-run`** prints the full plan (skill diff, tier-2 classification,
  pending migrations, brief contents) without writing; `groundwork check` gains a
  framework section (version gap, pending migrations, tier-1 corruption, unconsumed
  brief) that needs no network.
- **Upgrade-path tests**: frozen old-install fixtures (`tests/fixtures/installs/`),
  convergence/preservation/idempotency/detect-honesty contract tests, a
  migration-coverage gate in the contracts lane, and an `upgrade` simulation suite.
- [migration] Old installs never received `.groundwork/config/config.toml`; update now seeds the commented default (gw-seed-config-toml)
- [migration] Register the Serena code-intelligence MCP server in `.mcp.json` and remove the retired depwire server (gw-register-serena-mcp)
- [migration] Projects carrying `docs/ux-design.md` from before the Design System reframe need the rename and reference uplift (gw-design-system-rename)
- [migration] Products set up before the multi-surface restructure need the surface registry + capability ledger bootstrapped (gw-surfaces-registry-bootstrap)
- [migration] Code-coupled docs written before drift tracking need `last_reviewed`/`source_of_truth` frontmatter stamped (gw-drift-frontmatter-stamp)
- [migration] Bets opened before the bet-loop restructure need their tracking files uplifted to the current shape (gw-bet-shape-uplift)

Multi-surface restructure: every product is modelled as one headless **capability
core** plus zero or more **surfaces** (web, mobile, CLI, MCP), with parity tracked
per capability instead of presumed. A single-surface product pays zero added
ceremony — every phase degrades to its prior behaviour when the registry holds one
surface or none exists.

### Added (multi-surface, 2026-06-12)

- **Surface registry + capability ledger**: architecture (greenfield) and
  architecture-extract (brownfield) write `docs/surfaces.md` with a machine twin at
  `.groundwork/surfaces.json`; bet validation fills a capability × surface ledger row
  per delivered capability (`delivered`/`planned`/`omitted`/`n/a`; empty cells
  illegal; retired columns freeze).
- **The bet loop's core/surface spine**: pitches declare `surfaces:` scope and surface
  no-gos; technical designs split into Surface Design (per-surface, per-type
  vocabulary) and Capability Design (headless; the contract must serve every in-scope
  surface and presume none); milestones are typed capability-first vs surface, with
  prove-once enforcement (surface tests never re-prove core logic); headless delivery
  is legal and ledger-recorded.
- **`groundwork-surface-activation`** (eighteenth hidden skill): register → design
  (lazy track run) → scaffold → triage the ledger column → hand off; bootstraps the
  registry on pre-restructure products.
- **Two new solution types, full chains**: `flutter-app` (mobile) and `electron-app`
  (desktop) generators with survey-dated stack principles
  (`docs/principles/stack/{flutter,electron}/`), hidden engineer skills with
  hash-pinned sync anchors, brand-token theme projection, and toolchain guards that
  skip-with-reason (never silently green).
- **Multi-medium system tests**: `system-test-runner --surfaces` generates a
  `surfaces` fixture (slug → `{slug, medium, reach}`) with per-surface
  page/runner/client fixtures across five mediums; `frontend_base_url` survives as a
  deprecated alias for single-graphical-surface products.
- **Tooling**: `./dev surface status` renders the registry, ledger matrix, and
  planned-cell sync backlog; `groundwork-check` gains five surface signals (twin
  drift, empty cells, stale planned intent, untested active surface, missing
  registry).
- **Design system**: shared brand foundation runs once; tracks run per interface type
  in use; brand tokens carry per-type Tier-2 blocks (`terminal` + new `visual`, with
  platform ergonomics); the graphical-ui track gains web/mobile/desktop platform
  subsections.
- **Maturity + evals**: dimensions D8 (surface parity discipline) and D9 (contract
  compatibility); seeded `multi_surface` and `headless_api` simulation suites.
- Contract spec formats follow the core's deployment (OpenAPI/AsyncAPI hosted, proto
  for gRPC, typed module API embedded).

### Fixed (multi-surface, 2026-06-12)

- The brownfield eval fixture's `services/` tree was silently excluded by the repo
  `.gitignore` and never tracked; negation rules added and the fixture committed.

### Fixed (multi-surface live bake-out, 2026-06-12)

End-to-end sandbox run of the full chain — Go core + Flutter + Electron scaffolds
booted together, both surfaces proven live against the running core (real SDKs:
Flutter 3.44.2, Electron via Playwright `_electron`):

- **Flutter wiring proof now true out of the box**: the scaffold's `ApiClient`
  probed `/api/healthz` (the Next.js BFF route) while Go/Python cores serve
  `/health` — a freshly scaffolded mobile app rendered "unreachable" against its
  own healthy core. The client now probes `/health` (BFF variance documented).
- **Electron surface actually wired to the core**: the scaffold never consumed the
  `API_BASE_URL` the test harness passes. New `src/main/core-client.ts` seam (main
  fetches the gateway; the CSP-sandboxed renderer rides the typed `core:health`
  channel), rendered as a wiring-proof line in the home view, asserted in the
  Playwright smoke, unit-tested with injected fetch.
- **Auth seams on both surfaces**: Flutter gains `authTokenProvider` + a tested
  Bearer interceptor; Electron's core client exposes `coreAuthHeaders` —
  unauthenticated by default, identity-provider wiring documented at the seam.
- **`flutter create` pollution at bootstrap**: the platform-shell bootstrap now uses
  `--empty`, keeping the counter-app sample `widget_test.dart` (which references a
  `MyApp` the scaffold doesn't have) from breaking analyze/test post-bootstrap.
- **Re-running `workspace-dev-cli` no longer resets docker-compose.yml**: the
  topology accreted by service generators is preserved verbatim (a re-run erased
  the core's registration, and `./dev migrate` silently migrated nothing).
- **`./dev` lifecycle commands no longer treat surfaces as backends**: app services
  are now the `services/` directories wired into compose, so migrate/start/doctor
  skip mobile/desktop surface apps instead of creating phantom databases for them.
- **Flutter runner device probe counts only android/ios devices**: host "devices"
  (macOS, Chrome) no longer turn the intended skip into a hard no-devices failure;
  the skip names the missing device class.
- All of the above locked in by new generation tests (core-access seam wiring,
  `--empty` bootstrap, auth seams, compose preservation, device-probe filter).

Contract-grade delivery: the bet loop's design → tests → delivery chain becomes
machine-enforced end to end. Design emits specs, the proof suite is reviewed
assertion-by-assertion and sealed by hash manifest, delivery is tracked per-slice in a
machine-readable manifest, and the loop closes with a retrospective. Plus the package
rename and the BMAD delivery-loop adoptions. Also includes the second-pass quality
sweep over the 0.9.0 surface.

### Added (contract-grade delivery, 2026-06-10)

- **Specs at design time**: Design Foundations writes `docs/bets/<slug>/contracts/`
  (`openapi.yaml`, `asyncapi.yaml`, `schema.sql`); decomposition tests derive every shape
  from the specs; validation promotes them to `docs/api/<service>/` as the canonical record.
- **The signing gate**: a generated `test-review.md` puts every test's verbatim assertions
  and traceability in front of the user at Proof of Work; on approval `./dev bet sign`
  seals the suite with a SHA-256 manifest. `./dev test bet` refuses a tampered suite; the
  delivery workflow forbids test edits; a wrong test routes through the Amendment Protocol
  with user sign-off and a re-seal.
- **The progress surface**: `.groundwork/bets/<slug>/decomposition.json` mirrors the
  decomposition machine-readably; delivery records per-slice status, baseline/delivered
  commits, file lists, and notes; `./dev bet status [--json]` renders the milestone/slice
  board with seal verification.
- **Delivery-loop mechanics adopted from BMAD**: per-slice context capsule (read every file
  the slice modifies before changing it), three-lens slice review (blind reviewer, edge-case
  tracer, acceptance auditor against the specs) with decision/patch/defer/dismiss triage
  wired to the maturity ledger, the bet retrospective (slice-record mining, previous-retro
  follow-through audit, significant-discovery detection, readiness exploration), and Change
  Navigation with written before/after change proposals.
- **`groundwork-patch`**: the small-change lane — one bounded user-facing goal, tested,
  Living-Documents-passed, logged to `docs/bets/patch-ledger.md`; clustering patches surface
  as a bet signal in discovery. Contract/schema changes never qualify.
- **Generated test surface**: contract-conformance system test (served spec vs promoted
  spec), Playwright page-object scaffold + axe a11y smoke for graphical-ui projects, and a
  per-stack "Bet Slice Rollout" permanent-test taxonomy in the engineer skills.
- **1.0 criteria** written down in `docs/plans/archive/contract-grade-delivery.md` §9.5.

### Changed (contract-grade delivery, 2026-06-10)

- [migration] Package renamed `groundwork` → `groundwork-method` — the binary stays `groundwork`; change any `npx groundwork …` invocations in your scripts to `npx groundwork-method …` (gw-package-rename-invocations)
- Rename context: the bare npm name is held by an unrelated package, and the `-method` suffix matches the methodology-package convention.
- Release workflow publishes for real (dry-run gate removed); requires the `NPM_TOKEN` secret.
- Infra images pinned (`postgres:16`, `redis:7`); `groundwork check` exit codes documented.
- `docs/groundwork-vs-bmad.md` corrected: BMAD does deliver (full implementation phase);
  GroundWork's differentiators are the executable layer and the sealed design-locked test
  contract, not "they stop at documents."

### Added

- **`groundwork-elicit`**: structured elicitation as an anytime utility skill — diagnoses a
  weak draft section, proposes the one best-fit technique (24 curated methods, loaded only at
  invocation), executes it conversationally, and applies the strengthened section to the open
  draft with the review gate re-run before commit. Offered from the draft walkthroughs of
  product brief, architecture, the design-system tracks, and bet design.
- **Operating contract Protocol 9 (Review Invocation)**: the review-dispatch mechanics and the
  failure procedure now live in one place. A review that errors, hangs, or returns no verdict
  stops the phase — never a silent self-review; an inline self-review requires explicit user
  authorisation and is loudly labelled as not satisfying the gate. Additive; contract stays v1.

### Changed

- **Per-phase step files**: `groundwork-architecture` and `groundwork-scaffold` (31KB each)
  split into slim entries plus `phases/NN-*.md` loaded at each phase's start — a session in a
  late phase no longer carries every earlier phase's instructions. Content-preserving move.
- **Extract-path consistency**: Adopt/Upgrade detection is one structural rule stated
  identically across all three extract skills; `brand-tokens.json` is preserved when valid;
  state recording and frontmatter exemptions are stated as intent instead of left implicit;
  infra-adopt halts on a service-count mismatch and records a gap row.
- **Greenfield lifecycle gaps**: product-brief gains the sibling resume protocol; MVP defines
  its post-review refine path; scaffold flags unverified output with a Verification Status
  section; the reversal-protocol sentence is aligned across all phases.
- **Registered-skill context cost**: persona description cut 77→36 words; check loses its
  duplicated description and dead reference; orchestrator anchors the operating contract and
  explains its rules.
- `groundwork check` prints a friendly guard when run outside a git repository; the seeded
  `llms.txt` states that setup-phase docs appear as each phase commits.

### Removed

- The in-repo `BMAD/` reference clone (the analysis it informed is committed; the clone lives
  outside the repo). Stale `main` field in package.json and stale `.npmignore` entries.

### Fixed (full-corpus skill audit, 2026-06-12)

Every SKILL.md, instructions file, template, and checklist in the shipped corpus was
read and ~1,076 cross-references mechanically verified; the findings ledger executed:

- **Security**: `package.json` gains a `files` allowlist — a local `npm pack` previously
  shipped the repo's `.env` (live API keys), `.nx/` caches, and stray workspaces
  (2,832 files → 482). The CI release path was never affected. [no-migration]
- **Sandbox leak scrubbed from the Next.js engineer skill**: 12 live `wordloop.app`/
  cloudinary identifiers replaced with generic hosts, 14 "the the Next.js application"
  find/replace artifacts repaired across 8 reference files, and an invalid
  attribute-position JSX comment fixed in `mutations-and-forms.md`. [no-migration]
- **infra-adopt joins the multi-surface seam**: Phase 2 now runs
  `system-test-runner --surfaces` from `.groundwork/surfaces.json` instead of the
  deprecated single-surface `--interfaceMedium` alias — brownfield always has a
  registry by then, and the alias produced a fixture-less harness plus false
  groundwork-check warnings. [no-migration]
- **Broken shipped paths**: scaffold Phase 2's missing-skill fallback pointed at the
  repo-internal `src/hidden-skills/` (now `.agents/groundwork/skills/`);
  groundwork-writer's document-type table caught up with the canon
  (`docs/services/<service>.md`, `docs/decisions/`, `docs/api/<service>.md`, root
  `llms.txt`, new Domain Entity row). [no-migration]
- **Engineer-skill contract drift**: Go validation responses unified on 422 across
  SKILL.md, `api-design.md`, and `http-handlers.md` (matching the Python skill and
  huma's default); the insecure `tempfile.mktemp` exemplar (CWE-377) replaced with
  `mkstemp`; the "flat package layout" claim corrected to the nested `internal/`
  layout the generator actually scaffolds (fixed in the pinned principle and
  re-anchored); the phantom `--run-integration` pytest flag replaced with real
  `-m live` marker selection. [no-migration]
- **Protocol-list drift**: all bet workflow headers now carry the contract's
  Continuous Bet set (Protocols 1, 2, 4, 8, 9); the contract's Maintenance mode
  gains `groundwork-upgrade`; update/upgrade headers name Protocol 9. [no-migration]
- **Bet activation**: routes added for `status: discovery` (resume into design) and
  `status: delivered` (terminal — next work is a new bet), plus multi-pitch
  disambiguation when several active pitches exist. [no-migration]
- **Scan digest schema**: four new fields (`inferred_users`, `licensing_signals`,
  `theme_framework`, `interaction_a11y`) and routing so the brownfield extracts'
  findings-template sections (Inferred Users, Licensing, Product Surface, Theme &
  Framework, Interaction/A11y) are actually populated by the scan. [no-migration]
- **Governance (repo-side)**: engineer-skill mirror rule documented (canon =
  `src/hidden-skills/`, `.agents/skills/` copies are read-only) and enforced by two
  new gates in `./dev test contracts` (mirror byte-identity + sync-anchor hash
  verification — the anchors' "CI verifies" claim is now true); CLAUDE.md routes Go
  work to `groundwork-go-engineer` (was the vendored `golang-pro`) and gains a Python
  route; `skills-lock.json` hashes recomputed against the vendored files with the
  recipe documented; the contributor guide's repo map lists all eight dev skills and
  its phantom `./dev check contracts` reference now names the real conformance path.
- **Minors**: MVP phases renumbered contiguously (1–4); maturity prose reconciled
  with its four-row table (`n/a` is a precondition marker, not a state); `dormant`
  surfaces keep their recorded `testMedium` (exercised only while `active`); three
  electron cross-skill reference paths qualified; "Workstream F" plan leak removed
  from bet decomposition; scripted discovery questions converted to intent; dead
  `last_reviewed` dropped from the pitch template; groundwork-check's dimension
  range updated for D8/D9. [no-migration]
- **Audit backlog sweep** (second pass, same day): the Next.js engineer SKILL.md
  rejoined its family template (capability-core clause, named principle path, real
  reference files behind every Task Routing entry, hedge-free safety gates); sandbox
  `Story*` identifiers generalized out of the Python database reference; Python DI
  exemplar re-typed against the gateway Protocol; idempotency-key scope unified on
  POST/PATCH with PUT's HTTP-semantics exemption stated; stale Go 1.22 loop-var
  idiom removed and the provider-boundary `%v` wrap given its rationale; snapshot
  testing scoped to genuinely opaque artefacts (matching the Go rule); electron's
  sync-anchor now pins its `typescript/frontend.md` deferral target; the review
  skill documents `implementation-readiness.md` as deliberately outside the
  `document_type` enum and its upstream chain includes `decomposition`; digest
  routing labels exact-match the `## Service / Partition Map` header; the engineer
  two-family SKILL.md split and the vendored-skill style policy are now recorded in
  the contributor guide; scaffold-designer's checklists carry a summaries-not-canon
  caveat and its stale `workspace.json` claim is gone. [no-migration]

### Fixed (production-readiness pass, 2026-06-12)

- **`update` fails closed on copy errors**: the mechanical lane (skill trees,
  generators config, tier-2 docs, dev bundle) now aborts on any I/O failure
  *before* the version stamp and manifest advance — a partial apply reads as
  "update failed, re-run", never as a clean update whose half-copied files
  classify as user edits on the next run. `init` likewise aborts instead of
  printing success over a failed skill install. [no-migration]
- **Bet workflows pin the contract version**: all five `groundwork-bet`
  workflow headers now reference the operating contract as `(contract v1)`,
  matching every other methodology skill. [no-migration]
- **License metadata**: `package.json` declared ISC while the LICENSE file is
  MIT; the manifest now says MIT. [no-migration]
- **Repo hygiene** (dev-only): nine committed scratch scripts (Gemini SDK
  explorations) and an accidentally committed session lock file removed from
  the repo root; the lock path is now gitignored. The contributor guide's
  release section no longer claims the publish workflow is dry-run gated.

## [0.9.0] - 2026-06-09

First tracked release. GroundWork adopts semver from `0.x` honestly — the framework is
feature-complete across both setup paths but its operational surface is still hardening.

### Added

- **Update engine**: `groundwork-update` rebuilt as a full maintenance skill — change-set
  resolution, three-pass code→doc mapping (path intersection, Serena impact analysis,
  semantic mapping), surgical edits under the Living Documents protocol, fail-closed review
  gate per mutated doc.
- **Real CLI `update` and `check`**: `update` diffs installed skills against the package and
  refreshes them (preserving `.groundwork/config`, cache, and docs); `check` runs deterministic
  doc-drift detection (git history vs `last_reviewed`/`source_of_truth` frontmatter), CI-ready
  with meaningful exit codes.
- **Version stamping**: init/update write `groundwork.version` into `.groundwork/config/state.json`;
  the operating contract carries a contract version; the CLI warns on mismatch and prints the
  changelog slice between installed and current versions on update.
- **Help surface**: a workflow index generated from the orchestrator routing tables
  (`npm run gen:workflow-index`), served by the orchestrator's help intent and `npx groundwork help`;
  freshness is CI-gated.
- **Maturity steering (D8)**: a seven-dimension maturity model defining GroundWork's target
  state, a living `docs/maturity.md` (assessment + tracked gap roadmap) written by both setup
  paths, bet-loop steering (discovery proposes pulling gaps in, validation closes rows), and
  continuous re-assessment in `groundwork-check`. Supersedes the one-shot onboarding report.
- **Shipped review checklists**: per-document-type named-failure-mode checklists under
  `groundwork-review/checklists/`, cited by item name in review findings.
- **Skill conformance linter**: `./dev lint skills` (CI-gated) — frontmatter, versioned
  contract references, fail-closed review-gate blocks, canonical discovery-notes headers,
  routing↔filesystem agreement, llms.txt links, skill↔doc pairs, workflow-index freshness.
- **User config surface**: `.groundwork/config/config.toml` seeded once at init —
  `[defaults]` proposals (stack, models, generator flags) read by architecture/scaffold,
  `[skills]` custom routing merged after the built-in table.
- **CLI contract tests**: `./dev test cli` (CI-gated) covering init/update/check semantics;
  exposed and fixed a self-copy guard bug that could have deleted the source repo's own skills.
- **Adversarial simulation suites**: ambiguous, terse, mid-flow-reversal, and scope-creep
  personas for the simulation harness.
- **Host support statement** (`docs/host-support.md`), a greenfield output showcase
  (`docs/examples/greenfield-verse.md`), and BMAD-artifact ingestion named explicitly in all
  three brownfield extract skills (Adopt/Upgrade mode).
- Root `README.md` and `docs/getting-started.md` (walkthrough with excerpts from a real
  greenfield simulation session).
- `Maintenance (anytime)` lifecycle mode in the operating contract, defining which protocols
  bind `groundwork-update` and `groundwork-check`.
- `contracts` CI job: dev-CLI bundle freshness, adopt-merge idempotency, workflow-index freshness.

### Changed

- [migration] Installs made before 0.9.0 carry no version stamp — run `npx groundwork update` once to stamp `groundwork.version` into `.groundwork/config/state.json` and enable migration notes for future upgrades.
- `groundwork-persona` editorial pass to the skill-writer standard (stays registered — always-on
  conversational posture cannot load on demand).
- Lifecycle docs cover the brownfield path (scan → extract ×3 → infra adoption) and Adopt/Upgrade
  mode; `docs/lifecycle/index.md` no longer claims greenfield-only.

### Pre-history

Before 0.9.0 the package was unversioned (hardcoded `1.0.0`, no releases). Major capabilities
built in that period: the two-layer skill architecture and orchestrator routing; greenfield setup
phases (product brief, design system, architecture, scaffold, MVP); the brownfield track (scan,
three extract phases, infra adoption, gap ledger); the operating contract (discovery notes,
living documents, phase lifecycle, summaries, hand-off cache, cache isolation, review gate);
Nx generators for Go/Python microservices, Next.js apps, CLI apps, docs sites, and the
system-test runner; the bundled `./dev` workspace CLI; Serena MCP registration; the scaffold
test harness (generation/contracts/compilation/e2e) and the simulation harness with checkpoints.
