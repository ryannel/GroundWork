# Implementation Plan: Contract-Grade Delivery (Machine-Readable Design, Signed Tests, Visible Progress)

**Status:** Proposed — produced by a full framework review on 2026-06-10. No workstream started.
**Audience:** An engineer or agent implementing this change. Each slice names its files and acceptance check; judgment calls that remain are listed as open decisions in §8.
**Scope owner:** `groundwork-bet` skill and the `workspace-dev-cli` / `system-test-runner` generators, with coupled changes to `groundwork-check`, the operating contract, review checklists, and framework lifecycle docs.

---

## 0. Read this first — the mental model

GroundWork's thesis: **human engineers focus on design — UX, API contracts, schema, dataflows, key business logic — lock that design down in reviewed tests, and use those tests to drive and track sliced delivery of implementation work done by AI agents.**

The 2026-06-10 review found the workflow layer delivers ~70% of this thesis. The five-phase bet loop is sound: design is locked before decomposition, bet-progress tests are written red before any implementation, vertical slices are enforced, review gates are fail-closed, and Living Documents keeps the doc set current. What's missing is the **enforcement layer** that turns the thesis from a protocol agents are asked to follow into a contract the tooling makes impossible to break. Three gaps carry almost all of the risk:

> **Gap 1 — Design is prose when tests are written.** API contracts become machine-readable (OpenAPI/proto/AsyncAPI) only as a *delivery-close* requirement. During Decomposition, slice tests are authored against markdown shape descriptions, not generated clients. The contract exists in executable form only *after* the work it was supposed to govern.
>
> **Gap 2 — Tests are reviewed for structure, not signed for meaning — and nothing locks them.** The Proof of Work walkthrough has the user "confirm the test files exist, and confirm the suite is red" (`workflows/03-decomposition.md`). No step makes the human *read the assertions* cheaply, and once delivery starts, nothing technically prevents the implementing agent from editing an approved test until it passes. The reviewed tests are the contract — but the contract is unsigned and unsealed.
>
> **Gap 3 — Progress lives only in pytest output.** Which slices are done, which milestones are proven, what remains — all of it requires running the suite and reading the terminal. There is no machine-readable decomposition manifest and no `./dev bet status` board. "Tests track delivery" is true only for someone watching the test runner.

This plan closes those three gaps (WS-B, WS-C, WS-D), pays down the verification debt that blocks credible 1.0 claims (WS-A), builds the capabilities the locked-contract model enables — parallel agent delivery and richer generated test types (WS-E, WS-F) — adopts the strongest delivery-loop mechanics from BMAD's implementation phase (WS-H, added 2026-06-10), and finishes with release engineering (WS-G).

**The organizing idea:** every artifact a human reviews gains a machine-checkable twin, and every approval gains a seal the tooling enforces. Prose stays — it carries rationale — but it stops being the only representation of anything an agent builds against.

---

## 1. Review findings this plan responds to

Condensed from the full audit. IDs are referenced by the workstreams below.

| ID | Finding | Severity |
|---|---|---|
| G1 | API contracts are prose at design/decomposition time; machine-readable spec is only a delivery-close gate (`workflows/02-design.md`, `04-delivery.md`) | High — core thesis |
| G2 | No semantic test-review gate: Proof of Work confirms test *existence* and *redness*, not assertion correctness; review checklist checks structure/traceability only | High — core thesis |
| G3 | Approved bet-progress tests are mutable during delivery; no hash/lock, no CI gate, no amendment protocol | High — core thesis |
| G4 | No slice/milestone progress surface; no machine-readable decomposition manifest; `status:` frontmatter tracks phase, not slices | High — core thesis |
| G5 | Brownfield path never observed end-to-end in live Claude Code (S19 sandbox seeded, session not run) | Critical — verification |
| G6 | Orchestrator state-reconciliation table-tests missing from `tests/cli/` despite S20 marked done | High — verification |
| G7 | Bet-lifecycle restructure Half 2 (generator templates) not started — scaffolds emit templates out of sync with the five-phase methodology | High — consistency |
| G8 | Scaffold generators don't write drift-tracking frontmatter (`source_of_truth`, `last_reviewed`) into the docs they produce — TODO in `groundwork-scaffold` Phase 2 | Medium |
| G9 | 16 of 20 hidden skills lack frontmatter consistency; `./dev lint skills` rule not present | Medium |
| G10 | No contract-test scaffolding in generated projects (no OpenAPI conformance, no generated-client tests); Playwright optional with no page-object structure | Medium — expansion |
| G11 | npm name `groundwork` held by unrelated package; release workflow stuck on `--dry-run` (F21) | Blocker for publish |
| G12 | Unpinned `postgres`/`redis` images; no generator `--dry-run`; CLI exit codes undocumented | Low |
| G13 | Judge rubric for simulation assessment referenced but not committed as a reproducible checklist | Medium — verification |
| G14 | `docs/groundwork-vs-bmad.md` wrongly claimed BMAD "stops at documents" — BMAD v6 ships a full implementation phase (sprint tracking, story context capsules, test-first dev loop, 3-layer code review, retrospectives). Doc corrected 2026-06-10; the mechanics worth adopting are Workstream H | High — positioning + adoption |

