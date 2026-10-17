// What changed in a repo since Groundwork last read it, as a work list for groundwork-explore.
//   node tools/scan-diff.ts workspaces/<ws> <org/name> <repo-dir> [--to <ref>] [--json]
// Reads the high-water mark in workspaces/<ws>/scans/<org/name>.yaml (written by tools/scan-mark.ts), diffs its head
// against <ref> (default HEAD) in the clone, and matches the changed paths against the sources of every fact.
// Exit 0 with a work list; 2 when there is no mark yet (run a full scan instead).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

export interface Change {
  readonly status: string;
  readonly path: string;
  readonly from?: string;
}

export interface IndexedFact {
  readonly id: string;
  readonly paths: readonly string[];
}

export interface WorkList {
  readonly reexplore: readonly { readonly id: string; readonly paths: readonly string[] }[];
  readonly explore: readonly { readonly path: string; readonly why: string }[];
  readonly vanished: readonly { readonly id: string; readonly paths: readonly string[] }[];
  readonly renamed: readonly {
    readonly from: string;
    readonly to: string;
    readonly changed: boolean;
    readonly facts: readonly string[];
  }[];
  readonly unchanged: number;
}

const NOISE =
  /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.yaml|go\.sum|Cargo\.lock|poetry\.lock)$|\.(?:png|jpe?g|gif|svg|ico|webp|pdf)$/u;

// `git diff --name-status -z -M` output: status NUL path NUL, or R<score> NUL from NUL to NUL
export function parseNameStatus(raw: string): Change[] {
  const parts = raw.split('\0').filter((part) => part !== '');
  const changes: Change[] = [];
  for (let at = 0; at < parts.length;) {
    const status = parts[at] ?? '';
    const moved = status.startsWith('R') || status.startsWith('C');
    const first = parts[at + 1] ?? '';
    changes.push(
      moved ? { status, from: first, path: parts[at + 2] ?? '' } : { status, path: first },
    );
    at += moved ? 3 : 2;
  }
  return changes;
}

// blob shas then and now, for a mark whose head is no longer in history (force-push, shallow clone)
export function changesBetween(
  then: ReadonlyMap<string, string>,
  now: ReadonlyMap<string, string>,
): Change[] {
  const changes: Change[] = [];
  for (const [file, sha] of now) {
    const before = then.get(file);
    if (before === undefined) changes.push({ status: 'A', path: file });
    else if (before !== sha) changes.push({ status: 'M', path: file });
  }
  for (const file of then.keys()) if (!now.has(file)) changes.push({ status: 'D', path: file });
  return changes;
}

function factsByPath(facts: readonly IndexedFact[]): Map<string, string[]> {
  const byPath = new Map<string, string[]>();
  for (const fact of facts) {
    for (const file of fact.paths) byPath.set(file, [...(byPath.get(file) ?? []), fact.id]);
  }
  return byPath;
}

function unexplored(change: Change): { readonly path: string; readonly why: string } | undefined {
  if (NOISE.test(change.path)) return undefined;
  return {
    path: change.path,
    why: change.status === 'A' ? 'added' : 'changed, no facts cite it yet',
  };
}

function readChanges(
  changes: readonly Change[],
  byPath: ReadonlyMap<string, readonly string[]>,
): Pick<WorkList, 'explore' | 'renamed'> & { readonly touched: ReadonlySet<string> } {
  const touched = new Set<string>();
  const explore: { readonly path: string; readonly why: string }[] = [];
  const renamed: WorkList['renamed'][number][] = [];
  for (const change of changes) {
    const ids = byPath.get(change.from ?? change.path) ?? [];
    const changed = change.status !== 'R100';
    if (change.from !== undefined) {
      renamed.push({ from: change.from, to: change.path, changed, facts: ids });
    }
    if (change.status === 'D' || !changed) continue;
    for (const id of ids) touched.add(id);
    const file = ids.length === 0 ? unexplored(change) : undefined;
    if (file !== undefined) explore.push(file);
  }
  return { touched, explore, renamed };
}

export function workList(changes: readonly Change[], facts: readonly IndexedFact[]): WorkList {
  const deleted = new Set(
    changes.filter((change) => change.status === 'D').map((change) => change.path),
  );
  const { touched, explore, renamed } = readChanges(changes, factsByPath(facts));
  const goneOf = (fact: IndexedFact): readonly string[] =>
    fact.paths.filter((file) => deleted.has(file));
  const vanished = facts.flatMap((fact) => {
    const gone = goneOf(fact);
    return gone.length > 0 && gone.length === fact.paths.length
      ? [{ id: fact.id, paths: gone }]
      : [];
  });
  const reexplore = facts.flatMap((fact) => {
    const gone = goneOf(fact);
    const all = gone.length > 0 && gone.length === fact.paths.length;
    return !all && (gone.length > 0 || touched.has(fact.id))
      ? [{ id: fact.id, paths: fact.paths }]
      : [];
  });
  const unchanged = facts.length - vanished.length - reexplore.length;
  return { reexplore, explore, vanished, renamed, unchanged };
}

