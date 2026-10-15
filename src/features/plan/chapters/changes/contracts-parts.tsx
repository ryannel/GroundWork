import type { Model } from '@/application/plan/derive';
import { changesOf } from '@/application/plan-story-changes-touched';
import type { Sequencing } from '@/application/plan-viz-ladder-order';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { StatusBadge } from '@/features/plan/common/status-badge';
import { FieldTable } from '@/features/plan/viz/field-table/field-table';
import { Callout } from '@/ui/callout';

import { Block } from './changes-kit';
import styles from './contracts-parts.module.css';

/** Where a ladder's work is planned out of order, and which work items collide. */
export function SequenceNotes({
  model,
  seq,
}: {
  readonly model: Model;
  readonly seq: Sequencing | null;
}) {
  if (seq === null || seq.notes.length === 0) return null;
  return (
    <Callout title="Planned out of order" tone="warning">
      <ul className={styles.notes}>
        {seq.notes.map((n) => (
          <li key={`${n.wi}-${n.text}`}>
            <EntityChip id={n.wi} model={model} /> {n.text}
          </li>
        ))}
      </ul>
    </Callout>
  );
}

/** What goes away without a ladder: the interface, what replaces it, and the changes behind it. */
export function RetiredList({
  model,
  ids,
}: {
  readonly model: Model;
  readonly ids: readonly string[];
}) {
  if (ids.length === 0) return null;
  return (
    <Block title="Also going away">
      <ul className={styles.rets}>
        {ids.map((id) => {
          const replacedBy = model.versions(id).replacedBy;
          return (
            <li className={styles.ret} key={id}>
              <EntityChip id={id} model={model} />
              <StatusBadge status={model.status(id)} />
              {replacedBy === null ? null : (
                <>
                  <span className={styles.faint}>replaced by</span>
                  <EntityChip id={replacedBy} model={model} />
                </>
              )}
              {changesOf(model, id).map((c) => (
                <EntityChip id={c} key={c} model={model} />
              ))}
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

/** Request and event bodies whose fields change, each as a compact table. */
export function ShapesList({
  model,
  ids,
}: {
  readonly model: Model;
  readonly ids: readonly string[];
}) {
  if (ids.length === 0) return null;
  return (
    <Block title="Request and event bodies that change">
      <div className={styles.shapes}>
        {ids.map((id) => (
          <FieldTable
            changes={false}
            density="compact"
            head
            key={id}
            mode="diff"
            model={model}
            schemaId={id}
          />
        ))}
      </div>
    </Block>
  );
}
