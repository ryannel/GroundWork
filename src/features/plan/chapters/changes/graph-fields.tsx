import type { Model } from '@/application/plan/derive';
import type { FieldChange, GraphDiff } from '@/application/plan/federation-diff';
import { dayText } from '@/application/plan-story-versions-words';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { StatusBadge } from '@/features/plan/common/status-badge';
import { OwnershipGrid } from '@/features/plan/viz/graph-map/ownership-grid';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import { Block } from './changes-kit';
import styles from './graph-fields.module.css';

const uniq = <T,>(xs: readonly T[]): T[] => [...new Set(xs)];

/** The operations that select a field: today's for a field that goes (it is what the removal affects), both otherwise. */
function selecting(model: Model, field: FieldChange): string[] {
  const asIs = model.operationsSelecting(field.id, 'asIs');
  if (field.status === 'removed') return asIs;
  return uniq([...asIs, ...model.operationsSelecting(field.id, 'toBe')]);
}

function rolloutOf(model: Model, field: FieldChange): string[] {
  if (field.status !== 'deprecated' && field.status !== 'removed') return [];
  return (model.plan.changes ?? [])
    .filter(
      (c) =>
        c.rollout !== undefined &&
        c.ops.some((op) =>
          'remove' in op ? op.remove === field.id : 'deprecate' in op && op.deprecate === field.id,
        ),
    )
    .map((c) => c.rollout ?? '');
}

function Where({ model, field }: { readonly model: Model; readonly field: FieldChange }) {
  const { before, after } = field.subgraphs;
  const now = after.length > 0 ? after : before;
  return (
    <>
      {now.map((id) => (
        <EntityChip id={id} key={id} model={model} />
      ))}
      {field.moved ? (
        <span className={styles.was}>
          {' '}
          was <s>{before.map((id) => model.label(id)).join(', ')}</s>
        </span>
      ) : null}
    </>
  );
}

function Usage({ field }: { readonly field: FieldChange }) {
  const u = field.usage;
  if (u === null || u === undefined) return null;
  const seen = u.last_seen === undefined ? '' : ` · last seen ${dayText(u.last_seen)}`;
  return (
    <span className={styles.small}>
      used by {(u.clients ?? []).join(', ')} · {String(u.per_day ?? '')} a day{seen}
    </span>
  );
}

function Row({ model, field }: { readonly model: Model; readonly field: FieldChange }) {
  const ops = selecting(model, field);
  return (
    <tr data-status={field.status}>
      <td>
        <EntityChip id={field.id} model={model} />
      </td>
      <td>
        <StatusBadge status={field.status} />
        {rolloutOf(model, field).map((text) => (
          <p className={styles.rollout} key={text}>
            <strong>Rollout:</strong> <ModelInline model={model} text={text} />
          </p>
        ))}
      </td>
      <td>
        <Where field={field} model={model} />
      </td>
      <td>
        {ops.length === 0 ? (
          <span className={styles.small}>no operation</span>
        ) : (
          ops.map((id) => <EntityChip id={id} key={id} model={model} />)
        )}
      </td>
      <td>
        <Usage field={field} />
      </td>
    </tr>
  );
}

function FieldTable({
  model,
  fields,
}: {
  readonly model: Model;
  readonly fields: readonly FieldChange[];
}) {
  return (
    <ScrollCue note>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Change</th>
            <th scope="col">Subgraph</th>
            <th scope="col">Operations affected</th>
            <th scope="col">Usage</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <Row field={field} key={field.id} model={model} />
          ))}
        </tbody>
      </table>
    </ScrollCue>
  );
}

interface GraphFieldsProps {
  readonly model: Model;
  readonly graphId: string;
  readonly diff: GraphDiff;
}

/**
 * The fields the plan moves, adds or removes. One that moves between subgraphs is drawn on the ownership grid,
 * before and after, with the usage of what is removed under it; otherwise a table says what happens to each field.
 */
export function GraphFields({ model, graphId, diff }: GraphFieldsProps) {
  if (diff.fields.length === 0) return null;
  const moved = diff.fields.filter((f) => f.moved).length;
  const impacted = uniq(diff.fields.flatMap((f) => model.operationsSelecting(f.id, 'toBe')));
  if (moved <= 1) {
    return (
      <Block title="Fields">
        <FieldTable fields={diff.fields} model={model} />
      </Block>
    );
  }
  const used = diff.fields.filter((f) => f.status === 'removed' && f.usage !== null);
  return (
    <Block title="Fields">
      <OwnershipGrid diff={diff} graphId={graphId} model={model} />
      {used.length === 0 ? null : <FieldTable fields={used} model={model} />}
      {impacted.length === 0 ? null : (
        <p className={styles.impact}>
          <span className={styles.small}>Operations affected:</span>{' '}
          {impacted.map((id) => (
            <EntityChip id={id} key={id} model={model} />
          ))}
        </p>
      )}
    </Block>
  );
}
