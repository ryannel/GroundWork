#!/usr/bin/env node
/**
 * Seed a sandbox with the GroundWork simulation harness.
 *
 * Writes two artifacts into the sandbox so a fresh chat opened from the folder
 * can dry-run the greenfield flow against a *simulated* user instead of a human:
 *
 *   .claude/agents/sandbox-user.md        ← persona subagent (the "client")
 *   .claude/commands/simulate-greenfield.md ← kickoff command (the operating loop)
 *
 * The persona is lifted verbatim from the eval suite's suite.json, so the
 * interactive dry-run and the automated eval harness share one source of truth.
 *
 * Usage: node scripts/seed_simulation.js <suite> <sandboxDir>
 */

const fs = require('fs');
const path = require('path');

const [, , suite, sandboxDir] = process.argv;
if (!suite || !sandboxDir) {
  console.error('Usage: node scripts/seed_simulation.js <suite> <sandboxDir>');
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

// --- Persona subagent: the simulated human client -------------------------
const personaAgent = `---
name: sandbox-user
description: >-
  Simulated human client for a GroundWork greenfield dry-run (suite: ${suite}).
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
description: Dry-run the GroundWork greenfield flow against a simulated user (suite: ${suite}).
---

Run the **GroundWork greenfield flow end-to-end** against a *simulated* human
user. Do NOT ask me (the real human) the discovery questions — delegate every
user-facing turn to the \`sandbox-user\` subagent.

## Operating loop

1. Invoke the \`groundwork-orchestrator\` skill to determine project state and the
   next phase. This is a fresh greenfield project (empty \`docs/\`, state.json
   \`project_type: null\`).
2. Proceed through the full greenfield sequence, letting the orchestrator route
   and loading each hidden skill as directed:
   **Product Brief → Design System → Architecture → Scaffold → MVP planning → first Bet.**
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
`;

function writeFile(relPath, contents) {
  const full = path.join(sandboxDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  console.log(`  ✔ wrote ${relPath}`);
}

writeFile(path.join('.claude', 'agents', 'sandbox-user.md'), personaAgent);
writeFile(path.join('.claude', 'commands', 'simulate-greenfield.md'), kickoffCommand);
console.log(`  Persona sourced from suite: ${suite}`);
