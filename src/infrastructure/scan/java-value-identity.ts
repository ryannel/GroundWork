import 'server-only';

import type { ValueBinding } from './java-call-binding-types';

function valueSignature(binding: ValueBinding): string {
  return JSON.stringify([
    binding.kind,
    binding.relation,
    binding.from,
    binding.to,
    binding.call,
    binding.guards,
  ]);
}

/** Repeated source projections can agree exactly; conflicting evidence must never be discarded. */
export function distinctJavaValues(bindings: readonly ValueBinding[]): ValueBinding[] {
  const selected = new Map<string, ValueBinding>();
  for (const binding of bindings) {
    const previous = selected.get(binding.id);
    if (previous && valueSignature(previous) !== valueSignature(binding)) {
      throw new Error(`Conflicting Java value binding identity: ${binding.id}`);
    }
    if (!previous) selected.set(binding.id, binding);
  }
  return [...selected.values()];
}
