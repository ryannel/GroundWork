import type {
  ExplorerField,
  ExplorerLink,
  ExplorerNode,
  ExplorerPage,
  ExplorerSource,
} from './service-explorer';

function object(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function strings(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}
function textFields(value: Readonly<Record<string, unknown>>, fields: readonly string[]): boolean {
  return fields.every((key) => typeof value[key] === 'string');
}
function source(value: unknown): value is ExplorerSource {
  return (
    object(value) &&
    textFields(value, ['id', 'label', 'url']) &&
    typeof value.url === 'string' &&
    /^https:\/\/\S+$/u.test(value.url)
  );
}
function node(value: unknown): value is ExplorerNode {
  if (!object(value) || !textFields(value, ['id', 'label', 'detail', 'kind'])) return false;
  const kinds: readonly unknown[] = [
    'component',
    'entry',
    'branch',
    'call',
    'storage',
    'message',
    'async',
    'return',
    'failure',
    'schema',
  ];
  return (
    kinds.includes(value.kind) &&
    strings(value.sourceIds) &&
    (value.target === null || typeof value.target === 'string')
  );
}
function link(value: unknown): value is ExplorerLink {
  if (!object(value) || !textFields(value, ['id', 'from', 'to', 'label', 'kind'])) return false;
  const kinds: readonly unknown[] = [
    'control',
    'branch',
    'failure',
    'async',
    'data',
    'interaction',
  ];
  return kinds.includes(value.kind) && strings(value.sourceIds);
}
function field(value: unknown): value is ExplorerField {
  if (!object(value) || !textFields(value, ['name', 'type', 'required', 'nullable'])) return false;
  return (
    ['yes', 'no', 'unknown'].includes(String(value.required)) &&
    ['yes', 'no', 'unknown'].includes(String(value.nullable)) &&
    strings(value.sourceIds)
  );
}

interface PageCollections {
  readonly nodes: readonly ExplorerNode[];
  readonly links: readonly ExplorerLink[];
  readonly fields: readonly ExplorerField[];
  readonly sources: readonly ExplorerSource[];
}
function collection<T>(
  value: unknown,
  check: (item: unknown) => item is T,
  maximum: number,
): value is readonly T[] {
  return Array.isArray(value) && value.length <= maximum && value.every(check);
}
function collections(
  value: Readonly<Record<string, unknown>>,
): value is Readonly<Record<string, unknown>> & PageCollections {
  return (
    collection(value.nodes, node, 100) &&
    collection(value.links, link, 200) &&
    collection(value.fields, field, 200) &&
    collection(value.sources, source, 300)
  );
}
function references(value: PageCollections): boolean {
  const ids = new Set(value.nodes.map((item) => item.id));
  const sourceIds = new Set(value.sources.map((item) => item.id));
  return (
    ids.size === value.nodes.length &&
    value.links.every((item) => ids.has(item.from) && ids.has(item.to)) &&
    [...value.nodes, ...value.links, ...value.fields].every((item) =>
      item.sourceIds.every((id) => sourceIds.has(id)),
    )
  );
}
/** Also used on fetched browser data; validation never evaluates source expressions. */
export function isExplorerPage(value: unknown): value is ExplorerPage {
  if (!object(value) || value.format !== 'service-explorer-page/v1') return false;
  if (!textFields(value, ['snapshot', 'title', 'description', 'kind'])) return false;
  if (!['overview', 'flow', 'data', 'callers'].includes(String(value.kind))) return false;
  if (!collections(value) || !strings(value.gaps) || typeof value.completeSelection !== 'boolean') {
    return false;
  }
  if (value.incoming !== undefined && typeof value.incoming !== 'string') return false;
  return references(value);
}
export function explorerPage(value: unknown): ExplorerPage {
  if (!isExplorerPage(value)) throw new Error('Invalid or unbounded explorer page');
  return value;
}
