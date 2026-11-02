// Where each stage of a target sits before it is drawn: its column, and the lane it belongs to.
//
// Every stage sits as far right as the stages it feeds allow, so separate supply chains meet where they are used.
// Each stage that is made from nothing starts a lane; a stage made only from one lane stays in it, and a stage made
// from more than one lane joins the trunk, the single line that runs from where the lanes meet to the end.

export interface GridStage {
  readonly id: string;
  readonly from: readonly string[];
}

/** The trunk's lane: where the lanes have met. */
export const TRUNK = -1;

export interface Grid {
  readonly col: ReadonlyMap<string, number>;
  /** A lane index, in the order the sources are written, or TRUNK. */
  readonly lane: ReadonlyMap<string, number>;
  /** The trunk's first stages: where lanes meet. */
  readonly hubs: ReadonlySet<string>;
  /** The stages each one feeds, in the order they are written. */
  readonly feeds: ReadonlyMap<string, readonly string[]>;
}

const known = (stages: readonly GridStage[]) => {
  const ids = new Set(stages.map((stage) => stage.id));
  return (stage: GridStage) => stage.from.filter((id) => ids.has(id) && id !== stage.id);
};

/** The stages made, through others, from themselves. */
export function loopsOf(stages: readonly GridStage[]): string[] {
  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  const fromOf = known(stages);
  const reaches = (start: string): boolean => {
    const seen = new Set<string>();
    const queue = [...fromOf(byId.get(start) ?? { id: start, from: [] })];
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (id === start) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(...fromOf(byId.get(id) ?? { id, from: [] }));
    }
    return false;
  };
  return stages.map((stage) => stage.id).filter(reaches);
}

/** The longest run of stages before each one; a loop counts as a stage made from nothing. */
function depths(stages: readonly GridStage[]): Map<string, number> {
  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  const fromOf = known(stages);
  const depth = new Map<string, number>();
  const busy = new Set<string>();
  const visit = (id: string): number => {
    const done = depth.get(id);
    if (done !== undefined) return done;
    const stage = byId.get(id);
    if (stage === undefined || busy.has(id)) return -1;
    busy.add(id);
    const at = Math.max(-1, ...fromOf(stage).map(visit)) + 1;
    busy.delete(id);
    depth.set(id, at);
    return at;
  };
  for (const stage of stages) visit(stage.id);
  return depth;
}

function feedsOf(stages: readonly GridStage[]): Map<string, string[]> {
  const fromOf = known(stages);
  const feeds = new Map<string, string[]>(stages.map((stage) => [stage.id, []]));
  for (const stage of stages) for (const id of fromOf(stage)) feeds.get(id)?.push(stage.id);
  return feeds;
}

/** Each stage one column left of the first stage it feeds; a stage that feeds nothing keeps its depth. */
function columns(stages: readonly GridStage[], feeds: ReadonlyMap<string, readonly string[]>) {
  const depth = depths(stages);
  const col = new Map(depth);
  const deepestFirst = stages.toSorted((a, b) => (depth.get(b.id) ?? 0) - (depth.get(a.id) ?? 0));
  for (const stage of deepestFirst) {
    const next = (feeds.get(stage.id) ?? []).map((id) => col.get(id) ?? 0);
    const at = next.length === 0 ? null : Math.min(...next) - 1;
    if (at !== null && at > (col.get(stage.id) ?? 0)) col.set(stage.id, at);
  }
  return { depth, col };
}

function lanes(stages: readonly GridStage[], depth: ReadonlyMap<string, number>) {
  const fromOf = known(stages);
  const lane = new Map<string, number>();
  const hubs = new Set<string>();
  let sources = 0;
  const shallowFirst = stages.toSorted((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0));
  for (const stage of shallowFirst) {
    const from = fromOf(stage).filter((id) => lane.has(id));
    const met = new Set(from.map((id) => lane.get(id) ?? TRUNK));
    const only = met.size === 1 ? ([...met][0] ?? TRUNK) : TRUNK;
    if (from.length === 0) {
      lane.set(stage.id, sources);
      sources += 1;
    } else lane.set(stage.id, only);
    if (from.length > 0 && only === TRUNK && !met.has(TRUNK)) hubs.add(stage.id);
  }
  return { lane, hubs };
}

/** Columns and lanes for a target's stages. */
export function gridOf(stages: readonly GridStage[]): Grid {
  const feeds = feedsOf(stages);
  const { depth, col } = columns(stages, feeds);
  return { col, ...lanes(stages, depth), feeds };
}
