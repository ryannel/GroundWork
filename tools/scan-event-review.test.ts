import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';

import { consentSourceClauses } from './scan-event-review-consent';
import { eventReviewMutations } from './scan-event-review-mutations';
import { saveSourceClauses } from './scan-event-review-save';

vi.mock(import('server-only'), () => ({}));

function fixture(file: string, content: string) {
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
const COMPARISON = `class MarketingConsentEventService {
 boolean hasConsentInfoChanged(Customer previous, Individual individual) {
   if(previous == null) { return true; }
   Individual previousIndividual = previous.individual(Role.SIGNATORY);
   if(previousIndividual == null) { return true; }
   return !Objects.equals(individual.consentInfo(), previousIndividual.consentInfo())
     || !Objects.equals(individual.cdbId(), previousIndividual.cdbId());
 }
 MarketingConsentEventPayload buildPayload(Individual individual, String countryCode) {
   ConsentInfo consentInfo = individual.consentInfo();
   return new MarketingConsentEventPayload(individual.volvoId(), individual.cdbId(), countryCode,
     consentInfo.consentType(), consentInfo.consentGranted(), consentInfo.dateOfConsent(), consentInfo.contactPreferences());
 }
}`;
const POST = `class CustomerSavePostProcessor {
 CustomerEventService customerEventService;
 AnalyticsEventService analyticsEventService;
 AuditLogService auditLogService;
 MarketingConsentEventService marketingConsentEventService;
 void postProcess(Customer previousCustomer, Customer updatedCustomer) {
  customerEventService.publishCustomerEvent(previousCustomer, updatedCustomer);
  analyticsEventService.publishAnalyticsEvent(previousCustomer, updatedCustomer);
  auditLogService.saveCustomerAuditLog(updatedCustomer);
  marketingConsentEventService.publishEvent(previousCustomer, updatedCustomer);
 }
}
class Customer {}
class CustomerEventService { void publishCustomerEvent(Customer previous, Customer updated) {} }
class AnalyticsEventService { void publishAnalyticsEvent(Customer previous, Customer updated) {} }
class AuditLogService { void saveCustomerAuditLog(Customer customer) {} }
class MarketingConsentEventService { void publishEvent(Customer previous, Customer updated) {} }`;

const GUARDED_SEND = `class MarketingConsentEventService {
 void publishEvent(Customer previous, Customer updated) {
  if(kafkaTemplate == null || !eventSettings.enabled()) { return; }
  Individual individual = updated.individual(Role.SIGNATORY);
  if(individual == null || individual.cdbId() == null) { return; }
  if(individual.consentInfo() == null) { return; }
  if(!hasConsentInfoChanged(previous, individual)) { return; }
  Event event = eventBuilder.payload(buildPayload(individual, updated.market().getCountryCode())).build();
  Message message = kafkaEventPublisher.buildEventMessage(eventSettings.topicName(), updated.customerId(), event, VERSION, ECOM_CUSTOMER_SERVICE);
  kafkaEventPublisher.sendSafely(kafkaTemplate, message);
 }
}`;

describe.runIf(process.env.GROUNDWORK_NATIVE_PARSERS === '1')('frozen event source oracle', () => {
  it('requires saved result reaching values at both postprocessing and final return', () => {
    const baseline = fixture(
      'CustomerService',
      `class CustomerService {
      Customer saveAndPostProcess(Customer previousCustomer, Customer updatedCustomer) {
        updatedCustomer = customerRepository.save(updatedCustomer);
        savePostProcessor.postProcess(previousCustomer, updatedCustomer);
        return updatedCustomer;
      }
    }`,
    );
    expect(saveSourceClauses(baseline).savedValueRebinding).toBe(true);
    const overwritten = fixture(
      'CustomerService',
      `class CustomerService {
      Customer saveAndPostProcess(Customer previousCustomer, Customer updatedCustomer) {
        updatedCustomer = customerRepository.save(updatedCustomer);
        updatedCustomer = previousCustomer;
        savePostProcessor.postProcess(previousCustomer, updatedCustomer);
        return updatedCustomer;
      }
    }`,
    );
    expect(saveSourceClauses(overwritten).savedValueRebinding).toBe(false);
    for (const relation of ['reaching_value', 'assigned_value'] as const) {
      const changed = structuredClone(baseline);
      changed.semantic = changed.semantic.filter(
        (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
      );
      expect(saveSourceClauses(changed).savedValueRebinding).toBe(false);
    }
  });
  it('rejects a send attempted before otherwise intact consent guards', () => {
    expect(
      consentSourceClauses(fixture('MarketingConsentEventService', GUARDED_SEND)).orderedGuards,
    ).toBe(true);
    const moved = GUARDED_SEND.replace(
      'void publishEvent(Customer previous, Customer updated) {',
      'void publishEvent(Customer previous, Customer updated) { kafkaEventPublisher.sendSafely(kafkaTemplate, message);',
    );
    expect(consentSourceClauses(fixture('MarketingConsentEventService', moved)).orderedGuards).toBe(
      false,
    );
  });
  it('rejects payload construction before otherwise intact consent guards', () => {
    const moved = GUARDED_SEND.replace(
      'void publishEvent(Customer previous, Customer updated) {',
      'void publishEvent(Customer previous, Customer updated) { Event early = buildPayload(individual, updated.market().getCountryCode());',
    );
    expect(consentSourceClauses(fixture('MarketingConsentEventService', moved)).orderedGuards).toBe(
      false,
    );
  });
  it('never counts incomplete whole-question baselines as rejected mutations', () => {
    const incomplete = fixture('MarketingConsentEventService', COMPARISON);
    const mutations = eventReviewMutations(incomplete);
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.every((mutation) => !mutation.baselinePassed && !mutation.rejected)).toBe(
      true,
    );
    expect(mutations.some((mutation) => mutation.applied)).toBe(true);
  });
  it('requires both previous/current operands and the OR comparison while display remains unchanged', () => {
    const baseline = fixture('MarketingConsentEventService', COMPARISON);
    expect(consentSourceClauses(baseline).previousCurrentComparison).toBe(true);
    const changed = structuredClone(baseline);
    for (const node of changed.semantic) {
      if (node.kind === 'semantic_node' && node.operator === '||') node.operator = '&&';
    }
    expect(consentSourceClauses(changed).previousCurrentComparison).toBe(false);
    const missing = structuredClone(baseline);
    missing.bindings = missing.bindings.filter(
      (record) => record.kind !== 'java_value_binding' || record.relation !== 'reference',
    );
    expect(consentSourceClauses(missing).previousCurrentComparison).toBe(false);
  });
  it('rejects payload argument replacement without using display syntax', () => {
    const baseline = fixture('MarketingConsentEventService', COMPARISON);
    expect(consentSourceClauses(baseline).payloadConstruction).toBe(true);
    const changed = structuredClone(baseline);
    for (const node of changed.semantic) {
      if (
        node.kind === 'semantic_node' &&
        node.nodeKind === 'member' &&
        node.name === 'dateOfConsent'
      ) {
        node.name = 'consentGranted';
      }
    }
    expect(consentSourceClauses(changed).payloadConstruction).toBe(false);
  });
  it('requires postprocessor formal references and collaborator argument applications', () => {
    const baseline = fixture('CustomerSavePostProcessor', POST);
    expect(saveSourceClauses(baseline).localAttemptOrder).toBe(true);
    for (const relation of ['reference', 'argument_parameter'] as const) {
      const changed = structuredClone(baseline);
      changed.bindings = changed.bindings.filter(
        (record) => record.kind !== 'java_value_binding' || record.relation !== relation,
      );
      expect(saveSourceClauses(changed).localAttemptOrder).toBe(false);
    }
  });
  it('requires local invocation order rather than a collaborator name inventory', () => {
    const baseline = fixture('CustomerSavePostProcessor', POST);
    expect(saveSourceClauses(baseline).localAttemptOrder).toBe(true);
    const changed = structuredClone(baseline);
    for (const edge of changed.semantic) {
      if (edge.kind === 'semantic_edge' && edge.relation === 'statement') {
        edge.position = -(edge.position ?? 0);
      }
    }
    expect(saveSourceClauses(changed).localAttemptOrder).toBe(false);
  });
});
