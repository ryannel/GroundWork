#!/usr/bin/env node
// Generates src/skills/groundwork-orchestrator/workflow-index.md from the routing
// tables in src/skills/groundwork-orchestrator/SKILL.md (decision D7 in
// docs/plans/archive/bmad-quality-uplift.md: help is generated, not hand-maintained, so it
// cannot drift from the actual routes).
//
//   node scripts/generate_workflow_index.js          # write the index
//   node scripts/generate_workflow_index.js --check  # exit 1 if the committed index is stale

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKILL_PATH = path.join(ROOT, 'src', 'skills', 'groundwork-orchestrator', 'SKILL.md');
const INDEX_PATH = path.join(ROOT, 'src', 'skills', 'groundwork-orchestrator', 'workflow-index.md');

function fail(msg) {
  console.error(`generate_workflow_index: ${msg}`);
  process.exit(1);
}

const skill = fs.readFileSync(SKILL_PATH, 'utf8');

// ── Parsers ──────────────────────────────────────────────────────────────────

// Returns the text between a heading line and the next heading of the same-or-higher level.
function section(heading) {
  const lines = skill.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) fail(`heading not found in SKILL.md: "${heading}"`);
  const level = heading.match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

// Parses the first markdown table in a block into row arrays of trimmed cells.
function table(block, context) {
  const rows = block
    .split('\n')
    .filter((l) => l.trim().startsWith('|'))
    .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  if (rows.length < 3) fail(`no table found under ${context}`);
  return rows.slice(2); // drop header + separator
}

const strip = (s) => s.replace(/`/g, '');

// ── Extract routes ───────────────────────────────────────────────────────────

const skillPaths = {};
for (const [name, file] of table(section('### Skill Paths'), 'Skill Paths')) {
  skillPaths[strip(name)] = strip(file);
}

function instructionPath(skillName) {
  const p = skillPaths[skillName];
  if (!p) fail(`skill "${skillName}" appears in a routing table but not in Skill Paths`);
  return p;
}

const greenfield = table(section('### Greenfield Setup Phases'), 'Greenfield Setup Phases')
  .map(([order, phase, name, artifact]) => ({ order, phase, skill: strip(name), artifact, path: instructionPath(strip(name)) }));

const brownfield = table(section('### Brownfield Setup Phases'), 'Brownfield Setup Phases')
  .map(([order, phase, name, signal]) => ({ order, phase, skill: strip(name), signal, path: instructionPath(strip(name)) }));

const anytime = section('### Anytime Skills')
  .split('\n')
  .filter((l) => l.trim().startsWith('- '))
  .map((l) => {
    const m = l.trim().match(/^- `([^`]+)`\s*—\s*(.*)$/);
    if (!m) fail(`unparseable Anytime Skills bullet: "${l.trim()}"`);
    return { skill: m[1], purpose: m[2], path: instructionPath(m[1]) };
  });

const deliveryRow = table(section('### Mode Detection'), 'Mode Detection')
  .find(([state]) => /setup phases complete/i.test(state));
if (!deliveryRow) fail('Mode Detection table has no "setup phases complete" row');
const deliverySkill = strip(deliveryRow[2]);

// Delivery-loop lanes are parsed from the Work Intake triage bullets so the index
// cannot drift from the orchestrator's actual sizing logic. Each numbered bullet ends
// in a routing arrow followed by a bold lane name; the scope test is the question text
// up to its first "?" (the explanatory prose after it is not the test).
const lanes = section('### User requests work — build, add, change, or fix something')
  .split('\n')
  .filter((l) => /^\d+\.\s/.test(l.trim()))
  .map((l) => {
    const line = l.trim();
    const arrow = line.lastIndexOf('→');
    if (arrow === -1) fail(`triage bullet has no routing arrow: "${line}"`);
    const laneMatch = line.slice(arrow).match(/\*\*(.+?)\*\*/);
    if (!laneMatch) fail(`triage bullet has no bold lane after its arrow: "${line}"`);
    let scope = line.slice(0, arrow).replace(/^\d+\.\s*/, '');
    const q = scope.indexOf('?');
    if (q !== -1) scope = scope.slice(0, q + 1);
    scope = scope.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
    return { lane: laneMatch[1], scope };
  });
