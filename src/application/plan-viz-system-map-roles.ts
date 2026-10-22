import { SYSTEM_TIERS, type SystemTier } from '@/domain/workspace';

// The tier each column of a domain's map shows, in the order a request travels: in through the channels, across
// the gateway, to the forward-facing systems that answer it, the back end they rely on, and the upstream sources
// the data comes from. Each system takes the tier a person gave it, else the one the model implies.

export type MapRole = SystemTier;

export interface RoleSpan {
  readonly role: MapRole;
  readonly name: string;
  /** What the role means, for the band's tip and the docs. */
  readonly means: string;
  /** The first column the role heads, and how many columns it spans. */
  readonly from: number;
  readonly span: number;
}

const ROLES: Readonly<Record<MapRole, { readonly name: string; readonly means: string }>> = {
  channel: {
    name: 'Channels',
    means:
      'Where people come in: the sites and apps they use. Nothing on the map calls them; they call in.',
  },
  gateway: {
    name: 'Gateway',
    means:
      'The one front door the channels ask, which fans each question out to the systems that own the answer.',
  },
  forward: {
    name: 'Forward-facing',
    means: 'Answer the channels through the gateway: each serves part of the graph.',
  },
  backend: {
    name: 'Back end',
    means:
      'Keep the data and rules the forward-facing systems rely on; no channel asks them directly.',
  },
  upstream: {
    name: 'Upstream sources',
    means:
      'Outside parties the data comes from: product data, banks, tax providers and other services we call.',
  },
};

/** A tier's place, left to right. */
export const roleIndex = (role: MapRole): number => SYSTEM_TIERS.indexOf(role);

/** The tier at a place, left to right. */
const roleAt = (index: number): MapRole => SYSTEM_TIERS[index] ?? 'backend';

/** One band per column, each headed by the tier it shows; `used` holds each column's tier place. */
export function roleSpansOf(used: readonly number[]): RoleSpan[] {
  return used.map((index, from) => {
    const role = roleAt(index);
    return { role, ...ROLES[role], from, span: 1 };
  });
}
