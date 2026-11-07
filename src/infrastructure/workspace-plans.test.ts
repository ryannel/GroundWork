import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('server-only'), () => ({}));

const { planData, planFailure } = await import('./plan-data');
const { checkPlanState, readPlanState } = await import('./workspace-plans');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const mini = await readFile(path.join(process.cwd(), 'test', 'fixtures', 'mini.yaml'), 'utf8');
const made: string[] = [];

async function workspaceWith(text: string): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(path.join(scratch, 'workspace-plans-'));
  made.push(dir);
  await mkdir(path.join(dir, 'ws', 'plans', 'p'), { recursive: true });
  await writeFile(path.join(dir, 'ws', 'workspace.yaml'), 'id: ws\nname: WS\n');
  await writeFile(path.join(dir, 'ws', 'plans', 'p', 'plan.yaml'), text);
  // An empty landed base, so the plan is read on its own rather than onto the empty workspace's today.
  await writeFile(path.join(dir, 'ws', 'plans', 'p', 'base.yaml'), 'landed_on: 2025-01-01\n');
  return dir;
}

afterEach(() => vi.unstubAllEnvs());

afterAll(async () => {
  await Promise.all(made.map(async (dir) => rm(dir, { recursive: true, force: true })));
});

describe('readPlanState', () => {
  it('loads a plan that passes its checks', async () => {
    const state = await readPlanState('ws', 'p', await workspaceWith(mini));
    expect(state?.broken).toBeNull();
    expect(state?.loaded?.plan.meta.title).toBeTruthy();
  });

  it('says what is wrong with a plan the schema rejects, without stopping', async () => {
    const state = await readPlanState('ws', 'p', await workspaceWith('meta: [unclosed\n'));
    expect(state?.loaded).toBeNull();
    expect(state?.broken?.errors[0]?.path).toBe('(root)');
    expect(state?.broken?.title).toBeNull();
  });

  it('holds back a plan whose cross-references fail when checked, keeping its title', async () => {
    const text = mini.replace('team: team:subs, kind: service', 'team: team:nobody, kind: service');
    const state = await checkPlanState('ws', 'p', await workspaceWith(text));
    expect(state?.loaded).toBeNull();
    expect(state?.broken?.errors.length).toBeGreaterThan(0);
    expect(state?.broken?.title).toBeTruthy();
  });

  it('trusts the check a plan passed when written, so a read does not follow its references', async () => {
    const text = mini.replace('team: team:subs, kind: service', 'team: team:nobody, kind: service');
    const state = await readPlanState('ws', 'p', await workspaceWith(text));
    expect(state?.broken).toBeNull();
    expect(state?.loaded?.warnings).toEqual([]);
  });

  it('knows no plan that is not there', async () => {
    await expect(readPlanState('ws', 'absent', await workspaceWith(mini))).resolves.toBeNull();
  });
});

describe('retained format-1 plan pages', () => {
  const at = { workspace: 'ws', plan: 'p' };

  it('loads the recorded legacy plan, its title and its cover address', async () => {
    const root = await workspaceWith(mini);
    vi.stubEnv('GROUNDWORK_WORKSPACES', path.join(root, 'ws'));
    const data = await planData(at);
    expect(data?.workspaceName).toBe('WS');
    expect(data?.model.plan.meta).toMatchObject({ id: 'mini', title: 'Pause (mini fixture)' });
    expect(data?.outline.pages[0]).toMatchObject({ chapter: 'cover', href: '/ws/plans/p/' });
    await expect(planFailure(at)).resolves.toBeNull();
  });

  it('retains the malformed legacy plan error and leaves the page unavailable', async () => {
    const root = await workspaceWith('meta: [unclosed\n');
    vi.stubEnv('GROUNDWORK_WORKSPACES', path.join(root, 'ws'));
    const failure = await planFailure(at);
    expect(failure).toMatchObject({ workspace: 'ws', workspaceName: 'WS', title: null });
    expect(failure?.errors[0]?.path).toBe('(root)');
    await expect(planData(at)).resolves.toBeNull();
  });
});
