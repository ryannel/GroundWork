import type { Model } from '@/application/plan/derive';
import { typeOf } from '@/application/plan/ids';
import { parentOf } from '@/domain/ids';

import type { Neighbours, Outline, Page } from './plan-navigation';
import { catalogueOf } from './plan-pages-entity-where';
import { idToToken } from './plan-pages-hash';
import { thingHref } from './thing-paths';

// Every thing the inspector can open, bar the parts of a thing, also has a page of its own at
// /<workspace>/plans/<plan>/things/?id=<token>, beside the others of its kind: the services with the services.
// One page serves them all: the browser reads the id and draws the thing from the model it fetched, so the
// export does not grow with the model.

const CHILD_TYPES = new Set(['field', 'step', 'region']);

function planLevelIds(model: Model): string[] {
  const { plan } = model;
  return [
    ...(plan.changes ?? []),
    ...(plan.tests ?? []),
    ...(plan.work_items ?? []),
    ...(plan.milestones ?? []),
    ...(plan.decisions ?? []),
    ...(plan.risks ?? []),
    ...(plan.questions ?? []),
    ...(plan.problem.scenarios ?? []),
    ...(plan.domain?.concepts ?? []),
  ].map((e) => e.id);
}

/** Every id the plan can show, in plan order: today's things, then the plan's, then plan-level things. */
function thingIds(model: Model): string[] {
  const ids = new Set([
    ...model.asIs.byId.keys(),
    ...model.toBe.byId.keys(),
    ...planLevelIds(model),
  ]);
  return [...ids].filter((id) => typeOf(id) !== null && model.get(id) !== undefined);
}

/** The things with a page of their own: all but the parts of a thing (fields, steps, regions), which the
 * palette leaves out too. */
export const topThingIds = (model: Model): string[] =>
  thingIds(model).filter((id) => !CHILD_TYPES.has(typeOf(id) ?? ''));

/** The things of the same kind, in plan order, the thing among them; a part's siblings share its parent. */
export function siblingsOf(model: Model, id: string): string[] {
  const type = typeOf(id);
  const parent = parentOf(id);
  return thingIds(model).filter((x) => typeOf(x) === type && parentOf(x) === parent);
}

/** The screen a thing's page belongs under: its Reference catalogue, else the cover. */
export function thingHome(outline: Outline, id: string): Page | null {
  const screen = catalogueOf(id);
  const found = outline.pages.find((p) => p.chapter === 'ref' && p.screen === screen);
  return found ?? outline.pages[0] ?? null;
}

const pageOf = (model: Model, outline: Outline, id: string | undefined): Page | null =>
  id === undefined
    ? null
    : {
        chapter: 'ref',
        screen: idToToken(id),
        title: model.label(id),
        href: thingHref(outline, id),
      };

/** The thing before and after it among its siblings, as the pager and the arrow keys step to them. */
export function thingNeighbours(model: Model, outline: Outline, id: string): Neighbours {
  const list = siblingsOf(model, id);
  const at = list.indexOf(id);
  return {
    previous: at > 0 ? pageOf(model, outline, list[at - 1]) : null,
    next: at === -1 ? null : pageOf(model, outline, list[at + 1]),
    previousChapter: null,
    nextChapter: null,
    opens: null,
    end: null,
  };
}

/** The thing a page's `?id=` names, or null. */
export const thingByToken = (model: Model, token: string): string | null =>
  topThingIds(model).find((id) => idToToken(id) === token) ?? null;
