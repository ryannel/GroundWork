import { idToToken } from '@/domain/ids';

export interface EntryFlowAddress {
  readonly entry?: string;
  readonly plan?: string;
  readonly version?: 'before' | 'after';
  readonly domain?: string;
}

/** One route per entry kind, with immutable identities carried as opaque address tokens. */
export function entryFlowHref(workspace: string, address: EntryFlowAddress = {}): string {
  const query = new URLSearchParams();
  if (address.entry !== undefined) query.set('id', idToToken(address.entry));
  if (address.plan !== undefined) query.set('plan', idToToken(address.plan));
  if (address.version !== undefined) query.set('version', address.version);
  if (address.domain !== undefined) query.set('domain', idToToken(address.domain));
  const suffix = query.toString();
  const search = suffix === '' ? '' : `?${suffix}`;
  return `/${workspace}/entries/${search}`;
}
