import { expect, it } from 'vitest';

import { lineOf, parseLsRemote, recorded, statusOf } from './scan-status';

const HEAD = 'a'.repeat(40);
const TIP = 'b'.repeat(40);
const remote = (tips: Record<string, string>, defaultBranch: string | null = 'master') => ({
  defaultBranch,
  tips: new Map(Object.entries(tips)),
});
const never = () => null;

it('reads the default branch and tips from ls-remote', () => {
  const raw = `ref: refs/heads/master\tHEAD\n${TIP}\tHEAD\n${HEAD}\trefs/heads/main\n`;
  const parsed = parseLsRemote(raw);
  expect(parsed.defaultBranch).toBe('master');
  expect(parsed.tips.get('master')).toBe(TIP);
  expect(parsed.tips.get('main')).toBe(HEAD);
});

it('calls a repo with no mark never scanned', () => {
  expect(statusOf(null, remote({ master: TIP }), never)).toEqual({
    kind: 'never',
    branch: 'master',
    tip: TIP,
  });
});

it('calls a repo up to date when the tip is the head', () => {
  const status = statusOf({ branch: 'master', head: TIP }, remote({ master: TIP }), never);
  expect(status).toMatchObject({ kind: 'current', behind: 0, gone: null });
});

it('counts how far behind a mark is', () => {
  const status = statusOf({ branch: 'master', head: HEAD }, remote({ master: TIP }), () => 37);
  expect(status).toMatchObject({ kind: 'behind', behind: 37 });
  expect(lineOf('org/x', { branch: 'master', head: HEAD }, status)).toBe(
    'org/x: 37 commits behind (aaaaaaa → bbbbbbb on master)',
  );
});

it('falls back to the default branch when the mark’s branch is gone', () => {
  const status = statusOf({ branch: 'main', head: HEAD }, remote({ master: TIP }), never);
  expect(status).toMatchObject({ kind: 'behind', branch: 'master', gone: 'main', behind: null });
});

it('says when the repo cannot be reached', () => {
  expect(statusOf(null, remote({}, null), never)).toEqual({ kind: 'unreachable' });
});

it('records the check without moving the head', () => {
  const mark = { repo: 'org/x', branch: 'main', head: HEAD, files: { 'a.cs': '1' } };
  const status = statusOf({ branch: 'main', head: HEAD }, remote({ master: TIP }), () => 4);
  expect(recorded(mark, status, { at: '2026-10-20T00:00:00Z' })).toEqual({
    ...mark,
    branch: 'master',
    checked: { at: '2026-10-20T00:00:00Z', tip: TIP, behind: 4 },
  });
});
