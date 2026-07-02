# GroundWork Distillation — Master Execution Plan

**Status:** EXECUTED 2026-07-02 — see EXECUTION.md for the per-slice record
**Audience:** GroundWork contributors executing the distillation; the ten per-section plans in this directory are the detailed inputs and remain the finding-level authority.
**Scope owner:** whole instruction surface — `src/hidden-skills/`, `src/skills/`, `src/engineer-skills/`, `src/docs/`, `.agents/skills/` (vendored skills excluded), `migrations/`, plus the small code seams the reviews exposed (`bin/groundwork.js` promotion path, `cli-src/.../bet.ts`, `scripts/lint_skills.py`).

This plan synthesizes ten section reviews (files `01`–`10` in this directory), each of which read its full section against the skill-writer standard and the operating contract, reconstructed the intention behind every file, and proposed distillation moves with per-file deltas. Every cross-section `FLAG(n)` raised by the reviewers is resolved here — either into a workstream slice or into the decisions tables.

---

## §0 Mental model

GroundWork's instruction surface (~323k words) grew through ~20 sequential uplifts. Each landed well; the reviews found the underlying material is **healthy** — the operating contract's protocols are genuinely enacted (no dead protocols found), the personas and the design references are model distillations, the principles corpus is stance-first post-rewrite. The disease is not rot. It is **accretion mechanics**:

1. **Duplication-by-overlay.** Each uplift restated its doctrine at every consumer instead of giving it one home. The honest-green tells live in ≥7 files; the front-door rule in ~6; the commit tail in 4; the review-dispatch mechanics in ~11 places *against the contract's own "never restated per skill" rule*; the lethal trifecta 3×; the testing spine verbatim ×5.
2. **Alignment-by-copying.** The sibling-consistency rule was satisfied by pasting shared lifecycles into every sibling — manufacturing 3–4-way drift surfaces (design tracks' Phase-5 machinery ×3, extract skills' revise-cap ×2-of-4, engineer testing framing ×5).
3. **Live drift, already paid for.** A dozen confirmed instances: scan exclusions template vs its reference; extract ADR fields vs the governed template; `ways-of-working/` teaching a delivery model three overhauls old (feature-flag milestones — the doctrine the front-door redesign retired); skill-writer's own flagship exemplar teaching that same retired canon; six code-drift instances in the contributor guide; a go security reference re-stamped against its pinned source without content.
4. **A handful of real defects** hiding under the volume: the full-bet flow never writes the `bet/<slug>/approved` tag its own readiness gate hard-blocks on; the slice `Surface` field has readers but no writer; `.groundwork/context/scaffold.md` has a writer but no reader; `./dev new slice` hardcodes `.py`; a shipped template mis-parents the brand-tokens `platform` block.
5. **The lens was silent.** skill-writer has no audience taxonomy (so briefs and engineer gates read as violations), no context-budget model, no integrate-don't-append rule, no doneness test — the exact disciplines whose absence produced 1–4.

**The thesis of the fix:** distillation here is not word-count reduction — it is *giving every piece of doctrine exactly one home and every shared identifier exactly one writer*, then letting consumers point. The aggregate word delta (−48k, −15%, and −24% off the always-loaded surfaces) is a *byproduct* of single-homing; the behavioural wins are that protocol edits propagate, gates become satisfiable, and the next 20 uplifts land against a standard that resists appending.

**Sequencing thesis:** fix the lens first (it changes judgment for everything after), land the defects early (they are independent and high-value), fix the shared roots before the consumers (contract before skills), and batch the product-deliverable edits by sync-anchor blast radius (the expensive dimension is pin re-stamps, not words).

---

## §1 Findings — repo-wide themes

Per-section findings keep their IDs (ORCH-*, GREEN-*, DESIGN-*, BROWN-*, BET-*, MAINT-*, PERSONA-*, PRIN-*, ENG-*, META-*). The master themes below are what the workstreams reference.

