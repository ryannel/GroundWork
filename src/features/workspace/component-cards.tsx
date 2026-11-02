import type { ComponentCard } from '@/application/today-components';
import { Text, TextLink } from '@/ui/text';

import styles from './component-cards.module.css';
import { RefChip } from './ref-chip';

const NO_EXPLORER_LINKS: Readonly<Record<string, string>> = {};

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

function OneCard({
  card,
  explorer,
}: {
  readonly card: ComponentCard;
  readonly explorer: string | undefined;
}) {
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
      {explorer === undefined ? null : <TextLink href={explorer}>Explore service →</TextLink>}
      {reach === '' ? null : (
        <Text size="sm" tone="faint">
          {reach}
        </Text>
      )}
      <RefChip chip={{ ...card.chip, label: `Details of ${card.chip.label}` }} />
    </article>
  );
}

// Components as a bounded index: full descriptions and relationships open in the shared inspector.
export function ComponentCards({
  cards,
  explorerLinks = NO_EXPLORER_LINKS,
}: {
  readonly cards: readonly ComponentCard[];
  readonly explorerLinks?: Readonly<Record<string, string>>;
}) {
  return (
    <div className={styles.cards}>
      {cards.map((card) => (
        <OneCard card={card} explorer={explorerLinks[card.chip.id]} key={card.chip.id} />
      ))}
    </div>
  );
}
