import type { ReactNode } from 'react';

import type { NavGroup } from '@/application/workspace-nav';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { NavRail, type RailTop } from '@/ui/nav-rail';
import { RailToggle } from '@/ui/rail-drawer.client';

export interface Crumb {
  readonly label: string;
  readonly href: string;
}

interface WorkspaceShellProps {
  readonly nav: readonly NavGroup[];
  /** Inside a domain: the way back to the workspace and the domain's name. */
  readonly navTop?: RailTop;
  readonly trail: readonly Crumb[];
  readonly title: string;
  /** What floats over the page: the inspector, the palette, the keys. */
  readonly overlays?: ReactNode;
  /** Buttons at the end of the bar, such as search. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

// A workspace page in the same frame as a plan: the trail in the bar, the workspace down the left.
export function WorkspaceShell({
  nav,
  navTop,
  trail,
  title,
  overlays,
  actions,
  children,
}: WorkspaceShellProps) {
  return (
    <AppShell
      bar={
        <AppBar lead={<RailToggle label="Show the workspace" />} title={title} trail={trail}>
          {actions}
        </AppBar>
      }
      overlays={overlays}
      rail={<NavRail groups={nav} label="Workspace" top={navTop} />}
    >
      {children}
    </AppShell>
  );
}
