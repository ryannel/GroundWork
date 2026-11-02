import 'server-only';

import {
  resolveJavaType,
  type JavaAnnotation,
  type JavaMethod,
  type JavaType,
} from './java-declarations';
import type { OutboundInput } from './spring-outbound-provenance';
import type { ScheduleDeclaration } from './spring-schedule-types';

const SCHEDULED = 'org.springframework.scheduling.annotation.Scheduled';
const LOCK = 'net.javacrumbs.shedlock.spring.annotation.SchedulerLock';
const ENABLE = 'org.springframework.scheduling.annotation.EnableScheduling';
const ENABLE_LOCK = 'net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock';

function declaration(
  owner: { readonly source: string },
  annotation: JavaAnnotation,
): ScheduleDeclaration | null {
  const annotationType = annotation.name;
  if (
    annotationType !== SCHEDULED &&
    annotationType !== LOCK &&
    annotationType !== ENABLE &&
    annotationType !== ENABLE_LOCK
  ) {
    return null;
  }
  return {
    source: annotation.source,
    owner_source: owner.source,
    annotation_type: annotationType,
    arguments: Object.entries(annotation.arguments).map(([name, expression]) => ({
      name,
      expression,
    })),
  };
}

export function scheduleDeclarations(
  owner: Pick<JavaType | JavaMethod, 'source' | 'annotations'>,
): readonly ScheduleDeclaration[] {
  return owner.annotations.flatMap((annotation) => {
    const entry = declaration(owner, annotation);
    return entry === null ? [] : [entry];
  });
}

/** Nominal @Bean return types are candidates, including no claim about inherited providers. */
export function scheduleProviders(input: OutboundInput): readonly string[] {
  return input.units.flatMap((unit) =>
    unit.types
      .flatMap((owner) => owner.methods)
      .filter(
        (method) =>
          method.annotations.some(
            (entry) => entry.name === 'org.springframework.context.annotation.Bean',
          ) &&
          resolveJavaType(method.returnType, unit) === 'net.javacrumbs.shedlock.core.LockProvider',
      )
      .map((method) => method.source),
  );
}

export function scheduleActivation(input: OutboundInput): readonly ScheduleDeclaration[] {
  return input.units.flatMap((unit) =>
    unit.types.flatMap((owner) =>
      scheduleDeclarations(owner).filter(
        (entry) => entry.annotation_type === ENABLE || entry.annotation_type === ENABLE_LOCK,
      ),
    ),
  );
}
