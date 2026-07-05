<!--
  Template for the delivery-path kickoff command, rendered by
  scripts/seed_simulation.js into <sandbox>/.claude/commands/simulate-delivery.md.
  Placeholders: {{suite}}, {{startState}}, {{modeNote}}.
  $ARGUMENTS is substituted by Claude Code at invocation time (bounded-run
  directives from `./dev sim run --until=...`).
-->
---
description: Dry-run the GroundWork Delivery phase for the sealed Task Capture bet against a simulated owner (suite: {{suite}}).
---

Drive the **Delivery phase of the sealed `task-capture` bet** end-to-end against
a *simulated* owner. Do NOT ask me (the real human) the owner decisions — delegate
every owner-facing turn to the `sandbox-user` subagent (Agent tool,
`subagent_type: sandbox-user`). You are the **delivery driver**.

## Starting state

{{startState}}

## How to run it

1. Invoke the `groundwork-orchestrator` skill. {{modeNote}} Then load
   `groundwork-bet`'s delivery workflow (`workflows/04-delivery.md`) and follow its
   **step router** — read one step file fully, execute it, load the next only at
   its transition line. Never collapse the step files into one read.
2. **Dispatch real subagents.** Each slice is delivered by a fresh `slice-worker`
   (implements to green in the one bet worktree, returns a short report). Each
   review lens (`blind`, `edge-case tracer`, `coverage`) runs as its own isolated
   subagent, writes its full findings to a file under
   `.groundwork/cache/bets/task-capture/reviews/<slice-key>/<lens>.md`, and returns
   only a parseable `VERDICT:` line + ≤5 findings + `FULL: <path>`. Gate on the
   returned verdict — a lens that returns only a path is not a pass.
3. **Owner decisions go to the persona, never to me.** Whenever delivery would
   ask the owner to ratify a default, approve an amendment, dispose of a finding,
   or walk a checkpoint, send the exact question/summary to `sandbox-user` and feed
   its reply back. Maintain the persona's memory across turns (SendMessage if you
   can; otherwise re-spawn with the running transcript).
4. **Produce real outputs.** Implement real code to green, run the real tests,
   commit each slice on the `bet/task-capture` branch, and write the real board /
   memlog / pack / reviews / decisions / findings state under
   `.groundwork/cache/bets/task-capture/`. This is a faithful run — no shortcuts, no
   fabricated results.
   - **Running the bet-progress tests:** this reduced fixture ships no project test
     runner. Write each materialized stub as a plain `unittest` module ending in
     `if __name__ == "__main__": unittest.main()`, and run it **directly by path** —
     `python tests/bets/task-capture/<file>.py` (set `PYTHONPATH=src` so `taskcli`
     imports). Direct execution avoids unittest's discovery, which the hyphen in
     `task-capture` would break. Drive the front door as a real subprocess from
     inside the test.

## The run must exercise every delivery mechanic (this is the point)

Drive the sealed plan honestly; these mechanics arise naturally from it, and the
run is only complete when the transcript shows each one:

- **Spine → step routing.** The readiness gate (Step 0), the red board (Step 0.5),
  and the granularity choice (Step 0.7) each run from their own step file. Confirm
  every materialized stub is red for the feature's absence before opening a slice.
- **File-backed lens verdicts.** Every slice's review writes full findings to files
  and returns inline verdicts, as in step 2 above.
- **Default+veto, ratified at a checkpoint.** A non-steering implementation choice
  will come up (e.g. how the store serialises). Record the recommended default with
  `npx groundwork-method decisions add --bet task-capture ...`, proceed on it, and
  batch it to the milestone-1 checkpoint walkthrough for the owner (`sandbox-user`);
  record their verbatim answer with `npx groundwork-method decisions ratify --bet
  task-capture --all --response "<their words>"`. The `approved` tag does not move for
  a defaulted decision — only ratification settles it.
- **Mid-bet fresh-context resume.** After slice 1.1 closes, *simulate a fresh
  context*: discard your working memory of the loop and reconstruct the bet's
  state **solely** from `board.yaml` + `memlog.md` + the milestone pack + the git
  log, reconcile against the bet-progress tests (run them by path), then continue
  with slice 1.2. Narrate what you reconstructed.
- **Blocked milestone close on an open finding.** At milestone-1 close, a review
  finding will remain open (e.g. list ordering unasserted). Record it with
  `npx groundwork-method findings add --bet task-capture ...`; `npx groundwork-method
  findings check --bet task-capture --milestone 1` then exits non-zero and blocks the
  close. Ask the owner (`sandbox-user`) for a disposition, record it with `findings
  disposition`, and only then — when `findings check` is green — close.
- **Amendment + pack recompile.** When you **open milestone 2**, its second agreed
  front-door case (`taskcli list --pending`) adds a CLI surface the design never
  carried and exceeds the pitch's appetite/no-gos. Propose **dropping that agreed
  case** — that is changing what the milestone proves, so it is an owner-approved
  **Amendment** (`delivery/on-amendment.md`), never a silent edit. On the owner's
  approval, amend milestone 2's `index.md`, commit it, **re-point the
  `bet/task-capture/approved` tag**, and **recompile the milestone-2 context pack**
  (its `compiled_from` must match the new tag sha).

## Stop condition

Stop when the whole bet is green — both milestones closed and postmortem'd, the
delivery reaches the validation hand-off — or when `sandbox-user` says "End of Task".

## Run directives

$ARGUMENTS

If the directives above are empty, run to the full stop condition. A directive that
bounds the run (e.g. "stop after milestone 1 closes") overrides it — reach the named
point, commit the durable state, then end the session cleanly.

## Notes

- I (the real human) am observing and may interject. Treat any message from me as
  a real-human override, not the persona.
- Narrate briefly between steps: which step you are in, what the worker/lenses
  returned, what the owner decided, what you committed.
- The simulation is the *instrument*, not the thing under test. If the delivery
  skill behaves poorly, do NOT paper over it — run it faithfully so the weakness is
  visible in the transcript. Surfacing the flaw is the point.
