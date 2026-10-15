import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { SystemStep } from '@/application/plan-viz-experience';
import { ModelText } from '@/features/plan/common/model-text';

import styles from './experience-systems.module.css';
import { SystemList } from './system-list.client';

interface SystemsProps {
  readonly model: Model;
  readonly systems: readonly SystemStep[];
  /** Marks beside a step, by step id (what the plan does to it). */
  readonly marks?: ReadonlyMap<string, ReactNode> | undefined;
  /** The reader's place, so the list scrolls to it. */
  readonly place: string;
}

interface RowProps {
  readonly model: Model;
  readonly step: SystemStep;
  readonly mark: ReactNode;
}

function Row({ model, step, mark }: Readonly<RowProps>) {
  return (
    <li
      aria-current={step.current ? 'step' : undefined}
      className={styles.system}
      data-current={step.current ? '' : undefined}
    >
      <button className={styles.go} data-step={step.stop} type="button">
        <span className={styles.number}>{step.n}</span>
        <span>
          <strong>
            {step.action}
            {mark}
          </strong>
          <small>
            {step.from} → {step.to}
            {step.event ? ' · event-driven' : ''}
          </small>
        </span>
      </button>
      {step.logic === '' ? null : (
        <div className={styles.logic}>
          <ModelText model={model} text={step.logic} />
        </div>
      )}
      {step.fails === '' ? null : (
        <details className={styles.failure}>
          <summary>If this fails</summary>
          <ModelText model={model} text={step.fails} />
        </details>
      )}
    </li>
  );
}

// The system work behind a moment, each step a button that takes the diagram to it.
export function ExperienceSystems({ model, systems, marks, place }: SystemsProps) {
  if (systems.length === 0) return null;
  return (
    <div className={styles.backend}>
      <h4 className={styles.heading}>System steps</h4>
      <p className={styles.explanation}>
        What the systems do after this moment. Select a step to trace it in the diagram.
      </p>
      <SystemList current={place}>
        {systems.map((s) => (
          <Row key={s.id} mark={marks?.get(s.id)} model={model} step={s} />
        ))}
      </SystemList>
    </div>
  );
}
