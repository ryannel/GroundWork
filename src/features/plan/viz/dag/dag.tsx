import type { Model } from '@/application/plan/derive';
import { type DagOptions, dagOf } from '@/application/plan-viz-dag';
import { countOf } from '@/application/plan-viz-text';
import { STATE_GLYPH, STATE_WORD } from '@/application/plan-viz-work';
import { TeamTag } from '@/features/plan/common/team-dot';
import { ZoomPane } from '@/features/plan/viz/zoompane/zoom-pane.client';
import { Callout } from '@/ui/callout';
import { Legend, type LegendItem } from '@/ui/legend';

import { DagFigure } from './dag-figure';
import styles from './dag.module.css';

interface DagProps extends Omit<DagOptions, 'today'> {
  readonly model: Model;
}

function legendItems(dag: NonNullable<ReturnType<typeof dagOf>>): LegendItem[] {
  return [
    { line: 'solid', label: 'depends on (the arrow points at the item that waits)' },
    { glyph: '━', label: 'critical path' },
    ...(dag.violations.length > 0
      ? [{ line: 'dashed', label: 'depends on a later milestone' } satisfies LegendItem]
      : []),
    ...(dag.anyWaits
      ? [{ glyph: '?', label: 'blocked by an open question (hover for which)' }]
      : []),
    ...(dag.hasState
      ? (['done', 'open', 'not-started'] as const).map((k) => ({
          glyph: STATE_GLYPH[k],
          label: STATE_WORD[k],
        }))
      : []),
  ];
}

/** The work items' dependency graph: drawn at reading size in a pane that scrolls sideways and expands, with its key. */
export function Dag({ model, byMilestone, lens }: DagProps) {
  const dag = dagOf(model, { byMilestone, lens, today: new Date() });
  if (dag === null) return <p className={styles.none}>No work items in this plan.</p>;
  const waiting =
    dag.violations.length === 1
      ? 'One work item waits'
      : `${String(dag.violations.length)} work items wait`;
  return (
    <div className={styles.dag}>
      {dag.teams.length < 2 ? null : (
        <div className={styles.teams} role="note">
          <span className={styles.teamsTitle}>Teams</span>
          {dag.teams.map((team) => (
            <TeamTag key={team} model={model} teamId={team} />
          ))}
        </div>
      )}
      {dag.violations.length === 0 ? null : (
        <Callout title={`${waiting} on a later milestone.`} tone="warning">
          {dag.violations.map((v) => (
            <p key={v.text}>{v.text}</p>
          ))}
        </Callout>
      )}
      <ZoomPane
        h={dag.h}
        legend={<Legend items={legendItems(dag)} />}
        more={countOf(dag.count, 'work item')}
        w={dag.w}
        what="the graph"
        wide
      >
        <DagFigure dag={dag} />
      </ZoomPane>
    </div>
  );
}
