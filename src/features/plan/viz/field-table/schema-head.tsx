import type { Model } from '@/application/plan/derive';
import type { Mode } from '@/application/plan/derive-core';
import { chipInfo } from '@/application/plan-chips';
import { schemaCounts, schemaOf, type SchemaCounts } from '@/application/plan-viz-fields';
import { countOf } from '@/application/plan-viz-text';
import { CompatBadge } from '@/features/plan/viz/compat/compat';
import { Glyph } from '@/ui/icon';
import { Legend } from '@/ui/legend';

import styles from './schema-head.module.css';

const hasChanges = (c: SchemaCounts): boolean =>
  c.added + c.modified + c.deprecated + c.removed > 0;

/** "+3 ~1": each count in its status colour, spelled out. */
export function CountsLine({ counts }: { readonly counts: SchemaCounts }) {
  const parts = [
    { key: 'add', n: counts.added, word: 'new' },
    { key: 'mod', n: counts.modified, word: 'changed' },
    { key: 'dep', n: counts.deprecated, word: 'deprecated · still works' },
    { key: 'rem', n: counts.removed, word: 'removed' },
  ].filter((p) => p.n > 0);
  if (parts.length === 0) return <span className={styles.faint}>no field changes</span>;
  return (
    <span className={styles.counts} title={parts.map((p) => `${String(p.n)} ${p.word}`).join(', ')}>
      {parts.map((p, i) => (
        <span key={p.key}>
          {i > 0 ? <span className={styles.faint}> · </span> : null}
          <span data-count={p.key}>
            {p.n} {p.word}
          </span>
        </span>
      ))}
    </span>
  );
}

/** The legend under a table in diff: only the marks that appear (pass the counts), or every mark. */
export function FieldLegend({ counts }: { readonly counts?: SchemaCounts }) {
  const items = [
    { show: counts === undefined || counts.added > 0, label: 'new field', glyph: '+' },
    {
      show: counts === undefined || counts.modified > 0,
      label: 'changed (old type struck through)',
      glyph: '~',
    },
    {
      show: counts === undefined || counts.deprecated > 0,
      label: 'deprecated · still works',
      glyph: '·',
    },
    { show: counts === undefined || counts.removed > 0, label: 'removed', glyph: '×' },
  ]
    .filter((i) => i.show)
    .map(({ label, glyph }) => ({ label, glyph }));
  return items.length === 0 ? null : <Legend items={items} />;
}

interface SchemaHeadProps {
  readonly model: Model;
  readonly schemaId: string;
  readonly mode?: Mode;
  /** Leaves the name off: the page already says it. */
  readonly bare?: boolean;
  /** Shows the verdict on readers (diff only). */
  readonly compat?: boolean;
}

function Title({
  model,
  schemaId,
  name,
  store,
}: {
  readonly model: Model;
  readonly schemaId: string;
  readonly name: string;
  readonly store: string | undefined;
}) {
  return (
    <span className={styles.title}>
      <Glyph glyph="▤" />
      <button className={styles.schema} data-inspect={schemaId} type="button">
        {name}
      </button>
      <span className={styles.faint}>{chipInfo(model, schemaId).word}</span>
      {store === undefined ? null : (
        <span className={styles.where}>
          <Glyph glyph="⛁" />
          {model.label(store)}
        </span>
      )}
    </span>
  );
}

function sizeOf(model: Model, schemaId: string, mode: Mode): string {
  const counts = schemaCounts(model, schemaId);
  if (mode !== 'diff') {
    return countOf(schemaOf(model, schemaId, mode)?.fields.length ?? 0, 'field');
  }
  const wholly = model.status(schemaId) === 'added';
  return !wholly && counts.before !== counts.fields
    ? `${String(counts.before)} → ${countOf(counts.fields, 'field')}`
    : countOf(counts.fields, 'field');
}

function Sum({ model, schemaId, mode, compat }: Required<Omit<SchemaHeadProps, 'bare'>>) {
  const counts = schemaCounts(model, schemaId);
  const diff = mode === 'diff';
  const wholly = diff && model.status(schemaId) === 'added';
  return (
    <span className={styles.sum}>
      <span>{sizeOf(model, schemaId, mode)}</span>
      {diff && !wholly && hasChanges(counts) ? <CountsLine counts={counts} /> : null}
      {diff && compat ? <CompatBadge id={schemaId} model={model} /> : null}
    </span>
  );
}

/** Name, where it lives, how many fields, the verdict. */
export function SchemaHead({
  model,
  schemaId,
  mode = 'diff',
  bare = false,
  compat = true,
}: SchemaHeadProps) {
  const schema = schemaOf(model, schemaId, mode);
  if (schema === undefined) return null;
  return (
    <div className={styles.head}>
      {bare ? null : (
        <Title model={model} name={schema.name} schemaId={schemaId} store={schema.store} />
      )}
      <Sum compat={compat} mode={mode} model={model} schemaId={schemaId} />
    </div>
  );
}
