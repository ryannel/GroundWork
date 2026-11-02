import { describe, expect, it, vi } from 'vitest';

import { declarationSource } from '@/infrastructure/scan/java-declaration-parts';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';
import { createSpringEntryPlanner } from '@/infrastructure/scan/spring-entry-planner';
import { springProgramBindings } from '@/infrastructure/scan/spring-program-bindings';
import { springRoutes } from '@/infrastructure/scan/spring-routes';

import { bindingEvidence, missingEvidenceSourceIDs } from './scan-binding-evidence';

vi.mock(import('server-only'), () => ({}));

const CONTENT = `package fixture;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.scheduling.annotation.Scheduled;
interface Api {
  @GetMapping("/text") String get(String id);
  @GetMapping("/number") String get(Integer id);
}
@RestController class Controller implements Api {
  Worker worker;
  public String get(String id) { return worker.load(id); }
  public String get(Integer id) { return worker.number(id); }
  public String unused() { return "excluded"; }
}
class Worker {
  static final String PREFIX="active";
  String load(String id) { return helper(id); }
  String helper(String id) { System.nanoTime(); return PREFIX+id; }
  String number(Integer id) { return "number"; }
}
class Timer {
  Worker worker;
  @Scheduled(fixedDelay=1000) void tick() { worker.load("timer"); }
  @KafkaListener(topics="events") void listen(String input) { worker.load(input); }
}`;