**Strengths the plan must not regress:** the operating contract's protocol discipline; the two-layer skill economy (3 registered, rest hidden); red-tests-first decomposition with vertical-slice enforcement; isolated fail-closed review subagent; Living Documents + reversal protocol; maturity model as a schedulable roadmap; discovery-driven test infra (compose-parsed, no manifests); OTel tracing verified end-to-end in generated services.

---

## 2. Workstream A — Verification debt (do first; cheap, asymmetric credibility)

Nothing in B–G is trustworthy if the framework's own claims aren't verified. These slices are independent and parallelizable.

**A1 — Run the brownfield simulation live (G5).**
Re-seed the S19 sandbox (`./dev sandbox --brownfield --simulate`) per the second-pass sweep note, run `/simulate-brownfield` in a live session through Scan → 3 extracts → Infra Adopt → first bet. Harvest checkpoints (`./dev sandbox checkpoint capture`). *Accept:* `./dev sandbox review` checklist green; transcript + judge report committed under `docs/examples/` or referenced from the plan.

**A2 — Re-run greenfield with the current skill set.**
The last green run predates the Protocol 9 / elicit / step-file-split changes. *Accept:* same as A1 for `/simulate-greenfield`.

**A3 — Orchestrator state table-tests (G6).**
Add table-driven tests to `tests/cli/` covering: greenfield completion detection, brownfield scan→extract routing, doc-present-but-not-completed reconciliation, completed-but-doc-missing removal, version stamping. *Accept:* tests exist and pass in `./dev test contracts` or a new `./dev test cli` lane.

**A4 — Commit the judge rubric (G13).**
Promote the `/judge` command's rubric into a versioned file the seeder copies, so simulation assessment is reproducible. *Accept:* rubric file in `tests/evals/`, referenced by `scripts/seed_simulation.js`.

**A5 — Hidden-skill frontmatter sweep + lint (G9).**
Normalize `name`/`description` frontmatter across all hidden skills; add the missing `./dev lint skills` rule. *Accept:* lint passes; CI runs it.

**A6 — Bet-lifecycle Half 2 (G7).**
Execute Workstreams E–I of `docs/plans/bet-lifecycle-restructure.md` — generator templates updated to the milestone-in-decomposition pattern. *Accept:* that plan's §14 gates pass.

**A7 — Scaffold writes drift frontmatter (G8).**
Close the Phase 2 TODO in `groundwork-scaffold`: generated `docs/infrastructure.md`, service docs, and domain stubs carry `source_of_truth` + `last_reviewed`, making `groundwork-check` effective from day one. *Accept:* fresh scaffold → `npx groundwork-method check` reports all docs assessed (none "unassessed").

---

## 3. Workstream B — Design compiles: machine-readable contracts at design time (G1)

**The shift:** contracts move from a delivery-close *obligation* to a design-phase *output*. Prose in `technical-design.md` carries rationale and error-case guidance; the shapes themselves live in spec files the toolchain can generate clients and validators from.

**B1 — Design Foundations emits spec files.**
`workflows/02-design.md`: the API Contracts step writes `docs/bets/<slug>/contracts/` — `openapi.yaml` (HTTP boundaries), `asyncapi.yaml` (events/websockets, when present), and a schema artifact for the Data Schema section (see decision D2 in §11). `technical-design.md`'s contract sections become rationale + error-case narrative that **references** the spec, never restates field tables. The design review gate (technical-design checklist) gains: *"Every boundary in the Data Flows section has a corresponding operation in the spec files; no shape is defined only in prose."*

