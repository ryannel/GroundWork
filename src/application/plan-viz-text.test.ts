// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import {
  countOf,
  countWord,
  enumValues,
  firstSentence,
  numWord,
  plainLine,
  short,
  wasText,
} from './plan-viz-text';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('mini.yaml'));

describe('numbers as words', () => {
  it('spells up to twelve and keeps digits after', () => {
    expect(numWord(0)).toBe('no');
    expect(numWord(3)).toBe('three');
    expect(numWord(13)).toBe('13');
    expect(countOf(1, 'field')).toBe('1 field');
    expect(countOf(2, 'child', 'children')).toBe('2 children');
    expect(countWord(1, 'field')).toBe('one field');
    expect(countWord(4, 'field')).toBe('four fields');
  });
});

describe('prose', () => {
  it('takes the first sentence', () => {
    expect(firstSentence('One. Two.')).toBe('One.');
    expect(firstSentence('No stop')).toBe('No stop');
    expect(firstSentence(null)).toBe('');
  });

  it('shortens a title at a word, reading citations and marks as plain words', () => {
    expect(short('A [[svc:subs]] `x` *y*')).toBe('A svc:subs x y');
    expect(short('one two three four', 10)).toBe('one two…');
    expect(short(7)).toBe('');
    expect(plainLine('See [[svc:subs]]')).toContain('Subs');
  });

  it('reads the values of an enum type', () => {
    expect(enumValues('enum(a, b, c)?')).toEqual(['a', 'b', 'c']);
    expect(enumValues('string')).toBeNull();
    expect(enumValues(null)).toBeNull();
  });
});

describe('wasText', () => {
  it('names ids, joins lists and objects, and says none for nothing', () => {
    expect(wasText(model, null)).toBe('(none)');
    expect(wasText(model, 'svc:subs')).toBe(model.label('svc:subs'));
    expect(wasText(model, 'svc:nope')).toBe('svc:nope');
    expect(wasText(model, ['a', 'b'])).toBe('a, b');
    expect(wasText(model, { from: 'x', gone: null, n: 3 })).toBe('from: x · n: 3');
  });
});
