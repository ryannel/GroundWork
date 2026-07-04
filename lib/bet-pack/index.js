'use strict';

// Milestone context pack generator — the mechanical form of the pack the
// delivery driver used to distil by hand at milestone open (W1.3; Wave-2
// `groundwork pack build|refresh|check`, docs/plans/groundwork-v2.md §4).
//
// CRITICAL INVARIANT — POINTERS AND LEARNINGS, NEVER CONTRACT TEXT. The pack
// names *where* a worker reads the contract (technical-design paths, the
// milestone index, slice files and their test paths); it must never copy an
// API shape, a schema, a data flow, or proof text out of the design docs. A
// second copy of a contract is exactly the drift `gw-bet-prose-redesign`
// killed — this generator emits paths and anchors only, by construction.
//
// Staleness is mechanical: amendments re-point the `bet/<slug>/approved` tag,
// so pack-stale === `compiled_from` frontmatter ≠ the sha that tag points at.
// The `<!-- driver-notes:start/end -->` block is the driver's judgment surface
// (worktree facts, engineer Context-Routing rows, distilled learnings) and is
// preserved verbatim across every rebuild.
//
// Dependency-free: Node built-ins only (git via execFileSync).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const betState = require('../bet-state');

const NOTES_START = '<!-- driver-notes:start -->';
const NOTES_END = '<!-- driver-notes:end -->';

const DEFAULT_NOTES = `
_Driver judgment goes here — worktree environment facts (ports, scratch DB,
fixtures, bootstrap quirks), the engineer Context-Routing rows this milestone's
workers should load, and distilled learnings the mechanical harvest above
cannot capture. This block is preserved verbatim by \`pack build\` and
\`pack refresh\`; everything outside it is regenerated._
`;

// Errors carry the CLI exit code so the handler stays a thin printer:
// 2 = environment (not a git repo, no approved tag), 1 = bet-shape errors.
class PackError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ─── Paths ──────────────────────────────────────────────────────────────────

function pad2(milestone) {
  const n = Number(milestone);
  if (!Number.isInteger(n) || n < 1) {
    throw new PackError(`--milestone must be a positive integer (got '${milestone}')`, 1);
  }
  return String(n).padStart(2, '0');
}

function packPath(targetDir, slug, milestone) {
  return path.join(targetDir, '.groundwork', 'cache', 'bets', slug, `milestone-${pad2(milestone)}-context.md`);
}

function cacheBetDir(targetDir, slug) {
  return path.join(targetDir, '.groundwork', 'cache', 'bets', slug);
}

// ─── Git: the approved-tag baseline ─────────────────────────────────────────

