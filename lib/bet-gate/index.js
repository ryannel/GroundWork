'use strict';

// Mechanical bet gates: the structural, fail-closed half of the delivery
// checklists the driver used to walk by hand.
//
//   gate decomposition  — the decomposition tree is structurally complete:
//                         meta.json + every milestone index.md, the first
//                         milestone (or a named one) sliced, a Proof-of-work
//                         section and a named Test file per unit, and every
//                         slice link / meta page resolving to a real file.
//   gate readiness      — everything gate-decomposition checks, plus the pitch
//                         is at status: delivery, technical-design/ exists, and
//                         the bet/<slug>/approved tag is present.
//   seal verify         — the sealed prose (decomposition + technical-design)
//                         has not drifted from the approved tag: one git-pathspec
//                         diff, the mechanical form of the prose-integrity walk.
//
// These compute the "files exist, anchors resolve, test paths named, tag present"
// items only. Authorship judgment (horizontal milestones, unfalsifiable
// capabilities, shape-not-in-design) stays with groundwork-review / Protocol 9 —
// a gate that tried to judge those would rubber-stamp. Dependency-free.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── small fs helpers ────────────────────────────────────────────────────────

function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }

function betDocs(targetDir, slug) { return path.join(targetDir, 'docs', 'bets', slug); }

// A check result: { name, ok, detail }. `detail` explains a failure (or "" on pass).
function check(name, ok, detail) { return { name, ok: !!ok, detail: ok ? '' : (detail || '') }; }

// Pitch frontmatter `status:` (first `--- … ---` block), or null.
function pitchStatus(pitchPath) {
  if (!isFile(pitchPath)) return null;
  const text = fs.readFileSync(pitchPath, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const s = /(^|\n)\s*status:\s*([A-Za-z-]+)/.exec(m[1]);
  return s ? s[2].trim() : null;
}

// Milestone dirs under decomposition/ that carry an index.md, sorted by their
// leading number (NN-<slug>/). Returns [{ n, slug, dir, index }].
function milestones(decompDir) {
  if (!isDir(decompDir)) return [];
  return fs.readdirSync(decompDir)
    .map((name) => ({ name, dir: path.join(decompDir, name) }))
    .filter((e) => isDir(e.dir) && /^\d+/.test(e.name) && isFile(path.join(e.dir, 'index.md')))
    .map((e) => ({
      n: parseInt(e.name, 10),
      slug: e.name,
      dir: e.dir,
      index: path.join(e.dir, 'index.md'),
    }))
    .sort((a, b) => a.n - b.n);
}

// Slice files a milestone links from its index.md (relative ./NN-*.md links),
// resolved to absolute paths. Deduplicated, index.md itself excluded.
function sliceLinks(indexPath) {
  const text = fs.readFileSync(indexPath, 'utf8');
  const dir = path.dirname(indexPath);
  const out = [];
  const re = /\]\(\.\/([^)]+\.md)\)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] === 'index.md') continue;
    const abs = path.join(dir, m[1]);
    if (!out.includes(abs)) out.push(abs);
  }
  return out;
}

