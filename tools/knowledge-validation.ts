import { readFile, writeFile } from 'node:fs/promises';

import type { KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators, snapshotFor } from '@/infrastructure/knowledge/knowledge-format';
import { verifyKnowledgeSelection } from '@/infrastructure/knowledge/knowledge-selection';

import { sourceChecker } from './knowledge-source-check';
import type { ValidationOptions } from './knowledge-validation-args';

async function jsonFile(file: string): Promise<unknown> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  return value;
}

function verifySources(records: readonly KnowledgeRecord[], root: string | undefined): number {
  if (root === undefined) return 0;
  const evidence = records.filter((record) => record.kind === 'evidence');
  const problems = evidence.flatMap(sourceChecker(root));
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return evidence.length;
}

export async function validateKnowledgeFiles(options: ValidationOptions): Promise<{
  readonly snapshot: string;
  readonly bundles: number;
  readonly records: number;
  readonly sourceRangesChecked: number;
  readonly sourceVerification: string;
}> {
  const parse = await knowledgeValidators();
  const bundles = await Promise.all(
    options.files.map(async (file) => parse.bundle(await jsonFile(file))),
  );
  if (bundles.some((bundle) => bundle.format !== 'groundwork-knowledge/v3')) {
    throw new Error(
      'Canonical scan validation requires v3 bundles; replay legacy proofs with their original tools',
    );
  }
  const manifest =
    options.snapshot === undefined
      ? snapshotFor(bundles, 'knowledge-query/v3')
      : parse.snapshot(await jsonFile(options.snapshot));
  if (manifest.rules !== 'knowledge-query/v3') {
    throw new Error('Canonical scans require v3 query rules');
  }
  verifyKnowledgeSelection({ manifest, bundles });
  const records = bundles.flatMap((bundle) => bundle.records);
  const sourceRangesChecked = verifySources(records, options.sources);
  if (options.writeSnapshot !== undefined) {
    await writeFile(options.writeSnapshot, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
    });
  }
  return {
    snapshot: manifest.id,
    bundles: bundles.length,
    records: records.length,
    sourceRangesChecked,
    sourceVerification: options.sources === undefined ? 'not_requested' : 'pinned_local_files',
  };
}
