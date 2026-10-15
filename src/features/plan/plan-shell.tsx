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
import { CheatSheet } from './cheat-sheet.client';
import { Inspector } from './inspector.client';
import { PlanKeys } from './keys.client';
import { LensCarry } from './lens.client';
import { Pager } from './pager.client';
import { PeekToday } from './peek.client';
import { PlanActions } from './plan-bar';
import { planJsonOf } from './plan-model';
import { PlanSwitch } from './plan-switch.client';
import { ProgressStrip } from './progress/progress-strip.client';
import { ChangesAhead } from './tray/changes-ahead.client';

interface PlanShellProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
  readonly workspaceName: string;
  /** Every plan of the workspace, for the switcher. */
  readonly plans: readonly PlanCard[];
  /** What the pager and the arrow keys step to, when not the screens either side. */
  readonly neighbours?: Neighbours;
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
  const neighbours = given ?? neighboursOf(outline, page);
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
        <>
          <Inspector plan={{ workspace: outline.workspace, slug: outline.slug }} src={src} />
          <LensCarry />
          <CheatSheet />
          <ChangesAhead
            here={page.href}
            plan={{ workspace: outline.workspace, slug: outline.slug }}
            src={src}
          />
          <PlanKeys
            next={neighbours.next?.href ?? null}
            nextChapter={neighbours.nextChapter?.href ?? null}
            previous={neighbours.previous?.href ?? null}
            previousChapter={neighbours.previousChapter?.href ?? null}
          />
        </>
      }
      rail={<ChapterRail hidden={teamHidden(outline, teams)} outline={outline} page={page} />}
    >
      <ProgressStrip crumb={crumbOf(outline, page)} teams={teamPlaces(teams, page.href)} />
      {page.chapter === 'changes' ? <PeekToday key={page.href}>{children}</PeekToday> : children}
      <Pager neighbours={neighbours} />
    </AppShell>
  );
}
