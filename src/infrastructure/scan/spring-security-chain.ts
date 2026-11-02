import 'server-only';

import {
  type JavaInvocation,
  type JavaMethod,
  type JavaType,
  type JavaUnit,
  resolveJavaType,
} from './java-declarations';

export interface SpringEnforcementStep {
  readonly stage: string;
  readonly source_ids: readonly string[];
  readonly detail: string;
}
interface BoundMethod {
  readonly type: JavaType;
  readonly method: JavaMethod;
}

function target(
  call: JavaInvocation,
  owner: JavaType,
  units: readonly JavaUnit[],
): JavaType | undefined {
  const segments = call.callee.replaceAll(/\s/gu, '').split('.');
  if (segments.length === 1 || (segments.length === 2 && segments[0] === 'this')) return owner;
  if (segments.length !== 2) return undefined;
  const field = owner.fields.find((entry) => entry.name === segments[0]);
  const unit = units.find((entry) => entry.types.includes(owner));
  if (!field || !unit) return undefined;
  const name = resolveJavaType(field.type, unit);
  return units.flatMap((entry) => entry.types).find((entry) => entry.qualifiedName === name);
}

function bound(
  call: JavaInvocation,
  owner: JavaType,
  units: readonly JavaUnit[],
): BoundMethod | undefined {
  const type = target(call, owner, units);
  const name = call.callee.replaceAll(/\s/gu, '').split('.').at(-1);
  const methods =
    type?.methods.filter(
      (method) => method.name === name && method.parameters.length === call.arguments.length,
    ) ?? [];
  if (!type || methods.length !== 1 || !methods[0]) return undefined;
  return { type, method: methods[0] };
}

/** Only unique local signatures are followed; external receivers and ambiguous overloads remain frontiers. */
export function springEnforcementChain(
  start: BoundMethod,
  units: readonly JavaUnit[],
): readonly SpringEnforcementStep[] {
  const steps: SpringEnforcementStep[] = [];
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.shift() ?? start;
    if (visited.has(current.method.source)) continue;
    visited.add(current.method.source);
    for (const call of current.method.calls ?? []) {
      const destination = bound(call, current.type, units);
      if (destination) {
        steps.push({
          stage: call.conditional ? 'conditional_source_call' : 'source_call',
          source_ids: [call.source, destination.method.source],
          detail: `${current.type.qualifiedName}.${current.method.name} calls ${destination.type.qualifiedName}.${destination.method.name}; runtime dispatch is unobserved.`,
        });
        pending.push(destination);
      }
    }
  }
  return steps;
}
