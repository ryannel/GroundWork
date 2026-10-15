import type { Model } from '@/application/plan/derive';
import type { WaterfallBodyView, WaterfallRow } from '@/application/plan-viz-waterfall-view';
import { GraphEstimate } from '@/features/plan/viz/graph-evidence/graph-estimate';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import { CacheRow } from './cache-row';
import { FetchRow } from './fetch-row';
import { BandRow, FillRow, HingeRow } from './hinge-row';
import styles from './waterfall-body.module.css';

interface RowsProps {
  readonly model: Model;
  readonly row: WaterfallRow;
}

function AnyRow({ model, row }: RowsProps) {
  switch (row.kind) {
    case 'cache': {
      return <CacheRow model={model} row={row} />;
    }
    case 'hinge': {
      return <HingeRow model={model} row={row} />;
    }
    case 'band': {
      return <BandRow model={model} row={row} />;
    }
    case 'fetch': {
      return <FetchRow model={model} row={row} />;
    }
    case 'fill': {
      return <FillRow model={model} row={row} />;
    }
  }
}

interface BodyProps {
  readonly model: Model;
  /** The operation, by id. */
  readonly id: string;
  readonly body: WaterfallBodyView;
  readonly mode?: 'asIs' | 'toBe' | undefined;
}

// One case of a waterfall: what happened, the rows in order, and what it came to.
export function WaterfallBody({ model, id, body, mode }: BodyProps) {
  return (
    <div className={styles.body} data-case-of={body.kase}>
      {body.caption === null ? null : <p className={styles.caption}>{body.caption}</p>}
      <ScrollCue note>
        <ol className={styles.rows}>
          {body.rows.map((row) => (
            <AnyRow key={row.key} model={model} row={row} />
          ))}
        </ol>
      </ScrollCue>
      <p className={styles.summary}>
        {body.summary} <GraphEstimate id={id} mode={mode ?? 'toBe'} model={model} />
      </p>
    </div>
  );
}
