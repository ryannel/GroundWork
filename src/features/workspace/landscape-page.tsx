import type { ReactNode } from 'react';

import type { PlanCard } from '@/application/plan-footprint';
import type { DomainCard, Landscape } from '@/application/workspace-landscape';
import type { NavGroup } from '@/application/workspace-nav';
import { Callout } from '@/ui/callout';
import { Card } from '@/ui/card';
import { Facts } from '@/ui/facts';
import { Markdown } from '@/ui/markdown';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { JourneyCards } from './journey-cards';
import styles from './landscape-page.module.css';
import { PlanCards } from './plan-parts';
import { WorkspaceShell } from './workspace-shell';

interface LandscapePageProps {
  readonly landscape: Landscape;
  readonly folder: string;
  readonly nav: readonly NavGroup[];
  /** The map of every system, drawn by the route. */
  readonly map?: ReactNode;
  /** The workspace's plans; leave out and the section is not drawn. */
  readonly plans?: readonly PlanCard[];
  /** What floats over the page: the inspector, the palette, the keys. */
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

function DomainCards({ domains }: { readonly domains: readonly DomainCard[] }) {
  return (
    <ul className={styles.domains}>
      {domains.map((domain) => (
        <li key={domain.id}>
          <Card href={domain.href} title={domain.name}>
            {domain.purpose === null ? null : <p className={styles.purpose}>{domain.purpose}</p>}
            <ul className={styles.systems}>
              {domain.systems.map((system) => (
                <li key={system.id}>
                  <span className={styles.system}>{system.name}</span>
                  {system.does === '' ? null : <span className={styles.does}>{system.does}</span>}
                </li>
              ))}
            </ul>
            <p className={styles.size}>
              {domain.size}
              {domain.role === null ? null : ` · ${domain.role}`}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Empty({ folder }: { readonly folder: string }) {
  return (
    <Callout title="No domains yet">
      <p>
        Add a domain as a folder with a <code>domain.yaml</code> under{' '}
        <code>workspaces/{folder}/domains/</code>, then its systems under <code>systems/</code>.
      </p>
    </Callout>
  );
}

// The whole workspace, in the order a newcomer learns it: how the company works, the map, the journeys that carry
// the work, each domain, and, set apart, what may change.
export function LandscapePage(props: LandscapePageProps) {
  const { landscape, folder, nav, map, plans, overlays, actions } = props;
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav}
      overlays={overlays}
      title={landscape.name}
      trail={[{ label: 'Workspaces', href: '/' }]}
    >
      <PageHeader
        description={landscape.headline}
        meta={<Facts items={landscape.facts} />}
        title={landscape.name}
      >
        {landscape.summary === null ? null : <Markdown text={landscape.summary} />}
      </PageHeader>
      {landscape.domains.length === 0 ? (
        <Empty folder={folder} />
      ) : (
        <>
          {map === undefined || map === null ? null : (
            <section className={styles.section}>
              <SectionHeading title="Map">
                <p>
                  Every system, read left to right through the stages of the work. Open Full for
                  each component; click any card or line to see what it is.
                </p>
              </SectionHeading>
              {map}
            </section>
          )}
          <section className={styles.section}>
            <SectionHeading title="Journeys">
              <p>
                How work moves across the systems, from what sets it off to how it ends. Open one to
                walk it.
              </p>
            </SectionHeading>
            <JourneyCards cards={landscape.journeys} />
          </section>
          <section className={styles.section}>
            <SectionHeading title="Domains">
              <p>Each domain, the systems in it, and its part in the journeys.</p>
            </SectionHeading>
            <DomainCards domains={landscape.domains} />
          </section>
        </>
      )}
      {plans === undefined ? null : (
        <section className={styles.apart}>
          <SectionHeading title="Plans">
            <p>What may change. Each plan shows its own picture of the systems after it lands.</p>
          </SectionHeading>
          <PlanCards plans={plans} />
        </section>
      )}
    </WorkspaceShell>
  );
}
