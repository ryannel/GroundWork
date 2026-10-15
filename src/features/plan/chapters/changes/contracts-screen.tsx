import { contractClaim } from '@/application/plan-story-changes-claims';
import { changesOf, type Touched } from '@/application/plan-story-changes-touched';
import { ladderSummary } from '@/application/plan-viz-ladder';
import { sequencing } from '@/application/plan-viz-ladder-order';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelInline } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Ladder } from '@/features/plan/viz/ladder/ladder';
import { SegTabs } from '@/features/plan/viz/query-plan/seg-tabs.client';

import { Decisions, TeamRow } from './changes-kit';
import { RetiredList, SequenceNotes, ShapesList } from './contracts-parts';

const uniq = <T,>(xs: readonly T[]): T[] => [...new Set(xs)];

interface PanelProps extends BodyProps {
  readonly t: Touched;
  readonly ladder: string | null;
  readonly last: boolean;
  readonly item?: string | undefined;
}

type Summary = ReturnType<typeof ladderSummary>;

function ledeOf(sum: Summary): string {
  if (sum?.sequence !== null) return '';
  return sum.deadline === '' ? sum.retire : sum.deadline;
}

function changesFor(
  model: PanelProps['model'],
  ladder: string | null,
  behind: readonly string[],
): string[] {
  const rungs = ladder === null ? [] : model.ladder(ladder).rungs.flatMap((r) => r.changes);
  return uniq([...rungs, ...behind.flatMap((id) => changesOf(model, id))]);
}

function Lede({ model, text }: { readonly model: PanelProps['model']; readonly text: string }) {
  if (text === '') return null;
  return (
    <p>
      <ModelInline model={model} text={text} />
    </p>
  );
}

function Panel({ model, outline, page, t, ladder, last, item }: PanelProps) {
  const sum = ladder === null ? null : ladderSummary(model, ladder);
  const seq = sum?.sequence ?? null;
  const headline = seq?.sentences[0] ?? sum?.headline ?? contractClaim(model, t.retired, t.shapes);
  const changes = changesFor(model, ladder, last ? [...t.retired, ...t.shapes] : []);
  return (
    <>
      <ScreenHead headline={headline} item={item} outline={outline} page={page}>
        <Lede model={model} text={ledeOf(sum)} />
      </ScreenHead>
      <TeamRow model={model} teamIds={uniq(changes.flatMap((c) => model.teamsOf(c)))} />
      <SequenceNotes model={model} seq={seq} />
      {ladder === null ? null : <Ladder id={ladder} model={model} />}
      {last ? <RetiredList ids={t.retired} model={model} /> : null}
      {last ? <ShapesList ids={t.shapes} model={model} /> : null}
      <Decisions changeIds={changes} model={model} />
    </>
  );
}

/** Interfaces that get a new version, one tab each; what goes away or changes shape rides on the last. */
export function ContractsScreen({ t, ...props }: BodyProps & { readonly t: Touched }) {
  const { model } = props;
  if (t.ladders.length === 0) return <Panel {...props} last ladder={null} t={t} />;
  const many = t.ladders.length > 1;
  return (
    <>
      {many ? <ScreenHead outline={props.outline} page={props.page} /> : null}
      <SegTabs
        label="Versioned interfaces"
        stepped
        tabs={t.ladders.map((id, i) => ({
          key: id,
          label: `${model.label(id)}${sequencing(model, id) === null ? '' : ' ⚠'}`,
          content: (
            <Panel
              {...props}
              item={many ? model.label(id) : undefined}
              ladder={id}
              last={i === t.ladders.length - 1}
              t={t}
            />
          ),
        }))}
      />
    </>
  );
}
