import type { ReactNode } from 'react';

import type { NavGroup } from '@/application/workspace-nav';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { NavRail } from '@/ui/nav-rail';
import { RailToggle } from '@/ui/rail-drawer.client';

export interface Crumb {
  readonly label: string;
  readonly href: string;
}

interface WorkspaceShellProps {
  readonly nav: readonly NavGroup[];
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
      rail={<NavRail groups={nav} label="Workspace" />}
    >
      {children}
    </AppShell>
  );
}
