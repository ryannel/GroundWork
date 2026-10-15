import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';

// Which team a thing belongs to, and which of the thirteen team colours that team wears.

const TEAM_COLOURS = 13;
const RINGED_FROM = 9;
const UNKNOWN_SLOT = 8;
const MAX_DEPTH = 4;
const TEAM_PREFIX = 'team:';
const OWNER_KEYS = ['team', 'owner', 'service', '$service', 'producer', 'from', 'store'] as const;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** A team's colour slot (1–13): the plan's own `colour`, else its place in the plan's team order. */
export function teamIndex(model: Model, teamId: string): number {
  const colour = Number(prop(model.get(teamId), 'colour'));
  if (Number.isInteger(colour) && colour >= 1 && colour <= TEAM_COLOURS) return colour;
  const at = model.plan.teams.findIndex((t) => t.id === teamId);
  return at === -1 ? UNKNOWN_SLOT : (at % 12) + 1;
}

/** Slots past eight are drawn with a ring too, so colour never carries the meaning alone. */
export function isRinged(slot: number): boolean {
  return slot >= RINGED_FROM;
}

export function teamName(model: Model, teamId: string): string {
  const name = text(prop(model.get(teamId), 'name'));
  return name === '' ? teamId.replace(/^team:/, '') : name;
}

function parentOf(id: string): string | null {
  const at = id.indexOf('#');
  return at === -1 ? null : id.slice(0, at);
}

function viaLink(model: Model, id: string, depth: number): string | null {
  const entity = model.get(id);
  const own = text(prop(entity, 'team'));
  if (own !== '') return own;
  for (const key of OWNER_KEYS) {
    const value = text(prop(entity, key));
    if (value.startsWith(TEAM_PREFIX)) return value;
    if (value !== '') return teamOf(model, value, depth + 1);
  }
  const parent = text(prop(entity, '$parent'));
  const up = parent === '' ? (parentOf(id) ?? '') : parent;
  return up === '' ? null : teamOf(model, up, depth + 1);
}

/** The team that owns an id, following owner, service, producer and parent links. */
export function teamOf(model: Model, id: string, depth = 0): string | null {
  if (id === '' || depth > MAX_DEPTH) return null;
  if (id.startsWith(TEAM_PREFIX)) return id;
  const owner = depth === 0 ? model.ownerTeam(id) : null;
  if (owner !== null) return owner;
  return viaLink(model, id, depth);
}
