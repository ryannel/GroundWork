import { rootFields, type Sides } from '@/application/plan/impact-fields';
import type { Carry } from '@/application/plan/impact-journeys';
import { baseId, changedKeys, mentions } from '@/application/plan/impact-planned';
import type { Region, Screen } from '@/domain/plan/plan.generated';

export type RegionMark = 'added' | 'removed' | 'behaviour' | 'layout' | 'data';

export interface RegionChange {
  id: string;
  region: Region;
  before: Region | null;
  after: Region | null;
  keys: string[];
  carries: Carry[];
  mark: RegionMark;
}

export interface ScreenChange {
  id: string;
  screen: Screen;
  before: Screen | null;
  after: Screen | null;
  keys: string[];
  picture: boolean;
  regions: RegionChange[];
  mark: 'added' | 'removed' | 'behaviour' | 'data';
  team: string | null;
}

const SCREEN_KEYS = new Set([
  'name',
  'summary',
  'route',
  'image',
  'figma',
  'mockup',
  'device',
  'kind',
]);

const screenKeys = (a: Screen, b: Screen): string[] =>
  changedKeys(a, b, []).filter((k) => SCREEN_KEYS.has(k));

interface Pair<T> {
  a: T | undefined;
  b: T | undefined;
}

function regionMark({ a, b }: Pair<Region>, rk: string[], carries: Carry[]): RegionMark | null {
  if (a === undefined) return 'added';
  if (b === undefined) return 'removed';
  // only the box moving is layout, not behaviour
  if (rk.some((k) => k !== 'at')) return 'behaviour';
  if (rk.length > 0) return 'layout';
  return carries.length > 0 ? 'data' : null;
}

/** A region carries the new data only when it shows it: reading the holder is not showing the field. */
function shownCarries({ shape }: Sides, rb: Region | undefined): Carry[] {
  if (rb === undefined) return [];
  return (rb.reads ?? [])
    .map(baseId)
    .filter((x) => shape.has(x))
    .map((x) => ({ schema: x, fields: rootFields(shape, x) }))
    .filter((c) => c.fields.some((f) => mentions(rb.shows, f.name)));
}

function regionChange(sides: Sides, rid: string): RegionChange | null {
  const [ra, rb] = [sides.A.regions.get(rid)?.region, sides.B.regions.get(rid)?.region];
  const region = rb ?? ra;
  if (region === undefined) return null;
  const keys = ra !== undefined && rb !== undefined ? changedKeys(ra, rb, ['id']) : [];
  const carries = shownCarries(sides, rb);
  const mark = regionMark({ a: ra, b: rb }, keys, carries);
  return mark === null
    ? null
    : { id: rid, region, before: ra ?? null, after: rb ?? null, keys, carries, mark };
}

function screenMark(
  { a, b }: Pair<Screen>,
  keys: string[],
  regions: RegionChange[],
): ScreenChange['mark'] | null {
  if (a === undefined) return 'added';
  if (b === undefined) return 'removed';
  if (keys.length > 0 || regions.some((r) => r.mark !== 'data')) return 'behaviour';
  return regions.length > 0 ? 'data' : null;
}

const regionsOf = (sides: Sides, { a, b }: Pair<Screen>): RegionChange[] =>
  [...new Set([...(b?.regions ?? []), ...(a?.regions ?? [])].map((r) => r.id))].flatMap(
    (rid) => regionChange(sides, rid) ?? [],
  );

const teamOf = ({ A, B }: Sides, b: Screen | undefined, screen: Screen): string | null =>
  (b === undefined ? A : B).services.get(screen.service)?.team ?? null;

function screenChange(sides: Sides, id: string): ScreenChange | null {
  const [a, b] = [sides.A.screens.get(id), sides.B.screens.get(id)];
  const screen = b ?? a;
  if (screen === undefined) return null;
  const keys = a !== undefined && b !== undefined ? screenKeys(a, b) : [];
  const regions = regionsOf(sides, { a, b });
  const mark = screenMark({ a, b }, keys, regions);
  if (mark === null) return null;
  const picture = keys.includes('image') || a === undefined;
  return {
    id,
    screen,
    before: a ?? null,
    after: b ?? null,
    keys,
    picture,
    regions,
    mark,
    team: teamOf(sides, b, screen),
  };
}

/** Screens that change, with their regions. */
export function screensOf(sides: Sides): ScreenChange[] {
  const ids = new Set([...sides.A.screens.keys(), ...sides.B.screens.keys()]);
  return [...ids].flatMap((id) => screenChange(sides, id) ?? []);
}
