import { ID_PREFIXES } from '@/domain/plan/plan-ids';

// The open inspector lives in the address as `#i-<token>`: `svc:orders` is `#i-svc-orders`, and a child such
// as `flow:cancel#publish` is `#i-flow-cancel.publish`. A copied address reopens the same thing.

const MARK = '#i-';

const clean = (text: string): string => text.replaceAll(/[^\w.~-]/gu, '');

export function idToToken(id: string): string {
  return clean(id.replace(':', '-').replace('#', '.'));
}

/** The id a token names, or null when it does not start with a known prefix. */
export function tokenToId(token: string): string | null {
  const dash = token.indexOf('-');
  const prefix = token.slice(0, dash);
  if (dash < 1 || dash === token.length - 1 || !Object.hasOwn(ID_PREFIXES, prefix)) return null;
  const rest = token.slice(dash + 1);
  const dot = rest.indexOf('.');
  return dot > 0 ? `${prefix}:${rest.slice(0, dot)}#${rest.slice(dot + 1)}` : `${prefix}:${rest}`;
}

/** The id the address says is open, or null. */
export function inspectedIn(hash: string): string | null {
  return hash.startsWith(MARK) ? tokenToId(decodeURIComponent(hash.slice(MARK.length))) : null;
}

export function hashFor(id: string): string {
  return `${MARK}${idToToken(id)}`;
}
