import { describe, expect, it } from 'vitest';

import {
  homeUrlOf,
  issueUrlOf,
  normaliseRepository,
  parseCodeLines,
  parseGitHostUrl,
  permalinkOf,
  remoteUrlOf,
  repositoryOf,
  repositoryUrl,
} from './code-links';

const source = {
  repo: 'acme/orders',
  commit: 'abc123',
  path: 'src/my file.ts',
  lines: [3, 3] as const,
};

describe('code links', () => {
  it('keeps the existing citation styles explicit', () => {
    expect(permalinkOf(source)).toBe(
      'https://github.com/acme/orders/blob/abc123/src/my%20file.ts#L3',
    );
    expect(permalinkOf(source, { encoding: 'raw', range: 'always' })).toBe(
      'https://github.com/acme/orders/blob/abc123/src/my file.ts#L3-L3',
    );
    expect(
      permalinkOf({ ...source, path: 'src/a#b?.ts', lines: [3, 8] }, { encoding: 'segments' }),
    ).toBe('https://github.com/acme/orders/blob/abc123/src/a%23b%3F.ts#L3-L8');
    expect(
      permalinkOf({ repo: 'acme/orders', path: 'x', commit: 'abc' }, { host: 'git.example.com' }),
    ).toBe('https://git.example.com/acme/orders/blob/abc/x');
  });

  it('builds repository homes, tree links, issues and clone remotes', () => {
    expect(homeUrlOf({ repo: 'acme/orders' })).toBe('https://github.com/acme/orders');
    expect(homeUrlOf({ repo: 'git.example.com/acme/orders', path: null })).toBe(
      'https://git.example.com/acme/orders',
    );
    expect(homeUrlOf({ repo: 'https://git.example.com/acme/orders/', path: 'src' })).toBe(
      'https://git.example.com/acme/orders/tree/HEAD/src',
    );
    expect(issueUrlOf('acme/orders', 12)).toBe('https://github.com/acme/orders/issues/12');
    expect(remoteUrlOf('acme/orders')).toBe('https://github.com/acme/orders.git');
    expect(repositoryUrl('acme/orders')).toBe('https://github.com/acme/orders');
  });

  it('parses remotes and preserves hosted repository identity', () => {
    expect(repositoryOf('git@github.com:acme/orders.git')).toBe('acme/orders');
    expect(repositoryOf('https://github.com/acme/orders.git\n')).toBe('acme/orders');
    expect(repositoryOf('ssh://git@git.example.com/acme/orders.git')).toBe(
      'git.example.com/acme/orders',
    );
    expect(repositoryOf('https://git.example.com/company/team/orders.git')).toBe(
      'git.example.com/company/team/orders',
    );
    expect(normaliseRepository('github.com/acme/orders')).toBe('acme/orders');
    expect(repositoryOf('not a remote')).toBeUndefined();
  });

  it('parses code paths and line anchors without treating malformed links as facts', () => {
    const link = parseGitHostUrl('https://github.com/acme/orders/blob/abc/src/a%20b.ts#L3-L8');
    expect(link).toMatchObject({
      repo: 'acme/orders',
      host: 'github.com',
      kind: 'blob',
      commit: 'abc',
      path: 'src/a b.ts',
      rawPath: 'src/a%20b.ts',
      lines: [3, 8],
      explicitRange: true,
    });
    expect(parseGitHostUrl('https://github.com/acme/orders/blob/abc/x#L3')?.lines).toEqual([3, 3]);
    expect(
      parseGitHostUrl('https://git.example.com/company/team/orders/-/blob/abc/src/a.ts')?.repo,
    ).toBe('company/team/orders');
    expect(parseCodeLines('L4-9')).toEqual([4, 9]);
    expect(parseCodeLines('section')).toBeUndefined();
    for (const value of [
      'invalid',
      'file:///tmp/orders',
      'https://github.com/acme',
      'https://github.com//orders',
      'https://github.com/acme/orders/blob/abc/%ZZ',
    ]) {
      expect(parseGitHostUrl(value)).toBeNull();
    }
  });
});
