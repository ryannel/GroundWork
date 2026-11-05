import 'server-only';

import { z } from 'zod';

import { SYSTEM_TIERS } from '@/domain/workspace';
import {
  RESERVED_PAGES,
  RESERVED_SYSTEM_PAGES,
  RESERVED_WORKSPACES,
} from '@/domain/workspace-check';

const RESERVED = 'the id is reserved for a page';

const id = z.string().regex(/^[a-z0-9][a-z0-9:-]*$/u, 'ids are lower-case, with - and :');

const componentFile = z.strictObject({
  id,
  name: z.string(),
  type: z.enum(['service', 'website', 'database', 'queue', 'job', 'library', 'external']),
  tech: z.string().optional(),
  does: z.string().optional(),
  infrastructure: z.boolean().optional(),
  talks_to: z
    .array(z.strictObject({ to: id, via: z.enum(['api', 'message', 'data']) }))
    .default([]),
});

export const systemFile = z.strictObject({
  id: id.refine((value) => !RESERVED_SYSTEM_PAGES.includes(value), RESERVED),
  name: z.string(),
  purpose: z.string().optional(),
  tier: z.enum(SYSTEM_TIERS).optional(),
  team: id.optional(),
  /** The platform system it runs on, by system id. */
  runs_on: id.optional(),
  repos: z
    .array(
      z.union([
        z.string(),
        z.strictObject({
          repo: z.string(),
          path: z
            .string()
            .regex(/^[^/].*[^/]$|^[^/]$/u, 'a folder inside the repo, with no slash at either end'),
        }),
      ]),
    )
    .default([]),
  components: z.array(componentFile).default([]),
});

export const domainFile = z.strictObject({
  id: id.refine((value) => !RESERVED_PAGES.includes(value), RESERVED),
  name: z.string(),
  purpose: z.string().optional(),
});

export const workspaceFile = z.strictObject({
  /** The version of the workspace layout; 1 is today's. */
  format: z.literal(1).optional(),
  id: id.refine((value) => !RESERVED_WORKSPACES.includes(value), RESERVED),
  name: z.string(),
  description: z.string().optional(),
  private: z.boolean().default(false),
  teams: z
    .array(
      z.strictObject({
        id,
        name: z.string(),
        colour: z.number().int().min(1).max(13).optional(),
        channel: z.string().optional(),
        /** What evidence calls the team: CODEOWNERS and GitHub teams, Backstage owners. */
        handles: z.array(z.string().min(1)).default([]),
        /** A team outside the company, whose systems are described from its documents. */
        partner: z.boolean().default(false),
        contacts: z
          .array(z.strictObject({ name: z.string().min(1), role: z.string().optional() }))
          .default([]),
      }),
    )
    .default([]),
  actors: z
    .array(
      z.strictObject({
        id: id.refine((value) => value.startsWith('actor:'), 'an actor id starts with actor:'),
        name: z.string(),
        summary: z.string().optional(),
        uses: z.array(id).default([]),
        customer: z.boolean().default(false),
      }),
    )
    .default([]),
  key_journeys: z.array(z.string()).default([]),
});
