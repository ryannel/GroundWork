'use strict';

// Board derivation shared by `groundwork status` (this module's caller) — a
// CLI-side re-implementation of the milestone/slice green/red derivation the
// scaffolded `./dev bet status --json` performs
// (src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts). The
// groundwork-method CLI cannot depend on the scaffolded ./dev bundle, so the
// derivation is re-implemented here against the same committed-truth inputs:
// the bet suite's test file names (tests/bets/<slug>/) + git, never board.yaml.
//
// Dependency-free: Node built-ins only. Running the actual suite (pytest, go
// test, ...) is out of scope for a CLI that ships with no project runtime
// assumptions — this module derives what it can from file presence and git
// history, and reports 'unknown' where only a live test run would resolve it.
// This is a narrower derivation than the scaffolded ./dev bundle's (which runs
// the suite for a real pass/fail verdict); the snapshot's contract is "render
// from committed truth, never board.yaml", which this satisfies.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MILESTONE_TEST_RE = /^test_milestone_(\d+)_(.+)\.[^.]+$/;
const SLICE_TEST_RE = /^test_slice_(\d+)_(.+)_([a-z0-9][a-z0-9-]*)\.[^.]+$/;
const MILESTONE_DIR_RE = /^(\d\d)-(.+)$/;

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function gitLines(cwd, args) {
  const out = git(cwd, args);
  return out ? out.split('\n').filter(Boolean) : [];
}

// ─── Milestone/slice test-file inventory ───────────────────────────────────

function suiteTestFiles(targetDir, slug) {
  const dir = path.join(targetDir, 'tests', 'bets', slug);
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && (MILESTONE_TEST_RE.test(e.name) || SLICE_TEST_RE.test(e.name)))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// A file is committed at HEAD (materialized) vs merely present on disk — the
// snapshot renders from committed truth, so an uncommitted stub does not
// count as a milestone/slice having been authored.
function committedFiles(targetDir, relDir) {
  const out = gitLines(targetDir, ['ls-files', relDir]);
  return new Set(out.map((f) => path.basename(f)));
}

// Best-effort green/red from git log, used only when the suite cannot be run
// (no pytest-capable interpreter found): a file with a single commit (its
// RED-materialization commit, per Delivery Step 0) is 'in-progress'; two or
// more commits (materialize + at least one closing edit) is 'done'. This is a
// coarser signal than a real pass/fail — it degrades gracefully, it does not
// replace running the suite when a runner is available. It is faithful for
// SLICE files only (the close commits them a second time); milestone files
// are committed once and turn green because slices land, so deriveBoard
// post-processes milestone rows from their slices instead.
function fileLifecycleFallback(targetDir, relPath) {
  const commits = gitLines(targetDir, ['log', '--follow', '--format=%H', '--', relPath]);
  if (commits.length === 0) return 'not-started';
  if (commits.length === 1) return 'in-progress';
  return 'done';
}

