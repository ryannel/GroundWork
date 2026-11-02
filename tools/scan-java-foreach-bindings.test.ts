import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({
    path: 'Fixture.java',
    language: 'java',
    content,
    ...(process.env.GROUNDWORK_TEST_JAVA === undefined
      ? {}
      : { java: process.env.GROUNDWORK_TEST_JAVA }),
  });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected Java declarations');
  return { ...collectJavaBindings([index], [unit]), unit };
}

describe.skipIf(process.env.GROUNDWORK_NATIVE_PARSERS !== '1')(
  'typed collection iteration bindings',
  () => {
    it('joins collection-return elements and captured statistics to private helper formals', () => {
      const result = extract(`package fixture; import java.util.List; import java.util.Set;
      class Customer {} class Statistics {} class App {
        List<Customer> customers() { return null; }
        private void archive(Customer customer, Statistics statistics) {}
        void run(Statistics statistics, Set<? extends Customer> others) {
          customers().forEach(customer -> archive(customer, statistics));
          others.forEach(customer -> archive(customer, statistics));
          customers().stream().forEach(customer -> archive(customer, statistics));
        }
      }`);
      const calls = result.calls.filter((call) => call.methodName === 'archive');
      expect(calls).toHaveLength(3);
      expect(calls.every((call) => call.resolution === 'exact')).toBe(true);
      expect(calls.map((call) => call.argumentTypes)).toEqual(
        Array.from({ length: 3 }, () => ['fixture.Customer', 'fixture.Statistics']),
      );
      const formals = result.unit.types
        .find((type) => type.name === 'App')
        ?.methods.find((method) => method.name === 'archive')
        ?.parameters.map((parameter) => parameter.source);
      for (const call of calls) {
        expect(
          result.values
            .filter((value) => value.relation === 'argument_parameter' && value.call === call.call)
            .map((value) => value.to),
        ).toEqual(formals);
      }
      expect(
        result.calls
          .filter((call) => call.methodName === 'forEach')
          .every((call) => call.resolution === 'unresolved'),
      ).toBe(true);
    });

    it('keeps unknown, lower-bounded, raw, custom and unsupported iterator types unresolved', () => {
      const result = extract(`package fixture; import java.util.List;
      class Customer {} class Custom { void forEach(Object fn) {} }
      class App {
        void archive(Customer customer) {}
        void run(List<?> unknown, List<? super Customer> lower, List raw, Custom custom, List<Customer> typed) {
          unknown.forEach(customer -> archive(customer));
          lower.forEach(customer -> archive(customer));
          raw.forEach(customer -> archive(customer));
          custom.forEach(customer -> archive(customer));
          typed.parallelStream().forEach(customer -> archive(customer));
          typed.forEach(customer -> archive(customer), 1);
          archive(customer);
        }
      }`);
      const calls = result.calls.filter((call) => call.methodName === 'archive');
      expect(calls).toHaveLength(7);
      expect(calls.every((call) => call.resolution === 'unresolved')).toBe(true);
      expect(calls.every((call) => call.argumentTypes[0] === null)).toBe(true);
    });
  },
);
