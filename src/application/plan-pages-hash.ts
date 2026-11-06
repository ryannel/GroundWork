import { idToToken, tokenToId } from '@/domain/ids';

export { idToToken, tokenToId } from '@/domain/ids';

const MARK = '#i-';

/** The id the address says is open, or null. */
export function inspectedIn(hash: string): string | null {
  return hash.startsWith(MARK) ? tokenToId(decodeURIComponent(hash.slice(MARK.length))) : null;
}

export function hashFor(id: string): string {
  return `${MARK}${idToToken(id)}`;
}
