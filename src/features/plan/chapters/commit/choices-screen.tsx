import type { Model } from '@/application/plan/derive';
import { choicesHeadline, choicesLede, choicesOf } from '@/application/plan-story-commit';
import type { Deciding } from '@/application/plan-viz-decision';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { DecisionCard } from '@/features/plan/viz/decisions/decision-card';

import styles from './choices-screen.module.css';

interface SectionProps {
  readonly model: Model;
  readonly title: string;
  readonly tone: 'pending' | 'ok';
  readonly items: readonly Deciding[];
}

function Section({ model, title, tone, items }: SectionProps) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section}>
      <h3 className={styles.heading} data-tone={tone}>
        {title}
      </h3>
      <div className={styles.cards}>
        {items.map((e) => (
          <DecisionCard e={e} key={e.id} model={model} />
        ))}
      </div>
    </section>
  );
}

// 8.1: the choices the plan rests on, the ones it rests on most first.
export function ChoicesScreen({ model, outline, page }: BodyProps) {
  const choices = choicesOf(model);
  const none = choices.proposed.length + choices.accepted.length + choices.answered.length === 0;
  const lede = choicesLede(choices);
  return (
    <>
      <DeliveryHead
        chapter="commit"
        headline={choicesHeadline(model, choices)}
        model={model}
        outline={outline}
        page={page}
      >
        {none ? (
          <p>
            For the plan’s author: add them under <code>decisions:</code> and link the changes that
            depend on them.
          </p>
        ) : null}
        {lede === '' ? null : <p>{lede}</p>}
      </DeliveryHead>
      <Section items={choices.proposed} model={model} title="Proposed" tone="pending" />
      <Section items={choices.accepted} model={model} title="Accepted" tone="ok" />
      <Section items={choices.answered} model={model} title="Answered" tone="ok" />
    </>
  );
}
