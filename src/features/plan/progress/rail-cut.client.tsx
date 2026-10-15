'use client';

import { Suspense, useEffect } from 'react';

import { useLens } from '@/features/plan/lens.client';

/** The screens each team's lens leaves out of the rail, by team id. */
export type RailHidden = Readonly<Record<string, readonly string[]>>;

const trimmed = (path: string): string => (path.endsWith('/') ? path.slice(0, -1) : path);

/** Hides the rail's entries for the screens the lens leaves out, and shows them all again without one. */
export function cutRail(root: ParentNode, lens: string | null, hidden: RailHidden): void {
  const out = new Set(
    (lens === null ? [] : (hidden[lens] ?? hidden[`team:${lens}`] ?? [])).map(trimmed),
  );
  for (const link of root.querySelectorAll<HTMLAnchorElement>('li a[href]')) {
    const item = link.closest('li');
    if (item !== null) item.hidden = out.has(trimmed(link.getAttribute('href') ?? ''));
  }
}

function Cut({ hidden }: { readonly hidden: RailHidden }) {
  const lens = useLens();
  useEffect(() => {
    const rail = document.querySelector('nav[aria-label="Chapters"]');
    if (rail !== null) cutRail(rail, lens, hidden);
  }, [lens, hidden]);
  return null;
}

// While reading as one team, the rail lists only that team's screens.
export function RailCut({ hidden }: { readonly hidden: RailHidden }) {
  return (
    <Suspense fallback={null}>
      <Cut hidden={hidden} />
    </Suspense>
  );
}
