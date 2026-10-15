import type { Report } from '@/application/plan/check-context';
import { isRecord, walkStrings } from '@/application/plan/ids';
import type { PathSegment } from '@/domain/plan/plan-ids';
import type { Plan } from '@/domain/plan/plan.generated';

const TEAM_SLOTS = 13;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WD =
  '(Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
const MON = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*';

interface DateParts {
  wd: string;
  day: string;
  mon: string;
  year: string | undefined;
}

// "Thu 9 Oct", "Friday 10 October 2026", "Mon, 13th of Oct", "Thu Oct 9", "Thu 2026-10-09"
const WEEKDAY_DATES: { re: RegExp; pick: (m: RegExpExecArray) => DateParts }[] = [
  {
    re: new RegExp(
      String.raw`\b${WD}\b\.?,?\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+${MON}\b(?:,?\s+(\d{4})\b)?`,
      'g',
    ),
    pick: (m) => ({ wd: m[1] ?? '', day: m[2] ?? '', mon: m[3] ?? '', year: m[4] }),
  },
  {
    re: new RegExp(
      String.raw`\b${WD}\b\.?,?\s+${MON}\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4})\b)?`,
      'g',
    ),
    pick: (m) => ({ wd: m[1] ?? '', day: m[3] ?? '', mon: m[2] ?? '', year: m[4] }),
  },
  {
    re: new RegExp(String.raw`\b${WD}\b\.?,?\s+(\d{4})-(\d{2})-(\d{2})\b`, 'g'),
    pick: (m) => ({
      wd: m[1] ?? '',
      day: m[4] ?? '',
      mon: MONTHS[Number(m[3]) - 1] ?? '',
      year: m[2],
    }),
  },
];

interface WeekdayProblem {
  text: string;
  said: string;
  actual: string;
  date: string;
}

function problemOf(
  m: RegExpExecArray,
  parts: DateParts,
  defaultYear: string | undefined,
): WeekdayProblem | null {
  const y = Number(parts.year ?? defaultYear);
  const mi = MONTHS.indexOf(parts.mon.slice(0, 3).toLowerCase());
  const d = Number(parts.day);
  if (Number.isNaN(y) || y === 0 || mi === -1 || Number.isNaN(d) || d < 1 || d > 31) return null;
  const when = new Date(Date.UTC(y, mi, d));
  if (when.getUTCMonth() !== mi) return null;
  const actual = WEEKDAYS[when.getUTCDay()] ?? '';
  if (actual.toLowerCase().startsWith(parts.wd.slice(0, 3).toLowerCase())) return null;
  return { text: m[0], said: parts.wd, actual, date: when.toISOString().slice(0, 10) };
}

/** Weekdays that disagree with the calendar. A date with no year takes `defaultYear`. */
export function weekdayProblems(text: string, defaultYear?: string): WeekdayProblem[] {
  const out: WeekdayProblem[] = [];
  for (const { re, pick } of WEEKDAY_DATES) {
    for (const m of text.matchAll(re)) {
      const found = problemOf(m, pick(m), defaultYear);
      if (found !== null) out.push(found);
    }
  }
  return out;
}

function checkWeekdays(plan: Plan, rep: Report): void {
  const year = /^\d{4}/.exec(plan.meta.date ?? '')?.[0];
  walkStrings(plan, (str, segs) => {
    for (const p of weekdayProblems(str, year)) {
      rep.err(
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
  path: PathSegment[] = [],
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
    const ref = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([^/]+)\//.exec(url)?.[1];
    if (ref !== undefined && !/^[0-9a-f]{40}$/.test(ref)) {
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
