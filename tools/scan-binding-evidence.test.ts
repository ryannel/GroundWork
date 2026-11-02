import { describe, expect, it, vi } from 'vitest';

import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { syntaxIdentity } from '@/infrastructure/scan/source-expressions';
import { indexSource } from '@/infrastructure/scan/source-index';
import { syntaxRole } from '@/infrastructure/scan/syntax-candidates';

import { bindingEvidence, missingEvidenceSelectors } from './scan-binding-evidence';

vi.mock(import('server-only'), () => ({}));

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'bounded native binding evidence',
  () => {
    it('selects qualified methods and fields and reports missing or quarantined selectors', () => {
      const index = indexSource({
        path: 'core/src/main/java/Fixture.java',
        language: 'java',
        content: `class One {
          static final String FIELD = "selected";
          static final String OTHER = "excluded";
          void run() { selected(); }
        }
        class Two { void run() { unrelated(); } }`,
      });
      expect(index.diagnostics).toEqual([]);
      const facts = extractLocalFacts(index, {
        host: 'host:test',
        repo: 'fixture/repo',
        commit: 'a'.repeat(40),
      });
      const selectors = ['One#run', 'One#FIELD'];
      const entry = {
        file: { path: index.path, language: 'java' as const, environment: 'server' as const },
        index,
        facts,
        blob: 'b'.repeat(40),
      };
      const evidence = bindingEvidence({ sources: [entry] }, selectors);
      const nodes = evidence.semantic.filter((record) => record.kind === 'semantic_node');
      expect(nodes.some((node) => node.value === 'selected')).toBe(true);
      expect(nodes.some((node) => node.value === 'excluded')).toBe(false);
      expect(nodes.some((node) => node.name === 'unrelated')).toBe(false);
      expect(missingEvidenceSelectors([index], [...selectors, 'Missing#run'])).toEqual([
        'Missing#run',
      ]);
      expect(
        missingEvidenceSelectors([{ ...index, diagnostics: ['quarantined'] }], selectors),
      ).toEqual(selectors);
    }, 30_000);
    it('retains nested lambda owners and callback edges while excluding another method', () => {
      const index = indexSource({
        path: 'core/src/main/java/Fixture.java',
        language: 'java',
        content: `class Fixture {
        Object selected(java.util.List<String> values) {
          return values.stream().map(value -> value.trim()).filter(value -> !value.isEmpty()).toList();
        }
        Object other() { return unrelated(); }
      }`,
      });
      expect(index.diagnostics).toEqual([]);
      const facts = extractLocalFacts(index, {
        host: 'host:test',
        repo: 'fixture/repo',
        commit: 'a'.repeat(40),
      });
      const source = {
        file: { path: index.path, language: 'java' as const, environment: 'server' as const },
        index,
        facts,
        blob: 'b'.repeat(40),
      };
      const evidence = bindingEvidence({ sources: [source] }, ['selected']);
      const functions = index.nodes.filter((node) => syntaxRole(node) === 'function');
      const selected = functions.find((node) => node.symbol === 'selected');
      const other = functions.find((node) => node.symbol === 'other');
      if (!selected || !other) throw new Error('Missing fixture methods');
      const owners = new Set(evidence.summaries.map((summary) => summary.id));
      const nested = functions.filter((node) => node.kind === 'LAMBDA_EXPRESSION');
      expect(nested).toHaveLength(2);
      expect(nested.every((node) => owners.has(`summary:${syntaxIdentity(index, node)}`))).toBe(
        true,
      );
      expect(owners.has(`summary:${syntaxIdentity(index, selected)}`)).toBe(true);
      expect(owners.has(`summary:${syntaxIdentity(index, other)}`)).toBe(false);
      const nodes = evidence.semantic.filter((record) => record.kind === 'semantic_node');
      expect(nodes.some((node) => node.owner === `summary:${syntaxIdentity(index, other)}`)).toBe(
        false,
      );
      const ids = new Set(nodes.map((node) => node.id));
      const callbacks = evidence.semantic
        .filter((record) => record.kind === 'semantic_edge')
        .filter((record) => record.relation === 'callback');
      expect(callbacks).toHaveLength(2);
      expect(callbacks.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
      expect(bindingEvidence({ sources: [source] }, []).semantic).toEqual([]);
    }, 30_000);
  },
);
