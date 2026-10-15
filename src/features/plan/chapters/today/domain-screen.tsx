import { domainHead } from '@/application/plan-story-today-domain';
import { domainView, namesPlan } from '@/application/plan-viz-domain';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelText } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { ConceptCards } from '@/features/plan/viz/domain/concept-cards';
import { Names } from '@/features/plan/viz/domain/names';

import styles from './domain-screen.module.css';

// The words the plan uses, as they are today: what each means, where it is created and what each system calls it.
export function DomainScreen({ model, outline, page }: BodyProps) {
  const head = domainHead(model);
  const view = domainView(model, true);
  const hasNames = namesPlan(model, view).kind !== 'none';
  return (
    <>
      <ScreenHead headline={head.headline} outline={outline} page={page}>
        <p>{head.lede}</p>
      </ScreenHead>
      {view.summary === '' ? null : (
        <div className={styles.story}>
          <ModelText model={model} text={view.summary} />
        </div>
      )}
      <h3 className={styles.label}>Concepts</h3>
      <ConceptCards model={model} today />
      {head.added.length === 0 ? null : (
        <p className={styles.adds}>
          {head.addedBefore}
          {head.added.map((word) => (
            <EntityChip
              id={word.id}
              key={word.id}
              label={word.name}
              model={model}
              status="existing"
            />
          ))}
          {head.addedAfter}
        </p>
      )}
      {hasNames ? (
        <>
          <h3 className={styles.label}>Same thing, different names</h3>
          <Names model={model} today />
        </>
      ) : null}
    </>
  );
}
