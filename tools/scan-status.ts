// Which repos have moved on since Groundwork last read them, and which it has never read.
//   node tools/scan-status.ts workspaces/<ws> [--record] [--json] [--clones <dir>]
// For every repo a system.yaml lists, asks the remote for the tip of the mark's branch (or the default branch when
// there is no mark, or the mark's branch is gone) and compares it with the mark's head. When a clone exists in
// <dir>/<org>/<name> (default ~/.cache/groundwork/clones), it fetches and counts the commits in between.
// --record writes what it found into each mark as `checked: { at, tip, behind, folders }` (and corrects a branch
// that no longer exists), where `folders` counts the new commits that touch each folder a system lists of a repo
// it shares with others, so the app can say how far behind a system's description is. It never moves `head`: that is
// tools/scan-mark.ts, after a scan merges and validates.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import { parse, stringify } from 'yaml';

export interface Remote {
  /** The default branch, or null when the repo could not be reached. */
  readonly defaultBranch: string | null;
  /** Tip of every branch asked about, by name. */
  readonly tips: ReadonlyMap<string, string>;
}

export interface MarkLike {
  readonly branch: string;
  readonly head: string;
}

export type Status =
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'never'; readonly branch: string; readonly tip: string }
  | {
      readonly kind: 'current' | 'behind';
      readonly branch: string;
      readonly tip: string;
      /** Commits between head and tip, or null when no clone could count them. */
      readonly behind: number | null;
      /** The mark's branch when it no longer exists on the remote. */
      readonly gone: string | null;
    };

export function statusOf(
  mark: MarkLike | null,
  remote: Remote,
  count: (head: string, tip: string) => number | null,
): Status {
  const fallback = remote.defaultBranch;
  if (fallback === null) return { kind: 'unreachable' };
  const wanted = mark?.branch;
  const branch = wanted !== undefined && remote.tips.has(wanted) ? wanted : fallback;
  const tip = remote.tips.get(branch);
  if (tip === undefined) return { kind: 'unreachable' };
  if (mark === null) return { kind: 'never', branch, tip };
  const gone = branch === mark.branch ? null : mark.branch;
  if (tip === mark.head) return { kind: 'current', branch, tip, behind: 0, gone };
  return { kind: 'behind', branch, tip, behind: count(mark.head, tip), gone };
}

export function lineOf(repo: string, mark: MarkLike | null, status: Status): string {
  if (status.kind === 'unreachable') return `${repo}: could not reach the repo`;
  if (status.kind === 'never') {
    return `${repo}: never scanned (${status.branch} at ${status.tip.slice(0, 7)})`;
  }
  const head = mark === null ? '' : mark.head.slice(0, 7);
  const moved =
    status.gone === null ? '' : `; branch ${status.gone} is gone, read ${status.branch}`;
  if (status.kind === 'current') return `${repo}: up to date at ${head}${moved}`;
  const commits = status.behind === 1 ? 'commit' : 'commits';
  const by = status.behind === null ? 'behind' : `${String(status.behind)} ${commits} behind`;
  return `${repo}: ${by} (${head} → ${status.tip.slice(0, 7)} on ${status.branch})${moved}`;
}

/** The mark with what the check found; `head` and `files` stay as the scan left them. */
export function recorded(
  mark: Record<string, unknown>,
  status: Status,
  {
    at,
    folders = {},
  }: { readonly at: string; readonly folders?: Readonly<Record<string, number>> },
): Record<string, unknown> {
  if (status.kind !== 'current' && status.kind !== 'behind') return mark;
  const checked = {
    at,
    tip: status.tip,
    ...(status.behind === null ? {} : { behind: status.behind }),
    ...(Object.keys(folders).length === 0 ? {} : { folders }),
  };
  return { ...mark, branch: status.branch, checked };
}

// `git ls-remote --symref <url> HEAD refs/heads/<b>…`: `ref: refs/heads/main\tHEAD`, then `<sha>\t<ref>` lines
export function parseLsRemote(raw: string): Remote {
  let defaultBranch: string | null = null;
  const tips = new Map<string, string>();
  for (const line of raw.split('\n')) {
    const symref = /^ref: refs\/heads\/(\S+)\tHEAD$/u.exec(line);
    if (symref?.[1] !== undefined) defaultBranch = symref[1];
    const tip = /^([0-9a-f]{40})\trefs\/heads\/(\S+)$/u.exec(line);
    if (tip?.[1] !== undefined && tip[2] !== undefined) tips.set(tip[2], tip[1]);
  }
  if (defaultBranch !== null && !tips.has(defaultBranch)) {
    const head = /^([0-9a-f]{40})\tHEAD$/mu.exec(raw)?.[1];
    if (head !== undefined) tips.set(defaultBranch, head);
  }
  return { defaultBranch, tips };
}

function run(cmd: string, args: readonly string[]): string | null {
  const out = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.status === 0 ? out.stdout : null;
}

function remoteOf(repo: string, branch: string | undefined): Remote {
  const url = `https://github.com/${repo}.git`;
  const refs = ['HEAD', ...(branch === undefined ? [] : [`refs/heads/${branch}`])];
  const raw = run('git', ['ls-remote', '--symref', url, ...refs]);
  return raw === null ? { defaultBranch: null, tips: new Map() } : parseLsRemote(raw);
}

