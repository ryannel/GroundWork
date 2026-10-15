import type { Model } from '@/application/plan/derive';
import { ladderView } from '@/application/plan-viz-ladder-rungs';
import { EndpointSig } from '@/features/plan/viz/endpoint/endpoint-parts';
import { EventLine } from '@/features/plan/viz/event-line/event-line';
import { Legend } from '@/ui/legend';

import { LadderRung } from './ladder-rung';
import styles from './ladder.module.css';
import { VersionBadge } from './version-badge';

interface LadderProps {
  readonly model: Model;
  /** Any version in the chain. */
  readonly id: string;
}

function Version({ model, id }: LadderProps) {
  if (id.startsWith('msg:')) return <EventLine bare id={id} mode="diff" model={model} />;
  const ep = [...model.toBe.endpoints, ...model.asIs.endpoints].find((e) => e.id === id);
  return (
    <div className={styles.version}>
      {ep === undefined ? <span>{id}</span> : <EndpointSig ep={ep} />}
      <VersionBadge id={id} model={model} />
    </div>
  );
}

/** The migration ladder of a versioned event or endpoint: expand, migrate one consumer at a time, remove. */
export function Ladder({ model, id }: LadderProps) {
  const view = ladderView(model, id);
  if (view === null) return null;
  return (
    <div className={styles.ladder} data-ladder={id}>
      <div className={styles.top}>
        {view.chain.map((v) => (
          <Version id={v} key={v} model={model} />
        ))}
      </div>
      <ol className={styles.rungs}>
        {view.rungs.map((r) => (
          <LadderRung key={r.key} model={model} rung={r} />
        ))}
      </ol>
      <Legend
        items={[
          ...view.legend.map((label) => ({ label })),
          ...(view.keepsOld ? [{ label: 'Removing the old version is not in this plan' }] : []),
        ]}
        title="Expand · migrate · remove"
      />
    </div>
  );
}
