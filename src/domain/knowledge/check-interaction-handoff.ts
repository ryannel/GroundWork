import type { Interaction, KnowledgeRecord } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;
function messageContract(
  record: Interaction,
  handoff: Extract<KnowledgeRecord, { readonly kind: 'handoff' }>,
  byId: Records,
): string[] {
  const contract = byId.get(record.contract);
  if (contract?.kind !== 'interface_contract') return [];
  const message = contract.request.find((part) => part.part === 'message');
  const subscription = byId.get(handoff.subscription);
  const payload =
    subscription?.kind === 'subscription' ? byId.get(subscription.payload) : undefined;
  const shape = payload?.kind === 'value' ? payload.shape : null;
  return message?.shape === handoff.wireShape || (shape !== null && message?.shape === shape)
    ? []
    : [`${record.id}: handoff requires its producer or consumer message schema`];
}
export function interactionHandoffProblems(record: Interaction, byId: Records): string[] {
  if (record.handoff === null) return [];
  const handoff = byId.get(record.handoff);
  if (handoff?.kind !== 'handoff') return [];
  if (record.mode === 'publish') {
    return handoff.effect === record.effect && handoff.owner === record.owner
      ? messageContract(record, handoff, byId)
      : [`${record.id}: publication must match its handoff producer`];
  }
  if (record.mode !== 'consume') {
    return [`${record.id}: only publication and consumption interactions bind handoffs`];
  }
  return consumptionProblems(record, handoff, byId);
}

function consumptionProblems(
  record: Interaction,
  handoff: Extract<KnowledgeRecord, { readonly kind: 'handoff' }>,
  byId: Records,
): string[] {
  const subscription = byId.get(handoff.subscription);
  if (subscription?.kind !== 'subscription' || subscription.owner !== record.owner) {
    return [`${record.id}: consumption must execute its handoff subscription`];
  }
  const channel = byId.get(subscription.binding);
  if (channel?.kind !== 'channel_binding') return [];
  const bound = [...byId.values()].some(
    (item) =>
      item.kind === 'resource_binding' &&
      item.resource === channel.resource &&
      item.component === record.target &&
      item.role === 'transport',
  );
  return bound
    ? messageContract(record, handoff, byId)
    : [`${record.id}: consumption requires its subscriber channel component`];
}
