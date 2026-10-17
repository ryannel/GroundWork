import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { planBarOf } from '@/application/plan-bar';
import type { PlanCard } from '@/application/plan-footprint';
import { neighboursOf, type Neighbours, type Outline, type Page } from '@/application/plan-pages';
import { crumbOf, teamHidden, teamPages, teamPlaces } from '@/application/plan-pages-team';
import { workspaceHref } from '@/application/workspace-paths';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { RailToggle } from '@/ui/rail-drawer.client';

import { ChapterRail } from './chapter-rail';
import { Pager } from './pager.client';
import { PeekToday } from './peek.client';
import { PlanActions } from './plan-bar';
import { planJsonOf } from './plan-model';
import { PlanOverlays } from './plan-overlays';
import { PlanSwitch } from './plan-switch.client';
import { ProgressStrip } from './progress/progress-strip.client';

const NO_NEIGHBOURS: Neighbours = {
  previous: null,
  next: null,
  previousChapter: null,
  nextChapter: null,
  opens: null,
  end: null,
};

interface PlanShellProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
  readonly workspaceName: string;
  /** Every plan of the workspace, for the switcher. */
  readonly plans: readonly PlanCard[];
  /** What the pager and the arrow keys step to, when not the screens either side; null when the page draws its
   * own, as the things page does once it knows which thing it shows. */
  readonly neighbours?: Neighbours | null;
  readonly children: ReactNode;
}

export function PlanShell({
  model,
  outline,
  page,
  workspaceName,
  plans,
  neighbours: given,
  children,
}: PlanShellProps) {
  const neighbours = given === undefined ? neighboursOf(outline, page) : given;
  const src = planJsonOf(page);
  const bar = planBarOf(model, outline);
  const teams = teamPages(model, outline);
  return (
    <AppShell
      bar={
        <AppBar
          after={<PlanSwitch current={outline.slug} plans={plans} />}
          lead={<RailToggle label="Show the chapters" />}
          title={outline.title}
          trail={[
            { label: 'Workspaces', href: '/' },
            { label: workspaceName, href: workspaceHref(outline.workspace) },
          ]}
        >
          <PlanActions bar={bar} outline={outline} src={src} />
        </AppBar>
      }
      overlays={
        <PlanOverlays
          neighbours={neighbours ?? NO_NEIGHBOURS}
          outline={outline}
          page={page}
          src={src}
        />
      }
      rail={<ChapterRail hidden={teamHidden(outline, teams)} outline={outline} page={page} />}
    >
      <ProgressStrip crumb={crumbOf(outline, page)} teams={teamPlaces(teams, page.href)} />
      {page.chapter === 'changes' ? <PeekToday key={page.href}>{children}</PeekToday> : children}
      {neighbours === null ? null : <Pager neighbours={neighbours} />}
    </AppShell>
  );
}
