import type { Model } from '@/application/plan/derive';
import type { ProposedMarks } from '@/application/plan/proposed';
import { type ScreenMode, regionCount, screenIn } from '@/application/plan-viz-screens';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';
import { StatusBadge } from '@/features/plan/common/status-badge';

import styles from './screen-card.module.css';
import { ScreenFigure } from './screen-figure';

export interface ScreenCardProps {
  readonly model: Model;
  /** The screen. */
  readonly id: string;
  /** Where the plan's pictures are served from. */
  readonly base: string;
  readonly mode?: ScreenMode;
  /** Say what the plan does to the screen. */
  readonly status?: boolean;
  /** Words a gallery's search box can match against. */
  readonly search?: boolean;
  readonly proposed?: ProposedMarks | null;
}

const FLOWS_SHOWN = 3;

function Flows({ model, id, mode }: Pick<ScreenCardProps, 'model' | 'id' | 'mode'>) {
  const flows = model.flowsOnScreen(id, mode === 'asIs' ? 'asIs' : 'either').map((f) => f.flow);
  if (flows.length === 0) return <span>no flow passes through it</span>;
  return (
    <span className={styles.flows}>
      {flows.slice(0, FLOWS_SHOWN).map((flow) => (
        <EntityChip id={flow} key={flow} model={model} status="existing" />
      ))}
      {flows.length > FLOWS_SHOWN ? <span>+{flows.length - FLOWS_SHOWN}</span> : null}
    </span>
  );
}

// A gallery card: the picture, what the screen is for, how many regions it names and the flows through it.
export function ScreenCard({
  model,
  id,
  base,
  mode = 'asIs',
  status = false,
  search = false,
  proposed = null,
}: ScreenCardProps) {
  const screen = screenIn(model, id, mode);
  if (screen === undefined) return null;
  const state = status ? (model.status(id) ?? 'existing') : 'existing';
  const haystack = [screen.name, id, screen.route, screen.kind, screen.summary, screen.service]
    .filter((s) => s !== undefined && s !== '')
    .join(' ')
    .toLowerCase();
  return (
    <article
      className={styles.card}
      data-search={search ? haystack : undefined}
      data-status={state}
    >
      <ScreenFigure
        base={base}
        id={id}
        mode={mode}
        model={model}
        proposed={proposed}
        size="sm"
        status={status}
      />
      <div className={styles.body}>
        <ModelText model={model} text={screen.summary} />
        <div className={styles.meta}>
          {status ? <StatusBadge status={state} /> : null}
          <span>{regionCount(screen.regions.length)}</span>
          <Flows id={id} mode={mode} model={model} />
        </div>
      </div>
    </article>
  );
}
