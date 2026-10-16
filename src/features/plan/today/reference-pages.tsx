import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { teamNames } from '@/application/plan-story-ref';
import { referenceKindHref } from '@/application/today-reader';
import { type ReferenceKind, referenceOf } from '@/application/today-reference';
import { workspaceHref } from '@/application/workspace-paths';
import { ApisCat } from '@/features/plan/chapters/ref/apis-cat';
import type { CatProps } from '@/features/plan/chapters/ref/catalogue-bits';
import { EventsCat } from '@/features/plan/chapters/ref/events-cat';
import { FlowsCat } from '@/features/plan/chapters/ref/flows-cat';
import { OperationsCat } from '@/features/plan/chapters/ref/operations-cat';
import { SchemasCat } from '@/features/plan/chapters/ref/schemas-cat';
import { ScreensCat } from '@/features/plan/chapters/ref/screens-cat';
import { ServicesCat } from '@/features/plan/chapters/ref/services-cat';
import { StoresCat } from '@/features/plan/chapters/ref/stores-cat';
import { Card } from '@/ui/card';
import { PageHeader } from '@/ui/page-header';

import styles from './reference-pages.module.css';

type Catalogue = (props: CatProps & { readonly base: string }) => ReactNode;

const CATALOGUES: Readonly<Record<ReferenceKind, Catalogue>> = {
  components: ServicesCat,
  stores: StoresCat,
  apis: ApisCat,
  schemas: SchemasCat,
  events: EventsCat,
  flows: FlowsCat,
  screens: ScreensCat,
  operations: OperationsCat,
};

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
  workspace,
  model,
  kind,
}: ReferenceProps & { readonly kind: string }) {
  const entry = referenceOf(model).find((k) => k.kind === kind);
  if (entry === undefined) return null;
  const Cat = CATALOGUES[entry.kind];
  return (
    <>
      <PageHeader description={entry.headline} title={entry.title}>
        <p>{entry.lede}</p>
      </PageHeader>
      <Cat base={workspaceHref(workspace)} model={model} teams={teamNames(model)} today />
    </>
  );
}