| ID | Theme | Evidence (representative section findings) |
|---|---|---|
| T1 | **Defects: identifier with readers but no writer, or writer but no reader** | BET-1 (approval tag never created), BET-2 (`Surface` field), GREEN-4 (`context/scaffold.md` unread), BET-9 ("reference apps" unresolvable), BROWN-9 (doc-shape pointer resolves to nothing), BET-8 (dead "area G" ref) |
| T2 | **Live content drift** | BROWN-2 (exclusions), BROWN-8/GREEN-9 (ADR fields), PRIN-1/2 (ways-of-working false canon), META-1 (skill-writer exemplar), META-5/META-7 (contributor/scaffold-designer vs code), ENG-2 (go security re-stamped hollow), ENG-8 (electron deferral → stub), PRIN-4 (broken links), ORCH-8 (elicit phantom section), PRIN-13 (llms.txt scent) |
| T3 | **Protocol restated against the contract's own no-restatement rule** | GREEN-1/2, DESIGN-15, BROWN-1/3, BET-5, MAINT-7; plus root-side twins ORCH-1/3 |
| T4 | **Doctrine sprawl — one rule, many full homes** | BET-6/7 (honest-green, front-door), GREEN-5 (pitch canon), PRIN-3 (ADR ×3), PRIN-5/6 (resilience, trifecta), PERSONA-2/3 (AI economics, protocol stack), ENG-5 (testing spine ×5), ENG-6 (code-intel ×10), BROWN-10/11 (`--surfaces`, interface-type), MAINT-2 (recipes ×2) |
| T5 | **Alignment-by-copying across siblings** | DESIGN-1/2 (track machinery ×3), BROWN-1/16, ENG-4/14, GREEN-15 |
| T6 | **Context-tax misplacement** | ORCH-5/7/14 (always-on orchestrator/persona/check), META-4 (contributor 4k on-demand words always-on), GREEN-7, ENG-1 (nextjs tutorial mass), DESIGN-3 (instructions discarded before use) |
| T7 | **Genre drift in references** | ENG-1 (framework tutorial), PERSONA-1 (near-copy compression), ENG-3, PRIN-11 (vendor catalogs) |
| T8 | **Temporal anchoring in durable files** | PERSONA-4, PRIN-11 (year-stamped claims shipping into projects) |
| T9 | **Guard gaps in the maintenance machinery** | PERSONA-7/11 (anchors don't name their references; no link lint), ENG-2/FLAG(8) (re-stamp without reconciliation), PRIN-9 (embedded-but-unpinned), ENG FLAG(6) (update never refreshes promoted engineer skills), DESIGN-11 (anchor proves review, not distillation) |
| T10 | **Lens gaps in skill-writer** | META-2 (audience taxonomy), META-3 (budget/doneness/accretion), plus the five convergent FLAG(10)s: extraction-over-copies, driver/worker pairs, brief operational-restatement exception, transcluded-text self-containment, references-genre standard |
| T11 | **Sandbox leakage** | ENG-10 (meeting-transcription domain), PRIN-12 (product-shape framing) |
| T12 | **Dead/misfiled weight** | BROWN-6 (second completion marker), ORCH-12/BET-21 (contracts/instructions filed as templates), ENG-7 (sync-anchor shipped to users), ENG-13 (phantom-skill routing), MAINT-6 (bootstrap for installs that may not exist) |

Aggregate proposed outcome across the ten plans: **~323k → ~275k words (−48k, −15%)**, with the sharpest cuts exactly where load frequency is highest — orchestrator body −24%, contributor always-on −62%, bet delivery −26%, nextjs engineer −49% — and three deliberate *additions* (skill-writer +240 accretion-resistance principles; designer usability reference +130; product-risks ethics calibration +30).

---

## §2 Workstreams

Each slice names its inputs (per-section plan moves), files, and an acceptance check. A slice is one reviewable commit unless noted.

### WS-A — Fix the lens and the repo's self-governance (execute FIRST)

*Inputs: plan 10 (all moves) + the six FLAG(10)s from plans 1–6, 9 + PRIN FLAG(10).*

| Slice | What | Acceptance |
|---|---|---|
| A1 | **skill-writer rebuild**: canon-neutral exemplar (META-1); audience taxonomy — facilitation / dispatched-briefs+execution-routers / reference — with existing principles scoped to it (META-2); "The budget" cluster: budget-by-load-tier, integrate-don't-append, done-when-cutting-changes-behaviour (META-3); density rule back-ported from groundwork-writer (META-9); "the description is the router" (META-8); Common Failure Modes → "Cross-file integrity" (META-11). **Fold in the convergent cross-section amendments**: consistency-by-extraction, not synchronized copies (DESIGN/BROWN FLAG(10)); driver/worker pairs — rationale with the decision-maker, recipes with the executor (MAINT FLAG(10)); a dispatched brief may restate the *operational* form of a rule it enforces, never the rationale (BET FLAG(10)); transcluded/generated text is self-contained (ORCH FLAG(10)); `references/` are decision-time distillations, never framework manuals, and newest-sibling-as-template extends to reference files (ENG FLAG(10)); one-line runtime-mirror note naming `groundwork-stack-forge/references/authoring-engineer-skills.md` (GREEN FLAG(10)). | File reads as one integrated standard (no appended-overlay seams); the three relocated failure modes verified present in their owning shipped skills before deletion (DESIGN FLAG(3): shallow-translation/ambiguous-medium live in design-system tracks; PERSONA FLAG(7): propose-the-pattern lives in the facilitation flow) |
| A2 | **Contributor guide split + truth pass**: always-on core ~2,800 w; `references/{testing,releasing,cross-phase-contracts}.md` (META-4/M7); fix all six code-drift instances (META-5/M8); delete Writer Enforcement table, add `writer-ref` check to `scripts/lint_skills.py` (META-6/M9); collapse operating-contract duplication to pointers (META-10); **add the brownfield chains to the cross-phase-contracts reference** (BROWN FLAG(10)) and **fix the four-vs-five discovery-notes headers row** (PRIN FLAG(10)); record the greenfield workflows + bet workflows as readers of persona reference filenames (GREEN FLAG(7)). | `./dev ci` green incl. new lint; grep shows no `CLAUDE_API_KEY`, no bare `npx groundwork ` |
| A3 | **scaffold-designer re-grounding** (META-7/M11–12): engineer-skill path fix, four-layer harness pointer, generators.json + changelog-gate steps, checklists to question form (item count unchanged). | Item count identical pre/post |
| A4 | **CLAUDE.md/AGENTS.md router completion** (META-12/M13): +Flutter/Electron rows, drop duplicated delivery rule. | All routed paths exist |
| A5 | **New mechanical guards** (T9): reference-link lint (PERSONA M9 — every `references/<x>.md` mention in SKILL.md/workflows/references resolves); sync-anchor `Distilled into` column in all 8 anchors (PERSONA M8; regex-compatible, no script change); adopt the convention that a hash re-stamp requires a commit-message line naming what was reconciled (ENG FLAG(8)). | Link lint runs in `./dev ci` and passes; anchors carry the third column |

**Why first:** A1 re-weighs downstream judgments — under the taxonomy, the bet briefs' and engineer skills' imperative register is *conformant* (META FLAG(5)/FLAG(9)); no executing agent should "fix" gate-shaped briefs into peer-stance prose. A5's link lint must exist before WS-F's reference merges/renames.

### WS-B — Defects and live drift (independent; can land in parallel with anything)

*Inputs: T1 + T2 items that need no restructuring.*

| Slice | What | Acceptance |
|---|---|---|
| B1 | **Seal the full-bet baseline** (BET M1/M2): 03-decomposition Transition creates `bet/<slug>/approved`; 04 Amendment Protocol re-tags; slice spec + `templates/decomposition/slice.md` gain `Surface:`; extend the groundwork-update **Bets family** advance to tag/backfill pre-change in-flight bets. | A dry-run full bet passes `implementation-readiness.md` Step 0; strings byte-match the checklist |
| B2 | **CLI truths** (BET FLAG(2)): `bet.ts` `newSlice`/`newMilestone` discover the test language instead of hardcoding `.py`; verify `SLICE_RE` vs multi-underscore names; prose adopts the CLI's bet-global `<N>` semantics (BET M12's numbering half; 00-quick drops the hardcoded `1`). Rebuild dev bundle. | `./dev test cli` green; bundle-freshness contract green |
| B3 | **Setup-chain fixes**: MVP reads `context/scaffold.md` (GREEN M4); resume ledgers completed (GREEN M5); scaffold cites only verified maturity evidence (GREEN M10); scan exclusions single-sourced + `scan/complete.md` retired with eval descriptor repointed (BROWN M2/M6); extract ADR list deferred to `templates/adr.md` (BROWN M8) and greenfield 07-commit checked for the same (BROWN FLAG(2)); infra-adopt doc-shape pointer resolves (BROWN M9). | Greps in each plan's §5 verify writer/reader pairs |
| B4 | **Shipped-contract repairs**: brand-tokens `- platform` bullet (DESIGN MOVE-8); corpus `../../decisions/` links (PRIN M2); elicit "Summary-for-Downstream" → Downstream Context (ORCH M12); "area G" → `NATIVE-CHECK-CONTRACT.md` (BET M6 item); electron accessibility deferral → `references/accessibility.md` (ENG M7, the non-M1-dependent half); product SKILL.md maturity hedge (PERSONA M12); update lane enacts Protocol 1 at close-out (MAINT M3). | Each is a one-file-pair change; `./dev ci` green |

