import type { ReactNode } from 'react';

import type { DomainNav } from '@/application/domain-nav';
import type { DomainView } from '@/application/workspace-domain';
import { PageHeader } from '@/ui/page-header';
import { Stats } from '@/ui/stats';
import { Swatch } from '@/ui/swatch';

import styles from './domain-page.module.css';
import { WorkspaceShell } from './workspace-shell';

interface DomainPageProps {
  readonly view: DomainView;
  readonly nav: DomainNav;
  /** The page being read, with its own header: the overview, plans, flows, map, language or interfaces. */
  readonly children?: ReactNode;
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

// The flows and the words are counted down the rail, so the numbers here are the domain's size and its surface.
function statsOf(view: DomainView) {
  const { href, counts } = view;
  const all = [
    {
      value: counts.systems,
      label: counts.systems === 1 ? 'system' : 'systems',
      href: `${href}#systems`,
    },
    { value: counts.components, label: 'components', href: `${href}map/` },
    { value: counts.calls, label: 'calls', href: `${href}interfaces/#calls` },
    { value: counts.events, label: 'events', href: `${href}interfaces/#events` },
    { value: counts.stores, label: 'stores', href: `${href}interfaces/#stores` },
  ];
  return all.filter((stat, at) => at < 2 || stat.value > 0);
}

// The domain's name and what it is for, how big it is and who runs it, at the top of its overview.
export function DomainHeader({ view }: { readonly view: DomainView }) {
  return (
    <>
      <PageHeader description={view.purpose ?? view.headline} title={view.name} />
      <DomainNumbers view={view} />
    </>
  );
}

// Each other page of the domain names itself, under the domain it belongs to, and says what it shows.
export function DomainTab({
  view,
  title,
  says,
}: {
  readonly view: DomainView;
  readonly title: string;
  readonly says: string;
}) {
  return (
    <PageHeader description={says} title={title} trail={[{ label: view.name, href: view.href }]} />
  );
}

function DomainNumbers({ view }: { readonly view: DomainView }) {
  return (
    <div className={styles.meta}>
      <Stats label={`${view.name} in numbers`} stats={statsOf(view)} />
      {view.teams.length === 0 ? null : (
        <ul aria-label="Teams" className={styles.teams}>
          {view.teams.map((team) => (
            <li className={styles.team} key={team.name}>
              <Swatch slot={team.slot} />
              {team.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// One domain, around the page being read; each page draws its own header. The rail lists the ways to read it (the
// overview, the plans, the flows, the map, the words and the interfaces), each at its own address.
export function DomainPage({ view, nav, children, overlays, actions }: DomainPageProps) {
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav.groups}
      navTop={nav.top}
      overlays={overlays}
      title={view.name}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: view.workspace.name, href: view.workspace.href },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
