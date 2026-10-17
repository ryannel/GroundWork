import type { Report } from '@/application/plan/check-context';
import { isRecord, walkStrings } from '@/application/plan/ids';
import type { PathSegment } from '@/domain/plan/plan-ids';
import type { Plan } from '@/domain/plan/plan.generated';

const TEAM_SLOTS = 13;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

interface DateParts {
  readonly wd: string;
  readonly day: string;
  readonly mon: string;
  readonly year?: string | undefined;
}

const WEEKDAY_WORDS = new Set([
  'Mon',
  'Tue',
  'Tues',
  'Wed',
  'Thu',
  'Thur',
  'Thurs',
  'Fri',
  'Sat',
  'Sun',
  ...WEEKDAYS,
]);

/** A capitalised word naming a month: one of its three-letter heads, then anything. */
const isMonth = (word: string): boolean => MONTHS.includes(word.slice(0, 3).toLowerCase());

interface DateTail {
  readonly re: RegExp;
  /** Whether a year may follow. */
  readonly year: boolean;
  readonly pick: (wd: string, m: RegExpExecArray) => DateParts | null;
}

// what follows the weekday in "Thu 9 Oct", "Friday 10 October 2026", "Mon, 13th of Oct", "Thu Oct 9", "Thu 2026-10-09"
const WEEKDAY_TAILS: readonly DateTail[] = [
  {
    re: /^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+([A-Z][a-z]*)\b/u,
    year: true,
    pick: (wd, m) => monthParts({ wd, day: m[1] ?? '', mon: m[2] ?? '' }),
  },
  {
    re: /^([A-Z][a-z]*)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/u,
    year: true,
    pick: (wd, m) => monthParts({ wd, day: m[2] ?? '', mon: m[1] ?? '' }),
  },
  {
    re: /^(\d{4})-(\d{2})-(\d{2})\b/u,
    year: false,
    pick: (wd, m) => ({ wd, day: m[3] ?? '', mon: MONTHS[Number(m[2]) - 1] ?? '', year: m[1] }),
  },
];

function monthParts(parts: DateParts): DateParts | null {
  return isMonth(parts.mon) ? parts : null;
}

interface DateMatch {
  readonly text: string;
  readonly parts: DateParts;
}

/** The date a tail makes at the start of `rest`, with the year after it when one may follow; its length too. */
function tailAt(rest: string, tail: DateTail, wd: string): DateMatch | null {
  const t = tail.re.exec(rest);
  const parts = t === null ? null : tail.pick(wd, t);
  if (t === null || parts === null) return null;
  const y = tail.year ? /^,?\s+(\d{4})\b/u.exec(rest.slice(t[0].length)) : null;
  const year = y?.[1] ?? parts.year;
  return { text: rest.slice(0, t[0].length + (y?.[0].length ?? 0)), parts: { ...parts, year } };
}

/** The dates one tail makes after a weekday, left to right, each starting after the last one ends. */
function datesWith(text: string, tail: DateTail): DateMatch[] {
  const out: DateMatch[] = [];
  // a capitalised word, and the full stop, comma and space that may follow a weekday
  const head = /\b([A-Z][a-z]*)\.?,?\s+/gu;
  for (let m = head.exec(text); m !== null; m = head.exec(text)) {
    const wd = m[1] ?? '';
    const date = WEEKDAY_WORDS.has(wd) ? tailAt(text.slice(head.lastIndex), tail, wd) : null;
    if (date === null) head.lastIndex = m.index + 1;
    else {
      const whole = text.slice(m.index, head.lastIndex) + date.text;
      out.push({ text: whole, parts: date.parts });
      head.lastIndex += date.text.length;
    }
  }
  return out;
}

interface WeekdayProblem {
  readonly text: string;
  readonly said: string;
  readonly actual: string;
  readonly date: string;
}

const isDay = (d: number): boolean => !Number.isNaN(d) && d >= 1 && d <= 31;

