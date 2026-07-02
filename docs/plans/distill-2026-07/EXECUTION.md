# Distillation Execution Ledger

**Purpose:** durable execution state for the master plan (`00-master-plan.md`). A fresh session resumes with: this file + master plan §2/§4 + the section plans feeding the next pending workstream. Updated at every slice landing.

**Branch:** `worktree-distill-review-plans` (PR #1). One reviewable commit per slice unless a same-commit coupling says otherwise. Gates per landing: `./dev ci`. Contract stays v1 throughout.

**Orchestration:** Sonnet-class subagents perform targeted edits per slice; the orchestrating (frontier) session reviews every diff, runs acceptance checks, and owns commits.

## Slice status

Status values: `pending` · `in-progress` · `landed <sha>` · `deviated <sha> (see Deviations)`.

| Slice | What (short) | Status | Acceptance verified |
|---|---|---|---|
| 0 | Baseline CI + this ledger | landed (this commit) | `./dev ci` green on 280f227: lint, 227 gen, 14 contracts, 59 cli, 28 compile. Baseline words: hidden 164,222 · skills 4,932 · engineer 69,237 · docs 72,391 · skill-writer 2,408 · contributor 7,367 · scaffold-designer 1,486 · AGENTS 232 = 322,275 |
| A1 | skill-writer rebuild (taxonomy, budget cluster, density, router-description, cross-file integrity, 6× FLAG(10) amendments) | landed (this commit) | Reads as one integrated standard. All 3 relocated failure-mode kernels verified ALREADY PRESENT in owning shipped skills (design-system instructions:38; product-brief instructions:123,206; architecture phases 03/04/05) — deleted, no relocation. DEVIATION: 2,408→3,296 words vs plan ~2,650; overage = the six cross-section amendments unpriced in section 10's own §6 estimate; every addition passes the cutting test |
| A2 | contributor split → core + references/{testing,releasing,cross-phase-contracts}; 6 drift fixes; writer-ref lint; D12 statement | landed (this commit) | Core 7,367→3,145 (−4,222 always-on); refs: testing 1,337 / contracts 1,005 / releasing 377. Greps clean (no CLAUDE_API_KEY, no bare `npx groundwork `). `./dev lint skills` green incl. new writer-ref check (derived list, 4 exempt). Brownfield chains + 5-header fix + persona-reader row verified against live source (verification detail in this commit message) |
| A3 | scaffold-designer re-grounding (item count invariant) | landed (this commit) | item count 26→26 verified against pre-edit blob; 1,486→1,207 words; path fix verified against `scaffold-helpers.ts`; generators.json + changelog-gate steps added |
| A4 | CLAUDE.md/AGENTS.md router completion | landed (this commit) | Flutter/Electron rows added (paths verified to exist); duplicated engineer-delivery rule → one pointer clause repointed at the post-split Two-Layer section |
| A5 | reference-link lint; `Distilled into` column ×8 anchors; re-stamp convention | landed (this commit, with B4b) | Lint green with documented exemptions (global bare-name set + one file-scoped set; `<stack>` placeholder verified against real engineer skills); all 8 anchors carry the column, first two columns byte-identical, `./dev check sync-anchors` green; convention = one sentence in contributor Two-Layer. B4b: 2 corpus decision-links fixed + go/product pins re-stamped same-commit (reconciled: Related-Reading links only) |
| B1 | approved-tag writer + `Surface:` field + update backfill arm | landed (this commit) | Tag/Surface strings byte-match implementation-readiness.md (gate untouched; `registry slug` term aligned). Amendment Protocol re-points the tag. Bets-family backfill follows the row's legacy-signal→advance format. Changelog `[no-migration]` |
| B2 | bet.ts language discovery (drop `.py` hardcode); `<N>` semantics; bundle rebuild | landed (this commit) | Extension discovered from shipped template suffix (fallback `.py` documented); SLICE_RE verified fine (multi-underscore services parse); D11 numbering prose in 00-quick + bet-progress-test; +BONUS defect: kebab slug in generated Python def names (SyntaxError) fixed via SLUG_IDENT/MILESTONE_IDENT tokens, locked by ast.parse asserts; cli 59 ✓ contracts 14 ✓ extensions 8 ✓ |
| B3 | setup-chain writer/reader fixes (scaffold.md, ledgers, exclusions, ADR, infra-adopt) | landed (this commit) | context/scaffold.md writer+reader grep ✓; scan/complete zero live refs (frozen fixtures intentionally kept); exclusions.md pointer resolves, no code parses the old array; phase-03 pointer target exists; BROWN FLAG(2) confirmed+fixed in greenfield 07-commit too |
| B4 | one-file shipped-contract repairs (7 items) | landed (this commit) — PRIN M2 corpus links SPLIT to B4b | 6/7 items landed with target-exists verification each. PRIN M2 (product-engineering + code-craft `../../decisions/` links) held back: edits trip go-engineer + product anchor pins, and A5 owns the anchor files — lands as B4b right after A5 with the 2 re-stamps in the same commit |
| C1 | contract root pass — SAME COMMIT as E1 | landed (this commit) | v1 unchanged, no protocol semantics changed, 122 protocol citations resolve. M1 was already single-homed (writer-side dup is C2's, landed). −227w. Terminal carve-outs: MVP (no handoff, no context file), infra-adopt (no handoff) |
| C2 | orchestrator/check/persona/writer/review; workflow-index regen | landed (this commit, with C3) | Invariants held: orchestrator description untouched; readiness 🔴 items 11→11 byte-stable (one 2-line pointer addition only); check reachable at SKILL.md path. Orchestrator −323w, review −557w, persona −291w, writer −205w, check spec re-seated. Full ./dev ci green on combined tree. Bet-side counterpart pointer STAGED → E-slices |
| C3 | template relocations + path sweep + contributor table (one commit) | landed (this commit, with C2) | surfaces/capability-ports → `*-contract.md` siblings of maturity-model; 4 referencing skills swept + check instructions (the SKILL.md text migrated into C2's file — the discovered coupling that merged these slices); gap-ledger vocab single-homed in maturity-model; templates/ = 6 true skeletons; shipping verified (recursive tree walk, no curated list) |
| D1 | protocol-conformance collapse across setup skills | pending | — |
| D2 | design-system `_foundation.md` — SAME COMMIT as surface-activation lazy path | landed (this commit) | Phase-3/5a/5b machinery extracted to _foundation (tracks keep medium content); both dry-run traces gap-free (hybrid graphical-ui+cli; standalone cli activation); MOVE-10 only graphical-ui (only file with multi-sentence defaults); −1,718w across the family. Independent Review block DEFERRED to D1 by lint design (see coupling below) |
| D3 | single homes: interface-type taxonomy, `--surfaces`, product-brief shape, Design References | landed (this commit) | D4: taxonomy home = design-system Step 2, extract cites same one-test wording. D5: `--surfaces` section in surfaces-contract.md, 3 invokers cite + keep deltas. M19: new product-brief-template.md, both writers cite (extract's drifted paraphrase retired). D6: graphical-ui Commit Contributions owns Design References spec. Lint green. FLAGGED for D1/later: review checklist product-brief.md carries stale "Experience without a medium" phrasing |
| D4 | scaffold/MVP right-sizing (pitch routing lands with E2) | pending | — |
| D5 | brownfield remainder (4 signature stances survive verbatim-strength) | landed (this commit) | M4/M5/M7/M12–M17 done; all 4 stances quoted before=after (empty-ledger canonical statement untouched, second occurrence now cites it); M15 applied 2-of-3 (architecture-extract never had the triplet — correct); −406w across 6 files; lint green |
| E1 | bet doctrine single-homing — SAME COMMIT as C1 | landed (this commit) | instructions.md router + three invariants (1604→1394w); tells canonical in acceptance-auditor (TEST_MODE greps to 1 file), 6 satellites → pointers; tier lift/escalation received (integrated, tier semantics unchanged); B1 tag/Surface strings preserved; 04-side counterpart pointer added (C2 staging honored); BET-24 activation-row merge folded in |
| E2 | pitch canon home (templates/pitch.md + 01-discovery example) | pending | — |
| E3 | 04-delivery rebuild around driver decisions | pending | — |
| E4 | briefs/templates right-sized; bet-progress → references/ | pending | — |
| E5 | lane boundaries → Work Intake (D9) | pending | — |
| F1 | pin-free corpus batch (ways-of-working rewrite; zero re-stamps) | pending | — |
| F2 | architect-batch corpus + persona reconciliation (one commit, ~9+1 pins) | pending | — |
| F3 | engineer-skills rebuild + Operating Rules rename (all-or-nothing) | pending | — |
| F4 | promotion mechanics + new reconcile family for promoted engineer skills | pending | — |
| F5 | deferred multi-pin folds + ENG M12 near-copy audit | pending | — |
| G1 | update driver/worker + orchestrator routing rows (from C2) — one commit | pending | — |
| G2 | doc-sync + migrations trims | pending | — |
| G3 | surface-activation compress + D-O1 retirement (three-file change) | pending | — |
| G4 | freshness = 12-month advisory; Phase-A merge check vs F1 fallout | pending | — |

## Staged couplings (cross-workstream obligations)

| From | To | Obligation |
|---|---|---|
| C2 | G1 | Orchestrator routing rows for update/doc-sync/surface-activation change in G1's commit, not C2's. |
| E4 | F3 | `testing.md` Bet Slice Rollout heading + obligation names are a published contract — E4 defers to them; F3 must not rename without sweeping E4's citations. |
| F1 | G4 | ways-of-working heavily rewritten → G4 confirms groundwork-check Phase-A merge behaves on it. |
| A1 | all | New lens applies: brief/engineer imperative register is CONFORMANT (D1); density rule owns bet instructions.md run-ons (E1's to fix). |
| C1 | B1 | `implementation-readiness.md` 🔴 strings stay byte-stable; B1's tag/Surface strings must byte-match them. |
| A1 | D4 | skill-writer gained taxonomy/budget/density rules → review the stack-forge runtime mirror (`groundwork-stack-forge/references/authoring-engineer-skills.md`) when D4 touches stack-forge. |
| D2 | D1 | `lint_skills.py`'s review-gate check requires the full Independent Review block in each design-system track (excludes _foundation by design) — D1's Protocol-9 payload collapse must land WITH a coordinated lint-rule change (the ~1,000-word tripled block is D1's remaining prize). |

## Decisions imported at execution time

- **D-O1 census (user, 2026-07-02): no pre-publish installs remain.** G3 confirms earliest `npm view groundwork-method versions` ships the surface model, then retires bootstrap + orchestrator clause + Surfaces-family arm as one three-file change.
- Execution lands on PR #1's branch (user-confirmed).
- Live sims (one per lane) are OWED after execution, not part of this run.

## Deviations

(none yet)

## Word-delta accounting

Captured at baseline (0) and re-measured at final report. Targets from each plan's §6; aggregate ~323k → ~275k.
