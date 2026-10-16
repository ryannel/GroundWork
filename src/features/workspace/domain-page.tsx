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
import { JourneysHere } from './journey-cards';
import { NeighbourList } from './neighbour-list';
import { PlanParts } from './plan-parts';
import { WorkspaceShell } from './workspace-shell';

interface DomainPageProps {
  readonly view: DomainView;
  readonly nav: readonly NavGroup[];
  /** The map of the domain's components and their neighbours, drawn by the route. */
  readonly map?: ReactNode;
  /** The list of flows with a step here, beside the one chosen; drawn by the route. */
  readonly flows?: ReactNode;
  /** The words the domain owns and what each system calls them; drawn by the route. */
  readonly language?: ReactNode;
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

// One domain, in the order a newcomer learns it: what it is for, the plans that would change it, where it ends,
// the map of its components, the flows and user journeys through it, each system, the words it owns, and what it
// offers, announces and keeps. A domain can carry hundreds of flows, so they are a list beside the one drawn, not a wall of cards.
export function DomainPage(props: DomainPageProps) {
  const { view, nav, map, flows, language, parts, overlays, actions } = props;
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
      {parts === undefined ? null : (
        <Section says="What may change here." title="Plans">
          <PlanParts parts={parts} where="this domain" />
        </Section>
      )}
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
      {flows === undefined || flows === null || view.flows.length === 0 ? null : (
        <Section
          says="The work with steps in this domain, grouped by the system it comes in through, most steps here first. Step through each flow on the drawing, or read it as a sequence."
          title="Flows"
        >
          {flows}
        </Section>
      )}
      <Section
        says="The user journeys with steps in this domain, most steps here first. Open one to walk it end to end."
        title="User journeys"
      >
        <JourneysHere all={view.allJourneys} cards={view.journeys} />
      </Section>
      <Section says="What each system does, who runs it and where its code is." title="Systems">
        <SystemCards systems={view.systems} />
      </Section>
      {language === undefined || language === null ? null : (
        <Section
          says="The words this domain owns: what each means, where it is created, and what each system calls it. Click a word to see it."
          title="Language"
        >
          {language}
        </Section>
      )}
      <Section
        says="The calls the domain answers, the events it announces and the data it keeps. Click a name to see it."
        title="Interfaces, events and data"
      >
        <CatalogueList catalogue={view.catalogue} />
      </Section>
    </WorkspaceShell>
  );
}
