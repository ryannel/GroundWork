import { evidenceAnchorProblems } from './check-evidence-anchor';
import type { KnowledgeBundle } from './knowledge.generated';

export function runtimeBundleProblems(bundle: KnowledgeBundle): string[] {
  if (bundle.format !== 'groundwork-knowledge/v3') return [];
  const errors: string[] = [];
  const pairs = new Set<string>();
  for (const record of bundle.records) {
    if (record.kind === 'evidence') errors.push(...evidenceAnchorProblems(record));
    if (record.kind === 'execution_binding') {
      const pair = `${record.implementation}@${record.component}`;
      if (pairs.has(pair)) {
        errors.push(`${record.id}: duplicate implementation binding in the same runtime component`);
      }
      pairs.add(pair);
    }
  }
  return errors;
}
