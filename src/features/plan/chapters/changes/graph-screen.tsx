import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import { prop, strings } from '@/application/plan/ids';
import { graphChange } from '@/application/plan-story-changes-graph';
import { flowShowing } from '@/application/plan-story-changes-links';
import { teamsBehind, topOf } from '@/application/plan-story-changes-touched';
import { journeyHref } from '@/features/plan/chapters/journey-href';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { EntityChip } from '@/features/plan/common/entity-chip';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { GraphMap } from '@/features/plan/viz/graph-map/graph-map';

import { Block, Decisions, JourneyLink, TeamRow } from './changes-kit';
import { GraphFields } from './graph-fields';
import { GraphOpsTable } from './graph-ops-table';
import styles from './graph-screen.module.css';
import { Waterfalls } from './graph-waterfalls';

const lostCache = (diff: GraphDiff) =>
  diff.operations.filter((o) => o.before?.cacheable === true && o.after?.cacheable !== true);

/** An operation that was cached at the edge and no longer can be, with the risks the plan records for it. */
function Lost({ model, diff }: { readonly model: Model; readonly diff: GraphDiff }) {
  return lostCache(diff).map((o) => (
    <p className={styles.lost} key={o.id}>
      <EntityChip id={o.id} model={model} />{' '}
      <span className={styles.muted}>
        can no longer be cached at the edge (the CDN in front of the gateway)
      </span>
      {model.inverse(o.id).risks.map((risk) => (
        <EntityChip id={risk} key={risk} model={model} />
      ))}
    </p>
  ));
}

function Caches({
  model,
  outline,
  graphId,
  diff,
}: Pick<BodyProps, 'model' | 'outline'> & { readonly graphId: string; readonly diff: GraphDiff }) {
  if (diff.caches.length === 0 && lostCache(diff).length === 0) return null;
  return (
    <Block title="Caches">
      <GraphMap
        diff={diff}
        graphId={graphId}
        model={model}
        purgeHref={(flowId) => journeyHref(model, outline, flowId)}
        view="caches"
      />
      <Lost diff={diff} model={model} />
    </Block>
  );
}

/** The first flow that runs an operation the plan changes. */
function flowOf(model: Model, diff: GraphDiff): string | null {
  for (const op of diff.operations) {
    const [screen] = strings(prop(model.toBe.get(op.id), 'screens'));
    const flow = screen === undefined ? null : flowShowing(model, topOf(screen));
    if (flow !== null) return flow;
  }
  return null;
}

/** What the plan changes in the graph: the route each operation takes, the fields that move, the caches. */
export function GraphChangeScreen({ model, outline, page }: BodyProps) {
  const change = graphChange(model);
  if (change === null) return null;
  const { graphId, diff } = change;
  const flow = flowOf(model, diff);
  return (
    <>
      <ScreenHead headline={change.headline} outline={outline} page={page}>
        {change.lede === '' ? null : <p>{change.lede}</p>}
      </ScreenHead>
      <TeamRow model={model} teamIds={teamsBehind(model, change.changeIds)} />
      {flow === null ? null : (
        <JourneyLink flowId={flow} label={model.label(flow)} model={model} outline={outline} />
      )}
      <div className={styles.screen}>
        <GraphOpsTable diff={diff} model={model} />
        <GraphFields diff={diff} graphId={graphId} model={model} />
        <Caches diff={diff} graphId={graphId} model={model} outline={outline} />
        <Waterfalls diff={diff} model={model} />
      </div>
      <Decisions changeIds={change.changeIds} model={model} />
    </>
  );
}
