import type { Model } from '@/application/plan/derive';
import {
  type Deciding,
  firstSentenceMd,
  isDecision,
  metaOf,
  numberOf,
  optionsOf,
  sayStateOnCard,
  stateOf,
  tiesOf,
  titleOf,
} from '@/application/plan-viz-decision';
import { stateTone, stateWord } from '@/application/plan-viz-state';
import { ModelInline, ModelText } from '@/features/plan/common/model-text';
import { NamedChips } from '@/features/plan/common/named-chip';
import { Badge } from '@/ui/badge';
import { Glyph } from '@/ui/icon';

import styles from './decision-card.module.css';
import { MetaLine, Options } from './decision-parts';

interface DecisionCardProps {
  readonly model: Model;
  readonly e: Deciding;
}

interface RowProps {
  readonly model: Model;
  readonly label: string;
  readonly ids: readonly string[];
}

function ChipRow({ model, label, ids }: RowProps) {
  if (ids.length === 0) return null;
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <NamedChips ids={ids} model={model} />
    </div>
  );
}

function Said({ model, e }: DecisionCardProps) {
  const text = isDecision(e) ? e.decision : e.answer;
  if (text === undefined) return null;
  return (
    <div className={styles.said}>
      <ModelText model={model} text={text} />
    </div>
  );
}

function Costs({ model, e }: DecisionCardProps) {
  if (!isDecision(e) || e.consequences === undefined) return null;
  return (
    <div className={styles.costs}>
      <span className={styles.rowLabel}>What it costs</span>
      <ModelText model={model} text={e.consequences} />
    </div>
  );
}

/** A decision or a question as a card: its title, why it matters, what was said, what it costs and what hangs on it. */
export function DecisionCard({ model, e }: DecisionCardProps) {
  const state = stateOf(e);
  const ties = tiesOf(model, e);
  const why = isDecision(e) ? firstSentenceMd(e.context) : '';
  return (
    <article className={styles.card} data-state={state}>
      <h4 className={styles.head}>
        <button className={styles.title} data-inspect={e.id} type="button">
          <span className={styles.ref}>
            <Glyph glyph={isDecision(e) ? '⚖' : '?'} />
            {numberOf(model, e.id)}
          </span>
          {titleOf(e)}
        </button>
        {sayStateOnCard(e) ? <Badge tone={stateTone(state)}>{stateWord(state)}</Badge> : null}
      </h4>
      {why === '' ? null : (
        <p className={styles.why}>
          <ModelInline model={model} text={why} />
        </p>
      )}
      <Said e={e} model={model} />
      <Costs e={e} model={model} />
      <Options options={optionsOf(e)} />
      <ChipRow ids={ties.risks} label="Risks accepted with it" model={model} />
      <ChipRow ids={ties.answers} label="Questions it answers" model={model} />
      <ChipRow ids={ties.waiting} label="Waiting on this" model={model} />
      <MetaLine meta={metaOf(e)} model={model} />
    </article>
  );
}
