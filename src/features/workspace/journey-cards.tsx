import type { JourneyCard } from '@/application/today-scope';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';

import styles from './journey-cards.module.css';

// The journeys and flows through a part of the workspace, each a card that opens its walk: who starts it, what
// sets it off, what it ends with and the systems it crosses.
export function JourneyCards({ cards }: { readonly cards: readonly JourneyCard[] }) {
  if (cards.length === 0)
    return <p className={styles.none}>No journey or flow runs through here yet.</p>;
  return (
    <ul className={styles.cards}>
      {cards.map((card) => (
        <li key={card.key}>
          <Card href={card.href} title={card.title}>
            <p className={styles.kind}>
              <Badge tone={card.kind === 'journey' ? 'accent' : 'neutral'}>
                {card.kind === 'journey' ? 'User journey' : 'Flow'}
              </Badge>
              <span>{card.claim}</span>
            </p>
            <dl className={styles.ends}>
              {card.trigger === '' ? null : (
                <>
                  <dt>Starts when</dt>
                  <dd>{card.trigger}</dd>
                </>
              )}
              {card.outcome === '' ? null : (
                <>
                  <dt>Ends with</dt>
                  <dd>{card.outcome}</dd>
                </>
              )}
              <dt>Crosses</dt>
              <dd>{card.through}</dd>
            </dl>
            {card.here === null ? null : <p className={styles.here}>{card.here}</p>}
            {card.why === undefined || card.why === null ? null : (
              <p className={styles.why}>{card.why}</p>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
