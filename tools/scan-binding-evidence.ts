import type { Gap, LocalSummary, SemanticRecord } from '@/domain/scan/scan.generated';
import { declarationSource } from '@/infrastructure/scan/java-declaration-parts';
import type { ScopedSources } from '@/infrastructure/scan/scoped-source-store';
import { syntaxIdentity } from '@/infrastructure/scan/source-expressions';
import type { SourceIndex, SyntaxNode } from '@/infrastructure/scan/source-index-types';
import { syntaxRole } from '@/infrastructure/scan/syntax-candidates';

interface BindingEvidence {
  readonly semantic: readonly SemanticRecord[];
  readonly summaries: readonly LocalSummary[];
  readonly gaps: readonly Gap[];
}

function selectedDeclaration(
  index: SourceIndex,
  node: SyntaxNode,
  methods: readonly string[],
): boolean {
  if (node.kind !== 'METHOD' && node.kind !== 'VARIABLE') return false;
  const method = node.symbol ?? '';
  if (node.kind === 'METHOD' && methods.includes(method)) return true;
  const owner = index.nodes.findLast(
    (candidate) =>
      ['CLASS', 'INTERFACE', 'RECORD', 'ENUM'].includes(candidate.kind) &&
      candidate.start <= node.start &&
      candidate.end >= node.end,
  );
  if (owner === undefined) return false;
  const ownerName = owner.symbol ?? '';
  const name = method === '<init>' ? ownerName : method;
  return methods.includes(`${ownerName}#${name}`);
}

/** A typo or quarantined declaration must not silently remove requested proof evidence. */
export function missingEvidenceSelectors(
  indexes: readonly SourceIndex[],
  selectors: readonly string[],
): readonly string[] {
  return selectors.filter(
    (selector) =>
      !indexes.some(
        (index) =>
          index.diagnostics.length === 0 &&
          index.nodes.some((node) => selectedDeclaration(index, node, [selector])),
      ),
  );
}

/** Exact declaration identities distinguish overloads and equally named owners in different packages. */
export function missingEvidenceSourceIDs(
  indexes: readonly SourceIndex[],
  sourceIDs: readonly string[],
): readonly string[] {
  const available = new Set(
    indexes
      .filter((index) => index.diagnostics.length === 0)
      .flatMap((index) =>
        index.nodes
          .filter((node) => ['METHOD', 'VARIABLE'].includes(node.kind))
          .map((node) => declarationSource(index, node)),
      ),
  );
  return sourceIDs.filter((source) => !available.has(source));
}

function entryEvidence(
  entry: ScopedSources['sources'][number],
  methods: readonly string[],
  ownerSourceIDs: readonly string[],
): BindingEvidence {
  if (entry.index.diagnostics.length > 0) return { semantic: [], summaries: [], gaps: [] };
  const selected = entry.index.nodes.filter(
    (node) =>
      selectedDeclaration(entry.index, node, methods) ||
      (['METHOD', 'VARIABLE'].includes(node.kind) &&
        ownerSourceIDs.includes(declarationSource(entry.index, node))),
  );
  const functions = entry.index.nodes.filter(
    (node) =>
      syntaxRole(node) === 'function' &&
      selected.some((method) => node.start >= method.start && node.end <= method.end),
  );
  const owners = new Set(functions.map((node) => `summary:${syntaxIdentity(entry.index, node)}`));
  const fields = selected.filter((node) => node.kind === 'VARIABLE');
  const fieldSources = new Set(
    entry.index.nodes
      .filter((node) => fields.some((field) => node.start >= field.start && node.end <= field.end))
      .map((node) => `source:${syntaxIdentity(entry.index, node)}`),
  );
  const nodes = (entry.facts.semantic ?? []).filter(
    (record) =>
      record.kind === 'semantic_node' &&
      (owners.has(record.owner) || fieldSources.has(record.source)),
  );
  for (const node of nodes) owners.add(node.owner);
  const ids = new Set(nodes.map((node) => node.id));
  return {
    semantic: [
      ...nodes,
      ...(entry.facts.semantic ?? []).filter(
        (record) => record.kind === 'semantic_edge' && ids.has(record.from) && ids.has(record.to),
      ),
    ],
    summaries: entry.facts.summaries.filter((summary) => owners.has(summary.id)),
    gaps: owners.size === 0 ? [] : entry.facts.gaps,
  };
}

/** Explicit method selections retain native guard/value evidence without copying the whole graph. */
export function bindingEvidence(
  result: Pick<ScopedSources, 'sources'>,
  methods: readonly string[],
  ownerSourceIDs: readonly string[] = [],
): BindingEvidence {
  const selections = result.sources.map((entry) => entryEvidence(entry, methods, ownerSourceIDs));
  return {
    semantic: selections.flatMap((selection) => selection.semantic),
    summaries: selections.flatMap((selection) => selection.summaries),
    gaps: selections.flatMap((selection) => selection.gaps),
  };
}
