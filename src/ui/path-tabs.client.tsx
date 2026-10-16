'use client';

import { usePathname } from 'next/navigation';

import { type Tab, Tabs } from './tabs';

const slashed = (path: string): string => (path.endsWith('/') ? path : `${path}/`);

/** The tab whose address the page sits under, the longest such address winning; the first tab otherwise. */
export function currentTab(tabs: readonly Tab[], path: string): string {
  const here = slashed(path);
  const under = tabs
    .filter((tab) => here.startsWith(slashed(tab.href)))
    .toSorted((a, b) => b.href.length - a.href.length);
  return under[0]?.href ?? tabs[0]?.href ?? '';
}

// Tabs that work out which one is open from the address, so a layout can draw them for every page beneath it.
export function PathTabs({
  label,
  tabs,
}: {
  readonly label: string;
  readonly tabs: readonly Tab[];
}) {
  const path = usePathname();
  return <Tabs current={currentTab(tabs, path)} label={label} tabs={tabs} />;
}
