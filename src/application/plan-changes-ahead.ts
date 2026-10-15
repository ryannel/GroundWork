import type { Model } from '@/application/plan/derive';
import { pageHref, type PlanAddress } from '@/application/plan-pages';
import { type ChangeBody, changesLayout } from '@/application/plan-pages-screens-changes';
import { reachIds, topOf } from '@/application/plan-story-changes-touched';

// Where the story shows how a thing changes: the screen of chapter 4 that draws it, else the ledger of all changes.
// The changes-ahead tray links each pinned thing there.

export interface AheadStop {
  readonly href: string;
  readonly title: string;
  /** Its place in the story, such as 4.2. */
  readonly position: string;
}

const CHAPTER = '4';

function idsOf(body: ChangeBody): readonly string[] {
  switch (body.kind) {
    case 'flows':
    case 'screens':
    case 'records': {
      return body.ids;
    }
    case 'contracts': {
      return [...body.touched.ladders, ...body.touched.retired, ...body.touched.shapes];
    }
    case 'small-flow': {
      return [body.id, ...reachIds(body.reach)];
    }
    case 'more': {
      return reachIds(body.reach);
    }
    case 'graph':
    case 'ledger': {
      return [];
    }
  }
}

/** The screen of chapter 4 that shows how a thing changes; null when the plan has no chapter 4. */
export function aheadStop(model: Model, at: PlanAddress, id: string): AheadStop | null {
  const screens = changesLayout(model);
  const top = topOf(id);
  const index = screens.findIndex((s) => idsOf(s.body).some((x) => x === id || x === top));
  const at4 = index === -1 ? screens.findIndex((s) => s.body.kind === 'ledger') : index;
  const screen = screens[at4];
  if (screen === undefined) return null;
  return {
    href: pageHref(at, 'changes', screen.key),
    title: screen.title,
    position: `${CHAPTER}.${String(at4 + 1)}`,
  };
}
