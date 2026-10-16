import type { Model } from '@/application/plan/derive';
import { domainView, namesPlan, narrowedTo } from '@/application/plan-viz-domain';
import type { DomainWords } from '@/application/workspace-language';
import { ModelText } from '@/features/plan/common/model-text';
import { ConceptCards } from '@/features/plan/viz/domain/concept-cards';
import { Names } from '@/features/plan/viz/domain/names';

import styles from './today-language.module.css';

interface TodayLanguageProps {
  readonly model: Model;
  readonly words: DomainWords;
}

// The words a domain owns, as they are today: the domain in its own words, what each word means and where it is
// created, then what each system calls the same thing.
export function TodayLanguage({ model, words }: TodayLanguageProps) {
  const named = namesPlan(model, narrowedTo(domainView(model, true), words.concepts));
  return (
    <>
      {words.summary === '' ? null : (
        <div className={styles.story}>
          <ModelText model={model} text={words.summary} />
        </div>
      )}
      <ConceptCards model={model} only={words.concepts} today />
      {named.kind === 'none' ? null : (
        <>
          <h3 className={styles.label}>Same thing, different names</h3>
          <Names model={model} only={words.concepts} today />
        </>
      )}
    </>
  );
}
