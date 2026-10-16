import type { Model } from '@/application/plan/derive';
import {
  journeyClaim,
  type TodayJourney as Journey,
  todayJourneysOf,
} from '@/application/today-journeys';
import { journeyHref, todayReaderOf } from '@/application/today-reader';
import { workspaceHref } from '@/application/workspace-paths';
import { ScenarioWalk } from '@/features/plan/chapters/journey/scenario-walk.client';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { plain } from '@/shared/plain-text';
import { PageHeader } from '@/ui/page-header';

import styles from './journey-walk.module.css';

interface TodayJourneyProps {
  readonly workspace: string;
  readonly model: Model;
  /** The journey's key under journeys/. */
  readonly journey: string;
}

const ORDER =
  'Steps follow the order each flow is drawn in; work set off by an event can finish separately.';

const plainOf = (model: Model, text: string | undefined): string =>
  plain(text, (id) => model.label(id));

function FlowHead({
  model,
  id,
  many,
}: {
  readonly model: Model;
  readonly id: string;
  readonly many: boolean;
}) {
  const node = model.asIs.get(id);
  const flow = node?.$type === 'flow' ? node : null;
  const lines = [
    ['Starts when', plainOf(model, flow?.trigger)],
    ['Comes to', plainOf(model, flow?.outcome)],
  ].filter(([, text]) => text !== '');
  return (
    <header className={styles.head}>
      {many ? <h2 className={styles.flow}>{model.label(id)}</h2> : null}
      {lines.map(([label, text]) => (
        <p className={styles.line} key={label}>
          <strong>{label}</strong> {text}
        </p>
      ))}
    </header>
  );
}

function Moves({ model, journey }: { readonly model: Model; readonly journey: Journey }) {
  const node = model.asIs.get(journey.id);
  if (node?.$type !== 'userJourney') return null;
  return (
    <details className={styles.context} data-keep="journey">
      <summary>The journey, move by move</summary>
      <ol className={styles.moves}>
        {node.interactions.map((id, index) => {
          const move = model.asIs.get(id);
          const to = move?.$type === 'interaction' ? move.to : null;
          return (
            <li key={`${id}-${String(index)}`}>
              {model.label(id)}
              {to === null ? null : (
                <>
                  {' → '}
                  <EntityChip id={to} model={model} status="existing" />
                </>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.order}>{ORDER}</p>
    </details>
  );
}

function Context({ model, journey }: { readonly model: Model; readonly journey: Journey }) {
  if (journey.kind === 'journey') return <Moves journey={journey} model={model} />;
  return (
    <details className={styles.context} data-keep="scenario">
      <summary>How to read the steps</summary>
      <p className={styles.order}>{ORDER}</p>
    </details>
  );
}

/** One journey walked a step at a time as it runs today, with the keys and the page held steady. */
export function TodayJourney({ workspace, model, journey: key }: TodayJourneyProps) {
  const journey = todayJourneysOf(model).find((j) => j.key === key);
  if (journey === undefined) return null;
  const many = journey.flows.length > 1;
  const actor = journey.actor === '' ? '' : ` Started by: ${journey.actor}.`;
  return (
    <>
      <PageHeader description={`${journeyClaim(journey)}${actor}`} title={journey.title} />
      <ScenarioWalk
        base={workspaceHref(workspace)}
        context={<Context journey={journey} model={model} />}
        flows={journey.flows.map((id) => ({ id, option: model.label(id) }))}
        heads={Object.fromEntries(
          journey.flows.map((id) => [id, <FlowHead id={id} key={id} many={many} model={model} />]),
        )}
        href={journeyHref(workspace, journey.key)}
        src={todayReaderOf(workspace, 2).modelSrc}
        today
      />
    </>
  );
}
