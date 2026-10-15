import { z } from 'zod';

// The files of the system model, beside the structure. Entries in plan shape are checked against
// plan.schema.json once `origin` is taken off and their sources are turned into permalinks.

export const origin = z.enum(['extracted', 'seeded', 'curated']);

const line = z.number().int().min(1);

export const codeSource = z.strictObject({
  repo: z
    .string()
    .regex(/^(?:[a-z0-9.-]+\/)?[\w.-]+\/[\w.-]+$/, 'repo is org/name, or host/org/name off GitHub'),
  path: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/, 'commit is a sha'),
  lines: z.tuple([line, line]).optional(),
  symbol: z.string().optional(),
  label: z.string().optional(),
  note: z.string().optional(),
});

// The older form: a bare link, for a doc or a dashboard rather than code.
const linkSource = z.strictObject({
  url: z.url(),
  label: z.string().optional(),
  note: z.string().optional(),
});

export const anySource = z.union([codeSource, linkSource]);

export const componentDetail = z.strictObject({
  id: z.string(),
  origin,
  kind: z.enum(['ui', 'service', 'job', 'external']).optional(),
  summary: z.string().optional(),
  sources: z.array(anySource).optional(),
});

const entries = z.array(z.unknown()).default([]);

export const contractsFile = z.strictObject({
  components: z.array(componentDetail).default([]),
  stores: entries,
  interfaces: entries,
  schemas: entries,
  messages: entries,
  screens: entries,
  graphs: entries,
  subgraphs: entries,
  operations: entries,
});

export const storyFile = z.strictObject({
  summary: z.string().optional(),
  concepts: entries,
  stages: entries,
});

export const journeyFile = z.strictObject({
  journey: z.unknown().optional(),
  interactions: entries,
});

export const scanFile = z.strictObject({
  repo: z.string(),
  branch: z.string(),
  head: z.string().regex(/^[0-9a-f]{7,40}$/, 'head is a sha'),
  scanned_at: z.union([z.string(), z.date().transform((date) => date.toISOString())]),
  scanner: z.string(),
  files: z.record(z.string(), z.string()).default({}),
  facts: z.number().int().min(0),
});
