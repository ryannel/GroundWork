import { describe, expect, it } from 'vitest';

import { combinedConnectionSummary, connectionDetails } from './connection-summary';

describe('connection explanations', () => {
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
