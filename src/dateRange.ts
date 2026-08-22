/**
 * Ranges are written the way the CLI accepts them: `2024-01-05..2024-01-09`,
 * with both ends included. Dates stay as ISO strings; they are only turned
 * into Date objects for the arithmetic in here.
 */

export interface DateRange {
  start: string;
  end: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(day: string): number {
  if (!ISO_DAY.test(day)) {
    throw new Error(`not a date: ${day}`);
  }
  const time = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(time)) {
    throw new Error(`not a date: ${day}`);
  }
  return time;
}

/** Reads `2024-01-05..2024-01-09`. A single date is a range of one day. */
export function parseRange(text: string): DateRange {
  const parts = text.trim().split('..');
  if (parts.length === 1) {
    const only = parts[0]!;
    toTime(only);
    return { start: only, end: only };
  }
  if (parts.length !== 2) {
    throw new Error(`not a range: ${text}`);
  }
  const [start, end] = parts as [string, string];
  if (toTime(start) > toTime(end)) {
    throw new Error(`range ends before it starts: ${text}`);
  }
  return { start, end };
}

/** Number of days in the range, counting both ends. */
export function dayCount(range: DateRange): number {
  return (toTime(range.end) - toTime(range.start)) / DAY_MS + 1;
}

/** Every day in the range, in order, as ISO strings. */
export function eachDay(range: DateRange): string[] {
  const days: string[] = [];
  const last = toTime(range.end);
  for (let time = toTime(range.start); time <= last; time += DAY_MS) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}

/** True when day falls inside the range. */
export function contains(range: DateRange, day: string): boolean {
  const time = toTime(day);
  return time >= toTime(range.start) && time <= toTime(range.end);
}
