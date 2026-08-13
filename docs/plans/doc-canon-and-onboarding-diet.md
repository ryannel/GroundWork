# Implementation Plan: Doc Canon & Onboarding Diet (First-Contact Unlock, Shape-Advanced Docs, Brownfield Resequencing)

**Status:** WS-A + WS-B EXECUTED 2026-08-13 (commits `4e2302e` B1, `0f1f5f9` B2+B3, `25f020c` A1+A2, `315dbf8` A3; 320 cli tests + lint + sync-anchors green). Execution notes: (1) B2's default-track flip is **not** in — it references WS-E phases that do not exist yet; what landed is the full deferral semantics (settled-phase Mode Detection, graduation predicate, deferred re-entry incl. the deferrable-set guard: only the product-brief and design-system extracts qualify pre-E, since scan feeds the extracts and architecture-extract feeds the ops harness) with the track flip staying in WS-E. (2) The R5 interim guard landed: infra-adopt preserves the scan cache while any extract is deferred; the last deferred extract owns teardown — superseded by E4's regenerate-at-invocation when WS-E lands. (3) A1's acceptance shifted: orchestrator routing is skill prose, not CLI code, so the planned `tests/cli` routing table-test is not mechanically expressible — coverage is the new progress-header lint rule plus the G4 sim probes, which are **owed**. Remaining: WS-C…WS-G per sequencing, D-O5 still open. Derived from two subagent review suites run the same day: a six-lens onboarding review of the brownfield flow (14 agents, 40 findings, top 8 adversarially verified: 4 confirmed / 4 partial / 0 refuted) and a six-lens red-team of the resulting doc-cut proposals (14 agents, 55 findings, top 8 verified: 3 confirmed / 5 partial / 0 refuted). Full reports: [onboarding review](https://claude.ai/code/artifact/ed972628-924b-4c4e-b672-11c1d6c9b49a), [doc-diet red-team](https://claude.ai/code/artifact/dab24136-9fa0-49f6-974b-0cbdbd3a9e30).
**Audience:** An engineer or agent implementing this change. Each slice names its files and acceptance check; judgment calls that remain are open decisions in §9.
**Scope owner:** `groundwork-orchestrator` routing and the brownfield track (`groundwork-scan`, the three extract skills, `groundwork-infra-adopt`), with coupled shape changes to `docs/product-brief.md`, `docs/design-system.md`, `docs/architecture/index.md` and every consumer that reads them — `groundwork-bet` workflows, `groundwork-patch`, review checklists, `groundwork-doc-sync`, `groundwork-update` (Family Index), `groundwork-surface-activation`, the state schema, and the docs-site nav.

---

## 0. Read this first — the mental model

Two problems turned out to be one problem.

**Problem 1 — onboarding weight.** Every delivery lane is locked behind all five brownfield setup phases, and the gate is policy, not a data dependency: the delivery loop's own consumers already degrade gracefully without setup artifacts, and the patch lane reads nothing that setup produces. A day-one "fix this bug" is silently converted into a five-session document march (~13–16 user decision points) with no consent moment and no visible end. The scan itself is the well-engineered part; the weight is the four mandatory document phases behind it and the value ordering that ships the operational layer (`./dev`, test harness) last.

**Problem 2 — document value.** The maintained prose canon has thin consumers. The test of a living document is whether anything hurts when it goes stale — and the sandbox evidence (magpie) is that the product brief went stale and nothing hurt. The research corpus points the same way: instruction-shaped content is followed; repository overviews are not; there is no controlled evidence that maintained document canon beats a lighter loop. But the red-team confirmed the naive cut is wrong: each doc carries a small load-bearing core with real consumers — the NFR envelope and brand foundation in the design system (two 🔴 review gates, surface activation), the scope ratchet in the brief, the boundary rulings in the architecture index.

**The organizing idea:** every canonical doc keeps its path and its decision-record core; the descriptive prose around that core dies or becomes generated; the maintenance contract narrows to exactly what gates consume. And the delivery loop opens before the document phases run, not after — setup becomes schedulable work the user steers ("make this repeatable"), not a toll gate.

Three rules the slices below implement:

