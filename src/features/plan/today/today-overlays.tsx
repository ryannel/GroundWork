import { todayReaderOf } from '@/application/today-reader';
import { todayScreensOf } from '@/application/today-thing';
import { systemPagesOf } from '@/application/workspace-paths';
import type { Workspace } from '@/domain/workspace';
import { CheatSheet, HelpButton } from '@/features/plan/cheat-sheet.client';
import { Inspector } from '@/features/plan/inspector.client';
import { PlanKeys } from '@/features/plan/keys.client';
import { Palette, PaletteButton } from '@/features/plan/palette.client';

import { TodayReaders } from './today-readers.client';

interface TodayOverlaysProps {
  readonly workspace: Workspace;
  /** How deep the page is below /<workspace>/, so model.json is found by a relative address; without it, the
   * depth is read from the address of whichever page is open, for a layout that wraps pages at several depths. */
  readonly depth?: number;
  /** Where → and ← go past the ends of a walk or stops, when anywhere. */
  readonly previous?: string | null;
  readonly next?: string | null;
}

// What floats over a workspace page: the inspector and hover cards on today's model, the palette, the cheat sheet
// and the keys. Mount it in WorkspaceShell's overlays.
export function TodayOverlays({
  workspace,
  depth,
  previous = null,
  next = null,
}: TodayOverlaysProps) {
  const screens = todayScreensOf(workspace);
  const pages = systemPagesOf(workspace);
  const reader = depth === undefined ? null : todayReaderOf(workspace.id, depth, pages);
  return (
    <>
      {reader === null ? (
        <TodayReaders pages={pages} screens={screens} workspace={workspace.id} />
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

/** The bar's search and help, for WorkspaceShell's actions; TodayOverlays must be on the page too. */
export function TodaySearch() {
  return (
    <>
      <PaletteButton />
      <HelpButton />
    </>
  );
}