if (lanes.length < 3) fail('Work Intake triage has fewer than 3 lane bullets');

// Each lane's route target is stated once in the routing bullets that follow the triage
// (e.g. "- **patch** → `groundwork-patch`."). Parse them so the index shows where each
// lane actually goes rather than assuming the delivery skill.
const laneRoutes = {};
for (const l of section('### User requests work — build, add, change, or fix something').split('\n')) {
  const m = l.trim().match(/^-\s*\*\*(.+?)\*\*\s*→\s*`([^`]+)`/);
  if (m) laneRoutes[m[1]] = m[2];
}
for (const r of lanes) {
  r.route = laneRoutes[r.lane];
  if (!r.route) fail(`triage lane "${r.lane}" has no routing bullet naming its skill`);
}

// ── Emit ─────────────────────────────────────────────────────────────────────

const out = `<!-- GENERATED FILE — do not edit by hand.
     Source: the routing tables in SKILL.md (same directory).
     Regenerate: npm run gen:workflow-index -->

# GroundWork Workflow Index

Every lifecycle route the orchestrator knows, in one map. The orchestrator decides which row applies by reading \`.groundwork/config/state.json\` and the filesystem — this index is for orientation, not for routing.

## Greenfield Setup (empty repository)

Phases run in order; each commits its artifact, then the orchestrator routes to the next.

| Order | Phase | Skill | Artifact | Instructions |
|---|---|---|---|---|
${greenfield.map((r) => `| ${r.order} | ${r.phase} | \`${r.skill}\` | ${r.artifact} | \`${r.path}\` |`).join('\n')}

## Brownfield Setup (existing codebase)

The same canonical docs, reverse-engineered from the code. No MVP phase — the first bet cold-starts from the gap report.

| Order | Phase | Skill | Completion signal | Instructions |
|---|---|---|---|---|
${brownfield.map((r) => `| ${r.order} | ${r.phase} | \`${r.skill}\` | ${r.signal} | \`${r.path}\` |`).join('\n')}

## Delivery Loop (all setup phases complete)

| Skill | What it runs | Instructions |
|---|---|---|
| \`${deliverySkill}\` | The five-phase bet workflow: discovery → design foundations → decomposition → delivery → validation | \`${instructionPath(deliverySkill)}\` |

Every build/change/fix request is sized into one of three lanes at intake (the Work Intake triage). Resolve a borderline ask to the lighter lane and name the escalation trigger.

| Lane | Scope test | Route |
|---|---|---|
${lanes.map((r) => `| **${r.lane}** | ${r.scope} | \`${r.route}\` |`).join('\n')}

## General questions (not a route)

Questions about the framework — what a phase produces, why the method works this way, what a term means — are answered from the shipped corpus, never from memory.

| Ask | Answer corpus |
|---|---|
| "How does X work?", "why bets?", "what is a surface?" | \`docs/\` (framework docs seeded into the project) + \`llms.txt\` (the machine-readable map) |

## Anytime

Available in any mode, on demand.

| Skill | Purpose | Instructions |
|---|---|---|
${anytime.map((r) => `| \`${r.skill}\` | ${r.purpose} | \`${r.path}\` |`).join('\n')}
`;

if (process.argv.includes('--check')) {
  const committed = fs.existsSync(INDEX_PATH) ? fs.readFileSync(INDEX_PATH, 'utf8') : null;
  if (committed !== out) {
    console.error('workflow-index.md is STALE — the orchestrator routing tables changed.');
    console.error('Regenerate with: npm run gen:workflow-index');
    process.exit(1);
  }
  console.log('workflow-index.md is fresh.');
} else {
  fs.writeFileSync(INDEX_PATH, out);
  console.log(`wrote ${path.relative(ROOT, INDEX_PATH)}`);
}
