import 'server-only';

import { z } from 'zod';

// The files of the system model, beside the structure. Entries in plan shape are checked against
// plan.schema.json once `origin` is taken off and their sources are turned into permalinks.

export const origin = z.enum(['extracted', 'seeded', 'curated']);

const line = z.number().int().min(1);

export const codeSource = z.strictObject({
  repo: z
    .string()
    .regex(
      /^(?:[a-z0-9.-]+\/)?[\w.-]+\/[\w.-]+$/u,
      'repo is org/name, or host/org/name off GitHub',
    ),
  path: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/u, 'commit is a sha'),
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

export const languageFile = z.strictObject({
  summary: z.string().optional(),
  concepts: entries,
});

const example = z.strictObject({
  context: z.enum(['everyday', 'company']),
  analogy: z.string().optional(),
  sentence: z.string().optional(),
});

const keyTerm = z.strictObject({
  id: z.string().regex(/^term:[a-z0-9-]+$/u, 'a key term id is term:<name>'),
  name: z.string(),
  group: z.string().optional(),
  aliases: z.array(z.string()).default([]),
  means: z.string(),
  examples: z.array(example).default([]),
  relates: z.array(z.strictObject({ to: z.string(), as: z.string() })).default([]),
  anchors: z
    .array(
      z.strictObject({
        to: z.string(),
        fit: z.enum(['same', 'close', 'renamed', 'clash', 'lives-in']),
        note: z.string().optional(),
      }),
    )
    .default([]),
});

/** language.yaml at the workspace root: the words the business has agreed on. */
export const keyTermsFile = z.strictObject({
  summary: z.string().optional(),
  source: z
    .strictObject({ title: z.string(), url: z.string().optional(), status: z.string().optional() })
    .optional(),
  groups: z.array(z.strictObject({ id: z.string(), name: z.string() })).default([]),
  terms: z.array(keyTerm).default([]),
});

export const journeyFile = z.strictObject({
  journey: z.unknown().optional(),
  interactions: entries,
});

export const scanFile = z.strictObject({
  repo: z.string(),
  branch: z.string(),
  head: z.string().regex(/^[0-9a-f]{7,40}$/u, 'head is a sha'),
  scanned_at: z.union([z.string(), z.date().transform((date) => date.toISOString())]),
  scanner: z.string(),
  files: z.record(z.string(), z.string()).default({}),
  facts: z.number().int().min(0),
});
