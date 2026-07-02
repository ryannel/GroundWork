# Distillation Plan — Orchestration Spine & Shared Services

Status: PROPOSED (input to the master distillation plan)
Scope (current word counts, `wc -w`):

| File | Words |
|---|---|
| `src/skills/groundwork-orchestrator/SKILL.md` | 2,688 |
| `src/skills/groundwork-orchestrator/workflow-index.md` (generated) | 636 |
| `src/skills/groundwork-check/SKILL.md` | 682 |
| `src/skills/groundwork-check/instructions.md` | 926 |
| `src/hidden-skills/operating-contract.md` | 6,786 |
| `src/hidden-skills/groundwork-persona/instructions.md` | 1,307 |
| `src/hidden-skills/groundwork-writer/SKILL.md` | 3,164 |
| `src/hidden-skills/groundwork-review/instructions.md` | 2,033 |
| `src/hidden-skills/groundwork-review/checklists/` (10 files) | 8,558 |
| `src/hidden-skills/groundwork-elicit/` (instructions + methods) | 1,818 |
| `src/hidden-skills/templates/` (8 files) | 3,981 |
| `src/hidden-skills/code-intelligence.md` | 1,566 |
| `src/hidden-skills/repo-map-schema.md` | 651 |
| `src/hidden-skills/maturity-model.md` | 1,527 |
| **Total** | **36,323** |

---

## 1. Intention

This section is the framework's spine: the router that puts every user request onto the right lane, the shared protocol root every methodology skill enacts, the conversational identity, the two writing/reviewing quality gates, and the shared data contracts (templates, repo map, maturity model) that let phases written in different files — often run in different sessions — agree on identifiers. Its reason to exist is **one definition, many enactments**: protocols and identifiers are defined once here so twenty consumer skills can stay lean and consistent.

The good news first, because it bounds the plan: the contract is genuinely alive. Spot-checks of `groundwork-product-brief` (P1, P2, P5, P6, P8, P9 all enacted at named steps), `groundwork-architecture` (P5, P8, P9 at phases 06–07), `groundwork-bet` (P8/P9 at discovery Step 134, tier frontmatter on all seven briefs), and the scan/scaffold/design-system skills (P7 cache-clean checks at init and commit) found **no dead protocols**. The failure mode here is not rot; it is *duplication of the root into consumers and siblings*, which is exactly the drift vector the contract exists to prevent.

Per-file intention map:

- **`groundwork-orchestrator/SKILL.md`** — cause every session to resolve project state before acting, size incoming work into the right lane (setup phase / patch / quick bet / bet), and load the correct hidden skill by path instead of improvising lifecycle decisions. Its description is a permanent context tax on every session; its body loads on nearly every working session (the capture hook routes all build requests through it), so every word is near-always-on.
- **`groundwork-orchestrator/workflow-index.md`** — a generated orientation map the orchestrator quotes when the user asks for help; explicitly *not* used for routing.
- **`groundwork-check/SKILL.md` + `instructions.md`** — cause an agent (or CI session) to test the docs' claim of currency mechanically and report honestly, including what it could *not* assess, with a recovery route per finding.
- **`operating-contract.md`** — the protocol root: capture out-of-phase signals (P1), keep docs living and gate reversals (P2), run a uniform phase lifecycle (P3), pace conversation (P4), carry the cross-phase contract in context files (P5) and hand-offs (P6), isolate caches (P7), fail-closed review gating (P8) and dispatch (P9), model-tier policy, and setup teardown (P10). Intention: consumers *point* here; nothing protocol-shaped is authored twice.
- **`groundwork-persona/instructions.md`** — set the conversational posture (decisive expert peer, propose-first, guide-not-tourist) before the first user-facing reply of every session.
- **`groundwork-writer/SKILL.md`** — make every published `docs/` artifact read as timeless reference documentation for a cold reader (human or agent), and enforce the published-doc/context-file separation at commit.
- **`groundwork-review/instructions.md` + `checklists/`** — an isolated second pair of eyes that returns a parseable verdict and quotable findings, calibrated per document type by a named-failure-mode checklist, without leaking its deliberation into the caller's context.
- **`groundwork-elicit/`** — strengthen exactly one weak draft section with the one best-fit structured technique, then hand control back untouched otherwise.
- **`templates/`** — shared output skeletons and cross-phase data contracts so writers and readers of `discovery-notes.md`, hand-offs, ADRs, the gap ledger, the maturity doc, the surface registry, and capability ports never disagree on shape or vocabulary.
- **`code-intelligence.md` / `repo-map-schema.md`** — teach any code-touching skill to orient by structure (map hubs → Serena symbols) with honest degradation; pin the `repo-map.json` shape between its one producer and its several consumers. Both are actively loaded (engineer skills, slice-worker, 04-delivery, scan, check, doc-sync).
- **`maturity-model.md`** — one authoritative definition of the nine dimensions and the roadmap vocabulary that `infra-adopt`, `scaffold`, `bet`, `check`, `doc-sync`, and the maturity checklist all parse by exact string.

