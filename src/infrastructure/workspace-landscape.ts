import 'server-only';

import { parse } from 'yaml';
import { z } from 'zod';

import type { AuthoredLandscape } from '@/domain/landscape';
import { pathIn, readTextIfAny } from '@/infrastructure/disk';

import { workspaceFolder } from './workspace-folders';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/u, 'ids are lower-case, with hyphens');
const area = z.strictObject({
  id,
  name: z.string().min(1),
  purpose: z.string().min(1),
  activities: z.array(z.string().min(1)).min(1),
  boundary: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  evidence_count: z.number().int().nonnegative(),
});
const relationship = z.strictObject({
  id,
  from: id,
  to: id,
  label: z.string().min(1),
  kind: z.enum(['exchange', 'transition', 'support']),
});
const systemRelationship = z.strictObject({
  id,
  from: id,
  to: id,
  label: z.string().min(1),
  kind: z.enum(['api', 'message', 'data']),
  detail: z.string().min(1),
});
const collaboration = z.strictObject({
  id,
  name: z.string().min(1),
  summary: z.string().min(1),
  systems: z.array(id).min(2),
});
const flowConnection = z.strictObject({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['api', 'message', 'data']),
  evidence: z.array(z.string().min(1)).min(1),
});
const valueFlow = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
  reasoning: z.string().min(1),
  limitations: z.array(z.string()),
  bands: z
    .array(
      z.strictObject({
        id,
        title: z.string().min(1),
        summary: z.string().min(1),
        nodes: z
          .array(
            z.strictObject({
              component: z.string().min(1),
              column: z.number().int().nonnegative(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  connections: z.array(flowConnection),
  columns: z
    .array(z.strictObject({ system: id, column: z.number().int().nonnegative() }))
    .min(1)
    .optional(),
  summaries: z.array(flowConnection).optional(),
  overview: z.array(flowConnection).optional(),
});
const detail = z.strictObject({
  area: id,
  valueFlow: valueFlow.optional(),
  systems: z.array(id).min(1),
  relationships: z.array(systemRelationship),
  collaborations: z.array(collaboration),
});
const file = z.strictObject({
  format: z.literal(1),
  label: z.literal('Inferred'),
  reviewed: z.iso.date(),
  scope: z.string().min(1),
  limitation: z.string().min(1),
  areas: z.array(area).min(1),
  relationships: z.array(relationship),
  details: z.array(detail).default([]),
});

function referencesAreKnown(value: z.output<typeof file>): void {
  const areas = new Set(value.areas.map((each) => each.id));
  const unknown = value.relationships.find((each) => !areas.has(each.from) || !areas.has(each.to));
  const missingDetail = value.details.find((each) => !areas.has(each.area));
  if (unknown !== undefined) throw new Error(`relationship ${unknown.id}: unknown area`);
  if (missingDetail !== undefined) throw new Error(`detail ${missingDetail.area}: unknown area`);
}

function authored(value: z.output<typeof file>): AuthoredLandscape {
  return {
    label: value.label,
    reviewed: value.reviewed,
    scope: value.scope,
    limitation: value.limitation,
    areas: value.areas.map((each) => ({
      id: each.id,
      name: each.name,
      purpose: each.purpose,
      activities: each.activities,
      boundary: each.boundary,
      confidence: each.confidence,
      evidenceCount: each.evidence_count,
    })),
    relationships: value.relationships,
    details: value.details,
  };
}

/** The optional authored entrances beside a workspace's technical model. */
export async function readAuthoredLandscape(
  workspace: string,
  root?: string,
): Promise<AuthoredLandscape | null> {
  const folder = await workspaceFolder(workspace, root);
  if (folder === null) return null;
  const location = pathIn(folder, 'landscape.yaml');
  const text = await readTextIfAny(location);
  if (text === null) return null;
  const result = file.safeParse(parse(text));
  if (!result.success) throw new Error(`${location}: ${result.error.message}`);
  referencesAreKnown(result.data);
  return authored(result.data);
}
