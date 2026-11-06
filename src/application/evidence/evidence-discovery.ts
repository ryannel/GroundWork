import {
  type EvidenceFields,
  type EvidenceRecord,
  fieldsOf,
  listOf,
  textOf,
} from '@/domain/evidence/evidence';
import { childId } from '@/domain/ids';

/** What the discovery pass concluded about a repository, beside its claims. */
export interface DiscoverySummary {
  readonly readiness: string;
  readonly coverage: string;
  readonly scopes: readonly EvidenceFields[];
  readonly sourceDeclaredComponents: readonly EvidenceFields[];
  readonly actionHosts: readonly EvidenceFields[];
  readonly knowledgeGaps: readonly string[];
  readonly unresolvedCandidates: readonly string[];
}

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function discoverySummary(detail: EvidenceFields): DiscoverySummary {
  return {
    readiness: textOf(detail.discovery_readiness, 'unknown'),
    coverage: textOf(detail.investigation_coverage, 'unknown'),
    scopes: listOf(detail.scopes),
    sourceDeclaredComponents: listOf(detail.source_declared_components),
    actionHosts: listOf(detail.action_hosts),
    knowledgeGaps: strings(detail.knowledge_gaps),
    unresolvedCandidates: strings(detail.unresolved_candidates),
  };
}

/** The discovery pass's claims (purpose, actor, action, journey, relationship), without the run that wrote them. */
export function discoveryClaims(detail: EvidenceFields): EvidenceRecord[] {
  return listOf(detail.claims).map((claim) => {
    const kept = Object.entries(claim).filter(([key]) => key !== 'run_id');
    return { ...Object.fromEntries(kept), kind: textOf(claim.kind, 'claim'), id: textOf(claim.id) };
  });
}

/** Findings from documentation-only discovery, as Inferred claims of kind `finding`. */
export function targetedClaims(detail: EvidenceFields): EvidenceRecord[] {
  return listOf(detail.findings).map((finding) => ({
    ...finding,
    kind: 'finding',
    id: `finding:${textOf(finding.id)}`,
    label: 'Inferred',
  }));
}

/** Declared schemas (protobuf messages, enums and fields), one record each; a repeated name gets a counter. */
export function schemaRecords(catalogue: EvidenceFields): EvidenceRecord[] {
  const seen = new Map<string, number>();
  return listOf(catalogue.rows).map((row) => {
    const fallback = childId(textOf(row.path), textOf(row.fq_name));
    const base = textOf(fieldsOf(row.declaration).id, fallback);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const suffix = count === 0 ? '' : `#${String(count)}`;
    return { ...row, kind: textOf(row.kind, 'schema'), id: `schema:${base}${suffix}` };
  });
}
