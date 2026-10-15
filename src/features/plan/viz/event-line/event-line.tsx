import type { Model } from '@/application/plan/derive';
import {
  type EventData,
  type EventMode,
  eventData,
  sortEvents,
} from '@/application/plan-viz-events';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { StatusBadge } from '@/features/plan/common/status-badge';
import { CompatBadge } from '@/features/plan/viz/compat/compat';

import { EventBody, type EventLinks } from './event-body';
import { EventFlow } from './event-flow';
import styles from './event-line.module.css';

export interface EventLineProps extends EventLinks {
  readonly model: Model;
  readonly id: string;
  /** 'diff' marks what the plan changes; 'asIs' and 'toBe' draw one side. */
  readonly mode?: EventMode;
  readonly groupTopic?: boolean;
  readonly open?: boolean;
  /** A service id whose chip stays quiet: the page's own subject. */
  readonly self?: string | undefined;
  /** The line alone, with no body; 'flow' also leaves out the facts, which the page says elsewhere. */
  readonly bare?: boolean | 'flow';
}

function Facts({
  model,
  data,
  mode,
}: {
  readonly model: Model;
  readonly data: EventData;
  readonly mode: EventMode;
}) {
  const diff = mode === 'diff';
  const shown = data.key !== '' || data.delivery !== '' || data.replacedBy !== null || diff;
  if (!shown) return null;
  return (
    <span className={styles.facts}>
      {data.key === '' ? null : (
        <span>
          <span className={styles.faint}>key</span> <span className={styles.mono}>{data.key}</span>
        </span>
      )}
      {data.delivery === '' ? null : <span>{data.delivery}</span>}
      {data.replacedBy === null ? null : (
        <span className={styles.faint}>
          replaced by <EntityChip id={data.replacedBy} model={model} status="existing" />
        </span>
      )}
      {diff ? <StatusBadge status={data.status} /> : null}
      {diff ? <CompatBadge id={data.id} model={model} quiet /> : null}
    </span>
  );
}

/**
 * One event as a line that opens to its payload: producer → topic · name → consumers, then key, delivery, status
 * and verdict.
 */
export function EventLine({
  model,
  id,
  mode = 'diff',
  groupTopic = false,
  open = false,
  self,
  bare = false,
  stepHref,
  ladderHref,
}: EventLineProps) {
  const data = eventData(model, id, mode);
  if (data === null) return null;
  const flow = <EventFlow data={data} groupTopic={groupTopic} model={model} self={self} />;
  const facts = bare === 'flow' ? null : <Facts data={data} mode={mode} model={model} />;
  if (bare !== false) {
    return (
      <div className={styles.bare} data-status={data.status ?? 'existing'}>
        <div className={styles.sum}>
          {flow}
          {facts}
        </div>
      </div>
    );
  }
  return (
    <details
      className={styles.line}
      data-search={data.search}
      data-status={data.status ?? 'existing'}
      open={open}
    >
      <summary className={styles.sum}>
        {flow}
        <Facts data={data} mode={mode} model={model} />
      </summary>
      <EventBody
        data={data}
        ladderHref={ladderHref}
        mode={mode}
        model={model}
        stepHref={stepHref}
      />
    </details>
  );
}

interface EventLinesProps extends Omit<EventLineProps, 'id' | 'bare' | 'open'> {
  readonly ids: readonly string[];
}

/** A topic's events, or a service's, in catalogue order. */
export function EventLines({ ids, ...rest }: EventLinesProps) {
  return (
    <div className={styles.list}>
      {sortEvents(rest.model, ids).map((id) => (
        <EventLine id={id} key={id} {...rest} />
      ))}
    </div>
  );
}
