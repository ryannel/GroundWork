import { expect, it } from 'vitest';

import { flowFixture } from '@/../test/fixtures/model-current-flow';

import { indexOf } from './model-index';
import { modelJourneyIndexOf, modelJourneysOf, modelJourneyWalkOf } from './model-journeys';

it('retains unplaced and interaction-only journeys, exact explicit flow order and authored narrative facts', () => {
  const model = {
    ...flowFixture(),
    aliases: { 'uj:linked': { to: 'jny:linked', reason: 'Canonical journey identity.' } },
    journeys: [
      { id: 'jny:unplaced', name: 'Not yet placed', summary: 'A recorded gap.' },
      {
        id: 'jny:linked',
        name: 'Read the story',
        actor: 'actor:reader',
        flows: ['flow:story'],
        interactions: ['ui:a'],
      },
    ],
  };
  const index = indexOf(model);
  const list = modelJourneysOf(index);
  expect(list.map((record) => record.id)).toEqual(['jny:unplaced', 'jny:linked', 'flow:story']);
  expect(list[0]).toMatchObject({ systems: [], flows: [], steps: 0 });
  expect(list[1]).toMatchObject({
    actor: 'Reader',
    flows: ['flow:story'],
    systems: ['sys:a', 'sys:b', 'sys:unmapped'],
    steps: 2,
  });
  const rows = modelJourneyIndexOf(index);
  expect(rows.total).toBe(3);
  expect(rows.groups[0]?.rows[0]?.href).toBe('/queries/journeys/jny-unplaced/');
  expect(rows.groups[0]?.rows[1]?.domains).toEqual(['dom:queries']);
  const walk = modelJourneyWalkOf(index, 'jny-linked');
  expect(walk?.source).toBe(model.journeys[1]);
  expect(walk?.flows[0]?.source).toBe(model.flows[0]);
  expect(walk?.flows[0]?.steps[0]?.source.logic).toBe('Only when a value is present');
  expect(modelJourneyWalkOf(index, 'uj-linked')?.journey.id).toBe('jny:linked');
  expect(modelJourneyWalkOf(index, 'unknown')).toBeNull();
});
