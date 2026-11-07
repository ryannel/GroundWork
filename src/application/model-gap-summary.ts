import type { ModelGap } from '@/domain/workspace-model';

export interface ModelGapSummary extends Pick<ModelGap, 'kind' | 'message'> {
  readonly count: number;
}

/** Summarise display messages while full references remain in the canonical index. */
export function modelGapSummary(gaps: readonly ModelGap[]): readonly ModelGapSummary[] {
  const messages = new Map<string, ModelGapSummary>();
  for (const { kind, message } of gaps) {
    const key = JSON.stringify([kind, message]);
    const count = (messages.get(key)?.count ?? 0) + 1;
    messages.set(key, { kind, message, count });
  }
  return [...messages.values()];
}
