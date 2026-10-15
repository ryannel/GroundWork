import {
  affected,
  type Affected,
  type Ctx,
  type Kind,
  movedBy,
  type Moved,
  type PeopleEnv,
} from '@/application/plan/compat-people';
import { type Verdict, worse } from '@/application/plan/compat-rules';

export interface Hit {
  target: string;
  field?: string;
  verdict: Verdict;
  rule: string;
  text: string;
  who: Kind[];
}

export interface Reason {
  target: string;
  rule: string;
  text: string;
  verdict: Verdict;
}

export interface Person extends Affected {
  target: string;
  movedBy: Moved | null;
}

export interface Compat {
  verdict: Verdict;
  reasons: Reason[];
  who: Person[];
}

export interface Judged extends Compat {
  targets: Map<string, Verdict>;
}

export const nothing = (): Compat => ({ verdict: 'safe', reasons: [], who: [] });

const sameWho = (a: Affected, b: Affected): boolean => a.svc === b.svc && a.role === b.role;
const firstOf = <T extends Affected>(w: T, i: number, all: T[]): boolean =>
  all.findIndex((x) => sameWho(x, w)) === i;

export function merge(parts: Compat[]): Compat {
  return {
    verdict: parts.reduce<Verdict>((v, p) => worse(v, p.verdict), 'safe'),
    reasons: parts.flatMap((p) => p.reasons),
    who: parts.flatMap((p) => p.who).filter(firstOf),
  };
}

function nounOf(kinds: Kind[]): string {
  if (kinds.includes('caller')) return 'caller';
  return kinds.includes('consumer') ? 'consumer' : 'reader';
}

/** A breaking hit whose readers are all moved by this plan is needs migration, and says so. */
function breakingReasons(h: Hit, people: Person[]): { verdict: Verdict; reasons: Reason[] } {
  const reason = (rule: string, text: string, verdict: Verdict): Reason => ({
    target: h.target,
    rule,
    text,
    verdict,
  });
  if (people.length === 0) {
    return {
      verdict: 'breaking',
      reasons: [reason('no-reader', `no ${nounOf(h.who)} recorded`, 'breaking')],
    };
  }
  const left = people.filter((w) => w.movedBy === null);
  if (left.length === 0) {
    const text = `breaking edit, all ${String(people.length)} move in this plan`;
    return { verdict: 'migration', reasons: [reason('all-move', text, 'migration')] };
  }
  const text = `not moved by this plan: ${left.map((w) => w.svc).join(', ')}`;
  return { verdict: 'breaking', reasons: [reason('unmoved', text, 'breaking')] };
}

function peopleOf(env: PeopleEnv, h: Hit, ctx: Ctx): Person[] {
  if (h.verdict === 'safe') return [];
  return h.who
    .flatMap((kind) =>
      affected(env, { kind, ctx, ...(h.field === undefined ? {} : { field: h.field }) }),
    )
    .filter(firstOf)
    .map((w) => ({
      ...w,
      target: h.target,
      movedBy: movedBy(env, w, { ctx, ...(h.field === undefined ? {} : { field: h.field }) }),
    }));
}

/**
 * Turn rule hits into a verdict: each hit says what and who; a breaking hit whose readers are all moved by this
 * plan is needs migration.
 */
export function judge(env: PeopleEnv, hits: Hit[], ctx: Ctx): Judged {
  const reasons: Reason[] = [];
  const who: Person[] = [];
  const targets = new Map<string, Verdict>();
  let verdict: Verdict = 'safe';
  for (const h of hits) {
    const people = peopleOf(env, h, ctx);
    reasons.push({ target: h.target, rule: h.rule, text: h.text, verdict: h.verdict });
    let v = h.verdict;
    if (v === 'breaking') {
      const more = breakingReasons(h, people);
      v = more.verdict;
      reasons.push(...more.reasons);
    }
    verdict = worse(verdict, v);
    targets.set(h.target, worse(targets.get(h.target), v));
    who.push(...people.filter((w) => !who.some((x) => sameWho(x, w))));
  }
  return { verdict, reasons, who, targets };
}
