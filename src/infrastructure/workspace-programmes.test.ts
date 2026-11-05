import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';
import { stringify } from 'yaml';

vi.mock(import('server-only'), () => ({}));

const { checkPlanState, readPlanState } = await import('./workspace-plans');
const { readProgramme, readProgrammes } = await import('./workspace-programmes');
const { readWorkspaces } = await import('./workspace-store');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const mini = await readFile(path.join(process.cwd(), 'test', 'fixtures', 'mini.yaml'), 'utf8');
const made: string[] = [];

const CARE = {
  id: 'care',
  title: 'Care in Sweden',
  outcome: 'One Care deal from sale to change; see [[dec:contract]].',
  decisions: [
    { id: 'dec:contract', title: 'A revised contract', status: 'accepted', decider: 'team:subs' },
  ],
  questions: [{ id: 'q:quote-shape', question: 'What does a quote hold?', status: 'open' }],
  milestones: [{ id: 'ms:m3', name: 'Orders change' }],
};

/** A workspace with the care programme, a broken one, and plans p (in care, building on q) and q. */
async function workspace(files: Readonly<Record<string, string>> = {}): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(path.join(scratch, 'workspace-programmes-'));
  made.push(dir);
  const p = mini
    .replace('meta:\n  id: mini\n', 'meta:\n  id: mini\n  programme: care\n')
    .replace('\nproblem:\n', '\nbuilds_on: [q]\n\nproblem:\n')
    .replace(
      "{ id: ms:skeleton, name: 'Walking skeleton',",
      "{ id: ms:skeleton, serves: care/ms:m3, name: 'Walking skeleton',",
    )
    .replace(
      "      title: 'Pause endpoint',\n",
      "      title: 'Pause endpoint',\n      blocked_by: [care/dec:contract, q/q:trial-pause],\n",
    );
  const all: Readonly<Record<string, string>> = {
    'workspace.yaml': stringify({
      id: 'ws',
      name: 'WS',
      teams: [{ id: 'team:subs', name: 'Subs' }],
    }),
    'programmes/care/programme.yaml': stringify(CARE),
    'programmes/bad/programme.yaml': stringify({
      ...CARE,
      id: 'worse',
      outcome: 'See [[q/q:gone]].',
    }),
    'plans/p/plan.yaml': p,
    // An empty landed base, so the plan is read on its own rather than onto the empty workspace's today.
    'plans/p/base.yaml': 'landed_on: 2025-01-01\n',
    'plans/q/plan.yaml': mini,
    'plans/q/base.yaml': 'landed_on: 2025-01-01\n',
    ...files,
  };
  await Promise.all(
    Object.entries(all).map(async ([file, text]) => {
      await mkdir(path.dirname(path.join(dir, 'ws', file)), { recursive: true });
      await writeFile(path.join(dir, 'ws', file), text);
    }),
  );
  return dir;
}

afterAll(async () => {
  await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
});

describe('programmes', () => {
  it('reads each programme, and says what is wrong with one that does not check', async () => {
    const root = await workspace();
    const [ws] = await readWorkspaces(root);
    const read = await readProgrammes(ws!, root);
    expect(read.map(({ id, programme }) => [id, programme?.title ?? null])).toEqual([
      ['bad', null],
      ['care', 'Care in Sweden'],
    ]);
    expect(read[0]?.errors).toEqual([
      { path: 'id', message: 'the id is worse, but the folder is bad; make them the same' },
      {
        path: 'outcome',
        message: 'cites [[q/q:gone]]: q/q:gone does not exist in q; fix the id, or define it there',
      },
    ]);
    expect(read[1]?.errors).toEqual([]);
  });

  it('refuses a programme the schema does not take', async () => {
    const root = await workspace({ 'programmes/care/programme.yaml': 'id: care\ntitle: Care\n' });
    const [ws] = await readWorkspaces(root);
    const read = await readProgramme(ws!, 'care', root);
    expect(read.programme).toBeNull();
    expect(read.errors.map((e) => e.message).join('\n')).toMatch(/outcome/u);
  });
});

describe('plans among their neighbours', () => {
  it('loads a plan in a programme that builds on another and cites both', async () => {
    const state = await readPlanState('ws', 'p', await workspace());
    expect(state?.broken?.errors).toBeUndefined();
    expect(state?.loaded?.plan.builds_on).toEqual(['q']);
  });

  it('holds back a plan whose qualified ids do not resolve', async () => {
    const root = await workspace({
      'plans/q/plan.yaml': mini.replace('id: q:trial-pause', 'id: q:trial-break'),
    });
    const state = await checkPlanState('ws', 'p', root);
    expect(state?.broken?.errors).toContainEqual({
      path: 'work_items[0].blocked_by[1]',
      message: 'q/q:trial-pause does not exist in q; fix the id, or define it there',
    });
  });

  it('holds back a plan whose progress.yaml names what it does not have', async () => {
    const root = await workspace({
      'plans/q/progress.yaml': stringify({
        events: [
          { at: '2026-10-20', subject: 'wi:gone', kind: 'work', state: 'done' },
          { at: '2026-10-21', subject: 'wi:retire', kind: 'commitment', state: 'in_progress' },
        ],
      }),
    });
    const state = await readPlanState('ws', 'q', root);
    expect(state?.loaded).toBeNull();
    expect(state?.broken?.errors).toEqual([
      {
        path: 'progress.yaml: events[0].subject',
        message: 'wi:gone is no work item or milestone of this plan; fix the id',
      },
      {
        path: 'progress.yaml: events[1].state',
        message:
          'a commitment event cannot be in_progress; its states are proposed, accepted, declined, withdrawn',
      },
    ]);
  });

  it('reads issue state from the GitHub events in progress.yaml', async () => {
    const root = await workspace({
      'plans/q/progress.yaml': stringify({
        events: [
          {
            at: '2026-10-20',
            subject: 'wi:retire',
            kind: 'work',
            state: 'done',
            source: { kind: 'github', repo: 'org/subs', issue: 4 },
          },
        ],
      }),
    });
    const state = await readPlanState('ws', 'q', root);
    expect(state?.loaded?.status).toEqual({
      'wi:retire': {
        state: 'closed',
        closed_at: '2026-10-20',
        url: 'https://github.com/org/subs/issues/4',
      },
    });
  });
});
