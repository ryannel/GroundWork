import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { readPlanState } = await import('./workspace-plans');

const scratch = path.join(process.cwd(), 'node_modules', '.cache');
const mini = await readFile(path.join(process.cwd(), 'test', 'fixtures', 'mini.yaml'), 'utf8');
const made: string[] = [];

async function workspaceWith(text: string): Promise<string> {
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(path.join(scratch, 'workspace-plans-'));
  made.push(dir);
  await mkdir(path.join(dir, 'ws', 'plans', 'p'), { recursive: true });
  await writeFile(path.join(dir, 'ws', 'plans', 'p', 'plan.yaml'), text);
  return dir;
}

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

  it('holds back a plan whose cross-references fail, keeping its title', async () => {
    const text = mini.replace('team: team:subs, kind: service', 'team: team:nobody, kind: service');
    const state = await readPlanState('ws', 'p', await workspaceWith(text));
    expect(state?.loaded).toBeNull();
    expect(state?.broken?.errors.length).toBeGreaterThan(0);
    expect(state?.broken?.title).toBeTruthy();
  });

  it('knows no plan that is not there', async () => {
    expect(await readPlanState('ws', 'absent', await workspaceWith(mini))).toBeNull();
  });
});
