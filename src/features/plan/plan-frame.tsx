import type { ReactNode } from 'react';

import type { PlanCard } from '@/application/plan-footprint';
import type { Neighbours, Outline, Page } from '@/application/plan-navigation';
import { workspaceHref } from '@/application/workspace-paths';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { RailToggle } from '@/ui/rail-drawer.client';

import { ChapterRail } from './chapter-rail';
import { Pager } from './pager.client';
import { PlanSwitch } from './plan-switch.client';
import type { RailHidden } from './progress/rail-cut.client';

interface PlanFrameProps {
  readonly outline: Outline;
  readonly page: Page;
  readonly workspaceName: string;
  readonly plans: readonly PlanCard[];
  readonly actions: ReactNode;
  readonly overlays: ReactNode;
  readonly progress: ReactNode;
  readonly neighbours: Neighbours | null;
  readonly hidden?: RailHidden;
  readonly children: ReactNode;
}
/** The plan's existing frame consumes presentation data, independently of any model format. */
export function PlanFrame({
  outline,
  page,
  workspaceName,
  plans,
  actions,
  overlays,
  progress,
  neighbours,
  hidden,
  children,
}: PlanFrameProps) {
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
          {actions}
        </AppBar>
      }
      overlays={overlays}
      rail={
        <ChapterRail outline={outline} page={page} {...(hidden === undefined ? {} : { hidden })} />
      }
    >
      {progress}
      {children}
      {neighbours === null ? null : <Pager neighbours={neighbours} />}
    </AppShell>
  );
}
