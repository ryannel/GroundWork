'use strict';

// The checkpoint-snapshot renderer (Wave 2, WS-B slice B1) —
// `npx groundwork-method status [--bet <slug>] [--json]`.
//
// Renders the "you are here" snapshot Protocol 11 (operating-contract.md,
// "The checkpoint snapshot") specifies: Program (every bet, plain-language
// payloads) -> Bet (the goal + milestone ladder as a checklist) -> Milestone
// (the current milestone's slices, with the in-progress slice's model tier as
// a column). Every source is committed truth: docs/bets/_archive/ for
// delivered bets, pitch frontmatter + decomposition prose for in-flight bets,
// `.groundwork/cache/discovery-notes.md`'s `## Bets` bullets (IN WRITTEN
// ORDER — the order IS the queue, D-S5) for queued bets, and
// `git log --grep='Lane: patch'` for patches. `board.yaml` is NEVER read —
// the snapshot must render with no board, mid-delivery (D-S2/D-S5).
//
// Zero engine vocabulary outside Protocol 11's shared set (bet, milestone,
// slice, pitch, appetite, numbers) reaches the rendered markdown — see the
// state-label / tier-label maps below, the one deliberate translation layer.
//
// Dependency-free: Node built-ins + git.

const fs = require('fs');
const path = require('path');

const derive = require('./derive');
const betState = require('../bet-state');
const { composeState } = require('../bet-state/compose');

// ─── Small readers ──────────────────────────────────────────────────────────

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function parsePitch(pitchPath) {
  return parsePitchText(readFileSafe(pitchPath));
}

function parsePitchText(text) {
  if (text == null) return null;
  const front = text.startsWith('---') ? text.split('---')[1] : '';
  const statusMatch = /(^|\n)status:\s*(\S+)/.exec(front || '');
  // The one-line goal is what the bet does (Solution); the problem it fixes is
  // the fallback — a delivered bet described by its problem reads backwards.
  const solutionMatch = /\*\*Solution:\*\*\s*(.+)/.exec(text);
  const problemMatch = /\*\*Problem:\*\*\s*(.+)/.exec(text);
  const titleMatch = /^#\s*Bet:\s*(.+)$/m.exec(text);
  return {
    status: statusMatch ? statusMatch[2] : null,
    goal: (solutionMatch ? solutionMatch[1].trim() : null) || (problemMatch ? problemMatch[1].trim() : null),
    title: titleMatch ? titleMatch[1].trim() : null,
  };
}

// ─── Program section sources ────────────────────────────────────────────────

// Delivered: docs/bets/_archive/<slug>/ in the checkout this runs in.
function listArchivedBets(targetDir) {
  const dir = path.join(targetDir, 'docs', 'bets', '_archive');
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name !== 'meta.json')
    .map((e) => e.name)
    .sort()
    .map((slug) => {
      const pitch = parsePitch(path.join(dir, slug, 'pitch.md'));
      return {
        slug,
        state: 'delivered',
        goal: (pitch && (pitch.goal || pitch.title)) || slug,
        branch: null,
      };
    });
}

// In flight, current checkout: active bet dirs directly under docs/bets/
// (excluding _archive) whose pitch.md exists.
function listActiveBetsInCheckout(targetDir) {
  const dir = path.join(targetDir, 'docs', 'bets');
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name !== '_archive')
    .map((e) => e.name)
    .sort()
    .map((slug) => {
      const pitch = parsePitch(path.join(dir, slug, 'pitch.md'));
      if (!pitch) return null;
      return {
        slug,
        state: 'in-flight',
        goal: pitch.goal || pitch.title || slug,
        branch: 'HEAD',
      };
    })
    .filter(Boolean);
}

