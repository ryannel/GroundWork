import type { RevisionImpact } from '@/application/plan/impact';
import { plural, type Tense } from '@/application/plan-story-versions-words';

export type Tone = 'warn' | 'mod' | 'add' | 'quiet';

export interface TallyItem {
  readonly text: string;
  readonly tone: Tone;
}

type Tally = RevisionImpact['tally'];

const spellOne = (n: number): string => (n === 1 ? 'One' : String(n));

function workItems(x: Tally, { t }: Tense): TallyItem[] {
  const out: TallyItem[] = [];
  if (x.edges > 0) {
    out.push({
      text: `${plural(x.edges, 'new dependency', 'new dependencies')} between teams`,
      tone: 'warn',
    });
  }
  if (x.breaking > 0) out.push({ text: plural(x.breaking, 'breaking field change'), tone: 'warn' });
  if (x.rework > 0) {
    const n = plural(x.rework, 'done work item');
    out.push({
      text: t(`Reopens ${n}`, `Reopened ${n}`, `Would have reopened ${n}`),
      tone: 'warn',
    });
  }
  if (x.newWork > 0) {
    const noun = x.newWork === 1 ? 'item' : 'items';
    const n = plural(x.newWork, 'work item');
    out.push({
      text: t(`${spellOne(x.newWork)} new work ${noun}`, `Added ${n}`, `Would have added ${n}`),
      tone: 'add',
    });
  }
  return out;
}

function fieldItem(x: Tally): TallyItem[] {
  const added =
    x.optional === x.fieldsAdded && x.breaking === 0 ? 'new optional field' : 'new field';
  const parts = [
    x.fieldsAdded > 0 ? plural(x.fieldsAdded, added) : '',
    x.fieldsRemoved > 0 ? `${plural(x.fieldsRemoved, 'field')} removed` : '',
    x.fieldsChanged > 0 ? `${plural(x.fieldsChanged, 'field')} changed` : '',
  ].filter((p) => p !== '');
  return parts.length === 0 ? [] : [{ text: parts.join(' · '), tone: 'mod' }];
}

function stepItems(x: Tally, { t }: Tense): TallyItem[] {
  const out: TallyItem[] = [];
  if (x.stepsAdded > 0) out.push({ text: plural(x.stepsAdded, 'new step'), tone: 'add' });
  if (x.behaviour > 0) {
    const works = plural(x.behaviour, 'step works', 'steps work');
    const n = plural(x.behaviour, 'step');
    out.push({
      text: t(`${works} differently`, `${n} changed`, `${n} would have changed`),
      tone: 'mod',
    });
  }
  if (x.stepsRemoved > 0) {
    out.push({ text: `${plural(x.stepsRemoved, 'step')} removed`, tone: 'warn' });
  }
  if (x.carries > 0) {
    const pass = plural(x.carries, 'step passes', 'steps pass');
    const n = plural(x.carries, 'step');
    out.push({
      text: t(
        `${pass} the new data on`,
        `${n} passed the new data on`,
        `${n} would have passed the new data on`,
      ),
      tone: 'quiet',
    });
  }
  return out;
}

/** The revision in one line of counts, loudest first. */
export function tallyItems(im: RevisionImpact, tense: Tense): TallyItem[] {
  const x = im.tally;
  const screens: TallyItem =
    x.screens > 0
      ? {
          text: `${plural(x.screens, 'screen')} ${tense.t('change', 'changed', 'would have changed')}`,
          tone: 'mod',
        }
      : { text: 'No screen changes', tone: 'quiet' };
  return [...workItems(x, tense), ...fieldItem(x), ...stepItems(x, tense), screens];
}
