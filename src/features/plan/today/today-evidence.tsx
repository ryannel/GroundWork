import type { Model } from '@/application/plan/derive';
import type { EntitySource } from '@/application/plan-pages-entity';
import { originWord, type Evidence } from '@/application/today-thing';

import styles from './today-evidence.module.css';

interface TodayEvidenceProps {
  readonly model: Model;
  readonly id: string;
  readonly evidence: readonly Evidence[];
  /** Links the thing cites that are not lines of code, such as a design document. */
  readonly sources: readonly EntitySource[];
}

function Line({
  model,
  id,
  line,
}: {
  readonly model: Model;
  readonly id: string;
  readonly line: Evidence;
}) {
  return (
    <li className={styles.line}>
      <a href={line.href} rel="noreferrer" target="_blank">
        <span className={styles.repo}>{line.repo}</span> · {line.where} ↗
      </a>
      <span className={styles.meta}>
        {originWord(line.origin)}, at commit <code>{line.commit}</code>
        {line.symbol === null ? null : (
          <>
            , in <code>{line.symbol}</code>
          </>
        )}
        {line.about === id ? null : ` (${model.label(line.about)})`}
      </span>
      {line.note === null ? null : <span className={styles.note}>{line.note}</span>}
    </li>
  );
}

// The code that says what the page says: who said each fact, the file and lines, and the commit it was read at.
export function TodayEvidence({ model, id, evidence, sources }: TodayEvidenceProps) {
  const cited = new Set(evidence.map((line) => line.href));
  const others = sources.filter((source) => !cited.has(source.href));
  if (evidence.length === 0 && others.length === 0)
    return <p className={styles.none}>No code is cited for it yet.</p>;
  return (
    <ul className={styles.list}>
      {evidence.map((line) => (
        <Line id={id} key={line.href} line={line} model={model} />
      ))}
      {others.map((source) => (
        <li className={styles.line} key={source.href}>
          <a href={source.href} rel="noreferrer" target="_blank">
            {source.label} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}