// In flight, other worktrees: `git worktree list --porcelain`, read each
// worktree's docs/bets/<slug>/ directly. Degrades to [] when git or worktree
// listing is unavailable — the section renders with whatever it has.
function listWorktreeBets(targetDir, skipSlugs) {
  const out = derive.git(targetDir, ['worktree', 'list', '--porcelain']);
  if (out == null) return [];
  const results = [];
  const blocks = out.split(/\n\n+/);
  for (const block of blocks) {
    const wtMatch = /^worktree\s+(.+)$/m.exec(block);
    const branchMatch = /^branch\s+refs\/heads\/(.+)$/m.exec(block);
    if (!wtMatch) continue;
    const wtPath = wtMatch[1].trim();
    if (path.resolve(wtPath) === path.resolve(targetDir)) continue; // current checkout, already covered
    const branch = branchMatch ? branchMatch[1].trim() : null;
    const betsDir = path.join(wtPath, 'docs', 'bets');
    let entries;
    try {
      entries = fs.readdirSync(betsDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === '_archive') continue;
      if (skipSlugs.has(e.name)) continue;
      const pitch = parsePitch(path.join(betsDir, e.name, 'pitch.md'));
      if (!pitch) continue;
      results.push({
        slug: e.name,
        state: 'in-flight',
        goal: pitch.goal || pitch.title || e.name,
        branch: branch || null,
        freshness: 'live',
      });
    }
  }
  return results;
}

