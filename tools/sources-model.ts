// This process loads the canonical reader with the same conditions as the other model commands.
import { spawnSync } from 'node:child_process';

import { indexOf, type ModelIndex } from '@/application/model-index';
import type { CodeLocation } from '@/domain/code-links';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import type { ModelCite, ModelGap } from '@/domain/workspace-model';
import { readModelFolder } from '@/infrastructure/read-model';

interface SourceFact {
  readonly id: string;
  readonly cites: readonly ModelCite[];
  readonly sources: readonly CodeLocation[];
  readonly gaps: readonly ModelGap[];
}

function sourceFacts(index: ModelIndex): readonly SourceFact[] {
  const resolve = codeCitationResolver(index.model.evidence);
  const gapsById = new Map<string, ModelGap[]>();
  for (const gap of index.gaps()) {
    if (gap.kind !== 'no_cites' && gap.kind !== 'unresolved_cite') continue;
    const existing = gapsById.get(gap.id) ?? [];
    existing.push(gap);
    gapsById.set(gap.id, existing);
  }
  return index.entities
    .filter(({ kind }) => kind !== 'evidence')
    .map(({ id }) => {
      const cites = index.cites(id);
      const sources = resolve(cites).map(({ kind: _kind, ...source }) => source);
      const gaps = gapsById.get(id) ?? [];
      if (sources.length === 0 && gaps.length === 0) {
        gaps.push({
          id,
          kind: 'no_code_source',
          message:
            cites.length === 0
              ? 'No source citation is recorded.'
              : 'The recorded citations have no resolved code location.',
        });
      }
      return { id, cites, sources, gaps };
    });
}

function fileLength(source: CodeLocation): number | undefined {
  const run = spawnSync(
    'gh',
    [
      'api',
      '-H',
      'Accept: application/vnd.github.raw',
      `repos/${source.repo}/contents/${source.path}?ref=${source.commit}`,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return run.status === 0 ? run.stdout.split('\n').length : undefined;
}

function unreachable(facts: readonly SourceFact[]): string[] {
  const lengths = new Map<string, number | undefined>();
  const out: string[] = [];
  for (const fact of facts) {
    for (const source of fact.sources) {
      const key = `${source.repo}@${source.commit}:${source.path}`;
      if (!lengths.has(key)) lengths.set(key, fileLength(source));
      const length = lengths.get(key);
      if (length === undefined) out.push(`${fact.id}: ${key} cannot be read`);
      else if (source.lines !== undefined && source.lines[1] > length) {
        out.push(`${fact.id}: ${key} has ${String(length)} lines, not ${String(source.lines[1])}`);
      }
    }
  }
  return out;
}

function printGaps(gaps: readonly ModelGap[]): void {
  for (const gap of gaps) {
    console.log([gap.id, gap.at, gap.reference, gap.message].filter(Boolean).join('\t'));
  }
}

async function main(args: readonly string[]): Promise<void> {
  const [folder, id, ...flags] = args;
  if (folder === undefined || id === undefined) {
    throw new Error('Expected a workspace folder and id');
  }
  const index = indexOf(await readModelFolder(folder, id));
  const facts = sourceFacts(index);
  if (flags.includes('--index')) {
    const repo = flags[flags.indexOf('--repo') + 1];
    const picked = flags.includes('--repo')
      ? facts.filter((fact) => fact.sources.some((source) => source.repo === repo))
      : facts;
    console.log(JSON.stringify(picked, null, 2));
    return;
  }

  const gaps = facts.flatMap((fact) => fact.gaps);
  const unresolved = gaps.filter((gap) => gap.kind !== 'no_code_source');
  if (flags.includes('--missing')) {
    printGaps(gaps);
  } else {
    const pinned = facts.filter((fact) => fact.sources.length > 0).length;
    console.log(folder);
    console.log(
      `  ${String(pinned)} of ${String(facts.length)} model records cite code; ${String(gaps.length)} source gaps`,
    );
    printGaps(unresolved);
  }
  const missing = flags.includes('--check') ? unreachable(facts) : [];
  for (const line of missing) console.log(`  missing ${line}`);
  if (missing.length > 0 || (!flags.includes('--missing') && unresolved.length > 0)) {
    process.exitCode = 1;
  }
}

await main(process.argv.slice(2));
