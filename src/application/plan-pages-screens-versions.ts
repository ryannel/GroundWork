import type { Model } from '@/application/plan/derive';
import { ledgerOf } from '@/application/plan/revision-ledger';

// Chapter 9 as screens: a history page, then one page per version, the newest first.

export interface VersionScreen {
  readonly key: string;
  readonly title: string;
}

export const versionKey = (version: string): string => `v${version}`;

/** The plan's revision ledger as screens. Without a ledger there are none. */
export function versionScreens(model: Model): VersionScreen[] {
  const ledger = ledgerOf(model.plan);
  if (ledger.length === 0) return [];
  return [
    { key: 'history', title: 'Every version' },
    ...ledger
      .toReversed()
      .map((r) => ({ key: versionKey(r.version), title: `${r.version} · ${r.status}` })),
  ];
}
