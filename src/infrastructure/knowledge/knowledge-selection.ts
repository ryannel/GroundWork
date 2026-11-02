import 'server-only';

import { checkKnowledge } from '@/domain/knowledge/check-knowledge';
import { versionFormats } from '@/domain/knowledge/knowledge-versions';
import type { KnowledgeBundle, KnowledgeSnapshot } from '@/domain/knowledge/knowledge.generated';

import { knowledgeDigest } from './knowledge-format';

const CURRENT_FORMAT = 'groundwork-knowledge/v3';

interface KnowledgeSelection {
  readonly manifest: KnowledgeSnapshot;
  readonly bundles: readonly KnowledgeBundle[];
}

function selectedFormat(bundles: readonly KnowledgeBundle[]): KnowledgeBundle['format'] {
  if (bundles.some((bundle) => bundle.format === CURRENT_FORMAT)) {
    return CURRENT_FORMAT;
  }
  return bundles.some((bundle) => bundle.format === 'groundwork-knowledge/v2')
    ? 'groundwork-knowledge/v2'
    : 'groundwork-knowledge/v1';
}

/** Check the combined revision set before either publication or source verification. */
export function verifyKnowledgeSelection(input: KnowledgeSelection): void {
  const { id, ...selection } = input.manifest;
  if (knowledgeDigest(selection) !== id) throw new Error('Snapshot digest mismatch');
  const actual = input.bundles.map(knowledgeDigest).toSorted((a, b) => a.localeCompare(b));
  if (
    JSON.stringify(actual) !==
    JSON.stringify(input.manifest.bundles.toSorted((a, b) => a.localeCompare(b)))
  ) {
    throw new Error('Bundle digest mismatch');
  }
  if (
    input.manifest.rules === 'knowledge-query/v1' &&
    input.bundles.some((bundle) => bundle.format !== 'groundwork-knowledge/v1')
  ) {
    throw new Error('V2 bundles require v2 query rules');
  }
  if (input.manifest.format !== versionFormats(input.manifest.rules).snapshot) {
    throw new Error('Snapshot format does not match rules');
  }
  if (
    input.manifest.rules !== 'knowledge-query/v3' &&
    input.bundles.some((bundle) => bundle.format === CURRENT_FORMAT)
  ) {
    throw new Error('V3 bundles require v3 query rules');
  }
  if (new Set(input.bundles.map((bundle) => bundle.workspace)).size !== 1) {
    throw new Error('Snapshot must contain one workspace');
  }
  const problems = checkKnowledge({
    format: selectedFormat(input.bundles),
    workspace: input.bundles[0]?.workspace ?? '',
    records: input.bundles.flatMap((bundle) => bundle.records),
  });
  if (problems.length > 0) throw new Error(problems.join('\n'));
}
