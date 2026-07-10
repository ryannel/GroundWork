'use strict';

// The proofs-at-a-glance board (Workstream B, slice B1; state/evidence/
// footer landed in B3) —
// `npx groundwork-method proofs --bet <slug> [--json] [--write]`.
//
// One row per agreed front-door case from the decomposition tree, walked in
// milestone order: milestone number + name, consumer, the case text verbatim,
// its proof (test) path, the derived board state of its milestone, and any
// Tier-2 visual evidence — plus one Proves-headline row per milestone. Reuses
// lib/bet-status/derive.js's tree walker (listMilestoneDirs) and its
// parseMilestoneIndex, extended there to also capture the Consumer / Proves /
// Test-file fields and the acceptance-criteria bullets.
//
// D-T1: the board is never hand-edited and carries no confirmation state —
// ever. It is derived, whole-regenerated, and degrades per-row rather than
// failing outright: a milestone whose index.md doesn't parse (or that
// carries zero acceptance criteria) renders one "(no criteria parsed — see
// the milestone page)" row instead of dropping the milestone or the board.
// With git unavailable, every row's state renders "(state unknown)" rather
// than a guessed 'not-started' — the two claims are different and the board
// never conflates them; the verb still exits 0.
//
// Dependency-free: Node built-ins only.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const derive = require('../bet-status/derive');
const betState = require('../bet-state');

const DEGRADED_CASE_TEXT = '(no criteria parsed — see the milestone page)';
const { STATE_GLYPH, STATE_LABEL } = derive;

function pitchExists(targetDir, slug) {
  return fs.existsSync(path.join(targetDir, 'docs', 'bets', slug, 'pitch.md'));
}

function gitAvailable(targetDir) {
  return derive.git(targetDir, ['rev-parse', '--git-dir']) !== null;
}

// ─── B3: board-state per row ────────────────────────────────────────────────
// Every case/proves/degraded row belongs to a milestone; its state is that
// milestone's board row state (a milestone's own test file cannot carry its
// state alone — see derive.js's deriveBoardWithMeta comment — so this is
// already the corrected, slices-aware state).

function milestoneState(board, milestoneN) {
  const row = (board || []).find((r) => r.kind === 'milestone' && r.n === milestoneN);
  if (!row) return 'not-started';
  if (row.state === 'done') return 'done';
  if (row.state === 'in-progress') return 'in-progress';
  return 'not-started';
}

function stateCell(state) {
  if (state === 'unknown') return '(state unknown)';
  return `${STATE_GLYPH[state]} ${STATE_LABEL[state]}`;
}

// ─── B3: Tier-2 visual evidence, mined from commit bodies ──────────────────
// step-03-milestone-close.md: "Record a one-line spec-conformance verdict per
// screen in the closing slice's commit message (a `Visual:` line)". A commit
// carries no explicit milestone-number field, so attribution is via the
// milestone/slice test file(s) that same commit touched under
// tests/bets/<slug>/ — the slice-test filename convention
// (test_slice_<milestone-n>_<service>_<slug>.py) already encodes the
// milestone number, so this needs no new convention. A commit whose Visual:
// line cannot be attributed to a milestone is skipped, never guessed onto one.
function mineVisualVerdicts(targetDir, slug) {
  const out = new Map();
  const format = '%H%x1f%B%x1e';
  const log = derive.git(targetDir, ['log', `--format=${format}`, 'HEAD']);
  if (log == null || !log.trim()) return out; // no git, no commits, or unborn HEAD
  const testDirPrefix = `tests/bets/${slug}/`;
  const entries = log.split('\x1e').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const sep = entry.indexOf('\x1f');
    if (sep === -1) continue;
    const sha = entry.slice(0, sep);
    const body = entry.slice(sep + 1);
    const visualLines = [...body.matchAll(/^Visual:\s*(.+)$/gm)].map((m) => m[1].trim()).filter(Boolean);
    if (!visualLines.length) continue;
    const files = derive.gitLines(targetDir, ['show', '--name-only', '--format=', sha]);
    let n = null;
    for (const f of files) {
      if (!f.startsWith(testDirPrefix)) continue;
      const mm = /^test_(?:milestone|slice)_(\d+)_/.exec(path.basename(f));
      if (mm) { n = Number(mm[1]); break; }
    }
    if (n == null) continue; // never guess which milestone an unattributed verdict belongs to
    if (!out.has(n)) out.set(n, []);
    out.get(n).push(...visualLines);
  }
  return out;
}

