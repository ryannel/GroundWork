import type { Model } from '@/application/plan/derive';
import type { CacheRowView } from '@/application/plan-viz-waterfall-view';
import { EntityChip } from '@/features/plan/common/entity-chip';

import styles from './cache-row.module.css';
import { MarkTag } from './mark-tag';
import { Row } from './row';

interface CacheRowProps {
  readonly model: Model;
  readonly row: CacheRowView;
}

function Why({ model, row }: CacheRowProps) {
  const { why } = row;
  if (why === null) return <span className={styles.meta}>{row.meta}</span>;
  return (
    <span className={styles.why}>
      <MarkTag mark={{ kind: 'blocked', glyph: null, text: '✕' }} />
      {why.kind === 'text' ? (
        why.text
      ) : (
        <>
          cannot keep this response: <span aria-hidden="true">🔒</span>
          <EntityChip id={why.field} model={model} status="existing" />
          is private, so it is for one person
        </>
      )}
    </span>
  );
}

// A cache layer the response passes through, with what it did: answered, missed, was skipped, or cannot keep it.
export function CacheRow({ model, row }: CacheRowProps) {
  const store = <EntityChip id={row.store} model={model} status="existing" />;
  return (
    <Row
      kind="cache"
      state={row.state}
      track={<MarkTag mark={row.mark} />}
      wasToday={row.wasLive}
      what={
        <>
          <Why model={model} row={row} />
          {row.per.length === 0 ? null : (
            <span className={styles.per}>
              {row.per.map((x) => (
                <span className={styles.item} data-state={x.state} key={x.key}>
                  {x.text}
                </span>
              ))}
            </span>
          )}
          {row.note === null ? null : <span className={styles.note}>{row.note}</span>}
        </>
      }
      who={
        <>
          <span className={styles.layer}>
            <span aria-hidden="true">◍</span> {row.layer}
          </span>
          {row.state === 'blocked' ? <s className={styles.struck}>{store}</s> : store}
        </>
      }
    />
  );
}
