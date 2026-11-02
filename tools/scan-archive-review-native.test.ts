import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { archiveQuestionProof } from './scan-archive-review';
import { archiveFlowClauses } from './scan-archive-review-flow';
import { archiveReviewMutations } from './scan-archive-review-mutations';
import { profileGraph } from './scan-profile-review-graph';

vi.mock(import('server-only'), () => ({}));

const SERVICE = `class CustomerArchiveService {
 CustomerService customerService; CustomerArchiveRepository customerArchiveRepository;
 void findAndArchiveCustomers(CustomerArchiveJobStatistics statistics) {
  customerService.getCustomersReadyForArchival().forEach((Customer customer) -> moveCustomerToArchivedCollection(customer, statistics));
 }
 private void moveCustomerToArchivedCollection(Customer customer, CustomerArchiveJobStatistics statistics) {
  try {
   customerArchiveRepository.upsertCustomerArchive(customer);
   customerService.deleteCustomer(customer.customerId());
   statistics.addExpired();
   log.info("done", customer.customerId());
  } catch(Exception e) {
   statistics.addFailed(); log.warn("failed", customer.customerId(), e);
  }
 }
}`;
const JOB = `class CustomerArchiveJob {
 CustomerArchiveService customerArchiveService;
 void start() {
  long startTime = System.currentTimeMillis();
  try {
   CustomerArchiveJobStatistics statistics = new CustomerArchiveJobStatistics();
   customerArchiveService.findAndArchiveCustomers(statistics);
   log.info("done", statistics.getNumberOfArchived(), statistics.getNumberOfFailed(), System.currentTimeMillis()-startTime);
  } catch(Exception exception) { log.error("error", System.currentTimeMillis()-startTime, exception); }
 }
}`;
const TYPES = `class Customer { String customerId() { return "id"; } }
class CustomerArchiveRepository { void upsertCustomerArchive(Customer customer) {} }
class CustomerService { Object getCustomersReadyForArchival() { return null; } void deleteCustomer(String id) {} }
`;

const STATS = `class CustomerArchiveJobStatistics {
 int numberOfArchived; int numberOfFailed;
 void addExpired() { numberOfArchived++; } void addFailed() { numberOfFailed++; }
 int getNumberOfArchived() { return numberOfArchived; } int getNumberOfFailed() { return numberOfFailed; }
}`;
const CONFIG = `class CustomerArchiveConfig {
 Object customerArchiveJobTaskExecutor() {
  ThreadPoolTaskExecutor taskExecutor = new ThreadPoolTaskExecutor();
  taskExecutor.setThreadPriority(Thread.MIN_PRIORITY);
  taskExecutor.setCorePoolSize(1); taskExecutor.setMaxPoolSize(1);
  taskExecutor.setThreadNamePrefix("AsyncThreadCustomerArchive-");
  return taskExecutor;
 }
}`;
function fixture(service = SERVICE, job = JOB, config = CONFIG) {
  const files = [
    ['CustomerArchiveService', service],
    ['CustomerArchiveJob', job],
    ['Types', TYPES],
    ['CustomerArchiveJobStatistics', STATS],
    ['CustomerArchiveConfig', config],
  ];
  const indexes = files.map(([name = '', content = '']) =>
    indexSource({
      path: `src/${name}.java`,
      language: 'java',
      content: `package example; ${content}`,
      ...(process.env.GROUNDWORK_TEST_JAVA === undefined
        ? {}
        : { java: process.env.GROUNDWORK_TEST_JAVA }),
    }),
  );
  expect(indexes.flatMap((index) => index.diagnostics)).toEqual([]);
  const units = indexes.flatMap((index) => {
    const unit = javaDeclarations(index);
    return unit ? [unit] : [];
  });
  const facts = indexes.map((index) =>
    extractLocalFacts(index, { host: 'host:test', repo: 'fixture/repo', commit: 'a'.repeat(40) }),
  );
  const bindings = collectJavaBindings(indexes, units);
  return {
    ...scanFixture(),
    sources: facts.flatMap((fact) => fact.sources),
    semantic: facts.flatMap((fact) => fact.semantic ?? []),
    bindings: [
      ...bindings.calls.map((call) => ({
        ...call,
        argumentTypes: [...call.argumentTypes],
        guards: [...call.guards],
      })),
      ...bindings.values.map((value) => ({ ...value, guards: [...value.guards] })),
    ],
  };
}

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'archival failure source oracle',
  () => {
    it('requires typed per-customer catch, ordered operations and shared iteration statistics', () => {
      const document = fixture();
      expect(archiveFlowClauses(profileGraph(document))).toEqual({
        perCustomerCatchAndOrder: true,
        iterationCustomerStatisticsLineage: true,
        outerJobFailureAndStatistics: true,
      });
    });
    it('rejects delete before archive and a narrowed per-customer catch', () => {
      const reversed = SERVICE.replace(
        'customerArchiveRepository.upsertCustomerArchive(customer);\n   customerService.deleteCustomer(customer.customerId());',
        'customerService.deleteCustomer(customer.customerId());\n   customerArchiveRepository.upsertCustomerArchive(customer);',
      );
      expect(archiveFlowClauses(profileGraph(fixture(reversed))).perCustomerCatchAndOrder).toBe(
        false,
      );
      expect(
        archiveFlowClauses(
          profileGraph(
            fixture(SERVICE.replace('catch(Exception e)', 'catch(IllegalStateException e)')),
          ),
        ).perCustomerCatchAndOrder,
      ).toBe(false);
    });
    it('rejects lost callback or formal references while display text remains unchanged', () => {
      const baseline = fixture();
      for (const relation of ['callback', 'parameter', 'catch'] as const) {
        const document = structuredClone(baseline);
        document.semantic = document.semantic.filter(
          (entry) => entry.kind !== 'semantic_edge' || entry.relation !== relation,
        );
        expect(Object.values(archiveFlowClauses(profileGraph(document))).every(Boolean)).toBe(
          false,
        );
      }
    });
    it('rejects an iteration callback with an earlier return before the archive helper', () => {
      const skipped = SERVICE.replace(
        '-> moveCustomerToArchivedCollection(customer, statistics)',
        '-> { if (skip) return; moveCustomerToArchivedCollection(customer, statistics); }',
      );
      expect(
        archiveFlowClauses(profileGraph(fixture(skipped))).iterationCustomerStatisticsLineage,
      ).toBe(false);
    });
    it('requires the returned executor to keep its declared pool bound', () => {
      expect(archiveQuestionProof(fixture()).clauses.singleWorkerExecutor).toBe(true);
      const overridden = CONFIG.replace(
        'return taskExecutor;',
        'taskExecutor.setMaxPoolSize(2); return taskExecutor;',
      );
      expect(
        archiveQuestionProof(fixture(SERVICE, JOB, overridden)).clauses.singleWorkerExecutor,
      ).toBe(false);
    });
    it('does not count an incomplete whole-question baseline as a rejected mutation', () => {
      const mutations = archiveReviewMutations(fixture());
      expect(mutations.some((entry) => entry.applied)).toBe(true);
      expect(mutations.every((entry) => !entry.baselinePassed && !entry.rejected)).toBe(true);
    });
  },
);
