import { checkedPackPage } from '@/domain/explorer-publication-check';
import type { ExplorerArtifact } from '@/domain/service-explorer';

const cache = new Map<string>();

export async function loadPackPage(
  input: {
    readonly base: string;
    readonly file: string;
    readonly pack: NonNullable<ExplorerArtifact['pack']>;
    readonly signal: AbortSignal;
  },
  read: (artifact: ExplorerArtifact) => Promise<string>,
): Promise<string> {
  const key = `${input.base}${input.pack.file}:${input.pack.sha256}`;
  let parsed = cache.get(key);
  if (parsed === undefined) {
    const raw = await read(input.pack);
    parsed = JSON.parse(raw);
    if (cache.size >= 8) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    cache.set(key, parsed);
  }
  if (input.signal.aborted) throw new DOMException('Selection cancelled', 'AbortError');
  return checkedPackPage(parsed, input.file);
}