None of the three shared references is dead weight — the "shared reference nobody loads" hypothesis was checked and does not hold (grep: `code-intelligence.md` has 9 loaders, `maturity-model.md` has 9, `repo-map-schema.md` has 2 including the scan, its primary consumer).

---

## 2. Findings

| ID | Where | Finding | Severity |
|---|---|---|---|
| ORCH-1 | `operating-contract.md` Protocol 5 ↔ `groundwork-writer/SKILL.md` §"Downstream Context" | **Duplication of a root contract**: the four-subsection table (Key Decisions / Binding Constraints / Deferred Questions / Out of Scope), the ≤200-word budget, the "no rationale / no rejected options / no framing" list, and the "derive it from the finished doc, last" rule appear near-verbatim in both files (~350 words duplicated). Two owners of one shape is the exact root-document-drift failure the contract warns against. | high |
| ORCH-2 | `groundwork-review/instructions.md` Check 3 + Check 4 ↔ `checklists/{bet-pitch,maturity,domain-entity}.md` | **Duplication of checklist content into the generic pass**: Check 4's bet-pitch rabbit-holes rule duplicates checklist item "No-Gos only, no rabbit hole" (bet-pitch.md); Check 4's four maturity row rules duplicate maturity.md's "State without evidence", "Out-of-vocabulary …", "Unattributed closure/acceptance", "Partial without specifics"; Check 3's domain-entity special resolution repeats domain-entity.md items down to the same `Owner: web (via Supabase Auth)` example. ~500 words stated twice; the two copies will drift and the reviewer double-reports. | high |
| ORCH-3 | `operating-contract.md` Protocol 8 §"Fail closed when the review cannot run" ↔ Protocol 9 §"When the review cannot run" | **Same rule stated twice in the root**: fail-closed on a review that cannot run, and the authorised-self-review fallback, are each written out in full in both protocols (~450 words combined), with each section cross-referencing the other ("Protocol 9 turns this rule into the operational procedure…", "This is Protocol 8's fallback rule as an operational procedure"). One semantic, two texts. | high |
| ORCH-4 | `groundwork-orchestrator/SKILL.md` §"Setup Graduation" → "Run it" | **Root restated in a consumer**: the orchestrator re-enumerates Protocol 10's three steps (graduate ADRs → Living Documents pass → tear down) inline, then also restates the fail-safe. Protocol 10 owns the steps; the orchestrator owns only the trigger, the routing hold, and the `setup_graduated` record. Drift risk on every P10 edit. | med |
| ORCH-5 | `groundwork-orchestrator/SKILL.md` §"Anytime Skills" (patch, update rows) | **Checklist bloat in an always-on file**: the patch bullet is ~120 words re-explaining the three-lane triage that §"User requests work" already owns; the update bullet (~90 words) carries the update-vs-doc-sync disambiguation twice over (it also appears in the doc-sync bullet). This text is additionally duplicated wholesale into the generated `workflow-index.md`. | med |
| ORCH-6 | `workflow-index.md` line 49 (generated from the SKILL.md patch row) | **Dead cross-reference in a transcluded table**: "(see *User requests work* above)" — that heading exists only in SKILL.md, not in the generated index where the text also renders. Table text written in one file and rendered in another must not carry file-internal anchors. | low |
| ORCH-7 | `groundwork-check/SKILL.md` ↔ `instructions.md` Step 4 | **Content in the wrong half of a two-file split**: the registered SKILL.md carries the full Doc-Type Behaviours spec (~550 words) while `instructions.md` Step 4 re-summarises all of it in one dense paragraph and points back ("Apply the Doc-Type Behaviours defined in this skill's SKILL.md"). Circular hop, duplicated summary, and behavioural spec sitting in the always-scanned registered file instead of the on-demand instruction file. | med |
| ORCH-8 | `groundwork-elicit/methods.md`, "Assumption Audit" row | **Identifier at drift — stale**: "Best for: Summary-for-Downstream sections…" names a section that no longer exists in published docs (removed when Protocol 5 moved the contract to `.groundwork/context/`). An agent matching a diagnosis against this row can select against a phantom shape. | med |
| ORCH-9 | `operating-contract.md` §"Model Tiers" (subsections "Per-slice lift" + "Runtime escalation is distinct from a blocking concern") | **Altitude misplacement in the shared root**: ~300 of the section's ~700 words are bet-delivery mechanics — Decomposition Step 4's slice flag, the mid-slice advisor escalation, the `BLOCKING CONCERN` distinction (a slice-worker-brief concept). Only the bet skill enacts these; every other methodology skill pays to load them. The policy (two tiers, classes-not-ids, degradation) is genuinely shared; the mechanics are not. | med |
| ORCH-10 | `groundwork-writer/SKILL.md` §"Common Failure Modes" | **Failure list restates the body**: 5 of 10 items ("Report-out register", "No orientation", "Opaque labels", "Compressed density", "Prose where a diagram belongs") restate body sections by name — the house standard (skill-writer §Common Failure Modes) requires failure modes to be *distinct phenomena that don't reduce to a principle already stated*. The label rule alone is written three times across shipped files (writer §Accessibility, writer failure list, persona §"Keep the Reader in the Picture"). | med |
| ORCH-11 | `groundwork-review/instructions.md` §"Check 1: Conversation Fidelity" + §"How This Skill Is Invoked" | **Heading contradicts content + history residue**: Check 1 opens by explaining it *cannot* see the conversation and narrows to internal coherence — the name promises what the check disclaims. The invocation section justifies isolation by contrasting with "the way earlier versions of this skill operated", a fresh-slate violation; Protocol 9 already owns the dispatch story. | low |
| ORCH-12 | `templates/surfaces.md`, `templates/capability-ports.md` | **Convention breach — contracts filed as templates**: both are titled "…Contract", carry schema rules and consumption instructions ("How the scaffold consumes it"), and contain no fill-in skeleton beyond an example. The contributor guide states "`templates/` directories hold output skeletons, never instructions." Their true siblings are the root shared references (`maturity-model.md`, `repo-map-schema.md`). A reader predicting internals from directory names is misled. | med |
| ORCH-13 | `templates/gap-ledger.md` ↔ `maturity-model.md` §"The roadmap" | **Vocabulary defined twice with mutual deferral**: severity/recommendation value sets are defined with prose glosses in the gap-ledger template *and* in the maturity model, and each claims the other is the source ("Severity and Recommendation are closed value sets defined by the maturity model" vs "Severity and recommendation reuse the gap-ledger tiers exactly"). No single owner for strings that downstream skills parse exactly. | low |
| ORCH-14 | `groundwork-persona/instructions.md` | **Always-on overweight**: loaded before the first reply of every session, yet "Recommend, Don't Just List" (~200 words) and "Speak as the Guide, Not the Tourist" (~250 words) each say one idea at triple length, and the "Name things in plain language" bullet duplicates the writer's label rule (ORCH-10). The content is right; the density is below the file's own "Zero Fluff" bar. | low |
| ORCH-15 | `groundwork-orchestrator/SKILL.md` — the two `fan_out` paragraphs (after the brownfield table; after Anytime Skills) | **Same mechanism specified twice**: the scan and update `fan_out` hints are two near-identical paragraphs explaining the same probe-avoidance rationale. | low |
| ORCH-16 | `groundwork-orchestrator/SKILL.md` — the two blockquote footnotes under Skill Paths | **Redundant re-explanation** (~230 words): the stack-forge and discipline-persona footnotes restate adoption context that the persona SKILL.md headers and the contributor guide already carry; the routing table only needs "not a lifecycle route — adopted from within X" per row. | low |
| ORCH-17 | `operating-contract.md` Protocol 1 ↔ `templates/discovery-notes.md` | **Drift pair without a pointer**: P1 instructs "create it with all section headers listed below" and carries the five-header description table; the shipped template carries the same headers with the same descriptions as comments. P1 never references the template, so there are two creation sources for one file shape. | low |
| ORCH-18 | `groundwork-check` frontmatter (both files) | **Mis-calibrated claims**: "Designed to run in CI" / "exits non-zero on critical drift" describe the CLI (`npx groundwork-method check`), not the agent skill, which "ends with a failing status" only rhetorically. Minor honesty fix so the agent doesn't try to emulate process semantics. | low |
| ORCH-19 | `groundwork-review/checklists/decomposition.md` ↔ `checklists/implementation-readiness.md` | **Deliberate two-gate overlap, undocumented**: proof-of-work presence/`Test file:` checks appear in both (authorship review vs pre-flight). The split is intentional (different moments, different questions) but neither file names its counterpart, so a future editor will either merge them or grow them apart. | low |

