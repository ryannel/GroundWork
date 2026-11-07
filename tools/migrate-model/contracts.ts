import { buildId, isChildId, localId, parseId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { convertCitations, type MigrationCitations } from './citations';
import { fingerprint, type MigrationReview } from './review';
import { slug } from './steps';

type Node = Readonly<Record<string, unknown>>;
export interface ContractContext {
  readonly citations: MigrationCitations;
  readonly review: MigrationReview;
}
function nodeOf(value: unknown): Node {
  const node = modelRecord(value);
  if (node === null) throw new Error('Expected an authored contract object.');
  return node;
}
function partsOf(text: string): readonly string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if ('<(['.includes(character)) depth += 1;
    if ('>)]'.includes(character)) depth -= 1;
    if (character === ',' && depth === 0) {
      result.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(text.slice(start).trim());
  return result;
}
export function taggedType(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.endsWith('[]')) return { array: taggedType(value.slice(0, -2)) };
  const wrapper = /^(Map|Dictionary|List|Array|oneof|one_of|enum)[<(](.*)[>)]$/u.exec(value);
  const inner = wrapper?.[2];
  if (wrapper === null || inner === undefined) return value;
  const parts = partsOf(inner);
  if (wrapper[1] === 'enum') {
    return { enum: parts.map((part) => part.replaceAll(/^['"]|['"]$/gu, '')) };
  }
  if (wrapper[1] === 'oneof' || wrapper[1] === 'one_of') return { one_of: parts.map(taggedType) };
  if (wrapper[1] === 'Map' || wrapper[1] === 'Dictionary') {
    return parts.length === 2
      ? { map: { key: taggedType(parts[0]), value: taggedType(parts[1]) } }
      : value;
  }
  return { array: taggedType(inner) };
}
function fieldId(name: string | null): string {
  if (name === null) return '';
  return isChildId(name) ? name : slug(`field ${name}`);
}
function argumentFields(args: unknown, note: string | null): Node {
  if (typeof args === 'string') {
    return { note: [note, `Original GraphQL arguments: ${args}`].filter(Boolean).join('\n\n') };
  }
  return args === undefined ? {} : { args: fieldsOf(modelList(args)) };
}
export function fieldsOf(values: readonly unknown[]): readonly Node[] {
  return values.map((value) => {
    const { args, ...field } = nodeOf(value);
    const declared = modelText(field.id);
    const name = modelText(field.name);
    const id = declared === null ? fieldId(name) : (parseId(declared)?.path.at(-1) ?? declared);
    return {
      ...field,
      id,
      ...(field.type === undefined ? {} : { type: taggedType(field.type) }),
      ...argumentFields(args, modelText(field.note)),
    };
  });
}
export function errorOf(value: unknown): Node {
  const error = nodeOf(value);
  if (error.code === undefined) return error;
  const { code, ...kept } = error;
  return {
    ...kept,
    when: [modelText(error.when), `Code: ${JSON.stringify(code)}`].filter(Boolean).join(' · '),
  };
}
export function restShapeOf(value: unknown): Node {
  const sig = modelText(value);
  const rest =
    sig === null ? null : /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\s+(\/\S*)$/u.exec(sig);
  return rest === null ? {} : { method: rest[1], path: rest[2] };
}
export function entryOf(value: unknown, kind: unknown, review: MigrationReview): Node {
  const entry = nodeOf(value);
  const sig = modelText(entry.sig);
  const shape = kind === 'rest' ? restShapeOf(sig) : {};
  if (sig !== null && Object.keys(shape).length === 0) {
    review.add('signatures', `signature/${String(entry.id)}`, entry, {
      id: entry.id,
      sig,
      disposition: 'Original sig retained; no protocol fields guessed.',
    });
  }
  return {
    ...entry,
    ...shape,
    ...(entry.errors === undefined ? {} : { errors: modelList(entry.errors).map(errorOf) }),
  };
}
function interfaceProvider(service: unknown, node: Node): Node {
  const provider =
    modelText(service) ??
    modelText(node.component) ??
    modelText(node.external) ??
    modelText(node.system);
  if (provider === null) return {};
  const fields: Readonly<Record<string, string>> = { ext: 'external', sys: 'system' };
  const field = fields[parseId(provider)?.prefix ?? ''] ?? 'component';
  return { [field]: provider };
}
export function migrateContracts(input: unknown, context: ContractContext): Node {
  const file = nodeOf(convertCitations(input, context.citations));
  const interfaces = modelList(file.interfaces).map((item) => {
    const node = nodeOf(item);
    const { service, protocol, endpoints, ...kept } = node;
    const transport = protocol === 'http' || protocol === 'https' ? protocol : null;
    const kind = transport === null ? (protocol ?? node.kind) : 'rest';
    return {
      ...kept,
      kind,
      ...(transport === null ? {} : { transport }),
      ...interfaceProvider(service, kept),
      entries: modelList(endpoints ?? node.entries).map((entry) =>
        entryOf(entry, kind, context.review),
      ),
    };
  });
  const schemas = modelList(file.schemas).map((value) => {
    const schema = nodeOf(value);
    return {
      ...schema,
      ...(schema.fields === undefined ? {} : { fields: fieldsOf(modelList(schema.fields)) }),
    };
  });
  const messages = modelList(file.messages).map((value) =>
    Object.fromEntries(
      Object.entries(nodeOf(value)).filter(([key]) => !['producer', 'consumers'].includes(key)),
    ),
  );
  return {
    interfaces,
    schemas,
    messages,
    subscriptions: modelList(file.subscriptions),
    jobs: modelList(file.jobs),
    interactions: modelList(file.interactions),
    operations: modelList(file.operations),
  };
}
export function migrateScreens(
  values: readonly unknown[],
  citations: MigrationCitations,
): readonly Node[] {
  return values.map((item) => {
    const { service, image, ...screen } = nodeOf(convertCitations(item, citations));
    const regions = modelList(screen.regions).map((value) => {
      const region = nodeOf(value);
      const id = modelText(region.id);
      return {
        ...Object.fromEntries(Object.entries(region).filter(([key]) => key !== 'shows')),
        ...(region.shows === undefined ? {} : { summary: region.shows }),
        id: id === null ? slug(modelText(region.name) ?? '') : (parseId(id)?.path.at(-1) ?? id),
      };
    });
    return {
      ...screen,
      app: screen.app ?? service,
      ...(typeof image === 'string'
        ? { assets: [...modelList(screen.assets), { file: image }] }
        : {}),
      ...(screen.regions === undefined ? {} : { regions }),
    };
  });
}
export function subscriptionOf(handler: Node, cites: readonly unknown[]): Node | null {
  const on = modelText(handler.on);
  const component = modelText(handler.component);
  if (parseId(on)?.prefix !== 'msg' || on === null || component === null) return null;
  return {
    id: buildId('sub', `${localId(component)}-${localId(on)}`),
    component,
    message: on,
    ...(cites.length === 0 ? {} : { cites }),
  };
}
export function reviewUnplaced(value: unknown, scope: string, review: MigrationReview): void {
  review.add('placements', `${scope}/${fingerprint(value)}`, value, {
    scope,
    value,
    reason: 'No unambiguous containing system is recorded.',
  });
}
