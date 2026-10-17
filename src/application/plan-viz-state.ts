// How a decision, a question or a risk's handling is worded, and how a date reads on a card.

export type StateTone = 'neutral' | 'accent' | 'added' | 'modified' | 'deprecated' | 'removed';

const TONE: Readonly<Record<string, StateTone>> = {
  accepted: 'added',
  resolved: 'added',
  answered: 'added',
  mitigated: 'added',
  proposed: 'modified',
  owned: 'modified',
  open: 'accent',
  rejected: 'removed',
  superseded: 'deprecated',
  deferred: 'neutral',
};

/** What the reader sees for a state the plan file spells differently: a decision a later decision replaced. */
const WORD: Readonly<Record<string, string>> = { superseded: 'replaced' };

export const stateTone = (state: string): StateTone => TONE[state] ?? 'neutral';
export const stateWord = (state: string): string => WORD[state] ?? state;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO = /^(\d{4})-(\d{2})-(\d{2})/u;

/**
 * "2026-10-16" as "16 Oct", with the year when it is not today's year (or today is not known); anything else comes
 * back as it was.
 */
export function shortDate(date: string, today: Date | undefined): string {
  const m = ISO.exec(date);
  const month = MONTHS[Number(m?.[2]) - 1];
  if (m === null || month === undefined) return date;
  const year = Number(m[1]);
  const day = `${String(Number(m[3]))} ${month}`;
  return year === today?.getFullYear() ? day : `${day} ${String(year)}`;
}

/** The day alone, for a machine-readable `time`. */
export const isoDay = (date: string): string => date.slice(0, 10);
