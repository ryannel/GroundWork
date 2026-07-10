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

// Shared board-state vocabulary — the single source both lib/bet-status/index.js
// (the checkpoint snapshot's Bet/Milestone sections) and lib/bet-proofs/index.js
// (the proofs board's state column, B3) render from, so the two boards never
// speak a different visual language for the same underlying state.
const STATE_GLYPH = { done: '✅', 'in-progress': '▶', 'not-started': '○' };
const STATE_LABEL = { done: 'done', 'in-progress': 'in progress', 'not-started': 'not started' };

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

// ─── C5: the last-run verdict cache ────────────────────────────────────────
// Per-bet working state at `.groundwork/cache/bets/<slug>/last-run.json` —
// never a gate (D-T8). Conservative: valid only when its recorded HEAD
// matches HEAD now AND no file directly under tests/bets/<slug>/ carries an
// mtime newer than `ranAt`; anything uncertain (no git, a missing/malformed
// cache file, an unparseable timestamp) is a miss and the real suite runs,
// exactly as it did before this cache existed. A cache-write failure never
// breaks derivation — this is working state, not a source of truth (D-S5).

function runCachePath(targetDir, slug) {
  return path.join(targetDir, '.groundwork', 'cache', 'bets', slug, 'last-run.json');
}

function readRunCache(targetDir, slug) {
  let raw;
  try {
    raw = fs.readFileSync(runCachePath(targetDir, slug), 'utf8');
  } catch {
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  if (typeof data.ranAt !== 'string' || typeof data.head !== 'string' || !data.byFile || typeof data.byFile !== 'object') {
    return null;
  }
  return data;
}

function writeRunCache(targetDir, slug, cache) {
  try {
    const file = runCachePath(targetDir, slug);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2) + '\n');
  } catch {
    // Fail-soft: a cache-write failure must never break derivation.
  }
}

