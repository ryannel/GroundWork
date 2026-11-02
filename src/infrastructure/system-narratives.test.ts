import { rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { tempDir, writeWorkspace } from '@/../test/workspace-kit';

import { readSystemNarratives, systemNarrativeInputs } from './system-narratives';

vi.mock(import('server-only'), () => ({}));
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(folders.map(async (folder) => rm(folder, { recursive: true, force: true })));
});

async function fixture() {
  const root = await tempDir('narrative-');
  folders.push(root);
  const folder = path.join(root, 'system');
  await writeWorkspace(folder, { 'system.yaml': { id: 'test' } });
  const { basis } = await systemNarrativeInputs(folder, root);
  const story = {
    id: 'prepare',
    name: 'Prepare',
    summary: 'Prepare inputs.',
    confidence: 'medium',
    reasoning: 'Evidence.',
    limitations: [],
    stages: ['svc:editor', 'st:inputs'].map((component) => ({
      component,
      title: 'Inputs',
      summary: 'Prepare.',
      supporting: [],
      evidence: [component],
    })),
  };
  const file = {
    format: 1,
    label: 'Inferred',
    authored: '2026-10-29',
    generator: 'Test',
    basis,
    stories: [story],
  };
  return { root, folder, file, story };
}

describe('saved system narratives', () => {
  it('is optional and detects changed files and newly added flows', async () => {
    const { root, folder, file } = await fixture();
    await expect(readSystemNarratives(folder, root)).resolves.toBeUndefined();
    await writeWorkspace(folder, { 'narratives.yaml': file });
    await expect(readSystemNarratives(folder, root)).resolves.toMatchObject({
      status: 'current',
      label: 'Inferred',
    });
    await writeWorkspace(root, {
      'flows/new.yaml': { id: 'flow:new' },
      'flows/ignore.txt': 'Ignored',
    });
    await expect(readSystemNarratives(folder, root)).resolves.toMatchObject({ status: 'stale' });
    const changed = await systemNarrativeInputs(folder, root);
    expect(changed.files['flows/new.yaml']).toContain('flow:new');
    expect(changed.files['flows/ignore.txt']).toBeUndefined();
    await writeWorkspace(folder, {
      'narratives.yaml': { ...file, basis: changed.basis },
      'handlers.yaml': { handlers: [] },
    });
    await expect(readSystemNarratives(folder, root)).resolves.toMatchObject({ status: 'stale' });
  });
  it('rejects extra fields, duplicate stories and repeated component placement', async () => {
    const { root, folder, file, story } = await fixture();
    await writeWorkspace(folder, { 'narratives.yaml': { ...file, surprise: true } });
    await expect(readSystemNarratives(folder, root)).rejects.toThrow(/Unrecognized key/u);
    await writeWorkspace(folder, { 'narratives.yaml': { ...file, stories: [story, story] } });
    await expect(readSystemNarratives(folder, root)).rejects.toThrow('Duplicate');
    await writeWorkspace(folder, {
      'narratives.yaml': {
        ...file,
        stories: [{ ...story, stages: [story.stages[0], story.stages[0]] }],
      },
    });
    await expect(readSystemNarratives(folder, root)).rejects.toThrow('more than one stage');
  });
});
