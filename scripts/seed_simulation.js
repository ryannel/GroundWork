#!/usr/bin/env node
/**
 * Seed a sandbox with the GroundWork simulation harness.
 *
 * Flow testing in GroundWork is NOT a programmatic agent driver. It is a real
 * Claude Code session — launched by a human, or detached via `./dev sim run` —
 * against the real installed skills. This script writes the artifacts that make
 * that session a faithful, repeatable dry-run instead of an ad-hoc chat:
 *
 *   .claude/agents/sandbox-user.md           ← persona subagent (the simulated "client")
 *   .claude/commands/simulate-<path>.md      ← the facilitator's operating loop
 *   .claude/commands/judge.md                ← non-gating quality rubric (run in a FRESH session)
 *
 * This file is a THIN RENDERER. All session-facing text lives as templates:
 *
 *   tests/evals/templates/persona.md            {{flowPath}} {{suite}} {{userPersona}} {{userGoal}}
 *   tests/evals/templates/kickoff-setup.md      {{flowPath}} {{suite}} {{startState}} {{sequence}} {{modeNote}}
 *   tests/evals/templates/kickoff-delivery.md   {{suite}} {{startState}} {{modeNote}}
 *   tests/evals/templates/judge-delivery.md     (no placeholders)
 *   tests/evals/judge-rubric.md                 {{flowPath}} + {{#greenfield}}/{{#brownfield}} blocks
 *
 * Rendering rules: the leading <!-- --> template comment is stripped; {{key}}
 * placeholders are substituted. `$ARGUMENTS` in a template is NOT ours — Claude
 * Code substitutes it at slash-command invocation time (bounded-run directives,
 * judge run references). Never inline session text here; edit the template.
 *
 * The persona is lifted verbatim from the eval suite's suite.json, so attended
 * dry-runs and autonomous runs share one source of truth.
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
const templatesDir = path.join(repoRoot, 'tests', 'evals', 'templates');
const suiteJsonPath = path.join(repoRoot, 'tests', 'evals', 'scenarios', suite, 'suite.json');
if (!fs.existsSync(suiteJsonPath)) {
  console.error(`✖ No suite.json found for suite "${suite}" at ${suiteJsonPath}`);
  process.exit(1);
}

const suiteSpec = JSON.parse(fs.readFileSync(suiteJsonPath, 'utf8'));
const { user_persona, user_goal } = suiteSpec;
if (!user_persona || !user_goal) {
  console.error(`✖ suite.json for "${suite}" is missing user_persona or user_goal.`);
  process.exit(1);
}

// --- Per-path operating-loop configuration ---------------------------------
// Each path differs only in its starting state, phase sequence, and the
// orchestrator's mode detection; the delegation loop lives in the templates.
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
      "will be red for the feature's absence, not for import errors. No delivery has run yet: " +
      'no red board, no `.groundwork/cache/bets/`.',
    sequence: '', // delivery drives one phase; the template carries its own step spine
    modeNote:
      'The orchestrator will detect an approved bet at `status: delivery` and route straight ' +
      'into Phase 4 (Delivery). Do NOT re-run setup or re-open earlier bet phases — the bet is ' +
      'sealed; enter delivery and drive the sealed plan.',
  },
};
// A suite may override its path's default framing — a suite-owned brownfield
// fixture (a methodology twin, say) describes its own starting repo and route.
const cfg = {
  ...PATHS[flowPath],
  ...(suiteSpec.start_state ? { startState: suiteSpec.start_state } : {}),
  ...(suiteSpec.sequence ? { sequence: suiteSpec.sequence } : {}),
  ...(suiteSpec.mode_note ? { modeNote: suiteSpec.mode_note } : {}),
};

// --- Rendering --------------------------------------------------------------
function stripTemplateComment(text) {
  return text.replace(/^<!--[\s\S]*?-->\s*/, '');
}

function substitute(text, vars) {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  const leftover = out.match(/\{\{[a-zA-Z]+\}\}/);
  if (leftover) {
    console.error(`✖ Unsubstituted placeholder ${leftover[0]} — template/vars mismatch.`);
    process.exit(1);
  }
  return out;
}

function renderTemplate(name, vars) {
  const file = path.join(templatesDir, name);
  if (!fs.existsSync(file)) {
    console.error(`✖ Missing template: ${file}`);
    process.exit(1);
  }
  return substitute(stripTemplateComment(fs.readFileSync(file, 'utf8')), vars);
}

// The setup judge renders the shared rubric for the current path: the
// {{#greenfield}}/{{#brownfield}} blocks are kept for the active path and
// dropped for the other. Delivery has its own judge template.
function renderJudgeRubric(template, activePath) {
  const inactivePath = activePath === 'brownfield' ? 'greenfield' : 'brownfield';
  return stripTemplateComment(template)
    .replace(new RegExp(`\\{\\{#${inactivePath}\\}\\}[\\s\\S]*?\\{\\{/${inactivePath}\\}\\}\\n?`, 'g'), '')
    .replace(new RegExp(`\\{\\{[#/]${activePath}\\}\\}\\n?`, 'g'), '')
    .replace(/\{\{flowPath\}\}/g, activePath);
}

const personaAgent = renderTemplate('persona.md', {
  flowPath, suite, userPersona: user_persona, userGoal: user_goal,
});

const kickoffCommand = flowPath === 'delivery'
  ? renderTemplate('kickoff-delivery.md', {
      suite, startState: cfg.startState, modeNote: cfg.modeNote,
    })
  : renderTemplate('kickoff-setup.md', {
      flowPath, suite, startState: cfg.startState, sequence: cfg.sequence, modeNote: cfg.modeNote,
    });

let judgeCommand;
if (flowPath === 'delivery') {
  judgeCommand = renderTemplate('judge-delivery.md', {});
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
