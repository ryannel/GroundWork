import { planHref } from '@/application/plan-pages';
import { screenClaim } from '@/application/plan-story-changes-flows';
import { changesOf, teamsBehind } from '@/application/plan-story-changes-touched';
import { numWord } from '@/application/plan-viz-text';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { SegTabs } from '@/features/plan/viz/query-plan/seg-tabs.client';
import { BeforeAfter } from '@/features/plan/viz/screens/before-after';
import { RegionList } from '@/features/plan/viz/screens/region-list';
import { ScreenLinks } from '@/features/plan/viz/screens/screen-links';

import { Block, Decisions, JourneyLink, TeamRow } from './changes-kit';

const uniq = <T,>(xs: readonly T[]): T[] => [...new Set(xs)];

function ledeOf(props: BodyProps, id: string): string {
  const { model } = props;
  const d = model.screenDiff(id);
  const changed = d.regions.filter((r) => r.status !== 'existing');
  const flows = model.flowsOnScreen(id, 'either').map((f) => f.flow);
  const count = flows.length === 1 ? 'one flow' : `${numWord(flows.length)} flows`;
  const names = flows
    .slice(0, 3)
    .map((f) => model.label(f))
    .join(', ');
  const used = flows.length === 0 ? '' : `Used in ${count}: ${names}.`;
  return [
    d.pictureChanges ? '' : 'The picture stays the same.',
    changed.length > 0 ? 'Outlined regions change.' : '',
    used,
  ]
    .filter((x) => x !== '')
    .join(' ');
}

const regionsTitle = (n: number): string => (n > 0 ? `Regions · ${String(n)} changed` : 'Regions');

/** A screen the plan changes, before and after, with the regions that change. */
function ScreenPanel(
  props: BodyProps & { readonly id: string; readonly item?: string | undefined },
) {
  const { model, outline, page, id, item } = props;
  const d = model.screenDiff(id);
  const focus = d.regions.filter((r) => r.status !== 'existing').map((r) => r.id);
  const changes = uniq([
    ...changesOf(model, id),
    ...d.regions.flatMap((r) => changesOf(model, r.id)),
  ]);
  const base = planHref(outline);
  const lede = ledeOf(props, id);
  return (
    <>
      <ScreenHead headline={screenClaim(model, id)} item={item} outline={outline} page={page}>
        {lede === '' ? null : <p>{lede}</p>}
      </ScreenHead>
      <TeamRow model={model} teamIds={teamsBehind(model, changes)} />
      <BeforeAfter base={base} focus={focus} id={id} model={model} />
      <ScreenLinks base={base} id={id} mode="toBe" model={model} />
      <Block title={regionsTitle(focus.length)}>
        <RegionList
          focus={focus}
          id={id}
          mode={model.status(id) === 'removed' ? 'asIs' : 'toBe'}
          model={model}
          numbered
        />
      </Block>
      <JourneyLink label={model.label(id)} model={model} outline={outline} screenId={id} />
      <Decisions changeIds={changes} model={model} />
    </>
  );
}

export function ScreensScreen({ ids, ...props }: BodyProps & { readonly ids: readonly string[] }) {
  const many = ids.length > 1;
  return (
    <>
      {many ? <ScreenHead outline={props.outline} page={props.page} /> : null}
      <SegTabs
        label="Screens that change"
        stepped
        tabs={ids.map((id) => ({
          key: id,
          label: props.model.label(id),
          content: (
            <ScreenPanel {...props} id={id} item={many ? props.model.label(id) : undefined} />
          ),
        }))}
      />
    </>
  );
}
