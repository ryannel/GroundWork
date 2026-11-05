import type { Model } from '@/application/plan/derive';
import type { BaseInfo } from '@/application/plan/plan-base';
import type { PlanCard } from '@/application/plan-footprint';
import type { Outline } from '@/application/plan-pages';
import type { VersionsData } from '@/application/plan-story-versions-data';
import type { StackCoverVM } from '@/application/workspace-work/stack-cover';
import type { SearchParams } from '@/shared/search-params';

import { ChapterBoundary } from './chapter-boundary.client';
import { PlanShell } from './plan-shell';
import { Remember } from './remember/remember';
import { BODIES } from './screen-bodies';

interface PlanPageProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly workspaceName: string;
  /** Which screen; the cover when left out. */
  readonly chapter?: string;
  readonly screen?: string;
  /** The plan's revisions, for the versions chapter. */
  readonly versions?: VersionsData | null;
  /** Every plan of the workspace, for the plan switcher. */
  readonly plans?: readonly PlanCard[];
  /** Where the plan's today comes from. */
  readonly base?: BaseInfo;
  /** The plans it reads after, overlaps and joins; the cover says so. */
  readonly stack?: StackCoverVM | null;
  /** The team the address cuts the page to (`?team=`), or null for everyone. */
  readonly lens?: string | null;
  readonly searchParams?: SearchParams;
}

const NO_PLANS: NonNullable<PlanPageProps['plans']> = [];

/** A plan's cover, or one of its screens, inside the viewer shell. Null when the screen is not in the plan. */
export function PlanPage({
  model,
  outline,
  workspaceName,
  chapter = 'cover',
  screen = 'cover',
  versions = null,
  plans = NO_PLANS,
  base,
  stack = null,
  lens = null,
  searchParams,
}: PlanPageProps) {
  const page = outline.pages.find((p) => p.chapter === chapter && p.screen === screen);
  if (page === undefined) return null;
  const body = BODIES[page.chapter];
  return (
    <PlanShell
      model={model}
      outline={outline}
      page={page}
      plans={plans}
      workspaceName={workspaceName}
    >
      <ChapterBoundary key={page.href}>
        {body({
          model,
          outline,
          page,
          versions,
          stack,
          lens,
          ...(searchParams === undefined ? {} : { searchParams }),
          ...(base === undefined ? {} : { base }),
        })}
      </ChapterBoundary>
      <Remember model={model} outline={outline} page={page} />
    </PlanShell>
  );
}
