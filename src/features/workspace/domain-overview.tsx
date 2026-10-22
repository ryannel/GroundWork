import type { ReactNode } from 'react';

import type { DomainView } from '@/application/workspace-domain';
import { SectionHeading } from '@/ui/section-heading';

import styles from './domain-overview.module.css';
import { DomainHeader } from './domain-page';
import { FlowsPreview, LanguagePreview, type WordsPreview } from './domain-previews';
import { DomainSystems } from './domain-systems';
import { JourneysHere } from './journey-cards';
import { NeighbourList } from './neighbour-list';

interface DomainOverviewProps {
  readonly view: DomainView;
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

// The first page of a domain: how big it is and who runs it, each system, the systems just outside it, the busiest flows and the
// words it owns. Each part is short and leads to its own page for the rest; Plans lists what may change.
export function DomainOverview({ view, words = null }: DomainOverviewProps) {
  return (
    <>
      <DomainHeader view={view} />
      <Section id="systems" title="Systems">
        <DomainSystems systems={view.systems} />
      </Section>
      {view.neighbours.reaches.length + view.neighbours.reachedBy.length === 0 ? null : (
        <Section
          says="The systems just outside the domain, and which way the work goes."
          title="Edges"
        >
          <NeighbourList name={view.name} neighbours={view.neighbours} />
        </Section>
      )}
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