---

## 3. Distillation moves

Each move names its finding(s), the target files, and what improves in execution — not just size.

**M1 — Single-source the Downstream Context shape (ORCH-1).**
`operating-contract.md` Protocol 5 keeps the four-subsection table, the length budget, the exclusion list, and the derive-last rule — it is the root. `groundwork-writer/SKILL.md` §"Downstream Context" shrinks to: the two-artifact/two-reader framing (writer-specific, keep), the bet/maintenance exception, the worked example (calibration the contract does not carry — keep), and one pointer: "Structure, budget, and derivation rule: operating contract Protocol 5." Every skill that loads the writer at commit has already loaded the contract (all methodology skills do), so nothing is lost at authoring time. *Improves delivery*: one owner means a P5 edit can no longer half-propagate; the writer file gets ~250 words lighter at its most-loaded moment (commit).

**M2 — Fold the review's type-specific text into the checklists it duplicates (ORCH-2).**
In `groundwork-review/instructions.md`: delete Check 4 entirely; move its two rules into the checklists (they are already there — verify item-by-item, keep the stronger phrasing). Shrink Check 3's maturity and domain-entity special-resolution paragraphs to one line each naming the upstream set ("`maturity` → read `.groundwork/skills/maturity-model.md` first; `domain-entity` → `docs/architecture/index.md` + accepted ADRs, skip superseded") and move the worked violations (Supabase example, overstated-guarantee, unprovisioned-event) into `checklists/domain-entity.md` headers where they already exist — dedupe rather than transplant. *Improves delivery*: the reviewer stops double-reporting the same violation from two sources, and a rule edit lands in exactly one file. Before→after sketch: instructions.md goes from "chain + special cases + type rules" to "chain + generic checks + output contract"; checklists own everything type-shaped.