### WS-C — Operating contract & orchestration spine

*Inputs: plan 1 (all moves) + the contract-touching flags from plans 2, 4, 5.*

| Slice | What | Acceptance |
|---|---|---|
| C1 | **Contract root pass** (one commit): P5 single-homed (ORCH M1); P8/P9 cannot-run rule one home (ORCH M3); P1 points at its template (ORCH M12); **absorb the revise-cap hard-stop diagnostic into P8** (BROWN FLAG(1)/M1); **terminal-phase carve-outs for MVP and infra-adopt** in Lifecycle Modes (GREEN FLAG(1) + BROWN FLAG(1)); Model Tiers trimmed to shared policy, mechanics staged for WS-E receipt (ORCH M8 — land the contract cut and the bet-side paste in the same commit as E1). Contract stays `version: "1"`. | Consumer greps: every P1–P10 citation resolves; no protocol semantics changed |
| C2 | **Orchestrator + check + persona + writer + review** (ORCH M2, M4, M5, M9, M10, M11): router restates less; check spec re-seated into instructions.md; review Check 4 deleted into checklists; two-gate split named (decomposition ↔ implementation-readiness, adopting the counterpart-pointer on the delivery side too — ORCH FLAG(5)); regenerate workflow-index. While editing the review checklists, dedupe the front-door/honest-green enumerations against WS-E's canonical homes (BET FLAG(1)): the decomposition checklist stays the reviewer-side superset; 03 keeps the author-side gate that cites it. Keep `groundwork-check` reachable at its SKILL.md path (MAINT FLAG(1) coordination: orchestrator routing rows for update/doc-sync/surface-activation move in the same change as WS-G's restructure — stage those rows there, not here). | Workflow-index freshness gate green; `implementation-readiness.md` 🔴 strings byte-stable (WS-B B1 depends on them) |
| C3 | **Templates directory honesty** (ORCH M6/M7): `surfaces.md` + `capability-ports.md` relocate to `src/hidden-skills/*-contract.md` siblings of maturity-model; path sweep over all named referencing skills; gap-ledger vocabulary single-owned by maturity-model. | `grep -r 'skills/templates/' src/` shows only true skeletons; contributor contracts table updated |

