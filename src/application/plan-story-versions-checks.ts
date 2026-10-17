import { prop } from '@/application/plan/ids';
import type { Check } from '@/application/plan/impact';
import type { WorkImpact } from '@/application/plan/impact-work';
import { findEntity } from '@/application/plan/revision-view';
import { nameIn, type Pair, teamOfService } from '@/application/plan-story-versions-pair';
import { dayText, type Tense, unmark } from '@/application/plan-story-versions-words';
import { andList } from '@/application/plan-viz-ladder-order';

export type CheckLevel = 'warn' | 'ask' | 'note';

/** One thing to ask before deciding: a sentence (**bold** and `code` as markdown), and where it happens. */
export interface CheckView {
  readonly level: CheckLevel;
  readonly icon: string;
  readonly word: string;
  readonly text: string;
  readonly at: readonly string[];
  readonly atLabel: string;
  /** The places read on the same line as the sentence. */
  readonly inline: boolean;
}

const LEVEL: Readonly<Record<CheckLevel, readonly [string, string]>> = {
  warn: ['!', 'Needs an answer'],
  ask: ['?', 'Open point'],
  note: ['·', 'Good to know'],
};

interface Said {
  readonly text: string;
  readonly at: readonly string[];
  readonly atLabel?: string;
  readonly inline?: boolean;
}

type Of<K extends Check['kind']> = Extract<Check, { readonly kind: K }>;

const code = (s: string): string => `\`${s}\``;
const bold = (s: string): string => `**${s}**`;

