// The identity vocabulary and its legacy representations share one boundary.
export const ID_PREFIXES = {
  team: 'team',
  sys: 'system',
  svc: 'service',
  st: 'store',
  sch: 'schema',
  if: 'interface',
  api: 'endpoint',
  msg: 'message',
  flow: 'flow',
  chg: 'change',
  tst: 'test',
  wi: 'workItem',
  ms: 'milestone',
  dec: 'decision',
  risk: 'risk',
  q: 'question',
  sc: 'scenario',
  con: 'concept',
  stage: 'stage',
  scr: 'screen',
  graph: 'graph',
  sg: 'subgraph',
  gql: 'operation',
  ui: 'interaction',
  uj: 'userJourney',
  h: 'handler',
  req: 'requirement',
} as const;

export type IdPrefix = keyof typeof ID_PREFIXES;
export type BaseType = (typeof ID_PREFIXES)[IdPrefix];
export type ChildType = 'field' | 'step' | 'region';
export type EntityType = BaseType | ChildType;

const KINDS = {
  ...ID_PREFIXES,
  dom: 'domain',
  app: 'app',
  top: 'topic',
  lib: 'library',
  ext: 'external',
  sub: 'subscription',
  job: 'job',
  actor: 'actor',
  area: 'area',
  jny: 'journey',
  plan: 'plan',
  prog: 'programme',
  ev: 'evidence',
  rel: 'relationship',
} as const;
export type IdKind = (typeof KINDS)[keyof typeof KINDS] | ChildType | 'failure';
export interface ParsedId {
  readonly prefix: string;
  readonly local: string;
  readonly root: string;
  readonly path: readonly string[];
  readonly failure: boolean;
}

export function buildId(prefix: string, local: string): string {
  return `${prefix}:${local}`;
}
export function hasPrefix<Prefix extends string>(
  id: unknown,
  prefix: Prefix,
): id is `${Prefix}:${string}` {
  return typeof id === 'string' && id.startsWith(`${prefix}:`);
}
export function stripPrefix(id: string, prefix: string): string;
export function stripPrefix(id: string | null | undefined, prefix: string): string | undefined;
export function stripPrefix(id: string | null | undefined, prefix: string): string | undefined {
  if (id === null || id === undefined) return undefined;
  return hasPrefix(id, prefix) ? id.slice(prefix.length + 1) : id;
}
export function prefixOf(id: string): string {
  return id.split(':')[0] ?? '';
}
export function rootId(id: string): string;
export function rootId(id?: string): string | undefined;
export function rootId(id?: string): string | undefined {
  return id?.split('#', 1)[0];
}
export function childPathOf(id: string): string | undefined {
  return id.split('#')[1];
}
export function childId(parent: string, child: unknown): string {
  return `${parent}#${String(child)}`;
}
export function nestedId(parent: string, path: readonly string[]): string {
  return childId(parent, path.join('/'));
}
export function failureId(parent: string, failure: string): string {
  return childId(parent, `!${failure}`);
}
export function parentOf(id: unknown): string | null {
  return typeof id === 'string' && id.indexOf('#') > 0 ? rootId(id) : null;
}
export function qualifiedOf(id: string): { readonly scope: string; readonly id: string } | null {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z]+:.+)$/u.exec(id);
  return match?.[1] === undefined || match[2] === undefined
    ? null
    : { scope: match[1], id: match[2] };
}
export function qualifyId(scope: string, id: string): string {
  return `${scope}/${id}`;
}

