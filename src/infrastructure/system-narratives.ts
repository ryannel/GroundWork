import 'server-only';

import { createHash } from 'node:crypto';

import { parse } from 'yaml';
import { z } from 'zod';

import type { SystemNarratives } from '@/domain/system-narrative';

import { listFolder, pathIn, readTextIfAny } from './disk';

const text = z.string().min(1);
const stage = z.strictObject({
  component: text,
  title: text,
  summary: text,
  supporting: z.array(text),
  evidence: z.array(text).min(1),
});
const story = z.strictObject({
  id: text,
  name: text,
  summary: text,
  confidence: z.enum(['low', 'medium', 'high']),
  reasoning: text,
  limitations: z.array(text),
  connections: z
    .array(
      z.strictObject({
        from: text,
        to: text,
        kind: z.enum(['api', 'message', 'data']),
        label: text,
        evidence: z.array(text).min(1),
      }),
    )
    .default([]),
  relatedSystems: z.array(text).default([]),
  stages: z.array(stage).min(2).max(8),
});
const file = z.strictObject({
  format: z.literal(1),
  label: z.literal('Inferred'),
  authored: z.iso.date(),
  generator: text,
  basis: z.string().regex(/^[a-f0-9]{64}$/u),
  stories: z.array(story).min(1),
});

/** All flow files participate, so adding a flow also invalidates a previously chosen story. */
export async function systemNarrativeInputs(
  folder: string,
  workspace: string,
): Promise<{ readonly basis: string; readonly files: Readonly<Record<string, string | null>> }> {
  const entries = await listFolder(pathIn(workspace, 'flows'));
  const flows = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b));
  const local = await Promise.all(
    ['system.yaml', 'contracts.yaml', 'handlers.yaml'].map(
      async (name) => [name, await readTextIfAny(pathIn(folder, name))] as const,
    ),
  );
  const flowFiles = await Promise.all(
    flows.map(
      async (name) =>
        [`flows/${name}`, await readTextIfAny(pathIn(workspace, 'flows', name))] as const,
    ),
  );
  const files = Object.fromEntries([...local, ...flowFiles]);
  return { basis: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
}

/** Changed evidence remains readable, but cannot silently drive a current-looking narrative. */
export async function readSystemNarratives(
  folder: string,
  workspace: string,
): Promise<SystemNarratives | undefined> {
  const source = await readTextIfAny(pathIn(folder, 'narratives.yaml'));
  if (source === null) return undefined;
  const value = file.parse(parse(source));
  const ids = value.stories.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate system narrative id');
  for (const item of value.stories) {
    const components = item.stages.flatMap((part) => [part.component, ...part.supporting]);
    if (new Set(components).size !== components.length) {
      throw new Error(`Narrative ${item.id}: a component appears in more than one stage`);
    }
  }
  const inputs = await systemNarrativeInputs(folder, workspace);
  return {
    label: value.label,
    authored: value.authored,
    generator: value.generator,
    status: value.basis === inputs.basis ? 'current' : 'stale',
    stories: value.stories,
  };
}
