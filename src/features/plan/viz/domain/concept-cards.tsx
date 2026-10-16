import type { Model } from '@/application/plan/derive';
import {
  type ConceptCard,
  conceptCards,
  domainView,
  narrowedTo,
} from '@/application/plan-viz-domain';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';

import styles from './concept-cards.module.css';

export interface ConceptCardsProps {
  readonly model: Model;
  /** Only what runs today: no concept the plan introduces. */
  readonly today?: boolean;
  /** Only these concepts, by id. */
  readonly only?: readonly string[];
}

function Card({ model, card }: { readonly model: Model; readonly card: ConceptCard }) {
  return (
    <li className={styles.card} data-new={card.isNew ? '' : undefined}>
      <header className={styles.head}>
        <EntityChip id={card.id} label={card.name} model={model} />
        {card.isNew ? <span className={styles.new}>new in this plan</span> : null}
      </header>
      <div className={styles.means}>
        <ModelText model={model} text={card.means} />
      </div>
      {card.bornIn === null ? null : (
        <p className={styles.born}>
          Created in <EntityChip id={card.bornIn} model={model} />
        </p>
      )}
      {card.relations.length === 0 ? null : (
        <ul className={styles.relations}>
          {card.relations.map((r) => (
            <li key={`${r.as}-${r.to}`}>
              <span className={styles.as}>{r.as}</span> <EntityChip id={r.to} model={model} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** One card per concept: what it means, where it is created, what it is part of and relates to. */
export function ConceptCards({ model, today = false, only }: ConceptCardsProps) {
  const cards = conceptCards(narrowedTo(domainView(model, today), only));
  if (cards.length === 0) return null;
  return (
    <ul className={styles.cards}>
      {cards.map((card) => (
        <Card card={card} key={card.id} model={model} />
      ))}
    </ul>
  );
}
