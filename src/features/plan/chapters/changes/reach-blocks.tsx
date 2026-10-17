import { planHref, type Outline } from '@/application/plan-pages';
import { screenClaim } from '@/application/plan-story-changes-flows';
import { bySeverity } from '@/application/plan-story-changes-records';
import type { Reach } from '@/application/plan-story-changes-touched';
import { ladderSummary } from '@/application/plan-viz-ladder';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Ladder } from '@/features/plan/viz/ladder/ladder';
import { BeforeAfter } from '@/features/plan/viz/screens/before-after';

import { Block, JourneyLink } from './changes-kit';
import { RetiredList, SequenceNotes, ShapesList } from './contracts-parts';
import styles from './reach-blocks.module.css';
import { RecordTable } from './record-screen';

type Model = BodyProps['model'];

function Records({ model, ids }: { readonly model: Model; readonly ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <Block title="Records that change">
      <div className={styles.stack}>
        {bySeverity(model, ids).map((id) => (
          <RecordTable id={id} key={id} model={model} />
        ))}
      </div>
    </Block>
  );
}

function Screens({
  model,
  outline,
  ids,
}: {
  readonly model: Model;
  readonly outline: Outline;
  readonly ids: readonly string[];
}) {
  if (ids.length === 0) return null;
  return (
    <Block title={ids.length === 1 ? 'The screen that changes' : 'The screens that change'}>
      {ids.map((id) => (
        <div className={styles.stack} key={id}>
          <h4 className={styles.claim}>{screenClaim(model, id)}</h4>
          <BeforeAfter
            base={planHref(outline)}
            focus={model
              .screenDiff(id)
              .regions.filter((r) => r.status !== 'existing')
              .map((r) => r.id)}
            id={id}
            model={model}
          />
          <JourneyLink label={model.label(id)} model={model} outline={outline} screenId={id} />
        </div>
      ))}
    </Block>
  );
}

function Contracts({ model, reach }: { readonly model: Model; readonly reach: Reach }) {
  return (
    <>
      {reach.ladders.map((id) => {
        const sum = ladderSummary(model, id);
        return (
          <div className={styles.stack} key={id}>
            <SequenceNotes model={model} seq={sum?.sequence ?? null} />
            <Block title={sum?.sequence?.sentences[0] ?? sum?.headline ?? model.label(id)}>
              <Ladder id={id} model={model} />
            </Block>
          </div>
        );
      })}
      <RetiredList ids={reach.retired} model={model} />
      <ShapesList ids={reach.shapes} model={model} />
    </>
  );
}

/** The records, screens and interfaces a change reaches, drawn in full. */
export function Inline({ model, outline, reach }: BodyProps & { readonly reach: Reach }) {
  return (
    <>
      <Records ids={reach.records} model={model} />
      <Screens ids={reach.screens} model={model} outline={outline} />
      <Contracts model={model} reach={reach} />
    </>
  );
}
