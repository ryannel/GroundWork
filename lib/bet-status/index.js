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

function buildBetSection(targetDir, slug) {
  const pitchPath = path.join(targetDir, 'docs', 'bets', slug, 'pitch.md');
  const pitch = parsePitch(pitchPath);
  if (!pitch) return null;

  const board = derive.deriveBoard(targetDir, slug);
  const milestoneDirs = derive.listMilestoneDirs(targetDir, slug);

  const milestones = milestoneDirs.map((m) => {
    const parsed = derive.parseMilestoneIndex(path.join(m.dirPath, 'index.md'));
    const state = milestoneRowState(targetDir, slug, m.n, board);
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

function buildMilestoneSection(targetDir, slug, milestoneN) {
  if (milestoneN == null) return null;
  const milestoneDirs = derive.listMilestoneDirs(targetDir, slug);
  const dir = milestoneDirs.find((m) => m.n === milestoneN);
  if (!dir) return null;

  const board = derive.deriveBoard(targetDir, slug);
  const sliceFiles = derive.listSliceFiles(dir.dirPath);

  const slices = sliceFiles.map((file) => {
    const parsed = derive.parseSliceFile(path.join(dir.dirPath, file));
    // Match this slice file to its board row via the slice-slug segment of
    // the file name (NN-<slice-slug>.md).
    const slugMatch = /^\d\d-(.+)\.md$/.exec(file);
    const sliceSlug = slugMatch ? slugMatch[1] : file;
    const row = board.find((r) => r.kind === 'slice' && r.slug === sliceSlug);
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

function composeStatus(targetDir, requestedSlug) {
  const program = buildProgram(targetDir);
  const slug = requestedSlug || resolveDefaultBetSlug(program);

  let bet = null;
  let milestone = null;
  if (slug) {
    bet = buildBetSection(targetDir, slug);
    if (bet) milestone = buildMilestoneSection(targetDir, slug, bet.currentMilestoneN);
  }

  return { program, bet, milestone, requestedSlug: requestedSlug || null, resolvedSlug: slug || null };
}

// ─── Render: markdown ───────────────────────────────────────────────────────

const STATE_GLYPH = { done: '✅', 'in-progress': '▶', 'not-started': '○' };
const STATE_LABEL = { done: 'done', 'in-progress': 'in progress', 'not-started': 'not started' };
const TIER_LABEL = { frontier: 'strongest model', execution: 'standard model', light: 'fast model' };

function renderProgramMarkdown(program) {
  const lines = [];
  lines.push('## Program');
  lines.push('');
  const rows = [];
  for (const b of program.archived) rows.push({ ...b, sortKey: `0-${b.slug}` });
  for (const b of program.inFlight) rows.push({ ...b, sortKey: `1-${b.slug}` });
  // Queued preserves written order (D-S5) — no re-sort.
  program.queued.forEach((b, i) => rows.push({ ...b, sortKey: `2-${String(i).padStart(6, '0')}` }));

  if (rows.length === 0 && program.patches.length === 0) {
    lines.push('_No bets found — nothing delivered, in flight, or queued yet._');
  } else {
    for (const b of program.archived) {
      lines.push(`- **Delivered** — ${b.goal}`);
    }
    for (const b of program.inFlight) {
      const branchNote = b.branch && b.branch !== 'HEAD' ? ` (branch \`${b.branch}\`, ${b.freshness || 'live'})` : '';
      lines.push(`- **In flight** — ${b.goal}${branchNote}`);
    }
    for (const b of program.queued) {
      lines.push(`- **Queued** — ${b.goal}`);
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

function renderMarkdown(doc) {
  const parts = [renderProgramMarkdown(doc.program)];
  if (doc.bet) parts.push(renderBetMarkdown(doc.bet));
  else if (doc.requestedSlug) parts.push(`## Bet: ${doc.requestedSlug}\n\n_No pitch found at docs/bets/${doc.requestedSlug}/pitch.md._`);
  if (doc.milestone) parts.push(renderMilestoneMarkdown(doc.milestone));
  return parts.join('\n\n') + '\n';
}

module.exports = {
  composeStatus,
  renderMarkdown,
  buildProgram,
  buildBetSection,
  buildMilestoneSection,
};
