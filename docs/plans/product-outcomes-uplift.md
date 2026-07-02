# Implementation Plan: Product Outcomes Uplift (Security by Default, Builder Parity, Sharper Gates)

**Status:** EXECUTED 2026-07-02 — all 18 slices landed (A1–A5, B1–B5, C1–C3, D1–D4, E1+E2), one commit per slice, gates green per slice and full `./dev ci` before merge. Sourced from a full-corpus skill review (all 235 canonical skill files: registered, hidden, engineer, dev-only meta) with each finding spot-verified against the tree. Execution deltas: A1 ships as a new `./dev audit` command (the scaffolded CLI has no `ci` verb) and uses `npm audit` (the scaffolds are npm-based, not pnpm); C2's probe folds `./dev audit` into scaffold Phase 4. Live-sim debt owed per §7: A1 (seeded vuln + seeded credential turning a fresh scaffold red), A2/D1 (seeded IDOR fixture / silently-mocked dependency dry-runs), C2 (probe observed in a fresh scaffold run).
**Audience:** An engineer or agent implementing this change. Each slice names its files and an acceptance check; judgment calls that remain are open decisions in §8.
**Scope owner:** The engineer-skill family (`src/engineer-skills/`) and the `groundwork-bet` delivery briefs/checklists, with coupled changes to the scaffold generators' CI surface, `groundwork-architecture` Phase 2, `groundwork-review`, and the maturity model.

---

## 0. Read this first — the mental model

GroundWork's build-side guarantees are strong and this plan must not regress them: fail-closed review gates, front-door proof, honest green, plan-just-enough laddering, heavy real-path testing (honeycomb/trophy, Testcontainers, trace assertions), and cheap-worker-under-strong-gate model tiering. The review found the risk to *product* outcomes concentrated not in that machinery but at its edges. Four ideas organize the response:

> **Bake in, don't gate.** Security and operational best practice should arrive wired into every scaffolded project and every engineer skill's default path, so an agent doing ordinary feature work lands secure code without ever "doing security work." Flagging is reserved for the residual the baseline can't assume — regulated data, novel trust boundaries.
>
> **Strengthen the builder.** The engineer skills are the hands that write the product. Parity gaps between siblings, routing that only fires on self-identified task labels, and missing stacks translate directly into product defects.
>
> **Feed the next pitch — lightly.** Post-deploy cycles are not this method's job. But delivered bets already author falsifiable success signals; making them *answerable* and giving the answer a seat at the next discovery costs two lines of protocol and zero machinery. Most GroundWork projects are greenfield with no users — nothing here may block or nag.
>
> **Sharpen existing gates, don't multiply them.** The few review-system residuals (milestone-close self-audit, invisible reviewer thoroughness, the quick-bet UX bypass) are fixed inside lenses and checklists that already exist. This plan adds zero new subagent lenses.

---

## 1. Review findings this plan responds to

IDs are referenced by the workstreams below. Every finding was verified against the named file.

### Security baseline (baked-in, not flagged)

| ID | Finding | Severity |
|---|---|---|
| F1 | No dependency-audit or secret-scan gate in the scaffolded `./dev ci` — govulncheck / pip-audit / pnpm audit exist as engineer-skill doctrine (`references/code-craft-security.md`, `references/security.md`), never as shipped gates | High |
| F2 | Delivery review lenses audit correctness/conformance/coverage but are not taught the top security bug classes; `briefs/acceptance-auditor.md`'s "nothing more than the design" can flag a baseline security control as scope creep | High |
| F3 | Engineer-skill routing is keyword-gated on task self-labels: a handler doing write-plus-publish never triggers Go's `integration.md`; input-handling work doesn't pull `security.md`; Flutter deep-link validation hangs off a cross-reference (`SKILL.md` routing tables, all five skills) | High |
| F4 | The residual that isn't standard best practice has no ask: `groundwork-architecture/phases/02-technical-constraints.md` treats regulatory/content constraints as areas to "cover in whatever order flows naturally" — a user who never raises GDPR/HIPAA/PCI is never asked once | Medium |
| F5 | `groundwork-scaffold` defers the LLM moderation/safety gate to bet work with no tracking (`phases/01-ingestion-service-mapping.md` LLM honesty rule) — an AI product handling user input can ship with no moderation and no flag | Medium |

