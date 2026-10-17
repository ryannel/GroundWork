import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { prop } from '@/application/plan/ids';
import type { ScreenNode } from '@/domain/plan/plan-graph';

// What a screen picture, its regions and a flow's screen journey are made of, worked out from the plan. The
// components draw these; they do not read the plan themselves.

export type ScreenMode = 'asIs' | 'toBe';

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const KIND_WORD: Readonly<Record<string, string>> = {
  page: 'page',
  modal: 'modal',
  sheet: 'sheet',
  email: 'email',
  push: 'push notification',
  print: 'printed document',
};

/** What sort of screen it is, in words. */
export const screenKind = (screen: Pick<ScreenNode, 'kind'>): string =>
  KIND_WORD[screen.kind ?? 'page'] ?? 'screen';

const NARROW = new Set(['mobile', 'handheld']);

/** A phone-shaped picture: drawn narrow so it does not fill the page. */
export const isNarrow = (screen: Pick<ScreenNode, 'device'> | undefined): boolean =>
  screen?.device !== undefined && NARROW.has(screen.device);

/** An image or file path in a plan, as an address: absolute addresses stay, the rest hang off the plan's own. */
export function assetUrl(base: string, path: string | null | undefined): string {
  if (path === null || path === undefined || path === '') return '';
  if (path.startsWith('data:') || path.includes('://') || path.startsWith('//')) return path;
  return `${base}${path.replace(/^\.?\//u, '')}`;
}

const isScreen = (node: unknown): node is ScreenNode => prop(node, '$type') === 'screen';

/** The screen as one side of the plan has it (either, when no side is asked for). */
export function screenIn(model: Model, id: string, mode?: ScreenMode): ScreenNode | undefined {
  const node = mode === undefined ? model.get(id) : (model[mode].get(id) ?? model.get(id));
  return isScreen(node) ? node : undefined;
}

/** A percentage kept within the picture. */
export const percent = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

/** One region of a screen, as the list and the picture both draw it. */
export interface RegionRow {
  readonly id: string;
  readonly name: string;
  readonly at: Box | null;
  readonly shows: string;
  readonly reads: readonly string[];
  /** What the plan does to it; "existing" when status is off. */
  readonly status: ElementStatus;
  /** The plan removes it, so it is not on the screen as it will be. */
  readonly gone: boolean;
}

export interface RegionOptions {
  readonly mode?: ScreenMode;
  /** Show what the plan does: adds the regions it removes and says what it does to each. */
  readonly status?: boolean;
}

function rowOf(
  model: Model,
  region: ScreenNode['regions'][number],
  opts: RegionOptions,
): RegionRow {
  const status = opts.status === true ? (model.status(region.id) ?? 'existing') : 'existing';
  return {
    id: region.id,
    name: region.name,
    at: region.at ?? null,
    shows: region.shows ?? '',
    reads: region.reads ?? [],
    status,
    gone: false,
  };
}

/**
 * The regions of a screen in list order. With `status` on the list also holds the regions the plan removes, last, so
 * the picture and the list number from one list.
 */
export function regionsOf(model: Model, scrId: string, opts: RegionOptions = {}): RegionRow[] {
  const mode = opts.mode ?? 'toBe';
  const status = opts.status ?? mode !== 'asIs';
  const rows = (screenIn(model, scrId, mode)?.regions ?? [])
    .filter((region) => region.id !== '')
    .map((region) => rowOf(model, region, { mode, status }));
  if (!status) return rows;
  const have = new Set(rows.map((row) => row.id));
  const before = screenIn(model, scrId, 'asIs')?.regions ?? [];
  for (const { id } of model.screenDiff(scrId).regions) {
    const region = before.find((r) => r.id === id);
    if (have.has(id) || region === undefined) continue;
    rows.push({ ...rowOf(model, region, { status: false }), status: 'removed', gone: true });
  }
  return rows;
}

/** Region id → 1, 2, 3 … in the order the list shows them. */
export const regionNumbers = (rows: readonly RegionRow[]): ReadonlyMap<string, number> =>
  new Map(rows.map((row, i) => [row.id, i + 1]));

/** A region on the picture. */
export interface FigureRegion {
  readonly id: string;
  readonly name: string;
  readonly at: Box;
  /** "existing", or what the plan does to it. */
  readonly status: ElementStatus;
  readonly lit: boolean;
  readonly number: number | null;
  /** The word after its name: "new", "changes", "removed", or "". */
  readonly note: string;
}

