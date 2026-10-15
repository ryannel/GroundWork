import type { ReactNode } from 'react';

import { neighboursOf, type Outline, type Page } from '@/application/plan-pages';
import { workspaceHref } from '@/application/workspace-paths';

import { ChapterRail } from './chapter-rail';
import { Inspector } from './inspector.client';
import { PlanKeys } from './keys.client';
import { LensCarry } from './lens.client';
import { Pager } from './pager.client';
import { Palette } from './palette.client';
import { planJsonOf } from './plan-model';
import styles from './plan-shell.module.css';
import { TopBar } from './top-bar';

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
    <div className={styles.shell}>
      <TopBar
        title={outline.title}
        version={version}
        workspace={{ name: workspaceName, href: workspaceHref(outline.workspace) }}
      >
        <Palette outline={outline} src={src} />
      </TopBar>
      <div className={styles.body}>
        <ChapterRail outline={outline} page={page} />
        <main className={styles.stage}>
          {children}
          <Pager neighbours={neighbours} />
        </main>
      </div>
      <Inspector plan={{ workspace: outline.workspace, slug: outline.slug }} src={src} />
      <LensCarry />
      <PlanKeys next={neighbours.next?.href ?? null} previous={neighbours.previous?.href ?? null} />
    </div>
  );
}
