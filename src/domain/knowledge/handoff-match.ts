import type {
  ChannelBinding,
  Handoff,
  KnowledgeRecord,
  Shape,
  Subscription,
} from './knowledge.generated';

type ReadRecord = (id: string) => KnowledgeRecord | undefined;

function sameShape(
  get: ReadRecord,
  pair: readonly [string, string],
  seen: ReadonlySet<string>,
): boolean {
  const key = pair.join('/');
  if (seen.has(key)) return true;
  const source = get(pair[0]);
  const target = get(pair[1]);
  if (source?.kind !== 'shape' || target?.kind !== 'shape') return false;
  if (source.encoding !== target.encoding || source.wireType !== target.wireType) return false;
  if (source.completeness !== 'closed' || target.completeness !== 'closed') return false;
  return matchingFields(get, { source, target, seen: new Set([...seen, key]) });
}

function matchingFields(
  get: ReadRecord,
  pair: { readonly source: Shape; readonly target: Shape; readonly seen: ReadonlySet<string> },
): boolean {
  if (pair.source.fields.length !== pair.target.fields.length) return false;
  return pair.source.fields.every((field) => {
    const matched = pair.target.fields.find((candidate) => candidate.wireTag === field.wireTag);
    if (field.wireTag === undefined || matched?.type !== field.type) return false;
    if (field.optional !== matched.optional) return false;
    if (field.shape === undefined) return matched.shape === undefined;
    return matched.shape !== undefined && sameShape(get, [field.shape, matched.shape], pair.seen);
  });
}

function channelMatch(
  publisher: ChannelBinding,
  receiver: ChannelBinding,
  environment: string,
): string | null {
  if (publisher.environment !== environment || receiver.environment !== environment) {
    return 'Environment profile does not match query';
  }
  if (publisher.namespace === null || publisher.channel === null) {
    return 'Channel namespace or name is unresolved';
  }
  if (publisher.namespace !== receiver.namespace || publisher.channel !== receiver.channel) {
    return 'Broker namespace or channel differs';
  }
  return null;
}

function wireMatch(get: ReadRecord, handoff: Handoff, subscription: Subscription): string | null {
  const mismatch = filterMismatch(handoff, subscription);
  if (mismatch !== null) return mismatch;
  const payload = get(subscription.payload);
  if (payload?.kind !== 'value' || payload.shape === null) {
    return 'Consumer wire schema is unresolved';
  }
  const producer = get(handoff.wireShape);
  if (producer?.kind !== 'shape' || producer.wireType !== handoff.messageType) {
    return 'Wire type does not match message type';
  }
  if (producer.encoding !== 'protobuf') {
    return 'Wire compatibility rule is only established for protobuf';
  }
  return sameShape(get, [handoff.wireShape, payload.shape], new Set())
    ? null
    : 'Source wire schemas are not established as matching';
}

function filterMismatch(handoff: Handoff, subscription: Subscription): string | null {
  if (subscription.headerFilter === 'unresolved') return 'Consumer header filter is unresolved';
  if (subscription.headerFilter === 'none') return null;
  if (subscription.header !== handoff.typeHeader) return 'Message type header differs';
  if (subscription.headerFilter === 'present') return null;
  return subscription.messageType === handoff.messageType
    ? null
    : 'Consumer filter does not match message type';
}

/** Matches committed source profiles and schemas; never asserts deployed delivery. */
export function handoffMatch(
  get: ReadRecord,
  handoff: Handoff,
  environment: string,
): string | null {
  const publisher = get(handoff.binding);
  const subscription = get(handoff.subscription);
  if (publisher?.kind !== 'channel_binding' || subscription?.kind !== 'subscription') {
    return 'Missing channel or subscription';
  }
  const receiver = get(subscription.binding);
  if (receiver?.kind !== 'channel_binding') return 'Missing consumer channel binding';
  return channelMatch(publisher, receiver, environment) ?? wireMatch(get, handoff, subscription);
}
