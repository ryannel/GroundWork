import type { Model } from '@/application/plan/derive';
import { levelWord, PLANNED, runsLine } from '@/application/plan-viz-tests';
import type { Test } from '@/domain/plan/plan.generated';
import { ModelText } from '@/features/plan/common/model-text';
import { NamedChips } from '@/features/plan/common/named-chip';
import { TeamTag } from '@/features/plan/common/team-dot';
import { Badge } from '@/ui/badge';
import { Glyph } from '@/ui/icon';

import styles from './test-card.module.css';

const CLAUSES = ['given', 'when', 'then'] as const;

interface TestCardProps {
  readonly model: Model;
  readonly test: Test;
}

/** A planned test as a card: what it is called, where it runs, its given, when and then, and what it proves. */
export function TestCard({ model, test }: TestCardProps) {
  const clauses = CLAUSES.filter((k) => (test[k] ?? '') !== '');
  const proves = test.proves;
  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h4 className={styles.title}>
          <span aria-hidden="true" className={styles.glyph} title="Planned test: not run yet">
            <Glyph glyph={PLANNED} />
          </span>
          <span>{model.label(test.id)}</span>
        </h4>
        <div className={styles.badges}>
          <Badge>{levelWord(test.level)} test</Badge>
          {test.env === undefined ? null : <Badge>{runsLine([test.env])}</Badge>}
          {test.owner === undefined ? null : <TeamTag model={model} teamId={test.owner} />}
        </div>
      </header>
      {clauses.length === 0 ? null : (
        <div className={styles.clauses}>
          {clauses.map((k) => (
            <div className={styles.clause} key={k}>
              <span className={styles.label}>{k}</span>
              <ModelText model={model} text={test[k]} />
            </div>
          ))}
        </div>
      )}
      {proves.length === 0 ? null : (
        <div className={styles.proves}>
          <span className={styles.label}>proves</span>
          <NamedChips ids={proves} model={model} />
        </div>
      )}
    </article>
  );
}