> **Rule 1 — A doc earns maintained status only if some gate fails when it lies.** Everything else is generated, frozen, or demoted. (Amended by the red-team: demoted-from-maintenance, not deleted — and doc-poor brownfield repos still get their orientation page *generated*, the one condition where the research shows generated context paying.)
>
> **Rule 2 — Shape advance, never path change.** `docs/product-brief.md` and `docs/design-system.md` survive at their paths in smaller shapes. This kills half the blast radius (no dangling references) and gives existing installs a vehicle: the Family Index shape-advance is exactly what the update lane was built for.
>
> **Rule 3 — Descriptive content flows from code; intent content is authored.** Topology and communication patterns are design *intent* (prescriptive in greenfield — the scaffold builds from them) and stay hand-kept. Inventory tables, contract indexes, and module graphs are derivable and get generated — scoped to what the sources actually assert (repo-map's module graph is a build DAG, not a service topology).

**Relationship to the north-star (PR #31).** This plan is the current-repo expression of directions the v2 spec already ratifies-pending: incremental brownfield manifest, pitch-holds-intention, code-coupled docs with `source_of_truth`. The findings feed v2's corresponding bets regardless of when ratification lands; whether to execute the heavier workstreams on main first is open decision D-O5.

---

## 1. Review findings this plan responds to

IDs are referenced by the workstreams. Verification status is from the adversarial verify passes; "adopted" marks unverified findings the plan accepts on inspection.

| ID | Finding | Status |
|---|---|---|
| O1 | All delivery lanes locked behind all five setup phases (`orchestrator SKILL.md:105,164`); gate is policy, not data — delivery consumers degrade gracefully without setup artifacts; patch lane reads nothing setup produces | Confirmed — High |
| O2 | A concrete build/fix request is converted into the setup march with no consent moment, acknowledgment, or lighter path (`SKILL.md:158`) | Confirmed — High |
| O3 | Four post-scan phases mandatory, auto-chained, un-deferrable; ~13–16 decision points over 5–6 sessions; `state.json` has no deferred/collapsed/not-applicable semantics | Confirmed — High |
| O4 | No proactive progress orientation anywhere — "how much longer?" is unanswerable at every gate; position report is reactive-only (`SKILL.md:185-188`) | Partial — High |
| O5 | Operational layer sequenced last; `workspace-dev-cli` has no doc dependency at all; `system-test-runner` needs `surfaces.json` (written at architecture-extract commit), so an earlier ops layer needs surfaces confirmed earlier — not zero dependencies | Partial — High |
| O6 | Design-system extract unconditional even for headless repos; outright skip breaks real references (surfaces design tracks, bet design step) — needs a collapsed variant, not deletion | Partial — High |
| O7 | Scan produces nothing the user can use ("structured findings, not prose for a human"); every surveyed comparable pays the user at step one | Adopted (prior art) |
| O8 | Extracts hard-read scan slices with no absent-file branch; the Coverage & Gaps note has no consumer; infra-adopt tears down the scan cache | Adopted |
| R1 | NFR envelope (budgets, a11y floors) lives in design-system prose; five consumers incl. two 🔴 gates (bet-pitch constraint-breach, decomposition orphan-NFR) read it there; the naive split leaves it homeless | Confirmed — High |
| R2 | `groundwork-surface-activation` reads brand direction from the committed foundation sections (`tracks/_foundation.md:96-98`); the session cache is deleted at commit; tokens cannot replace mood/philosophy prose for a new-medium translation | Confirmed — High |
| R3 | `module_graph` is a manifest-declared build DAG (no HTTP/queue edges; compose-only services invisible; Go/Python/single-package-Node uncovered); greenfield `index.md` is prescriptive — scaffold reads it before code exists | Confirmed — High |
| R4 | The brief is a write target (validation Living-Docs scan, doc-sync, Protocol 1 header), not just a read source; but the high-cadence class — capabilities per bet — already accumulates in the `docs/surfaces.md` capability ledger | Partial — High |
| R5 | Deferred extracts have no input path (scan findings never written under scan-lite; cache torn down) and no post-graduation route (Adopt/Upgrade is a pre-graduation repair path only) | Partial — High |
| R6 | The Brownfield Setup table, per-phase completion contracts, and the Setup Graduation predicate must be rewritten in the same change as any resequencing — the table is the source of truth reconciliation reads | Partial — High |
| R7 | Shape conversions need a vehicle: Family Index rows + a `cli` migration for state/nav; without them, reconciliation bounces existing installs back into Setup | Adopted |
| R8 | The research licenses *not-maintaining*, not deleting; ETH tested always-on files (regime boundary); the docs-stripped condition is where generated context *helped* (+2.7%) — doc-poor repos should still get generated orientation content | Adopted |
| R9 | Hand-kept and generated content in one file breaks the update lane's whole-file hash classification and per-file drift routing; generated views need sibling files or a tier change | Adopted |
| R10 | The single orientation eval cannot stand as acceptance for six proposals; legacy-install, half-migrated, and greenfield-compose arms are missing | Adopted |

**Strengths this plan must not regress:** the scan's own engineering (depth tiers, write-and-purge, one interview point, resume); the fail-closed review gate model; the Living Documents reversal protocol; the capability ledger in `docs/surfaces.md`; the captured-from-code `docs/architecture/api/` record (already the right direction); Adopt/Upgrade mode for repos with existing docs.

---

## 2. Workstream A — First-contact unlock (O1, O2, O4)

Cheapest, highest leverage, independent of everything else. Ship this even if nothing else lands.

**A1 — Provisional patch lane before setup completes.**
`src/skills/groundwork-orchestrator/SKILL.md` (the `:164` rule and lane table) + `src/hidden-skills/groundwork-patch/instructions.md`. A pre-setup request that passes the existing patch scope test routes to the patch lane with reduced context: run `npx groundwork-method repo-map` on demand for impact, read only touched files, skip canonical-doc reads that don't exist yet, stamp the existing Lane/Area commit trailers, and append any doc debt the patch creates as a gap-ledger row for setup to absorb. Requests that fail the scope test still route to setup — via A2's hand-off, not silently. *Accept:* a `tests/cli/` orchestrator table-test covering pre-setup routing (patchable ask → patch lane; non-patchable ask → setup with hand-off); a sim probe where "fix this typo" on a fresh brownfield install ships a commit in session one.

**A2 — First-contact hand-off paragraph.**
`SKILL.md` opening-move rules (`:158` region). When a pre-setup build request exceeds patch scope, the orchestrator must (a) confirm the ask was heard and will be the first work item after setup, (b) name the phases between here and it in plain language with rough effort, (c) offer the choice: proceed now (recommended depth) or record the ask and let the user pick the moment. Routing without this paragraph becomes a contract violation. *Accept:* text shipped; judge rubric for the brownfield sim gains a scored first-contact turn.

**A3 — Setup progress header.**
`operating-contract.md` Sequential Setup section + each setup skill's phase entry. One line at every phase entry and before every user-blocking question: phase N of M, what this phase asks of the user, what remains after it. The scan's depth options gain duration framing; Stage 3b surfaces partition progress ("12 of 18 areas read") when it crosses a turn. *Accept:* `./dev lint skills` rule checking setup-phase files carry the header instruction; sim judge scores a mid-setup "where are we?" turn without the user asking.

---

## 3. Workstream B — State semantics: deferral becomes expressible (O3, R6, R5-routing)

The enabler for C and E. Today a lazier ordering is structurally impossible to express.

**B1 — `state.json` phase-state shape.**
`src/config/groundwork-state.json` + consumers. Phases gain a state beyond present/absent in `completed`: `deferred` (user chose later), `collapsed` (micro-variant ran — records what it emitted), `na` (recorded reason). Shape bump ships with a `cli` migration (`migrations/`, registered in `index.json`) advancing installed `state.json` in place. *Accept:* migration proven against `tests/fixtures/installs/`; `./dev test contracts` migration-coverage gate green.

**B2 — Orchestrator table + graduation predicate rewrite.**
`SKILL.md` Mode Detection, Brownfield Setup table, completion contract (`:44-66, :90-98`), and `operating-contract.md` Protocol 10 (which hardcodes infra-adopt as the brownfield terminal phase). The default brownfield track becomes the E-series phases; the extracts move to a deferred register; "all setup phases done" quantifies over the new table plus deferred/collapsed/na states. Mid-setup installs: reconciliation maps old completed-phase names onto the new table (see F3). *Accept:* orchestrator table-tests in `tests/cli/` cover fresh, mid-setup-legacy, deferred, and collapsed states.

**B3 — Post-graduation routing for deferred phases.**
`SKILL.md` Anytime Skills / routing tables. A deferred extract is routable on demand after Setup Graduation — today Adopt/Upgrade exists only as a pre-graduation repair path. Trigger language: route when a bet's discovery or design step first needs the artifact, or when the user asks. *Accept:* table-test: `deferred` design-system phase + a graphical-ui bet pitch → orchestrator routes to the extract before the bet's design step.

---

## 4. Workstream C — Canonical doc shape advances (R1, R2, R4, O6)

Keep the paths; shrink the shapes; re-point every consumer in the same slice that changes its source.

**C1 — Product brief → orientation shape.**
`src/hidden-skills/groundwork-product-brief/product-brief-template.md` (+ extract twin's target shape): problem, audience, deliberate non-goals — roughly half a page. Writers re-scoped in the same change: `groundwork-bet/workflows/05-validation.md:92-99` (Living-Docs scan accepts vision-level classes only; capability state named as the surfaces ledger's job), `groundwork-doc-sync/instructions.md` capability routing → `docs/surfaces.md` ledger, `operating-contract.md` Protocol 1 `## Product Brief` header note. Greenfield still runs the product conversation at full depth — Downstream Context files carry its working state to design/architecture/scaffold — but what is committed and maintained is the orientation shape. *Accept:* template + both writer sites + doc-sync route updated in one commit; `groundwork-review/checklists/product-brief.md` rewritten for the new shape.

**C2 — Scope ratchet re-pointed.**
`groundwork-bet/workflows/01-discovery.md:66` (product persona scope-fit) and the bet-pitch checklist's out-of-scope-resurrection item: judged against the orientation page's non-goals plus the surfaces capability ledger, not the old brief's capability prose. *Accept:* checklist + workflow text updated; a sim probe pitches a non-goal violation and the gate still fires.

**C3 — Design system → foundation + commitments + pattern index.**
`groundwork-design-system` (greenfield tracks) + `groundwork-design-system-extract` target shape. The doc keeps: foundation sections (brand direction, interaction philosophy — the surface-activation input, R2), a `## Commitments` rulings section holding the NFR envelope (R1; home decision D-O1), and the pattern index (component names, `## Design References`, per-surface interface vocabulary) over code as the styling canon. What dies: per-type component-specification prose. Consumers re-pointed in the same change: `01-discovery.md:42`, bet-pitch and decomposition 🔴 budget gates, `groundwork-architecture/phases/01-context-ingestion.md`, `groundwork-mvp`, `surfaces-contract.md` design-track pointers, `tracks/_foundation.md:96-98` standalone-invocation note. *Accept:* every named consumer's reference resolves against the new shape; `checklists/design-system.md` rewritten; grep for the retired section anchors returns nothing.

**C4 — Collapsed design variant for headless repos (O6).**
`groundwork-design-system-extract` + orchestrator completion contract: when the scan's recorded surface set has no `graphical-ui`/`cli` partition, the phase collapses to one confirmation — Tier-1 brand tokens from the manifest + the protocol-vocabulary section only — recorded as `collapsed` in state (B1). *Accept:* extract instructions branch on the surface set; table-test for the collapsed completion check.

**C5 — Experience auditor + design-step reads.**
`groundwork-bet/workflows/02-design.md`, `briefs/experience-auditor.md`: baseline becomes the pattern index + code components + Design References record. The accumulate rule ("add new patterns as real components so the next bet inherits") survives — it lands in code + one index line, not prose. *Accept:* both files reference only surviving sections.

---

## 5. Workstream D — Architecture index: rulings + scoped generation (R3, R9)

**D1 — Template partition: rulings vs generated.**
`groundwork-architecture/architecture-template.md` (+ extract twin): §1 Constraints & Budgets, §3 Capability decisions, §6 SLRs, and — per R3 — §2 Topology and §5 Communication Patterns stay **hand-kept** (design intent; prescriptive in greenfield). Newly marked as generated: service/module inventory tables and the contract-location index. *Accept:* template sections carry an explicit `hand-kept`/`generated` marker line; `checklists/architecture.md` distinguishes them.

**D2 — Generated views as sibling files, post-graduation.**
New `docs/architecture/generated/` (naming: D-O2) written by a `groundwork-method` verb from repo-map (where coverage exists) + captured `docs/architecture/api/` + compose. Activated at Setup Graduation, never during setup (greenfield has no code, R3). Sibling files keep the update lane's whole-file classification and give `groundwork-check` a clean freshness rule: generated files are stale when `generated_at_commit` drifts, never by review date (R9). Regeneration owner: the validation phase's Living-Docs step triggers the verb. *Accept:* verb produces the views in a scaffold sandbox; `groundwork-check` reports drift on a stale generated file and does not flag a fresh one as unreviewed.

**D3 — doc-sync triggers re-scoped.**
`groundwork-doc-sync/instructions.md`: "service added/removed/rewired" targets the hand-kept topology ruling (still authored) and fires the D2 regeneration; it no longer treats the inventory tables as prose to edit. *Accept:* trigger table names the split.

**Out of scope (parked as a candidate bet):** extending repo-map with a service/infrastructure layer (compose parsing, port maps, queue bindings) that could observe real cross-service edges. Not a precondition for anything above.

---

## 6. Workstream E — Brownfield resequencing (O5, O7, O8, R5)

Depends on B. The default track becomes: **E1 scan-lite → E2 ops layer → E3 decision-record bootstrap → graduation**, extracts deferred.

**E1 — Scan-lite default.**
`groundwork-scan`: default mode becomes classify (Stage 1) + deterministic repo-map (Stage 1.5) + one scope confirmation that now also confirms the **surface list** (feeding E2 — the `system-test-runner` needs `surfaces.json`, O5) — no whole-repo LLM digest pass. Closes O7 by emitting one user-facing artifact from data already in hand: the orientation page (C1 shape) drafted from manifests/README plus a coverage-and-gaps note — for doc-poor repos this is the measured-benefit zone (R8). The full digest scan survives as an explicit option and as the deferred extracts' input path (E4). *Accept:* scan-lite on a fixture repo ends with repo-map.json + confirmed surfaces + a drafted orientation page and no `.groundwork/cache/scan/` findings tree.

**E2 — Ops layer as its own phase.**
Split from `groundwork-infra-adopt`: nx bootstrap, `workspace-dev-cli` (compose merge guard intact), `system-test-runner` from the E1-confirmed surfaces, optional docs site — default branding, re-branded when the design phase eventually commits (O5). The documentation half (service docs, maturity consolidation) stays downstream. *Accept:* on the brownfield fixture, `./dev start` and the harness work with zero extract phases run.

**E3 — Decision-record bootstrap.**
New micro-phase (or infra-adopt remainder): a short interview capturing only the load-bearing rulings — boundary intent, budgets if the user has them, ADRs only where rationale exists (the extract skill's existing no-fabrication rule) — into `docs/architecture/index.md` rulings sections + `decisions/`. *Accept:* completion contract registered in the B2 table; output passes the D1-updated checklist.

**E4 — Deferred-extract input contract.**
The extracts regenerate their own scoped inputs at invocation: each gains a partition-scoped ingest step (targeted reads guided by repo-map centrality + the digest schema as read discipline) replacing the hard-read of pre-existing scan slices; an absent-findings branch is added (O8). `groundwork-infra-adopt:158-160` teardown re-owned: preserve `repo-map.json` + the orientation draft; delete only what E-series phases wrote and consumed. Honest cost note in the skill text: the LLM read cost is deferred to invocation, not eliminated (R5). *Accept:* invoking a deferred extract on the fixture with no scan cache present completes and produces the C-shaped doc.

---

## 7. Workstream F — Upgrade path for existing installs (R7)

**F1 — Family Index rows.**
`groundwork-update` Family Index: three shape-advance families (brief → orientation shape; design-system → foundation+index shape; architecture index → partitioned template), each with owner → legacy signal → advance recipe for the reconcile worker. Audit the shipped Naming family and the ux-design rename path so no legacy install is advanced *into* a retired shape. *Accept:* reconcile-worker dry-run against a legacy fixture produces the new shapes with user content preserved.

**F2 — `cli` migration: state + nav.**
One registered migration: B1 state shape bump + docs-site `meta.json` nav entries for demoted/renamed pages. *Accept:* fixture install's docs site builds with no dead nav after migration.

**F3 — Mid-setup stranding map.**
B2's reconciliation maps old completed-phase names to the new table: completed extracts count as their deferred-register equivalents done; a half-finished old-track install resumes into the new track without repeating work. *Accept:* table-test with a fixture `state.json` captured mid-old-track.

**F4 — Changelog discipline.**
Every slice above lands with its `[migration: …]` / `[no-migration: <surface group>]` line scoped per the annotation rules; the F1 families are annotated `[no-migration: docs]` as reconcile families. *Accept:* `./dev test contracts` migration-coverage gate green across the whole plan's commits.

---

## 8. Workstream G — Verification (R10; gates for everything above)

**G1 — Orientation eval (gates D2's scope only).** Sim: same bet, fresh context, three arms — full legacy `index.md` / D1 rulings + D2 generated views / repo-map only. Measure tokens + turns to first correct move and boundary-ruling violations. Outcome decides how far generation goes, not whether the plan ships.

**G2 — Upgrade sims (gate the release).** Two arms: a legacy green install through `update` (F1+F2), and the F3 mid-setup fixture. *Accept:* both end green with user content intact; `groundwork check` clean.

**G3 — Greenfield end-to-end.** `./dev sim run` greenfield under C-shaped docs: product conversation → design foundation → architecture → scaffold → first bet. Proves the Downstream Context chain still feeds scaffold/MVP when committed shapes shrink. *Accept:* judge verdict faithful; scaffold Phase 1 service-count gate passes.

**G4 — Brownfield first-session sim.** Fresh brownfield fixture: "fix this bug" ships via A1 in session one; E-track completes after; a later graphical-ui bet triggers B3 routing into the deferred design extract. *Accept:* judge verdict faithful on all three beats.

**G5 — Live proof.** One real repo (magpie or staycurrent) through the new default track. *Accept:* recorded in the plan's execution ledger.

---

## 9. Decisions

### Settled (owner rulings from the 2026-08-13 review sessions)

| ID | Decision |
|---|---|
| D-S1 | Shape advance, never path change — `product-brief.md` and `design-system.md` survive at their paths in smaller shapes; Family Index is the vehicle |
| D-S2 | Design foundation sections (brand direction, interaction philosophy) survive as the doc's decision-record core — surface activation depends on them |
| D-S3 | Topology and communication-pattern sections stay hand-kept as design intent; generation is scoped to inventory/contract views |
| D-S4 | Capability accumulation formally lives in the `docs/surfaces.md` ledger (already true in practice); the brief carries none of it |
| D-S5 | Evidence posture: the research licenses not-maintaining, not deleting; doc-poor brownfield repos still get generated orientation content |
| D-S6 | The patch lane unlocks pre-setup with reduced guardrails and gap-ledger debt; over-ceremony is the costlier error at the setup boundary too |

### Open

| ID | Question | Recommendation |
|---|---|---|
| D-O1 | NFR envelope home: `## Commitments` rulings inside `design-system.md`, or merged into architecture SLRs? | Keep in `design-system.md` — fewest consumer re-points (two 🔴 gates already cite that path); revisit if architecture rulings absorb budgets later |
| D-O2 | Generated views: sibling files under `docs/architecture/generated/` vs marked blocks in `index.md`? | Sibling files — survives whole-file hash classification (R9) and gives `check` a clean freshness rule |
| D-O3 | Does the quick-bet lane also unlock pre-setup? | Not initially — patch only; widen after G4 evidence |
| D-O4 | Deferred-extract inputs: regenerate scoped inputs at invocation vs preserve the scan cache indefinitely? | Regenerate (E4) — no stale-cache class, consistent with pull-based direction |
| D-O5 | Execute now on main vs fold into the v2 ladder pending PR #31 ratification? | Execute WS-A/B/F now (cheap, wanted either way); sequence C/D/E against the ratification decision — owner call |
| D-O6 | Do generated views render on the docs site as pages or stay repo-only? | Repo-only first; docs-site rendering is a follow-up once D2 stabilizes |

---

## 10. Sequencing and done-ness

```
WS-A (independent, ship first)
WS-B (enabler) ──► WS-C ─┐
              └──► WS-D ─┼──► WS-F ──► WS-G (G2–G5 gate release)
              └──► WS-E ─┘         G1 gates only D2's scope
```

**Done means:** `./dev ci` green end-to-end; the migration-coverage gate satisfied for every touched surface group; G2, G3, G4 sims green; G5 live proof recorded; and the two review reports' confirmed findings each traceable to a landed slice (O1→A1, O2→A2, O3→B1/B2, R1→C3, R2→C3, R3→D1/D2).
