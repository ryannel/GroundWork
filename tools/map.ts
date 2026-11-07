// Ask the system map from a terminal or an agent. Prints JSON, except `md`, which writes MAP.md.
//   npm run map -- find <words>     facts whose id, name or summary hold the words
//   npm run map -- show <id>        the fact, its sources, what it calls and what calls it, and when
//   npm run map -- callers <id>     who reaches it, up to --depth hops (3)
//   npm run map -- calls <id>       the call tree under an endpoint, message or handler, --depth hops (8)
//   npm run map -- owns <path>      the facts read from a file (--repo org/name to narrow)
//   npm run map -- repos            the commit each repo was last read at; never-scanned repos say so
//   npm run map -- md               write <workspace>/MAP.md
// Options: --workspace <id> (required when several are registered); --checkouts <dir> adds a local path to every
// source whose repo is checked out as <dir>/<name>.
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import type { Cited } from '@/application/system-map';
import { localId } from '@/domain/ids';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { selectedWorkspace, workspaceFolder } from '@/infrastructure/workspace-folders';

import { modelMapOf } from './model-map';
import { modelMapQueries } from './model-map-query';

type CanonicalMap = ReturnType<typeof modelMapOf> &
  ReturnType<typeof modelMapQueries> & { readonly workspace: string };

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    workspace: { type: 'string' },
    checkouts: { type: 'string' },
    repo: { type: 'string' },
    depth: { type: 'string' },
  },
});

async function loaded(): Promise<CanonicalMap> {
  const selected = await selectedWorkspace(values.workspace);
  console.error(`Workspace: ${selected.name} (${selected.id}) at ${selected.folder}`);
  process.env.GROUNDWORK_WORKSPACES = selected.folder;
  const canonical = await readCanonicalModelIndex(selected.id);
  if (canonical === null) {
    throw new Error(
      `A consolidated model is not available for ${selected.id} at ${selected.folder}.`,
    );
  }
  return { ...modelMapOf(canonical), ...modelMapQueries(canonical), workspace: selected.id };
}

// Where a cited file sits on this machine, when its repo is checked out under --checkouts.
function local(source: Cited): Cited & { readonly local?: string } {
  if (values.checkouts === undefined) return source;
  const name = source.repo.split('/').at(-1) ?? source.repo;
  const file = path.join(values.checkouts, name, source.path);
  return existsSync(file) ? { ...source, local: file } : source;
}

function isCited(value: unknown): value is Cited {
  if (typeof value !== 'object' || value === null) return false;
  if (!('repo' in value) || !('path' in value)) return false;
  return typeof value.repo === 'string' && typeof value.path === 'string';
}

function withLocal(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withLocal);
  if (typeof value !== 'object' || value === null) return value;
  const pairs: readonly (readonly [string, unknown])[] = Object.entries(value);
  const entries = pairs.map(([key, inner]): [string, unknown] =>
    key === 'sources' && Array.isArray(inner)
      ? [key, inner.map((source) => (isCited(source) ? local(source) : source))]
      : [key, withLocal(inner)],
  );
  return Object.fromEntries(entries);
}

function depthOr(fallback: number): number {
  const depth = Number(values.depth ?? fallback);
  return Number.isInteger(depth) && depth > 0 ? depth : fallback;
}

async function canonicalAnswer(map: CanonicalMap, command: string, arg: string): Promise<unknown> {
  switch (command) {
    case 'find': {
      return map.find(arg);
    }
    case 'show': {
      return map.show(arg) ?? { error: `no fact ${arg}; try: find ${localId(arg)}` };
    }
    case 'callers': {
      return map.callers(arg, depthOr(3));
    }
    case 'calls': {
      return map.calls(arg, depthOr(8));
    }
    case 'owns': {
      return map.owns(arg, values.repo);
    }
    case 'repos': {
      return map.repos();
    }
    case 'md': {
      const folder = await workspaceFolder(map.workspace);
      if (folder === null) throw new Error(`no workspace ${map.workspace}`);
      const file = path.join(folder, 'MAP.md');
      await writeFile(file, map.markdown());
      return { wrote: path.relative(process.cwd(), file) };
    }
    default: {
      return { error: `unknown command ${command}; see the head of tools/map.ts` };
    }
  }
}

const [command = 'repos', ...rest] = positionals;
const map = await loaded();
const arg = rest.join(' ');
const result = await canonicalAnswer(map, command, arg);
process.stdout.write(`${JSON.stringify(withLocal(result), null, 2)}\n`);
