import type { Core, Indexed } from '@/application/plan/derive-core';
import { memo, objects, textOf, tie, uniq } from '@/application/plan/derive-values';
import {
  citationsIn,
  formatPath,
  prop,
  strings,
  typeOf,
  walkStrings,
} from '@/application/plan/ids';

export type RegisterKey = 'decide' | 'decided' | 'deferred' | 'loose' | 'notes' | 'aside';
export type RegisterItem = Indexed & { readonly answers?: string };

const REGISTER: readonly [RegisterKey, string, string][] = [
  [
    'decide',
    'To decide',
    'Something in the plan waits on these; settle them before the owner approves it.',
  ],
  ['decided', 'Decided', 'Settled, and the plan depends on them.'],
  ['deferred', 'Deferred', 'Put off on purpose, with a date to come back to.'],
  ['loose', 'Loose ends', 'Still open, but nothing depends on them yet.'],
  ['notes', 'Discovery notes', 'Questions answered while mapping the system.'],
  ['aside', 'Set aside', 'Rejected or replaced.'],
];

// A decision or question carries weight when the delivery side of the plan rests on it: a change records it,
// a question blocks something, or a change, risk, work item, test, non-goal, caveat or a decision's consequences
// cite it. A decision's *context* citing a question is evidence, not dependence. Everything else is what
// discovery left behind. Decisions always carry: recording one is deliberate.
const DELIVERY_ROOTS = new Set([
  'changes',
  'decisions',
  'risks',
  'work_items',
  'tests',
  'milestones',
]);

