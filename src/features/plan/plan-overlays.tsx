import type { Neighbours, Outline, Page } from '@/application/plan-pages';
import { planReaderOf } from '@/application/plan-pages-things';

import { CheatSheet } from './cheat-sheet.client';
import { Inspector } from './inspector.client';
import { PlanKeys } from './keys.client';
import { LensCarry } from './lens.client';
import { ChangesAhead } from './tray/changes-ahead.client';

interface PlanOverlaysProps {
  readonly outline: Outline;
  readonly page: Page;
  readonly neighbours: Neighbours;
  /** Where the plan's model is. */
  readonly src: string;
}

/** What floats over every plan screen: the inspector, the lens, the cheat sheet, the tray and the keys. */
export function PlanOverlays({ outline, page, neighbours, src }: PlanOverlaysProps) {
  const plan = { workspace: outline.workspace, slug: outline.slug };
  return (
    <>
      <Inspector reader={planReaderOf(plan, src)} />
      <LensCarry />
      <CheatSheet />
      <ChangesAhead here={page.href} plan={plan} src={src} />
      <PlanKeys
        next={neighbours.next?.href ?? null}
        nextChapter={neighbours.nextChapter?.href ?? null}
        previous={neighbours.previous?.href ?? null}
        previousChapter={neighbours.previousChapter?.href ?? null}
      />
    </>
  );
}
