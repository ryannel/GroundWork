import type { Model } from '@/application/plan/derive';
import type { BandRowView, FillRowView, HingeRowView } from '@/application/plan-viz-waterfall-view';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';

import styles from './hinge-row.module.css';
import { Row } from './row';

interface ViewProps<T> {
  readonly model: Model;
  readonly row: T;
}

/** The gateway: it splits the request across the subgraphs. */
export function HingeRow({ model, row }: ViewProps<HingeRowView>) {
  return (
    <Row
      kind="hinge"
      state={row.state}
      what={<span className={styles.meta}>{row.text}</span>}
      who={
        <>
          <span className={styles.layer}>
            <span aria-hidden="true">▣</span> gateway
          </span>
          <EntityChip id={row.gateway} model={model} status="existing" />
          {row.team === null ? null : <TeamTag model={model} teamId={row.team} />}
        </>
      }
    />
  );
}

/** The line between round trips, and what a mutation's first one writes. */
export function BandRow({ model, row }: ViewProps<BandRowView>) {
  return (
    <li className={styles.band}>
      <span>{row.text}</span>
      {row.writes.length === 0 ? null : (
        <span className={styles.writes}>
          writes{' '}
          {row.writes.map((id) => (
            <EntityChip id={id} key={id} model={model} status="existing" />
          ))}
        </span>
      )}
    </li>
  );
}

/** The caches fill as the answer returns, innermost first. */
export function FillRow({ model, row }: ViewProps<FillRowView>) {
  return (
    <Row
      kind="fill"
      track={<span className={styles.return} />}
      what={
        <span className={styles.fill}>
          {row.stores.map((id, i) => (
            <span className={styles.store} key={id}>
              {i === 0 ? null : <span className={styles.then}>then</span>}
              <EntityChip id={id} model={model} status="existing" />
            </span>
          ))}
        </span>
      }
      who={
        <span className={styles.layer}>
          <span aria-hidden="true">◄</span> caches fill as the answer returns
        </span>
      }
    />
  );
}