**B2 — Decomposition consumes the spec.**
`workflows/03-decomposition.md`: slice system-tests are written against clients/validators generated from `contracts/openapi.yaml` (Go: oapi-codegen; Python: generated httpx client or schema-validating fixture; the system-test runner gains a `contract_client` fixture). A test that hand-rolls a request shape the spec doesn't define is a review-blocking finding. *Accept:* decomposition checklist updated; system-test-runner template ships the fixture.

**B3 — Contract drift detection.**
Generated Go (Huma) and Python (FastAPI) services already serve their runtime OpenAPI. Add `./dev check contracts`: diff each service's served spec against the design spec of every delivered bet that touched it; report additive vs breaking drift. Wire into `groundwork-check`'s staleness report and CI. *Accept:* introducing an undeclared endpoint in a scaffold sandbox turns the check red.

**B4 — Delivery-close requirement becomes reconciliation.**
`workflows/04-delivery.md` / `05-validation.md`: instead of "produce machine-readable docs before close," validation **promotes** the bet's spec files into the canonical per-service spec (`docs/api/<service>/openapi.yaml`), running B3's diff as the proof. Living Documents protocol references spec promotion explicitly.

**B5 — Interface design gets a checkable skeleton (graphical-ui track).**
Lighter-touch than APIs: the Interface Design section's view states (loading/empty/active/error/degraded) are listed in a small structured block (table or YAML fence) that the milestone interface-test template enumerates 1:1. No DSL, no new format — just a shape the decomposition reviewer and test generator can mechanically cross-check. *Accept:* decomposition checklist verifies every declared state has an interface-test assertion.

---

## 4. Workstream C — The signing gate: tests become a sealed contract (G2, G3)

**The shift:** "reviewed tests" becomes literal. The human signs the suite; the seal is enforced by tooling; breaking the seal has a protocol.

**C1 — Test review surface.**
New decomposition step (between Step 6 and the Step 7 review): generate `docs/bets/<slug>/test-review.md` — for each milestone/slice: required capability → contract operation (from B1 specs) → test file → **the verbatim assertion block**, with a one-line plain-language reading of what each assertion proves. This is what the human reads at Proof of Work, instead of being told "the files exist and they're red." Rendered by a script (`./dev bet render-tests <slug>`) so it can't drift from the real test files. *Accept:* the walkthrough step in `03-decomposition.md` is rewritten to walk this document assertion-by-assertion.