/** A caveat as plain words: `[[id]]` reads as its name ("this question" for the entry itself), marks dropped. */
function caveatText(text: string, self: string, label: Core['label']): string {
  return text
    .replaceAll(
      /\[\[([^\]|#]{1,200})(?:#[^\]|]{0,200})?(?:\|([^\]]{0,200}))?\]\]/gu,
      (_, ref: string, alt?: string) => {
        if (alt !== undefined && alt !== '') return alt;
        if (ref !== self) return label(ref);
        return typeOf(ref) === 'decision' ? 'this decision' : 'this question';
      },
    )
    .replaceAll(/[`*_]/gu, '')
    .trim();
}

function caveatNote({ plan, label }: Core, [path, id]: readonly [string, string]): string {
  const at = /^execution\.caveats\[(\d+)\]/u.exec(path)?.[1];
  const text = at === undefined ? undefined : strings(prop(plan.execution, 'caveats'))[Number(at)];
  return text === undefined
    ? 'a caveat in how it gets built'
    : `the caveat “${caveatText(text, id, label)}”`;
}

interface Weight {
  readonly ids: readonly string[];
  readonly notes: readonly string[];
  readonly total: number;
}

/** A citation from a delivery entry (change, risk, work item...) adds that entry, unless it is a decision's context. */
function entryCitation(
  { plan }: Core,
  [root, index, sub]: readonly [string, string, string | undefined],
  id: string,
) {
  if (root === 'decisions' && sub === 'context') return {};
  const e = textOf(objects(prop(plan, root))[Number(index)]?.id);
  return e !== undefined && e !== '' && e !== id ? { id: e } : {};
}

/** What a citation at `path` adds to the weight of `id`: the entry that cites it, or a note about where. */
function citationWeight(
  core: Core,
  [path, id]: readonly [string, string],
): { readonly id?: string; readonly note?: string } {
  const m = /^([a-z_]+)(?:\[(\d+)\])?(?:\.([a-z_]+))?/u.exec(path);
  if (m === null) return {};
  const [, root = '', index, sub] = m;
  if (DELIVERY_ROOTS.has(root) && index !== undefined) {
    return entryCitation(core, [root, index, sub], id);
  }
  if (root === 'problem' && sub === 'non_goals') return { note: 'a non-goal' };
  return root === 'execution' ? { note: caveatNote(core, [path, id]) } : {};
}

/** What rests on a decision (changes recording it, risks it accepts) or a question (what it blocks), before citations. */
function ownWeight({ plan, changes }: Core, id: string): string[] {
  const ids: string[] = [];
  if (typeOf(id) === 'decision') {
    ids.push(
      ...changes.filter((c) => (c.decisions ?? []).includes(id)).map((c) => c.id),
      ...(plan.risks ?? []).filter((r) => r.accepted_by === id).map((r) => r.id),
    );
  }
  const q = (plan.questions ?? []).find((x) => x.id === id);
  if (q !== undefined) ids.push(...(q.blocks ?? []));
  return ids;
}

function weighOf(core: Core, citedBy: ReadonlyMap<string, readonly string[]>, id: string): Weight {
  const ids = ownWeight(core, id);
  const notes: string[] = [];
  for (const path of citedBy.get(id) ?? []) {
    const w = citationWeight(core, [path, id]);
    if (w.id !== undefined) ids.push(w.id);
    if (w.note !== undefined) notes.push(w.note);
  }
  const [u, n] = [uniq(ids), uniq(notes)];
  return { ids: u, notes: n, total: u.length + n.length };
}

const isText = (x: string | undefined): x is string => x !== undefined && x !== '';
const decideBy = (e: Indexed): string => textOf(prop(e, 'decide_by')) ?? '\uFFFF';
const isDecision = (e: Indexed): boolean => typeOf(e.id) === 'decision';

/** Where a decision sits in the register: settled, put off, set aside, or still to decide (when something rests on it). */
function decisionKey(status: string, carries: boolean): RegisterKey {
  if (status === 'accepted') return 'decided';
  if (status === 'deferred') return 'deferred';
  if (status === 'rejected' || status === 'superseded') return 'aside';
  return carries ? 'decide' : 'loose';
}

/** The fields of a decision or question whose text may cite the other kind. */
const TEXT_KEYS: Record<'decision' | 'question', string[]> = {
  decision: ['context', 'decision', 'consequences'],
  question: ['question', 'answer'],
};

/**
 * The other kind of register entry that bears on a decision or question by citation, either way, beside
 * `answered_by`: a decision whose text cites a question (or is cited by it) settles part of it, and the question
 * links back. Questions for a decision, decisions for a question, in plan order.
 */
function bearsOnOf(
  { plan, planIndex }: Core,
  citedBy: ReadonlyMap<string, readonly string[]>,
  id: string,
) {
  const t = typeOf(id);
  if (t !== 'decision' && t !== 'question') return [];
  const want = t === 'decision' ? 'questions' : 'decisions';
  const e = planIndex.get(id);
  const text = TEXT_KEYS[t].map((k) => textOf(prop(e, k))).filter(isText);
  const wanted = objects(prop(plan, want)).map((x) => textOf(x.id));
  const out = new Set(citationsIn(text.join(' ')).filter((x) => wanted.includes(x)));
  for (const path of citedBy.get(id) ?? []) {
    const m = /^(questions|decisions)\[(\d+)\]/u.exec(path);
    const hit = m?.[1] === want ? wanted[Number(m[2])] : undefined;
    if (hit !== undefined) out.add(hit);
  }
  // what `answered_by` already says is shown as the answer, not again here
  const answered =
    t === 'decision'
      ? new Set((plan.questions ?? []).filter((q) => q.answered_by === id).map((q) => q.id))
      : new Set([textOf(prop(e, 'answered_by'))]);
  return wanted.filter((x): x is string => x !== undefined && out.has(x) && !answered.has(x));
}

/** A decision followed by the questions it answers. */
const withAnswers =
  (answersOf: (id: string) => Indexed[]) =>
  (e: Indexed): RegisterItem[] => [
    e,
    ...(isDecision(e) ? answersOf(e.id).map((q) => ({ ...q, answers: e.id })) : []),
  ];

/** Decisions before questions, then the earlier decide_by, then what more rests on it. */
const byWeight =
  (weightOf: (id: string) => Weight) =>
  (a: Indexed, b: Indexed): number =>
    tie(
      Number(isDecision(b)) - Number(isDecision(a)),
      decideBy(a).localeCompare(decideBy(b)),
      weightOf(b.id).total - weightOf(a.id).total,
    );

/** Where each id is cited (by path), and how much the plan rests on every decision and question. */
/** One group of the decision register. */
export interface RegisterGroup {
  readonly key: RegisterKey;
  readonly label: string;
  readonly note: string;
  readonly items: readonly RegisterItem[];
}

/** Decisions and questions, what cites them and how much the plan rests on them. */
export interface Register {
  /** For each cited id, the paths in the plan that cite it. */
  readonly citedBy: ReadonlyMap<string, readonly string[]>;
  /** A question answered by a decision is settled only once that decision is accepted. */
  readonly questionState: (
    q: string | { readonly id?: string; readonly status?: string },
  ) => string;
  readonly weightOf: (id: string) => Weight;
  /** Questions a decision answers. */
  readonly answersOf: (id: string) => Indexed[];
  readonly bearsOn: (id: string) => string[];
  /** Decisions and questions as one register, grouped by how much the plan rests on them. */
  readonly decisionRegister: () => RegisterGroup[];
  readonly registerGroup: (id: string) => RegisterGroup | null;
}

export function createRegister(core: Core): Register {
  const { plan, planIndex } = core;
  const citedBy = new Map<string, string[]>();
  walkStrings(plan, (s, segs) => {
    for (const id of citationsIn(s)) {
      citedBy.set(id, [...(citedBy.get(id) ?? []), formatPath(segs)]);
    }
  });

  /** A question answered by a decision is settled only once that decision is accepted. */
  const questionState = (
    q: string | { readonly id?: string; readonly status?: string },
  ): string => {
    const id = typeof q === 'string' ? q : q.id;
    return (
      textOf(prop(planIndex.get(id ?? ''), 'status')) ??
      (typeof q === 'string' ? undefined : q.status) ??
      'open'
    );
  };

  const weightOf = memo((id: string): Weight => weighOf(core, citedBy, id));
  const decisionIds = new Set((plan.decisions ?? []).map((d) => d.id));

  const registerKey = (e: Indexed): RegisterKey => {
    const carries = weightOf(e.id).total > 0;
    if (isDecision(e)) return decisionKey(textOf(prop(e, 'status')) ?? 'proposed', carries);
    const by = planIndex.get(textOf(prop(e, 'answered_by')) ?? '');
    if (by !== undefined && decisionIds.has(by.id)) return registerKey(by);
    if (questionState(e.id) === 'resolved') return carries ? 'decided' : 'notes';
    return carries ? 'decide' : 'loose';
  };

  const bearsOn = memo((id: string): string[] => bearsOnOf(core, citedBy, id));

  /** Questions a decision answers: they read as part of it, not as separate asks. */
  const answersOf = memo((id: string): Indexed[] =>
    (plan.questions ?? [])
      .filter((q) => q.answered_by === id)
      .flatMap((q) => planIndex.get(q.id) ?? []),
  );

  /**
   * Decisions and questions as one register, grouped by how much the plan rests on them. A question that a
   * decision answers sits right after that decision (`answers` on the entry names it).
   */
  const decisionRegister = memo((): RegisterGroup[] => {
    const all = [...(plan.decisions ?? []), ...(plan.questions ?? [])]
      .filter((e) => {
        const by = textOf(prop(e, 'answered_by'));
        return !(by !== undefined && decisionIds.has(by));
      })
      .flatMap((e) => planIndex.get(e.id) ?? []);
    return REGISTER.map(([key, name, note]) => ({
      key,
      label: name,
      note,
      items: all
        .filter((e) => registerKey(e) === key)
        .toSorted(byWeight(weightOf))
        .flatMap(withAnswers(answersOf)),
    }));
  });

  const registerGroup = memo(
    (id: string) => decisionRegister().find((g) => g.items.some((e) => e.id === id)) ?? null,
  );

  return { citedBy, questionState, weightOf, answersOf, bearsOn, decisionRegister, registerGroup };
}