**M3 — Give the cannot-run procedure one home (ORCH-3).**
Protocol 9 keeps the full "When the review cannot run" procedure (stop-and-report, two paths, no third path). Protocol 8's §"Fail closed when the review cannot run" collapses to two sentences: the gate blocks on anything that is not a parseable PRESENT, and the operational procedure for a review that cannot run is Protocol 9's. Keep protocol numbers stable — consumers cite "Protocol 9's failure path" verbatim (product-brief 137, architecture 06-draft-review, bet 01-discovery) and those references keep resolving. *Improves delivery*: one authoritative statement of the self-review-fallback conditions; today's two copies differ subtly in emphasis (P8 frames it as a permission, P9 as a procedure), which is how a future edit forks the rule.

**M4 — Orchestrator restates less, routes more (ORCH-4, ORCH-5, ORCH-15, ORCH-16, ORCH-6).**
- §Setup Graduation: keep Detection and Record (orchestrator-owned); replace "Run it"'s step re-enumeration with "Load the operating contract and execute Protocol 10 in order; its fail-safe binds — never tear down if graduation could not complete." (~120 words saved, drift closed.)
- §Anytime Skills: cut the patch row to its scope test + route ("bounded fix, no new capability, no contract change — the floor of the three lanes; sizing rules live in *User requests work*") and the update row to trigger phrases + Phase A/B one-liner. The triage section already owns lane discrimination.
- Merge the two `fan_out` paragraphs into one rule stated once ("When routing to `groundwork-scan` or `groundwork-update`, pass `fan_out: parallel|sequential` …").
- Compress the two Skill Paths footnotes to one line per non-routable entry.
- Fix the transclusion bug: table-cell text must be self-contained (no "see … above"); regenerate `workflow-index.md` (`npm run gen:workflow-index`), which shrinks automatically with its source.
*Improves delivery*: the body an agent loads on almost every working session gets ~600 words lighter without losing a single route, and the lane-sizing logic exists in exactly one place, so triage can't quote a stale variant of itself.