// `head` is passed in (not re-resolved here) so a single `git rev-parse` per
// call serves both the validity check and, on a fresh run, the write.
function runCacheIsValid(targetDir, slug, cache, head) {
  if (!cache || !head) return false; // no git, or nothing cached — uncertain
  if (cache.head !== head) return false;
  const ranAtMs = Date.parse(cache.ranAt);
  if (Number.isNaN(ranAtMs)) return false;
  const betTestDir = path.join(targetDir, 'tests', 'bets', slug);
  let entries;
  try {
    entries = fs.readdirSync(betTestDir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (!e.isFile()) continue;
    let stat;
    try {
      stat = fs.statSync(path.join(betTestDir, e.name));
    } catch {
      return false;
    }
    if (stat.mtimeMs > ranAtMs) return false;
  }
  return true;
}

// The cache's byFile stores the owner-language pass/fail grammar
// ("green"/"red") the plan specifies; translate to this module's internal
// row-state vocabulary ('done'/'in-progress') so the cached path and the
// live-run path hand deriveBoard an identical Map shape. Malformed entries
// are skipped rather than failing the whole cache (degrade, never break).
function verdictsFromCache(cache) {
  const byFile = new Map();
  for (const [file, v] of Object.entries(cache.byFile)) {
    if (v === 'green') byFile.set(file, 'done');
    else if (v === 'red') byFile.set(file, 'in-progress');
  }
  return byFile;
}

// The single entry point for pass/fail state: try the cache first (unless
// `opts.run` bypasses it), fall back to actually running the suite, and
// persist what a real run just paid for. Returns
// `{ byFile: Map|null, verdictSource: {cached:true, ranAt}|null }` —
// verdictSource is set only on the cache path, so a fresh real run's callers
// see exactly what they saw before this cache existed.
function computeSuiteVerdicts(targetDir, slug, opts = {}) {
  if (!opts.run) {
    const head = git(targetDir, ['rev-parse', 'HEAD']);
    const cache = readRunCache(targetDir, slug);
    if (runCacheIsValid(targetDir, slug, cache, head)) {
      return { byFile: verdictsFromCache(cache), verdictSource: { cached: true, ranAt: cache.ranAt } };
    }
  }
  const byFile = runSuiteVerdicts(targetDir, slug);
  if (byFile) {
    const head = git(targetDir, ['rev-parse', 'HEAD']);
    if (head) {
      const cacheByFile = {};
      for (const [file, state] of byFile) cacheByFile[file] = state === 'done' ? 'green' : 'red';
      writeRunCache(targetDir, slug, { ranAt: new Date().toISOString(), head, byFile: cacheByFile });
    }
    // No git (`head` null) -> nothing durable to key a future cache hit on;
    // skip the write rather than persist a cache that can never validate.
  }
  return { byFile, verdictSource: null };
}

// Backward-compatible: existing callers get exactly the rows array they did
// before this cache existed. `opts` is additive (`{ run: true }` bypasses the
// cache and forces a real run — the C5 `--run` escape hatch).
function deriveBoard(targetDir, slug, opts) {
  return deriveBoardWithMeta(targetDir, slug, opts).rows;
}

// Same derivation, plus `verdictSource` — the metadata composeStatus needs to
// render C5's age line and to avoid deriving the board twice per command (the
// shared-derivation contract behind `--with-proofs`).
function deriveBoardWithMeta(targetDir, slug, opts = {}) {
  const betTestDir = path.join('tests', 'bets', slug);
  const files = suiteTestFiles(targetDir, slug);
  const committed = committedFiles(targetDir, betTestDir);
  const { byFile: suiteVerdicts, verdictSource } = files.length > 0
    ? computeSuiteVerdicts(targetDir, slug, opts)
    : { byFile: null, verdictSource: null };

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
  return { rows, verdictSource };
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

// Parse the acceptance-criteria bullets following a milestone's
// "**Acceptance criteria...**" bold field (`templates/decomposition/
// milestone-index.md`) — the agreed front-door cases the owner signs at
// decomposition (lib/bet-proofs' board, Wave 2 WS-B slice B1). Accepts both
// `- [ ] case` (checkbox, pre-B5 template vintage) and plain `- case`
// bullets; stops at the first blank line following the first bullet, or the
// first non-bullet line. Returns [] when the field or its bullets are
// absent — never throws, so a hand-edited or older milestone page degrades
// instead of crashing the board.
function parseAcceptanceCriteria(body) {
  const fieldMatch = /\*\*Acceptance criteria\b[^\n]*\*\*\s*/.exec(body);
  if (!fieldMatch) return [];
  const rest = body.slice(fieldMatch.index + fieldMatch[0].length);
  const criteria = [];
  let started = false;
  for (const raw of rest.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      if (started) break; // blank line after bullets began -> end of the list
      continue; // allow blank line(s) before the first bullet
    }
    const m = /^-\s+(?:\[[ xX]\]\s*)?(.+)$/.exec(line);
    if (!m) break;
    criteria.push(m[1].trim());
    started = true;
  }
  return criteria;
}

// Parse a milestone index.md for its demonstrable-goal text (never the coded
// name/slug) — the field the plan and Protocol 11 both name as the ladder
// label. Falls back to the H1 title (still product prose, never a slug) when
// the field is missing, so a hand-authored decomposition without the field
// still renders something readable rather than nothing.
//
// Also captures the fields the proofs board (lib/bet-proofs) needs: the
// Consumer line, the acceptance-criteria bullets, the Proves line (under
// "## Proof of work"), and the Test-file path — additive fields alongside
// `goal`; existing callers reading only `.goal` see unchanged behavior.
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

  const consumerMatch = /\*\*Consumer:\*\*\s*(.+)/.exec(body);
  const consumer = consumerMatch ? consumerMatch[1].trim() : null;

  const provesMatch = /\*\*Proves:\*\*\s*(.+)/.exec(body);
  const proves = provesMatch ? provesMatch[1].trim() : null;

  const testFileMatch = /\*\*Test file:\*\*\s*`([^`]+)`/.exec(body);
  const testFile = testFileMatch ? testFileMatch[1].trim() : null;

  const criteria = parseAcceptanceCriteria(body);

  return { goal, consumer, proves, testFile, criteria };
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
  deriveBoardWithMeta,
  runCachePath,
  listMilestoneDirs,
  parseMilestoneIndex,
  listSliceFiles,
  parseSliceFile,
  git,
  gitLines,
  STATE_GLYPH,
  STATE_LABEL,
};
