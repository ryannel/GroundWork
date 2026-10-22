import type { ReactNode } from 'react';

import { type DomainNav, sectionId } from '@/application/domain-nav';
import type { PlanPart } from '@/application/plan-footprint';
import type { RepoRow } from '@/application/today-repos';
import type { SystemView } from '@/application/workspace-system';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { CatalogueList } from './catalogue-list';
import { ComponentCards } from './component-cards';
import { JourneysHere } from './journey-cards';
import { NeighbourList } from './neighbour-list';
import { PlanParts } from './plan-parts';
import styles from './system-page.module.css';
import { WorkspaceShell } from './workspace-shell';

interface SystemPageProps {
  readonly view: SystemView;
  readonly nav: DomainNav;
  /** The map of the system's components and their neighbours, drawn by the route. */
  readonly map?: ReactNode;
  /** The flows through the system, step by step, drawn by the route. */
  readonly flows?: ReactNode;
  /** The plans landing on this system; leave out and the section is not drawn. */
  readonly parts?: readonly PlanPart[];
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
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
    <section className={styles.section} id={sectionId(title)}>
      <SectionHeading title={title}>
        <p>{says}</p>
      </SectionHeading>
      {children}
    </section>
  );
}

function Repos({ repos }: { readonly repos: readonly RepoRow[] }) {
  if (repos.length === 0) {
    return <p className={styles.none}>No repo is named for this system yet.</p>;
  }
  return (
    <ul className={styles.repos}>
      {repos.map((repo) => (
        <li className={styles.repo} data-scanned={repo.scanned} key={repo.repo}>
          <a className={styles.name} href={repo.href}>
            {repo.repo}
          </a>
          <span className={styles.read}>{repo.read}</span>
          {repo.moved === null ? null : <span className={styles.cited}>{repo.moved}</span>}
          <span className={styles.cited}>{repo.cited}</span>
        </li>
      ))}
    </ul>
  );
}

function Drawn({ view, map, flows }: Pick<SystemPageProps, 'view' | 'map' | 'flows'>) {
  return (
    <>
      {map === undefined || map === null ? null : (
        <Section
          says="Its components, with what calls them and what they call. Dotted cards sit outside it, one step away. Click any card or line to see what it is."
          title="Map"
        >
          {map}
        </Section>
      )}
      <Section says="The systems just outside it, and which way the work goes." title="Edges">
        <NeighbourList name={view.name} neighbours={view.neighbours} />
      </Section>
      {flows === undefined || flows === null || view.flows.length === 0 ? null : (
        <Section
          says="The work that runs through it, most steps here first. Step through each flow on the drawing, or read it as a sequence."
          title="Flows"
        >
          {flows}
        </Section>
      )}
    </>
  );
}

// One system, in the order a newcomer learns it: its job and owner, the plans that would change it, the map and
// where it ends, the flows through it, each component, the data it keeps and the user journeys that pass through
// it. Where its code lives, and how fresh our reading of it is, comes last.
export function SystemPage({ view, nav, map, flows, parts, overlays, actions }: SystemPageProps) {
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav.groups}
      navTop={nav.top}
      overlays={overlays}
      title={view.name}
      trail={[{ label: 'Workspaces', href: '/' }, ...view.trail]}
    >
      <PageHeader
        description={view.headline}
        meta={<Facts items={[view.about, ...view.facts]} />}
        title={view.name}
      />
      <Section says="What may change here." title="Plans">
        <PlanParts name={view.name} parts={parts ?? []} />
      </Section>
      <Drawn flows={flows} map={map} view={view} />
      <Section
        says="What each component does. Open the line under one for what it answers, calls, announces, hears and keeps."
        title="Components"
      >
        <ComponentCards cards={view.components} />
      </Section>
      {view.data.length === 0 ? null : (
        <Section
          says="Its stores and the records in each. Click a record to see its fields."
          title="Data"
        >
          <CatalogueList catalogue={{ apis: [], events: [], data: view.data }} />
        </Section>
      )}
      <Section
        says="The user journeys that pass through it. Open one to walk it end to end."
        title="User journeys"
      >
        <JourneysHere all={view.allJourneys} cards={view.journeys} />
      </Section>
      <Section
        says="Where its code lives, and whether what this page says has been read from it."
        title="Code"
      >
        <Repos repos={view.repos} />
      </Section>
    </WorkspaceShell>
  );
}
