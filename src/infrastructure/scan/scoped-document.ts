import 'server-only';

import { actionConcerns, endpointConcerns } from '@/domain/scan/check-scan-answers';
import type { Answer, Host, ScanDocument } from '@/domain/scan/scan.generated';

import { collectAspNetRoutes } from './aspnet-bindings';
import { csharpDiagnosticGaps } from './csharp-diagnostics';
import { collectCsharpSymbols } from './csharp-symbol-bindings';
import { collectPythonRustContracts } from './python-rust-contracts';
import { collectPythonRustFramework } from './python-rust-framework';
import type { ScanScope, ScopeQuestion } from './scan-scope';
import type { ScopedSources } from './scoped-source-store';
import { sourceDigest } from './source-index';

function unique<T extends { readonly id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function addQuestion(document: ScanDocument, question: ScopeQuestion): void {
  const concerns = question.profile === 'action' ? actionConcerns : endpointConcerns;
  const answers = concerns.map((concern) => {
    const id = `obligation:${question.id}:${concern}`;
    const gap = `gap:question:${question.id}:${concern}`;
    document.obligations.push({
      kind: 'obligation',
      id,
      version: 'questions/v1',
      profile: question.profile,
      scope: question.id,
      concern,
      allowedInapplicabilityRules: [],
    });
    const answer: Answer = { state: 'unresolved', reason: 'unsupported', gap };
    document.gaps.push({
      kind: 'gap',
      id: gap,
      reason: 'unsupported',
      description: `Local operations do not establish complete ${concern} analysis for this question; semantic closure and independent reconciliation are required.`,
    });
    return { obligation: id, answer };
  });
  const first = answers[0];
  if (first === undefined) throw new Error('A question must have obligations');
  document.receipts.push({
    kind: 'receipt',
    id: `receipt:${question.id}`,
    scope: question.id,
    profile: question.profile,
    authority: 'declared',
    obligations: [first.obligation, ...answers.slice(1).map((entry) => entry.obligation)],
    answers: [first, ...answers.slice(1)],
  });
}

/** New facts only: accepted earlier execution bundles are not copied into extraction results. */
export function scopedDocument(scope: ScanScope, input: ScopedSources): ScanDocument {
  const sources = unique(input.sources.flatMap((entry) => entry.facts.sources));
  const hosts = unique(
    input.sources.flatMap((entry) => {
      const support = entry.facts.sources[0]?.id;
      if (support === undefined) return [];
      const identity = sourceDigest([scope.repo, entry.file.environment].join(':')).slice(0, 16);
      const id = `host:${identity}`;
      const host: Host = {
        kind: 'host',
        id,
        component: `scope:${scope.repo}:${entry.file.environment}`,
        environment: entry.file.environment,
        support: [support],
      };
      return [host];
    }),
  );
  const indexes = input.sources.map((entry) => entry.index);
  const csharp = collectCsharpSymbols(indexes);
  const document: ScanDocument = {
    framework: [
      ...collectAspNetRoutes(indexes, csharp.signatures),
      ...collectPythonRustFramework(indexes),
    ],
    bindings: [...csharp.bindings],
    format: 'scan/v1',
    semantic: unique(input.sources.flatMap((entry) => entry.facts.semantic ?? [])),
    id: `scan:${scope.id}`,
    sources,
    hosts,
    rules: [],
    derivations: [],
    gaps: unique([
      ...input.sources.flatMap((entry) => entry.facts.gaps),
      ...csharpDiagnosticGaps(csharp.diagnostics, scope),
    ]),
    obligations: [],
    receipts: [],
    contracts: [...csharp.contracts, ...collectPythonRustContracts(indexes)],
    effects: [],
    summaries: unique(input.sources.flatMap((entry) => entry.facts.summaries)),
    actors: [],
    surfaces: [],
    controls: [],
    actions: [],
    outcomes: [],
    executions: [],
    journeys: [],
    dependencies: [],
    closures: [],
  };
  for (const question of scope.questions) addQuestion(document, question);
  document.id = `scan:${sourceDigest(JSON.stringify(document))}`;
  return document;
}