### WS-D — Setup lanes (greenfield · design · brownfield)

*Inputs: plans 2, 3, 4; the shared-home decisions D3–D6 below.*

| Slice | What | Acceptance |
|---|---|---|
| D1 | **Protocol-conformance collapse across all setup skills**: commit tails → parameter blocks (GREEN M1); review invocations → Protocol-9 payloads (GREEN M2, DESIGN MOVE-1's review part, BROWN M1's caller side); operating-contract framing paragraph deduped (GREEN M12); completion-signal shadow copies collapsed (BROWN M3). | Per-skill: trigger point + `document_path`/`document_type` still explicit (Protocol 3.2 chain naming kept) |
| D2 | **Design-system machinery extraction** (DESIGN MOVE-1/2/3/6/10, DESIGN-14 coupling): shared Phase-5/Phase-3 machinery into `_foundation.md`; tracks keep medium content; instructions.md on a routing diet; **surface-activation lazy path updated in the same commit** (MAINT M7/FLAG(3): tracks own a "standalone invocation" note; activation points instead of paraphrasing). | Dry read-through of the hybrid two-type case (graphical-ui + cli); surface-activation loads the machinery |
| D3 | **Single homes for setup's shared contracts** (D4–D6 below): interface-type taxonomy one citable home with extract aligned to the same one-test wording (DESIGN MOVE-4 + BROWN M11/FLAG(3)); `--surfaces` invocation contract stated once beside the surfaces contract file, cited by scaffold/infra-adopt/surface-activation (BROWN M10/FLAG(2)/FLAG(6)); product-brief shape given one referenced home on the architecture-template pattern (BROWN M19/FLAG(2) + GREEN M9's product-brief side); Design References spec owned by graphical-ui Commit Contributions (DESIGN MOVE-5). | Two-writers checks: extract and greenfield classify/shape from the same text |
| D4 | **Scaffold/MVP right-sizing** (GREEN M3/M6/M7/M8/M11/M13): MVP routes pitch canon to the bet-owned home (lands with E2); one flag catalog; stack-forge honest contract claim. | Orchestrator's flag-catalog pin still true (section-1 pointer re-verified) |
| D5 | **Brownfield distillation remainder** (BROWN M4/M5/M7/M12–M17): mode-detection once, scan trims, drafting-paragraph split with the anchor rule unmissable, interview triplets tightened, compose merge as invariant. | The four signature stances survive verbatim-strength (named in plan 4 §5) |

