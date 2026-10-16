import type { ReactNode } from 'react';

import type { DomainView } from '@/application/workspace-domain';
import type { NavGroup } from '@/application/workspace-nav';
import { PageHeader } from '@/ui/page-header';
import { PathTabs } from '@/ui/path-tabs.client';
import { Stats } from '@/ui/stats';
import { Swatch } from '@/ui/swatch';

import styles from './domain-page.module.css';
import { WorkspaceShell } from './workspace-shell';

interface DomainPageProps {
  readonly view: DomainView;
  readonly nav: readonly NavGroup[];
  /** How many words the domain owns; 0 when it has written none down. */
  readonly words?: number;
  /** The tab being read: the overview, the flows, the map, the language or the interfaces. */
  readonly children?: ReactNode;
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

function tabsOf(view: DomainView, words: number) {
  const { href, counts } = view;
  const kept = counts.calls + counts.events + counts.stores;
  return [
    { href, label: 'Overview' },
    ...(counts.flows === 0 ? [] : [{ href: `${href}flows/`, label: 'Flows', count: counts.flows }]),
    { href: `${href}map/`, label: 'Map', count: counts.components },
    ...(words === 0 ? [] : [{ href: `${href}language/`, label: 'Language', count: words }]),
    ...(kept === 0 ? [] : [{ href: `${href}interfaces/`, label: 'Interfaces', count: kept }]),
  ];
}

function statsOf(view: DomainView, words: number) {
  const { href, counts } = view;
  const all = [
    {
      value: counts.systems,
      label: counts.systems === 1 ? 'system' : 'systems',
      href: `${href}#systems`,
    },
    { value: counts.components, label: 'components', href: `${href}map/` },
    { value: counts.flows, label: 'flows', href: `${href}flows/` },
    { value: words, label: 'words', href: `${href}language/` },
    { value: counts.calls, label: 'calls', href: `${href}interfaces/#calls` },
    { value: counts.events, label: 'events', href: `${href}interfaces/#events` },
    { value: counts.stores, label: 'stores', href: `${href}interfaces/#stores` },
  ];
  return all.filter((stat, at) => at < 2 || stat.value > 0);
}

function Teams({ view }: { readonly view: DomainView }) {
  if (view.teams.length === 0) return null;
  return (
    <ul aria-label="Teams" className={styles.teams}>
      {view.teams.map((team) => (
        <li className={styles.team} key={team.name}>
          <Swatch slot={team.slot} />
          {team.name}
        </li>
      ))}
    </ul>
  );
}

// One domain: its name, what it is for, how big it is and who runs it, then a tab for each way to read it. The
// overview comes first; the flows, the map, the words and the interfaces each have their own address.
export function DomainPage(props: DomainPageProps) {
  const { view, nav, words = 0, children, overlays, actions } = props;
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav}
      overlays={overlays}
      title={view.name}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: view.workspace.name, href: view.workspace.href },
      ]}
    >
      <PageHeader
        description={view.purpose ?? view.headline}
        meta={
          <div className={styles.meta}>
            <Stats label={`${view.name} in numbers`} stats={statsOf(view, words)} />
            <Teams view={view} />
          </div>
        }
        title={view.name}
      />
      <div className={styles.tabs}>
        <PathTabs label={`Ways to read ${view.name}`} tabs={tabsOf(view, words)} />
      </div>
      <div className={styles.body}>{children}</div>
    </WorkspaceShell>
  );
}
