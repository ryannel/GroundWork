import type { Model } from '@/application/plan/derive';
import type { Outline } from '@/application/plan-pages';
import type { VersionsData } from '@/application/plan-story-versions-data';

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
}

/** A plan's cover, or one of its screens, inside the viewer shell. Null when the screen is not in the plan. */
export function PlanPage({
  model,
  outline,
  workspaceName,
  chapter = 'cover',
  screen = 'cover',
  versions = null,
}: PlanPageProps) {
  const page = outline.pages.find((p) => p.chapter === chapter && p.screen === screen);
  if (page === undefined) return null;
  const body = BODIES[page.chapter];
  return (
    <PlanShell
      outline={outline}
      page={page}
      version={model.plan.meta.version}
      workspaceName={workspaceName}
    >
      {body({ model, outline, page, versions })}
      <Remember model={model} outline={outline} page={page} />
    </PlanShell>
  );
}
