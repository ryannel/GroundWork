import Link from 'next/link';

import { pageHref, planHref, type Outline } from '@/application/plan-pages';
import type { ChangeBody } from '@/application/plan-pages-screens-changes';
import { contractClaim } from '@/application/plan-story-changes-claims';
import { screenClaim } from '@/application/plan-story-changes-flows';
import { bySeverity, fit, recordClaim } from '@/application/plan-story-changes-records';
import { type Reach, changesOf } from '@/application/plan-story-changes-touched';
import { ladderSummary } from '@/application/plan-viz-ladder';
import { andList } from '@/application/plan-viz-ladder-order';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelInline } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Ladder } from '@/features/plan/viz/ladder/ladder';
import { BeforeAfter } from '@/features/plan/viz/screens/before-after';

import { Block, Decisions, JourneyLink } from './changes-kit';
import { RetiredList, SequenceNotes, ShapesList } from './contracts-parts';
import { FlowPanel } from './flow-screen';
import { RecordTable } from './record-screen';
import styles from './small-screens.module.css';

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

function Inline({ model, outline, reach }: BodyProps & { readonly reach: Reach }) {
  return (
    <>
      <Records ids={reach.records} model={model} />
      <Screens ids={reach.screens} model={model} outline={outline} />
      <Contracts model={model} reach={reach} />
    </>
  );
}

function LedgerLink({ outline }: { readonly outline: Outline }) {
  if (!outline.pages.some((p) => p.chapter === 'ref' && p.screen === 'ledger')) return null;
  return (
    <p className={styles.link}>
      <Link href={pageHref(outline, 'ref', 'ledger')}>
        Every change, with its edits, is in Reference → Changes
      </Link>
    </p>
  );
}

function claimOf(model: Model, reach: Reach): string | null {
  const [record] = bySeverity(model, reach.records);
  if (record !== undefined) return recordClaim(model, record);
  const [ladder] = reach.ladders;
  if (ladder !== undefined) return ladderSummary(model, ladder)?.headline ?? null;
  return reach.retired.length > 0 || reach.shapes.length > 0
    ? contractClaim(model, reach.retired, reach.shapes)
    : null;
}

type SmallFlow = Extract<ChangeBody, { kind: 'small-flow' }>;
type More = Extract<ChangeBody, { kind: 'more' }>;

/** A flow that changes, and everything its steps reach that changes with it. */
export function SmallFlowScreen({ body, ...props }: BodyProps & { readonly body: SmallFlow }) {
  const { model, outline } = props;
  return (
    <FlowPanel
      {...props}
      claim={claimOf(model, body.reach)}
      id={body.id}
      tail={body.last ? <LedgerLink outline={outline} /> : undefined}
    >
      <Inline {...props} reach={body.reach} />
    </FlowPanel>
  );
}

function leadOf(model: Model, reach: Reach): string {
  const [record] = bySeverity(model, reach.records);
  if (record !== undefined) return recordClaim(model, record);
  const [screen] = reach.screens;
  if (screen !== undefined) return screenClaim(model, screen);
  const [ladder] = reach.ladders;
  if (ladder !== undefined) {
    const sum = ladderSummary(model, ladder);
    return sum?.sequence?.sentences[0] ?? sum?.headline ?? 'An interface changes';
  }
  return contractClaim(model, reach.retired, reach.shapes);
}

/** What no flow that changes reaches. */
export function MoreScreen({ body, ...props }: BodyProps & { readonly body: More }) {
  const { model, outline, page } = props;
  const { head, rest } = fit(leadOf(model, body.reach));
  const kinds = [
    body.reach.records.length > 0 ? 'records' : '',
    body.reach.screens.length > 0 ? 'screens' : '',
    body.reach.ladders.length + body.reach.retired.length + body.reach.shapes.length > 0
      ? 'interfaces'
      : '',
  ].filter((k) => k !== '');
  return (
    <>
      <ScreenHead headline={head} outline={outline} page={page}>
        {rest === '' ? null : (
          <p>
            <ModelInline model={model} text={rest} />
          </p>
        )}
        <p>No flow that changes reaches {andList(kinds)} here.</p>
      </ScreenHead>
      <Inline {...props} reach={body.reach} />
      <Decisions
        changeIds={[...body.reach.records, ...body.reach.retired].flatMap((id) =>
          changesOf(model, id),
        )}
        model={model}
      />
      <LedgerLink outline={outline} />
    </>
  );
}
