import type { Claim, ScanInterpretation } from '@/domain/scan/interpretation.generated';
import {
  interpretationDigest,
  type InterpretationInput,
} from '@/infrastructure/scan/interpretation-format';

import { scanFixture } from './scan-kit';

type SharedClaim = Pick<
  Claim,
  | 'label'
  | 'statement'
  | 'reasoning'
  | 'confidence'
  | 'alternatives'
  | 'limitations'
  | 'support'
  | 'dependencies'
  | 'run_id'
>;

export function interpretationFixture(): {
  readonly document: ScanInterpretation;
  readonly inputs: readonly InterpretationInput[];
} {
  const observed = scanFixture();
  observed.sources = observed.sources.map((source) => ({ ...source, commit: 'a'.repeat(40) }));
  const bytes = JSON.stringify(observed);
  const support: Claim['support'] = [
    {
      kind: 'observed_record',
      context_id: 'context:source',
      record_id: 'host:server',
      source_ids: ['source:handler'],
    },
  ];
  const shared: SharedClaim = {
    label: 'inferred',
    statement: 'Probable customer support capability',
    reasoning: 'The examined handler and source ownership suggest customer support.',
    confidence: 'medium',
    alternatives: [],
    limitations: ['Product intent and deployed use are unverified.'],
    support,
    dependencies: [],
    run_id: 'run:interpretation',
  };
  const claims: Claim[] = [
    {
      ...shared,
      id: 'inferred:purpose',
      kind: 'purpose',
      subject: { kind: 'observed_record', context_id: 'context:source', record_id: 'host:server' },
    },
    {
      ...shared,
      id: 'inferred:actor',
      kind: 'actor',
      name: 'Customer support colleague',
      actor_type: 'person',
      goal: 'Keep customer information useful',
    },
    {
      ...shared,
      id: 'inferred:action',
      kind: 'action',
      name: 'Update customer details',
      actor: 'inferred:actor',
      entrypoints: [...shared.support],
      goal: 'Correct a customer record',
    },
    {
      ...shared,
      id: 'inferred:journey',
      kind: 'journey',
      name: 'Maintain customer details',
      actor: 'inferred:actor',
      goal: 'Resolve a customer request',
      steps: [
        {
          action: 'inferred:action',
          reason: 'A request may require correcting the stored details.',
        },
      ],
    },
    {
      ...shared,
      id: 'inferred:relationship',
      kind: 'relationship',
      from: { kind: 'inferred_claim', claim_id: 'inferred:actor' },
      to: { kind: 'observed_record', context_id: 'context:source', record_id: 'host:server' },
      relationship: 'uses',
    },
  ];
  return {
    inputs: [{ kind: 'scan_snapshot', id: 'context:source', bytes }],
    document: {
      format: 'scan-interpretation/v1',
      id: 'interpretation:fixture',
      state: 'complete',
      contexts: [
        {
          kind: 'scan_snapshot',
          id: 'context:source',
          scan_id: observed.id,
          sha256: interpretationDigest(bytes),
          repo: 'fixture/repo',
          commit: 'a'.repeat(40),
          role: 'target',
        },
      ],
      runs: [
        {
          id: 'run:interpretation',
          provider: 'OpenAI',
          model: { name: null, provenance: 'unknown' },
          started_at: '2026-10-25T12:00:00Z',
          finished_at: '2026-10-25T12:01:00Z',
          method: 'Best-effort interpretation of examined code and known context',
          input_context_ids: ['context:source'],
          usage: {
            state: 'unknown',
            calls_lower_bound: 1,
            reason: 'Per-run model usage is unavailable in this session.',
          },
        },
      ],
      claims,
      attempts: claims.map((claim) => ({
        area: claim.kind,
        outcome: 'claims_proposed',
        claim_ids: [claim.id],
        reason: 'Proposed the most plausible useful interpretation from examined context.',
        run_id: claim.run_id,
      })),
    },
  };
}