**M5 — Re-seat groundwork-check's spec (ORCH-7, ORCH-18).**
Move §"Doc-Type Behaviours" from `groundwork-check/SKILL.md` into `instructions.md` as Step 4's body; SKILL.md becomes a true trigger stub (frontmatter + "workflow in instructions.md, load on invocation"), matching the registered-skill pattern the orchestrator already uses. Delete Step 4's now-redundant summary paragraph. Reword the frontmatter so CI/exit-code claims attach to `npx groundwork-method check` and the skill's own obligation stays "report honestly, mutate nothing." Update the orchestrator Skill Paths row target if the canonical entry file changes (keep it `SKILL.md` as the load point; it forwards). *Improves delivery*: one hop instead of a circle; the scanner-visible file stops carrying 550 words of behaviour spec; the agent stops mimicking process semantics it doesn't have.

**M6 — Relocate the two contract docs out of `templates/` (ORCH-12).**
Move `templates/surfaces.md` → `src/hidden-skills/surfaces-contract.md` and `templates/capability-ports.md` → `src/hidden-skills/capability-ports-contract.md`, siblings of `maturity-model.md`/`repo-map-schema.md` (same species: shape contracts with one writer and many readers). `templates/` retains only true skeletons (discovery-notes, handoff, adr, maturity, domain-entity, gap-ledger). Same-release path sweep over every referencing skill (writers/readers named in §5). *Improves delivery*: directory names predict content again — an agent told "copy the template" cannot accidentally copy a contract spec; contract readers get a stable, semantically named path.

**M7 — One owner for the roadmap vocabulary (ORCH-13).**
`maturity-model.md` owns the severity/recommendation/status value sets and their glosses (it is the durable shipped reference; the ledger is a transient working file). `templates/gap-ledger.md` lists the bare values with "definitions: `.groundwork/skills/maturity-model.md` — write them exactly; a drifted spelling orphans the row." The maturity template's inline restatement points the same way. *Improves delivery*: exact-parse strings have one definition site; today an example edit in the ledger template could silently diverge from the model the checklist reviews against.

**M8 — Trim the Model Tiers section to the shared policy (ORCH-9).**
Operating contract keeps: the two-tier table, tiers-are-classes, the degradation rule ("everything at frontier, never the reverse"), and one sentence each acknowledging the per-slice lift and runtime escalation with a pointer to the bet skill. The lift mechanics (slice flag, authoring moment) move beside Decomposition Step 4; the advisor/`BLOCKING CONCERN` distinction moves into the slice-worker brief where the concept lives. (Cross-section: FLAG(5) below — section 5 receives the moved text.) *Improves delivery*: a design-system or product-brief session no longer loads slice-dispatch mechanics; the bet skill reads its own mechanics next to the step that enacts them.

