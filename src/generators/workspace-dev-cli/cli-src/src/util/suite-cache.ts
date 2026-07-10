import * as fs from 'fs';
import * as path from 'path';
import { ROOT, TESTS_DIR } from './paths';
import { capture } from './proc';

/** C5 — the last-run verdict cache: `.groundwork/cache/bets/<slug>/last-run.json`,
 *  gitignored working state, never a gate (D-T8). Both this dev-CLI and the
 *  groundwork-method engine (`lib/bet-status/derive.js`) read and write this
 *  file — they cannot share code (the engine cannot depend on the scaffolded
 *  ./dev bundle) — so this module mirrors `derive.js`'s cache shape and
 *  validity rules byte-for-byte: `{ranAt, head, byFile}`, valid only when
 *  `head` matches HEAD now and no file directly under `tests/bets/<slug>/`
 *  carries an mtime newer than `ranAt`. Anything uncertain is a miss and the
 *  caller re-runs the real suite, exactly as before this cache existed. */

export type Verdict = 'green' | 'red';

export interface LastRunCache {
  ranAt: string;
  head: string;
  byFile: Record<string, Verdict>;
}

// pytest -v emits one line per test: `bets/<slug>/<file>::<test> PASSED [ 12%]`.
// Shared by every path that runs the bet-progress suite for real (bet.ts's
// board derivation, quality.ts's `test bet`), so a cache entry written by
// either command is in the one shape a reader on either side can trust.
const PYTEST_LINE = /(?:^|\/)(test_(?:milestone|slice)_\d+_[^/:]+\.[A-Za-z0-9]+)::\S+\s+(PASSED|FAILED|ERROR|XFAIL|XPASS|SKIPPED)/g;

/** Parse a pytest -v transcript into a per-file green/red verdict. A file the
 *  tally never saw a PASSED/XFAIL line for is 'red' — the materialized-RED
 *  starting state; a file with any FAILED/ERROR/XPASS line is 'red' regardless
 *  of other passes. SKIPPED contributes to neither — a skipped test proves
 *  nothing. */
export function parseVerdicts(stdout: string): Map<string, Verdict> {
  const tally = new Map<string, { passed: number; failed: number }>();
  for (const m of stdout.matchAll(PYTEST_LINE)) {
    const file = m[1];
    const outcome = m[2];
    const t = tally.get(file) ?? { passed: 0, failed: 0 };
    if (outcome === 'PASSED' || outcome === 'XFAIL') t.passed += 1;
    else if (outcome === 'FAILED' || outcome === 'ERROR' || outcome === 'XPASS') t.failed += 1;
    tally.set(file, t);
  }
  const byFile = new Map<string, Verdict>();
  for (const [file, t] of tally) byFile.set(file, t.failed > 0 ? 'red' : t.passed > 0 ? 'green' : 'red');
  return byFile;
}

function cachePath(slug: string): string {
  return path.join(ROOT, '.groundwork', 'cache', 'bets', slug, 'last-run.json');
}

/** Read the C5 last-run cache. Missing, unreadable, or malformed (not an
 *  object, or missing/mistyped `ranAt`/`head`/`byFile`) is a miss — never a
 *  throw, so an uncertain cache always falls back to the real suite. */
export function readCache(slug: string): LastRunCache | null {
  let raw: string;
  try {
    raw = fs.readFileSync(cachePath(slug), 'utf8');
  } catch {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<LastRunCache>;
  if (typeof d.ranAt !== 'string' || typeof d.head !== 'string' || !d.byFile || typeof d.byFile !== 'object') {
    return null;
  }
  return { ranAt: d.ranAt, head: d.head, byFile: d.byFile as Record<string, Verdict> };
}

/** Write the C5 last-run cache. Fail-soft — a write failure (read-only tree,
 *  permission error) must never break the command that just paid for the
 *  suite; this is disposable working state, not a source of truth (D-S5). */
export function writeCache(slug: string, cache: LastRunCache): void {
  try {
    const file = cachePath(slug);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2) + '\n');
  } catch {
    /* working state only — never break the caller. */
  }
}

/** Current HEAD, or null with no git / not inside a work tree — the same
 *  uncertain-is-a-miss posture as the rest of this module. */
export function gitHead(): string | null {
  const res = capture('git', ['-C', ROOT, 'rev-parse', 'HEAD']);
  return res.status === 0 ? res.stdout.trim() : null;
}

/** Conservative cache validity: the recorded HEAD must match HEAD now, `ranAt`
 *  must parse, and no file directly under `tests/bets/<slug>/` may carry an
 *  mtime newer than `ranAt` — anything uncertain (no git, an unreadable suite
 *  dir, an unparsable timestamp) is a miss. Mirrors
 *  `lib/bet-status/derive.js`'s `runCacheIsValid` exactly, so the two caches
 *  agree on when a run is stale. */
export function isCacheValid(slug: string, cache: LastRunCache | null, head: string | null): boolean {
  if (!cache || !head) return false;
  if (cache.head !== head) return false;
  const ranAtMs = Date.parse(cache.ranAt);
  if (Number.isNaN(ranAtMs)) return false;
  const betDir = path.join(TESTS_DIR, 'bets', slug);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(betDir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (!e.isFile()) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(path.join(betDir, e.name));
    } catch {
      return false;
    }
    if (stat.mtimeMs > ranAtMs) return false;
  }
  return true;
}

/** Parse a real pytest -v run's stdout and persist it as the C5 cache — the
 *  single write path both bet.ts's board derivation and quality.ts's
 *  `test bet` share, so a suite run from either command leaves an identical
 *  cache entry behind. Skips the write (nothing durable to key a future hit
 *  on) when there is no git HEAD — matching the engine's own no-git
 *  behavior. Returns the parsed verdicts either way, so the caller never
 *  re-parses what it already has. */
export function recordRun(slug: string, stdout: string): Map<string, Verdict> {
  const byFile = parseVerdicts(stdout);
  const head = gitHead();
  if (head) {
    const cacheByFile: Record<string, Verdict> = {};
    for (const [file, v] of byFile) cacheByFile[file] = v;
    writeCache(slug, { ranAt: new Date().toISOString(), head, byFile: cacheByFile });
  }
  return byFile;
}

/** Plain-language relative time ("3 minutes ago") — mirrors
 *  `lib/bet-status/index.js`'s `formatAge` bucket-for-bucket so the dev-CLI's
 *  and the engine's age lines read as one vocabulary, even though the two
 *  sides cannot share code. */
export function formatAge(sinceIso: string, nowMs: number): string | null {
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