function pythonCmd() {
  for (const cmd of ['python3', 'python']) {
    try {
      execFileSync(cmd, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
      return cmd;
    } catch { /* try next */ }
  }
  return null;
}

// Run the bet suite with pytest (the template convention — see
// templates/decomposition/slice.md's `tests/bets/<slug>/test_*.py`) and map
// each test file to a pass/fail verdict. Best-effort: any interpreter/pytest
// absence, or a suite that cannot collect, degrades to the git-log fallback
// rather than failing the whole snapshot — the renderer must survive an
// environment with no test runner installed.
function runSuiteVerdicts(targetDir, slug) {
  const python = pythonCmd();
  if (!python) return null;
  const betTestDir = path.join('tests', 'bets', slug);
  let res;
  try {
    res = execFileSync(
      python,
      ['-m', 'pytest', betTestDir, '-v', '--tb=no', '--color=no', '-p', 'no:cacheprovider'],
      {
        cwd: targetDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // The snapshot must stay cheap and always-available: a hanging suite
        // degrades to the git fallback instead of blocking the command, and a
        // truncated -v transcript must never be tallied (misclassifying the
        // files whose result line fell past the cutoff), so both bound here.
        timeout: 120_000,
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch (err) {
    // pytest exits non-zero on any test failure — that is still a verdict,
    // not a cannot-run condition. A timeout kill or output overflow is NOT a
    // verdict: its stdout is partial, and a partial tally silently lies.
    if (err.killed || err.signal || err.code === 'ENOBUFS') return null;
    if (err.stdout == null) return null;
    res = err.stdout;
  }
  const tally = new Map();
  const line = /(?:^|\/)(test_(?:milestone|slice)_\d+_[^/:]+\.py)::\S+\s+(PASSED|FAILED|ERROR|XFAIL|XPASS|SKIPPED)/g;
  for (const m of res.matchAll(line)) {
    const file = m[1];
    const outcome = m[2];
    const t = tally.get(file) || { passed: 0, failed: 0 };
    if (outcome === 'PASSED' || outcome === 'XFAIL') t.passed += 1;
    else if (outcome === 'FAILED' || outcome === 'ERROR' || outcome === 'XPASS') t.failed += 1;
    tally.set(file, t);
  }
  if (tally.size === 0) return null; // nothing collected — treat as cannot-run
  const byFile = new Map();
  for (const [file, t] of tally) byFile.set(file, t.failed > 0 ? 'in-progress' : 'done');
  return byFile;
}

function deriveBoard(targetDir, slug) {
  const betTestDir = path.join('tests', 'bets', slug);
  const files = suiteTestFiles(targetDir, slug);
  const committed = committedFiles(targetDir, betTestDir);
  const suiteVerdicts = files.length > 0 ? runSuiteVerdicts(targetDir, slug) : null;

  const rows = files.map((file) => {
    const relPath = path.join(betTestDir, file).split(path.sep).join('/');
    const isCommitted = committed.has(file);
    let state;
    if (!isCommitted) {
      state = 'not-started';
    } else if (suiteVerdicts && suiteVerdicts.has(file)) {
      state = suiteVerdicts.get(file);
    } else if (suiteVerdicts) {
      // Suite ran but produced no result for this file (e.g. a collection
      // error scoped to it) — materialized but not proven is 'in-progress'.
      state = 'in-progress';
    } else {
      state = fileLifecycleFallback(targetDir, relPath);
    }

    const mm = MILESTONE_TEST_RE.exec(file);
    if (mm) {
      return { kind: 'milestone', file, n: Number(mm[1]), slug: mm[2], service: null, state };
    }
    const sm = SLICE_TEST_RE.exec(file);
    return { kind: 'slice', file, n: Number(sm[1]), service: sm[2], slug: sm[3], state };
  });

  const order = { milestone: 0, slice: 1 };
  rows.sort((a, b) => order[a.kind] - order[b.kind] || a.n - b.n);

  // A milestone's own test file cannot carry its state the way a slice's can:
  // the workflow commits it once (red, at materialization) and it turns green
  // because slices land — its commit count says nothing, and a red stub may
  // just be an unopened rung. So milestone rows are corrected from their
  // slices: with the suite unavailable the slices ARE the milestone's state,
  // and even with the suite running, a failing stub with no slices authored
  // yet reads as not started, not in progress.
  const slicesByN = new Map();
  for (const r of rows) {
    if (r.kind !== 'slice') continue;
    if (!slicesByN.has(r.n)) slicesByN.set(r.n, []);
    slicesByN.get(r.n).push(r);
  }
  for (const r of rows) {
    if (r.kind !== 'milestone') continue;
    const slices = slicesByN.get(r.n) || [];
    if (suiteVerdicts) {
      if (r.state === 'in-progress' && slices.length === 0) r.state = 'not-started';
    } else if (slices.length > 0) {
      if (slices.every((s) => s.state === 'done')) r.state = 'done';
      else if (slices.some((s) => s.state !== 'not-started')) r.state = 'in-progress';
      else r.state = 'not-started';
    } else if (r.state === 'in-progress') {
      r.state = 'not-started'; // one commit = the materialized stub of an unopened rung
    }
  }
  return rows;
}

// ─── Decomposition tree ────────────────────────────────────────────────────

// Milestone directories under docs/bets/<slug>/decomposition/, in numeric order.
function listMilestoneDirs(targetDir, slug) {
  const decompDir = path.join(targetDir, 'docs', 'bets', slug, 'decomposition');
  let entries;
  try {
    entries = fs.readdirSync(decompDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && MILESTONE_DIR_RE.test(e.name))
    .map((e) => {
      const m = MILESTONE_DIR_RE.exec(e.name);
      return { n: Number(m[1]), dirName: e.name, dirPath: path.join(decompDir, e.name) };
    })
    .sort((a, b) => a.n - b.n);
}

// Parse a milestone index.md for its demonstrable-goal text (never the coded
// name/slug) — the field the plan and Protocol 11 both name as the ladder
// label. Falls back to the H1 title (still product prose, never a slug) when
// the field is missing, so a hand-authored decomposition without the field
// still renders something readable rather than nothing.
function parseMilestoneIndex(indexPath) {
  let body;
  try {
    body = fs.readFileSync(indexPath, 'utf8');
  } catch {
    return null;
  }
  const goalMatch = /\*\*Demonstrable goal:\*\*\s*(.+)/.exec(body);
  const titleMatch = /^#\s*Milestone\s*\[?\d*\]?:?\s*(.+)$/m.exec(body);
  const goal = goalMatch ? goalMatch[1].trim() : (titleMatch ? titleMatch[1].trim() : null);
  return { goal };
}

// Slice files beside a milestone's index.md (NN-<slice-slug>.md), in file order.
function listSliceFiles(milestoneDirPath) {
  let entries;
  try {
    entries = fs.readdirSync(milestoneDirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')
    .map((e) => e.name)
    .sort();
}

// Parse a slice file for its plain name and Model tier field.
function parseSliceFile(slicePath) {
  let body;
  try {
    body = fs.readFileSync(slicePath, 'utf8');
  } catch {
    return null;
  }
  const titleMatch = /^#\s*Slice\s*\[?([\d.]+)?\]?\s*(?:—|-)?\s*(?:\[?([^:—-]+)\]?\s*[:—-]\s*)?(.+)$/m.exec(body);
  // Fall back to a looser title parse if the strict shape doesn't match.
  const simpleTitle = /^#\s*(.+)$/m.exec(body);
  const name = titleMatch && titleMatch[3] ? titleMatch[3].trim() : (simpleTitle ? simpleTitle[1].trim() : null);

  const tierMatch = /\*\*Model tier:\*\*\s*(.+)/.exec(body);
  let tierRaw = tierMatch ? tierMatch[1].trim() : '';
  // Strip a parenthetical placeholder like "(omit for the execution default...)"
  if (/^\(/.test(tierRaw)) tierRaw = '';
  let tier = 'execution';
  if (/^frontier/i.test(tierRaw)) tier = 'frontier';
  else if (/^execution/i.test(tierRaw)) tier = 'execution';
  else if (/^light/i.test(tierRaw)) tier = 'light';

  const testFileMatch = /\*\*Test file:\*\*\s*`([^`]+)`/.exec(body);

  return { name, tier, testFile: testFileMatch ? testFileMatch[1] : null };
}

module.exports = {
  suiteTestFiles,
  deriveBoard,
  listMilestoneDirs,
  parseMilestoneIndex,
  listSliceFiles,
  parseSliceFile,
  git,
  gitLines,
};