// In flight, branch-only: `git for-each-ref refs/heads/bet/*` minus branches
// already covered by a worktree or the current checkout. Materializes
// docs/bets/<slug>/pitch.md via `git show <branch>:<path>`.
function listBranchOnlyBets(targetDir, coveredBranches, skipSlugs) {
  const refs = derive.gitLines(targetDir, ['for-each-ref', 'refs/heads/bet/*', '--format=%(refname:short)']);
  const results = [];
  for (const branch of refs) {
    if (coveredBranches.has(branch)) continue;
    // Slug is the branch's trailing path segment (bet/<slug> or bet/<slug>/...).
    const slug = branch.replace(/^bet\//, '').split('/')[0];
    if (!slug || skipSlugs.has(slug)) continue;
    const content = showAtRef(targetDir, branch, `docs/bets/${slug}/pitch.md`);
    if (content == null) continue;
    const pitch = parsePitchText(content);
    results.push({
      slug,
      state: 'in-flight',
      goal: pitch.goal || pitch.title || slug,
      branch,
      freshness: 'as of last commit',
      pitchStatus: pitch.status,
    });
  }
  return results;
}

function showAtRef(targetDir, ref, relPath) {
  try {
    return require('child_process').execFileSync(
      'git', ['show', `${ref}:${relPath}`],
      { cwd: targetDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch {
    return null;
  }
}

// Queued: `.groundwork/cache/discovery-notes.md`'s `## Bets` bullets, IN
// WRITTEN ORDER — the order IS the queue (D-S5).
function listQueuedBets(targetDir) {
  const file = path.join(targetDir, '.groundwork', 'cache', 'discovery-notes.md');
  const text = readFileSafe(file);
  if (text == null) return [];
  // Split into `## <Header>` sections and take the body of the `Bets` one —
  // avoids JS regex $/^ per-line vs whole-string ambiguity across Node versions.
  const sections = text.split(/^##\s+/m).slice(1); // drop preamble before the first ##
  const betsSection = sections.find((s) => /^Bets\s*\n/.test(s));
  if (!betsSection) return [];
  const body = betsSection.replace(/^Bets\s*\n/, '');
  const bullets = [];
  for (const line of body.split('\n')) {
    const m = /^\s*-\s+(.+)$/.exec(line);
    if (m) bullets.push(m[1].trim());
  }
  return bullets.map((goal, i) => ({ slug: null, state: 'queued', goal, order: i }));
}

// Patches since the last bet close: `git log --grep='Lane: patch'`, grouped by
// `Area:` trailer, windowed since the most recent archived bet (mirrors the
// patch-lane's own clustering read, `groundwork-patch/instructions.md`).
function listPatchesSinceLastClose(targetDir) {
  const format = '%H%x1f%s%x1f%b%x1e';
  const out = derive.git(targetDir, ['log', '--grep=Lane: patch', `--format=${format}`]);
  if (out == null || !out.trim()) return [];
  const entries = out.split('\x1e').map((s) => s.trim()).filter(Boolean);
  const patches = [];
  for (const entry of entries) {
    const [sha, subject, body] = entry.split('\x1f');
    const areaMatch = /^Area:\s*(.+)$/m.exec(body || '');
    const dateOut = derive.git(targetDir, ['show', '-s', '--format=%cI', sha]);
    patches.push({
      sha,
      subject: (subject || '').trim(),
      area: areaMatch ? areaMatch[1].trim() : null,
      date: dateOut || null,
    });
  }
  return patches;
}

// ─── Program section ────────────────────────────────────────────────────────

function buildProgram(targetDir) {
  const archived = listArchivedBets(targetDir);
  const inCheckout = listActiveBetsInCheckout(targetDir);
  const checkoutSlugs = new Set(inCheckout.map((b) => b.slug));
  const worktreeBets = listWorktreeBets(targetDir, checkoutSlugs);
  const coveredBranches = new Set([
    ...(derive.git(targetDir, ['rev-parse', '--abbrev-ref', 'HEAD']) ? [derive.git(targetDir, ['rev-parse', '--abbrev-ref', 'HEAD'])] : []),
  ]);
  // Also cover any branch a worktree is already checked out on.
  const wtPorcelain = derive.git(targetDir, ['worktree', 'list', '--porcelain']) || '';
  for (const m of wtPorcelain.matchAll(/^branch\s+refs\/heads\/(.+)$/gm)) coveredBranches.add(m[1].trim());
  const knownSlugs = new Set([...checkoutSlugs, ...worktreeBets.map((b) => b.slug)]);
  const branchOnlyBets = listBranchOnlyBets(targetDir, coveredBranches, knownSlugs);

  const inFlight = [...inCheckout, ...worktreeBets, ...branchOnlyBets];
  const queued = listQueuedBets(targetDir);
  const patches = listPatchesSinceLastClose(targetDir);

  return { archived, inFlight, queued, patches };
}

// ─── Bet section (milestone ladder) ─────────────────────────────────────────

function milestoneRowState(targetDir, slug, milestoneN, board) {
  const row = board.find((r) => r.kind === 'milestone' && r.n === milestoneN);
  if (!row) return 'not-started';
  if (row.state === 'done') return 'done';
  if (row.state === 'in-progress') return 'in-progress';
  return 'not-started';
}

// `board` (C5) is the pre-derived row array — composeStatus derives it once
// and shares it with buildMilestoneSection below, so a single `status` call
// no longer derives the board twice. Optional and self-deriving when absent,
// so a direct caller with only `(targetDir, slug)` sees unchanged behavior.
function buildBetSection(targetDir, slug, board) {
  const pitchPath = path.join(targetDir, 'docs', 'bets', slug, 'pitch.md');
  const pitch = parsePitch(pitchPath);
  if (!pitch) return null;

  const resolvedBoard = board || derive.deriveBoard(targetDir, slug);
  const milestoneDirs = derive.listMilestoneDirs(targetDir, slug);

  const milestones = milestoneDirs.map((m) => {
    const parsed = derive.parseMilestoneIndex(path.join(m.dirPath, 'index.md'));
    const state = milestoneRowState(targetDir, slug, m.n, resolvedBoard);
    return {
      n: m.n,
      dirName: m.dirName,
      goal: (parsed && parsed.goal) || m.dirName,
      state,
    };
  });

  // The current milestone: the first not-done milestone, or the last one if
  // all are done (nothing left to show as "current" otherwise).
  let current = milestones.find((m) => m.state !== 'done');
  if (!current && milestones.length) current = milestones[milestones.length - 1];

  return {
    slug,
    goal: pitch.goal || pitch.title || slug,
    status: pitch.status,
    milestones,
    currentMilestoneN: current ? current.n : null,
  };
}

// ─── Milestone section (current milestone's slices) ─────────────────────────

function buildMilestoneSection(targetDir, slug, milestoneN, board) {
  if (milestoneN == null) return null;
  const milestoneDirs = derive.listMilestoneDirs(targetDir, slug);
  const dir = milestoneDirs.find((m) => m.n === milestoneN);
  if (!dir) return null;

  const resolvedBoard = board || derive.deriveBoard(targetDir, slug);
  const sliceFiles = derive.listSliceFiles(dir.dirPath);

  const slices = sliceFiles.map((file) => {
    const parsed = derive.parseSliceFile(path.join(dir.dirPath, file));
    // Match this slice file to its board row via the slice-slug segment of
    // the file name (NN-<slice-slug>.md).
    const slugMatch = /^\d\d-(.+)\.md$/.exec(file);
    const sliceSlug = slugMatch ? slugMatch[1] : file;
    const row = resolvedBoard.find((r) => r.kind === 'slice' && r.slug === sliceSlug);
    const state = row ? (row.state === 'done' ? 'done' : row.state === 'in-progress' ? 'in-progress' : 'not-started') : 'not-started';
    return {
      file,
      name: (parsed && parsed.name) || sliceSlug,
      state,
      tier: (parsed && parsed.tier) || 'execution',
    };
  });

  return { milestoneN, dirName: dir.dirName, slices };
}

// ─── Compose ────────────────────────────────────────────────────────────────

// Pick the single in-flight bet when unambiguous (exactly one in-flight bet
// across all sources), otherwise null (caller must pass --bet explicitly).
function resolveDefaultBetSlug(program) {
  if (program.inFlight.length === 1) return program.inFlight[0].slug;
  return null;
}

// `opts` (C5, additive): `{ run: true }` bypasses the last-run cache and
// forces a real suite spawn (the `--run` escape hatch); `{ precomputedBoard:
// {rows, verdictSource} }` skips derivation entirely and uses what the caller
// already derived — how `--with-proofs` shares one derivation between the
// status and proofs pages instead of paying for the suite twice.
function composeStatus(targetDir, requestedSlug, opts = {}) {
  const program = buildProgram(targetDir);
  const slug = requestedSlug || resolveDefaultBetSlug(program);

  let bet = null;
  let milestone = null;
  let verdictSource = null;
  if (slug) {
    const hasPitch = fs.existsSync(path.join(targetDir, 'docs', 'bets', slug, 'pitch.md'));
    if (hasPitch) {
      // Derived exactly once and shared by both sections below — previously
      // each section derived its own board, spawning the suite twice per call.
      const derived = opts.precomputedBoard || derive.deriveBoardWithMeta(targetDir, slug, opts);
      verdictSource = derived.verdictSource;
      bet = buildBetSection(targetDir, slug, derived.rows);
      if (bet) milestone = buildMilestoneSection(targetDir, slug, bet.currentMilestoneN, derived.rows);
    }
  }

  return {
    program, bet, milestone,
    requestedSlug: requestedSlug || null,
    resolvedSlug: slug || null,
    verdictSource,
  };
}

// ─── Render: markdown ───────────────────────────────────────────────────────

// STATE_GLYPH/STATE_LABEL now live in derive.js (single source shared with
// lib/bet-proofs/index.js's board-state column, B3) — destructured here so
// this module's own vocabulary is byte-identical to before the move.
const { STATE_GLYPH, STATE_LABEL } = derive;
const TIER_LABEL = { frontier: 'strongest model', execution: 'standard model', light: 'fast model' };

// `prevProgram` (E2, additive/optional): the previous render's Program
// *signature* (see `programSignature` below) — when given, each row that is
// new since that snapshot or whose state flipped carries a trailing
// `(new)` / `(was <state>)` marker. Omitted (the default), this renders
// exactly as it always has — every existing caller (renderStatusPage's full
// page, --json's absence of markdown, a first-ever chat render) is unaffected.
const PROGRAM_STATE_LABEL = { delivered: 'delivered', 'in-flight': 'in flight' };

function programRowStates(prevProgram) {
  const map = new Map();
  for (const b of prevProgram.archived) map.set(b.slug, 'delivered');
  for (const b of prevProgram.inFlight) map.set(b.slug, 'in-flight');
  return map;
}

function programRowMarker(slug, currentState, prevStates) {
  if (!prevStates) return '';
  if (!prevStates.has(slug)) return ' (new)';
  const prevState = prevStates.get(slug);
  if (prevState !== currentState) return ` (was ${PROGRAM_STATE_LABEL[prevState] || prevState})`;
  return '';
}

function renderProgramMarkdown(program, prevProgram) {
  const lines = [];
  lines.push('## Program');
  lines.push('');
  const rows = [];
  for (const b of program.archived) rows.push({ ...b, sortKey: `0-${b.slug}` });
  for (const b of program.inFlight) rows.push({ ...b, sortKey: `1-${b.slug}` });
  // Queued preserves written order (D-S5) — no re-sort.
  program.queued.forEach((b, i) => rows.push({ ...b, sortKey: `2-${String(i).padStart(6, '0')}` }));

  const prevStates = prevProgram ? programRowStates(prevProgram) : null;
  const prevQueuedGoals = prevProgram ? new Set(prevProgram.queued) : null;

  if (rows.length === 0 && program.patches.length === 0) {
    lines.push('_No bets found — nothing delivered, in flight, or queued yet._');
  } else {
    for (const b of program.archived) {
      lines.push(`- **Delivered** — ${b.goal}${programRowMarker(b.slug, 'delivered', prevStates)}`);
    }
    for (const b of program.inFlight) {
      const branchNote = b.branch && b.branch !== 'HEAD' ? ` (branch \`${b.branch}\`, ${b.freshness || 'live'})` : '';
      lines.push(`- **In flight** — ${b.goal}${branchNote}${programRowMarker(b.slug, 'in-flight', prevStates)}`);
    }
    for (const b of program.queued) {
      const marker = prevQueuedGoals && !prevQueuedGoals.has(b.goal) ? ' (new)' : '';
      lines.push(`- **Queued** — ${b.goal}${marker}`);
    }
    // E6 — name the user's queue: one italic footer line right after the
    // queued bullets, only when there is a queue to name. Rides this shared
    // renderer, so it lands in both the chat snapshot and the written page.
    if (program.queued.length) {
      lines.push('');
      lines.push('_Queue order is yours: reorder the bullets under `## Bets` in `.groundwork/cache/discovery-notes.md` to reorder it._');
    }
  }
  if (program.patches.length) {
    lines.push('');
    lines.push('**Patches since the last bet close:**');
    const byArea = new Map();
    for (const p of program.patches) {
      const area = p.area || '(unspecified area)';
      if (!byArea.has(area)) byArea.set(area, []);
      byArea.get(area).push(p);
    }
    for (const [area, items] of byArea) {
      lines.push(`- ${area}:`);
      for (const p of items) lines.push(`  - ${p.subject}`);
    }
  }
  return lines.join('\n');
}

function renderBetMarkdown(bet) {
  const lines = [];
  lines.push(`## Bet: ${bet.slug}`);
  lines.push('');
  lines.push(bet.goal);
  lines.push('');
  if (bet.milestones.length === 0) {
    lines.push('_No milestones decomposed yet._');
  } else {
    for (const m of bet.milestones) {
      lines.push(`- ${STATE_GLYPH[m.state]} Milestone ${m.n}: ${m.goal} (${STATE_LABEL[m.state]})`);
    }
  }
  return lines.join('\n');
}

function renderMilestoneMarkdown(milestone) {
  const lines = [];
  lines.push(`## Milestone ${milestone.milestoneN}`);
  lines.push('');
  if (milestone.slices.length === 0) {
    lines.push('_No slices authored yet._');
    return lines.join('\n');
  }
  lines.push('| Slice | State | Built by |');
  lines.push('|---|---|---|');
  for (const s of milestone.slices) {
    const tierCell = s.state === 'in-progress' ? TIER_LABEL[s.tier] : '';
    lines.push(`| ${s.name} | ${STATE_GLYPH[s.state]} ${STATE_LABEL[s.state]} | ${tierCell} |`);
  }
  return lines.join('\n');
}

// ─── C5: the plain-language age line ────────────────────────────────────────
// Shared by C5 (test-verdict cache age) and E2 (Program-unchanged-since age)
// — one relative-time phrase, no engine vocabulary.
function formatAge(sinceIso, nowMs) {
  const sinceMs = Date.parse(sinceIso);
  if (Number.isNaN(sinceMs)) return null;
  const diffMs = Math.max(0, nowMs - sinceMs);
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'less than a minute ago';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

// One plain line appended only when the milestone/slice states just rendered
// came from C5's last-run cache rather than a fresh suite spawn — a fresh
// real run renders exactly as it did before this cache existed.
function renderVerdictAgeLine(doc, clock) {
  if (!doc.verdictSource || !doc.verdictSource.cached) return null;
  const nowMs = (clock ? clock() : new Date()).getTime();
  const age = formatAge(doc.verdictSource.ranAt, nowMs);
  if (!age) return null;
  return `_Test states are from the last run, ${age}._`;
}

// The full, uncompressed render — Program in full, the Bet ladder in full,
// the Milestone slice table in full (always). Used by renderStatusPage (the
// written page is ALWAYS full, per E2) and by the chat path whenever nothing
// is available to compress against. `clock` is additive/optional (defaults
// to the real clock) — added so the age line above and the generated-at line
// `renderStatusPage` already prints can share one "now".
function renderMarkdown(doc, clock) {
  const parts = [renderProgramMarkdown(doc.program)];
  if (doc.bet) parts.push(renderBetMarkdown(doc.bet));
  else if (doc.requestedSlug) parts.push(`## Bet: ${doc.requestedSlug}\n\n_No pitch found at docs/bets/${doc.requestedSlug}/pitch.md._`);
  if (doc.milestone) parts.push(renderMilestoneMarkdown(doc.milestone));
  const ageLine = renderVerdictAgeLine(doc, clock);
  if (ageLine) parts.push(ageLine);
  return parts.join('\n\n') + '\n';
}

// ─── E2: snapshot delta compression (chat render only) ──────────────────────
// A fail-open render cache of the last CHAT render's Program section + Bet
// ladder — `.groundwork/cache/bets/<slug>/last-snapshot.json` for a resolved
// bet, `.groundwork/cache/last-snapshot.json` for a program-only render.
// Never a source of truth (D-S5): missing, corrupt, or stale sidecar all fail
// open to a full render. The written page (`renderStatusPage`, above) never
// reads or writes this — `--write` pages are always full.

function snapshotCachePath(targetDir, slug) {
  return slug
    ? path.join(targetDir, '.groundwork', 'cache', 'bets', slug, 'last-snapshot.json')
    : path.join(targetDir, '.groundwork', 'cache', 'last-snapshot.json');
}

function readSnapshotCache(targetDir, slug) {
  let raw;
  try {
    raw = fs.readFileSync(snapshotCachePath(targetDir, slug), 'utf8');
  } catch {
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || typeof data.generatedAt !== 'string' || !data.program) return null;
  return data;
}

function writeSnapshotCache(targetDir, slug, snapshot) {
  try {
    const file = snapshotCachePath(targetDir, slug);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n');
  } catch {
    // Fail-open: the render already happened; a write failure here just
    // means the next call also sees a stale/missing cache and renders full.
  }
}

// The plain-value subset of Program state the collapse decision and the
// (new)/(was) markers key off — safe to JSON-cache and deep-compare.
function programSignature(program) {
  return {
    archived: program.archived.map((b) => ({ slug: b.slug, goal: b.goal })),
    inFlight: program.inFlight.map((b) => ({ slug: b.slug, goal: b.goal, branch: b.branch || null, freshness: b.freshness || null })),
    queued: program.queued.map((b) => b.goal),
    patches: program.patches.map((p) => p.sha),
  };
}

function programCounts(program) {
  return { delivered: program.archived.length, inFlight: program.inFlight.length, queued: program.queued.length };
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildSnapshot(doc, clock) {
  const nowIso = (clock ? clock() : new Date()).toISOString();
  return {
    generatedAt: nowIso,
    program: programSignature(doc.program),
    ladder: doc.bet ? doc.bet.milestones.map((m) => ({ n: m.n, state: m.state })) : null,
  };
}

// Reads the PREVIOUS sidecar (before it is overwritten) and persists the
// snapshot for the doc just composed — called once per `status` invocation,
// regardless of output mode (chat, --write, --json, --full), per E2's "after
// composeStatus(), persist" contract. Returns the previous snapshot (or null
// on a first-ever render / a corrupt or deleted sidecar) for the caller to
// hand to `renderChatMarkdownFromPrev`.
function updateSnapshotCache(doc, targetDir, clock) {
  const slug = doc.resolvedSlug || null;
  const prev = readSnapshotCache(targetDir, slug);
  writeSnapshotCache(targetDir, slug, buildSnapshot(doc, clock));
  return prev;
}

// The chat-stdout renderer: collapses an unchanged Program section to one
// line and an unchanged Bet ladder to one line, with (new)/(was <state>)
// markers on Program rows when a full render is needed. The Milestone slice
// table is never compressed. `forceFull` is the `--full` escape — with it
// (or with no usable previous snapshot) this renders identically to
// `renderMarkdown`, save for the collapse logic simply never firing.
function renderChatMarkdownFromPrev(doc, prevSnapshot, clock, forceFull) {
  const nowMs = (clock ? clock() : new Date()).getTime();
  const usable = !forceFull && !!prevSnapshot;

  const parts = [];

  const newProgramSig = programSignature(doc.program);
  const programUnchanged = usable && deepEqual(newProgramSig, prevSnapshot.program);
  if (programUnchanged) {
    const ageText = formatAge(prevSnapshot.generatedAt, nowMs) || 'a while ago';
    const counts = programCounts(doc.program);
    parts.push([
      '## Program',
      `_Program — unchanged since ${ageText}: ${counts.delivered} delivered · ${counts.inFlight} in flight · ${counts.queued} queued (full picture: the bet's status page)._`,
    ].join('\n'));
  } else {
    parts.push(renderProgramMarkdown(doc.program, usable ? prevSnapshot.program : null));
  }

  if (doc.bet) {
    const newLadder = doc.bet.milestones.map((m) => ({ n: m.n, state: m.state }));
    const ladderUnchanged = usable && doc.bet.milestones.length > 0
      && prevSnapshot.ladder && deepEqual(newLadder, prevSnapshot.ladder);
    if (ladderUnchanged) {
      const current = doc.bet.milestones.find((m) => m.n === doc.bet.currentMilestoneN);
      const label = current ? current.goal : doc.bet.goal;
      parts.push([`## Bet: ${doc.bet.slug}`, `_Milestone ladder — unchanged: still on "${label}"._`].join('\n'));
    } else {
      parts.push(renderBetMarkdown(doc.bet));
    }
  } else if (doc.requestedSlug) {
    parts.push(`## Bet: ${doc.requestedSlug}\n\n_No pitch found at docs/bets/${doc.requestedSlug}/pitch.md._`);
  }

  if (doc.milestone) parts.push(renderMilestoneMarkdown(doc.milestone));

  const ageLine = renderVerdictAgeLine(doc, clock);
  if (ageLine) parts.push(ageLine);

  return parts.join('\n\n') + '\n';
}

// ─── "Waiting on you" (C4) — written page only ──────────────────────────────
// A re-entry point for the owner: pending decisions (the default+veto queue),
// open findings (bucket translated to plain language), and one integrity line
// when the sealed prose has drifted. Composed straight from committed engine
// state (lib/bet-state, lib/bet-state/compose) — never from board.yaml or a
// cache — and rendered ONLY by renderStatusPage/writeStatusPage. renderMarkdown
// (the chat-paste render, above) never calls into this: the chat snapshot is
// byte-unaffected by whatever this section composes.
//
// Every read here is fail-soft — a malformed ledger, a non-git checkout, or a
// bet-state read that throws for any other reason all degrade to "nothing to
// show" rather than breaking a `--write` call.

const FINDING_BUCKET_PLAIN = {
  'decision-needed': 'needs your ruling',
  patch: 'being fixed',
  defer: 'parked with an owner',
  dismiss: 'flagged to drop',
};

function buildWaitingOnYou(targetDir, slug) {
  if (!targetDir || !slug) return null;

  let pending = [];
  try {
    pending = betState.listDecisions(targetDir, slug, { status: 'pending' });
  } catch {
    pending = [];
  }

  let open = [];
  try {
    open = betState.openFindings(targetDir, slug);
  } catch {
    open = [];
  }

  // (e) whole section omitted when nothing is pending or open — a seal-drift
  // line never earns the section on its own.
  if (!pending.length && !open.length) return null;

  let driftedCount = 0;
  try {
    const state = composeState(targetDir, slug);
    if (state && state.seal && state.seal.status === 'drift') {
      driftedCount = (state.seal.drifted || []).length;
    }
  } catch {
    driftedCount = 0;
  }

  return { pending, open, driftedCount };
}

function renderWaitingOnYouMarkdown(data, generatedAt) {
  const lines = [];
  lines.push('## Waiting on you');
  lines.push('');
  lines.push(`_As of ${generatedAt}._`);
  if (data.pending.length) {
    lines.push('');
    lines.push('**Decisions pending:**');
    for (const d of data.pending) {
      lines.push(`- [ ] ${d.question} — if you don't say otherwise, we'll go with: ${d.default}.`);
    }
  }
  if (data.open.length) {
    lines.push('');
    lines.push('**Findings open:**');
    for (const f of data.open) {
      lines.push(`- ${f.title} — ${FINDING_BUCKET_PLAIN[f.bucket] || 'open'}.`);
    }
  }
  if (data.driftedCount) {
    lines.push('');
    lines.push(`The approved baseline has drifted in ${data.driftedCount} file${data.driftedCount === 1 ? '' : 's'} — worth asking about.`);
  }
  lines.push('');
  lines.push("Rulings happen in the conversation — this list is your re-entry point.");
  return lines.join('\n');
}

// ─── Render: the written status page (C2, `status --write`) ────────────────
//
// The page is the same full-tier markdown `renderMarkdown` prints (program ->
// bet -> milestone), wrapped for its life as a file on disk rather than a
// chat paste: an HTML marker comment says it is generated and regenerated at
// every checkpoint (never hand-edit it — the next write clobbers it whole,
// never patches), and a generated-at line carries a real wall-clock timestamp
// (`new Date()` — D-S9 register: only Workflow *scripts* ban Date.now; this is
// Node CLI code, which may read the system clock directly). No frontmatter:
// bet docs (`pitch.md`) carry `status:`/`surfaces:`, never `title:` — the
// docsite's frontmatter schema (`source.config.ts`) derives the sidebar title
// from the page's first `# H1` when `title:` is absent, so leading with an H1
// here is what the existing convention already relies on.
// `targetDir` is optional (kept so any future caller with only a composed
// `doc` in hand still renders the base page) — the "Waiting on you" section
// simply omits itself when it has no bet-state to read from.
function renderStatusPage(doc, targetDir, clock) {
  const generatedAt = (clock ? clock() : new Date()).toISOString();
  const header = [
    '<!-- GENERATED by `groundwork-method status --write` — regenerated whole at every',
    '     checkpoint. Do not hand-edit; edits are overwritten on the next write. -->',
    '',
    `# Status: ${doc.resolvedSlug || doc.requestedSlug || 'program'}`,
    '',
    `_Generated at ${generatedAt}._`,
    '',
    '',
  ].join('\n');
  let page = header + renderMarkdown(doc, clock);

  let waiting = null;
  try {
    const data = buildWaitingOnYou(targetDir, doc.resolvedSlug);
    if (data) waiting = renderWaitingOnYouMarkdown(data, generatedAt);
  } catch {
    waiting = null;
  }
  if (waiting) page += '\n' + waiting + '\n';

  return page;
}

// Default write path when `--write` carries no explicit value: the bet's own
// status page. Requires a resolved slug — with no bet in view there is no
// per-bet path to default to, so the caller (bin/groundwork.js) errors instead
// of guessing a program-wide location that does not exist in this plan.
function defaultWritePath(targetDir, slug) {
  return path.join(targetDir, 'docs', 'bets', slug, 'status.md');
}

// Write the page whole — never append, never patch. Regenerating from scratch
// each call is what keeps a stale section from surviving a re-render.
function writeStatusPage(filePath, doc, targetDir, clock) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderStatusPage(doc, targetDir, clock));
}

module.exports = {
  composeStatus,
  renderMarkdown,
  renderStatusPage,
  defaultWritePath,
  writeStatusPage,
  buildProgram,
  buildBetSection,
  buildMilestoneSection,
  // E2 — chat-render delta compression.
  updateSnapshotCache,
  readSnapshotCache,
  renderChatMarkdownFromPrev,
  snapshotCachePath,
};
