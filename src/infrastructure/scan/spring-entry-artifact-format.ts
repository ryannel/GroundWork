import 'server-only';

import { z } from 'zod';

import { parseScanScope } from './scan-scope';
import { sourceByteLimit } from './source-budget';

const budget = z.number().int().nonnegative();
const planSchema = z
  .object({
    entry_id: z.string(),
    root_source_ids: z.array(z.string()),
    owner_source_ids: z.array(z.string()),
    field_source_ids: z.array(z.string()),
    call_binding_ids: z.array(z.string()),
    boundary_binding_ids: z.array(z.string()),
    frontiers: z.array(
      z
        .object({
          kind: z.enum(['unresolved_call', 'missing_declaration', 'budget', 'deferred_execution']),
          source_id: z.string(),
          binding_id: z.string().nullable(),
          reason: z.string(),
        })
        .strict(),
    ),
    limits: z
      .object({
        maxOwners: budget,
        maxCalls: budget,
        maxFields: budget,
        maxDepth: budget,
        maxSyntaxNodes: budget,
        maxFrontiers: budget,
      })
      .strict(),
    selected_syntax_nodes: budget,
    omitted_frontiers: budget,
    completeness: z.literal('partial'),
    execution: z.literal('source_reachability_runtime_unverified'),
  })
  .strict();
const catalogueSchema = z
  .object({
    format: z.literal('spring-entry-catalogue/v1'),
    capture: z.string(),
    captureDigest: z.string(),
    metadataChecksum: z.string(),
    analysisFingerprint: z.string(),
    planChecksum: z.string(),
    sourcePolicy: z
      .object({ maxSourceBytes: z.number().int().positive().max(33_554_432) })
      .strict(),
    scopes: z.array(
      z
        .object({
          file: z.string(),
          digest: z.string(),
          scope: z.unknown().transform(parseScanScope),
        })
        .strict(),
    ),
    catalogue: z
      .object({
        entries: z.array(
          z
            .object({
              id: z.string(),
              kind: z.enum(['rest', 'kafka_consumer', 'schedule']),
              binding_id: z.string(),
              declaration_source_id: z.string(),
              executable_source_id: z.string().nullable(),
              root_source_ids: z.array(z.string()),
              completeness: z.literal('partial'),
            })
            .strict(),
        ),
        boundaries: z.array(
          z
            .object({
              binding_id: z.string(),
              kind: z.enum(['storage', 'outbound']),
              binding_kind: z.string(),
              source_id: z.string(),
              owner_source_id: z.string().nullable(),
            })
            .strict(),
        ),
        quarantined_paths: z.array(z.string()),
        completeness: z.literal('partial'),
        gaps: z.array(z.string()),
      })
      .strict(),
    plans: z.array(z.object({ binding_id: z.string(), plan: planSchema }).strict()),
    source_locations: z.array(
      z.object({ source_id: z.string(), path: z.string(), scope_id: z.string() }).strict(),
    ),
  })
  .strict();
export type EntryArtifact = z.infer<typeof catalogueSchema>;

export function parseEntryArtifact(input: unknown): EntryArtifact {
  return catalogueSchema.parse(input);
}

export function entryCapturePin(input: unknown): {
  readonly repo: string;
  readonly commit: string;
  readonly maxSourceBytes: number;
} {
  const manifest = z
    .object({
      format: z.enum(['scan-repository/v1', 'scan-repository/v2']),
      repo: z.string().min(1),
      commit: z.string().regex(/^[a-f\d]{40,64}$/u),
      sourcePolicy: z.object({ maxSourceBytes: z.number().int().positive() }).loose().optional(),
    })
    .loose()
    .parse(input);
  return {
    repo: manifest.repo,
    commit: manifest.commit,
    maxSourceBytes: sourceByteLimit(manifest.sourcePolicy?.maxSourceBytes),
  };
}
