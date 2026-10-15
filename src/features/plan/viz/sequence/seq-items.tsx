import { holdsCurrent } from '@/application/plan-viz-sequence';
import type { SeqCell } from '@/application/plan-viz-sequence-cells';
import type { Item } from '@/application/plan-viz-sequence-rows';

import { Cell } from './seq-cells';
import type { SeqEnv } from './seq-env';
import styles from './seq-items.module.css';

/** The number of the first row an item holds; it keys the item among its siblings. */
function firstAt(item: Item<SeqCell>): string {
  if (item.kind !== 'frame') return String(item.at);
  const [first] = item.items;
  return first === undefined ? 'empty' : firstAt(first);
}

interface ItemsProps {
  readonly env: SeqEnv;
  readonly items: readonly Item<SeqCell>[];
}

/** The rows of a drawing, a frame drawn as a box around the rows it holds. */
export function Items({ env, items }: ItemsProps) {
  return items.map((item) =>
    item.kind === 'frame' ? (
      <div
        className={styles.frame}
        data-current={holdsCurrent(item.items) ? '' : undefined}
        data-frame={item.frame}
        key={firstAt(item)}
      >
        <Items env={env} items={item.items} />
      </div>
    ) : (
      <Cell cell={item} env={env} key={firstAt(item)} />
    ),
  );
}
