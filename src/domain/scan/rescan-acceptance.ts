export const rescanAcceptanceGates = [
  'tracked_tree_and_language_mapping',
  'language_syntax_and_semantics',
  'framework_entries_effects_and_schemas',
  'runtime_components_connections_and_reverse_queries',
  'overview_entry_branch_effect_schema_source_route',
  'snapshot_bound_inference_separation',
  'cache_delta_freshness_and_invalidation',
  'stop_resume_budgets_and_independent_adversarial_review',
] as const;
export type RescanAcceptanceGate = (typeof rescanAcceptanceGates)[number];
export interface RescanAcceptanceEvidence {
  readonly gate: RescanAcceptanceGate;
  readonly repo: string;
  readonly commit: string;
  readonly status: 'accepted' | 'unsupported' | 'pending' | 'failed';
  readonly artifact: string;
  readonly verifiedDigest: string;
  readonly independentReview: string;
  readonly limitation: string;
}
/** Assesses verified evidence supplied by a caller; test totals are deliberately not an input. */
export function assessRescanAcceptance(input: {
  readonly repositories: readonly { readonly repo: string; readonly commit: string }[];
  readonly evidence: readonly RescanAcceptanceEvidence[];
}): {
  readonly status: 'accepted_for_declared_pinned_scope' | 'blocked';
  readonly blockers: readonly string[];
  readonly authorisation: 'unchanged';
} {
  const blockers = input.repositories.flatMap((repository) =>
    rescanAcceptanceGates.flatMap((gate) => {
      const matches = input.evidence.filter(
        (item) => item.repo === repository.repo && item.gate === gate,
      );
      if (matches.length !== 1) {
        return [`${repository.repo}: ${gate}: expected exactly one receipt`];
      }
      const evidence = matches[0];
      if (evidence === undefined) return [];
      const pinned = evidence.commit === repository.commit;
      const reviewed = evidence.artifact.trim() !== '' && evidence.independentReview.trim() !== '';
      const hashed = /^[a-f0-9]{64}$/u.test(evidence.verifiedDigest);
      const accepted = evidence.status === 'accepted' && pinned;
      return accepted && reviewed && hashed
        ? []
        : [
            `${repository.repo}: ${gate}: ${evidence.status}; pin, verified digest and independent review required`,
          ];
    }),
  );
  const names = input.repositories.map((repository) => repository.repo);
  if (names.length === 0 || new Set(names).size !== names.length) {
    blockers.push('Repository roster is empty or duplicated');
  }
  if (input.evidence.some((item) => !names.includes(item.repo))) {
    blockers.push('Evidence names a repository outside the roster');
  }
  return {
    status: blockers.length === 0 ? 'accepted_for_declared_pinned_scope' : 'blocked',
    blockers,
    authorisation: 'unchanged',
  };
}
