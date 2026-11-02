import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { javaCallSite, javaExpressionType } from './java-call-resolution';
import { javaAncestors, javaMethod } from './java-call-syntax';
import { declarationSource } from './java-declaration-parts';
import type { SyntaxNode } from './source-index-types';
import { eventHelperCandidates, privateEventHelper } from './spring-event-helper';
import {
  eventBuilders,
  eventComparisons,
  eventConditions,
  eventConstructions,
} from './spring-event-relations';
import type { EventBinding } from './spring-event-types';
import { outboundFailures, type OutboundInput } from './spring-outbound-provenance';

const SDK = 'com.volvocars.ecom.kafka.producer.KafkaEventPublisher';
const KAFKA = 'org.springframework.kafka.core.KafkaTemplate';

function operation(
  type: string,
  name: string,
): { readonly contract: EventBinding['contract']; readonly roles: readonly string[] } | null {
  if (type === SDK && name === 'buildEventMessage') {
    return {
      contract: 'external_sdk_source',
      roles: ['topic_selector', 'key', 'event', 'version', 'producer'],
    };
  }
  if (type === SDK && name === 'sendSafely') {
    return { contract: 'external_sdk_source', roles: ['template', 'message'] };
  }
  if (type.startsWith(`${KAFKA}<`) || type === KAFKA) {
    if (name === 'send') return { contract: 'spring_kafka', roles: [] };
    if (name === 'sendDefault') return { contract: 'spring_kafka', roles: [] };
  }
  return null;
}

function methodSources(input: OutboundInput, owner: string): ReadonlySet<string> {
  const selected = new Set([owner]);
  for (let pass = 0; pass < 64; pass++) {
    const next = input.calls.filter(
      (call) =>
        call.caller !== null &&
        selected.has(call.caller) &&
        call.target !== null &&
        !selected.has(call.target),
    );
    const candidates = input.calls
      .filter((call) => call.caller !== null && selected.has(call.caller) && call.target === null)
      .flatMap((call) => {
        const candidate = privateEventHelper(input, call);
        return candidate === null || selected.has(candidate) ? [] : [candidate];
      });
    if (next.length === 0 && candidates.length === 0) break;
    for (const call of next) if (call.target !== null) selected.add(call.target);
    for (const candidate of candidates) selected.add(candidate);
  }
  return selected;
}

function observation(
  context: JavaBindingContext,
  node: SyntaxNode,
): EventBinding['result_observation'] {
  const parent = node.parent === null ? undefined : context.index.nodes[node.parent];
  if (parent?.kind === 'EXPRESSION_STATEMENT') return 'discarded';
  if (parent?.kind === 'RETURN') return 'returned';
  if (parent && ['VARIABLE', 'ASSIGNMENT'].includes(parent.kind)) return 'assigned';
  return 'composed';
}

function binding(
  input: OutboundInput,
  context: JavaBindingContext,
  node: SyntaxNode,
): EventBinding | null {
  const site = javaCallSite(context, node);
  const contract =
    site.receiverType === null ? null : operation(site.receiverType, site.methodName);
  const owner = javaMethod(context.index, node);
  if (!contract || !owner || !site.receiver || site.receiverType === null) return null;
  const ownerSource = declarationSource(context.index, owner);
  const owners = methodSources(input, ownerSource);
  const calls = input.calls.filter((call) => call.caller !== null && owners.has(call.caller));
  const selected = selectNodes(input, owners);
  return makeBinding({ input, context, node, site, contract, ownerSource, calls, selected });
}

interface Selection {
  readonly context: JavaBindingContext;
  readonly nodes: readonly SyntaxNode[];
}

function selectNodes(input: OutboundInput, owners: ReadonlySet<string>): readonly Selection[] {
  return input.indexes.flatMap((index) => {
    const unit = input.units.find((entry) => entry.path === index.path);
    if (!unit || index.diagnostics.length > 0) return [];
    const nodes = index.nodes.filter((entry) => {
      const method = javaMethod(index, entry);
      // Nested callbacks are separate executions, not an enclosing method's immediate work.
      return (
        method !== undefined &&
        owners.has(declarationSource(index, method)) &&
        !javaAncestors(index, entry).some((ancestor) => ancestor.kind === 'LAMBDA_EXPRESSION')
      );
    });
    return [{ context: { index, unit, units: input.units }, nodes }];
  });
}