// A unit (milestone index or slice file) must carry a Proof-of-work section and
// name a bet-progress Test file.
function unitContentChecks(label, mdPath) {
  const checks = [];
  const text = fs.readFileSync(mdPath, 'utf8');
  checks.push(check(`${label}: Proof of work`, /(^|\n)#{1,6}\s*Proof of work/i.test(text),
    `${mdPath} has no "## Proof of work" section`));
  const namesTest = /Test file:\*{0,2}\s*`?tests\/bets\//.test(text) || /`tests\/bets\/[^`]+`/.test(text);
  checks.push(check(`${label}: Test file named`, namesTest,
    `${mdPath} names no \`tests/bets/…\` Test file`));
  return checks;
}

// ─── decomposition tree ──────────────────────────────────────────────────────

// scope.milestone (optional): additionally require that milestone to be sliced.
function decompositionChecks(targetDir, slug, scope = {}) {
  const checks = [];
  const decomp = path.join(betDocs(targetDir, slug), 'decomposition');

  if (!isDir(decomp)) {
    checks.push(check('decomposition/ exists', false, `${decomp} is missing`));
    return checks; // nothing else is checkable
  }

  // meta.json present + valid + every listed page resolves.
  const metaPath = path.join(decomp, 'meta.json');
  let meta = null;
  if (!isFile(metaPath)) {
    checks.push(check('meta.json', false, `${metaPath} is missing`));
  } else {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      checks.push(check('meta.json', true));
    } catch (err) {
      checks.push(check('meta.json', false, `meta.json is not valid JSON (${err.message})`));
    }
  }
  if (meta && Array.isArray(meta.pages)) {
    const dangling = meta.pages.filter((rel) => typeof rel === 'string' && !isFile(path.join(decomp, rel)));
    checks.push(check('meta.json pages resolve', dangling.length === 0,
      `meta.json lists missing page(s): ${dangling.join(', ')}`));
  }

  const ms = milestones(decomp);
  checks.push(check('at least one milestone', ms.length > 0, 'no milestone index.md under decomposition/'));

  // Every milestone: Proof of work + Test file. First milestone (and any named
  // scope milestone) must be sliced; later milestones are sliced on arrival.
  for (const m of ms) {
    unitContentChecks(`milestone ${m.n}`, m.index).forEach((c) => checks.push(c));
  }

  const first = ms[0];
  const mustBeSliced = new Set();
  if (first) mustBeSliced.add(first.n);
  if (scope.milestone != null) mustBeSliced.add(Number(scope.milestone));

  for (const m of ms) {
    const links = sliceLinks(m.index);
    if (mustBeSliced.has(m.n)) {
      const missing = links.filter((p) => !isFile(p));
      checks.push(check(`milestone ${m.n} sliced`, links.length > 0,
        `milestone ${m.n} links no slice files`));
      checks.push(check(`milestone ${m.n} slice links resolve`, missing.length === 0,
        `milestone ${m.n} links missing slice file(s): ${missing.map((p) => path.basename(p)).join(', ')}`));
      for (const sf of links.filter(isFile)) {
        unitContentChecks(`slice ${path.basename(sf, '.md')}`, sf).forEach((c) => checks.push(c));
      }
    } else {
      // A later milestone may carry links already; if it does, they must resolve.
      const missing = links.filter((p) => !isFile(p));
      if (missing.length) {
        checks.push(check(`milestone ${m.n} slice links resolve`, false,
          `milestone ${m.n} links a slice file that does not exist: ${missing.map((p) => path.basename(p)).join(', ')}`));
      }
    }
  }

  return checks;
}

// ─── readiness ───────────────────────────────────────────────────────────────

function readinessChecks(targetDir, slug) {
  const checks = [];
  const docs = betDocs(targetDir, slug);

  checks.push(check('pitch.md exists', isFile(path.join(docs, 'pitch.md')), `${path.join(docs, 'pitch.md')} is missing`));
  const status = pitchStatus(path.join(docs, 'pitch.md'));
  checks.push(check('pitch status is delivery', status === 'delivery' || status === 'decomposition',
    `pitch status is ${status == null ? '(unset)' : status}, expected delivery`));
  checks.push(check('technical-design/ exists',
    isDir(path.join(docs, 'technical-design')) && fs.readdirSync(path.join(docs, 'technical-design')).length > 0,
    `${path.join(docs, 'technical-design')} is missing or empty`));

  // Approval tag present (git only; a non-git project falls back to prose).
  const tag = `bet/${slug}/approved`;
  checks.push(check('approved tag present', tagExists(targetDir, tag),
    `git tag ${tag} does not exist — the decomposition was never sealed`));

  // The whole-tree structural gate.
  decompositionChecks(targetDir, slug).forEach((c) => checks.push(c));
  return checks;
}

// ─── seal verify (git-pathspec drift) ────────────────────────────────────────

function tagExists(targetDir, tag) {
  try {
    execFileSync('git', ['-C', targetDir, 'rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function inGitRepo(targetDir) {
  try {
    execFileSync('git', ['-C', targetDir, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

// Returns { status: 'sealed' | 'drift' | 'no-tag' | 'no-git', tag, drifted: [files] }.
function sealVerify(targetDir, slug) {
  const tag = `bet/${slug}/approved`;
  if (!inGitRepo(targetDir)) return { status: 'no-git', tag, drifted: [] };
  if (!tagExists(targetDir, tag)) return { status: 'no-tag', tag, drifted: [] };
  const pathspecs = [`docs/bets/${slug}/decomposition`, `docs/bets/${slug}/technical-design`];
  const out = execFileSync('git', ['-C', targetDir, 'diff', '--name-only', tag, '--', ...pathspecs], { encoding: 'utf8' });
  const drifted = out.split('\n').map((s) => s.trim()).filter(Boolean);
  return { status: drifted.length ? 'drift' : 'sealed', tag, drifted };
}

module.exports = {
  decompositionChecks,
  readinessChecks,
  sealVerify,
  // exported for tests
  pitchStatus,
  milestones,
};
