import {
  blame,
  touched,
  whereAt,
  type CheckContext,
  type Report,
} from '@/application/plan/check-context';
import { parentOf } from '@/application/plan/ids';
import type {
  InteractionNode,
  PlanNode,
  ScreenNode,
  StepNode,
  SystemGraph,
} from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';

const SCREEN_KINDS = new Set(['page', 'modal', 'sheet']);
const OUTPUT_KINDS = new Set(['email', 'push', 'print']);

interface Scope {
  readonly ctx: CheckContext;
  readonly rep: Report;
  readonly g: SystemGraph;
}

const isAsIs = (s: Scope): boolean => s.g === s.ctx.asIs;

function checkScreenKind(s: Scope, scr: ScreenNode): void {
  const svc = s.g.get(scr.service);
  const kind = scr.kind ?? 'page';
  if (svc?.$type === 'service' && SCREEN_KINDS.has(kind) && svc.kind !== 'ui') {
    s.rep.warn(
      whereAt(s, scr, 'service'),
      `${scr.id} is a ${kind}, but ${scr.service} is a ${svc.kind}; a page, modal or sheet is served by a kind: ui service (an email, push or print may come from any service)`,
    );
  }
}

function checkScreen(s: Scope, scr: ScreenNode): void {
  checkScreenKind(s, scr);
  if (isAsIs(s) && (scr.image === undefined || scr.image === '')) {
    s.rep.warn(
      [...scr.$path, 'image'],
      `${scr.id} has no image; add a screenshot under plans/<slug>/assets/ so the story can show what people see today`,
    );
  }
  for (const [i, r] of scr.regions.entries()) {
    const b = r.at;
    if (b === undefined || (b.x + b.w <= 100.5 && b.y + b.h <= 100.5)) continue;
    const at = isAsIs(s) ? [...scr.$path, 'regions', i, 'at'] : blame(s.ctx, r.id, 'at');
    s.rep.error(
      at,
      `${r.id}.at runs off the picture (x + w and y + h are percentages and must stay within 100)`,
    );
  }
}

function checkStepScreen(s: Scope, step: StepNode): void {
  if (step.screen === undefined || (!isAsIs(s) && !touched(s.ctx, step.id))) return;
  const scr = s.g.get(parentOf(step.screen) ?? step.screen);
  if (scr?.$type !== 'screen') return;
  if (step.from !== scr.service && step.to !== scr.service) {
    s.rep.error(
      whereAt(s, step, 'screen'),
      `${step.id} happens on ${step.screen}, which ${scr.service} serves, but the step runs ${step.from} → ${step.to}; point screen at a screen of one of them, or set it on the step the UI takes`,
    );
  }
}

/** Check 14: a UI serves screens, steps happen on a screen of their own service, regions sit on the picture. */
export function checkScreens(ctx: CheckContext, rep: Report): void {
  for (const g of [ctx.asIs, ctx.toBe]) {
    const s: Scope = { ctx, rep, g };
    for (const scr of g.screens) if (isAsIs(s) || touched(ctx, scr.id)) checkScreen(s, scr);
    for (const step of g.steps) checkStepScreen(s, step);
  }
}

/** The screen an id sits on: the screen itself, or a region's parent. */
function rootScreen(g: SystemGraph, id: string): ScreenNode | null {
  const node = g.get(id);
  if (node?.$type === 'screen') return node;
  if (node?.$type !== 'region' || node.$parent === undefined) return null;
  const parent = g.get(node.$parent);
  return parent?.$type === 'screen' ? parent : null;
}

function checkInteraction(s: Scope, it: InteractionNode): void {
  const target = rootScreen(s.g, it.to);
  const sources = it.from.map((id) => rootScreen(s.g, id));
  if (target === null || sources.includes(null)) return;
  const kind = target.kind ?? 'page';
  const at = (prop: string): PathSegment[] => whereAt(s, it, prop);
  const same = sources.some((x) => x?.id === target.id);
  if (it.effect === 'output' && !OUTPUT_KINDS.has(kind)) {
    s.rep.error(
      at('to'),
      `${it.id} produces an output, but ${target.id} is a ${kind}; point to an email, push or print, or use navigate/update`,
    );
  }
  if (it.effect === 'navigate') checkNavigate(s, { it, target, kind, same }, at);
  if (it.effect === 'update' && !(sources.length === 1 && same)) {
    s.rep.error(
      at('effect'),
      `${it.id} updates a screen, so it needs one source and a destination on that same screen; fix from/to, or use navigate/output`,
    );
  }
}

interface Navigation {
  readonly it: InteractionNode;
  readonly target: ScreenNode;
  readonly kind: string;
  readonly same: boolean;
}

function checkNavigate(s: Scope, nav: Navigation, at: (prop: string) => PathSegment[]): void {
  const { it, target, kind, same } = nav;
  if (!SCREEN_KINDS.has(kind)) {
    s.rep.error(
      at('to'),
      `${it.id} navigates to ${target.id}, a ${kind}; navigation targets a page, modal or sheet, and an email, push or print uses effect: output`,
    );
  }
  if (same) {
    s.rep.error(
      at('effect'),
      `${it.id} navigates back to the same screen; use effect: update for a change within ${target.id}`,
    );
  }
}

/** Why a journey cannot go from `previous` to `next` (the screen one ends on is not one the other starts on), else null. */
function breakBetween(
  g: SystemGraph,
  journeyId: string,
  [previous, next]: readonly [PlanNode | undefined, PlanNode | undefined],
): string | null {
  if (next?.$type !== 'interaction' || previous?.$type !== 'interaction') return null;
  const ended = rootScreen(g, previous.to);
  if (ended === null) return null;
  const starts = next.from.map((id) => rootScreen(g, id)).filter((x) => x !== null);
  if (starts.length === 0 || starts.some((x) => x.id === ended.id)) return null;
  return `${journeyId} cannot continue from ${previous.id} to ${next.id}: ${previous.id} ends on ${ended.id}, which is not a source of ${next.id}; add the missing interaction to the journey or fix its order`;
}

function checkJourneys(s: Scope): void {
  for (const journey of s.g.userJourneys) {
    const steps = journey.interactions.map((id) => s.g.get(id));
    for (const [i, next] of steps.entries()) {
      const why = breakBetween(s.g, journey.id, [steps[i - 1], next]);
      if (why !== null) {
        s.rep.error(whereAt(s, journey, { prop: 'interactions', rel: ['interactions', i] }), why);
      }
    }
  }
}

/** Navigation checks: effects match screen kinds, and a journey is a connected path. */
export function checkNavigation(ctx: CheckContext, rep: Report): void {
  for (const g of [ctx.asIs, ctx.toBe]) {
    const s: Scope = { ctx, rep, g };
    for (const it of g.interactions) checkInteraction(s, it);
    checkJourneys(s);
  }
}
