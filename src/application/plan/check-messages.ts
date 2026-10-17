import { scoped, whereAt, type CheckContext, type Report } from '@/application/plan/check-context';
import type { SystemGraph } from '@/domain/plan/plan-graph';

/** `sku, country` is the composite key [sku, country]. */
const keyNames = (key: string): string[] =>
  key
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

type Msg = SystemGraph['messages'][number];

function checkKey(
  at: { readonly ctx: CheckContext; readonly g: SystemGraph },
  m: Msg,
  rep: Report,
): void {
  const payload = m.key === undefined || m.payload === undefined ? undefined : at.g.get(m.payload);
  if (m.key === undefined || payload?.$type !== 'schema') return;
  const names = payload.fields.map((f) => f.name);
  const path = whereAt(at, m, 'key');
  for (const n of keyNames(m.key).filter((k) => !names.includes(k))) {
    rep.error(
      path,
      `${m.id} is keyed by ${n}, which is not a field of ${String(m.payload)}; use one of ${names.length === 0 ? '(no fields)' : names.join(', ')}`,
    );
  }
}

/** Check 4b (messages): a message's key names fields of its payload schema. */
export function checkMessageKeys(ctx: CheckContext, rep: Report): void {
  for (const { g, list } of scoped(ctx, (x) => x.messages)) {
    for (const m of list) checkKey({ ctx, g }, m, rep);
  }
}
