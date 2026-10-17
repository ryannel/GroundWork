import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { chipInfo, chipName, questionTitle, statusWord } from './plan-chips';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('mini.yaml'));

describe('chipInfo', () => {
  it('names a service by its kind', () => {
    expect(chipInfo(model, 'svc:web')).toMatchObject({
      glyph: '◧',
      word: 'UI',
      label: 'Web app',
      mono: false,
    });
    expect(chipInfo(model, 'svc:subs')).toMatchObject({
      glyph: '▣',
      word: 'service',
      missing: false,
    });
  });

  it('draws stores in mono by their kind', () => {
    expect(chipInfo(model, 'st:sub-events')).toMatchObject({
      glyph: '⇶',
      word: 'topic',
      mono: true,
    });
  });

  it('numbers risks, decisions and questions by their place in the plan', () => {
    expect(chipInfo(model, 'risk:v1-consumer')).toMatchObject({
      number: 'R1',
      label: 'A v1 consumer is missed.',
    });
    expect(chipInfo(model, 'dec:version-event').number).toBe('D1');
    expect(chipInfo(model, 'q:trial-pause')).toMatchObject({
      number: 'Q1',
      label: 'Can trials pause?',
    });
  });

  it('marks an id the plan does not know', () => {
    expect(chipInfo(model, 'svc:nope')).toMatchObject({
      missing: true,
      label: 'svc:nope',
      number: '',
    });
    expect(chipInfo(model, 'nonsense')).toMatchObject({ glyph: '·', word: 'item' });
  });

  it('says a new thing is new', () => {
    const info = chipInfo(model, 'sch:pause-request');
    expect(info.status).toBe('added');
    expect(chipName(info)).toMatch(/\(new\)$/u);
    expect(chipName(chipInfo(model, 'svc:subs'))).toBe('service: Subscriptions');
    expect(statusWord('existing')).toBe('unchanged');
  });
});

describe('questionTitle', () => {
  it('keeps the sentence that asks', () => {
    expect(questionTitle('We ship soon. Can trials pause? More context.')).toBe(
      'Can trials pause?',
    );
    expect(questionTitle('No question here')).toBe('No question here');
  });
});