function structure(selected: readonly Selection[]) {
  const sources = new Set(
    selected.flatMap(({ context: current, nodes }) =>
      nodes.map((entry) => declarationSource(current.index, entry)),
    ),
  );
  return {
    sources,
    constructions: selected.flatMap(({ context: current, nodes }) =>
      eventConstructions(
        current,
        nodes,
        selected.map((entry) => entry.context),
      ),
    ),
    builder_calls: selected.flatMap(({ context: current, nodes }) => eventBuilders(current, nodes)),
    conditions: selected.flatMap(({ context: current, nodes }) => eventConditions(current, nodes)),
    comparisons: selected.flatMap(({ context: current, nodes }) =>
      eventComparisons(current, nodes),
    ),
  };
}

interface EventDetails {
  readonly input: OutboundInput;
  readonly context: JavaBindingContext;
  readonly node: SyntaxNode;
  readonly site: ReturnType<typeof javaCallSite>;
  readonly contract: NonNullable<ReturnType<typeof operation>>;
  readonly ownerSource: string;
  readonly calls: OutboundInput['calls'];
  readonly selected: readonly Selection[];
}

function eventSupport(selected: readonly Selection[]): readonly string[] {
  return selected.flatMap(({ context, nodes }) =>
    nodes
      .filter((entry) => ['IF', 'NEW_CLASS', 'RETURN', 'METHOD_INVOCATION'].includes(entry.kind))
      .map((entry) => declarationSource(context.index, entry)),
  );
}

function makeBinding(details: EventDetails): EventBinding {
  const { input, context, node, site, contract, ownerSource, calls, selected } = details;
  const source = declarationSource(context.index, node);
  const relations = structure(selected);
  const candidates = eventHelperCandidates(input, calls);
  return {
    kind: 'event_binding',
    id: `event:${source}`,
    source,
    owner_source: ownerSource,
    client: {
      type: site.receiverType ?? 'unresolved',
      receiver_source: declarationSource(context.index, site.receiver ?? node),
    },
    operation: site.methodName,
    contract: contract.contract,
    arguments: site.arguments.map((argument, position) => ({
      position,
      role: contract.roles.at(position) ?? 'unresolved_overload_argument',
      source: declarationSource(context.index, argument),
      type: javaExpressionType(context, argument),
    })),
    candidate_helpers: candidates,
    constructions: relations.constructions,
    builder_calls: relations.builder_calls,
    conditions: relations.conditions,
    comparisons: relations.comparisons,
    selectors: calls.map((call) => ({
      source: call.call,
      receiver_type: call.receiverType,
      operation: call.methodName,
      target_source: call.target,
    })),
    result_observation: observation(context, node),
    failure_paths: outboundFailures(context, node),
    call_binding_ids: calls.map((call) => call.id),
    value_binding_ids: input.values
      .filter((value) => relations.sources.has(value.from) || relations.sources.has(value.to))
      .map((value) => value.id),
    support: [
      ...new Set([
        source,
        ownerSource,
        ...eventSupport(selected),
        ...candidates.flatMap((candidate) => [
          candidate.call_source,
          candidate.target_source,
          ...candidate.argument_sources,
          ...candidate.parameter_sources,
        ]),
      ]),
    ],
    completeness: 'partial',
    gaps: [
      'External publisher implementation, effective wire codec, headers, broker delivery and durable acknowledgement are unobserved. Source operation names do not establish those semantics.',
      'Method-local source closure retains construction candidates; effective runtime object selection and configuration remain unresolved.',
    ],
  };
}

/** Recognise typed publisher calls; retain native construction, control and shared value provenance. */
export function collectEventBindings(input: OutboundInput): readonly EventBinding[] {
  return input.indexes.flatMap((index) => {
    const unit = input.units.find((entry) => entry.path === index.path);
    if (!unit || index.diagnostics.length > 0) return [];
    const context = { index, unit, units: input.units };
    return index.nodes
      .filter((node) => node.kind === 'METHOD_INVOCATION')
      .flatMap((node) => {
        const result = binding(input, context, node);
        return result ? [result] : [];
      });
  });
}
