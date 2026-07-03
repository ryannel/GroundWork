# Changelog

All notable changes to GroundWork are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/). Entries that require action when upgrading an
existing installation are prefixed `[migration]` — `npx groundwork update` surfaces them
automatically when it detects a version jump.

## [Unreleased]

### Added (engine wave — mechanical gates: `gate` + `seal verify`, 2026-07-03)

Two more Wave-2 engine verbs move the structural, fail-closed half of the delivery
checklists from agent-walked prose into computation (dependency-free; logic in
`lib/bet-gate/`). `groundwork gate readiness|decomposition --bet <slug>` checks what a
tool can settle — the document chain exists, `meta.json` pages and every slice link
resolve, each milestone and slice names a Proof of work and a `Test file:`, the pitch
is at `status: delivery`, and the `bet/<slug>/approved` tag is present — exiting
non-zero and naming each failed check; the authorship items (horizontal milestones,
unfalsifiable capabilities, shape-not-in-design) stay with `groundwork-review` /
Protocol 9, which a gate would only rubber-stamp. `groundwork seal verify --bet <slug>`
is the prose-integrity walk as one git-pathspec diff: the sealed decomposition +
technical-design prose still matches the approved tag (amendments re-point the tag, so
a ratified change reads as sealed), exiting 1 on undeclared drift and 2 when it cannot
run (no tag / no git). The delivery prose shrinks in the same change — the readiness
gate, the milestone-open Decomposition Gate, and the per-slice + whole-bet
prose-integrity checks now invoke the verbs. Design: `docs/plans/groundwork-v2.md` (§4).

- [no-migration] New verbs; the hidden-skill tree clean-copies on update.

### Added (engine wave — findings & decisions verbs, 2026-07-03)

The first two Wave-2 engine verbs move facts from prose the driver kept by hand into
deterministic, committed state under `.groundwork/bets/<slug>/` (dependency-free;
logic in `lib/bet-state/`). `groundwork findings add|disposition|check|list` is the
findings ledger (`findings.json`): `check` exits non-zero while any finding is open —
the mechanical, fail-closed form of the milestone-close gate, so it is CI-safe and
cannot be rubber-stamped; `deferred-with-owner` and `dismissed-with-reason`
dispositions require a `--note` so the owner or the reason is never dropped.
`groundwork decisions add|pending|ratify|list` is the default+veto queue
(`decisions.json`): `ratify` records the owner's **verbatim response** as durable
state and is the only thing that lets the approved tag move — closing the exit-gate
finding that the human-in-the-loop exchange lived only in a memlog line. The delivery
workflow's prose shrinks in the same change to invoke the verbs instead of
maintaining `docs/bets/<slug>/findings.md` / `decisions.md` by hand. Design:
`docs/plans/groundwork-v2.md` (§4).

- [no-migration] New verbs create state on demand; the hidden-skill tree clean-copies on update.

## [0.14.0] - 2026-07-03

### Changed (internal — delivery-phase simulation harness, 2026-07-03)

