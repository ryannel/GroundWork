import type { Model } from '@/application/plan/derive';
import {
  flowsByStage,
  journeyClaim,
  journeysHeadline,
  type TodayJourney,
  todayJourneysOf,
} from '@/application/today-journeys';
import { journeyHref } from '@/application/today-reader';
import { Card } from '@/ui/card';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import styles from './journey-index.module.css';

interface TodayJourneysProps {
  readonly workspace: string;
  readonly model: Model;
}

interface CardProps {
  readonly workspace: string;
  readonly model: Model;
  readonly journey: TodayJourney;
}

function JourneyCard({ workspace, model, journey }: CardProps) {
  const facts: readonly (readonly [string, string])[] = [
    ['Who', journey.actor],
    ['Starts', journey.trigger],
    ['Comes to', journey.outcome],
    ['Systems', journey.systems.map((id) => model.label(id)).join(', ')],
  ];
  return (
    <li>
      <Card href={journeyHref(workspace, journey.key)} title={journey.title}>
        <p className={styles.claim}>{journeyClaim(journey)}</p>
        <dl className={styles.facts}>
          {facts
            .filter(([, value]) => value !== '')
            .map(([label, value]) => (
              <div className={styles.fact} key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      </Card>
    </li>
  );
}

function Cards({
  workspace,
  model,
  journeys,
}: Omit<CardProps, 'journey'> & {
  readonly journeys: readonly TodayJourney[];
}) {
  return (
    <ul className={styles.cards}>
      {journeys.map((journey) => (
        <JourneyCard journey={journey} key={journey.key} model={model} workspace={workspace} />
      ))}
    </ul>
  );
}

/** Every journey through the workspace today: what people do first, then each flow by the stage it serves. */
export function TodayJourneys({ workspace, model }: TodayJourneysProps) {
  const journeys = todayJourneysOf(model);
  const people = journeys.filter((j) => j.kind === 'journey');
  const stages = flowsByStage(model, journeys);
  return (
    <>
      <PageHeader description={journeysHeadline(journeys)} title="Journeys">
        <p>Open one to walk it a step at a time: → and ← move one step, and the page stays put.</p>
      </PageHeader>
      {journeys.length === 0 ? (
        <p className={styles.empty}>No journeys or flows are recorded for this workspace yet.</p>
      ) : null}
      {people.length === 0 ? null : (
        <section className={styles.section}>
          <SectionHeading title="User journeys">
            <p>What a person does, walked across the flows that serve each move.</p>
          </SectionHeading>
          <Cards journeys={people} model={model} workspace={workspace} />
        </section>
      )}
      {stages.length === 0 ? null : (
        <section className={styles.section}>
          <SectionHeading title="Flows">
            <p>The work the systems do, grouped by the stage it serves.</p>
          </SectionHeading>
          {stages.map((stage) => (
            <div className={styles.stage} key={stage.stage}>
              <h3 className={styles.stageTitle}>{stage.title}</h3>
              <Cards journeys={stage.journeys} model={model} workspace={workspace} />
            </div>
          ))}
        </section>
      )}
    </>
  );
}