// ─── B3: screenshot paths — existence check only, never embedded ───────────
// The two capture-path conventions step-03-milestone-close.md names: Tier-1
// smoke (`.groundwork/cache/visual/_smoke/`) and Tier-2 per-state captures
// (`.groundwork/cache/visual/<slug>/`). Neither carries a milestone-number
// path segment, so this is a bet-wide list, not a per-row attribution — never
// a guess. Existence-only: this module never reads image bytes.
function walkExistingFiles(targetDir, relDir, out) {
  const abs = path.join(targetDir, relDir);
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const relPath = path.join(relDir, e.name);
    if (e.isDirectory()) walkExistingFiles(targetDir, relPath, out);
    else if (e.isFile()) out.push(relPath.split(path.sep).join('/'));
  }
}

function listExistingScreenshotPaths(targetDir, slug) {
  const out = [];
  walkExistingFiles(targetDir, path.join('.groundwork', 'cache', 'visual', slug), out);
  walkExistingFiles(targetDir, path.join('.groundwork', 'cache', 'visual', '_smoke'), out);
  return out.sort();
}

// ─── B3: the honesty/wiring/tokens scan cache ───────────────────────────────
// `.groundwork/cache/bets/<slug>/scan-cache.json`: {head, honesty, wiring,
// tokens} — the C5 cache pattern one level up, so a board refresh is never
// the thing that pays for a scan twice (re-scans only when HEAD moved).
// Working state only (D-S5): a read/write failure never breaks the board.

function scanCachePath(targetDir, slug) {
  return path.join(targetDir, '.groundwork', 'cache', 'bets', slug, 'scan-cache.json');
}

function readScanCache(targetDir, slug) {
  let raw;
  try {
    raw = fs.readFileSync(scanCachePath(targetDir, slug), 'utf8');
  } catch {
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || typeof data.head !== 'string') return null;
  return data;
}

function writeScanCache(targetDir, slug, cache) {
  try {
    const file = scanCachePath(targetDir, slug);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2) + '\n');
  } catch {
    // Fail-soft: a cache-write failure must never break the board.
  }
}

// Cheap, in-process cannot-run probe (git repo + the approved tag both need
// to exist — the same precondition ensureScannable enforces inside each
// scan) — checked BEFORE paying for a subprocess spawn, so a bet with no
// approved tag yet (most of delivery, before any milestone closes) never
// spawns three Node processes just to learn what this one `git` call already
// knows.
function scansCanRun(targetDir, slug) {
  if (!gitAvailable(targetDir)) return false;
  const tag = `bet/${slug}/approved`;
  return derive.git(targetDir, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]) !== null;
}

const SCAN_TIMEOUT_MS = 10_000;
const SCAN_KIND_TO_LIB_DIR = {
  honesty: path.join(__dirname, '..', 'bet-honesty'),
  wiring: path.join(__dirname, '..', 'bet-wiring'),
  tokens: path.join(__dirname, '..', 'bet-tokens'),
};
const SCAN_LABEL = { honesty: 'Honesty check', wiring: 'Wiring check', tokens: 'Design-token check' };

// Runs one scan's own `scan()` function directly (no CLI arg-parsing/output-
// formatting layer in between — this calls exactly what `honesty scan` /
// `wiring scan` / `tokens scan` call) inside an isolated child Node process,
// time-boxed to ~10s. The isolation is what makes the time-box real: Node is
// single-threaded, so an in-process call blocked inside a slow `git` command
// cannot be preempted by a timer in this same process — only killing a
// separate process actually bounds it (execFileSync's `timeout` sends the
// child a kill signal). `GW_SCAN_COUNT_FILE`, when set, is a test-only
// invocation counter (one line per real scan spawn) so a cache-hit path can
// be proven to have spawned nothing, without timing.
function runScanCount(targetDir, slug, kind) {
  const libDir = SCAN_KIND_TO_LIB_DIR[kind];
  const counterFile = process.env.GW_SCAN_COUNT_FILE;
  const script = [
    counterFile
      ? `try { require('fs').appendFileSync(${JSON.stringify(counterFile)}, ${JSON.stringify(kind)} + '\\n'); } catch (e) {}`
      : '',
    `const scanner = require(${JSON.stringify(libDir)});`,
    'try {',
    `  const result = scanner.scan(${JSON.stringify(targetDir)}, ${JSON.stringify(slug)});`,
    '  process.stdout.write(JSON.stringify({ ok: true, count: (result.findings || []).length }));',
    '} catch (err) {',
    '  process.stdout.write(JSON.stringify({ ok: false }));',
    '}',
  ].filter(Boolean).join('\n');
  try {
    const out = execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      timeout: SCAN_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
    const parsed = JSON.parse(out);
    return parsed.ok ? parsed.count : null;
  } catch {
    return null; // timeout, crash, or unparsable output -> unavailable, never thrown
  }
}