function git(dir: string, args: readonly string[]): { readonly ok: boolean; readonly out: string } {
  const run = spawnSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return { ok: run.status === 0, out: run.stdout };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

export function indexedFacts(json: unknown, repo: string): IndexedFact[] {
  if (!Array.isArray(json)) return [];
  return json.filter(isRecord).map((fact) => {
    const sources = Array.isArray(fact.sources) ? fact.sources.filter(isRecord) : [];
    const paths = stringsOf(
      sources.filter((source) => source.repo === repo).map((source) => source.path),
    );
    return { id: typeof fact.id === 'string' ? fact.id : '', paths: [...new Set(paths)] };
  });
}

function blobsAt(dir: string, ref: string): Map<string, string> {
  const listing = git(dir, ['ls-tree', '-r', '-z', ref]).out.split('\0');
  const blobs = new Map<string, string>();
  for (const line of listing) {
    const [meta = '', file = ''] = line.split('\t');
    const sha = meta.split(' ')[2];
    if (file !== '' && sha !== undefined) blobs.set(file, sha);
  }
  return blobs;
}

function markOf(workspace: string, repo: string): Record<string, unknown> {
  const file = path.join(workspace, 'scans', `${repo}.yaml`);
  const mark: unknown = existsSync(file)
    ? parse(readFileSync(file, 'utf8'), { schema: 'failsafe' })
    : undefined;
  if (!isRecord(mark) || typeof mark.head !== 'string') {
    console.error(`${repo} has no scan mark at ${file}; run a full groundwork-scan of it first`);
    process.exit(2);
  }
  return mark;
}

function changesSince(
  dir: string,
  mark: Record<string, unknown>,
  to: string,
): { readonly changes: readonly Change[]; readonly rewritten: boolean } {
  const head = String(mark.head);
  if (git(dir, ['cat-file', '-e', `${head}^{commit}`]).ok) {
    return {
      changes: parseNameStatus(git(dir, ['diff', '--name-status', '-z', '-M', head, to]).out),
      rewritten: false,
    };
  }
  const then = new Map(
    Object.entries(isRecord(mark.files) ? mark.files : {}).map(([k, v]) => [k, String(v)]),
  );
  return { changes: changesBetween(then, blobsAt(dir, to)), rewritten: true };
}

function main(argv: readonly string[]): void {
  const [workspace, repo, dir] = argv.filter(
    (arg, at) => !arg.startsWith('--') && argv[at - 1] !== '--to',
  );
  if (workspace === undefined || repo === undefined || dir === undefined) {
    console.error(
      'usage: node tools/scan-diff.ts workspaces/<ws> <org/name> <repo-dir> [--to <ref>] [--json]',
    );
    process.exit(2);
  }
  const mark = markOf(workspace, repo);
  const to = git(dir, [
    'rev-parse',
    argv.includes('--to') ? (argv[argv.indexOf('--to') + 1] ?? 'HEAD') : 'HEAD',
  ]).out.trim();
  if (to === mark.head) {
    console.log(`${repo} is up to date at ${to.slice(0, 7)}`);
    return;
  }
  const index = spawnSync(
    process.execPath,
    [path.join(import.meta.dirname, 'sources.ts'), workspace, '--index', '--repo', repo],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  const { changes, rewritten } = changesSince(dir, mark, to);
  const commits = rewritten
    ? undefined
    : Number(git(dir, ['rev-list', '--count', `${String(mark.head)}..${to}`]).out);
  const work = {
    repo,
    from: mark.head,
    to,
    commits,
    rewritten,
    ...workList(changes, indexedFacts(JSON.parse(index.stdout), repo)),
  };
  console.log(argv.includes('--json') ? JSON.stringify(work, null, 2) : summary(work));
}

function summary(
  work: WorkList & {
    readonly repo: string;
    readonly to: string;
    readonly commits: number | undefined;
  },
): string {
  const count = String(work.commits);
  const plural = work.commits === 1 ? '' : 's';
  const since = work.commits === undefined ? 'history rewritten' : `${count} commit${plural}`;
  const lines = [`${work.repo} → ${work.to.slice(0, 7)} (${since})`];
  for (const fact of work.reexplore) {
    lines.push(`  re-explore ${fact.id}  ${fact.paths.join(', ')}`);
  }
  for (const file of work.explore) lines.push(`  explore    ${file.path}  (${file.why})`);
  for (const fact of work.vanished) lines.push(`  vanished   ${fact.id}  ${fact.paths.join(', ')}`);
  for (const move of work.renamed) {
    lines.push(`  renamed    ${move.from} → ${move.to}  ${move.facts.join(', ')}`.trimEnd());
  }
  lines.push(`  ${String(work.unchanged)} facts unchanged`);
  return lines.join('\n');
}

if (process.argv[1] === import.meta.filename) main(process.argv.slice(2));
