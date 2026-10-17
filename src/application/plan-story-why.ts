import type { Model } from '@/application/plan/derive';
import { firstSentence, numWord, plainLine } from '@/application/plan-viz-text';

// What chapter 1 says, worked out from the plan: the problem in its own words, what is promised and ruled out,
// and where the scenarios run. Today comes first, so nothing here is coloured by change.

const MAX_HEADLINE = 84;
const MIN_SPLIT = 20;
const SEPARATORS = [' because ', '; ', ': ', ' — ', ', '] as const;

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export interface ProblemHead {
  readonly headline: string;
  /** The tail of a headline that ran long; empty when it fits. */
  readonly lede: string;
}

/** The authored claim, or the plan's first sentence of evidence. A long one keeps two lines; the rest opens the lede. */
export function problemHead(model: Model): ProblemHead {
  const { plan } = model;
  const authored = plan.story?.chapters?.why?.headline ?? '';
  const evidence = firstSentence(plainLine(plan.problem.why));
  const fallback = evidence === '' ? 'Why this plan exists' : evidence;
  const claim = authored === '' ? fallback : authored;
  if (claim.length <= MAX_HEADLINE) return { headline: claim, lede: '' };
  for (const separator of SEPARATORS) {
    const at = claim.indexOf(separator);
    if (at <= MIN_SPLIT || at > MAX_HEADLINE) continue;
    const rest = claim.slice(at + separator.length);
    return {
      headline: claim.slice(0, at),
      lede: capital((separator === ' because ' ? `because ${rest}` : rest).trim()),
    };
  }
  return { headline: claim, lede: '' };
}

export interface Milestone {
  readonly id: string;
  /** The part before " · ", such as "M1". */
  readonly mark: string;
  readonly text: string;
}

export interface PromiseView {
  readonly headline: string;
  /** The goals after the one the headline already says. */
  readonly promises: readonly string[];
  readonly promisesLabel: string;
  /** Whether the promises column is drawn: a plan with one promise has none. */
  readonly showPromises: boolean;
  readonly wont: readonly string[];
  readonly appetite: string | null;
  readonly milestones: readonly Milestone[];
}

/** "Reserve stock" reads on as "reserve stock"; an acronym such as "VAT" keeps its capitals. */
function lowerFirst(text: string): string {
  const [first = '', second = ''] = text;
  const word = first >= 'A' && first <= 'Z' && !(second >= 'A' && second <= 'Z');
  return word ? first.toLowerCase() + text.slice(1) : text;
}

function withoutStops(text: string): string {
  let end = text.length;
  while (end > 0 && '!.'.includes(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
}

function promiseHeadline(first: string, budget: string): string {
  if (first !== '') return budget === '' ? `${first}.` : `In ${budget}, ${lowerFirst(first)}.`;
  return budget === '' ? 'What this plan promises.' : `The time budget is ${budget}.`;
}

function milestoneOf(m: { readonly id: string; readonly name: string }): Milestone {
  const [mark = m.name, ...rest] = m.name.split(' · ').map((part) => part.trim());
  return { id: m.id, mark, text: rest.length > 0 ? rest.join(' · ') : m.name };
}

/** The claim is the first promise and the time given to it, not a count of the lists below. */
export function promiseView(model: Model): PromiseView {
  const { problem, meta, milestones = [] } = model.plan;
  const goals = problem.goals ?? [];
  const appetite = meta.appetite ?? null;
  const budget = (appetite ?? '').split(/[·,;]/u)[0]?.trim() ?? '';
  const first = withoutStops((goals[0] ?? '').trim());
  const promises = first === '' ? goals : goals.slice(1);
  return {
    headline: promiseHeadline(first, budget),
    promises,
    promisesLabel: first === '' ? 'We promise' : 'We also promise',
    showPromises: promises.length > 0 || goals.length === 0,
    wont: problem.non_goals ?? [],
    appetite,
    milestones: milestones.map(milestoneOf),
  };
}

export interface ScenarioCard {
  readonly id: string;
  readonly title: string;
  readonly story: string;
  readonly flows: readonly { readonly id: string; readonly added: boolean }[];
}

export interface ScenariosView {
  readonly headline: string;
  readonly lede: string;
  /** Some flows are new and some run today: each flow is tagged. */
  readonly mixed: boolean;
  readonly cards: readonly ScenarioCard[];
}

interface Counts {
  readonly added: number;
  readonly today: number;
  readonly title: string | undefined;
  readonly one: boolean;
}

function scenariosHeadline({ added, today, title, one }: Counts): string {
  if (added + today === 0) {
    return one
      ? `${title ?? 'The scenario'}: the one this plan must make work.`
      : 'The scenarios this plan must make work.';
  }
  const subject = one ? `“${title ?? ''}”` : 'Every scenario';
  if (added === 0) {
    return `${subject} runs on flows that work today; the plan changes how they behave.`;
  }
  if (today === 0) return `${subject} needs a flow that doesn’t exist yet.`;
  return `The scenarios run on today’s flows plus ${numWord(added)} new ${added === 1 ? 'one' : 'ones'}.`;
}

/** The claim is where the scenarios run (today's flows, new ones), never how many cards follow. */
export function scenariosView(model: Model): ScenariosView {
  const scenarios = model.plan.problem.scenarios ?? [];
  const flows = [...new Set(scenarios.flatMap((s) => s.flows ?? []))];
  const added = flows.filter((id) => model.status(id) === 'added').length;
  const today = flows.length - added;
  return {
    headline: scenariosHeadline({
      added,
      today,
      title: scenarios[0]?.title,
      one: scenarios.length === 1,
    }),
    lede: flows.length === 0 ? '' : 'Journey walks these flows today and with this plan.',
    mixed: added > 0 && today > 0,
    cards: scenarios.map((s) => ({
      id: s.id,
      title: s.title,
      story: s.story ?? '',
      flows: (s.flows ?? []).map((id) => ({ id, added: model.status(id) === 'added' })),
    })),
  };
}
