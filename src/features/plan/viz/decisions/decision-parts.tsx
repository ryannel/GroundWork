import type { Model } from '@/application/plan/derive';
import type { Meta, OptionLine } from '@/application/plan-viz-decision';
import { TeamTag } from '@/features/plan/common/team-dot';
import { Badge } from '@/ui/badge';

import styles from './decision-parts.module.css';

/** The other options, folded away: the one chosen first, then each with why it was not. */
export function Options({ options }: { readonly options: readonly OptionLine[] }) {
  if (options.length === 0) return null;
  const others = options.filter((o) => !o.chosen);
  return (
    <details className={styles.options}>
      <summary>
        {others.length === 1 ? '1 other option' : `${String(others.length)} other options`}:{' '}
        {others.map((o) => o.name).join(' · ')}
      </summary>
      <ul className={styles.list}>
        {options.map((o) => (
          <li data-chosen={o.chosen ? '' : undefined} key={o.name}>
            <strong>{o.name}</strong>
            {o.chosen ? ' (chosen)' : null}
            {o.why === '' ? null : <> — {o.why}</>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Who decides, by when, and how hard it is to undo. */
export function MetaLine({ model, meta }: { readonly model: Model; readonly meta: Meta }) {
  const { decider, verb, when, door } = meta;
  if (decider === null && when === null && door === '') return null;
  return (
    <p className={styles.meta}>
      {decider === null ? null : (
        <>
          <TeamTag model={model} teamId={decider} /> {verb}
        </>
      )}
      {when === null ? null : (
        <span>
          {when.label} <time dateTime={when.date}>{when.text}</time>
          {when.late ? <Badge tone="removed">overdue</Badge> : null}
        </span>
      )}
      {door === '' ? null : <span>{door}</span>}
    </p>
  );
}
