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
| A5 | reference-link lint; `Distilled into` column ×8 anchors; re-stamp convention | pending | — |
| B1 | approved-tag writer + `Surface:` field + update backfill arm | pending | — |
| B2 | bet.ts language discovery (drop `.py` hardcode); `<N>` semantics; bundle rebuild | pending | — |
| B3 | setup-chain writer/reader fixes (scaffold.md, ledgers, exclusions, ADR, infra-adopt) | pending | — |
| B4 | one-file shipped-contract repairs (7 items) | pending | — |
| C1 | contract root pass — SAME COMMIT as E1 | pending | — |
| C2 | orchestrator/check/persona/writer/review; workflow-index regen | pending | — |
| C3 | template relocations + path sweep + contributor table (one commit) | pending | — |
| D1 | protocol-conformance collapse across setup skills | pending | — |
| D2 | design-system `_foundation.md` — SAME COMMIT as surface-activation lazy path | pending | — |
| D3 | single homes: interface-type taxonomy, `--surfaces`, product-brief shape, Design References | pending | — |
| D4 | scaffold/MVP right-sizing (pitch routing lands with E2) | pending | — |
| D5 | brownfield remainder (4 signature stances survive verbatim-strength) | pending | — |
| E1 | bet doctrine single-homing — SAME COMMIT as C1 | pending | — |
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

## Decisions imported at execution time

- **D-O1 census (user, 2026-07-02): no pre-publish installs remain.** G3 confirms earliest `npm view groundwork-method versions` ships the surface model, then retires bootstrap + orchestrator clause + Surfaces-family arm as one three-file change.
- Execution lands on PR #1's branch (user-confirmed).
- Live sims (one per lane) are OWED after execution, not part of this run.

## Deviations

(none yet)

## Word-delta accounting

Captured at baseline (0) and re-measured at final report. Targets from each plan's §6; aggregate ~323k → ~275k.
