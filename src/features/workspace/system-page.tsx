import type { ReactNode } from 'react';

import type { PlanPart } from '@/application/plan-footprint';
import type { RepoRow } from '@/application/today-repos';
import type { NavGroup } from '@/application/workspace-nav';
import type { SystemView } from '@/application/workspace-system';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { CatalogueList } from './catalogue-list';
import { ComponentCards } from './component-cards';
import { JourneyCards } from './journey-cards';
import { NeighbourList } from './neighbour-list';
import { PlanParts } from './plan-parts';
import styles from './system-page.module.css';
import { WorkspaceShell } from './workspace-shell';

interface SystemPageProps {
  readonly view: SystemView;
  readonly nav: readonly NavGroup[];
  /** The map of the system's components and their neighbours, drawn by the route. */
  readonly map?: ReactNode;
  /** The flows through the system, step by step, drawn by the route. */
  readonly flows?: ReactNode;
  /** The plans landing on this system; leave out and the section is not drawn. */
  readonly parts?: readonly PlanPart[];
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

function Section(props: {
  readonly title: string;
  readonly says: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <SectionHeading title={props.title}>
        <p>{props.says}</p>
      </SectionHeading>
      {props.children}
    </section>
  );
}

function Repos({ repos }: { readonly repos: readonly RepoRow[] }) {
  if (repos.length === 0)
    return <p className={styles.none}>No repo is named for this system yet.</p>;
  return (
    <ul className={styles.repos}>
      {repos.map((repo) => (
        <li className={styles.repo} data-scanned={repo.scanned} key={repo.repo}>
          <a className={styles.name} href={repo.href}>
            {repo.repo}
          </a>
          <span className={styles.read}>{repo.read}</span>
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
      {flows === undefined || flows === null || view.flows.length === 0 ? null : (
        <Section
          says="The flows with steps here, most steps here first: who calls whom, in order."
          title="Flows"
        >
          {flows}
        </Section>
      )}
    </>
  );
}

// One system, in the order a newcomer learns it: its job and owner, how fresh our reading of its code is, where it
// ends, the map, the flows through it, each component, the data it keeps, and the plans that would change it.
export function SystemPage({ view, nav, map, flows, parts, overlays, actions }: SystemPageProps) {
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav}
      overlays={overlays}
      title={view.name}
      trail={[{ label: 'Workspaces', href: '/' }, ...view.trail]}
    >
      <PageHeader description={view.headline} meta={<Facts items={view.facts} />} title={view.name}>
        <p className={styles.about}>{view.about}.</p>
      </PageHeader>
      <Section
        says="Where its code lives, and whether what this page says has been read from it."
        title="Code"
      >
        <Repos repos={view.repos} />
      </Section>
      <Section says="The systems just outside it, and which way the work goes." title="Edges">
        <NeighbourList name={view.name} neighbours={view.neighbours} />
      </Section>
      <Drawn flows={flows} map={map} view={view} />
      <Section
        says="What each component does, what it is called on, what it calls, what it announces and hears, and what it keeps."
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
        says="The journeys and flows that pass through it. Open one to walk it end to end."
        title="Journeys"
      >
        <JourneyCards cards={view.journeys} />
      </Section>
      {parts === undefined ? null : (
        <section className={styles.apart}>
          <SectionHeading title="Plans">
            <p>What may change here.</p>
          </SectionHeading>
          <PlanParts parts={parts} where="this system" />
        </section>
      )}
    </WorkspaceShell>
  );
}