// The single entry point: a cache hit (HEAD unchanged since the last scan)
// invokes zero scans. A miss re-derives all three and persists what it just
// paid for, keyed on the SAME HEAD read the cache-hit check already used.
function computeScanCounts(targetDir, slug) {
  const head = derive.git(targetDir, ['rev-parse', 'HEAD']);
  if (!head) return { honesty: null, wiring: null, tokens: null };

  const cache = readScanCache(targetDir, slug);
  if (cache && cache.head === head) {
    return { honesty: cache.honesty, wiring: cache.wiring, tokens: cache.tokens };
  }

  if (!scansCanRun(targetDir, slug)) {
    const result = { honesty: null, wiring: null, tokens: null };
    writeScanCache(targetDir, slug, { head, ...result });
    return result;
  }

  const result = {
    honesty: runScanCount(targetDir, slug, 'honesty'),
    wiring: runScanCount(targetDir, slug, 'wiring'),
    tokens: runScanCount(targetDir, slug, 'tokens'),
  };
  writeScanCache(targetDir, slug, { head, ...result });
  return result;
}

function scanLine(kind, count) {
  const label = SCAN_LABEL[kind];
  if (count == null) return `${label}: (scan unavailable).`;
  return `${label}: ${count} thing${count === 1 ? '' : 's'} worth a second look.`;
}

// ─── B3: findings counts by bucket and disposition ──────────────────────────

const FINDING_BUCKET_PLAIN = {
  'decision-needed': 'needing your ruling',
  patch: 'being fixed',
  defer: 'parked with an owner',
  dismiss: 'flagged to drop',
};
const FINDING_DISPOSITION_PLAIN = {
  fixed: 'fixed',
  'deferred-with-owner': 'deferred with an owner',
  'dismissed-with-reason': 'dismissed with a reason',
};

function buildFindingsFooterLines(targetDir, slug) {
  let all = [];
  try {
    all = betState.listFindings(targetDir, slug);
  } catch {
    all = [];
  }
  const open = all.filter((f) => f.status === 'open');
  const closed = all.filter((f) => f.status === 'closed');

  const openByBucket = {};
  for (const b of betState.FINDING_BUCKETS) openByBucket[b] = 0;
  for (const f of open) if (f.bucket in openByBucket) openByBucket[f.bucket] += 1;
  const openLine = `${open.length} open finding${open.length === 1 ? '' : 's'} — `
    + betState.FINDING_BUCKETS.map((b) => `${openByBucket[b]} ${FINDING_BUCKET_PLAIN[b]}`).join(', ') + '.';

  const closedByDisposition = {};
  for (const d of betState.FINDING_DISPOSITIONS) closedByDisposition[d] = 0;
  for (const f of closed) if (f.disposition in closedByDisposition) closedByDisposition[f.disposition] += 1;
  const closedLine = `${closed.length} finding${closed.length === 1 ? '' : 's'} dispositioned — `
    + betState.FINDING_DISPOSITIONS.map((d) => `${closedByDisposition[d]} ${FINDING_DISPOSITION_PLAIN[d]}`).join(', ') + '.';

  return [openLine, closedLine];
}

// ─── B3: the deletion-test line — explicit absence semantics ───────────────
// Mines `.groundwork/cache/bets/<slug>/memlog.md` for the mutate ran-signal
// lines the slice loop logs (step-02-slice-loop.md §2, `./dev bet log`
// appends `- <ts> — mutate <slice-key>: bit` / `"... did not bite"` —
// src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts's logCmd).
// "Never ran" and "ran clean" are different claims and must never collapse
// into the same line.

function memlogPath(targetDir, slug) {
  return path.join(targetDir, '.groundwork', 'cache', 'bets', slug, 'memlog.md');
}

