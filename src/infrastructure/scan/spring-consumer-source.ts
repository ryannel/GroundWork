import 'server-only';

import type { CallBinding } from './java-call-binding-types';
import { javaAncestors } from './java-call-syntax';
import { javaMethods } from './java-call-types';
import { declarationChildren, declarationSource } from './java-declaration-parts';
import type { JavaUnit } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import type { ConsumerBinding } from './spring-consumer-types';
import type { OutboundInput } from './spring-outbound-provenance';

interface Selection {
  readonly index: SourceIndex;
  readonly unit: JavaUnit;
  readonly node: SyntaxNode;
}
type Candidate = ConsumerBinding['candidate_helpers'][number];

export function consumerNode(input: OutboundInput, source: string): Selection | null {
  for (const index of input.indexes) {
    const node = index.nodes.find((entry) => declarationSource(index, entry) === source);
    const unit = input.units.find((entry) => entry.path === index.path);
    if (node && unit && index.diagnostics.length === 0) return { index, unit, node };
  }
  return null;
}

export function consumerArguments(input: OutboundInput, call: CallBinding): readonly string[] {
  const selected = consumerNode(input, call.call);
  return selected
    ? declarationChildren(selected.index, selected.node, 'arguments').map((node) =>
        declarationSource(selected.index, node),
      )
    : [];
}

/** A nominal receiver and unique concrete declaration establish only a source candidate. */
function consumerCandidate(input: OutboundInput, call: CallBinding): Candidate | null {
  if (call.target !== null || call.receiverType === null || !call.argumentTypes.includes(null)) {
    return null;
  }
  const selected = consumerNode(input, call.call);
  if (!selected) return null;
  const targets = javaMethods({ ...selected, units: input.units }, call.receiverType).filter(
    (target) =>
      target.method.name === call.methodName &&
      target.parameters.length === call.argumentTypes.length,
  );
  const target = targets.length === 1 ? targets[0] : undefined;
  if (
    target?.method.body === undefined ||
    target.method.body === null ||
    target.method.parameters.some((parameter) => parameter.type.includes('...')) ||
    call.argumentTypes.some(
      (actual, position) => actual !== null && actual !== target.parameters[position],
    )
  ) {
    return null;
  }
  return {
    call_source: call.call,
    target_source: target.method.source,
    argument_sources: consumerArguments(input, call),
    parameter_sources: target.method.parameters.map((parameter) => parameter.source),
    resolution: 'nominal_source_candidate',
  };
}

export function consumerDeferred(index: SourceIndex, node: SyntaxNode): boolean {
  const owner = javaAncestors(index, node).find((ancestor) =>
    ['METHOD', 'LAMBDA_EXPRESSION', 'CLASS', 'INTERFACE', 'ENUM', 'RECORD'].includes(ancestor.kind),
  );
  return owner?.kind !== 'METHOD';
}

function directCalls(input: OutboundInput, owners: ReadonlySet<string>): readonly CallBinding[] {
  return input.calls.filter((call) => {
    if (call.caller === null || !owners.has(call.caller)) return false;
    const selected = consumerNode(input, call.call);
    return selected !== null && !consumerDeferred(selected.index, selected.node);
  });
}

const MAPPERS = new Set([
  'tools.jackson.databind.json.JsonMapper',
  'com.fasterxml.jackson.databind.ObjectMapper',
  'com.fasterxml.jackson.databind.json.JsonMapper',
]);

export function consumerMapperCall(call: CallBinding): boolean {
  return call.methodName === 'readValue' && MAPPERS.has(call.receiverType ?? '');
}

function synchronousMethods(input: OutboundInput, source: string): ReadonlySet<string> {
  const owner = input.units
    .flatMap((unit) => unit.types)
    .find((type) => type.methods.some((method) => method.source === source));
  if (!owner) return new Set();
  return new Set(
    owner.methods
      .filter(
        (method) =>
          method.body !== null &&
          ![...owner.annotations, ...method.annotations].some(
            (annotation) => annotation.name === 'org.springframework.scheduling.annotation.Async',
          ),
      )
      .map((method) => method.source),
  );
}

function localTargets(input: OutboundInput, calls: readonly CallBinding[]): readonly string[] {
  return calls.flatMap((call) => {
    const target =
      call.resolution === 'exact' ? call.target : consumerCandidate(input, call)?.target_source;
    return target === null || target === undefined ? [] : [target];
  });
}

/** Only the listener's lexical synchronous helper bodies and immediate typed Jackson decoders aggregate here.
 * Application-service targets and deferred/async continuations remain separately navigable shared records. */
export function consumerClosure(
  input: OutboundInput,
  source: string,
): { readonly owners: ReadonlySet<string>; readonly candidates: readonly Candidate[] } {
  const lexical = synchronousMethods(input, source);
  const localOwners = new Set([source]);
  let before = -1;
  while (before !== localOwners.size) {
    before = localOwners.size;
    for (const target of localTargets(input, directCalls(input, localOwners))) {
      if (lexical.has(target)) localOwners.add(target);
    }
  }
  const localCalls = directCalls(input, localOwners);
  const exactTargets = new Set(
    localCalls
      .filter((call) => call.resolution === 'exact' && call.target !== null)
      .map((call) => call.target),
  );
  const decoderOwners = input.calls
    .filter(consumerMapperCall)
    .flatMap((call) =>
      call.caller !== null &&
      exactTargets.has(call.caller) &&
      synchronousMethods(input, call.caller).has(call.caller)
        ? [call.caller]
        : [],
    );
  const owners = new Set([...localOwners, ...decoderOwners]);
  const candidates = directCalls(input, owners).flatMap((call) => {
    const candidate = consumerCandidate(input, call);
    return candidate === null ? [] : [candidate];
  });
  return { owners, candidates };
}
