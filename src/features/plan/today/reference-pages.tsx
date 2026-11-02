import type { Model } from '@/application/plan/derive';
import { referenceKindHref } from '@/application/today-reader';
import { referenceOf } from '@/application/today-reference';
import { ReferenceIndex } from '@/features/plan/chapters/ref/reference-index';
import type { SearchParams } from '@/shared/search-params';
import { Card } from '@/ui/card';
import { PageHeader } from '@/ui/page-header';

import styles from './reference-pages.module.css';

const listOf = (items: readonly string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;

interface ReferenceProps {
  readonly workspace: string;
  readonly model: Model;
}

/** Every kind of thing the systems hold today, each with how many and what its catalogue is for. */
export function TodayReference({ workspace, model }: ReferenceProps) {
  const kinds = referenceOf(model);
  const what =
    kinds.length === 0
      ? 'Nothing is recorded about how the systems work yet.'
      : `What is recorded of the systems today: ${listOf(kinds.map((k) => k.size))}.`;
  return (
    <>
      <PageHeader description={what} title="Reference">
        <p>
          Each catalogue lists one kind of thing as it runs today. Open any name to see it whole.
        </p>
      </PageHeader>
      <ul className={styles.cards}>
        {kinds.map((entry) => (
          <li key={entry.kind}>
            <Card href={referenceKindHref(workspace, entry.kind)} title={entry.title}>
              <p className={styles.headline}>{entry.headline}</p>
              <p className={styles.lede}>{entry.lede}</p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

/** One catalogue of the systems as they run today: no modes, no status. */
export function TodayCatalogue({
  model,
  kind,
  params,
}: ReferenceProps & { readonly kind: string; readonly params?: SearchParams }) {
  const entry = referenceOf(model).find((each) => each.kind === kind);
  if (entry === undefined) return null;
  return (
    <>
      <PageHeader title={entry.title} description={entry.headline}>
        <p>{entry.lede}</p>
      </PageHeader>
      <ReferenceIndex
        kind={entry.kind}
        model={model}
        today
        {...(params === undefined ? {} : { params })}
      />
    </>
  );
}
