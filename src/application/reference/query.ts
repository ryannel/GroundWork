import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import { teamOf } from '@/application/plan-viz-teams';
import { plainLine } from '@/application/plan-viz-text';
import { poolOf, showOf, type Show } from '@/application/reference/model';
import { buildId } from '@/domain/ids';
import { firstParam, type SearchParams } from '@/shared/search-params';

// This query depends only on reading records, labels and ownership, not on delivery or diagram machinery.
type ReferenceModel = Pick<
  Model,
  'asIs' | 'toBe' | 'plan' | 'label' | 'get' | 'ownerService' | 'ownerTeam' | 'teamCut'
>;

const COLLECTIONS = {
  services: 'services',
  components: 'services',
  stores: 'stores',
  apis: 'endpoints',
  schemas: 'schemas',
  events: 'messages',
  flows: 'flows',
  screens: 'screens',
  operations: 'operations',
} as const;

export type ReferenceKind = keyof typeof COLLECTIONS | 'ledger';
export const isReferenceKind = (kind: string): kind is ReferenceKind =>
  kind === 'ledger' || Object.hasOwn(COLLECTIONS, kind);

export interface ReferenceQuery {
  readonly q: string;
  readonly team: string;
  readonly show: Show;
  readonly page: number;
}
export interface ReferenceRow {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly owner: string | null;
}
export interface ReferencePage {
  readonly query: ReferenceQuery;
  readonly rows: readonly ReferenceRow[];
  readonly total: number;
  readonly pages: number;
}
const PAGE_SIZE = 30;

function queryOf(params: SearchParams, today: boolean): ReferenceQuery {
  const requested = Number(firstParam(params.page));
  return {
    q: firstParam(params.q).trim(),
    team: firstParam(params.team),
    show: today ? 'asis' : showOf(firstParam(params.show)),
    page: Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
  };
}

function records(
  model: ReferenceModel,
  kind: ReferenceKind,
  show: Show,
): readonly { readonly id: string }[] {
  if (kind === 'ledger') return model.plan.changes ?? [];
  const collection = COLLECTIONS[kind];
  return poolOf<{ readonly id: string }>(model.asIs[collection], model.toBe[collection], show);
}

const wordsOf = (entity: unknown, key: string): string => {
  const value = prop(entity, key);
  return typeof value === 'string' ? value : '';
};

function rowOf(model: ReferenceModel, entity: { readonly id: string }): ReferenceRow {
  const owner = model.ownerService(entity.id) ?? teamOf(model, entity.id);
  const label =
    ['sig', 'name', 'title'].map((key) => wordsOf(entity, key)).find((value) => value !== '') ??
    model.label(entity.id);
  const summary =
    ['summary', 'why', 'does'].map((key) => wordsOf(entity, key)).find((value) => value !== '') ??
    '';
  return {
    id: entity.id,
    label: plainLine(label, model),
    summary: plainLine(summary, model).slice(0, 400),
    owner: owner === entity.id ? null : owner,
  };
}

/** Filter the complete catalogue before taking a bounded page. Detailed records remain in the inspector. */
export function referencePage(
  model: ReferenceModel,
  kind: ReferenceKind,
  input: { readonly params: SearchParams; readonly today: boolean },
): ReferencePage {
  const query = queryOf(input.params, input.today);
  const team = model.plan.teams.find(
    (each) => each.id === query.team || each.id === buildId('team', query.team),
  );
  const cut = team === undefined ? null : model.teamCut(team.id);
  const words = query.q.toLowerCase().split(/\s+/u).filter(Boolean);
  const found = records(model, kind, query.show).filter((entity) => {
    if (cut !== null && !cut.has(entity.id) && teamOf(model, entity.id) !== cut.team) return false;
    const text = `${model.label(entity.id)} ${JSON.stringify(entity)}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const pages = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  return {
    query: { ...query, team: team?.id ?? '', page },
    total: found.length,
    pages,
    rows: found
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((entity) => rowOf(model, entity)),
  };
}
