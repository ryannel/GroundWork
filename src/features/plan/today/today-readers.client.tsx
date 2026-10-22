'use client';

import { usePathname } from 'next/navigation';

import type { PaletteEntry } from '@/application/plan-pages-search';
import { depthIn, todayReaderOf } from '@/application/today-reader';
import { Inspector } from '@/features/plan/inspector.client';
import { Palette } from '@/features/plan/palette.client';

interface TodayReadersProps {
  readonly workspace: string;
  readonly screens: readonly PaletteEntry[];
  readonly pages: Readonly<Record<string, string>>;
}

// The inspector and palette for a layout that wraps pages at several depths: the domain's overview and its map
// sit one level apart, so model.json's relative address comes from the page that is open.
export function TodayReaders({ workspace, screens, pages }: TodayReadersProps) {
  const reader = todayReaderOf(workspace, depthIn(workspace, usePathname()), pages);
  return (
    <>
      <Inspector reader={reader} />
      <Palette screens={screens} src={reader.modelSrc} today trigger={false} />
    </>
  );
}