function git(targetDir, args) {
  return execFileSync('git', args, {
    cwd: targetDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString().trim();
}

// The sha the `bet/<slug>/approved` tag points at — the sealed baseline every
// pack is compiled from. Exit-code-2 territory when the environment is wrong.
function approvedTagSha(targetDir, slug) {
  try {
    git(targetDir, ['rev-parse', '--git-dir']);
  } catch {
    throw new PackError(`not a git repo — the pack is compiled from the bet/${slug}/approved tag`, 2);
  }
  try {
    return git(targetDir, ['rev-parse', '--verify', `refs/tags/bet/${slug}/approved^{commit}`]);
  } catch {
    throw new PackError(`no approved tag bet/${slug}/approved — seal the bet before compiling its pack`, 2);
  }
}

// ─── Frontmatter of an existing pack ────────────────────────────────────────

function readExisting(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

function compiledFromOf(content) {
  if (!content) return null;
  const m = /^compiled_from:\s*(\S+)\s*$/m.exec(content);
  return m ? m[1] : null;
}

function driverNotesOf(content) {
  if (!content) return null;
  const start = content.indexOf(NOTES_START);
  const end = content.indexOf(NOTES_END);
  if (start === -1 || end === -1 || end < start) return null;
  return content.slice(start + NOTES_START.length, end);
}

// ─── Harvest: what this milestone's decomposition names ─────────────────────

function milestoneDir(targetDir, slug, milestone) {
  const nn = pad2(milestone);
  const decompDir = path.join(targetDir, 'docs', 'bets', slug, 'decomposition');
  let entries = [];
  try {
    entries = fs.readdirSync(decompDir, { withFileTypes: true });
  } catch {
    throw new PackError(`no decomposition at docs/bets/${slug}/decomposition/`, 1);
  }
  const dir = entries.find((e) => e.isDirectory() && (e.name === nn || e.name.startsWith(`${nn}-`)));
  if (!dir) {
    throw new PackError(`no milestone dir docs/bets/${slug}/decomposition/${nn}-*/ — decompose the milestone first`, 1);
  }
  return path.join(decompDir, dir.name);
}

function relToTarget(targetDir, abs) {
  return path.relative(targetDir, abs).split(path.sep).join('/');
}

// Scan the milestone's files for `technical-design/<file>.md` mentions and each
// slice's named `Test file:` path. Names only — the design content is never read.
function harvestMilestone(targetDir, slug, milestone) {
  const dir = milestoneDir(targetDir, slug, milestone);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const indexFile = files.includes('index.md') ? path.join(dir, 'index.md') : null;
  const sliceFiles = files.filter((f) => f !== 'index.md').map((f) => path.join(dir, f));

  const designNames = new Set();
  const slices = [];
  for (const file of [indexFile, ...sliceFiles].filter(Boolean)) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(/technical-design\/([A-Za-z0-9._-]+\.md)/g)) {
      designNames.add(m[1]);
    }
    if (file === indexFile) continue;
    const test = /\*\*Test file:\*\*\s*`([^`]+)`/.exec(body);
    slices.push({ path: relToTarget(targetDir, file), test: test ? test[1] : null });
  }

  const designs = [...designNames].sort().map((name) => {
    const rel = `docs/bets/${slug}/technical-design/${name}`;
    return { path: rel, exists: fs.existsSync(path.join(targetDir, rel)) };
  });

  return {
    index: indexFile ? relToTarget(targetDir, indexFile) : null,
    slices,
    designs,
  };
}

// Pointer-style learnings: findings + ratified decisions one-lined from the
// durable state, report paths, and the memlog's tail. Never design content.
function harvestLearnings(targetDir, slug) {
  const findings = betState.listFindings(targetDir, slug);
  const decisions = betState.listDecisions(targetDir, slug, { status: 'ratified' });

  const reportsDir = path.join(cacheBetDir(targetDir, slug), 'reports');
  let reports = [];
  try {
    reports = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.md')).sort()
      .map((f) => relToTarget(targetDir, path.join(reportsDir, f)));
  } catch { /* no reports yet */ }

  const memlogFile = path.join(cacheBetDir(targetDir, slug), 'memlog.md');
  let memlogTail = null;
  if (fs.existsSync(memlogFile)) {
    const lines = fs.readFileSync(memlogFile, 'utf8').replace(/\s+$/, '').split('\n');
    memlogTail = lines.slice(-15).join('\n');
  }

  return { findings, decisions, reports, memlogTail };
}

// ─── Render ─────────────────────────────────────────────────────────────────

function renderPack(slug, milestone, sha, harvest, learnings, driverNotes) {
  const nn = pad2(milestone);
  const sources = [
    ...(harvest.index ? [harvest.index] : []),
    ...harvest.slices.map((s) => s.path),
    ...harvest.designs.map((d) => d.path),
  ];

  const lines = [];
  lines.push('---');
  lines.push(`milestone: ${nn}`);
  lines.push(`compiled_from: ${sha}`);
  lines.push('sources:');
  for (const s of sources) lines.push(`  - ${s}`);
  lines.push('---');
  lines.push('');
  lines.push(`# Milestone ${nn} — context pack`);
  lines.push('');
  lines.push('Generated by `groundwork pack build` from the sealed bet\'s state; stale when');
  lines.push(`\`compiled_from\` ≠ the sha \`bet/${slug}/approved\` points at (\`groundwork pack refresh\`).`);
  lines.push('It carries **pointers and learnings, never contract text** — workers read the');
  lines.push('pointed-at design for the shapes. Ripple caller lists are excluded by design:');
  lines.push('they go stale per commit, so the driver computes them per-slice at dispatch.');
  lines.push('');
  lines.push('## Pointers');
  lines.push('');
  if (harvest.index) lines.push(`- Milestone index: \`${harvest.index}\``);
  lines.push('- Technical design this milestone references:');
  if (harvest.designs.length) {
    for (const d of harvest.designs) {
      lines.push(`  - \`${d.path}\`${d.exists ? '' : ' *(named by the decomposition but not found on disk)*'}`);
    }
  } else {
    lines.push('  - *(no technical-design files named by this milestone\'s files)*');
  }
  lines.push('- Slices:');
  if (harvest.slices.length) {
    for (const s of harvest.slices) {
      lines.push(`  - \`${s.path}\` — test: ${s.test ? `\`${s.test}\`` : '*(no `Test file:` named)*'}`);
    }
  } else {
    lines.push('  - *(no slice files authored yet — slices arrive when Delivery opens the milestone)*');
  }
  lines.push('');
  lines.push('## Learnings');
  lines.push('');
  lines.push(`### Findings ledger (\`.groundwork/bets/${slug}/findings.json\`)`);
  lines.push('');
  if (learnings.findings.length) {
    for (const f of learnings.findings) {
      lines.push(`- ${f.id} [${f.status === 'open' ? 'open' : f.disposition}] ${f.title}`);
    }
  } else {
    lines.push('- *(none recorded)*');
  }
  lines.push('');
  lines.push(`### Ratified decisions (\`.groundwork/bets/${slug}/decisions.json\`)`);
  lines.push('');
  if (learnings.decisions.length) {
    for (const d of learnings.decisions) {
      lines.push(`- ${d.id}: ${d.question} → ${d.default}`);
    }
  } else {
    lines.push('- *(none ratified yet)*');
  }
  lines.push('');
  lines.push('### Slice reports');
  lines.push('');
  if (learnings.reports.length) {
    for (const r of learnings.reports) lines.push(`- \`${r}\``);
  } else {
    lines.push('- *(none yet)*');
  }
  lines.push('');
  lines.push('### Memlog tail');
  lines.push('');
  if (learnings.memlogTail) {
    lines.push('```');
    lines.push(learnings.memlogTail);
    lines.push('```');
  } else {
    lines.push('- *(no memlog yet)*');
  }
  lines.push('');
  lines.push(NOTES_START);
  lines.push((driverNotes != null ? driverNotes : DEFAULT_NOTES).replace(/^\n+|\n+$/g, ''));
  lines.push(NOTES_END);
  lines.push('');
  return lines.join('\n');
}

// ─── Verbs ──────────────────────────────────────────────────────────────────

// build: always regenerate (preserving driver notes). Returns { file, compiled_from }.
function buildPack(targetDir, slug, milestone) {
  const sha = approvedTagSha(targetDir, slug);
  const file = packPath(targetDir, slug, milestone);
  const harvest = harvestMilestone(targetDir, slug, milestone);
  const learnings = harvestLearnings(targetDir, slug);
  const notes = driverNotesOf(readExisting(file));
  const content = renderPack(slug, milestone, sha, harvest, learnings, notes);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return { file: relToTarget(targetDir, file), compiled_from: sha };
}

// check: staleness probe, no writes. Returns { status, compiled_from, tag_sha };
// status is 'fresh' | 'stale' | 'missing'.
function checkPack(targetDir, slug, milestone) {
  const sha = approvedTagSha(targetDir, slug);
  const existing = readExisting(packPath(targetDir, slug, milestone));
  const compiledFrom = compiledFromOf(existing);
  const status = existing === null ? 'missing' : compiledFrom === sha ? 'fresh' : 'stale';
  return { status, compiled_from: compiledFrom, tag_sha: sha };
}

// refresh: no-op when fresh, regenerate (preserving driver notes) when stale or
// missing. Returns { status: 'fresh' | 'rebuilt', file, compiled_from }.
function refreshPack(targetDir, slug, milestone) {
  const probe = checkPack(targetDir, slug, milestone);
  const file = relToTarget(targetDir, packPath(targetDir, slug, milestone));
  if (probe.status === 'fresh') {
    return { status: 'fresh', file, compiled_from: probe.compiled_from };
  }
  const built = buildPack(targetDir, slug, milestone);
  return { status: 'rebuilt', was: probe.status, ...built };
}

module.exports = {
  PackError,
  packPath,
  approvedTagSha,
  buildPack,
  checkPack,
  refreshPack,
};
