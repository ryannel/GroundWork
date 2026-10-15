import type { CheckContext, Report } from '@/application/plan/check-context';
import { isRecord, type Rec } from '@/application/plan/ids';
import { isContainer } from '@/application/plan/ops-index';
import { type EntityType, type PathSegment, CHILDREN } from '@/domain/plan/plan-ids';

/** One way an entity fails its schema: the prop at fault, where inside it, and what to say. */
export interface ShapeProblem {
  prop: string | undefined;
  tail: PathSegment[];
  message: string;
  unknownProp: boolean;
}

/** Checks one authored entity against the schema def of its type. Injected, because ajv is infrastructure. */
export type ShapeCheck = (type: EntityType, entity: Rec) => ShapeProblem[];

/** The authored shape of a node: derived `$`-props and a field's id stripped, children resolved. */
function plain(type: EntityType, node: Rec): Rec {
  const kids = isContainer(type) ? CHILDREN[type] : undefined;
  const childProp = kids?.[0];
  const out: Rec = {};
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$') || (type === 'field' && k === 'id')) continue;
    const list: unknown[] | null = Array.isArray(v) ? v : null;
    out[k] =
      k === childProp && list !== null
        ? list.map((c) => (isRecord(c) ? plain(kids?.[1] ?? type, c) : c))
        : v;
  }
  return out;
}

/** To-be entities must still match their schema after the modify ops that changed them. */
export function checkShapes(ctx: CheckContext, rep: Report, shape: ShapeCheck): void {
  for (const [id, mods] of ctx.modsById) {
    const node = ctx.toBe.get(id);
    if (node === undefined) continue;
    const entity = plain(node.$type, { ...node });
    for (const problem of shape(node.$type, entity)) {
      const rec = mods.toReversed().find((r) => r.props.some((p) => p.prop === problem.prop));
      const change = rec?.props.find((p) => p.prop === problem.prop)?.change;
      if (rec === undefined || change === undefined || problem.prop === undefined) continue;
      const message = problem.unknownProp
        ? `${problem.prop} is not a property of a ${node.$type}; use one of its real props (see the ${node.$type} entry in schema/plan.schema.json)`
        : problem.message;
      rep.err([...rec.path, change, problem.prop, ...problem.tail], message);
    }
  }
}
