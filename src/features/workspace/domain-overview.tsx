import type { ReactNode } from 'react';

import type { DomainDiagram } from '@/application/domain-diagram';
import type { PlanPart } from '@/application/plan-footprint';
import type { DomainView } from '@/application/workspace-domain';
import { SectionHeading } from '@/ui/section-heading';

import { DomainDiagramView } from './domain-diagram.client';
import styles from './domain-overview.module.css';
import { FlowsPreview, LanguagePreview, type WordsPreview } from './domain-previews';
import { DomainSystems } from './domain-systems';
import { JourneysHere } from './journey-cards';
import { NeighbourList } from './neighbour-list';
import { PlanParts } from './plan-parts';

interface DomainOverviewProps {
  readonly view: DomainView;
  readonly diagram: DomainDiagram;
  /** The plans landing on the domain's systems. */
  readonly parts: readonly PlanPart[];
  /** The words the domain owns; null when it has written none down. */
  readonly words?: WordsPreview | null;
}

interface SectionProps {
  readonly id?: string;
  readonly title: string;
  readonly says?: string;
  readonly children: ReactNode;
}

function Section({ id, title, says, children }: SectionProps) {
  return (
    <section className={styles.section} id={id}>
      <SectionHeading title={title}>{says === undefined ? null : <p>{says}</p>}</SectionHeading>
      {children}
    </section>
  );
}

function Diagram({ view, diagram }: Pick<DomainOverviewProps, 'view' | 'diagram'>) {
  return (
    <Section
      says="Who uses each system and which calls which. Point at a box to light its lines; dashed boxes sit in other domains."
      title="How the systems work together"
    >
      <DomainDiagramView diagram={diagram} />
      <details className={styles.more}>
        <summary>Read the systems outside the domain as a list</summary>
        <NeighbourList name={view.name} neighbours={view.neighbours} />
      </details>
    </Section>
  );
}

// The first tab of a domain: what may change, how its systems fit together, each system, the busiest flows and the
// words it owns. Each part is short and leads to its own tab for the rest.
export function DomainOverview({ view, diagram, parts, words = null }: DomainOverviewProps) {
  return (
    <>
      <Section says="What may change here, and how far each plan has got." title="Plans">
        <PlanParts parts={parts} where="this domain" />
      </Section>
      <Diagram diagram={diagram} view={view} />
      <Section id="systems" title="Systems">
        <DomainSystems systems={view.systems} />
      </Section>
      {view.flows.length === 0 ? null : (
        <Section says="The flows with the most steps here." title="Busiest flows">
          <FlowsPreview flows={view.flows} href={`${view.href}flows/`} />
        </Section>
      )}
      {words === null ? null : (
        <Section title="Language">
          <LanguagePreview href={`${view.href}language/`} preview={words} />
        </Section>
      )}
      {view.journeys.some((j) => j.kind === 'journey') ? (
        <Section says="The user journeys with steps here, most steps first." title="User journeys">
          <JourneysHere all={view.allJourneys} cards={view.journeys} />
        </Section>
      ) : null}
    </>
  );
}
