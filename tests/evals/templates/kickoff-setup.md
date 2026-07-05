<!--
  Template for the setup-path (greenfield/brownfield) kickoff command, rendered
  by scripts/seed_simulation.js into <sandbox>/.claude/commands/simulate-<path>.md.
  Placeholders: {{flowPath}}, {{suite}}, {{startState}}, {{sequence}}, {{modeNote}}.
  $ARGUMENTS is NOT a placeholder — Claude Code substitutes it at invocation
  time with whatever follows the slash command (e.g. a bounded-run directive
  from `./dev sim run --until=...`).
-->
---
description: Dry-run the GroundWork {{flowPath}} flow against a simulated user (suite: {{suite}}).
---

Run the **GroundWork {{flowPath}} flow end-to-end** against a *simulated* human
user. Do NOT ask me (the real human) the discovery questions — delegate every
user-facing turn to the `sandbox-user` subagent.

## Starting state

{{startState}}

## Operating loop

1. Invoke the `groundwork-orchestrator` skill to determine project state and the
   next phase. {{modeNote}}
2. Proceed through the full {{flowPath}} sequence, letting the orchestrator route
   and loading each hidden skill as directed:
   {{sequence}}
3. Whenever the active skill would **ask the human a question** or **present a
   draft for review/approval**, do NOT pause for me. Instead:
   - Send the exact question or draft to the `sandbox-user` subagent (Agent tool,
     `subagent_type: sandbox-user`).
   - Maintain the simulated user's memory across turns. If you can continue the
     same subagent (e.g. via SendMessage), do so. If continuation isn't available,
     re-spawn `sandbox-user` each turn and include the running interview transcript
     in the prompt — the persona is instructed never to re-introduce itself, so
     this stays consistent. Either way, never fabricate the user's answers yourself.
   - Treat the subagent's reply as the human's answer and feed it back into the
     skill.
4. Actually produce the real outputs: write the `docs/*.md` files and `.groundwork`
   state the skills generate, and commit when the simulated user approves a draft
   (the persona replies "Looks great, please commit it.").
5. Stop when the first Bet is scoped/committed, or when the simulated user says
   "End of Task".

## Run directives

$ARGUMENTS

If the directives above are empty, run the full sequence. A directive that bounds
the run (e.g. "stop after the Product Brief phase output is committed") overrides
the stop condition in step 5 — finish the named phase, commit its output, then end
the session cleanly instead of starting the next phase.

## Notes

- I (the real human) am observing and may interject. If I send a message, treat
  it as a real-human override — not as the persona.
- Narrate briefly between phases: which phase you're in, what the simulated user
  said, and what you're writing.
- This is a faithful dry-run: use the real skills and real file outputs. Do not
  shortcut the methodology or fabricate the user's answers yourself.
- The simulation is the *instrument*, not the thing under test. If a skill behaves
  poorly, do NOT paper over it — run it faithfully so the weakness is visible in
  the transcript. Surfacing the flaw is the point.
