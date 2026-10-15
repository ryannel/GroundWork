import type { Model } from '@/application/plan/derive';
import { changedStepIds } from '@/application/plan-story-changes-flows';
import { graphChangeOf } from '@/application/plan-story-changes-graph';
import { bySeverity } from '@/application/plan-story-changes-records';
import {
  type Reach,
  type Touched,
  isEmptyReach,
  isSmallPlan,
  leftOver,
  reachIds,
  reachOf,
  touched,
} from '@/application/plan-story-changes-touched';

// Chapter 4 as screens. What the plan touches decides which exist: a flow, a screen, the graph, the interfaces,
// the records and the ledger. A small plan folds all of it into one screen per flow.

export type ChangeBody =
  | { readonly kind: 'flows'; readonly ids: readonly string[] }
  | { readonly kind: 'screens'; readonly ids: readonly string[] }
  | { readonly kind: 'graph' }
  | { readonly kind: 'contracts'; readonly touched: Touched }
  | { readonly kind: 'records'; readonly ids: readonly string[] }
  | { readonly kind: 'ledger' }
  | {
      readonly kind: 'small-flow';
      readonly id: string;
      readonly reach: Reach;
      readonly last: boolean;
    }
  | { readonly kind: 'more'; readonly reach: Reach; readonly first: boolean };

export interface ChangeScreen {
  readonly key: string;
  readonly title: string;
  readonly body: ChangeBody;
}

const SPLIT = 3;
const nameOf = (model: Model, id: string): string => model.label(id);
const afterColon = (id: string): string => id.split(':')[1] ?? id;

function smallScreens(model: Model, t: Touched): ChangeScreen[] {
  const taken = new Set<string>();
  const reaches = t.flows.map((id) => ({
    id,
    reach: reachOf(model, t, { id, changed: new Set(changedStepIds(model, id)), taken }),
  }));
  const left = leftOver(t, taken);
  const more = !isEmptyReach(left);
  const flows = reaches.map(({ id, reach }, i): ChangeScreen => ({
    key: `flow-${afterColon(id)}`,
    title: nameOf(model, id),
    body: { kind: 'small-flow', id, reach, last: i === reaches.length - 1 && !more },
  }));
  const rest: ChangeScreen[] = more
    ? [
        {
          key: 'more',
          title: 'Also changing',
          body: { kind: 'more', reach: left, first: flows.length === 0 },
        },
      ]
    : [];
  return [...flows, ...rest];
}

function flowScreens(model: Model, ids: readonly string[]): ChangeScreen[] {
  if (ids.length === 0) return [];
  if (ids.length > SPLIT)
    return [{ key: 'flows', title: 'Flows that change', body: { kind: 'flows', ids } }];
  return ids.map((id) => ({
    key: `flow-${afterColon(id)}`,
    title: nameOf(model, id),
    body: { kind: 'flows', ids: [id] },
  }));
}

function screenScreens(model: Model, ids: readonly string[]): ChangeScreen[] {
  if (ids.length === 0) return [];
  if (ids.length > SPLIT)
    return [{ key: 'screens', title: 'Screens that change', body: { kind: 'screens', ids } }];
  return ids.map((id) => ({
    key: `screen-${afterColon(id)}`,
    title: `${nameOf(model, id)} changes`,
    body: { kind: 'screens', ids: [id] },
  }));
}

function contractScreens(t: Touched): ChangeScreen[] {
  if (
    reachIds({ records: [], screens: [], ladders: t.ladders, retired: t.retired, shapes: t.shapes })
      .length === 0
  )
    return [];
  return [
    {
      key: 'contracts',
      title:
        t.ladders.length > 0
          ? 'Interfaces that get a new version'
          : 'Interfaces that are deprecated or removed',
      body: { kind: 'contracts', touched: t },
    },
  ];
}

function recordScreens(model: Model, ids: readonly string[]): ChangeScreen[] {
  if (ids.length === 0) return [];
  const sorted = bySeverity(model, ids);
  const [only] = sorted;
  return [
    {
      key: 'records',
      title:
        sorted.length === 1 && only !== undefined
          ? `${nameOf(model, only)} changes`
          : 'Records that change',
      body: { kind: 'records', ids: sorted },
    },
  ];
}

/** The screens of chapter 4, each with what it draws. */
export function changesLayout(model: Model): ChangeScreen[] {
  const t = touched(model);
  const graph = graphChangeOf(model);
  if (isSmallPlan(model) && graph === null) {
    const small = smallScreens(model, t);
    if (small.length > 0) return small;
  }
  const graphScreen: ChangeScreen[] =
    graph === null
      ? []
      : [{ key: 'graph', title: 'What changes in the graph', body: { kind: 'graph' } }];
  return [
    ...flowScreens(model, t.flows),
    ...screenScreens(model, t.screens),
    ...graphScreen,
    ...contractScreens(t),
    ...recordScreens(model, t.records),
    { key: 'ledger', title: 'All changes', body: { kind: 'ledger' } },
  ];
}

export const changeScreens = (model: Model): { key: string; title: string }[] =>
  changesLayout(model).map(({ key, title }) => ({ key, title }));