**M9 — Writer and persona tighten to their own standard (ORCH-10, ORCH-14).**
- Writer §Common Failure Modes: keep the operationally distinct five (passive docs, missing llms.txt, missing `description`, mutable ADRs, identifier drift); delete the five that restate body sections — the body sections are the rule, and skill-writer's own bar says the failure list is for phenomena that don't reduce to a stated principle.
- Persona: compress "Recommend, Don't Just List" to ~90 words (the three load-bearing ideas: carry analysis to a recommendation, ground it in where the ecosystem is heading, name the trade-off that would flip it) and "Speak as the Guide" to the intro plus four one-line bullets. Keep the label-naming bullet as one line pointing at behaviour-level speech; the full rule lives in the writer.
*Improves delivery*: the persona is read before every first reply — a leaner statement of the same posture is the posture; a 250-word lecture about not lecturing undercuts itself.

**M10 — Review instructions: honest headings, no history (ORCH-11, plus length).**
Rename Check 1 to "Internal Coherence" and cut its narrowing preamble to the one operative sentence (fidelity hints arrive from the caller in the prompt). Cut the "earlier versions of this skill" paragraph; the isolation rationale is one sentence ("deliberation stays here; only the verdict returns") and Protocol 9 owns dispatch. Keep the Invocation environments table — it is the reviewer's side of the contract and genuinely environment-calibrating.

**M11 — Name the two-gate split (ORCH-19).**
One sentence in each checklist header: decomposition.md — "Proof-of-work *authorship* is judged here; existence/currency at delivery start is `implementation-readiness.md`'s job"; implementation-readiness.md already states the inverse ("mechanical existence and consistency checks, not authorship review") — add the counterpart pointer. Costs ~30 words, prevents the merge-or-fork failure.

**M12 — Point Protocol 1 at its template (ORCH-17, ORCH-8).**
P1 step 2 gains "create it from `.groundwork/skills/templates/discovery-notes.md`"; the header-description table stays in the contract (it is the calibration consumers read), and the template's comments shrink to short pointers so descriptions live once. Fix `methods.md` "Assumption Audit" row: "Summary-for-Downstream sections" → "Downstream Context files, binding constraints".

---

## 4. Cuts

Content removed outright, with why the intention survives:

