import type { RegionChange, ScreenChange } from '@/application/plan/impact-screens';
import {
  type BeforeAfter,
  beforeAfter,
  carryText,
  type Mark,
  markOf,
} from '@/application/plan-story-versions-marks';
import { nameIn, type Pair, type View } from '@/application/plan-story-versions-pair';
import { unmark } from '@/application/plan-story-versions-words';
import { builtBy, type WorkRow } from '@/application/plan-story-versions-work';

// What a revision does to a screen: its pictures before and after, and its regions.

export interface PictureView {
  readonly version: string;
  /** The image path in the plan, or null when that version has no picture. */
  readonly image: string | null;
  readonly alt: string;
}

export type RegionBody =
  | { readonly kind: 'carry'; readonly text: string }
  | { readonly kind: 'text'; readonly text: string; readonly struck: boolean }
  | { readonly kind: 'diff'; readonly diff: BeforeAfter }
  | { readonly kind: 'moves' };

export interface RegionView {
  readonly id: string;
  readonly name: string;
  readonly mark: Mark;
  readonly body: RegionBody;
}

export interface ScreenView {
  readonly id: string;
  readonly name: string;
  readonly mark: Mark;
  readonly pictures: readonly PictureView[];
  readonly regions: readonly RegionView[];
  /** The work that builds the screen; empty when it sits on a step, which lists its own. */
  readonly builtBy: readonly WorkRow[];
}

function bodyOf(pair: Pair, r: RegionChange): RegionBody {
  if (r.mark === 'data') {
    const shown = r.carries.map((c) => carryText(pair, c.schema)).join('; ');
    return { kind: 'carry', text: `Shows ${shown}.` };
  }
  if (r.mark === 'added') return { kind: 'text', text: unmark(r.after?.shows), struck: false };
  if (r.mark === 'removed') return { kind: 'text', text: unmark(r.before?.shows), struck: true };
  if (r.keys.includes('shows')) {
    return { kind: 'diff', diff: beforeAfter(pair, r.before?.shows, r.after?.shows) };
  }
  return { kind: 'moves' };
}

function picturesOf(pair: Pair, sc: ScreenChange): PictureView[] {
  const sides = [
    { version: pair.fromVersion, screen: sc.before },
    { version: pair.toVersion, screen: sc.after },
  ];
  if (!sc.picture || sides.every((s) => (s.screen?.image ?? '') === '')) return [];
  return sides.map(({ version, screen }) => ({
    version,
    image: screen?.image === undefined || screen.image === '' ? null : screen.image,
    alt: `${nameIn(pair, sc.id)} in ${version}`,
  }));
}

export function screenView({ pair, tense }: View, sc: ScreenChange, onStep: boolean): ScreenView {
  return {
    id: sc.id,
    name: nameIn(pair, sc.id),
    mark: markOf(sc.mark, tense),
    pictures: picturesOf(pair, sc),
    regions: sc.regions.map((r) => ({
      id: r.id,
      name: unmark(r.region.name),
      mark: markOf(r.mark, tense),
      body: bodyOf(pair, r),
    })),
    builtBy: onStep ? [] : builtBy(pair, tense, sc.id),
  };
}
