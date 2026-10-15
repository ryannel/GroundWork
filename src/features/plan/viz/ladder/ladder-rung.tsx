import type { Model } from '@/application/plan/derive';
import { RUNG_HINT, RUNG_WORD, type RungView, type Seg } from '@/application/plan-viz-ladder-rungs';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';

import styles from './ladder-rung.module.css';

const SIGN = { added: '+', modified: '~', deprecated: '−', removed: '×' } as const;

function Part({ seg }: { readonly seg: Seg }) {
  if (seg.tone === 'strong') return <b>{seg.text}</b>;
  if (seg.tone === 'still') return <span className={styles.still}>{seg.text}</span>;
  if (seg.tone === 'who' && seg.id !== undefined) {
    return (
      <button className={styles.who} data-inspect={seg.id} type="button">
        {seg.text}
      </button>
    );
  }
  return <span>{seg.text}</span>;
}

function When({ when }: Pick<RungView, 'when'>) {
  if (when === null)
    return (
      <span className={styles.when} data-none="">
        no milestone
      </span>
    );
  return (
    <span className={styles.when} data-late={when.late ? '' : undefined} title={when.title}>
      {when.late ? '⚠ ' : ''}
      {when.text}
    </span>
  );
}

function Ops({ rung }: { readonly rung: RungView }) {
  if (rung.note !== null) return <div className={styles.note}>{rung.note}</div>;
  return (
    <div className={styles.ops}>
      {rung.ops.map((o) => (
        <div
          className={styles.op}
          data-change={o.change}
          data-more={o.more ? '' : undefined}
          key={o.key}
        >
          <span aria-hidden="true">{o.more ? '' : SIGN[o.change]}</span>
          <span>{o.text}</span>
        </div>
      ))}
    </div>
  );
}

function Links({ model, rung }: { readonly model: Model; readonly rung: RungView }) {
  return (
    <div className={styles.links}>
      {rung.teams.map((t) => (
        <TeamTag key={t} model={model} teamId={t} />
      ))}
      {rung.items.length > 0 ? <span className={styles.label}>Work item</span> : null}
      {rung.items.map((w) => (
        <EntityChip id={w.id} key={w.id} label={w.label} model={model} />
      ))}
      {rung.items.length === 0 && rung.noItems ? (
        <span className={styles.label}>no work item yet</span>
      ) : null}
    </div>
  );
}

/** One rung of the ladder: what happens, when it is planned, the edits, and who builds it. */
export function LadderRung({ model, rung }: { readonly model: Model; readonly rung: RungView }) {
  return (
    <li className={styles.rung} data-kind={rung.kind}>
      <span aria-hidden="true" className={styles.node} />
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.kind} title={RUNG_HINT[rung.kind]}>
            {RUNG_WORD[rung.kind]}
          </span>
          <span className={styles.what}>
            {rung.what.map((s, i) => (
              <Part key={`${String(i)}-${s.text}`} seg={s} />
            ))}
          </span>
          <When when={rung.when} />
        </div>
        <Ops rung={rung} />
        <Links model={model} rung={rung} />
      </div>
    </li>
  );
}
