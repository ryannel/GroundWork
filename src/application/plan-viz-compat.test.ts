import { describe, expect, it } from 'vitest';

import type { Compat, Person, Reason } from '@/application/plan/compat-judge';
import { derive, type Model } from '@/application/plan/derive';

import { compatBadgeView, compatOf, whoKey, whoView } from './plan-viz-compat';

const target = 'api:change';
function model(compat: Compat | null): Model {
  const base = derive({
    meta: { id: 'compat', title: 'Explain compatibility' },
    problem: { summary: 'Show who must move.' },
    teams: [],
    services: [
      { id: 'svc:a', name: 'Orders', kind: 'service' },
      { id: 'svc:b', name: 'Search', kind: 'service' },
    ],
  });
  return { ...base, compat: (id) => (id === target ? compat : null) };
}
const person = (svc: string, extra: Partial<Person> = {}): Person => ({
  svc,
  via: '',
  role: 'reader',
  target,
  movedBy: null,
  ...extra,
});
const reason = (text: string, rule = 'removed'): Reason => ({
  target,
  verdict: 'breaking',
  rule,
  text,
});

describe('compatibility presentation', () => {
  it('leaves unknown verdicts absent and suppresses only safe quiet badges', () => {
    const empty = model(null);
    expect(compatOf(empty, target)).toBeNull();
    expect(compatBadgeView(empty, target)).toBeNull();
    expect(whoView(empty, target)).toBeNull();
    const safe = model({ verdict: 'safe', reasons: [], who: [] });
    expect(compatBadgeView(safe, target)).toEqual({
      verdict: 'safe',
      word: 'safe',
      tail: '',
      why: '',
    });
    expect(compatBadgeView(safe, target, { quiet: true })).toBeNull();
    expect(whoView(safe, target)).toEqual({ breaks: [], moves: [], noReader: false });
  });
  it('names only unmoved readers for breaking changes and preserves a visible missing-reader gap', () => {
    const broken = model({
      verdict: 'breaking',
      reasons: [reason('A field is removed')],
      who: [
        person('svc:a'),
        person('svc:b', { movedBy: { step: 'flow:change#read', change: 'chg:move' } }),
      ],
    });
    expect(compatBadgeView(broken, target)).toEqual({
      verdict: 'breaking',
      word: 'breaking',
      tail: 'Orders',
      why: 'A field is removed',
    });
    expect(compatBadgeView(broken, target, { quiet: true })?.verdict).toBe('breaking');
    const gap = model({
      verdict: 'breaking',
      reasons: [
        reason('no reader recorded', 'no-reader'),
        reason('no reader recorded', 'no-reader'),
        reason(''),
      ],
      who: [],
    });
    expect(compatBadgeView(gap, target)).toEqual({
      verdict: 'breaking',
      word: 'breaking',
      tail: 'no service reader recorded',
      why: 'no service reader recorded',
    });
    expect(whoView(gap, target)).toEqual({ breaks: [], moves: [], noReader: true });
    expect(
      compatBadgeView(model({ verdict: 'breaking', reasons: [], who: [] }), target)?.tail,
    ).toBe('');
  });
  it.each(['reader', 'writer', 'caller', 'consumer'] as const)(
    'counts several %ss without erasing their role',
    (role) => {
      const value = model({
        verdict: 'migration',
        reasons: [],
        who: [person('svc:a', { role }), person('svc:b', { role })],
      });
      expect(compatBadgeView(value, target)).toEqual({
        verdict: 'migration',
        word: 'needs migration',
        tail: `2 ${role}s`,
        why: '',
      });
    },
  );
  it('names one migrating service, counts mixed roles as services, and caps distinct explanations at eight', () => {
    expect(
      compatBadgeView(model({ verdict: 'migration', reasons: [], who: [person('svc:b')] }), target)
        ?.tail,
    ).toBe('Search');
    expect(
      compatBadgeView(model({ verdict: 'migration', reasons: [], who: [] }), target)?.tail,
    ).toBe('');
    const reasons = [
      reason('First'),
      reason('First'),
      reason(''),
      ...Array.from({ length: 9 }, (_, index) => reason(`Reason ${String(index + 1)}`)),
    ];
    const value = model({
      verdict: 'migration',
      reasons,
      who: [person('svc:a'), person('svc:b', { role: 'caller' })],
    });
    expect(compatBadgeView(value, target)?.tail).toBe('2 services');
    expect(compatBadgeView(value, target)?.why).toBe(
      'First\nReason 1\nReason 2\nReason 3\nReason 4\nReason 5\nReason 6\nReason 7',
    );
  });
  it('keeps proof locations, distinguishes steps from contracts, and deduplicates the same service and proof', () => {
    const value = model({
      verdict: 'breaking',
      reasons: [],
      who: [
        person('svc:a'),
        person('svc:a'),
        person('svc:a', { via: 'flow:read#one' }),
        person('svc:b', { via: 'api:read' }),
        person('svc:b', { via: 'flow:read' }),
        person('svc:a', {
          via: 'api:old',
          movedBy: { step: 'flow:new#one', change: 'chg:move', rung: 'api:new' },
        }),
        person('svc:a', {
          via: 'api:other',
          movedBy: { step: 'flow:new#one', change: 'chg:move' },
        }),
        person('svc:b', {
          via: 'msg:old',
          movedBy: { step: null, change: 'chg:move', rung: 'msg:new' },
        }),
        person('svc:b', { via: 'flow:current#two', movedBy: { step: null, change: null } }),
        person('svc:b', { movedBy: { step: null, change: null } }),
      ],
    });
    expect(whoView(value, target)).toEqual({
      breaks: [
        { svc: 'svc:a', where: null },
        { svc: 'svc:a', where: { word: 'in', id: 'flow:read#one' } },
        { svc: 'svc:b', where: { word: 'through', id: 'api:read' } },
        { svc: 'svc:b', where: { word: 'through', id: 'flow:read' } },
      ],
      moves: [
        { svc: 'svc:a', where: { word: 'in', id: 'flow:new#one' } },
        { svc: 'svc:b', where: { word: 'to', id: 'msg:new' } },
        { svc: 'svc:b', where: { word: 'in', id: 'flow:current#two' } },
        { svc: 'svc:b', where: null },
      ],
      noReader: false,
    });
    expect(whoKey({ svc: 'svc:a', where: null })).toBe('svc:a ');
    expect(whoKey({ svc: 'svc:a', where: { word: 'in', id: 'flow:read#one' } })).toBe(
      'svc:a flow:read#one',
    );
  });
});
