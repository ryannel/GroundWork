import { idToToken } from '@/domain/ids';

export interface EntryFlowAddress {
  readonly entry?: string;
  readonly plan?: string;
  readonly version?: 'before' | 'after';
  readonly domain?: string;
  readonly system?: string;
  readonly page?: number;
}

/** One route per entry kind, with immutable identities carried as opaque address tokens. */
export function entryFlowHref(workspace: string, address: EntryFlowAddress = {}): string {
  const query = new URLSearchParams();
  if (address.entry !== undefined) query.set('id', idToToken(address.entry));
  if (address.plan !== undefined) query.set('plan', idToToken(address.plan));
  if (address.version !== undefined) query.set('version', address.version);
  if (address.domain !== undefined) query.set('domain', idToToken(address.domain));
  if (address.system !== undefined) query.set('system', idToToken(address.system));
  if (address.page !== undefined && address.page > 1) query.set('page', String(address.page));
  const suffix = query.toString();
  const search = suffix === '' ? '' : `?${suffix}`;
  return `/${workspace}/entries/${search}`;
}
