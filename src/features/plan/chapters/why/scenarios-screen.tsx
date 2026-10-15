import { scenariosView, type ScenarioCard } from '@/application/plan-story-why';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { Legend } from '@/ui/legend';

import styles from './scenarios-screen.module.css';

interface CardProps extends Pick<BodyProps, 'model'> {
  readonly card: ScenarioCard;
  readonly tagged: boolean;
}

function Card({ model, card, tagged }: CardProps) {
  return (
    <article className={styles.card}>
      <h3 className={styles.title}>
        <span aria-hidden="true" className={styles.quoteMark}>
          ❝
        </span>
        <button className={styles.titleButton} data-inspect={card.id} type="button">
          {card.title}
        </button>
      </h3>
      <div className={styles.story}>
        <ModelText model={model} text={card.story} />
      </div>
      {card.flows.length === 0 ? null : (
        <footer className={styles.flows}>
          <span className={styles.flowsLabel}>Flows</span>
          {card.flows.map((flow) => (
            <span className={styles.flow} key={flow.id}>
              <EntityChip id={flow.id} model={model} status="existing" />
              {tagged ? (
                <span className={styles.tag} data-new={flow.added ? '' : undefined}>
                  {flow.added ? 'new' : 'today'}
                </span>
              ) : null}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}

const KEY = [
  { swatch: 'plain', label: 'today: the flow runs today' },
  { swatch: 'add', label: 'new: the flow is added with this plan' },
] as const;

// Where each scenario runs: on today's flows, on new ones, or on both.
export function ScenariosScreen({ model, outline, page }: BodyProps) {
  const view = scenariosView(model);
  return (
    <>
      <ScreenHead headline={view.headline} outline={outline} page={page}>
        {view.lede === '' ? null : <p>{view.lede}</p>}
      </ScreenHead>
      <div className={styles.cards} data-count={view.cards.length}>
        {view.cards.map((card) => (
          <Card card={card} key={card.id} model={model} tagged={view.mixed} />
        ))}
      </div>
      {view.mixed ? <Legend items={KEY} /> : null}
    </>
  );
}
