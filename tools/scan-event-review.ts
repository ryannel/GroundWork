import type { ScanDocument } from '@/domain/scan/scan.generated';

import { consentSourceClauses } from './scan-event-review-consent';
import { saveSourceClauses } from './scan-event-review-save';
import { profileGraph, profileMethod } from './scan-profile-review-graph';
import { individualRecipe } from './scan-profile-review-individual-atoms';

export interface EventQuestionProof {
  readonly supported: boolean;
  readonly clauses: Readonly<Record<string, boolean>>;
  readonly details: readonly string[];
}

function publicationAttempts(document: ScanDocument): boolean {
  const graph = profileGraph(document);
  return [
    ['CustomerEventService', 'publishCustomerEvent', 'sendSafely', 'kafkaTemplate,message'],
    ['AnalyticsEventService', 'publishAnalyticsEvent', 'send', 'message'],
    ['MarketingConsentEventService', 'publishEvent', 'sendSafely', 'kafkaTemplate,message'],
  ].every(([file = '', method = '', operation, arguments_]) => {
    const owner = profileMethod(graph, file, method)[0];
    return (document.bindings ?? []).some((record) => {
      if (record.kind !== 'event_binding' || record.owner_source !== owner?.source) return false;
      const argumentsMatch =
        record.arguments
          .map((argument) => individualRecipe(graph, graph.bySource.get(argument.source)))
          .join(',') === arguments_;
      const callMatches = graph.calls.some(
        (call) => call.call === record.source && record.call_binding_ids.includes(call.id),
      );
      return [
        record.operation === operation,
        argumentsMatch,
        record.gaps.length > 0,
        callMatches,
      ].every(Boolean);
    });
  });
}

/** Whole frozen questions. A source boundary is an answer, never an invented runtime guarantee. */
export function eventQuestionProofs(document: ScanDocument): {
  readonly q15: EventQuestionProof;
  readonly q16: EventQuestionProof;
} {
  const q15 = {
    ...saveSourceClauses(document),
    publicationAttempts: publicationAttempts(document),
  };
  const q16 = consentSourceClauses(document);
  return {
    q15: {
      supported: Object.values(q15).every(Boolean),
      clauses: q15,
      details: [
        'Invocation order is customer, analytics, audit, consent after saved-value rebinding. A synchronous exception prevents later local statements; independently dispatched failures do not have this ordering guarantee. Local return and callback paths do not establish durable writes or broker delivery.',
        'Async annotations and activation/executor declarations require effective Spring interception. Ignored futures do not make callers wait; external sendSafely behaviour and acknowledgement remain unobserved.',
        'The selected methods/classes declare no shared transaction or local catch to compensate the saved customer after a later failure. Independently dispatched work has no source completion ordering guarantee.',
      ],
    },
    q16: {
      supported: Object.values(q16).every(Boolean),
      clauses: q16,
      details: [
        'Disabled/missing Kafka, missing SIGNATORY/CDB ID, missing consent or unchanged consentInfo and CDB ID skip the attempt. A CDB-ID-only change passes the comparison.',
        'Payload carries complete current values. consentGranted maps to consented; dateOfConsent maps to timestamp; countryCode comes from the updated market expression. A unique private source helper candidate joins its arguments and declared parameters; the generated country-code accessor implementation remains unobserved. External codec and broker success remain unobserved.',
      ],
    },
  };
}
