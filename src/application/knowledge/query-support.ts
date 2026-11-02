import { evidenceAnchor } from '@/domain/knowledge/evidence-anchor';
import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import { recordReferences } from '@/domain/knowledge/knowledge-references';
import type {
  KnowledgeRecord,
  QueryRequest,
  QueryResponse,
} from '@/domain/knowledge/knowledge.generated';

/** Supporting-record pages are pinned queries; omission means already loaded, never proved. */
export function supportingPage(reader: KnowledgeReader, result: QueryResponse): QueryResponse {
  const seen = new Set(result.request.omit);
  const pending = initialSupport(result);
  const requested = new Set(associationOwners(result.request));
  const records: KnowledgeRecord[] = [];
  const budget = result.request.maxRecords ?? Number.MAX_SAFE_INTEGER;
  while (pending.length > 0 && records.length < budget) {
    const id = pending.pop();
    if (id === undefined || seen.has(id)) continue;
    const record = reader.get(id);
    if (record === undefined) throw new Error(`Missing proof record: ${id}`);
    seen.add(id);
    records.push(record);
    pending.push(...supportReferences(reader, record, requested));
  }
  const remaining = [...new Set(pending)].filter((id) => !seen.has(id));
  const limited = remaining.length > 0;
  return {
    ...result,
    ...(result.request.format === 'groundwork-query/v3'
      ? { sourceLinks: sourceLinks(records) }
      : {}),
    records: records.toSorted((a, b) => a.id.localeCompare(b.id)),
    evidence: records
      .filter((record) => record.kind === 'evidence')
      .map((record) => record.id)
      .toSorted((a, b) => a.localeCompare(b)),
    limitsHit: limited ? [...result.limitsHit, 'maxRecords'] : result.limitsHit,
    traversalComplete: !limited && result.limitsHit.length === 0,
    ...(result.request.format === 'groundwork-query/v1'
      ? {}
      : { nextRequest: limited ? nextPage(result.request, remaining, [...seen]) : null }),
  };
}

/** Related declarations are discoverable without asserting they executed on the displayed path. */
function supportReferences(
  reader: KnowledgeReader,
  record: KnowledgeRecord,
  requested: ReadonlySet<string>,
): string[] {
  const scoped =
    record.kind === 'entry' || record.kind === 'implementation' || requested.has(record.id);
  const related = scoped
    ? reader
        .select('owner', record.id)
        .filter((item) => item.kind === 'claim' || item.kind === 'coverage' || item.kind === 'gap')
        .map((item) => item.id)
    : [];
  const exposures =
    record.kind === 'entry'
      ? reader
          .select('entry', record.id)
          .filter((item) => item.kind === 'entry_binding')
          .map((item) => item.id)
      : [];
  return [...recordReferences(record), ...related, ...exposures];
}

function supportIds(result: QueryResponse): string[] {
  return [
    ...result.nodes.flatMap((node) => [
      node.record,
      ...(typeof node.component === 'string' ? [node.component] : []),
      ...(typeof node.execution === 'string' ? [node.execution] : []),
    ]),
    ...result.edges.flatMap((edge) => (edge.record === null ? [] : [edge.record])),
    ...result.claims,
    ...result.coverage,
    ...result.frontiers.flatMap((frontier) => frontier.references),
    ...result.findings.flatMap((finding) => finding.support),
  ];
}

function nextPage(
  request: QueryRequest,
  ids: readonly string[],
  omit: readonly string[],
): QueryRequest {
  return {
    ...request,
    query: 'records',
    value: null,
    context: [],
    outcome: null,
    changed: [],
    representation: 'constructed',
    ids: [...ids],
    omit: [...omit],
    ...(request.format === 'groundwork-query/v3'
      ? { associationOwners: associationOwners(request) }
      : {}),
  };
}

function associationOwners(request: QueryRequest): string[] {
  const owners =
    request.associationOwners ?? (request.query === 'records' ? (request.ids ?? []) : []);
  return [...new Set(owners)];
}

function initialSupport(result: QueryResponse): string[] {
  return result.request.query === 'records' ? [...(result.request.ids ?? [])] : supportIds(result);
}

function sourceLinks(
  records: readonly KnowledgeRecord[],
): { readonly evidence: string; readonly url: string; readonly label: string }[] {
  return records.flatMap((record) => {
    if (record.kind !== 'evidence') return [];
    const url = evidenceAnchor(record);
    return url === null
      ? []
      : [
          {
            evidence: record.id,
            url,
            label: `${record.repo}/${record.path}:${String(record.lines[0])}–${String(record.lines[1])}`,
          },
        ];
  });
}