/** A region the plan removes, drawn where it was on the picture that no longer has it. */
export interface FigureGhost {
  readonly id: string;
  readonly name: string;
  readonly at: Box;
  readonly number: number | null;
}

export interface FigureData {
  readonly id: string;
  readonly name: string;
  /** The picture's address, or "". */
  readonly image: string;
  readonly route: string;
  readonly kind: string;
  /** "desktop", "mobile", … unless "any". */
  readonly device: string;
  readonly narrow: boolean;
  readonly regions: readonly FigureRegion[];
  readonly ghosts: readonly FigureGhost[];
}

export interface FigureOptions {
  readonly mode?: ScreenMode;
  readonly base: string;
  /** Ids of the regions to light. */
  readonly focus?: readonly string[];
  /** Colour regions by what the plan does to them. */
  readonly status?: boolean;
  /** Regions to show as removed (outlined on today's picture). */
  readonly removed?: readonly string[];
  readonly numbers?: ReadonlyMap<string, number> | null;
  readonly ghosts?: readonly RegionRow[];
}

const boxed = (at: Box): Box => ({
  x: percent(at.x),
  y: percent(at.y),
  w: percent(at.w),
  h: percent(at.h),
});

const NOTES: Readonly<Partial<Record<ElementStatus, string>>> = {
  added: 'new',
  modified: 'changes',
  removed: 'removed',
  deprecated: 'removed',
};

function figureRegion(
  model: Model,
  region: ScreenNode['regions'][number],
  opts: FigureOptions,
): FigureRegion {
  let status: ElementStatus = 'existing';
  if (opts.removed?.includes(region.id) === true) status = 'removed';
  else if (opts.status === true) status = model.status(region.id) ?? 'existing';
  return {
    id: region.id,
    name: region.name,
    at: boxed(region.at ?? { x: 0, y: 0, w: 0, h: 0 }),
    status,
    lit: opts.focus?.includes(region.id) === true,
    number: opts.numbers?.get(region.id) ?? null,
    note: NOTES[status] ?? '',
  };
}

/** The picture of a screen with its regions, or null when the plan has no such screen. */
export function figureOf(model: Model, scrId: string, opts: FigureOptions): FigureData | null {
  const mode = opts.mode ?? 'toBe';
  const screen = screenIn(model, scrId, mode);
  if (screen === undefined) return null;
  const regions: FigureRegion[] = [];
  for (const region of screen.regions) {
    if (region.at !== undefined && region.id !== '') {
      regions.push(figureRegion(model, region, opts));
    }
  }
  const ghosts = (opts.ghosts ?? []).flatMap((row) =>
    row.at === null
      ? []
      : [
          {
            id: row.id,
            name: row.name,
            at: boxed(row.at),
            number: opts.numbers?.get(row.id) ?? null,
          },
        ],
  );
  return {
    id: scrId,
    name: screen.name,
    image: assetUrl(opts.base, screen.image),
    route: screen.route ?? '',
    kind: screenKind(screen),
    device: screen.device === undefined || screen.device === 'any' ? '' : screen.device,
    narrow: isNarrow(screen),
    regions,
    ghosts,
  };
}

/** One screen of a journey: where it is reached and, in a stepper, which stop reaches it first. */
export interface StripLeg {
  readonly screen: string;
  readonly name: string;
  readonly image: string;
  readonly narrow: boolean;
  readonly status: ElementStatus;
  readonly current: boolean;
  /** The stepper stop holding the leg's first step, or -1 when the strip is not driving a stepper. */
  readonly stop: number;
}

/** A stepper stop, as far as the strip and the screens beside it need to know. */
export interface StopRef {
  readonly stepIds: readonly string[];
  readonly indices: readonly number[];
}

export interface StripOptions {
  readonly mode?: ScreenMode | undefined;
  readonly base: string;
  readonly currentStepIds?: readonly string[] | undefined;
  readonly stops?: readonly StopRef[] | null | undefined;
}

/** The screens of a flow in the order its steps reach them, for a strip of thumbnails. */
export function stripLegs(
  model: Model,
  legs: readonly { readonly screen: string; readonly stepIds: readonly string[] }[],
  opts: StripOptions,
): StripLeg[] {
  const current = new Set(opts.currentStepIds);
  return legs.map((leg) => {
    const screen = screenIn(model, leg.screen, opts.mode);
    const first = leg.stepIds[0] ?? '';
    return {
      screen: leg.screen,
      name: screen?.name ?? leg.screen,
      image: assetUrl(opts.base, screen?.image),
      narrow: isNarrow(screen),
      status: opts.mode === 'asIs' ? 'existing' : (model.status(leg.screen) ?? 'existing'),
      current: leg.stepIds.some((id) => current.has(id)),
      stop: opts.stops?.findIndex((stop) => stop.stepIds.includes(first)) ?? -1,
    };
  });
}

