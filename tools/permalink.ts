// Turns file and line references in a local checkout into Groundwork sources, which pin a fact to the code at one
// commit: { repo, path, lines, commit, symbol? }. The url is derived from them, never stored alone.
//   node tools/permalink.ts <repo-dir> <path>[:<from>[-<to>]][@<symbol>] ...   `sources: [...]` to paste into YAML
//   node tools/permalink.ts <repo-dir> --url <ref> ...                          one commit permalink per line
//   node tools/permalink.ts <repo-dir> --grep '<regex>' [<pathspec>]           a source per matching line (first 50)
// Reads `git remote get-url origin` and HEAD of <repo-dir>, so it works offline and for private repos.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { stringify } from 'yaml';

export interface Ref {
  path: string;
  lines?: readonly [number, number];
  symbol?: string;
}

export interface Source extends Ref {
  repo: string;
  commit: string;
}

const LINES = /:(\d+)(?:-(\d+))?$/;

// `org/name` for github.com, as system.yaml lists repos; `host/org/name` for any other host
export function repoOf(remote: string): string | undefined {
  const trimmed = remote.trim().replace(/\.git$/, '');
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(trimmed);
  let host = scp?.[1];
  let name = scp?.[2];
  if (scp === null) {
    if (!URL.canParse(trimmed)) return undefined;
    const url = new URL(trimmed);
    host = url.hostname;
    name = url.pathname.replace(/^\/+/, '');
  }
  if (host === undefined || name?.includes('/') !== true) return undefined;
  return host === 'github.com' ? name : `${host}/${name}`;
}

export function parseRef(text: string): Ref {
  const at = text.lastIndexOf('@');
  const tail = text.slice(at + 1);
  const hasSymbol = at > 0 && tail !== '' && !tail.includes('/');
  const rest = hasSymbol ? text.slice(0, at) : text;
  const match = LINES.exec(rest);
  const ref: Ref = { path: match === null ? rest : rest.slice(0, match.index) };
  if (match?.[1] !== undefined) {
    const from = Number(match[1]);
    ref.lines = [from, match[2] === undefined ? from : Number(match[2])];
  }
  if (hasSymbol) ref.symbol = tail;
  return ref;
}

export function permalinkOf(source: Source): string {
  const host = source.repo.split('/').length > 2 ? source.repo : `github.com/${source.repo}`;
  const lines =
    source.lines === undefined ? '' : `#L${String(source.lines[0])}-L${String(source.lines[1])}`;
  return `https://${host}/blob/${source.commit}/${source.path}${lines}`;
}

export function sourcesYaml(sources: readonly Source[]): string {
  return `sources: ${stringify(sources, { collectionStyle: 'flow', flowCollectionPadding: false, lineWidth: 0 }).trim()}`;
}

function git(dir: string, args: readonly string[]): { ok: boolean; out: string } {
  const run = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return { ok: run.status === 0, out: run.stdout.trim() };
}

interface Checkout {
  dir: string;
  root: string;
  repo: string;
  commit: string;
}

function checkoutOf(dir: string): Checkout {
  const root = git(dir, ['rev-parse', '--show-toplevel']);
  const origin = git(dir, ['remote', 'get-url', 'origin']);
  const repo = repoOf(origin.out);
  if (!root.ok || repo === undefined) {
    console.error(`${dir} is not a clone with an origin remote`);
    process.exit(2);
  }
  return { dir, root: root.out, repo, commit: git(dir, ['rev-parse', 'HEAD']).out };
}

// a reference must name a file at HEAD and lines inside it, and a local edit would make the permalink lie;
// a reference without lines cites the whole file, since every source carries lines
function checked(checkout: Checkout, source: Source): { source: Source; problem?: string } {
  const blob = git(checkout.root, ['show', `HEAD:${source.path}`]);
  if (!blob.ok) return { source, problem: `${source.path} is not in ${checkout.repo} at HEAD` };
  const length = blob.out.split('\n').length;
  const lines = source.lines ?? [1, length];
  const full: Source = { repo: source.repo, path: source.path, lines, commit: source.commit };
  if (source.symbol !== undefined) full.symbol = source.symbol;
  if (lines[0] > lines[1] || lines[1] > length) {
    const range = `${String(lines[0])}-${String(lines[1])}`;
    return { source: full, problem: `${source.path} has ${String(length)} lines; check ${range}` };
  }
  if (git(checkout.root, ['status', '--porcelain', '--', source.path]).out !== '') {
    const problem = `${source.path} has local changes; commit or stash them so the lines match ${checkout.commit.slice(0, 7)}`;
    return { source: full, problem };
  }
  return { source: full };
}

function sourceOf(checkout: Checkout, ref: Ref): Source {
  const relative = path.relative(checkout.root, path.resolve(checkout.dir, ref.path));
  return {
    repo: checkout.repo,
    path: relative.split(path.sep).join('/'),
    ...(ref.lines === undefined ? {} : { lines: ref.lines }),
    commit: checkout.commit,
    ...(ref.symbol === undefined ? {} : { symbol: ref.symbol }),
  };
}

function grep(checkout: Checkout, pattern: string, pathspec: string): Source[] {
  const found = git(checkout.root, ['grep', '-nE', pattern, '--', pathspec]).out;
  return found
    .split('\n')
    .filter((line) => line !== '')
    .slice(0, 50)
    .map((line) => {
      const [file = '', number = '0'] = line.split(':');
      return {
        repo: checkout.repo,
        path: file,
        lines: [Number(number), Number(number)],
        commit: checkout.commit,
      };
    });
}

function main(argv: readonly string[]): void {
  const [dir, ...rest] = argv;
  if (dir === undefined || rest.length === 0) {
    console.error(
      'usage: node tools/permalink.ts <repo-dir> [--url] <path>[:from[-to]][@symbol] ... | --grep <regex> [pathspec]',
    );
    process.exit(2);
  }
  const checkout = checkoutOf(dir);
  const urls = rest.includes('--url');
  const args = rest.filter((arg) => arg !== '--url');
  const found =
    args[0] === '--grep'
      ? grep(checkout, args[1] ?? '.', args[2] ?? '.')
      : args.map((arg) => sourceOf(checkout, parseRef(arg)));
  const results = found.map((source) => checked(checkout, source));
  const sources = results.map((result) => result.source);
  for (const { problem } of results)
    if (problem !== undefined) console.error(`warning: ${problem}`);
  console.log(
    urls ? sources.map((source) => permalinkOf(source)).join('\n') : sourcesYaml(sources),
  );
}

if (process.argv[1] === import.meta.filename) main(process.argv.slice(2));
