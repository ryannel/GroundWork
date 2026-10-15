import { describe, expect, it } from 'vitest';

import { parseRef, permalinkOf, repoOf, sourcesYaml } from './permalink';

const COMMIT = '3f9c2e1a3f9c2e1a3f9c2e1a3f9c2e1a3f9c2e1a';

describe('repoOf', () => {
  it('names a github.com repo as org/name, as system.yaml does', () => {
    expect(repoOf('git@github.com:alder-finch/pricing.git')).toBe('alder-finch/pricing');
    expect(repoOf('https://github.com/alder-finch/pricing.git\n')).toBe('alder-finch/pricing');
  });

  it('keeps the host for anything else', () => {
    expect(repoOf('https://git.example.com/team/stock')).toBe('git.example.com/team/stock');
  });

  it('gives up on a remote it cannot read', () => {
    expect(repoOf('not a remote')).toBeUndefined();
  });
});

describe('parseRef', () => {
  it('reads a path, a line range and a symbol', () => {
    expect(parseRef('src/price.ts:10-24@getPrice')).toEqual({
      path: 'src/price.ts',
      lines: [10, 24],
      symbol: 'getPrice',
    });
  });

  it('treats one line as a range of one', () => {
    expect(parseRef('src/price.ts:7')).toEqual({ path: 'src/price.ts', lines: [7, 7] });
  });

  it('does not mistake an @ in a path for a symbol', () => {
    expect(parseRef('node_modules/@scope/pkg/index.js')).toEqual({
      path: 'node_modules/@scope/pkg/index.js',
    });
  });
});

describe('permalinkOf', () => {
  it('pins the file to a commit and the lines', () => {
    expect(
      permalinkOf({
        repo: 'alder-finch/pricing',
        path: 'src/price.ts',
        lines: [10, 24],
        commit: COMMIT,
      }),
    ).toBe(`https://github.com/alder-finch/pricing/blob/${COMMIT}/src/price.ts#L10-L24`);
  });
});

it('writes sources as one line of YAML to paste under a fact', () => {
  expect(sourcesYaml([{ repo: 'a/b', path: 'x.ts', lines: [1, 2], commit: COMMIT }])).toBe(
    `sources: [{repo: a/b, path: x.ts, lines: [1, 2], commit: ${COMMIT}}]`,
  );
});
