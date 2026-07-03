# Delivery Step 1 — Readiness, red board, granularity

The delivery spine (`../04-delivery.md`) routes here first. Run Steps 0, 0.5, and 0.7 in order, then transition to the Slice Loop.

## Step 0: Implementation Readiness Gate

Before any slice work, verify the bet is actually executable. Load `.groundwork/skills/groundwork-review/checklists/implementation-readiness.md` and check every item against the bet's artifacts — the document chain, the API and data design, the approved decomposition commit, and currency. If the checklist file is absent, stop and report it; do not improvise the gate from memory. These are mechanical existence and consistency checks; run them inline (no review subagent — there is nothing here to be biased about). This is the delivery-side counterpart of Decomposition Step 6's review: that gate judged the prose's authorship against `groundwork-review/checklists/decomposition.md`; this one only confirms the same artifacts still exist, are current, and agree with each other now.

The gate is fail-closed: any 🔴 item blocks delivery. Report each failed item by name, route back to the owning phase (a missing interface design → Design Foundations; an unapproved decomposition tree → Decomposition; an unreconciled discovery note → resolve it now), and do not begin implementation until it passes. 🟡 items are surfaced to the user with your read on whether they touch this bet; the user decides.

When every 🔴 item passes, state so in one line, update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivery`, and inform the user you are entering Developer Mode. Write the active-lane sentinel — `printf '%s\n' '<bet-slug>' > .groundwork/cache/active-lane` — so the capture reminder hook stays silent while this lane drives edits; Validation removes it at bet close.

**Initialize the working state** (`../04-delivery.md`, *Working state*). Write `.groundwork/cache/bets/<bet-slug>/board.yaml` from the approved decomposition — the bet, the track, `approved: bet/<bet-slug>/approved@<sha>`, the full milestone ladder with the first milestone's slices `pending`, and `step: step-01-readiness` — and open the memlog with a first line (`./dev bet log <bet-slug> -- "delivery opened"`). The board is a convenience that reconciles against git and the suite; it never gates.

**Compile milestone 1's context pack.** Distil `.groundwork/cache/bets/<bet-slug>/milestone-01-context.md` from the template (`../../templates/milestone-context.md`) — pointers to the technical-design sections this milestone's slices touch, the engineer Context-Routing rows, and the worktree environment facts, stamped `compiled_from` = the approved-tag sha. The pack carries pointers and learnings, never contract text; it is what the Slice Loop's dispatch capsule points each worker at.

**Quick-bet depth.** When the pitch carries `track: quick`, this is a quick bet — a single-milestone delivery (see `../00-quick.md`). It runs the *same* slice loop, review lenses, and honest-green discipline as any bet; what scopes down is the milestone-close ceremony built for assembled multi-screen milestones: the Tier-3 polish pass always, and the experience-auditor only when the quick bet touches **no UI surface** — any user-visible change keeps the auditor, because the floor is inspection, not polish. Noted at *Milestone close* (`step-03-milestone-close.md`). The deterministic floor and the visual spec check (Tiers 1–2) hold in full — a quick bet that ships UI still cannot ship broken or off-spec.

## Step 0.5: Materialize the red board

The approved decomposition is prose; Delivery's first act is to render it into the runnable red board it tracks progress against. From the approved Proof-of-work prose, generate one red stub per **milestone** (the whole ladder) and one per **slice of the first milestone** — the board the rest of this phase turns green. A later milestone's slice stubs are materialized when Delivery opens that milestone; until then it carries only its headline stub. This is deliberate: the milestone stubs make the ladder legible from the first run — `./dev bet status` shows Milestone 1 going green while Milestones 2+ stay red.

For each milestone `index.md` and each slice file of the first milestone, materialize its named `Test file:` as a red stub that fails explicitly (never skips), commenting it with what the Proof-of-work prose says it must eventually assert. Discover the project's test language and service names from the scaffold — never assume. Use `./dev new milestone <bet-slug> <milestone-slug>` and `./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>` when they exist; write the files directly otherwise. Either way the paths match the prose exactly:

```
tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>
tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>
```

Consult `.groundwork/skills/groundwork-bet/references/bet-progress-tests.md` for the placeholder pattern and quality criteria. Run the suite once and confirm **every stub is red** — because the implementation does not exist, not an import or fixture error. Commit the red board (e.g. `bet(<bet-slug>): materialize red board`) before opening the first slice — it is the build artifact the slice loop fills in, free to change.

The scaffold and the `./dev` CLI are a starting point you keep shaping as the product grows: when a repeated delivery task earns it, or shipped tooling does not fit the work, adapt the tooling rather than scripting around it — never leave a shipped command inert and never build a parallel tool beside it (the *no empty capabilities* rule, `docs/principles/delivery/day-2-operational-baseline.md`).

## Step 0.7: Choose delivery granularity

Delivery can run at three cadences. The cadence sets where you pause for the user; it never relaxes the gates. Offer the choice in one turn and recommend the default:

| Mode | Runs autonomously | Pauses for the user |
|---|---|---|
| **Slice by slice** | one slice | after every slice closes, and at every milestone postmortem |
| **Milestone by milestone** *(default)* | all of a milestone's slices | at every milestone postmortem |
| **Whole bet** | all milestones | only on a hard stop, and at a postmortem that flags a course-correction |

**Hard stops pause in every mode, the autonomy choice notwithstanding:** a `decision-needed` review finding, an Amendment Protocol trigger (an approved proof looks wrong), or a Change Navigation trigger (reality contradicts the locked design). Autonomy speeds the path between gates; it never lets the driver decide one of these alone.

Recommend the user pin a **`frontier`**-tier model for this driver session (Model Tiers, operating contract) — subagent tiers are the dispatch defaults applied in the Slice Loop (`step-02-slice-loop.md`, §1, §2). Also recommend a **`frontier`**-class **advisor** (Claude Code: `/advisor opus` or `advisorModel`) so an `execution`-tier worker can escalate mid-slice instead of grinding toward a forced green (Model Tiers — *Runtime escalation*).

State the chosen mode back in one line, record it in `board.yaml` (`mode:`) and a memlog line, then begin the milestone loop. The choice is a session preference — on a fresh-context resume, re-confirm the mode before continuing; it is one cheap question.

---

➡️ Readiness passed, red board committed, mode chosen. Return to the spine's Milestone Loop and enter the Slice Loop: `step-02-slice-loop.md`.
