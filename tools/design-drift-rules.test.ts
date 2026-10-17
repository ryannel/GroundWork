import { describe, expect, it } from 'vitest';

import {
  compare,
  controlCount,
  countsOf,
  duplicateGroups,
  rulesOf,
  visualCount,
} from './design-drift-rules';

describe('design drift rules', () => {
  it('reads innermost rules and skips comments', () => {
    const css =
      '/* a: b; */ .row { display: grid; } @media (width > 1px) { .row { gap: var(--s-2); } }';
    expect(rulesOf(css)).toStrictEqual([
      { selector: '.row', declarations: ['display: grid'] },
      { selector: '.row', declarations: ['gap: var(--s-2)'] },
    ]);
  });

  it('counts looks but not layout', () => {
    const css =
      '.a { display: flex; color: var(--fg-1); border-radius: var(--r-2); padding: 0 }\n.a::-webkit-search-cancel-button { appearance: none; }';
    expect(visualCount(css)).toBe(4);
  });

  it('counts raw controls in a component', () => {
    expect(
      controlCount('<button type="button">x</button><input value="a" /><Button>y</Button>'),
    ).toBe(2);
  });

  it('finds rule bodies copied between stylesheets', () => {
    const body = '{ display: flex; gap: 1px; align-items: center; }';
    const groups = duplicateGroups({
      'a.css': `.x ${body}`,
      'b.css': `.y ${body}`,
      'c.css': '.z { gap: 1px; }',
    });
    expect(groups).toStrictEqual([
      ['align-items: center; display: flex; gap: 1px', 'a.css', 'b.css'],
    ]);
  });

  it('reports what got worse and what got better', () => {
    const verdict = compare(
      { visual: { 'a.css': 2 }, controls: { 'a.tsx': 1 }, duplicates: 3 },
      { visual: { 'a.css': 1, 'b.css': 1 }, controls: {}, duplicates: 3 },
    );
    expect(verdict.worse).toStrictEqual(['b.css: visual styling 0 → 1']);
    expect(verdict.better).toStrictEqual([
      'a.css: visual styling 2 → 1',
      'a.tsx: raw controls 1 → 0',
    ]);
  });

  it('refuses a baseline it did not write', () => {
    expect(() => countsOf({ visual: {} })).toThrow('missing its counts');
    expect(countsOf({ visual: { 'a.css': 1 }, controls: {}, duplicates: 2 })).toStrictEqual({
      visual: { 'a.css': 1 },
      controls: {},
      duplicates: 2,
    });
  });
});
