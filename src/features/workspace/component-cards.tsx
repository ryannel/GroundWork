import type { ComponentCard, Offer } from '@/application/today-components';
import type { ChipRef } from '@/application/today-scope';
import { Markdown } from '@/ui/markdown';

import styles from './component-cards.module.css';
import { RefChip, RefChips } from './ref-chip';

function Row({ label, chips }: { readonly label: string; readonly chips: readonly ChipRef[] }) {
  if (chips.length === 0) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <RefChips chips={chips} />
      </dd>
    </>
  );
}

// What answering a call sets off, when the code's handlers are known: each call, announcement, read and write,
// indented under the one that makes it.
function Offers({ offers }: { readonly offers: readonly Offer[] }) {
  if (offers.length === 0) return null;
  return (
    <>
      <dt>Offers</dt>
      <dd>
        <ul className={styles.offers}>
          {offers.map((offer) => (
            <li key={offer.chip.id}>
              <RefChip chip={offer.chip} />
              {offer.calls.length === 0 ? null : (
                <ol className={styles.tree}>
                  {offer.calls.map((line) => (
                    <li className={styles.line} data-depth={line.depth} key={line.key}>
                      <span className={styles.verb}>{line.says}</span> <RefChip chip={line.chip} />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      </dd>
    </>
  );
}

function OneCard({ card }: { readonly card: ComponentCard }) {
  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.name}>
          <RefChip chip={card.chip} />
        </h3>
        <span className={styles.kind}>{card.kind}</span>
      </header>
      {card.does === '' ? null : <p className={styles.does}>{card.does}</p>}
      {card.summary === '' ? null : (
        <div className={styles.summary}>
          <Markdown text={card.summary} />
        </div>
      )}
      <dl className={styles.parts}>
        <Offers offers={card.offers} />
        <Row chips={card.calls} label="Calls" />
        <Row chips={card.announces} label="Announces" />
        <Row chips={card.listens} label="Listens to" />
        <Row chips={card.keeps} label="Keeps" />
        <Row chips={card.uses} label="Uses" />
      </dl>
    </article>
  );
}

// Each component of a system: what it is and does, what it is called on, what it calls, the events it announces
// and listens to, and the data it keeps or uses. Every name opens in the inspector.
export function ComponentCards({ cards }: { readonly cards: readonly ComponentCard[] }) {
  return (
    <div className={styles.cards}>
      {cards.map((card) => (
        <OneCard card={card} key={card.chip.id} />
      ))}
    </div>
  );
}
