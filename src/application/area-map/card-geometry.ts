import type { AreaComponentView, AreaResourceView } from '@/application/workspace-area';

import { type ApiSurface, apiSurface } from './api-surface';
import { linkedResources } from './component-summary';

/**
 * The fixed heights of a component card, in canvas pixels. The card's stylesheet uses the same numbers,
 * so a line can land on the middle of the row it names.
 */
export const CARD = {
  width: 320,
  header: 84,
  contents: 32,
  heading: 26,
  apiRow: 28,
  resourceRow: 40,
  sharedRow: 28,
  end: 10,
  footer: 56,
} as const;

export type CardSectionKind = 'api' | 'stores' | 'publishes' | 'shared';

export type CardRow =
  | { readonly kind: 'api'; readonly surface: ApiSurface; readonly centre: number }
  | { readonly kind: 'resource'; readonly resource: AreaComponentView; readonly centre: number }
  | { readonly kind: 'shared'; readonly resource: AreaResourceView; readonly centre: number };

export interface CardSection {
  readonly kind: CardSectionKind;
  readonly rows: readonly CardRow[];
}

export interface CardContents {
  readonly kind: CardSectionKind;
  readonly count: number;
}

export interface CardLayout {
  /** What the card holds, counted by kind; a closed card shows only this. */
  readonly contents: readonly CardContents[];
  readonly open: boolean;
  /** Empty while the card is closed, so lines land on the card itself. */
  readonly sections: readonly CardSection[];
  readonly height: number;
  /** Stores and topics shown as their own card keep a footer naming their technology. */
  readonly footer: boolean;
}

type Pending =
  | { readonly kind: 'api'; readonly surface: ApiSurface }
  | { readonly kind: 'resource'; readonly resource: AreaComponentView }
  | { readonly kind: 'shared'; readonly resource: AreaResourceView };

const HEIGHTS: Readonly<Record<Pending['kind'], number>> = {
  api: CARD.apiRow,
  resource: CARD.resourceRow,
  shared: CARD.sharedRow,
};

function pendingSections(
  component: AreaComponentView,
): readonly { readonly kind: CardSectionKind; readonly rows: readonly Pending[] }[] {
  const owned = component.attachments ?? [];
  return [
    {
      kind: 'api' as const,
      rows: apiSurface(component.endpoints).map((surface) => ({ kind: 'api' as const, surface })),
    },
    {
      kind: 'stores' as const,
      rows: owned
        .filter((resource) => resource.kind !== 'queue')
        .map((resource) => ({ kind: 'resource' as const, resource })),
    },
    {
      kind: 'publishes' as const,
      rows: owned
        .filter((resource) => resource.kind === 'queue')
        .map((resource) => ({ kind: 'resource' as const, resource })),
    },
    {
      kind: 'shared' as const,
      rows: linkedResources(component).map((resource) => ({ kind: 'shared' as const, resource })),
    },
  ].filter((section) => section.rows.length > 0);
}

/**
 * A card is a header and, when it holds anything, a strip counting what it holds. An open card then lists one
 * titled section per kind of thing the component offers or holds.
 */
export function cardLayout(component: AreaComponentView, open: boolean): CardLayout {
  const pending = pendingSections(component);
  const contents = pending.map((section) => ({ kind: section.kind, count: section.rows.length }));
  let top = CARD.header + (contents.length === 0 ? 0 : CARD.contents);
  const sections = (open ? pending : []).map((section) => {
    top += CARD.heading;
    const rows = section.rows.map((row): CardRow => {
      const centre = top + HEIGHTS[row.kind] / 2;
      top += HEIGHTS[row.kind];
      return { ...row, centre };
    });
    return { kind: section.kind, rows };
  });
  const footer = component.kind === 'database' || component.kind === 'queue';
  return {
    contents,
    open: open && contents.length > 0,
    sections,
    height: top + (footer ? CARD.footer : CARD.end),
    footer,
  };
}
