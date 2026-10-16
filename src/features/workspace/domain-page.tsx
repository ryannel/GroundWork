import type { ReactNode } from 'react';

import type { PlanPart } from '@/application/plan-footprint';
import type { DomainSystemCard, DomainView } from '@/application/workspace-domain';
import type { NavGroup } from '@/application/workspace-nav';
import { Card } from '@/ui/card';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { CatalogueList } from './catalogue-list';
import styles from './domain-page.module.css';
import { JourneyCards } from './journey-cards';
import { NeighbourList } from './neighbour-list';
import { PlanParts } from './plan-parts';
import { WorkspaceShell } from './workspace-shell';

interface DomainPageProps {
  readonly view: DomainView;
  readonly nav: readonly NavGroup[];
  /** The map of the domain's components and their neighbours, drawn by the route. */
  readonly map?: ReactNode;
  /** The plans landing on the domain's systems; leave out and the section is not drawn. */
  readonly parts?: readonly PlanPart[];
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

function SystemCards({ systems }: { readonly systems: readonly DomainSystemCard[] }) {
  return (
    <ul className={styles.systems}>
      {systems.map((system) => (
        <li key={system.id}>
          <Card href={system.href} title={system.name}>
            {system.does === '' ? null : <p className={styles.does}>{system.does}</p>}
            <p className={styles.about}>{system.about.join(' · ')}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  says,
  children,
}: {
  readonly title: string;
  readonly says: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <SectionHeading title={title}>
        <p>{says}</p>
      </SectionHeading>
      {children}
    </section>
  );
}

// One domain, in the order a newcomer learns it: what it is for and where it ends, the map of its components,
// the journeys through it, each system, what it offers, announces and keeps, and the plans that would change it.
export function DomainPage({ view, nav, map, parts, overlays, actions }: DomainPageProps) {
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
      <PageHeader description={view.headline} meta={<Facts items={view.facts} />} title={view.name}>
        {view.purpose === null ? null : <p className={styles.purpose}>{view.purpose}</p>}
      </PageHeader>
      <Section
        says="The systems just outside the domain, and which way the work goes."
        title="Edges"
      >
        <NeighbourList name={view.name} neighbours={view.neighbours} />
      </Section>
      {map === undefined || map === null ? null : (
        <Section
          says="Each component in the domain, grouped by system. Dotted cards sit outside it, one step away. Click any card or line to see what it is."
          title="Map"
        >
          {map}
        </Section>
      )}
      <Section
        says="The journeys and flows with steps in this domain, most steps here first. Open one to walk it."
        title="Journeys"
      >
        <JourneyCards cards={view.journeys} />
      </Section>
      <Section says="What each system does, who runs it and where its code is." title="Systems">
        <SystemCards systems={view.systems} />
      </Section>
      <Section
        says="The calls the domain answers, the events it announces and the data it keeps. Click a name to see it."
        title="Interfaces, events and data"
      >
        <CatalogueList catalogue={view.catalogue} />
      </Section>
      {parts === undefined ? null : (
        <section className={styles.apart}>
          <SectionHeading title="Plans">
            <p>What may change here.</p>
          </SectionHeading>
          <PlanParts parts={parts} where="this domain" />
        </section>
      )}
    </WorkspaceShell>
  );
}
