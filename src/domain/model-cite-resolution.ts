import { codePathInHome, parseAuthoredCodeCitation } from '@/domain/code-links';
import { mapSourceCitations, type CitationContext } from '@/domain/model-citations';
import {
  modelList,
  modelRecord,
  modelText,
  type ModelCite,
  type ModelData,
  type ModelGap,
  type ModelRepository,
} from '@/domain/workspace-model';

export interface CitationScope {
  readonly entity: string;
  readonly homes: Readonly<Record<string, readonly ModelData<'CodeHome'>[] | undefined>>;
  readonly evidence: readonly ModelRepository[];
  readonly file: string;
  readonly handler?: Readonly<Record<string, unknown>>;
}
export interface CitationResolution {
  readonly data: unknown;
  readonly problems: readonly ModelGap[];
}
interface EvidenceValue {
  readonly data: Readonly<Record<string, unknown>>;
  readonly repo: string;
  readonly commit: string;
}
type CodeCite = Extract<ModelCite, { readonly kind: 'code' }>;
function evidenceIndex(evidence: readonly ModelRepository[]): ReadonlyMap<string, EvidenceValue> {
  return new Map(
    evidence.flatMap(({ repository, records }) =>
      records.flatMap((record) => {
        const data = modelRecord(record.data);
        const id = modelText(data?.id);
        return data === null || id === null
          ? []
          : [[id, { data, repo: repository.repo, commit: repository.commit }] as const];
      }),
    ),
  );
}
function codeLines(value: unknown): readonly [number, number] | undefined {
  const [from, to] = modelList(value);
  return typeof from === 'number' && typeof to === 'number' ? [from, to] : undefined;
}
function fileLocation(value: EvidenceValue): CodeCite | null {
  const path = modelText(value.data.path);
  return path === null ? null : { kind: 'code', repo: value.repo, commit: value.commit, path };
}
function sourceLocation(
  value: EvidenceValue,
  evidence: ReadonlyMap<string, EvidenceValue>,
): readonly CodeCite[] {
  const file = evidence.get(modelText(value.data.file) ?? '');
  if (file?.data.kind !== 'file' || file.repo !== value.repo) return [];
  const location = fileLocation(file);
  if (location === null) return [];
  const lines = codeLines(value.data.lines);
  const symbol = modelText(value.data.symbol);
  return [
    {
      ...location,
      ...(lines === undefined ? {} : { lines }),
      ...(symbol === null ? {} : { symbol }),
    },
  ];
}
function evidenceLocations(
  id: string,
  evidence: ReadonlyMap<string, EvidenceValue>,
  visited: ReadonlySet<string>,
): readonly CodeCite[] {
  if (visited.has(id)) return [];
  const value = evidence.get(id);
  if (value === undefined) return [];
  if (value.data.kind === 'file') {
    const location = fileLocation(value);
    return location === null ? [] : [location];
  }
  if (value.data.kind === 'source') return sourceLocation(value, evidence);
  const refs = [
    ...modelList(value.data.cites),
    ...modelList(value.data.sources),
    value.data.source,
  ];
  const seen = new Set([...visited, id]);
  return refs.flatMap((ref) =>
    typeof ref === 'string' ? evidenceLocations(ref, evidence, seen) : [],
  );
}
function homeLocation(
  parsed: Extract<
    NonNullable<ReturnType<typeof parseAuthoredCodeCitation>>,
    { readonly kind: 'home' }
  >,
  scope: CitationScope,
): CodeCite | null {
  const homes = new Map(
    (scope.homes[parsed.home] ?? []).map((home) => [`${home.repo}\n${home.path ?? ''}`, home]),
  );
  const choices = [...homes.values()];
  const home = choices.length === 1 ? choices[0] : undefined;
  if (home === undefined) return null;
  const pin = scope.evidence.find(({ repository }) => repository.repo === home.repo)?.repository
    .commit;
  const commit = parsed.commit ?? pin;
  const path = codePathInHome(parsed.path, home.path);
  if (commit === undefined || path === null) return null;
  return {
    kind: 'code',
    repo: home.repo,
    commit,
    path,
    ...(parsed.lines === undefined ? {} : { lines: parsed.lines }),
    ...(parsed.symbol === undefined ? {} : { symbol: parsed.symbol }),
  };
}
function recordedLocation(value: Readonly<Record<string, unknown>>): CodeCite | null {
  const { repo, commit, path } = value;
  if (typeof repo !== 'string' || typeof commit !== 'string' || typeof path !== 'string') {
    return null;
  }
  return { kind: 'code', repo, commit, path };
}
function recordedLocations(
  value: unknown,
  evidence: ReadonlyMap<string, EvidenceValue>,
): readonly CodeCite[] | null {
  const recorded = modelRecord(value);
  if (recorded?.kind === 'code') {
    const location = recordedLocation(recorded);
    return location === null ? [] : [location];
  }
  if (recorded?.kind === 'evidence' && typeof recorded.id === 'string') {
    return evidenceLocations(recorded.id, evidence, new Set());
  }
  return null;
}
function handlerFile(
  handler: Readonly<Record<string, unknown>> | null,
  scope: CitationScope,
  evidence: ReadonlyMap<string, EvidenceValue>,
): CodeCite | null {
  const locations = modelList(handler?.cites).flatMap((cite) => {
    const recorded = recordedLocations(cite, evidence);
    if (recorded !== null) return recorded;
    if (typeof cite !== 'string') return [];
    const parsed = parseAuthoredCodeCitation(cite);
    if (parsed?.kind === 'evidence') return evidenceLocations(parsed.id, evidence, new Set());
    const code = parsed?.kind === 'home' ? homeLocation(parsed, scope) : null;
    return code === null ? [] : [code];
  });
  const files = new Map(
    locations.map((location) => [
      `${location.repo}\n${location.commit}\n${location.path}`,
      location,
    ]),
  );
  return files.size === 1 ? ([...files.values()].at(0) ?? null) : null;
}
function resolveOne(
  value: string,
  scope: CitationScope,
  context: CitationContext,
  evidence: ReadonlyMap<string, EvidenceValue>,
): ModelCite | null {
  const parsed = parseAuthoredCodeCitation(value);
  if (parsed === null) return null;
  if (parsed.kind === 'evidence') return { kind: 'evidence', id: parsed.id };
  if (parsed.kind === 'home') return homeLocation(parsed, scope);
  const file = handlerFile(context.handler ?? scope.handler ?? null, scope, evidence);
  return file === null
    ? null
    : { kind: 'code', repo: file.repo, commit: file.commit, path: file.path, lines: parsed.lines };
}

