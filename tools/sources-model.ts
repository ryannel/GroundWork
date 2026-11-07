// This process loads the canonical reader with the same conditions as the other model commands.
import { indexOf, type ModelIndex } from '@/application/model-index';
import { codeCitationResolver } from '@/domain/model-cite-resolution';
import type { ModelCite, ModelGap } from '@/domain/workspace-model';
import { readModelFolder } from '@/infrastructure/read-model';

import { unreachable, type Located } from './sources';

interface SourceFact {
  readonly id: string;
  readonly cites: readonly ModelCite[];
  readonly sources: readonly Located[];
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
