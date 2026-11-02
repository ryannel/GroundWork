import type { VisualContext } from './visual-types';

/** Corpus publications resolve cross-shard source identities, then verify every target at publication. */
export function visualFile(context: VisualContext, id: string): string | null {
  return context.files.get(id) ?? context.fileFor?.(id) ?? null;
}
