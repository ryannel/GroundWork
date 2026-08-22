/**
 * Roll a list of entries up into the numbers the CLI prints at the end of a
 * run. Totals stay in minor units.
 */

import { categorize } from './categorize.ts';

export interface Entry {
  date: string;
  description: string;
  amountMinor: number;
  category?: string;
}

/** Total per category, keyed by category name. */
export function totalByCategory(entries: Entry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    const key = entry.category ?? categorize(entry.description);
    totals[key] = (totals[key] ?? 0) + entry.amountMinor;
  }
  return totals;
}

/** The entry with the largest amount, or undefined when there are none. */
export function largest(entries: Entry[]): Entry | undefined {
  let best: Entry | undefined;
  for (const entry of entries) {
    if (best === undefined || entry.amountMinor > best.amountMinor) {
      best = entry;
    }
  }
  return best;
}

/** Entries sorted by date, oldest first. Ties keep their original order. */
export function byDate(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