1. **Protocol 8's long fail-closed/self-review passage** (~180 words net) — the identical rule remains in full in Protocol 9, which every consumer already cites for the failure path. Nothing is un-said; it is said once.
2. **Review instructions Check 4** (~330 words) — both rules exist verbatim in `checklists/bet-pitch.md` and `checklists/maturity.md`, which load for exactly those document types. The checklist *is* the type-specific pass; Check 4 was a vestigial second copy.
3. **Review instructions' historical justification** ("Running the review in-context, the way earlier versions of this skill operated, paid the cost…") (~60 words) — rationale-by-contrast with a dead design; the live rationale (isolation keeps the caller's window clean and the judgement independent) is retained in one sentence.
4. **Orchestrator's inline restatement of Protocol 10's three steps + fail-safe** (~120 words) — Protocol 10 is loaded at the moment of execution (the orchestrator's own instruction says to load the contract first); the steps live there.
5. **Orchestrator Anytime-row lane pedagogy** (~170 words across patch/update rows) — the Work Intake triage section carries the sizing rules; the rows keep the scope test one-liner and the route. The generated index shrinks with it.
6. **One of the two `fan_out` paragraphs** (~70 words) — same rule, merged.
7. **Skill Paths footnote prose** (~150 words) — adoption context survives in each persona/stack-forge skill's own header, which is what actually loads when adopted.
8. **Writer's five body-restating failure modes** (~150 words) — each names a body section that remains; the failure list keeps only phenomena with no body twin.
9. **Writer's copy of the Protocol 5 structure table, budget, and exclusions** (~250 words) — root retained in the operating contract; the writer keeps the worked example (the part with calibration value the contract lacks).
10. **groundwork-check Step 4 summary paragraph** (~90 words) — replaced by the behaviours themselves moving into Step 4 (net-neutral there; the cut is the duplicate summary).
11. **Persona verbosity** (~350 words across two sections) — compression, not deletion of ideas; every bullet's intent survives as one line.
12. **Model Tiers delivery mechanics** (~280 words) — *moved*, not lost: per-slice lift to the decomposition step that sets the flag, advisor/BLOCKING-CONCERN distinction to the slice-worker brief that enacts it (FLAG(5)).
13. **Gap-ledger tier glosses** (~120 words) — definitions survive in `maturity-model.md`, which the template now cites as the single owner.

Total removed or relocated ≈ 4,300 words (~12% of the section), all of it duplication, restatement, or misplaced altitude — no protocol, route, identifier, or calibration example is lost.

---

## 5. Risks & cross-section flags

**Execution risks**

- **Operating-contract version**: every move preserves protocol numbers and semantics — no behaviour changes, so the contract stays `version: "1"` and no `[migration]` entry is needed for it. Verify by re-running the consumer greps in this review (P1–P10 citations all resolve to the same numbered protocols).
- **Shipped-surface classification**: all files here are tier-1 (framework-owned skills, clean-replaced on update) — changes are `[no-migration]`, per the contributor guide's "skills are exempt (clean-copy carries them)". The M6 relocation moves files *within* `.groundwork/skills/`, still tier-1; it needs **no migration** but does need every referencing path updated in the same commit, because old installs get the whole tree clean-replaced atomically.
- **M6 path sweep (writers/readers to update in one commit)**: `templates/surfaces.md` is cited by `groundwork-check/SKILL.md` (contract pointer), `groundwork-architecture` phase 07, `groundwork-architecture-extract`, `groundwork-surface-activation`, `groundwork-bet` 05-validation, `groundwork-update` (Surfaces family); `templates/capability-ports.md` by `groundwork-architecture` 07-commit and `groundwork-scaffold` phases 01/02/04. Grep for `skills/templates/` after the move; the cross-phase contracts table in the contributor guide also names both rows.
- **Workflow-index regeneration**: any SKILL.md table edit requires `npm run gen:workflow-index` in the same commit (the generated header says so); the workflow-index freshness gate will otherwise fail.
- **Identifier pairs to hold**: discovery-notes five headers (P1 table ↔ template ↔ every phase's init step); Downstream Context four `###` subsection names (P5 ↔ writer example ↔ product-brief commit step 224); `VERDICT: PRESENT|REVISE` / `REVIEW_UNAVAILABLE` strings (P8/P9 ↔ review output contract ↔ every drafting phase); severity/recommendation/status vocab (maturity-model ↔ gap-ledger ↔ maturity checklist ↔ check Step 3). None of these strings changes in this plan; the moves reduce the number of places they are written.
- **Sync anchors**: none of this section's files carries a `sync-anchor.md`; no cascade. (The persona/discipline skills that do are untouched.)
- **groundwork-check consolidation (M5)**: the orchestrator Skill Paths row and the `groundwork-update` Family Index reference `groundwork-check` by path — keep `SKILL.md` as the load entry (stub forwarding to instructions) so no external reference changes.

**Cross-section flags**

- FLAG(5): Operating-contract §Model Tiers — the "Per-slice lift" mechanics and the advisor/`BLOCKING CONCERN` escalation distinction (~280 words) should move into groundwork-bet canon: the lift beside Decomposition Step 4 (where the flag is authored) and the escalation text into `briefs/slice-worker.md`. The contract retains the two-tier policy, class definitions, and the never-downgrade rule. Coordinate wording so `tier:` frontmatter semantics stay identical.
- FLAG(5): `groundwork-review/checklists/implementation-readiness.md` is applied inline by the bet delivery workflow, not via Protocol 9 — if section 5 restructures delivery, keep this path and its "never a `document_type`" carve-out stable, and adopt the M11 counterpart-pointer sentence on the delivery side.
- FLAG(6): `groundwork-update`'s Family Index and reconcile-worker deliberately grep for legacy `## Summary for Downstream` sections as *detection signals* — the distillation must not scrub those two references (`groundwork-update/instructions.md:135`, `briefs/reconcile-worker.md:140`); they are legacy-shape detectors, not drift. Also coordinate on M5: `groundwork-check` stays reachable at `.agents/skills/groundwork-check/SKILL.md`.
- FLAG(4): The orchestrator's "Brownfield completion is a contract check" depends on extract skills writing `generation_mode`/`source_of_truth` frontmatter and `.groundwork/context/<phase>.md` files — if section 4 rewrites the extract skills, these are the exact strings the router checks; change both ends or neither.
- FLAG(3): `groundwork-review/checklists/design-system.md` item "Target-structure gap" references "the track's target structure" — if section 3 restructures the design-system tracks' target structures, this checklist item's vocabulary must move with them (the checklist lives in my section; the structure it names lives in yours).
- FLAG(9): Each engineer SKILL.md carries a ~90-word inline summary of the code-intelligence orientation workflow before pointing at `.groundwork/skills/code-intelligence.md`. The pointer path must survive any engineer-skill rewrite; consider whether the inline summaries can shrink to the pointer plus one sentence — the full workflow is one `Read` away and recently calibrated.
- FLAG(10): skill-writer standard gap — it names root-document drift and identifier drift but has no rule for **generated/transcluded text**: table cells authored in one file and rendered into another (orchestrator SKILL.md → workflow-index.md) must be self-contained, carrying no file-internal cross-references ("see § above") and no assumptions about surrounding headings. ORCH-6 is the live instance; suggest adding this as a named failure mode.

---

## 6. Expected outcome

| File | Current | Target | Delta |
|---|---|---|---|
| orchestrator `SKILL.md` | 2,688 | ~2,050 | −640 |
| `workflow-index.md` (generated) | 636 | ~480 | −155 |
| check `SKILL.md` | 682 | ~120 | −560 |
| check `instructions.md` | 926 | ~1,380 | +455 (absorbs behaviours; pair nets −105) |
| `operating-contract.md` | 6,786 | ~5,650 | −1,135 |
| persona `instructions.md` | 1,307 | ~950 | −355 |
| writer `SKILL.md` | 3,164 | ~2,450 | −715 |
| review `instructions.md` | 2,033 | ~1,300 | −735 |
| review `checklists/` (10) | 8,558 | ~8,500 | −60 (small dedups, +pointer sentences) |
| elicit (2 files) | 1,818 | ~1,790 | −30 |
| `templates/` (8 → 6 files + 2 relocated) | 3,981 | ~3,800 | −180 |
| `code-intelligence.md` | 1,566 | ~1,470 | −95 (light density pass only — recently calibrated) |
| `repo-map-schema.md` | 651 | 651 | 0 (already a clean contract) |
| `maturity-model.md` | 1,527 | ~1,480 | −45 (absorbs vocab ownership, sheds nothing structural) |
| **Total** | **36,323** | **~32,070** | **≈ −4,250 (−12%)** |

**What improves in agent behaviour:**

- **Routing sessions get lighter and less self-contradicting.** The orchestrator body — loaded on nearly every working session — drops ~24% while keeping every route; lane sizing exists once, so the triage the agent quotes is always the triage it runs.
- **Protocol edits propagate.** P5, the review fail-closed rule, the P10 steps, and the roadmap vocabulary each gain a single definition site; the failure class "fixed the root, consumer still carries the old copy" loses its four biggest current instances.
- **The reviewer double-reports less and drifts less.** Type rules live only in the checklist that loads for that type; the generic pass stays generic. Verdict semantics, dispatch, and cannot-run procedure form a clean P8/P9/review-instructions triangle with no shared text.
- **Directory names predict content again.** `templates/` means skeleton; shared contracts sit with their siblings; the check skill's registered file is a trigger, not a spec.
- **Always-on posture stays, at posture-appropriate weight.** The persona says the same things in fewer words — which is itself the behaviour it prescribes.
