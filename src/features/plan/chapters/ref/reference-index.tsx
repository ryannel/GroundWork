import type { Model } from '@/application/plan/derive';
import { teamNames } from '@/application/reference/model';
import { referencePage, type ReferenceKind } from '@/application/reference/query';
import { EntityChip } from '@/features/plan/common/entity-chip';
import type { SearchParams } from '@/shared/search-params';
import { List, ListItem } from '@/ui/list';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { ReferenceControls } from './reference-controls.client';

const NO_PARAMS: SearchParams = {};

/** One searchable index shared by workspace and plan catalogues; only the selected page is rendered. */
export function ReferenceIndex({
  model,
  kind,
  params = NO_PARAMS,
  today = false,
}: {
  readonly model: Model;
  readonly kind: ReferenceKind;
  readonly params?: SearchParams;
  readonly today?: boolean;
}) {
  const { rows, ...page } = referencePage(model, kind, { params, today });
  return (
    <Stack>
      <ReferenceControls
        key={JSON.stringify(page.query)}
        page={page}
        teams={teamNames(model)}
        today={today}
      />
      {rows.length === 0 ? (
        <Text as="p">Nothing matches that filter.</Text>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItem key={row.id}>
              <Stack>
                <Cluster>
                  <EntityChip
                    id={row.id}
                    label={row.label}
                    model={model}
                    {...(page.query.show === 'diff' ? {} : { status: 'existing' })}
                  />
                  {row.owner === null ? null : (
                    <EntityChip id={row.owner} model={model} status="existing" />
                  )}
                </Cluster>
                {row.summary === '' ? null : (
                  <Text as="p" size="sm" tone="faint">
                    {row.summary}
                  </Text>
                )}
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}
