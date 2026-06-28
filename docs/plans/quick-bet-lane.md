# Implementation Plan: The Quick-Bet Lane + Work-Intake Capture

**Status:** EXECUTED 2026-06-28 (branch `worktree-quick-bet-lane`; ships in 0.12.0). Everything implementable without a live run is done and gated green (lint, generation, contracts incl. the new migration round-trip, cli 57, compilation). **Owed:** the live adversarial capture sims (cold + warm-drift) — a human-run Claude Code session is the only faithful instrument — and the 0.12.0 release cut.
**Audience:** An engineer or agent working on this lane. The design rationale below is why the repo took this shape; verify the Status against the tree before re-executing.
**Scope owner:** `groundwork-bet` (the new `workflows/00-quick.md` track + delivery/validation depth gates), `groundwork-orchestrator` (Work Intake), `groundwork-patch` (calibrated rigor + escalation), the capture hook + its CLI seeding/migration, and coupled doc/checklist updates.

---

## 0. Read this first — the mental model

Two problems, one front door.

**Capture.** Live testing showed most build/change/fix requests never trigger GroundWork — the agent just edits code, bypassing the process. Nothing an agent reads treated a coding request as a routing trigger.

**Granularity.** `groundwork-patch` (the floor: no new capability, no contract change) and the five-phase `groundwork-bet` (the ceiling) left no lane for the small-but-real change — "add a delete button" is a new capability touching a contract, but a milestone ladder over-ceremonies it.

**The thesis: one spine, three depths.** GroundWork was already ~80% modular — shared operating-contract protocols, review lenses in `briefs/`, type-keyed gate checklists, depth-scalable validation steps. The three lanes are three *compositions* of that one module set, sized by the work: every change runs **Frame → Prove → Build → Check → Record**, at a depth set by its size. `patch` is depth 1, `quick bet` the new depth 2, `bet` depth N. The quick bet is a *compressed bet*, not a slimmer patch: it touches every dimension a bet does (what/why · UX · contract · proof) but as one approved pass producing **one milestone**, then hands that milestone to the *existing* delivery + validation machinery. The spine itself is this plan's framing — it ships as concrete deltas, not as a doc.

---

## 1. What shipped

**WS-A — Work Intake & capture.**
- Orchestrator `description` broadened to fire on build/add/change/fix intent (the soft mid-session lever); a capture clause folded into `AGENTS.md` (fresh-session reach). A new **Work Intake** Intent-Handling case runs a 3-signal triage (patch scope test → patch; one milestone / one sitting / local non-structural contract → quick bet; multi-milestone or structural → bet), proposes the lane, and routes — guarded against re-triaging an active lane.
- A non-blocking **Claude Code PreToolUse hook** (`src/hooks/capture-reminder.js`) seeded to `.groundwork/hooks/` and wired via `.claude/settings.json`: on an Edit/Write outside any active lane it adds a reminder to route through the orchestrator. Suppressed by the `.groundwork/cache/active-lane` sentinel (delivery + patch write/clear it), inside a worktree, and on process artifacts. Seeded at init + update; the `gw-seed-capture-hook` migration heals existing Claude Code installs (native-only installs are n/a). The deterministic mid-session signal; soft instructions remain the fresh-session and non-Claude-Code path.

**WS-B — the quick-bet track (`groundwork-bet/workflows/00-quick.md`).** Scope test → clarify → discover (AI reads the tech) → re-size checkpoint (promote to a bet before approval if the code cascades) → author the delivery contract directly (thin `pitch.md` with `status: quick`→`delivery`, `track: quick`; a compressed `technical-design/` at field-level fidelity; a one-milestone `decomposition/` with `meta.json`) → an independent `groundwork-review` to `VERDICT: PRESENT` (clears Step 0's *Unreviewed artifact* 🔴 and is the authoring-time depth floor) → the single user approval gate → seal (approval commit + `bet/<slug>/approved` tag) → route to `04-delivery` unchanged.

**WS-C — depth-aware spine + entry wiring + patch calibration.** Bet activation branches on `lane: quick-bet` (new) and `status: quick` (resume). `track: quick` gates: the decomposition checklist accepts one milestone; `04-delivery` milestone-close skips the experience-auditor subagent + Tier-3 (keeps the Tier-1 floor + Tier-2 designer spec check); `05-validation` skips the cross-slice retrospective + per-decision ADRs. Patch gains honest-green's behaviour check (inline, always) + the blind-reviewer lens (subagent, only for behaviour-shaped patches), and escalates a local contract change to a quick bet.

**WS-D — record at depth + hygiene.** Capability-ledger fill is inherited unchanged (`05-validation` Step 2.7). The `groundwork-update` Bets family recognizes `track: quick` as a legitimate single-milestone shape. The contributor Cross-Phase Contracts table gains the `track` identifier row. CHANGELOG: the lane `[no-migration]` + the hook `[migration]` (gw-seed-capture-hook).

---

## 2. Key decisions (settled)

- **Three lanes, patch is the floor; the user sees a quick-bet-vs-bet front door.** *(User, 2026-06-28.)*
- **Quick bet reuses the delivery engine** — a compressed front-end emitting the contract `04-delivery` already consumes, not a new run-till-green path. Implemented as a track *inside* `groundwork-bet`, not a standalone skill (all three review lenses converged on this — it inherits the wiring and naturally emits the shapes the readiness gate reads). *(User + review, 2026-06-28.)*
- **Even patch gains calibrated rigor** — one lens + honest-green, not the full ceremony; the pressure valve stays light. *(User, 2026-06-28.)*
- **Capture: a non-blocking reminder hook**, not a hard block (a lockout pushes users to disable it) and not soft-only (the mid-session leak persists). *(User, 2026-06-28.)*
- **The spine is framing, not a shipped artifact** — only the concrete deltas and the `track` contract row land in the repo. *(Review, 2026-06-28.)*

## 3. Open / owed

- **Live adversarial capture sims** — cold (fresh session) and warm-drift (deep in unrelated work, then a bare "add a delete button"), multiple phrasings, GroundWork unnamed. The only proof capture actually fires; document the residual leak (native agents have no hook) honestly.
- **O2 (one approval gate → run to green) and O4 (same git contract vs. a lighter main-checkout branch when the worktree bootstrap dominates a one-button change)** — O2 is implemented as one gate; O4 left at the same contract, to revisit from sim evidence.
- The full `groundwork-deliver` spine extraction — the clean end-state, deferred (a risky relocation the composition model does not need).
- 0.12.0 release cut.