### Builder (engineer-skill family)

| ID | Finding | Severity |
|---|---|---|
| F6 | Python parity vs Go: no `integration.md` (outbox / idempotent consumers / webhook signing); `database.md` lacks Go `postgres.md`'s EXPLAIN/index-evidence discipline; `observability.md` restates all 8 canon principles verbatim where Go's defers (shadow-knowledge violation) | High |
| F7 | AI/LLM engineering doctrine (prompts-as-code, evals-as-CI-tests, output validation at the boundary) lives only in `groundwork-python-engineer/references/ml-systems-ai-engineering.md` — an LLM feature on any other surface inherits none of it | High |
| F8 | Only Next.js has a staleness firewall (`references/version-corrections.md`); Electron and Flutter carry heavy date-pinned advice (currency windows, framework-version defaults) with no equivalent | Medium |
| F9 | Stack holes: no Node/TS-backend engineer skill (Next.js covers Route Handlers/Server Actions only); `scaffold-designer` has Day-2 checklists for Backend + Next.js but not Flutter/Electron | Medium |
| F10 | Vendored `golang-pro` (dev-only, never ships) contradicts go-engineer canon — mandates 80%+ coverage where `testing.md` calls coverage-gated CI an anti-pattern, teaches mocking your own repositories where `testing.md` forbids it — and is stale (`import "constraints"`, `// +build`) | Low (hygiene) |

### Build-side residuals (narrow — the testing doctrine covers the rest)

| ID | Finding | Severity |
|---|---|---|
| F11 | Orphan NFR budgets: a user-felt budget stated in the design system or technical design needs no milestone proof. `workflows/02-design.md` Step 1.92 narrates this exact failure (POC measured 3.7s; shipped path ran 5–10× slower "because nothing re-checked it") but no checklist enforces the mapping; `checklists/design-system.md` flags budgets *without numbers*, not numbers *without proofs* | High |
| F12 | Shipped fitness functions unverified: depguard (`go-microservice/files/.golangci.yml.template`), import-linter (`python-microservice/files/pyproject.toml.template`), and the a11y smoke (`system-test-runner/files/tests/system/test_a11y_smoke.py.template`) all ship — but no scaffold step proves they fire on a violation before `phases/04-infrastructure-verification.md` signs off, and nothing records them in `docs/maturity.md` | Medium |
| F13 | D9 contract compatibility (`maturity-model.md`) activates only when a second surface registers — a single-surface product with declared external API consumers is ungated | Medium |

### Review-system residuals

| ID | Finding | Severity |
|---|---|---|
| F14 | Milestone-close honesty — "did it honestly prove its intent at the front door" — is driver self-audit only (`workflows/04-delivery.md` postmortem Q1); the framework's most-prized invariant has no independent check at milestone scope | High |
| F15 | Reviewer thoroughness is invisible: `groundwork-review` Check 3 reads every upstream doc into a ≤500-token verdict over a concatenated blob; a lazy PRESENT is indistinguishable from a thorough one, and the length cap can silently drop findings | Medium |
| F16 | Quick bets skip the experience-auditor entirely (`workflows/00-quick.md`, `04-delivery.md` quick-bet depth) — a UI change sized as a quick bet gets less UX scrutiny than the identical change sized as a bet | Medium |

### Next-pitch intake

| ID | Finding | Severity |
|---|---|---|
| F17 | The pitch's falsifiable success signal (`workflows/01-discovery.md`) is authored and approved but nothing ensures it is *answerable* — it may name no source any future conversation could consult | Low |
| F18 | Bet discovery reads patch clusters, the maturity roadmap, and discovery notes — but never the delivered bets' own signals; evidence from the wild has no seat at the table | Low |
| F19 | Honor-system obligations never age: `scaffold: manual` surface obligations, forged-stack Day-2 checklist items, and `provider: none` capability ports (`capability-ports-contract.md`) are prose notes nothing revisits; brownfield's deliberately-empty capability ledger leaves D8 parity unmeasured with no tracked gap | Medium |

