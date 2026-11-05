import { describe, expect, it } from 'vitest';

import {
  agentPrompt,
  draftEvent,
  eventYaml,
  type ProgressDraft,
  progressCommand,
  shellWord,
  statesFor,
  yamlScalar,
} from './progress-draft';

const DRAFT: ProgressDraft = {
  at: '2026-11-04',
  subject: 'wi:quote',
  kind: 'commitment',
  state: 'accepted',
  promisedFor: '2027-03-01',
  confidence: 'medium',
  saidBy: 'Louise A. Zieme',
  sourceKind: 'meeting',
  url: 'https://notion.so/quote?id=1',
  note: "Ziklo's quote, as agreed",
};

describe('draftEvent', () => {
  it('drafts a commitment with everything said', () => {
    expect(draftEvent(DRAFT)).toEqual({
      at: '2026-11-04',
      subject: 'wi:quote',
      kind: 'commitment',
      state: 'accepted',
      promised_for: '2027-03-01',
      confidence: 'medium',
      said_by: 'Louise A. Zieme',
      source: { kind: 'meeting', url: 'https://notion.so/quote?id=1' },
      note: "Ziklo's quote, as agreed",
    });
  });

  it('leaves out what does not apply to the kind, and what was left blank', () => {
    expect(
      draftEvent({ ...DRAFT, kind: 'work', state: 'in_progress', saidBy: ' ', url: '', note: '' }),
    ).toEqual({
      at: '2026-11-04',
      subject: 'wi:quote',
      kind: 'work',
      state: 'in_progress',
      source: { kind: 'meeting' },
    });
    expect(draftEvent({ ...DRAFT, kind: 'note', sourceKind: '', note: 'Heard nothing' })).toEqual({
      at: '2026-11-04',
      subject: 'wi:quote',
      kind: 'note',
      said_by: 'Louise A. Zieme',
      note: 'Heard nothing',
    });
  });

  it('drops a state that does not belong to its kind, and an unknown confidence', () => {
    const event = draftEvent({ ...DRAFT, state: 'done', confidence: 'sure' });
    expect(event.state).toBeUndefined();
    expect(event.confidence).toBeUndefined();
  });

  it('offers the states of each kind', () => {
    expect(statesFor('commitment')).toEqual(['proposed', 'accepted', 'declined', 'withdrawn']);
    expect(statesFor('work')).toEqual(['not_started', 'in_progress', 'blocked', 'done']);
    expect(statesFor('note')).toEqual([]);
  });
});

describe('the outputs', () => {
  const event = draftEvent(DRAFT);

  it('writes the event as it goes under events:', () => {
    expect(eventYaml(event)).toBe(
      [
        "- at: '2026-11-04'",
        '  subject: wi:quote',
        '  kind: commitment',
        '  state: accepted',
        "  promised_for: '2027-03-01'",
        '  confidence: medium',
        '  said_by: Louise A. Zieme',
        '  source:',
        '    kind: meeting',
        "    url: 'https://notion.so/quote?id=1'",
        "  note: 'Ziklo''s quote, as agreed'",
        '',
      ].join('\n'),
    );
  });

  it('gives the exact command that appends it', () => {
    expect(progressCommand('volvo-cars', 'order-change', event)).toBe(
      String.raw`npm run progress -- add volvo-cars order-change --subject wi:quote --kind commitment --state accepted --promised-for 2027-03-01 --confidence medium --said-by 'Louise A. Zieme' --source-kind meeting --url 'https://notion.so/quote?id=1' --note 'Ziklo'\''s quote, as agreed' --at 2026-11-04`,
    );
  });

  it('asks an agent to run that command', () => {
    const prompt = agentPrompt('volvo-cars', 'order-change', event);
    expect(prompt).toContain(
      'Append this event to plans/order-change/progress.yaml in workspace volvo-cars using npm run progress',
    );
    expect(prompt).toContain(progressCommand('volvo-cars', 'order-change', event));
    expect(prompt).toContain(eventYaml(event).trimEnd());
  });

  it('quotes only what YAML or the shell would read differently', () => {
    expect(yamlScalar('wi:quote')).toBe('wi:quote');
    expect(yamlScalar('a: b')).toBe("'a: b'");
    expect(yamlScalar('yes')).toBe("'yes'");
    expect(yamlScalar('ends ')).toBe("'ends '");
    expect(yamlScalar('2027')).toBe("'2027'");
    expect(yamlScalar('# not a comment')).toBe("'# not a comment'");
    expect(shellWord('wi:quote')).toBe('wi:quote');
    expect(shellWord('two words')).toBe("'two words'");
    expect(shellWord('$HOME')).toBe("'$HOME'");
  });
});