function fixture(content = CONTENT) {
  const index = indexSource({
    path: 'core/src/main/java/Fixture.java',
    language: 'java',
    content,
    ...(process.env.GROUNDWORK_TEST_JAVA === undefined
      ? {}
      : { java: process.env.GROUNDWORK_TEST_JAVA }),
  });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected native Java declarations.');
  const bindings = springProgramBindings({ indexes: [index], units: [unit] });
  const calls = bindings.filter((binding) => binding.kind === 'java_call_binding');
  const values = bindings.filter((binding) => binding.kind === 'java_value_binding');
  const input = {
    indexes: [index],
    units: [unit],
    routes: springRoutes([unit]),
    bindings,
    calls,
    values,
  };
  const facts = extractLocalFacts(index, {
    host: 'fixture',
    repo: 'fixture/repo',
    commit: 'pinned',
  });
  const result = {
    sources: [
      {
        file: { path: index.path, language: 'java' as const, environment: 'server' as const },
        index,
        facts,
        blob: 'fixture',
      },
    ],
  };
  return { input, index, unit, result, planner: createSpringEntryPlanner(input) };
}

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'automatic Spring entry query planning',
  () => {
    it('discovers overload-distinct inherited REST roots, listeners and schedules without manual selectors', () => {
      const { planner } = fixture();
      expect(
        planner.catalogue.entries
          .map((entry) => entry.kind)
          .toSorted((left, right) => left.localeCompare(right)),
      ).toEqual(['kafka_consumer', 'rest', 'rest', 'schedule']);
      const routes = planner.catalogue.entries.filter((entry) => entry.kind === 'rest');
      expect(new Set(routes.map((entry) => entry.declaration_source_id)).size).toBe(2);
      expect(
        routes.every((entry) => entry.executable_source_id !== entry.declaration_source_id),
      ).toBe(true);
      expect(planner.catalogue.completeness).toBe('partial');
      expect(() => planner.plan('unknown')).toThrow('Unknown source entry');
    });

    it('selects exact native owners, resolved local callees and referenced field anchors without the other overload', () => {
      const { input, unit, planner, result, index } = fixture();
      const route = input.routes.find((entry) => entry.path === '/text');
      if (!route) throw new Error('Missing text route');
      const plan = planner.plan(`entry:${route.id}`);
      const worker = unit.types.find((type) => type.name === 'Worker');
      const number = worker?.methods.find((method) => method.name === 'number');
      expect(plan.owner_source_ids).toHaveLength(3);
      expect(plan.owner_source_ids).not.toContain(number?.source);
      expect(plan.field_source_ids).toContain(
        worker?.fields.find((field) => field.name === 'PREFIX')?.source,
      );
      expect(plan.frontiers.some((frontier) => frontier.kind === 'unresolved_call')).toBe(true);
      expect(plan.execution).toBe('source_reachability_runtime_unverified');
      const sourceIDs = [...plan.owner_source_ids, ...plan.field_source_ids];
      expect(missingEvidenceSourceIDs([index], sourceIDs)).toEqual([]);
      const evidence = bindingEvidence(result, [], sourceIDs);
      const sources = new Set(
        evidence.semantic
          .filter((record) => record.kind === 'semantic_node')
          .map((record) => record.source),
      );
      expect(sources.has(number?.source ?? '')).toBe(false);
      expect(
        evidence.semantic.some(
          (record) => record.kind === 'semantic_node' && record.value === 'active',
        ),
      ).toBe(true);
      expect(bindingEvidence(result, ['Controller#get']).summaries.length).toBeGreaterThan(
        bindingEvidence(result, [], [route.method.implementation_source_id ?? '']).summaries.length,
      );
    });

    it('makes budget frontiers explicit and bounds owner, call, field and syntax selections', () => {
      const { planner } = fixture();
      const entry = planner.catalogue.entries.find((candidate) => candidate.kind === 'schedule');
      if (!entry) throw new Error('Missing schedule');
      const none = planner.plan(entry.id, { maxSyntaxNodes: 0 });
      expect(none.owner_source_ids).toEqual([]);
      expect(none.frontiers[0]?.kind).toBe('budget');
      const small = planner.plan(entry.id, {
        maxOwners: 1,
        maxCalls: 1,
        maxFields: 0,
        maxDepth: 0,
        maxFrontiers: 1,
      });
      expect(small.owner_source_ids).toHaveLength(1);
      expect(small.call_binding_ids.length).toBeLessThanOrEqual(1);
      expect(small.field_source_ids).toEqual([]);
      expect(small.frontiers.length).toBeLessThanOrEqual(1);
      expect(small.completeness).toBe('partial');
      expect(() => planner.plan(entry.id, { maxCalls: -1 })).toThrow('budgets');
      expect(() => planner.plan(entry.id, { maxDepth: 1.5 })).toThrow('budgets');
    });

    it('preserves deferred execution and recursive call reachability without asserting callback activation', () => {
      const { planner } = fixture(`import org.springframework.scheduling.annotation.Scheduled;
      class Timer { @Scheduled(fixedDelay=1) void tick() { Runnable task=()->work(); }
        void work() { again(); } void again() { work(); } }`);
      const entry = planner.catalogue.entries[0];
      if (!entry) throw new Error('Missing schedule');
      const plan = planner.plan(entry.id);
      expect(plan.owner_source_ids).toHaveLength(3);
      expect(plan.frontiers.some((frontier) => frontier.kind === 'deferred_execution')).toBe(true);
      expect(new Set(plan.owner_source_ids).size).toBe(plan.owner_source_ids.length);
    });

    it('accounts for storage and outbound declarations separately from entry behaviour', () => {
      const { input, unit } = fixture();
      const source = unit.types
        .find((type) => type.name === 'Worker')
        ?.methods.find((method) => method.name === 'helper')?.source;
      if (source === undefined) throw new Error('Missing helper');
      const planner = createSpringEntryPlanner({
        ...input,
        bindings: [
          ...input.bindings,
          { kind: 'mongo_operation_binding', id: 'storage', source },
          { kind: 'outbound_binding', id: 'remote', source },
        ],
      });
      expect(
        planner.catalogue.boundaries
          .map((boundary) => boundary.kind)
          .toSorted((left, right) => left.localeCompare(right)),
      ).toEqual(['outbound', 'storage']);
      const entry = planner.catalogue.entries.find((candidate) => candidate.kind === 'schedule');
      if (!entry) throw new Error('Missing schedule');
      expect(
        planner
          .plan(entry.id)
          .boundary_binding_ids.toSorted((left, right) => left.localeCompare(right)),
      ).toEqual(['remote', 'storage']);
    });

    it('reports quarantine and exact source-ID misses without projecting recovery facts', () => {
      const { input, index, result } = fixture();
      const owner = index.nodes.find((node) => node.kind === 'METHOD' && node.symbol === 'tick');
      if (!owner) throw new Error('Missing scheduled owner');
      const ownerID = declarationSource(index, owner);
      const quarantined = { ...index, diagnostics: ['Synthetic parser failure'] };
      expect(missingEvidenceSourceIDs([quarantined], [ownerID, 'missing'])).toEqual([
        ownerID,
        'missing',
      ]);
      expect(
        bindingEvidence({ sources: [{ ...result.sources[0]!, index: quarantined }] }, [], [ownerID])
          .semantic,
      ).toEqual([]);
      const planner = createSpringEntryPlanner({ ...input, indexes: [quarantined] });
      expect(planner.catalogue.quarantined_paths).toEqual([index.path]);
      const entry = planner.catalogue.entries.find((candidate) => candidate.kind === 'schedule');
      if (!entry) throw new Error('Missing schedule');
      expect(
        planner
          .plan(entry.id)
          .frontiers.some((frontier) => frontier.kind === 'missing_declaration'),
      ).toBe(true);
    });
  },
);
