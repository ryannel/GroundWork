#!/usr/bin/env node
/**
 * Seed a sandbox with the GroundWork simulation harness.
 *
 * Flow testing in GroundWork is NOT a programmatic agent driver. It is a real
 * Claude Code session, run by a human, against the real installed skills. This
 * script writes the artifacts that make that session a faithful, repeatable
 * dry-run instead of an ad-hoc chat:
 *
 *   .claude/agents/sandbox-user.md           ← persona subagent (the simulated "client")
 *   .claude/commands/simulate-<path>.md      ← the facilitator's operating loop
 *   .claude/commands/judge.md                ← non-gating quality rubric (run in a FRESH session)
 *
 * The persona is lifted verbatim from the eval suite's suite.json, so the
 * interactive dry-run and any future automated probe share one source of truth.
 *
 * Usage: node scripts/seed_simulation.js <suite> <sandboxDir> [greenfield|brownfield|delivery]
 */

const fs = require('fs');
const path = require('path');

const [, , suite, sandboxDir, pathArg] = process.argv;
const flowPath = pathArg || 'greenfield';
if (!suite || !sandboxDir) {
  console.error('Usage: node scripts/seed_simulation.js <suite> <sandboxDir> [greenfield|brownfield|delivery]');
  process.exit(1);
}
if (flowPath !== 'greenfield' && flowPath !== 'brownfield' && flowPath !== 'delivery') {
  console.error(`✖ Unknown path "${flowPath}". Expected "greenfield", "brownfield", or "delivery".`);
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const suiteJsonPath = path.join(repoRoot, 'tests', 'evals', 'scenarios', suite, 'suite.json');
if (!fs.existsSync(suiteJsonPath)) {
  console.error(`✖ No suite.json found for suite "${suite}" at ${suiteJsonPath}`);
  process.exit(1);
}

const { user_persona, user_goal } = JSON.parse(fs.readFileSync(suiteJsonPath, 'utf8'));
if (!user_persona || !user_goal) {
  console.error(`✖ suite.json for "${suite}" is missing user_persona or user_goal.`);
  process.exit(1);
}

// --- Per-path operating loop configuration --------------------------------
// Each path differs only in its starting state, phase sequence, and the
// orchestrator's mode detection. The delegation loop is identical.
const PATHS = {
  greenfield: {
    startState:
      'This is a fresh greenfield project: empty `docs/`, no application source, ' +
      'state.json `project_type: null` and `completed: []`.',
    sequence:
      '**Product Brief → Design System → Architecture → Scaffold → MVP planning → first Bet.**',
    modeNote:
      'The orchestrator will detect greenfield from the empty filesystem and route to the ' +
      'Product Brief phase first.',
  },
  brownfield: {
    startState:
      'This is a brownfield project: an existing codebase is already committed (a Go API + ' +
      'Next.js web + Go CLI monorepo wired with docker-compose), `docs/` is empty, and ' +
      'state.json is `project_type: null`. GroundWork is being adopted onto the existing repo.',
    sequence:
      '**Scan → Product Brief Extract → Design System Extract → Architecture Extract → ' +
      'Infra Adoption → first Bet.**',
    modeNote:
      'The orchestrator will detect brownfield from the existing application source and route ' +
      'to the Scan phase first. The docs are reverse-engineered from the code; the simulated ' +
      'user is interviewed only for the gaps the code cannot reveal.',
  },
  delivery: {
    startState:
      'This is a project mid-flow: setup is done and a bet named **Task Capture** has been ' +
      'designed, decomposed, approved, and **sealed** (`bet/task-capture/approved` tag). The ' +
      'pitch is `status: delivery`. `docs/bets/task-capture/` carries the pitch, the four ' +
      'technical-design files, and the decomposition tree (milestone 1 sliced; milestone 2 ' +
      'sliced-on-arrival). The `taskcli` package exists as unimplemented stubs — the red board ' +
      'will be red for the feature\'s absence, not for import errors. No delivery has run yet: ' +
      'no red board, no `.groundwork/cache/bets/`.',
    sequence:
      '**Delivery only: readiness gate → red board → slice loop (per milestone) → milestone ' +
      'close → postmortem → open the next milestone → validation hand-off.**',
    modeNote:
      'The orchestrator will detect an approved bet at `status: delivery` and route straight ' +
      'into Phase 4 (Delivery). Do NOT re-run setup or re-open earlier bet phases — the bet is ' +
      'sealed; enter delivery and drive the sealed plan.',
  },
};
const cfg = PATHS[flowPath];

// --- Persona subagent: the simulated human client -------------------------
const personaAgent = `---
name: sandbox-user
description: >-
  Simulated human client for a GroundWork ${flowPath} dry-run (suite: ${suite}).
  Plays the user being interviewed by the facilitator. Invoke this for every
  turn where a GroundWork skill would address the human — questions and draft
  approvals. Continue the same conversation across turns so it stays in character.
model: haiku
---

You are role-playing the HUMAN CLIENT in a product-discovery interview. A
GroundWork facilitator agent is interviewing you to build your product. Stay in
character at all times — you are the human, not an assistant.

# Who you are
${user_persona}

# How you behave
${user_goal}

# Hard rules
- You have NO tools. Never attempt a tool call. Reply only in natural language,
  the way a real client would speak in a conversation.
- Keep answers short and human. Do not write specs, documents, or bullet-point
  requirements for the agent — producing those is the agent's job, not yours.
- Never break character. Do not mention that you are an AI, a model, or a
  simulation. Do not re-introduce yourself mid-conversation.
`;

// --- Kickoff command: the facilitator's operating loop --------------------
// Setup paths (greenfield/brownfield) run the discovery-through-first-bet
// sequence; the delivery path drives the sealed bet's Delivery phase and is
// scripted below to exercise the delivery engine's steering mechanics.
const setupKickoff = `---
description: Dry-run the GroundWork ${flowPath} flow against a simulated user (suite: ${suite}).
---

Run the **GroundWork ${flowPath} flow end-to-end** against a *simulated* human
user. Do NOT ask me (the real human) the discovery questions — delegate every
user-facing turn to the \`sandbox-user\` subagent.

## Starting state

${cfg.startState}

## Operating loop

1. Invoke the \`groundwork-orchestrator\` skill to determine project state and the
   next phase. ${cfg.modeNote}
2. Proceed through the full ${flowPath} sequence, letting the orchestrator route
   and loading each hidden skill as directed:
   ${cfg.sequence}
3. Whenever the active skill would **ask the human a question** or **present a
   draft for review/approval**, do NOT pause for me. Instead:
   - Send the exact question or draft to the \`sandbox-user\` subagent (Agent tool,
     \`subagent_type: sandbox-user\`).
   - Maintain the simulated user's memory across turns. If you can continue the
     same subagent (e.g. via SendMessage), do so. If continuation isn't available,
     re-spawn \`sandbox-user\` each turn and include the running interview transcript
     in the prompt — the persona is instructed never to re-introduce itself, so
     this stays consistent. Either way, never fabricate the user's answers yourself.
   - Treat the subagent's reply as the human's answer and feed it back into the
     skill.
4. Actually produce the real outputs: write the \`docs/*.md\` files and \`.groundwork\`
   state the skills generate, and commit when the simulated user approves a draft
   (the persona replies "Looks great, please commit it.").
5. Stop when the first Bet is scoped/committed, or when the simulated user says
   "End of Task".

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
`;

const deliveryKickoff = `---
description: Dry-run the GroundWork Delivery phase for the sealed Task Capture bet against a simulated owner (suite: ${suite}).
---

Drive the **Delivery phase of the sealed \`task-capture\` bet** end-to-end against
a *simulated* owner. Do NOT ask me (the real human) the owner decisions — delegate
every owner-facing turn to the \`sandbox-user\` subagent (Agent tool,
\`subagent_type: sandbox-user\`). You are the **delivery driver**.

## Starting state

${cfg.startState}

## How to run it

1. Invoke the \`groundwork-orchestrator\` skill. ${cfg.modeNote} Then load
   \`groundwork-bet\`'s delivery workflow (\`workflows/04-delivery.md\`) and follow its
   **step router** — read one step file fully, execute it, load the next only at
   its transition line. Never collapse the step files into one read.
2. **Dispatch real subagents.** Each slice is delivered by a fresh \`slice-worker\`
   (implements to green in the one bet worktree, returns a short report). Each
   review lens (\`blind\`, \`edge-case tracer\`, \`coverage\`) runs as its own isolated
   subagent, writes its full findings to a file under
   \`.groundwork/cache/bets/task-capture/reviews/<slice-key>/<lens>.md\`, and returns
   only a parseable \`VERDICT:\` line + ≤5 findings + \`FULL: <path>\`. Gate on the
   returned verdict — a lens that returns only a path is not a pass.
3. **Owner decisions go to the persona, never to me.** Whenever delivery would
   ask the owner to ratify a default, approve an amendment, dispose of a finding,
   or walk a checkpoint, send the exact question/summary to \`sandbox-user\` and feed
   its reply back. Maintain the persona's memory across turns (SendMessage if you
   can; otherwise re-spawn with the running transcript).
4. **Produce real outputs.** Implement real code to green, run the real tests,
   commit each slice on the \`bet/task-capture\` branch, and write the real board /
   memlog / pack / reviews / decisions / findings state under
   \`.groundwork/cache/bets/task-capture/\`. This is a faithful run — no shortcuts, no
   fabricated results.
   - **Running the bet-progress tests:** this reduced fixture ships no project test
     runner. Write each materialized stub as a plain \`unittest\` module ending in
     \`if __name__ == "__main__": unittest.main()\`, and run it **directly by path** —
     \`python tests/bets/task-capture/<file>.py\` (set \`PYTHONPATH=src\` so \`taskcli\`
     imports). Direct execution avoids unittest's discovery, which the hyphen in
     \`task-capture\` would break. Drive the front door as a real subprocess from
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
  \`npx groundwork-method decisions add --bet task-capture ...\`, proceed on it, and
  batch it to the milestone-1 checkpoint walkthrough for the owner (\`sandbox-user\`);
  record their verbatim answer with \`npx groundwork-method decisions ratify --bet
  task-capture --all --response "<their words>"\`. The \`approved\` tag does not move for
  a defaulted decision — only ratification settles it.
- **Mid-bet fresh-context resume.** After slice 1.1 closes, *simulate a fresh
  context*: discard your working memory of the loop and reconstruct the bet's
  state **solely** from \`board.yaml\` + \`memlog.md\` + the milestone pack + the git
  log, reconcile against the bet-progress tests (run them by path), then continue
  with slice 1.2. Narrate what you reconstructed.
- **Blocked milestone close on an open finding.** At milestone-1 close, a review
  finding will remain open (e.g. list ordering unasserted). Record it with
  \`npx groundwork-method findings add --bet task-capture ...\`; \`npx groundwork-method
  findings check --bet task-capture --milestone 1\` then exits non-zero and blocks the
  close. Ask the owner (\`sandbox-user\`) for a disposition, record it with \`findings
  disposition\`, and only then — when \`findings check\` is green — close.
- **Amendment + pack recompile.** When you **open milestone 2**, its second agreed
  front-door case (\`taskcli list --pending\`) adds a CLI surface the design never
  carried and exceeds the pitch's appetite/no-gos. Propose **dropping that agreed
  case** — that is changing what the milestone proves, so it is an owner-approved
  **Amendment** (\`delivery/on-amendment.md\`), never a silent edit. On the owner's
  approval, amend milestone 2's \`index.md\`, commit it, **re-point the
  \`bet/task-capture/approved\` tag**, and **recompile the milestone-2 context pack**
  (its \`compiled_from\` must match the new tag sha).

## Stop condition

Stop when the whole bet is green — both milestones closed and postmortem'd, the
delivery reaches the validation hand-off — or when \`sandbox-user\` says "End of Task".

## Notes

- I (the real human) am observing and may interject. Treat any message from me as
  a real-human override, not the persona.
- Narrate briefly between steps: which step you are in, what the worker/lenses
  returned, what the owner decided, what you committed.
- The simulation is the *instrument*, not the thing under test. If the delivery
  skill behaves poorly, do NOT paper over it — run it faithfully so the weakness is
  visible in the transcript. Surfacing the flaw is the point.
`;

const kickoffCommand = flowPath === 'delivery' ? deliveryKickoff : setupKickoff;

// --- Judge command: non-gating quality rubric (FRESH session) -------------
// Run after a simulation completes, in a NEW Claude Code session opened from the
// same sandbox. A fresh context is a genuine critic — a judge that shares the
// context that wrote the docs would only rubber-stamp its own work.
//
// The rubric text lives in tests/evals/judge-rubric.md (single source of
// truth). This renders it for the current path: the leading template comment
// is stripped, {{flowPath}} is substituted, and {{#greenfield}}/{{#brownfield}}
// blocks are kept for the active path and dropped for the other.
function renderJudgeRubric(template, activePath) {
  const inactivePath = activePath === 'brownfield' ? 'greenfield' : 'brownfield';
  return template
    .replace(/^<!--[\s\S]*?-->\s*/, '')
    .replace(new RegExp(`\\{\\{#${inactivePath}\\}\\}[\\s\\S]*?\\{\\{/${inactivePath}\\}\\}\\n?`, 'g'), '')
    .replace(new RegExp(`\\{\\{[#/]${activePath}\\}\\}\\n?`, 'g'), '')
    .replace(/\{\{flowPath\}\}/g, activePath);
}

// The delivery path has its own judge — a fresh-context critic that scores
// whether the run honestly exercised the delivery engine's mechanics, rather
// than the setup-doc rubric. Setup paths render the shared rubric.
const deliveryJudge = `---
description: Fresh-context quality verdict on a Delivery-phase dry-run (bet: task-capture).
---

You are a fresh critic opened in a sandbox where a GroundWork **Delivery** dry-run
just ran for the sealed \`task-capture\` bet. You did not drive it — judge only what
the durable state and git history show. Be skeptical: reward honest mechanics,
penalise theater (a mechanic *claimed* in narration but absent from the artifacts).

Read \`docs/bets/task-capture/\`, \`.groundwork/cache/bets/task-capture/\` (board.yaml,
memlog.md, milestone packs, reviews/), the durable engine state at
\`.groundwork/bets/task-capture/\` (findings.json, decisions.json), the \`git log\` of the
\`bet/task-capture\` branch, and the test suite. Then score each mechanic
**Present / Weak / Absent** with the specific evidence (a commit sha, a file, a
memlog line) — or its absence:

1. **Real green through the front door** — the bet-progress tests exist, run, and
   pass by driving \`taskcli\` as a real subprocess against a real store file (not an
   in-memory or mirror assertion). Each bet-progress test, run by path, is green.
2. **Spine → step routing** — the run moved through readiness → red board →
   slice loop → milestone close → postmortem; the red board was committed red
   before implementation.
3. **File-backed lens verdicts** — \`reviews/<slice>/<lens>.md\` files exist with full
   findings, and the driver acted on parseable inline verdicts.
4. **Default+veto ratified at a checkpoint** — a recommended default is recorded in
   \`decisions.json\` (status pending → ratified), and the ratification carries the
   owner's **verbatim response** as durable state (not just a memlog line); the
   approved tag did not move until then.
5. **Fresh-context resume** — the memlog/board show a mid-bet reconstruction from
   state, and the reconciliation against git+suite is evident.
6. **Blocked milestone close on an open finding** — a finding in \`findings.json\` was
   held open, \`groundwork findings check\` blocked the milestone close, and it was
   dispositioned by the owner before close.
7. **Amendment + pack recompile** — milestone 2's \`list --pending\` case was dropped
   by an owner-approved amendment commit, the \`bet/task-capture/approved\` tag was
   re-pointed to it, and the milestone-2 pack's \`compiled_from\` matches the new sha.
8. **Legibility at checkpoints** — read every user-facing turn in the transcript, not
   the durable state. Each checkpoint must orient a reader with no memory of this
   session: which bet, which milestone, where this slice sits in the ladder — legible
   to someone who has never seen the skill corpus, not a teammate who already knows
   its vocabulary. A coined ID (an \`R<n>\` reference, an internal file or field name)
   or wire-format vocabulary (\`VERDICT:\`, a bucket tag, a tier name, "red board",
   "Developer Mode") spoken in a user-facing turn is a finding, not a style note —
   name the turn and the term.

End with an overall verdict — **Faithful / Partial / Unfaithful** — and the single
most important thing the delivery skill should improve, grounded in what you saw.
This verdict does not gate anything; it is signal for the framework authors.
`;

let judgeCommand;
if (flowPath === 'delivery') {
  judgeCommand = deliveryJudge;
} else {
  const rubricPath = path.join(repoRoot, 'tests', 'evals', 'judge-rubric.md');
  if (!fs.existsSync(rubricPath)) {
    console.error(`✖ Judge rubric not found at ${rubricPath}`);
    process.exit(1);
  }
  judgeCommand = renderJudgeRubric(fs.readFileSync(rubricPath, 'utf8'), flowPath);
}

function writeFile(relPath, contents) {
  const full = path.join(sandboxDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  console.log(`  ✔ wrote ${relPath}`);
}

writeFile(path.join('.claude', 'agents', 'sandbox-user.md'), personaAgent);
writeFile(path.join('.claude', 'commands', `simulate-${flowPath}.md`), kickoffCommand);
writeFile(path.join('.claude', 'commands', 'judge.md'), judgeCommand);
console.log(`  Path: ${flowPath}  ·  persona sourced from suite: ${suite}`);
