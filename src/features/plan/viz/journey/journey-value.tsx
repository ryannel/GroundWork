import type { Model } from '@/application/plan/derive';
import { isRecord, type Rec } from '@/application/plan/ids';
import { propLabel } from '@/application/plan-viz-journey-words';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';

import styles from './journey-value.module.css';

interface ValueProps {
  readonly model: Model;
  readonly value: unknown;
}

const ENTITY = /^(?:flow|scr|svc|api|gql|sch|msg|st|chg|dec):/;

/** Each value with a key of its own, though two may be alike. */
function keyed(values: readonly unknown[]): { key: string; value: unknown }[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const base = JSON.stringify(value);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: `${base}#${String(n)}`, value };
  });
}

const shown = ([key]: readonly [string, unknown]): boolean =>
  key !== 'id' && key !== 'name' && key !== 'sources' && !key.startsWith('$');

function Items({ model, items }: { readonly model: Model; readonly items: readonly unknown[] }) {
  if (items.length === 0) return <span className={styles.muted}>None</span>;
  return (
    <ul className={styles.list}>
      {keyed(items).map(({ key, value }) => (
        <li key={key}>
          <JourneyValue model={model} value={value} />
        </li>
      ))}
    </ul>
  );
}

function Properties({ model, record }: { readonly model: Model; readonly record: Rec }) {
  const name = record.name;
  return (
    <>
      {typeof name === 'string' && name !== '' ? <strong>{name}</strong> : null}
      <dl className={styles.properties}>
        {Object.entries(record)
          .filter(shown)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{propLabel(key)}</dt>
              <dd>
                <JourneyValue model={model} value={value} />
              </dd>
            </div>
          ))}
      </dl>
    </>
  );
}

/**
 * A recorded value in plain words: prose as the plan's text, a reference as its chip, a list as a list, and a
 * record as its named properties. A field's name and type cannot stand in for its notes, defaults or optionality.
 */
export function JourneyValue({ model, value }: ValueProps) {
  if (value === null || value === undefined || value === '') {
    return <span className={styles.muted}>Not recorded</span>;
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span>{String(value)}</span>;
  if (Array.isArray(value)) return <Items items={value} model={model} />;
  if (isRecord(value)) return <Properties model={model} record={value} />;
  if (typeof value !== 'string') return <span className={styles.muted}>Not recorded</span>;
  return ENTITY.test(value) ? (
    <EntityChip id={value} model={model} />
  ) : (
    <ModelText model={model} text={value} />
  );
}
