import { buildId, childId, hasPrefix, isQualifiedId, localId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { fieldsOf } from './contracts';
import type { MigrationFile } from './files';
import type { MigrationReview } from './review';
import { slug } from './steps';

type Node = Readonly<Record<string, unknown>>;
export interface MigrationIdentities {
  readonly replacements: ReadonlyMap<string, string>;
  readonly components: ReadonlyMap<string, Node>;
  readonly placements: ReadonlyMap<string, string>;
  readonly ambiguous: ReadonlyMap<string, readonly string[]>;
  readonly externalKinds: ReadonlyMap<string, 'external' | 'system'>;
}
function mappedId(id: string, prefix: string): string {
  return buildId(prefix, localId(id));
}
function fileIdentity(file: MigrationFile): readonly [string, string] | null {
  const value = modelRecord(file.value);
  const id = modelText(value?.id) ?? modelText(modelRecord(value?.meta)?.id);
  if (id === null) return null;
  if (file.path.endsWith('/domain.yaml')) return [id, 'dom'];
  if (file.path.endsWith('/system.yaml')) return [id, 'sys'];
  if (/^plans\/.*(?:plan|revisions\/[^/]+)\.yaml$/u.test(file.path)) return [id, 'plan'];
  if (file.path.startsWith('programmes/')) return [id, 'prog'];
  return null;
}
function externalKind(component: Node, review: MigrationReview): 'external' | 'system' {
  const id = modelText(component.id) ?? '';
  if (localId(id).includes('launchdarkly')) return 'external';
  const accepted = modelRecord(
    review.add('identities', `identity/${id}`, component, {
      id,
      name: component.name,
      does: component.does,
      proposed: null,
      reason: 'Legacy external does not distinguish a vendor from an unmapped company system.',
    }),
  );
  return accepted?.kind === 'system' ? 'system' : 'external';
}
interface IdentityState extends MigrationIdentities {
  readonly add: (before: string, after: string) => void;
  readonly declare: (id: string, component: Node, system: string) => void;
  readonly external: (id: string, kind: 'external' | 'system') => void;
}
function identityState(): IdentityState {
  const replacements = new Map<string, string>();
  const components = new Map<string, Node>();
  const placements = new Map<string, string>();
  const externalKinds = new Map<string, 'external' | 'system'>();
  const ambiguous = new Map<string, readonly string[]>();
  return {
    replacements,
    components,
    placements,
    externalKinds,
    ambiguous,
    add: (before, after) => {
      const previous = replacements.get(before);
      if (previous !== undefined && previous !== after && isQualifiedId(before)) {
        throw new Error(`Conflicting identity: ${before}`);
      }
      const alternatives = ambiguous.get(before);
      if (alternatives !== undefined) {
        ambiguous.set(before, [...new Set([...alternatives, after])]);
        return;
      }
      if (previous !== undefined && previous !== after) {
        ambiguous.set(before, [previous, after]);
        replacements.delete(before);
        return;
      }
      if (before !== after) replacements.set(before, after);
    },
    declare: (id, component, system) => {
      components.set(id, component);
      placements.set(id, system);
    },
    external: (id, kind) => {
      externalKinds.set(id, kind);
    },
  };
}
function addComponent(
  item: unknown,
  system: string,
  state: IdentityState,
  review: MigrationReview,
  implemented: ReadonlyMap<string, readonly string[]>,
): void {
  const component = modelRecord(item);
  const id = modelText(component?.id);
  if (component === null || id === null) throw new Error(`${system}: missing component id.`);
  if (state.components.has(id)) throw new Error(`Component declared more than once: ${id}`);
  state.declare(id, component, system);
  const prefixes: Readonly<Record<string, string>> = {
    website: 'app',
    queue: 'top',
    library: 'lib',
  };
  const prefix = prefixes[modelText(component.type) ?? ''];
  if (prefix !== undefined) state.add(id, mappedId(id, prefix));
  if (component.type !== 'external') return;
  const handlers = implemented.get(id);
  if (handlers !== undefined) {
    review.add(
      'component-kinds',
      `implemented/${id}`,
      { component, handlers },
      {
        id,
        handlers,
        disposition:
          'Existing handlers prove an executable component; retain its svc identity and known implementation.',
      },
    );
    return;
  }
  const kind = externalKind(component, review);
  state.external(id, kind);
  const externalPrefix = kind === 'external' ? 'ext' : 'sys';
  const next = localId(id).includes('launchdarkly')
    ? buildId('ext', 'launchdarkly')
    : mappedId(id, externalPrefix);
  state.add(id, next);
}
function addAreas(file: MigrationFile | undefined, state: IdentityState): void {
  const landscape = modelRecord(file?.value);
  for (const item of modelList(landscape?.areas)) {
    const id = modelText(modelRecord(item)?.id);
    if (id !== null && !isQualifiedId(id)) state.add(id, buildId('area', slug(id)));
  }
}
function implementedComponents(
  files: readonly MigrationFile[],
): ReadonlyMap<string, readonly string[]> {
  const result = new Map<string, readonly string[]>();
  for (const file of files.filter((value) => value.path.endsWith('/handlers.yaml'))) {
    for (const item of modelList(modelRecord(file.value)?.handlers)) {
      const handler = modelRecord(item);
      const component = modelText(handler?.component);
      const id = modelText(handler?.id);
      if (component !== null && id !== null) {
        result.set(component, [...(result.get(component) ?? []), id]);
      }
    }
  }
  return result;
}
function addFieldIdentities(node: Node, state: IdentityState): void {
  const id = modelText(node.id);
  const fields = modelList(node.fields);
  if (id !== null && fields.length > 0) {
    const migrated = fieldsOf(fields);
    for (const [index, field] of fields.entries()) {
      const original = modelRecord(field);
      const before = modelText(original?.id) ?? modelText(original?.name);
      const after = modelText(migrated[index]?.id);
      if (before !== null && after !== null) state.add(childId(id, before), childId(id, after));
    }
  }
}
function fieldIdentities(value: unknown, state: IdentityState): void {
  if (Array.isArray(value)) {
    for (const item of value) fieldIdentities(item, state);
    return;
  }
  const node = modelRecord(value);
  if (node === null) return;
  addFieldIdentities(node, state);
  for (const item of Object.values(node)) fieldIdentities(item, state);
}
function plannedComponentIdentities(files: readonly MigrationFile[], state: IdentityState): void {
  for (const file of files.filter((item) => item.path.startsWith('plans/'))) {
    const changes = modelList(modelRecord(file.value)?.changes);
    const ops = changes.flatMap((change) => modelList(modelRecord(change)?.ops));
    for (const item of ops) {
      const op = modelRecord(item);
      const value = modelRecord(op?.value);
      const id = modelText(value?.id);
      if (op?.add === 'service' && value?.kind === 'ui' && id !== null) {
        state.add(id, mappedId(id, 'app'));
      }
    }
  }
}
export function migrationIdentities(
  files: readonly MigrationFile[],
  review: MigrationReview,
): MigrationIdentities {
  const state = identityState();
  const implemented = implementedComponents(files);
  for (const file of files) {
    const identity = fileIdentity(file);
    if (identity !== null) state.add(identity[0], mappedId(identity[0], identity[1]));
    const value = modelRecord(file.value);
    if (!file.path.endsWith('/system.yaml')) continue;
    const system = mappedId(modelText(value?.id) ?? '', 'sys');
    for (const item of modelList(value?.components)) {
      addComponent(item, system, state, review, implemented);
    }
  }
  plannedComponentIdentities(files, state);
  for (const file of files) fieldIdentities(file.value, state);
  addAreas(
    files.find((file) => file.path === 'landscape.yaml'),
    state,
  );
  return state;
}

function legacyJobTargets(
  files: readonly MigrationFile[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const targets = new Map<string, Set<string>>();
  for (const file of files.filter((item) => item.path.endsWith('/handlers.yaml'))) {
    for (const value of modelList(modelRecord(file.value)?.handlers)) {
      const handler = modelRecord(value);
      const on = modelText(handler?.on);
      const id = modelText(handler?.id);
      if (on === null || id === null || !hasPrefix(on, 'job')) continue;
      const entries = targets.get(on) ?? new Set<string>();
      entries.add(buildId('job', localId(id)));
      targets.set(on, entries);
    }
  }
  return targets;
}
/** Legacy job labels were entry descriptions; shared labels cannot identify one canonical entry. */
export function migrationJobIdentities(files: readonly MigrationFile[]): {
  readonly replacements: ReadonlyMap<string, string>;
  readonly aliases: Readonly<
    Record<string, { readonly to: string | null; readonly reason: string }>
  >;
} {
  const targets = legacyJobTargets(files);
  const replacements = new Map<string, string>();
  const aliases: Record<string, { readonly to: string | null; readonly reason: string }> = {};
  for (const [before, entries] of targets) {
    const candidates = [...entries].toSorted((a, b) => a.localeCompare(b));
    const target = candidates.length === 1 ? candidates[0] : null;
    if (target === before) continue;
    if (typeof target === 'string') replacements.set(before, target);
    aliases[before] = {
      to: target ?? null,
      reason:
        candidates.length === 1
          ? 'Canonical job entry; original trigger retained on the declaration.'
          : `Shared legacy trigger label; use ${candidates.join(' or ')}.`,
    };
  }
  return { replacements, aliases };
}
