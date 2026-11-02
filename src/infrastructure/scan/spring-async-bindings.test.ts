import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from './java-call-bindings';
import { javaDeclarations } from './java-declarations';
import { indexSource } from './source-index';
import { collectAsyncBindings } from './spring-async-bindings';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({ path: 'src/main/java/Example.java', language: 'java', content });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected parsed Java');
  const input = {
    indexes: [index],
    units: [unit],
    selected_owner_sources: unit.types.flatMap((type) =>
      type.methods.map((method) => method.source),
    ),
    ...collectJavaBindings([index], [unit]),
  };
  return { index, input, bindings: collectAsyncBindings(input) };
}
const IMPORTS = `import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.context.annotation.Bean;
import java.util.concurrent.Executor;
import java.util.concurrent.CompletableFuture;
`;

describe('source async execution bindings', () => {
  it('joins exact async targets to source result use and retains declaration uncertainty', () => {
    const { bindings } = extract(`${IMPORTS}
      @EnableAsync class Config { @Bean Executor executor() { return null; } }
      class Worker { @Async("executor") CompletableFuture<Void> work(String id) { return null; } }
      class Caller {
        Worker worker;
        void call(String id) { worker.work(id); }
        Object returned(String id) { return worker.work(id); }
        void deferred(String id) { Runnable task = () -> worker.work(id); }
      }`);
    const async = bindings.find((entry) => entry.kind === 'async_binding');
    expect(async).toMatchObject({
      executor: 'executor',
      completion: 'future',
      activation: 'declared_runtime_unverified',
    });
    expect(async?.activation_sources).toHaveLength(1);
    expect(async?.executor_sources).toHaveLength(1);
    expect(async?.invocations.map((entry) => entry.use)).toEqual([
      'ignored',
      'returned',
      'unknown',
    ]);
    expect(
      async?.invocations.every((entry) => entry.dispatch === 'receiver_proxy_unverified'),
    ).toBe(true);
    expect(async?.invocations[2]?.owner_source).not.toBe(async?.invocations[0]?.owner_source);
  });

  it('keeps self invocation direct and distinguishes bound and immediate joined results', () => {
    const { bindings } = extract(`${IMPORTS}class Worker {
      @Async CompletableFuture<Void> work() { return null; }
      void self() { work(); this.work(); var future=work(); work().join(); }
    }`);
    const async = bindings.find((entry) => entry.kind === 'async_binding');
    expect(async?.invocations.map((entry) => entry.use)).toEqual([
      'ignored',
      'ignored',
      'bound',
      'joined',
    ]);
    expect(async?.invocations.every((entry) => entry.dispatch === 'direct_self')).toBe(true);
  });

  it('excludes deferred returns, throws and catches from enclosing execution ownership', () => {
    const { bindings, index } = extract(`${IMPORTS}
      import org.springframework.transaction.annotation.Transactional;
      class Worker {
        @Transactional Object work() {
          Runnable task=()->{ try { throw new Error(); } catch(Error e) { throw e; } finally { clean(); } };
          try { return task; } catch(RuntimeException e) { throw e; } finally { clean(); }
        }
        void clean() {}
      }`);
    const execution = bindings
      .filter((entry) => entry.kind === 'execution_binding')
      .find((entry) => entry.transaction_sources.length > 0);
    expect(execution).toMatchObject({
      transaction: 'declared_runtime_unverified',
      failure: 'source_paths_only',
    });
    expect(execution?.return_sources).toHaveLength(1);
    expect(execution?.throw_sources).toHaveLength(1);
    expect(execution?.catch_sources).toHaveLength(1);
    expect(execution?.finally_sources).toHaveLength(1);
    const method = index.nodes.find((entry) => entry.kind === 'METHOD' && entry.symbol === 'work');
    expect(method).toBeDefined();
    expect(execution?.call_results).toHaveLength(1);
  });

  it('rejects wrong annotations and future types with familiar names', () => {
    const { bindings } = extract(`import other.Async; import other.EnableAsync;
      import other.CompletableFuture; @EnableAsync class Worker {
        @Async CompletableFuture work() { return null; }
      }`);
    expect(bindings.filter((entry) => entry.kind === 'async_binding')).toEqual([]);
    const wrongFuture = extract(`import org.springframework.scheduling.annotation.Async;
      import other.CompletableFuture; class Worker { @Async CompletableFuture work() { return null; } }`);
    expect(wrongFuture.bindings.find((entry) => entry.kind === 'async_binding')?.completion).toBe(
      'unknown',
    );
  });

  it('accepts fully qualified Spring declarations while excluding unselected execution owners', () => {
    const { input } = extract(`class Worker {
      @org.springframework.scheduling.annotation.Async void async() {}
      void ordinary() {}
    }`);
    const bindings = collectAsyncBindings({
      indexes: input.indexes,
      units: input.units,
      calls: input.calls,
      values: input.values,
    });
    expect(bindings.filter((entry) => entry.kind === 'async_binding')).toHaveLength(1);
    expect(bindings.filter((entry) => entry.kind === 'execution_binding')).toHaveLength(1);
  });

  it('does not equate a familiar join name on an unrelated result type with future observation', () => {
    const { bindings } = extract(`import org.springframework.scheduling.annotation.Async;
      class Result { void join() {} }
      class Worker { @Async Result work() { return null; } void call() { work().join(); } }`);
    const async = bindings.find((entry) => entry.kind === 'async_binding');
    expect(async?.completion).toBe('unknown');
    expect(async?.invocations[0]?.use).toBe('unknown');
  });

  it('requires an actual zero-argument invocation to observe an immediate future join', () => {
    const { bindings } = extract(`${IMPORTS}class Worker {
      @Async CompletableFuture<Void> work() { return null; }
      void call() { Object member=work().join; work().join(42); work().join(); }
    }`);
    const async = bindings.find((entry) => entry.kind === 'async_binding');
    expect(async?.invocations.map((entry) => entry.use)).toEqual(['unknown', 'unknown', 'joined']);
  });

  it('retains save return rebinding using shared values without claiming persistence completion', () => {
    const { bindings, input } =
      extract(`class Customer {} class Repository { Customer save(Customer c) { return c; } }
      class Worker { Repository repository; Customer save(Customer c) { c=repository.save(c); return c; } }`);
    const execution = bindings
      .filter((entry) => entry.kind === 'execution_binding')
      .find((entry) => entry.call_results.length > 0);
    expect(execution?.call_results[0]?.use).toBe('bound');
    const values = input.values.filter(
      (entry) => execution?.value_binding_ids.includes(entry.id) === true,
    );
    expect(values.some((entry) => entry.relation === 'assignment')).toBe(true);
    expect(values.some((entry) => entry.relation === 'return_call')).toBe(true);
    expect(execution?.completion).toBe('source_returns_only');
  });
});
