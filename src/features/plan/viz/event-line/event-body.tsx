import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { EventData, EventLines, EventMode } from '@/application/plan-viz-events';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { ServiceChip } from '@/features/plan/common/service-chip';
import { FieldTable } from '@/features/plan/viz/field-table/field-table';
import { GoLink } from '@/features/plan/viz/go-link/go-link';

import styles from './event-body.module.css';

export interface EventLinks {
  /** The page that draws a step, for the link after "Published at" and "Consumed at". */
  readonly stepHref?: ((stepId: string) => string | undefined) | undefined;
  /** The page that draws the migration ladder. */
  readonly ladderHref?: string | undefined;
}

interface BodyProps extends EventLinks {
  readonly model: Model;
  readonly data: EventData;
  readonly mode: EventMode;
}

function Line({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className={styles.line}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

interface AtProps extends Pick<EventLinks, 'stepHref'> {
  readonly model: Model;
  readonly label: string;
  readonly lines: EventLines;
}

function At({ model, label, lines, stepHref }: AtProps) {
  if (lines.points.length === 0) return null;
  const href = lines.first === null ? undefined : stepHref?.(lines.first);
  return (
    <Line label={label}>
      {lines.points.map((p) => (
        <span className={styles.by} key={p.key}>
          {p.by === undefined ? null : (
            <>
              <ServiceChip id={p.by} model={model} />
              <span className={styles.faint}>at</span>
            </>
          )}
          <EntityChip id={p.step} model={model} status="existing" />
        </span>
      ))}
      {lines.more > 0 ? <span className={styles.faint}>+{lines.more}</span> : null}
      {href === undefined ? null : <GoLink href={href} />}
    </Line>
  );
}

/** What opens under an event line: its payload, where it is published and consumed, and its migration. */
export function EventBody({ model, data, mode, stepHref, ladderHref }: BodyProps) {
  return (
    <div className={styles.body}>
      {data.payload === null ? null : (
        <div className={styles.shape}>
          {mode === 'diff' ? (
            <EntityChip id={data.payload} model={model} />
          ) : (
            <EntityChip id={data.payload} model={model} status="existing" />
          )}
          <FieldTable
            changes={false}
            density="compact"
            head={false}
            mode={mode}
            model={model}
            schemaId={data.payload}
          />
        </div>
      )}
      <dl className={styles.lines}>
        <At label="Published at" lines={data.published} model={model} stepHref={stepHref} />
        <At label="Consumed at" lines={data.consumed} model={model} stepHref={stepHref} />
        {data.migration === null ? null : (
          <Line label="Migration">
            <span>
              <ModelInline model={model} text={data.migration} />.
            </span>
            {ladderHref === undefined ? null : <GoLink href={ladderHref} label="See the ladder" />}
          </Line>
        )}
      </dl>
      <div className={styles.foot}>
        <button className={styles.open} data-inspect={data.id} type="button">
          Open event →
        </button>
      </div>
    </div>
  );
}
