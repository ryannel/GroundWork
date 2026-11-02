import type { KnowledgeRecord, QueryResponse } from '@/domain/knowledge/knowledge.generated';

export interface RuntimeProofView {
  readonly name: 'capture' | 'soft-offer';
  readonly interactions: QueryResponse;
  readonly trace: QueryResponse;
}
export function viewRecords(view: RuntimeProofView): ReadonlyMap<string, KnowledgeRecord> {
  return new Map(
    [...view.interactions.records, ...view.trace.records].map((record) => [record.id, record]),
  );
}
export function html(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
export function anchor(id: string): string {
  return id.replaceAll(/[^a-zA-Z0-9-]/gu, '-');
}