function problemOf(
  { text, parts }: DateMatch,
  defaultYear: string | undefined,
): WeekdayProblem | null {
  const y = Number(parts.year ?? defaultYear);
  const mi = MONTHS.indexOf(parts.mon.slice(0, 3).toLowerCase());
  const known = !Number.isNaN(y) && y !== 0 && mi !== -1;
  if (!known || !isDay(Number(parts.day))) return null;
  const d = Number(parts.day);
  const when = new Date(Date.UTC(y, mi, d));
  if (when.getUTCMonth() !== mi) return null;
  const actual = WEEKDAYS[when.getUTCDay()] ?? '';
  if (actual.toLowerCase().startsWith(parts.wd.slice(0, 3).toLowerCase())) return null;
  return { text, said: parts.wd, actual, date: when.toISOString().slice(0, 10) };
}

/** Weekdays that disagree with the calendar. A date with no year takes `defaultYear`. */
export function weekdayProblems(text: string, defaultYear?: string): WeekdayProblem[] {
  return WEEKDAY_TAILS.flatMap((tail) => datesWith(text, tail))
    .map((date) => problemOf(date, defaultYear))
    .filter((found) => found !== null);
}

function checkWeekdays(plan: Plan, rep: Report): void {
  const year = /^\d{4}/u.exec(plan.meta.date ?? '')?.[0];
  walkStrings(plan, (value, segs) => {
    for (const p of weekdayProblems(value, year)) {
      rep.error(
        segs,
        `"${p.text}" says ${p.said}, but ${p.date} is a ${p.actual}; change the weekday (or the date) so they agree`,
      );
    }
  });
}

/** Visit every sources[] entry in the plan (base arrays, children and add-op values). */
function walkSources(
  value: unknown,
  fn: (src: Record<string, unknown>, segs: PathSegment[]) => void,
  path: readonly PathSegment[] = [],
): void {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) walkSources(v, fn, [...path, i]);
    return;
  }
  if (!isRecord(value)) return;
  const own: unknown = value.sources;
  for (const [i, src] of (Array.isArray(own) ? own : []).entries()) {
    if (isRecord(src)) fn(src, [...path, 'sources', i]);
  }
  for (const [k, v] of Object.entries(value)) {
    if (k !== 'sources') walkSources(v, fn, [...path, k]);
  }
}

function checkSources(plan: Plan, rep: Report): void {
  walkSources(plan, (src, segs) => {
    const url = typeof src.url === 'string' ? src.url : '';
    const ref = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([^/]+)\//u.exec(url)?.[1];
    if (ref !== undefined && !/^[0-9a-f]{40}$/u.test(ref)) {
      rep.warn(
        [...segs, 'url'],
        `source points at ref "${ref}", which can drift; use a commit permalink (press y on github.com)`,
      );
    }
  });
}

function checkColours(plan: Plan, rep: Report): void {
  const bySlot = new Map<number, number[]>();
  for (const [i, t] of plan.teams.entries()) {
    if (t.colour !== undefined) bySlot.set(t.colour, [...(bySlot.get(t.colour) ?? []), i]);
  }
  const uncoloured = plan.teams.filter((t) => t.colour === undefined).length;
  if (TEAM_SLOTS - bySlot.size - uncoloured <= 0) return;
  for (const [slot, idx] of bySlot) {
    const [a, b] = [plan.teams[idx[0] ?? 0], plan.teams[idx[1] ?? -1]];
    if (a !== undefined && b !== undefined) {
      rep.warn(
        ['teams', idx[1] ?? 0, 'colour'],
        `${b.id} has the same colour (${String(slot)}) as ${a.id}, and the palette has a free slot; give it another so the two can be told apart`,
      );
    }
  }
}

/** Source permalinks, weekdays beside dates, and team colour slots. */
export function checkText(plan: Plan, rep: Report): void {
  checkSources(plan, rep);
  checkWeekdays(plan, rep);
  checkColours(plan, rep);
}
