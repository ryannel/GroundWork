import { describe, expect, it, vi } from 'vitest';

import { collectJavaBindings } from '@/infrastructure/scan/java-call-bindings';
import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';
import { collectAsyncBindings } from '@/infrastructure/scan/spring-async-bindings';
import { collectScheduleBindings } from '@/infrastructure/scan/spring-schedule-bindings';

vi.mock(import('server-only'), () => ({}));

function extract(content: string) {
  const index = indexSource({
    path: 'src/main/java/Example.java',
    language: 'java',
    content,
    ...(process.env.GROUNDWORK_TEST_JAVA === undefined
      ? {}
      : { java: process.env.GROUNDWORK_TEST_JAVA }),
  });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Expected parsed Java');
  const input = { indexes: [index], units: [unit], ...collectJavaBindings([index], [unit]) };
  const async = collectAsyncBindings(input).filter((entry) => entry.kind === 'async_binding');
  return { input, async, bindings: collectScheduleBindings({ ...input, async_bindings: async }) };
}

const IMPORTS = `import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.EnableScheduling;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import net.javacrumbs.shedlock.core.LockProvider;
`;

describe.skipIf(process.env.GROUNDWORK_NATIVE_PARSERS !== '1')('source schedule bindings', () => {
  it('retains raw schedule, lock, activation and scoped conditions without evaluating them', () => {
    const { bindings } = extract(`${IMPORTS}
      @EnableScheduling @EnableSchedulerLock(defaultLockAtMostFor="PT25S") class Config {
        @Bean LockProvider lockProvider() { return null; }
      }
      @ConditionalOnProperty(prefix="archive",value="enabled",havingValue="true") class Timer {
        @Scheduled(cron="\u0024{archive.cron}")
        @SchedulerLock(name="archive",lockAtLeastFor="\u0024{archive.lock}")
        @ConditionalOnBean(Config.class) void run() {}
      }`);
    expect(bindings).toHaveLength(1);
    const binding = bindings[0];
    expect(binding?.annotations.map((entry) => entry.annotation_type)).toEqual([
      'org.springframework.scheduling.annotation.Scheduled',
      'net.javacrumbs.shedlock.spring.annotation.SchedulerLock',
    ]);
    expect(binding?.annotations[0]?.arguments).toEqual([
      { name: 'cron', expression: `"\${archive.cron}"` },
    ]);
    expect(binding?.activation_declarations[1]?.arguments).toEqual([
      { name: 'defaultLockAtMostFor', expression: '"PT25S"' },
    ]);
    expect(binding?.conditions).toHaveLength(2);
    expect(binding?.conditions[0]?.owner_source).toBe(binding?.owner_source);
    expect(binding?.conditions[1]?.owner_source).toBe(binding?.source);
    expect(binding?.lock_provider_sources).toHaveLength(1);
    expect(binding?.activation).toBe('declared_runtime_unverified');
  });

  it('joins the immediate async invocation and excludes lambda and nested class owners', () => {
    const { bindings, async } = extract(`${IMPORTS}
      @org.springframework.scheduling.annotation.EnableAsync class Config {
        @Bean org.springframework.core.task.AsyncTaskExecutor one() { return null; }
      }
      @ConditionalOnBean(Timer.class) class Worker { @Async("one") void work() {} }
      class Timer { Worker worker; @Scheduled(fixedDelay=1000) void run() {
        worker.work(); Runnable deferred=()->worker.work();
        class Nested { void call() { worker.work(); } }
      } }`);
    expect(async[0]?.invocations).toHaveLength(2);
    expect(async[0]?.executor_sources).toHaveLength(1);
    expect(async[0]?.activation_sources).toHaveLength(1);
    expect(async[0]?.conditions[0]?.annotation_type).toBe(
      'org.springframework.boot.autoconfigure.condition.ConditionalOnBean',
    );
    expect(bindings[0]?.async_invocations).toHaveLength(1);
    expect(bindings[0]?.call_binding_ids).toHaveLength(1);
    expect(bindings[0]?.async_invocations[0]).toEqual({
      ...async[0]?.invocations[0],
      async_binding_id: async[0]?.id,
    });
    expect(bindings[0]?.async_invocations[0]?.dispatch).toBe('receiver_proxy_unverified');
    expect(bindings[0]?.async_invocations[0]?.use).toBe('ignored');
    expect(bindings[0]?.lock_scope).toBe('scheduled_invocation_only_async_completion_unverified');
  });

  it('preserves direct self dispatch without asserting an async lock extension', () => {
    const { bindings } = extract(`${IMPORTS} class Timer {
      @Async void work() {}
      @Scheduled(fixedRate=500) @SchedulerLock(name="one") void run() { this.work(); }
    }`);
    expect(bindings[0]?.async_invocations[0]?.dispatch).toBe('direct_self');
    expect(bindings[0]?.gaps.some((gap) => gap.includes('global concurrency'))).toBe(true);
  });

  it('rejects familiar annotations and providers from unrelated packages', () => {
    const wrong = extract(
      `import other.Scheduled; class Timer { @Scheduled(cron="*") void run() {} }`,
    );
    expect(wrong.bindings).toEqual([]);
    const { bindings } = extract(`import other.EnableScheduling; import other.EnableSchedulerLock;
      import other.LockProvider; import other.Bean; import other.SchedulerLock;
      @EnableScheduling @EnableSchedulerLock class Config { @Bean LockProvider lock() { return null; } }
      class Timer { @org.springframework.scheduling.annotation.Scheduled(fixedDelay=1)
        @SchedulerLock(name="one") void run() {} }`);
    expect(bindings[0]?.annotations).toHaveLength(1);
    expect(bindings[0]?.activation_declarations).toEqual([]);
    expect(bindings[0]?.lock_provider_sources).toEqual([]);
  });

  it('leaves inherited and external providers unresolved and ignores unannotated overrides', () => {
    const { bindings } = extract(`${IMPORTS}
      class Parent { @Scheduled(fixedDelay=1) void run() {} }
      class Child extends Parent { void run() {} }
      class CustomProvider implements LockProvider {}
      class Config extends ExternalConfig { @Bean CustomProvider lock() { return null; } }`);
    expect(bindings).toHaveLength(1);
    expect(bindings[0]?.owner_type).toBe('Parent');
    expect(bindings[0]?.lock_provider_sources).toEqual([]);
    expect(bindings[0]?.completeness).toBe('partial');
    expect(bindings[0]?.gaps.some((gap) => gap.includes('inherited'))).toBe(true);
  });
});
