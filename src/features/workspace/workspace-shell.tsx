import type { ReactNode } from 'react';

import type { NavGroup } from '@/application/workspace-nav';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { NavRail } from '@/ui/nav-rail';

interface Crumb {
  readonly label: string;
  readonly href: string;
}

interface WorkspaceShellProps {
  readonly nav: readonly NavGroup[];
  readonly trail: readonly Crumb[];
  readonly title: string;
  readonly children: ReactNode;
}

// A workspace page in the same frame as a plan: the trail in the bar, the workspace down the left.
export function WorkspaceShell({ nav, trail, title, children }: WorkspaceShellProps) {
  return (
    <AppShell
      bar={<AppBar title={title} trail={trail} />}
      rail={<NavRail groups={nav} label="Workspace" />}
    >
      {children}
    </AppShell>
  );
}
