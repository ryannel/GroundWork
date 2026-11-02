import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { SpringRouteBinding } from '@/domain/scan/scan.generated';
import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { extractLocalFacts } from '@/infrastructure/scan/local-facts';
import { indexSource } from '@/infrastructure/scan/source-index';
import { collectExceptionBindings } from '@/infrastructure/scan/spring-exception-bindings';
import { type SpringRoute, springRoutes } from '@/infrastructure/scan/spring-routes';

import { exceptionUpdateProof, type ExceptionReviewInput } from './scan-exception-review-native';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

function mutableRoute(route: SpringRoute): SpringRouteBinding {
  return {
    ...route,
    source_ids: [...route.source_ids],
    method: { ...route.method, parameter_types: [...route.method.parameter_types] },
    parameters: route.parameters.map((parameter) => ({
      ...parameter,
      validation_groups: [...parameter.validation_groups],
      json_views: [...parameter.json_views],
    })),
    documented_response_statuses: [...route.documented_response_statuses],
    response_json_views: [...route.response_json_views],
    request_validation_groups: [...route.request_validation_groups],
    security_binding_ids: [...route.security_binding_ids],
    schema_binding_ids: [...(route.schema_binding_ids ?? [])],
    uncertainties: [...route.uncertainties],
  };
}

function fixture(): ExceptionReviewInput {
  const files = [
    [
      'customer/CustomerService.java',
      `class CustomerService {
      Object updateIndividual(String individualId) { Customer originalCustomer = null;
        if (originalCustomer.individuals().stream().noneMatch(individual -> individual.id().equals(individualId))) {throw new IndividualNotFoundException(individualId);}
        return null; } }
      class IndividualNotFoundException extends RuntimeException {IndividualNotFoundException(String id) {}}`,
    ],
    [
      'impl/CustomerApiService.java',
      'class CustomerApiService {CustomerService customerService; Object updateIndividual(String id) {return customerService.updateIndividual(id);}}',
    ],
    [
      'impl/CustomerControllerImpl.java',
      '@RestController @RequestMapping("/v1/customers") class CustomerControllerImpl {CustomerApiService customerApiService; @PutMapping("/{customerId}/individual/{id}") Object updateIndividual(String id) {return customerApiService.updateIndividual(id);}}',
    ],
    [
      'common/Advice.java',
      '@ControllerAdvice class Advice extends Base {@ExceptionHandler(IndividualNotFoundException.class) @ResponseStatus(HttpStatus.NOT_FOUND) Object missing(IndividualNotFoundException e) {return response(HttpStatus.NOT_FOUND,e);}} class Base {Object response(HttpStatus status,IndividualNotFoundException e) {return e;}}',
    ],
  ] as const;
  const indexes = files.map(([path, content]) =>
    indexSource({
      path: `fixture/${path}`,
      language: 'java',
      content: `package fixture; import org.springframework.web.bind.annotation.*; ${content}`,
    }),
  );
  const units = indexes.flatMap((index) => {
    const unit = javaDeclarations(index);
    return unit ? [unit] : [];
  });
  const facts = indexes.map((index) =>
    extractLocalFacts(index, { host: 'host:server', repo: 'fixture/repo', commit: 'a'.repeat(40) }),
  );
  const document = {
    ...scanFixture(),
    sources: facts.flatMap((fact) => [...fact.sources]),
    summaries: facts.flatMap((fact) => [...fact.summaries]),
    semantic: facts.flatMap((fact) => [...(fact.semantic ?? [])]),
    framework: springRoutes(units).map(mutableRoute),
  };
  return {
    document,
    calls: collectJavaBindings(indexes, units).calls,
    values: collectJavaBindings(indexes, units).values,
    exceptions: collectExceptionBindings(indexes, units),
  };
}

describe.skipIf(!NATIVE)('independent Q05 native proof', () => {
  it('requires typed guard, throw, argument, return and interprocedural relations with display unchanged', () => {
    const input = fixture();
    expect(exceptionUpdateProof(input)).toMatchObject({ supported: true });
    for (const relation of [
      'condition',
      'callback',
      'consequent',
      'value',
      'argument',
      'receiver',
      'returns',
    ] as const) {
      const document = {
        ...input.document,
        semantic: (input.document.semantic ?? []).filter(
          (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
        ),
      };
      expect(exceptionUpdateProof({ ...input, document }).supported, relation).toBe(false);
    }
    for (const removed of input.calls.filter(
      (call) => call.resolution === 'exact' && call.methodName === 'updateIndividual',
    )) {
      expect(
        exceptionUpdateProof({
          ...input,
          calls: input.calls.filter((call) => call.id !== removed.id),
        }).supported,
      ).toBe(false);
    }
    expect(exceptionUpdateProof({ ...input, exceptions: [] }).supported).toBe(false);
    expect(
      exceptionUpdateProof({
        ...input,
        values: input.values.filter((value) => value.relation !== 'argument_parameter'),
      }).supported,
    ).toBe(false);
  });
});
