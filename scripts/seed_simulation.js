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
 * Usage: node scripts/seed_simulation.js <suite> <sandboxDir> [greenfield|brownfield]
 */

const fs = require('fs');
const path = require('path');

const [, , suite, sandboxDir, pathArg] = process.argv;
const flowPath = pathArg || 'greenfield';
if (!suite || !sandboxDir) {
  console.error('Usage: node scripts/seed_simulation.js <suite> <sandboxDir> [greenfield|brownfield]');
  process.exit(1);
}
if (flowPath !== 'greenfield' && flowPath !== 'brownfield') {
  console.error(`✖ Unknown path "${flowPath}". Expected "greenfield" or "brownfield".`);
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
const kickoffCommand = `---
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

const rubricPath = path.join(repoRoot, 'tests', 'evals', 'judge-rubric.md');
if (!fs.existsSync(rubricPath)) {
  console.error(`✖ Judge rubric not found at ${rubricPath}`);
  process.exit(1);
}
const judgeCommand = renderJudgeRubric(fs.readFileSync(rubricPath, 'utf8'), flowPath);

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
