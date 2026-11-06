import { buildId, localId, parseId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import type { MigrationCitations } from './citations';
import { type MigrationReview, fingerprint } from './review';

type Node = Readonly<Record<string, unknown>>;
const RESOURCE_FIELDS = [
  'notes',
  'layer',
  'granularity',
  'keyed_by',
  'stale',
  'purge',
  'invalidated_by',
  'observed',
];
export function detailIndex(
  files: readonly { readonly value: unknown }[],
): ReadonlyMap<string, readonly Node[]> {
  const details = new Map<string, readonly Node[]>();
  for (const file of files) {
    const value = modelRecord(file.value);
    for (const item of [...modelList(value?.components), ...modelList(value?.stores)]) {
      const node = modelRecord(item);
      const id = modelText(node?.id);
      if (node !== null && id !== null && node.type === undefined) {
        details.set(id, [...(details.get(id) ?? []), node]);
      }
    }
  }
  return details;
}
function words(values: readonly unknown[]): string | null {
  const texts = values.filter(
    (value): value is string => typeof value === 'string' && value !== '',
  );
  return texts.length === 0 ? null : [...new Set(texts)].join('\n\n');
}
function resourceType(component: Node, details: readonly Node[]): Node {
  if (component.type === 'queue') {
    const stream = /kafka|event hub|eventhub|stream/iu.test(modelText(component.tech) ?? '');
    return { kind: 'topic', form: stream ? 'stream' : 'queue' };
  }
  if (component.type === 'website') return { kind: 'app', form: 'web' };
  if (component.type !== 'database') return { kind: 'service' };
  const form =
    details
      .map((detail) => detail.kind)
      .find((value) =>
        ['database', 'cache', 'bucket', 'warehouse', 'vector', 'managed'].includes(String(value)),
      ) ?? 'database';
  return { kind: 'store', form };
}
function recordConflicts(
  component: Node,
  details: readonly Node[],
  review: MigrationReview,
  id: string,
): void {
  for (const detail of details) {
    for (const key of ['name', 'tech', 'does']) {
      if (
        component[key] !== undefined &&
        detail[key] !== undefined &&
        component[key] !== detail[key]
      ) {
        review.add(
          'component-conflicts',
          `component/${id}/${key}/${fingerprint(detail[key])}`,
          { structure: component[key], detail: detail[key] },
          {
            id,
            field: key,
            structure: component[key],
            detail: detail[key],
            disposition:
              key === 'does'
                ? 'Both texts retained in does.'
                : 'Structure value retained; original detail preserved here.',
          },
        );
      }
    }
  }
}
function ownerOf(
  details: readonly Node[],
  cites: readonly unknown[],
  review: MigrationReview,
  id: string,
): Node {
  const owner = details.map((detail) => detail.owner).find((value) => typeof value === 'string');
  if (owner === undefined) return {};
  if (cites.length > 0 && ['svc', 'app'].includes(parseId(owner)?.prefix ?? '')) {
    return { owner: { id: owner, cites } };
  }
  review.add('owners', `owner/${id}`, details, {
    id,
    owner,
    reason: 'No cited executable component is established as the resource owner.',
  });
  return {};
}
export function migrateComponent(
  component: Node,
  details: readonly Node[],
  citations: MigrationCitations,
  review: MigrationReview,
): Node {
  const id = modelText(component.id) ?? '';
  const cites = [...new Set([component, ...details].flatMap((value) => citations.convert(value)))];
  const does = words([
    component.does,
    ...details.flatMap((detail) => [detail.does, detail.summary]),
  ]);
  const fields = Object.fromEntries(
    ['tech', 'infrastructure', ...RESOURCE_FIELDS].flatMap((key) => {
      const value = component[key] ?? details.find((detail) => detail[key] !== undefined)?.[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
  const homeKeys = Object.keys(citations.homes()).filter((key) => {
    const home = citations.homes()[key];
    return (
      home !== undefined &&
      details.some((detail) =>
        modelList(detail.sources).some((source) => modelRecord(source)?.repo === home.repo),
      )
    );
  });
  recordConflicts(component, details, review, id);
  return {
    id,
    name:
      component.name ?? details.find((detail) => detail.name !== undefined)?.name ?? localId(id),
    ...resourceType(component, details),
    ...fields,
    ...(does === null ? {} : { does }),
    ...(cites.length === 0 ? {} : { cites }),
    ...(homeKeys.length === 0 ? {} : { homes: homeKeys }),
    ...ownerOf(details, cites, review, id),
  };
}
export function identityRecord(
  component: Node,
  details: readonly Node[],
  citations: MigrationCitations,
): Node {
  const cites = [...new Set([component, ...details].flatMap((value) => citations.convert(value)))];
  const summary = words([component.does, ...details.map((detail) => detail.summary)]);
  return {
    id: component.id,
    name: component.name ?? localId(modelText(component.id) ?? ''),
    ...(summary === null ? {} : { summary }),
    ...(cites.length === 0 ? {} : { cites }),
  };
}
export function handlerEntry(handler: Node): Node | null {
  const on = modelText(handler.on);
  const component = modelText(handler.component);
  if (on === null || component === null) return null;
  if (on === buildId('msg', localId(on))) {
    return { id: buildId('sub', `${localId(component)}-${localId(on)}`), component, message: on };
  }
  return null;
}
