import type { ComponentCard } from '@/application/today-components';
import type { ChipRef } from '@/application/today-scope';
import { Markdown } from '@/ui/markdown';
import { Text } from '@/ui/text';

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

const counted = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

/** "answers 21 calls · calls 2 · listens to 2 events · keeps 1 store": how much hangs off it, in one line. */
function reachOf(card: ComponentCard): string {
  return [
    card.offers.length === 0 ? '' : `answers ${counted(card.offers.length, 'call', 'calls')}`,
    card.calls.length === 0 ? '' : `calls ${String(card.calls.length)}`,
    card.announces.length === 0
      ? ''
      : `announces ${counted(card.announces.length, 'event', 'events')}`,
    card.listens.length === 0
      ? ''
      : `listens to ${counted(card.listens.length, 'event', 'events')}`,
    card.keeps.length === 0 ? '' : `keeps ${counted(card.keeps.length, 'store', 'stores')}`,
    card.uses.length === 0 ? '' : `uses ${counted(card.uses.length, 'store', 'stores')}`,
  ]
    .filter((part) => part !== '')
    .join(' · ');
}

function OneCard({ card }: { readonly card: ComponentCard }) {
  const reach = reachOf(card);
  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3 className={styles.name}>
          <RefChip chip={card.chip} />
        </h3>
        <span className={styles.kind}>{card.kind}</span>
      </header>
      {card.does === '' ? null : <p className={styles.does}>{card.does}</p>}
      {reach === '' && card.summary === '' ? null : (
        <details className={styles.more}>
          <summary>
            <Text size="sm" tone="faint">
              {reach === '' ? 'More about it' : reach}
            </Text>
          </summary>
          {card.summary === '' ? null : (
            <div className={styles.summary}>
              <Markdown text={card.summary} />
            </div>
          )}
          <dl className={styles.parts}>
            <Row chips={card.offers} label="Offers" />
            <Row chips={card.calls} label="Calls" />
            <Row chips={card.announces} label="Announces" />
            <Row chips={card.listens} label="Listens to" />
            <Row chips={card.keeps} label="Keeps" />
            <Row chips={card.uses} label="Uses" />
          </dl>
        </details>
      )}
    </article>
  );
}

// Each component of a system: what it is and does, and in one line how much hangs off it. The calls it answers,
// what it calls, the events it announces and hears and the data it keeps fold open beneath; every name opens in
// the inspector.
export function ComponentCards({ cards }: { readonly cards: readonly ComponentCard[] }) {
  return (
    <div className={styles.cards}>
      {cards.map((card) => (
        <OneCard card={card} key={card.chip.id} />
      ))}
    </div>
  );
}
