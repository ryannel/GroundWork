import type { Core, ElementStatus } from '@/application/plan/derive-core';
import type { Owners } from '@/application/plan/derive-owners';
import { memo } from '@/application/plan/derive-values';
import { parentOf } from '@/application/plan/ids';
import type { SystemGraph, StepNode } from '@/domain/plan/plan-graph';

export interface ScreenLook {
  readonly image: string | null;
  readonly figma: string | null;
  readonly mockup: string | null;
}

export interface ScreenStop {
  readonly screen: string;
  readonly region: string | null;
}

export interface FlowOnScreen {
  readonly flow: string;
  readonly steps: readonly string[];
}

/** Before | after for a screen: both looks, and whether the picture itself changes. */
export interface ScreenDiff {
  readonly before: ScreenLook | null;
  readonly after: ScreenLook | null;
  readonly pictureChanges: boolean;
  readonly regions: readonly { readonly id: string; readonly status: ElementStatus }[];
  readonly changed: boolean;
}

export interface ScreenQueries {
  /** Screens a service serves (as-is ∪ to-be), in plan order. */
  readonly screensOf: (svcId: string) => string[];
  readonly screenOfStep: (g: SystemGraph, step: StepNode) => ScreenStop | null;
  /** Flows whose steps happen on a screen. Without a mode, reads as-is ∪ to-be. */
  readonly flowsOnScreen: (scrId: string, mode: string | undefined) => FlowOnScreen[];
  readonly look: (scrId: string, mode?: string) => ScreenLook | null;
  readonly screenDiff: (scrId: string) => ScreenDiff;
  /** As-is entities that chapter 5 revisits. */
  readonly touchedAsIs: () => string[];
}

const SKIPPED = new Set(['field', 'step', 'endpoint', 'team', 'region']);
const REVISITED = new Set(['schema', 'interface', 'flow', 'screen', 'graph', 'subgraph']);

/** Screens: who serves them, which flows pass over them, how they look and what changes on them. */
function graphsFor(mode: string | undefined, asIs: SystemGraph, toBe: SystemGraph): SystemGraph[] {
  if (mode === 'asIs') return [asIs];
  return mode === 'toBe' ? [toBe] : [asIs, toBe];
}

export function createScreens(core: Core, owners: Owners): ScreenQueries {
  const { asIs, toBe, sys, unionIds, status } = core;
  const { descendants, rollup } = owners;

  /** Screens a service serves (as-is ∪ to-be), in plan order. */
  const screensOf = memo((svcId: string): string[] =>
    unionIds.filter((id) => {
      const n = sys(id);
      return n?.$type === 'screen' && n.service === svcId;
    }),
  );

  /** The screen (or region's screen) a step happens on, in a graph; null when it has none. */
  const screenOfStep = (g: SystemGraph, step: StepNode): ScreenStop | null => {
    if (step.screen === undefined) return null;
    const parent = parentOf(step.screen);
    const scrId = parent ?? step.screen;
    const scr = g.get(scrId) ?? sys(scrId);
    if (scr?.$type !== 'screen') return null;
    return { screen: scrId, region: parent === null ? null : step.screen };
  };

  /** Flows whose steps happen on a screen, with the step ids. Without a mode, reads as-is ∪ to-be. */
  const flowsOnScreen = memo((scrId: string, mode: string | undefined): FlowOnScreen[] => {
    const hits = new Map<string, string[]>();
    const graphs = graphsFor(mode, asIs, toBe);
    for (const g of graphs) {
      for (const s of g.steps) {
        if (screenOfStep(g, s)?.screen !== scrId) continue;
        const flow = parentOf(s.id) ?? '';
        const have = hits.get(flow) ?? [];
        hits.set(flow, have.includes(s.id) ? have : [...have, s.id]);
      }
    }
    return [...hits].map(([flow, steps]) => ({ flow, steps }));
  });

  /** What a screen looks like in a graph; null when the screen is not in that graph. */
  const look = (scrId: string, mode = 'toBe'): ScreenLook | null => {
    const n = (mode === 'asIs' ? asIs : toBe).get(scrId);
    if (n?.$type !== 'screen') return null;
    return { image: n.image ?? null, figma: n.figma ?? null, mockup: n.mockup ?? null };
  };

  /** Before | after for a screen: both looks, and whether the picture itself changes. */
  const screenDiff = memo((scrId: string): ScreenDiff => {
    const before = look(scrId, 'asIs');
    const after = look(scrId, 'toBe');
    const regions = descendants(scrId).map((id) => ({ id, status: status(id) ?? 'existing' }));
    const pictureChanges = before !== null && after !== null && before.image !== after.image;
    const edited =
      (status(scrId) ?? 'existing') !== 'existing' || regions.some((r) => r.status !== 'existing');
    return {
      before,
      after,
      pictureChanges,
      regions,
      changed: (before !== null || after !== null) && edited,
    };
  });

  /** As-is entities that chapter 5 revisits (status changed or changes inside). */
  const touchedAsIs = memo((): string[] =>
    [...asIs.byId.keys()].filter((id) => {
      const type = asIs.get(id)?.$type ?? '';
      if (SKIPPED.has(type)) return false;
      const st: ElementStatus | null = status(id);
      return st !== 'existing' || (REVISITED.has(type) && rollup(id).total > 0);
    }),
  );

  return { screensOf, screenOfStep, flowsOnScreen, look, screenDiff, touchedAsIs };
}
