import { describe, expect, it, vi } from 'vitest';

import { createCore } from '@/application/plan/derive-core';
import { createWords, propWord } from '@/application/plan/derive-words';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const words = async () => createWords(createCore(await loadFixture('mini.yaml')));

describe('propWord', () => {
  it('uses plain words for the props a modify touches most', () => {
    expect(propWord('sig')).toBe('signature');
    expect(propWord('logic')).toBe('what it does');
    expect(propWord('max_age')).toBe('max age');
  });
});

describe('itemText and valText', () => {
  it('says ids as labels and edges, layers, overrides and hints as short phrases', async () => {
    const w = await words();
    expect(w.itemText('svc:subs')).toBe(w.label('svc:subs'));
    expect(w.itemText({ svc: 'svc:subs', mode: 'read' })).toBe(`${w.label('svc:subs')} read`);
    expect(w.itemText({ at: 'svc:web', ttl: 600 })).toBe(`${w.label('svc:web')} · 600 s`);
    expect(w.itemText({ at: 'svc:web' })).toBe(w.label('svc:web'));
    expect(w.itemText({ from: 'svc:billing', percent: 10 })).toBe(
      `from ${w.label('svc:billing')} · 10 %`,
    );
    expect(w.itemText({ from: 'svc:billing' })).toBe(`from ${w.label('svc:billing')}`);
    expect(w.itemText({ max_age: 300, scope: 'private' })).toBe('300 s · private');
    expect(w.itemText({ max_age: 300 })).toBe('300 s');
    expect(w.itemText({ fields: ['a', 'b'], in: ['svc:subs'] })).toBe(
      `a b in ${w.label('svc:subs')}`,
    );
    expect(w.itemText({ status: 404, code: 'NOPE' })).toBe('404 NOPE');
    expect(w.itemText({ while: 30, retry: 3 })).toBe('while 30, retry 3');
    expect(w.itemText({ nested: { a: 1 } })).toBe('{"nested":{"a":1}}');
    expect(w.itemText(7)).toBe('7');
  });
  it('shortens long text and lists values', async () => {
    const w = await words();
    expect(w.valText(null)).toBe('(none)');
    expect(w.valText('long '.repeat(20))).toMatch(/…$/u);
    expect(w.valText('short   text')).toBe('short text');
    expect(w.valText([])).toBe('(none)');
    expect(w.valText(['svc:subs', 'x'])).toBe(`${w.label('svc:subs')}, x`);
    expect(w.valText({ svc: 'svc:subs', mode: 'read' })).toBe(`${w.label('svc:subs')} read`);
    expect(w.valText(3)).toBe('3');
  });
  it('collapses same-name versions to "v1 → v2" and says (none) for a missing side', async () => {
    const w = await words();
    expect(w.pairText(null, 'svc:subs')[0]).toBe('(none)');
    expect(w.pairText('msg:status-changed-v1', 'svc:subs')).toEqual([
      w.label('msg:status-changed-v1'),
      w.label('svc:subs'),
    ]);
  });
});

const keys = (inn: string[]): unknown[] => [{ fields: ['id'], in: inn }];

describe('listDelta', () => {
  it('says what a list gains and loses', async () => {
    const w = await words();
    expect(w.listDelta('readers', ['svc:web'], ['svc:web', 'svc:billing'])).toBe(
      `readers: now also ${w.label('svc:billing')}`,
    );
    expect(w.listDelta('readers', ['svc:web', 'svc:billing'], ['svc:web'])).toBe(
      `readers: no longer ${w.label('svc:billing')}`,
    );
    expect(w.listDelta('readers', ['svc:web', 'svc:billing'], ['svc:web', 'svc:billing'])).toBe(
      'readers reordered',
    );
  });
  it('says what moved in a cache layer or a key set', async () => {
    const w = await words();
    expect(w.listDelta('cache', [{ at: 'svc:web', ttl: 60 }], [{ at: 'svc:web', ttl: 600 }])).toBe(
      `cache: ${w.label('svc:web')} 60 s → 600 s`,
    );
    expect(w.listDelta('cache', [{ at: 'svc:web', ttl: 60 }], [{ at: 'svc:web' }])).toBe(
      `cache: ${w.label('svc:web')} 60 s → derived`,
    );
    expect(
      w.listDelta('cache', [{ at: 'svc:web', ttl: 60, x: 1 }], [{ at: 'svc:web', ttl: 60, x: 2 }]),
    ).toBe(`cache: ${w.label('svc:web')} changes`);
    expect(w.listDelta('keys', keys(['svc:subs']), keys(['svc:subs', 'svc:billing']))).toBe(
      `keys: id now also in ${w.label('svc:billing')}`,
    );
    expect(w.listDelta('keys', keys(['svc:subs', 'svc:billing']), keys(['svc:subs']))).toBe(
      `keys: id no longer in ${w.label('svc:billing')}`,
    );
    expect(
      w.listDelta('keys', keys(['svc:subs', 'svc:billing']), keys(['svc:billing', 'svc:subs'])),
    ).toBe('keys: id reordered');
  });
});

describe('objDelta', () => {
  it('says what changed per key', async () => {
    const w = await words();
    expect(
      w.objDelta('cache_control', { max_age: 300, scope: 'a' }, { max_age: 60, scope: 'a' }),
    ).toBe('cache control: max age 300 → 60');
    expect(w.objDelta('cache_control', { max_age: 300 }, { max_age: 300 })).toBe(
      'cache control reordered',
    );
    expect(
      w.objDelta('override', { from: 'svc:subs', percent: 5 }, { from: 'svc:billing', percent: 5 }),
    ).toBe(`override: from ${w.label('svc:subs')} · 5 % → from ${w.label('svc:billing')} · 5 %`);
  });
});
