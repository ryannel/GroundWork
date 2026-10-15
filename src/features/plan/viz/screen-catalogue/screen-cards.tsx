import type { Model } from '@/application/plan/derive';
import type { CatalogueView } from '@/application/plan-viz-screen-catalogue';
import { ModelText } from '@/features/plan/common/model-text';
import { ScreenFigure } from '@/features/plan/viz/screens/screen-figure';

import styles from './screen-cards.module.css';

export interface ScreenCardsProps {
  readonly model: Model;
  readonly base: string;
  readonly sections: CatalogueView['sections'];
}

function Card({
  model,
  base,
  card,
}: {
  readonly model: Model;
  readonly base: string;
  readonly card: CatalogueView['sections'][number]['cards'][number];
}) {
  const screen = model.asIs.get(card.id);
  const summary = screen?.$type === 'screen' ? screen.summary : undefined;
  return (
    <article className={styles.card}>
      <ScreenFigure base={base} caption id={card.id} link mode="asIs" model={model} size="sm" />
      {card.meta === '' ? null : <p className={styles.meta}>{card.meta}</p>}
      {summary === undefined || summary === '' ? null : (
        <p className={styles.summary}>
          <ModelText model={model} text={summary} />
        </p>
      )}
      {card.unlinked ? <p className={styles.unlinked}>No recorded journey link</p> : null}
    </article>
  );
}

// Every current screen as a card, in a list the reader opens: grouped by the app that serves them once there are
// more than three.
export function ScreenCards({ model, base, sections }: ScreenCardsProps) {
  return (
    <details className={styles.all}>
      <summary>Screens and documents</summary>
      <div className={styles.body}>
        {sections.map((section) => (
          <section key={section.app ?? 'all'}>
            {section.app === null ? null : <h4 className={styles.app}>{section.app}</h4>}
            <div className={styles.grid}>
              {section.cards.map((card) => (
                <Card base={base} card={card} key={card.id} model={model} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}
