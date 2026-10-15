import { blame, type CheckContext, type Report, touched } from '@/application/plan/check-context';
import type { SystemGraph } from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';

/** Where a finding sits: the entity it is about, and the path to point at. */
export interface Where {
  id: string;
  segs: PathSegment[];
}

interface Located {
  id: string;
  $path: PathSegment[];
}

/** One graph of the plan (as-is or to-be), and how its federation checks report. */
export interface Scope {
  ctx: CheckContext;
  g: SystemGraph;
  /** Is this the to-be graph? Its checks only speak of what the ledger touched, and of what is new. */
  toBe: boolean;
  /** The path of a node's prop (or of a part inside it): its source, or the op that last changed it. */
  at: (node: Located, prop?: string, rel?: PathSegment[]) => Where;
  error: (at: Where, message: string, dedupe?: string) => void;
  warn: (at: Where, message: string, dedupe?: string) => void;
  /** Is the entity touched by the ledger (or in the as-is graph)? */
  fresh: (id: string) => boolean;
}

/**
 * The as-is and the to-be scope. A to-be finding that the as-is graph already has is left out (it is not this plan's);
 * `dedupe` names what makes two findings the same when their messages differ.
 */
export function createScopes(ctx: CheckContext, rep: Report): [Scope, Scope] {
  const seen = new Set<string>();
  const make = (g: SystemGraph, toBe: boolean): Scope => {
    const say =
      (send: Report['err']) =>
      (at: Where, message: string, dedupe?: string): void => {
        const key = `${at.id}|${dedupe ?? message}`;
        if (!toBe) seen.add(key);
        else if (seen.has(key)) return;
        send(at.segs, message);
      };
    return {
      ctx,
      g,
      toBe,
      at: (node, prop, rel) => {
        const inside = rel ?? (prop === undefined ? [] : [prop]);
        const segs = toBe
          ? blame(ctx, node.id, { prop: prop ?? 'id', rel: inside })
          : [...node.$path, ...inside];
        return { id: node.id, segs };
      },
      error: say(rep.err),
      warn: say(rep.warn),
      fresh: (id) => !toBe || touched(ctx, id),
    };
  };
  return [make(ctx.asIs, false), make(ctx.toBe, true)];
}