**Strengths the plan must not regress:** the fail-closed review gate (pass on presence-of-pass only); isolated frontier reviewers over cheap execution workers; front-door proof and honest green with the recorded-amendment ratchet; prose-first decomposition with plan-just-enough laddering; Living Documents with the reversal re-gate; the surfaces twin registry; mutation testing as signal, never a gate; the evidence-required maturity assessments.

---

## 2. Workstream A — Security by default (F1–F5)

The baseline ships wired and on; conversation is reserved for what the baseline can't assume.

**A1 — Shipped supply-chain and secret gates.**
Wire a dependency-audit step into the scaffolded `./dev ci` for every generated stack — natives where they're smarter than lockfile matching: `govulncheck ./...` (Go — reachability analysis keeps the gate quiet), `pip-audit` via uv (Python), `pnpm audit --prod` (Next.js/Electron); `osv-scanner` on `pubspec.lock` for Flutter (Dart has no native audit command) and as the uniform lockfile fallback for forged stacks (Cargo, Swift PM). Secret scanning is `gitleaks` (settled, D2): version-pinned in the dev config, diff-range mode per CI run, `--baseline-path` lets `groundwork-infra-adopt` acknowledge existing history while gating everything after. Both binaries follow one install story — the CLI detects-and-instructs on a missing binary, never auto-downloads. Implemented in `src/generators/workspace-dev-cli/cli-src/` (rebuild the bundle) with per-stack detection following the existing compose-parsed discovery pattern; `groundwork-infra-adopt` offers the same additively for brownfield. Annotate changelog per the shipped-surface rules (tier-1 bundle → clean-replace; generator templates → provenance). *Accept:* fresh scaffold of each stack → `./dev ci` runs the audit and secret steps; a seeded known-vulnerable dep pin and a seeded fake credential each turn the build red.