### WS-E — Bet delivery

*Inputs: plan 5; receives Model-Tiers mechanics (C1), pitch canon (D4), ways-of-working review duty (F1).*

| Slice | What | Acceptance |
|---|---|---|
| E1 | **Doctrine single-homing** (BET M3/M4): `instructions.md` rebuilt as router + "The three invariants"; authoring-time tells canonical in 03; acceptance-auditor keeps operational bullets (legitimate under the A1 brief exception); restatements deleted from the 6 satellite files. Receive the per-slice-lift text beside Decomposition Step 4 and the advisor/`BLOCKING CONCERN` text into slice-worker (from C1, same commit as the contract cut). | The tells enumerated in exactly one authoring home + one cold brief; `tier:` semantics unchanged |
| E2 | **Pitch canon one home** (GREEN FLAG(5)/BET): canonical statement in `templates/pitch.md` + worked example in 01-discovery; MVP thinned to its deltas (GREEN M3); discovery tracks merged, Stakes restored (BET M10). | Both writers of `document_type: bet-pitch` cite one standard; reviewer checklist aligned |
| E3 | **04-delivery rebuild around driver decisions** (BET M6): topology table compressed; Serena caveat re-homed to `code-intelligence.md`; bet-close pointed at 05 Step 8.5; tier restatements dropped; amendment format once; postmortem kept. 05 confirms rather than restates (BET M8). | Driver decision points (triage, pause, amendment routing) at top level; no dead refs |
| E4 | **Briefs and templates right-sized** (BET M7/M11/M12/M13): slice-worker/coverage-auditor defer to `testing.md`'s Bet Slice Rollout as authority (coordinate F3: heading + obligation names are a published contract — ENG FLAG(5)/BET FLAG(9)); technical-design templates to skeletons; bet-progress guide relocated to `groundwork-bet/references/bet-progress-tests.md` (D8 below) and cut to mechanics; "reference apps" resolved to `## Design References` everywhere (BET M13 + DESIGN confirmation). | Experience-auditor inputs assemblable from named paths; contributor contracts-table row updated for the moved file |
| E5 | **Lane boundaries owned by Work Intake** (BET M9): patch/quick keep membership tests only; decide patch's "queued-bet dependency" criterion (D9). Persona adoption seams across 01/02/05 thinned to pointers at the personas' Context Routing tables (DESIGN FLAG(5)b, BET FLAG(7), PERSONA pattern rule). | One sizing rule; adoption seams are pointers (architect seam in 02-design is the model) |

