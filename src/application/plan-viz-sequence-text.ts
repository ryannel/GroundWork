import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { chipInfo } from '@/application/plan-chips';
import { plain } from '@/shared/plain-text';

// The words and the column geometry a sequence drawing shares: how wide a column must be, where an arrow sits
// on the lane strip, what a status pill says.

/** The most participants a lane strip can place; the stylesheet has a rule for each of its grid lines. */
export const MAX_COLS = 16;

/** More participants than this and the strip scrolls at a fixed column width. */
const DENSE_AT = 8;

/** Column widths a strip opens at, in pixels: the stylesheet has one rule for each. */
const COLUMN_TIERS = [84, 96, 120, 144, 176, 208] as const;

const PART_MIN = 96;
const PART_MIN_LOOSE = 84;
const CH = 7.2;
const CH_MONO = 6.7;
const COL_PAD = 16;

export interface Place {
  /** The grid line the item starts on. */
  readonly start: number;
  /** How many grid lines it spans. */
  readonly span: number;
}

export type Tone = 'add' | 'mod' | 'dep' | 'rem';

const PILLS: Partial<Record<ElementStatus, readonly [Tone, string]>> = {
  added: ['add', 'new step'],
  modified: ['mod', 'works differently'],
  removed: ['rem', 'removed'],
  deprecated: ['dep', 'Deprecated · still works'],
};

/** What a changed step is called, or null for one that has not changed. */
export const pillOf = (status: ElementStatus): readonly [Tone, string] | null =>
  PILLS[status] ?? null;

const LEVELS: Readonly<Record<string, string>> = {
  e2e: 'end-to-end',
  unit: 'unit',
  service: 'service',
  contract: 'contract',
  integration: 'integration',
};

/** A test level in words. */
export const levelName = (level?: string): string => LEVELS[level ?? ''] ?? 'test';

/** The longest word a column must hold on one line (a name breaks at spaces and after . _ -, never inside a word). */
export const longestWord = (name: string): number =>
  Math.max(0, ...name.split(/[\s._-]+/).map((w) => w.length));

/** The column width, from the tiers, that holds every name; wider than the last tier is the last. */
export function columnTier(
  names: readonly { readonly name: string; readonly mono: boolean }[],
  participants: number,
): number {
  const base = participants > DENSE_AT ? PART_MIN : PART_MIN_LOOSE;
  const need = Math.max(
    base,
    ...names.map((n) => Math.ceil(longestWord(n.name) * (n.mono ? CH_MONO : CH)) + COL_PAD),
  );
  return COLUMN_TIERS.find((t) => t >= need) ?? COLUMN_TIERS.at(-1) ?? PART_MIN;
}

/** Whether a strip of this many columns scrolls rather than squeezes. */
export const isDense = (participants: number): boolean => participants > DENSE_AT;

const clampColumn = (col: number): number => Math.min(Math.max(col, 0), MAX_COLS - 1);

/**
 * A lane strip of P columns has 2P+1 grid lines: column i lies between lines 2i+1 and 2i+3 and its lifeline
 * is line 2i+2. Arrows run lifeline to lifeline.
 */
const centreLine = (col: number): number => 2 * clampColumn(col) + 2;

/** From one lifeline to another. */
export function between(from: number, to: number): Place {
  const lo = centreLine(Math.min(from, to));
  const hi = centreLine(Math.max(from, to));
  return { start: lo, span: Math.max(hi - lo, 1) };
}

/** The whole of one column. */
export const columnPlace = (col: number): Place => ({ start: 2 * clampColumn(col) + 1, span: 2 });

/** From the lifeline of a column to the right edge of the strip, held to three columns. */
export function fromCentre(col: number): Place {
  const start = centreLine(col);
  return { start, span: Math.min(6, 2 * MAX_COLS + 1 - start) };
}

/** From the left edge of the strip to the lifeline of a column. */
export const toCentre = (col: number): Place => ({ start: 1, span: centreLine(col) - 1 });

/** A trigger or an authored condition as one line of plain words (markdown and [[ids]] resolved). */
export const plainText = (model: Model, text: string | null | undefined): string =>
  plain(text, (id) => chipInfo(model, id).label);