**A2 — Teach the lenses security-as-correctness.**
Extend `briefs/blind-reviewer.md` and `briefs/edge-case-tracer.md` with the top security bug classes as first-class correctness findings: missing/wrong authorization (IDOR), injection (SQL/command/template), secrets in code or logs, SSRF on outbound fetches, unsafe deserialization, tenant-isolation breaks. No new subagent, no new gate — the lenses already read every diff at frontier tier. Amend `briefs/acceptance-auditor.md`: a security control that is stack-baseline practice (per the stack's engineer-skill security reference) is never "more than the design." *Accept:* brief text shipped; a seeded IDOR fixture diff is flagged by a lens dry-run; `./dev lint skills` green.

**A3 — Route on feature signals, not task labels.**
Rework the Context Routing / Task Routing tables in all five `src/engineer-skills/*/SKILL.md` so security/integration depth loads off what the code touches: any user-input handling → `security.md`; a write that also publishes (event/webhook/queue) → `integration.md`; deep links or external navigation → the link-validation guidance; outbound HTTP with user-influenced URLs → the SSRF section. Keep the tables lean — this is re-keying rows, not adding prose. *Accept:* each SKILL.md routing table carries feature-signal triggers for security + integration; sibling parity confirmed across the five; sync anchors re-stamped with a named reconciliation.

**A4 — One residual ask in architecture.**
`groundwork-architecture/phases/02-technical-constraints.md` gains a single non-skippable question set — regulated-data classes handled (health, payment, minors, PII beyond account basics), data-residency obligations, abuse exposure (user-generated content, messaging, payments) — asked once, answers including "none" recorded in the constraints section and Downstream Context. Bets flag security only when work departs from the baked-in baseline (novel trust boundary, regulated data named here). Mirror the ask in `groundwork-architecture-extract` for brownfield. *Accept:* phase text shipped; `checklists/architecture.md` gains a 🔴 for a missing residual-ask record; review dry-run on a doc without it returns REVISE.

**A5 — LLM safety tracked, not silently deferred.**
When a scaffold provisions `--llm` for a product whose brief names user-facing input, the deferred moderation gate is recorded as a `docs/maturity.md` roadmap row (severity per the model's enums) at scaffold Phase 5 — the same aging mechanism as every other roadmap row, surfaced at bet discovery. No new gate; the deferral just stops being invisible. *Accept:* scaffold fixture with `--llm` + user-input brief → maturity roadmap row present; `groundwork-scaffold` phase text updated.

---

## 3. Workstream B — Strengthen the builder (F6–F10)

**B1 — Python parity pass.**
Three edits to `src/engineer-skills/groundwork-python-engineer/`: (a) new `references/integration.md` — transactional outbox, idempotent consumers, webhook signing/verification — mirroring Go's file at Python idiom (SQLAlchemy outbox table, FastAPI webhook verification); (b) `references/database.md` gains the query-evidence discipline of Go's `postgres.md` (EXPLAIN ANALYZE before index changes, `pg_stat_statements` read-outs); (c) `references/observability.md` cut to Go's canon-deferral shape. Family rule: copy the newest sibling. *Accept:* routing table rows added (keyed per A3); `./dev lint skills` + sync-anchor re-stamp green; observability file no longer restates canon.

**B2 — Generalize the AI/LLM doctrine.**
Promote the LLM-engineering canon out of the Python skill into `src/docs/principles/` (prompts-as-code, evals-as-CI-tests, structured-output validation at the boundary, moderation gates on user input) and give every engineer skill a routed reference that defers to it — Python's `ml-systems-ai-engineering.md` becomes the deep treatment, the other four get a lean stack-idiom pointer (calling an LLM from a Server Action / a Go service / a client via its backend). *Accept:* principle file exists; all five skills route "LLM/AI feature" to it; sync anchors pinned; say-it-once holds (no duplicated doctrine bodies).

**B3 — Staleness firewalls for every skill.**
Generalize the Next.js `version-corrections.md` pattern: Electron and Flutter first (they carry the heaviest date pins — currency windows, SwiftPM/Material defaults), then Go/Python (tooling-status notes). Each skill gets a `references/version-corrections.md` routed as "check first on any framework-version-sensitive task," and inline date-pinned advice moves there. Update `groundwork-stack-forge/references/authoring-engineer-skills.md` to require the section, so forged skills ship it too. *Accept:* five firewalls exist and are routed; stack-forge standard names it; no date-pinned guidance remains outside a firewall file (spot-check per skill).

**B4 — New stack: Node/TS backend engineer skill + client Day-2 checklists.**
(a) `src/engineer-skills/groundwork-node-engineer/` on the backend-family template (copy the newest backend sibling): layering with dependency-direction lint (eslint-plugin-boundaries or dependency-cruiser), honeycomb testing with Testcontainers, `integration.md`, `security.md`, `observability.md` canon-deferral, staleness firewall. Whether a generator ships alongside it is open decision D3. (b) `scaffold-designer/SKILL.md` gains Flutter and Electron Day-2 checklists elaborated from `day-2-operational-baseline.md`, matching the existing Backend/Next.js pair. *Accept:* skill passes `./dev lint skills` + sync anchors; an eval task per the stack-forge eval-before-accept loop lands well; scaffold-designer checklists reviewed against the two client engineer skills.

**B5 — golang-pro hygiene.**
Dev-only, never ships — but it can misguide work on this repo. Either drop it or add a top-of-file vendored-skill note that go work in this repo follows `src/engineer-skills/groundwork-go-engineer/` on any conflict (coverage gates, repository mocking), leaving upstream voice otherwise intact per the vendored-skill rule; recompute `skills-lock.json` only if the file changes deliberately. *Accept:* conflict is unambiguous to a reader of either file; lock hash consistent.

---

## 4. Workstream C — Build-side residuals (F11–F13)

Narrow by design: mutation stays signal-only, no new test machinery, the existing doctrine is trusted.

**C1 — No orphan NFR budgets.**
`checklists/decomposition.md` gains a 🔴: every user-felt NFR budget stated in the design system or `technical-design/` maps to a milestone proof line or a named fitness function — quote the budget that has neither. `workflows/03-decomposition.md` Step 3 names the rule beside the un-mockable-headline rule (same shape: decomposition-time complement to honest green). *Accept:* checklist + workflow text shipped; a fixture decomposition with a stated 200ms budget and no proof returns REVISE in a dry-run.

**C2 — Prove the shipped gates fire.**
`groundwork-scaffold/phases/04-infrastructure-verification.md` gains a fitness-function probe: introduce a deliberate inward-dependency violation → depguard/import-linter must fail; revert; run the a11y smoke where a graphical surface exists. Result recorded in the `docs/maturity.md` initial assessment (evidence, per the model's assessment style — no new dimension; this is D4-adjacent evidence). *Accept:* phase text shipped; scaffold fixture run shows the probe in the verification transcript and the maturity note.

**C3 — D9 for declared external consumers.**
`maturity-model.md` D9 trigger widens: contract-compatibility discipline activates when a second independently-deployed surface registers **or** when `docs/architecture/api/` declares an external consumer. `groundwork-architecture` Phase 5's contract-compatibility conversation asks the "who else calls this?" question for single-surface products. *Accept:* model text + phase text shipped; maturity checklist consistent; `[no-migration]` vs reconcile-family assessed at execution (doc-shape guidance change only).

---

## 5. Workstream D — Sharpen existing gates (F14–F16, F19)

**D1 — Independent milestone-close honesty check.**
Extend `briefs/acceptance-auditor.md` with a milestone-scope mode: at milestone close, the auditor receives the milestone's prose proof lines + the assembled diff since milestone open, and re-derives the front-door judgment — is the proven thing real at the front door, or did a dependency get faked along the way? `workflows/04-delivery.md` milestone close dispatches it alongside the experience-auditor; postmortem Q1 consumes its verdict instead of self-attesting. One brief edit, no new lens. *Accept:* brief + workflow shipped; a fixture milestone with a silently-mocked dependency is flagged in a dry-run.

**D2 — Reviewer thoroughness contract.**
`groundwork-review/instructions.md`: (a) the verdict block gains a one-line read manifest — files fully read, files skimmed/skipped — so the caller can see coverage; (b) the ≤500-token discipline becomes "cap the findings list and disclose `N further findings withheld for length`" rather than silent truncation; (c) oversized multi-file inputs (decomposition trees, technical-design directories) are read per file, not as one concatenated blob — callers pass the directory, the reviewer walks it. *Accept:* instructions shipped; callers that pre-concatenate (`03-decomposition.md`) updated to pass paths; dry-run verdict shows the manifest.

**D3 — Quick-bet UX floor.**
`workflows/00-quick.md` + `04-delivery.md` quick-bet depth: the experience-auditor skip applies only when the quick bet touches no UI surface; any user-visible change gets the auditor at bet scope (Tier-3 polish pass remains skipped — the floor is inspection, not polish). *Accept:* workflow text shipped; depth table updated in both files consistently.

**D4 — Obligation aging.**
Route the honor-system obligations through the roadmap mechanism that already ages work: `scaffold: manual` surface obligations and forged-stack Day-2 checklist items land as `docs/maturity.md` roadmap rows at their creating phase; `provider: none` capability ports gain a `since:` date in `.groundwork/capability-ports.json` and surface in the maturity assessment while unbuilt; brownfield's empty capability ledger is recorded as an explicit D8 "unmeasured" roadmap row at `groundwork-infra-adopt` commit. Bet discovery already reads the roadmap — no new reader needed. *Accept:* each creating skill's text updated (`groundwork-scaffold` Phase 1, `groundwork-stack-forge` Stage 6, `groundwork-surface-activation` Step 3, `groundwork-infra-adopt` Phase 5); fixture runs show the rows; shape changes to `capability-ports.json` get a `cli` migration if the key is added mechanically.

---

## 6. Workstream E — Evidence at the discovery table (F17, F18)

Light touch, never a blocker. Post-deploy stays out of the method; the method just gives evidence a seat when it exists. Most GroundWork projects are greenfield with no users — both slices are calibrated for that.

**E1 — Signals name their source (advisory).**
`checklists/decomposition.md` gains a 🟡 (never 🔴): the pitch's success signal names where its answer would come from. For a product with users: an event, metric, or support-queue count — and if the product doesn't emit it, a slice does or the signal is rewritten. For a greenfield product with no users: "demonstrable at the front door" is a fully valid source. Never forces instrumentation onto a user-less product. *Accept:* checklist line shipped at 🟡; `workflows/01-discovery.md` pitch guidance names the source expectation in one sentence.

**E2 — Discovery asks what reality said.**
`workflows/01-discovery.md` intake (alongside patch clusters, maturity roadmap, discovery notes) adds one step: read the archived pitches' success signals (`docs/bets/` archive) and ask the user once — "did reality say anything about the last bet's signal?" A number, an impression, "no idea," or "no users yet" are all recorded, acceptable answers; the last two cost one sentence and the conversation moves on. No scheduler, no outcome files, no maturity dimension, nothing that can block or nag. *Accept:* workflow text shipped; the question is a single intake bullet, not a stage.

---

## 7. Sequencing

```
WS-A (A1–A3 first — default-strength wins; A4, A5 anytime)   A2/A3 are brief/table edits, cheap
WS-B (B1→B2→B3 early; B5 anytime; B4 last — largest)          B2 blocks nothing but feeds A5's doctrine
WS-C (independent, after A-series lands its checklist idiom)
WS-D (D1 after A2 — same brief file; D2–D4 independent)
WS-E (anytime — two one-line edits)
```

Gates on every slice: `./dev lint skills`, `./dev check sync-anchors`, `./dev test contracts` (+ `generation`/`compilation` where generators change), full `./dev ci` before merge; changelog lines with migration / reconcile-family / `[no-migration]` annotations per the contributor guide; operating contract stays v1 (everything here is additive to skills, briefs, checklists, and generators — confirm per slice). Live-simulation debt is recorded per repo convention: A1, A2/D1, and C2 each owe a live-sim observation before the claims graduate from "shipped" to "proven."

---

## 8. Decisions

### Settled

| # | Decision | Resolution |
|---|---|---|
| D2 | Scan tooling (A1) — settled 2026-07-02 | Secrets: **gitleaks** (MIT single static binary, diff-range mode, `--baseline-path` for brownfield adopt; trufflehog rejected as default — AGPL plus live credential verification is network-dependent and exercises found secrets; detect-secrets rejected — Python runtime not guaranteed on every stack). Dependency audit: **per-ecosystem natives** (`govulncheck` for reachability, `pip-audit`, `npm audit --omit=dev` — the scaffolds are npm-based, correcting this plan's pnpm assumption) with **osv-scanner** for Flutter and forged-stack lockfiles. Versions pinned in the dev bundle, overridable via the `audit` block in `.dev/dev.config.json`; detect-and-instruct install story, never auto-download. |
| D1 | Architecture residual-ask wording (A4) — settled at execution 2026-07-02 | Fixed three-question set (regulated data classes, data residency, abuse exposure), answers recorded even when "none" — variants invite skipping. |
| D3 | Node/TS backend skill scope (B4) — settled at execution 2026-07-02 | Skill only. A generator is its own plan once the skill's doctrine has survived real use; until then the skill serves forged and hand-built Node backends. |
| D4 | golang-pro (B5) — settled at execution 2026-07-02 | Annotate — a top-of-file vendored-skill note names the conflicts and defers to go-engineer canon; upstream voice untouched, lock hash recomputed. |
| D5 | D9 widening mechanics (C3) — settled at execution 2026-07-02 | Maturity-model text only. A `groundwork-check` rule waits until a fixture proves the declared-external-consumer signal is mechanically detectable. |

### Open (user)

None — the four open decisions settled on their default proposals at execution.
