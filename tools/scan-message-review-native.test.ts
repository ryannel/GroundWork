import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { messageContractClauses } from './scan-message-review-contracts';
import {
  messageBranches,
  messageBoundary,
  messageCall,
  messageLocal,
  messageMethod,
} from './scan-message-review-graph';
import { messageReviewMutations } from './scan-message-review-mutations';
import { profileGraph } from './scan-profile-review-graph';

vi.mock(import('server-only'), () => ({}));

function fixture(content: string, file = 'CustomerEventService') {
  const index = indexSource({ path: `src/${file}.java`, language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const facts = extractLocalFacts(index, {
    host: 'host:test',
    repo: 'fixture/repo',
    commit: 'a'.repeat(40),
  });
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Missing declaration');
  const bindings = collectJavaBindings([index], [unit]);
  return {
    ...scanFixture(),
    sources: [...facts.sources],
    semantic: [...(facts.semantic ?? [])],
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
const SOURCE = `class CustomerEventService {
 int getEventType(Customer previous, Customer updated) {
  if(previous == null) { return CustomerEventType.CUSTOMER_CREATED; }
  else if(updated.archivalData() != null) { return CustomerEventType.CUSTOMER_ARCHIVED; }
  else { return CustomerEventType.CUSTOMER_UPDATED; }
 }
 int publish(Customer previous, Customer updated) {
  int eventType = getEventType(previous, updated);
  return eventType;
 }
}
class Customer { Object archivalData(){ return null; } }
class CustomerEventType { static int CUSTOMER_CREATED; static int CUSTOMER_ARCHIVED; static int CUSTOMER_UPDATED; }`;
const VALUES = [
  'CustomerEventType.CUSTOMER_CREATED',
  'CustomerEventType.CUSTOMER_ARCHIVED',
  'CustomerEventType.CUSTOMER_UPDATED',
] as const;

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')(
  'frozen customer messaging source oracle',
  () => {
    it('requires complete ordered event selection and enum member values with intact display', () => {
      const baseline = fixture(SOURCE);
      expect(
        messageBranches(profileGraph(baseline), ['CustomerEventService', 'getEventType'], VALUES),
      ).toBe(true);
      const changed = structuredClone(baseline);
      for (const node of changed.semantic) {
        if (
          node.kind === 'semantic_node' &&
          node.nodeKind === 'member' &&
          node.name === 'CUSTOMER_ARCHIVED'
        ) {
          node.name = 'CUSTOMER_UPDATED';
        }
      }
      expect(
        messageBranches(profileGraph(changed), ['CustomerEventService', 'getEventType'], VALUES),
      ).toBe(false);
      for (const relation of ['condition', 'otherwise', 'returns'] as const) {
        const removed = structuredClone(baseline);
        removed.semantic = removed.semantic.filter(
          (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
        );
        expect(
          messageBranches(profileGraph(removed), ['CustomerEventService', 'getEventType'], VALUES),
        ).toBe(false);
      }
    });
    it('requires actual/formal application to the exact helper rather than a matching call name', () => {
      const baseline = fixture(SOURCE);
      const graph = profileGraph(baseline);
      const caller = messageMethod(graph, ['CustomerEventService', 'publish']);
      const call = messageCall(graph, caller, 'getEventType(previous,updated)');
      const target = messageMethod(graph, ['CustomerEventService', 'getEventType']);
      expect(messageBoundary(graph, call, target)).toBe(true);
      const changed = structuredClone(baseline);
      changed.bindings = changed.bindings.filter(
        (record) =>
          record.kind !== 'java_value_binding' || record.relation !== 'argument_parameter',
      );
      const broken = profileGraph(changed);
      expect(messageBoundary(broken, call, target)).toBe(false);
      expect(messageLocal(graph, caller)).toBe(true);
      changed.bindings = changed.bindings.filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== 'reference',
      );
      expect(messageLocal(profileGraph(changed), caller)).toBe(false);
    });
    it('rejects a later overwrite of the event selector result', () => {
      const changed = fixture(
        SOURCE.replace('return eventType;', 'eventType = 0; return eventType;'),
      );
      const graph = profileGraph(changed);
      expect(messageLocal(graph, messageMethod(graph, ['CustomerEventService', 'publish']))).toBe(
        false,
      );
    });
    it('never scores destructive mutations against an incomplete whole-question baseline', () => {
      const attempts = messageReviewMutations(fixture(SOURCE));
      expect(attempts.length).toBeGreaterThan(20);
      expect(attempts.every((attempt) => !attempt.baselinePassed && !attempt.rejected)).toBe(true);
      expect(attempts.some((attempt) => attempt.applied)).toBe(true);
    });
    it('requires each role callback on its actual source collection', () => {
      const source = `class AnalyticsIndividualMapper {
        AnalyticsIndividual to(Individual individual) {
          return new AnalyticsIndividual(individual.id(),
            individual.emails() != null ? individual.emails().stream().flatMap(email -> email.emailRoles().stream()).collect(Collectors.toSet()) : Set.of(),
            individual.phoneNumbers() != null ? individual.phoneNumbers().stream().flatMap(phone -> phone.phoneRoles().stream()).collect(Collectors.toSet()) : Set.of(),
            individual.addresses() != null ? individual.addresses().stream().flatMap(address -> address.addressRoles().stream()).collect(Collectors.toSet()) : Set.of(),
            individual.roles(),individual.cdbId(),individual.cdbTcId(),individual.volvoId(),individual.entraId(),individual.useOrgAddress(),individual.contactPreferences(),individual.dateOfConsent(),individual.consentInfo());
        }
      }`;
      const baseline = fixture(source, 'AnalyticsIndividualMapper');
      expect(messageContractClauses(baseline).analyticsIndividualMapping).toBe(true);
      const wrong = fixture(
        source.replace('email.emailRoles()', 'email.phoneRoles()'),
        'AnalyticsIndividualMapper',
      );
      expect(messageContractClauses(wrong).analyticsIndividualMapping).toBe(false);
      const detached = structuredClone(baseline);
      detached.semantic = detached.semantic.filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== 'callback',
      );
      expect(messageContractClauses(detached).analyticsIndividualMapping).toBe(false);
    });
    it('selects collection overloads by native parameter type after bounded record reordering', () => {
      const individual = fixture(
        `class AnalyticsIndividualMapper {
        List<AnalyticsIndividual> to(List<Individual> individuals) {
          if(individuals == null) { return List.of(); }
          return individuals.stream().map(this::to).toList();
        }
        AnalyticsIndividual to(Individual individual) { return null; }
      }`,
        'AnalyticsIndividualMapper',
      );
      const corporate = fixture(
        `class AnalyticsCorporateEntityMapper {
        List<AnalyticsCorporateEntity> to(List<CorporateEntity> corporateEntities) {
          if(corporateEntities == null) { return List.of(); }
          return corporateEntities.stream().map(this::to).toList();
        }
        AnalyticsCorporateEntity to(CorporateEntity corporateEntity) { return null; }
      }`,
        'AnalyticsCorporateEntityMapper',
      );
      const document = {
        ...individual,
        sources: [...individual.sources, ...corporate.sources],
        semantic: [...individual.semantic, ...corporate.semantic],
        bindings: [...individual.bindings, ...corporate.bindings],
      };
      expect(messageContractClauses(document).analyticsCollectionMapping).toBe(true);
      document.semantic = document.semantic.toSorted((left, right) =>
        left.id.localeCompare(right.id),
      );
      expect(messageContractClauses(document).analyticsCollectionMapping).toBe(true);
      for (const node of document.semantic) {
        if (
          node.kind === 'semantic_node' &&
          node.nodeKind === 'type' &&
          node.name === 'List<CorporateEntity>'
        ) {
          node.name = 'List<Individual>';
        }
      }
      expect(messageContractClauses(document).analyticsCollectionMapping).toBe(false);
    });
  },
);
