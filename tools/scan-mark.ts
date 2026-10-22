// Moves a repo's high-water mark once its scan has merged and validated, so the next scan can start from here.
//   node tools/scan-mark.ts workspaces/<ws> <org/name> <repo-dir> [--branch <name>] [--scanner <name@v>] [--force]
// Writes workspaces/<ws>/scans/<org/name>.yaml: the commit the system model now reflects, and the blob sha of every
// file a fact cites, which lets tools/scan-diff.ts work even after history is rewritten. Refuses when a fact cites a
// file whose content at its cited commit differs from HEAD (the fact was read from older code) unless --force.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { stringify } from 'yaml';

export interface Cited {
  readonly id: string;
  readonly path: string;
  readonly commit: string;
}

export interface Mark {
  readonly repo: string;
  readonly branch: string;
  readonly head: string;
  readonly scanned_at: string;
  readonly scanner: string;
  readonly files: Record<string, string>;
  readonly facts: number;
}

function git(dir: string, args: readonly string[], input?: string): string {
  const run = spawnSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 256 * 1024 * 1024,
  });
  return run.status === 0 ? run.stdout : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function citedIn(json: unknown, repo: string): Cited[] {
  if (!Array.isArray(json)) return [];
  return json.filter(isRecord).flatMap((fact) =>
    (Array.isArray(fact.sources) ? fact.sources.filter(isRecord) : [])
      .filter((source) => source.repo === repo)
      .map((source) => ({
        id: String(fact.id),
        path: String(source.path),
        commit: String(source.commit),
      })),
  );
}

// `<rev>:<path>` → blob sha, or undefined when the path does not exist there; one git call for the lot
function blobs(dir: string, specs: readonly string[]): Map<string, string | undefined> {
  const out = git(
    dir,
    ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
    `${specs.join('\n')}\n`,
  ).split('\n');
  return new Map(
    specs.map((spec, at) => {
      const [sha, type] = (out[at] ?? '').split(' ');
      return [spec, type === 'blob' ? sha : undefined];
    }),
  );
}

export function staleCitations(
  cited: readonly Cited[],
  blob: (spec: string) => string | undefined,
): string[] {
  return cited
    .filter((source) => {
      const now = blob(`HEAD:${source.path}`);
      return now === undefined || blob(`${source.commit}:${source.path}`) !== now;
    })
    .map((source) => `${source.id}: ${source.path}@${source.commit.slice(0, 7)} differs from HEAD`);
}

function option(argv: readonly string[], name: string): string | undefined {
  return argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined;
}

function cite(workspace: string, repo: string): Cited[] {
  const index = spawnSync(
    process.execPath,
    [path.join(import.meta.dirname, 'sources.ts'), workspace, '--index', '--repo', repo],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  if (index.status !== 0) {
    console.error(index.stderr);
    process.exit(1);
  }
  return citedIn(JSON.parse(index.stdout), repo);
}

function filesOf(
  cited: readonly Cited[],
  shas: ReadonlyMap<string, string | undefined>,
): Record<string, string> {
  const files: Record<string, string> = {};
  for (const file of new Set(
    cited.map((source) => source.path).toSorted((a, b) => a.localeCompare(b)),
  )) {
    const sha = shas.get(`HEAD:${file}`);
    if (sha !== undefined) files[file] = sha;
  }
  return files;
}

// The branch the clone follows: the checked-out one, or the remote's default when HEAD is detached (as the scan
// leaves it after `checkout --detach origin/<branch>`).
function branchOf(dir: string): string {
  const current = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (current !== '' && current !== 'HEAD') return current;
  const remote = git(dir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).trim();
  const branch = remote.replace(/^origin\//u, '');
  return branch === '' ? 'HEAD' : branch;
}

function main(argv: readonly string[]): void {
  const valued = new Set(['--branch', '--scanner']);
  const [workspace, repo, dir] = argv.filter(
    (arg, at) => !arg.startsWith('--') && !valued.has(argv[at - 1] ?? ''),
  );
  if (workspace === undefined || repo === undefined || dir === undefined) {
    console.error(
      'usage: node tools/scan-mark.ts workspaces/<ws> <org/name> <repo-dir> [--branch b] [--scanner s] [--force]',
    );
    process.exit(2);
  }
  const cited = cite(workspace, repo);
  const specs = [
    ...new Set(
      cited.flatMap((source) => [`HEAD:${source.path}`, `${source.commit}:${source.path}`]),
    ),
  ];
  const shas = blobs(dir, specs);
  const stale = staleCitations(cited, (spec) => shas.get(spec));
  for (const line of stale) console.error(`stale ${line}`);
  if (stale.length > 0 && !argv.includes('--force')) {
    console.error(
      `${String(stale.length)} fact(s) were read from older code; re-explore them or pass --force`,
    );
    process.exit(1);
  }
  const files = filesOf(cited, shas);
  const mark: Mark = {
    repo,
    branch: option(argv, '--branch') ?? branchOf(dir),
    head: git(dir, ['rev-parse', 'HEAD']).trim(),
    scanned_at: new Date().toISOString().replace(/\.\d+Z$/u, 'Z'),
    scanner: option(argv, '--scanner') ?? 'groundwork-explore@1',
    files,
    facts: new Set(cited.map((source) => source.id)).size,
  };
  const file = path.join(workspace, 'scans', `${repo}.yaml`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, stringify(mark, { lineWidth: 0 }));
  console.log(
    `${repo} marked at ${mark.head.slice(0, 7)}: ${String(mark.facts)} facts from ${String(Object.keys(files).length)} files`,
  );
}

if (process.argv[1] === import.meta.filename) main(process.argv.slice(2));
