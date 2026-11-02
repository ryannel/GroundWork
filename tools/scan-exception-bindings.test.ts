import { describe, expect, it, vi } from 'vitest';

import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';
import { collectExceptionBindings } from '@/infrastructure/scan/spring-exception-bindings';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

function bind(source: string) {
  const index = indexSource({
    path: 'Fixture.java',
    language: 'java',
    content: `package fixture;
    import org.springframework.web.bind.annotation.*;
    class Missing extends RuntimeException { Missing(String id) {} }
    ${source}`,
  });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  return collectExceptionBindings([index], unit ? [unit] : []);
}

describe.skipIf(!NATIVE)('source exception to HTTP bindings', () => {
  it('binds typed throw, argument, membership guard and unique global advice with inherited body construction', () => {
    const bindings = bind(`
      class Service { void update(String id) { if (!contains(id)) throw new Missing(id); } }
      class Base { Object respond(String status, String message) { return external(status,message); } }
      @ControllerAdvice class Advice extends Base {
        @ExceptionHandler({Missing.class}) @ResponseStatus(HttpStatus.NOT_FOUND)
        Object missing(Missing error) { return respond(HttpStatus.NOT_FOUND,error.getMessage()); }
      }`);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toMatchObject({
      thrown_type: 'fixture.Missing',
      resolution: 'resolved',
      candidates: [{ scope: 'global', response_status: 'HttpStatus.NOT_FOUND' }],
    });
    expect(bindings[0]?.constructor_argument_source_ids).toHaveLength(1);
    expect(bindings[0]?.guard_source_ids).toHaveLength(1);
    expect(bindings[0]?.candidates[0]?.response_return_source_ids).toHaveLength(1);
    expect(bindings[0]?.candidates[0]?.response_construction_source_ids.length).toBeGreaterThan(1);
    const owners = bindings[0]?.candidates[0]?.response_construction_owners ?? [];
    expect(new Set(owners.map((entry) => entry.owner_method_source_id)).size).toBe(2);
    expect(owners.map((entry) => entry.source_id)).toEqual(
      bindings[0]?.candidates[0]?.response_construction_source_ids,
    );
  });
  it('keeps callback returns outside the handler return binding', () => {
    const result = bind(`class Service {void update(String id) {throw new Missing(id);}}
      @ControllerAdvice class Advice {@ExceptionHandler(Missing.class) Object missing(Missing e) {Supplier<Object> callback = () -> {return e;}; return null;}}`);
    expect(result[0]?.candidates[0]?.response_return_source_ids).toHaveLength(1);
  });
  it('retains ambiguous advice, scoped advice and catch propagation as unresolved', () => {
    for (const advice of [
      '@ControllerAdvice class A { @ExceptionHandler(Missing.class) Object missing(Missing e) {return e;} } @ControllerAdvice class B { @ExceptionHandler(Missing.class) Object missing(Missing e) {return e;} }',
      '@ControllerAdvice(basePackages="fixture") class A { @ExceptionHandler(Missing.class) Object missing(Missing e) {return e;} }',
    ]) {
      expect(
        bind(`class Service { void update(String id) {throw new Missing(id);} } ${advice}`)[0]
          ?.resolution,
      ).toBe('unresolved');
    }
    const caught =
      bind(`class Service {void update(String id) {try {throw new Missing(id);} catch (Missing e) {}}}
      @ControllerAdvice class A {@ExceptionHandler(Missing.class) Object missing(Missing e) {return e;}}`)[0];
    expect(caught?.resolution).toBe('unresolved');
    expect(caught?.enclosing_try_source_ids).toHaveLength(1);
  });
  it('does not accept fake namespaces, unresolved types, or display-only exception names', () => {
    expect(
      bind(`class Service {void update(String id) {String message="throw new Missing(id)";}}
      @ControllerAdvice class A {@ExceptionHandler(Missing.class) Object missing(Missing e) {return e;}}`),
    ).toEqual([]);
    expect(
      bind(`class Service {void update(String id) {throw new Missing(id);}}
      @custom.ControllerAdvice class A {@ExceptionHandler(Missing.class) Object missing(Missing e) {return e;}}`)[0]
        ?.resolution,
    ).toBe('unresolved');
  });
});
