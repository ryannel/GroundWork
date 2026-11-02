import type { LocalSummary, Operation } from '@/domain/scan/scan.generated';

export interface DepthResult {
  readonly id: string;
  readonly status: 'supported' | 'unresolved' | 'failed';
  readonly evidence: readonly string[];
  readonly reason: string;
}
export interface DepthContext {
  readonly id: string;
  readonly summary: LocalSummary | undefined;
}
export type Call = Extract<Operation, { readonly kind: 'call' }>;
export const compact = (value: string): string => value.replaceAll(/\s+/gu, '');

export function result(
  context: DepthContext,
  status: DepthResult['status'],
  detail: { readonly evidence: readonly Operation[]; readonly reason: string },
): DepthResult {
  return {
    id: context.id,
    status,
    evidence: detail.evidence.map((operation) => operation.id),
    reason: detail.reason,
  };
}
export function unresolved(
  context: DepthContext,
  reason: string,
  evidence: readonly Operation[] = [],
): DepthResult {
  return result(context, 'unresolved', { evidence, reason });
}
export function call(context: DepthContext, callee: string): Call | undefined {
  return context.summary?.operations.find(
    (operation): operation is Call =>
      operation.kind === 'call' && compact(operation.callee) === compact(callee),
  );
}
export function argumentsMatch(operation: Call, expected: readonly string[]): boolean {
  return (
    operation.arguments.length === expected.length &&
    operation.arguments.every(
      (argument, index) => compact(argument) === compact(expected[index] ?? ''),
    )
  );
}
export function ordered(context: DepthContext, operations: readonly Operation[]): boolean {
  const positions = operations.map(
    (operation) => context.summary?.operations.indexOf(operation) ?? -1,
  );
  return positions.every(
    (position, index) => position >= 0 && (index === 0 || position > (positions[index - 1] ?? -1)),
  );
}
export function returnsValue(operation: Operation | undefined, expression: string): boolean {
  return (
    operation?.kind === 'return' &&
    operation.value.kind === 'value' &&
    operation.value.values.length === 1 &&
    compact(operation.value.values[0]) === compact(expression)
  );
}
export function branch(
  context: DepthContext,
  expression: string,
): Extract<Operation, { readonly kind: 'control' }> | undefined {
  return context.summary?.operations.find(
    (operation): operation is Extract<Operation, { readonly kind: 'control' }> =>
      operation.kind === 'control' &&
      compact(operation.predicate.expression) === compact(expression),
  );
}

export function ambiguousControl(context: DepthContext, guard: Operation): boolean {
  return (
    context.summary?.operations.some(
      (operation) =>
        operation.kind === 'opaque' || (operation.kind === 'control' && operation.id !== guard.id),
    ) === true
  );
}
