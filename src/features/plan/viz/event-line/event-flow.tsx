import type { Model } from '@/application/plan/derive';
import type { EventData } from '@/application/plan-viz-events';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ServiceChip } from '@/features/plan/common/service-chip';

import styles from './event-flow.module.css';

const MAX_CONSUMERS = 5;

interface FlowProps {
  readonly model: Model;
  readonly data: EventData;
  /** A service id whose chip stays quiet: the page's own subject. */
  readonly self?: string | undefined;
  /** The group head carries the topic, so the line leaves it out. */
  readonly groupTopic?: boolean;
}

function Consumers({ model, data, self }: Pick<FlowProps, 'model' | 'data' | 'self'>) {
  const { now, leaving } = data;
  if (now.length === 0 && leaving.length > 0) return null;
  if (now.length === 0) return <span className={styles.faint}>no consumer recorded</span>;
  return (
    <>
      {now.slice(0, MAX_CONSUMERS).map((id) => (
        <ServiceChip id={id} key={id} model={model} quiet={id === self} />
      ))}
      {now.length > MAX_CONSUMERS ? (
        <span className={styles.faint}>+{now.length - MAX_CONSUMERS}</span>
      ) : null}
    </>
  );
}

function Leaving({ model, ids }: { readonly model: Model; readonly ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className={styles.off}>
      <span className={styles.faint}>┊ moving off</span>
      {ids.map((id) => (
        <ServiceChip dim id={id} key={id} model={model} />
      ))}
    </span>
  );
}

/** producer → topic · name version → who hears it, on one line. */
export function EventFlow({ model, data, self, groupTopic = false }: FlowProps) {
  return (
    <span className={styles.flow}>
      {data.producer === null ? null : (
        <>
          <ServiceChip id={data.producer} model={model} quiet={data.producer === self} />
          <span aria-hidden="true" className={styles.arrow}>
            →
          </span>
        </>
      )}
      {groupTopic || data.topic === null ? null : (
        <>
          <EntityChip id={data.topic} model={model} status="existing" />
          <span aria-hidden="true" className={styles.arrow}>
            ·
          </span>
        </>
      )}
      <button className={styles.name} data-inspect={data.id} title="Open the event" type="button">
        <span className={styles.mono}>{data.name}</span>
        {data.version === '' ? null : <span className={styles.version}> {data.version}</span>}
      </button>
      <span aria-hidden="true" className={styles.arrow}>
        →
      </span>
      <span className={styles.cons}>
        <Consumers data={data} model={model} self={self} />
      </span>
      <Leaving ids={data.leaving} model={model} />
    </span>
  );
}