/** Counts the commits from head to tip, or only those touching one folder, in a clone; null without one. */
function counter(dir: string): (head: string, tip: string, folder?: string) => number | null {
  let fetched = false;
  return (head, tip, folder) => {
    if (!existsSync(path.join(dir, '.git'))) return null;
    if (!fetched) {
      run('git', ['-C', dir, 'fetch', '--quiet', 'origin']);
      fetched = true;
    }
    const only = folder === undefined ? [] : ['--', folder];
    const out = run('git', ['-C', dir, 'rev-list', '--count', `${head}..${tip}`, ...only]);
    return out === null ? null : Number(out.trim());
  };
}

interface Listed {
  readonly repo: string;
  /** The folder of the repo the system holds, or null for the whole repo. */
  readonly path: string | null;
  readonly system: string;
}

// An entry of system.yaml's `repos:` is `org/name`, or `{ repo: org/name, path: folder }` for one folder of it.
function listedOf(entry: unknown): { readonly repo: string; readonly path: string | null } | null {
  if (typeof entry === 'string') return { repo: entry, path: null };
  if (typeof entry !== 'object' || entry === null) return null;
  if (!('repo' in entry) || typeof entry.repo !== 'string') return null;
  const folder = 'path' in entry && typeof entry.path === 'string' ? entry.path : null;
  return { repo: entry.repo, path: folder };
}

function reposOf(workspace: string): readonly Listed[] {
  const domains = path.join(workspace, 'domains');
  if (!existsSync(domains)) return [];
  return readdirSync(domains).flatMap((domain) => {
    const systems = path.join(domains, domain, 'systems');
    if (!existsSync(systems)) return [];
    return readdirSync(systems).flatMap((system) => {
      const file = path.join(systems, system, 'system.yaml');
      if (!existsSync(file)) return [];
      const data: unknown = parse(readFileSync(file, 'utf8'));
      const listed = typeof data === 'object' && data !== null && 'repos' in data;
      const entries: unknown[] = listed && Array.isArray(data.repos) ? data.repos : [];
      return entries.flatMap((entry) => {
        const found = listedOf(entry);
        return found === null ? [] : [{ ...found, system }];
      });
    });
  });
}

// Only a folder that shares its repo with another system needs its own count: the repo's count says the rest.
function touchedOf(
  homes: readonly Listed[],
  {
    mark,
    status,
    count,
  }: {
    readonly mark: MarkLike | null;
    readonly status: Status;
    readonly count: (head: string, tip: string, folder?: string) => number | null;
  },
): Record<string, number> {
  if (mark === null || status.kind !== 'behind') return {};
  return Object.fromEntries(
    homes.flatMap(({ path: folder }) => {
      if (folder === null) return [];
      const touched = count(mark.head, status.tip, folder);
      return touched === null ? [] : [[folder, touched]];
    }),
  );
}

function markAt(file: string): Record<string, unknown> | null {
  if (!existsSync(file)) return null;
  const data: unknown = parse(readFileSync(file, 'utf8'));
  return typeof data === 'object' && data !== null && !Array.isArray(data)
    ? Object.fromEntries(Object.entries(data))
    : null;
}

function main(argv: readonly string[]): void {
  const clonesAt = argv.indexOf('--clones');
  const workspace = argv.find(
    (arg, at) => !arg.startsWith('--') && (clonesAt === -1 || at !== clonesAt + 1),
  );
  if (workspace === undefined) {
    console.error(
      'usage: node tools/scan-status.ts workspaces/<ws> [--record] [--json] [--clones <dir>]',
    );
    process.exit(2);
  }
  const clones =
    clonesAt === -1
      ? path.join(
          process.env.GROUNDWORK_CACHE ?? path.join(homedir(), '.cache', 'groundwork'),
          'clones',
        )
      : (argv[clonesAt + 1] ?? '');
  const at = new Date().toISOString().replace(/\.\d+Z$/u, 'Z');
  const listed = reposOf(workspace);
  const rows = [...new Set(listed.map(({ repo }) => repo))].flatMap((repo) => {
    const file = path.join(workspace, 'scans', `${repo}.yaml`);
    const raw = markAt(file);
    const mark =
      raw !== null && typeof raw.branch === 'string' && typeof raw.head === 'string'
        ? { branch: raw.branch, head: raw.head }
        : null;
    const count = counter(path.join(clones, repo));
    const status = statusOf(mark, remoteOf(repo, mark?.branch), count);
    const homes = listed.filter((each) => each.repo === repo);
    const folders = touchedOf(homes, { mark, status, count });
    if (argv.includes('--record') && raw !== null) {
      writeFileSync(file, stringify(recorded(raw, status, { at, folders }), { lineWidth: 0 }));
    }
    return homes.map(({ path: folder, system }) => {
      const label = folder === null ? repo : `${repo}/${folder}`;
      const touched = folder === null ? undefined : folders[folder];
      const note = touched === undefined ? '' : `; ${String(touched)} touch ${folder ?? ''}`;
      return { repo: label, system, status, line: `${lineOf(label, mark, status)}${note}` };
    });
  });
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        rows.map(({ repo, system, status }) => ({ repo, system, ...status })),
        null,
        2,
      ),
    );
  } else {
    for (const row of rows) console.log(`${row.system.padEnd(20)} ${row.line}`);
  }
}

if (process.argv[1] === import.meta.filename) main(process.argv.slice(2));
