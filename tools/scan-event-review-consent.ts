import type { ScanDocument, SemanticNode } from '@/domain/scan/scan.generated';

import { FIELDS, GUARDS } from './scan-event-review-expectations';
import { nativeConsent } from './scan-event-review-native';
import { profileGraph, profileMethod, type ProfileGraph } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';
import { methodRecipe } from './scan-profile-review-method';
import { descendants, targets } from './scan-semantic-query';

const FILE = 'MarketingConsentEventService';
function guardsBeforeConstruction(
  graph: ProfileGraph,
  statements: readonly SemanticNode[],
  guards: readonly SemanticNode[],
): boolean {
  const indices = statements.flatMap((statement, index) =>
    descendants(graph, statement).some(
      (node) =>
        node.nodeKind === 'call' &&
        targets(graph, node, 'callee').some((callee) =>
          ['buildPayload', 'buildEventMessage'].includes(callee.name ?? ''),
        ),
    )
      ? [index]
      : [],
  );
  return (
    indices.length === 2 &&
    indices.every((index) => guards.every((guard) => statements.indexOf(guard) < index))
  );
}
/** Frozen Q16 source clauses: all recipes are rebuilt from parsed atoms, never display syntax. */
export function consentSourceClauses(document: ScanDocument): Readonly<Record<string, boolean>> {
  const graph = profileGraph(document);
  const publish = profileMethod(graph, FILE, 'publishEvent')[0];
  const statements = targets(graph, targets(graph, publish, 'body')[0], 'statement');
  const guards = statements.filter((node) => node.nodeKind === 'if');
  const sendAt = statements.findIndex(
    (node) =>
      individualRecipe(graph, node) === 'kafkaEventPublisher.sendSafely(kafkaTemplate,message)',
  );
  const guardedSend = sendAt !== -1 && guards.every((guard) => statements.indexOf(guard) < sendAt);
  const orderedGuards =
    guardedSend &&
    guardsBeforeConstruction(graph, statements, guards) &&
    guards.length === GUARDS.length &&
    GUARDS.every(
      (recipe, index) =>
        individualRecipe(graph, targets(graph, guards[index], 'condition')[0]) === recipe,
    );
  return {
    orderedGuards,
    guardExitsAndCurrentIndividual: methodRecipe(graph, [FILE, 'publishEvent'], {
      initializers: { individual: 'updated.individual(Role.SIGNATORY)' },
      branches: GUARDS.map((condition) => ({ condition, exits: true })),
      calls: [
        'buildPayload(individual,updated.market().getCountryCode())',
        'eventBuilder.metadata(buildMetadata(eventType,updated.customerId())).payload(buildPayload(individual,updated.market().getCountryCode())).build()',
        'kafkaEventPublisher.sendSafely(kafkaTemplate,message)',
      ],
    }),
    previousCurrentComparison: methodRecipe(graph, [FILE, 'hasConsentInfoChanged'], {
      initializers: { previousIndividual: 'previous.individual(Role.SIGNATORY)' },
      branches: [
        { condition: 'previous==null', returns: 'true' },
        { condition: 'previousIndividual==null', returns: 'true' },
      ],
      returns: [
        '!Objects.equals(individual.consentInfo(),previousIndividual.consentInfo())||!Objects.equals(individual.cdbId(),previousIndividual.cdbId())',
      ],
    }),
    payloadConstruction: methodRecipe(graph, [FILE, 'buildPayload'], {
      initializers: { consentInfo: 'individual.consentInfo()' },
      returns: [`MarketingConsentEventPayload(${FIELDS.map(([, recipe]) => recipe).join(',')})`],
    }),
    ...nativeConsent(graph),
  };
}