**C2 — Semantic test-review checklist.**
Extend the decomposition review checklist (and `groundwork-review`'s decomposition type) with correctness criteria: assertion matches the capability's postcondition; failure cases from the contract's error table are covered; no tautological or always-passing assertions; no assertion against internals (black-box only); red for the right reason (feature absent, not import error). *Accept:* checklist shipped; a seeded wrong-assertion fixture is caught in a review dry-run.

**C3 — The lock manifest.**
On user approval at Proof of Work, write `.groundwork/bets/<slug>/test-manifest.json`: SHA-256 per approved test file + the approving review verdict reference + timestamp. `./dev test bet <slug>` verifies hashes before running; mismatch = hard fail naming the modified file. CI gate likewise. *Accept:* editing an approved test file makes `./dev test bet` fail closed.

**C4 — The amendment protocol.**
Operating contract gains a short protocol (or an extension of Protocol 2): an approved bet-progress test may change only via an explicit amendment — agent states what the test asserted, why it's wrong (traced to a contract or design defect, which triggers the existing "revert to Phase 2" rule when structural), the human approves, manifest is re-stamped. `workflows/04-delivery.md` adds the prohibition in its constraints: *implementing agents never edit `tests/bets/<slug>/`; a red test that looks wrong is a stop-and-escalate, not an edit.* *Accept:* contract version note + delivery workflow text; simulation A1/A2 personas extended with one "agent tempted to fix the test" probe.

**C5 — Sign-off recorded in the bet.**
`decomposition.md` frontmatter gains `tests_signed: <date>` + manifest path. `groundwork-check` flags a bet in `delivery` status whose manifest is missing or stale. *Accept:* checklist + check rule shipped.

---

## 5. Workstream D — The progress surface: tests track delivery visibly (G4)

**D1 — Machine-readable decomposition manifest.**
Decomposition writes `.groundwork/bets/<slug>/decomposition.json` alongside the prose doc: milestones → slices → capabilities → test file/node IDs. The prose `decomposition.md` remains the reviewed artifact; the JSON is generated from the same pass (and regenerated by `./dev bet render-tests`). *Accept:* schema documented; seeder + templates updated.

**D2 — `./dev bet status [<slug>] [--json]`.**
Runs (or reads the last result of) the bet-progress suite, joins against D1's manifest, renders a board: milestone → slice → ✅/🔴 per test, percent complete, current slice. `--json` for CI and dashboards. This is the single answer to "where is the bet?" for a human who never opens a terminal test run. *Accept:* board renders correctly against a half-delivered fixture bet in the scaffold sandbox.

**D3 — Per-slice status in delivery.**
`workflows/04-delivery.md`: completing a slice updates `decomposition.json` (`status: delivered`, timestamp, commit ref) — delivery progress survives context resets and is diffable in git history. Validation's report (Phase 5) is generated from the manifest rather than re-derived. *Accept:* a resumed delivery session reads the manifest and continues from the right slice without re-running everything.

**D4 — Orchestrator awareness.**
`state.json` gains the active bet slug + phase; the orchestrator's routing answer to "where were we?" includes the D2 board summary. *Accept:* orchestrator table-tests (A3) extended for bet state.

---

## 6. Workstream E — Parallel slice delivery (the payoff)

Sealed tests + vertical slices + a machine-readable manifest make slices safely parallelizable: each slice has an unambiguous, tamper-proof done-signal. This is the capability that justifies the enforcement work — and a genuine differentiator. BMAD's delivery loop supports parallel story work but recommends sequential execution, because its stories share unsealed context and learnings flow story-to-story; sealed tests and locked contracts are what make parallelism safe rather than risky.

**E1 — Slice independence marking.** Decomposition marks which slices within a milestone are independent (no shared files/contract surface) vs ordered. Stored in `decomposition.json`. The default stays sequential; parallelism is opt-in per milestone.
**E2 — Parallel delivery mode in `04-delivery.md`.** For independent slices: dispatch one implementing subagent per slice in an isolated git worktree; merge gated on (a) that slice's tests green, (b) lock manifest intact, (c) full bet suite green post-merge. Failures return the slice to sequential handling — no debugging across worktrees.
**E3 — Simulation coverage.** A suite whose bet decomposes into ≥2 independent slices, run live (A1/A2 infrastructure). *Accept:* transcript shows two slices delivered by parallel subagents, merge gate enforced, board (D2) reflecting both.

*Scope guard:* E ships **after** C and D are verified live. Parallel delivery against unsealed tests multiplies the exact risk C exists to remove.

---

## 7. Workstream F — Opinionated test-surface expansion (G10)

Stay opinionated: deepen the stacks we have rather than adding stacks (explicitly deferred — see D4 in §8).

**F1 — Contract conformance tests, generated.** System-test runner gains a generated conformance suite per service: every spec operation exercised against the running service, responses schema-validated (schemathesis or equivalent for FastAPI/Huma). Free coverage from B1's specs.
**F2 — Playwright structure for graphical-ui.** Page-object scaffold + a11y smoke (axe) generated with the nextjs-app when interface medium is graphical-ui; milestone interface-test template imports the page objects instead of raw selectors.
**F3 — Engineer-skill test guidance.** Go/Python/Next engineer skills gain a short permanent-test taxonomy section (unit vs honeycomb perimeter vs property-based, when each earns its keep) so Phase 4's "roll out permanent tests" has stack-specific teeth.
**F4 — Hygiene (G12).** Pin `postgres`/`redis` image versions in compose injection; add generator `--dry-run`; document CLI exit codes in `--help`.

---

## 8. Workstream H — Delivery-loop mechanics adopted from BMAD (added 2026-06-10)

A corrective study of BMAD v6's implementation phase (`/Users/ryannel/Workspace/mbad-method/src/bmm-skills/4-implementation/` and `core-skills/`) — prompted by the G14 research error — surfaced mechanics that translate cleanly into bet vocabulary without importing the story model. Each slice names its BMAD source so the lineage is auditable.

**H1 — Slice delivery record.**
When a slice completes, the delivery workflow writes into `decomposition.json` (with prose mirror in the validation report): the baseline commit captured at slice start, the file list (every file added/modified/deleted), completion notes, and any deviations with rationale. *(BMAD: the story file's `baseline_commit` frontmatter, File List, Change Log, and Dev Agent Record — the story file as spec, tracker, and completion log in one.)* Builds directly on D1/D3 — implement together. *Accept:* a delivered fixture slice carries all four fields; the Phase 5 validation report is generated from them rather than re-derived.

**H2 — Slice context capsule.**
`workflows/04-delivery.md` gains a per-slice context-assembly step before any implementation: read the previous slice's delivery record (learnings, patterns, review feedback); read **every existing file the slice modifies** and record current state / what this slice changes / what must be preserved; scan recent git history for conventions; just-in-time web research for any library the slice pins. *(BMAD: `create-story` as "context engine", including its rule "READ FILES BEING MODIFIED — skipping this is the primary cause of implementation failures and review cycles".)* *Accept:* workflow text shipped; a simulation transcript shows the capsule being assembled before code.

**H3 — Orthogonal review lenses + acceptance auditor.**
Delivery-phase code review runs three parallel lenses instead of one: a **blind reviewer** (diff only, no context — catches what familiarity hides); an **edge-case path tracer** (diff + repo read access, mechanically enumerates unhandled branches/boundaries, structured findings); an **acceptance auditor** (diff + the locked contracts from WS-B + the signed suite from WS-C — verifies the implementation does what the contract says and nothing more). *(BMAD: `bmad-code-review`'s Blind Hunter / Edge Case Hunter / Acceptance Auditor. GroundWork's auditor is strictly stronger because its spec is machine-readable.)* *Accept:* review invocation updated (Protocol 9 composes the three lenses); one transcript with all three reporting and findings deduplicated.

**H4 — Triage buckets wired to the maturity ledger.**
Review findings are triaged: **decision-needed** (blocks slice completion until the user rules), **patch** (fix now or convert to explicit follow-up), **defer** (pre-existing, not caused by this slice), **dismiss** (noise, not persisted). Defer items append as rows to `docs/maturity.md` with severity — GroundWork already has the gap ledger that BMAD's `deferred-work.md` approximates; integrate, don't duplicate. *(BMAD: `bmad-code-review` Step 3 triage.)* *Accept:* triage section in the review flow; a deferred finding lands as a maturity row in a fixture run.

**H5 — Bet retrospective with follow-through.** *(User-flagged high value — schedule early; pure methodology, no dependencies beyond H1's records as best-case input, degrades gracefully without them.)*
Validation gains a retrospective step with four distinct mechanics, each load-bearing:

1. **Slice-record mining.** Read every slice's delivery record (H1) — or, until H1 ships, the validation evidence and review verdicts — and extract patterns: a finding type that appeared in 2+ slice reviews, a struggle that recurred, a contract that needed amendment. Patterns, not anecdotes: one-off issues are noise; repeats are process signal.
2. **Previous-retro follow-through audit.** For each action item from the previous bet's retrospective: done, in progress, or ignored — and if ignored, did it cost us this bet? This audit is the mechanism that makes learning compound instead of evaporate; a retro without it is a suggestion box. Ignored-and-costly items escalate to `docs/maturity.md` rows so they stop relying on memory.
3. **Significant-discovery detection.** Check whether this bet's delivery invalidated assumptions queued bets depend on: an architectural assumption broken, a dependency the next pitch doesn't account for, debt level that changes appetite math, user behavior different than the brief assumed. On detection, recommend re-pitching the affected bets **before** the next one starts — never start the next bet on premises this bet just disproved.
4. **Readiness exploration.** Before closing: is the delivered work actually live (deployed, accepted, observed), or merely green? Unresolved blockers and not-yet-deployed work carry forward as explicit items, not assumptions.

Action items land in discovery notes `## Bets` (which the next bet's discovery phase already reads) with a stable ID each, so the next retro's follow-through audit can reference them mechanically. Keep it lightweight — single facilitated pass, not a ceremony; the four mechanics are checklist items, not separate meetings. *(BMAD: `bmad-retrospective` — deep story analysis, previous-retro follow-through, significant-discovery alert, critical-readiness exploration. Its party-mode facilitation is deliberately NOT adopted; GroundWork's single-facilitator stance applies.)* *Accept:* validation workflow updated; one simulation transcript shows (a) the next bet's discovery consuming action items and (b) a follow-through audit referencing them by ID. The existing sim-findings pattern — recurring scaffold↔architecture drift across runs — is the canonical example of what mechanic 1 must catch.

**H6 — Change navigation (correct-course analog).**
A structured mid-bet change workflow for when reality contradicts the locked design: impact analysis across pitch / technical design / decomposition / signed tests; before/after change proposals; severity routing — *minor* amends through C4's test-amendment protocol, *structural* reverts to Design Foundations with a written change proposal the user approves. Today the bet loop's only options are "stay the course" or an unstructured revert; this gives the revert a spine and a paper trail. *(BMAD: `bmad-correct-course` and its sprint-change proposal.)* *Accept:* workflow section + proposal template shipped; referenced from `04-delivery.md`'s "fundamental flaw" path.

**H7 — Small-change lane (quick-dev analog).**
An orchestrator-routed lane for work that doesn't warrant a bet: single user-facing goal, bounded scope, still requires tests for the change and a Living Documents pass, and logs each change to a ledger that bet discovery reads — N small changes clustering in one area is a signal to pitch a bet (surfaced by H5). The guard-rails make it a pressure valve, not bet-avoidance. *(BMAD: `bmad-quick-dev`, with its explicit 900–1600-token scope standard.)* *Accept:* routing rule in the orchestrator + lane definition; ledger consumed in a discovery transcript.

**H8 — Headless skill evals (pattern A/B).**
Adopt BMAD's two-pattern eval design for methodology skills, run **headless in the real CLI** against the installed skills — not a hand-rolled API loop (the old `conversational_eval.py` was removed for exactly that reason): **Pattern A** artifact-correctness (fixed inputs → does the skill emit a conforming artifact: required sections, frontmatter, no invented facts); **Pattern B** process-discipline (decision-capture fidelity, conflict detection on contradicting updates, review-gate compliance). Start with the three cheapest skills (update, review, elicit) and grow. *(BMAD: `evals/` harness with A/B case split + the deterministic/judgment split in `tools/skill-validator.md`.)* Complements — does not replace — the human simulation harness. *Accept:* a `./dev eval` lane runs ≥1 Pattern A and ≥1 Pattern B case green.

*Sequencing within H:* H5 first — user-flagged high value, pure methodology, and its follow-through loop gets more valuable the earlier it starts accumulating history. H1+H2 ride on WS-D's template work (implement together); H3 needs WS-B+C for the auditor lens; H4 is independent; H6–H7 anytime; H8 follows A5's lint groundwork.

---

## 9. Workstream G — Release engineering & positioning

**G1 — npm name decision (G11, blocker).** User decision: scope (`@<scope>/groundwork`), rename, or pursue transfer. Until resolved, release stays `--dry-run`.
**G2 — 1.0 criteria, written down.** Proposed: A1+A2 transcripts green and committed; WS-B/C/D shipped and exercised in one live simulation; npm name resolved; CHANGELOG migration notes for the operating-contract version bump (C4 changes protocol surface → minor contract bump).
**G3 — Docs site (S24, deferred earlier).** Dogfood the docs-site generator on `docs/` once 1.0 criteria are set — the methodology is now distinctive enough to be worth publishing.

---

## 10. Sequencing

```
WS-A (all slices, parallel)  ──►  gates everything; A6/A7 unblock B
WS-B (B1→B2→B3→B4, B5 anytime) ──► B1 blocks C1's traceability rendering
WS-C (C1→C2→C3→C4→C5)          ──► C3 blocks E
WS-D (D1→D2→D3→D4)             ──► D1 blocks E1; D independent of C except shared templates
WS-H (H1+H2 with D; H3 after B+C; H4–H7 anytime; H8 after A5)
WS-E (E1→E2→E3)                ──► after C+D verified live
WS-F (independent, anytime after B1 for F1)
WS-G (G1 immediately — user decision; G2 after C/D; G3 last)
```

## 11. Open decisions (user)

| # | Decision | Options | Default proposal |
|---|---|---|---|
| D1 | npm name (G11) | scope / rename / transfer | scope as `@<scope>/groundwork`, revisit transfer later |
| D2 | Data-schema spec format (B1) | plain SQL DDL sketch / Atlas-style HCL / JSON Schema per entity | SQL DDL — zero new tooling, diffable, agents read it natively |
| D3 | Lock-manifest strictness (C3) | hard fail everywhere / hard in CI + warn locally | hard fail everywhere — a soft local gate trains agents to ignore it |
| D4 | New stacks (Java/Rust/.NET) | now / after 1.0 / never | after 1.0, demand-driven; depth-over-breadth is the brand |
| D5 | Parallel delivery (WS-E) in 1.0 scope? | yes / post-1.0 | post-1.0 headline feature; 1.0 ships the sealed-contract loop |
