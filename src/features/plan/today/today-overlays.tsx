import type { ModelIndex } from '@/application/model-index';
import { modelPageLinks, modelWorkspaceScreens } from '@/application/model-pages';
import type { PaletteEntry } from '@/application/plan-pages-search';
import { todayReaderOf } from '@/application/today-reader';
import { CheatSheet, HelpButton } from '@/features/plan/cheat-sheet.client';
import { Inspector } from '@/features/plan/inspector.client';
import { PlanKeys } from '@/features/plan/keys.client';
import { Palette, PaletteButton } from '@/features/plan/palette.client';

import { TodayReaders } from './today-readers.client';

interface TodayOverlaysProps {
  /** How deep the page is below /<workspace>/, so model.json is found by a relative address; without it, the
   * depth is read from the address of whichever page is open, for a layout that wraps pages at several depths. */
  readonly depth?: number;
  /** Where → and ← go past the ends of a walk or stops, when anywhere. */
  readonly previous?: string | null;
  readonly next?: string | null;
}

// What floats over a workspace page: the inspector and hover cards on today's model, the palette, the cheat sheet
// and the keys. Mount it in WorkspaceShell's overlays.
function TodayOverlayFrame({
  id,
  pages,
  screens,
  depth,
  previous = null,
  next = null,
}: TodayOverlaysProps & {
  readonly id: string;
  readonly pages: Readonly<Record<string, string>>;
  readonly screens: readonly PaletteEntry[];
}) {
  const reader = depth === undefined ? null : todayReaderOf(id, depth, pages);
  return (
    <>
      {reader === null ? (
        <TodayReaders pages={pages} screens={screens} workspace={id} />
      ) : (
        <>
          <Inspector reader={reader} />
          <Palette screens={screens} src={reader.modelSrc} today trigger={false} />
        </>
      )}
      <CheatSheet today />
      <PlanKeys next={next} nextChapter={null} previous={previous} previousChapter={null} />
    </>
  );
}

/** Native pages pass bounded navigation records; their browser facts are fetched only on demand. */
export function ModelTodayOverlays({
  index,
  ...options
}: TodayOverlaysProps & { readonly index: ModelIndex }) {
  return (
    <TodayOverlayFrame
      id={index.model.id}
      pages={modelPageLinks(index)}
      screens={modelWorkspaceScreens(index)}
      {...options}
    />
  );
}

/** The bar's search and help, for WorkspaceShell's actions; TodayOverlays must be on the page too. */
export function TodaySearch() {
  return (
    <>
      <PaletteButton />
      <HelpButton />
    </>
  );
}