const MUTATE_LINE_RE = /—\s*mutate\s+\S+:\s*(bit|did not bite)\s*$/;

function deletionTestLine(targetDir, slug) {
  let text = null;
  try {
    text = fs.readFileSync(memlogPath(targetDir, slug), 'utf8');
  } catch {
    text = null;
  }
  let bit = 0;
  let didNotBite = 0;
  if (text) {
    for (const raw of text.split('\n')) {
      const m = MUTATE_LINE_RE.exec(raw.trim());
      if (!m) continue;
      if (m[1] === 'bit') bit += 1;
      else didNotBite += 1;
    }
  }
  const total = bit + didNotBite;
  if (total === 0) return 'no deletion-test runs logged.';
  if (didNotBite === 0) return `${total} deletion-test run${total === 1 ? '' : 's'} logged, none failed.`;
  return `${total} run${total === 1 ? '' : 's'} logged, ${didNotBite} did not bite — see the findings ledger.`;
}

// ─── B3: "What keeps this honest" — the faithfulness footer ────────────────
// 5-8 owner-language lines: findings (2), the three scans (3), the deletion
// test (1) — the as-of stamp (1) is appended at RENDER time (not here) so it
// shares whatever clock the page/stdout render is using, rather than baking
// in composeProofs' own call time.
function buildFaithfulnessFooterLines(targetDir, slug) {
  const findingsLines = buildFindingsFooterLines(targetDir, slug);
  const scans = computeScanCounts(targetDir, slug);
  const scanLines = [
    scanLine('honesty', scans.honesty),
    scanLine('wiring', scans.wiring),
    scanLine('tokens', scans.tokens),
  ];
  return [...findingsLines, ...scanLines, deletionTestLine(targetDir, slug)];
}

// ─── Compose ────────────────────────────────────────────────────────────────

// Compose the proofs board for one bet. Always returns a document (never
// throws on a missing bet) — `found: false` mirrors composeStatus's
// `doc.bet === null` convention so the caller decides how to fail, and --json
// always has a consistent shape to print.
//
// `opts.board` (C5, additive): the pre-derived board rows from a `status`
// composition already paid for in this same command (`--with-proofs`) —
// reused as-is when passed, so the pair never derives the board twice; self-
// derived via deriveBoardWithMeta when absent (a bare `proofs` call pays for
// its own derivation, same as `status` always has).
function composeProofs(targetDir, slug, opts = {}) {
  if (!pitchExists(targetDir, slug)) {
    return { slug, found: false, milestones: [], rows: [], board: opts.board || null, screenshots: [], footerLines: [] };
  }

  const gitOk = gitAvailable(targetDir);
  const board = opts.board || (gitOk ? derive.deriveBoardWithMeta(targetDir, slug, {}).rows : []);

  const milestoneDirs = derive.listMilestoneDirs(targetDir, slug);
  const milestones = [];
  const rows = [];
  const visualByMilestone = mineVisualVerdicts(targetDir, slug);

  for (const m of milestoneDirs) {
    const parsed = derive.parseMilestoneIndex(path.join(m.dirPath, 'index.md'));
    const cases = (parsed && parsed.criteria) || [];
    const degraded = !parsed || cases.length === 0;
    const goal = (parsed && parsed.goal) || m.dirName;
    const consumer = (parsed && parsed.consumer) || null;
    const proves = (parsed && parsed.proves) || null;
    const testFile = (parsed && parsed.testFile) || null;
    const state = gitOk ? milestoneState(board, m.n) : 'unknown';
    const evidence = (visualByMilestone.get(m.n) || []).join(' ');

    milestones.push({ n: m.n, dirName: m.dirName, goal, consumer, proves, testFile, cases, degraded, state, evidence });

    if (degraded) {
      rows.push({ milestoneN: m.n, milestoneGoal: goal, consumer, kind: 'degraded', text: DEGRADED_CASE_TEXT, testFile, state, evidence });
      continue;
    }
    if (proves) {
      rows.push({ milestoneN: m.n, milestoneGoal: goal, consumer, kind: 'proves', text: proves, testFile, state, evidence });
    }
    for (const caseText of cases) {
      rows.push({ milestoneN: m.n, milestoneGoal: goal, consumer, kind: 'case', text: caseText, testFile, state, evidence });
    }
  }

  const screenshots = listExistingScreenshotPaths(targetDir, slug);
  const footerLines = buildFaithfulnessFooterLines(targetDir, slug);

  return { slug, found: true, milestones, rows, board, screenshots, footerLines };
}

