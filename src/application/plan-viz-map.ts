import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';

// The names and labels the flow drawings share (the flow diagram, the sequence, the store grid).

type Kinds = Readonly<Record<string, readonly [glyph: string, word: string]>>;

const SERVICE_KINDS: Kinds = {
  service: ['▣', 'SERVICE'],
  ui: ['◧', 'UI'],
  job: ['⏱', 'JOB'],
  external: ['◇', 'EXTERNAL'],
};

const STORE_KINDS: Kinds = {
  database: ['⛁', 'DATABASE'],
  warehouse: ['⛁', 'WAREHOUSE'],
  bucket: ['⛁', 'BUCKET'],
  cache: ['◍', 'CACHE'],
  topic: ['⇶', 'TOPIC'],
  queue: ['⇶', 'QUEUE'],
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A service, store or topic as its type glyph and upper-case type word. */
export function nodeType(id: string, entity: unknown): readonly [glyph: string, word: string] {
  if (entity === undefined || entity === null) return ['·', 'ITEM'];
  const kind = text(prop(entity, 'kind'));
  if (id.startsWith('st:')) return STORE_KINDS[kind] ?? ['⛁', 'STORE'];
  return SERVICE_KINDS[kind] ?? ['▣', 'SERVICE'];
}

const clipText = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

function endpointLabel(method: string, path: string, max: number): string {
  if (path.length + method.length + 1 <= max) return `${method} ${path}`;
  const last = path.split('/').findLast((segment) => segment !== '') ?? '';
  return clipText(`${method} …/${last}`, max);
}

function signatureLabel(sig: string, max: number): string {
  const [method = '', path = ''] = sig.split(/\s+/u, 2);
  if (METHODS.has(method) && path !== '') return endpointLabel(method, path, max);
  return clipText(emptied(sig), max);
}

// "StartBillingRun(a, b)" reads as "StartBillingRun()".
function emptied(sig: string): string {
  const open = sig.indexOf('(');
  const close = sig.indexOf(')', open);
  return open === -1 || close === -1 ? sig : `${sig.slice(0, open)}()${sig.slice(close + 1)}`;
}

function messageLabel(entity: unknown, max: number): string {
  const words = [text(prop(entity, 'name')), text(prop(entity, 'version'))];
  return clipText(words.filter((word) => word !== '').join(' '), max);
}

/** A short edge or step label: "POST …/cancel", "StartBillingRun()", "subscription.status.changed v1". */
export function viaLabel(model: Model, via: string | null, max = 30): string {
  if (via === null || via === '' || via === 'internal') return 'internal';
  const entity = model.get(via);
  if (entity === undefined) return via;
  if (via.startsWith('msg:')) return messageLabel(entity, max);
  const sig = [text(prop(entity, 'sig')), text(prop(entity, 'name')), via].find((s) => s !== '');
  return signatureLabel(sig ?? via, max);
}