/** Resolve only supplied references. An unknown pin, home or inherited file remains a recorded gap. */
export function resolveModelCitations(
  definition: string,
  value: unknown,
  scope: CitationScope,
): CitationResolution {
  const evidence = evidenceIndex(scope.evidence);
  const problems: ModelGap[] = [];
  const report = (reference: string, context: CitationContext, message: string): void => {
    problems.push({
      id: context.entity,
      kind: 'unresolved_cite',
      message,
      reference,
      at: `${scope.file}:${context.path.join('/')}`,
      property: context.localPath.join('/'),
    });
  };
  const data = mapSourceCitations(definition, value, scope.entity, (values, context) =>
    values.flatMap((cite) => {
      const reference = modelRecord(cite);
      if (reference?.kind === 'code' || reference?.kind === 'evidence') return [cite];
      if (typeof cite !== 'string') {
        report(JSON.stringify(cite), context, 'An authored citation must be a string.');
        return [];
      }
      const resolved = resolveOne(cite, scope, context, evidence);
      if (resolved === null) {
        report(
          cite,
          context,
          'The citation has no unambiguous code home, repository pin or inherited file.',
        );
        return [];
      }
      if (resolved.kind === 'evidence' && !evidence.has(resolved.id)) {
        report(cite, context, 'The cited evidence record is not present.');
      }
      return [resolved];
    }),
  );
  return { data, problems };
}