Built the instrument the Wave-1 exit gate needed: `./dev sandbox <name> --delivery` seeds a sealed `task-capture` bet ready at Delivery Step 0 (readiness-gate-shaped doc chain, `taskcli` stubs that fail red for the feature's absence, the `bet/task-capture/approved` tag) with deliberate seams for every delivery mechanic, plus a `/simulate-delivery` kickoff that drives the loop against a simulated owner and a delivery-specific `/judge`. A frontier driver ran it end-to-end and an independent fresh-context judge scored all six mechanics PRESENT (verdict: FAITHFUL). Dev-only test infrastructure — not shipped in the npm package. Design: `docs/plans/groundwork-v2.md` (§9.7).

- [no-migration] Dev-time test harness under `scripts/`, `tests/`, and `dev`; not part of the installed skill tree.

### Changed (pointer + builder hygiene, 2026-07-03)

De-brittled the cross-skill `Bet Slice Rollout` citation: a new lint rule requires every engineer skill's testing reference to carry the `## Bet Slice Rollout` heading the slice-worker and coverage-auditor briefs cite by name (a rename now fails the build) — which surfaced and fixed a missing section in `groundwork-node-engineer`. `groundwork-stack-forge`'s authoring reference now states an explicit required-sections contract for forged engineer skills (version-corrections, a testing reference with a Bet Slice Rollout section, a Context-Routing section). The engineer default-row `references/core.md` distillation is tracked as a follow-up. Design: `docs/plans/groundwork-v2.md` (W1.10).

- [no-migration] Dev-time lint + skill prose; skills clean-copy on update.

### Added (additive policy layer: policy.toml + policy.user.toml, 2026-07-03)

A two-file additive customization layer: `.groundwork/config/policy.toml` (team, committed) + `policy.user.toml` (personal, gitignored). It lets a team add rigor and context — never remove the floor: `[facts]` (org facts injected into state resolution, dispatched capsules/packs, and setup facilitators), `[lenses]` (additive review lenses dispatched alongside the built-ins — they add findings, they can never satisfy or replace a built-in lens or `groundwork-review`), `[checklists]` (additive 🟡 items per review document_type), and `[phases]` (instruction hooks at phase init/commit). Merge is deliberately trivial — scalars: user wins; arrays: concatenate, team first. A vendored TOML-subset parser keeps the CLI dependency-free; `npx groundwork-method policy` prints the resolved merge as JSON, and `groundwork check` validates both files (parse errors, broken `file:` refs, missing lens briefs, unknown keys). Artifact-path overrides are rejected for v1 (they would generate identifier drift against the cross-phase contracts). Design: `docs/plans/groundwork-v2.md` (W1.9).

- [migration] Seeds `.groundwork/config/policy.toml` and gitignores `policy.user.toml` on installs that predate the layer; purely additive (gw-seed-policy-toml)

### Changed (stakes-scaled validation + experience-audit dedup, 2026-07-03)

Bet-close validation finally reads the pitch's per-bet **Stakes** field (blast radius, reversibility, review load) to set how much of the end-to-end judgment the owner walks with the auditor — a one-way-door bet earns a heavier walk, an iterate-behind-a-flag change a lighter one. This is the per-bet shaping the owner already authors and nothing yet read; it is **not the rejected project-level stakes axis** and conditions nothing in the floor — the deterministic tiers, per-slice lenses, honesty audit, front-door proofs, and experience gate run in full regardless. The whole-bet experience audit now **dedups the re-drive**: seams in full, and a whole milestone only when it took commits after its own close-time audit. Design: `docs/plans/groundwork-v2.md` (W1.8).

- [no-migration] Hidden-skill trees are clean-copied on update.

### Changed (attestation theater removed, 2026-07-03)

The always-run confirmation walks that never tripped are cut to mechanical, conditional checks. Prose integrity is one git-pathspec check against the approved tag (a clean output is the whole pass); honest-green's consumer-compile runs only on ripple slices and its shipping-build check only on front-door slices — where each can actually bite. Protocol 9 doc re-reviews at milestone open are **reserved**: the mechanical Decomposition Gate (recorded item-by-item in the commit body) is the review of record, and P9 dispatches only for a new contract or surface, a post-amendment rung, or a first decomposition — the observed P9 re-reviews found zero critical findings over ground the gate had just covered. Design: `docs/plans/groundwork-v2.md` (W1.7).

- [no-migration] Hidden-skill trees are clean-copied on update.

### Added (owner decisions: default+veto + checkpoint walkthrough, 2026-07-03)

Delivery runs without input by default and stops deliberately. A destructive, scope-changing, or proof-weakening decision is a hard stop; every other decision takes its recommended default (recorded in `docs/bets/<slug>/decisions.md`), proceeds, and batches to the next checkpoint for ratification — the approved tag moves only on ratification, provisional amendments ride a single `[provisional]` commit. **Design-altitude guard:** anything that changes what the owner authored at a design altitude — UI, data flows, API, schema — is an amendment and a hard stop, never a defaulted decision. A new `briefs/checkpoint-walkthrough.md` (frontier, read-only, not a gate) opens each milestone pause and the bet-close review: the change organized by concern, 2–5 blast-radius spots tagged `[auth]/[schema]/[contract]/[data]/[infra]`, suggested front-door observations, the pending decisions queue for ratification, and touched deferred/maturity rows — maintaining the owner's system comprehension as delivery evolves it. Design: `docs/plans/groundwork-v2.md` (W1.6).

- [no-migration] Hidden-skill trees are clean-copied on update.

### Changed (review policy: adversarial fleet, findings ledger, file-backed lens output, 2026-07-03)

The per-slice review drops to **three** independent lenses (blind reviewer, edge-case tracer, coverage auditor default-on); the acceptance auditor is **retired per-slice** (17 runs / 2 catches / 4 false-negatives) and reborn as a **per-milestone honesty audit** — test-mirrors, dead shims, generated-file edits, dropped spec marks, deleted guards — dispatched once at close, its verdict feeding postmortem Q1. The edge-case tracer gains design anchors and a state-machine / lifecycle reachability checklist seeded from the escaped bug classes. Every lens now writes full findings to `.groundwork/cache/bets/<slug>/reviews/<key>/<lens>.md` and **returns exactly** a parseable `VERDICT:` line, ≤5 bucket-tagged findings, and a `FULL:` path — Protocol 8 gates on the verdict in the returned text, so a lens returning only a path is not a pass (fail-closed, stated in every brief). A **findings ledger** gives every finding a disposition (fixed / deferred-with-owner / dismissed-with-reason), and **milestone close blocks while any finding is open**. Design: `docs/plans/groundwork-v2.md` (W1.4).

### Added (fix-in-place ladder, 2026-07-03)

A patch finding is fixed at the cheapest rung that holds the slice's context — driver inline → continuation to the original worker → minimal-capsule fix worker with a strict scope rule — never a fresh agent that re-derives context (the ~41% re-derivation tax this ladder kills). Encoded in `step-02-slice-loop.md` and `briefs/slice-worker.md`. Design: `docs/plans/groundwork-v2.md` (W1.5).

- [no-migration] Hidden-skill trees are clean-copied on update.

### Added (milestone context pack, 2026-07-03)

Delivery gains a per-milestone context pack (`templates/milestone-context.md` → `.groundwork/cache/bets/<slug>/milestone-<NN>-context.md`), distilled at milestone open and refreshed at slice close. It carries **pointers and learnings, never contract text** — design-section pointers, engineer Context-Routing rows, prior-slice `Notes`, postmortem gists, proven recipes, testing obligations, worktree environment facts — so a fresh worker inherits context without re-reading upstream docs and without a second copy of any API/schema/data shape. Staleness is mechanical (`compiled_from` ≠ approved-tag sha), checked at milestone open and after any amendment. The dispatch capsule shrinks to the pack pointer plus slice-specifics; ripple caller lists stay per-slice (never precompiled). Design: `docs/plans/groundwork-v2.md` (W1.3).

- [no-migration] Cache-tier; skills clean-copy on update.

### Added (delivery working state: board.yaml + memlog + `./dev bet log`, 2026-07-03)

Delivery gains a gitignored per-bet working state under `.groundwork/cache/bets/<bet-slug>/`: `board.yaml` (schema v1 — the step-router pointer + a slice status map derived from the decomposition tree, carrying zero proof text) and `memlog.md` (append-only resume index). Neither ever gates — git and the suite are the record, the working state reconciles against them, and on divergence git/suite wins; absent or corrupt, it self-heals from the git log (no migration). A new `./dev bet log <slug> -- "<line>"` appends a timestamped memlog line (documented `printf >>` fallback); `./dev archive bet` now also removes the working-state cache. The cache is gitignored via a seeded `.groundwork/cache/.gitignore`. New Protocol 7 row in the operating contract (additive; contract stays v1). Design: `docs/plans/groundwork-v2.md` (W1.2).

- [no-migration] Cache-tier working state; in-flight bets self-heal from git, and the cache `.gitignore` seeds on the next init/update.

### Changed (delivery workflow: step-file spine, 2026-07-03)

`groundwork-bet`'s 6.6k-word `workflows/04-delivery.md` splits into a thin spine (driver model, restrictions, git workflow, a state→step router) plus per-step files under `workflows/delivery/`: `step-01-readiness.md`, `step-02-slice-loop.md`, `step-03-milestone-close.md`, `step-04-postmortem.md`, and the trigger-loaded `on-amendment.md`, `on-change-navigation.md`, `topologies.md`. The reader loads one step fully, executes it, and follows its transition line — cutting delivery-entry instruction load and making resume cheap. Every gate sentence from the old file survives in exactly one step file. Design: `docs/plans/groundwork-v2.md` (W1.1).

- [no-migration] Hidden-skill trees are clean-copied on update.

### Added (packaging: async update check, init --set, channels doc, 2026-07-03)

`groundwork` now prints a dim "a newer version is available" line after a command when npm's `latest` is ahead — a non-blocking 1500ms best-effort check, all errors swallowed, suppressed on non-TTY / `CI` / `GROUNDWORK_NO_UPDATE_CHECK` / the `update` command. `init --set key=value` (repeatable) seeds a `config.toml` default at install time only; the key allowlist is derived from the seed template, prototype-pollution tokens are rejected, and a `--set` against an existing (user-owned) config refuses rather than mutating it. The `next` dist-tag stays deferred; how one would be cut is documented in the releasing reference. Design: `docs/plans/groundwork-v2.md` (W0.3).

- [no-migration] CLI-only behavior; nothing to reconcile in existing installs.

### Added (skill-lint uplift: description budget, model-id ban, template links, 2026-07-03)

`./dev lint skills` gains three hard rules and one warning: a registered-skill description budget with an intent-shape (no body-summary opener) check; a ban on concrete model ids in the skill trees (tiers name a capability class, not an id); a `templates/`+`briefs/` reference-resolution check; and a non-blocking word-budget warning per over-long skill file. All new rules pass clean on the current corpus. Design: `docs/plans/groundwork-v2.md` (W0.3).

- [no-migration] Dev-time lint only; not shipped.

### Changed (host registry extracted to src/config/hosts.json, 2026-07-03)

The `AGENT_ADAPTERS` map moves out of `bin/groundwork.js` into a data file, `src/config/hosts.json` (`key`, `label`, `detect[]`, `native`, `links[]`, `status`, `notes`); `detectAgents` / `wireAgents` / `promptAgents` / `parseInitFlags` are now data-driven. The schema carries only symlinks-to-canonical or `native: true` — no body-template or copy semantics, so the single-`AGENTS.md`-canon invariant stays structural. A contract test keeps the registry keys/status in sync with the `docs/host-support.md` matrix. Wiring is byte-identical; windsurf is deliberately not added yet (plan §10 open decision 4). Design: `docs/plans/groundwork-v2.md` (W0.2).

- [no-migration] The CLI is framework-owned and clean-replaced on update; `hosts.json` is CLI-internal and never seeded into projects.

### Changed (orchestrator guidance: one position-report procedure + intent-first dispatch, 2026-07-03)

The "what's next" and "help" intents collapse into a single Guidance procedure — position report (setup phase N of M, or the delivery lane state from the pitch `status:`, `./dev bet status`, patch-cluster trailers, a pending upgrade brief, and open maturity rows) → exactly one recommended next action with the phrase that starts it → general questions answered from `docs/` + `llms.txt`, never memory. A new opening-message dispatch rule routes an unambiguous first message in the same turn and asks exactly one clarifying question only when the route is genuinely ambiguous. No third registered skill — the guidance lives in the orchestrator. Design: `docs/plans/groundwork-v2.md` (W0.1b, W0.1c).

- [no-migration] Registered-skill trees are clean-copied on update.

### Added (workflow index: delivery lanes + general-questions row, 2026-07-03)

The generated `workflow-index.md` now carries a Delivery-Loop lanes table (patch / quick bet / bet, each with its scope-test one-liner and route) and a General-questions pointer row (`docs/` + `llms.txt` as the answer corpus). Both are derived from the orchestrator's own Work Intake triage and routing bullets, so the index cannot drift from the actual sizing logic. Design: `docs/plans/groundwork-v2.md` (W0.1a).

- [no-migration] Registered-skill trees are clean-copied on update; the generated index rides along.

### Added (new backend stack: groundwork-node-engineer + client Day-2 checklists, 2026-07-02)

The backend engineer family gains its third member: `groundwork-node-engineer` — Node 22 / TypeScript strict / native ESM, Fastify with zod at every boundary, Drizzle target-state schema with diff-derived migrations, pino + OTel observability deferring to canon, Vitest + Testcontainers honeycomb testing, and dependency-cruiser as the dependency-direction fitness function. Eleven decision-time references including the required staleness firewall, the family's outbox / idempotent-consumer / raw-body-HMAC integration shape, and a sync anchor pinning the six cross-cutting canon files. Skill only — no generator yet (decision D3): it serves forged and hand-built Node backends today and is the doctrine a future `node-microservice` generator will promote. The dev-only `scaffold-designer` also gains Mobile (Flutter) and Desktop (Electron) Day-2 checklists, completing its Backend/Frontend pair. Design: `docs/plans/product-outcomes-uplift.md` (B4).

- [no-migration] Engineer skills are promoted per-language at scaffold time and clean-copied on update; nothing to reconcile.

### Changed (security by default: lenses, routing, the residual ask, tracked deferrals, 2026-07-02)

Security best practice now arrives baked into ordinary work instead of waiting to be asked for. The blind-reviewer and edge-case-tracer briefs treat the top security bug classes (injection, secrets in code/logs, SSRF, unsafe deserialization, missing authz/IDOR, tenant-filter gaps, hostile inputs) as first-class correctness findings, and the acceptance auditor never flags a stack-baseline security control as scope creep. All six engineer skills route security and integration depth off what the code touches — user-input parsing, a write that also publishes, a user-influenced outbound URL — not off task self-labels. What the baseline cannot assume gets one non-skippable ask: architecture Phase 2 (and the brownfield extract) asks three fixed questions — regulated data classes, data residency, abuse exposure — with answers recorded even when "none" and a 🔴 checklist item behind them. And an `--llm` scaffold whose brief names user-facing input records the deferred moderation gate as a maturity roadmap row (backed by new canon: `ai-engineering.md` principle 9, moderation gates on user-facing input), so the deferral ages at bet discovery instead of vanishing. Design: `docs/plans/product-outcomes-uplift.md` (A2–A5, B2).

- [no-migration] Skill prose and briefs ride the clean-copy; the canon edit propagates through the tier-2 refresh/merge path.

### Changed (builder parity: Python catches up to Go, staleness firewalls everywhere, one LLM home, 2026-07-02)

The Python engineer gains `integration.md` (SQLAlchemy outbox in one transaction, ON CONFLICT idempotent consumers, raw-body HMAC webhook verification), Go-grade query-evidence discipline in `database.md` (EXPLAIN ANALYZE before index changes, `pg_stat_statements` read-outs), and an `observability.md` cut to the canon-deferral shape. Every engineer skill now carries a `references/version-corrections.md` staleness firewall on the Next.js pattern — Go 1.22 loop vars and `rand/v2`, Pydantic v2 / SQLAlchemy 2.0 / lifespan / uv, the Material split and SwiftPM default and Riverpod 3 shapes, the Electron currency window and signing renames — routed "check first on any framework-version-sensitive task," with inline date pins relocated there and `groundwork-stack-forge`'s authoring standard requiring the file in every forged skill. The AI/LLM doctrine has one home: Python's near-verbatim restatement of the ai-native canon is cut to a deferral, and all six skills route "LLM/AI feature" to `docs/principles/ai-native/ai-engineering.md` with the stack idiom stated at the routing site. The vendored `golang-pro` (dev-only) carries a note that go-engineer canon wins on conflict. Design: `docs/plans/product-outcomes-uplift.md` (B1–B3, B5).

- [no-migration] Skills are clean-copied on update.

### Changed (sharper gates, zero new lenses — and evidence at the discovery table, 2026-07-02)

Four review-system residuals fixed inside machinery that already exists. Milestone-close honesty is no longer driver self-audit: the acceptance auditor gains a milestone-scope mode — the Proof-of-work prose plus the assembled diff since milestone open, re-deriving the front-door judgment — dispatched at every close (quick bets included), with postmortem Q1 consuming its verdict. Reviewer thoroughness is visible: `groundwork-review` returns a one-line READ manifest (read/skimmed/skipped), caps findings by disclosing what was withheld instead of silently truncating, and walks directory inputs file by file — the design/decomposition callers now pass the directory instead of pre-concatenating. Quick bets keep a UX floor: the experience-auditor is skipped only when no UI surface is in scope. Honor-system obligations age through the maturity roadmap (manual-surface obligations, forged Day-2 items, the brownfield D8 "parity unmeasured" stance row, and `provider: none` capability ports with a new optional `since` date). Decomposition blocks orphan NFR budgets (a stated user-felt budget maps to a milestone proof line or a named fitness function — 🔴), the scaffold's Phase 4 proves the shipped fitness functions actually fire before signing off, and D9 contract compatibility activates on a declared external consumer, not only a second surface. Discovery gets evidence with a light touch: the pitch's signal names where its answer would come from (🟡 advisory — "demonstrable at the front door" is fully valid for greenfield), and intake asks once what reality said about the last bet's signal, where "no users yet" is a recorded, acceptable answer. Design: `docs/plans/product-outcomes-uplift.md` (C1–C3, D1–D4, E1–E2).

- [no-migration] Skill prose, briefs, and checklists ride the clean-copy; the `since` key is optional and additive.

### Added (shipped security gate: `./dev audit` — dependency vulnerabilities + secret scan, 2026-07-02)

Every scaffolded workspace now carries a supply-chain and secrets gate, on by default and callable non-interactively: `./dev audit` runs the ecosystem-native dependency audit per service — `govulncheck ./...` for Go (reachability analysis keeps the gate quiet), `pip-audit` via uv for Python, `npm audit --omit=dev --audit-level=high` for Node surfaces — and `osv-scanner` on lockfiles no native audit covers (Flutter's `pubspec.lock`, forged-stack Cargo/SwiftPM/Gemfile/composer locks), then a `gitleaks` secret scan over the repo (git history when present, directory otherwise). It exits non-zero on findings; a missing scanner binary is a loud skip carrying its pinned install line — the CLI detects-and-instructs, never auto-downloads. Pins live in the bundle and are overridable via an `audit` block in `.dev/dev.config.json`; a `.dev/gitleaks-baseline.json` (written by brownfield adoption) acknowledges pre-adoption history while gating everything after. `groundwork-infra-adopt` Phase 4 offers the gate additively for brownfield repos, with the live-credential-rotation rule stated. Design: `docs/plans/product-outcomes-uplift.md` (A1, settled decision D2).

- [no-migration] The dev bundle is tier-1 (clean-replaced on `groundwork update`), the workspace-cli skill rides the clean-copy, and the infra-adopt change is skill prose. Existing installs gain the command on their next update with nothing to reconcile.

### Added (one map: a manifest-derived module graph in repo-map, 2026-07-02)

`repo-map` now reads the project's **build manifests** into a `module_graph` section of `repo-map.json`: the declared module/target DAG, its external products, and a module-level PageRank ranking — plus `--mermaid`, which renders it to `.groundwork/cache/module-graph.mmd` for docs and humans. Built-in providers cover SwiftPM (`Package.swift`), Cargo (workspace + path dependencies), npm/pnpm workspaces, and .NET project references; a project maps any other build system by committing `.groundwork/config/repo-map.manifests.js` (same replace-on-collision seam as `repo-map.languages.js`). This closes the gap that made projects adopt one-off graph tools: symbols-fidelity languages (Swift, Rust, Kotlin, C#, …) contribute no import edges, but their manifests declare the module topology outright — so the module altitude is now real for **every** stack, from the one tool every other skill already reads. Parsing is deterministic manifest text (no build, no resolution, no network), marked honestly as `method: "parsed"`; `schema_version` bumps to 2 (additive).

- [no-migration] Additive engine + schema change: the map regenerates on next `repo-map` run and consumers treat `module_graph` as optional; a stale cache reparses once from the schema bump. The `repo-map.manifests.js` seam is opt-in per project.

### Changed (delivery code intelligence: driver-side ripple analysis replaces ritual orientation, 2026-07-02)

Two consecutive live deliveries used neither Serena nor the repo map despite canon prescribing both — the always-on orientation step was rationally skipped (the driver's capsule already pre-chews navigation; mid-slice the worker's uncommitted edits make LSP symbols stale), while the one place the tools would have paid off (a rename ripple escaping into a target the test loop never compiles) had no prescription at all. Delivery now puts each tool where its mechanics actually work. **Ripple slices** (new optional `Ripple` field in the slice spec) get **driver-side reference analysis at capsule-assembly time**: the driver — root session, committed code, accurate symbols — warms Serena at first need, runs `find_referencing_symbols`, annotates callers with modules from `module_graph`, and pastes the caller list into the capsule as the worker's checklist. The slice-worker's blanket "orient through the map" step is cut (orient from the capsule; tools are means, not steps). And honest-green gains the **consumer-compile check**: a slice touching a shared symbol is green only when every consumer module (read off `module_graph` edges) compiles — the compiler only vouches for targets the loop actually built. `code-intelligence.md` is reframed around the three altitudes (module = manifest graph, file = import graph where resolvers exist, symbol = Serena) with the staleness rule stated plainly: run reference analysis where the code is committed.

- [no-migration] Skill-prose change only; rides the clean-copy reconcile. The `Ripple` field is optional — existing decompositions are unaffected, and a driver can infer a ripple slice from the diff it implies.

### Fixed (Serena MCP startup nag and browser dashboard popup, 2026-07-02)

Two per-session irritations in every Claude Code install, both traced to Serena's registration. Claude Code asks to approve the project-scoped `.mcp.json` server on every startup because it saves the answer to `.claude/settings.local.json` — a write that fails through the `.claude → .agents` directory symlink, so the approval never sticks ("could not be saved … you will be asked again next startup"). `init` and `update` now approve the server for the whole project in the committed `.claude/settings.json` (`enabledMcpjsonServers: ["serena"]`), which every worktree inherits — the prompt never fires and the un-savable file is never needed. And the Serena entry now passes `--open-web-dashboard false`, so the user-level Serena config no longer opens a browser dashboard tab on every MCP launch; the dashboard stays up and manually reachable.

- [migration] Older installs get the flag appended to a shipped-shape Serena entry and the approval merged into `.claude/settings.json`; user-customized entries, other approvals, and unparseable settings are left untouched (gw-serena-quiet-enable)

### Changed (model tiers set explicitly at every dispatch site, 2026-07-02)

A live delivery run showed slice-workers running at `frontier` despite the `execution` tier policy: the dispatch sites named the tier but left the concrete mechanism one pointer-hop away in the operating contract, and a dispatch that omits the host's model parameter silently inherits the driver's session model — the policy defeated with nothing visibly failing. Every dispatch site now states the rule inline in the doctrine's own class vocabulary — set the tier's model explicitly on the dispatch (the host's Opus-class / Sonnet-class model), never rely on inheritance — and the one concrete reference-host mapping (`frontier`→`"opus"`, `execution`→`"sonnet"`, `light`→`"haiku"` on Claude Code) lives in a single place, the Model Tiers Mechanism paragraph, keeping the canon host-agnostic. The slice-worker dispatch also names its tier→model choice in its one-line dispatch note so an omission is visible to the user watching the run. Touched: the operating contract's Model Tiers mechanism and Protocol 9 dispatch, delivery's slice-worker / review-lens / experience-auditor dispatches, the update driver's reconcile-worker dispatch, and the patch lane's blind-review dispatch.

- [no-migration] Prose clarification of existing tier policy; contract stays v1. Rides the reconcile path for existing installs.

## [0.13.0] - 2026-07-02

### Changed (documentation principles point at the ADR doctrine and match the enforced freshness window, 2026-07-02)

`foundations/documentation.md` §8 defers the ADR doctrine to its single home (`architecture-decisions.md` owns amend-vs-supersede, assumptions, review triggers) instead of paraphrasing it, and the principles freshness row now says 12 months — the advisory window `groundwork-check` actually enforces — instead of a 6-month claim nothing implemented. Five engineer anchor pins re-stamped for exactly these edits; each pin's distilling reference was read and confirmed unaffected (they distill the doc-comment hierarchy, not ADR/freshness content).

- [no-migration] Tier-2 content rides the refresh/merge path.

### Changed (the nextjs engineer skill is a decision-time reference set, not a framework tutorial, 2026-07-02)

The nextjs references rebuilt in the flutter/electron genre: pin conventions, calibrate defaults, correct staleness — never restate the framework manual. A new `version-corrections.md` concentrates the training-data-is-stale corrections previously diluted across four files (async params/cookies, proxy.ts rename, 'use cache', navigation-throw handling, Tailwind v4, hydration causes); `performance-and-deployment.md` becomes `performance.md` with the deployment tutorial and duplicated Web-Vitals content gone; near-identical example bodies collapse to one per pattern. `ux-principles.md` goes values-free — motion values and the feature inventory belong to the project's design system; the reference keeps the engineer-side judgment rules and points at `docs/design-system.md`. Sandbox domain leakage purged (a generic order domain replaces the meeting-transcription examples). Table-of-contents blocks dropped across the reference set. Skill 24,077 → ~18,600 words (−23%); every electron deferral verified still resolving; the Bet Slice Rollout contract byte-identical.

- [no-migration] Ships via promotion for new scaffolds and the Engineer-skills reconcile family for existing installs; zero anchor hash changes (Distilled-into cells updated for the renamed files).

### Changed (engineer family: one home per concept, a real go security distillation, Operating Rules, 2026-07-02)

The go security reference had been re-stamped against its pinned source without content — it now carries a real decision-time distillation (parameterized queries, secrets posture with the eliminate→shorten→rotate hierarchy, SSRF allowlists, supply-chain verification, non-leaking error envelopes), and `integration-realtime-data.md` becomes a concrete `integration.md` (outbox, idempotent consumer, webhook HMAC in Go) deferring the theory to the shipped corpus. All five testing spines defer their shared framing to `docs/principles/foundations/testing.md` by principle number, keeping stack tables, gotchas, and the Bet Slice Rollout obligations verbatim (the briefs cite those strings). Code-intelligence sections shrink to the pointer plus a by-language-property clause; go/python handoff tables collapse; TOCs drop; python's test-tier names align to go's and it gains the missing performance stub + pin. `## Operating Contract` → `## Operating Rules` family-wide (5 engineer + 3 persona skills, one commit) — the heading no longer collides with the real contract file. Product persona gains the ethics-ownership calibration; the designer's usability reference gains the floor-vs-ceiling and complete-pattern distillations its corpus source added in June.

- [no-migration] Skill-prose changes ride promotion for new scaffolds and the new Engineer-skills reconcile family for existing installs; zero existing anchor hashes changed (one new python pin row).

### Removed (the surface-registry bootstrap — every install already has a registry, 2026-07-02)

Surface-activation carried a full registry-reconstruction path for products installed before the surface model existed. Evidence closed the question: every published version (0.10.0 up) ships the surface model, and no pre-publish install remains — so the bootstrap's precondition cannot occur. Retired in one change across every surface that mentioned it: the skill's bootstrap section (replaced by a one-line fail-safe routing a genuinely damaged registry to the update lane's Surfaces family), the orchestrator's routing clause, the update family's bootstrap arm (the family survives, re-scoped to its real ongoing job — registering runner-less surfaces into `./dev`), the reconcile-worker recipe verb, groundwork-check's two no-registry rows (now damage, not adoption), and the dev CLI's message (bundle rebuilt).

- [no-migration] Retirement of an unreachable path; the fail-safe covers corruption. Surfaces family slug unchanged.

### Changed (the architect batch: corpus doctrine single-homed, two references merged, calendar claims retired, 2026-07-02)

One anchor-priced batch across the principles corpus and the architect/product personas. Corpus: resilience patterns, orchestration-vs-choreography, the lethal trifecta, AI economics, and appetite doctrine each get one home with pointers from their former restatement sites; vendor catalogs compress to decision rules (named tools stay as opinionated defaults); `progressive-delivery.md` states its boundary with the bet contract — the general technique ships dark behind a flag, GroundWork's milestone proof is the release gate so trunk needs no flag, and flags stay a team-optional tool inside that guarantee. Personas: `identity-and-access.md` retires into `security-and-trust.md` and `integration-patterns.md` + `durable-execution.md` merge into `integration-and-workflows.md` — the merge surfaced and fixed two live defects (an "exactly-once side effects" overclaim corrected to effectively-once, and a step-count orchestration rule corrected to the corpus's coupling/visibility rule); every adoption-seam filename swept in the same change, verified by the reference-link gate. Calendar claims de-dated on both corpus and reference sides. `decision-records.md` gains the amend-vs-supersede carve-out its corpus source already carried.

- [no-migration] Tier-2 corpus content rides the refresh/merge path; persona skill changes ride the clean-copy reconcile. 10 architect pins + 1 product pin re-stamped — reconciled: the batch's own content edits, itemized in the F2 ledger row.

### Added (promoted engineer skills stop shipping repo bookkeeping — and finally track canon, 2026-07-02)

`promoteEngineerSkill` no longer copies `sync-anchor.md` into scaffolded projects — it pins repo-side `src/` paths that don't exist in a user project (noise at best, a path an agent chases at worst). And the long-standing propagation gap closes: `groundwork update` preserved promoted engineer skills byte-identical forever, so no canon improvement ever reached an existing install. A new **Engineer skills** reconcile family reads the promotion provenance already recorded in `manifest.generated`, re-promotes untouched files from the installed package's canon (dropping stale sync-anchors), surfaces user-edited files as collisions instead of clobbering them, and never touches a skill directory with no provenance record — project-authored skills (e.g. a hand-built swift engineer) stay invisible to it by construction. Drift detection is hash-vs-canonical, not version, so it composes with (never re-runs) the generator-level `regen:` items.

- [no-migration] The skip is generative-path only; existing installs advance via the new reconcile family, not a registry migration. Generation tests assert the anchor's absence and the provenance record; a new CLI test proves the legacy signal survives an update pass.

### Fixed (ways-of-working teaches the current delivery model, not one three overhauls old, 2026-07-02)

The shipped `docs/ways-of-working/` still taught flag-gated internal milestones — the doctrine the front-door redesign retired — and described brownfield support as a roadmap item. Rewritten from current canon, quoting it: a milestone is a thin, user-visible step proven by driving the shipping build through its real front door; trunk only ever receives a complete, validated bet (no feature flag required); requests triage into three lanes (patch · quick bet · bet) with the orchestrator's exact sizing rules; brownfield is the implemented five-phase track it actually is. The Operating Contract section is a pointer at the real contract instead of a paraphrase. All 44 `llms.txt` descriptions re-scented to when-to-read phrasing. New stack-forge sync anchor pins `day-2-operational-baseline.md` (load-bearing but previously unpinned) — the gate now verifies 9 anchors.

- [no-migration] Tier-2 content changes propagate via the refresh/merge path; the new anchor ships with the stack-forge skill via clean-copy.

### Changed (bet briefs cite the testing authority; templates are skeletons; the progress-test guide is a reference, 2026-07-02)

The slice-worker and coverage-auditor briefs cite the engineer skills' `testing.md` **Bet Slice Rollout** section as the authority (its heading and obligation names are a published contract), keeping one-clause citations instead of re-enumerations. The technical-design templates are skeletons again (−40%): the authoring guidance and the API quality standard live in the design workflow that applies them. The bet-progress guide relocates from `templates/` to `groundwork-bet/references/bet-progress-tests.md` (it instructs, it isn't filled in) and is cut to the mechanics only it knows — fixtures, naming, `<N>` semantics, placeholders, screenshot paths; every referencing path swept, including the dev CLI's comment. "Reference apps" resolves to the `## Design References` record in `docs/design-system.md` at every remaining site — the artifact that actually exists.

- [no-migration] Skill-prose + relocation carried by the clean-copy reconcile; dev bundle rebuilt for the CLI comment sweep.

### Changed (setup skills enact the contract's protocols instead of restating them, 2026-07-02)

Every setup skill's commit tail, review invocation, and framing paragraph now carries only its own parameters and points at the protocol that owns the procedure: commit sequences cite Protocol 3.4 with the phase's genuinely local hazards kept verbatim (scaffold's reversal re-review, MVP's two terminal deviations); review invocations state trigger + `document_path` + `document_type` and defer verdict grammar, fail-closed, and the revise cap to Protocols 8/9 — including the ~260-word review block that was tripled across the design-system tracks; the extract skills' revise-cap and completion-signal restatements collapse against the contract's now-landed diagnostics. The review-gate lint is redesigned to match: five markers that still fail a skill dropping its review invocation (verified red/green), without demanding the retired verbatim block. −1,485 words of protocol restatement.

- [no-migration] Skill-prose changes carried by the clean-copy reconcile; the lint change is dev-side.

### Changed (bet delivery reads as the driver's decision sequence, 2026-07-02)

`04-delivery.md` rebuilt around the decisions its driver actually makes (−25%): the topology guidance is a three-row table, the Serena worktree caveat is a pointer at `code-intelligence.md`'s canonical Degraded-mode text, bet-close points at validation's Step 8.5 instead of restating it, tier restatements defer to the contract and the slice files, and the amendment format is stated once. Every heading inbound files reference is preserved; the milestone-close Tier 1–3 definitions and the postmortem judgment framing stay whole. `05-validation.md` confirms rather than restates (Tier-1 duplicate and persona triplication cut).

- [no-migration] Skill-prose changes carried by the clean-copy reconcile.

### Changed (one pitch bar, one flag catalog, an honest stack-forge claim, 2026-07-02)

The pitch canon has one home: `templates/pitch.md` was already the field-level standard, and both writers of `document_type: bet-pitch` now cite it — bet discovery's two near-identical tracks merge into one Pitch Elements walk with a stance-calibration line (restoring **Stakes** to the execution-focused path, which had silently dropped it), and MVP keeps only its first-bet deltas instead of a duplicated example and definitions. Scaffold-side right-sizing: the developer on-ramp spec lives in the phase that writes it; the generator capability/availability tables merge into one catalog (the orchestrator's pointer still resolves); the architecture commit phase stops restating what `templates/adr.md` and the registry contract already say; stack-forge claims its three real contract obligations instead of "binding" the whole contract; the llms.txt step is a visible numbered step. The stack-forge authoring mirror is reconciled with the rebuilt skill-writer standard (register boundaries, budget-by-load-tier, description-is-the-router, one-idea-per-unit, integrate-don't-append).

- [no-migration] Skill-prose changes carried by the clean-copy reconcile.

### Changed (brownfield skills state each stance once, 2026-07-02)

The brownfield lane's shared stances get one home each: the Adopt/Upgrade mode-detection framing lives in product-brief-extract (the track's first phase), with the later extracts keeping only their genuinely local rules (brand-tokens preservation, code-wins reconciliation); the frontmatter-exemption rationale is stated once and cited; repo-map mechanics defer to `code-intelligence.md`; the compose merge is stated as its invariant (merge structurally, never re-emit YAML through the model) instead of a pasted script; the interview triplets, draft-file table, and scan digest framing are tightened. The four signature stances — infer-first-interview-last, mint-nothing-without-rationale, empty-ledger-is-honest, additive-never-destructive — survive verbatim; the design-system-extract's type-section anchor rule is now an unmissable standalone line.

- [no-migration] Skill-prose changes carried by the clean-copy reconcile.

### Changed (the operating contract sheds its restatements; bet doctrine lives in one home each, 2026-07-02)

The contract root: Protocol 1 creates discovery notes from its template instead of restating the header list; Protocol 8's fail-closed rule is two sentences pointing at Protocol 9's procedure (the one home); the revise-cap gains the extract skills' hard-won diagnostic (repeated contract↔body desyncs usually mean an unreconciled Downstream Context file); Lifecycle Modes names the terminal-phase carve-outs (MVP and infra-adopt write no hand-off — there is no next phase to consume one). Model Tiers keeps the policy — two tiers, capability classes, never-downgrade — and sends the mechanics to the one skill that authors and dispatches slices: the per-slice lift lives beside Decomposition Step 4's Model tier field, the advisor/`BLOCKING CONCERN` escalation in the slice-worker brief. `tier:` semantics unchanged; the contract stays v1 with no protocol semantics changed.

Bet-side: `instructions.md` is a router with "The three invariants" (front-door proof · honest green · recorded amendment), each naming its canonical home; the honest-green gaming tells are enumerated in exactly one place (the acceptance-auditor's Honesty check — `TEST_MODE` now greps to one file) with the six satellite restatements collapsed to pointers; delivery names `implementation-readiness.md` as its Step-0 counterpart of the decomposition review.

- [no-migration] Skill-prose changes carried by the clean-copy reconcile; contract version and every protocol number unchanged.

### Changed (setup's shared contracts get one home each, 2026-07-02)

Four identifiers every setup lane depends on were each stated at multiple fidelities; each now has one citable home with consumers pointing at it. The interface-type taxonomy (`graphical-ui | cli | agentic-protocol`) and its "who consumes the output" test live in greenfield design-system Step 2; the extract cites the same test. The `--surfaces` invocation contract (flag shape, per-medium reach rules) lives beside the surface registry contract in `surfaces-contract.md`; scaffold, infra-adopt, and surface-activation cite it and keep only their moment-specific deltas. The Product Brief section list lives in a new `product-brief-template.md` on the architecture-template pattern — greenfield discovery and brownfield extract now draft against the same text (retiring the extract's drifted paraphrase). The Design References record spec is owned by the graphical-ui track's Commit Contributions; the foundation phase triggers it and the extract recovers against it.

- [no-migration] Skill-prose changes + one new hidden-skill file, carried by the clean-copy reconcile.

### Changed (the orchestration spine says everything once — and the templates directory holds only templates, 2026-07-02)

The always-loaded orchestrator router restates less (−323 words; routing tests keep their teeth, rationale lives in the routed skills), groundwork-check's spec sits in its instructions instead of being duplicated across SKILL.md and body (SKILL.md is now a true stub), the persona and writer skills drop restatements their body sections already carry, and groundwork-review's Check 4 folds into the per-type checklists it duplicated — findings now cite checklist items by name. The two review gates name each other: decomposition review (proof quality at authoring) ↔ implementation-readiness (existence/currency at delivery start). Two contract files misfiled as templates relocate to real homes: `.groundwork/skills/templates/{surfaces,capability-ports}.md` → `.groundwork/skills/{surfaces,capability-ports}-contract.md`, with every referencing skill swept in the same change; the gap-ledger severity/recommendation value sets are now defined once in `maturity-model.md` and cited by the ledger template and maturity template instead of restated. `templates/` now holds only fill-in skeletons.

- [no-migration] Skill-prose changes and a tier-1 relocation carried whole by the clean-copy reconcile — old installs' `.groundwork/skills/` tree is replaced on update, so the renamed contract files and every swept pointer arrive together. No protocol semantics changed; the operating contract stays v1.

### Fixed (./dev new milestone|slice discovers the test language and generates valid Python, 2026-07-02)

`./dev new slice`/`new milestone` hardcoded `.py` — the stub's extension now follows whichever test-stub template actually ships in `scripts/cli/templates/` (a future `slice-test.gotmpl` is picked up unprompted; `.py` stays the documented fallback), and the stub ordinal counts by prefix regardless of extension. Two generated-identifier defects fixed in the same pass: the milestone and slice templates interpolated the kebab-case slug straight into the Python `def` name (`def test_slice_1_record-event(` — a SyntaxError pytest hits at import), now substituted as snake_case identifiers while filenames keep the kebab slug `SLICE_RE` parses. Prose adopts the CLI's bet-global slice numbering (`<N>` is the slice's ordinal across the whole bet, not per milestone) in `00-quick.md` and the bet-progress guide.

- [no-migration] CLI + generator-template change; the rebuilt dev bundle ships at scaffold/update, and regenerated projects pick up the fixed templates via the tier-3 reconcile. Existing stubs are project-owned test files — never rewritten.

### Added (self-routing sync anchors + a reference-link gate, 2026-07-02)

Every sync anchor (3 personas + 5 engineer skills) gains a `Distilled into` column mapping each pinned principle to the reference file that distills it — the gate stops saying "review the skill" and starts saying "review this file". A new `reference-link` lint verifies every `references/<name>.md` mention across hidden and engineer skills resolves to a real file (own references first, then the named skill's, then the discipline personas'; `<stack>` placeholders verified against at least one real engineer skill) — the guard that makes reference renames mechanically safe. Two corpus "Related Reading" links that pointed at a nonexistent `../../decisions/` folder now point at the architecture-decisions doctrine page; the go-engineer and product anchors are re-stamped for exactly that link fix (distilled content unaffected).

- [no-migration] Anchor-table and corpus-link changes ride the promotion and tier-2 refresh paths; the lint is dev-side tooling.

### Fixed (shipped-contract point repairs: mis-parented tokens, dead references, a missing Protocol 1 enactment, 2026-07-02)

Six one-file repairs from the distillation review. The brand-tokens template's `platform` block is its own bullet instead of riding inside `references` (a consumer reading the template's shape now sees the real structure). groundwork-elicit points at Downstream Context files instead of the retired "Summary-for-Downstream" sections. Bet delivery's native-UI-check pointer names the real contract (`NATIVE-CHECK-CONTRACT.md`) instead of a plan area that shipped nowhere. The electron accessibility deferral resolves to the nextjs `references/accessibility.md` file that actually exists. The product persona hedges `docs/maturity.md` with "if present" (it reads brownfield projects that may not carry one). The update lane enacts Protocol 1 at close-out — stray signals from the catch-up conversation land in discovery notes instead of evaporating.

- [no-migration] Skill-prose and template changes carried by the clean-copy reconcile; no schema or contract change.

### Fixed (setup chains: every writer has a reader, every pointer resolves, 2026-07-02)

Eight small writer/reader defects across the setup lanes, found by the distillation review. `\.groundwork/context/scaffold.md` had a writer but no reader — MVP Planning now reads it (boot/test commands, env constraints) before scoping over a possibly-unverified scaffold. The scaffold and MVP resume ledgers gain their missing phase rows (Ingestion & Service Mapping renamed to match the phase table; Draft & Review and Commit now marked complete at their steps). The scaffold maturity draft cites only evidence it can point at (checks `.mcp.json` before claiming Serena; roadmap row if absent). Scan exclusions are single-sourced in `references/exclusions.md` (the state-file template and the fan-out brief now point instead of carrying a second drifting copy), and the redundant `scan/complete.md` terminal marker is retired — `state.json`'s `"scan"` entry is the one completion signal (eval descriptor repointed to a durable artifact). The extract and greenfield ADR steps defer their field lists to the governed `templates/adr.md` instead of restating (already-drifted) inline copies. Infra-adopt's service/API doc-shape pointer now names the real file (`groundwork-scaffold/phases/03-service-documentation-api-stubs.md`) instead of a template set that does not exist.

- [no-migration] Skill-prose + template changes carried by the clean-copy reconcile. Frozen install fixtures under `tests/fixtures/installs/` intentionally keep the old strings — they snapshot what old versions shipped.

### Fixed (the full-bet baseline is sealable — the approval tag gets a writer, the Surface field gets one too, 2026-07-02)

The readiness gate hard-blocked delivery on a `bet/<slug>/approved` git tag **no workflow step ever created**, and the slice `Surface:` field the gate and the validation ledger read had readers but no writer — a full bet run honestly following the prose could not pass its own gate. Decomposition's Transition now commits *and tags* the approved baseline (`bet/<slug>/approved`), Delivery's Amendment Protocol re-points the tag at each recorded amendment commit (the tag names the *current* sealed baseline, preserving the ratchet), and the slice spec + `templates/decomposition/slice.md` carry the `Surface:` field with the exact values the gate checks (`core` or a registry slug, registry projects only). The update lane's **Bets family** backfills pre-fix in-flight bets: an approved-but-untagged decomposition gets its tag on the approval commit found by `git log --grep`, or on `HEAD` with a disclosed note when unidentifiable.

- [no-migration] Skill-prose + template change carried by the clean-copy reconcile; the in-flight backfill is a Bets-family extension, not a registry migration. No schema or contract change — the operating contract stays v1.

### Changed (one de-risk term — proof of concept — and a POC scoped against prior proof, 2026-07-01)

A live run scoped a de-risking investigation as a *"spike at the front of discovery"* — two drifts in one phrase. First, **terminology**: the canon had already landed on **proof of concept (POC)** as the single name for a throwaway de-risk (Design, Step 1.92), but "spike" survived as an un-deprecated alias — including two literal `POC/spike` slash-pairs — and leaked back into runs. Every de-risk use of "spike" across the methodology (bet workflows, operating contract, pitch template, slice-worker, delivery, the review lens, `groundwork-mvp`, `groundwork-product`, the principles corpus, and the worked examples) is now **proof of concept / POC**; the unrelated metric/load "spikes" (error-rate, memory, reconnection-rate) are left untouched. Second, **placement**: the de-risk POC is a **Design-phase** activity, not a discovery one — Discovery's solution-sketch and the pitch's Rabbit Holes now say the risk is *named* here but the POC is *run* later in Design (Step 1.92), closing the seam that let a run front-load it. Third, a **prior-knowledge discipline** the run lacked: Step 1.92 now requires scoping a POC against what a prior bet or investigation already proved — carried in as discovery notes, or a prior POC/recipe handed forward at Delivery — and aiming it at the *residual* unknown only, so the process never re-proves signal an earlier spike already retired.

- [no-migration] Skill-prose change only; the clean-copy reconcile carries the renamed term, the placement notes, and the prior-knowledge paragraph. No installed-file, schema, or contract change — the operating contract stays v1.

### Changed (code intelligence is warmed and honestly calibrated, not mentioned-but-skipped, 2026-06-30)

A live audit found Serena and the repo map registered, running, and enabled — and logging **zero** use across a real delivery: the LSP cache was empty and the consumable map was never generated. Two causes, both fixed in canon. First, **the tools were never warmed or reachable where the work happens**: a fresh delivery worktree's `.claude/settings.json` enables no MCP servers (so Serena's tools never load in a worktree-rooted session), and nothing triggered an index. The delivery worktree-bootstrap (`04-delivery.md`) now indexes Serena's symbol cache (`serena project index` — seconds, even on a large tree) alongside the repo-map build, and enables the project's MCP servers in the worktree's `.claude/settings.json`; it also states honestly how `--project .` scopes for a worktree-rooted session vs a root-session Task subagent (root-scoped symbols are accurate for committed code, stale for uncommitted edits — re-index touched files). Second, **the canon mis-sold the value**: it framed Serena's `find_referencing_symbols` as catching the missed-call-site "you'd otherwise lean on the compiler to catch late" — which overclaims for compiled, statically-typed stacks (the compiler already catches it) and understates for dynamically-typed ones (there is no compiler — a missed caller ships a runtime error). `slice-worker.md` and `code-intelligence.md` now calibrate the value **by language property**: correctness-critical for dynamically-typed stacks, a navigation/early-signal win for statically-typed ones (where its real edge is disambiguating a common identifier that text search drowns in), and a symbols-fidelity stack (no centrality/edges) orients off module shape + Serena rather than a ranking it does not have.

- [no-migration] Skill-prose change only; the clean-copy reconcile carries the new bootstrap steps and the calibrated framing. The worktree MCP-enable is a delivery-time bootstrap action the driver performs per worktree, not an installed-file change.

### Added (a model-tier policy — frontier reasoning plans and gates, cheaper execution builds, 2026-06-29)

GroundWork now assigns each dispatched subagent a **model tier** by the reasoning its role needs, turning a long-standing belief into a default: workers can run cheaply *only because* the independent review is the gate, so the gate must run strong. The delivery driver's planning and **every** review lens (the five delivery lenses, `groundwork-review`, and the patch lane's blind-review) run at a **`frontier`** tier; gated execution (`slice-worker`, `reconcile-worker`) runs a cheaper **`execution`** tier. A slice flagged *challenging or vague* when it is authored (new optional **Model tier** field, Decomposition Step 4) lifts its worker to `frontier` for that one slice — one-directional, never below the role default. Tiers name a **class of model, not a model id** (capability-described with cross-provider exemplars — Claude Opus/Sonnet, Gemini Pro/Flash, GPT-5 classes), so the host picks a fitting model at dispatch and the policy survives model and provider churn; a host that cannot set a per-subagent model degrades to all-`frontier` (correct, never weaker). The cheaper tier stays safe in practice because a worker that bumps into something above its weight **escalates to a `frontier` model mid-slice instead of grinding a forced green** — on Claude Code via the built-in **advisor** (`advisorModel`/`/advisor`, which dispatched subagents inherit), with the worker's `BLOCKING CONCERN` hand-back and the frontier review gate behind it where a host has no such mechanism. The canonical policy is the operating contract's new **Model Tiers** section; `docs/host-support.md` surfaces it for users. No code change — briefs carry a `tier:` default and dispatch steps pass the matching model through the host's subagent mechanism.

- [no-migration] Skill-prose + template change only; the clean-copy reconcile carries the new `tier:` frontmatter, the Model Tiers section, and the optional slice field. Existing bets and installs are unaffected — a slice with no Model tier field is the `execution` default, and a host without per-subagent model control runs everything at `frontier` exactly as before.

### Changed (the patch lane derives clustering from git, not a hand-maintained ledger, 2026-06-29)

The patch lane no longer maintains `docs/bets/patch-ledger.md`. Each patch now lands as a single Conventional Commit stamped with `Lane: patch` and `Area: <service-or-surface>` trailers (plus `Override: <reason>` when the user overrides the lane sizing). The clustering signal that escalates "the third patch in one area" to a bet — read by both the patch scope test and bet discovery — is now mined from git history (`git log --grep='Lane: patch'`, grouped by `Area:`, windowed since the most recent archived bet under `docs/bets/_archive/`) rather than from a sidecar file. This removes a manual append step from the pressure-valve lane and a duplicate source of truth that drifts when forgotten; git already carries every column the ledger held — date (commit date), files (`--name-only`), description (subject), and the test (same commit).

- [no-migration] Skill-prose change only. `docs/bets/patch-ledger.md` is a generated project doc, not an installed framework file; an existing one becomes harmlessly orphaned (bet discovery simply stops reading it), and patches are stamped commits going forward.

## [0.12.0] - 2026-06-28

### Added (the quick-bet lane — a middle delivery depth between patch and bet, 2026-06-28)

Three delivery lanes now sit on one spine — **patch** (the floor: a fix or tweak), **quick bet** (new: one small new capability), **bet** (a substantial feature) — and the orchestrator's Work Intake triage sizes any build/change/fix request into a lane and routes it. The quick bet is a compressed track inside `groundwork-bet` (`workflows/00-quick.md`): it collapses discovery, design, and decomposition into one AI-driven, single-approval pass that produces a single milestone, earns an independent `groundwork-review` verdict, then hands that milestone to the existing delivery and validation machinery — which scope down for `track: quick` (no experience-auditor subagent or Tier-3 polish at milestone close, no cross-slice retrospective or per-decision ADRs) while keeping the Tier-1/Tier-2 UX floor and honest-green discipline in full. The patch lane gains calibrated rigor: an inline honest-green behaviour check always, plus the blind-reviewer lens for behaviour-shaped patches (not copy tweaks), and it now escalates a local contract change to a quick bet rather than straight to a full bet.

- [no-migration] Additive lane + skill-prose change; clean-copy carries the new track and the updated orchestrator/patch/bet/validation/review skills. Existing bets and patches are unaffected, and the `groundwork-update` Bets family now recognizes `track: quick` as a legitimate single-milestone shape.

### Added (a capture reminder hook so build requests reach the process, 2026-06-28)

A non-blocking Claude Code PreToolUse hook now ships with each install: when an `Edit`/`Write` happens outside any active GroundWork lane, it reminds the agent to route the change through the orchestrator (which sizes it patch / quick bet / bet). It never blocks the edit and stays silent inside an active lane, in a bet worktree, or on process artifacts — closing the leak where a mid-session "add a delete button" was implemented directly, bypassing the process. The orchestrator's skill description was broadened and an AGENTS.md clause folded in for fresh-session capture; the hook is the deterministic mid-session signal. Claude Code-specific — AGENTS.md-native agents (Cursor/Codex/Cline) keep soft capture.

- [migration] Seeds the capture reminder hook into existing Claude Code installs (`.groundwork/hooks/capture-reminder.js` + a `.claude/settings.json` PreToolUse entry); non-blocking and additive — an install with no `.claude` dir is skipped, and the entry is never duplicated (gw-seed-capture-hook)

## [0.11.0] - 2026-06-27

### Fixed (the update report no longer reads as if it deletes authored skills, 2026-06-27)

`groundwork update` computed its `.agents/skills/` diff against the package's shipped skills alone, so any skill authored beside the framework ones — a promoted engineer skill, a hand-written one — showed up as a red `-` removal line, reading as "your skill is being deleted." The install never touched those skills (it scopes its cleanup to framework-owned names), so the report contradicted the behavior, and the phantom removals also inflated the change total enough to suppress the calm "Already up to date" message on a run that changed nothing real. The report now reads ownership from the same set the installer uses (`ownedRegisteredSkillNames`): authored skills never appear in the diff, and a run whose only difference is an authored skill reports up-to-date.

- [no-migration] Reporting-only change in the CLI; no project artifact shape, install behavior, or migration change. Authored skills were always preserved on disk — only the printed diff was wrong.

### Changed (a bet lands as working, usable software — proven at the front door, 2026-06-27)

A live test run exposed a structural hole: a bet closed all-green — UI tests plus a full package suite — yet the shipped app could not do its core job, because every proof faked the real work (a scripted driver, a fake worker path, hand-written thumbnails, a pre-loaded fake library) and no test ever drove the real product on real data the way a user would. The method *told* it to build this way: decomposition split milestones into a "capability" kind proven headless behind a fake and a "surface" kind wired later, even allowing a bet to finish headless. This release resets the core so a bet cannot be called done unless the real product works, looks right, and is usable.

The milestone model collapses to one shape. A **milestone** is a thin, user-visible step proven by driving the shipping build through its real front door, on the real pipeline and real data, for a named consumer (a person at a screen, a developer calling an SDK, an operator reading a dashboard, a system calling the API — a pure-API product's front door is the API). A **slice** is a vertical cut through one service that builds toward a milestone, slices run in sequence each on the last, and the design system lands in the running app at the first user-visible milestone. The "un-mockable" rule is rewritten as drive-the-real-product-through-the-front-door plus **a fake a test leans on needs a real test behind it** (seeded inputs are fine; faking the work in the middle is the violation), and the ladder must sum to a complete, well-rounded experience — a dead-end screen or a silent-progress view is a *missing milestone*. Delivery proves each milestone at the front door (folding the visual tiers in and adding a polish pass), extends honest-green with the fake-behind-real and shipping-build checks, and Validation's success signal is the owner driving the real shipping product through the agreed front-door cases.

Integrity moves from a heavyweight seal to a **lightweight recorded amendment trail**: the approved decomposition commit is the baseline, steering how slices break down is free, and changing *what a milestone proves* is an owner-approved amendment recorded in git history with a reason — the prose-integrity reconciliation reads that trail instead of a ratcheting `bet/<slug>/approved` tag (retired). The design phase gains a **proof-of-concept step** to de-risk unknowns (throwaway code, learning written into the technical design, a POC result never standing in for a milestone proof) and a best-in-class-pattern discipline (chosen per UX problem, implemented in full, accumulated into the design system). A new **experience-auditor** review lens (the designer persona) judges the assembled, running milestone and the whole bet for patterns-in-full, no dead ends, present states, design-system match, and the joy-to-use bar — distinct from the per-slice coverage auditor. The manifesto gains the front-door proof (belief #4 rewritten) and a UX-first-class belief (#9); `foundations/testing.md` gains the front-door-proof level above the honeycomb; `design/usability-and-ux.md` names the checkable floor (no dead ends, full async states) and the judged ceiling.

The visual gate no longer fails silently on a surface it cannot test: when a graphical surface's platform has no runnable UI check, the `system-test-runner` generator emits a **fail-closed placeholder check** that fails with the named gap (pointing to `NATIVE-CHECK-CONTRACT.md`) instead of silently deleting the checks, and the web render-smoke floor gains a no-dead-end navigation assertion. The actual native UI checks (Flutter/Electron/native) are the named follow-on the placeholder turns green.

- [no-migration] The bet workflows, templates, review briefs, principle docs, and engineer-skill references are framework-owned and clean-replace on update; the `system-test-runner` change only affects newly generated test suites. No project artifact shape, CLI, or migration change. In-flight bets carrying the retired `bet/<slug>/approved` tag are unaffected — the tag simply stops being read; reconciliation falls back to the git history of the decomposition prose.

### Changed (engineer skills brought to full topic parity, and the canon→skill review chain healed, 2026-06-26)

The five engineer skills are brought to deliberate coverage parity against the principle canon, and the structural gap that let them drift is closed. On testing, property-based testing and fuzzing (the canon's input-generation principle) are now first-class in the Go, Next.js, Flutter, and Electron testing references — `rapid` + `go test -fuzz`, `fast-check` + Schemathesis, `glados`, and policy-module fuzzing respectively — and the behaviour-naming template is explicit on every surface. Beyond testing, every cross-cutting concern is now consciously covered or marked not-applicable-with-reason on every stack: dedicated `security.md` (Python/Next.js/Flutter), `documentation.md` (Go/Flutter/Electron), `performance-and-reliability.md` (Flutter/Electron), and `observability.md` (Next.js/Flutter/Electron, client-adapted — distributed tracing stays at the capability core, the client carries crash/RUM telemetry); Next.js accessibility is promoted from a `ux-principles.md` section to its own reference. The per-stack principle docs that ship to projects (`docs/principles/stack/{go,python,flutter}/testing.md`) are refreshed to carry the current canon (honeycomb, in-memory span exporter, mutation, input-generation). Repo-map + Serena orientation is wired into each skill's mandatory first-action flow (Required First Checks / first How-to-Use step), not left as skippable advisory prose.

The recurring-drift root cause is fixed. Each engineer skill's `sync-anchor.md` now pins the central-canon files it distils (testing, observability, security, documentation, performance, reliability, code-craft, accessibility — as applicable per stack) in addition to the per-stack idiom docs. Previously the skills pinned only the per-stack files, so a central-canon change forced zero engineer-skill review; now a canon edit fails `./dev test contracts` for every skill that embeds it, forcing the skill review and a per-stack reconcile in the same commit.

- [no-migration] Engineer skills and their references are framework-owned and promoted into scaffolded projects' `.agents/skills/` per language (clean-replaced on update); the refreshed per-stack principle docs ship through their generators. No project artifact shape, CLI, or migration change.

### Changed (delivery subagents orient through the repo map and Serena, 2026-06-26)

The code-intelligence layer (the deterministic repo map + the Serena MCP server) was prescribed for the engineer persona but never threaded into the delivery orchestration capsules, so a slice-worker or reviewer used it only by chance — a live run found the delivery subagents navigating and verifying with ordinary reads and the compiler while an empty `.serena/` and no `repo-map.json` sat in the bet worktree. This closes the seam. The **slice-worker** brief now opens its context-assembly step by orienting through the map (refresh, read `centrality` for the hubs it lands among — qualified honestly, since centrality is real only for graph-fidelity stacks and a symbols-fidelity stack leans on the symbol index plus Serena) and running live impact analysis with `find_referencing_symbols` before changing any depended-on symbol. The **edge-case tracer** lens — the one review lens that already follows paths out of the diff into existing code — gains a reference-graph pass that enumerates a changed symbol's callers (Serena, or the repo-map edges offline) to catch the caller a dynamically-typed stack's compiler would miss; the blind reviewer stays deliberately diff-only so its blindness remains a distinct instrument. The **Delivery worktree bootstrap** now builds the map in the worktree and documents the `--project .` caveat (Serena resolves to the session root, so it is best-effort in a worktree — lean on the freshly-built map). Every addition carries the existing graceful-degradation contract: when the map or Serena is absent, fall back to ordinary reads and let the compiler and tests be the backstop.

- [no-migration] The bet workflow, review briefs, and `code-intelligence.md` are framework-owned and clean-replace on update. No project artifact shape, CLI, or migration change — and no change to the repo-map generator or Serena registration; the tooling already existed, the delivery capsules simply now point workers at it.

### Changed (delivery rolls out reviewed, comprehensive test coverage, 2026-06-26)

The bet loop gated the *honesty* of a slice's headline proof but left the seam to comprehensive coverage ungated: permanent best-practice tests were rolled out *after* the slice review, so no lens ever judged them, and "the project's testing strategy" they were rolled out against named nothing. This closes that seam end to end. The slice-worker now rolls out the permanent best-practice tests as part of its own job (a new step), so they land in the reviewed diff; a fourth review lens — the **coverage auditor** — holds that suite against the stack's engineer-skill testing strategy for completeness (error/boundary matrix to happy-path rigour, complex-logic unit tests, critical-path trace assertions, named `graphical-ui` states) and assertion quality (a sociable test that executes a branch without asserting is a gap; a surviving mutant on changed high-risk code is the evidence). The four review lenses (blind reviewer, edge-case tracer, acceptance auditor, coverage auditor) are now first-class briefs the driver dispatches by path.

The testing-principles canon is raised to current best practice and the five engineer skills realigned to it: the honeycomb is named as a stack-appropriate heuristic (the trophy for the frontend) anchored on independent-oracles-and-reproducibility, trace-first/ODD is made concrete with in-memory span-exporter assertions and helpers, mutation testing is positioned as the honeycomb's signal-only assertion-quality read-out (degrading gracefully where tooling is weak), and a new input-generation principle covers property-based testing, fuzzing, Schemathesis, and deterministic simulation. Flutter and Electron gain the Bet Slice Rollout sections they were missing.

- [no-migration] The bet workflow, review briefs, review checklist, and engineer skills are framework-owned and clean-replace on update; the `src/docs/principles/` testing and observability canon propagate through `groundwork update`'s Tier-2 refresh/reconcile path. No project artifact shape, CLI, or migration change — existing bets in flight finish under the lens count they started with.

### Fixed (`update` prints a scannable change summary instead of dumping the whole changelog, 2026-06-26)

A version-jump `groundwork update` dumped every line of every changelog entry in the range verbatim — for a 0.9.0 → 0.10.0 jump that is a multi-screen wall of prose. Worse, the "Migration required" list matched *any* line containing the `[migration]` token, so a prose sentence that merely mentions the token in backticks ("Changelog `[migration]` lines now reference registry ids") leaked into the list as a stray, prefix-stripped bullet ("Changelog `` lines now reference registry ids"). The renderer (`bin/groundwork.js`) now prints one bullet per change — `Category — headline`, derived from each `### Category (headline, date)` section header — and surfaces only genuine `- [migration]` bullets, with the token prefix stripped and the registry id preserved. `update --full` restores the verbatim entry dump for anyone who wants it, and a footer points at `CHANGELOG.md` / `--full` for detail.

- [no-migration] CLI output only; `bin/groundwork.js` is framework-owned and clean-replaces on update. No project artifact, migration, or behavior change — only what `update` prints.

## [0.10.0] - 2026-06-25

### Changed (the Naming family now reconciles the relocated hidden-skills path, 2026-06-25)

A live update run surfaced a gap: the hidden methodology skills moved from `.agents/groundwork/skills/` to `.groundwork/skills/`, but `groundwork-update`'s Naming family only carried the `ux-design`/`hexagonal-architecture` renames and the `npx groundwork` → `npx groundwork-method` rewrite — nothing swept doc/script references to the old skills path. Stale references survived an update and were only caught when a review gate happened to read the doc that held one. The Naming family now lists `.agents/groundwork/skills/` → `.groundwork/skills/` as a legacy signal, and the reconcile-worker gains an explicit **reference rewrite** recipe covering both that path and the `npx` rename (touch only the changed token; leave the user-owned `config.toml`, lockfiles, and historical records alone).

- [no-migration] Skill-text only; the `groundwork-update` skill clean-replaces on update. The reconcile it now performs runs against existing installs the next time `update groundwork` is invoked.

### Changed ("update groundwork" reliably routes through the orchestrator, 2026-06-25)

The orchestrator is the front door for framework maintenance, but nothing told the agent so — a project agent that heard "update groundwork" had no signal connecting that intent to `groundwork-orchestrator`, so it would guess (probe npm, grep for a skill) instead of routing. The orchestrator's skill `description` now explicitly claims "update groundwork" / "upgrade groundwork" / "bring this project up to date" as triggers (the description is the only thing a skill-matcher reads), and the consumer `AGENTS.md` "Start here" names the orchestrator as the maintenance entry point too — "don't go hunting for a CLI command or a specific skill." The internal route to `groundwork-update` already existed; this closes the discovery gap that kept agents from reaching it.

- [no-migration] Skill-description and instruction-doc text only; `AGENTS.md` and the orchestrator skill clean-replace on update. No CLI or project-artifact change.

### Changed (groundwork-update orchestrates the catch-up as a context-lean driver, 2026-06-25)

`groundwork-update` no longer runs the whole catch-up inline. It is now a **driver**: the main session holds the thin spine — the upgrade brief, the Family Index, the cheap structural detection, the user pacing, the review gate, and the commits — and farms each unit of work (one brief item, or one reconcile family) to a disposable `reconcile-worker` sub-agent that reads the canonical and the project's instances *in its own context*, makes the change, and returns a short structured report, leaving its edits unstaged for the driver to review and commit. The transform reasoning dies with the worker's context, so the driver stays small enough to reason about the update as a whole. It reuses the bet-delivery driver/slice-worker pattern and the `fan_out` hint convention: with a sub-agent dispatch tool it farms out; without one it degrades to advancing each unit inline, one at a time (it must run everywhere). Units run serially in dependency order — no concurrency.

- [no-migration] Skill-execution-model change only; the `groundwork-update` skill (and its new `briefs/reconcile-worker.md`) clean-replace on update like every framework skill. No project artifact or CLI behavior changes.

### Changed (one update lane, reconciled to the current canonical, 2026-06-24)

The framework now has a single call to bring a project current, and one durable engine behind it. `groundwork-upgrade` is renamed `groundwork-update` and reframed: Phase A still works the residual upgrade brief the CLI compiles (edited seeded docs, a customized launcher, generator output behind its generator), and a new Phase B **reconciles each artifact family to the framework's current canonical** — reading the live shape that ships in `.groundwork/skills/`, detecting divergence, and advancing legacy structure forward with agent judgment. This replaces the change-indexed agent-migration registry: structural advancement is no longer a per-change migration but a target-state reconcile driven by a small ownership map (the skill's Family Index), so a future structural change is picked up for free when its owning skill changes. The standalone `groundwork-docs-uplift` skill folds in as the Docs-site family. The former `groundwork-update` (docs-kept-in-sync-with-your-own-code) is renamed `groundwork-doc-sync` to end the name collision; its behavior is unchanged. The migration registry keeps only its mechanical `cli` migrations; the ten `agent` migrations are retired, their transform knowledge relocated into the Family Index.

- [no-migration] Skill renames clean-replace on update like every framework skill (`installSkillTrees`), and no project artifact stores a skill directory name. Structural advancement that the retired agent-migrations performed is now carried by the `groundwork-update` skill's Phase B reconcile against the current canonical — run it after `npx groundwork-method update`.

### Changed (the bet becomes pure prose; tests and contracts are built in code at Delivery, 2026-06-24)

The bet is now pure prose, and every machine-readable artifact is built in code at Delivery rather than authored up front. Decomposition is a browsable prose tree at `docs/bets/<slug>/decomposition/` (`meta.json` + a milestone `index.md` + a file per slice, each with a **Proof of work** section); the monolithic `decomposition.md`, the `decomposition.json` mirror, and the separate `test-review.md` surface are gone. The bet-progress suite is materialized red at Delivery start from the approved prose, turned green slice by slice — the suite is the board (`./dev bet status`, derived), git is the record. The API/data design prose carries the shapes at design fidelity, so `docs/bets/<slug>/contracts/` is removed; the canonical machine-readable contract is captured code-first into `docs/architecture/api/<service>/` from the running service at Validation. The approval baseline moved from `approval_commit` to the git tag `bet/<slug>/approved` on the approved-prose commit, and the integrity model inverts: the prose is frozen (tamper-checked against the tag) while the code — tests and the generated contract — is free to change. The whole bet is archived at Delivery (`docs/bets/<slug>/` and `tests/bets/<slug>/` → `_archive/`).

- [migration] Existing installs carry old-shape bet artifacts; `decomposition.md` becomes a `decomposition/` prose tree, `decomposition.json` is dropped (the suite + git are the record), `docs/bets/<slug>/contracts/` is removed (the prose design carries shapes; the canonical contract is captured into `docs/architecture/api/<service>/` from running code), and the approval baseline is the git tag `bet/<slug>/approved`. Largely advisory — it names active bets to restructure by hand and mechanically removes obsolete `decomposition.json`/`contracts/` from archived bets and stray `.groundwork/bets/<slug>/decomposition.json` (gw-bet-prose-redesign)

### Changed (the docs site routes two audiences and orders its sidebar as a learning journey, 2026-06-24)

The scaffolded docs site opened on an undifferentiated link dump and rendered its canonical docs as a flat eleven-item sidebar. It now greets two audiences and reads as a product-learning journey. The architecture docs nest under one section, and a skill-authored getting-started on-ramp gives a fresh-clone developer a real front door.

- **Two-audience landing.** `app/page.tsx` keeps the brand hero, then offers two on-ramps over the section grid — "new here — get it running" → `docs/getting-started`, and "understand the product" → `docs/product-brief`. Each card renders only when its target doc exists (a route-existence guard over `source.getPages()`), so a half-populated scaffold degrades gracefully instead of linking to a 404.
- **Product-learning sidebar order.** `seedDocsMeta` orders the top level product-brief → design-system → architecture → ways-of-working → getting-started → bets → … → principles (sunk last and collapsed). Architecture is now a nested folder ordered by a seeded `docs/architecture/meta.json` (index → infrastructure → domain → services → api → decisions), and getting-started by `docs/getting-started/meta.json` (index → setup → dev-cli-reference). Each sub-meta is seeded only when absent, so a hand-tuned project is never clobbered.
- **Nested architecture docs.** `docs/architecture.md` becomes `docs/architecture/index.md`, and `infrastructure.md`, `domain/`, `services/`, `api/`, and `decisions/` move under `docs/architecture/`. The authoring skills (architecture, architecture-extract, scaffold, infra-adopt) and every live cross-reference across the skill corpus, review checklists, orchestrator, and `./dev` now point at the nested paths; the two raw `cat > docs/architecture/index.md` assemble steps gained a `mkdir -p` guard.
- **Skill-authored getting-started on-ramp.** `groundwork-scaffold` (greenfield) and `groundwork-infra-adopt` (brownfield) now author `docs/getting-started/{index,setup,dev-cli-reference}.md` — a routing index, a fresh-clone setup walkthrough (prerequisites → `./dev doctor` → install dependencies → `./dev start`, the content `infrastructure.md` never carried), and a `./dev` command reference derived from `./dev help`. `infrastructure.md` slims to the running-system shape plus the canonical three commands and a pointer to the on-ramp.
- **Docs-uplift target state.** `groundwork-docs-uplift` T4/T5 are rewritten to the nested order and two-audience landing, and route existing flat-layout sites through the migration first.
- [no-migration] Existing installs carry the flat architecture layout (`docs/architecture.md`, `docs/infrastructure.md`, `docs/domain/`, `docs/services/`, `docs/api/`, `docs/decisions/`); the `groundwork-update` skill's Architecture-docs family relocates them under `docs/architecture/` with `architecture.md` becoming `index.md`, rewrites the sidebar metas, and carries live cross-references forward

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
- [no-migration] Existing installs carry a stale summary section atop each setup doc; the `groundwork-update` skill's Doc-contracts family graduates it in place — binding decisions promoted to ADRs or the doc body, then the section stripped — leaving docs/ as clean reference documentation
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
- [no-migration] Existing Next.js apps regenerate their token layer — gaining `app/brand.css`, the restructured token-driven `globals.css`, and `test_token_conformance.py` — with hand-edited `globals.css` reconciled rather than clobbered; the `groundwork-update` skill's Next.js-token-layer family drives this via the generator-regenerate path

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
- [no-migration] Installs carrying the orphaned `hexagonal-architecture.md` from before the reframe have it retired and its live cross-references carried forward to `code-structure.md` by the `groundwork-update` skill's Naming family

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
- [no-migration] Projects scaffolded before the runner registry have a runner-less `dev.config.json`; the `groundwork-update` skill's Surfaces-registry family registers their surfaces and native sidecars as runners without touching db/jaeger compose

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
- [no-migration] Projects carrying `docs/ux-design.md` from before the Design System reframe get the rename and reference uplift from the `groundwork-update` skill's Naming family
- [no-migration] Products set up before the multi-surface restructure get the surface registry + capability ledger bootstrapped by the `groundwork-update` skill's Surfaces-registry family
- [no-migration] Code-coupled docs written before drift tracking get `last_reviewed`/`source_of_truth` frontmatter stamped by the `groundwork-update` skill's Doc-contracts family
- [no-migration] Bets opened before the bet-loop restructure have their tracking files uplifted to the current shape by the `groundwork-update` skill's Bets family

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
  from the specs; validation promotes them to `docs/architecture/api/<service>/` as the canonical record.
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

- [no-migration] Package renamed `groundwork` → `groundwork-method` — the binary stays `groundwork`; the `groundwork-update` skill's Naming family rewrites any `npx groundwork …` invocations in your scripts to `npx groundwork-method …`
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
