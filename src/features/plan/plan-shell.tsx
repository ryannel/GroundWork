import type { ReactNode } from 'react';

import { neighboursOf, type Outline, type Page } from '@/application/plan-pages';
import { workspaceHref } from '@/application/workspace-paths';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';

import { ChapterRail } from './chapter-rail';
import { Inspector } from './inspector.client';
import { PlanKeys } from './keys.client';
import { LensCarry } from './lens.client';
import { Pager } from './pager.client';
import { Palette } from './palette.client';
import { planJsonOf } from './plan-model';

interface PlanShellProps {
  readonly outline: Outline;
  readonly page: Page;
  readonly workspaceName: string;
  readonly version: string | undefined;
  readonly children: ReactNode;
}

export function PlanShell({ outline, page, workspaceName, version, children }: PlanShellProps) {
  const neighbours = neighboursOf(outline, page);
  const src = planJsonOf(page);
  return (
    <AppShell
      bar={
        <AppBar
          note={version === undefined ? undefined : `v${version}`}
          title={outline.title}
          trail={[
            { label: 'Workspaces', href: '/' },
            { label: workspaceName, href: workspaceHref(outline.workspace) },
          ]}
        >
          <Palette outline={outline} src={src} />
        </AppBar>
      }
      overlays={
        <>
          <Inspector plan={{ workspace: outline.workspace, slug: outline.slug }} src={src} />
          <LensCarry />
          <PlanKeys
            next={neighbours.next?.href ?? null}
            previous={neighbours.previous?.href ?? null}
          />
        </>
      }
      rail={<ChapterRail outline={outline} page={page} />}
    >
      {children}
      <Pager neighbours={neighbours} />
    </AppShell>
  );
}
