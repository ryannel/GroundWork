import 'server-only';

import { z } from 'zod';

const source = z
  .object({
    kind: z.literal('scan_snapshot'),
    id: z.string().min(1),
    path: z.string().min(1),
    scanKind: z.enum(['source', 'program']).optional(),
  })
  .strict();
const context = z
  .object({
    kind: z.literal('context_snapshot'),
    id: z.string().min(1),
    path: z.string().min(1),
    uri: z.string().min(1),
    revision: z.string().min(1),
  })
  .strict();
const manifest = z
  .object({
    format: z.literal('scan-interpretation-inputs/v1'),
    inputs: z.array(z.discriminatedUnion('kind', [source, context])).min(1),
  })
  .strict();
export type InterpretationInputManifest = z.infer<typeof manifest>;
export function interpretationInputManifest(input: unknown): InterpretationInputManifest {
  return manifest.parse(input);
}
