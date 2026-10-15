import type { Model } from '@/application/plan/derive';
import type { StoreItem } from '@/application/plan-story-today-types';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { Badge } from '@/ui/badge';

import styles from './store-list.module.css';

// Each store with the system that owns it, who else reads or writes it, and the records it holds.
export function StoreList({
  model,
  stores,
}: {
  readonly model: Model;
  readonly stores: readonly StoreItem[];
}) {
  return (
    <ul className={styles.stores}>
      {stores.map((store) => (
        <li
          className={styles.store}
          data-shared={store.sharedBy === null ? undefined : ''}
          key={store.id}
        >
          <div className={styles.head}>
            <EntityChip id={store.id} model={model} />
            {store.owner === null ? null : (
              <span className={styles.note}>owned by {model.label(store.owner)}</span>
            )}
          </div>
          {store.sharedBy === null ? null : (
            <div className={styles.shared}>
              <Badge>shared</Badge>
              <span className={styles.note}>also accessed by</span>
              {store.sharedBy.map((id) => (
                <EntityChip id={id} key={id} model={model} />
              ))}
            </div>
          )}
          <div className={styles.records}>
            {store.records.length === 0 ? (
              <span className={styles.note}>no records listed</span>
            ) : (
              store.records.map((record) => (
                <EntityChip
                  id={record.id}
                  key={record.id}
                  label={`${record.name} · ${record.fields}`}
                  model={model}
                />
              ))
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
