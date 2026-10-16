import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import type {
  MapEdgeIn,
  MapNodeIn,
  MapRefIn,
  MapStageIn,
  SystemMapInput,
} from '@/application/plan-viz-system-map-types';
import { teamIndex, teamOf } from '@/application/plan-viz-teams';
import { plainLine } from '@/application/plan-viz-text';

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const orNull = (value: string): string | null => (value === '' ? null : value);
const TOPICS = new Set(['topic', 'queue']);

function nodeIn(model: Model, id: string, teamId: string | null): MapNodeIn {
  const entity = model.asIs.get(id);
  return {
    id,
    name: model.label(id),
    kind: text(prop(entity, 'kind')),
    does: text(prop(entity, 'does')),
    team: teamId,
    teamSlot: teamId === null ? 8 : teamIndex(model, teamId),
  };
}

function refOf(model: Model, id: string): MapRefIn | null {
  const entity = model.asIs.get(id);
  if (entity === undefined) return null;
  return {
    type: entity.$type,
    service: orNull(text(prop(entity, 'service'))),
    parent: orNull(text(prop(entity, '$parent'))),
    topic: TOPICS.has(text(prop(entity, 'kind'))),
  };
}

function interfaceOf(model: Model, via: string): string {
  const parent = text(prop(model.asIs.get(via), '$parent'));
  return parent !== '' && model.asIs.has(parent) ? parent : via;
}

function stagesIn(model: Model): MapStageIn[] {
  return model.domain().stages.map((s) => ({
    id: s.id,
    name: s.name,
    summary: plainLine(s.summary),
    entries: (s.services ?? []).map((x) => ({ svc: x.svc, reads: x.from ?? [] })),
  }));
}

function stageColumns(model: Model): Record<string, number> {
  const dm = model.domain();
  const index = new Map(dm.stages.map((s, i) => [s.id, i]));
  const out: Record<string, number> = {};
  for (const svc of model.asIs.services) {
    const stage = dm.stageOf(svc.id);
    const column = stage === null ? undefined : index.get(stage);
    if (column !== undefined) out[svc.id] = column;
  }
  return out;
}

/** What the stages say each service reads from, with the things they name. */
function stageRefs(model: Model): Record<string, MapRefIn> {
  const refs: Record<string, MapRefIn> = {};
  const add = (id: string): void => {
    const ref = refOf(model, id);
    if (ref !== null) refs[id] = ref;
  };
  for (const stage of model.domain().stages) {
    for (const from of (stage.services ?? []).flatMap((x) => x.from ?? [])) {
      add(from);
      const parent = refs[from]?.parent;
      if (parent !== null && parent !== undefined) add(parent);
    }
  }
  return refs;
}

function edgesIn(model: Model): MapEdgeIn[] {
  return model.edges('asIs', 'all').map((e) => ({
    kind: e.kind,
    from: e.from,
    to: e.to,
    via: e.via,
    steps: e.steps,
    read: e.read,
    write: e.write,
  }));
}

/** Every id the drawing may name, so the browser needs no model to label anything. */
function labelsOf(model: Model, ids: readonly string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id) => [id, model.label(id)]));
}

/** What the system map needs from the plan, as plain data. `lens` is a team id, or null for no lens. */
export function systemMapInput(model: Model, lens: string | null = null): SystemMapInput {
  const { services, stores, systems, messages, flows } = model.asIs;
  const edges = edgesIn(model);
  const refs = stageRefs(model);
  const interfaces: Record<string, string> = {};
  for (const e of edges) if (e.via !== null) interfaces[e.via] = interfaceOf(model, e.via);
  const ids = [
    ...[...services, ...stores, ...systems].map((n) => n.id),
    ...edges.flatMap((e) => [e.from, e.to, e.via ?? '']).filter((id) => id !== ''),
    ...Object.keys(refs),
    ...Object.values(interfaces),
    ...[...services, ...stores, ...systems].map((n) => teamOf(model, n.id) ?? ''),
  ].filter((id) => id !== '');
  return {
    services: services.map((s) => ({
      ...nodeIn(model, s.id, teamOf(model, s.id)),
      system: s.system ?? null,
    })),
    systems: systems.map((s) => nodeIn(model, s.id, orNull(text(s.team)))),
    stores: stores.map((s) => ({
      ...nodeIn(model, s.id, teamOf(model, s.id)),
      topic: TOPICS.has(s.kind),
      owner: s.owner,
      carries: messages
        .filter((m) => m.topic === s.id)
        .map((m) => (text(m.name) === '' ? m.id : text(m.name))),
    })),
    edges,
    steps: flows.flatMap((f) =>
      f.steps.map((s) => ({
        id: s.id,
        from: s.from,
        to: s.to,
        via: typeof s.via === 'string' ? s.via : '',
      })),
    ),
    stages: stagesIn(model),
    stageOf: stageColumns(model),
    refs,
    interfaceOf: interfaces,
    labels: labelsOf(model, ids),
    lens,
    focus: null,
  };
}
