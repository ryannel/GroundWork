import type { ReactNode } from 'react';

import { packAreaMapOverview } from '@/application/area-map/transport';
import type { AreaView } from '@/application/workspace-area';
import type { NavGroup } from '@/application/workspace-nav';
import { stripPrefix } from '@/domain/ids';
import { Callout } from '@/ui/callout';
import { Facts } from '@/ui/facts';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { AreaCollaborations } from './area-collaborations';
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

function evidenceCountLabel(view: AreaView): string {
  if (view.area.evidenceCount === undefined) return 'Supporting claim count not recorded';
  const label = view.boundaries === undefined ? 'supporting claims' : 'recorded supporting claims';
  return `${String(view.area.evidenceCount)} ${label}`;
}

/** One purpose-led area, then its collaborations and the systems that support them. */
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
      <PageHeader
        description={view.area.purpose}
        meta={
          <Facts
            items={[
              view.area.confidence === undefined
                ? 'Confidence not recorded'
                : `${view.area.confidence} confidence`,
              `Reviewed ${view.reviewed}`,
              evidenceCountLabel(view),
            ]}
          />
        }
        title={view.area.name}
      >
        <p>{view.area.boundary}</p>
      </PageHeader>
      {view.systems.length === 0 ? (
        <Callout title="Technical map not authored yet">
          The activity boundary is useful, but the current evidence has not yet been reconciled into
          a trustworthy cross-system view for this area.
        </Callout>
      ) : (
        <section className={styles.section} id="value-flow-map">
          <SectionHeading
            title={
              view.valueFlow === undefined ? 'Systems and information flow' : 'How the work flows'
            }
          >
            <p>
              {view.valueFlow === undefined
                ? 'Open a system to explore its components and recorded connections.'
                : 'Follow how information is created, published and used. Expand a system to see its core work and the components that support it.'}
            </p>
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
      <Activities view={view} />
      {view.collaborations.length === 0 ? null : (
        <section className={styles.section}>
          <SectionHeading title="How it works">
            <p>
              Cross-system collaborations reveal useful slices without flattening the area into one
              journey.
            </p>
          </SectionHeading>
          <AreaCollaborations view={view} />
        </section>
      )}
      <Callout title="Evidence boundary">{view.limitation}</Callout>
    </WorkspaceShell>
  );
}