const quote = (name: string): string => `“${name}”`;
const stripStop = (text: string): string => {
  let end = text.length;
  while (end > 0 && /[.\s]/u.test(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
};

/** Size and milestone of a work item: "size S · M1 due 16 Oct". */
function workFacts(pair: Pair, w: WorkImpact): string {
  const id = w.milestone;
  if (id === null) return w.size === null ? '' : `size ${w.size}`;
  const ms = findEntity(pair.to, id) ?? findEntity(pair.from, id);
  const named = prop(ms, 'name');
  const name = unmark(typeof named === 'string' ? named : id);
  const cut = name.indexOf('·');
  const short = (cut === -1 ? name : name.slice(0, cut)).trim();
  const due = prop(ms, 'due');
  const when = typeof due === 'string' ? ` due ${dayText(due, false)}` : '';
  const size = w.size === null ? '' : `size ${w.size} · `;
  return `${size}${short}${when}`;
}

function newEdge(pair: Pair, c: Of<'new-edge'>, { t }: Tense): Said {
  const a = teamOfService(pair, c.from);
  const b = teamOfService(pair, c.to);
  const calls = `${a} ${t('would call', 'now calls', 'would have called')} ${b} directly.`;
  const listens = `${a} ${t('starts listening', 'listens', 'would have listened')} to ${b}'s events.`;
  const how = bold(c.call === 'call' ? calls : listens);
  const stop = t('would stop', 'can stop', 'would have stopped');
  const was =
    c.call === 'call' && c.before === 'event'
      ? ` Today ${a} only sends ${b} events, so a ${b} outage ${stop} ${a}.`
      : ` If ${b} is down, ${a} waits.`;
  return { text: `${how}${was}`, at: c.steps, atLabel: 'Where' };
}

function breaking(pair: Pair, c: Of<'breaking'>): Said {
  const schema = nameIn(pair, c.schema);
  const field = code(c.field);
  const what = {
    removed: `${field} is removed from ${schema}`,
    added: `${field} arrives required on ${schema}`,
    edited: `${field} on ${schema} changes type or becomes required`,
  }[c.change];
  const then = c.stored
    ? 'Data already stored has no value for it. Say how it is filled.'
    : 'Everyone reading it breaks until they change.';
  const lead = bold(`${what}.`);
  return { text: `${lead} ${then}`, at: [c.schema] };
}

function whoSets(pair: Pair, c: Of<'who-sets'>): Said {
  const [w] = c.writes;
  const schema = nameIn(pair, c.schema);
  const note = c.note === null ? '' : ` The field's note says: “${stripStop(unmark(c.note))}.”`;
  if (w === undefined) {
    const lead = bold(`No step writes ${schema}, so nothing fills ${code(c.field)}.`);
    return { text: `${lead}${note} Say which step sets it.`, at: [] };
  }
  const lead = bold(
    `${quote(nameIn(pair, w.step))} writes ${schema} but doesn't say it fills ${code(c.field)}.`,
  );
  return {
    text: `${lead}${note} Say so in the step, or the field stays empty.`,
    at: c.candidates,
    atLabel: 'First stored at',
    inline: true,
  };
}

function contract(pair: Pair, c: Of<'contract'>, { t }: Tense): Said {
  const fields = andList(c.fields.map((x) => code(x.name)));
  const who = c.consumers.map((x) => teamOfService(pair, x));
  const one = who.length === 1;
  const verb = one ? 'reads' : 'read';
  const reads = who.length > 0 ? ` ${andList(who)} ${verb} it.` : '';
  const optional = `It is optional, so ${one ? 'it keeps' : 'they keep'} working as ${one ? 'it is' : 'they are'}.`;
  const breaks = `${one ? 'It breaks' : 'They break'} until ${one ? 'it changes' : 'they change'}.`;
  const gains = t('gains', 'gained', 'would have gained');
  const tail = c.breaking ? breaks : optional;
  return {
    text: `The ${nameIn(pair, c.message)} event ${gains} ${fields}.${reads} ${tail}`,
    at: [c.message],
  };
}

function rework(pair: Pair, c: Of<'rework'>): Said {
  const facts = c.items.flatMap((id) => {
    const w = pair.im.work.find((x) => x.id === id);
    return w === undefined ? [] : [`${nameIn(pair, w.team)} (${workFacts(pair, w)})`];
  });
  const list = facts.length > 0 ? ` ${andList(facts)}.` : '';
  return { text: `${bold('Done work is reopened.')}${list}`, at: c.items };
}

function milestone(c: Of<'milestone'>): Said {
  const from = dayText(c.fromDue, false);
  const to = dayText(c.toDue, false);
  const [a, b] = [from === '' ? 'no date' : from, to === '' ? 'no date' : to];
  const moved = c.fromDue === c.toDue ? '' : ` from ${a} to ${b}`;
  return { text: `${bold('Moves a milestone')}${moved}.`, at: [c.milestone] };
}

function untested(pair: Pair, c: Of<'untested-field'> | Of<'untested-step'>, { t }: Tense): Said {
  if (c.kind === 'untested-step') {
    const differs = t('works differently', 'changed', 'would have changed');
    const lead = bold(`No test runs ${quote(nameIn(pair, c.step))}`);
    return { text: `${lead}, which ${differs}.`, at: [c.step] };
  }
  const next =
    c.tests.length > 0 ? 'Add a case to the nearest test.' : 'Add one where the value is set.';
  const lead = bold(`No test checks ${code(c.field)}.`);
  return {
    text: `${lead} ${next}`,
    at: c.tests,
    atLabel: c.tests.length > 0 ? 'Nearest test' : '',
  };
}

function plain(pair: Pair, c: Check): Said {
  switch (c.kind) {
    case 'who-uses': {
      const lead = bold(`No step or screen uses ${code(c.field)}.`);
      const text = `${lead} Say who reads it, or leave it out.`;
      return { text, at: c.candidates, atLabel: 'Steps that receive it' };
    }
    case 'stale-picture': {
      const lead = bold(`${quote(nameIn(pair, c.screen))} changes but its picture doesn't.`);
      return { text: `${lead} Reviewers see the old screen.`, at: [c.screen] };
    }
    case 'stale-vote': {
      const vote = `${String(c.confidence)} (${quote(unmark(c.said))})`;
      return {
        text: `${nameIn(pair, c.team)} rated its confidence ${vote} before this change. Ask again.`,
        at: [],
      };
    }
    case 'question': {
      return { text: 'Opens the question below.', at: [c.question] };
    }
    case 'decision': {
      return { text: 'Changes the decision below.', at: [c.decision] };
    }
    default: {
      return { text: c.kind, at: [] };
    }
  }
}

function sayOf(pair: Pair, c: Check, tense: Tense): Said {
  switch (c.kind) {
    case 'new-edge': {
      return newEdge(pair, c, tense);
    }
    case 'breaking': {
      return breaking(pair, c);
    }
    case 'who-sets': {
      return whoSets(pair, c);
    }
    case 'untested-field':
    case 'untested-step': {
      return untested(pair, c, tense);
    }
    case 'contract': {
      return contract(pair, c, tense);
    }
    case 'rework': {
      return rework(pair, c);
    }
    case 'milestone': {
      return milestone(c);
    }
    default: {
      return plain(pair, c);
    }
  }
}

/** The checks a reviewer makes before deciding, one sentence each with the places it happens. */
export function checkViews(pair: Pair, tense: Tense): CheckView[] {
  return pair.im.checks.map((c) => {
    const s = sayOf(pair, c, tense);
    const [icon, word] = LEVEL[c.level];
    return {
      level: c.level,
      icon,
      word,
      text: s.text,
      at: s.at,
      atLabel: s.atLabel ?? '',
      inline: s.inline ?? false,
    };
  });
}