export function parseId(id: unknown): ParsedId | null {
  if (typeof id !== 'string') return null;
  const match = /^([a-z]+):([^#\s]+)(?:#([^#\s]+))?$/u.exec(id);
  const prefix = match?.[1];
  const local = match?.[2];
  if (prefix === undefined || local === undefined || !Object.hasOwn(KINDS, prefix)) return null;
  const child = match?.[3];
  const failure = child?.startsWith('!') === true;
  const pathText = failure ? child.slice(1) : child;
  const path = pathText === undefined ? [] : pathText.split('/');
  if (path.includes('')) return null;
  return { prefix, local, root: buildId(prefix, local), path, failure };
}
function knownKind(prefix: string): (typeof KINDS)[keyof typeof KINDS] | null {
  return Object.entries(KINDS).find(([key]) => key === prefix)?.[1] ?? null;
}
export function kindOf(id: unknown): IdKind | null {
  const parsed = parseId(id);
  if (parsed === null) return null;
  if (parsed.failure) return 'failure';
  if (parsed.path.length === 0) return knownKind(parsed.prefix);
  if (parsed.prefix === 'sch') return 'field';
  return parsed.prefix === 'scr' ? 'region' : 'step';
}
function legacyPrefix(key: string): key is IdPrefix {
  return Object.hasOwn(ID_PREFIXES, key);
}
/** Preserve the plan reader's vocabulary until it moves to the consolidated model. */
export function planEntityTypeOf(id: unknown): EntityType | null {
  if (typeof id !== 'string') return null;
  const match = /^([a-z]+):[^#\s]+(#.+)?$/u.exec(id);
  const key = match?.[1];
  if (key === undefined || !legacyPrefix(key)) return null;
  const base = ID_PREFIXES[key];
  if (match?.[2] === undefined) return base;
  if (base === 'flow') return 'step';
  if (base === 'schema') return 'field';
  return base === 'screen' ? 'region' : null;
}
const clean = (text: string): string => text.replaceAll(/[^\w.~-]/gu, '');

export function idToToken(id: string): string {
  return clean(id.replace(':', '-').replace('#', '.'));
}

/** The id a token names, or null when it does not start with a known prefix. */
export function tokenToId(token: string): string | null {
  const dash = token.indexOf('-');
  const prefix = token.slice(0, dash);
  if (dash < 1 || dash === token.length - 1 || !Object.hasOwn(ID_PREFIXES, prefix)) return null;
  const rest = token.slice(dash + 1);
  const dot = rest.indexOf('.');
  return dot > 0 ? `${prefix}:${rest.slice(0, dot)}#${rest.slice(dot + 1)}` : `${prefix}:${rest}`;
}

export interface Alias {
  readonly to: string | null;
  readonly reason?: string;
}
export interface AliasResolution {
  readonly id: string | null;
  readonly used: readonly string[];
  readonly problem: string | null;
}
/** Exact child aliases take precedence; a root alias preserves the declared child path. */
export function resolveAlias(
  id: string,
  aliases: Readonly<Record<string, Alias>>,
): AliasResolution {
  const used: string[] = [];
  let current = id;
  for (;;) {
    const { key, alias } = aliasAt(current, aliases);
    if (alias === undefined) return { id: current, used, problem: null };
    if (used.includes(key)) return { id: null, used, problem: `Alias cycle at ${key}` };
    used.push(key);
    if (alias.to === null) return retiredAlias(key, alias.reason, used);
    current = key === current ? alias.to : childId(alias.to, childPathOf(current));
  }
}

/** Legacy display helpers remain here until authored ids have been migrated. */
export const localId = (id: string): string => id.replace(/^[a-z]+:/u, '');
export const colonLocalId = (id: string): string => id.split(':')[1] ?? id;
export const lastChildId = (id: string): string => id.split('#').pop() ?? id;
export const appendChild = (parent: string, child: string): string =>
  parent.includes('#') ? `${parent}/${child}` : childId(parent, child);
export const isQualifiedId = (id: string): boolean => id.includes(':');
export const hasChildPath = (id: unknown): id is `${string}#${string}` =>
  typeof id === 'string' && id.includes('#');

export const workspaceIdPattern = /^[a-z0-9][a-z0-9:-]*$/u;
export const keyTermIdPattern = /^term:[a-z0-9-]+$/u;
export const isDisplayId = (id: string): boolean => /^[a-z]+:[a-z0-9-]+(?:#[a-z0-9-]+)?$/u.test(id);
export const startsWithId = (id: string): boolean => /^[a-z]+:[a-z0-9]/u.test(id);
export const isTextId = (id: string): boolean => /^[a-z]+:[\w-]/u.test(id) && !/\s/u.test(id);
export const splitChildId = (id: string): readonly [string, string | undefined] => [
  rootId(id),
  childPathOf(id),
];

function retiredAlias(
  key: string,
  reason: string | undefined,
  used: readonly string[],
): AliasResolution {
  const problem = (reason ?? '').trim() === '' ? `Alias ${key} needs a reason` : (reason ?? '');
  return { id: null, used, problem };
}

function aliasAt(
  id: string,
  aliases: Readonly<Record<string, Alias>>,
): { readonly key: string; readonly alias: Alias | undefined } {
  const key = Object.hasOwn(aliases, id) ? id : rootId(id);
  return { key, alias: Object.hasOwn(aliases, key) ? aliases[key] : undefined };
}

/** A slash in a child path does not qualify its root into another plan. */
export const scopedId = (scope: string, id: string): string =>
  qualifiedOf(id) === null ? qualifyId(scope, id) : id;

export const isWithinId = (part: string, whole: string): boolean => part.startsWith(`${whole}#`);
export const inIdScope = (id: string, scope: string): boolean => id.startsWith(`${scope}/`);
export const withoutIdScope = (id: string, scope: string): string => id.slice(scope.length + 1);
export const lastIdPart = (id: string): string => id.split(/[:#]/u).pop() ?? id;
export const lastSlugPart = (id: string): string => id.split('-').pop() ?? id;
