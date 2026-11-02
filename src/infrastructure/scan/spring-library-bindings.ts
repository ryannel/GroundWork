import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaExpressionType } from './java-call-resolution';
import { javaDeclaredType, javaField, javaMethod } from './java-call-syntax';
import { declarationSource } from './java-declaration-parts';
import { resolveJavaType } from './java-declarations';
import type { SyntaxNode } from './source-index-types';
import type { LibraryBinding } from './spring-client-boundary-types';
import {
  outboundFailures,
  outboundProvenance,
  type OutboundInput,
} from './spring-outbound-provenance';
import { outboundArguments, outboundName } from './spring-outbound-syntax';

const JWT_DECODER = 'org.springframework.security.oauth2.jwt.JwtDecoder';

function decoderReceiver(context: JavaBindingContext, receiver: SyntaxNode): boolean {
  if (javaExpressionType(context, receiver) === JWT_DECODER) return true;
  if (
    receiver.kind !== 'METHOD_INVOCATION' ||
    outboundName(context.index, receiver) !== 'computeIfAbsent'
  ) {
    return false;
  }
  const callee = javaField(context.index, receiver, 'callee');
  const map = callee && javaField(context.index, callee, 'receiver');
  const declared = map && javaDeclaredType(context, map);
  if (declared === null) return false;
  return decoderMap(context, declared);
}

function decoderMap(context: JavaBindingContext, declared: string): boolean {
  const start = declared.indexOf('<');
  if (start === -1 || !declared.endsWith('>')) return false;
  const parts = declared
    .slice(start + 1, -1)
    .split(',')
    .map((part) => part.trim());
  const value = parts[1];
  return (
    parts.length === 2 &&
    value !== undefined &&
    ['java.util.Map', 'java.util.concurrent.ConcurrentMap'].includes(
      resolveJavaType(declared.slice(0, start), context.unit),
    ) &&
    resolveJavaType(value, context.unit) === JWT_DECODER
  );
}

function libraryBinding(
  context: JavaBindingContext,
  call: SyntaxNode,
  input: OutboundInput,
): LibraryBinding | null {
  if (outboundName(context.index, call) !== 'decode') return null;
  const callee = javaField(context.index, call, 'callee');
  const receiver = callee && javaField(context.index, callee, 'receiver');
  const method = javaMethod(context.index, call);
  if (!receiver || !method || !decoderReceiver(context, receiver)) return null;
  const source = declarationSource(context.index, call);
  const owner = declarationSource(context.index, method);
  const provenance = outboundProvenance(input, owner, {
    type: JWT_DECODER,
    receiver_source: declarationSource(context.index, receiver),
    logical_name: null,
    registry_source: null,
  });
  return {
    kind: 'library_binding',
    id: `library:${source}`,
    source,
    owner_source: owner,
    owner_type: JWT_DECODER,
    method_name: 'decode',
    call_source: source,
    receiver_source: declarationSource(context.index, receiver),
    argument_sources: outboundArguments(context.index, call),
    result_type: 'org.springframework.security.oauth2.jwt.Jwt',
    contract_basis: 'framework_api',
    failure_paths: outboundFailures(context, call),
    call_binding_ids: provenance.calls.map((binding) => binding.id),
    value_binding_ids: provenance.values.map((binding) => binding.id),
    support: [owner, source, declarationSource(context.index, receiver)],
    completeness: 'partial',
    gaps: [
      'The declared JwtDecoder API is an in-process library boundary; its implementation, decoder factory selection, discovery/JWK requests, network timing, caching and effective configuration are unobserved.',
      ...(provenance.complete ? [] : ['The bounded local method traversal reached its limit.']),
    ],
  };
}

/** Record supported framework API contracts without claiming their external runtime behaviour. */
export function collectLibraryBindings(input: OutboundInput): readonly LibraryBinding[] {
  return input.indexes.flatMap((index) => {
    const unit = input.units.find((candidate) => candidate.path === index.path);
    if (!unit || index.diagnostics.length > 0) return [];
    const context = { index, unit, units: input.units };
    return index.nodes
      .filter((node) => node.kind === 'METHOD_INVOCATION')
      .flatMap((node) => {
        const result = libraryBinding(context, node, input);
        return result ? [result] : [];
      });
  });
}
