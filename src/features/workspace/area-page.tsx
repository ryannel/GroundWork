import type { ReactNode } from 'react';

import { packAreaMapOverview } from '@/application/area-map/transport';
import type { AreaView } from '@/application/workspace-area';
import type { NavGroup } from '@/application/workspace-nav';
import { stripPrefix } from '@/domain/ids';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { AreaMap } from './area-map.client';
import styles from './area-page.module.css';
import { WorkspaceShell } from './workspace-shell';

interface Props {
  readonly view: AreaView;
  readonly nav: readonly NavGroup[];
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
  readonly initialFlow?: string;
}

function Activities({ view }: { readonly view: AreaView }) {
  if (view.area.activities.length === 0) return null;
  return (
    <section className={styles.activities}>
      <SectionHeading title="What happens here">
        <p>These activities explain the scope. They are not assumed to form one journey.</p>
      </SectionHeading>
      <List>
        {view.area.activities.map((activity) => (
          <ListItem key={activity}>{activity}</ListItem>
        ))}
      </List>
    </section>
  );
}

function SharedInfrastructure({ view }: { readonly view: AreaView }) {
  const components = view.systems.flatMap((system) =>
    system.components.filter((component) => component.infrastructure === true),
  );
  if (components.length === 0) return null;
  return (
    <section className={styles.section}>
      <SectionHeading title="Shared infrastructure" />
      <List>
        {components.map(({ id, name, summary }) => (
          <ListItem key={id}>
            {name}
            {summary === '' ? '' : ` · ${summary}`}
          </ListItem>
        ))}
      </List>
    </section>
  );
}

/** One area from the workspace model: its purpose, its systems and how they connect. */
export function AreaPage({ view, nav, overlays, actions, initialFlow = '' }: Props) {
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav}
      overlays={overlays}
      title={view.area.name}
      wide
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: view.workspace.name, href: view.workspace.href },
      ]}
    >
      <PageHeader description={view.area.purpose} title={view.area.name} />
      {view.systems.length === 0 ? (
        <Callout title="No systems here yet">
          No system in the workspace model names this area as its home.
        </Callout>
      ) : (
        <section className={styles.section} id="value-flow-map">
          <SectionHeading title="Systems and information flow">
            <p>Open a system to explore its components and recorded connections.</p>
          </SectionHeading>
          <AreaMap
            key={`${view.workspace.id}:${view.area.id}:${initialFlow}`}
            initialFlow={initialFlow}
            payload={packAreaMapOverview(view)}
            detailsHref={`${view.workspace.href}areas/${encodeURIComponent(stripPrefix(view.area.id, 'area'))}/map.json`}
          />
        </section>
      )}
      {(view.gaps?.length ?? 0) === 0 ? null : (
        <Callout title="Recorded gaps">
          {String(view.gaps?.length)} gaps remain visible in the entry flows and boundary details.
        </Callout>
      )}
      <SharedInfrastructure view={view} />
      <Activities view={view} />
    </WorkspaceShell>
  );
}
