import type { Model } from '@/application/plan/derive';
import { fit, recordClaim, recordTeams } from '@/application/plan-story-changes-records';
import { changesOf } from '@/application/plan-story-changes-touched';
import { schemaCounts } from '@/application/plan-viz-fields';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { FieldTable } from '@/features/plan/viz/field-table/field-table';
import { FieldLegend } from '@/features/plan/viz/field-table/schema-head';
import { SegTabs } from '@/features/plan/viz/query-plan/seg-tabs.client';

import { Decisions, TeamRow } from './changes-kit';

/** A record's fields, today to with this plan, the worst first, with who must move. */
export function RecordTable({ model, id }: { readonly model: Model; readonly id: string }) {
  return (
    <>
      <FieldTable
        changeKey
        changes="auto"
        head
        mode="diff"
        model={model}
        order="worst"
        schemaId={id}
        who
      />
      <FieldLegend counts={schemaCounts(model, id)} />
    </>
  );
}

interface ItemProps {
  readonly id: string;
  readonly item?: string | undefined;
}

function RecordPanel({ model, outline, page, id, item }: BodyProps & ItemProps) {
  const { head, rest } = fit(recordClaim(model, id));
  const node = model.get(id);
  const store =
    node !== undefined && 'store' in node && typeof node.store === 'string'
      ? node.store
      : undefined;
  const name =
    node !== undefined && 'name' in node && typeof node.name === 'string' ? node.name : id;
  return (
    <>
      <ScreenHead headline={head} item={item} outline={outline} page={page}>
        {rest === '' ? null : (
          <p>
            <ModelInline model={model} text={rest} />
          </p>
        )}
        {store === undefined ? null : (
          <p>
            {name} is stored in <EntityChip id={store} model={model} />.
          </p>
        )}
      </ScreenHead>
      <TeamRow model={model} teamIds={recordTeams(model, id)} />
      <RecordTable id={id} model={model} />
      <Decisions changeIds={changesOf(model, id)} model={model} />
    </>
  );
}

/** One grouped screen: a tab per record, the worst first. */
export function RecordsScreen({ ids, ...rest }: BodyProps & { readonly ids: readonly string[] }) {
  const many = ids.length > 1;
  return (
    <>
      {many ? <ScreenHead outline={rest.outline} page={rest.page} /> : null}
      <SegTabs
        label="Records that change"
        stepped
        tabs={ids.map((id) => ({
          key: id,
          label: rest.model.label(id),
          content: <RecordPanel {...rest} id={id} item={many ? rest.model.label(id) : undefined} />,
        }))}
      />
    </>
  );
}