// ─── Render: markdown ───────────────────────────────────────────────────────
//
// A single flat table — every row already carries its own milestone/consumer/
// test-path/state/evidence context, so a scan down the Case column is the
// whole board — followed by the screenshot listing (existence-only) and the
// faithfulness footer. No engine vocabulary (verdicts, tiers, wire tokens,
// tags, HEAD) reaches this render — every field here is either owner-authored
// prose from the milestone page or the plain-language translations below.

function escapeCell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function renderScreenshotsMarkdown(paths) {
  if (!paths || !paths.length) return null;
  const lines = ['**Screenshots on disk:**'];
  for (const p of paths) lines.push(`- \`${p}\``);
  return lines.join('\n');
}

function renderFaithfulnessFooterMarkdown(footerLines, clock) {
  const generatedAt = (clock ? clock() : new Date()).toISOString();
  const lines = ['## What keeps this honest', ''];
  for (const l of footerLines) lines.push(`- ${l}`);
  lines.push(`- As of ${generatedAt} — rulings happen in the conversation.`);
  return lines.join('\n');
}

function renderMarkdown(doc, clock) {
  if (!doc.found) {
    return `_No pitch found at docs/bets/${doc.slug}/pitch.md._\n`;
  }
  const parts = [];
  if (doc.milestones.length === 0) {
    parts.push('_No milestones decomposed yet._');
  } else {
    const lines = [];
    lines.push('| Milestone | Consumer | Case | Test file | State | Evidence |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of doc.rows) {
      const milestoneCell = escapeCell(`${r.milestoneN}: ${r.milestoneGoal}`);
      const consumerCell = r.consumer ? escapeCell(r.consumer) : '—';
      const testCell = r.testFile ? `\`${r.testFile}\`` : '—';
      const caseCell = r.kind === 'proves' ? `**Proves:** ${escapeCell(r.text)}` : escapeCell(r.text);
      const evidenceCell = r.evidence ? escapeCell(r.evidence) : '—';
      lines.push(`| ${milestoneCell} | ${consumerCell} | ${caseCell} | ${testCell} | ${stateCell(r.state)} | ${evidenceCell} |`);
    }
    parts.push(lines.join('\n'));
  }

  const screenshotsMd = renderScreenshotsMarkdown(doc.screenshots);
  if (screenshotsMd) parts.push(screenshotsMd);

  if (doc.footerLines && doc.footerLines.length) {
    parts.push(renderFaithfulnessFooterMarkdown(doc.footerLines, clock));
  }

  return parts.join('\n\n') + '\n';
}

// ─── Render: the written proofs page (`proofs --write`) ────────────────────
//
// Same GENERATED-header + generated-at-line discipline as
// lib/bet-status/index.js's renderStatusPage/writeStatusPage: an HTML marker
// comment says the page is generated and regenerated whole (never hand-edit
// it), a real wall-clock generated-at line follows, and the body is the same
// markdown the terminal prints. H1-led, no frontmatter — the docsite derives
// the sidebar title from the first H1 when `title:` is absent (see
// bet-status/index.js's own note on this).
function renderProofsPage(doc, clock) {
  const generatedAt = (clock ? clock() : new Date()).toISOString();
  const header = [
    '<!-- GENERATED by `groundwork-method proofs --write` — regenerated whole at every',
    '     checkpoint. Do not hand-edit; edits are overwritten on the next write. -->',
    '',
    `# Proofs: ${doc.slug}`,
    '',
    `_Generated at ${generatedAt}._`,
    '',
    '',
  ].join('\n');
  return header + renderMarkdown(doc, clock);
}

// Default write path when `--write` carries no explicit value: the bet's own
// proofs page, beside status.md.
function defaultWritePath(targetDir, slug) {
  return path.join(targetDir, 'docs', 'bets', slug, 'proofs.md');
}

// Write the page whole — never append, never patch. Regenerating from
// scratch each call is what keeps a stale row from surviving a re-render.
function writeProofsPage(filePath, doc, clock) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderProofsPage(doc, clock));
}

module.exports = {
  composeProofs,
  renderMarkdown,
  renderProofsPage,
  defaultWritePath,
  writeProofsPage,
};
