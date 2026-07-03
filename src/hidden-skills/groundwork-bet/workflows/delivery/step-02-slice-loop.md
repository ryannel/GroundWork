# Delivery Step 2 — the Slice Loop

The spine (`../04-delivery.md`) routes here to drive a milestone's slices to green. Run this loop once per slice, in order; when the milestone's last slice closes, transition to milestone close.

## The Slice Loop — the driver's per-slice sequence

For each slice in the milestone, in order:

### 1. Dispatch the slice-worker

Assemble the context capsule and dispatch a fresh slice-worker subagent (Protocol 9 mechanics — an isolated subagent loading `.groundwork/skills/groundwork-bet/briefs/slice-worker.md`) at the **`execution`** tier — or `frontier` if the slice's **Model tier** flags it (Model Tiers, operating contract). Set the tier's model explicitly on the dispatch — the host's Sonnet-class model, or its Opus-class model when lifted (Model Tiers — *Mechanism* carries the reference-host mapping); an omitted model silently inherits this driver session's `frontier` model and defeats the tiering. Name the choice in your one-line dispatch note (e.g. "dispatching slice-worker · execution → <chosen model>") so the user can see the tier held. The capsule is **pointers and slice-specifics, not a paraphrase of the brief** — the worker reads the brief for its process; restating that here only bloats the capsule and drifts when the brief changes. Pass:

