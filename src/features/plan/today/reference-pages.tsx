import type { ModelReferenceEntry, ModelReferencePage } from '@/application/model-reference';
import type { Model } from '@/application/plan/derive';
import { referenceKindHref } from '@/application/today-reader';
import { referenceOf } from '@/application/today-reference';
import { ReferenceControls } from '@/features/plan/chapters/ref/reference-controls.client';
import { ReferenceIndex } from '@/features/plan/chapters/ref/reference-index';
import type { SearchParams } from '@/shared/search-params';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import styles from './reference-pages.module.css';

const listOf = (items: readonly string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;

interface ReferenceProps {
  readonly workspace: string;
  readonly model: Model;
}

/** Every kind of thing the systems hold today, each with how many and what its catalogue is for. */
export function TodayReference({ workspace, model }: ReferenceProps) {
  return <ModelTodayReference workspace={workspace} kinds={referenceOf(model)} />;
}

export function ModelTodayReference({
  workspace,
  kinds,
}: {
  readonly workspace: string;
  readonly kinds: readonly ModelReferenceEntry[];
}) {
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

/** Native pages share the catalogue controls and bounded rows; full records open in the native inspector. */
export function ModelTodayCatalogue({
  entry,
  page,
}: {
  readonly entry: ModelReferenceEntry;
  readonly page: ModelReferencePage;
}) {
  const { rows, teams, ...controls } = page;
  return (
    <>
      <PageHeader title={entry.title} description={entry.headline}>
        <p>{entry.lede}</p>
      </PageHeader>
      <Stack>
        <ReferenceControls
          key={JSON.stringify(controls.query)}
          page={controls}
          teams={teams}
          today
        />
        {rows.length === 0 ? (
          <Text as="p">Nothing matches that filter.</Text>
        ) : (
          <List>
            {rows.map((row) => (
              <ListItem key={row.chip.id}>
                <Stack>
                  <Chip {...row.chip} />
                  {row.owner === null ? null : <Chip {...row.owner} />}
                  {row.summary === '' ? null : (
                    <Text as="p" tone="faint">
                      {row.summary}
                    </Text>
                  )}
                  {row.gaps.map((gap, at) => (
                    <Text
                      as="p"
                      size="sm"
                      tone="muted"
                      key={`${gap.kind}:${gap.message}:${String(at)}`}
                    >
                      {gap.message}
                      {gap.count === undefined || gap.count === 1
                        ? null
                        : ` (${String(gap.count)} occurrences)`}
                    </Text>
                  ))}
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </Stack>
    </>
  );
}
