import { modelAssetsOf } from '@/application/model-assets';
import { modelKindPresentation } from '@/application/model-chip';
import type { ModelIndex } from '@/application/model-index';
import type { ModelPlanRecord } from '@/application/model-plan-pages';
import type { ModelQueryContext } from '@/application/model-reader';
import { isAuthoredReference, kindOf } from '@/domain/ids';
import { modelRecord } from '@/domain/workspace-model';
import { List, ListItem } from '@/ui/list';
import { Markdown } from '@/ui/markdown';
import { Mention } from '@/ui/mention';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { ModelPlanAssets } from './model-plan-assets';

export function modelPlanItems(
  values: readonly unknown[],
): readonly { readonly key: string; readonly value: unknown }[] {
  const counts = new Map<string, number>();
  return values.map((value) => {
    const identity = JSON.stringify(value);
    const occurrence = counts.get(identity) ?? 0;
    counts.set(identity, occurrence + 1);
    return { key: `${identity}:${String(occurrence)}`, value };
  });
}
export interface ModelPlanLabelLookup {
  readonly labelOf: (id: string) => string;
  /** Workspace work pages link local plan metadata into its own selected plan context. */
  readonly hrefOf?: (id: string) => string | null;
  readonly canInspect?: (id: string) => boolean;
}
export interface ModelPlanLabels extends ModelPlanLabelLookup {
  readonly context: ModelQueryContext;
  readonly version: 'before' | 'after';
  readonly planBase: string;
  readonly index: ModelIndex;
}
function Ref({ id, lookup }: { readonly id: string; readonly lookup: ModelPlanLabelLookup }) {
  const href = lookup.hrefOf?.(id) ?? null;
  if (href !== null) return <TextLink href={href}>{lookup.labelOf(id)}</TextLink>;
  if (lookup.canInspect?.(id) === false) return <Text>{lookup.labelOf(id)}</Text>;
  return (
    <Mention
      id={id}
      label={lookup.labelOf(id)}
      glyph={modelKindPresentation(kindOf(id) ?? 'unknown').glyph}
    />
  );
}
export function ModelPlanText({
  text,
  lookup,
}: {
  readonly text: string | null | undefined;
  readonly lookup: ModelPlanLabelLookup;
}) {
  return (
    <Markdown
      text={text}
      isReference={isAuthoredReference}
      renderRef={(id) => <Ref id={id} lookup={lookup} />}
    />
  );
}
function Scalar({
  value,
  lookup,
}: {
  readonly value: string | number | boolean | null;
  readonly lookup: ModelPlanLabelLookup;
}) {
  if (typeof value !== 'string') return <Text mono>{value === null ? 'null' : String(value)}</Text>;
  if (isAuthoredReference(value)) return <Ref id={value} lookup={lookup} />;
  if (/^https?:\/\/\S+$/u.test(value)) return <TextLink href={value}>{value}</TextLink>;
  return <ModelPlanText text={value} lookup={lookup} />;
}
const fieldLabel = (key: string): string =>
  key.replaceAll('_', ' ').replace(/^./u, (letter) => letter.toUpperCase());
/** Nested authored values retain every field and their recorded order, without a JSON substitute for the page. */
export function ModelPlanValue({
  value,
  lookup,
}: {
  readonly value: unknown;
  readonly lookup: ModelPlanLabelLookup;
}) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return <Scalar value={value} lookup={lookup} />;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? (
      <Text tone="muted">No entries recorded.</Text>
    ) : (
      <List>
        {modelPlanItems(value).map(({ key, value: item }) => (
          <ListItem key={key}>
            <ModelPlanValue value={item} lookup={lookup} />
          </ListItem>
        ))}
      </List>
    );
  }
  const record = modelRecord(value);
  if (record === null) return null;
  return (
    <dl>
      {Object.entries(record)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => (
          <div key={key}>
            <dt>
              <Text size="sm" tone="muted">
                {fieldLabel(key)}
              </Text>
            </dt>
            <dd>
              <ModelPlanValue value={item} lookup={lookup} />
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function ModelPlanRecordDetail({
  record,
  lookup,
}: {
  readonly record: ModelPlanRecord;
  readonly lookup: ModelPlanLabels;
}) {
  return (
    <Stack as="section" label={record.title} gap={2}>
      <Text as="h3" weight="strong">
        {record.title}
      </Text>
      {record.id === null ? null : <Ref id={record.id} lookup={lookup} />}
      <ModelPlanAssets
        assets={
          record.id === null
            ? []
            : modelAssetsOf(lookup.context, record.id, lookup.version, lookup.planBase)
        }
      />
      <ModelPlanValue value={record.data} lookup={lookup} />
    </Stack>
  );
}
