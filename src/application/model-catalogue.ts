import { modelChipOf } from '@/application/model-chip';
import type { ModelIndex } from '@/application/model-index';
import type { Catalogue, CatalogueRow } from '@/application/today-catalogue';
import { modelText, type ModelEntity } from '@/domain/workspace-model';

const unique = (ids: readonly string[]): readonly string[] => [...new Set(ids)];
function selected(index: ModelIndex, focus: ReadonlySet<string>, id: string): boolean {
  const node = index.get(id);
  return (
    node !== null &&
    [node.id, node.place.component, node.place.system, node.place.domain].some(
      (part) => part !== null && focus.has(part),
    )
  );
}
function providerOf(index: ModelIndex, endpoint: string): string | null {
  const entry = index.get(endpoint);
  const provider = index.get(entry?.parent ?? '');
  const id =
    modelText(provider?.data.component) ??
    modelText(provider?.data.external) ??
    modelText(provider?.data.system);
  return id === null ? null : (index.get(id)?.id ?? null);
}
/** Declared interface providers and canonical calls agree on what a boundary answers. */
export function modelOfferedBy(index: ModelIndex, id: string): readonly string[] {
  const offered = index.entities
    .filter((node) => node.kind === 'endpoint' && providerOf(index, node.id) === id)
    .map((node) => node.id);
  const called = index.edges(id, { direction: 'in', kinds: ['call'] }).flatMap((edge) => {
    const via = index.get(edge.via);
    return via?.kind === 'endpoint' || via?.kind === 'operation' ? [via.id] : [];
  });
  return unique([...offered, ...called]);
}
function apisOf(index: ModelIndex, focus: ReadonlySet<string>): readonly CatalogueRow[] {
  return index.entities
    .filter(
      (node) =>
        ['service', 'app', 'external', 'system'].includes(node.kind) &&
        selected(index, focus, node.id),
    )
    .flatMap((node) => {
      const offered = modelOfferedBy(index, node.id);
      if (offered.length === 0) return [];
      const detail =
        modelText(node.data.does) ??
        modelText(node.data.summary) ??
        modelText(node.data.purpose) ??
        '';
      const note =
        node.kind === 'system' && node.data.mapped === false
          ? [detail, 'Implementation not mapped.'].filter(Boolean).join(' ')
          : detail;
      return [
        {
          head: modelChipOf(index, node.id),
          note,
          items: offered.map((id) => modelChipOf(index, id)),
        },
      ];
    });
}
function eventsOf(index: ModelIndex, focus: ReadonlySet<string>): readonly CatalogueRow[] {
  return index.entities
    .filter((node) => node.kind === 'message')
    .flatMap((node) => {
      const producers = index.producers(node.id);
      const announced = producers.some((id) => selected(index, focus, id));
      const unplacedPublisher = producers.length === 0 && selected(index, focus, node.id);
      if (!announced && !unplacedPublisher) return [];
      const consumers = index.consumers(node.id);
      const from =
        producers.length === 0
          ? 'Publisher not identified'
          : `From ${producers.map(index.label).join(', ')}`;
      return [
        {
          head: modelChipOf(index, node.id),
          note: consumers.length === 0 ? `${from}; no recorded consumers` : from,
          items: consumers.map((id) => modelChipOf(index, id)),
        },
      ];
    });
}
function dataOf(index: ModelIndex, focus: ReadonlySet<string>): readonly CatalogueRow[] {
  return index.entities
    .filter((node) => node.kind === 'store' && selected(index, focus, node.id))
    .map((node) => {
      const owner = index.resourceOwner(node.id);
      const ownership = owner === null ? 'Owner not identified' : `Kept by ${index.label(owner)}`;
      const description = modelText(node.data.does) ?? modelText(node.data.summary);
      return {
        head: modelChipOf(index, node.id),
        note: [description, ownership].filter(Boolean).join('; '),
        items: index.entities
          .filter(
            (schema) =>
              schema.kind === 'schema' &&
              index.get(modelText(schema.data.store) ?? '')?.id === node.id,
          )
          .map((schema) => modelChipOf(index, schema.id)),
      };
    });
}
/** Placement bounds the catalogue; providers, producers, consumers and ownership come only from the index. */
export function modelCatalogueOf(index: ModelIndex, scopedIds: ReadonlySet<string>): Catalogue {
  return {
    apis: apisOf(index, scopedIds),
    events: eventsOf(index, scopedIds),
    data: dataOf(index, scopedIds),
  };
}

/** System entries follow declared providers and containment, independently of resource ownership. */
export function modelSystemEntriesOf(
  index: ModelIndex,
  system: string,
  catalogue: Catalogue = modelCatalogueOf(index, new Set([system])),
): readonly ModelEntity[] {
  const offered = catalogue.apis.flatMap((row) => row.items.map((item) => item.id));
  const others = index
    .entries()
    .filter((node) => node.kind !== 'endpoint' && node.place.system === system)
    .map((node) => node.id);
  return unique([...offered, ...others]).flatMap((id) => {
    const node = index.get(id);
    return node !== null && ['endpoint', 'subscription', 'job', 'interaction'].includes(node.kind)
      ? [node]
      : [];
  });
}