### WS-F — Product deliverables (principles corpus · personas · engineer skills), batched by anchor blast radius

*Inputs: plans 7, 8, 9; A5's link lint and `Distilled into` columns land first.*

| Slice | What | Acceptance |
|---|---|---|
| F1 | **Pin-free corpus batch** (PRIN M1/M9/M11 + llms.txt): ways-of-working rewritten from current bet canon — **bet-delivery reviewer signs off on canon fidelity** (PRIN FLAG(5)); day-2 baseline pinned in the stack-forge anchor; llms.txt descriptions re-scented. | Zero anchor re-stamps; milestone/lane vocabulary quoted from 03/00-quick |
| F2 | **Architect-batch corpus edits + persona reconciliation in one commit** (PRIN M2–M8 batch B + PERSONA M1–M5, M7, M10): resilience/orch-choreo/trifecta/ADR/appetite/AI-economics single-homed; vendor catalogs to decision rules; de-dating sweep at source *and* references together (PERSONA M5 + PRIN FLAG(8)); architect reference merges (identity→security-and-trust, durable-execution→integration-and-workflows) with the adoption-seam filename sweep (bet 02-design, greenfield phases, routing tables) verified by the A5 lint; progressive-delivery vs no-flag-trunk boundary stated corpus-side (META FLAG(8)b). | `./dev test contracts` green in the same commit (anchors re-stamped with reconciliation notes); ~9 architect pins + 1 product pin as priced in plan 8 §5 |
| F3 | **Engineer-skills rebuild** (ENG M1–M5, M8–M11 + PERSONA/ENG family moves): nextjs rebuilt in the flutter/electron genre with `version-corrections` concentration and sandbox-domain sweep (ENG M1 + T11); go security/integration parity rewrite (ENG M2); one home per concept per skill (ENG M3); testing spine deferred to shipped canon with graceful-degradation stubs (ENG M4, D7); code-intel stated once per skill (ENG M5 + ORCH FLAG(9): shrink to pointer + one sentence); ux-principles values-free (ENG M8 — design-system tracks confirmed as the motion/feature owner per DESIGN); handoffs collapsed (M10); TOCs dropped (M11); electron deferrals repointed with the restructure (ENG M7). Backend tier names aligned (ENG-14). **Family-wide `## Operating Contract` → `## Operating Rules` rename across 3 personas + 5 engineer skills in this batch, all-or-nothing** (PERSONA M11, D10). | Generation tests updated where promoted trees change; every electron deferral resolves post-restructure; family spines match the newest sibling |
| F4 | **Promotion + propagation mechanics** (ENG M6 + ENG FLAG(6)): `promoteEngineerSkill` skips `sync-anchor.md`; **new groundwork-update reconcile family for promoted engineer skills** (provenance-based re-promotion via `manifest.generated`) so F3's improvements reach existing installs — owned jointly with WS-G. | Generation tests green; Family Index row + worker recipe added; fixture exercised |
| F5 | **Deferred multi-pin edits** (PRIN M3's documentation.md §8, M12 freshness alignment, security/reliability openers): fold into F3's batch if it already re-stamps those anchors, else defer to next content edit (PRIN batch D/E discipline). ENG M12 stack-doc near-copy audit runs after F3 settles the reference state. | No anchor re-stamped for cosmetics alone |

### WS-G — Maintenance lane

*Inputs: plan 6; coordinates with C2 (orchestrator rows) and F4 (new family).*

| Slice | What | Acceptance |
|---|---|---|
| G1 | **Update driver/worker pair** (MAINT M1/M2/M4): one driver loop, Family Index as detection table with slug column, recipes only in the worker, isolation rationale driver-side only. Orchestrator routing rows for update/doc-sync/surface-activation updated in this commit (MAINT FLAG(1)). | Family slugs match worker capsule examples; capsule "Advance approach" bullet kept |
| G2 | **doc-sync + migrations trims** (MAINT M5/M8/M9): staleness baseline owned by check; boundary once; summaries one line. | Gate tests green |
| G3 | **Surface-activation** (MAINT M6/M7 + D2 coupling): bootstrap compressed now; **evidence task** — `npm view groundwork-method versions` + pre-publish install census; retire bootstrap + orchestrator clause + family arm together if confirmed (open decision D-O1). Step 2 delegates track mechanics (landed in D2). | Retirement lands as one three-file change or not at all |
| G4 | **Freshness number picked** (PRIN FLAG(6)/M12): align `foundations/documentation.md` to the shipped 12-month advisory (D11). Confirm Phase-A merge behaves on a heavily-edited `docs/ways-of-working/` (F1 fallout). | groundwork-check behaviour documented once |

---

## §3 Decisions

### Settled

| # | Decision | Rationale |
|---|---|---|
| D1 | **skill-writer changes land before any other section executes; executors apply the new lens.** Concretely: brief/engineer imperative register is conformant (drop any finding that says otherwise — none of the ten plans ultimately proposed softening, so this is a guard, not a rework); the bet `instructions.md` run-on bullets are WS-E's to fix under the density rule. | The lens governs every downstream judgment (META FLAG(5)/FLAG(9)) |
| D2 | **Consistency-by-extraction is the default; synchronized copies only when no shared file is co-loaded.** | Three sections independently derived it (DESIGN-1, BROWN-1, ENG-5) |
| D3 | **Pitch canon home: bet-owned** (`templates/pitch.md` + 01-discovery example); MVP keeps only its deltas. | Both writers produce `document_type: bet-pitch`; the reviewer enforces one bar (GREEN M3 ↔ BET agreement) |
| D4 | **Interface-type taxonomy: one citable home with the "who consumes the output" test**; greenfield Step 2 owns it, extract cites. | Most-shared identifier in setup (BROWN-11, DESIGN MOVE-4) |
| D5 | **`--surfaces` invocation contract: one statement beside the surfaces contract file** (post-C3 relocation), cited by its three invokers. | Four statements at three fidelities today (BROWN-10) |
| D6 | **`## Design References` in `docs/design-system.md` is the canonical "reference apps" artifact**; graphical-ui Commit Contributions owns its spec. | No other writer exists (BET-9, DESIGN MOVE-5) |
| D7 | **Engineer testing spine defers to shipped canon** (`docs/principles/foundations/testing.md`) with one-clause graceful-degradation stubs — not a `_shared/` copy mechanism. | No generator change; canon ships to every project; stubs keep direction if the tier-2 doc is edited (ENG M4) |
| D8 | **`bet-progress-test.md` relocates to `groundwork-bet/references/`** and is cut to mechanics. | Same directory-honesty rule as C3 (templates hold skeletons); contributor row updated (BET M12, ORCH-12 precedent) |
| D9 | **Patch's "changes nothing a queued bet depends on" criterion is real policy → moves into the orchestrator's Work Intake**; patch cites it. | It encodes a genuine hazard; a lane test living only in the lane is invisible at triage (BET FLAG(1)) |
| D10 | **Rename persona/engineer `## Operating Contract` → `## Operating Rules`, family-wide in F3, all-or-nothing.** | Collision with the real contract root; both owning sections endorse (PERSONA M11, ENG FLAG via PERSONA FLAG(9)) |
| D11 | **Slice test `<N>` = bet-global ordinal (the CLI's semantics).** Prose bends to shipped code. | Reverse requires a CLI release; collision risk gone (BET-15) |
| D12 | **The corpus keeps shipping tier-2, and the split relationship is documented once**: personas are self-contained because tier-1 must survive a user-edited/deleted corpus and essays are the wrong decision-time shape; engineer skills and bet briefs may defer to the corpus by live path because it ships into the same project. State this in the contributor guide's two-layer section (A2). | The corpus has verified runtime consumers (PRIN §1); "might not have it" was the wrong reason, not the wrong rule (PERSONA-14) |
| D13 | **Corpus edits: no renames, no deletions; batch by anchor as priced in plan 8 §5.** | Tier-2 stays on the ordinary refresh/merge path; ~16 pin re-stamps instead of ~60 |
| D14 | **De-dating: stances stay, calendar claims go — at corpus and references in the same batch.** Named tools/vendors stay as opinionated defaults. | PERSONA M5 + PRIN FLAG(8)a; one-directional sweeps re-import the disease |

### Open

| # | Question | Path to close |
|---|---|---|
| D-O1 | Retire surface-activation's registry bootstrap (+ orchestrator clause + Surfaces-family arm)? | G3's evidence task: earliest published npm version ships the surface model + census of pre-publish installs (MAINT-6) |
| D-O2 | Corpus-wide TL;DR/Anti-patterns format trim (~25–30% per file)? | Deferred — the designer references prove 2× compression works, but the anchor churn (all 8 anchors, ~60 pins) outweighs the gain now; revisit after F2/F3 prove the batch discipline (DESIGN FLAG(8)a vs PRIN's pricing) |
| D-O3 | `stack/postgres.md` relocation to generator-shipped stack docs | Phase-2 per-stack-idiom work; until then pinned to the architect anchor (PRIN M10) |
| D-O4 | Should `groundwork-check` verify corpus internal links? | Small check-side addition; decide when C2 touches check (PRIN FLAG(1) — would have caught PRIN-4) |
| D-O5 | ENG-16: which go/python references are near-copies of generator-shipped stack docs? | F5 audit after F3; corpus-side answer feeds FLAG(8) |

---

## §4 Sequencing and gates

```
WS-A (lens + guards)          ──► everything else judged under the new lens
WS-B (defects)                ──► parallel with anything after A5's lint exists (B1 anytime)
WS-C (contract + spine)       ──► before D and E (they collapse onto the root C fixes)
WS-D (setup lanes)  ─┬─ parallel, with D3's shared homes agreed before D1 lands per-skill
WS-E (bet delivery) ─┘  E1 pairs with C1's Model-Tiers cut (same commit)
WS-F (deliverables)           ──► F1 anytime after A; F2–F4 after E1 (ways-of-working quotes bet canon; testing-spine contract stable)
WS-G (maintenance)            ──► G1 pairs with C2's orchestrator rows; F4's family lands via G
```

**Same-commit couplings (violating any of these ships a broken seam):**
- C1's Model-Tiers trim ↔ E1's receipt of the mechanics.
- D2's Phase-5 extraction ↔ surface-activation's lazy-path update (DESIGN FLAG(6)).
- F3's reference renames/merges ↔ every adoption-seam filename (gated by A5's lint) ↔ electron deferrals.
- C3's template relocations ↔ the full referencing-path sweep ↔ contributor contracts table.
- B1's tag/Surface strings ↔ `implementation-readiness.md` wording (byte-identical).
- G1's Family Index restructure ↔ orchestrator routing rows.

**Gates that define done, per landing:** `./dev ci` (lint + generation + contracts + cli + compilation) — contracts includes sync-anchors, migration coverage, changelog↔registry, workflow-index freshness, plus the two new lints from A5/A2. Changelog: skill-text changes `[no-migration]`; B1's in-flight-bet backfill and F4's propagation land as reconcile-family extensions (not registry migrations); B2/F4's generator/CLI changes rebuild the dev bundle. Contract stays v1 throughout — C1 changes no protocol semantics.

**Verification beyond CI:** one live sim per lane after the dust settles (greenfield `/simulate-greenfield`, brownfield fixture run, and one quick-bet + one full-bet dry run against B1's sealed baseline) — the reviews found the failure modes that only surface cross-file; the sims are the cross-file instrument.

**What is deliberately not attempted:** no protocol semantics changes, no lane redesigns, no new methodology — this plan makes the existing design legible and single-homed. The three genuine additions (skill-writer's budget cluster, the designer's pattern discipline, the ethics calibration) each close a measured gap, not extend scope.
