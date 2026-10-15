import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9:-]*$/, 'ids are lower-case, with - and :');

const componentFile = z.strictObject({
  id,
  name: z.string(),
  type: z.enum(['service', 'website', 'database', 'queue', 'job', 'library', 'external']),
  tech: z.string().optional(),
  does: z.string().optional(),
  talks_to: z
    .array(z.strictObject({ to: id, via: z.enum(['api', 'message', 'data']) }))
    .default([]),
});

export const systemFile = z.strictObject({
  id,
  name: z.string(),
  team: id.optional(),
  repos: z.array(z.string()).default([]),
  components: z.array(componentFile).default([]),
});

export const domainFile = z.strictObject({
  id: id.refine((value) => value !== 'plans', 'plans is reserved for the plan pages'),
  name: z.string(),
  purpose: z.string().optional(),
});

export const workspaceFile = z.strictObject({
  id,
  name: z.string(),
  description: z.string().optional(),
  private: z.boolean().default(false),
  teams: z
    .array(
      z.strictObject({ id, name: z.string(), colour: z.number().int().min(1).max(13).optional() }),
    )
    .default([]),
});
