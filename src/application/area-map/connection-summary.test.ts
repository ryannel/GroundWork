import { describe, expect, it } from 'vitest';

import type { AreaTechnicalRelationship } from '@/application/workspace-area';

import {
  combinedConnectionSummary,
  connectionDetails,
  connectionSummary,
} from './connection-summary';

const call: AreaTechnicalRelationship = {
  id: 'call',
  from: 'discounts',
  to: 'offers',
  fromSystem: 'discounts',
  toSystem: 'offers',
  endpointId: 'api:cars',
  via: 'api:cars',
  kind: 'api',
  evidenced: true,
  label: 'GET /markets/{market}/cars-for-sale',
  detail: 'Discounts calls Offers.',
};
const authored = {
  from: 'discounts',
  to: 'offers',
  kind: 'api' as const,
  label: 'Find cars for sale',
  evidence: ['api:cars'],
};

describe('connection explanations', () => {
  it('uses evidence-backed purpose for the directed operations it covers', () => {
    expect(connectionSummary(call, [], [authored])).toBe('Find cars for sale');
    expect(connectionSummary({ ...call, endpointId: 'api:publish' }, [], [authored])).toBe(
      call.label,
    );
    expect(connectionSummary({ ...call, from: 'offers', to: 'discounts' }, [], [authored])).toBe(
      call.label,
    );
  });
  it('deduplicates the same purpose without losing distinct work', () => {
    expect(
      combinedConnectionSummary([{ label: 'Find cars for sale' }, { label: 'Find cars for sale' }]),
    ).toBe('Find cars for sale');
    expect(combinedConnectionSummary([{ label: 'Read offers' }, { label: 'Publish offers' }])).toBe(
      'Read offers; Publish offers',
    );
  });
  it('keeps each exact call and states shared direction qualifications only once', () => {
    const note = 'Direction follows the initiating request, not its response.';
    const detail = connectionDetails('Find cars for sale', [
      { detail: `Offer explorer calls GET /cars-for-sale. ${note}` },
      { detail: `Discount calculator calls GET /cars-for-sale. ${note}` },
    ]);
    expect(detail.startsWith('Find cars for sale')).toBe(true);
    expect(detail).toContain('Offer explorer calls GET /cars-for-sale.');
    expect(detail).toContain('Discount calculator calls GET /cars-for-sale.');
    expect(detail.split(note)).toHaveLength(2);
  });
});