/** Where a step happens: its screen, and the region when it names one. */
const placeOf = (at: string): { readonly screen: string; readonly region: string | null } => ({
  screen: at.split('#')[0] ?? at,
  region: at.includes('#') ? at : null,
});

/** The screens a stepper stop happens on, in the order the stop's steps reach them, with the regions touched. */
export function stopScreens(
  steps: readonly { readonly screen?: string | null | undefined }[],
  stop: Pick<StopRef, 'indices'> | undefined,
): { readonly screen: string; readonly regions: readonly string[] }[] {
  const out: { readonly screen: string; readonly regions: readonly string[] }[] = [];
  for (const i of stop?.indices ?? []) {
    const at = steps[i]?.screen ?? '';
    if (at === '') continue;
    const { screen, region } = placeOf(at);
    const last = out.at(-1);
    if (last?.screen !== screen) out.push({ screen, regions: region === null ? [] : [region] });
    else if (region !== null && !last.regions.includes(region)) {
      out[out.length - 1] = { screen, regions: [...last.regions, region] };
    }
  }
  return out;
}

/** Figma and walking-mockup addresses for a screen (the to-be look unless asked otherwise). */
export function screenLinks(
  model: Model,
  scrId: string,
  opts: { readonly base: string; readonly mode?: ScreenMode | undefined },
): { readonly figma: string | null; readonly mockup: string | null } {
  const mode = opts.mode ?? 'toBe';
  const screen = screenIn(model, scrId, mode);
  // The walking mockup is one file per plan; a screen the plan touches without its own falls back to it.
  const touched = mode !== 'asIs' && (model.status(scrId) ?? 'existing') !== 'existing';
  const planMockup = touched
    ? model.toBe.screens.find((s) => s.mockup !== undefined)?.mockup
    : undefined;
  const mockup = screen?.mockup ?? planMockup;
  return {
    figma: screen?.figma ?? null,
    mockup: mockup === undefined ? null : `${assetUrl(opts.base, mockup)}#${scrId}`,
  };
}

/** What changes in a region's words: its "shows" text before and after, and one line for each other edit. */
export interface RegionChange {
  readonly shows: { readonly before: string; readonly after: string } | null;
  readonly lines: readonly string[];
}

/** What the plan does to one region, in words. */
export function regionChange(model: Model, regionId: string): RegionChange {
  const edits = model.diff(regionId).filter((entry) => entry.prop !== null);
  const text = edits.find((e) => e.prop === 'shows' && typeof e.before === 'string');
  const shows =
    text === undefined
      ? null
      : { before: String(text.before), after: typeof text.after === 'string' ? text.after : '' };
  const counted = new Map<string, number>();
  for (const e of edits) {
    if (shows !== null && e.prop === 'shows') continue;
    counted.set(e.summary, (counted.get(e.summary) ?? 0) + 1);
  }
  const lines = [...counted].map(([summary, n]) => (n > 1 ? `${summary} × ${String(n)}` : summary));
  return { shows, lines };
}

/** Two pictures are the same shape when their proportions are within 5%: a swipe over different shapes would mislead. */
export function sameShape(
  a: { readonly width: number; readonly height: number },
  b: { readonly width: number; readonly height: number },
): boolean {
  if (a.width === 0 || a.height === 0 || b.width === 0 || b.height === 0) return false;
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / Math.max(ra, rb) < 0.05;
}

/** "3 regions", "1 region", "no regions named". */
export function regionCount(n: number): string {
  if (n === 0) return 'no regions named';
  return n === 1 ? '1 region' : `${String(n)} regions`;
}

/** The two pictures of a screen the plan changes, when it has both and there is something to compare. */
export function comparablePictures(
  model: Model,
  scrId: string,
  base: string,
): { readonly today: string; readonly plan: string } | null {
  const today = assetUrl(base, screenIn(model, scrId, 'asIs')?.image);
  const plan = assetUrl(base, screenIn(model, scrId, 'toBe')?.image);
  return today === '' || plan === '' ? null : { today, plan };
}
