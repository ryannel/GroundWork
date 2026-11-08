import { parseGitHostUrl } from '@/domain/code-links';
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
  readonly complete: boolean;
  readonly sourceIndex?: string | undefined;
  readonly interpretationIndex?: string | undefined;
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

/** The old flat publication could open a data page while another repository was selected. */
export function historicalDataPin(page: ExplorerPage): {
  readonly repo: string;
  readonly commit: string;
} | null {
  if (page.kind !== 'data' || page.sources.length === 0) return null;
  const sources = page.sources.map(({ url }) => parseGitHostUrl(url));
  const pin = sources[0];
  if (
    pin?.host !== 'github.com' ||
    pin.kind !== 'blob' ||
    !/^[a-f0-9]{40}$/u.test(pin.commit ?? '')
  ) {
    return null;
  }
  const { repo, commit } = pin;
  if (
    commit === undefined ||
    !sources.every(
      (source) =>
        source?.host === pin.host &&
        source.kind === pin.kind &&
        source.repo === repo &&
        source.commit === commit,
    )
  ) {
    return null;
  }
  return { repo, commit };
}