- The **milestone context pack** path (`.groundwork/cache/bets/<bet-slug>/milestone-<NN>-context.md`) — the worker reads it for the design pointers this milestone touches, the engineer Context-Routing rows (which stack references to load, including the testing strategy and permanent-tests obligation), the prior-slice `Notes` learnings, proven recipes and their durable paths, and the worktree environment facts. Pass the path, not its contents; recompile the pack first if it is stale (`compiled_from` ≠ the approved-tag sha).
- `bet_slug` and the slice's `slice_file` path.
- The **working directory & isolation contract** — the bet's worktree path, run every command from it, leave changes **unstaged**, and **do not re-isolate** (no new worktree, branch, or `EnterWorktree`).
- The **previous slice's delivery commit** (hash, message) to read for its established patterns, eaten review findings, and `Notes:` line.
- The **exact existing files this slice modifies**, named, to read in full, and — when the slice **builds on a prior slice's proven contract** — that slice's **green test file**.
- The slice's materialized red `Test file:` path(s).
- Any **slice-specific constraints** the brief cannot know — a frozen signature, an off-limits subsystem, a guardrail, required fixtures — stated as hard constraints. Append the resolved policy `[facts]` (the orchestrator carries them in state) to this slot verbatim, so an org fact reaches the worker.
- For a **ripple slice** — one that renames or reshapes a symbol other code already depends on (the slice spec's **Ripple** field, or your own read of the diff it implies) — **the caller list, which you produce now, before dispatch** (never precompiled into the pack — caller lists go stale per commit). Run Serena's `find_referencing_symbols` on each named symbol (warm the index first if cold: `serena project index`, seconds) and annotate each caller with its module from the map's `module_graph`. This analysis is yours, not the worker's, for a mechanical reason: you run it against *committed* code, where LSP symbols are accurate — the worker mid-edit would be asking about the very symbol it is rewriting. The pasted list turns "the compiler will catch it" into *every consumer named before the change* — including consumers in modules the worker's test loop never compiles, which is exactly where rename escapes live. No Serena on this host? Derive the consumer *modules* from `module_graph` edges and say the per-call-site list is missing rather than implying it.

The worker implements to green inside the locked design, rolls out the slice's permanent tests, self-reconciles, and returns a short report (files touched, `COVERAGE:`, `NOTES:`, self-reconcile result, any `BLOCKING CONCERN`). It does not commit. A tight capsule keeps the worker bounded.

**Act on a `BLOCKING CONCERN` before reviewing.** A worker reporting an approved proof looks wrong, reality contradicting the locked design, or a real dependency that cannot be reached has hit a hard stop — route it through the Amendment Protocol (`on-amendment.md`) or Change Navigation (`on-change-navigation.md`) before any further slice work.

### 2. Review the slice

A worker's green report is the author's account of its own work; it is not the gate. Review the slice's uncommitted diff before closing it — the test files are *built* this phase and are *supposed* to change; what is fixed is the approved prose.

**First, reconcile against the approved prose (mechanical — run it yourself, no subagent, not an attestation walk).** The worker's self-reconcile is a first pass; confirm it.

- **Prose integrity — one git-pathspec check.** `git log --oneline -- docs/bets/<bet-slug>/decomposition/ docs/bets/<bet-slug>/technical-design/` since the `bet/<bet-slug>/approved` tag: a clean output (or only recorded-amendment commits) is the pass, and that is the whole check. A proof, acceptance criterion, or API shape changed without a recorded amendment — weakened, dropped, or loosened — is a `decision-needed` finding. Most slices change no prose, so this is usually a one-line no-op — do not narrate it into a ritual.
- **Honest green — the gaming tells, plus two conditional checks.** The implementation must satisfy the proof for the right reason, against the real product; the gaming tells are canonical in `briefs/acceptance-auditor.md` (the milestone honesty audit) and apply here, run inline by the driver as `decision-needed` findings. Two further checks fire only where they can bite, not on every slice:
  - **On a front-door slice** (one that contributes to a milestone's front-door proof): **the proof runs against the shipping build** — the artifact a user actually launches (the packaged app, the embedded worker), not a test target that runs code the shipping build never includes.
  - **On a ripple slice** (one that touched a symbol other modules depend on): **the green compiled every consumer** — read the consumer modules off the map's `module_graph` edges and confirm each one compiles; a test-target-only loop leaves the app target's compile unproven, which is precisely where a rename slips out.

  A worker's `SELF-RECONCILE` flag is a lead to confirm, not a verdict to trust.

**Then dispatch the slice diff for review** through three parallel, independent lenses (Protocol 9 mechanics — isolated subagents, each loading its brief under `.groundwork/skills/groundwork-bet/briefs/`; none substitutes for another, and none is the slice-worker, which authored the diff). Every lens dispatches at the **`frontier`** tier — the review is the gate that makes cheap execution safe (Model Tiers, operating contract) — with the host's Opus-class model set explicitly, not inherited, so the gate holds even under a cheaper driver. Conformance-to-design honesty is no longer a per-slice lens (the acceptance auditor rubber-stamped it slice by slice); it moves to the driver's own honest-green reconciliation above and the per-milestone honesty audit at close:

- **Blind reviewer** (`briefs/blind-reviewer.md`) — the diff only, no bet context; familiarity hides bugs, and this lens has none.
- **Edge-case tracer** (`briefs/edge-case-tracer.md`) — the diff plus repo read access and the design anchors this milestone touches; walks every branch and boundary against a state-machine / lifecycle checklist and reports only unhandled paths (null/empty inputs, failure timing, races, off-by-ones, unreachable states).
- **Coverage auditor** (`briefs/coverage-auditor.md`) — the diff, the slice's Required Capabilities, and the stack's testing strategy; judges the permanent tests rolled out against it: error/boundary cases at the rigour of the happy path, a unit test for complex logic, a trace assertion on an observable path, named states for a `graphical-ui` slice. A sociable test that executes a branch without asserting on it is a gap even on a green board. Default-on; skip only with a mechanical no-obligation reason (the slice rolls out no permanent test the strategy asks for), stated in one line.

**Every lens returns a parseable `VERDICT:` line, ≤5 bucket-tagged findings, and a `FULL:` path** to its full findings file under `reviews/<slice-key>/`. Protocol 8 gates on the verdict *in the returned text* — a lens that returns only a path is **not a pass**, fail-closed.

**Additive user lenses.** Any `[[lenses.slice]]` in the resolved policy layer dispatches in this same parallel wave, at the `frontier` tier, with findings through the same buckets. **A user lens adds findings; it can never satisfy, replace, or stand in for a built-in lens or `groundwork-review`** — the three built-in lenses always run, unconditionally, whatever the policy adds.

**Triage every finding** into exactly one bucket, deduplicating across lenses and the reconciliation, and **record each in the findings ledger** (`docs/bets/<bet-slug>/findings.md`, or the board's per-slice review pointers) with its disposition — a finding with no recorded disposition is an open finding:

| Bucket | Meaning | Handling |
|---|---|---|
| decision-needed | A real choice the design does not settle | Blocks the slice — put it to the user now (a hard stop) |
| patch | Unambiguous fix within the slice's scope | Fix before closing the slice (fix-in-place ladder below) |
| defer | Real, but pre-existing — not caused by this slice | Append as a row to `docs/maturity.md` with severity, and record the owner |
| dismiss | False positive or noise | Record the reason; do not persist the finding itself |

A slice closes only with zero open decision-needed and patch findings, every finding carrying a disposition (fixed / deferred-with-owner / dismissed-with-reason).

**Fixing a patch finding — the fix-in-place ladder.** Apply the fix at the cheapest rung that fits; a fix must never go to a fresh agent that has to re-derive the slice's context (measured at ~41% of the original build cost — the tax this ladder exists to kill):

1. **Driver inline** — when the fix is small and bounded (a guard, a rename, a missing assertion), make it yourself in the worktree. You already hold the context; a round-trip buys nothing.
2. **Continuation to the original worker** — when the fix needs the implementation reasoning that built the slice, continue *that same worker* (it still holds the context) rather than spawning a new one.
3. **Minimal-capsule fix worker** — only when neither fits (the original worker's context is gone and the fix is too large to drive inline). Dispatch a fresh worker with a **strict scope rule**: the exact finding, the exact files, and nothing beyond fixing it — no adjacent refactor, no scope the finding did not name.

Re-review the fix at the rung that produced it; a driver-inline fix is confirmed by the driver.

### 3. Record and close the slice

Commit the slice — that commit **is** the record, and the driver writes it (the worker left the changes unstaged). Use a structured message: a `bet(<bet-slug>): slice <N.M> <slice-slug>` subject, a body listing every file added, modified, or deleted, and a `Notes:` line — one or two sentences the next slice should know (a pattern established, a deviation and why, a struggle worth not repeating; carry the worker's `NOTES:` forward). An empty `Notes:` on a slice that fought us is a record that lies. The slice flips green on the board the moment its tests pass. Then push the branch (`git push`) — backup, not integration (Git workflow in the spine); skip only on a project with no remote.

Update the working state (`../04-delivery.md`, *Working state* — it never gates): rewrite `board.yaml` to mark this slice `done` with its commit sha and advance `step`, append one memlog line (`./dev bet log <bet-slug> -- "slice <N.M> closed (<sha>): <Notes gist>"`), mirror the worker's ~20-line report to `.groundwork/cache/bets/<bet-slug>/reports/<slice-key>.md` (so the postmortem and validation re-read it without holding it live), and refresh this milestone's context pack with the slice's `Notes` learning so the next worker inherits it. Carry any amendment through to the memlog too.

**In slice-by-slice mode, pause here** — show the user the closed slice (what it proved, what the review found, the commit) and confirm before dispatching the next worker. In milestone and whole-bet modes, continue to the next slice without pausing.

---

➡️ More slices in this milestone? Loop back to §1 for the next one. Milestone's last slice closed? Prove the milestone at its front door: `step-03-milestone-close.md`.
