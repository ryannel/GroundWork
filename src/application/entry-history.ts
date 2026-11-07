import type { ExplorerPage } from '@/domain/service-explorer';

import { workspaceHref } from './workspace-paths';

export interface HistoricalScope {
  readonly key: string;
  readonly publication: 'live' | 'fallback';
  readonly service: string;
  readonly name: string;
  readonly repo: string;
  readonly commit: string;
}
export interface HistoricalAddress {
  readonly scope?: string | undefined;
  readonly service?: string | undefined;
  readonly page?: string | undefined;
  readonly node?: string | undefined;
}
export interface HistoricalEntry {
  readonly id: string;
  readonly file: string;
  readonly label: string;
  readonly native: string | null;
}
interface HistoricalSelection {
  readonly scope: HistoricalScope;
  readonly entries: readonly HistoricalEntry[];
  readonly links: readonly string[];
  readonly overview: string;
  readonly callers: string;
}
export type EntryHistory =
  | { readonly kind: 'directory'; readonly scopes: readonly HistoricalScope[] }
  | (HistoricalSelection & {
      readonly kind: 'snapshot';
      readonly file: string;
      readonly page: ExplorerPage;
      readonly selected: string | null;
    })
  | (HistoricalSelection & {
      readonly kind: 'retired' | 'unavailable';
      readonly title: string;
      readonly sources: readonly { readonly label: string; readonly url: string }[];
    });

export function historicalEntryHref(workspace: string, address: HistoricalAddress = {}): string {
  const query = new URLSearchParams();
  if (address.scope !== undefined) query.set('scope', address.scope);
  if (address.service !== undefined) query.set('service', address.service);
  if (address.page !== undefined) query.set('page', address.page);
  if (address.node !== undefined) query.set('node', address.node);
  const search = query.size === 0 ? '' : `?${query.toString()}`;
  return `${workspaceHref(workspace)}explorer/${search}`;
}
