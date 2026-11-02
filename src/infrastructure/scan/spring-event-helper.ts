import 'server-only';

import type { CallBinding, JavaBindingContext } from './java-call-binding-types';
import { javaCallSite } from './java-call-resolution';
import { javaOwner } from './java-call-syntax';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { SyntaxNode } from './source-index-types';
import type { EventBinding } from './spring-event-types';
import type { OutboundInput } from './spring-outbound-provenance';

/** A source-only private helper candidate when unknown actual types prevent the shared exact join. */
export function privateEventHelper(input: OutboundInput, call: CallBinding): string | null {
  for (const index of input.indexes) {
    const node = index.nodes.find((entry) => declarationSource(index, entry) === call.call);
    const unit = input.units.find((entry) => entry.path === index.path);
    if (!node || !unit) continue;
    return sourceCandidate({ index, unit, units: input.units }, node);
  }
  return null;
}

function sourceCandidate(context: JavaBindingContext, node: SyntaxNode): string | null {
  const { index } = context;
  const site = javaCallSite(context, node);
  if (site.receiver !== null && site.receiver.text !== 'this') return null;
  const owner = javaOwner(index, node);
  if (!owner) return null;
  const candidates = declarationChildren(index, owner, 'members').filter(
    (member) =>
      member.kind === 'METHOD' &&
      member.symbol === site.methodName &&
      declarationChildren(index, member, 'parameters').length === site.arguments.length,
  );
  const candidate = candidates.length === 1 ? candidates[0] : undefined;
  if (
    candidate &&
    declarationChildren(index, candidate, 'parameters').some((parameter) =>
      parameter.text.includes('...'),
    )
  ) {
    return null;
  }
  return candidate?.modifiers?.includes('private') === true
    ? declarationSource(index, candidate)
    : null;
}

/** Candidate-qualified actual/formal joins never replace shared exact call/value bindings. */
export function eventHelperCandidates(
  input: OutboundInput,
  calls: readonly CallBinding[],
): EventBinding['candidate_helpers'] {
  return calls
    .filter((call) => call.target === null)
    .flatMap((call) => {
      const target = privateEventHelper(input, call);
      if (target === null) return [];
      for (const index of input.indexes) {
        const node = index.nodes.find((entry) => declarationSource(index, entry) === call.call);
        const method = index.nodes.find((entry) => declarationSource(index, entry) === target);
        if (!node || !method) continue;
        return [
          {
            call_source: call.call,
            target_source: target,
            argument_sources: declarationChildren(index, node, 'arguments').map((entry) =>
              declarationSource(index, entry),
            ),
            parameter_sources: declarationChildren(index, method, 'parameters').map((entry) =>
              declarationSource(index, entry),
            ),
            resolution: 'source_candidate' as const,
          },
        ];
      }
      return [];
    });
}
