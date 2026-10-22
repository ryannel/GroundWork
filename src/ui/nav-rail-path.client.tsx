'use client';

import { usePathname } from 'next/navigation';

import { type RailItem, RailItems } from './nav-rail-items';
import { currentTab } from './path-tabs.client';

// Items that work out which one is open from the address, so a layout can draw them for every page beneath it.
export function PathRailItems({ items }: { readonly items: readonly RailItem[] }) {
  const path = usePathname();
  const here = currentTab(
    items.map((item) => ({ href: item.href, label: item.title })),
    path,
  );
  return <RailItems flat items={items.map((item) => ({ ...item, current: item.href === here }))} />;
}
