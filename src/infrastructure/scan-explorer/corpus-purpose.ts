import 'server-only';

import { z } from 'zod';

import type { ExplorerService } from '@/domain/service-explorer';

import { checkedCorpusArtifact, type CorpusRepository } from './corpus-catalogue';

const claim = z
  .object({
    kind: z.string(),
    id: z.string(),
    label: z.literal('inferred'),
    statement: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    reasoning: z.string(),
    limitations: z.array(z.string()),
  })
  .loose();
const interpretation = z.object({
  format: z.literal('scan-interpretation/v1'),
  state: z.literal('complete'),
  claims: z.array(claim),
});
export type CorpusClaim = z.infer<typeof claim>;
export async function readCorpusClaims(
  root: string,
  repository: CorpusRepository,
): Promise<readonly CorpusClaim[]> {
  const document = interpretation.parse(
    JSON.parse(await checkedCorpusArtifact(root, repository.interpretationArtifact)),
  );
  return document.claims;
}

/** The completed catalogue binds the reviewed sidecar bytes, not a new inference. */
export async function readCorpusPurpose(
  root: string,
  repository: CorpusRepository,
): Promise<ExplorerService['purpose']> {
  const claims = await readCorpusClaims(root, repository);
  const purpose = claims.find((item) => item.kind === 'purpose');
  if (purpose === undefined) throw new Error(`No reviewed purpose for ${repository.repo}`);
  return {
    label: 'Inferred',
    statement: purpose.statement,
    confidence: purpose.confidence,
    claim: purpose.id,
  };
}
